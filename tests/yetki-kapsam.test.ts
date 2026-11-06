import {
  DEGERLENDIRME_KATILIMCI_ALANLARI,
  danismanAdayiFiltresi,
  faaliyetKapsamFiltresi,
  ogrenciKapsamFiltresi,
  ogrenciListeFiltresi,
  ogretmenKapsamFiltresi,
  ogretmenListeFiltresi,
  paydasKapsamFiltresi,
  paydasListeFiltresi,
  ulusalBasvuranFiltresi,
  faaliyetKatilimFiltresi,
} from "@/lib/yetki/kapsam";
import { KOORDINATOR_ONAYINA_TABI_ROLLER } from "@/lib/yetki/izinler";
import {
  danismanYap,
  koordinatorYap,
  ogrenciYap,
  projeYoneticisiYap,
  rolsuzOgretmenYap,
} from "./yardimcilar";

/**
 * Kapsam filtresi testleri — references/permissions.md Bölüm 2 ve 3.
 *
 * Filtrenin ürettiği koşulları doğruluyoruz; yanlış üretilen bir filtre
 * doğrudan veri sızması demektir.
 */

function metne(filtre: unknown): string {
  return JSON.stringify(filtre);
}

describe("öğrenci kapsam filtresi", () => {
  it("proje yöneticisine il/kurum kısıtı uygulanmaz", () => {
    const filtre = ogrenciKapsamFiltresi(projeYoneticisiYap());
    expect(metne(filtre)).not.toContain("ilKodu");
    expect(metne(filtre)).not.toContain("kurumKodu");
    expect(metne(filtre)).toContain("OGRENCI");
  });

  it("il koordinatörü yalnızca kendi ilini görür", () => {
    const filtre = ogrenciKapsamFiltresi(koordinatorYap({ ilKodu: "34" }));
    expect(filtre).toEqual({
      AND: [
        { roller: { some: { rolKodu: "OGRENCI", bitisTarihi: null } } },
        { ilKodu: "34" },
      ],
    });
  });

  /*
   * 6 KASIM 2026 · güvenlik incelemesi; kural: "sadece danışmanı olduğu
   * kişileri görmesi gerek".
   *
   * "Okulundaki danışmansızlar" kolu (10 Ağustos 2026) kalktı: kayıtta
   * öğretmen seçen herkes danışman oluyor ve okulunu kendisi seçiyor; kol
   * açıkken istenen okulun danışmansız öğrencileri açılabiliyordu. Okul kodu
   * filtrede HİÇ geçmemeli — testin asıl koruduğu şey bu.
   */
  it("danışman yalnızca danışmanı olduğu öğrencileri görür", () => {
    const filtre = ogrenciKapsamFiltresi(
      danismanYap({ id: 200, kurumKodu: 750001 }),
    );
    expect(filtre).toEqual({
      AND: [
        { roller: { some: { rolKodu: "OGRENCI", bitisTarihi: null } } },
        {
          ogrenciAtamalari: {
            some: { danismanKullaniciId: 200, bitisTarihi: null },
          },
        },
      ],
    });
    const metin = metne(filtre);
    expect(metin).not.toContain("750001");
    expect(metin).not.toContain('"none"');
  });

  it("öğrenci yalnızca kendisini görür", () => {
    const filtre = ogrenciKapsamFiltresi(ogrenciYap({ id: 100 }));
    expect(filtre).toEqual({
      AND: [
        { roller: { some: { rolKodu: "OGRENCI", bitisTarihi: null } } },
        { id: 100 },
      ],
    });
  });

  it("rolsüz öğretmen hiçbir öğrenci görmez (fail closed)", () => {
    const filtre = ogrenciKapsamFiltresi(rolsuzOgretmenYap());
    expect(filtre).toEqual({ id: { in: [] } });
  });
});

describe("öğrenci listesi filtreleri", () => {
  it("filtre yokken kapsam koşulu aynen korunur", () => {
    const kullanici = koordinatorYap({ ilKodu: "34" });
    expect(ogrenciListeFiltresi(kullanici)).toEqual({
      AND: [ogrenciKapsamFiltresi(kullanici)],
    });
  });

  it("seçilen filtreler kapsamın üstüne eklenir", () => {
    const filtre = ogrenciListeFiltresi(projeYoneticisiYap(), {
      ilKodu: "06",
      kurumKodu: 750003,
      sinif: "9",
      calismaGrubuId: 4,
    });
    expect(filtre.AND).toContainEqual({ ilKodu: "06" });
    expect(filtre.AND).toContainEqual({ kurumKodu: 750003 });
    expect(filtre.AND).toContainEqual({
      sinif: { contains: "9", mode: "insensitive" },
    });
    expect(filtre.AND).toContainEqual({
      calismaGruplari: { some: { calismaGrubuId: 4 } },
    });
  });

  it("başka ilin kodu girilse bile koordinatörün il kısıtı düşmez", () => {
    // Adres çubuğuna ?il=06 yazan İstanbul koordinatörü senaryosu: iki koşul
    // birlikte arandığı için sonuç boş küme olur, başka ilin verisi gelmez.
    const filtre = ogrenciListeFiltresi(koordinatorYap({ ilKodu: "34" }), {
      ilKodu: "06",
    });
    expect(filtre.AND).toContainEqual({
      AND: [
        { roller: { some: { rolKodu: "OGRENCI", bitisTarihi: null } } },
        { ilKodu: "34" },
      ],
    });
    expect(filtre.AND).toContainEqual({ ilKodu: "06" });
  });

  it("rolsüz öğretmen filtre verse de hiçbir kayıt göremez", () => {
    const filtre = ogrenciListeFiltresi(rolsuzOgretmenYap(), {
      ilKodu: "34",
      ara: "Elif",
    });
    expect(filtre.AND).toContainEqual({ id: { in: [] } });
  });

  it("danışmansız filtresi aktif atama yokluğunu arar", () => {
    const filtre = ogrenciListeFiltresi(projeYoneticisiYap(), {
      danismansizMi: true,
    });
    expect(filtre.AND).toContainEqual({
      ogrenciAtamalari: { none: { bitisTarihi: null } },
    });
  });

  it("ad araması hem adda hem soyadda eşleşir", () => {
    const filtre = ogrenciListeFiltresi(projeYoneticisiYap(), { ara: "yıl" });
    expect(filtre.AND).toContainEqual({
      OR: [
        { ad: { contains: "yıl", mode: "insensitive" } },
        { soyad: { contains: "yıl", mode: "insensitive" } },
      ],
    });
  });
});

describe("ulusal faaliyet istisnası", () => {
  it("il koordinatörü yalnızca kendi açtığı faaliyetin başvuranlarını görür", () => {
    const filtre = ulusalBasvuranFiltresi(koordinatorYap({ id: 300 }), 900);
    expect(filtre).toEqual({
      faaliyetId: 900,
      faaliyet: { duzenleyenKullaniciId: 300 },
    });
  });

  it("değerlendirme ekranında telefon ve e-posta gösterilmez", () => {
    const alanlar = Object.keys(DEGERLENDIRME_KATILIMCI_ALANLARI);
    expect(alanlar).not.toContain("telefon");
    expect(alanlar).not.toContain("eposta");
    expect(alanlar).not.toContain("ogrenciProfil");
    expect(alanlar).toContain("ad");
    expect(alanlar).toContain("soyad");
  });
});

describe("faaliyet kapsam filtresi", () => {
  it("proje yöneticisine filtre uygulanmaz", () => {
    expect(faaliyetKapsamFiltresi(projeYoneticisiYap())).toEqual({});
  });

  it("öğrenciye yayındaki bütün faaliyetler listelenir, kapsamdan bağımsız", () => {
    // 2 Kasım 2026: başka ilin etkinliği görünür; kapsam yalnızca başvuruyu sınırlar.
    const filtre = faaliyetKapsamFiltresi(
      ogrenciYap({ kurumKodu: 750001, ilKodu: "34" }),
    );
    const metin = metne(filtre);
    expect(metin).toContain("ONAYLANDI");
    expect(metin).toContain("ONAY_GEREKMEZ");
    expect(metin).not.toContain('"kapsam"');
    expect(metin).not.toContain("BEKLIYOR");
  });

  it("başvuru filtresi kişinin okulu, ili ve ulusal çağrılarla sınırlıdır", () => {
    const metin = metne(
      faaliyetKatilimFiltresi({ kurumKodu: 750001, ilKodu: "34" }),
    );
    expect(metin).toContain("750001");
    expect(metin).toContain('"ilKodu":"34"');
    expect(metin).toContain("ULUSAL");
  });

  it("kişinin kendi açtığı faaliyetler onay durumundan bağımsız görünür", () => {
    const filtre = faaliyetKapsamFiltresi(koordinatorYap({ id: 300 }));
    expect(metne(filtre)).toContain('"duzenleyenKullaniciId":300');
  });

  /**
   * FİLTRE İLE ONAY YETKİSİ AYNI ROLLERİ TAŞIMAK ZORUNDA.
   *
   * Bu eşleşme iki kez bozuldu (danışman öğretmen, sonra mezun/paydaş/mentör)
   * ve ikisinde de sessizce: koordinatöre "onayınızı bekliyor" bildirimi
   * gidiyor, bağlantı 404 veriyor, etkinlik sonsuza kadar BEKLIYOR'da
   * kalıyordu. Test, listenin tek kaynaktan (KOORDINATOR_ONAYINA_TABI_ROLLER)
   * geldiğini ve filtreye eksiksiz yazıldığını doğruluyor.
   */
  it("koordinatörün onay kuyruğu, onaylayabildiği tüm rolleri kapsar", () => {
    const metin = metne(faaliyetKapsamFiltresi(koordinatorYap()));
    for (const rol of KOORDINATOR_ONAYINA_TABI_ROLLER) {
      expect(metin).toContain(`"${rol}"`);
    }
    expect(metin).toContain("BEKLIYOR");
  });

  it("onaya tabi rol listesi, yetki tarafındaki üç bayrakla aynı kümedir", () => {
    // Bayraklar: duzenleyenOgrenciMi · duzenleyenDanismanMi ·
    // duzenleyenDisKullaniciMi (mezun + paydaş temsilcisi).
    expect([...KOORDINATOR_ONAYINA_TABI_ROLLER].sort()).toEqual(
      ["DANISMAN", "MEZUN", "OGRENCI", "PAYDAS_TEMSILCISI"].sort(),
    );
  });
});

describe("danışman adayı filtresi", () => {
  it("aynı kurumdaki, işaretlemiş ve il koordinatörü olmayan öğretmenleri seçer", () => {
    const filtre = danismanAdayiFiltresi(750001);
    expect(filtre.kurumKodu).toBe(750001);
    expect(metne(filtre)).toContain("danismanOlmakIstiyor");
    expect(metne(filtre)).toContain("IL_KOORDINATOR");
    expect(metne(filtre)).toContain("NOT");
  });
});

/**
 * Öğretmen envanteri kapsamı — analiz dokümanı Bölüm 2.
 */
describe("öğretmen kapsam filtresi", () => {
  it("öğrenci hiçbir öğretmen kaydı göremez (fail closed)", () => {
    expect(ogretmenKapsamFiltresi(ogrenciYap())).toEqual({ id: { in: [] } });
  });

  it("görev almamış öğretmen de envanteri göremez", () => {
    expect(ogretmenKapsamFiltresi(rolsuzOgretmenYap())).toEqual({
      id: { in: [] },
    });
  });

  it("il koordinatörü kendi ilinin öğretmenlerini görür", () => {
    const filtre = ogretmenKapsamFiltresi(koordinatorYap({ ilKodu: "34" }));
    expect(metne(filtre)).toContain('"ilKodu":"34"');
  });

  it("danışman öğretmen kendi okuluyla sınırlıdır", () => {
    const filtre = ogretmenKapsamFiltresi(danismanYap({ kurumKodu: 750001 }));
    expect(metne(filtre)).toContain('"kurumKodu":750001');
  });

  /*
   * "Öğretmen" = aktif öğrenci rolü olmayan kullanıcı. YEĞİTEK personeli de
   * dışarıda: okulda görevli bir öğretmen değildir, listede okulsuz satır
   * olarak görünmesi envanteri kirletir.
   */
  it("öğrenciler ve merkez personeli envanterin dışındadır", () => {
    const filtre = metne(ogretmenKapsamFiltresi(projeYoneticisiYap()));
    expect(filtre).toContain("none");
    expect(filtre).toContain("OGRENCI");
    expect(filtre).toContain("PROJE_YONETICISI");
  });

  it("görev yılı filtresi aralık ÇAKIŞMASI arar, kapsanma değil", () => {
    const filtre = ogretmenListeFiltresi(projeYoneticisiYap(), {
      gorevAraligi: {
        baslangic: new Date(2024, 8, 1),
        bitis: new Date(2025, 7, 31),
      },
    });
    const metin = metne(filtre);
    // Süren görev (bitisTarihi null) de o yıla dahil olmalı.
    expect(metin).toContain('"bitisTarihi":null');
    expect(metin).toContain("baslangicTarihi");
  });
});

/**
 * Paydaş envanteri kapsamı — analiz dokümanı Bölüm 3.
 */
describe("paydaş kapsam filtresi", () => {
  it("proje yöneticisine il kısıtı uygulanmaz", () => {
    expect(paydasKapsamFiltresi(projeYoneticisiYap())).toEqual({});
  });

  it("il koordinatörü kendi ilini VE kendi eklediklerini görür", () => {
    /*
     * İkinci koşul olmasaydı, koordinatörün başka ile eklediği kayıt
     * kaydedildiği anda listesinden kaybolurdu.
     */
    expect(paydasKapsamFiltresi(koordinatorYap({ id: 77, ilKodu: "34" }))).toEqual(
      { OR: [{ ilKodu: "34" }, { ekleyenKullaniciId: 77 }] },
    );
  });

  it("danışman öğretmen kendi ilinin paydaşlarını görür", () => {
    // İş birliği il düzeyinde kurulur; okul kırılımı yoktur.
    expect(paydasKapsamFiltresi(danismanYap({ ilKodu: "34" }))).toEqual({
      ilKodu: "34",
    });
  });

  it("öğrenci hiçbir paydaş göremez", () => {
    expect(paydasKapsamFiltresi(ogrenciYap({ ilKodu: "34" }))).toEqual({
      id: { in: [] },
    });
  });

  it("pasif kayıtlar varsayılan olarak listelenmez", () => {
    const filtre = metne(paydasListeFiltresi(projeYoneticisiYap()));
    expect(filtre).toContain('"aktif":true');
  });

  it("pasifleri göster seçilirse aktif kısıtı düşer", () => {
    const filtre = metne(
      paydasListeFiltresi(projeYoneticisiYap(), { pasifleriDeGoster: true }),
    );
    expect(filtre).not.toContain('"aktif":true');
  });

  /*
   * KURUM SÜTUN SÜZGECİ (31 Ağustos 2026 · istek: "Kurum / Tür / İl — bunlar
   * filtreli"). `ara`dan ayrı: `ara` kurum adı, yetkili kişi ve iş birliği
   * alanına birden bakıyor; sütun süzgeci yalnızca sütunun kendisine.
   */
  it("kurum süzgeci yalnızca kurum adında arar", () => {
    const filtre = metne(
      paydasListeFiltresi(projeYoneticisiYap(), { kurum: "teknopark" }),
    );
    expect(filtre).toContain('"contains":"teknopark"');
    // `ara` dalının imzası: yetkili kişi de aranır. Burada olmamalı.
    expect(filtre).not.toContain("yetkiliKisi");
  });

  it("kurum ve ara birlikte DARALTIR, birbirinin yerine geçmez", () => {
    const filtre = metne(
      paydasListeFiltresi(projeYoneticisiYap(), {
        kurum: "teknopark",
        ara: "ayşe",
      }),
    );
    expect(filtre).toContain('"contains":"teknopark"');
    expect(filtre).toContain("yetkiliKisi");
  });

  /*
   * Seçilen filtreler kapsamın YERİNE geçmez, üstüne eklenir: adres çubuğuna
   * başka bir il kodu yazan koordinatör o ilin paydaşlarını göremez.
   */
  it("il filtresi kapsamı genişletmez", () => {
    const filtre = paydasListeFiltresi(koordinatorYap({ id: 77, ilKodu: "34" }), {
      ilKodu: "06",
    });
    const metin = metne(filtre);
    // Kapsam (kendi ili + kendi eklediği) ile ekran filtresi AND'lenir;
    // adres çubuğuna yazılan il kodu kapsamın yerine GEÇMEZ.
    expect(metin).toContain('"ilKodu":"34"');
    expect(metin).toContain('"ekleyenKullaniciId":77');
    expect(metin).toContain('"ilKodu":"06"');
  });
});

/**
 * Öğrenci listesinin yeni filtreleri — analiz dokümanı 1.2.
 */
describe("öğrenci liste filtreleri: okul türü ve eğitim-öğretim yılı", () => {
  it("okul türü öğrencide değil bağlı olduğu kurumda aranır", () => {
    const filtre = metne(
      ogrenciListeFiltresi(projeYoneticisiYap(), {
        okulTuru: "Anadolu Lisesi",
      }),
    );
    expect(filtre).toContain('"kurum":{"okulTuru":"Anadolu Lisesi"}');
  });

  it("eğitim-öğretim yılı filtresi kapsamla birlikte uygulanır", () => {
    const filtre = metne(
      ogrenciListeFiltresi(koordinatorYap({ ilKodu: "34" }), {
        egitimOgretimYili: "2024-2025",
      }),
    );
    expect(filtre).toContain('"egitimOgretimYili":"2024-2025"');
    expect(filtre).toContain('"ilKodu":"34"');
  });
});

describe("ogrenciListeFiltresi · profilde arama süzgeci", () => {
  /*
   * SÜZGEÇ GRUP BAZINDA (26 Ağustos 2026 · istek: "ürünlere göre,
   * topluluklara göre, deneyimlerime göre filtrelesin"). Önce tek tek
   * kazanım tipleri listeleniyor, yanında da başlıkta metin arayan bir alan
   * duruyordu; ikisi de kalktı. Profildeki üç başlık esas alınıyor.
   */
  it("grubun kapsadığı TÜM tipleri arar", () => {
    const kosul = ogrenciListeFiltresi(projeYoneticisiYap(), {
      kazanimGrubu: "DENEYIMLERIM",
    });

    const metin = JSON.stringify(kosul);
    expect(metin).toContain("GENCTEK_ETKINLIGI");
    expect(metin).toContain("YARISMA_DERECESI");
    expect(metin).toContain("SERTIFIKA");
    expect(metin).toContain("DIS_ETKINLIK");
  });

  it("tek tipli grupta yalnızca o tipi arar", () => {
    const kosul = ogrenciListeFiltresi(projeYoneticisiYap(), {
      kazanimGrubu: "URUNLERIM",
    });

    const metin = JSON.stringify(kosul);
    expect(metin).toContain("URUN");
    expect(metin).not.toContain("SERTIFIKA");
  });

  it("kazanım koşulu TEK `some` içinde kurulur", () => {
    const kosul = ogrenciListeFiltresi(projeYoneticisiYap(), {
      kazanimGrubu: "TOPLULUKLARIM",
    });

    const metin = JSON.stringify(kosul);
    expect((metin.match(/"kazanimlar"/g) ?? []).length).toBe(1);
  });

  /*
   * Tanınmayan kod süzgeci HİÇ UYGULAMAZ. Boş dizi ile sorgulansaydı
   * (`tip: { in: [] }`) hiçbir öğrenci dönmez, kullanıcı da filtrenin
   * çalıştığını sanırdı.
   */
  it("tanınmayan grup kodu koşul eklemez", () => {
    const kosul = ogrenciListeFiltresi(projeYoneticisiYap(), {
      kazanimGrubu: "OLMAYAN_GRUP",
    });

    expect(JSON.stringify(kosul)).not.toContain("kazanimlar");
  });

  it("hiç süzgeç yokken kazanım koşulu eklemez", () => {
    const kosul = ogrenciListeFiltresi(projeYoneticisiYap(), {});

    expect(JSON.stringify(kosul)).not.toContain("kazanimlar");
  });
});
