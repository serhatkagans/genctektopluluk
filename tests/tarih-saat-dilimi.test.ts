import {
  girdiTarihi,
  girdiTarihSaati,
  gunBasi,
  gunSonu,
  yerelTarihSaat,
} from "@/lib/tarih";

/**
 * Form tarihleri Türkiye saatiyle çözülür (31 Ekim 2026). Sunucu UTC'de
 * çalışıyor; bu testler sürecin saat diliminden bağımsız sonuç bekler
 * (TZ=UTC ile de çalıştırılmalı).
 */
describe("form tarihleri · Türkiye saati", () => {
  it("datetime-local girdisi Türkiye saati olarak çözülür", () => {
    expect(yerelTarihSaat("2026-10-22T09:49")?.toISOString()).toBe(
      "2026-10-22T06:49:00.000Z",
    );
  });

  it("gün başı ve sonu Türkiye gününe göre", () => {
    expect(gunBasi("2026-10-22")?.toISOString()).toBe("2026-10-21T21:00:00.000Z");
    expect(gunSonu("2026-10-22")?.toISOString()).toBe("2026-10-22T20:59:59.999Z");
  });

  it("form varsayılanı kayıtlı anın Türkiye'deki gün/saati", () => {
    const an = new Date("2026-10-22T22:30:00.000Z"); // TR: 23 Ekim 01:30
    expect(girdiTarihi(an)).toBe("2026-10-23");
    expect(girdiTarihSaati(an)).toBe("2026-10-23T01:30");
  });

  it("değiştirilmeden kaydedilen değer kaymaz", () => {
    const an = new Date("2026-10-22T09:49:00.000Z");
    expect(yerelTarihSaat(girdiTarihSaati(an))?.getTime()).toBe(an.getTime());
    const gun = gunSonu("2026-10-22")!;
    expect(girdiTarihi(gun)).toBe("2026-10-22");
  });

  it("geçersiz girdi null döner", () => {
    expect(yerelTarihSaat("bozuk")).toBeNull();
    expect(gunBasi("")).toBeNull();
  });
});
