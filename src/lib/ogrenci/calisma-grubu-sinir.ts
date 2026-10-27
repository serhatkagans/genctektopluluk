// Tarayıcıda da okunur (seçim formu istemci bileşeni); veritabanı içe aktarmaz.

/**
 * Bir öğrencinin aynı anda kayıtlı olabileceği çalışma grubu sayısı
 * (20 Ağustos 2026 · istek: "öğrenciler max 5 çalışma grubunda görülebilsin").
 *
 * ÖNCEKİ KARARIN TERSİ ve bilerek öyle. Sistemde bir zamanlar
 * `OGRENCI_CALISMA_GRUBU_UST_SINIRI` ayarı vardı, "en fazla 3" kısıtıyla
 * birlikte kaldırılmıştı ve kodda "buraya sayı kontrolü eklemeyin" notları
 * duruyordu. Sınır geri geldi; notlar bu yüzden güncellendi, silinmedi —
 * kaldırılmış bir kısıtın neden geri döndüğü, kısıtın kendisi kadar önemli.
 *
 * SİSTEM AYARI DEĞİL, KOD SABİTİ: kaldırılan ayar tabloya geri konmadı.
 * Sayı, ekranda öğrenciye söylenen bir cümlenin parçası ("en fazla 5") ve
 * çalışma zamanında değişebilen bir değer, iki yüzeyi de belirsizleştirirdi.
 * Değişmesi gerekirse burası tek yer.
 *
 * GEÇMİŞ SEÇİMLER GERİYE DÖNÜK KIRILMAZ: sınır yalnızca YENİ kayıtta
 * uygulanır. Beş üstü seçimi olan öğrenci (sınırdan önce yapılmış ya da
 * danışmanı/koordinatörü eklemiş olabilir) ekranda hepsini görmeye devam
 * eder; kaydetmek istediğinde beşe inmesi istenir.
 */
export const CALISMA_GRUBU_UST_SINIRI = 5;

/** Seçim sayısı sınırı aşıyor mu? */
export function calismaGrubuSayisiAsildiMi(secilenSayisi: number): boolean {
  return secilenSayisi > CALISMA_GRUBU_UST_SINIRI;
}
