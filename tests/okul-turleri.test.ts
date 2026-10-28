import {
  BILINEN_OKUL_TURLERI,
  KAPSAM_DISI_OKUL_KOSULU,
  kapsamDisiOkulTuruMu,
  OKUL_TURU_DIGER,
  okulTuruKosulu,
  okulTuruSecenekleri,
} from "@/lib/okul/turler";

/**
 * Okul türü süzgecinin seçenekleri ve koşulu (26 Ağustos 2026).
 *
 * İstek: "Okul türü alanına diğer okul türlerini ekleyelim meslek lisesi
 * imamhatip lisesi falan en son da diğer olsun."
 */

describe("okulTuruSecenekleri", () => {
  it("veri boşken bile standart türleri teklif eder", () => {
    // Asıl derdi bu: ilinde henüz kayıtlı meslek lisesi olmayan koordinatör
    // de o türü süzgeçte görebilmeli.
    const secenekler = okulTuruSecenekleri([]);
    expect(secenekler).toContain("Mesleki ve Teknik Anadolu Lisesi");
    expect(secenekler).toContain("Anadolu İmam Hatip Lisesi");
    expect(secenekler.length).toBe(BILINEN_OKUL_TURLERI.length + 1);
  });

  it("veriden gelen ama listede olmayan türü korur", () => {
    // Eski kararın koruduğu şey buydu: tür alanı e-Okul'dan serbest metin
    // geliyor ve yeni bir tür süzgeçte kaybolmamalı.
    expect(okulTuruSecenekleri(["Denizcilik Meslek Lisesi"])).toContain(
      "Denizcilik Meslek Lisesi",
    );
  });

  it("tekrarları ve boşlukları eler", () => {
    const secenekler = okulTuruSecenekleri([
      "Fen Lisesi",
      "  Fen Lisesi  ",
      "",
      "   ",
    ]);
    expect(secenekler.filter((tur) => tur === "Fen Lisesi")).toHaveLength(1);
    expect(secenekler).not.toContain("");
  });

  it("'Diğer'i her zaman en sona koyar", () => {
    // Alfabetik sırada ortalara düşseydi bir tür adı gibi okunurdu.
    for (const veri of [[], ["Zümrüt Lisesi"], ["Açık Öğretim Lisesi"]]) {
      const secenekler = okulTuruSecenekleri(veri);
      expect(secenekler[secenekler.length - 1]).toBe(OKUL_TURU_DIGER);
      expect(secenekler.filter((tur) => tur === OKUL_TURU_DIGER)).toHaveLength(
        1,
      );
    }
  });

  it("veriden 'Diğer' gelse bile ikinci kez basmaz", () => {
    const secenekler = okulTuruSecenekleri([OKUL_TURU_DIGER]);
    expect(secenekler.filter((tur) => tur === OKUL_TURU_DIGER)).toHaveLength(1);
  });

  it("Türkçe harf sırasına dizer", () => {
    // Varsayılan sıralamada Ç, Ö ve İ yanlış yere düşer.
    const secenekler = okulTuruSecenekleri([]);
    const sirali = [...secenekler.slice(0, -1)].sort((a, b) =>
      a.localeCompare(b, "tr"),
    );
    expect(secenekler.slice(0, -1)).toEqual(sirali);
  });
});

describe("okulTuruKosulu", () => {
  it("tür seçilmemişse daraltma yapmaz", () => {
    expect(okulTuruKosulu(null)).toEqual({});
    expect(okulTuruKosulu("")).toEqual({});
    expect(okulTuruKosulu(undefined)).toEqual({});
  });

  it("normal türde tam eşleşme ister", () => {
    expect(okulTuruKosulu("Fen Lisesi")).toEqual({ okulTuru: "Fen Lisesi" });
  });

  it("'Diğer'i standart listenin dışı olarak okur", () => {
    // Düz değer olarak gönderilseydi hiçbir kayıt eşleşmezdi: veritabanında
    // "Diğer" diye bir okul türü yok.
    const kosul = okulTuruKosulu(OKUL_TURU_DIGER);
    expect(kosul).toEqual({
      okulTuru: { notIn: [...BILINEN_OKUL_TURLERI] },
      ...KAPSAM_DISI_OKUL_KOSULU,
    });
  });
});

describe("açık öğretim kapsam dışı (28 Ekim 2026)", () => {
  it("açık öğretim türlerini tanır", () => {
    expect(kapsamDisiOkulTuruMu("Açık Öğretim Lisesi")).toBe(true);
    expect(kapsamDisiOkulTuruMu("Mesleki Açık Öğretim Lisesi")).toBe(true);
    expect(kapsamDisiOkulTuruMu("AÇIK ÖĞRETİM LİSESİ")).toBe(true);
    expect(kapsamDisiOkulTuruMu("Anadolu Lisesi")).toBe(false);
    expect(kapsamDisiOkulTuruMu(null)).toBe(false);
  });

  it("veride olsa da seçeneklerde çıkmaz", () => {
    const secenekler = okulTuruSecenekleri([
      "Açık Öğretim Lisesi",
      "Mesleki Açık Öğretim Lisesi",
    ]);
    expect(secenekler.some(kapsamDisiOkulTuruMu)).toBe(false);
  });
});
