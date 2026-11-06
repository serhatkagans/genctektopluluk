import {
  gizliIcerikImhaAni,
  imhaAdayiMi,
  imhaAuthProviderId,
  imhaEdilmisKimlik,
  IMHA_EDILMIS_ICERIK,
} from "@/lib/kvkk/imha-kurallari";

const kullaniciBul = jest.fn();
const kullaniciGuncelle = jest.fn();
const kullaniciListele = jest.fn();
const ekListele = jest.fn();
const ekGuncelle = jest.fn();
const dosyaSil = jest.fn();
const kazanimEkSil = jest.fn();
const topluGuncelle = jest.fn();

/*
 * Sayaç döndüren her updateMany aynı sahteye bağlanıyor: testler "hangi tablo"
 * değil "hangi süzgeçle ve ne zaman" sorusunu sınıyor. Çağrı sırası ve where
 * gövdesi `topluGuncelle.mock.calls` üzerinden okunuyor.
 */
const sayacDonduren = { updateMany: topluGuncelle };

jest.mock("@/lib/db", () => ({
  prisma: {
    kullanici: {
      findUnique: (...girdiler: unknown[]) => kullaniciBul(...girdiler),
      findMany: (...girdiler: unknown[]) => kullaniciListele(...girdiler),
      update: (...girdiler: unknown[]) => kullaniciGuncelle(...girdiler),
    },
    mesaj: sayacDonduren,
    gonderi: sayacDonduren,
    gonderiYorumu: sayacDonduren,
    ekipMesaji: sayacDonduren,
    talepCevabi: sayacDonduren,
    yorum: sayacDonduren,
    talep: sayacDonduren,
    basvuru: sayacDonduren,
    ogrenciProfil: sayacDonduren,
    ogretmenProfil: sayacDonduren,
    faaliyetEk: {
      findMany: (...girdiler: unknown[]) => ekListele(...girdiler),
      update: (...girdiler: unknown[]) => ekGuncelle(...girdiler),
    },
    kazanimEk: {
      deleteMany: (...girdiler: unknown[]) => kazanimEkSil(...girdiler),
    },
    $transaction: async (isle: (islem: unknown) => Promise<unknown>) =>
      isle({
        kullanici: { update: (...g: unknown[]) => kullaniciGuncelle(...g) },
        mesaj: sayacDonduren,
        gonderi: sayacDonduren,
        gonderiYorumu: sayacDonduren,
        ekipMesaji: sayacDonduren,
        talepCevabi: sayacDonduren,
        yorum: sayacDonduren,
        talep: sayacDonduren,
        basvuru: sayacDonduren,
        ogrenciProfil: sayacDonduren,
        ogretmenProfil: sayacDonduren,
      }),
  },
}));

jest.mock("@/lib/depolama", () => ({
  depolama: () => ({ sil: (...girdiler: unknown[]) => dosyaSil(...girdiler) }),
}));

import {
  gizliIcerikleriImhaEt,
  hareketsizKullanicilariImhaEt,
  kullaniciyiImhaEt,
} from "@/lib/kvkk/imha";

const SIMDI = new Date("2026-09-02T12:00:00.000Z");
const SINIR = new Date("2026-03-02T12:00:00.000Z");

beforeEach(() => {
  jest.clearAllMocks();
  topluGuncelle.mockResolvedValue({ count: 1 });
  ekListele.mockResolvedValue([]);
  dosyaSil.mockResolvedValue(undefined);
});

describe("imha kuralları", () => {
  it("süresi dolmuş ve henüz imha edilmemiş kaydı aday sayar", () => {
    expect(
      imhaAdayiMi(
        {
          sonSenkronTarihi: new Date("2026-01-01T00:00:00.000Z"),
          anonimlestirmeTarihi: null,
        },
        SINIR,
      ),
    ).toBe(true);
  });

  it("bir kez imha edilen kaydı bir daha aday saymaz", () => {
    expect(
      imhaAdayiMi(
        {
          sonSenkronTarihi: new Date("2020-01-01T00:00:00.000Z"),
          anonimlestirmeTarihi: new Date("2026-01-01T00:00:00.000Z"),
        },
        SINIR,
      ),
    ).toBe(false);
  });

  it("sistemle teması süren kişiye dokunmaz", () => {
    expect(
      imhaAdayiMi(
        {
          sonSenkronTarihi: new Date("2026-08-30T00:00:00.000Z"),
          anonimlestirmeTarihi: null,
        },
        SINIR,
      ),
    ).toBe(false);
  });

  it("gizlenme tarihi bilinmeyen içerikte oluşturma tarihine düşer", () => {
    const olusturma = new Date("2024-05-05T00:00:00.000Z");
    expect(
      gizliIcerikImhaAni({ gizlenmeTarihi: null, olusturmaTarihi: olusturma }),
    ).toBe(olusturma);
  });

  it("EBA kimliğini kayda özel bir değerle değiştirir", () => {
    // Sabit bir değer olsaydı ikinci imha unique kısıtına takılırdı.
    expect(imhaAuthProviderId(41)).not.toBe(imhaAuthProviderId(42));
    expect(imhaEdilmisKimlik(42).authProviderId).toBe("imha-42");
  });

  it("kimlikten iz bırakmaz ama kaydı okunur tutar", () => {
    const kimlik = imhaEdilmisKimlik(7);
    expect(kimlik.fotoDepolamaYolu).toBeNull();
    expect(kimlik.sinif).toBeNull();
    expect(kimlik.hakkinda).toBeNull();
    expect(kimlik.aktif).toBe(false);
    expect(kimlik.ad).not.toBe("");
  });
});

describe("kullanıcı imhası", () => {
  function kullaniciyiKur(uzerine: Record<string, unknown> = {}) {
    kullaniciBul.mockResolvedValue({
      id: 42,
      anonimlestirmeTarihi: null,
      fotoDepolamaYolu: "foto/42.jpg",
      ogrenciProfil: { cvDepolamaYolu: "cv/42.pdf" },
      ogretmenProfil: null,
      kazanimlar: [],
      ...uzerine,
    });
  }

  it("fotoğrafı ve özgeçmişi depolamadan siler", async () => {
    kullaniciyiKur();

    const sonuc = await kullaniciyiImhaEt(42, SIMDI);

    expect(sonuc.yapildiMi).toBe(true);
    expect(dosyaSil).toHaveBeenCalledWith("foto/42.jpg");
    expect(dosyaSil).toHaveBeenCalledWith("cv/42.pdf");
  });

  it("kazanım eklerinin dosyalarını ve satırlarını da siler", async () => {
    // 6 Kasım 2026 · güvenlik incelemesi: imha yalnızca foto ve CV'yi kaldırıyordu.
    kullaniciyiKur({
      kazanimlar: [
        { ekler: [{ id: 7, depolamaYolu: "2026/10/a.pdf" }] },
        { ekler: [{ id: 8, depolamaYolu: "2026/10/b.jpg" }] },
      ],
    });

    await kullaniciyiImhaEt(42, SIMDI);

    expect(dosyaSil).toHaveBeenCalledWith("2026/10/a.pdf");
    expect(dosyaSil).toHaveBeenCalledWith("2026/10/b.jpg");
    expect(kazanimEkSil).toHaveBeenCalledWith({ where: { id: { in: [7, 8] } } });
  });

  it("dosya silinemese de kayıt imhasını tamamlar ve hatayı sayar", async () => {
    kullaniciyiKur();
    dosyaSil.mockRejectedValueOnce(new Error("depolama erişilemedi"));

    const sonuc = await kullaniciyiImhaEt(42, SIMDI);

    expect(sonuc.yapildiMi).toBe(true);
    expect(sonuc.silinemeyenDosya).toBe(1);
    expect(kullaniciGuncelle).toHaveBeenCalled();
  });

  it("kimlik alanlarını temizler ve imha anını damgalar", async () => {
    kullaniciyiKur();

    await kullaniciyiImhaEt(42, SIMDI);

    const veri = kullaniciGuncelle.mock.calls[0][0].data;
    expect(veri.authProviderId).toBe("imha-42");
    expect(veri.anonimlestirmeTarihi).toBe(SIMDI);
    expect(veri.fotoDepolamaYolu).toBeNull();
  });

  it("kişinin yazdıklarını boşaltır ve gizler", async () => {
    kullaniciyiKur();

    await kullaniciyiImhaEt(42, SIMDI);

    const mesajYazma = topluGuncelle.mock.calls.find(
      ([girdi]) => girdi.where?.yazanKullaniciId === 42 && girdi.data?.gizlendiMi,
    );
    expect(mesajYazma).toBeDefined();
    expect(mesajYazma?.[0].data.icerik).toBe(IMHA_EDILMIS_ICERIK);
  });

  it("başvuru satırını korur, gerekçesini imha eder", async () => {
    kullaniciyiKur();

    await kullaniciyiImhaEt(42, SIMDI);

    const basvuru = topluGuncelle.mock.calls.find(
      ([girdi]) => girdi.where?.katilimciId === 42,
    );
    expect(basvuru?.[0].data).toEqual({ gerekce: IMHA_EDILMIS_ICERIK });
  });

  it("zaten imha edilmiş kaydı ikinci kez işlemez", async () => {
    kullaniciyiKur({ anonimlestirmeTarihi: new Date("2026-01-01T00:00:00Z") });

    const sonuc = await kullaniciyiImhaEt(42, SIMDI);

    expect(sonuc.yapildiMi).toBe(false);
    expect(kullaniciGuncelle).not.toHaveBeenCalled();
    expect(dosyaSil).not.toHaveBeenCalled();
  });

  it("olmayan kullanıcıda sessizce durur", async () => {
    kullaniciBul.mockResolvedValue(null);

    const sonuc = await kullaniciyiImhaEt(99, SIMDI);

    expect(sonuc.yapildiMi).toBe(false);
    expect(kullaniciGuncelle).not.toHaveBeenCalled();
  });
});

describe("gizlenmiş içerik imhası", () => {
  it("gizlenme tarihi boş satırları oluşturma tarihine göre de tarar", async () => {
    await gizliIcerikleriImhaEt(SINIR);

    const [girdi] = topluGuncelle.mock.calls[0];
    expect(girdi.where.gizlendiMi).toBe(true);
    expect(girdi.where.OR).toEqual([
      { gizlenmeTarihi: { lt: SINIR } },
      { gizlenmeTarihi: null, olusturmaTarihi: { lt: SINIR } },
    ]);
  });

  it("zaten boşaltılmış satırı yeniden saymaz", async () => {
    await gizliIcerikleriImhaEt(SINIR);

    const [girdi] = topluGuncelle.mock.calls[0];
    expect(girdi.where.icerik).toEqual({ not: IMHA_EDILMIS_ICERIK });
  });

  it("faaliyet ekinin dosyasını siler ve yolunu boşaltır", async () => {
    ekListele.mockResolvedValue([{ id: 5, depolamaYolu: "ek/5.pdf" }]);

    const sonuc = await gizliIcerikleriImhaEt(SINIR);

    expect(dosyaSil).toHaveBeenCalledWith("ek/5.pdf");
    expect(ekGuncelle).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { depolamaYolu: "", dosyaAdi: "" },
    });
    expect(sonuc.faaliyetEki).toBe(1);
  });
});

describe("hareketsiz kullanıcı taraması", () => {
  it("aday bulunmazsa hiçbir şey yapmaz", async () => {
    kullaniciListele.mockResolvedValue([]);

    const sonuc = await hareketsizKullanicilariImhaEt(SINIR, SIMDI);

    expect(sonuc.imhaEdilenKullanici).toBe(0);
    expect(kullaniciGuncelle).not.toHaveBeenCalled();
  });

  it("her adayı tek tek imha eder ve sayar", async () => {
    kullaniciListele.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    kullaniciBul.mockImplementation(async ({ where }: { where: { id: number } }) => ({
      id: where.id,
      anonimlestirmeTarihi: null,
      fotoDepolamaYolu: null,
      ogrenciProfil: null,
      ogretmenProfil: null,
      kazanimlar: [],
    }));

    const sonuc = await hareketsizKullanicilariImhaEt(SINIR, SIMDI);

    expect(sonuc.imhaEdilenKullanici).toBe(2);
    expect(kullaniciGuncelle).toHaveBeenCalledTimes(2);
  });
});
