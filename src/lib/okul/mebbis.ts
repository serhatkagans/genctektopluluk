import { GECICI_KURUM_KODU_TABANI, okulAdiAnahtari } from "./eslestirme";
import { BILINEN_OKUL_TURLERI } from "./turler";

/**
 * MEBBİS KURUM LİSTESİ KURALLARI (16 Kasım 2026).
 *
 * Okul listesi mebbis.meb.gov.tr/kurumlistesi.aspx'ten (Resmi Kurumlar, lise
 * düzeyi) çekilip `scripts/okul-listesi-yukle.ts` ile yüklendi; çift kayıtlar
 * `scripts/okul-cift-birlestir.ts` ile birleştirildi. Buradaki saf kurallar
 * ikisinin de ortak dayanağı ve testi (tests/okul-mebbis.test.ts).
 *
 * İLKE: VERİ KAYBI OLMASIN (istek: "çakışan ismi sistemde hatalı olan okullar
 * olabilir, veri kaybı olmamalı"; "aynı tür ve isimse birleştir, yanlış
 * birleştirmenden endişe ediyorum"). Bu yüzden "aynı okul" kararı GEVŞEK
 * benzerlikle değil, aşağıdaki KATI anahtarla veriliyor.
 */

/** MEBBİS tür adı → bizim okul türümüz. Listede olmayan tür olduğu gibi kalır. */
const TUR_ESLEME: Record<string, string> = {
  "Anadolu Meslek Programı": "Mesleki ve Teknik Anadolu Lisesi",
  "BİLSEM (Üstün veya Özel Yetenekliler)": "Bilim ve Sanat Merkezi",
  BİLSEM: "Bilim ve Sanat Merkezi",
  "Mesleki Eğitim Merkezi": "Mesleki ve Teknik Eğitim Merkezi",
  "Özel Eğitim Meslek Okulu (Zihinsel Engelliler)": "Özel Eğitim Meslek Lisesi",
  "Özel Eğitim Meslek Okulu": "Özel Eğitim Meslek Lisesi",
  "Hazırlık Sınıfı Bulunan Fen Lisesi": "Fen Lisesi",
  // Bizde ayrı türü yok; en yakını Güzel Sanatlar Lisesi (sanat liseleri).
  "Müzik ve Sahne Sanatları Lisesi": "Güzel Sanatlar Lisesi",
};

/**
 * MEBBİS türünü bizim türümüze çevirir; bizim 12 türümüzden birine düşmüyorsa
 * null (ilkokul, ortaokul, halk eğitim … yüklenmez).
 *
 * "… ANADOLU İMAM HATİP LİSESİ" adlı okulların bir kısmı MEBBİS'te "İmam
 * Hatip Lisesi" türünde duruyor; kayıtta öğrenci türü adından seçtiği için
 * tür adla çelişirse okulunu listede bulamazdı.
 */
export function mebbisTurunuCevir(mebbisTuru: string, ad: string): string | null {
  const ham = mebbisTuru.trim();
  /*
   * PARANTEZ İÇİ EK YOK SAYILIR (17 Kasım 2026): "Anadolu İmam Hatip
   * Lisesi(Yabancı Uyruklular)", "Özel Eğitim Meslek Lisesi(İşitme
   * Engelliler)" gibi 55 resmî okul ilk yüklemede tür tanınmadığı için
   * atlanmıştı (ör. Uluslararası Seferihisar Borsa İstanbul AİHL).
   */
  const sade = ham.replace(/\s*\([^)]*\)\s*$/, "").trim();
  let tur = TUR_ESLEME[ham] ?? TUR_ESLEME[sade] ?? sade;
  if (
    tur === "İmam Hatip Lisesi" &&
    ad.toLocaleLowerCase("tr-TR").includes("anadolu imam hatip")
  ) {
    tur = "Anadolu İmam Hatip Lisesi";
  }
  return BILINEN_OKUL_TURLERI.includes(tur) ? tur : null;
}

/** MEBBİS adları BÜYÜK HARF; bunlar başlık biçimine çevrilirken büyük kalır. */
const KISALTMA_KELIMELER = new Set([
  "BTSO", "TOKİ", "TEV", "TOBB", "İMKB", "TED", "TÜBİTAK", "OSB", "THY", "TSK",
  "TCDD", "PTT", "MÜSİAD", "TÜSİAD", "İTO", "İSO", "ATSO", "KTO", "ETO", "ESO",
  "GTO", "KSO", "ASO", "TİM", "TMMOB", "TRT", "TEİAŞ", "SGK", "BOTAŞ", "TPAO",
  "DMO", "MKE", "İSKİ", "ASKİ", "İZSU", "TEMSA", "İDO", "TAV", "THK", "AFAD",
]);

function kelimeBasHarfi(kelime: string): string {
  if (KISALTMA_KELIMELER.has(kelime.toLocaleUpperCase("tr-TR"))) {
    return kelime.toLocaleUpperCase("tr-TR");
  }
  return (
    kelime
      .toLocaleLowerCase("tr-TR")
      // Kelime başı her zaman; nokta/tire sonrası yalnızca ardından harf ya da
      // nokta geliyorsa ("İbn-i Sina" kalır; "Zeynep-Hasan", "Dr.M." olur).
      .replace(/^\p{L}/u, (harf) => harf.toLocaleUpperCase("tr-TR"))
      // Noktadan ve parantezden sonra her zaman ("E.C.A", "Prof.Dr.").
      .replace(/([.(])(\p{L})/gu, (_, on: string, harf: string) =>
        on + harf.toLocaleUpperCase("tr-TR"),
      )
      // Tireden sonra yalnızca ardından harf geliyorsa ("Zeynep-Hasan";
      // "İbn-i Sina" ve "Murad-ı Veli"deki tek harfli ek küçük kalır).
      .replace(/([-/])(\p{L})(?=\p{L})/gu, (_, on: string, harf: string) =>
        on + harf.toLocaleUpperCase("tr-TR"),
      )
  );
}

/** "PROF.DR. ZEYNEP-HASAN ANADOLU LİSESİ" → "Prof.Dr. Zeynep-Hasan Anadolu Lisesi". */
export function baslikHarfi(ad: string): string {
  return ad
    .split(/\s+/)
    .filter(Boolean)
    .map((k, i) =>
      i > 0 && k.toLocaleLowerCase("tr-TR") === "ve" ? "ve" : kelimeBasHarfi(k),
    )
    .join(" ")
    .replace(/Meslekî/g, "Mesleki");
}

/**
 * Birebir eşleşen okulun mevcut adı gerçekten bozuk mu? Koordinatörün düzgün
 * yazdığı adı ("BTSO …") MEBBİS'in büyük harfinden üretilmiş tahmini biçimle
 * ezmemek için yalnızca bariz bozuklukta ad değişir: küçük harfle başlayan
 * kelime ("Anadolu lisesi") ya da kısaltma (MTAL).
 */
export function adBozukMu(ad: string): boolean {
  const kelimeler = ad.split(/\s+/).filter(Boolean);
  if (kelimeler.some((k, i) => (i === 0 || k !== "ve") && /^\p{Ll}/u.test(k))) {
    return true;
  }
  return /(^|\s)(MTAL|AİHL|AIHL|İHL|IHL|ÇPAL|CPAL|SBL|MTEM|AL|FL)(\s|$)/u.test(ad);
}

/** Eşleştirmede ayırt edici sayılmayan kelimeler (anahtar biçiminde). */
const GENEL_KELIMELER = new Set([
  "anadolu", "lisesi", "mesleki", "meslek", "ve", "teknik", "imam", "hatip",
  "fen", "kiz", "erkek", "cok", "programli", "sosyal", "bilimler", "guzel",
  "sanatlar", "spor", "bilim", "sanat", "merkezi", "egitim", "ozel", "sehit",
  "merkez", "okulu", "lise", "il", "ilce", "turizm", "ticaret", "saglik",
]);

/** İl ve ilçe adlarının anahtar biçimindeki kelimeleri ("Şirvan" → "sirvan"). */
export function yerAdlariKumesi(adlar: readonly string[]): Set<string> {
  return new Set(adlar.flatMap((ad) => okulAdiAnahtari(ad).split(" ")).filter(Boolean));
}

/** Adın ayırt edici kelimeleri: genel kelimeler ve il/ilçe adları çıkmış. */
export function ayirtEdici(ad: string, yerAdlari: ReadonlySet<string>): Set<string> {
  return new Set(
    okulAdiAnahtari(ad)
      .split(" ")
      .filter((k) => k && !GENEL_KELIMELER.has(k) && !yerAdlari.has(k)),
  );
}

/** a, b'nin boş olmayan alt kümesi mi? (Yükleyicinin GEVŞEK eşleşmesi.) */
export function altKume(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size === 0) return false;
  for (const k of a) if (!b.has(k)) return false;
  return true;
}

/**
 * KATI AD ANAHTARI: kısaltmalar açılmış ad, il/ilçe adları, "şehit" ve "ve"
 * çıkarılmış. "Çankaya Betül Can AL" ile "Betül Can Anadolu Lisesi" aynı
 * anahtarı verir; "Eryaman Şehit Ertan Akgül AL" ile "Şehit Ertan Akgül AL"
 * VERMEZ (Eryaman bir ilçe değil, ayırt edici olabilir).
 */
export function katiAdAnahtari(ad: string, yerAdlari: ReadonlySet<string>): string {
  return okulAdiAnahtari(ad)
    .split(" ")
    .filter((k) => k && k !== "sehit" && k !== "ve" && !yerAdlari.has(k))
    .join(" ");
}

/**
 * İki kayıt AYNI OKUL mu? Birleştirme kararının tek kapısı.
 *
 *   · türler aynı olmalı,
 *   · katı anahtarlar birebir aynı olmalı,
 *   · adda en az bir AYIRT EDİCİ kelime olmalı — "Anadolu Lisesi" ile
 *     "Siirt Anadolu Lisesi" aynı anahtara iner ama hiçbir şey söylemez.
 *
 * İlçe eşitliğini çağıran sağlar ("Atatürk Anadolu Lisesi" her ilçede var).
 */
export function ayniOkulMu(
  a: { ad: string; okulTuru: string | null },
  b: { ad: string; okulTuru: string | null },
  yerAdlari: ReadonlySet<string>,
): boolean {
  if (!a.okulTuru || a.okulTuru !== b.okulTuru) return false;
  if (ayirtEdici(a.ad, yerAdlari).size === 0) return false;
  return katiAdAnahtari(a.ad, yerAdlari) === katiAdAnahtari(b.ad, yerAdlari);
}

/**
 * KOORDİNATÖRÜN GİRDİĞİ MEB KURUM KODU geçerli mi? (16 Kasım 2026 · istek:
 * "koordinatör kurum kodlarını doğrusu ile değiştirebilsin").
 *
 * MEBBİS listesi kurum kodunu vermediği için okullar geçici kodla
 * (900.000.000 üstü) girildi. MEB kurum kodları 6 hanelidir (ör. 774994);
 * aralık yine de 4–8 hane tutuldu — eski ve özel kurumlarda kısa kodlar var.
 * Geçici aralığa yazılan kod reddedilir: o aralık sistemin.
 */
export function kurumKoduCoz(
  deger: string,
): { olurMu: true; kod: number } | { olurMu: false; neden: string } {
  const temiz = deger.trim();
  if (!/^\d{4,8}$/.test(temiz)) {
    return { olurMu: false, neden: "MEB kurum kodu 4–8 haneli bir sayı olmalı (ör. 774994)." };
  }
  const kod = Number(temiz);
  if (kod <= 0 || kod >= GECICI_KURUM_KODU_TABANI) {
    return { olurMu: false, neden: "Geçerli bir MEB kurum kodu yazın." };
  }
  return { olurMu: true, kod };
}
