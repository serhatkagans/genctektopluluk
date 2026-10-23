import {
  faaliyetSuresiGecerliMi,
  faaliyetSuresiGun,
  faaliyetSuresiYaz,
  KATILIMCI_TIPI_ETIKETLERI,
  katilimciTipi,
  vekaletenBasvuruGecerliMi,
  FaaliyetKuralHatasi,
  basvuruPenceresi,
  basvuruYapilabilirMi,
  danismanaKopyaGerekiyorMu,
  degerlendirmeYapilabilirMi,
  duzenleyenBirimBelirle,
  etkinlikKategorisiDogrula,
  faaliyetAcmaYetkisiVarMi,
  faaliyetIcerikAlabilirMi,
  faaliyetYeriBelirle,
  KAPSAMLAR,
  KAPSAM_ETIKETLERI,
  kapsamSecenekleri,
  kontenjanAltSiniri,
  kontenjanDegisikligiGecerliMi,
  kontenjanDurumu,
  onayDurumuBelirle,
  programSecimiGerekiyorMu,
  yenidenOnayGerekiyorMu,
} from "@/lib/faaliyet/kurallar";
import {
  danismanYap,
  koordinatorYap,
  ogrenciYap,
  projeYoneticisiYap,
  rolsuzOgretmenYap,
} from "./yardimcilar";

/**
 * Faaliyet iş kuralları — references/domain-rules.md Bölüm 6 ve 8.
 *
 * Ekranlar bu fonksiyonlara güvenerek "ne teklif edeceğine" karar veriyor,
 * sunucu eylemleri de aynı fonksiyonlarla "ne kabul edeceğine". Bu yüzden
 * kararların kendisi burada sınanır.
 */

describe("kapsam seçenekleri", () => {
  /*
   * ULUSLARARASI KAPSAM (26 Ağustos 2026 · istek: "yapılacak tüm etkinliklere
   * uluslararasını da ekleyelim, o da lazım olacak"). Yer bakımından ulusalla
   * aynı davranır; ayrımı kartta ve raporlamada.
   */
  it("uluslararası etkinlik ne okula ne ile bağlıdır", () => {
    expect(faaliyetYeriBelirle(projeYoneticisiYap(), "ULUSLARARASI", null)).toEqual({
      kurumKodu: null,
      ilKodu: null,
    });
  });

  it("koordinatörün uluslararası etkinliği merkez onayına gider", () => {
    expect(onayDurumuBelirle(koordinatorYap(), "ULUSLARARASI")).toBe("BEKLIYOR");
  });

  it("her kapsamın bir ekran etiketi vardır", () => {
    for (const kapsam of KAPSAMLAR) {
      expect(KAPSAM_ETIKETLERI[kapsam]).toBeTruthy();
    }
  });

  /*
   * ÖĞRETMEN ÜÇ KAPSAMDA DA AÇAR (26 Ağustos 2026). Kural katmanı bunu zaten
   * söylüyordu — faaliyetAcabilirMi danışmana her kapsamı açık tutuyor ve okul
   * dışı kapsamlar il koordinatörünün onayına gidiyor; geride kalan tek yer
   * ekrana teklif edilen listeydi.
   *
   * SIRA DAR KAPSAMDAN GENİŞE: formda ilk seçenek varsayılan oluyor ve
   * öğretmenin olağan işi kendi okulunda.
   */
  // 23 Ekim 2026 · istek: öğretmen sayfasında "Yeni etkinlik … pasif".
  it("danışman öğretmen etkinlik açamaz", () => {
    expect(kapsamSecenekleri(danismanYap())).toEqual([]);
    expect(faaliyetAcmaYetkisiVarMi(danismanYap())).toBe(false);
  });

  it("öğretmenin okul dışı faaliyeti onaya gider, okul içi gitmez", () => {
    const ogretmen = danismanYap();
    expect(onayDurumuBelirle(ogretmen, "OKUL")).not.toBe("BEKLIYOR");
    expect(onayDurumuBelirle(ogretmen, "IL")).toBe("BEKLIYOR");
    expect(onayDurumuBelirle(ogretmen, "ULUSAL")).toBe("BEKLIYOR");
  });

  // 23 Ekim 2026 · istek: koordinatör sayfasında "Etkinlikler öğretmeninki ile aynı".
  it("il koordinatörü etkinlik açamaz", () => {
    expect(kapsamSecenekleri(koordinatorYap())).toEqual([]);
  });

  it("YEĞİTEK'e okul kapsamı teklif edilmez", () => {
    expect(kapsamSecenekleri(projeYoneticisiYap())).not.toContain("OKUL");
  });

  // 23 Ekim 2026 · istek: "Öğrenci etkinlik açamaz, düğme pasif olsun".
  it("öğrenci etkinlik açamaz", () => {
    expect(kapsamSecenekleri(ogrenciYap())).toEqual([]);
    expect(faaliyetAcmaYetkisiVarMi(ogrenciYap())).toBe(false);
  });

  it("görev almamış öğretmen faaliyet açamaz", () => {
    expect(faaliyetAcmaYetkisiVarMi(rolsuzOgretmenYap())).toBe(false);
  });
});

describe("onay durumu", () => {
  it("il koordinatörünün ulusal faaliyeti onay bekler", () => {
    expect(onayDurumuBelirle(koordinatorYap(), "ULUSAL")).toBe("BEKLIYOR");
  });

  it("il koordinatörünün il faaliyeti onaysız yayına girer", () => {
    expect(onayDurumuBelirle(koordinatorYap(), "IL")).toBe("ONAY_GEREKMEZ");
  });

  it("YEĞİTEK'in ulusal faaliyeti kendi onayını beklemez", () => {
    expect(onayDurumuBelirle(projeYoneticisiYap(), "ULUSAL")).toBe(
      "ONAY_GEREKMEZ",
    );
  });

  /*
   * Kural 20 Ağustos 2026'da bir kez daha değişti: öğretmenin KENDİ OKULUNA
   * açtığı etkinlik doğrudan yayına giriyor, okul dışına çıkan her kapsam
   * ilin koordinatörünün onayını bekliyor (istek: "öğretmen … kendi okulunda
   * etkinlik oluşturabiliyor, türkiye geneli … bir etkinlik oluşturmak
   * istediğinde il koordinatörüne onaya gidecek").
   *
   * Bu yalnızca YENİ faaliyetleri etkiler; veritabanındaki kayıtlar olduğu
   * gibi kalır.
   */
  it("danışman öğretmenin okul faaliyeti onaysız, okul dışı faaliyeti onaylı yayınlanır", () => {
    expect(onayDurumuBelirle(danismanYap(), "OKUL")).toBe("ONAY_GEREKMEZ");
    expect(onayDurumuBelirle(danismanYap(), "IL")).toBe("BEKLIYOR");
    expect(onayDurumuBelirle(danismanYap(), "ULUSAL")).toBe("BEKLIYOR");
  });
});

describe("faaliyet yeri", () => {
  it("okul faaliyetinin kurumu roldan gelir, formdan değil", () => {
    const yer = faaliyetYeriBelirle(danismanYap({ kurumKodu: 750001 }), "OKUL");
    expect(yer).toEqual({ kurumKodu: 750001, ilKodu: null });
  });

  it("koordinatörün il faaliyeti kendi iline sabitlenir", () => {
    // Formdan başka bir il gelse de yok sayılır.
    const yer = faaliyetYeriBelirle(koordinatorYap({ ilKodu: "34" }), "IL", "06");
    expect(yer).toEqual({ kurumKodu: null, ilKodu: "34" });
  });

  it("YEĞİTEK il faaliyetinde ili seçebilir", () => {
    const yer = faaliyetYeriBelirle(projeYoneticisiYap(), "IL", "06");
    expect(yer).toEqual({ kurumKodu: null, ilKodu: "06" });
  });

  it("il seçilmeden il faaliyeti açılamaz", () => {
    expect(() => faaliyetYeriBelirle(projeYoneticisiYap(), "IL", null)).toThrow(
      FaaliyetKuralHatasi,
    );
  });

  it("okulu olmayan kullanıcı okul faaliyeti açamaz", () => {
    expect(() => faaliyetYeriBelirle(koordinatorYap(), "OKUL")).toThrow(
      FaaliyetKuralHatasi,
    );
  });

  it("ulusal faaliyette yer alanları boş kalır", () => {
    expect(faaliyetYeriBelirle(koordinatorYap(), "ULUSAL")).toEqual({
      kurumKodu: null,
      ilKodu: null,
    });
  });
});

describe("düzenleyen birim", () => {
  it("YEĞİTEK ulusal faaliyette merkez adıyla görünür", () => {
    expect(duzenleyenBirimBelirle(projeYoneticisiYap(), "ULUSAL", {})).toBe(
      "MEB YEĞİTEK",
    );
  });

  it("okul faaliyetinde okul adı yazılır", () => {
    expect(
      duzenleyenBirimBelirle(danismanYap(), "OKUL", {
        okulAdi: "Kadıköy Anadolu Lisesi",
      }),
    ).toBe("Kadıköy Anadolu Lisesi");
  });

  it("il faaliyetinde il koordinatörlüğü yazılır", () => {
    expect(
      duzenleyenBirimBelirle(koordinatorYap(), "IL", { ilAdi: "İstanbul" }),
    ).toBe("İstanbul İl Koordinatörlüğü");
  });

  it("koordinatörün ULUSAL faaliyeti merkeze mal edilmez", () => {
    // Merkez onaylıyor diye faaliyet YEĞİTEK'in gibi görünmemeli.
    expect(
      duzenleyenBirimBelirle(koordinatorYap(), "ULUSAL", { ilAdi: "İstanbul" }),
    ).toBe("İstanbul İl Koordinatörlüğü");
  });

  it("YEĞİTEK'in açtığı il faaliyeti merkez adına düzenlenir", () => {
    expect(
      duzenleyenBirimBelirle(projeYoneticisiYap(), "IL", { ilAdi: "Ankara" }),
    ).toBe("MEB YEĞİTEK · Ankara");
  });
});

describe("başvuru penceresi", () => {
  const faaliyet = {
    basvuruBaslangic: new Date("2026-03-01T00:00:00"),
    basvuruBitis: new Date("2026-03-10T23:59:59"),
  };

  it("başlangıçtan önce açılmamıştır", () => {
    expect(basvuruPenceresi(faaliyet, new Date("2026-02-28T12:00:00"))).toBe(
      "ACILMADI",
    );
  });

  it("aralık içinde açıktır", () => {
    expect(basvuruPenceresi(faaliyet, new Date("2026-03-05T12:00:00"))).toBe(
      "ACIK",
    );
  });

  it("bitiş gününün sonuna kadar açık kalır", () => {
    expect(basvuruPenceresi(faaliyet, new Date("2026-03-10T22:00:00"))).toBe(
      "ACIK",
    );
  });

  it("bitişten sonra kapanır", () => {
    expect(basvuruPenceresi(faaliyet, new Date("2026-03-11T00:00:01"))).toBe(
      "KAPANDI",
    );
  });
});

describe("kontenjan", () => {
  it("kontenjanı yalnızca seçilenler değil TÜM aktif başvurular doldurur", () => {
    const durum = kontenjanDurumu(
      [
        { durum: "SECILDI" },
        { durum: "SECILDI" },
        { durum: "YEDEK" },
        { durum: "BEKLIYOR" },
        { durum: "REDDEDILDI" },
        { durum: "GERI_CEKILDI" },
      ],
      5,
    );
    expect(durum).toEqual({
      kontenjan: 5,
      secilen: 2,
      bekleyen: 1,
      yedek: 1,
      aktifBasvuru: 4,
      kalanYer: 1,
      doluMu: false,
    });
  });

  it("reddedilen ve geri çekilen başvurular yer tutmaz", () => {
    const durum = kontenjanDurumu(
      [
        { durum: "BEKLIYOR" },
        { durum: "REDDEDILDI" },
        { durum: "GERI_CEKILDI" },
        { durum: "IPTAL_EDILDI" },
      ],
      2,
    );
    expect(durum.aktifBasvuru).toBe(1);
    expect(durum.doluMu).toBe(false);
  });

  it("aktif başvuru kontenjana ulaştığında dolu sayılır", () => {
    const durum = kontenjanDurumu(
      [{ durum: "BEKLIYOR" }, { durum: "YEDEK" }],
      2,
    );
    expect(durum.doluMu).toBe(true);
    expect(durum.kalanYer).toBe(0);
  });

  /*
   * Yerin asıl açıldığı an: seçilmiş biri vazgeçtiğinde. Bekleyen başvurunun
   * geri çekilmesi zaten yukarıda kapsanıyor; buradaki senaryo, dolu bir
   * etkinlikte SEÇİLEN katılımcının çekilmesiyle yeni başvurunun mümkün hale
   * gelmesidir (bkz. etkinlikler/eylemler.ts · basvuruGeriCekEylemi).
   */
  it("seçilmiş başvuru geri çekilince dolu kontenjanda yer açılır", () => {
    const dolu = kontenjanDurumu(
      [{ durum: "SECILDI" }, { durum: "SECILDI" }],
      2,
    );
    expect(dolu.doluMu).toBe(true);
    expect(
      basvuruYapilabilirMi({
        pencere: "ACIK",
        onayDurumu: "ONAYLANDI",
        kontenjanDoluMu: dolu.doluMu,
      }).olurMu,
    ).toBe(false);

    const cekilmeSonrasi = kontenjanDurumu(
      [{ durum: "SECILDI" }, { durum: "GERI_CEKILDI" }],
      2,
    );
    expect(cekilmeSonrasi.secilen).toBe(1);
    expect(cekilmeSonrasi.kalanYer).toBe(1);
    expect(cekilmeSonrasi.doluMu).toBe(false);
    expect(
      basvuruYapilabilirMi({
        pencere: "ACIK",
        onayDurumu: "ONAYLANDI",
        kontenjanDoluMu: cekilmeSonrasi.doluMu,
      }).olurMu,
    ).toBe(true);
  });
});

describe("kontenjan değişikliği", () => {
  const durum = kontenjanDurumu(
    [{ durum: "SECILDI" }, { durum: "SECILDI" }, { durum: "BEKLIYOR" }],
    5,
  );

  it("seçilen sayısının altına düşürülemez", () => {
    const karar = kontenjanDegisikligiGecerliMi(1, durum);
    expect(karar.olurMu).toBe(false);
    expect(karar.neden).toContain("altına düşürülemez");
    expect(kontenjanAltSiniri(durum)).toBe(2);
  });

  it("seçilen sayısına eşitlenebilir", () => {
    expect(kontenjanDegisikligiGecerliMi(2, durum).olurMu).toBe(true);
  });

  it("her zaman artırılabilir", () => {
    expect(kontenjanDegisikligiGecerliMi(50, durum).olurMu).toBe(true);
  });

  it("sıfır veya negatif kontenjan kabul edilmez", () => {
    expect(kontenjanDegisikligiGecerliMi(0, durum).olurMu).toBe(false);
  });
});

describe("etkinlik kategorisi", () => {
  /*
   * KURAL DEĞİŞTİ: Temel Etkinlik ve Çalışma Grubu Etkinliği'nde ad eskiden
   * ZORUNLU olarak listeden geliyordu. Listede olmayan bir etkinlik açmak
   * isteyen kişi kategoriyi İl Etkinliği'ne çevirmek zorunda kalıyor ve
   * etkinliğin gerçek niteliğini kaybediyordu. Artık "Diğer" yolu var.
   */
  it("temel etkinlikte program YA DA serbest ad gerekir", () => {
    // Program yok + ad yok -> reddedilir
    expect(
      etkinlikKategorisiDogrula({
        kategori: "TEMEL_ETKINLIK",
        programGrubu: null,
        serbestAd: null,
      }).olurMu,
    ).toBe(false);

    // Program yok + ad var ("Diğer" yolu) -> kabul edilir
    expect(
      etkinlikKategorisiDogrula({
        kategori: "TEMEL_ETKINLIK",
        programGrubu: null,
        serbestAd: "Listede olmayan etkinlik",
      }).olurMu,
    ).toBe(true);

    expect(programSecimiGerekiyorMu("TEMEL_ETKINLIK")).toBe(true);
  });

  it("program da ad da yoksa gerekçe iki yolu birden söyler", () => {
    const karar = etkinlikKategorisiDogrula({
      kategori: "TEMEL_ETKINLIK",
      programGrubu: null,
      serbestAd: null,
    });
    expect(karar.neden).toContain("Diğer");
  });

  it("program yanlış gruptansa reddedilir", () => {
    // Veritabanı kısıtı programın DOLU olmasını tutar, doğru gruptan
    // olduğunu tutamaz; o kontrol burada.
    expect(
      etkinlikKategorisiDogrula({
        kategori: "TEMEL_ETKINLIK",
        programGrubu: "CALISMA_GRUBU_ETKINLIGI",
        serbestAd: null,
      }).olurMu,
    ).toBe(false);
  });

  it("doğru gruptan program kabul edilir", () => {
    expect(
      etkinlikKategorisiDogrula({
        kategori: "CALISMA_GRUBU_ETKINLIGI",
        programGrubu: "CALISMA_GRUBU_ETKINLIGI",
        serbestAd: null,
      }).olurMu,
    ).toBe(true);
  });

  it("il etkinliğinde program aranmaz, ad zorunludur", () => {
    expect(programSecimiGerekiyorMu("IL_ETKINLIGI")).toBe(false);
    expect(
      etkinlikKategorisiDogrula({
        kategori: "IL_ETKINLIGI",
        programGrubu: null,
        serbestAd: "Robot Futbol Ligi",
      }).olurMu,
    ).toBe(true);
    expect(
      etkinlikKategorisiDogrula({
        kategori: "IL_ETKINLIGI",
        programGrubu: null,
        serbestAd: null,
      }).olurMu,
    ).toBe(false);
  });
});

describe("yeniden onay", () => {
  it("onaylanmış faaliyette tarih değişimi onayı düşürür", () => {
    expect(
      yenidenOnayGerekiyorMu({
        onayDurumu: "ONAYLANDI",
        tarihDegistiMi: true,
        kontenjanAzaldiMi: false,
      }),
    ).toBe(true);
  });

  it("yalnızca kontenjan artışı onayı düşürmez", () => {
    expect(
      yenidenOnayGerekiyorMu({
        onayDurumu: "ONAYLANDI",
        tarihDegistiMi: false,
        kontenjanAzaldiMi: false,
      }),
    ).toBe(false);
  });

  it("onaya tabi olmayan faaliyette tarih değişimi onay istemez", () => {
    expect(
      yenidenOnayGerekiyorMu({
        onayDurumu: "ONAY_GEREKMEZ",
        tarihDegistiMi: true,
        kontenjanAzaldiMi: true,
      }),
    ).toBe(false);
  });
});

describe("faaliyet iptali", () => {
  it("iptal edilen faaliyet yeni içerik almaz", () => {
    expect(faaliyetIcerikAlabilirMi("AKTIF")).toBe(true);
    expect(faaliyetIcerikAlabilirMi("IPTAL_EDILDI")).toBe(false);
  });

  it("iptal edilen faaliyete başvurulamaz", () => {
    const karar = basvuruYapilabilirMi({
      pencere: "ACIK",
      onayDurumu: "ONAY_GEREKMEZ",
      faaliyetDurumu: "IPTAL_EDILDI",
    });
    expect(karar.olurMu).toBe(false);
    expect(karar.neden).toContain("iptal");
  });

  it("IPTAL_EDILDI durumu elle verilemez", () => {
    expect(
      degerlendirmeYapilabilirMi("IPTAL_EDILDI", kontenjanDurumu([], 5)).olurMu,
    ).toBe(false);
  });
});

describe("başvuru yapılabilirliği", () => {
  it("açık pencerede yayındaki faaliyete başvurulur", () => {
    expect(
      basvuruYapilabilirMi({ pencere: "ACIK", onayDurumu: "ONAY_GEREKMEZ" }),
    ).toEqual({ olurMu: true });
  });

  it("onay bekleyen faaliyete başvurulamaz", () => {
    expect(
      basvuruYapilabilirMi({ pencere: "ACIK", onayDurumu: "BEKLIYOR" }).olurMu,
    ).toBe(false);
  });

  it("pencere kapandıysa başvurulamaz", () => {
    expect(
      basvuruYapilabilirMi({ pencere: "KAPANDI", onayDurumu: "ONAYLANDI" })
        .olurMu,
    ).toBe(false);
  });

  it("aktif başvurusu olan tekrar başvuramaz", () => {
    expect(
      basvuruYapilabilirMi({
        pencere: "ACIK",
        onayDurumu: "ONAYLANDI",
        mevcutBasvuruDurumu: "BEKLIYOR",
      }).olurMu,
    ).toBe(false);
  });

  it("geri çekilmiş başvuru kontenjan dolmadıysa yeniden yapılabilir", () => {
    expect(
      basvuruYapilabilirMi({
        pencere: "ACIK",
        onayDurumu: "ONAYLANDI",
        mevcutBasvuruDurumu: "GERI_CEKILDI",
        kontenjanDoluMu: false,
      }).olurMu,
    ).toBe(true);
  });

  it("kontenjan dolduysa geri çeken öğrenci geri dönemez", () => {
    // domain-rules.md Bölüm 11 kenar durumu: yerini bırakan kişi, yer
    // kalmadığında sıraya yeniden giremez.
    const karar = basvuruYapilabilirMi({
      pencere: "ACIK",
      onayDurumu: "ONAYLANDI",
      mevcutBasvuruDurumu: "GERI_CEKILDI",
      kontenjanDoluMu: true,
    });
    expect(karar.olurMu).toBe(false);
    expect(karar.neden).toContain("Kontenjan doldu");
  });

  it("kontenjan dolduğunda İLK başvuru da alınmaz", () => {
    // Yeni kontenjan modeli: kontenjan tüm aktif başvuruları sınırlar, dolu
    // kontenjan artık "yedek listesi" değil kapalı kapı demektir.
    const karar = basvuruYapilabilirMi({
      pencere: "ACIK",
      onayDurumu: "ONAYLANDI",
      kontenjanDoluMu: true,
    });
    expect(karar.olurMu).toBe(false);
    expect(karar.neden).toContain("Kontenjan doldu");
  });
});

describe("değerlendirme", () => {
  const dolu = kontenjanDurumu([{ durum: "SECILDI" }], 1);
  const bos = kontenjanDurumu([], 2);

  it("kontenjan dolduğunda seçim engellenir", () => {
    const karar = degerlendirmeYapilabilirMi("SECILDI", dolu);
    expect(karar.olurMu).toBe(false);
    expect(karar.neden).toContain("Kontenjan dolu");
  });

  it("kontenjan dolu olsa da yedeğe alınabilir ve reddedilebilir", () => {
    expect(degerlendirmeYapilabilirMi("YEDEK", dolu).olurMu).toBe(true);
    expect(degerlendirmeYapilabilirMi("REDDEDILDI", dolu).olurMu).toBe(true);
  });

  it("boş kontenjanda seçim yapılabilir", () => {
    expect(degerlendirmeYapilabilirMi("SECILDI", bos).olurMu).toBe(true);
  });

  it("geri çekmeyi değerlendiren yapamaz", () => {
    expect(degerlendirmeYapilabilirMi("GERI_CEKILDI", bos).olurMu).toBe(false);
  });
});

/*
 * domain-rules.md Bölüm 8: "Başka ilden ulusal faaliyete başvuran öğrencide
 * danışman onayı aranmaz; bildirim danışmana kopya olarak iletilir."
 * Belirleyici olan başvurunun ULUSAL olması değil, öğrencinin kendi ili
 * dışındaki bir birime başvurmuş olmasıdır.
 */
describe("danışmana kopya bildirim", () => {
  it("öğrenci başka ilin ulusal faaliyetine başvurursa kopya gider", () => {
    expect(
      danismanaKopyaGerekiyorMu({
        kapsam: "ULUSAL",
        ogrenciIlKodu: "65",
        duzenleyenIlKodu: "34",
      }),
    ).toBe(true);
  });

  it("öğrenci kendi ilinin açtığı ulusal faaliyete başvurursa kopya gitmez", () => {
    expect(
      danismanaKopyaGerekiyorMu({
        kapsam: "ULUSAL",
        ogrenciIlKodu: "34",
        duzenleyenIlKodu: "34",
      }),
    ).toBe(false);
  });

  it("merkezin açtığı ulusal faaliyette kopya gitmez", () => {
    // YEĞİTEK faaliyetinin ili yoktur; öğrenci "dışarıya" başvurmuş sayılmaz,
    // aksi halde her merkezî etkinlikte tüm danışmanlara bildirim giderdi.
    expect(
      danismanaKopyaGerekiyorMu({
        kapsam: "ULUSAL",
        ogrenciIlKodu: "34",
        duzenleyenIlKodu: null,
      }),
    ).toBe(false);
  });

  it("okul ve il kapsamındaki faaliyetlerde kopya gitmez", () => {
    expect(
      danismanaKopyaGerekiyorMu({
        kapsam: "OKUL",
        ogrenciIlKodu: "34",
        duzenleyenIlKodu: "34",
      }),
    ).toBe(false);
    expect(
      danismanaKopyaGerekiyorMu({
        kapsam: "IL",
        ogrenciIlKodu: "34",
        duzenleyenIlKodu: "34",
      }),
    ).toBe(false);
  });
});

/**
 * Katılımcı tipi ve vekaleten başvuru — analiz dokümanı 4.2.
 */
describe("katılımcı tipi", () => {
  /*
   * Tip veride TUTULMAZ, aktif rolden okunur: kopyalanan bir tip alanı öğrenci
   * mezun olduğunda ya da öğretmen görev değiştirdiğinde eskirdi.
   */
  it("aktif öğrenci rolü olan kişi öğrencidir", () => {
    expect(katilimciTipi([{ rolKodu: "OGRENCI" }])).toBe("OGRENCI");
  });

  it("öğrenci rolü olmayan herkes öğretmen sayılır", () => {
    expect(katilimciTipi([{ rolKodu: "DANISMAN" }])).toBe("OGRETMEN");
    expect(katilimciTipi([{ rolKodu: "IL_KOORDINATOR" }])).toBe("OGRETMEN");
    // Görev almamış öğretmenin hiç rolü yoktur.
    expect(katilimciTipi([])).toBe("OGRETMEN");
  });

  it("her katılımcı tipinin ekran etiketi vardır", () => {
    expect(KATILIMCI_TIPI_ETIKETLERI.OGRENCI).toBeTruthy();
    expect(KATILIMCI_TIPI_ETIKETLERI.OGRETMEN).toBeTruthy();
  });
});

describe("vekaleten başvuru", () => {
  it("öğrenci adına başvuru yapılabilir", () => {
    const karar = vekaletenBasvuruGecerliMi({
      hedefTipi: "OGRENCI",
      vekilKullaniciId: 200,
      hedefKullaniciId: 100,
    });
    expect(karar.olurMu).toBe(true);
  });

  /*
   * Analiz dokümanı vekaleti öğrenci adına başvuru olarak tanımlıyor; bir
   * öğretmenin başka bir öğretmen adına başvurması katılımın kişisel karar
   * olmasına aykırı olurdu.
   */
  it("öğretmen adına başvuru yapılamaz", () => {
    const karar = vekaletenBasvuruGecerliMi({
      hedefTipi: "OGRETMEN",
      vekilKullaniciId: 200,
      hedefKullaniciId: 201,
    });
    expect(karar.olurMu).toBe(false);
  });

  it("kişi kendi adına vekaleten başvuramaz", () => {
    const karar = vekaletenBasvuruGecerliMi({
      hedefTipi: "OGRENCI",
      vekilKullaniciId: 100,
      hedefKullaniciId: 100,
    });
    expect(karar.olurMu).toBe(false);
  });
});

describe("faaliyet süresi", () => {
  const mart1 = new Date("2026-03-01T10:00:00+03:00");

  it("bitiş yoksa geçerlidir ve 1 gündür", () => {
    expect(faaliyetSuresiGecerliMi(mart1, null).olurMu).toBe(true);
    expect(faaliyetSuresiGun(mart1, null)).toBe(1);
    expect(faaliyetSuresiYaz(mart1, null)).toBe("1 gün");
  });

  it("bitiş başlangıçtan önceyse reddeder", () => {
    const karar = faaliyetSuresiGecerliMi(
      mart1,
      new Date("2026-02-28T10:00:00+03:00"),
    );
    expect(karar.olurMu).toBe(false);
    expect(karar.neden).toBe("Etkinlik bitişi başlangıcından önce olamaz.");
  });

  it("aynı gün başlayıp biten faaliyet 1 gündür", () => {
    expect(faaliyetSuresiGun(mart1, new Date("2026-03-01T17:00:00+03:00"))).toBe(1);
  });

  it("ertesi güne sarkan faaliyet 2 gündür", () => {
    // 15 saatlik bir aralık ama iki ayrı gün; saat farkıyla bölmek "1 gün"
    // gösterirdi, kullanıcı "2 gün" bekler.
    expect(faaliyetSuresiGun(mart1, new Date("2026-03-02T01:00:00+03:00"))).toBe(2);
  });

  it("üç aylık faaliyeti gün olarak sayar", () => {
    expect(faaliyetSuresiGun(mart1, new Date("2026-05-31T10:00:00+03:00"))).toBe(92);
  });

  it("artık yılın şubatını doğru sayar", () => {
    // 2028 artık yıl: 28 Şubat + 29 Şubat = 2 gün.
    expect(
      faaliyetSuresiGun(
        new Date("2028-02-28T09:00:00+03:00"),
        new Date("2028-02-29T18:00:00+03:00"),
      ),
    ).toBe(2);
  });
});
