import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "../db";
import { OGRETMEN } from "../yetki/kapsam";

/**
 * Rol/Atama Envanteri — proje yöneticisinin "hangi il koordinatörsüz, hangi
 * okul danışmansız" sorusunun toplu cevabı.
 *
 * YENİ TABLO YOKTUR: bu dosya kullanici_rol (aktif il koordinatörlükleri) ve
 * danisman_atama (aktif atamalar) üzerine yazılmış bir rapor katmanıdır. İl
 * koordinatörünün kendi ilinde gördüğü "danışmansız okullar" listesiyle aynı
 * sorgu mantığıdır; buradaki tek fark il filtresinin olmamasıdır
 * (references/permissions.md — "Rol/atama envanterini görüntüleme" satırı).
 *
 * Yetki kontrolü burada YAPILMAZ; çağıran ekran rolEnvanteriGorebilirMi ile
 * kapıyı tutar.
 */

const AKTIF_OGRENCI: Prisma.KullaniciWhereInput = {
  aktif: true,
  roller: { some: { rolKodu: "OGRENCI", bitisTarihi: null } },
};

/** Aktif danışman ataması olmayan öğrenci. */
const ATANMAMIS: Prisma.KullaniciWhereInput = {
  ogrenciAtamalari: { none: { bitisTarihi: null } },
};

export interface IlKoordinatorDurumu {
  ilKodu: string;
  ilAdi: string;
  koordinator: {
    kullaniciId: number;
    ad: string;
    soyad: string;
    brans: string | null;
    atamaTarihi: Date;
    /**
     * İLETİŞİM BİLGİSİ (27 Ağustos 2026 · istek: "eposta ve telefon numarası
     * sütunlarını ekleyelim").
     *
     * Kaynağı `OgretmenProfil` — kişinin KENDİ girdiği bilgi; e-Okul'dan
     * gelmiyor ve senkronda üzerine yazılmıyor. Tablonun adı tarihsel, içeriği
     * "öğrenci olmayan kullanıcının iletişim bilgisi" (bkz. schema.prisma).
     * Dolayısıyla kayıt hiç açılmamışsa ikisi de `null` olur; ekran boş hücre
     * basar, uydurma bir adres göstermez.
     */
    eposta: string | null;
    telefon: string | null;
    /** Atamanın serbest metin notu; bkz. schema.prisma · KullaniciRol.aciklama. */
    aciklama: string | null;
  } | null;
  ogrenciSayisi: number;
  /**
   * İldeki öğretmen sayısı (11 Ağustos 2026 · istek: "rol atama envanterinde
   * Atanma tarihi yerine o ildeki öğretmen sayısı gelsin").
   *
   * "Öğretmen" tanımı ENVANTERLE AYNI kaynaktan geliyor (kapsam.ts · OGRETMEN):
   * öğrenci, merkez personeli, mezun ve paydaş temsilcisi hariç herkes. Tanım
   * burada yeniden yazılsaydı, aynı ilin öğretmen sayısı bu ekranda başka,
   * Öğretmenler ekranında başka görünürdü.
   */
  ogretmenSayisi: number;
  /**
   * Danışmanı da koordinatörü de olmayan öğrenciler. Koordinatör boşaldığında
   * bu sayı sıfırdan büyük olur ve ekranda kırmızı uyarı olarak gösterilir.
   */
  atanmamisOgrenciSayisi: number;
  /**
   * İlde koordinatör olarak atanabilecek öğretmen sayısı (27 Ekim 2026 ·
   * istek: "hangi illerde görevli öğretmen var hangisi atamaya uygun bunu
   * ayırt etmek zor oluyor"). Koşul aday listesininkiyle AYNIDIR
   * (bkz. ADAY_KOSULU): sayı 3 diyorsa liste açıldığında 3 kişi çıkar.
   */
  adaySayisi: number;
}

/**
 * Koordinatör adayı olabilecek kullanıcı — aday listesi ile il tablosundaki
 * aday sayısı bu tek tanımı paylaşır.
 *
 * Öğrenciye koordinatörlük verilmez; başka ilin koordinatörü de aday olamaz.
 *
 * MEZUN ve PAYDAS_TEMSILCISI de elenir: ikisinin de iletişim bilgisi
 * ogretmen_profil'de tutuluyor (tablonun adı tarihsel, içeriği "öğrenci
 * olmayanın iletişim bilgisi") ve ilKodu'ları var — koşul buna bakmasaydı bir
 * mezun, ilinin koordinatör aday listesinde çıkardı.
 */
const ADAY_KOSULU: Prisma.KullaniciWhereInput = {
  aktif: true,
  ogretmenProfil: { isNot: null },
  roller: {
    none: {
      bitisTarihi: null,
      rolKodu: {
        in: ["OGRENCI", "IL_KOORDINATOR", "MEZUN", "PAYDAS_TEMSILCISI"],
      },
    },
  },
};

export async function ilKoordinatorDurumlari(): Promise<IlKoordinatorDurumu[]> {
  const [
    iller,
    roller,
    ogrenciSayilari,
    atanmamisSayilari,
    ogretmenSayilari,
    adaySayilari,
  ] = await Promise.all([
    prisma.il.findMany({
      orderBy: { ad: "asc" },
      select: { ilKodu: true, ad: true },
    }),
    prisma.kullaniciRol.findMany({
      where: { rolKodu: "IL_KOORDINATOR", bitisTarihi: null },
      select: {
        ilKodu: true,
        baslangicTarihi: true,
        aciklama: true,
        kullanici: {
          select: {
            id: true,
            ad: true,
            soyad: true,
            brans: true,
            ogretmenProfil: { select: { eposta: true, telefon: true } },
          },
        },
      },
    }),
    prisma.kullanici.groupBy({
      by: ["ilKodu"],
      where: AKTIF_OGRENCI,
      _count: { _all: true },
    }),
    prisma.kullanici.groupBy({
      by: ["ilKodu"],
      where: { AND: [AKTIF_OGRENCI, ATANMAMIS] },
      _count: { _all: true },
    }),
    prisma.kullanici.groupBy({
      by: ["ilKodu"],
      where: { AND: [{ aktif: true }, OGRETMEN] },
      _count: { _all: true },
    }),
    prisma.kullanici.groupBy({
      by: ["ilKodu"],
      where: ADAY_KOSULU,
      _count: { _all: true },
    }),
  ]);

  const koordinatorHaritasi = new Map(
    roller
      .filter((rol) => rol.ilKodu !== null)
      .map((rol) => [rol.ilKodu as string, rol]),
  );
  const ogrenciHaritasi = sayimHaritasi(ogrenciSayilari);
  const atanmamisHaritasi = sayimHaritasi(atanmamisSayilari);
  const ogretmenHaritasi = sayimHaritasi(ogretmenSayilari);
  const adayHaritasi = sayimHaritasi(adaySayilari);

  return iller.map((il) => {
    const rol = koordinatorHaritasi.get(il.ilKodu);
    return {
      ilKodu: il.ilKodu,
      ilAdi: il.ad,
      koordinator: rol
        ? {
            kullaniciId: rol.kullanici.id,
            ad: rol.kullanici.ad,
            soyad: rol.kullanici.soyad,
            brans: rol.kullanici.brans,
            atamaTarihi: rol.baslangicTarihi,
            eposta: rol.kullanici.ogretmenProfil?.eposta ?? null,
            telefon: rol.kullanici.ogretmenProfil?.telefon ?? null,
            aciklama: rol.aciklama,
          }
        : null,
      ogrenciSayisi: ogrenciHaritasi.get(il.ilKodu) ?? 0,
      ogretmenSayisi: ogretmenHaritasi.get(il.ilKodu) ?? 0,
      atanmamisOgrenciSayisi: atanmamisHaritasi.get(il.ilKodu) ?? 0,
      adaySayisi: adayHaritasi.get(il.ilKodu) ?? 0,
    };
  });
}

function sayimHaritasi(
  satirlar: { ilKodu: string | null; _count: { _all: number } }[],
): Map<string, number> {
  return new Map(
    satirlar
      .filter((satir) => satir.ilKodu !== null)
      .map((satir) => [satir.ilKodu as string, satir._count._all]),
  );
}

export interface KurumDanismanDurumu {
  kurumKodu: number;
  kurumAdi: string;
  ilKodu: string;
  ilAdi: string;
  ilceAdi: string;
  danismanSayisi: number;
  ogrenciSayisi: number;
  /**
   * Okul danışmansızsa öğrencilerin düştüğü il koordinatörü. Null ise ilin de
   * koordinatörü yok demektir: öğrenciler atanmamış durumdadır.
   */
  ilKoordinatoru: { ad: string; soyad: string } | null;
}

/**
 * Kurum bazında danışman ve öğrenci sayıları.
 *
 * Yalnızca sisteme kayıtlı ÖĞRENCİSİ ya da DANIŞMANI olan kurumlar listelenir:
 * MEB referans tablosundaki on binlerce okulun tamamını göstermek envanteri
 * okunmaz hale getirirdi.
 */
export async function kurumDanismanDurumlari(): Promise<KurumDanismanDurumu[]> {
  const [ogrenciSayilari, danismanSayilari, koordinatorler] = await Promise.all([
    prisma.kullanici.groupBy({
      by: ["kurumKodu"],
      where: AKTIF_OGRENCI,
      _count: { _all: true },
    }),
    prisma.kullaniciRol.groupBy({
      by: ["kurumKodu"],
      where: { rolKodu: "DANISMAN", bitisTarihi: null },
      _count: { _all: true },
    }),
    prisma.kullaniciRol.findMany({
      where: { rolKodu: "IL_KOORDINATOR", bitisTarihi: null },
      select: {
        ilKodu: true,
        kullanici: { select: { ad: true, soyad: true } },
      },
    }),
  ]);

  const ogrenciHaritasi = new Map(
    ogrenciSayilari
      .filter((satir) => satir.kurumKodu !== null)
      .map((satir) => [satir.kurumKodu as number, satir._count._all]),
  );
  const danismanHaritasi = new Map(
    danismanSayilari
      .filter((satir) => satir.kurumKodu !== null)
      .map((satir) => [satir.kurumKodu as number, satir._count._all]),
  );

  const kurumKodlari = [
    ...new Set([...ogrenciHaritasi.keys(), ...danismanHaritasi.keys()]),
  ];
  if (kurumKodlari.length === 0) return [];

  const kurumlar = await prisma.kurum.findMany({
    where: { kurumKodu: { in: kurumKodlari } },
    select: {
      kurumKodu: true,
      ad: true,
      ilKodu: true,
      il: { select: { ad: true } },
      ilce: { select: { ad: true } },
    },
  });

  const koordinatorHaritasi = new Map(
    koordinatorler
      .filter((rol) => rol.ilKodu !== null)
      .map((rol) => [rol.ilKodu as string, rol.kullanici]),
  );

  return kurumlar
    .map((kurum) => ({
      kurumKodu: kurum.kurumKodu,
      kurumAdi: kurum.ad,
      ilKodu: kurum.ilKodu,
      ilAdi: kurum.il.ad,
      ilceAdi: kurum.ilce.ad,
      danismanSayisi: danismanHaritasi.get(kurum.kurumKodu) ?? 0,
      ogrenciSayisi: ogrenciHaritasi.get(kurum.kurumKodu) ?? 0,
      ilKoordinatoru: koordinatorHaritasi.get(kurum.ilKodu) ?? null,
    }))
    // Danışmansız okullar başa: ekranın asıl işi boşlukları göstermek.
    .sort((a, b) => {
      if (a.danismanSayisi !== b.danismanSayisi) {
        return a.danismanSayisi - b.danismanSayisi;
      }
      return a.kurumAdi.localeCompare(b.kurumAdi, "tr");
    });
}

export interface KoordinatorAdayi {
  kullaniciId: number;
  ad: string;
  soyad: string;
  brans: string | null;
  kurumAdi: string | null;
  /** Kişinin kendi girdiği iletişim bilgisi; bkz. IlKoordinatorDurumu. */
  eposta: string | null;
  telefon: string | null;
  /** Şu an danışman öğretmen mi? Atama yapılırsa öğrencileri dağıtılacak. */
  danismanMi: boolean;
  danismanliktakiOgrenciSayisi: number;
}

/**
 * Bir ile koordinatör olarak atanabilecek öğretmenler.
 *
 * Danışman öğretmenler LİSTEDEN ÇIKARILMAZ: atama engellenmez, yalnızca kaç
 * öğrencisinin yeniden dağıtılacağı gösterilir (domain-rules.md Bölüm 3).
 */
export async function koordinatorAdaylari(
  ilKodu: string,
): Promise<KoordinatorAdayi[]> {
  const ogretmenler = await prisma.kullanici.findMany({
    where: { AND: [{ ilKodu }, ADAY_KOSULU] },
    orderBy: [{ ad: "asc" }, { soyad: "asc" }],
    select: {
      id: true,
      ad: true,
      soyad: true,
      brans: true,
      kurum: { select: { ad: true } },
      /* Aday listesi de iletişim sütunlarını basıyor (27 Ağustos 2026): atamayı
         yapan kişi, aday hakkında ilin tablosunda göreceği bilgilerin aynısını
         önce burada görüyor. */
      ogretmenProfil: { select: { eposta: true, telefon: true } },
      roller: {
        where: { bitisTarihi: null, rolKodu: "DANISMAN" },
        select: { id: true },
      },
      _count: {
        select: { danismanAtamalari: { where: { bitisTarihi: null } } },
      },
    },
  });

  return ogretmenler.map((ogretmen) => ({
    kullaniciId: ogretmen.id,
    ad: ogretmen.ad,
    soyad: ogretmen.soyad,
    brans: ogretmen.brans,
    kurumAdi: ogretmen.kurum?.ad ?? null,
    eposta: ogretmen.ogretmenProfil?.eposta ?? null,
    telefon: ogretmen.ogretmenProfil?.telefon ?? null,
    danismanMi: ogretmen.roller.length > 0,
    danismanliktakiOgrenciSayisi: ogretmen._count.danismanAtamalari,
  }));
}
