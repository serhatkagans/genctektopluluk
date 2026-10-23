import type { EkipTuru } from "@/generated/prisma/enums";
import {
  ilKoordinatoruMu,
  koordinatorIlKodu,
  projeYoneticisiMi,
} from "@/lib/yetki/izinler";
import type { OturumKullanicisi } from "@/lib/yetki/tipler";

/**
 * Ekip kuralları (13 Ağustos 2026).
 *
 * İSTEK: "il koordinatörü ekipler kurabilsin, ekip ismini kendileri girsin,
 * ekiplere katılanlarla mesajlaşma sohbet yapabilsin".
 *
 * Saf tutulur: veritabanına gitmez, birim testle kapsanır. Ekran ve sunucu
 * eylemi aynı fonksiyonları çağırır — biri düğmeyi basıp öbürü izin
 * vermeseydi kullanıcı tıkladığı düğmeden hata alırdı.
 */

const EKIP_ADI_MAKS = 150;
const EKIP_ACIKLAMA_MAKS = 500;
const EKIP_MESAJ_MAKS = 2000;

/**
 * Ekip KURABİLİR/YÖNETEBİLİR mi?
 *
 * İl koordinatörü (istek) ve proje yöneticisi. Merkez, istekte sayılmadığı
 * hâlde dışarıda bırakılmadı: koordinatörü olmayan ya da görevi biten ilde
 * ekibin sahibi kalmazdı ve yanlış kurulmuş bir ekibi düzeltecek kimse
 * olmazdı. Aynı gerekçeyle merkez, mentörlük ve rol ekranlarında da son
 * mercidir.
 *
 * DANIŞMAN ÖĞRETMEN DIŞARIDA ve bu dar başlangıç bilinçli: ekip, üyelerine
 * birbirleriyle onaysız yazışma hakkı doğuruyor (bkz. ekipSohbetiOkuyabilirMi).
 * Bu hak bugüne kadar yalnızca danışman/koordinatör onayından geçerek
 * veriliyordu; kimin ekip kurabileceği, o kapının kimde olduğu sorusudur ve
 * ilde tek kişidedir. Öğretmene açılması ayrı bir karardır.
 */
export function ekipYonetebilirMi(kullanici: OturumKullanicisi): boolean {
  // 23 Ekim 2026 · istek: koordinatörde "Ekipler pasif olsun" (bkz. ekiplerKapaliMi).
  return projeYoneticisiMi(kullanici);
}

/**
 * EKİPLER İL KOORDİNATÖRÜNE KAPALI (23 Ekim 2026 · istek: koordinatör
 * sayfasında "Ekipler pasif olsun"). Kartlar pasif basılır, ekip sayfaları
 * koordinatörü panele geri gönderir. Veri silinmez.
 */
export function ekiplerKapaliMi(kullanici: OturumKullanicisi): boolean {
  return ilKoordinatoruMu(kullanici) && !projeYoneticisiMi(kullanici);
}

export const EKIPLER_KAPALI_ACIKLAMASI =
  "Ekipler il koordinatörleri için şu an kapalı.";

/**
 * Bu ekibi yönetebilir mi (üye ekleme/çıkarma, kapatma)?
 *
 * Kapsam burada uygulanıyor: koordinatör YALNIZCA kendi ilinin ekibini
 * yönetir, merkez hepsini. `ekipYonetebilirMi` "bu rol ekip yönetir mi"
 * sorusunu, bu ise "bu ekibi yönetir mi" sorusunu cevaplar; ikisi ayrı
 * tutuldu çünkü ilki ekran basılırken, ikincisi kayıt üzerinde çalışırken
 * soruluyor.
 */
export function buEkibiYonetebilirMi(
  kullanici: OturumKullanicisi,
  ekipIlKodu: string,
): boolean {
  // 23 Ekim 2026: ekipleri yalnızca proje yöneticisi yönetir (bkz.
  // ekiplerKapaliMi); `ekipIlKodu` artık sorulmuyor.
  void ekipIlKodu;
  return projeYoneticisiMi(kullanici);
}

/**
 * Ekip sohbetini OKUYABİLİR mi?
 *
 * Üyeler, ekibi yönetenler (ilin koordinatörü) ve proje yöneticisi. Gizli
 * kanal yoktur (bkz. lib/iletisim/kurallar.ts): sohbetin gözetime açık olması
 * ekip kurmanın koşuludur, çünkü üyelerin çoğu 18 yaş altı ve bu kanal
 * danışman onayından geçmeden açılıyor.
 */
export function ekipSohbetiOkuyabilirMi(
  kullanici: OturumKullanicisi,
  ekip: { ilKodu: string; uyeKullaniciIdleri: number[] },
): boolean {
  // Koordinatör üye olsa da ekipler ona kapalı (23 Ekim 2026).
  if (ekiplerKapaliMi(kullanici)) return false;
  if (ekip.uyeKullaniciIdleri.includes(kullanici.id)) return true;
  return buEkibiYonetebilirMi(kullanici, ekip.ilKodu);
}

/**
 * Sohbete YAZABİLİR mi?
 *
 * Okuyabilenlerle aynı kitle: ekibi kuran koordinatör de ekibin bir parçasıdır
 * ve duyurusunu oraya yazar. Merkez de yazabilir — okuyup müdahale edebilen
 * ama uyaramayan bir gözetim, gözetim değildir.
 *
 * KAPALI EKİBE YAZILMAZ: pasife alınmış ekip bir arşivdir.
 */
export function ekipSohbetineYazabilirMi(
  kullanici: OturumKullanicisi,
  ekip: { ilKodu: string; aktif: boolean; uyeKullaniciIdleri: number[] },
): boolean {
  if (!ekip.aktif) return false;
  return ekipSohbetiOkuyabilirMi(kullanici, ekip);
}

export type EkipAdiKarari =
  | { olurMu: true; ad: string; aciklama: string | null }
  | { olurMu: false; neden: string };

/**
 * Ekip adı ve açıklaması.
 *
 * AD SERBEST METİN (istek: "ekip ismini kendileri girsin") — referans listesi
 * yok. Tekillik il+ad üzerinde ve veritabanında (bkz. ux_ekip_il_ad_aktif):
 * aynı ilde aynı adla iki aktif ekip, üyenin hangisine yazdığını bilemediği
 * bir durumdur.
 */
export function ekipAdiniCoz(girdi: {
  ad: string;
  aciklama: string;
}): EkipAdiKarari {
  const ad = girdi.ad.trim().replace(/\s+/g, " ");
  if (!ad) return { olurMu: false, neden: "Ekip adı boş olamaz." };
  if (ad.length > EKIP_ADI_MAKS) {
    return {
      olurMu: false,
      neden: `Ekip adı en fazla ${EKIP_ADI_MAKS} karakter olabilir.`,
    };
  }

  const aciklama = girdi.aciklama.trim();
  if (aciklama.length > EKIP_ACIKLAMA_MAKS) {
    return {
      olurMu: false,
      neden: `Açıklama en fazla ${EKIP_ACIKLAMA_MAKS} karakter olabilir.`,
    };
  }

  return { olurMu: true, ad, aciklama: aciklama || null };
}

/** Ekip sohbetindeki mesaj metni — sınır yazışma mesajlarıyla aynı. */
export function ekipMesajiniCoz(
  metin: string,
): { olurMu: true; icerik: string } | { olurMu: false; neden: string } {
  const icerik = metin.trim();
  if (!icerik) return { olurMu: false, neden: "Mesaj boş olamaz." };
  if (icerik.length > EKIP_MESAJ_MAKS) {
    return {
      olurMu: false,
      neden: `Mesaj en fazla ${EKIP_MESAJ_MAKS} karakter olabilir.`,
    };
  }
  return { olurMu: true, icerik };
}

/**
 * Ekip sohbetinin kalıcı uyarısı.
 *
 * Tek sabitten geliyor ki her ekranda aynı cümle çıksın (GIZLILIK_UYARISI ile
 * aynı gerekçe).
 */
export const EKIP_SOHBET_UYARISI =
  "Ekip sohbeti gizli değildir: ekibi kuran il koordinatörü ve proje yöneticisi mesajları okuyabilir. Telefon, adres gibi iletişim bilgilerinizi yazmayın.";

// ---------------------------------------------------------------------------
// Ekip türü ve kapsamı (15 Ağustos 2026 · Manisa farkları turu)
// ---------------------------------------------------------------------------

export const EKIP_TURU_ETIKETLERI: Record<EkipTuru, string> = {
  OKUL_TAKIMI: "Okul Takımı",
  CALISMA_GRUBU: "Çalışma Grubu",
  IL_GENCTEK_EKIBI: "İl GençTek Ekibi",
  DIGER: "Diğer",
};

/*
 * SIRA EKRANDAKİ SIRA: "Diğer" EN SONDA (26 Ağustos 2026 · istek: "Ekip türü
 * alanına diğer ekleyelim"). Üç kapsam türü önce, geri kalanlar kutusu sonra —
 * arada dursaydı bir kapsam adı gibi okunurdu (emsali: okul türü süzgecindeki
 * "Diğer", bkz. lib/okul/turler.ts).
 */
export const EKIP_TURLERI: readonly EkipTuru[] = [
  "OKUL_TAKIMI",
  "CALISMA_GRUBU",
  "IL_GENCTEK_EKIBI",
  "DIGER",
];

/**
 * EKİP KURMA FORMUNDA SEÇİLEBİLEN TÜRLER (31 Ağustos 2026 · istek: "okul
 * seçimi kapanacak Okul").
 *
 * `EKIP_TURLERI`DEN AYRI BİR LİSTE ve ayrılığın sebebi şu: o liste enum'un
 * TAMAMIDIR ve üç işi daha var — `ekipTuruGecerliMi` doğrulaması, envanterin
 * tür süzgeci ve rozet etiketleri. OKUL_TAKIMI oradan silinseydi kurulmuş okul
 * takımları "geçersiz tür" sayılır, süzgeçten ve rozetlerinden düşerdi.
 *
 * ÇIKARILAN TEK TÜR OKUL_TAKIMI ve gerekçesi kaçınılmaz: türü zorunlu bir okul
 * bağı var (`ck_ekip_okul_takimi_kurum`) ve okul seçimi formdan kalktı. Türün
 * listede kalması, seçildiğinde her seferinde hata veren bir seçenek demekti.
 *
 * Süzgeç listesinde olduğu gibi ÇIKARARAK kuruluyor, elle sayarak değil:
 * enum'a yeni bir tür eklendiğinde formda kendiliğinden görünmesi doğru
 * varsayılan.
 */
export const EKIP_FORM_TURLERI: readonly EkipTuru[] = EKIP_TURLERI.filter(
  (tur) => tur !== "OKUL_TAKIMI",
);

export function ekipTuruGecerliMi(deger: string): deger is EkipTuru {
  return (EKIP_TURLERI as readonly string[]).includes(deger);
}

export type EkipKapsamKarari =
  | { olurMu: true; tur: EkipTuru; kurumKodu: number | null }
  | { olurMu: false; neden: string };

/**
 * Ekibin türü ve okul bağı.
 *
 * ============================================================================
 * KURAL VERİTABANINDAKİ KISITIN AYNISI
 * ============================================================================
 * `ck_ekip_okul_takimi_kurum`: OKUL_TAKIMI'nda kurum ZORUNLU, diğer ikisinde
 * BOŞ. Kural iki yerde birden duruyor ve bu bilinçli — veritabanı kısıtı son
 * savunma hattı, buradaki kontrol ise kullanıcıya anlaşılır bir cümle
 * söyleyebilen tek yer. Yalnızca kısıt bırakılsaydı form ham bir veritabanı
 * hatasıyla patlardı.
 *
 * OKUL DIŞI TÜRLERDE KURUM SESSİZCE DÜŞÜRÜLÜR, hata verilmez: formda tür
 * değiştiren kullanıcının tarayıcısında eski okul seçimi kalabiliyor ve bu
 * onun hatası değil. Ama OKUL_TAKIMI'nda okul yoksa hata verilir — orada
 * eksik olan şey kullanıcının vermesi gereken bir bilgi.
 */
export function ekipKapsaminiCoz(girdi: {
  tur: string;
  kurumKodu: string | null;
}): EkipKapsamKarari {
  if (!ekipTuruGecerliMi(girdi.tur)) {
    return { olurMu: false, neden: "Geçerli bir ekip türü seçin." };
  }

  if (girdi.tur !== "OKUL_TAKIMI") {
    return { olurMu: true, tur: girdi.tur, kurumKodu: null };
  }

  const kod = Number.parseInt((girdi.kurumKodu ?? "").trim(), 10);
  if (!Number.isInteger(kod)) {
    return {
      olurMu: false,
      neden: "Okul takımı için okul seçilmesi zorunludur.",
    };
  }

  return { olurMu: true, tur: girdi.tur, kurumKodu: kod };
}

/**
 * Ekip danışmansız mı?
 *
 * PASİF DANIŞMAN DA DANIŞMANSIZ SAYILIR. Manisa panelindeki ekranın başlığı da
 * böyle diyor ("danışman öğretmeni olmayan VEYA pasif danışmana sahip"):
 * görevden ayrılmış ya da hesabı kapatılmış bir öğretmen ekipte yazılı kalmaya
 * devam eder ve ekip, kimsenin bakmadığı bir ekip olur. Yalnızca alanın boş
 * olmasına bakılsaydı bu ekipler listede hiç görünmezdi — üstelik en çok
 * onların görünmesi gerekiyor.
 */
export function ekipDanismansizMi(ekip: {
  danisman: { aktif: boolean } | null;
}): boolean {
  return ekip.danisman === null || !ekip.danisman.aktif;
}
