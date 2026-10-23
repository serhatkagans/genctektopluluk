import { okulAdiBenzerMi, okulAdiSadele } from "@/lib/okul/benzerlik";

/** Okul adı benzerliği (23 Ekim 2026). */
describe("okul adı benzerliği", () => {
  test("Türkçe harf ve noktalama sadeleşir", () => {
    expect(okulAdiSadele("  Çankaya  Atatürk A.L. ")).toBe("cankaya ataturk a l");
  });

  test.each([
    ["Çankaya Atatürk Anadolu Lisesi", "cankaya ataturk anadolu lisesi"],
    ["Çankaya Atatürk Anadolu Lisesi", "Çankaya Atatürk Anadolu Lisessi"],
    ["Kadıköy Fen Lisesi", "Kadikoy Fen Lises"],
  ])("%s ≈ %s", (a, b) => {
    expect(okulAdiBenzerMi(a, b)).toBe(true);
  });

  test.each([
    ["Çankaya Atatürk Anadolu Lisesi", "Keçiören Fen Lisesi"],
    ["Kadıköy Fen Lisesi", "Kadıköy Anadolu Lisesi"],
    ["Fen Lisesi", null],
  ])("%s ≠ %s", (a, b) => {
    expect(okulAdiBenzerMi(a, b)).toBe(false);
  });
});
