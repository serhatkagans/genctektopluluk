import {
  sifirlamaHostuSec,
  sifirlamaSemasiSec,
} from "@/lib/dis-kimlik/sifirlama-adresi";

/**
 * Parola sıfırlama bağlantısının host seçimi.
 *
 * Buradaki asıl sınav: istemcinin belirlediği bir host'un jetonu taşıyan
 * bağlantıya SIZAMAMASI. Saldırganın alan adının kabul edildiği bir gerileme,
 * doğrudan hesap ele geçirme demektir.
 */

const IZINLILER = ["genctek.meb.gov.tr", "www.genctek.meb.gov.tr"] as const;

describe("sıfırlama bağlantısı host seçimi", () => {
  test("izinli host olduğu gibi kullanılır", () => {
    expect(sifirlamaHostuSec("genctek.meb.gov.tr", IZINLILER)).toBe(
      "genctek.meb.gov.tr",
    );
  });

  test("listedeki ikinci host da kabul edilir", () => {
    expect(sifirlamaHostuSec("www.genctek.meb.gov.tr", IZINLILER)).toBe(
      "www.genctek.meb.gov.tr",
    );
  });

  test("saldırganın alan adı listedeki ilk host'a düşer", () => {
    expect(sifirlamaHostuSec("saldirgan.example.com", IZINLILER)).toBe(
      "genctek.meb.gov.tr",
    );
  });

  /**
   * Alt alan adı hilesi: "genctek.meb.gov.tr.saldirgan.com" saldırganın
   * denetimindedir ama göz ucuyla bakıldığında doğru görünür. Karşılaştırma
   * tam eşleşme olduğu için elenmeli — `endsWith`/`includes` ile yazılsaydı
   * geçerdi.
   */
  test("izinli adı ÖNEK olarak taşıyan alan adı elenir", () => {
    expect(
      sifirlamaHostuSec("genctek.meb.gov.tr.saldirgan.com", IZINLILER),
    ).toBe("genctek.meb.gov.tr");
  });

  test("izinli adı SONEK olarak taşıyan alan adı elenir", () => {
    expect(sifirlamaHostuSec("kotu-genctek.meb.gov.tr", IZINLILER)).toBe(
      "genctek.meb.gov.tr",
    );
  });

  test("host adında büyük/küçük harf ayrımı yoktur", () => {
    expect(sifirlamaHostuSec("GencTek.MEB.gov.TR", IZINLILER)).toBe(
      "GencTek.MEB.gov.TR",
    );
  });

  test("baştaki/sondaki boşluk eşleşmeyi bozmaz", () => {
    expect(sifirlamaHostuSec("  genctek.meb.gov.tr  ", IZINLILER)).toBe(
      "  genctek.meb.gov.tr  ",
    );
  });

  test("boş host listedeki ilk host'a düşer", () => {
    expect(sifirlamaHostuSec("", IZINLILER)).toBe("genctek.meb.gov.tr");
  });

  /**
   * Geliştirme hâli: liste boşken doğrulama yapılmaz. Üretimde bu duruma
   * düşülemez, ortam doğrulaması IZINLI_HOSTLAR'ı zorunlu kılar.
   */
  test("liste boşken gelen host olduğu gibi kullanılır", () => {
    expect(sifirlamaHostuSec("localhost:3000", [])).toBe("localhost:3000");
  });
});

describe("sıfırlama bağlantısı şeması", () => {
  test("canlı alan adı her zaman https", () => {
    expect(sifirlamaSemasiSec("aiotechs.cloud")).toBe("https");
    expect(sifirlamaSemasiSec("genctek.meb.gov.tr")).toBe("https");
  });

  test("yalnızca yerel geliştirme http", () => {
    expect(sifirlamaSemasiSec("localhost:3000")).toBe("http");
    expect(sifirlamaSemasiSec("127.0.0.1:3041")).toBe("http");
    expect(sifirlamaSemasiSec("[::1]:3000")).toBe("http");
  });

  test("localhost'a benzeyen alan adı https kalır", () => {
    expect(sifirlamaSemasiSec("localhost.saldirgan.com")).toBe("https");
  });
});
