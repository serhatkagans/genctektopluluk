import {
  KOORDINATOR_ATAMA_ENGEL_MESAJLARI,
  type KoordinatorAtamaSonucu,
  koordinatorAtamaEngeli,
  yenidenDagitilanOgrenciSayisi,
} from "@/lib/rol/karar";

/**
 * İl koordinatörü atamasının saf kararları — domain-rules.md Bölüm 3.
 *
 * Bu kararların yanlış olması pahalıdır: atama bir kez çalıştığında öğrenciler
 * dağılır, dağıtım geri sayılamaz.
 */

function sonucYap(
  ozellikler: Partial<KoordinatorAtamaSonucu> = {},
): KoordinatorAtamaSonucu {
  return {
    koordinatorKullaniciId: 300,
    danismanliktanAlindiMi: false,
    devredilenOgrenciSayisi: 0,
    yenidenSecimBekleyen: 0,
    sahipsizkenBaglananOgrenciSayisi: 0,
    ...ozellikler,
  };
}

describe("il koordinatörü atama engelleri", () => {
  const uygun: Parameters<typeof koordinatorAtamaEngeli>[0] = {
    hedefVarMi: true,
    hedefAktifMi: true,
    hedefRolKodlari: [],
    ilTanimliMi: true,
    ildeGorevliKoordinatorVarMi: false,
  };

  it("rolsüz öğretmene atama yapılabilir", () => {
    expect(koordinatorAtamaEngeli({ ...uygun })).toBeNull();
  });

  it("DANIŞMAN ÖĞRETMEN ENGELLENMEZ", () => {
    // Karara bağlanmış madde: danışmanlığı kapanır, öğrencileri dağıtılır ama
    // atamanın kendisi durdurulmaz.
    expect(
      koordinatorAtamaEngeli({ ...uygun, hedefRolKodlari: ["DANISMAN"] }),
    ).toBeNull();
  });

  it("öğrenciye il koordinatörlüğü verilmez", () => {
    expect(
      koordinatorAtamaEngeli({ ...uygun, hedefRolKodlari: ["OGRENCI"] }),
    ).toBe("OGRENCIYE_VERILMEZ");
  });

  it.each(["MEZUN", "PAYDAS_TEMSILCISI"] as const)(
    "%s hesabına il koordinatörlüğü verilmez",
    (rol) => {
      expect(
        koordinatorAtamaEngeli({ ...uygun, hedefRolKodlari: [rol] }),
      ).toBe("DIS_KULLANICIYA_VERILMEZ");
    },
  );

  it("zaten koordinatör olan kişiye ikinci kez atama yapılmaz", () => {
    expect(
      koordinatorAtamaEngeli({
        ...uygun,
        hedefRolKodlari: ["IL_KOORDINATOR"],
      }),
    ).toBe("ZATEN_KOORDINATOR");
  });

  it("pasif veya bulunmayan kullanıcıya atama yapılmaz", () => {
    expect(koordinatorAtamaEngeli({ ...uygun, hedefAktifMi: false })).toBe(
      "KULLANICI_YOK",
    );
    expect(koordinatorAtamaEngeli({ ...uygun, hedefVarMi: false })).toBe(
      "KULLANICI_YOK",
    );
  });

  it("tanımsız ile atama yapılmaz", () => {
    expect(koordinatorAtamaEngeli({ ...uygun, ilTanimliMi: false })).toBe(
      "GECERSIZ_IL",
    );
  });

  it("koordinatörü dolu ile ikinci atama yapılmaz", () => {
    // Bir ilde aynı anda tek koordinatör olur; önce mevcut görev kaldırılmalı.
    expect(
      koordinatorAtamaEngeli({ ...uygun, ildeGorevliKoordinatorVarMi: true }),
    ).toBe("IL_DOLU");
  });

  it("her engelin kullanıcıya gösterilecek bir mesajı vardır", () => {
    const engel = koordinatorAtamaEngeli({
      ...uygun,
      hedefRolKodlari: ["OGRENCI"],
    });
    expect(engel).not.toBeNull();
    expect(KOORDINATOR_ATAMA_ENGEL_MESAJLARI[engel!]).toContain("öğretmen");
  });
});

describe("yeniden dağıtılan öğrenci sayısı", () => {
  it("devredilenler ile yeniden seçim bekleyenleri toplar", () => {
    expect(
      yenidenDagitilanOgrenciSayisi(
        sonucYap({ devredilenOgrenciSayisi: 4, yenidenSecimBekleyen: 3 }),
      ),
    ).toBe(7);
  });

  it("sahipsizken bağlananları SAYMAZ", () => {
    /*
     * Bunlar dağıtılmadı; ilde koordinatör olmadığı için atamasız bekliyorlardı
     * ve bu atamayla sahipsizlikten çıktılar. Tek sayıda toplanırlarsa proje
     * yöneticisi danışman değişikliğinden kaç öğrencinin etkilendiğini yanlış
     * okur.
     */
    expect(
      yenidenDagitilanOgrenciSayisi(
        sonucYap({ sahipsizkenBaglananOgrenciSayisi: 12 }),
      ),
    ).toBe(0);
  });

  it("danışman olmayan birinin atanmasında dağıtım olmaz", () => {
    expect(yenidenDagitilanOgrenciSayisi(sonucYap())).toBe(0);
  });
});
