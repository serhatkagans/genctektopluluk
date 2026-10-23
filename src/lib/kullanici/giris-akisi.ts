import { authProvider } from "../auth";
import { oturumAc } from "../auth/oturum";
import { aktifAtamaGetir, danismanliktanAyrildi, ilkAtamayiYurut } from "../danisman/atama";
import { ATAMAYI_YALNIZCA_YONETICI_YAPAR } from "../danisman/politika";
import { prisma } from "../db";
import { erisimLogla, kimlikDogrulamaLogla } from "../yetki/log";
import { kullaniciSagla } from "./sagla";

/**
 * Giriş akışı: kimlik doğrulama → kullanıcı sağlama → kurum değişimi kontrolü →
 * danışman ataması → oturum açma.
 *
 * Bu akış AuthProvider'ın hangi implementasyon olduğunu bilmez; mock ile de
 * EBA ile de aynı şekilde çalışır.
 */

export type GirisSonucu =
  | { durum: "BASARISIZ"; mesaj: string }
  | {
      durum: "BASARILI";
      kullaniciId: number;
      /** Öğrencinin danışman seçmesi gerekiyorsa seçim ekranına yönlendirilir. */
      danismanSecimiGerekli: boolean;
      /**
       * Giriş yapan kişi öğrenci mi? Yönlendirme kararında kullanılır (öğrenci
       * girişte profiline düşer). Bilgi KİMLİKTEN okunur, roller sorgusundan
       * değil: rol kaydı bu akış içinde daha yeni açılmış olabilir.
       */
      ogrenciMi: boolean;
    };

export async function girisYap(kimlikBilgisi: string): Promise<GirisSonucu> {
  const saglayici = authProvider();
  const kimlik = await saglayici.girisYap(kimlikBilgisi);
  if (!kimlik) {
    await kimlikDogrulamaLogla({
      islem: "GIRIS",
      basarili: false,
      kimlikBilgisi,
      saglayici: saglayici.saglayiciAdi,
      neden: "kimlik doğrulanamadı",
    });
    return { durum: "BASARISIZ", mesaj: "Kimlik doğrulanamadı." };
  }

  const saglama = await kullaniciSagla(kimlik);

  // Kurum kodu değiştiyse devir akışı tetiklenir: öğretmenin öğrencileri
  // dağıtılır, öğrencinin kendi ataması yeni okula göre yeniden kurulur.
  if (saglama.kurumKoduDegistiMi && !saglama.yeniKullaniciMi) {
    if (kimlik.tip === "OGRETMEN") {
      await danismanliktanAyrildi(
        saglama.kullaniciId,
        saglama.eskiKurumKodu,
        "OGRETMEN_AYRILDI",
      );
    } else if (kimlik.tip === "OGRENCI") {
      await kapatAktifAtama(saglama.kullaniciId);
    }
  }

  let danismanSecimiGerekli = false;

  // Otomatik atama yok: atamayı proje yöneticisi yapar (bkz. danisman/politika.ts).
  if (kimlik.tip === "OGRENCI" && !ATAMAYI_YALNIZCA_YONETICI_YAPAR) {
    const karar = await ilkAtamayiYurut(saglama.kullaniciId);
    danismanSecimiGerekli = karar.tur === "SECIM_GEREKLI";
  }

  if (saglama.yeniKullaniciMi) {
    await erisimLogla({
      kullaniciId: saglama.kullaniciId,
      islem: "DEGISIKLIK",
      hedefTip: kimlik.tip === "OGRENCI" ? "OGRENCI" : "OGRETMEN",
      hedefId: saglama.kullaniciId,
      detay: `İlk girişte kullanıcı oluşturuldu (${saglayici.saglayiciAdi})`,
    });
  }

  await kimlikDogrulamaLogla({
    islem: "GIRIS",
    basarili: true,
    kullaniciId: saglama.kullaniciId,
    saglayici: saglayici.saglayiciAdi,
  });
  await oturumAc(saglama.kullaniciId);

  return {
    durum: "BASARILI",
    kullaniciId: saglama.kullaniciId,
    danismanSecimiGerekli,
    ogrenciMi: kimlik.tip === "OGRENCI",
  };
}

/** Öğrenci okul değiştirdiğinde eski atama kapatılır, yeni okulun akışına girer. */
export async function kapatAktifAtama(ogrenciId: number): Promise<void> {
  const atama = await aktifAtamaGetir(ogrenciId);
  if (!atama) return;

  await prisma.danismanAtama.update({
    where: { id: atama.id },
    data: {
      bitisTarihi: new Date(),
      kapanmaNedeni: "OGRENCI_OKUL_DEGISTIRDI",
    },
  });
}
