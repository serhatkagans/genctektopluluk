"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { oturumKullanicisiZorunlu } from "@/lib/auth/oturum";
import {
  BILDIRIM_KODLARI,
  bildirimGonder,
  ilKoordinatorlerineBildir,
  projeYoneticilerineBildir,
} from "@/lib/bildirim/gonder";
import { prisma } from "@/lib/db";
import {
  KALDIRMA_DUZEYI_ETIKETLERI,
  mentorlukKaldirmaKarariGecerliMi,
  mentorlukKaldirmaTalebiGecerliMi,
  ogrenciMentorlukKarariGecerliMi,
} from "@/lib/mentor/kurallar";
import {
  mentorlukKaldirmaTalebiniOnaylayabilirMi,
  ogrenciMentorluguKaldirmaDuzeyi,
  ogrenciMentorluguneKararVerebilirMi,
} from "@/lib/yetki/izinler";
import { erisimLogla } from "@/lib/yetki/log";
import { BulunamadiHatasi } from "@/lib/yetki/tipler";

/** Yalnızca aktif öğrenci rolü olan kişi bu eylemlerin hedefi olabilir. */
const AKTIF_OGRENCI_KOSULU = {
  roller: { some: { rolKodu: "OGRENCI" as const, bitisTarihi: null } },
};

/**
 * ÖĞRENCİNİN MENTÖRLÜĞÜNE ÖĞRENCİ LİSTESİNDEN VERİLEN KARAR (26 Ağustos 2026 ·
 * danışman; 27 Ağustos 2026 · il koordinatörü).
 *
 * İSTEK: "danışman öğretmen kendi öğrencilerinden mentör ise o da görünsün,
 * Çalışma grupları bu sütunun yanına mentörlük durumu olsun; eğer öğrenci
 * başvurduysa buradan onaylasın, mentör yap / mentörlüğü kaldır butonu olsun".
 *
 * ---------------------------------------------------------------------------
 * KARAR MERKEZİN ONAYININ YERİNE GEÇER
 * ---------------------------------------------------------------------------
 * Mentörlük onayı 11 Ağustos'ta yalnızca proje yöneticisine bırakılmıştı
 * (bkz. izinler.ts · mentorlukOnaylayabilirMi) ve gerekçesi "kimse kendi işini
 * onaylamaz" idi — koordinatör kendi başvurusunu kendi kuyruğunda görüyordu.
 * O gerekçe BURADA GEÇERSİZ: danışman öğretmen kendi mentörlüğüne değil,
 * ÖĞRENCİSİNİNKİNE karar veriyor.
 *
 * Onay burada verildiğinde öğrenci anında onaylı mentör olur; merkezin kuyruğu
 * ikinci bir kapı değildir. Kararın sahibi olarak danışman seçildi çünkü
 * öğrenciyi tanıyan kişi odur: merkez, ülke genelindeki bir kuyrukta gördüğü
 * ada bakarak "bu öğrenci akranlarına yol gösterebilir mi" sorusunu
 * cevaplayamıyordu.
 *
 * İL KOORDİNATÖRÜ DE KARAR VERİR (27 Ağustos 2026 · istek: "il koordinatörü de
 * öğrencinin mentörlük başvurusunu onaylayabilsin"). Danışmanı olmayan
 * öğrencinin başvurusu bu ekranda kimseye düğme basmıyordu ve merkezin ülke
 * genelindeki kuyruğunda yalnızca bir ada dönüşüyordu. Kapının kime açıldığı
 * tek yerde yazıyor: izinler.ts · ogrenciMentorluguneKararVerebilirMi.
 *
 * MERKEZİN KUYRUĞU KAPANMADI: öğretmen, mezun ve paydaş başvuruları orada
 * karara bağlanmaya devam ediyor (mentorluk/eylemler.ts · mentorlukKararEylemi).
 *
 * ---------------------------------------------------------------------------
 * YETKİ HER ÇAĞRIDA VERİTABANINDAN SORULUYOR
 * ---------------------------------------------------------------------------
 * Rol kontrolü ("danışmanım", "koordinatörüm") tek başına yetmez: hangi
 * ÖĞRENCİ için yetkili olduğu ayrı bir sorudur ve ekranda düğmenin basılmamış
 * olması bir koruma değildir (form gövdesine başka bir öğrenci kimliği
 * yazılabilir). Bu yüzden aktif atama ve öğrencinin il kodu her çağrıda
 * veritabanından okunuyor — emsali talep-eylemleri.ts · yetkiyiDogrula.
 */

const YOL = "/panel/ogrenciler";

function donusYolunuCoz(veri: FormData): string {
  /*
   * Serbest bırakılamaz: açık yönlendirme açığı doğar. Yalnızca bu ekranın
   * kendisi ve sorgu dizeli hâli kabul edilir (bkz. eylemler.ts · aynı çözüm).
   */
  const istenen = String(veri.get("donusYolu") ?? "");
  if (istenen === YOL || istenen.startsWith(`${YOL}?`)) return istenen;
  return YOL;
}

/**
 * Kural katmanının reddettiği isteğin ekrana dönüşü.
 *
 * Üç eylem de aynı biçimi kullanıyor; ayrı ayrı yazıldığında birinde `&`
 * ayracı unutulur ve süzgeçli listeden gelen kullanıcı hatayı hiç görmezdi.
 */
function hataliDonus(donusYolu: string, neden: string): string {
  return `${donusYolu}${donusYolu.includes("?") ? "&" : "?"}hata=${encodeURIComponent(neden)}`;
}

export async function ogrenciMentorluguKararEylemi(
  veri: FormData,
): Promise<void> {
  const kullanici = await oturumKullanicisiZorunlu();
  const donusYolu = donusYolunuCoz(veri);

  const ogrenciId = Number.parseInt(String(veri.get("ogrenciId") ?? ""), 10);
  if (!Number.isInteger(ogrenciId)) throw new BulunamadiHatasi();

  /*
   * KAPSAM ARTIK `where` DEĞİL, OKUNAN KAYDIN ÜZERİNDE SORULUYOR (27 Ağustos
   * 2026). Eskiden aktif atama koşulu sorgunun içindeydi; iki karar sahibi
   * olunca (danışman VE il koordinatörü) o koşul "ya atamam var ya da il
   * kodum tutuyor" biçiminde `where`e yazılamaz oldu — yazılsaydı yetki
   * kuralının yarısı sorguda, yarısı izinler.ts'te durur ve biri
   * değiştirildiğinde öbürü sessizce geride kalırdı.
   *
   * Kayıt önce okunuyor, yetki sonra soruluyor; yetkisizde yine 404 dönüyor
   * ki "böyle bir öğrenci var" bilgisi sızmasın (emsali: mentorluk/eylemler.ts
   * · kapsam filtresi).
   *
   * HEDEF ÖĞRENCİ OLMALI (6 Kasım 2026 · güvenlik incelemesi). İzin kuralı
   * yalnızca il eşitliğine bakıyor; bu sorgu da rolü sormadığı için il
   * koordinatörü ilindeki bir öğretmenin, mezunun ya da paydaşın mentörlük
   * başvurusuna karar verebiliyor ve yalnızca proje yöneticisine ait olan
   * kuyruğu atlıyordu. Öğrenci olmayan kimlik burada bulunamaz.
   */
  const ogrenci = await prisma.kullanici.findFirst({
    where: { id: ogrenciId, ...AKTIF_OGRENCI_KOSULU },
    select: {
      id: true,
      ad: true,
      soyad: true,
      ilKodu: true,
      mentorluk: {
        select: {
          durum: true,
          /*
           * BEKLEYEN TALEP HER İKİ KARARI DA DURDURUR (28 Ağustos 2026);
           * kuralı `ogrenciMentorlukKarariGecerliMi` yazıyor, buradaki iş
           * yalnızca ona veriyi taşımak.
           */
          kaldirmaTalebi: {
            select: {
              durum: true,
              gerekce: true,
              isteyenKullaniciId: true,
              isteyenDuzeyi: true,
            },
          },
        },
      },
      ogrenciAtamalari: {
        where: { bitisTarihi: null },
        select: { danismanKullaniciId: true },
      },
    },
  });
  if (!ogrenci) throw new BulunamadiHatasi();

  const kendiOgrencisiMi = ogrenci.ogrenciAtamalari.some(
    (atama) => atama.danismanKullaniciId === kullanici.id,
  );
  if (
    !ogrenciMentorluguneKararVerebilirMi(kullanici, ogrenci, kendiOgrencisiMi)
  ) {
    throw new BulunamadiHatasi();
  }

  const kaldiriliyor = String(veri.get("karar") ?? "") === "KALDIR";
  const talep = ogrenci.mentorluk?.kaldirmaTalebi ?? null;

  /*
   * -------------------------------------------------------------------------
   * KALDIRMA ARTIK HERKESTE AYNI ŞEYİ YAPMIYOR (28 Ağustos 2026)
   * -------------------------------------------------------------------------
   * İSTEK: "hiyerarşi olsun: öğretmeninkini koordinatör ve proje yöneticisi,
   * koordinatörünkini de proje yöneticisi onaylasın, proje yöneticisine onay
   * yok".
   *
   * Düğme üçünde de aynı ("Mentörlüğü kaldır"); ayrışan şey sonucu. Hangi
   * düzeyden basıldığını izinler.ts söylüyor — burada dallanma tek satır ve
   * "proje yöneticisi mi" sorusu bu dosyada hiç sorulmuyor.
   */
  if (kaldiriliyor) {
    const duzey = ogrenciMentorluguKaldirmaDuzeyi(
      kullanici,
      ogrenci,
      kendiOgrencisiMi,
    );
    if (!duzey) throw new BulunamadiHatasi();

    if (duzey !== "MERKEZ") {
      const istek = mentorlukKaldirmaTalebiGecerliMi({
        mevcutDurum: ogrenci.mentorluk?.durum ?? null,
        talepDurumu: talep?.durum ?? null,
        gerekce: String(veri.get("gerekce") ?? ""),
      });
      if (!istek.olurMu) {
        revalidatePath(donusYolu);
        redirect(hataliDonus(donusYolu, istek.neden));
      }

      /*
       * UPSERT: öğrenci başına tek satır tutuluyor (bkz. şema · talep bir
       * DURUMDUR, geçmiş tablosu değil). Daha önce reddedilmiş bir talebin
       * satırı yeniden BEKLIYOR'a dönüyor; kararı, gerekçesi ve karar veren
       * temizleniyor — kalsalardı yeni talep, eski kararın izleriyle
       * okunurdu.
       */
      const talepVerisi = {
        durum: "BEKLIYOR" as const,
        isteyenKullaniciId: kullanici.id,
        isteyenDuzeyi: duzey,
        gerekce: istek.gerekce,
        istekTarihi: new Date(),
        kararVerenKullaniciId: null,
        kararTarihi: null,
        retGerekcesi: null,
      };
      await prisma.mentorlukKaldirmaTalebi.upsert({
        where: { kullaniciId: ogrenci.id },
        create: { kullaniciId: ogrenci.id, ...talepVerisi },
        update: talepVerisi,
      });

      /*
       * UYARI KARAR MERCİİNE GİDER, TALEBİN DÜZEYİNE GÖRE: danışmanınki ilin
       * koordinatörüne VE merkeze, koordinatörünki yalnızca merkeze. Alıcı
       * listesi `mentorlukKaldirmaTalebiniOnaylayabilirMi` ile aynı cümleyi
       * söylüyor; uyarısız bir kuyruk, günlerce bakılmayan kuyruktur ve
       * buradaki bedeli talebi açan öğretmen ödüyor.
       *
       * ÖĞRENCİYE GİTMEZ: henüz kaldırılmış bir şey yok (bkz. sablon.ts ·
       * MENTORLUK_KALDIRMA_TALEBI).
       */
      const degiskenler = {
        ogrenciAdSoyad: `${ogrenci.ad} ${ogrenci.soyad}`,
        isteyenAdSoyad: `${kullanici.ad} ${kullanici.soyad}`,
        isteyenGorevi: KALDIRMA_DUZEYI_ETIKETLERI[duzey],
        gerekce: istek.gerekce,
      };
      if (duzey === "DANISMAN") {
        await ilKoordinatorlerineBildir(
          ogrenci.ilKodu,
          BILDIRIM_KODLARI.MENTORLUK_KALDIRMA_TALEBI,
          degiskenler,
        );
      }
      await projeYoneticilerineBildir(
        BILDIRIM_KODLARI.MENTORLUK_KALDIRMA_TALEBI,
        degiskenler,
      );

      await erisimLogla({
        kullaniciId: kullanici.id,
        islem: "DEGISIKLIK",
        hedefTip: "ROL",
        hedefId: ogrenci.id,
        detay: `Öğrenci mentörlüğünün kaldırılması istendi (${KALDIRMA_DUZEYI_ETIKETLERI[duzey]}): ${ogrenci.ad} ${ogrenci.soyad}`,
      });

      revalidatePath(donusYolu);
      revalidatePath("/panel");
      redirect(
        `${donusYolu}${donusYolu.includes("?") ? "&" : "?"}durum=kaldirma-talebi-acildi`,
      );
    }
  }

  const karar = ogrenciMentorlukKarariGecerliMi({
    mevcutDurum: ogrenci.mentorluk?.durum ?? null,
    yeniDurum: kaldiriliyor ? "REDDEDILDI" : "ONAYLANDI",
    gerekce: String(veri.get("gerekce") ?? ""),
    bekleyenKaldirmaTalebiVarMi: talep?.durum === "BEKLIYOR",
  });
  if (!karar.olurMu) {
    revalidatePath(donusYolu);
    redirect(hataliDonus(donusYolu, karar.neden));
  }

  /*
   * KALDIRMA `REDDEDILDI`, `BIRAKILDI` DEĞİL. İkisi ayrı şeyler: bırakmak
   * kişinin kendi vazgeçmesidir (bkz. mentorluguBirakEylemi), bu ise
   * BAŞKASININ verdiği bir karardır ve gerekçesi vardır. `BIRAKILDI`
   * yazılsaydı kayıt, öğrencinin kendi vazgeçtiğini söylerdi.
   */
  const durum = kaldiriliyor ? "REDDEDILDI" : "ONAYLANDI";
  await prisma.mentorluk.update({
    where: { kullaniciId: ogrenci.id },
    data: {
      durum,
      kararVerenKullaniciId: kullanici.id,
      kararTarihi: new Date(),
      retGerekcesi: karar.retGerekcesi,
    },
  });

  /*
   * KARAR ÖĞRENCİYE DUYURULUR — merkezin kararıyla aynı şablondan, çünkü
   * öğrenci için sonuç aynı: mentör oldu ya da olmadı. Kararı kimin verdiği
   * ayrı bir cümle olsaydı, aynı bildirim iki farklı metinle okunurdu.
   */
  await bildirimGonder({
    kullaniciId: ogrenci.id,
    kod: BILDIRIM_KODLARI.MENTORLUK_KARARI,
    degiskenler: {
      sonuc: kaldiriliyor ? "reddedildi" : "onaylandı",
      gerekce: karar.retGerekcesi ?? "—",
    },
  });

  await erisimLogla({
    kullaniciId: kullanici.id,
    islem: "DEGISIKLIK",
    hedefTip: "ROL",
    hedefId: ogrenci.id,
    detay: `Öğrenci mentörlüğü ${kaldiriliyor ? "kaldırıldı" : "onaylandı"}: ${ogrenci.ad} ${ogrenci.soyad}`,
  });

  revalidatePath(donusYolu);
  /* Mentör havuzu ve panodaki mentörlük kartı da bu karardan etkileniyor. */
  revalidatePath("/panel/talepler/mentor-basvuru");
  revalidatePath("/panel");
  redirect(
    `${donusYolu}${donusYolu.includes("?") ? "&" : "?"}durum=${kaldiriliyor ? "mentorluk-kaldirildi" : "mentor-yapildi"}`,
  );
}

/**
 * BEKLEYEN KALDIRMA TALEBİNİN KARARI (28 Ağustos 2026 · istek: "hiyerarşi
 * olsun: öğretmeninkini koordinatör ve proje yöneticisi, koordinatörünkini de
 * proje yöneticisi onaylasın, proje yöneticisine onay yok").
 *
 * ONAY, MENTÖRLÜĞÜ TALEBİN GEREKÇESİYLE KALDIRIR: öğrenciye giden bildirimde
 * yazan metin, kaldırmayı isteyenin yazdığı gerekçedir — onaylayanın değil.
 * Onaylayana ayrıca gerekçe yazdırılsaydı, öğrenci kendisini tanımayan bir
 * mercinin cümlesini okurdu; kaldırmayı isteyen ise gerekçesinin yerine
 * başkasınınkinin geçtiğini hiç görmezdi.
 *
 * KARARI KİM VERDİ, MENTÖRLÜK SATIRINA YAZILIR (`kararVerenKullaniciId`):
 * kaldırma kararı onaylayana aittir, talebi açan yalnızca istemiştir.
 * "Kim istedi" bilgisi talep satırında duruyor ve ikisi ayrı sorulardır.
 *
 * YETKİ HER ÇAĞRIDA VERİTABANINDAN SORULUYOR — ekranda düğmenin basılmamış
 * olması bir koruma değil (aynı gerekçe bu dosyanın başında yazılı).
 */
export async function mentorlukKaldirmaTalebiKararEylemi(
  veri: FormData,
): Promise<void> {
  const kullanici = await oturumKullanicisiZorunlu();
  const donusYolu = donusYolunuCoz(veri);

  const ogrenciId = Number.parseInt(String(veri.get("ogrenciId") ?? ""), 10);
  if (!Number.isInteger(ogrenciId)) throw new BulunamadiHatasi();

  // Hedef öğrenci olmalı (bkz. ogrenciMentorluguKararEylemi).
  const ogrenci = await prisma.kullanici.findFirst({
    where: { id: ogrenciId, ...AKTIF_OGRENCI_KOSULU },
    select: {
      id: true,
      ad: true,
      soyad: true,
      ilKodu: true,
      mentorluk: {
        select: {
          durum: true,
          kaldirmaTalebi: {
            select: {
              durum: true,
              gerekce: true,
              isteyenKullaniciId: true,
              isteyenDuzeyi: true,
            },
          },
        },
      },
    },
  });
  if (!ogrenci) throw new BulunamadiHatasi();

  const talep = ogrenci.mentorluk?.kaldirmaTalebi ?? null;
  /*
   * TALEBİ OLMAYAN ÖĞRENCİDE 404 — "böyle bir öğrenci var" bilgisi de
   * sızmasın (emsali: yukarıdaki kapsam kararı).
   */
  if (!talep) throw new BulunamadiHatasi();
  if (!mentorlukKaldirmaTalebiniOnaylayabilirMi(kullanici, talep, ogrenci)) {
    throw new BulunamadiHatasi();
  }

  const onaylaniyor = String(veri.get("karar") ?? "") === "ONAYLA";
  const karar = mentorlukKaldirmaKarariGecerliMi({
    talepDurumu: talep.durum,
    yeniDurum: onaylaniyor ? "ONAYLANDI" : "REDDEDILDI",
    retGerekcesi: String(veri.get("retGerekcesi") ?? ""),
    mentorlukDurumu: ogrenci.mentorluk?.durum ?? null,
  });
  if (!karar.olurMu) {
    revalidatePath(donusYolu);
    redirect(hataliDonus(donusYolu, karar.neden));
  }

  /*
   * İKİ SATIR TEK İŞLEMDE: talebin kapanması ile mentörlüğün kalkması aynı
   * kararın iki yüzü. Ayrı yazılsalardı araya düşen bir hata, kapanmış bir
   * talebin ardında onaylı bir mentörlük ya da tersini bırakırdı — ikisi de
   * ekranda hiçbir düğmesi olmayan bir çıkmaz.
   */
  await prisma.$transaction(async (tx) => {
    await tx.mentorlukKaldirmaTalebi.update({
      where: { kullaniciId: ogrenci.id },
      data: {
        durum: onaylaniyor ? "ONAYLANDI" : "REDDEDILDI",
        kararVerenKullaniciId: kullanici.id,
        kararTarihi: new Date(),
        retGerekcesi: karar.retGerekcesi,
      },
    });

    if (onaylaniyor) {
      await tx.mentorluk.update({
        where: { kullaniciId: ogrenci.id },
        data: {
          /* Kaldırma `REDDEDILDI`dir, `BIRAKILDI` değil — gerekçesi yukarıda. */
          durum: "REDDEDILDI",
          kararVerenKullaniciId: kullanici.id,
          kararTarihi: new Date(),
          retGerekcesi: talep.gerekce,
        },
      });
    }
  });

  /* Talebi açan, kararı öğrenmeli: ret hâlinde öğrenci mentör KALIYOR. */
  await bildirimGonder({
    kullaniciId: talep.isteyenKullaniciId,
    kod: BILDIRIM_KODLARI.MENTORLUK_KALDIRMA_KARARI,
    degiskenler: {
      ogrenciAdSoyad: `${ogrenci.ad} ${ogrenci.soyad}`,
      kararVerenAdSoyad: `${kullanici.ad} ${kullanici.soyad}`,
      sonuc: onaylaniyor ? "onaylandı" : "reddedildi",
      gerekce: onaylaniyor ? talep.gerekce : (karar.retGerekcesi ?? "—"),
    },
  });

  /*
   * ÖĞRENCİYE YALNIZCA ONAYDA GİDER ve merkezin kararıyla AYNI şablondan:
   * onun için sonuç aynı — mentörlüğü kalktı. Reddedilen talep öğrenciyi hiç
   * ilgilendirmiyor; mentörlüğü hiç kesintiye uğramadı.
   */
  if (onaylaniyor) {
    await bildirimGonder({
      kullaniciId: ogrenci.id,
      kod: BILDIRIM_KODLARI.MENTORLUK_KARARI,
      degiskenler: { sonuc: "reddedildi", gerekce: talep.gerekce },
    });
  }

  await erisimLogla({
    kullaniciId: kullanici.id,
    islem: "DEGISIKLIK",
    hedefTip: "ROL",
    hedefId: ogrenci.id,
    detay: `Mentörlük kaldırma talebi ${onaylaniyor ? "onaylandı" : "reddedildi"}: ${ogrenci.ad} ${ogrenci.soyad}`,
  });

  revalidatePath(donusYolu);
  revalidatePath("/panel/talepler/mentor-basvuru");
  revalidatePath("/panel");
  redirect(
    `${donusYolu}${donusYolu.includes("?") ? "&" : "?"}durum=${
      onaylaniyor ? "kaldirma-talebi-onaylandi" : "kaldirma-talebi-reddedildi"
    }`,
  );
}
