"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { oturumKullanicisiZorunlu } from "@/lib/auth/oturum";
import { BILDIRIM_KODLARI, bildirimGonder } from "@/lib/bildirim/gonder";
import { atamaDegistir } from "@/lib/danisman/atama";
import {
  ATAMAYI_YALNIZCA_YONETICI_YAPAR,
  YONETICI_ATAR_ACIKLAMASI,
} from "@/lib/danisman/politika";
import { prisma } from "@/lib/db";
import { danismanlikDurumunuDegistir } from "@/lib/ogretmen/danismanlik";
import { danismanMi } from "@/lib/yetki/izinler";
import { erisimLogla } from "@/lib/yetki/log";
import { BulunamadiHatasi, YetkiHatasi } from "@/lib/yetki/tipler";

/**
 * Öğrencilerim ekranının eylemleri (7 Ağustos 2026).
 *
 * İki iş buraya TAŞINDI ya da YENİ eklendi:
 *   · GençTek danışman öğretmenliği işareti — Panel'den geldi (istek:
 *     "GençTek Danışman Öğretmenliği Öğrencilerim sekmesine geçsin").
 *   · Öğrenciyi kendi danışmanlığına alma — yeni (istek: "Öğrenci ekleme /
 *     Danışmanı olduğu öğrencileri seçme").
 */

const YOL = "/panel/ogrenciler";

function donusYolunuCoz(veri: FormData): string {
  /*
   * Değer FORMDAN geliyor ve serbest bırakılamaz — açık yönlendirme açığı
   * doğar. Yalnızca bu ekranın kendisi ve sorgu dizeli hâli kabul edilir;
   * filtreler korunsun diye sorgu taşınıyor.
   */
  const istenen = String(veri.get("donusYolu") ?? "");
  if (istenen === YOL || istenen.startsWith(`${YOL}?`)) return istenen;
  return YOL;
}

function parametreEkle(yol: string, anahtar: string, deger: string): string {
  const ayrac = yol.includes("?") ? "&" : "?";
  return `${yol}${ayrac}${anahtar}=${encodeURIComponent(deger)}`;
}

/**
 * "GençTek danışman öğretmeni olarak görev almak istiyorum" işareti.
 *
 * Kural katmanı ayrı (`danismanlikDurumunuDegistir`); görev bırakıldığında
 * öğrencilerin devri de orada yürüyor.
 *
 * ÇAĞIRAN EKRAN PANELİM (12 Ağustos 2026). Form bu ekrandaydı ama bu ekran
 * görev almamış öğretmene kapandı (bkz. ogrenciEnvanteriGorebilirMi) — işareti
 * koyacak kişi buraya hiç gelemiyordu. Eylem dosyası taşınmadı: formun
 * gönderildiği yer değişse de iş aynı işin parçası ve `donusYolu` verilmediğinde
 * varsayılan dönüş adresi Öğrencilerim, yani görev alındıktan sonra açılan ilk
 * ekran zaten burası oluyor.
 */
export async function danismanlikIsaretiEylemi(veri: FormData): Promise<void> {
  const kullanici = await oturumKullanicisiZorunlu();
  const donusYolu = donusYolunuCoz(veri);
  const gorevAlmakIstiyor = veri.get("gorevAlmakIstiyor") === "evet";

  await danismanlikDurumunuDegistir(kullanici.id, gorevAlmakIstiyor);

  // Rol değiştiği için DÜZEN de tazelenmeli: menü ve şerit role bakıyor.
  revalidatePath("/panel", "layout");
  redirect(
    parametreEkle(
      donusYolu,
      "durum",
      gorevAlmakIstiyor ? "danismanlik-alindi" : "danismanlik-birakildi",
    ),
  );
}

/**
 * Öğrenciyi kendi danışmanlığına alır.
 *
 * ---------------------------------------------------------------------------
 * KARAR: ÖĞRETMEN DOĞRUDAN EKLER (7 Ağustos 2026)
 * ---------------------------------------------------------------------------
 * Bu, "danışmanı öğrenci seçer" kuralından bilinçli bir sapmadır ve talep
 * sahibinin kararıdır. Sapmanın üç sınırı var:
 *
 *   1. YALNIZCA KENDİ OKULU. Danışmanlık kurum kodu eksenlidir; başka okuldan
 *      öğrenci alınamaz.
 *   2. YALNIZCA DANIŞMANSIZ ÖĞRENCİ. Var olan bir atamanın üzerine yazılmaz —
 *      yazılsaydı iki öğretmen birbirinin öğrencisini çekip alabilirdi.
 *      Devir gereken durumlar için ayrı akış var (danismanliktanAyrildi).
 *   3. ÖĞRENCİ HABERDAR EDİLİR. Onayı sorulmuyor ama bildirim gidiyor:
 *      öğrenci hiç haberi olmadan danışman sahibi olmamalı. Bu, kararı
 *      değiştirmeyen ama kişiyi karanlıkta bırakmayan en ucuz önlem.
 *
 * Yarış durumunda ikinci yazan veritabanındaki kısmi unique index'e takılır
 * ("bir öğrencinin tek aktif danışmanı olur"); buradaki kontrol kullanıcıya
 * anlamlı mesaj vermek için.
 */
export async function ogrenciyiDanismanligaAlEylemi(
  veri: FormData,
): Promise<void> {
  const kullanici = await oturumKullanicisiZorunlu();
  const donusYolu = donusYolunuCoz(veri);

  // Atamayı yalnızca proje yöneticisi yapar (23 Ekim 2026 · bkz. politika.ts).
  if (ATAMAYI_YALNIZCA_YONETICI_YAPAR) {
    redirect(parametreEkle(donusYolu, "hata", YONETICI_ATAR_ACIKLAMASI));
  }

  if (!danismanMi(kullanici)) {
    throw new YetkiHatasi(
      "Önce GençTek danışman öğretmeni görevini işaretlemelisiniz.",
    );
  }
  if (kullanici.kurumKodu === null) {
    throw new YetkiHatasi("Okul kaydınız olmadan danışmanlık alamazsınız.");
  }

  const ogrenciId = Number.parseInt(String(veri.get("ogrenciId") ?? ""), 10);
  if (!Number.isInteger(ogrenciId)) throw new BulunamadiHatasi();

  /*
   * Öğrenci KENDİ OKULUNDAN mı ve gerçekten öğrenci mi — ikisi de sorguda.
   * Kimliği adres çubuğuna yazan biri başka okulun öğrencisini alamamalı.
   */
  const ogrenci = await prisma.kullanici.findFirst({
    where: {
      id: ogrenciId,
      kurumKodu: kullanici.kurumKodu,
      roller: { some: { rolKodu: "OGRENCI", bitisTarihi: null } },
    },
    select: { id: true, ad: true, soyad: true },
  });
  if (!ogrenci) throw new BulunamadiHatasi();

  const mevcut = await prisma.danismanAtama.findFirst({
    where: { ogrenciId, bitisTarihi: null },
    select: { danismanKullaniciId: true },
  });
  if (mevcut) {
    redirect(
      parametreEkle(
        donusYolu,
        "hata",
        mevcut.danismanKullaniciId === kullanici.id
          ? `${ogrenci.ad} ${ogrenci.soyad} zaten danışmanlığınızda.`
          : `${ogrenci.ad} ${ogrenci.soyad} için başka bir danışman atanmış. Önce mevcut danışmanın görevi kapanmalı.`,
      ),
    );
  }

  await atamaDegistir({
    ogrenciId,
    danismanKullaniciId: kullanici.id,
    atamaTipi: "OGRENCI_SECTI",
  });

  /*
   * `OGRENCI_SECTI` atama tipi kullanılıyor çünkü sonuç aynı: öğrenci ile
   * danışmanı arasında doğrudan, devirsiz bir bağ. Yeni bir tip eklemek
   * migration ve her raporda ikinci bir dal demekti; kaydın kim tarafından
   * açıldığı zaten erişim kaydında duruyor.
   */
  await erisimLogla({
    kullaniciId: kullanici.id,
    islem: "DEGISIKLIK",
    hedefTip: "OGRENCI",
    hedefId: ogrenciId,
    detay: `Öğrenci danışmanlığa alındı: ${ogrenci.ad} ${ogrenci.soyad}`,
  });

  /*
   * Mevcut `DANISMAN_DEGISTI` şablonu kullanılıyor, yeni şablon açılmadı:
   * öğrencinin gördüğü şey aynı — "danışmanın güncellendi, profilinden
   * görebilirsin". Yeni bir kod, seed'e satır ve yönetim ekranına bir metin
   * daha eklerdi; söylediği şey ise aynı olurdu.
   */
  await bildirimGonder({
    kullaniciId: ogrenciId,
    kod: BILDIRIM_KODLARI.DANISMAN_DEGISTI,
  });

  revalidatePath(YOL);
  revalidatePath("/panel");
  redirect(
    parametreEkle(
      donusYolu,
      "durum",
      `${ogrenci.ad} ${ogrenci.soyad} danışmanlığınıza alındı.`,
    ),
  );
}
