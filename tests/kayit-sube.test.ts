import { sinifCoz } from "@/lib/kayit/kurallar";

describe("şube hoşgörülü okunur (2 Kasım 2026)", () => {
  it.each([
    ["A", "9-A"],
    ["a", "9-A"],
    ["9-A", "9-A"],
    ["9A", "9-A"],
    ["9/a", "9-A"],
    [" B ", "9-B"],
    ["A şubesi", "9-A"],
    ["", "9"],
  ])("%p → %p", (sube, beklenen) => {
    expect(sinifCoz("9", sube)).toEqual({ olurMu: true, sinif: beklenen });
  });

  it("12-B ve hazırlık", () => {
    expect(sinifCoz("12", "12 b")).toEqual({ olurMu: true, sinif: "12-B" });
    expect(sinifCoz("Hazırlık", "Hazırlık A")).toEqual({
      olurMu: true,
      sinif: "Hazırlık-A",
    });
  });

  it("anlamsız değer yine reddedilir", () => {
    expect(sinifCoz("9", "ABC").olurMu).toBe(false);
    expect(sinifCoz("9", "3").olurMu).toBe(false);
  });
});
