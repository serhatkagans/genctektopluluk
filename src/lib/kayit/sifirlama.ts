import { prisma } from "../db";
import { sifreSifirlamaEpostasi } from "../dis-kimlik/eposta";
import {
  epostaNormalle,
  SIFIRLAMA_GECERLILIK_DAKIKA,
  sifirlamaGecerliMi,
  sifirlamaYenidenIstenebilirMi,
  sifreKarariniVer,
} from "../dis-kimlik/kurallar";
import {
  sifirlamaJetonuDogrula,
  sifirlamaJetonuUret,
  sifreOzetle,
} from "../dis-kimlik/sifre";
import { erisimLogla } from "../yetki/log";
import { tcKimlikNoNormalle } from "./kurallar";

/**
 * "Şifremi unuttum" — kayıt formuyla açılmış öğrenci ve öğretmen hesapları
 * (28 Ekim 2026 · istek: "kullanıcılar şifrelerini unutunca sıfırlama için
 * bir şey yok, kendileri nasıl şifrelerini yenileyecekler").
 *
 * Akış dış kullanıcı sıfırlamasının aynısıdır (dis-kimlik/sifirlama.ts):
 * kişi T.C. kimlik numarasını ve e-postasını yazar, ikisi eşleşirse bağlantı
 * PROFİLDEKİ e-postaya gider. Yazılan adrese değil: adres yalnızca eşleşme
 * sınaması için sorulur, ileti hep kayıtlı adrese gider.
 *
 * HER DURUMDA AYNI SONUÇ. Numara kayıtlı olsa da olmasa da, e-posta tutsa da
 * tutmasa da ekran "gönderildi" der; aksi hâlde ekran "bu T.C. numarası
 * sistemde var mı" sorusunu cevaplayan bir araca dönerdi.
 *
 * Bağlantıda T.C. numarası DEĞİL kullanıcı numarası taşınır: adres çubuğu,
 * tarayıcı geçmişi ve sunucu günlükleri kimlik numarasını görmemeli.
 */

async function profilEpostasi(kullaniciId: number): Promise<string | null> {
  const kisi = await prisma.kullanici.findUnique({
    where: { id: kullaniciId },
    select: {
      ogrenciProfil: { select: { eposta: true } },
      ogretmenProfil: { select: { eposta: true } },
    },
  });
  const adres = kisi?.ogrenciProfil?.eposta ?? kisi?.ogretmenProfil?.eposta;
  return adres ? epostaNormalle(adres) : null;
}

export async function kayitSifirlamaIste(
  tcGirdisi: string,
  epostaGirdisi: string,
  baglantiKur: (kullaniciId: number, jeton: string) => string,
  simdi: Date = new Date(),
): Promise<void> {
  const tcKimlikNo = tcKimlikNoNormalle(tcGirdisi);
  const eposta = epostaNormalle(epostaGirdisi);
  if (!tcKimlikNo || !eposta) return;

  const kimlik = await prisma.kayitKimlik.findFirst({
    where: { kullanici: { authProviderId: tcKimlikNo } },
    select: {
      kullaniciId: true,
      sifirlamaSonGecerlilik: true,
      kullanici: { select: { ad: true, soyad: true, aktif: true } },
    },
  });
  if (!kimlik || !kimlik.kullanici.aktif) return;

  const kayitliAdres = await profilEpostasi(kimlik.kullaniciId);
  if (!kayitliAdres || kayitliAdres !== eposta) return;

  // Az önce verilmiş, hâlâ geçerli bir bağlantı varsa yenisi üretilmez.
  if (!sifirlamaYenidenIstenebilirMi(kimlik.sifirlamaSonGecerlilik, simdi)) {
    return;
  }

  const { jeton, ozet } = await sifirlamaJetonuUret();
  await prisma.kayitKimlik.update({
    where: { kullaniciId: kimlik.kullaniciId },
    data: {
      sifirlamaJetonuOzeti: ozet,
      sifirlamaSonGecerlilik: new Date(
        simdi.getTime() + SIFIRLAMA_GECERLILIK_DAKIKA * 60000,
      ),
    },
  });

  await sifreSifirlamaEpostasi(
    kayitliAdres,
    `${kimlik.kullanici.ad} ${kimlik.kullanici.soyad}`,
    baglantiKur(kimlik.kullaniciId, jeton),
    SIFIRLAMA_GECERLILIK_DAKIKA,
  );

  await erisimLogla({
    kullaniciId: kimlik.kullaniciId,
    islem: "DEGISIKLIK",
    hedefTip: "PROFIL",
    hedefId: kimlik.kullaniciId,
    detay: "Şifre sıfırlama bağlantısı istendi",
  });
}

export type KayitSifirlamaSonucu =
  | { olduMu: true }
  | { olduMu: false; neden: string };

/**
 * Jetonla yeni şifreyi yazar. Jeton tek kullanımlık; şifreyle birlikte
 * oturum sürümü de artar ve açık oturumların hepsi düşer
 * (bkz. dis-kimlik/sifirlama.ts · sifirlamayiTamamla).
 */
export async function kayitSifirlamayiTamamla(
  kullaniciId: number,
  jeton: string,
  yeniSifre: string,
  yeniSifreTekrar: string,
  simdi: Date = new Date(),
): Promise<KayitSifirlamaSonucu> {
  const gecersiz = {
    olduMu: false as const,
    neden:
      "Sıfırlama bağlantısı geçersiz ya da süresi dolmuş. Yeniden sıfırlama isteyin.",
  };
  if (!Number.isInteger(kullaniciId) || !jeton) return gecersiz;

  const kimlik = await prisma.kayitKimlik.findUnique({
    where: { kullaniciId },
    select: {
      sifirlamaJetonuOzeti: true,
      sifirlamaSonGecerlilik: true,
      kullanici: {
        select: { ad: true, soyad: true, aktif: true, authProviderId: true },
      },
    },
  });
  if (!kimlik || !kimlik.kullanici.aktif || !kimlik.sifirlamaJetonuOzeti) {
    return gecersiz;
  }

  if (!sifirlamaGecerliMi(kimlik.sifirlamaSonGecerlilik, simdi)) {
    await prisma.kayitKimlik.update({
      where: { kullaniciId },
      data: { sifirlamaJetonuOzeti: null, sifirlamaSonGecerlilik: null },
    });
    return gecersiz;
  }

  if (!(await sifirlamaJetonuDogrula(jeton, kimlik.sifirlamaJetonuOzeti))) {
    return gecersiz;
  }

  if (yeniSifre !== yeniSifreTekrar) {
    return { olduMu: false, neden: "Şifre ile tekrarı aynı değil." };
  }

  const karar = sifreKarariniVer(yeniSifre, {
    ad: kimlik.kullanici.ad,
    soyad: kimlik.kullanici.soyad,
    eposta: (await profilEpostasi(kullaniciId)) ?? "",
  });
  if (!karar.olurMu) return { olduMu: false, neden: karar.neden };
  if (yeniSifre.includes(kimlik.kullanici.authProviderId)) {
    return {
      olduMu: false,
      neden: "Şifre T.C. kimlik numaranızı içeremez.",
    };
  }

  await prisma.$transaction([
    prisma.kayitKimlik.update({
      where: { kullaniciId },
      data: {
        sifreOzeti: await sifreOzetle(yeniSifre),
        sifirlamaJetonuOzeti: null,
        sifirlamaSonGecerlilik: null,
        basarisizDeneme: 0,
        kilitBitisTarihi: null,
      },
    }),
    prisma.kullanici.update({
      where: { id: kullaniciId },
      data: { oturumSurumu: { increment: 1 } },
    }),
  ]);

  await erisimLogla({
    kullaniciId,
    islem: "DEGISIKLIK",
    hedefTip: "PROFIL",
    hedefId: kullaniciId,
    detay: "Şifre sıfırlandı; açık oturumlar düşürüldü",
  });

  return { olduMu: true };
}
