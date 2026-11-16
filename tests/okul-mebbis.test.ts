import { GECICI_KURUM_KODU_TABANI } from "@/lib/okul/eslestirme";
import {
  adBozukMu,
  altKume,
  ayirtEdici,
  ayniOkulMu,
  baslikHarfi,
  katiAdAnahtari,
  kurumKoduCoz,
  mebbisTurunuCevir,
  yerAdlariKumesi,
} from "@/lib/okul/mebbis";

/**
 * MEBBİS okul listesi kuralları (16 Kasım 2026). Asıl korunan şey: YANLIŞ
 * BİRLEŞTİRME OLMASIN ("aynı tür ve isimse birleştir, yanlış birleştirmenden
 * endişe ediyorum") — `ayniOkulMu` testleri bu yüzden en kalabalık bölüm.
 */

const ANKARA = yerAdlariKumesi(["Ankara", "Çankaya", "Etimesgut", "Sincan", "Keçiören", "Bala"]);
const SIIRT = yerAdlariKumesi(["Siirt", "Merkez", "Şirvan", "Kurtalan", "Baykan"]);

describe("MEBBİS türünü bizim türümüze çevirme", () => {
  it("bizim 12 türümüze denk gelenler çevrilir", () => {
    expect(mebbisTurunuCevir("Anadolu Meslek Programı", "X MTAL")).toBe(
      "Mesleki ve Teknik Anadolu Lisesi",
    );
    expect(mebbisTurunuCevir("BİLSEM (Üstün veya Özel Yetenekliler)", "X")).toBe(
      "Bilim ve Sanat Merkezi",
    );
    expect(mebbisTurunuCevir("Mesleki Eğitim Merkezi", "X")).toBe(
      "Mesleki ve Teknik Eğitim Merkezi",
    );
    expect(mebbisTurunuCevir("Fen Lisesi", "X FEN LİSESİ")).toBe("Fen Lisesi");
  });

  it("adı 'Anadolu İmam Hatip' olan okul MEBBİS'te 'İmam Hatip Lisesi' görünse de AİHL olur", () => {
    expect(
      mebbisTurunuCevir("İmam Hatip Lisesi", "SİİRT ANADOLU İMAM HATİP LİSESİ"),
    ).toBe("Anadolu İmam Hatip Lisesi");
    expect(mebbisTurunuCevir("İmam Hatip Lisesi", "X İMAM HATİP LİSESİ")).toBe(
      "İmam Hatip Lisesi",
    );
  });

  it("lise düzeyi dışındaki kurumlar yüklenmez", () => {
    expect(mebbisTurunuCevir("İlkokul", "X İLKOKULU")).toBeNull();
    expect(mebbisTurunuCevir("Ortaokul", "X ORTAOKULU")).toBeNull();
    expect(mebbisTurunuCevir("Halk Eğitimi Merkezi", "X")).toBeNull();
  });
});

describe("büyük harfli MEBBİS adını başlık biçimine çevirme", () => {
  it("kelime başları büyür, 've' küçük kalır", () => {
    expect(baslikHarfi("SİİRT MESLEKİ VE TEKNİK ANADOLU LİSESİ")).toBe(
      "Siirt Mesleki ve Teknik Anadolu Lisesi",
    );
  });

  it("bilinen kısaltmalar büyük kalır", () => {
    expect(baslikHarfi("BTSO ALİ OSMAN SÖNMEZ SOSYAL BİLİMLER LİSESİ")).toBe(
      "BTSO Ali Osman Sönmez Sosyal Bilimler Lisesi",
    );
    expect(baslikHarfi("TOKİ SARIÇAM ANADOLU LİSESİ")).toBe("TOKİ Sarıçam Anadolu Lisesi");
  });

  it("nokta ve tireden sonra büyür; tek harfli ek küçük kalır", () => {
    expect(baslikHarfi("PROF.DR. ORHAN OĞUZ ANADOLU LİSESİ")).toBe(
      "Prof.Dr. Orhan Oğuz Anadolu Lisesi",
    );
    expect(baslikHarfi("ZEYNEP-HASAN ERÇELEBİ ANADOLU LİSESİ")).toBe(
      "Zeynep-Hasan Erçelebi Anadolu Lisesi",
    );
    expect(baslikHarfi("İBN-İ SİNA MESLEKİ VE TEKNİK ANADOLU LİSESİ")).toBe(
      "İbn-i Sina Mesleki ve Teknik Anadolu Lisesi",
    );
  });

  it("'Meslekî' düz yazılır", () => {
    expect(baslikHarfi("ORMANDALI MESLEKÎ VE TEKNİK ANADOLU LİSESİ")).toBe(
      "Ormandalı Mesleki ve Teknik Anadolu Lisesi",
    );
  });
});

describe("mevcut ad bozuk mu (birebir eşleşmede ad yalnızca bozuksa değişir)", () => {
  it("küçük harfle başlayan kelime ya da kısaltma bozuktur", () => {
    expect(adBozukMu("Şavşat Anadolu lisesi")).toBe(true);
    expect(adBozukMu("fethiye kemal mumcu anadolu lisesi")).toBe(true);
    expect(adBozukMu("1 Eylül MTAL")).toBe(true);
    expect(adBozukMu("Atatürk AİHL")).toBe(true);
  });

  it("düzgün yazılmış ad, kısaltmalı özel ad dahil, bozuk sayılmaz", () => {
    expect(adBozukMu("Siirt Mesleki ve Teknik Anadolu Lisesi")).toBe(false);
    expect(adBozukMu("BTSO Ali Osman Sönmez Sosyal Bilimler Lisesi")).toBe(false);
  });
});

describe("ayırt edici kelimeler ve gevşek (alt küme) eşleşme", () => {
  it("genel kelimeler ve il/ilçe adları ayırt edici değildir", () => {
    expect([...ayirtEdici("Kurtalan Anadolu Lisesi", SIIRT)]).toEqual([]);
    expect([...ayirtEdici("Şehit Abdulhakim Ayten AİHL", SIIRT)].sort()).toEqual([
      "abdulhakim",
      "ayten",
    ]);
  });

  it("boş küme hiçbir şeyin alt kümesi sayılmaz", () => {
    expect(altKume(new Set(), new Set(["a"]))).toBe(false);
    expect(altKume(new Set(["a"]), new Set(["a", "b"]))).toBe(true);
    expect(altKume(new Set(["a", "c"]), new Set(["a", "b"]))).toBe(false);
  });
});

describe("AYNI OKUL MU — birleştirmenin tek kapısı", () => {
  const al = (ad: string) => ({ ad, okulTuru: "Anadolu Lisesi" });

  it("yalnızca il/ilçe öneki ya da kısaltma farkı: aynı okul", () => {
    expect(ayniOkulMu(al("Çankaya Betül Can Anadolu Lisesi"), al("Betül Can AL"), ANKARA)).toBe(true);
    expect(
      ayniOkulMu(
        { ad: "Abdulhakim Ayten AİHL", okulTuru: "Anadolu İmam Hatip Lisesi" },
        { ad: "Şehit Abdulhakim Ayten Anadolu İmam Hatip Lisesi", okulTuru: "Anadolu İmam Hatip Lisesi" },
        SIIRT,
      ),
    ).toBe(true);
  });

  it("türler farklıysa ad aynı olsa da aynı okul DEĞİL", () => {
    expect(
      ayniOkulMu(
        { ad: "Sincan Fatih Anadolu Lisesi", okulTuru: "Anadolu Lisesi" },
        { ad: "Fatih Anadolu Lisesi", okulTuru: "Fen Lisesi" },
        ANKARA,
      ),
    ).toBe(false);
  });

  it("farklı tür ve farklı ad (Sincan Fatih MTAL ↔ Fatih AL) aynı okul DEĞİL", () => {
    expect(
      ayniOkulMu(
        { ad: "Sincan Fatih Mesleki ve Teknik Anadolu Lisesi", okulTuru: "Mesleki ve Teknik Anadolu Lisesi" },
        al("Fatih Anadolu Lisesi"),
        ANKARA,
      ),
    ).toBe(false);
  });

  it("ilçe olmayan bir yer adı (Eryaman) ayırt edicidir: aynı okul sayılmaz", () => {
    expect(
      ayniOkulMu(al("Şehit Ertan Akgül Anadolu Lisesi"), al("Eryaman Şehit Ertan Akgül Anadolu Lisesi"), ANKARA),
    ).toBe(false);
  });

  it("ayırt edici kelimesi olmayan ad hiçbir şeyle birleşmez", () => {
    expect(ayniOkulMu(al("Siirt Anadolu Lisesi"), al("Kurtalan Anadolu Lisesi"), SIIRT)).toBe(false);
    expect(ayniOkulMu(al("Anadolu Lisesi"), al("Anadolu Lisesi"), SIIRT)).toBe(false);
  });

  it("türü boş kayıt birleşmez", () => {
    expect(ayniOkulMu({ ad: "Gazi AL", okulTuru: null }, al("Gazi Anadolu Lisesi"), SIIRT)).toBe(false);
  });

  it("katı anahtar 'şehit' ve 've' kelimelerini yok sayar", () => {
    expect(katiAdAnahtari("Şehit Zafer Kılıç Spor Lisesi", SIIRT)).toBe(
      katiAdAnahtari("Zafer Kılıç Spor Lisesi", SIIRT),
    );
    expect(katiAdAnahtari("Cemil Yıldırım Bilim ve Sanat Merkezi", ANKARA)).toBe(
      katiAdAnahtari("Cemil Yıldırım Bilim Sanat Merkezi", ANKARA),
    );
  });
});

describe("koordinatörün girdiği MEB kurum kodu", () => {
  it("4–8 haneli sayı kabul edilir", () => {
    expect(kurumKoduCoz(" 774994 ")).toEqual({ olurMu: true, kod: 774994 });
    expect(kurumKoduCoz("1234")).toEqual({ olurMu: true, kod: 1234 });
  });

  it("harf, kısa/uzun sayı ve boş değer reddedilir", () => {
    for (const deger of ["", "abc", "123", "77499A", "123456789", "-77499"]) {
      expect(kurumKoduCoz(deger).olurMu).toBe(false);
    }
  });

  it("geçici kod aralığı hiçbir zaman MEB kodu olarak kabul edilmez", () => {
    expect(GECICI_KURUM_KODU_TABANI).toBeGreaterThan(99_999_999);
    expect(kurumKoduCoz(String(GECICI_KURUM_KODU_TABANI + 5)).olurMu).toBe(false);
  });
});
