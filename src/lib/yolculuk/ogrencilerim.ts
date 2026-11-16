import { prisma } from "../db";
import { katilimSayilirMi } from "../kazanim/katilim-kurallar";
import { yolculukOgrenciFiltresi } from "../yetki/kapsam";
import type { OturumKullanicisi } from "../yetki/tipler";
import {
  PUAN_KAYNAKLARI,
  type SeviyeTanimi,
  YOLCULUK_SEVIYELERI,
  yolculukDurumu,
} from "./kurallar";

/**
 * ÖĞRENCİLERİMİN GENÇTEK YOLCULUĞU — öğretmenin gördüğü toplu hâl
 * (28 Ağustos 2026 · istek: "öğretmen tarafında 'GençTek Yolculuğum' yerine
 * 'Öğrencilerimin GençTek Yolculuğu' yazıyoruz … kaç öğrencisi Hello World
 * aşamasında onu yazdırıyoruz … o okuldaki öğrencilerin tüm sayılarını
 * yazdırabiliyor muyuz").
 *
 * ---------------------------------------------------------------------------
 * KİM "ÖĞRENCİLERİM"
 * ---------------------------------------------------------------------------
 * Sorunun cevabı burada YENİDEN TANIMLANMIYOR, `ogrenciKapsamFiltresi`den
 * geliyor: danışman öğretmen için okulundaki kendi ve danışmansız öğrenciler,
 * il koordinatörü için ilinin öğrencileri, proje yöneticisi için hepsi.
 * Kendi koşulunu yazan bir ekran, yetki matrisi değiştiğinde geride kalan ve
 * kimsenin fark etmediği ikinci bir kapı olurdu.
 *
 * ---------------------------------------------------------------------------
 * SEVİYE HESABI TEK YERDEN
 * ---------------------------------------------------------------------------
 * Her öğrencinin seviyesi, öğrencinin kendi ekranındaki `yolculukDurumu` ile
 * hesaplanıyor. Dağılımı SQL'de saymak (eşikleri sorguya gömmek) daha ucuz
 * olurdu ama eşikler iki yerde yaşardı: öğrencinin ekranı "Üretimde" derken
 * öğretmenin sayfası onu "Harekette" sütununda gösterebilirdi.
 *
 * ---------------------------------------------------------------------------
 * SORGU SAYISI ÖĞRENCİ SAYISINDAN BAĞIMSIZ
 * ---------------------------------------------------------------------------
 * Öğrenci başına `yolculugumuGetir` çağırmak (30 öğrenci × 8 sorgu) yerel
 * veritabanının bağlantı tavanını tek sayfada aşardı (bkz. veri.ts başlığı).
 * Bunun yerine her ölçüt TEK gruplanmış sorguyla çekilip bellekte öğrenciye
 * dağıtılıyor: öğrenci sayısı ne olursa olsun sorgu sayısı sabit.
 */

/** Bir basamak ve o basamakta duran öğrenci sayısı. */
export interface SeviyeDagilimi {
  seviye: SeviyeTanimi;
  ogrenciSayisi: number;
}

/** Topluluk defterinin bir satırı: kalem ve toplam adet. */
export interface TopluDokumSatiri {
  kod: string;
  etiket: string;
  adet: number;
}

export interface OgrencilerimYolculugu {
  ogrenciSayisi: number;
  /** Yedi basamağın hepsi, boş olanlar dahil ve seviye sırasında. */
  dagilim: SeviyeDagilimi[];
  /** Yalnızca sıfırdan büyük satırlar. */
  dokum: TopluDokumSatiri[];
  /**
   * Seviye kodu → o basamaktaki öğrencilerin kimlikleri (16 Kasım 2026 ·
   * istek: "keşifte kim varmış örneğin görmek istiyorum"). Ekran seçilen
   * basamağın öğrencilerini bu listeden çekiyor; seviye ikinci kez
   * hesaplanmıyor, yani sayı ile liste ayrışamaz.
   */
  seviyeOgrencileri: Record<string, number[]>;
  /**
   * Öğrenci → seyir defteri (16 Kasım 2026 · istek: "her bir öğrencinin
   * bireysel aldığı puanın nereden aldığını görmek istiyor"). Öğrencinin
   * kendi ekranındaki Seyir Defteri'nin aynısı: kalem ve ADET; puan rakamı
   * 28 Ağustos 2026'dan beri hiçbir ekranda gösterilmiyor.
   */
  ogrenciDokumleri: Record<number, OgrenciDokumSatiri[]>;
}

/** Bir öğrencinin seyir defteri satırı (öğretmen ekranı için kısa etiket). */
export interface OgrenciDokumSatiri {
  kod: string;
  etiket: string;
  adet: number;
}

/**
 * Öğretmenin listesinde tek öğrencinin satırına sığan kısa adlar. Kaynak
 * etiketleri ikinci tekil ("katıldın") ya da çoğul ("katıldılar") yazılı;
 * tablo hücresinde ad biçimi okunuyor.
 */
const KISA_ETIKETLER: Record<string, string> = {
  KAYIT: "Kayıt",
  URUN: "Ürün / proje",
  CALISMA_GRUBU: "Çalışma grubu",
  KATILIM: "Etkinlik katılımı",
  MENTORLUK: "Mentörlük",
  DENEYIM: "Deneyim / sertifika / derece",
  TEMSILCILIK: "Temsilcilik",
  GENCTEK_GOREVI: "GençTek görevi",
  AKRAN_EGITIMI: "Akran eğitimi",
  EKIP: "Topluluk / ekip / kulüp",
  ETKINLIK_DUZENLEME: "Etkinlik düzenleme",
};

/**
 * YER SÜZGECİ (16 Kasım 2026 · istek: "koordinatör ilinde seçtiği ilçedeki,
 * yönetici seçtiği il ve ilçedeki öğrencilerin durumlarını görsün").
 * Kapsamın YERİNE geçmez, üstüne eklenir (bkz. ogrenciListeFiltresi):
 * koordinatörün adres çubuğuna başka il yazması boş sonuç verir.
 */
export interface YolculukYerSuzgeci {
  ilKodu?: string | null;
  ilceKodu?: string | null;
}

/** `groupBy` sonucunu "kullanıcı → adet" tablosuna çevirir. */
function sayimTablosu<T extends { _count: { _all: number } }>(
  satirlar: T[],
  anahtar: keyof T,
): Map<number, number> {
  const tablo = new Map<number, number>();
  for (const satir of satirlar) {
    const id = satir[anahtar] as number | null;
    if (id === null) continue;
    tablo.set(id, (tablo.get(id) ?? 0) + satir._count._all);
  }
  return tablo;
}

export async function ogrencilerimYolculuguGetir(
  kullanici: OturumKullanicisi,
  yer: YolculukYerSuzgeci = {},
  simdi: Date = new Date(),
): Promise<OgrencilerimYolculugu> {
  const ogrenciler = await prisma.kullanici.findMany({
    /* Danışmanda okulun tamamı — bkz. yolculukOgrenciFiltresi. */
    where: yolculukOgrenciFiltresi(kullanici, {
      ilKodu: yer.ilKodu ?? null,
      ilceKodu: yer.ilceKodu ?? null,
    }),
    select: { id: true },
  });
  const idler = ogrenciler.map((ogrenci) => ogrenci.id);

  const bos: OgrencilerimYolculugu = {
    ogrenciSayisi: 0,
    dagilim: YOLCULUK_SEVIYELERI.map((seviye) => ({
      seviye,
      ogrenciSayisi: 0,
    })),
    dokum: [],
    seviyeOgrencileri: {},
    ogrenciDokumleri: {},
  };
  if (idler.length === 0) return bos;

  /*
   * Kazanımlar tipe göre tek sorguda; ürün, deneyim ve akran eğitimi aynı
   * tablodan geliyor (öğrencinin kendi ekranıyla aynı ayrım).
   */
  const kazanimlar = await prisma.kullaniciKazanim.groupBy({
    by: ["kullaniciId", "tip"],
    where: { kullaniciId: { in: idler } },
    _count: { _all: true },
  });
  const kazanimTablosu = (...tipler: string[]): Map<number, number> =>
    sayimTablosu(
      kazanimlar.filter((satir) => tipler.includes(satir.tip)),
      "kullaniciId",
    );

  const [calismaGruplari, temsilcilikler, gencTekGorevleri] = await Promise.all(
    [
      prisma.ogrenciCalismaGrubu.groupBy({
        by: ["ogrenciId"],
        where: { ogrenciId: { in: idler } },
        _count: { _all: true },
      }),
      prisma.ogrenciGorevRolu.groupBy({
        by: ["ogrenciId"],
        where: { ogrenciId: { in: idler } },
        _count: { _all: true },
      }),
      prisma.gencTekGorevBasvurusu.groupBy({
        by: ["kullaniciId"],
        where: { kullaniciId: { in: idler }, onayDurumu: "ONAYLANDI" },
        _count: { _all: true },
      }),
    ],
  );

  const [ekipUyelikleri, mentorlukler, duzenlenenler] = await Promise.all([
    prisma.ekipUyesi.groupBy({
      by: ["kullaniciId"],
      where: { kullaniciId: { in: idler } },
      _count: { _all: true },
    }),
    prisma.mentorluk.findMany({
      where: { kullaniciId: { in: idler }, durum: "ONAYLANDI" },
      select: { kullaniciId: true },
    }),
    prisma.faaliyet.groupBy({
      by: ["duzenleyenKullaniciId"],
      where: {
        duzenleyenKullaniciId: { in: idler },
        durum: "AKTIF",
        onayDurumu: { in: ["ONAYLANDI", "ONAY_GEREKMEZ"] },
      },
      _count: { _all: true },
    }),
  ]);

  /*
   * KATILIM İKİ KAYNAKTAN BİRLEŞİYOR ve sayım `katilimSayilirMi` kuralına
   * bırakılıyor — yoklamada "gelmedi" işaretlenmiş bir öğrenciyi belgesi
   * yüzünden katılmış saymamak için. Kural burada KOPYALANMIYOR, öğrencinin
   * kendi ekranıyla aynı fonksiyondan geçiyor.
   */
  const faaliyetKosulu = { tarih: { lt: simdi }, durum: "AKTIF" as const };
  const [basvurular, belgeler] = await Promise.all([
    prisma.basvuru.findMany({
      where: {
        katilimciId: { in: idler },
        durum: "SECILDI",
        faaliyet: faaliyetKosulu,
      },
      select: {
        katilimciId: true,
        katildiMi: true,
        faaliyetId: true,
        faaliyet: { select: { tarih: true } },
      },
    }),
    prisma.faaliyetBelgesi.findMany({
      where: { katilimciId: { in: idler }, faaliyet: faaliyetKosulu },
      select: {
        katilimciId: true,
        faaliyetId: true,
        faaliyet: { select: { tarih: true } },
      },
    }),
  ]);

  type Aday = {
    tarih: Date;
    belgeVarMi: boolean;
    secildiMi: boolean;
    katildiMi: boolean | null;
  };
  // kullanıcı → (faaliyet → aday): aynı etkinlik iki kaynaktan gelirse
  // işaretler birleşir, iki kez sayılmaz.
  const adaylar = new Map<number, Map<number, Aday>>();
  const adayAl = (kullaniciId: number, faaliyetId: number, tarih: Date) => {
    let kisininki = adaylar.get(kullaniciId);
    if (!kisininki) {
      kisininki = new Map();
      adaylar.set(kullaniciId, kisininki);
    }
    let aday = kisininki.get(faaliyetId);
    if (!aday) {
      aday = { tarih, belgeVarMi: false, secildiMi: false, katildiMi: null };
      kisininki.set(faaliyetId, aday);
    }
    return aday;
  };
  for (const belge of belgeler) {
    if (belge.katilimciId === null) continue;
    adayAl(
      belge.katilimciId,
      belge.faaliyetId,
      belge.faaliyet.tarih,
    ).belgeVarMi = true;
  }
  for (const basvuru of basvurular) {
    if (basvuru.katilimciId === null) continue;
    const aday = adayAl(
      basvuru.katilimciId,
      basvuru.faaliyetId,
      basvuru.faaliyet.tarih,
    );
    aday.secildiMi = true;
    // Yoklama yalnızca başvuru satırında; belgeden gelen null bunu silmemeli.
    aday.katildiMi = basvuru.katildiMi;
  }
  const katilimTablosu = new Map<number, number>();
  for (const [kullaniciId, kisininki] of adaylar) {
    let sayi = 0;
    for (const aday of kisininki.values())
      if (katilimSayilirMi(aday)) sayi += 1;
    katilimTablosu.set(kullaniciId, sayi);
  }

  const urunler = kazanimTablosu("URUN");
  const deneyimler = kazanimTablosu(
    "DIS_ETKINLIK",
    "YARISMA_DERECESI",
    "SERTIFIKA",
  );
  const akranEgitimleri = kazanimTablosu("AKRAN_EGITIMI");
  const calismaGrubuTablosu = sayimTablosu(calismaGruplari, "ogrenciId");
  const temsilcilikTablosu = sayimTablosu(temsilcilikler, "ogrenciId");
  const gencTekGorevTablosu = sayimTablosu(gencTekGorevleri, "kullaniciId");
  const ekipTablosu = sayimTablosu(ekipUyelikleri, "kullaniciId");
  const duzenlemeTablosu = sayimTablosu(duzenlenenler, "duzenleyenKullaniciId");
  const mentorlar = new Set(mentorlukler.map((satir) => satir.kullaniciId));

  const seviyeSayaci = new Map<string, number>(
    YOLCULUK_SEVIYELERI.map((seviye) => [seviye.kod, 0]),
  );
  const kalemSayaci = new Map<string, number>();
  const seviyeOgrencileri: Record<string, number[]> = {};
  const ogrenciDokumleri: Record<number, OgrenciDokumSatiri[]> = {};

  for (const ogrenciId of idler) {
    const durum = yolculukDurumu({
      katilimSayisi: katilimTablosu.get(ogrenciId) ?? 0,
      urunSayisi: urunler.get(ogrenciId) ?? 0,
      deneyimSayisi: deneyimler.get(ogrenciId) ?? 0,
      calismaGrubuSayisi: calismaGrubuTablosu.get(ogrenciId) ?? 0,
      akranEgitimiSayisi: akranEgitimleri.get(ogrenciId) ?? 0,
      duzenlenenEtkinlikSayisi: duzenlemeTablosu.get(ogrenciId) ?? 0,
      temsilcilikSayisi: temsilcilikTablosu.get(ogrenciId) ?? 0,
      gencTekGorevSayisi: gencTekGorevTablosu.get(ogrenciId) ?? 0,
      ekipSayisi: ekipTablosu.get(ogrenciId) ?? 0,
      mentorMu: mentorlar.has(ogrenciId),
      // Öğrencinin danışmanlığı olmaz; öğretmene özel kalem burada hep sıfır.
      aktifDanismanlikSayisi: 0,
    });

    seviyeSayaci.set(
      durum.seviye.kod,
      (seviyeSayaci.get(durum.seviye.kod) ?? 0) + 1,
    );
    (seviyeOgrencileri[durum.seviye.kod] ??= []).push(ogrenciId);
    ogrenciDokumleri[ogrenciId] = durum.dokum.map((satir) => ({
      kod: satir.kod,
      etiket: KISA_ETIKETLER[satir.kod] ?? satir.etiket,
      adet: satir.adet,
    }));
    /*
     * Defter ADETLERİ topluyor, puanı değil: "GençTek Vitrin'de ürün
     * sergilediler × 6" altı üründür, altı puan değil. Puanla toplansaydı
     * ağırlığı 2 olan kalemler sayıyı şişirir ve okuyan öğretmen listede
     * olmayan kayıtlar sayardı.
     */
    for (const satir of durum.dokum) {
      kalemSayaci.set(
        satir.kod,
        (kalemSayaci.get(satir.kod) ?? 0) + satir.adet,
      );
    }
  }

  return {
    ogrenciSayisi: idler.length,
    dagilim: YOLCULUK_SEVIYELERI.map((seviye) => ({
      seviye,
      ogrenciSayisi: seviyeSayaci.get(seviye.kod) ?? 0,
    })),
    dokum: PUAN_KAYNAKLARI.map((kaynak) => ({
      kod: kaynak.kod,
      etiket: kaynak.topluEtiketi,
      adet: kalemSayaci.get(kaynak.kod) ?? 0,
    })).filter((satir) => satir.adet > 0),
    seviyeOgrencileri,
    ogrenciDokumleri,
  };
}
