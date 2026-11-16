import type { KayitKaydi } from "@/lib/kayit/kurallar";

/**
 * KAYITTA ÇİFT HESAP ENGELİ (16 Kasım 2026).
 *
 * Eskişehir'de bir öğrenci T.C. numarasını ilk kayıtta yanlış yazıp bir
 * dakika sonra başka bir numarayla yeniden kayıt olmuştu: tekillik yalnızca
 * T.C.'den sorulduğu için iki hesap açıldı. Artık aynı ad soyad + aynı
 * e-postayla ikinci kayıt reddediliyor; T.C. kontrolü de yerinde.
 */

const kullaniciBul = jest.fn();
const kullaniciListele = jest.fn();
const kullaniciSagla = jest.fn();
const islem = jest.fn();

jest.mock("@/lib/db", () => ({
  prisma: {
    kullanici: {
      findUnique: (...a: unknown[]) => kullaniciBul(...a),
      findMany: (...a: unknown[]) => kullaniciListele(...a),
      update: jest.fn(),
    },
    ilce: { findUnique: jest.fn(async () => ({ ilKodu: "26" })) },
    kurum: {
      findUnique: jest.fn(async () => ({
        ilKodu: "26",
        ilceKodu: "2601",
        aktif: true,
        okulTuru: "Anadolu Lisesi",
      })),
    },
    kayitKimlik: { create: jest.fn() },
    ogrenciProfil: { update: jest.fn() },
    ogretmenProfil: { update: jest.fn() },
    $transaction: (...a: unknown[]) => islem(...a),
  },
}));
jest.mock("@/lib/dis-kimlik/sifre", () => ({ sifreOzetle: jest.fn(async () => "ozet") }));
jest.mock("@/lib/kullanici/sagla", () => ({
  kullaniciSagla: (...a: unknown[]) => kullaniciSagla(...a),
}));
jest.mock("@/lib/yetki/log", () => ({ erisimLogla: jest.fn() }));

// Taklitler kurulduktan sonra yüklenir.
const { kayitOl } = require("@/lib/kayit/kayit") as typeof import("@/lib/kayit/kayit");

function kayit(ozellik: Partial<KayitKaydi> = {}): KayitKaydi {
  return {
    tip: "OGRENCI",
    tcKimlikNo: "10000000146",
    ad: "Betül",
    soyad: "Aslan",
    cinsiyet: "K",
    ilKodu: "26",
    ilceKodu: "2601",
    kurumKodu: 900000001,
    beyanOkulAdi: null,
    okulTuru: "Anadolu Lisesi",
    eposta: "betul@example.com",
    telefon: "5550000000",
    sinif: "10-A",
    brans: null,
    egitimOgretimYili: "2026-2027",
    sifre: "GucluBirSifre1",
    ...ozellik,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  kullaniciBul.mockResolvedValue(null);
  kullaniciListele.mockResolvedValue([]);
  kullaniciSagla.mockResolvedValue({ kullaniciId: 42 });
  islem.mockResolvedValue([]);
});

describe("kayıtta çift hesap engeli", () => {
  it("aynı T.C. ile ikinci kayıt reddedilir (eski kural yerinde)", async () => {
    kullaniciBul.mockResolvedValue({ id: 7 });
    const sonuc = await kayitOl(kayit());
    expect(sonuc).toEqual({
      durum: "BASARISIZ",
      mesaj: expect.stringContaining("Bu T.C. kimlik numarasıyla"),
    });
    expect(kullaniciSagla).not.toHaveBeenCalled();
  });

  it("farklı T.C. ama aynı ad soyad + e-posta reddedilir ve 'Şifremi unuttum'a yönlendirir", async () => {
    kullaniciListele.mockResolvedValue([{ id: 1805 }]);
    const sonuc = await kayitOl(kayit({ tcKimlikNo: "10000000078" }));
    expect(sonuc.durum).toBe("BASARISIZ");
    expect(sonuc).toMatchObject({ mesaj: expect.stringContaining("Şifremi unuttum") });
    expect(kullaniciSagla).not.toHaveBeenCalled();
  });

  it("sorgu ad, soyad ve e-postayı büyük-küçük harf duyarsız ve yalnızca aktif hesaplarda arar", async () => {
    await kayitOl(kayit());
    const sorgu = kullaniciListele.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(sorgu.where).toMatchObject({
      aktif: true,
      ad: { equals: "Betül", mode: "insensitive" },
      soyad: { equals: "Aslan", mode: "insensitive" },
    });
    const metin = JSON.stringify(sorgu.where);
    expect(metin).toContain("ogrenciProfil");
    expect(metin).toContain("ogretmenProfil");
    expect(metin).toContain("betul@example.com");
  });

  it("eşleşme yoksa (ör. aynı e-postayı paylaşan, adı farklı kardeş) kayıt açılır", async () => {
    const sonuc = await kayitOl(kayit({ ad: "Elif" }));
    expect(sonuc).toEqual({ durum: "BASARILI", kullaniciId: 42 });
    expect(kullaniciSagla).toHaveBeenCalledTimes(1);
  });
});
