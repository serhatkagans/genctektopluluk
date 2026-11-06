import {
  baglantiIstegiGonderilebilirMi,
  dogrudanYazisilabilirMi,
  GIZLILIK_UYARISI,
  istekKarariniCoz,
  mesajMetniniCoz,
  mesajYazilabilirMi,
  PANO_KATEGORILERI,
  PANODAN_ACILABILIR_TURLER,
  SUZGEC_TURLERI,
  TALEP_AZAMI_GUN,
  TALEP_TURLERI,
  TALEP_TURU_ETIKETLERI,
  talebiCoz,
  talepAktifMi,
  talepTuruGecerliMi,
} from "@/lib/iletisim/kurallar";

/**
 * İletişim modülü kuralları.
 *
 * Modülün tek cümlelik ilkesi: gizli kanal yoktur. Kurallar bu ilkeyi
 * korumak ve kötüye kullanımı zorlaştırmak üzerine kurulu.
 */

const SIMDI = new Date("2026-07-31T12:00:00+03:00");
const gun = (n: number) => new Date(SIMDI.getTime() + n * 86_400_000);

describe("talepAktifMi", () => {
  /* Onaydan hiç geçmemiş ilan (öğrenci dışındakiler ve eski kayıtlar). */
  const acik = {
    kapatildiMi: false,
    sonGecerlilik: gun(5),
    onayDurumu: "ONAY_GEREKMEZ" as const,
    simdi: SIMDI,
  };

  it("kapatılmamış ve süresi dolmamış ilan aktiftir", () => {
    expect(talepAktifMi(acik)).toBe(true);
  });

  it("kapatılan ilan görünmez", () => {
    expect(talepAktifMi({ ...acik, kapatildiMi: true })).toBe(false);
  });

  it("süresi dolan ilan görünmez", () => {
    expect(talepAktifMi({ ...acik, sonGecerlilik: gun(-1) })).toBe(false);
  });

  /*
   * ONAY KAPISI (14 Ağustos 2026): öğrenci ilanı proje yöneticisi onaylayana
   * kadar panoda görünmez, üstüne cevap yazılamaz ve bağlantı isteği
   * gönderilemez — üçü de bu yardımcıdan geçiyor.
   */
  it("onay bekleyen ilan görünmez", () => {
    expect(talepAktifMi({ ...acik, onayDurumu: "BEKLIYOR" })).toBe(false);
  });

  it("reddedilen ilan görünmez", () => {
    expect(talepAktifMi({ ...acik, onayDurumu: "REDDEDILDI" })).toBe(false);
  });

  it("onaylanan ilan görünür", () => {
    expect(talepAktifMi({ ...acik, onayDurumu: "ONAYLANDI" })).toBe(true);
  });
});

describe("talebiCoz", () => {
  const gecerli = {
    baslik: "Devre şeması",
    icerik: "Robotik için",
    sonGecerlilik: gun(30),
    // 10 Ağustos 2026'dan sonra panodan yalnızca destek ve mentör talebi
    // açılabiliyor; geçerli örnek de o türlerden biri olmalı.
    tur: "TEKNIK_DESTEK",
  };

  it("geçerli ilanı kabul eder ve kırpar", () => {
    const sonuc = talebiCoz({ ...gecerli, baslik: "  A  " }, SIMDI);
    expect(sonuc.olurMu).toBe(true);
    if (sonuc.olurMu) expect(sonuc.baslik).toBe("A");
  });

  it("boş başlık ve metni reddeder", () => {
    expect(talebiCoz({ ...gecerli, baslik: "  " }, SIMDI).olurMu).toBe(false);
    expect(talebiCoz({ ...gecerli, icerik: "  " }, SIMDI).olurMu).toBe(false);
  });

  it("geçmiş tarihi reddeder", () => {
    const sonuc = talebiCoz({ ...gecerli, sonGecerlilik: gun(-1) }, SIMDI);
    expect(sonuc.olurMu).toBe(false);
    if (!sonuc.olurMu) expect(sonuc.neden).toContain("bugünden sonra");
  });

  it("çok uzak tarihi reddeder", () => {
    // Sınırsız ilan pano çürümesi demek: sahibi mezun olmuş bir ilan listede
    // durmaya devam ederdi.
    const sonuc = talebiCoz(
      { ...gecerli, sonGecerlilik: gun(TALEP_AZAMI_GUN + 1) },
      SIMDI,
    );
    expect(sonuc.olurMu).toBe(false);
    if (!sonuc.olurMu) expect(sonuc.neden).toContain(String(TALEP_AZAMI_GUN));
  });

  it("tarih seçilmediyse reddeder", () => {
    expect(talebiCoz({ ...gecerli, sonGecerlilik: null }, SIMDI).olurMu).toBe(false);
  });

  /*
   * Tür 6 Ağustos 2026'da eklendi ve YENİ ilanlarda zorunlu. Sütun NULL kabul
   * etmeye devam ediyor: eski ilanların türü bilinmiyor ve geriye dönük
   * doldurulmadı — türü bilinmeyen bir ilana "duyuru" demek, panoda o türle
   * filtreleyen kişiye yanlış liste gösterirdi.
   */
  it("tür seçilmediyse reddeder", () => {
    const sonuc = talebiCoz({ ...gecerli, tur: "" }, SIMDI);
    expect(sonuc.olurMu).toBe(false);
    if (!sonuc.olurMu) expect(sonuc.neden).toBe("Talep türü seçilmelidir.");
  });

  it("tanımsız türü reddeder", () => {
    // İstek elle kurcalanmadıkça gelmez; sessizce yutulursa ilan türsüz yazılır.
    const sonuc = talebiCoz({ ...gecerli, tur: "BAGIS" }, SIMDI);
    expect(sonuc.olurMu).toBe(false);
    if (!sonuc.olurMu) expect(sonuc.neden).toBe("Talep türü anlaşılamadı.");
  });

  it("geçerli türü olduğu gibi taşır", () => {
    const sonuc = talebiCoz({ ...gecerli, tur: "MENTORE_SOR" }, SIMDI);
    expect(sonuc.olurMu).toBe(true);
    if (sonuc.olurMu) expect(sonuc.tur).toBe("MENTORE_SOR");
  });

  /*
   * 10 AĞUSTOS 2026 · istek: panoda "alt alta iki alan olacak … biri destek
   * talebi aç diğeri mentör talebi aç". Tür seçimi ekrandan kalktı; gizli form
   * alanı kurcalanarak eski türlerin geri gelmemesi bu kapıya bağlı.
   */
  /*
   * 14 AĞUSTOS 2026 · istek: "talep oluştururken kategori olsun … teknik destek
   * talebi, duyuru / tanıtım desteği, ekip arkadaşı arama ve genel". Duyuru ve
   * ekip arkadaşı yeniden açılabilir oldu; kapatılan tek tür SPONSOR.
   */
  it("panodan açılamayan türü reddeder", () => {
    const sonuc = talebiCoz({ ...gecerli, tur: "SPONSOR" }, SIMDI);
    expect(sonuc.olurMu).toBe(false);
    if (!sonuc.olurMu) expect(sonuc.neden).toContain("kategoride ilan açılamaz");
  });

  it("düzenlemede ilanın kendi türü izinli sayılabilir", () => {
    // Artık açılamayan türdeki eski bir ilan düzenlenebilmeli; yoksa tek bir
    // yazım hatasını düzeltmek türü değiştirmeye zorlardı.
    const sonuc = talebiCoz({ ...gecerli, tur: "SPONSOR" }, SIMDI, [
      ...PANODAN_ACILABILIR_TURLER,
      "SPONSOR",
    ]);
    expect(sonuc.olurMu).toBe(true);
  });

  it("panodan açılabilen türler istekteki kategoriler ve mentör talebidir", () => {
    expect([...PANODAN_ACILABILIR_TURLER].sort()).toEqual([
      "DUYURU",
      "EKIP_ARKADASI",
      "GENEL",
      "MENTORE_SOR",
      "TEKNIK_DESTEK",
    ]);
  });

  it("altı türü kapsar", () => {
    /*
     * MENTORE_SOR 7 Ağustos 2026'da eklendi. TEKNIK_DESTEK'ten ayrı: o bir
     * SORUNU çözdürmek için açılır, bu bir YOL sorar.
     *
     * GENEL 14 Ağustos 2026'da eklendi: istek "duyuru / tanıtım desteği" ile
     * "genel"i aynı listede sayıyor, yani ikisi ayrı kategori.
     *
     * SPONSOR istekteki listede yok ama KAPATILMADI: açılmış ilanları
     * türsüz bırakmamak için listede duruyor.
     */
    expect([...TALEP_TURLERI].sort()).toEqual([
      "DUYURU",
      "EKIP_ARKADASI",
      "GENEL",
      "MENTORE_SOR",
      "SPONSOR",
      "TEKNIK_DESTEK",
    ]);
  });

  /*
   * ETİKETLER 11 AĞUSTOS 2026'DA GÜNCELLENDİ (istek: "destek talebi - teknik
   * destek talebi olsun … duyuru tanıtım desteği açılsın"). Enum değişmedi,
   * yalnızca ekranda yazan adlar değişti — testin sınadığı da bu.
   */
  it("istekteki dört başlığın hepsinin bir türü vardır", () => {
    expect(TALEP_TURU_ETIKETLERI.TEKNIK_DESTEK).toBe("Teknik destek talebi");
    expect(TALEP_TURU_ETIKETLERI.MENTORE_SOR).toBe("Mentöre sor");
    expect(TALEP_TURU_ETIKETLERI.DUYURU).toBe("Duyuru / tanıtım desteği");
    expect(TALEP_TURU_ETIKETLERI.EKIP_ARKADASI).toBe("Ekip arkadaşı arama");
  });

  /*
   * Süzgeç listesi enum'un TAMAMI DEĞİLDİR: sponsor ve mentöre sor süzgeçten
   * çıkarıldı ama ilanları panoda listelenmeye ve rozetleri basılmaya devam
   * ediyor. İkisini karıştırmak, açılmış ilanları görünmez yapardı.
   */
  it("süzgeçte sponsor ve mentöre sor yoktur, ilanları durmaya devam eder", () => {
    expect(SUZGEC_TURLERI).not.toContain("SPONSOR");
    expect(SUZGEC_TURLERI).not.toContain("MENTORE_SOR");
    /* 14 Ağustos 2026'da istekteki dörtlüye oturdu; kategori seçim listesiyle
       aynı küme (bkz. PANO_KATEGORILERI). */
    expect(SUZGEC_TURLERI).toEqual([
      "TEKNIK_DESTEK",
      "DUYURU",
      "EKIP_ARKADASI",
      "GENEL",
    ]);
    expect(SUZGEC_TURLERI).toEqual(PANO_KATEGORILERI);
    expect(TALEP_TURLERI).toContain("MENTORE_SOR");
    expect(talepTuruGecerliMi("MENTORE_SOR")).toBe(true);
  });

  it("her türün ekran etiketi vardır", () => {
    for (const tur of TALEP_TURLERI) {
      expect(TALEP_TURU_ETIKETLERI[tur]?.trim()).toBeTruthy();
    }
  });
});

describe("baglantiIstegiGonderilebilirMi", () => {
  const temel = {
    isteyenId: 1,
    hedefId: 2,
    bekleyenIstekVarMi: false,
    onayliBaglantiVarMi: false,
  };

  it("olağan durumda gönderilebilir", () => {
    expect(baglantiIstegiGonderilebilirMi(temel).olurMu).toBe(true);
  });

  it("kendine istek gönderilemez", () => {
    expect(
      baglantiIstegiGonderilebilirMi({ ...temel, hedefId: 1 }).olurMu,
    ).toBe(false);
  });

  it("bekleyen istek varken ikincisi gönderilemez", () => {
    /*
     * Reddedilen bir isteği tekrar tekrar göndermek taciz aracına dönüşürdü;
     * bekleyen istek kilidi bunun ilk basamağı.
     */
    const sonuc = baglantiIstegiGonderilebilirMi({
      ...temel,
      bekleyenIstekVarMi: true,
    });
    expect(sonuc.olurMu).toBe(false);
    if (!sonuc.olurMu) expect(sonuc.neden).toContain("onay bekliyor");
  });

  it("zaten yazışma varsa yeni istek gönderilemez", () => {
    expect(
      baglantiIstegiGonderilebilirMi({ ...temel, onayliBaglantiVarMi: true })
        .olurMu,
    ).toBe(false);
  });
});

describe("istekKarariniCoz", () => {
  it("onayda gerekçe zorunlu değildir", () => {
    expect(istekKarariniCoz({ onaylandiMi: true, gerekce: "" })).toEqual({
      olurMu: true,
      durum: "ONAYLANDI",
      gerekce: null,
    });
  });

  it("REDDE gerekçe zorunludur", () => {
    const sonuc = istekKarariniCoz({ onaylandiMi: false, gerekce: "  " });
    expect(sonuc.olurMu).toBe(false);
    if (!sonuc.olurMu) expect(sonuc.neden).toContain("zorunludur");
  });

  it("gerekçeli ret kabul edilir", () => {
    expect(
      istekKarariniCoz({ onaylandiMi: false, gerekce: "Uygun görülmedi." }),
    ).toEqual({ olurMu: true, durum: "REDDEDILDI", gerekce: "Uygun görülmedi." });
  });
});

describe("mesajYazilabilirMi", () => {
  it("onaylı ve açık yazışmaya yazılabilir", () => {
    expect(
      mesajYazilabilirMi({ onayDurumu: "ONAYLANDI", yazismaKapatildiMi: false })
        .olurMu,
    ).toBe(true);
  });

  /*
   * DOĞRUDAN YAZIŞMA (26 Ağustos 2026 · hata kimliği 2929174704): okul içi ve
   * okul temsilcisi yazışması onaydan geçmez, kaydı `ONAY_GEREKMEZ` açılır.
   * Kural yalnızca `ONAYLANDI` kabul etseydi, açılan yazışmaya hiç mesaj
   * yazılamazdı.
   */
  it("onay gerektirmeyen yazışmaya yazılabilir", () => {
    expect(
      mesajYazilabilirMi({
        onayDurumu: "ONAY_GEREKMEZ",
        yazismaKapatildiMi: false,
      }).olurMu,
    ).toBe(true);
  });

  it("onay gerektirmeyen yazışma kapatılmışsa yazılamaz", () => {
    expect(
      mesajYazilabilirMi({
        onayDurumu: "ONAY_GEREKMEZ",
        yazismaKapatildiMi: true,
      }).olurMu,
    ).toBe(false);
  });

  it("onay beklerken yazılamaz", () => {
    expect(
      mesajYazilabilirMi({ onayDurumu: "BEKLIYOR", yazismaKapatildiMi: false })
        .olurMu,
    ).toBe(false);
  });

  it("reddedilmiş bağlantıya yazılamaz", () => {
    expect(
      mesajYazilabilirMi({ onayDurumu: "REDDEDILDI", yazismaKapatildiMi: false })
        .olurMu,
    ).toBe(false);
  });

  it("kapatılmış yazışmaya yazılamaz", () => {
    const sonuc = mesajYazilabilirMi({
      onayDurumu: "ONAYLANDI",
      yazismaKapatildiMi: true,
    });
    expect(sonuc.olurMu).toBe(false);
    if (!sonuc.olurMu) expect(sonuc.neden).toContain("kapatıldı");
  });
});

describe("mesajMetniniCoz", () => {
  it("boş mesajı reddeder", () => {
    expect(mesajMetniniCoz("   ").olurMu).toBe(false);
  });

  it("çok uzun mesajı reddeder", () => {
    expect(mesajMetniniCoz("a".repeat(2001)).olurMu).toBe(false);
  });

  it("geçerli mesajı kırpar", () => {
    const sonuc = mesajMetniniCoz("  merhaba  ");
    expect(sonuc.olurMu).toBe(true);
    if (sonuc.olurMu) expect(sonuc.icerik).toBe("merhaba");
  });
});

describe("gizlilik uyarısı", () => {
  it("mahremiyet vaadi vermez, okuyanları sayar", () => {
    // Ekranlarda tek bir sabit kullanılıyor; farklı yerlerde farklı ifadeler
    // zamanla yumuşar ve "aslında kimse okumuyor" izlenimi doğardı.
    expect(GIZLILIK_UYARISI).toContain("gizli değildir");
    expect(GIZLILIK_UYARISI).toContain("danışman");
    expect(GIZLILIK_UYARISI).toContain("koordinatör");
  });
});

/**
 * DOĞRUDAN YAZIŞMA — onay kapısının iki istisnası (21 Ağustos 2026 · istek:
 * "kendi okulundaki herkesi görecek mesaj atacak, okul temsilcilerinin hepsini
 * görecek mesaj atabilecek").
 *
 * Sınanan şey ekran değil KARARDIR: kimin kimle onay beklemeden yazışabildiği.
 */
describe("doğrudan yazışma", () => {
  const girdi = (ozellikler: Record<string, unknown> = {}) => ({
    isteyenId: 1,
    hedefId: 2,
    isteyenKurumKodu: 100 as number | null,
    hedefKurumKodu: 100 as number | null,
    hedefOkulTemsilcisiMi: false,
    isteyenDisKullaniciMi: false,
    ...ozellikler,
  });

  it("dış kullanıcı okul temsilcisine onaysız yazışma açamaz", () => {
    /*
     * 6 Kasım 2026 · güvenlik incelemesi: kısayol açıkken bir mezun ya da
     * paydaş 81 ildeki bütün okul temsilcisi öğrencilerle onaysız yazışma
     * açabiliyordu.
     */
    const karar = dogrudanYazisilabilirMi(
      girdi({
        isteyenKurumKodu: null,
        hedefKurumKodu: 200,
        hedefOkulTemsilcisiMi: true,
        isteyenDisKullaniciMi: true,
      }),
    );
    expect(karar.olurMu).toBe(false);
  });

  it("dış kullanıcı aynı ekipteki kişiyle yine yazışır", () => {
    expect(
      dogrudanYazisilabilirMi(
        girdi({
          isteyenKurumKodu: null,
          hedefKurumKodu: 200,
          hedefOkulTemsilcisiMi: true,
          isteyenDisKullaniciMi: true,
          ayniEkiptenMi: true,
        }),
      ).olurMu,
    ).toBe(true);
  });

  it("aynı okuldakiyle onay beklemeden yazışılır", () => {
    expect(dogrudanYazisilabilirMi(girdi()).olurMu).toBe(true);
  });

  it("başka okuldan biriyle yazışılamaz", () => {
    const karar = dogrudanYazisilabilirMi(girdi({ hedefKurumKodu: 200 }));
    expect(karar.olurMu).toBe(false);
    expect(karar.neden).toContain("bağlantı isteği");
  });

  it("okul temsilcisiyle okul farkı gözetilmeden yazışılır", () => {
    expect(
      dogrudanYazisilabilirMi(
        girdi({ hedefKurumKodu: 200, hedefOkulTemsilcisiMi: true }),
      ).olurMu,
    ).toBe(true);
  });

  it("aynı ekipteki kişiyle okul farkı gözetilmeden yazışılır", () => {
    /*
     * 31 Ağustos 2026 · istek: "bireysel ve toplu mesaj atabilsin ekiptekilere".
     * Ekip zaten onaysız bir kanaldır (ekip sohbeti); toplu kanalı açık olan
     * iki kişiye birebir yazışmayı yasaklamak tutarsız olurdu.
     */
    expect(
      dogrudanYazisilabilirMi(
        girdi({ hedefKurumKodu: 200, ayniEkiptenMi: true }),
      ).olurMu,
    ).toBe(true);
  });

  it("ekip bağı bildirilmezse kapı kapalı kalır", () => {
    /*
     * Alan isteğe bağlı ve varsayılanı `false`: bilgiyi vermeyen çağıran dar
     * tarafta kalıyor, geniş tarafta değil.
     */
    expect(
      dogrudanYazisilabilirMi(girdi({ hedefKurumKodu: 200 })).olurMu,
    ).toBe(false);
    expect(
      dogrudanYazisilabilirMi(
        girdi({ hedefKurumKodu: 200, ayniEkiptenMi: false }),
      ).olurMu,
    ).toBe(false);
  });

  it("kendine ekip üzerinden de mesaj gönderilemez", () => {
    expect(
      dogrudanYazisilabilirMi(girdi({ hedefId: 1, ayniEkiptenMi: true })).olurMu,
    ).toBe(false);
  });

  it("okulsuz iki kişi aynı okuldan sayılmaz", () => {
    /*
     * Mezun ve paydaşın kurum kodu YOKTUR. `null === null` ile karar
     * verilseydi bütün okulsuz kullanıcılar birbirinin okul arkadaşı olurdu.
     */
    const karar = dogrudanYazisilabilirMi(
      girdi({ isteyenKurumKodu: null, hedefKurumKodu: null }),
    );
    expect(karar.olurMu).toBe(false);
  });

  it("kişi kendine mesaj gönderemez", () => {
    const karar = dogrudanYazisilabilirMi(girdi({ hedefId: 1 }));
    expect(karar.olurMu).toBe(false);
  });
});
