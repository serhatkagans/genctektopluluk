import { danismanlikAlabilirMi } from "@/lib/ogretmen/danismanlik-kurallar";

/**
 * Danışman öğretmen görevini kim alabilir — 6 Kasım 2026 güvenlik incelemesi.
 *
 * Eylem yalnızca oturum istiyordu; öğrenci sunucu eylemini doğrudan çağırıp
 * kendine DANISMAN rolü yazabiliyordu. Kapı kural katmanına taşındı.
 */
describe("danışmanlık görevini alma kapısı", () => {
  it("rolsüz öğretmen alabilir (görevi bırakıp geri alan)", () => {
    expect(danismanlikAlabilirMi({ aktifRoller: [], ogrenciProfiliVarMi: false })).toBe(true);
  });

  it("zaten danışman olan yeniden işaretleyebilir", () => {
    expect(
      danismanlikAlabilirMi({ aktifRoller: ["DANISMAN"], ogrenciProfiliVarMi: false }),
    ).toBe(true);
  });

  it.each(["OGRENCI", "MEZUN", "PAYDAS_TEMSILCISI", "PROJE_YONETICISI"] as const)(
    "%s alamaz",
    (rol) => {
      expect(danismanlikAlabilirMi({ aktifRoller: [rol], ogrenciProfiliVarMi: false })).toBe(
        false,
      );
    },
  );

  it("öğrenci rolü kapanmış ama öğrenci profili duran hesap alamaz", () => {
    expect(danismanlikAlabilirMi({ aktifRoller: [], ogrenciProfiliVarMi: true })).toBe(false);
  });

  it("izinli rolün yanında yasak rol varsa alamaz", () => {
    expect(
      danismanlikAlabilirMi({
        aktifRoller: ["DANISMAN", "OGRENCI"],
        ogrenciProfiliVarMi: false,
      }),
    ).toBe(false);
  });
});
