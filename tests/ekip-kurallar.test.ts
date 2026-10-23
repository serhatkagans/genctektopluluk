import {
  EKIP_FORM_TURLERI,
  EKIP_TURLERI,
  buEkibiYonetebilirMi,
  ekipAdiniCoz,
  ekipDanismansizMi,
  ekipKapsaminiCoz,
  ekipMesajiniCoz,
  ekipSohbetiOkuyabilirMi,
  ekipSohbetineYazabilirMi,
  ekipTuruGecerliMi,
  ekipYonetebilirMi,
} from "@/lib/ekip/kurallar";
import {
  danismanYap,
  koordinatorYap,
  mezunYap,
  ogrenciYap,
  projeYoneticisiYap,
} from "./yardimcilar";

/**
 * Ekip kuralları (13 Ağustos 2026).
 *
 * Bu dosyanın varlık sebebi: ekip üyeliği, danışman onayından GEÇMEDEN
 * yazışma hakkı doğuran tek yapıdır. Yanlış yazılmış bir koşul hata vermez —
 * yalnızca başka ilin öğrencisini bir sohbete sokar.
 */

describe("ekip yönetme yetkisi", () => {
  // 23 Ekim 2026 · istek: koordinatörde "Ekipler pasif olsun".
  it("yalnızca proje yöneticisi ekip kurar", () => {
    expect(ekipYonetebilirMi(koordinatorYap())).toBe(false);
    expect(ekipYonetebilirMi(projeYoneticisiYap())).toBe(true);
  });

  it("öğrenci, öğretmen ve mezun ekip kuramaz", () => {
    expect(ekipYonetebilirMi(ogrenciYap())).toBe(false);
    expect(ekipYonetebilirMi(danismanYap())).toBe(false);
    expect(ekipYonetebilirMi(mezunYap())).toBe(false);
  });

  it("koordinatör kendi ilinin ekibini de yönetemez", () => {
    const koordinator = koordinatorYap({ ilKodu: "34" });
    expect(buEkibiYonetebilirMi(koordinator, "34")).toBe(false);
    expect(buEkibiYonetebilirMi(koordinator, "06")).toBe(false);
  });

  it("proje yöneticisi her ilin ekibini yönetir", () => {
    expect(buEkibiYonetebilirMi(projeYoneticisiYap(), "06")).toBe(true);
  });
});

describe("ekip sohbeti", () => {
  const ekip = { ilKodu: "34", aktif: true, uyeKullaniciIdleri: [] as number[] };

  it("üye okur ve yazar", () => {
    const ogrenci = ogrenciYap();
    const uyeli = { ...ekip, uyeKullaniciIdleri: [ogrenci.id] };
    expect(ekipSohbetiOkuyabilirMi(ogrenci, uyeli)).toBe(true);
    expect(ekipSohbetineYazabilirMi(ogrenci, uyeli)).toBe(true);
  });

  it("üye olmayan öğrenci okuyamaz", () => {
    expect(ekipSohbetiOkuyabilirMi(ogrenciYap(), ekip)).toBe(false);
  });

  it("ilin koordinatörü okuyamaz; ekipler ona kapalı (23 Ekim 2026)", () => {
    expect(ekipSohbetiOkuyabilirMi(koordinatorYap({ ilKodu: "34" }), ekip)).toBe(
      false,
    );
  });

  it("başka ilin koordinatörü okuyamaz", () => {
    expect(ekipSohbetiOkuyabilirMi(koordinatorYap({ ilKodu: "06" }), ekip)).toBe(
      false,
    );
  });

  it("kapatılmış ekibe kimse yazamaz, okumak serbest", () => {
    const ogrenci = ogrenciYap();
    const kapali = { ...ekip, aktif: false, uyeKullaniciIdleri: [ogrenci.id] };
    expect(ekipSohbetiOkuyabilirMi(ogrenci, kapali)).toBe(true);
    expect(ekipSohbetineYazabilirMi(ogrenci, kapali)).toBe(false);
    expect(
      ekipSohbetineYazabilirMi(koordinatorYap({ ilKodu: "34" }), kapali),
    ).toBe(false);
  });
});

describe("ekip adı", () => {
  it("boş ad kabul edilmez", () => {
    expect(ekipAdiniCoz({ ad: "   ", aciklama: "" }).olurMu).toBe(false);
  });

  it("fazladan boşluklar tek boşluğa iner", () => {
    const karar = ekipAdiniCoz({ ad: "  Robotik   Ekibi ", aciklama: " " });
    expect(karar).toEqual({
      olurMu: true,
      ad: "Robotik Ekibi",
      aciklama: null,
    });
  });

  it("çok uzun ad ve açıklama reddedilir", () => {
    expect(ekipAdiniCoz({ ad: "a".repeat(151), aciklama: "" }).olurMu).toBe(
      false,
    );
    expect(
      ekipAdiniCoz({ ad: "Ekip", aciklama: "a".repeat(501) }).olurMu,
    ).toBe(false);
  });
});

describe("ekip mesajı", () => {
  it("boş mesaj gitmez", () => {
    expect(ekipMesajiniCoz("  ").olurMu).toBe(false);
  });

  it("sınırın üstü reddedilir", () => {
    expect(ekipMesajiniCoz("a".repeat(2001)).olurMu).toBe(false);
  });

  it("metin kırpılarak kabul edilir", () => {
    expect(ekipMesajiniCoz("  merhaba  ")).toEqual({
      olurMu: true,
      icerik: "merhaba",
    });
  });
});

describe("ekipKapsaminiCoz", () => {
  it("okul takımında okulu zorunlu tutar", () => {
    /*
     * Veritabanı kısıtı (ck_ekip_okul_takimi_kurum) bunu zaten engelliyor ama
     * oradan gelen hata kullanıcıya ham metin olarak çıkardı; burası anlaşılır
     * cümleyi söyleyebilen tek yer.
     */
    const karar = ekipKapsaminiCoz({ tur: "OKUL_TAKIMI", kurumKodu: null });

    expect(karar.olurMu).toBe(false);
    expect(karar.olurMu === false && karar.neden).toContain("okul");
  });

  it("okul takımında kurum kodunu sayıya çevirir", () => {
    const karar = ekipKapsaminiCoz({ tur: "OKUL_TAKIMI", kurumKodu: " 758715 " });

    expect(karar).toEqual({ olurMu: true, tur: "OKUL_TAKIMI", kurumKodu: 758715 });
  });

  it("okul dışı türlerde okul seçimini sessizce düşürür", () => {
    /*
     * Form türü değiştirdiğinde tarayıcıda eski okul seçimi kalabiliyor; bu
     * kullanıcının hatası değil, hata vermek yerine değer düşürülüyor.
     * Kısıt zaten kurum dolu bir çalışma grubunu reddediyor.
     */
    for (const tur of ["CALISMA_GRUBU", "IL_GENCTEK_EKIBI"]) {
      expect(ekipKapsaminiCoz({ tur, kurumKodu: "758715" })).toEqual({
        olurMu: true,
        tur,
        kurumKodu: null,
      });
    }
  });

  it("uydurma türü reddeder", () => {
    // Adres çubuğundan/formdan gelen değer doğrulanmasaydı Prisma patlardı.
    expect(ekipKapsaminiCoz({ tur: "OKUL", kurumKodu: null }).olurMu).toBe(false);
    expect(ekipKapsaminiCoz({ tur: "", kurumKodu: null }).olurMu).toBe(false);
  });

  it("sayı olmayan kurum kodunu reddeder", () => {
    expect(
      ekipKapsaminiCoz({ tur: "OKUL_TAKIMI", kurumKodu: "abc" }).olurMu,
    ).toBe(false);
  });
});

describe("ekipDanismansizMi", () => {
  it("danışmanı olmayan ekibi danışmansız sayar", () => {
    expect(ekipDanismansizMi({ danisman: null })).toBe(true);
  });

  it("PASİF danışmanlı ekibi de danışmansız sayar", () => {
    /*
     * Görevden ayrılmış öğretmen ekipte yazılı kalmaya devam ediyor ve ekip
     * kimsenin bakmadığı bir ekip oluyor. Yalnızca alanın boşluğuna bakılsaydı
     * bu ekipler listede hiç görünmezdi — en çok onların görünmesi gerekiyor.
     */
    expect(ekipDanismansizMi({ danisman: { aktif: false } })).toBe(true);
  });

  it("aktif danışmanlı ekibi danışmansız saymaz", () => {
    expect(ekipDanismansizMi({ danisman: { aktif: true } })).toBe(false);
  });
});

describe("ekipTuruGecerliMi", () => {
  it("üç türü tanır", () => {
    for (const tur of EKIP_TURLERI) {
      expect(ekipTuruGecerliMi(tur)).toBe(true);
    }
  });

  it("uydurma değeri reddeder", () => {
    expect(ekipTuruGecerliMi("OKUL")).toBe(false);
    expect(ekipTuruGecerliMi("")).toBe(false);
  });
});

describe("EKIP_FORM_TURLERI", () => {
  /*
   * 31 Ağustos 2026 · istek: "okul seçimi kapanacak Okul". Okul bağı zorunlu
   * olan tür, okul seçilemeyen bir formda seçilebilir kalırsa her denemede
   * hata veren bir seçenek olurdu.
   */
  it("okul takımını formdan çıkarır, enumda bırakır", () => {
    expect(EKIP_FORM_TURLERI).not.toContain("OKUL_TAKIMI");
    expect(EKIP_TURLERI).toContain("OKUL_TAKIMI");
    expect(ekipTuruGecerliMi("OKUL_TAKIMI")).toBe(true);
  });

  it("kalan türlerin hepsi formda durur", () => {
    for (const tur of EKIP_TURLERI) {
      if (tur === "OKUL_TAKIMI") continue;
      expect(EKIP_FORM_TURLERI).toContain(tur);
    }
  });
});
