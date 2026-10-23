import { kazanimGrubununTipleri } from "@/lib/kazanim/kurallar";
import { okulTuruKosulu } from "@/lib/okul/turler";
import type { Prisma } from "@/generated/prisma/client";
import type { PaydasTuru } from "@/generated/prisma/enums";
import {
  danismanKurumKodu,
  danismanMi,
  disKullaniciMi,
  KOORDINATOR_ONAYINA_TABI_ROLLER,
  koordinatorIlKodu,
  ogrenciMi,
  projeYoneticisiMi,
} from "./izinler";
import type { OturumKullanicisi } from "./tipler";

/**
 * Kapsam filtresi — references/permissions.md Bölüm 2.
 *
 * Öğrenci sorgulayan HER yol bu filtreden geçmek zorundadır; istisnası yoktur.
 * Elle yazılan filtreler er geç bir endpoint'te unutulur ve veri sızar, o
 * yüzden filtreyi tek bir yerde üretiyoruz.
 *
 * Yetki belirlenemezse filtre "hiçbir kaydı döndürmeyen" hâle döner (fail
 * closed). Yanlış tarafa düşmek, veri sızdırmaktan iyidir.
 *
 * DIŞ KULLANICILAR (mezun, paydaş temsilcisi) HER FİLTREDE AÇIKÇA ELENİR.
 * Rol kontrolüne dayanan filtreler onları zaten dışarıda bırakıyor ama İL
 * ALANINA bakan filtreler bırakmıyordu: mezunun da paydaş temsilcisinin de
 * ilKodu vardır ve "ili olan, öğrenci olmayan kullanıcı" koşulu onları içeri
 * alırdı (bkz. paydasKapsamFiltresi). Bu, filtresi yazılmamış bir ekranın
 * sessizce veri göstermesinin tam olarak nasıl olduğunu gösteren bir örnek.
 */

/** Hiçbir kaydı döndürmeyen filtre. */
const HICBIRI: Prisma.KullaniciWhereInput = { id: { in: [] } };

const AKTIF_OGRENCI: Prisma.KullaniciWhereInput = {
  roller: { some: { rolKodu: "OGRENCI", bitisTarihi: null } },
};

export function ogrenciKapsamFiltresi(
  kullanici: OturumKullanicisi,
): Prisma.KullaniciWhereInput {
  // Proje yöneticisi: filtre yok (tüm iller).
  if (projeYoneticisiMi(kullanici)) {
    return AKTIF_OGRENCI;
  }

  // İl koordinatörü: yalnızca kendi ilindeki öğrenciler. Kendi açtığı ulusal
  // faaliyete başvuran diğer il öğrencileri BURAYA dahil değildir; o erişim
  // yalnızca değerlendirme ekranındadır (bkz. ulusalBasvuranFiltresi).
  const ilKodu = koordinatorIlKodu(kullanici);
  if (ilKodu !== null) {
    return { AND: [AKTIF_OGRENCI, { ilKodu }] };
  }

  /*
   * Danışman öğretmen: KENDİ OKULUNDAKİ öğrencilerden
   *   · danışmanlığını üstlendikleri VE
   *   · hiç danışmanı olmayanlar (10 Ağustos 2026 · istek: "öğrencilerim
   *     sayfasında danışmanı olmasa da okulunda öğrenci varsa listede
   *     görünsün").
   *
   * NİYE DANIŞMANSIZLAR DA: öğretmen zaten onları danışmanlığına alabiliyor
   * ("Okulumdaki danışmansız öğrenciler" kartı) — alabildiği ama listeleyip
   * inceleyemediği bir öğrenci, kararı körlemesine vermek demekti. Tekil
   * bırakma da öğrenciyi danışmansız bıraktığı için (bkz. tekOgrenciyiBirak)
   * bırakılan öğrencinin okulunda görünmeye devam etmesi şart: aksi halde
   * bırakan öğretmenin ekranından tamamen kaybolur ve okulda kimse farkına
   * varmazdı.
   *
   * BAŞKA DANIŞMANIN ÖĞRENCİSİ HÂLÂ GÖRÜNMEZ: aynı okuldaki bir meslektaşın
   * öğrencisi bu listede yok ve olmamalı — danışmanlık kişiye özel bir bağdır,
   * "okulun tamamını gör" yetkisi il koordinatöründe.
   */
  /*
   * ATANMIŞ ÖĞRENCİ OKULDAN BAĞIMSIZ GÖRÜNÜR (23 Ekim 2026). Atamayı artık
   * proje yöneticisi yapıyor ve okul adları elle yazıldığı için aynı okul iki
   * kişide farklı kayıtta durabiliyor ("büyük küçük harf bir iki harf değişik
   * falan"). Yöneticinin bağladığı öğrenci, öğretmenin okul koduyla
   * eşleşmediği için listeden düşseydi atama kâğıt üzerinde kalırdı.
   * Danışmansız öğrenciler ise yine yalnızca öğretmenin KENDİ okulunda.
   */
  const atanmisOgrenci: Prisma.KullaniciWhereInput = {
    ogrenciAtamalari: {
      some: { danismanKullaniciId: kullanici.id, bitisTarihi: null },
    },
  };
  const kurumKodu = danismanKurumKodu(kullanici);
  if (kurumKodu !== null) {
    return {
      AND: [
        AKTIF_OGRENCI,
        {
          OR: [
            atanmisOgrenci,
            {
              kurumKodu,
              ogrenciAtamalari: { none: { bitisTarihi: null } },
            },
          ],
        },
      ],
    };
  }

  // Öğrenci: yalnızca kendisi. İl Temsilcisi / Okul Temsilcisi görev rolleri
  // burada istisna değildir — hiçbir ek görüntüleme yetkisi vermezler.
  if (ogrenciMi(kullanici)) {
    return { AND: [AKTIF_OGRENCI, { id: kullanici.id }] };
  }

  // Rolsüz öğretmen (danışmanlık işaretlemeyen) hiçbir öğrenci görmez.
  return HICBIRI;
}

/** Öğrenci listesi ekranında kullanıcının seçebildiği filtreler. */
export interface OgrenciListeFiltreleri {
  ilKodu?: string | null;
  ilceKodu?: string | null;
  kurumKodu?: number | null;
  /**
   * Okul türü ("Anadolu Lisesi", "Mesleki ve Teknik Anadolu Lisesi" gibi).
   * Kurum tablosundan gelir; öğrencide böyle bir alan yoktur.
   */
  okulTuru?: string | null;
  /** Kısmi eşleşir: "11" girildiğinde 11-A ve 11-B de gelir. */
  sinif?: string | null;
  /**
   * Eğitim-öğretim yılı ("2025-2026"). Yıllar arası karşılaştırmanın
   * dayanağıdır: geçen yılın envanteri bu filtreyle görüntülenir.
   */
  egitimOgretimYili?: string | null;
  calismaGrubuId?: number | null;
  /** Ad veya soyadda geçen metin. */
  ara?: string | null;
  /** Danışmanı olmayan öğrenciler (il koordinatörünün takip etmesi gereken durum). */
  danismansizMi?: boolean;
  /**
   * DENEYİM SÜZGECİ (15 Ağustos 2026 · Manisa farkları turu).
   *
   * Manisa panelinde öğrenciler "Deneyimler" alanına göre süzülüyor
   * ("TEKNOFEST Yarışmaları", "Bilim fuarları"). Bizde bu veri ZATEN VAR:
   * `KullaniciKazanim` tablosu GençTek dışı etkinlikleri, yarışma derecelerini,
   * sertifikaları ve toplulukları tutuyor. Eksik olan tablo değil, o veriyi
   * ARAMA EKSENİ hâline getiren süzgeçti — plandaki "yeni bir deneyim tablosu"
   * fikri uygulamada terk edildi; ikinci bir tablo mevcut modeli ikizlerdi.
   *
   * SÜZGEÇ GRUP BAZINDA (26 Ağustos 2026 · istek: "ürünlere göre,
   * topluluklara göre, deneyimlerime göre filtrelesin"). Önce tek tek tipler
   * listeleniyordu ve yanında bir de serbest metin araması vardı; ikisi de
   * kalktı. Profilde kayıtlar üç başlık altında duruyor (Ürünlerim,
   * Deneyimlerim, Topluluklarım) ve süzgeç artık aynı üçünü kullanıyor.
   */
  kazanimGrubu?: string | null;
  /**
   * GÖREV/ROL SÜZGECİ (27 Ağustos 2026 · istek: "üstteki filtrelere yeni bir
   * rol alanı ilçe temsilcisi il temsilcisi okul temsilcisi mentör şeklinde
   * açılan liste filtresi olsun").
   *
   * DÖRT DEĞERİN ÜÇÜ GÖREV, BİRİ DEĞİL: il/ilçe/okul temsilciliği
   * `ogrenci_gorev_rolu` kayıtlarıdır ve DÖNEMLİDİR — süzgeç öğrencinin kendi
   * eğitim-öğretim yılıyla eşleşen görevi arıyor, tablodaki sütunlarla aynı
   * kural (bkz. ogrenciler/page.tsx · dönem karşılaştırması). "Mentör" ise bir
   * görev değil, onaylanmış bir `Mentorluk` kaydıdır; aynı açılır listede
   * durması ekranın sorusunun ortak olmasından: "bu öğrenci ne yapıyor".
   *
   * Çalışma grubu temsilciliği listede YOK: onun kapsamı bir yer değil bir
   * gruptur ve grup süzgeci zaten ayrı bir alan.
   */
  gorevRolu?: OgrenciGorevSuzgeci | null;
}

export type OgrenciGorevSuzgeci =
  | "IL_TEMSILCISI"
  | "ILCE_TEMSILCISI"
  | "OKUL_TEMSILCISI"
  | "MENTOR";

export function ogrenciGorevSuzgeciGecerliMi(
  deger: string,
): deger is OgrenciGorevSuzgeci {
  return (
    deger === "IL_TEMSILCISI" ||
    deger === "ILCE_TEMSILCISI" ||
    deger === "OKUL_TEMSILCISI" ||
    deger === "MENTOR"
  );
}

/**
 * Kapsam filtresi + kullanıcının seçtiği filtreler.
 *
 * Seçilen filtreler kapsamın YERİNE geçmez, ÜSTÜNE eklenir: ikisi AND ile
 * bağlanır. Aksi halde adres çubuğuna `?il=06` yazan bir il koordinatörü başka
 * ilin öğrencilerini listeleyebilirdi. Bu yüzden filtreleri doğrulamak yerine
 * daraltıcı olmaya zorluyoruz — geçersiz bir değer en kötü durumda boş liste
 * verir, veri sızdırmaz.
 */
export function ogrenciListeFiltresi(
  kullanici: OturumKullanicisi,
  filtreler: OgrenciListeFiltreleri = {},
): Prisma.KullaniciWhereInput {
  const kosullar: Prisma.KullaniciWhereInput[] = [
    ogrenciKapsamFiltresi(kullanici),
  ];

  if (filtreler.ilKodu) kosullar.push({ ilKodu: filtreler.ilKodu });
  if (filtreler.ilceKodu) kosullar.push({ ilceKodu: filtreler.ilceKodu });
  if (filtreler.kurumKodu) kosullar.push({ kurumKodu: filtreler.kurumKodu });
  // Okul türü öğrencide değil bağlı olduğu kurumda durur.
  if (filtreler.okulTuru) {
    /* "Diğer" = standart listede olmayan türler (bkz. lib/okul/turler.ts). */
    kosullar.push({ kurum: okulTuruKosulu(filtreler.okulTuru) });
  }
  if (filtreler.egitimOgretimYili) {
    kosullar.push({ egitimOgretimYili: filtreler.egitimOgretimYili });
  }
  if (filtreler.sinif) {
    kosullar.push({
      sinif: { contains: filtreler.sinif, mode: "insensitive" },
    });
  }
  if (filtreler.ara) {
    kosullar.push({
      OR: [
        { ad: { contains: filtreler.ara, mode: "insensitive" } },
        { soyad: { contains: filtreler.ara, mode: "insensitive" } },
      ],
    });
  }
  /*
   * PROFİLDE ARAMA: seçilen grubun kapsadığı tiplerden EN AZ BİRİ kişide
   * varsa satır listede kalır. Tanınmayan kod süzgeci hiç uygulamıyor
   * (bkz. kazanimGrubununTipleri) — boş dizi ile sorgulamak, filtrenin
   * çalıştığını sanan kullanıcıya boş liste verirdi.
   */
  if (filtreler.kazanimGrubu) {
    const tipler = kazanimGrubununTipleri(filtreler.kazanimGrubu);
    if (tipler) {
      kosullar.push({
        kazanimlar: { some: { tip: { in: tipler as never[] } } },
      });
    }
  }

  if (filtreler.calismaGrubuId) {
    kosullar.push({
      calismaGruplari: { some: { calismaGrubuId: filtreler.calismaGrubuId } },
    });
  }
  /*
   * MENTÖR YALNIZCA ONAYLI KAYIT: bekleyen ya da reddedilmiş başvuru "mentör"
   * değildir; panodaki mentör havuzu da aynı koşulu kullanıyor.
   *
   * TEMSİLCİLİK DÖNEMLİ: `egitimOgretimYili` kıyası öğrencinin KENDİ yılıyla
   * yapılamıyor (Prisma iç içe `where` içinde ana satırın alanına başvuramaz),
   * bu yüzden görev kaydının açık olması koşuluyla yetiniliyor — kapanmış
   * görevler zaten `bitisTarihi` ile eleniyor.
   */
  if (filtreler.gorevRolu === "MENTOR") {
    kosullar.push({ mentorluk: { durum: "ONAYLANDI" } });
  } else if (filtreler.gorevRolu) {
    kosullar.push({
      gorevRolleri: { some: { rolKodu: filtreler.gorevRolu } },
    });
  }

  if (filtreler.danismansizMi) {
    kosullar.push({ ogrenciAtamalari: { none: { bitisTarihi: null } } });
  }

  return { AND: kosullar };
}

// ---------------------------------------------------------------------------
// Öğretmen envanteri
// ---------------------------------------------------------------------------

/**
 * "Öğretmen" = aktif öğrenci, merkez ve dış kullanıcı rolü olmayan kullanıcı.
 *
 * Ayrı bir kullanıcı tipi sütunu yok ve olmamalı: kimlik sağlayıcıdan gelen
 * kişi rolüyle tanımlanır. Görev almamış öğretmen de bu kümededir — envanterin
 * en çok işe yarayan satırı, henüz danışmanlık işaretlememiş öğretmendir.
 *
 * DIŞARIDA BIRAKILANLAR ve gerekçeleri:
 *   - Proje yöneticisi (YEĞİTEK personeli): okulda görevli bir öğretmen
 *     değildir, listede okulsuz satır olarak görünmesi envanteri kirletir.
 *   - Mezun ve paydaş temsilcisi: aynı gerekçenin daha keskin hâli. Küme
 *     "öğrenci OLMAYAN" diye tanımlı kaldığı sürece bu iki rol kendiliğinden
 *     içeri girer ve il koordinatörü, ilinin öğretmen envanterinde mezunları
 *     görürdü — üstelik ekran onları öğretmen sanarak branş sütunu basardı.
 */
export const OGRETMEN: Prisma.KullaniciWhereInput = {
  roller: {
    none: {
      rolKodu: {
        in: ["OGRENCI", "PROJE_YONETICISI", "MEZUN", "PAYDAS_TEMSILCISI"],
      },
      bitisTarihi: null,
    },
  },
};

/**
 * Öğretmen envanterinin kapsam filtresi — öğrencininkiyle aynı mantık.
 *
 * Danışman öğretmende bir fark var: öğrencide "kendi danışmanlığındakiler"
 * koşulu da aranıyordu, burada aranmıyor. Meslektaş listesi kişisel veri
 * bakımından daha dardır (öğretmenin sınıfı, çalışma grubu, kazanımı yok) ve
 * okuldaki diğer danışmanı görmek işbirliğinin ön koşulu.
 */
export function ogretmenKapsamFiltresi(
  kullanici: OturumKullanicisi,
): Prisma.KullaniciWhereInput {
  if (projeYoneticisiMi(kullanici)) {
    return OGRETMEN;
  }

  const ilKodu = koordinatorIlKodu(kullanici);
  if (ilKodu !== null) {
    return { AND: [OGRETMEN, { ilKodu }] };
  }

  const kurumKodu = danismanKurumKodu(kullanici);
  if (kurumKodu !== null) {
    return { AND: [OGRETMEN, { kurumKodu }] };
  }

  // Öğrenci ve görev almamış öğretmen hiçbir öğretmen kaydı görmez.
  return HICBIRI;
}

export interface OgretmenListeFiltreleri {
  ilKodu?: string | null;
  ilceKodu?: string | null;
  kurumKodu?: number | null;
  okulTuru?: string | null;
  /** Kısmi eşleşir: "Bilişim" girildiğinde "Bilişim Teknolojileri" de gelir. */
  brans?: string | null;
  /** Ad veya soyadda geçen metin. */
  ara?: string | null;
  /** Danışman olarak görev almış öğretmenler. */
  yalnizcaDanismanlar?: boolean;
  /** Danışmanlık için işaretlememiş, yani öğrenci listesinde çıkmayanlar. */
  yalnizcaGorevsizler?: boolean;
  /**
   * Görev ALDIĞI eğitim-öğretim yılı. Kullanıcının güncel yılı değil, rol
   * kaydının kapsadığı dönem sorulur: geçen yıl danışmanlık yapıp bu yıl
   * bırakan öğretmen, 2024-2025 seçildiğinde listede olmalıdır.
   */
  gorevAraligi?: { baslangic: Date; bitis: Date } | null;
}

export function ogretmenListeFiltresi(
  kullanici: OturumKullanicisi,
  filtreler: OgretmenListeFiltreleri = {},
): Prisma.KullaniciWhereInput {
  const kosullar: Prisma.KullaniciWhereInput[] = [
    ogretmenKapsamFiltresi(kullanici),
  ];

  if (filtreler.ilKodu) kosullar.push({ ilKodu: filtreler.ilKodu });
  if (filtreler.ilceKodu) kosullar.push({ ilceKodu: filtreler.ilceKodu });
  if (filtreler.kurumKodu) kosullar.push({ kurumKodu: filtreler.kurumKodu });
  if (filtreler.okulTuru) {
    /* "Diğer" = standart listede olmayan türler (bkz. lib/okul/turler.ts). */
    kosullar.push({ kurum: okulTuruKosulu(filtreler.okulTuru) });
  }
  if (filtreler.brans) {
    kosullar.push({ brans: { contains: filtreler.brans, mode: "insensitive" } });
  }
  if (filtreler.ara) {
    kosullar.push({
      OR: [
        { ad: { contains: filtreler.ara, mode: "insensitive" } },
        { soyad: { contains: filtreler.ara, mode: "insensitive" } },
      ],
    });
  }
  if (filtreler.yalnizcaDanismanlar) {
    kosullar.push({
      roller: { some: { rolKodu: "DANISMAN", bitisTarihi: null } },
    });
  }
  if (filtreler.yalnizcaGorevsizler) {
    kosullar.push({ roller: { none: { bitisTarihi: null } } });
  }
  if (filtreler.gorevAraligi) {
    /*
     * Aralık ÇAKIŞMASI aranır, kapsanması değil: 1 Eylül'de başlayıp yıl
     * ortasında biten bir görev de o yıla aittir. Süren görevin bitişi NULL
     * olduğundan ayrıca ele alınır.
     */
    const { baslangic, bitis } = filtreler.gorevAraligi;
    kosullar.push({
      roller: {
        some: {
          baslangicTarihi: { lte: bitis },
          OR: [{ bitisTarihi: null }, { bitisTarihi: { gte: baslangic } }],
        },
      },
    });
  }

  return { AND: kosullar };
}

// ---------------------------------------------------------------------------
// Paydaş envanteri
// ---------------------------------------------------------------------------

/** Hiçbir paydaş döndürmeyen filtre. */
const PAYDAS_HICBIRI: Prisma.PaydasWhereInput = { id: { in: [] } };

/**
 * Paydaş envanteri il bazlıdır: koordinatör kendi ilini, danışman öğretmen
 * kendi ilini (okulunu değil — iş birliği il düzeyinde kurulur), YEĞİTEK
 * tüm illeri görür.
 *
 * Öğrenci ve ili belli olmayan kullanıcı hiçbir kayıt görmez.
 *
 * KOORDİNATÖRDE BİR EK KOŞUL VAR: kendi eklediği kayıtları, başka bir ile
 * yazmış olsa bile görür. Koordinatör başka ildeki bir üniversiteyle iş
 * birliği kurabildiği için (bkz. paydasEkleyebilirMi) bu koşul olmasaydı
 * eklediği kayıt kaydettiği anda listesinden kaybolurdu.
 *
 * İl bağı bundan etkilenmez: kaydı ekleyen koordinatör görevden ayrılsa da
 * kayıt ilinde durmaya devam eder ve yeni koordinatör onu devralır.
 */
export function paydasKapsamFiltresi(
  kullanici: OturumKullanicisi,
): Prisma.PaydasWhereInput {
  if (projeYoneticisiMi(kullanici)) return {};

  const koordinatorIli = koordinatorIlKodu(kullanici);
  if (koordinatorIli !== null) {
    return {
      OR: [{ ilKodu: koordinatorIli }, { ekleyenKullaniciId: kullanici.id }],
    };
  }

  /*
   * Dış kullanıcı burada AÇIKÇA eleniyor. Koşul "ili olan, öğrenci olmayan"
   * dediği için paydaş temsilcisi kendi ilinin TÜM paydaş envanterini —
   * yetkili kişi adları ve doğrudan iletişim bilgileriyle birlikte —
   * görecekti. Mezun için de aynısı geçerliydi.
   */
  if (
    kullanici.ilKodu !== null &&
    !ogrenciMi(kullanici) &&
    !disKullaniciMi(kullanici)
  ) {
    return { ilKodu: kullanici.ilKodu };
  }

  return PAYDAS_HICBIRI;
}

export interface PaydasListeFiltreleri {
  ilKodu?: string | null;
  tur?: PaydasTuru | null;
  /** Kurum adı, yetkili kişi ya da iş birliği alanında geçen metin. */
  ara?: string | null;
  /**
   * YALNIZCA KURUM ADINDA arama (31 Ağustos 2026 · istek: "Kurum / Tür / İl —
   * bunlar filtreli").
   *
   * NİYE `ara`DAN AYRI: `ara` üç alana birden bakıyor (kurum, yetkili kişi, iş
   * birliği alanı) ve genel arama kutusunun karşılığı. Sütun süzgeci ise
   * SÜTUNUN kendisini süzüyor — "Kurum" başlığının altındaki kutuya yazılan
   * metin, yetkili kişinin adında eşleşip kurumla ilgisiz bir satır
   * döndürseydi süzgeç yalan söylerdi.
   *
   * İkisi bir arada kullanılabilir ve ikisi de daraltır: koşullar `AND`
   * zincirine ayrı ayrı giriyor.
   */
  kurum?: string | null;
  /** Pasife alınmış kayıtlar da listelensin mi? */
  pasifleriDeGoster?: boolean;
}

export function paydasListeFiltresi(
  kullanici: OturumKullanicisi,
  filtreler: PaydasListeFiltreleri = {},
): Prisma.PaydasWhereInput {
  const kosullar: Prisma.PaydasWhereInput[] = [paydasKapsamFiltresi(kullanici)];

  if (filtreler.ilKodu) kosullar.push({ ilKodu: filtreler.ilKodu });
  if (filtreler.tur) kosullar.push({ tur: filtreler.tur });
  if (filtreler.kurum) {
    kosullar.push({ ad: { contains: filtreler.kurum, mode: "insensitive" } });
  }
  if (!filtreler.pasifleriDeGoster) kosullar.push({ aktif: true });
  if (filtreler.ara) {
    kosullar.push({
      OR: [
        { ad: { contains: filtreler.ara, mode: "insensitive" } },
        { yetkiliKisi: { contains: filtreler.ara, mode: "insensitive" } },
        { isBirligiAlani: { contains: filtreler.ara, mode: "insensitive" } },
      ],
    });
  }

  return { AND: kosullar };
}

/**
 * Ulusal faaliyet istisnası — references/permissions.md Bölüm 3.
 *
 * İl koordinatörü, KENDİ AÇTIĞI ulusal faaliyete başvurmuş öğrencileri başka
 * ilden olsalar da görebilir. Bu erişim yalnızca başvuru değerlendirme
 * ekranındadır; envanter, arama ve raporlamada geçerli değildir.
 */
export function ulusalBasvuranFiltresi(
  kullanici: OturumKullanicisi,
  faaliyetId: number,
  /**
   * Düzenleyen görevden ayrıldığı için yetkinin devrolduğu durum. Kararı bu
   * fonksiyon veremez (düzenleyenin rol durumunu bilmez), çağıran
   * `yetkiDevrolduMu` ile hesaplayıp geçer.
   */
  yetkiDevroldu = false,
): Prisma.BasvuruWhereInput {
  if (projeYoneticisiMi(kullanici) || yetkiDevroldu) {
    return { faaliyetId };
  }
  return {
    faaliyetId,
    faaliyet: { duzenleyenKullaniciId: kullanici.id },
  };
}

/**
 * Değerlendirme ekranında gösterilebilecek asgari KATILIMCI alanları.
 * Telefon ve e-posta BİLİNÇLİ olarak yoktur.
 *
 * Katılımcı öğretmen de olabildiği için branş ve aktif rol de seçilir:
 * değerlendiren kişi karşısındakinin öğrenci mi öğretmen mi olduğunu
 * görmeden karar veremez.
 */
export const DEGERLENDIRME_KATILIMCI_ALANLARI = {
  id: true,
  ad: true,
  soyad: true,
  sinif: true,
  brans: true,
  ilKodu: true,
  il: { select: { ad: true } },
  kurum: { select: { ad: true } },
  roller: {
    where: { bitisTarihi: null },
    select: { rolKodu: true },
  },
  calismaGruplari: { select: { calismaGrubu: { select: { ad: true } } } },
} as const;

/**
 * Faaliyet görünürlük filtresi. Onay bekleyen faaliyet yalnızca düzenleyene,
 * onaylamaya yetkili olana ve proje yöneticisine görünür; öğrenciye yalnızca
 * kendi kapsamındaki onaylı faaliyetler listelenir.
 */
export function faaliyetKapsamFiltresi(
  kullanici: OturumKullanicisi,
): Prisma.FaaliyetWhereInput {
  if (projeYoneticisiMi(kullanici)) {
    return {};
  }

  /*
   * İl koordinatörü, kendi ilinde açılmış ONAY BEKLEYEN faaliyeti görür —
   * onaylayacak kişi onaylayacağı şeyi göremezse öneri hiç ulaşmamış olurdu
   * (bkz. ilKoordinatoruOnaylayabilirMi).
   *
   * ROL LİSTESİ ARTIK ELLE YAZILMIYOR (11 Ağustos 2026). Buradaki liste ile
   * `ilKoordinatoruOnaylayabilirMi`nin kabul ettiği roller İKİ KEZ AYRIŞTI:
   * önce danışman öğretmen onaya tabi kılınıp filtre unutuldu, sonra aynısı
   * mezun/paydaş/mentör için tekrarlandı. Her seferinde sonuç sessiz bir
   * kilitlenmeydi: faaliyet BEKLIYOR'da kalıyor, koordinatör onu ne listede ne
   * adresinde görebiliyor (404), "onayınızı bekliyor" bildirimi de bulunamayan
   * bir sayfaya götürüyordu. Hiçbir yerde hata çıkmıyordu.
   *
   * İki taraf da KOORDINATOR_ONAYINA_TABI_ROLLER'dan türüyor; ayrışma artık
   * yapısal olarak mümkün değil.
   */
  const koordinatorIli = koordinatorIlKodu(kullanici);
  const onaylayabilecekleri: Prisma.FaaliyetWhereInput[] =
    koordinatorIli !== null
      ? [
          {
            onayDurumu: "BEKLIYOR",
            duzenleyen: {
              roller: {
                some: {
                  rolKodu: { in: [...KOORDINATOR_ONAYINA_TABI_ROLLER] },
                  bitisTarihi: null,
                },
              },
            },
            /*
             * Faaliyetin ili, `faaliyetKapsamiCikar`'daki sırayla çözülür:
             * kapsam alanı → okulun ili → düzenleyenin ili. Okul içi faaliyette
             * il kodu boştur (okulunki geçerlidir), ulusal öneride ikisi de
             * boştur ve karar düzenleyenin ilindeki koordinatöre düşer.
             */
            OR: [
              { ilKodu: koordinatorIli },
              { ilKodu: null, kurum: { ilKodu: koordinatorIli } },
              {
                ilKodu: null,
                kurumKodu: null,
                duzenleyen: { ilKodu: koordinatorIli },
              },
            ],
          },
        ]
      : [];

  const yayindaOlanlar: Prisma.FaaliyetWhereInput = {
    onayDurumu: { in: ["ONAY_GEREKMEZ", "ONAYLANDI"] },
    OR: [
      /* Ulusal ve uluslararası çağrılar herkese görünür. */
      { kapsam: "ULUSAL" },
      { kapsam: "ULUSLARARASI" },
      ...(kullanici.kurumKodu !== null
        ? [{ kapsam: "OKUL" as const, kurumKodu: kullanici.kurumKodu }]
        : []),
      ...(kullanici.ilKodu !== null
        ? [{ kapsam: "IL" as const, ilKodu: kullanici.ilKodu }]
        : []),
      // İl koordinatörü kendi ilinin okul içi faaliyetlerini de görür.
      ...(koordinatorIli !== null
        ? [{ kapsam: "OKUL" as const, kurum: { ilKodu: koordinatorIli } }]
        : []),
    ],
  };

  // Kişinin kendi açtığı faaliyetler onay durumundan bağımsız görünür.
  return {
    OR: [
      { duzenleyenKullaniciId: kullanici.id },
      ...onaylayabilecekleri,
      yayindaOlanlar,
    ],
  };
}

/**
 * Danışman seçim listesi filtresi: aynı kurum kodundaki, danışmanlık için
 * işaretlenmiş öğretmenler.
 */
export function danismanAdayiFiltresi(
  kurumKodu: number,
): Prisma.KullaniciWhereInput {
  return {
    kurumKodu,
    aktif: true,
    ogretmenProfil: { danismanOlmakIstiyor: true },
    // İl koordinatörü olan öğretmen danışman listesinde çıkmaz.
    NOT: {
      roller: { some: { rolKodu: "IL_KOORDINATOR", bitisTarihi: null } },
    },
  };
}

// ---------------------------------------------------------------------------
// İl dışına giden başvurular
// ---------------------------------------------------------------------------

/** Hiçbir başvuru döndürmeyen filtre. */
const BASVURU_HICBIRI: Prisma.BasvuruWhereInput = { id: { in: [] } };

/**
 * İl koordinatörünün, KENDİ ilinden başka bir ilin etkinliğine giden
 * başvuruları — analiz isteği Bölüm 4.
 *
 * `ogrenciKapsamFiltresi`den farkı: orası "ilimdeki öğrenciler" sorusunu
 * cevaplar, burası "ilimden çıkan başvurular". İkisi ayrı çünkü koordinatörün
 * burada gördüğü şey öğrencinin kendisi değil, onun başka bir ile yaptığı tekil
 * bir başvurudur.
 *
 * Faaliyetin ili kaydın kendisinden okunamadığı için (okul içi faaliyette
 * okulun, ulusal faaliyette düzenleyenin ili geçerli) filtre "kaynak il onayı
 * BEKLİYOR ya da karara bağlanmış" kayıtlar üzerinden kurulur: o alan yalnızca
 * il dışı başvuruda doldurulur, dolayısıyla il karşılaştırmasını tekrar etmeye
 * gerek kalmaz.
 *
 * Proje yöneticisi hepsini görür; başka hiçbir rol bu listeyi görmez.
 */
export function ilDisiBasvuruFiltresi(
  kullanici: OturumKullanicisi,
): Prisma.BasvuruWhereInput {
  const ilDisiKayit: Prisma.BasvuruWhereInput = {
    kaynakIlOnayDurumu: { not: "ONAY_GEREKMEZ" },
  };

  if (projeYoneticisiMi(kullanici)) return ilDisiKayit;

  const ilKodu = koordinatorIlKodu(kullanici);
  if (ilKodu === null) return BASVURU_HICBIRI;

  // Katılımcının ili = kaynak il. Koordinatör yalnızca KENDİ ilinden çıkan
  // başvuruya karar verir; hedef ildeki karar düzenleyenin değerlendirmesidir.
  return { AND: [ilDisiKayit, { katilimci: { ilKodu } }] };
}

// ---------------------------------------------------------------------------
// İletişim modülü
// ---------------------------------------------------------------------------

/**
 * Kullanıcının GÖREBİLECEĞİ yazışmalar — analiz isteği Bölüm 6.
 *
 * GİZLİ KANAL YOKTUR. Bir yazışmayı şunlar görür:
 *   - tarafların kendisi
 *   - tarafların danışman öğretmenleri
 *   - tarafların illerinin koordinatörleri
 *   - proje yöneticileri (hepsi)
 *
 * Danışmanlık "aktif atama" üzerinden okunur, okul eşitliğinden DEĞİL: aynı
 * okuldaki başka bir danışmanın, kendi öğrencisi olmayan birinin yazışmasını
 * okuması gerekmiyor. Kapsam gereğinden geniş tutulursa modülün kendisi bir
 * veri sızıntısı kaynağına dönüşür.
 */
export function yazismaKapsamFiltresi(
  kullanici: OturumKullanicisi,
): Prisma.YazismaWhereInput {
  if (projeYoneticisiMi(kullanici)) return {};

  const taraflar: Prisma.BaglantiIstegiWhereInput[] = [
    { isteyenKullaniciId: kullanici.id },
    { hedefKullaniciId: kullanici.id },
  ];

  const koordinatorIli = koordinatorIlKodu(kullanici);
  if (koordinatorIli !== null) {
    taraflar.push(
      { isteyen: { ilKodu: koordinatorIli } },
      { hedef: { ilKodu: koordinatorIli } },
    );
  }

  if (danismanMi(kullanici)) {
    const danismanlik = {
      ogrenciAtamalari: {
        some: { danismanKullaniciId: kullanici.id, bitisTarihi: null },
      },
    };
    taraflar.push({ isteyen: danismanlik }, { hedef: danismanlik });
  }

  return { baglantiIstegi: { OR: taraflar } };
}

/**
 * Kullanıcının karar verebileceği bağlantı istekleri.
 *
 * Onaylayan, İSTEĞİ YAPANIN danışmanı ya da ilinin koordinatörü olabilir.
 * Yalnızca koordinatöre bırakılsaydı il başına tek kişi yüzlerce isteğin
 * darboğazı olurdu; danışman öğrencisini zaten tanıyor.
 *
 * Hedefin tarafı karar VERMEZ: bu bir "kabul ediyor musun" sorusu değil,
 * "öğrencimin bu teması kurmasına izin veriyor muyum" sorusudur.
 */
export function baglantiKarariFiltresi(
  kullanici: OturumKullanicisi,
): Prisma.BaglantiIstegiWhereInput {
  if (projeYoneticisiMi(kullanici)) return {};

  const kosullar: Prisma.BaglantiIstegiWhereInput[] = [];

  const koordinatorIli = koordinatorIlKodu(kullanici);
  if (koordinatorIli !== null) {
    kosullar.push({ isteyen: { ilKodu: koordinatorIli } });
  }

  if (danismanMi(kullanici)) {
    kosullar.push({
      isteyen: {
        ogrenciAtamalari: {
          some: { danismanKullaniciId: kullanici.id, bitisTarihi: null },
        },
      },
    });
  }

  if (kosullar.length === 0) return { id: { in: [] } };
  return { OR: kosullar };
}

/**
 * Raporlanabilecek faaliyetler — il koordinatörünün rapor modülü.
 *
 * Kapsam, GÖRÜNÜRLÜKTEN DAR: koordinatör başka illerin ulusal faaliyetlerini
 * listede görebiliyor ama onların raporunu yazmaz. Filtre bu yüzden faaliyetin
 * İLİNE bakar, görünürlük kurallarına değil.
 *
 * "İl" hesabı kapsam alanlarından okunamaz: okul içi faaliyette okulun ili,
 * ulusal faaliyette düzenleyenin ili geçerlidir (bkz. faaliyetKapsamiCikar).
 * Sorgu üçünü de kapsıyor.
 */
export function raporlanabilirFaaliyetFiltresi(
  kullanici: OturumKullanicisi,
): Prisma.FaaliyetWhereInput {
  if (projeYoneticisiMi(kullanici)) return {};

  const ilKodu = koordinatorIlKodu(kullanici);
  if (ilKodu !== null) {
    return {
      OR: [
        { ilKodu },
        { kurum: { ilKodu } },
        { duzenleyen: { ilKodu } },
        // Kendi açtığı faaliyet her koşulda kendisine ait.
        { duzenleyenKullaniciId: kullanici.id },
      ],
    };
  }

  // Danışman öğretmen yalnızca KENDİ açtığı faaliyetin raporunu yazar.
  return { duzenleyenKullaniciId: kullanici.id };
}
