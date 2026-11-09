/**
 * OKUL EŞLEŞTİRME — saf kurallar (9 Kasım 2026 · istekler: "belirsizler için
 * onay ekranı … aynı adla yazılmış öğrencileri grup halinde görür ve tek
 * tıkla doğru okula bağlar" · "koordinatör ilindekileri atasın ya da
 * bağlasın" · "gerçek okulları olsun herkesin").
 *
 * NEDEN GEREKTİ: canlıda `kurum` tablosu fiilen boştu (4 satır, hepsi pasif),
 * yani kayıt ekranındaki okul listesinden seçilecek bir şey yoktu ve herkes
 * okulunu "Okulum listede yok" ile elle yazdı. Sonuç: hiç kimse bir okula
 * bağlı değildi, okul temsilciliği kimseye verilemiyordu (kapı öğrencinin
 * kurum kodunu şart koşuyor) ve 31 Ekim öncesi kayıtların ilçesi boş kaldı.
 *
 * GEÇİCİ KURUM KODU: istek sırasında MEB kurum kodunun sorulmaması istendi
 * ("kurum kodu kalsın şimdilik karışır"). Kurum tablosunun anahtarı ise MEB
 * kodu. Ekrandan eklenen okul bu yüzden GEÇİCİ_KURUM_KODU_TABANI'nın
 * üstünde bir numara alıyor: MEB kodları altı-yedi hanelidir, dokuz haneli
 * aralık onlarla hiçbir zaman çakışmaz ve kodun geçici olduğu sayının
 * kendisinden okunur.
 *
 * EBA'YA GEÇMEDEN ÖNCE DÜZELTİLMELİ: EBA girişinde kimlik gerçek kurum
 * koduyla gelir; gece senkronu (lib/kullanici/senkron.ts) danışmanın kayıtlı
 * kodu ile gelen kodu karşılaştırıp fark görürse danışmanlığı kapatır. Geçici
 * kodlu okullar o gün gerçek kodlarına taşınmalı.
 *
 * Saf tutulur: veritabanına gitmez, birim testle kapsanır.
 */
import { okulAdiSadele, okulAdiBenzerMi } from "./benzerlik";
import { BILINEN_OKUL_TURLERI } from "./turler";

/** Ekrandan eklenen okulların kurum kodu bu sayıdan büyüktür. */
export const GECICI_KURUM_KODU_TABANI = 900_000_000;

export function geciciKurumKoduMu(kurumKodu: number): boolean {
  return kurumKodu > GECICI_KURUM_KODU_TABANI;
}

/** Var olan en büyük geçici koddan sonraki numara. */
export function sonrakiGeciciKurumKodu(enBuyuk: number | null): number {
  return enBuyuk !== null && enBuyuk > GECICI_KURUM_KODU_TABANI
    ? enBuyuk + 1
    : GECICI_KURUM_KODU_TABANI + 1;
}

/** Okul adının üst sınırı (kurum.ad VARCHAR(250)). */
export const OKUL_ADI_UST_SINIRI = 250;

/**
 * Elle yazılmış adı okul kaydına yazılacak biçime getirir: fazla boşluk
 * atılır, tümü küçük ya da tümü büyük yazılmışsa kelime başları büyütülür.
 * Karışık yazılmış ad ("ASELSAN Mesleki ve Teknik…") olduğu gibi kalır —
 * kısaltmaları bozmamak için.
 */
export function okulAdiDuzelt(ad: string): string {
  const temiz = ad.replace(/\s+/g, " ").trim();
  const kucuk = temiz.toLocaleLowerCase("tr-TR");
  const buyuk = temiz.toLocaleUpperCase("tr-TR");
  if (temiz !== kucuk && temiz !== buyuk) return temiz;
  return kucuk
    .split(" ")
    .map((kelime) =>
      kelime === "ve"
        ? kelime
        : kelime.charAt(0).toLocaleUpperCase("tr-TR") + kelime.slice(1),
    )
    .join(" ");
}

/**
 * Kısaltma açılımları. Yalnızca BÜTÜN KELİME olarak eşleşir: "mtal" açılır,
 * "Mtalib" gibi bir ad dokunulmaz.
 */
const KISALTMALAR: readonly [RegExp, string][] = [
  [/\bmtal\b/g, "mesleki ve teknik anadolu lisesi"],
  [/\bmtem\b/g, "mesleki ve teknik egitim merkezi"],
  [/\bmem\b/g, "mesleki egitim merkezi"],
  [/\baihl\b/g, "anadolu imam hatip lisesi"],
  [/\bihl\b/g, "imam hatip lisesi"],
  [/\bcpal\b/g, "cok programli anadolu lisesi"],
  [/\bsbl\b/g, "sosyal bilimler lisesi"],
  [/\bbilsem\b/g, "bilim ve sanat merkezi"],
  [/\bmesleki teknik\b/g, "mesleki ve teknik"],
  // "AL" / "FL" yalnızca adın SONUNDA: ortada bir kelime olabilir.
  [/\bal$/g, "anadolu lisesi"],
  [/\bfl$/g, "fen lisesi"],
  [/\blise\b/g, "lisesi"],
  [/\blis\b/g, "lisesi"],
];

/**
 * Karşılaştırma anahtarı: sadeleştirilmiş ad + açılmış kısaltmalar.
 * "Bursa Muradiye Turizm MTAL" ile "muradiye turizm mesleki ve teknik
 * anadolu lisesi" aynı anahtara çok yaklaşır.
 */
export function okulAdiAnahtari(ad: string): string {
  let anahtar = okulAdiSadele(ad);
  for (const [kalip, acilim] of KISALTMALAR) {
    anahtar = anahtar.replace(kalip, acilim);
  }
  return anahtar.replace(/\s+/g, " ").trim();
}

/** Kısaltmaları açarak iki adın aynı okulu anlatıp anlatmadığı. */
export function okulAdlariEsMi(a: string, b: string): boolean {
  return okulAdiBenzerMi(okulAdiAnahtari(a), okulAdiAnahtari(b));
}

export type KisiGrubu<T> = {
  ilKodu: string | null;
  /** Gruptaki en yaygın yazım (bkz. grupAdiSec), düzeltilmiş hâliyle. */
  okulAdi: string;
  kisiler: T[];
};

/**
 * Elle yazılmış okul adlarını İL İÇİNDE gruplar. Benzer yazılmış adlar aynı
 * gruba düşer; grup adı `grupAdiSec` ile seçilir. Gruplar kalabalıktan aza
 * sıralanır — en çok kişiyi bağlayan iş önce.
 *
 * Bu bir ÖNERİDİR: ekranda her kişinin kutusu ayrı işaretlenir ve yanlış
 * gruba düşen kişi işareti kaldırılarak dışarıda bırakılır.
 */
export function kisileriGrupla<
  T extends { ilKodu: string | null; beyanOkulAdi: string },
>(kisiler: readonly T[]): KisiGrubu<T>[] {
  const gruplar: (KisiGrubu<T> & { anahtar: string })[] = [];
  for (const kisi of kisiler) {
    const anahtar = okulAdiAnahtari(kisi.beyanOkulAdi);
    const grup = gruplar.find(
      (g) => g.ilKodu === kisi.ilKodu && okulAdiBenzerMi(g.anahtar, anahtar),
    );
    if (grup) grup.kisiler.push(kisi);
    else
      gruplar.push({
        ilKodu: kisi.ilKodu,
        okulAdi: "",
        anahtar,
        kisiler: [kisi],
      });
  }
  return gruplar
    .map(({ ilKodu, kisiler: liste }) => ({
      ilKodu,
      okulAdi: grupAdiSec(liste.map((kisi) => kisi.beyanOkulAdi)),
      kisiler: liste,
    }))
    .sort(
      (a, b) =>
        b.kisiler.length - a.kisiler.length ||
        a.okulAdi.localeCompare(b.okulAdi, "tr"),
    );
}

/**
 * Grubun adı = yeni okul eklenirken önerilen ad. En çok kişinin yazdığı
 * biçim seçilir; eşitlikte EN UZUN olan — kısaltmalı yazım ("Pendik MTAL")
 * yerine açık yazımın ("Pendik Mesleki ve Teknik Anadolu Lisesi") okul
 * kaydına girmesi için.
 */
export function grupAdiSec(adlar: readonly string[]): string {
  const sayac = new Map<string, number>();
  for (const ad of adlar) {
    const duzgun = okulAdiDuzelt(ad);
    sayac.set(duzgun, (sayac.get(duzgun) ?? 0) + 1);
  }
  return [...sayac.entries()].sort(
    ([a, x], [b, y]) => y - x || b.length - a.length,
  )[0][0];
}

/**
 * Grubun adına en çok benzeyen kayıtlı okul (aynı ilin okulları verilmeli).
 *
 * İki ölçüt: düzenleme uzaklığıyla benzerlik ya da biri ötekinin TAMAMINI
 * içeriyorsa ("Eskişehir İnönü Anadolu Lisesi" ⊃ "İnönü Anadolu Lisesi").
 * İçerme yalnızca kısa olan en az üç kelimeyse sayılır: "Anadolu Lisesi"
 * her Anadolu lisesinin içinde geçer.
 */
export function okulOnerisi<T extends { ad: string }>(
  grupAdi: string,
  okullar: readonly T[],
): T | null {
  const anahtar = okulAdiAnahtari(grupAdi);
  let enIyi: { okul: T; puan: number } | null = null;
  for (const okul of okullar) {
    const okulAnahtari = okulAdiAnahtari(okul.ad);
    let puan = 0;
    if (okulAnahtari === anahtar) puan = 3;
    else if (okulAdiBenzerMi(okulAnahtari, anahtar)) puan = 2;
    else if (icerirMi(anahtar, okulAnahtari)) puan = 1;
    if (puan > 0 && (!enIyi || puan > enIyi.puan)) enIyi = { okul, puan };
  }
  return enIyi?.okul ?? null;
}

function icerirMi(a: string, b: string): boolean {
  const [kisa, uzun] = a.length <= b.length ? [a, b] : [b, a];
  if (kisa.split(" ").length < 3) return false;
  return ` ${uzun} `.includes(` ${kisa} `);
}

/** Listede en sık geçen dolu değer; eşitlikte ilk görülen. */
export function enSikDeger(
  degerler: readonly (string | null | undefined)[],
): string | null {
  const sayac = new Map<string, number>();
  for (const deger of degerler) {
    if (deger) sayac.set(deger, (sayac.get(deger) ?? 0) + 1);
  }
  let enIyi: string | null = null;
  let enCok = 0;
  for (const [deger, adet] of sayac) {
    if (adet > enCok) {
      enIyi = deger;
      enCok = adet;
    }
  }
  return enIyi;
}

/**
 * Okul adından türünü tahmin eder (ör. "… Fen Lisesi" → "Fen Lisesi").
 * Kişilerin kayıtta seçtiği tür yoksa formdaki ön seçim buradan gelir;
 * kullanıcı değiştirebilir. Uzun türler önce denenir: "Anadolu İmam Hatip
 * Lisesi" "İmam Hatip Lisesi"nden önce yakalanmalı.
 */
export function okulTuruTahmin(ad: string): string | null {
  const anahtar = okulAdiAnahtari(ad);
  const turler = [...BILINEN_OKUL_TURLERI].sort((a, b) => b.length - a.length);
  for (const tur of turler) {
    if (anahtar.includes(okulAdiAnahtari(tur))) return tur;
  }
  return null;
}
