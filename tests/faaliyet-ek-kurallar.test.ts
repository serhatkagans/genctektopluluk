import {
  type EkSinirlari,
  FAALIYET_MAKS_EK,
  KAZANIM_MAKS_EK,
  ekAdediUygunMu,
  ekKabulEdilirMi,
  ekTuruBelirle,
  yorumKabulEdilirMi,
} from "@/lib/faaliyet/ek-kurallar";

/**
 * Ek ve yorum kabul kuralları — references/domain-rules.md Bölüm 7.
 *
 * Sınırlar sistem_ayari'ndan gelir, koda gömülmez; testler bu yüzden sınırı
 * parametre olarak veriyor.
 */

const SINIRLAR: EkSinirlari = {
  izinliGorselTipleri: ["image/jpeg", "image/png", "image/webp"],
  izinliBelgeTipleri: ["application/pdf"],
  gorselMaksBayt: 5 * 1024 * 1024,
  belgeMaksBayt: 10 * 1024 * 1024,
};

const dosya = (ozellikler: Partial<Parameters<typeof ekKabulEdilirMi>[0]>) => ({
  dosyaAdi: "afis.png",
  mimeTipi: "image/png",
  boyutBayt: 1024,
  ...ozellikler,
});

describe("ek türü", () => {
  it("görsel tiplerini tanır", () => {
    expect(ekTuruBelirle("image/webp", SINIRLAR)).toBe("GORSEL");
  });

  it("belge tiplerini tanır", () => {
    expect(ekTuruBelirle("application/pdf", SINIRLAR)).toBe("BELGE");
  });

  it("listede olmayan tipe tür vermez", () => {
    expect(ekTuruBelirle("application/zip", SINIRLAR)).toBeNull();
  });
});

describe("ek kabulü", () => {
  it("izinli tip ve boyutta kabul edilir", () => {
    const karar = ekKabulEdilirMi(dosya({}), SINIRLAR);
    expect(karar.olurMu).toBe(true);
    expect(karar.tur).toBe("GORSEL");
  });

  it("izin verilmeyen tip açık gerekçeyle reddedilir", () => {
    const karar = ekKabulEdilirMi(
      dosya({ mimeTipi: "application/x-msdownload", dosyaAdi: "kur.exe" }),
      SINIRLAR,
    );
    expect(karar.olurMu).toBe(false);
    expect(karar.neden).toContain("yüklenemez");
    expect(karar.neden).toContain("image/jpeg");
  });

  it("görsel kendi sınırını aşarsa reddedilir", () => {
    const karar = ekKabulEdilirMi(
      dosya({ boyutBayt: 6 * 1024 * 1024 }),
      SINIRLAR,
    );
    expect(karar.olurMu).toBe(false);
    expect(karar.neden).toContain("5 MB");
  });

  it("belge sınırı görselden ayrıdır", () => {
    // 6 MB bir görsel için fazla ama bir pdf için değil.
    const buyukPdf = dosya({
      mimeTipi: "application/pdf",
      dosyaAdi: "kilavuz.pdf",
      boyutBayt: 6 * 1024 * 1024,
    });
    expect(ekKabulEdilirMi(buyukPdf, SINIRLAR).olurMu).toBe(true);
  });

  it("belge kendi sınırını aşarsa reddedilir", () => {
    const karar = ekKabulEdilirMi(
      dosya({
        mimeTipi: "application/pdf",
        dosyaAdi: "kilavuz.pdf",
        boyutBayt: 11 * 1024 * 1024,
      }),
      SINIRLAR,
    );
    expect(karar.olurMu).toBe(false);
    expect(karar.neden).toContain("10 MB");
  });

  it("boş dosya reddedilir", () => {
    expect(ekKabulEdilirMi(dosya({ boyutBayt: 0 }), SINIRLAR).olurMu).toBe(
      false,
    );
  });

  it("adsız dosya reddedilir", () => {
    expect(ekKabulEdilirMi(dosya({ dosyaAdi: "  " }), SINIRLAR).olurMu).toBe(
      false,
    );
  });
});

describe("yorum kabulü", () => {
  it("dolu içerik kabul edilir", () => {
    expect(yorumKabulEdilirMi("Katılmak istiyorum.").olurMu).toBe(true);
  });

  it("boşluktan oluşan yorum reddedilir", () => {
    expect(yorumKabulEdilirMi("   \n  ").olurMu).toBe(false);
  });

  it("2000 karakteri aşan yorum reddedilir", () => {
    expect(yorumKabulEdilirMi("a".repeat(2001)).olurMu).toBe(false);
  });
});

describe("ek adedi tavanı (6 Kasım 2026 · disk doldurmaya karşı)", () => {
  it("tavanın altında kabul eder, tavanda reddeder", () => {
    expect(ekAdediUygunMu(0, FAALIYET_MAKS_EK).olurMu).toBe(true);
    expect(ekAdediUygunMu(FAALIYET_MAKS_EK - 1, FAALIYET_MAKS_EK).olurMu).toBe(true);
    const karar = ekAdediUygunMu(FAALIYET_MAKS_EK, FAALIYET_MAKS_EK);
    expect(karar.olurMu).toBe(false);
    expect(karar.neden).toContain(String(FAALIYET_MAKS_EK));
  });

  it("kazanım tavanı etkinlikten dar", () => {
    expect(KAZANIM_MAKS_EK).toBeLessThan(FAALIYET_MAKS_EK);
    expect(ekAdediUygunMu(KAZANIM_MAKS_EK, KAZANIM_MAKS_EK).olurMu).toBe(false);
  });
});
