/**
 * OKUL TÜRÜ SEÇENEKLERİ (26 Ağustos 2026 · istek: "Okul türü alanına diğer
 * okul türlerini ekleyelim meslek lisesi imamhatip lisesi falan en son da diğer
 * olsun").
 *
 * Saf tutulur: veritabanına gitmez, birim testle kapsanır.
 *
 * ---------------------------------------------------------------------------
 * NİYE SABİT BİR LİSTE GEREKTİ
 * ---------------------------------------------------------------------------
 * Süzgeç bugüne kadar türleri YALNIZCA VERİDEN okuyordu (bkz.
 * rapor/secenekler.ts) ve gerekçesi sağlamdı: tür alanı e-Okul'dan serbest
 * metin gelir, elle yazılmış bir liste yeni bir tür açıldığında onu görünmez
 * kılar.
 *
 * Eksik kalan şey şuydu: liste İL KAPSAMINA GÖRE daralıyor. Koordinatörün
 * ekranında yalnızca kendi ilinde KAYITLI ÖĞRENCİSİ OLAN okulların türleri
 * çıkıyordu — ilinde henüz GençTek'e katılmamış bir meslek lisesi varsa o tür
 * süzgeçte hiç görünmüyor, koordinatör de "bu sistemde meslek lisesi yok"
 * sanıyordu.
 *
 * ÇÖZÜM İKİSİNİ BİRDEN TUTUYOR: standart liste ile veriden gelenler
 * BİRLEŞTİRİLİYOR (bkz. okulTuruSecenekleri). Veride olup listede olmayan bir
 * tür kaybolmaz — eski kararın koruduğu şey buydu.
 *
 * ---------------------------------------------------------------------------
 * "DİĞER" BİR TÜR DEĞİL, BİR KOŞULDUR
 * ---------------------------------------------------------------------------
 * Hiçbir okul kaydında `okul_turu = 'Diğer'` yazmaz. Seçenek düz bir değer
 * olarak gönderilseydi her seferinde boş liste dönerdi — kullanıcıya çalışıyor
 * gibi görünen, hiçbir zaman sonuç vermeyen bir kutu. Bunun yerine "standart
 * listede olmayan türler" diye okunuyor (bkz. okulTuruKosulu).
 */

/** Süzgeçte "Diğer" seçeneğinin taşıdığı değer. */
export const OKUL_TURU_DIGER = "Diğer";

/**
 * MEB ortaöğretim kurum türleri.
 *
 * ORTAÖĞRETİM İLE SINIRLI: GençTek lise öğrencisiyle çalışıyor (sınıf alanı
 * 9-12) ve ilkokul/ortaokul türlerini eklemek, süzgeci hiçbir zaman sonuç
 * vermeyecek otuz satırla uzatırdı. Bilim ve Sanat Merkezi lise değil ama
 * listede: verisi zaten var ve öğrencileri GençTek'e katılıyor.
 *
 * SIRA ALFABETİK DEĞİL, ekranda da öyle basılmıyor — sıralama gösterim
 * kararıdır ve `okulTuruSecenekleri` içinde Türkçe harf sırasına göre
 * yapılıyor. Buradaki sıra yalnızca okunabilirlik için türden türe.
 */
export const BILINEN_OKUL_TURLERI: readonly string[] = [
  "Anadolu Lisesi",
  "Fen Lisesi",
  "Sosyal Bilimler Lisesi",
  "Anadolu İmam Hatip Lisesi",
  "İmam Hatip Lisesi",
  "Mesleki ve Teknik Anadolu Lisesi",
  "Çok Programlı Anadolu Lisesi",
  "Mesleki ve Teknik Eğitim Merkezi",
  "Özel Eğitim Meslek Lisesi",
  "Güzel Sanatlar Lisesi",
  "Spor Lisesi",
  "Bilim ve Sanat Merkezi",
  "Mesleki Açık Öğretim Lisesi",
  "Açık Öğretim Lisesi",
];

/**
 * Süzgeçte gösterilecek tür listesi: standart türler ile veridekiler
 * birleştirilir, Türkçe harf sırasına dizilir, "Diğer" EN SONA konur.
 *
 * "Diğer" sona sabitleniyor çünkü alfabetik sırada ortalara düşerdi ve orada
 * bir tür adı gibi okunurdu; sondaki yeri onu bir "geri kalanlar" kutusu
 * yapıyor.
 *
 * Sıralama `tr` yerel ayarıyla: varsayılan sıralamada "Çok Programlı" ile
 * "Özel Eğitim" yanlış yere düşer (Ç, Ö ve İ İngilizce alfabede yok).
 */
export function okulTuruSecenekleri(
  veridekiler: readonly string[] = [],
): string[] {
  const tumu = new Set<string>(BILINEN_OKUL_TURLERI);
  for (const tur of veridekiler) {
    const temiz = tur?.trim();
    if (temiz) tumu.add(temiz);
  }
  tumu.delete(OKUL_TURU_DIGER);

  return [
    ...[...tumu].sort((a, b) => a.localeCompare(b, "tr")),
    OKUL_TURU_DIGER,
  ];
}

/**
 * Seçilen türün veritabanı koşuluna çevrilmesi.
 *
 * "Diğer" = standart listede OLMAYAN türler. Ölçüt `BILINEN_OKUL_TURLERI`,
 * ekranda basılan birleşik liste değil: birleşik liste ile ölçseydik koşul
 * bakılan ile göre değişirdi — aynı seçenek, iki ilde iki farklı şey demek
 * olurdu.
 *
 * Dönen değer doğrudan `where` içine yayılır; tür seçilmemişse boş nesne
 * döner ve hiçbir daraltma yapmaz.
 */
export function okulTuruKosulu(
  okulTuru: string | null | undefined,
): { okulTuru?: string | { notIn: string[] } } {
  if (!okulTuru) return {};
  if (okulTuru === OKUL_TURU_DIGER) {
    return { okulTuru: { notIn: [...BILINEN_OKUL_TURLERI] } };
  }
  return { okulTuru };
}

/**
 * Okulun kayıttaki türünü bir seçim formunun seçeneklerinden birine çevirir:
 * standart listede olmayan bir tür "Diğer" olarak seçili gelir (23 Ekim 2026 ·
 * öğrenci panelindeki "Genel bilgiler").
 */
export function formOkulTuru(tur: string | null | undefined): string {
  if (!tur) return "";
  return BILINEN_OKUL_TURLERI.includes(tur) ? tur : OKUL_TURU_DIGER;
}
