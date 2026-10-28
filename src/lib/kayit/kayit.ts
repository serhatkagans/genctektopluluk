import type { AuthKimlik } from "../auth/tipler";
import { prisma } from "../db";
import { sifreOzetle } from "../dis-kimlik/sifre";
import { kullaniciSagla } from "../kullanici/sagla";
import { kapsamDisiOkulTuruMu } from "../okul/turler";
import { erisimLogla } from "../yetki/log";
import { type KayitKaydi, okulTuruUyarMi } from "./kurallar";

export type KayitSonucu =
  | { durum: "BASARILI"; kullaniciId: number }
  | { durum: "BASARISIZ"; mesaj: string };

/**
 * Kayıt formundan hesap açar (17 Eylül 2026).
 *
 * Kullanıcı satırı ve rolleri OLAĞAN SAĞLAMA AKIŞINDAN geçer
 * (kullanici/sagla.ts): öğrenciye OGRENCI rolü ve profili, okullu öğretmene
 * DANISMAN rolü. Kayıt için ikinci bir rol mantığı yazılsaydı, SSO geldiğinde
 * kayıtla açılan hesaplarla SSO'dan gelenler farklı kurallarla doğmuş olurdu.
 *
 * VAR OLAN KAYDA ŞİFRE BAĞLANMAZ. Aynı T.C. numarasıyla bir kullanıcı satırı
 * varsa kayıt reddedilir — şifresi olmasa bile. Aksi hâlde başkasının
 * numarasını bilen kişi o hesabı (rolleri ve verisiyle) sahiplenebilirdi.
 */
export async function kayitOl(kayit: KayitKaydi): Promise<KayitSonucu> {
  /*
   * LİSTEDE OLMAYAN OKUL (23 Ekim 2026): kurum kodu boş gelir, kişi okulsuz
   * açılır ve yazdığı ad `beyanOkulAdi`nda durur. İlçe bilinmediği için boş.
   * Okulsuz öğretmene danışman rolü verilmez (kullanici/sagla.ts); okul
   * referans tabloya eklenip kişi bağlandığında olağan akış devreye girer.
   */
  let ilceKodu: string | null = null;
  if (kayit.kurumKodu !== null) {
    const kurum = await prisma.kurum.findUnique({
      where: { kurumKodu: kayit.kurumKodu },
      select: { ilKodu: true, ilceKodu: true, aktif: true, okulTuru: true },
    });
    if (
      !kurum ||
      !kurum.aktif ||
      kurum.ilKodu !== kayit.ilKodu ||
      // Açık öğretim liseleri GençTek'in hedefi değil (bkz. okul/turler.ts).
      kapsamDisiOkulTuruMu(kurum.okulTuru)
    ) {
      return { durum: "BASARISIZ", mesaj: "Okulunuzu listeden seçin." };
    }
    if (kayit.okulTuru !== null && !okulTuruUyarMi(kayit.okulTuru, kurum.okulTuru)) {
      return {
        durum: "BASARISIZ",
        mesaj: "Seçtiğiniz okul, seçtiğiniz okul türünde değil. Okul türünü kontrol edin.",
      };
    }
    ilceKodu = kurum.ilceKodu;
  }

  const mevcut = await prisma.kullanici.findUnique({
    where: { authProviderId: kayit.tcKimlikNo },
    select: { id: true },
  });
  if (mevcut) {
    return {
      durum: "BASARISIZ",
      mesaj:
        "Bu T.C. kimlik numarasıyla açılmış bir hesap var. Giriş ekranından şifrenizle girin.",
    };
  }

  // Özet sağlamadan ÖNCE üretilir: scrypt ~100 ms sürer ve kullanıcı satırı
  // açıldıktan sonra başarısız olursa şifresiz bir hesap kalırdı.
  const sifreOzeti = await sifreOzetle(kayit.sifre);

  const kimlik: AuthKimlik = {
    authProviderId: kayit.tcKimlikNo,
    tip: kayit.tip,
    ad: kayit.ad,
    soyad: kayit.soyad,
    cinsiyet: kayit.cinsiyet,
    kurumKodu: kayit.kurumKodu,
    ilKodu: kayit.ilKodu,
    ilceKodu,
    sinif: kayit.sinif,
    brans: kayit.brans,
    egitimOgretimYili: kayit.egitimOgretimYili,
  };

  let kullaniciId: number;
  try {
    ({ kullaniciId } = await kullaniciSagla(kimlik));
  } catch (hata) {
    // Aynı anda gönderilen iki form: ikincisi benzersizlik kısıtına takılır.
    if ((hata as { code?: string }).code === "P2002") {
      return {
        durum: "BASARISIZ",
        mesaj:
          "Bu T.C. kimlik numarasıyla açılmış bir hesap var. Giriş ekranından şifrenizle girin.",
      };
    }
    throw hata;
  }

  /*
   * Şifre, beyan edilen okul ve iletişim bilgisi TEK İŞLEMDE yazılır. Profil
   * satırı (öğrenci/öğretmen) sağlama akışında açıldı; iletişim alanları
   * profildekilerle aynı yerde durur, kişi sonradan profilinden değiştirir.
   */
  const iletisim = { eposta: kayit.eposta, telefon: kayit.telefon };
  await prisma.$transaction([
    prisma.kayitKimlik.create({ data: { kullaniciId, sifreOzeti } }),
    ...(kayit.beyanOkulAdi !== null
      ? [
          prisma.kullanici.update({
            where: { id: kullaniciId },
            data: {
              beyanOkulAdi: kayit.beyanOkulAdi,
              beyanOkulTuru: kayit.okulTuru,
            },
          }),
        ]
      : []),
    kayit.tip === "OGRENCI"
      ? prisma.ogrenciProfil.update({ where: { kullaniciId }, data: iletisim })
      : prisma.ogretmenProfil.update({ where: { kullaniciId }, data: iletisim }),
  ]);

  await erisimLogla({
    kullaniciId,
    islem: "DEGISIKLIK",
    hedefTip: kayit.tip === "OGRENCI" ? "OGRENCI" : "OGRETMEN",
    hedefId: kullaniciId,
    detay: "Kayıt formuyla kullanıcı oluşturuldu",
  });

  return { durum: "BASARILI", kullaniciId };
}
