/**
 * OKUL EŞLEŞTİRME — veritabanı işlemleri (9 Kasım 2026). Kurallar ve
 * gerekçesi: ./eslestirme.ts.
 *
 * YETKİ BURADA SORULMAZ: çağıran eylem `okulEslestirebilirMi` ile kişinin ve
 * okulun ilini denetler. Burada denetlenen VERİ TUTARLILIĞI: kişi ile okul
 * aynı ilde mi, kişi hâlâ okulsuz mu, okul aktif mi.
 */
import type { RolKodu } from "@/generated/prisma/enums";
import { prisma } from "../db";
import { erisimLogla } from "../yetki/log";
import {
  GECICI_KURUM_KODU_TABANI,
  OKUL_ADI_UST_SINIRI,
  okulAdiAnahtari,
  sonrakiGeciciKurumKodu,
} from "./eslestirme";
import { kapsamDisiOkulTuruMu } from "./turler";

/**
 * Eşleştirmeye giren roller: öğrenci, danışman öğretmen ve il koordinatörü
 * (hepsi bir okulun mensubu). Proje yöneticisi bir okula bağlı değildir;
 * mezun ve paydaş temsilcisinin okul kaydı başvurusunda durur.
 */
const ESLESEN_ROLLER: RolKodu[] = ["OGRENCI", "DANISMAN", "IL_KOORDINATOR"];

const ROL_ETIKETLERI: Partial<Record<RolKodu, string>> = {
  OGRENCI: "Öğrenci",
  DANISMAN: "Danışman öğretmen",
  IL_KOORDINATOR: "İl koordinatörü",
};

function rolEtiketi(roller: { rolKodu: RolKodu }[]): string {
  // Öğretmen rolleri öğrenciden önce: bir kişide ikisi birden olmaz ama
  // olursa etiket daha az şaşırtan yönde yanılsın.
  for (const kod of ["IL_KOORDINATOR", "DANISMAN", "OGRENCI"] as const) {
    if (roller.some((rol) => rol.rolKodu === kod)) return ROL_ETIKETLERI[kod]!;
  }
  return "Kullanıcı";
}

const okulsuzKosulu = {
  aktif: true,
  kurumKodu: null,
  beyanOkulAdi: { not: null },
  roller: { some: { bitisTarihi: null, rolKodu: { in: ESLESEN_ROLLER } } },
};

export type OkulsuzKisi = {
  id: number;
  ad: string;
  soyad: string;
  ilKodu: string | null;
  ilceKodu: string | null;
  beyanOkulAdi: string;
  beyanOkulTuru: string | null;
  sinif: string | null;
  brans: string | null;
  rol: string;
};

/** İldeki okulsuz kişiler (okulunu elle yazmış olanlar). */
export async function okulsuzKisiler(ilKodu: string): Promise<OkulsuzKisi[]> {
  const satirlar = await prisma.kullanici.findMany({
    where: { ...okulsuzKosulu, ilKodu },
    orderBy: [{ ad: "asc" }, { soyad: "asc" }],
    select: {
      id: true,
      ad: true,
      soyad: true,
      ilKodu: true,
      ilceKodu: true,
      beyanOkulAdi: true,
      beyanOkulTuru: true,
      sinif: true,
      brans: true,
      roller: { where: { bitisTarihi: null }, select: { rolKodu: true } },
    },
  });
  return satirlar.map(({ roller, beyanOkulAdi, ...kisi }) => ({
    ...kisi,
    beyanOkulAdi: beyanOkulAdi ?? "",
    rol: rolEtiketi(roller),
  }));
}

/** Her ildeki okulsuz kişi sayısı (merkezin il özeti ve yönetim kartı). */
export async function ilBazindaOkulsuzSayilari(): Promise<Map<string, number>> {
  const satirlar = await prisma.kullanici.groupBy({
    by: ["ilKodu"],
    where: okulsuzKosulu,
    _count: { _all: true },
  });
  return new Map(
    satirlar
      .filter((satir) => satir.ilKodu !== null)
      .map((satir) => [satir.ilKodu as string, satir._count._all]),
  );
}

/** Okulsuz kişi sayısı; il verilmezse ülke geneli (yönetim kartının rozeti). */
export async function okulsuzKisiSayisi(ilKodu: string | null): Promise<number> {
  return prisma.kullanici.count({
    where: { ...okulsuzKosulu, ...(ilKodu ? { ilKodu } : {}) },
  });
}

/** İlin aktif okulları ve her okula bağlı kişiler. */
export async function ildekiOkullar(ilKodu: string) {
  const okullar = await prisma.kurum.findMany({
    where: { ilKodu, aktif: true },
    orderBy: { ad: "asc" },
    select: {
      kurumKodu: true,
      ad: true,
      ilceKodu: true,
      okulTuru: true,
      ilce: { select: { ad: true } },
      kullanicilar: {
        where: { aktif: true },
        orderBy: [{ ad: "asc" }, { soyad: "asc" }],
        select: {
          id: true,
          ad: true,
          soyad: true,
          roller: { where: { bitisTarihi: null }, select: { rolKodu: true } },
        },
      },
    },
  });
  return okullar.map(({ kullanicilar, ...okul }) => ({
    ...okul,
    kisiler: kullanicilar.map(({ roller, ...kisi }) => ({
      ...kisi,
      rol: rolEtiketi(roller),
    })),
  }));
}

export type IslemSonucu<T = null> =
  | { olurMu: true; deger: T }
  | { olurMu: false; neden: string };

/**
 * İle okul ekler; aynı ilçede aynı adla (kısaltmalar açılmış hâliyle) aktif
 * bir okul zaten varsa YENİSİNİ AÇMAZ, onu döndürür. İki koordinatör sekmesi
 * aynı okulu art arda eklediğinde çift kayıt doğmasın.
 */
export async function okulEkle(girdi: {
  ad: string;
  ilKodu: string;
  ilceKodu: string;
  okulTuru: string;
  ekleyenId: number;
}): Promise<IslemSonucu<{ kurumKodu: number; yeniMi: boolean }>> {
  const ad = girdi.ad.replace(/\s+/g, " ").trim();
  const okulTuru = girdi.okulTuru.trim();
  if (!ad) return { olurMu: false, neden: "Okul adını yazın." };
  if (ad.length > OKUL_ADI_UST_SINIRI) {
    return {
      olurMu: false,
      neden: `Okul adı en fazla ${OKUL_ADI_UST_SINIRI} karakter olabilir.`,
    };
  }
  if (!okulTuru) return { olurMu: false, neden: "Okul türünü seçin." };
  if (kapsamDisiOkulTuruMu(okulTuru)) {
    return { olurMu: false, neden: "Açık öğretim okulları GençTek kapsamında değil." };
  }

  const ilce = await prisma.ilce.findUnique({
    where: { ilceKodu: girdi.ilceKodu },
    select: { ilKodu: true },
  });
  if (!ilce || ilce.ilKodu !== girdi.ilKodu) {
    return { olurMu: false, neden: "Okulun ilçesini ilin listesinden seçin." };
  }

  const anahtar = okulAdiAnahtari(ad);
  const ilcedekiler = await prisma.kurum.findMany({
    where: { ilceKodu: girdi.ilceKodu, aktif: true },
    select: { kurumKodu: true, ad: true },
  });
  const ayni = ilcedekiler.find((okul) => okulAdiAnahtari(okul.ad) === anahtar);
  if (ayni) {
    return { olurMu: true, deger: { kurumKodu: ayni.kurumKodu, yeniMi: false } };
  }

  /*
   * Numara "en büyük + 1". İki istek aynı anda aynı numarayı alırsa ikincisi
   * birincil anahtara takılır; bir kez daha denenir.
   */
  for (let deneme = 0; deneme < 3; deneme++) {
    const enBuyuk = await prisma.kurum.aggregate({
      where: { kurumKodu: { gt: GECICI_KURUM_KODU_TABANI } },
      _max: { kurumKodu: true },
    });
    const kurumKodu = sonrakiGeciciKurumKodu(enBuyuk._max.kurumKodu);
    try {
      await prisma.kurum.create({
        data: {
          kurumKodu,
          ad,
          ilKodu: girdi.ilKodu,
          ilceKodu: girdi.ilceKodu,
          okulTuru,
          aktif: true,
        },
      });
      await erisimLogla({
        kullaniciId: girdi.ekleyenId,
        islem: "DEGISIKLIK",
        hedefTip: "SISTEM_AYARI",
        hedefId: kurumKodu,
        detay: `Okul eklendi (geçici kod): ${ad} · ${girdi.ilceKodu} · ${okulTuru}`,
      });
      return { olurMu: true, deger: { kurumKodu, yeniMi: true } };
    } catch (hata) {
      if ((hata as { code?: string }).code !== "P2002") throw hata;
    }
  }
  return { olurMu: false, neden: "Okul eklenemedi, lütfen tekrar deneyin." };
}

/**
 * Kişileri okula bağlar. Her kişide:
 *   · kurum kodu yazılır, ilçe OKULUN ilçesi olur (boş ilçe de böylece dolar),
 *   · elle yazılmış ad ve tür temizlenir (iş bitti — bkz. schema.prisma
 *     Kullanici.beyanOkulAdi), eski ad denetim kaydında kalır,
 *   · açık danışmanlık rolü varsa rolün kapsamı da bu okul olur. Yazılmasa
 *     danışman, okuluna bağlıyken okul temsilciliği veremez ve okulundaki
 *     danışmansız öğrencileri göremezdi (kapı rolün kurum koduna bakıyor).
 *
 * Okulsuz olmayan, ili okulunkiyle tutmayan ya da pasif kişi ATLANIR ve
 * sayısı döner — ekran başka sekmede değişmiş olabilir.
 */
export async function kisileriOkulaBagla(
  kurumKodu: number,
  kisiIdleri: number[],
  yapanId: number,
): Promise<IslemSonucu<{ baglanan: number; atlanan: number }>> {
  const okul = await prisma.kurum.findUnique({
    where: { kurumKodu },
    select: { kurumKodu: true, ad: true, ilKodu: true, ilceKodu: true, aktif: true },
  });
  if (!okul || !okul.aktif) {
    return { olurMu: false, neden: "Seçilen okul bulunamadı." };
  }

  const kisiler = await prisma.kullanici.findMany({
    where: { id: { in: kisiIdleri }, ...okulsuzKosulu, ilKodu: okul.ilKodu },
    select: { id: true, beyanOkulAdi: true },
  });

  for (const kisi of kisiler) {
    await prisma.$transaction([
      prisma.kullanici.update({
        where: { id: kisi.id },
        data: {
          kurumKodu: okul.kurumKodu,
          ilceKodu: okul.ilceKodu,
          beyanOkulAdi: null,
          beyanOkulTuru: null,
        },
      }),
      prisma.kullaniciRol.updateMany({
        where: { kullaniciId: kisi.id, rolKodu: "DANISMAN", bitisTarihi: null },
        data: { kurumKodu: okul.kurumKodu },
      }),
    ]);
    await erisimLogla({
      kullaniciId: yapanId,
      islem: "DEGISIKLIK",
      hedefTip: "PROFIL",
      hedefId: kisi.id,
      detay: `Okula bağlandı: "${kisi.beyanOkulAdi}" → ${okul.ad} (${okul.kurumKodu})`,
    });
  }

  return {
    olurMu: true,
    deger: { baglanan: kisiler.length, atlanan: kisiIdleri.length - kisiler.length },
  };
}

/**
 * Yanlış bağlamayı geri alır: kişi okulsuz döner, okulun adı yeniden "elle
 * yazılmış ad" olarak durur ve kişi eşleştirme listesine geri düşer. İlçe
 * olduğu gibi kalır — okul yanlış olsa da ilçe çoğunlukla doğrudur.
 */
export async function kisiyiOkuldanAyir(
  kisiId: number,
  yapanId: number,
): Promise<IslemSonucu<{ ilKodu: string }>> {
  const kisi = await prisma.kullanici.findUnique({
    where: { id: kisiId },
    select: {
      id: true,
      kurum: { select: { kurumKodu: true, ad: true, okulTuru: true, ilKodu: true } },
    },
  });
  if (!kisi?.kurum) return { olurMu: false, neden: "Kişi zaten bir okula bağlı değil." };

  await prisma.$transaction([
    prisma.kullanici.update({
      where: { id: kisi.id },
      data: {
        kurumKodu: null,
        beyanOkulAdi: kisi.kurum.ad,
        beyanOkulTuru: kisi.kurum.okulTuru,
      },
    }),
    prisma.kullaniciRol.updateMany({
      where: { kullaniciId: kisi.id, rolKodu: "DANISMAN", bitisTarihi: null },
      data: { kurumKodu: null },
    }),
  ]);
  await erisimLogla({
    kullaniciId: yapanId,
    islem: "DEGISIKLIK",
    hedefTip: "PROFIL",
    hedefId: kisi.id,
    detay: `Okul bağlantısı kaldırıldı: ${kisi.kurum.ad} (${kisi.kurum.kurumKodu})`,
  });
  return { olurMu: true, deger: { ilKodu: kisi.kurum.ilKodu } };
}

/** Ekrandan eklenmiş okulun adını düzeltir. */
export async function okulAdiniDegistir(
  kurumKodu: number,
  yeniAd: string,
  yapanId: number,
): Promise<IslemSonucu> {
  const ad = yeniAd.replace(/\s+/g, " ").trim();
  if (!ad) return { olurMu: false, neden: "Okul adını yazın." };
  if (ad.length > OKUL_ADI_UST_SINIRI) {
    return {
      olurMu: false,
      neden: `Okul adı en fazla ${OKUL_ADI_UST_SINIRI} karakter olabilir.`,
    };
  }
  const okul = await prisma.kurum.findUnique({
    where: { kurumKodu },
    select: { ad: true },
  });
  if (!okul) return { olurMu: false, neden: "Okul bulunamadı." };

  await prisma.kurum.update({ where: { kurumKodu }, data: { ad } });
  await erisimLogla({
    kullaniciId: yapanId,
    islem: "DEGISIKLIK",
    hedefTip: "SISTEM_AYARI",
    hedefId: kurumKodu,
    detay: `Okul adı değişti: ${okul.ad} → ${ad}`,
  });
  return { olurMu: true, deger: null };
}

/**
 * OKUL BİRLEŞTİRME (13 Kasım 2026 · istek: "Uşak Eşme ilçesi için 2 okul
 * girilmiş ama ikisi aynı okulmuş"). Ekrandan iki kez (farklı yazımla)
 * eklenmiş okulun her şeyi doğru okula taşınır: bağlı kişiler, roller
 * (danışmanlık, okul temsilciliği), öğrenci görevleri, faaliyetler, ekipler
 * ve mezun başvuruları. Tekrar eden kayıt silinmez, PASİFE alınır — listeden
 * düşer, günlük ve eski bağlantılar ona bakmaya devam edebilir.
 *
 * Yalnızca GEÇİCİ KODLU okul birleştirilerek kaldırılır; MEB kodlu okul
 * resmî listeden gelir. İki okul aynı ilde olmalı; taşınan kişilerin ilçesi
 * hedef okulun ilçesi olur.
 */
export async function okullariBirlestir(
  kaynakKodu: number,
  hedefKodu: number,
  yapanId: number,
): Promise<IslemSonucu<{ kisi: number }>> {
  if (kaynakKodu === hedefKodu) {
    return { olurMu: false, neden: "Okul kendisiyle birleştirilemez." };
  }
  const secim = {
    kurumKodu: true,
    ad: true,
    ilKodu: true,
    ilceKodu: true,
    aktif: true,
  } as const;
  const [kaynak, hedef] = await Promise.all([
    prisma.kurum.findUnique({ where: { kurumKodu: kaynakKodu }, select: secim }),
    prisma.kurum.findUnique({ where: { kurumKodu: hedefKodu }, select: secim }),
  ]);
  if (!kaynak || !kaynak.aktif) return { olurMu: false, neden: "Okul bulunamadı." };
  if (!hedef || !hedef.aktif) {
    return { olurMu: false, neden: "Birleştirilecek okulu listeden seçin." };
  }
  if (kaynak.ilKodu !== hedef.ilKodu) {
    return { olurMu: false, neden: "İki okul aynı ilde olmalı." };
  }
  if (kaynak.kurumKodu <= GECICI_KURUM_KODU_TABANI) {
    return { olurMu: false, neden: "MEB kodlu okul birleştirilerek kaldırılamaz." };
  }

  const yeni = { kurumKodu: hedef.kurumKodu };
  const kaynagin = { kurumKodu: kaynak.kurumKodu };
  const [kisiler] = await prisma.$transaction([
    prisma.kullanici.updateMany({
      where: kaynagin,
      data: { ...yeni, ilceKodu: hedef.ilceKodu },
    }),
    prisma.kullaniciRol.updateMany({ where: kaynagin, data: yeni }),
    prisma.ogrenciGorevRolu.updateMany({ where: kaynagin, data: yeni }),
    prisma.faaliyet.updateMany({ where: kaynagin, data: yeni }),
    prisma.ekip.updateMany({ where: kaynagin, data: yeni }),
    prisma.disKullaniciBasvurusu.updateMany({
      where: { mezunKurumKodu: kaynak.kurumKodu },
      data: { mezunKurumKodu: hedef.kurumKodu },
    }),
    prisma.kurum.update({ where: kaynagin, data: { aktif: false } }),
  ]);

  await erisimLogla({
    kullaniciId: yapanId,
    islem: "DEGISIKLIK",
    hedefTip: "SISTEM_AYARI",
    hedefId: kaynak.kurumKodu,
    detay: `Okul birleştirildi: ${kaynak.ad} (${kaynak.kurumKodu}) → ${hedef.ad} (${hedef.kurumKodu}); ${kisiler.count} kişi taşındı, eski kayıt pasife alındı`,
  });
  return { olurMu: true, deger: { kisi: kisiler.count } };
}
