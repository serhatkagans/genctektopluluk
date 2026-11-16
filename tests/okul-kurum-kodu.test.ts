/**
 * KOORDİNATÖRÜN KURUM KODUNU DÜZELTMESİ (16 Kasım 2026 · istek: "koordinatör
 * kurum kodlarını doğrusu ile değiştirebilsin").
 *
 * Kişiler ve bağlı kayıtlar yeni koda veritabanının ON UPDATE CASCADE
 * kuralıyla geçer; burada sınanan, işlevin YALNIZCA kurum satırının kodunu
 * değiştirdiği ve çakışan kodda hiçbir şeye dokunmadığı.
 */

const kurumBul = jest.fn();
const kurumGuncelle = jest.fn();
const logla = jest.fn();

jest.mock("@/lib/db", () => ({
  prisma: {
    kurum: {
      findUnique: (...a: unknown[]) => kurumBul(...a),
      update: (...a: unknown[]) => kurumGuncelle(...a),
    },
  },
}));
jest.mock("@/lib/yetki/log", () => ({ erisimLogla: (...a: unknown[]) => logla(...a) }));

const { okulKurumKodunuDegistir } = require("@/lib/okul/eslestirme-islem") as typeof import("@/lib/okul/eslestirme-islem");

const ESKI = 900000603;

function kurumlar(tablo: Record<number, { ad: string; aktif: boolean } | null>) {
  kurumBul.mockImplementation(async ({ where }: { where: { kurumKodu: number } }) =>
    tablo[where.kurumKodu] ?? null,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  kurumGuncelle.mockResolvedValue({});
});

describe("okulun kurum kodunu değiştirme", () => {
  it("geçerli ve boş kodda yalnızca kurum satırının kodu değişir ve kayda geçer", async () => {
    kurumlar({ [ESKI]: { ad: "Siirt Türk Telekom Fen Lisesi", aktif: true } });
    const sonuc = await okulKurumKodunuDegistir(ESKI, "774994", 1);
    expect(sonuc).toEqual({ olurMu: true, deger: { kurumKodu: 774994 } });
    expect(kurumGuncelle).toHaveBeenCalledWith({
      where: { kurumKodu: ESKI },
      data: { kurumKodu: 774994 },
    });
    expect(logla).toHaveBeenCalledWith(
      expect.objectContaining({ detay: expect.stringContaining(`${ESKI} → 774994`) }),
    );
  });

  it("geçersiz kod (harf, kısa, geçici aralık) hiçbir şeye dokunmaz", async () => {
    kurumlar({ [ESKI]: { ad: "X", aktif: true } });
    for (const deger of ["abc", "12", "900000999"]) {
      expect((await okulKurumKodunuDegistir(ESKI, deger, 1)).olurMu).toBe(false);
    }
    expect(kurumGuncelle).not.toHaveBeenCalled();
  });

  it("kod başka bir okulda kayıtlıysa değiştirilmez ve 'Birleştir' önerilir", async () => {
    kurumlar({
      [ESKI]: { ad: "Siirt Lisesi", aktif: true },
      774994: { ad: "Gazi Anadolu Lisesi", aktif: true },
    });
    const sonuc = await okulKurumKodunuDegistir(ESKI, "774994", 1);
    expect(sonuc.olurMu).toBe(false);
    expect(sonuc).toMatchObject({ neden: expect.stringContaining("Gazi Anadolu Lisesi") });
    expect(sonuc).toMatchObject({ neden: expect.stringContaining("Birleştir") });
    expect(kurumGuncelle).not.toHaveBeenCalled();
  });

  it("kod pasif bir okulda kayıtlıysa da değiştirilmez", async () => {
    kurumlar({
      [ESKI]: { ad: "Siirt Lisesi", aktif: true },
      774994: { ad: "Eski Kayıt", aktif: false },
    });
    expect((await okulKurumKodunuDegistir(ESKI, "774994", 1)).olurMu).toBe(false);
    expect(kurumGuncelle).not.toHaveBeenCalled();
  });

  it("pasif ya da olmayan okulun kodu değiştirilmez", async () => {
    kurumlar({ [ESKI]: { ad: "X", aktif: false } });
    expect((await okulKurumKodunuDegistir(ESKI, "774994", 1)).olurMu).toBe(false);
    kurumlar({});
    expect((await okulKurumKodunuDegistir(ESKI, "774994", 1)).olurMu).toBe(false);
    expect(kurumGuncelle).not.toHaveBeenCalled();
  });

  it("aynı kod yazılırsa hiçbir şey yapılmaz", async () => {
    kurumlar({ 774994: { ad: "X", aktif: true } });
    expect(await okulKurumKodunuDegistir(774994, "774994", 1)).toEqual({
      olurMu: true,
      deger: { kurumKodu: 774994 },
    });
    expect(kurumGuncelle).not.toHaveBeenCalled();
  });

  it("aynı anda iki istek aynı kodu yazarsa ikincisi anlaşılır bir hatayla döner", async () => {
    kurumlar({ [ESKI]: { ad: "X", aktif: true } });
    kurumGuncelle.mockRejectedValue(Object.assign(new Error("unique"), { code: "P2002" }));
    const sonuc = await okulKurumKodunuDegistir(ESKI, "774994", 1);
    expect(sonuc).toMatchObject({ olurMu: false, neden: expect.stringContaining("az önce") });
  });
});
