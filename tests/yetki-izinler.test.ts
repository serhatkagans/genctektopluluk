import {
  baskasiAdinaBasvurabilirMi,
  basvuruDegerlendirebilirMi,
  basvuruYapabilirMi,
  calismaGrubuTanimlayabilirMi,
  ekYukleyebilirMi,
  faaliyetPaydasiYonetebilirMi,
  ogrenciEnvanteriGorebilirMi,
  ogretmenEnvanteriGorebilirMi,
  paydasEkleyebilirMi,
  paydasGorebilirMi,
  paydasYonetebilirMi,
  faaliyetAcabilirMi,
  faaliyetDisaAktarabilirMi,
  faaliyetGorunurMu,
  faaliyetIptalEdebilirMi,
  faaliyetOnayGerekiyorMu,
  calismaGrubuYoneticisiAtayabilirMi,
  faaliyetOnaylayabilirMi,
  belgeUretenRoldeMi,
  faaliyetBelgesiUretebilirMi,
  faaliyetRaporuYazabilirMi,
  ilceTemsilcisiAtayabilirMi,
  ilKoordinatorAtayabilirMi,
  ilTemsilcisiAtayabilirMi,
  ogrenciCalismaGrubuYonetebilirMi,
  ogrenciMentorluguneKararVerebilirMi,
  ilKoordinatoruOnaylayabilirMi,
  ogrenciTemsilciligiAtayabilirMi,
  okulTemsilcisiAtayabilirMi,
  rolEnvanteriGorebilirMi,
  yetkiDevrolduMu,
  yorumSilebilirMi,
  yorumYazabilirMi,
} from "@/lib/yetki/izinler";
import {
  ogrenciGorevSuzgeciGecerliMi,
  ogrenciListeFiltresi,
} from "@/lib/yetki/kapsam";
import {
  danismanYap,
  faaliyetYap,
  koordinatorYap,
  mezunYap,
  ogrenciYap,
  paydasTemsilcisiYap,
  projeYoneticisiYap,
  rolsuzOgretmenYap,
} from "./yardimcilar";

/**
 * references/permissions.md Bölüm 1'deki yetki matrisinin testleri.
 * Matris değişirse bu testler de değişmelidir.
 */

describe("faaliyet açma kapsamı", () => {
  /*
   * Öğretmene üç kapsam da açık (20 Ağustos 2026): sınır kapsamda değil
   * onayda — okul dışına çıkan her etkinliği ilin koordinatörü görür
   * (bkz. "danışman öğretmenin okul dışı faaliyeti onay bekler").
   */
  it("danışman öğretmen her kapsamda faaliyet açar", () => {
    const danisman = danismanYap();
    expect(faaliyetAcabilirMi(danisman, "OKUL")).toBe(true);
    expect(faaliyetAcabilirMi(danisman, "IL")).toBe(true);
    expect(faaliyetAcabilirMi(danisman, "ULUSAL")).toBe(true);
  });

  it("il koordinatörü okul, il ve ulusal faaliyet açar", () => {
    const koordinator = koordinatorYap();
    expect(faaliyetAcabilirMi(koordinator, "OKUL")).toBe(true);
    expect(faaliyetAcabilirMi(koordinator, "IL")).toBe(true);
    expect(faaliyetAcabilirMi(koordinator, "ULUSAL")).toBe(true);
  });

  /*
   * ÖĞRENCİ FAALİYET AÇAMAZ (20 Ağustos 2026 · istek: "öğrencilerin etkinlik
   * oluşturmasına gerek yok sadece mevcutlara katılabilsin"). Başvuru kapısı
   * açık kalıyor; kapanan yalnızca açma kapısı.
   */
  it("öğrenci hiçbir kapsamda faaliyet açamaz", () => {
    const ogrenci = ogrenciYap();
    expect(faaliyetAcabilirMi(ogrenci, "OKUL")).toBe(false);
    expect(faaliyetAcabilirMi(ogrenci, "IL")).toBe(false);
    expect(faaliyetAcabilirMi(ogrenci, "ULUSAL")).toBe(false);
    // Katılım kapısı ayrı ve açık.
    expect(basvuruYapabilirMi(ogrenci)).toBe(true);
  });

  /*
   * "Etkinlik Bildir" (7 Ağustos 2026). Mezun/paydaş/mentöre il ve ulusal
   * kapsam açık, okul kapsamı KAPALI: kurum kodları yok, "kendi okulu" diye bir
   * yer yok ve bir okulun içine etkinlik açmak o okulun sorumlusunun işi.
   */
  it("mezun ve paydaş temsilcisi il ve ulusal etkinlik bildirebilir", () => {
    for (const kisi of [mezunYap(), paydasTemsilcisiYap()]) {
      expect(faaliyetAcabilirMi(kisi, "OKUL")).toBe(false);
      expect(faaliyetAcabilirMi(kisi, "IL")).toBe(true);
      expect(faaliyetAcabilirMi(kisi, "ULUSAL")).toBe(true);
    }
  });

  it("rolsüz öğretmen faaliyet açamaz", () => {
    expect(faaliyetAcabilirMi(rolsuzOgretmenYap(), "OKUL")).toBe(false);
  });
});

describe("dış kullanıcı etkinliğinin onay akışı", () => {
  it("mezun ve paydaşın bildirdiği her etkinlik onay bekler", () => {
    // Kapsam sınırı değil onay sınırı: kimliği EBA'dan gelmeyen, bir okul ya da
    // il görevine bağlı olmayan kişinin adına MEB etkinliği ilan edilmez.
    for (const kisi of [mezunYap(), paydasTemsilcisiYap()]) {
      expect(faaliyetOnayGerekiyorMu(kisi, "IL")).toBe(true);
      expect(faaliyetOnayGerekiyorMu(kisi, "ULUSAL")).toBe(true);
    }
  });

  it("etkinliğin ilindeki koordinatör onaylayabilir", () => {
    const faaliyet = faaliyetYap({
      duzenleyenKullaniciId: 500,
      duzenleyenDisKullaniciMi: true,
      onayliMi: false,
      kapsamIlKodu: "34",
    });
    expect(ilKoordinatoruOnaylayabilirMi(koordinatorYap(), faaliyet)).toBe(true);
    // Başka ilin koordinatörü karışamaz.
    expect(
      ilKoordinatoruOnaylayabilirMi(koordinatorYap({ id: 9 }), {
        ...faaliyet,
        kapsamIlKodu: "06",
      }),
    ).toBe(false);
  });

  it("proje yöneticisi de onaylayabilir", () => {
    expect(
      faaliyetOnaylayabilirMi(
        projeYoneticisiYap(),
        faaliyetYap({ duzenleyenDisKullaniciMi: true, onayliMi: false }),
      ),
    ).toBe(true);
  });

  it("onay bekleyen etkinlik yalnızca sahibine ve onaycılara görünür", () => {
    const faaliyet = faaliyetYap({
      duzenleyenKullaniciId: 500,
      duzenleyenDisKullaniciMi: true,
      onayliMi: false,
      kapsam: "ULUSAL",
      kapsamIlKodu: "34",
    });
    expect(faaliyetGorunurMu(mezunYap(), faaliyet)).toBe(true);
    expect(faaliyetGorunurMu(koordinatorYap(), faaliyet)).toBe(true);
    // Onaylanana kadar öğrenci göremez.
    expect(faaliyetGorunurMu(ogrenciYap(), faaliyet)).toBe(false);
  });
});

describe("ulusal faaliyet onay akışı", () => {
  it("il koordinatörünün açtığı ulusal faaliyet onay bekler", () => {
    expect(faaliyetOnayGerekiyorMu(koordinatorYap(), "ULUSAL")).toBe(true);
  });

  it("il koordinatörünün okul ve il faaliyetleri onaysız yayına girer", () => {
    const koordinator = koordinatorYap();
    expect(faaliyetOnayGerekiyorMu(koordinator, "IL")).toBe(false);
    expect(faaliyetOnayGerekiyorMu(koordinator, "OKUL")).toBe(false);
  });

  it("proje yöneticisinin faaliyeti onay gerektirmez", () => {
    expect(faaliyetOnayGerekiyorMu(projeYoneticisiYap(), "ULUSAL")).toBe(false);
  });

  it("faaliyet verilmeden sorulduğunda yalnızca proje yöneticisi geçer", () => {
    // İl koordinatörünün onay yetkisi HANGİ faaliyet olduğuna bağlıdır;
    // faaliyetsiz sorulduğunda cevap "hayır"dır.
    expect(faaliyetOnaylayabilirMi(projeYoneticisiYap())).toBe(true);
    expect(faaliyetOnaylayabilirMi(koordinatorYap())).toBe(false);
    expect(faaliyetOnaylayabilirMi(danismanYap())).toBe(false);
  });
});

describe("öğrenci faaliyeti onay akışı", () => {
  const ogrenciFaaliyeti = (ozellikler = {}) =>
    faaliyetYap({
      duzenleyenKullaniciId: 100,
      duzenleyenOgrenciMi: true,
      onayliMi: false,
      kapsamIlKodu: "34",
      ...ozellikler,
    });

  it("öğrencinin açtığı her faaliyet onay bekler", () => {
    /*
     * Öğrenci artık faaliyet AÇAMIYOR (bkz. "öğrenci hiçbir kapsamda faaliyet
     * açamaz"); kural yine de sınanıyor, çünkü kapı bir gün yeniden açılırsa
     * öğrencinin çağrısının sessizce onaysız yayına girmesi en pahalı hata
     * olurdu.
     */
    const ogrenci = ogrenciYap();
    expect(faaliyetOnayGerekiyorMu(ogrenci, "OKUL")).toBe(true);
    expect(faaliyetOnayGerekiyorMu(ogrenci, "IL")).toBe(true);
    expect(faaliyetOnayGerekiyorMu(ogrenci, "ULUSAL")).toBe(true);
  });

  it("öğrencinin ilinin koordinatörü onaylayabilir", () => {
    // Onay yalnızca merkeze bırakılsaydı bir okulun kendi içindeki öğrenci
    // etkinliği YEĞİTEK sırası gelene kadar bekler, öneri pratikte ölürdü.
    expect(
      ilKoordinatoruOnaylayabilirMi(
        koordinatorYap({ ilKodu: "34" }),
        ogrenciFaaliyeti(),
      ),
    ).toBe(true);
    expect(faaliyetOnaylayabilirMi(koordinatorYap(), ogrenciFaaliyeti())).toBe(
      true,
    );
  });

  it("başka ilin koordinatörü onaylayamaz", () => {
    expect(
      ilKoordinatoruOnaylayabilirMi(
        koordinatorYap({ ilKodu: "06" }),
        ogrenciFaaliyeti(),
      ),
    ).toBe(false);
  });

  it("koordinatörün/merkezin açtığı faaliyette ek yetki doğmaz", () => {
    // Ne öğrenci ne danışman açmışsa kapı kapalıdır: kimse kendi işini
    // onaylamaz ve ulusal faaliyetin onayı merkezdedir.
    const koordinatorFaaliyeti = faaliyetYap({
      onayliMi: false,
      kapsamIlKodu: "34",
    });
    expect(
      ilKoordinatoruOnaylayabilirMi(koordinatorYap(), koordinatorFaaliyeti),
    ).toBe(false);
  });

  it("danışman öğretmen öğrenci faaliyetini onaylayamaz", () => {
    expect(faaliyetOnaylayabilirMi(danismanYap(), ogrenciFaaliyeti())).toBe(
      false,
    );
  });

  it("onay bekleyen öğrenci faaliyeti onaylayacak koordinatöre görünür", () => {
    // Onaylayacak kişi onaylayacağı şeyi görmek zorunda.
    const faaliyet = ogrenciFaaliyeti();
    expect(faaliyetGorunurMu(koordinatorYap({ ilKodu: "34" }), faaliyet)).toBe(
      true,
    );
    expect(faaliyetGorunurMu(koordinatorYap({ ilKodu: "06" }), faaliyet)).toBe(
      false,
    );
  });

  it("onay bekleyen öğrenci faaliyeti diğer öğrencilere görünmez", () => {
    expect(
      faaliyetGorunurMu(ogrenciYap({ id: 101 }), ogrenciFaaliyeti()),
    ).toBe(false);
  });
});

describe("faaliyet görünürlüğü", () => {
  it("onay bekleyen faaliyet öğrenciye görünmez", () => {
    const faaliyet = faaliyetYap({
      kapsam: "ULUSAL",
      kurumKodu: null,
      onayliMi: false,
    });
    expect(faaliyetGorunurMu(ogrenciYap(), faaliyet)).toBe(false);
  });

  it("onay bekleyen faaliyet düzenleyene ve proje yöneticisine görünür", () => {
    const faaliyet = faaliyetYap({
      kapsam: "ULUSAL",
      kurumKodu: null,
      duzenleyenKullaniciId: 300,
      onayliMi: false,
    });
    expect(faaliyetGorunurMu(koordinatorYap({ id: 300 }), faaliyet)).toBe(true);
    expect(faaliyetGorunurMu(projeYoneticisiYap(), faaliyet)).toBe(true);
  });

  it("okul içi faaliyet başka okulun öğrencisine görünmez", () => {
    const faaliyet = faaliyetYap({ kapsam: "OKUL", kurumKodu: 750001 });
    expect(faaliyetGorunurMu(ogrenciYap({ kurumKodu: 750001 }), faaliyet)).toBe(
      true,
    );
    expect(faaliyetGorunurMu(ogrenciYap({ kurumKodu: 750002 }), faaliyet)).toBe(
      false,
    );
  });

  it("il içi faaliyet başka ilin öğrencisine görünmez", () => {
    const faaliyet = faaliyetYap({
      kapsam: "IL",
      kurumKodu: null,
      ilKodu: "34",
    });
    expect(faaliyetGorunurMu(ogrenciYap({ ilKodu: "34" }), faaliyet)).toBe(true);
    expect(faaliyetGorunurMu(ogrenciYap({ ilKodu: "06" }), faaliyet)).toBe(
      false,
    );
  });

  it("ulusal faaliyet ülke genelindeki tüm öğrencilere görünür", () => {
    const faaliyet = faaliyetYap({ kapsam: "ULUSAL", kurumKodu: null });
    expect(
      faaliyetGorunurMu(ogrenciYap({ ilKodu: "65", kurumKodu: 750004 }), faaliyet),
    ).toBe(true);
  });
});

describe("dosya/görsel ekleme", () => {
  it("yalnızca faaliyeti açan kullanıcı ek yükler", () => {
    const faaliyet = faaliyetYap({ duzenleyenKullaniciId: 200 });
    expect(ekYukleyebilirMi(danismanYap({ id: 200 }), faaliyet)).toBe(true);
  });

  it("aynı rolden başka bir danışman başkasının faaliyetine ek yükleyemez", () => {
    const faaliyet = faaliyetYap({ duzenleyenKullaniciId: 200 });
    expect(ekYukleyebilirMi(danismanYap({ id: 201 }), faaliyet)).toBe(false);
  });

  it("öğrenci ek yükleyemez", () => {
    const faaliyet = faaliyetYap({ duzenleyenKullaniciId: 200 });
    expect(ekYukleyebilirMi(ogrenciYap(), faaliyet)).toBe(false);
  });
});

describe("yorumlar", () => {
  it("faaliyeti gören öğrenci yorum yazabilir, görmeyen yazamaz", () => {
    const faaliyet = faaliyetYap({ kapsam: "OKUL", kurumKodu: 750001 });
    expect(yorumYazabilirMi(ogrenciYap({ kurumKodu: 750001 }), faaliyet)).toBe(
      true,
    );
    expect(yorumYazabilirMi(ogrenciYap({ kurumKodu: 750002 }), faaliyet)).toBe(
      false,
    );
  });

  it("öğrenci yalnızca kendi yorumunu silebilir", () => {
    const ogrenci = ogrenciYap({ id: 100 });
    const faaliyet = faaliyetYap({ duzenleyenKullaniciId: 200 });
    expect(
      yorumSilebilirMi(ogrenci, { yazanKullaniciId: 100 }, faaliyet),
    ).toBe(true);
    expect(
      yorumSilebilirMi(ogrenci, { yazanKullaniciId: 101 }, faaliyet),
    ).toBe(false);
  });

  it("faaliyeti açan kullanıcı kendi faaliyetindeki her yorumu silebilir", () => {
    const danisman = danismanYap({ id: 200 });
    const kendiFaaliyeti = faaliyetYap({ duzenleyenKullaniciId: 200 });
    const baskasininFaaliyeti = faaliyetYap({ duzenleyenKullaniciId: 201 });

    expect(
      yorumSilebilirMi(danisman, { yazanKullaniciId: 100 }, kendiFaaliyeti),
    ).toBe(true);
    expect(
      yorumSilebilirMi(danisman, { yazanKullaniciId: 100 }, baskasininFaaliyeti),
    ).toBe(false);
  });

  it("proje yöneticisi her yorumu her yerde silebilir", () => {
    expect(
      yorumSilebilirMi(
        projeYoneticisiYap(),
        { yazanKullaniciId: 100 },
        faaliyetYap({ duzenleyenKullaniciId: 999 }),
      ),
    ).toBe(true);
  });
});

describe("başvuru", () => {
  /*
   * Analiz dokümanı 4.2: katılımcı "öğretmen/öğrenci" olabilir. Öğretmenin
   * katılımcı olması istisna değil, kuralın kendisidir; dışarıda kalan tek rol
   * faaliyetleri düzenleyip onaylayan merkezdir.
   */
  it("öğrenci ve öğretmenler katılımcı olarak başvurabilir", () => {
    expect(basvuruYapabilirMi(ogrenciYap())).toBe(true);
    expect(basvuruYapabilirMi(danismanYap())).toBe(true);
    expect(basvuruYapabilirMi(koordinatorYap())).toBe(true);
    expect(basvuruYapabilirMi(rolsuzOgretmenYap())).toBe(true);
  });

  it("proje yöneticisi kendi düzenlediği etkinliğe katılımcı olamaz", () => {
    expect(basvuruYapabilirMi(projeYoneticisiYap())).toBe(false);
  });

  it("öğrenci adına başvuruyu yalnızca görevli öğretmenler yapabilir", () => {
    expect(baskasiAdinaBasvurabilirMi(danismanYap())).toBe(true);
    expect(baskasiAdinaBasvurabilirMi(koordinatorYap())).toBe(true);
    expect(baskasiAdinaBasvurabilirMi(projeYoneticisiYap())).toBe(true);
    // Öğrenci ve görev almamış öğretmen başkası adına başvuramaz.
    expect(baskasiAdinaBasvurabilirMi(ogrenciYap())).toBe(false);
    expect(baskasiAdinaBasvurabilirMi(rolsuzOgretmenYap())).toBe(false);
  });

  it("başvuruyu yalnızca faaliyeti açan kullanıcı değerlendirir", () => {
    const faaliyet = faaliyetYap({ duzenleyenKullaniciId: 300 });
    expect(
      basvuruDegerlendirebilirMi(koordinatorYap({ id: 300 }), faaliyet),
    ).toBe(true);
    expect(
      basvuruDegerlendirebilirMi(koordinatorYap({ id: 301 }), faaliyet),
    ).toBe(false);
    expect(basvuruDegerlendirebilirMi(projeYoneticisiYap(), faaliyet)).toBe(
      true,
    );
  });
});

/**
 * references/domain-rules.md Bölüm 11: "Faaliyeti açan kullanıcı görevden
 * ayrıldı → değerlendirme yetkisi il koordinatörüne / proje yöneticisine
 * düşer; yorum silme yetkisi de aynı şekilde devrolur."
 */
describe("düzenleyen görevden ayrıldığında yetki devri", () => {
  const ayrilaninFaaliyeti = faaliyetYap({
    kapsam: "OKUL",
    kurumKodu: 750001,
    ilKodu: null,
    kapsamIlKodu: "34",
    duzenleyenKullaniciId: 200,
    duzenleyenGorevdeMi: false,
  });

  it("faaliyetin ilindeki koordinatör değerlendirmeyi devralır", () => {
    expect(yetkiDevrolduMu(koordinatorYap({ ilKodu: "34" }), ayrilaninFaaliyeti)).toBe(true);
    expect(
      basvuruDegerlendirebilirMi(
        koordinatorYap({ ilKodu: "34" }),
        ayrilaninFaaliyeti,
      ),
    ).toBe(true);
  });

  it("başka ilin koordinatörü devralmaz", () => {
    expect(
      basvuruDegerlendirebilirMi(
        koordinatorYap({ ilKodu: "06" }),
        ayrilaninFaaliyeti,
      ),
    ).toBe(false);
  });

  it("düzenleyen görevdeyse koordinatör karışamaz", () => {
    // Devir yalnızca ayrılma durumunda olur; görevdeki öğretmenin faaliyetine
    // kendi ilinin koordinatörü müdahale edemez.
    const gorevdeki = faaliyetYap({
      kapsamIlKodu: "34",
      duzenleyenKullaniciId: 200,
      duzenleyenGorevdeMi: true,
    });
    expect(basvuruDegerlendirebilirMi(koordinatorYap({ ilKodu: "34" }), gorevdeki)).toBe(
      false,
    );
    expect(yetkiDevrolduMu(koordinatorYap({ ilKodu: "34" }), gorevdeki)).toBe(
      false,
    );
  });

  it("bilgi verilmediyse devir olmaz (dar tarafta kalınır)", () => {
    const belirsiz = faaliyetYap({ duzenleyenKullaniciId: 200 });
    expect(yetkiDevrolduMu(koordinatorYap({ ilKodu: "34" }), belirsiz)).toBe(
      false,
    );
  });

  it("moderasyon yetkisi de devrolur", () => {
    expect(
      yorumSilebilirMi(
        koordinatorYap({ ilKodu: "34" }),
        { yazanKullaniciId: 999 },
        ayrilaninFaaliyeti,
      ),
    ).toBe(true);
    expect(
      yorumSilebilirMi(
        koordinatorYap({ ilKodu: "06" }),
        { yazanKullaniciId: 999 },
        ayrilaninFaaliyeti,
      ),
    ).toBe(false);
  });

  it("öğrenci devirden yararlanamaz", () => {
    expect(yetkiDevrolduMu(ogrenciYap(), ayrilaninFaaliyeti)).toBe(false);
    expect(
      basvuruDegerlendirebilirMi(ogrenciYap(), ayrilaninFaaliyeti),
    ).toBe(false);
  });

  /*
   * İptal devrolmayan tek yetkidir: devralan koordinatör faaliyeti yürütür ama
   * kapatamaz — başvurmuş tüm öğrencileri etkileyen geri alınamaz bir karar.
   */
  it("devralan koordinatör faaliyeti iptal edemez", () => {
    const devralan = koordinatorYap({ ilKodu: "34" });
    expect(ekYukleyebilirMi(devralan, ayrilaninFaaliyeti)).toBe(true);
    expect(faaliyetIptalEdebilirMi(devralan, ayrilaninFaaliyeti)).toBe(false);
  });
});

describe("faaliyet iptali", () => {
  const faaliyet = faaliyetYap({ duzenleyenKullaniciId: 200 });

  it("faaliyeti açan kullanıcı iptal edebilir", () => {
    expect(faaliyetIptalEdebilirMi(danismanYap({ id: 200 }), faaliyet)).toBe(
      true,
    );
  });

  it("proje yöneticisi her faaliyeti iptal edebilir", () => {
    expect(faaliyetIptalEdebilirMi(projeYoneticisiYap(), faaliyet)).toBe(true);
  });

  it("aynı rolden başkası ve öğrenci iptal edemez", () => {
    expect(faaliyetIptalEdebilirMi(danismanYap({ id: 201 }), faaliyet)).toBe(
      false,
    );
    expect(faaliyetIptalEdebilirMi(ogrenciYap(), faaliyet)).toBe(false);
  });
});

describe("etkinlik listesinin CSV çıktısı", () => {
  // 10 Ağustos 2026 · istek: "öğrenci etkinliklerinde CSV indir kalkacak".
  it("öğrenci etkinlik listesini dışa aktaramaz", () => {
    expect(faaliyetDisaAktarabilirMi(ogrenciYap())).toBe(false);
  });

  it("öğretmen, koordinatör, merkez ve dış kullanıcı dışa aktarabilir", () => {
    expect(faaliyetDisaAktarabilirMi(danismanYap())).toBe(true);
    expect(faaliyetDisaAktarabilirMi(rolsuzOgretmenYap())).toBe(true);
    expect(faaliyetDisaAktarabilirMi(koordinatorYap())).toBe(true);
    expect(faaliyetDisaAktarabilirMi(projeYoneticisiYap())).toBe(true);
    expect(faaliyetDisaAktarabilirMi(mezunYap())).toBe(true);
    expect(faaliyetDisaAktarabilirMi(paydasTemsilcisiYap())).toBe(true);
  });
});

describe("rol ve görev atama", () => {
  it("il koordinatörünü yalnızca proje yöneticisi atar", () => {
    expect(ilKoordinatorAtayabilirMi(projeYoneticisiYap())).toBe(true);
    expect(ilKoordinatorAtayabilirMi(koordinatorYap())).toBe(false);
    expect(ilKoordinatorAtayabilirMi(danismanYap())).toBe(false);
  });

  it("okul temsilcisini danışman yalnızca kendi okulunda atar", () => {
    const danisman = danismanYap({ kurumKodu: 750001 });
    expect(okulTemsilcisiAtayabilirMi(danisman, 750001, true)).toBe(true);
    expect(okulTemsilcisiAtayabilirMi(danisman, 750002, true)).toBe(false);
    // Okulun ili GEÇİLMEDİĞİNDE koordinatör kapısı açılmaz: bilgiyi taşımayan
    // çağıran, 26 Ağustos öncesiyle aynı cevabı alır.
    expect(okulTemsilcisiAtayabilirMi(koordinatorYap(), 750001, true)).toBe(
      false,
    );
  });

  /*
   * 26 AĞUSTOS 2026 · istek: "il temsilcisi yap kaldır, ilçe temsilcisi yap
   * kaldır, okul temsilcisi yap kaldır butonları olsun; il koordinatörleri
   * bunların atamasını yapabilsin."
   */
  it("koordinatör KENDİ İLİNDEKİ okula temsilci atayabilir", () => {
    const koordinator = koordinatorYap({ ilKodu: "34" });
    // Danışmanlık koşulu koordinatöre sorulmaz: onun kapısı ilinden açılıyor.
    expect(okulTemsilcisiAtayabilirMi(koordinator, 750001, false, "34")).toBe(
      true,
    );
    expect(okulTemsilcisiAtayabilirMi(koordinator, 750001, false, "06")).toBe(
      false,
    );
    // Danışmanın kapısı ilden AÇILMAZ: okulu tutmuyorsa il de kurtarmaz.
    expect(
      okulTemsilcisiAtayabilirMi(
        danismanYap({ kurumKodu: 750001 }),
        750002,
        true,
        "34",
      ),
    ).toBe(false);
  });

  describe("ogrenciTemsilciligiAtayabilirMi", () => {
    const ogrenciKapsami = {
      ilKodu: "34",
      ilceKodu: "3401",
      kurumKodu: 750001,
    };

    it("koordinatöre kendi ilinde üç görevi de açar", () => {
      const koordinator = koordinatorYap({ ilKodu: "34" });
      for (const rol of [
        "IL_TEMSILCISI",
        "ILCE_TEMSILCISI",
        "OKUL_TEMSILCISI",
      ] as const) {
        expect(
          ogrenciTemsilciligiAtayabilirMi(
            koordinator,
            rol,
            ogrenciKapsami,
            false,
          ),
        ).toBe(true);
      }
    });

    it("başka ilin öğrencisinde üçünü de kapatır", () => {
      const koordinator = koordinatorYap({ ilKodu: "06" });
      for (const rol of [
        "IL_TEMSILCISI",
        "ILCE_TEMSILCISI",
        "OKUL_TEMSILCISI",
      ] as const) {
        expect(
          ogrenciTemsilciligiAtayabilirMi(
            koordinator,
            rol,
            ogrenciKapsami,
            false,
          ),
        ).toBe(false);
      }
    });

    it("danışmana yalnızca kendi öğrencisinin okul temsilciliğini açar", () => {
      const danisman = danismanYap({ kurumKodu: 750001 });
      expect(
        ogrenciTemsilciligiAtayabilirMi(
          danisman,
          "OKUL_TEMSILCISI",
          ogrenciKapsami,
          true,
        ),
      ).toBe(true);
      expect(
        ogrenciTemsilciligiAtayabilirMi(
          danisman,
          "OKUL_TEMSILCISI",
          ogrenciKapsami,
          false,
        ),
      ).toBe(false);
      expect(
        ogrenciTemsilciligiAtayabilirMi(
          danisman,
          "IL_TEMSILCISI",
          ogrenciKapsami,
          true,
        ),
      ).toBe(false);
    });

    it("kapsam verisi eksik öğrenciye görev vermez", () => {
      // Görev kaydı kapsam sütunuyla açılıyor; ili olmayan öğrenciye İl
      // Temsilcisi verilseydi kayıt kapsamsız doğardı.
      const merkez = projeYoneticisiYap();
      expect(
        ogrenciTemsilciligiAtayabilirMi(
          merkez,
          "IL_TEMSILCISI",
          { ilKodu: null, ilceKodu: null, kurumKodu: 750001 },
          false,
        ),
      ).toBe(false);
      expect(
        ogrenciTemsilciligiAtayabilirMi(
          merkez,
          "ILCE_TEMSILCISI",
          { ilKodu: "34", ilceKodu: null, kurumKodu: 750001 },
          false,
        ),
      ).toBe(false);
      expect(
        ogrenciTemsilciligiAtayabilirMi(
          merkez,
          "OKUL_TEMSILCISI",
          { ilKodu: "34", ilceKodu: "3401", kurumKodu: null },
          false,
        ),
      ).toBe(false);
    });
  });

  /*
   * 10 AĞUSTOS 2026 · istek: "danışmanı olmadığı öğrenciyi okul temsilcisi
   * yapabiliyor, bu bir tezat."
   *
   * Öğretmen okulundaki danışmansız öğrencileri de listeliyor; GÖRMEK ile
   * GÖREV VERMEK ayrı yetkiler.
   */
  it("danışman, danışmanlığında olmayan öğrenciye okul temsilciliği veremez", () => {
    const danisman = danismanYap({ kurumKodu: 750001 });
    expect(okulTemsilcisiAtayabilirMi(danisman, 750001, false)).toBe(false);
  });

  it("proje yöneticisine danışmanlık koşulu sorulmaz", () => {
    // Merkezin danışmanlığı yoktur; okulda danışman kalmadığında düzeltmeyi
    // yapabilecek tek kişi odur.
    expect(okulTemsilcisiAtayabilirMi(projeYoneticisiYap(), 750001, false)).toBe(
      true,
    );
  });

  it("il temsilcisini koordinatör yalnızca kendi ilinde atar", () => {
    const koordinator = koordinatorYap({ ilKodu: "34" });
    expect(ilTemsilcisiAtayabilirMi(koordinator, "34")).toBe(true);
    expect(ilTemsilcisiAtayabilirMi(koordinator, "06")).toBe(false);
    expect(ilTemsilcisiAtayabilirMi(danismanYap(), "34")).toBe(false);
  });

  /*
   * ÇALIŞMA GRUBU TEMSİLCİLİĞİ İKİ KEZ EL DEĞİŞTİRDİ; testler ikisini de
   * tutuyor.
   *
   * 11 Ağustos 2026 · istek: "koordinatör öğrenciyi çalışma grubu yöneticisi
   * yapamasın" — gerekçe, çalışma grubunun İL DEĞİL ÜLKE GENELİ bir yapı
   * olması ve grubun temsilcisinin tek kişi olmasıydı.
   *
   * 26 Ağustos 2026 · öğrenciler listesine atama kutusu eklenirken kapı
   * koordinatöre yeniden açıldı (onaylanan seçenek: "il koordinatörü de
   * atayabilsin"). Yarış riski ortadan kalkmadı, GÖRÜNÜR oldu: dönem+grup
   * başına tek kayıt kuralı eylemde duruyor ve ikinci il açık bir hata alıyor.
   */
  it("çalışma grubu temsilciliğinde merkez koşulsuz atar", () => {
    expect(calismaGrubuYoneticisiAtayabilirMi(projeYoneticisiYap())).toBe(true);
    expect(calismaGrubuYoneticisiAtayabilirMi(projeYoneticisiYap(), "34")).toBe(
      true,
    );
  });

  it("koordinatör YALNIZCA kendi ilindeki öğrenciye atar", () => {
    const koordinator = koordinatorYap({ ilKodu: "34" });
    expect(calismaGrubuYoneticisiAtayabilirMi(koordinator, "34")).toBe(true);
    expect(calismaGrubuYoneticisiAtayabilirMi(koordinator, "06")).toBe(false);
    // İl geçilmediğinde kapı açılmaz: bilgiyi taşımayan çağıran, 26 Ağustos
    // öncesiyle aynı cevabı alır.
    expect(calismaGrubuYoneticisiAtayabilirMi(koordinator)).toBe(false);
    expect(calismaGrubuYoneticisiAtayabilirMi(koordinator, null)).toBe(false);
  });

  it("danışman öğretmen çalışma grubu temsilcisi atayamaz", () => {
    // Kapı yalnızca merkeze ve ilin koordinatörüne açıldı; danışmanlık bu
    // görevde bir yetki doğurmuyor.
    expect(calismaGrubuYoneticisiAtayabilirMi(danismanYap())).toBe(false);
    expect(calismaGrubuYoneticisiAtayabilirMi(danismanYap(), "34")).toBe(false);
  });

  it("gruba ÜYE eklemek koordinatörde kalır", () => {
    // İsteğin ikinci yarısı: yönetici hayır, üye evet. İki yetki ayrı kapılar
    // ve yalnızca biri daraltıldı.
    expect(ogrenciCalismaGrubuYonetebilirMi(koordinatorYap())).toBe(true);
    expect(ogrenciCalismaGrubuYonetebilirMi(danismanYap())).toBe(true);
  });

  it("ilçe temsilcisini ilçenin bağlı olduğu ilin koordinatörü atar", () => {
    /*
     * Fonksiyon ilçe kodunu değil İL kodunu alır: sistemde ilçe düzeyinde
     * görevli yoktur (RolKodu'nda ILCE_KOORDINATOR diye bir değer yok), ilçe
     * ilin içindeki bir basamaktır. Danışman öğretmen kendi okulunun ilçesinde
     * bile atama yapamaz — temsilcilik okul sınırını aşıyor.
     */
    const koordinator = koordinatorYap({ ilKodu: "34" });
    expect(ilceTemsilcisiAtayabilirMi(koordinator, "34")).toBe(true);
    expect(ilceTemsilcisiAtayabilirMi(koordinator, "06")).toBe(false);
    expect(ilceTemsilcisiAtayabilirMi(danismanYap(), "34")).toBe(false);
    expect(ilceTemsilcisiAtayabilirMi(projeYoneticisiYap(), "34")).toBe(true);
  });

  it("çalışma grubunu yalnızca proje yöneticisi tanımlar", () => {
    expect(calismaGrubuTanimlayabilirMi(projeYoneticisiYap())).toBe(true);
    expect(calismaGrubuTanimlayabilirMi(koordinatorYap())).toBe(false);
  });

  it("öğrenciyi gruba yazmayı grup tanımlamaktan ayırır", () => {
    /*
     * İki ayrı yetki: grubu TANIMLAMAK listeyi yönetmektir (yalnızca proje
     * yöneticisi), öğrenciyi gruba EKLEMEK mevcut bir gruba kayıt açmaktır
     * (danışman ve koordinatör de yapar). Aynı fonksiyonla korunmaları,
     * danışmana grup listesini açmak ya da öğrenci eklemeyi merkeze kilitlemek
     * demek olurdu.
     */
    expect(ogrenciCalismaGrubuYonetebilirMi(projeYoneticisiYap())).toBe(true);
    expect(ogrenciCalismaGrubuYonetebilirMi(koordinatorYap())).toBe(true);
    expect(ogrenciCalismaGrubuYonetebilirMi(danismanYap())).toBe(true);
    // Öğrenci kendi seçimini /panel/calisma-gruplari ekranından yapar; bu yetki
    // başka bir öğrenciyi gruba yazmayı kapsadığı için ona verilmez.
    expect(ogrenciCalismaGrubuYonetebilirMi(ogrenciYap())).toBe(false);
    // Danışmanlık işaretlemeyen öğretmen hiçbir öğrenciye dokunamaz.
    expect(ogrenciCalismaGrubuYonetebilirMi(rolsuzOgretmenYap())).toBe(false);
  });

  it("rol/atama envanterini yalnızca proje yöneticisi görür", () => {
    // Bu, "öğrenci/öğretmen verisi görüntüleme" satırından AYRI bir yetkidir:
    // il koordinatörü kendi ilindeki öğrencileri görür ama tüm illerin
    // koordinatör/danışman boşluklarını göremez.
    expect(rolEnvanteriGorebilirMi(projeYoneticisiYap())).toBe(true);
    expect(rolEnvanteriGorebilirMi(koordinatorYap())).toBe(false);
    expect(rolEnvanteriGorebilirMi(danismanYap())).toBe(false);
    expect(rolEnvanteriGorebilirMi(ogrenciYap())).toBe(false);
  });
});

describe("öğrenci görev rolleri ek yetki vermez", () => {
  it("İl Temsilcisi olan öğrenci diğer öğrencilerle aynı yetkiye sahiptir", () => {
    // Görev rolü OturumKullanicisi.roller'a hiç girmez; yetki kararı yalnızca
    // OGRENCI rolüne bakar.
    const ilTemsilcisiOgrenci = ogrenciYap({ id: 101 });
    const sıradanOgrenci = ogrenciYap({ id: 102 });

    expect(basvuruYapabilirMi(ilTemsilcisiOgrenci)).toBe(
      basvuruYapabilirMi(sıradanOgrenci),
    );
    // Temsilcilik faaliyet açma kapısını da açmaz: ikisi de açamaz.
    expect(faaliyetAcabilirMi(ilTemsilcisiOgrenci, "OKUL")).toBe(
      faaliyetAcabilirMi(sıradanOgrenci, "OKUL"),
    );
    expect(faaliyetAcabilirMi(ilTemsilcisiOgrenci, "OKUL")).toBe(false);
  });
});

/**
 * Öğretmen ve paydaş envanterleri — analiz dokümanı Bölüm 2 ve 3.
 *
 * İkisinde de GÖRME ile YÖNETME ayrı kapılardır; testler bu ayrımın
 * kapanmadığını doğrular.
 */
/**
 * ÖĞRENCİ ENVANTERİ, kişisel verinin toplu görüldüğü tek liste.
 *
 * Kapı 11 Ağustos 2026'da genişletildi: ekran önceden yalnızca öğrenciyi
 * eliyor, mezun/paydaş/mentör ve görev almamış öğretmen listeyi açıp "0 kayıt"
 * görüyordu. Boş liste sızıntı değildi ama erişimi yalnızca kapsam filtresinin
 * varsayılan dalı tutuyordu; test o dalın tek savunma hattı olmadığını
 * doğruluyor.
 */
describe("öğrenci mentörlüğüne karar verme", () => {
  const ogrenci = { id: 100, ilKodu: "34" };

  it("danışman kendi öğrencisine karar verir", () => {
    expect(
      ogrenciMentorluguneKararVerebilirMi(danismanYap(), ogrenci, true),
    ).toBe(true);
  });

  it("danışman, danışmanlığında olmayan öğrenciye karar veremez", () => {
    expect(
      ogrenciMentorluguneKararVerebilirMi(danismanYap(), ogrenci, false),
    ).toBe(false);
  });

  /*
   * 27 Ağustos 2026 · istek: "il koordinatörü de öğrencinin mentörlük
   * başvurusunu onaylayabilsin". Danışmanı olmayan öğrencinin başvurusu bu
   * ekranda kimseye düğme basmıyordu.
   */
  it("il koordinatörü kendi ilindeki öğrenciye karar verir", () => {
    expect(
      ogrenciMentorluguneKararVerebilirMi(
        koordinatorYap({ ilKodu: "34" }),
        ogrenci,
        false,
      ),
    ).toBe(true);
  });

  it("il koordinatörü başka ilin öğrencisine karar veremez", () => {
    expect(
      ogrenciMentorluguneKararVerebilirMi(
        koordinatorYap({ ilKodu: "06" }),
        ogrenci,
        false,
      ),
    ).toBe(false);
  });

  it("ili olmayan öğrenci koordinatörün kapsamına girmez", () => {
    expect(
      ogrenciMentorluguneKararVerebilirMi(
        koordinatorYap({ ilKodu: "34" }),
        { id: 100, ilKodu: null },
        false,
      ),
    ).toBe(false);
  });

  /*
   * 27 Ağustos 2026 · istek: "proje yöneticisine mentörlük ata kaldır da
   * olsun". Bir tur önce merkez dışarıdaydı; kuyruğun kopyası olduğu
   * düşünülmüştü, oysa kuyruk yalnızca BEKLEYEN başvuruyu karara bağlıyor.
   */
  it("proje yöneticisi de karar verir", () => {
    expect(
      ogrenciMentorluguneKararVerebilirMi(projeYoneticisiYap(), ogrenci, false),
    ).toBe(true);
  });

  /* Kimse kendi işini onaylamaz — mentorlukOnaylayabilirMi ile aynı ilke. */
  it("kişi kendi kaydına karar veremez", () => {
    const koordinator = koordinatorYap({ ilKodu: "34" });
    expect(
      ogrenciMentorluguneKararVerebilirMi(
        koordinator,
        { id: koordinator.id, ilKodu: "34" },
        false,
      ),
    ).toBe(false);
  });

  it("öğrencinin kendisi başkasına karar veremez", () => {
    expect(
      ogrenciMentorluguneKararVerebilirMi(ogrenciYap({ id: 101 }), ogrenci, false),
    ).toBe(false);
  });
});

describe("öğrenci envanteri", () => {
  it("öğrenci, dış kullanıcılar ve görev almamış öğretmen envanteri göremez", () => {
    expect(ogrenciEnvanteriGorebilirMi(ogrenciYap())).toBe(false);
    expect(ogrenciEnvanteriGorebilirMi(rolsuzOgretmenYap())).toBe(false);
    expect(ogrenciEnvanteriGorebilirMi(mezunYap())).toBe(false);
    expect(ogrenciEnvanteriGorebilirMi(paydasTemsilcisiYap())).toBe(false);
  });

  it("danışman, koordinatör ve merkez envanteri görür", () => {
    expect(ogrenciEnvanteriGorebilirMi(danismanYap())).toBe(true);
    expect(ogrenciEnvanteriGorebilirMi(koordinatorYap())).toBe(true);
    expect(ogrenciEnvanteriGorebilirMi(projeYoneticisiYap())).toBe(true);
  });
});

describe("öğretmen envanteri", () => {
  it("öğrenci ve görev almamış öğretmen envanteri göremez", () => {
    expect(ogretmenEnvanteriGorebilirMi(ogrenciYap())).toBe(false);
    expect(ogretmenEnvanteriGorebilirMi(rolsuzOgretmenYap())).toBe(false);
  });

  it("danışman, koordinatör ve merkez envanteri görür", () => {
    expect(ogretmenEnvanteriGorebilirMi(danismanYap())).toBe(true);
    expect(ogretmenEnvanteriGorebilirMi(koordinatorYap())).toBe(true);
    expect(ogretmenEnvanteriGorebilirMi(projeYoneticisiYap())).toBe(true);
  });
});

describe("paydaş envanteri", () => {
  it("öğrenci paydaş listesini göremez", () => {
    expect(paydasGorebilirMi(ogrenciYap())).toBe(false);
  });

  it("faaliyet düzenleyen roller listeyi görür", () => {
    expect(paydasGorebilirMi(danismanYap())).toBe(true);
    expect(paydasGorebilirMi(koordinatorYap())).toBe(true);
    expect(paydasGorebilirMi(projeYoneticisiYap())).toBe(true);
  });

  it("kayıt açma yetkisi görmekten dardır: danışman öğretmen yönetemez", () => {
    expect(paydasYonetebilirMi(danismanYap(), "34")).toBe(false);
    expect(paydasYonetebilirMi(ogrenciYap(), "34")).toBe(false);
  });

  it("kayıt EKLEMEDE il sorulmaz: koordinatör başka ile de ekleyebilir", () => {
    // İzmir koordinatörünün Ankara'daki bir üniversiteyle iş birliği kurması
    // olağandır; kaydı kendi iline yazmaya zorlamak envanteri yanlışlardı.
    expect(paydasEkleyebilirMi(koordinatorYap({ ilKodu: "35" }))).toBe(true);
    expect(paydasEkleyebilirMi(projeYoneticisiYap())).toBe(true);
  });

  it("danışman öğretmen ve öğrenci kayıt ekleyemez", () => {
    expect(paydasEkleyebilirMi(danismanYap())).toBe(false);
    expect(paydasEkleyebilirMi(ogrenciYap())).toBe(false);
  });

  it("düzenleme eklemeden dardır: koordinatör kendi ilini düzenler", () => {
    const koordinator = koordinatorYap({ ilKodu: "34" });
    expect(paydasYonetebilirMi(koordinator, "34")).toBe(true);
    expect(paydasYonetebilirMi(koordinator, "06")).toBe(false);
  });

  it("başka ile yazdığı KENDİ kaydını düzenleyebilir", () => {
    // Yoksa yanlış girdiği bir kurumu düzeltemez hâle gelirdi.
    const koordinator = koordinatorYap({ id: 77, ilKodu: "34" });
    expect(paydasYonetebilirMi(koordinator, "06", 77)).toBe(true);
  });

  it("başka ilin koordinatörünün eklediği kayda dokunamaz", () => {
    const koordinator = koordinatorYap({ id: 77, ilKodu: "34" });
    expect(paydasYonetebilirMi(koordinator, "06", 88)).toBe(false);
  });

  it("proje yöneticisi her ilin paydaşını yönetir", () => {
    expect(paydasYonetebilirMi(projeYoneticisiYap(), "06")).toBe(true);
  });

  /*
   * Faaliyete paydaş BAĞLAMAK, paydaş kaydını yönetmekten farklıdır: kendi
   * faaliyetini açan danışman öğretmen bağlantıyı kurabilmeli.
   */
  it("faaliyete paydaş bağlamak faaliyetin sahipliğine bakar", () => {
    const faaliyet = faaliyetYap({ duzenleyenKullaniciId: 200 });
    expect(faaliyetPaydasiYonetebilirMi(danismanYap({ id: 200 }), faaliyet)).toBe(
      true,
    );
    expect(faaliyetPaydasiYonetebilirMi(danismanYap({ id: 201 }), faaliyet)).toBe(
      false,
    );
    expect(faaliyetPaydasiYonetebilirMi(projeYoneticisiYap(), faaliyet)).toBe(
      true,
    );
  });
});

describe("öğretmen faaliyeti onay akışı", () => {
  const ogretmenFaaliyeti = (ozellikler = {}) =>
    faaliyetYap({
      duzenleyenKullaniciId: 200,
      duzenleyenDanismanMi: true,
      onayliMi: false,
      kapsamIlKodu: "34",
      ...ozellikler,
    });

  it("danışman öğretmenin okul dışı faaliyeti onay bekler, okul içi beklemez", () => {
    /*
     * Kendi okulu öğretmenin zaten sorumlu olduğu yer; oraya açtığı etkinlik
     * doğrudan yayına girer (20 Ağustos 2026). Okul dışına çıkan çağrıyı ise
     * ilin koordinatörü görmeden yayınlamıyoruz.
     */
    const danisman = danismanYap();
    expect(faaliyetOnayGerekiyorMu(danisman, "OKUL")).toBe(false);
    expect(faaliyetOnayGerekiyorMu(danisman, "IL")).toBe(true);
    expect(faaliyetOnayGerekiyorMu(danisman, "ULUSAL")).toBe(true);
  });

  it("okulun ilindeki koordinatör onaylayabilir", () => {
    expect(
      ilKoordinatoruOnaylayabilirMi(
        koordinatorYap({ ilKodu: "34" }),
        ogretmenFaaliyeti(),
      ),
    ).toBe(true);
  });

  it("başka ilin koordinatörü onaylayamaz", () => {
    expect(
      ilKoordinatoruOnaylayabilirMi(
        koordinatorYap({ ilKodu: "06" }),
        ogretmenFaaliyeti(),
      ),
    ).toBe(false);
  });

  it("proje yöneticisi her koşulda onaylayabilir", () => {
    expect(
      faaliyetOnaylayabilirMi(projeYoneticisiYap(), ogretmenFaaliyeti()),
    ).toBe(true);
  });

  it("başka bir danışman öğretmen onaylayamaz", () => {
    expect(
      ilKoordinatoruOnaylayabilirMi(danismanYap(), ogretmenFaaliyeti()),
    ).toBe(false);
  });

  it("onay bekleyen faaliyet, onaylayacak koordinatöre GÖRÜNÜR", () => {
    // Onaylayacak kişi onaylayacağı şeyi görmek zorunda; görünmezse onay
    // ekranına hiç ulaşamazdı.
    expect(
      faaliyetGorunurMu(koordinatorYap({ ilKodu: "34" }), ogretmenFaaliyeti()),
    ).toBe(true);
  });

  it("proje yöneticisinin açtığı faaliyet onay beklemez", () => {
    expect(faaliyetOnayGerekiyorMu(projeYoneticisiYap(), "ULUSAL")).toBe(false);
  });
});

describe("faaliyet raporu yazma yetkisi", () => {
  const ilFaaliyeti = (ozellikler = {}) =>
    faaliyetYap({ duzenleyenKullaniciId: 500, kapsamIlKodu: "34", ...ozellikler });

  it("faaliyeti açan kendi raporunu yazar", () => {
    expect(
      faaliyetRaporuYazabilirMi(danismanYap({ id: 500 }), ilFaaliyeti()),
    ).toBe(true);
  });

  it("il koordinatörü İLİNDEKİ BAŞKASININ faaliyetinin raporunu yazabilir", () => {
    /*
     * Raporlama ilin sorumluluğu: okulundaki bir öğretmen etkinliği yapıp
     * raporu yazmadan görevden ayrılırsa faaliyet raporsuz kalmamalı.
     */
    expect(
      faaliyetRaporuYazabilirMi(koordinatorYap({ ilKodu: "34" }), ilFaaliyeti()),
    ).toBe(true);
  });

  it("BAŞKA ilin koordinatörü yazamaz", () => {
    expect(
      faaliyetRaporuYazabilirMi(koordinatorYap({ ilKodu: "06" }), ilFaaliyeti()),
    ).toBe(false);
  });

  it("ilgisiz danışman öğretmen yazamaz", () => {
    expect(
      faaliyetRaporuYazabilirMi(danismanYap({ id: 999 }), ilFaaliyeti()),
    ).toBe(false);
  });

  it("öğrenci yazamaz", () => {
    expect(faaliyetRaporuYazabilirMi(ogrenciYap(), ilFaaliyeti())).toBe(false);
  });

  it("proje yöneticisi her faaliyetin raporunu yazar", () => {
    expect(
      faaliyetRaporuYazabilirMi(projeYoneticisiYap(), ilFaaliyeti()),
    ).toBe(true);
  });

  it("rapor yetkisi EK YÜKLEMEDEN geniştir", () => {
    // Koordinatörün başkasının faaliyetine dosya eklemesi ayrı bir müdahale
    // ve gerekmiyor; rapor yazmak gerekiyor.
    const koordinator = koordinatorYap({ ilKodu: "34" });
    expect(faaliyetRaporuYazabilirMi(koordinator, ilFaaliyeti())).toBe(true);
    expect(ekYukleyebilirMi(koordinator, ilFaaliyeti())).toBe(false);
  });
});

/**
 * BELGE ÜRETME YETKİSİ (31 Ağustos 2026 · istekler: "Öğrenci açtığı etkinlik
 * için belge oluşturamasın … etkinliği öğrenci oluştursa bile il koordinatörü
 * belge oluşturabilsin o etkinliğe dair." · "Öğretmen de belge oluşturamasın,
 * sadece koordinatör ve proje yöneticileri belge üretebilsin.")
 *
 * Kapı rapordan AYRI ve ondan dar: rapor bir beyandır, belge bir onaydır ve
 * karşı tarafın GençTek Yolculuğu'na katılım düşürür. Etkinliği KİM AÇARSA
 * AÇSIN belgeyi ilin koordinatörü üretiyor.
 */
describe("belge üretme yetkisi", () => {
  const ogrenciFaaliyeti = () =>
    faaliyetYap({ duzenleyenKullaniciId: 101, kapsamIlKodu: "34" });
  const ogretmenFaaliyeti = () =>
    faaliyetYap({ duzenleyenKullaniciId: 500, kapsamIlKodu: "34" });

  it("etkinliği KENDİ AÇAN öğrenci belge üretemez", () => {
    expect(
      faaliyetBelgesiUretebilirMi(ogrenciYap({ id: 101 }), ogrenciFaaliyeti()),
    ).toBe(false);
  });

  it("etkinliği KENDİ AÇAN öğretmen de belge üretemez", () => {
    /*
     * "Etkinliği açan kişi" kolu kapıdan tümüyle çıktı: kapı
     * `ekYukleyebilirMi`yi hiç çağırmıyor. Çağırsaydı bu satır geri gelirdi.
     */
    expect(
      faaliyetBelgesiUretebilirMi(danismanYap({ id: 500 }), ogretmenFaaliyeti()),
    ).toBe(false);
  });

  it("yürütücüler yoklamayı ve bilgi notunu YAZMAYA devam eder", () => {
    // Kapının daralması yalnızca belgeyi kapsıyor: etkinliği yürüten kişi ne
    // olduğunu anlatmaya devam ediyor.
    expect(
      faaliyetRaporuYazabilirMi(ogrenciYap({ id: 101 }), ogrenciFaaliyeti()),
    ).toBe(true);
    expect(
      faaliyetRaporuYazabilirMi(danismanYap({ id: 500 }), ogretmenFaaliyeti()),
    ).toBe(true);
  });

  // 23 Ekim 2026 · istek: koordinatörde "Belge oluştur … pasif".
  it("il koordinatörü kendi ilinde de belge üretemez", () => {
    expect(
      faaliyetBelgesiUretebilirMi(
        koordinatorYap({ ilKodu: "34" }),
        ogrenciFaaliyeti(),
      ),
    ).toBe(false);
  });

  it("başka ilin koordinatörü üretemez", () => {
    expect(
      faaliyetBelgesiUretebilirMi(
        koordinatorYap({ ilKodu: "06" }),
        ogrenciFaaliyeti(),
      ),
    ).toBe(false);
  });

  it("proje yöneticisi her etkinliğe üretir", () => {
    expect(
      faaliyetBelgesiUretebilirMi(projeYoneticisiYap(), ogrenciFaaliyeti()),
    ).toBe(true);
  });

  it("giriş ekranının rol sorusu yalnızca merkezi geçirir", () => {
    expect(belgeUretenRoldeMi(koordinatorYap({ ilKodu: "34" }))).toBe(false);
    expect(belgeUretenRoldeMi(projeYoneticisiYap())).toBe(true);
    expect(belgeUretenRoldeMi(danismanYap())).toBe(false);
    expect(belgeUretenRoldeMi(ogrenciYap())).toBe(false);
  });
});

/**
 * ÖĞRENCİ LİSTESİNİN GÖREV/ROL SÜZGECİ (27 Ağustos 2026 · istek: "üstteki
 * filtrelere yeni bir rol alanı ilçe temsilcisi il temsilcisi okul temsilcisi
 * mentör şeklinde açılan liste filtresi olsun").
 *
 * Süzgeç YALNIZCA DARALTIR: kapsam filtresinin üstüne biniyor, onun yerine
 * geçmiyor. Testler koşulun `AND` zincirine eklendiğini ve "mentör"ün bir görev
 * kaydı değil onaylı mentörlük olarak sorulduğunu sınıyor.
 */
describe("öğrenci listesi · görev/rol süzgeci", () => {
  it("geçerli değerleri tanır, uydurmayı reddeder", () => {
    for (const deger of [
      "IL_TEMSILCISI",
      "ILCE_TEMSILCISI",
      "OKUL_TEMSILCISI",
      "MENTOR",
    ]) {
      expect(ogrenciGorevSuzgeciGecerliMi(deger)).toBe(true);
    }
    expect(ogrenciGorevSuzgeciGecerliMi("CALISMA_GRUBU_YONETICISI")).toBe(false);
    expect(ogrenciGorevSuzgeciGecerliMi("")).toBe(false);
  });

  it("temsilcilikte açık görev kaydı arar", () => {
    const kosul = ogrenciListeFiltresi(projeYoneticisiYap(), {
      gorevRolu: "IL_TEMSILCISI",
    });
    expect(kosul.AND).toContainEqual({
      gorevRolleri: { some: { rolKodu: "IL_TEMSILCISI" } },
    });
  });

  /* "Mentör" bir görev değil, ONAYLANMIŞ bir mentörlük kaydıdır. */
  it("mentörde onaylı mentörlük kaydı arar", () => {
    const kosul = ogrenciListeFiltresi(projeYoneticisiYap(), {
      gorevRolu: "MENTOR",
    });
    expect(kosul.AND).toContainEqual({ mentorluk: { durum: "ONAYLANDI" } });
  });

  it("süzgeç yokken listeyi daraltmaz", () => {
    const kosul = ogrenciListeFiltresi(projeYoneticisiYap(), {});
    const koşullar = Array.isArray(kosul.AND) ? kosul.AND : [];
    expect(
      koşullar.some((parca) => parca !== null && "mentorluk" in parca),
    ).toBe(false);
  });
});
