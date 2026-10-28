import { randomInt } from "node:crypto";
import { prisma } from "../db";
import { sifreOzetle } from "../dis-kimlik/sifre";
import { kullaniciyiImhaEt } from "../kvkk/imha";
import { erisimLogla } from "../yetki/log";

/**
 * KULLANICI YÖNETİMİ İŞLEMLERİ (28 Ekim 2026) — yalnızca proje yöneticisi
 * (bkz. yetki/izinler.ts · kullaniciYonetebilirMi). Yetki sorusu eylemde
 * sorulur; buradaki işlevler yalnızca "hedef dokunulabilir mi" sorusunu
 * cevaplar.
 *
 * DOKUNULMAYAN HESAPLAR: kişinin kendisi ve başka bir proje yöneticisi.
 * Yönetici kendi hesabını silerse sistemi yöneticisiz bırakabilir; bir
 * yöneticinin ötekinin şifresini değiştirebilmesi de tek bir ele geçirilmiş
 * hesabın bütün merkezi ele geçirmesi demek olurdu.
 */

export type IslemSonucu =
  | { olduMu: true; mesaj: string; geciciSifre?: string }
  | { olduMu: false; mesaj: string };

type Hedef = {
  id: number;
  ad: string;
  soyad: string;
  kayitKimlik: { kullaniciId: number } | null;
  disKimlik: { kullaniciId: number } | null;
};

async function hedefiGetir(
  yoneticiId: number,
  hedefId: number,
): Promise<{ hata: string } | { hedef: Hedef } | null> {
  if (!Number.isInteger(hedefId)) return null;
  if (hedefId === yoneticiId) return { hata: "Kendi hesabınızda bu işlem yapılamaz." };

  const hedef = await prisma.kullanici.findUnique({
    where: { id: hedefId },
    select: {
      id: true,
      ad: true,
      soyad: true,
      aktif: true,
      anonimlestirmeTarihi: true,
      roller: { where: { bitisTarihi: null }, select: { rolKodu: true } },
      kayitKimlik: { select: { kullaniciId: true } },
      disKimlik: { select: { kullaniciId: true } },
    },
  });
  if (!hedef) return null;
  if (hedef.anonimlestirmeTarihi) {
    return { hata: "Bu kayıt silinmiş." };
  }
  if (hedef.roller.some((rol) => rol.rolKodu === "PROJE_YONETICISI")) {
    return {
      hata: "Proje yöneticisi hesapları bu ekrandan değiştirilmez.",
    };
  }
  return { hedef };
}

/**
 * Geçici şifre: karışan harfler (0/O, 1/l/I) yok, telefonda okunup
 * yazdırılabilsin. 12 karakter, şifre kurallarını (en az 10, en az dört farklı
 * karakter) her zaman karşılar.
 */
const ALFABE = "ABCDEFGHJKLMNPRSTUVYZabcdefghjkmnprstuvyz23456789";

export function geciciSifreUret(): string {
  let sifre = "";
  while (new Set(sifre).size < 6) {
    sifre = Array.from({ length: 12 }, () => ALFABE[randomInt(ALFABE.length)]).join("");
  }
  return sifre;
}

/**
 * Geçici şifre verir. Kişinin açık oturumları düşer, kilidi açılır. Şifre
 * YALNIZCA BİR KEZ, yöneticinin ekranında gösterilir; hiçbir yerde düz metin
 * olarak saklanmaz ve günlüğe yazılmaz.
 */
export async function geciciSifreVer(
  yoneticiId: number,
  hedefId: number,
): Promise<IslemSonucu> {
  const sonuc = await hedefiGetir(yoneticiId, hedefId);
  if (!sonuc) return { olduMu: false, mesaj: "Kullanıcı bulunamadı." };
  if ("hata" in sonuc) return { olduMu: false, mesaj: sonuc.hata };
  const { hedef } = sonuc;

  if (!hedef.kayitKimlik && !hedef.disKimlik) {
    return {
      olduMu: false,
      mesaj: "Bu hesabın şifresi yok; kimliği dış sistemden (EBA) geliyor.",
    };
  }

  const sifre = geciciSifreUret();
  const ozet = await sifreOzetle(sifre);
  const sifreVerisi = {
    sifreOzeti: ozet,
    basarisizDeneme: 0,
    kilitBitisTarihi: null,
  };

  await prisma.$transaction([
    ...(hedef.kayitKimlik
      ? [
          prisma.kayitKimlik.update({
            where: { kullaniciId: hedef.id },
            data: {
              ...sifreVerisi,
              sifirlamaJetonuOzeti: null,
              sifirlamaSonGecerlilik: null,
            },
          }),
        ]
      : []),
    ...(hedef.disKimlik
      ? [
          prisma.disKimlik.update({
            where: { kullaniciId: hedef.id },
            data: {
              ...sifreVerisi,
              sifirlamaJetonuOzeti: null,
              sifirlamaSonGecerlilik: null,
            },
          }),
        ]
      : []),
    prisma.kullanici.update({
      where: { id: hedef.id },
      data: { oturumSurumu: { increment: 1 } },
    }),
  ]);

  await erisimLogla({
    kullaniciId: yoneticiId,
    islem: "DEGISIKLIK",
    hedefTip: "PROFIL",
    hedefId: hedef.id,
    detay: `Kullanıcı yönetimi: geçici şifre verildi (${hedef.ad} ${hedef.soyad}); açık oturumlar düşürüldü`,
  });

  return {
    olduMu: true,
    mesaj: `${hedef.ad} ${hedef.soyad} için geçici şifre oluşturuldu.`,
    geciciSifre: sifre,
  };
}

/** Hatalı denemeler yüzünden kilitlenen hesabı açar. */
export async function kilidiAc(
  yoneticiId: number,
  hedefId: number,
): Promise<IslemSonucu> {
  const sonuc = await hedefiGetir(yoneticiId, hedefId);
  if (!sonuc) return { olduMu: false, mesaj: "Kullanıcı bulunamadı." };
  if ("hata" in sonuc) return { olduMu: false, mesaj: sonuc.hata };
  const { hedef } = sonuc;

  const sifirla = { basarisizDeneme: 0, kilitBitisTarihi: null };
  await prisma.kayitKimlik.updateMany({ where: { kullaniciId: hedef.id }, data: sifirla });
  await prisma.disKimlik.updateMany({ where: { kullaniciId: hedef.id }, data: sifirla });

  await erisimLogla({
    kullaniciId: yoneticiId,
    islem: "DEGISIKLIK",
    hedefTip: "PROFIL",
    hedefId: hedef.id,
    detay: `Kullanıcı yönetimi: giriş kilidi açıldı (${hedef.ad} ${hedef.soyad})`,
  });
  return { olduMu: true, mesaj: `${hedef.ad} ${hedef.soyad} hesabının kilidi açıldı.` };
}

/**
 * Hesabı pasife alır ya da yeniden etkinleştirir. Pasif hesap giriş yapamaz,
 * açık oturumları düşer; verisi olduğu gibi durur (silmeden farkı budur).
 */
export async function aktiflikDegistir(
  yoneticiId: number,
  hedefId: number,
  aktif: boolean,
): Promise<IslemSonucu> {
  const sonuc = await hedefiGetir(yoneticiId, hedefId);
  if (!sonuc) return { olduMu: false, mesaj: "Kullanıcı bulunamadı." };
  if ("hata" in sonuc) return { olduMu: false, mesaj: sonuc.hata };
  const { hedef } = sonuc;

  await prisma.kullanici.update({
    where: { id: hedef.id },
    data: { aktif, oturumSurumu: { increment: 1 } },
  });

  await erisimLogla({
    kullaniciId: yoneticiId,
    islem: "DEGISIKLIK",
    hedefTip: "PROFIL",
    hedefId: hedef.id,
    detay: `Kullanıcı yönetimi: hesap ${aktif ? "etkinleştirildi" : "pasife alındı"} (${hedef.ad} ${hedef.soyad})`,
  });
  return {
    olduMu: true,
    mesaj: `${hedef.ad} ${hedef.soyad} hesabı ${aktif ? "etkinleştirildi" : "pasife alındı"}.`,
  };
}

/**
 * KAYDI SİLER.
 *
 * Satır veritabanından kalkmaz, KVKK imha akışıyla İÇİ BOŞALTILIR
 * (bkz. kvkk/imha.ts · kullaniciyiImhaEt): kullanıcı kaydı yirmiden fazla
 * tablonun yabancı anahtarı ve satırı silmek ya bağlı kayıtları zincirleme
 * silerdi ya da hiç yapılamazdı. Sonuç kişinin bakışından silmeyle aynıdır:
 * ad, kimlik numarası, iletişim bilgisi, fotoğraf, özgeçmiş ve yazdıkları
 * gider; hesap giriş yapamaz.
 *
 * Ayrıca: aktif rolleri kapanır ve şifre kimlikleri silinir. T.C. numarası ve
 * e-posta boşa çıktığı için kişi (ör. yanlış kayıt açmışsa) yeniden kayıt
 * olabilir.
 *
 * GERİ ALINAMAZ — ekran onay kelimesi ister.
 */
export async function kaydiSil(
  yoneticiId: number,
  hedefId: number,
): Promise<IslemSonucu> {
  const sonuc = await hedefiGetir(yoneticiId, hedefId);
  if (!sonuc) return { olduMu: false, mesaj: "Kullanıcı bulunamadı." };
  if ("hata" in sonuc) return { olduMu: false, mesaj: sonuc.hata };
  const { hedef } = sonuc;
  const adSoyad = `${hedef.ad} ${hedef.soyad}`;
  const simdi = new Date();

  await prisma.$transaction([
    prisma.kullaniciRol.updateMany({
      where: { kullaniciId: hedef.id, bitisTarihi: null },
      data: { bitisTarihi: simdi },
    }),
    prisma.kayitKimlik.deleteMany({ where: { kullaniciId: hedef.id } }),
    prisma.disKimlik.deleteMany({ where: { kullaniciId: hedef.id } }),
    // Mezun/paydaşı doğuran başvuru da ad, e-posta ve telefon taşıyor; imha
    // akışı bu tabloya dokunmadığı için burada boşaltılır.
    prisma.disKullaniciBasvurusu.updateMany({
      where: { olusanKullaniciId: hedef.id },
      data: {
        ad: "İmha edilmiş",
        soyad: "kullanıcı",
        eposta: `imha-${hedef.id}@imha.invalid`,
        telefon: null,
        sifreOzeti: null,
        gorevUnvani: null,
        beyan: "",
        mentorlukKonulari: null,
      },
    }),
    prisma.kullanici.update({
      where: { id: hedef.id },
      data: { aktif: false, oturumSurumu: { increment: 1 } },
    }),
  ]);

  const imha = await kullaniciyiImhaEt(hedef.id, simdi);

  // Günlükte ad yazılır: kaydın kendisinde artık ad yok, "kimi sildik"
  // sorusunun tek cevabı burası.
  await erisimLogla({
    kullaniciId: yoneticiId,
    islem: "SILME",
    hedefTip: "PROFIL",
    hedefId: hedef.id,
    detay: `Kullanıcı yönetimi: kayıt silindi (${adSoyad}); ${imha.imhaEdilenIcerik} içerik boşaltıldı`,
  });

  return { olduMu: true, mesaj: `${adSoyad} kaydı silindi.` };
}
