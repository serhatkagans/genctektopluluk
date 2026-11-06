"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { GorevRolKodu } from "@/generated/prisma/enums";
import { oturumKullanicisiZorunlu } from "@/lib/auth/oturum";
import { prisma } from "@/lib/db";
import { GOREV_ROL_ETIKETLERI } from "@/lib/yetki/etiketler";
import {
  ilceTemsilcisiAtayabilirMi,
  calismaGrubuYoneticisiAtayabilirMi,
  ilTemsilcisiAtayabilirMi,
  okulTemsilcisiAtayabilirMi,
} from "@/lib/yetki/izinler";
import { ogrenciKapsamFiltresi } from "@/lib/yetki/kapsam";
import { erisimLogla } from "@/lib/yetki/log";
import { BulunamadiHatasi, YetkiHatasi } from "@/lib/yetki/tipler";

/**
 * Öğrenci görev rolü atama ve kaldırma.
 *
 * Bu roller HİÇBİR ek veri görüntüleme yetkisi vermez (permissions.md Bölüm 5);
 * dönem bazlı bir görev etiketidir. Tekillik (il/ilçe/okul başına bir temsilci)
 * veritabanı kısmi unique index'leriyle korunur — buradaki kontrol yalnızca
 * kullanıcıya anlamlı mesaj vermek içindir.
 */

const YOL = "/panel/gorev-rolleri";

const GOREV_ROLLERI: GorevRolKodu[] = [
  "IL_TEMSILCISI",
  "ILCE_TEMSILCISI",
  "OKUL_TEMSILCISI",
  "CALISMA_GRUBU_YONETICISI",
];

/**
 * İşlem sonrası dönülecek adres.
 *
 * Okul Temsilcisi ataması Öğrencilerim ekranına taşındı (J2 · 5 Ağustos 2026)
 * ama il ve ilçe ataması Görev Rolleri ekranında kaldı; aynı eylem iki yerden
 * çağrılıyor. Değer FORMDAN geldiği için serbest bırakılamaz — açık yönlendirme
 * açığı doğar. İki ekranda da filtreler korunsun diye sorgu dizesi taşınıyor
 * (Görev Rolleri'ne süzgeç eklendi · 12 Ağustos 2026), ama YALNIZCA bilinen
 * önek doğrulandıktan sonra: eşleşme "/panel/... " ile başlayıp hemen ardından
 * `?` gelmesini şart koşuyor, yani `//baska-site` gibi bir değer geçemez.
 */
const IZINLI_ONEKLER = [YOL, "/panel/ogrenciler"] as const;

function donusYolunuCoz(veri: FormData): string {
  const istenen = String(veri.get("donusYolu") ?? "");
  for (const onek of IZINLI_ONEKLER) {
    if (istenen === onek || istenen.startsWith(`${onek}?`)) return istenen;
  }
  return YOL;
}

/** Adrese durum/hata parametresi ekler; mevcut sorgu dizesini bozmadan. */
function parametreEkle(yol: string, anahtar: string, deger: string): string {
  const ayrac = yol.includes("?") ? "&" : "?";
  return `${yol}${ayrac}${anahtar}=${encodeURIComponent(deger)}`;
}

function hataylaDon(yol: string, mesaj: string): never {
  redirect(parametreEkle(yol, "hata", mesaj));
}

export async function gorevRoluAtaEylemi(veri: FormData): Promise<void> {
  const kullanici = await oturumKullanicisiZorunlu();
  const donusYolu = donusYolunuCoz(veri);

  const ogrenciId = Number.parseInt(String(veri.get("ogrenciId") ?? ""), 10);
  const rolKodu = String(veri.get("rolKodu") ?? "") as GorevRolKodu;
  if (!Number.isFinite(ogrenciId)) throw new BulunamadiHatasi();
  if (!GOREV_ROLLERI.includes(rolKodu)) {
    throw new BulunamadiHatasi("Geçersiz görev rolü.");
  }

  /*
   * Öğrenci merkezi kapsam filtresinden çekilir: kapsamı dışındaki bir
   * öğrencinin id'sini forma yazan kullanıcı burada boş sonuç alır. Rol
   * kontrolü tek başına yetmez, "bu öğrenci onun ilinde/okulunda mı" da
   * sorulmalıdır.
   */
  const ogrenci = await prisma.kullanici.findFirst({
    where: {
      AND: [{ id: ogrenciId }, ogrenciKapsamFiltresi(kullanici)],
    },
    select: {
      id: true,
      ad: true,
      soyad: true,
      ilKodu: true,
      ilceKodu: true,
      kurumKodu: true,
      // Okul temsilcisi kapısı okulun ilini sorar (kaldırmayla aynı kaynak).
      kurum: { select: { ilKodu: true } },
      egitimOgretimYili: true,
      /*
       * "Bu benim öğrencim mi" — Okul Temsilcisi yetkisi buna bağlı
       * (10 Ağustos 2026). Danışman öğretmen okulundaki danışmansız
       * öğrencileri de görüyor; gördüğü herkese görev verememeli.
       */
      ogrenciAtamalari: {
        where: { bitisTarihi: null, danismanKullaniciId: kullanici.id },
        select: { id: true },
      },
    },
  });
  if (!ogrenci) throw new BulunamadiHatasi();

  const kendiOgrencisi = ogrenci.ogrenciAtamalari.length > 0;

  /*
   * Görevin kapsamı öğrencinin KAYITLI YERİNDEN alınıp kayda YAZILIR. İlçe
   * temsilciliğinin yetkisi ilçenin değil ilin koordinatöründedir: sistemde
   * ilçe düzeyinde görevli yoktur, ilçe ilin içindeki bir basamaktır.
   */
  const kapsam: {
    ilKodu: string | null;
    ilceKodu: string | null;
    kurumKodu: number | null;
    calismaGrubuId: number | null;
  } = { ilKodu: null, ilceKodu: null, kurumKodu: null, calismaGrubuId: null };

  /*
   * ÇALIŞMA GRUBU YÖNETİCİSİ (7 Ağustos 2026) diğer üçünden önce ele alınıyor
   * çünkü kapsamı bir YER değil bir GRUP: öğrencinin kayıtlı ilinden/okulundan
   * türetilemez, formdan gelen grup kimliğiyle belirlenir.
   *
   * YETKİ YALNIZCA MERKEZDE (11 Ağustos 2026 · istek: "koordinatör öğrenciyi
   * çalışma grubu yöneticisi yapamasın"). Önceden İl Temsilcisi ile aynı
   * kapıdan geçiyordu; gerekçesi "atama kararı ilin" idi ve o gerekçe çalışma
   * grubunda tutmuyor — grup ülke geneli bir yapı
   * (bkz. calismaGrubuYoneticisiAtayabilirMi).
   */
  if (rolKodu === "CALISMA_GRUBU_YONETICISI") {
    /*
      ÖĞRENCİNİN İLİ DE SORULUYOR (26 Ağustos 2026): il koordinatörü kendi
      ilindeki öğrenciye bu görevi verebiliyor (bkz.
      calismaGrubuYoneticisiAtayabilirMi). Değer geçilmezse kapı yalnızca
      merkeze açık kalır.
    */
    if (!calismaGrubuYoneticisiAtayabilirMi(kullanici, ogrenci.ilKodu)) {
      throw new YetkiHatasi(
        "Bu öğrenciye Çalışma Grubu Temsilcisi görevi verme yetkiniz yok: görev merkeze ve öğrencinin ilinin koordinatörüne açıktır.",
      );
    }
    const grupId = Number.parseInt(String(veri.get("calismaGrubuId") ?? ""), 10);
    if (!Number.isFinite(grupId)) {
      hataylaDon(donusYolu, "Çalışma grubu seçilmedi.");
    }
    /*
     * Grup VERİTABANINDAN doğrulanıyor: form girdisine güvenilseydi kapatılmış
     * ya da hiç var olmayan bir gruba yönetici atanabilirdi.
     */
    const grup = await prisma.calismaGrubu.findFirst({
      where: { id: grupId, aktif: true },
      select: { id: true },
    });
    if (!grup) hataylaDon(donusYolu, "Seçilen çalışma grubu bulunamadı.");
    kapsam.calismaGrubuId = grup.id;
  } else if (rolKodu === "IL_TEMSILCISI") {
    if (!ogrenci.ilKodu || !ilTemsilcisiAtayabilirMi(kullanici, ogrenci.ilKodu)) {
      throw new YetkiHatasi("Bu ilde İl Temsilcisi atama yetkiniz yok.");
    }
    kapsam.ilKodu = ogrenci.ilKodu;
  } else if (rolKodu === "ILCE_TEMSILCISI") {
    if (
      !ogrenci.ilceKodu ||
      !ogrenci.ilKodu ||
      !ilceTemsilcisiAtayabilirMi(kullanici, ogrenci.ilKodu)
    ) {
      throw new YetkiHatasi("Bu ilçede İlçe Temsilcisi atama yetkiniz yok.");
    }
    kapsam.ilceKodu = ogrenci.ilceKodu;
  } else if (
    !ogrenci.kurumKodu ||
    /*
     * OKULUN İLİ DE SORULUYOR (26 Ağustos 2026): il koordinatörü kendi
     * ilindeki okula temsilci atayabiliyor (bkz. okulTemsilcisiAtayabilirMi).
     * Dördüncü değer geçilmezse o kapı hiç açılmaz.
     */
    /*
     * İL, ÖĞRENCİNİN DEĞİL OKULUN KAYDINDAN (6 Kasım 2026 · güvenlik
     * incelemesi). Kaldırma okulun ilini soruyordu, atama öğrencininkini; iki
     * kayıt ayrışırsa koordinatör başka ildeki bir okula temsilci atayabilirdi.
     */
    !okulTemsilcisiAtayabilirMi(
      kullanici,
      ogrenci.kurumKodu,
      kendiOgrencisi,
      ogrenci.kurum?.ilKodu ?? null,
    )
  ) {
    throw new YetkiHatasi(
      "Bu öğrenciye Okul Temsilcisi görevi verme yetkiniz yok: danışmanlığınızdaki öğrencilere ya da kendi ilinizdeki okullara verilebilir.",
    );
  } else {
    kapsam.kurumKodu = ogrenci.kurumKodu;
  }

  const mevcut = await prisma.ogrenciGorevRolu.findFirst({
    where: {
      rolKodu,
      egitimOgretimYili: ogrenci.egitimOgretimYili,
      ...(rolKodu === "IL_TEMSILCISI"
        ? { ilKodu: kapsam.ilKodu }
        : rolKodu === "ILCE_TEMSILCISI"
          ? { ilceKodu: kapsam.ilceKodu }
          : rolKodu === "CALISMA_GRUBU_YONETICISI"
            ? { calismaGrubuId: kapsam.calismaGrubuId }
            : { kurumKodu: kapsam.kurumKodu }),
    },
    select: { id: true, ogrenci: { select: { ad: true, soyad: true } } },
  });

  if (mevcut) {
    hataylaDon(
      donusYolu,
      `Bu dönem için ${GOREV_ROL_ETIKETLERI[rolKodu]} görevi zaten ${mevcut.ogrenci.ad} ${mevcut.ogrenci.soyad} üzerinde. Önce mevcut görevi kaldırın.`,
    );
  }

  await prisma.ogrenciGorevRolu.create({
    data: {
      ogrenciId: ogrenci.id,
      rolKodu,
      egitimOgretimYili: ogrenci.egitimOgretimYili,
      ilKodu: kapsam.ilKodu,
      ilceKodu: kapsam.ilceKodu,
      kurumKodu: kapsam.kurumKodu,
      calismaGrubuId: kapsam.calismaGrubuId,
      atayanKullaniciId: kullanici.id,
    },
  });

  await erisimLogla({
    kullaniciId: kullanici.id,
    islem: "DEGISIKLIK",
    hedefTip: "ROL",
    hedefId: ogrenci.id,
    detay: `${GOREV_ROL_ETIKETLERI[rolKodu]} görevi verildi: ${ogrenci.ad} ${ogrenci.soyad}`,
  });

  revalidatePath(YOL);
  revalidatePath("/panel/ogrenciler");
  revalidatePath("/panel");
  redirect(parametreEkle(donusYolu, "durum", "atandi"));
}

export async function gorevRoluKaldirEylemi(veri: FormData): Promise<void> {
  const kullanici = await oturumKullanicisiZorunlu();
  const donusYolu = donusYolunuCoz(veri);

  const gorevId = Number.parseInt(String(veri.get("gorevId") ?? ""), 10);
  if (!Number.isFinite(gorevId)) throw new BulunamadiHatasi();

  const gorev = await prisma.ogrenciGorevRolu.findUnique({
    where: { id: gorevId },
    select: {
      id: true,
      rolKodu: true,
      ilKodu: true,
      kurumKodu: true,
      /*
       * OKUL TEMSİLCİLİĞİNİN KALDIRILMASI DA OKULUN İLİNİ SORAR: görevi
       * verebilen kişi kaldırabilmeli ve koordinatörün kapısı ile açılıyor.
       * İl, görevin KENDİ kurum kaydından okunuyor — öğrenci dönem içinde
       * başka ile taşınmış olabilir, görev ise verildiği yerde durur.
       */
      kurum: { select: { ilKodu: true } },
      ogrenci: {
        select: {
          id: true,
          ad: true,
          soyad: true,
          /* Çalışma grubu temsilciliğinin kaldırılması öğrencinin iline bakar. */
          ilKodu: true,
          // Kaldırma yetkisi de "kendi öğrencisi mi" sorusuna bağlı: görevi
          // veremeyen kişi kaldıramaz da.
          ogrenciAtamalari: {
            where: { bitisTarihi: null, danismanKullaniciId: kullanici.id },
            select: { id: true },
          },
        },
      },
      // İlçe temsilciliğinin yetkisi ilçenin BAĞLI OLDUĞU İLDEN sorulur;
      // öğrencinin güncel ilinden değil, çünkü öğrenci dönem içinde taşınmış
      // olabilir ve görev verildiği yerde durur.
      ilce: { select: { ilKodu: true } },
    },
  });
  if (!gorev) throw new BulunamadiHatasi();

  /*
   * ÇALIŞMA GRUBU YÖNETİCİLİĞİ AYRI DALDA (11 Ağustos 2026).
   *
   * Daha önce kendi dalı yoktu ve son `else`e düşüyordu: o dal
   * `gorev.kurumKodu !== null` istiyor, oysa bu görevin kapsamı bir OKUL değil
   * bir GRUP ve `kurumKodu` alanı NULL kalıyor. Sonuç, kimsenin fark etmediği
   * bir kilit — görev atanabiliyor ama PROJE YÖNETİCİSİ DAHİL hiç kimse
   * kaldıramıyordu, "Bu görevi kaldırma yetkiniz yok" diyerek.
   *
   * Kural ekranın kendi ilkesiyle aynı: "görevi veremeyen kişi kaldıramaz da".
   * Atama artık yalnızca merkezde olduğuna göre kaldırma da öyle.
   */
  const yetkili =
    gorev.rolKodu === "IL_TEMSILCISI"
      ? gorev.ilKodu !== null &&
        ilTemsilcisiAtayabilirMi(kullanici, gorev.ilKodu)
      : gorev.rolKodu === "ILCE_TEMSILCISI"
        ? gorev.ilce !== null &&
          ilceTemsilcisiAtayabilirMi(kullanici, gorev.ilce.ilKodu)
        : gorev.rolKodu === "CALISMA_GRUBU_YONETICISI"
          ? /*
              Kaldırma da aynı kapıdan: görevi veremeyen kişi kaldıramaz da.
              İl, GÖREVİN SAHİBİ öğrencinin kaydından okunuyor — grubun bir ili
              yok, görevi taşıyan kişinin var.
            */
            calismaGrubuYoneticisiAtayabilirMi(kullanici, gorev.ogrenci.ilKodu)
          : gorev.kurumKodu !== null &&
            okulTemsilcisiAtayabilirMi(
              kullanici,
              gorev.kurumKodu,
              gorev.ogrenci.ogrenciAtamalari.length > 0,
              gorev.kurum?.ilKodu ?? null,
            );

  if (!yetkili) {
    throw new YetkiHatasi("Bu görevi kaldırma yetkiniz yok.");
  }

  // Görev kaydı dönem bazlıdır ve geçmişi taşımaz; kaldırma gerçek silmedir.
  // İz erişim logunda kalır.
  await prisma.ogrenciGorevRolu.delete({ where: { id: gorev.id } });

  await erisimLogla({
    kullaniciId: kullanici.id,
    islem: "SILME",
    hedefTip: "ROL",
    hedefId: gorev.ogrenci.id,
    detay: `${GOREV_ROL_ETIKETLERI[gorev.rolKodu]} görevi kaldırıldı: ${gorev.ogrenci.ad} ${gorev.ogrenci.soyad}`,
  });

  revalidatePath(YOL);
  revalidatePath("/panel/ogrenciler");
  revalidatePath("/panel");
  redirect(parametreEkle(donusYolu, "durum", "kaldirildi"));
}
