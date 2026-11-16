import {
  ogrenciGorevSuzgeciGecerliMi,
  ogrenciKapsamFiltresi,
  ogrenciListeFiltresi,
  yolculukOgrenciFiltresi,
} from "@/lib/yetki/kapsam";
import {
  danismanYap,
  koordinatorYap,
  ogrenciYap,
  projeYoneticisiYap,
  rolsuzOgretmenYap,
} from "./yardimcilar";

/**
 * GENÇTEK YOLCULUĞU ekranının öğrenci kümesi (16 Kasım 2026 · istekler:
 * "danışman okulundaki, koordinatör ilinde seçtiği ilçedeki, yönetici seçtiği
 * il ve ilçedeki öğrencilerin durumlarını görsün"; "danışman okulundaki tüm
 * öğrencileri görsün").
 *
 * Yanlış üretilen bir filtre doğrudan veri sızması demek; o yüzden hem
 * GENİŞLEYEN (danışman → okul) hem DARALMASI GEREKEN (koordinatör → il)
 * yönler sınanıyor.
 */

function metne(filtre: unknown): string {
  return JSON.stringify(filtre);
}

describe("yolculuk ekranında danışman", () => {
  it("kendi öğrencilerine EK OLARAK danışman rolünün okulundaki tüm aktif öğrencileri görür", () => {
    const danisman = danismanYap({ kurumKodu: 750001 });
    const filtre = yolculukOgrenciFiltresi(danisman);
    expect(filtre).toEqual({
      OR: [
        ogrenciListeFiltresi(danisman, {}),
        { AND: [expect.anything(), { kurumKodu: { in: [750001] } }] },
      ],
    });
    // Okul kolu da aktif öğrenci koşulunu taşıyor.
    expect(metne(filtre)).toContain("OGRENCI");
  });

  it("okulu olmayan danışman rolünde dar kapsam (yalnızca kendi öğrencileri) kalır", () => {
    const danisman = danismanYap({
      roller: [{ rolKodu: "DANISMAN", ilKodu: null, kurumKodu: null }],
    });
    expect(yolculukOgrenciFiltresi(danisman)).toEqual(ogrenciListeFiltresi(danisman, {}));
  });

  it("genişleme YALNIZCA yolculuk ekranında: genel öğrenci kapsamı okulu açmaz", () => {
    const danisman = danismanYap({ kurumKodu: 750001 });
    expect(metne(ogrenciKapsamFiltresi(danisman))).not.toContain("750001");
  });

  it("yer süzgeci okul koluna da uygulanmaz ama dar kolda kalır (danışmanda yer seçimi yok)", () => {
    const danisman = danismanYap({ kurumKodu: 750001 });
    const filtre = yolculukOgrenciFiltresi(danisman, { ilKodu: "06" }) as { OR: unknown[] };
    expect(metne(filtre.OR[0])).toContain('"ilKodu":"06"');
  });
});

describe("yolculuk ekranında diğer roller", () => {
  it("il koordinatörü kendi iliyle sınırlı; adres çubuğuna başka il yazsa da kapsam düşmez", () => {
    const koordinator = koordinatorYap({ ilKodu: "56" });
    const filtre = yolculukOgrenciFiltresi(koordinator, { ilKodu: "06" });
    expect(filtre).toEqual(ogrenciListeFiltresi(koordinator, { ilKodu: "06" }));
    // Hem kapsamın ili (56) hem seçilen il (06) AND ile birlikte: sonuç boş küme.
    expect(metne(filtre)).toContain('"ilKodu":"56"');
    expect(metne(filtre)).toContain('"ilKodu":"06"');
    expect(metne(filtre)).not.toContain('"OR"');
  });

  it("il koordinatörü ilçe seçebilir", () => {
    const filtre = yolculukOgrenciFiltresi(koordinatorYap({ ilKodu: "56" }), {
      ilKodu: "56",
      ilceKodu: "5601",
    });
    expect(metne(filtre)).toContain('"ilceKodu":"5601"');
  });

  it("proje yöneticisi il ve ilçe seçer; okul genişlemesi yok", () => {
    const filtre = yolculukOgrenciFiltresi(projeYoneticisiYap(), { ilKodu: "56", ilceKodu: "5601" });
    expect(metne(filtre)).toContain('"ilKodu":"56"');
    expect(metne(filtre)).toContain('"ilceKodu":"5601"');
    expect(metne(filtre)).not.toContain('"OR"');
  });

  it("öğrenci ve rolsüz öğretmen için genişleme yok", () => {
    for (const kisi of [ogrenciYap(), rolsuzOgretmenYap()]) {
      expect(yolculukOgrenciFiltresi(kisi)).toEqual(ogrenciListeFiltresi(kisi, {}));
    }
  });
});

describe("mentörlük onayı bekleyen süzgeci (koordinatör mentör onayı)", () => {
  it("MENTOR_BEKLIYOR geçerli bir süzgeç değeridir", () => {
    expect(ogrenciGorevSuzgeciGecerliMi("MENTOR_BEKLIYOR")).toBe(true);
    expect(ogrenciGorevSuzgeciGecerliMi("MENTOR")).toBe(true);
    expect(ogrenciGorevSuzgeciGecerliMi("BASKA")).toBe(false);
  });

  it("bekleyen başvuruyu süzer, onaylı mentörü değil; kapsam yine uygulanır", () => {
    const koordinator = koordinatorYap({ ilKodu: "56" });
    const filtre = ogrenciListeFiltresi(koordinator, { gorevRolu: "MENTOR_BEKLIYOR" });
    expect(metne(filtre)).toContain('"mentorluk":{"durum":"BEKLIYOR"}');
    expect(metne(filtre)).not.toContain("ONAYLANDI");
    expect(metne(filtre)).toContain('"ilKodu":"56"');
  });
});
