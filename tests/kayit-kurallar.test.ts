import {
  type KayitGirdisi,
  kayitGirdisiniCoz,
  OKUL_LISTEDE_YOK,
  okulTuruUyarMi,
  tcKimlikNoGecerliMi,
} from "@/lib/kayit/kurallar";

describe("okul türü uyumu", () => {
  test("aynı tür uyar, farklı tür uymaz", () => {
    expect(okulTuruUyarMi("Fen Lisesi", "Fen Lisesi")).toBe(true);
    expect(okulTuruUyarMi("Fen Lisesi", "Anadolu Lisesi")).toBe(false);
  });

  test("Diğer yalnızca standart listede olmayan türleri karşılar", () => {
    expect(okulTuruUyarMi("Diğer", "Askerî Lise")).toBe(true);
    expect(okulTuruUyarMi("Diğer", "Anadolu Lisesi")).toBe(false);
  });
});

/**
 * Kayıtla giriş kuralları (17 Eylül 2026).
 *
 * Sınanan şey hangi kaydın kabul edildiği: T.C. kimlik numarasının sağlaması,
 * tipe göre zorunlu alanlar ve şifre politikası.
 */

const SIMDI = new Date("2026-09-17T12:00:00+03:00");
/** Sağlama kuralına uyan, yaygın kullanılan örnek numara. */
const GECERLI_TC = "10000000146";

function girdi(degisiklik: Partial<KayitGirdisi> = {}): KayitGirdisi {
  return {
    tip: "OGRENCI",
    tcKimlikNo: GECERLI_TC,
    ad: "Elif",
    soyad: "Yılmaz",
    cinsiyet: "K",
    ilKodu: "34",
    kurumKodu: "750001",
    beyanOkulAdi: "",
    okulTuru: "Anadolu Lisesi",
    eposta: "Elif.Yilmaz@ornek.com",
    telefon: "0532 123 45 67",
    sinifSeviyesi: "11",
    sube: "a",
    brans: "",
    sifre: "guclu-parola-42",
    sifreTekrar: "guclu-parola-42",
    ...degisiklik,
  };
}

describe("T.C. kimlik numarası", () => {
  test("sağlaması tutan numara geçer", () => {
    expect(tcKimlikNoGecerliMi(GECERLI_TC)).toBe(true);
  });

  test.each([
    ["10 hane", "1000000014"],
    ["0 ile başlayan", "01000000146"],
    ["harf içeren", "1000000014a"],
    ["10. hane yanlış", "10000000156"],
    ["11. hane yanlış", "10000000147"],
  ])("%s reddedilir", (_ad, numara) => {
    expect(tcKimlikNoGecerliMi(numara)).toBe(false);
  });
});

describe("kayıt girdisi", () => {
  test("öğrenci kaydı sınıf ve şubeyle kabul edilir", () => {
    const karar = kayitGirdisiniCoz(girdi(), SIMDI);
    expect(karar.olurMu).toBe(true);
    if (!karar.olurMu) return;
    expect(karar.kayit.sinif).toBe("11-A");
    expect(karar.kayit.brans).toBeNull();
    expect(karar.kayit.kurumKodu).toBe(750001);
    expect(karar.kayit.egitimOgretimYili).toBe("2026-2027");
  });

  test("şubesiz öğrenci kaydında sınıf yalnızca seviyedir", () => {
    const karar = kayitGirdisiniCoz(girdi({ sube: "" }), SIMDI);
    expect(karar.olurMu && karar.kayit.sinif).toBe("11");
  });

  test("boşluklu yazılan kimlik numarası normallenir", () => {
    const karar = kayitGirdisiniCoz(
      girdi({ tcKimlikNo: "100 000 001 46" }),
      SIMDI,
    );
    expect(karar.olurMu && karar.kayit.tcKimlikNo).toBe(GECERLI_TC);
  });

  test("öğretmen kaydı branşla kabul edilir, sınıf boş kalır", () => {
    const karar = kayitGirdisiniCoz(
      girdi({ tip: "OGRETMEN", brans: "Bilişim Teknolojileri" }),
      SIMDI,
    );
    expect(karar.olurMu).toBe(true);
    if (!karar.olurMu) return;
    expect(karar.kayit.sinif).toBeNull();
    expect(karar.kayit.brans).toBe("Bilişim Teknolojileri");
  });

  test("okul türü ve iletişim bilgisi kayda geçer", () => {
    const karar = kayitGirdisiniCoz(girdi(), SIMDI);
    expect(karar.olurMu).toBe(true);
    if (!karar.olurMu) return;
    expect(karar.kayit.okulTuru).toBe("Anadolu Lisesi");
    expect(karar.kayit.eposta).toBe("elif.yilmaz@ornek.com");
    expect(karar.kayit.telefon).toBe("0532 123 45 67");
    expect(karar.kayit.beyanOkulAdi).toBeNull();
  });

  test("okulu listede olmayan öğrenci adını yazarak kaydolur", () => {
    const karar = kayitGirdisiniCoz(
      girdi({
        kurumKodu: OKUL_LISTEDE_YOK,
        beyanOkulAdi: "  Kadıköy   Deneme Lisesi ",
        okulTuru: "Diğer",
      }),
      SIMDI,
    );
    expect(karar.olurMu).toBe(true);
    if (!karar.olurMu) return;
    expect(karar.kayit.kurumKodu).toBeNull();
    expect(karar.kayit.beyanOkulAdi).toBe("Kadıköy Deneme Lisesi");
    expect(karar.kayit.okulTuru).toBe("Diğer");
  });

  test("öğretmenden okul türü istenmez", () => {
    const karar = kayitGirdisiniCoz(
      girdi({ tip: "OGRETMEN", brans: "Fizik", okulTuru: "" }),
      SIMDI,
    );
    expect(karar.olurMu && karar.kayit.okulTuru).toBeNull();
  });

  test.each<[string, Partial<KayitGirdisi>]>([
    ["tip seçilmemiş", { tip: "PERSONEL" }],
    ["öğrencide okul türü yok", { okulTuru: "" }],
    ["öğrencide okul türü listede değil", { okulTuru: "Ortaokul" }],
    [
      "listede olmayan okulun adı yazılmamış",
      { kurumKodu: OKUL_LISTEDE_YOK, beyanOkulAdi: "  " },
    ],
    ["e-posta yok", { eposta: "" }],
    ["e-posta biçimsiz", { eposta: "elif@ornek" }],
    ["telefon yok", { telefon: "" }],
    ["telefon çok kısa", { telefon: "12345" }],
    ["telefon harf içeriyor", { telefon: "0532 abc 45 67" }],
    ["kimlik numarası geçersiz", { tcKimlikNo: "12345678901" }],
    ["ad boş", { ad: "  " }],
    ["cinsiyet seçilmemiş", { cinsiyet: "" }],
    ["il seçilmemiş", { ilKodu: "" }],
    ["okul seçilmemiş", { kurumKodu: "" }],
    ["öğrencide sınıf yok", { sinifSeviyesi: "" }],
    ["öğrencide sınıf lise dışı", { sinifSeviyesi: "7" }],
    ["şube biçimsiz", { sube: "A1" }],
    ["öğretmende branş yok", { tip: "OGRETMEN", brans: "" }],
    ["şifre tekrarı farklı", { sifreTekrar: "baska-parola-42" }],
    ["şifre kısa", { sifre: "kisa", sifreTekrar: "kisa" }],
    [
      "şifre kimlik numarasını içeriyor",
      { sifre: `x${GECERLI_TC}`, sifreTekrar: `x${GECERLI_TC}` },
    ],
  ])("%s reddedilir", (_ad, degisiklik) => {
    expect(kayitGirdisiniCoz(girdi(degisiklik), SIMDI).olurMu).toBe(false);
  });
});

describe("kayıt · ilçe ve hazırlık (31 Ekim 2026)", () => {
  it("seçilen ilçe kayda geçer, boşsa null", () => {
    const secili = kayitGirdisiniCoz(girdi({ ilceKodu: "3433" }), SIMDI);
    expect(secili.olurMu && secili.kayit.ilceKodu).toBe("3433");
    const bos = kayitGirdisiniCoz(girdi(), SIMDI);
    expect(bos.olurMu && bos.kayit.ilceKodu).toBeNull();
  });

  it("biçimi bozuk ilçe reddedilir", () => {
    expect(kayitGirdisiniCoz(girdi({ ilceKodu: "Kadıköy" }), SIMDI).olurMu).toBe(
      false,
    );
  });

  it("hazırlık sınıfı seçilebilir", () => {
    const karar = kayitGirdisiniCoz(
      girdi({ sinifSeviyesi: "Hazırlık", sube: "a" }),
      SIMDI,
    );
    expect(karar.olurMu && karar.kayit.sinif).toBe("Hazırlık-A");
  });
});
