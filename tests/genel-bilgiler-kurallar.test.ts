import { OKUL_LISTEDE_YOK } from "@/lib/kayit/kurallar";
import {
  danismanBilgisiCoz,
  type DanismanBilgisiGirdisi,
  genelBilgileriCoz,
  type GenelBilgilerGirdisi,
} from "@/lib/ogrenci/genel-bilgiler-kurallar";
import { formOkulTuru } from "@/lib/okul/turler";

/**
 * Öğrenci panelindeki "Genel bilgiler" ve "Danışman öğretmen bilgileri"
 * kuralları (23 Ekim 2026).
 */

function genel(degisiklik: Partial<GenelBilgilerGirdisi> = {}): GenelBilgilerGirdisi {
  return {
    ad: " Elif ",
    soyad: "Yılmaz",
    cinsiyet: "K",
    ilKodu: "34",
    ilceKodu: "3401",
    okulTuru: "Anadolu Lisesi",
    kurumKodu: "750001",
    beyanOkulAdi: "",
    sinifSeviyesi: "10",
    sube: "b",
    brans: "",
    ...degisiklik,
  };
}

describe("öğretmenin genel bilgileri", () => {
  test("sınıf sorulmaz, branş kaydedilir", () => {
    const karar = genelBilgileriCoz(
      genel({ sinifSeviyesi: "", sube: "", brans: " Fizik " }),
      "OGRETMEN",
    );
    expect(karar.olurMu).toBe(true);
    if (!karar.olurMu) return;
    expect(karar.bilgiler.sinif).toBeNull();
    expect(karar.bilgiler.brans).toBe("Fizik");
  });

  test("branşsız öğretmen kaydı reddedilir", () => {
    expect(genelBilgileriCoz(genel({ brans: "" }), "OGRETMEN").olurMu).toBe(
      false,
    );
  });

  test("öğrencide branş yok sayılır", () => {
    const karar = genelBilgileriCoz(genel({ brans: "Fizik" }));
    expect(karar.olurMu && karar.bilgiler.brans).toBeNull();
  });
});

describe("genel bilgiler", () => {
  test("listeden seçilen okulla kabul edilir", () => {
    const karar = genelBilgileriCoz(genel());
    expect(karar.olurMu).toBe(true);
    if (!karar.olurMu) return;
    expect(karar.bilgiler).toEqual({
      ad: "Elif",
      soyad: "Yılmaz",
      cinsiyet: "K",
      ilKodu: "34",
      ilceKodu: "3401",
      okulTuru: "Anadolu Lisesi",
      kurumKodu: 750001,
      beyanOkulAdi: null,
      sinif: "10-B",
      brans: null,
    });
  });

  // 23 Ekim 2026: gerçek ilçe listesi gelene kadar ilçe isteğe bağlı.
  test("ilçe boş bırakılabilir", () => {
    const karar = genelBilgileriCoz(genel({ ilceKodu: "" }));
    expect(karar.olurMu && karar.bilgiler.ilceKodu).toBeNull();
  });

  test("okulu listede olmayan öğrenci adını yazar", () => {
    const karar = genelBilgileriCoz(
      genel({ kurumKodu: OKUL_LISTEDE_YOK, beyanOkulAdi: "Deneme Lisesi" }),
    );
    expect(karar.olurMu).toBe(true);
    if (!karar.olurMu) return;
    expect(karar.bilgiler.kurumKodu).toBeNull();
    expect(karar.bilgiler.beyanOkulAdi).toBe("Deneme Lisesi");
  });

  test.each<[string, Partial<GenelBilgilerGirdisi>]>([
    ["ad boş", { ad: "" }],
    ["cinsiyet yok", { cinsiyet: "" }],
    ["il yok", { ilKodu: "" }],
    ["ilçe biçimsiz", { ilceKodu: "06" }],
    ["okul türü yok", { okulTuru: "" }],
    ["okul seçilmemiş", { kurumKodu: "" }],
    ["listede yok ama ad boş", { kurumKodu: OKUL_LISTEDE_YOK }],
    ["sınıf lise dışı", { sinifSeviyesi: "8" }],
    ["şube biçimsiz", { sube: "1" }],
  ])("%s reddedilir", (_ad, degisiklik) => {
    expect(genelBilgileriCoz(genel(degisiklik)).olurMu).toBe(false);
  });
});

function danisman(
  degisiklik: Partial<DanismanBilgisiGirdisi> = {},
): DanismanBilgisiGirdisi {
  return {
    ad: "Ahmet",
    soyad: "Kaya",
    brans: "Bilişim Teknolojileri",
    telefon: "0532 111 22 33",
    eposta: "Ahmet.Kaya@okul.k12.tr",
    ...degisiklik,
  };
}

describe("danışman öğretmen bilgisi", () => {
  test("tam bilgi kabul edilir, e-posta küçük harfe iner", () => {
    const karar = danismanBilgisiCoz(danisman());
    expect(karar.olurMu).toBe(true);
    if (!karar.olurMu) return;
    expect(karar.bilgi.beyanDanismanEposta).toBe("ahmet.kaya@okul.k12.tr");
    expect(karar.bilgi.beyanDanismanBrans).toBe("Bilişim Teknolojileri");
  });

  test("hepsi boşsa kayıt temizlenir", () => {
    const karar = danismanBilgisiCoz({
      ad: "",
      soyad: " ",
      brans: "",
      telefon: "",
      eposta: "",
    });
    expect(karar.olurMu).toBe(true);
    if (!karar.olurMu) return;
    expect(Object.values(karar.bilgi).every((d) => d === null)).toBe(true);
  });

  test("yalnızca ad soyad yeterli, diğerleri boş kalır", () => {
    const karar = danismanBilgisiCoz(
      danisman({ brans: "", telefon: "", eposta: "" }),
    );
    expect(karar.olurMu).toBe(true);
    if (!karar.olurMu) return;
    expect(karar.bilgi.beyanDanismanTelefon).toBeNull();
  });

  test.each<[string, Partial<DanismanBilgisiGirdisi>]>([
    ["telefon var ama ad yok", { ad: "" }],
    ["soyad yok", { soyad: "" }],
    ["telefon biçimsiz", { telefon: "abc" }],
    ["e-posta biçimsiz", { eposta: "ahmet@" }],
  ])("%s reddedilir", (_ad, degisiklik) => {
    expect(danismanBilgisiCoz(danisman(degisiklik)).olurMu).toBe(false);
  });
});

describe("formdaki okul türü", () => {
  test("standart tür olduğu gibi, diğerleri Diğer olarak gelir", () => {
    expect(formOkulTuru("Fen Lisesi")).toBe("Fen Lisesi");
    expect(formOkulTuru("Askerî Lise")).toBe("Diğer");
    expect(formOkulTuru(null)).toBe("");
  });
});
