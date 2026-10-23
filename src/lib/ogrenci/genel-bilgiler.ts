import { danismanliktanAyrildi, ilkAtamayiYurut } from "../danisman/atama";
import { ATAMAYI_YALNIZCA_YONETICI_YAPAR } from "../danisman/politika";
import { prisma } from "../db";
import { okulTuruUyarMi } from "../kayit/kurallar";
import { kapatAktifAtama } from "../kullanici/giris-akisi";
import { ortam } from "../ortam";
import {
  disKullaniciMi,
  ogrenciMi,
  projeYoneticisiMi,
} from "../yetki/izinler";
import { erisimLogla } from "../yetki/log";
import type { OturumKullanicisi } from "../yetki/tipler";
import type {
  GenelBilgiler,
  GenelBilgilerTipi,
} from "./genel-bilgiler-kurallar";

/**
 * Genel bilgiler yalnızca kimliğin kaynağı kişinin kendi kaydı olduğunda
 * düzenlenir. EBA kipinde alanlar e-Okul'dan gelir ve gecelik senkron
 * üzerine yazar; orada düzenleme, kaydedilip ertesi sabah kaybolan bir
 * değişiklik olurdu.
 */
export function genelBilgilerDuzenlenebilirMi(): boolean {
  return ortam.AUTH_PROVIDER !== "eba";
}

/**
 * Kişiye hangi "Genel bilgiler" formu basılır? Öğrenci → öğrenci formu;
 * öğretmen ve il koordinatörü → öğretmen formu (23 Ekim 2026). Proje
 * yöneticisi ve dış kullanıcılar (mezun, paydaş, mentör) için null: onlarda
 * eski "Kimlik bilgileri" kartı duruyor.
 */
export function genelBilgilerTipi(
  kullanici: OturumKullanicisi,
): GenelBilgilerTipi | null {
  if (ogrenciMi(kullanici)) return "OGRENCI";
  if (projeYoneticisiMi(kullanici) || disKullaniciMi(kullanici)) return null;
  return "OGRETMEN";
}

export type GenelBilgilerSonucu =
  | { durum: "BASARILI" }
  | { durum: "BASARISIZ"; mesaj: string };

/**
 * "Genel bilgiler"i kaydeder — öğrenci (23 Ekim 2026 · istek: "mevcut yapı
 * düzenlenebilir olsun") ve aynı gün öğretmen ile il koordinatörü
 * ("Kimlik bilgileri öğrenci bilgileri ile aynı olacak … sınıf olmayacak").
 *
 * Bu alanlar bugüne kadar salt okunurdu çünkü e-Okul'dan geleceklerdi.
 * Kayıtla girişte kaynak kişinin kendi formudur; düzeltmesi de ona düşer.
 *
 * OKUL DEĞİŞİRSE:
 *   · Öğrenci — danışman ataması giriş akışındaki gibi kapanır (bkz.
 *     kullanici/giris-akisi.ts). Yeni danışmanı proje yöneticisi atar.
 *   · Öğretmen — üzerindeki danışmanlıklar kapanır; danışman rolü eski okulda
 *     biter, yeni okul listedeyse orada yeniden açılır. Rol bir OKULA bağlıdır
 *     (`kullanici_rol.kurum_kodu`): eski okulun rolüyle kalmak, öğretmene
 *     ayrıldığı okulun öğrencilerini göstermeye devam ederdi.
 */
export async function genelBilgileriKaydet(
  kullaniciId: number,
  bilgiler: GenelBilgiler,
  tip: GenelBilgilerTipi = "OGRENCI",
): Promise<GenelBilgilerSonucu> {
  /*
   * İLÇE İSTEĞE BAĞLI (23 Ekim 2026). Gerçek MEB ilçe listesi henüz yüklenmedi:
   * çoğu ilin listesi boş, birkaçında da eksik (İstanbul'da yalnızca iki ilçe).
   * Zorunlu olsaydı ya formu kaydetmek imkânsız olurdu ya da kişi yanlış
   * ilçeyi seçmeye zorlanırdı. Seçildiyse ile ait olduğu denetlenir.
   */
  let ilceKodu = bilgiler.ilceKodu;
  if (ilceKodu !== null) {
    const ilce = await prisma.ilce.findUnique({
      where: { ilceKodu },
      select: { ilKodu: true },
    });
    if (!ilce || ilce.ilKodu !== bilgiler.ilKodu) {
      return { durum: "BASARISIZ", mesaj: "İlçe seçilen ile ait değil." };
    }
  }

  if (bilgiler.kurumKodu !== null) {
    const kurum = await prisma.kurum.findUnique({
      where: { kurumKodu: bilgiler.kurumKodu },
      select: { ilKodu: true, ilceKodu: true, aktif: true, okulTuru: true },
    });
    if (
      !kurum ||
      !kurum.aktif ||
      kurum.ilKodu !== bilgiler.ilKodu ||
      (ilceKodu !== null && kurum.ilceKodu !== ilceKodu)
    ) {
      return {
        durum: "BASARISIZ",
        mesaj: "Okulunuzu seçtiğiniz il ve ilçenin listesinden seçin.",
      };
    }
    if (!okulTuruUyarMi(bilgiler.okulTuru, kurum.okulTuru)) {
      return {
        durum: "BASARISIZ",
        mesaj: "Seçtiğiniz okul, seçtiğiniz okul türünde değil.",
      };
    }
    ilceKodu = kurum.ilceKodu;
  }

  const onceki = await prisma.kullanici.findUniqueOrThrow({
    where: { id: kullaniciId },
    select: {
      kurumKodu: true,
      ilKodu: true,
      roller: {
        where: { bitisTarihi: null },
        select: { id: true, rolKodu: true },
      },
    },
  });

  await prisma.kullanici.update({
    where: { id: kullaniciId },
    data: {
      ad: bilgiler.ad,
      soyad: bilgiler.soyad,
      cinsiyet: bilgiler.cinsiyet,
      ilKodu: bilgiler.ilKodu,
      ilceKodu,
      kurumKodu: bilgiler.kurumKodu,
      ...(tip === "OGRENCI"
        ? { sinif: bilgiler.sinif }
        : { brans: bilgiler.brans }),
      // Listeden okul seçildiyse beyan temizlenir: tür artık okulun kaydında.
      beyanOkulAdi: bilgiler.beyanOkulAdi,
      beyanOkulTuru: bilgiler.kurumKodu === null ? bilgiler.okulTuru : null,
    },
  });

  const okulDegisti = onceki.kurumKodu !== bilgiler.kurumKodu;
  const yerDegisti = okulDegisti || onceki.ilKodu !== bilgiler.ilKodu;

  if (tip === "OGRENCI" && yerDegisti) {
    await kapatAktifAtama(kullaniciId);
    // Yeni danışmanı proje yöneticisi atar (bkz. danisman/politika.ts).
    if (!ATAMAYI_YALNIZCA_YONETICI_YAPAR) await ilkAtamayiYurut(kullaniciId);
  }

  if (tip === "OGRETMEN" && okulDegisti) {
    await ogretmeninOkuluDegisti(kullaniciId, onceki, bilgiler.kurumKodu);
  }

  await erisimLogla({
    kullaniciId,
    islem: "DEGISIKLIK",
    hedefTip: tip === "OGRENCI" ? "PROFIL" : "OGRETMEN",
    hedefId: kullaniciId,
    detay: yerDegisti
      ? "Genel bilgiler güncellendi (okul/il değişti)"
      : "Genel bilgiler güncellendi",
  });

  return { durum: "BASARILI" };
}

/**
 * Öğretmenin okulu değişti: danışmanlıklar kapanır, danışman rolü yeni okula
 * taşınır.
 *
 * ROL TAŞINIR, AÇILMAZ: eski okulda danışman olan öğretmen yeni okulda da
 * danışman olur; yeni okul listede değilse rol kaydının kurum kodu boş kalır
 * (23 Ekim 2026 · migration 20261023150000). Danışman rolü olmayan öğretmene
 * — görevi kendisi bırakmış ya da il koordinatörü — rol verilmez.
 */
async function ogretmeninOkuluDegisti(
  kullaniciId: number,
  onceki: {
    kurumKodu: number | null;
    roller: { id: number; rolKodu: string }[];
  },
  yeniKurumKodu: number | null,
): Promise<void> {
  await danismanliktanAyrildi(kullaniciId, onceki.kurumKodu, "OGRETMEN_AYRILDI");

  const danismanRolu = onceki.roller.find((rol) => rol.rolKodu === "DANISMAN");
  if (!danismanRolu) return;

  await prisma.$transaction([
    prisma.kullaniciRol.update({
      where: { id: danismanRolu.id },
      data: { bitisTarihi: new Date() },
    }),
    prisma.kullaniciRol.create({
      data: { kullaniciId, rolKodu: "DANISMAN", kurumKodu: yeniKurumKodu },
    }),
  ]);
}
