import {
  enSikDeger,
  GECICI_KURUM_KODU_TABANI,
  geciciKurumKoduMu,
  kisileriGrupla,
  okulAdiAnahtari,
  okulAdiDuzelt,
  okulAdlariEsMi,
  okulOnerisi,
  okulTuruTahmin,
  sonrakiGeciciKurumKodu,
} from "@/lib/okul/eslestirme";

/**
 * Okul eşleştirme (9 Kasım 2026). Örnek adlar canlıdaki gerçek yazımlardan
 * alındı: aynı okulu farklı yazan kişilerin tek gruba düşmesi, farklı okulların
 * ise AYRI kalması gerekiyor — yanlış birleşen grup, bir kişiyi başka bir okula
 * bağlatır.
 */
describe("geçici kurum kodu", () => {
  test("ilk kod tabanın bir üstü", () => {
    expect(sonrakiGeciciKurumKodu(null)).toBe(GECICI_KURUM_KODU_TABANI + 1);
    expect(sonrakiGeciciKurumKodu(750001)).toBe(GECICI_KURUM_KODU_TABANI + 1);
  });

  test("sonraki kod en büyüğün bir fazlası", () => {
    expect(sonrakiGeciciKurumKodu(GECICI_KURUM_KODU_TABANI + 7)).toBe(
      GECICI_KURUM_KODU_TABANI + 8,
    );
  });

  test("MEB kodu geçici sayılmaz", () => {
    expect(geciciKurumKoduMu(750001)).toBe(false);
    expect(geciciKurumKoduMu(GECICI_KURUM_KODU_TABANI + 1)).toBe(true);
  });
});

describe("okul adı düzeltme", () => {
  test.each([
    ["  ankara   atatürk lisesi ", "Ankara Atatürk Lisesi"],
    ["SERÇEV ENGELSİZ MESLEKİ VE TEKNİK ANADOLU LİSESİ", "Serçev Engelsiz Mesleki ve Teknik Anadolu Lisesi"],
    ["ASELSAN Mesleki ve Teknik Anadolu Lisesi", "ASELSAN Mesleki ve Teknik Anadolu Lisesi"],
    ["İnönü Anadolu lisesi", "İnönü Anadolu lisesi"],
  ])("%s → %s", (girdi, beklenen) => {
    expect(okulAdiDuzelt(girdi)).toBe(beklenen);
  });
});

describe("kısaltma açılımı", () => {
  test("MTAL ve AİHL açılır", () => {
    expect(okulAdiAnahtari("Muradiye Turizm MTAL")).toBe(
      "muradiye turizm mesleki ve teknik anadolu lisesi",
    );
    expect(okulAdiAnahtari("Nilüfer AİHL")).toBe(
      "nilufer anadolu imam hatip lisesi",
    );
  });

  test.each([
    ["Mimar Sinan MTAL", "mimar sinan mesleki teknik anadolu lisesi"],
    ["Şehit Osman karakuş Anadolu imam-hatip lisesi", "Şehit Osman Karakuş AİHL"],
    ["Turgut Altınok Anadolu İmma Hatip Lisesi", "Turgut Altınok Anadolu İmam Hatip lisesi"],
    ["Hüseyin Girenes Fen Lisesj", "Hüseyin Girenes Fen Lisesi"],
    ["Beşiktaş Atatürk AL", "Beşiktaş Atatürk Anadolu Lisesi"],
  ])("%s ≈ %s", (a, b) => {
    expect(okulAdlariEsMi(a, b)).toBe(true);
  });

  test.each([
    ["İnönü Anadolu Lisesi", "İnönü Mesleki ve Teknik Anadolu Lisesi"],
    ["Kadıköy Fen Lisesi", "Kadıköy Anadolu Lisesi"],
    ["Turgut Altınok Anadolu İmam Hatip Lisesi", "Turgut Altınok İmam Hatip Ortaokulu"],
  ])("%s ≠ %s", (a, b) => {
    expect(okulAdlariEsMi(a, b)).toBe(false);
  });
});

describe("kişileri gruplama", () => {
  const kisi = (id: number, ilKodu: string, beyanOkulAdi: string) => ({
    id,
    ilKodu,
    beyanOkulAdi,
  });

  test("aynı ildeki benzer yazımlar tek grup, kalabalık önce", () => {
    const gruplar = kisileriGrupla([
      kisi(1, "26", "Eskişehir İnönü Anadolu lisesi"),
      kisi(2, "26", "İnönü Anadolu Lisesi"),
      kisi(3, "26", "İnönü Anadolu lisesi"),
      kisi(4, "26", "İnönü mesleki ve teknik Anadolu lisesi"),
      kisi(5, "26", "inönü anadolu lisesi"),
    ]);
    expect(gruplar[0].kisiler.map((k) => k.id)).toEqual([2, 3, 5]);
    expect(gruplar.map((g) => g.kisiler.length).sort()).toEqual([1, 1, 3]);
  });

  test("grup adı en yaygın yazım, eşitlikte açık yazım", () => {
    const gruplar = kisileriGrupla([
      kisi(1, "34", "Pendik MTAL"),
      kisi(2, "34", "Pendik Mesleki ve Teknik Anadolu Lisesi"),
      kisi(3, "34", "Beşiktaş Atatürk AL"),
      kisi(4, "34", "beşiktaş atatürk anadolu lisesi"),
      kisi(5, "34", "BEŞİKTAŞ ATATÜRK ANADOLU LİSESİ"),
    ]);
    expect(gruplar.map((g) => g.okulAdi)).toEqual([
      "Beşiktaş Atatürk Anadolu Lisesi",
      "Pendik Mesleki ve Teknik Anadolu Lisesi",
    ]);
  });

  test("farklı illerdeki aynı ad ayrı gruptur", () => {
    const gruplar = kisileriGrupla([
      kisi(1, "06", "Atatürk Anadolu Lisesi"),
      kisi(2, "35", "Atatürk Anadolu Lisesi"),
    ]);
    expect(gruplar).toHaveLength(2);
  });
});

describe("kayıtlı okul önerisi", () => {
  const okullar = [
    { kurumKodu: 1, ad: "İnönü Anadolu Lisesi" },
    { kurumKodu: 2, ad: "İnönü Mesleki ve Teknik Anadolu Lisesi" },
    { kurumKodu: 3, ad: "Fen Lisesi" },
  ];

  test("benzer ad önerilir", () => {
    expect(okulOnerisi("inönü anadolu lisesi", okullar)?.kurumKodu).toBe(1);
    expect(okulOnerisi("İnönü MTAL", okullar)?.kurumKodu).toBe(2);
  });

  test("il adıyla başlayan yazım içermeyle yakalanır", () => {
    expect(
      okulOnerisi("Eskişehir İnönü Anadolu Lisesi", okullar)?.kurumKodu,
    ).toBe(1);
  });

  test("iki kelimelik genel ad içermeyle eşleşmez", () => {
    expect(okulOnerisi("Ankara Fen Lisesi", okullar)).toBeNull();
  });
});

describe("yardımcılar", () => {
  test("en sık değer", () => {
    expect(enSikDeger(["0601", null, "0602", "0601"])).toBe("0601");
    expect(enSikDeger([null, undefined])).toBeNull();
  });

  test.each([
    ["Acıpayam Cumhuriyet fen lisesi", "Fen Lisesi"],
    ["Nilüfer AİHL", "Anadolu İmam Hatip Lisesi"],
    ["Mimar Sinan MTAL", "Mesleki ve Teknik Anadolu Lisesi"],
    ["Cemil Yıldırım Bilim Sanat Merkezi", null],
    ["Şehit Abdullah Büyüksoy BİLSEM", "Bilim ve Sanat Merkezi"],
    ["Etlik Anadolu Lisesi", "Anadolu Lisesi"],
  ])("%s → %s", (ad, tur) => {
    expect(okulTuruTahmin(ad)).toBe(tur);
  });
});
