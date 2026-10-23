/**
 * OKUL ADI BENZERLİĞİ (23 Ekim 2026 · istek: "öğrenci ve öğretmen aynı okulun
 * ismini aynı girmemiş olabilir, büyük küçük harf bir iki harf değişik
 * falan").
 *
 * Okulu listede olmayan kişi adını elle yazıyor; aynı okul iki kişide
 * "Çankaya Atatürk Anadolu Lisesi" ve "cankaya ataturk anadolu lis." olarak
 * durabilir. Toplu danışman atamasında öğretmenler bu karşılaştırmayla
 * sıralanır: kesin eşleşme kurum kodudur, bu ise yalnızca bir ÖNERİDİR —
 * atamayı engellemez, yönetici başka bir öğretmeni de seçebilir.
 *
 * Saf tutulur: veritabanına gitmez, birim testle kapsanır.
 */

/** Türkçe harfleri sadeleştirir, noktalamayı ve fazla boşluğu atar. */
export function okulAdiSadele(ad: string): string {
  return ad
    .toLocaleLowerCase("tr-TR")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .replace(/â/g, "a")
    .replace(/î/g, "i")
    .replace(/û/g, "u")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** İki metin arasındaki düzenleme uzaklığı (Levenshtein). */
function uzaklik(a: string, b: string): number {
  const onceki = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let solUst = onceki[0];
    onceki[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const ust = onceki[j];
      onceki[j] = Math.min(
        onceki[j] + 1,
        onceki[j - 1] + 1,
        solUst + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      solUst = ust;
    }
  }
  return onceki[b.length];
}

/**
 * İki okul adı aynı okulu mu anlatıyor?
 *
 * Sadeleştirilmiş adlar aynıysa ya da en fazla %15 oranında (en az 2 harf)
 * farklıysa evet. Oran sabit bir harf sayısı yerine kullanılıyor: kısa bir
 * adda iki harf farkı başka bir okul demek olabilir, uzun bir adda değil.
 */
export function okulAdiBenzerMi(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (!a || !b) return false;
  const x = okulAdiSadele(a);
  const y = okulAdiSadele(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const izin = Math.max(2, Math.floor(Math.max(x.length, y.length) * 0.15));
  return uzaklik(x, y) <= izin;
}
