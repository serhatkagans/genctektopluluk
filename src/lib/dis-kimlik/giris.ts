import { oturumAc } from "../auth/oturum";
import { prisma } from "../db";
import { kimlikDogrulamaLogla } from "../yetki/log";
import {
  basarisizDenemeSonucu,
  epostaNormalle,
  type KilitDurumu,
  kilitKalanDakika,
  kilitliMi,
} from "./kurallar";
import { sahteSifreDogrulamasi, sifreDogrula } from "./sifre";

/**
 * EBA dışı giriş (mezun, paydaş temsilcisi).
 *
 * AuthProvider'IN YERİNE GEÇMEZ, YANINA GELİR. EBA/mock kimlikli kullanıcılar
 * lib/kullanici/giris-akisi.ts'den geçmeye devam eder; burada kullanıcı
 * sağlama (provisioning) YOKTUR çünkü kullanıcı zaten onay anında açılmıştır.
 *
 * Oturum katmanı ikisini de ayırt etmez: çerez yalnızca authProviderId taşır
 * ve rol/kapsam her istekte veritabanından okunur (bkz. lib/auth/oturum.ts).
 * EBA entegrasyonu geldiğinde de değişmeyecek olan sınır budur.
 */

export type DisGirisSonucu =
  | { durum: "BASARILI"; kullaniciId: number }
  | { durum: "BASARISIZ"; mesaj: string };

/**
 * Kimlik doğrulanamadığında verilen TEK mesaj.
 *
 * "Böyle bir kullanıcı yok" ile "şifre yanlış" ayrımı yapılmaz: ayrım,
 * elindeki e-posta listesini sistemde kimin kayıtlı olduğunu öğrenmek için
 * deneyen birine doğrudan cevap verirdi.
 */
const GENEL_HATA = "E-posta adresi veya şifre hatalı.";

/**
 * Başarısız denemeyi sayar ve gerekirse kilidi kurar.
 *
 * SAYAÇ İŞLEM İÇİNDE VE SATIR KİLİTLİ ARTIYOR (27 Ağustos 2026 · güvenlik
 * incelemesi). Önce sayaç istek başında okunmuş değerden hesaplanıp MUTLAK
 * değer olarak yazılıyordu; bu klasik bir kayıp güncelleme (lost update):
 * aynı anda gönderilen N deneme sayacı 0 okur, N'i de 1 yazar ve kaba kuvvet
 * sınırı N kat gecikir. Sınırın kendisi kâğıt üzerinde duruyor ama pratikte
 * paralel istekle aşılabiliyordu.
 *
 * KURAL HAM SQL'E TAŞINMADI: `basarisizDenemeSonucu` birim testli ve sayaç
 * davranışının tek doğruluk kaynağı (kilitlenince sıfırlama dahil). Bu yüzden
 * satır `FOR UPDATE` ile kilitlenip TAZE değer okunuyor, karar yine o
 * fonksiyonda veriliyor. Kilit işlem bitince düşer; scrypt doğrulaması işlemin
 * DIŞINDA kalır, yoksa her deneme bir veritabanı bağlantısını yüzlerce
 * milisaniye tutardı (üretimde havuz dar — bkz. lib/db-havuz.ts).
 *
 * ARADA KİLİTLENDİYSE DOKUNULMAZ: paralel bir istek bu satırı kilitlemiş
 * olabilir; taze durum kilitliyse sayaç yeniden artırılmaz. Artırılsaydı
 * `basarisizDenemeSonucu` kilitli durumu "0 deneme" sayıp kilidi TEMİZLERDİ.
 */
async function basarisizDenemeyiIsle(
  kullaniciId: number,
  simdi: Date,
): Promise<KilitDurumu> {
  return prisma.$transaction(async (tx) => {
    const satirlar = await tx.$queryRaw<
      { basarisiz_deneme: number; kilit_bitis_tarihi: Date | null }[]
    >`SELECT basarisiz_deneme, kilit_bitis_tarihi
        FROM dis_kimlik
       WHERE kullanici_id = ${kullaniciId}
         FOR UPDATE`;

    const satir = satirlar[0];
    if (!satir) return { basarisizDeneme: 0, kilitBitisTarihi: null };

    const taze: KilitDurumu = {
      basarisizDeneme: satir.basarisiz_deneme,
      kilitBitisTarihi: satir.kilit_bitis_tarihi,
    };
    if (kilitliMi(taze, simdi)) return taze;

    const yeniDurum = basarisizDenemeSonucu(taze, simdi);
    await tx.disKimlik.update({
      where: { kullaniciId },
      data: {
        basarisizDeneme: yeniDurum.basarisizDeneme,
        kilitBitisTarihi: yeniDurum.kilitBitisTarihi,
      },
    });
    return yeniDurum;
  });
}

export async function disGirisYap(
  epostaGirdisi: string,
  sifre: string,
  simdi: Date = new Date(),
): Promise<DisGirisSonucu> {
  const eposta = epostaNormalle(epostaGirdisi);
  if (!eposta || !sifre) {
    await kimlikDogrulamaLogla({
      islem: "GIRIS",
      basarili: false,
      kimlikBilgisi: eposta,
      saglayici: "dış kimlik",
      neden: "eksik kimlik bilgisi",
    });
    return { durum: "BASARISIZ", mesaj: GENEL_HATA };
  }

  const kimlik = await prisma.disKimlik.findUnique({
    where: { eposta },
    select: {
      kullaniciId: true,
      sifreOzeti: true,
      basarisizDeneme: true,
      kilitBitisTarihi: true,
      kullanici: { select: { aktif: true } },
    },
  });

  if (!kimlik) {
    const sonuc = await bekleyenBasvuruCevabi(eposta, sifre);
    await kimlikDogrulamaLogla({
      islem: "GIRIS",
      basarili: false,
      kimlikBilgisi: eposta,
      saglayici: "dış kimlik",
      neden: "kimlik doğrulanamadı",
    });
    return sonuc;
  }

  if (kilitliMi(kimlik, simdi)) {
    const kalan = kilitKalanDakika(kimlik, simdi);
    await kimlikDogrulamaLogla({
      islem: "GIRIS",
      basarili: false,
      kullaniciId: kimlik.kullaniciId,
      saglayici: "dış kimlik",
      neden: "hesap kilitli",
    });
    return {
      durum: "BASARISIZ",
      mesaj: `Çok fazla hatalı deneme yapıldı. ${kalan} dakika sonra tekrar deneyin.`,
    };
  }

  const dogruMu = await sifreDogrula(sifre, kimlik.sifreOzeti);

  if (!dogruMu) {
    const yeniDurum = await basarisizDenemeyiIsle(kimlik.kullaniciId, simdi);

    await kimlikDogrulamaLogla({
      islem: "GIRIS",
      basarili: false,
      kullaniciId: kimlik.kullaniciId,
      saglayici: "dış kimlik",
      neden:
        yeniDurum.kilitBitisTarihi !== null
          ? "hatalı parola; hesap kilitlendi"
          : "kimlik doğrulanamadı",
    });

    if (yeniDurum.kilitBitisTarihi !== null) {
      const kalan = kilitKalanDakika(yeniDurum, simdi);
      return {
        durum: "BASARISIZ",
        mesaj: `Çok fazla hatalı deneme yapıldı. ${kalan} dakika sonra tekrar deneyin.`,
      };
    }
    return { durum: "BASARISIZ", mesaj: GENEL_HATA };
  }

  /*
   * Şifre doğru ama hesap pasife alınmışsa yine GENEL mesaj verilir. Pasif
   * hesabın sahibi zaten kararı veren yöneticiden haberdardır; giriş ekranında
   * "hesabınız kapatıldı" yazmak, hesabın varlığını doğrulamaktan başka işe
   * yaramaz.
   */
  if (!kimlik.kullanici.aktif) {
    await kimlikDogrulamaLogla({
      islem: "GIRIS",
      basarili: false,
      kullaniciId: kimlik.kullaniciId,
      saglayici: "dış kimlik",
      neden: "pasif hesap",
    });
    return { durum: "BASARISIZ", mesaj: GENEL_HATA };
  }

  await prisma.disKimlik.update({
    where: { kullaniciId: kimlik.kullaniciId },
    data: {
      basarisizDeneme: 0,
      kilitBitisTarihi: null,
      sonGirisTarihi: simdi,
      // Bekleyen bir sıfırlama jetonu varsa düşer: şifresini hatırladığını
      // kanıtlayan kişi için jetonun açık kalmasının anlamı yok.
      sifirlamaJetonuOzeti: null,
      sifirlamaSonGecerlilik: null,
    },
  });

  await kimlikDogrulamaLogla({
    islem: "GIRIS",
    basarili: true,
    kullaniciId: kimlik.kullaniciId,
    saglayici: "dış kimlik",
  });
  await oturumAc(kimlik.kullaniciId);

  return { durum: "BASARILI", kullaniciId: kimlik.kullaniciId };
}

/**
 * Kullanıcı EBA'dan mı, dış giriş kapısından mı geliyor?
 *
 * ÖLÇÜT `dis_kimlik` SATIRI — rol değil. Aynı ölçüt kimlik seçerek girişte de
 * kullanılıyor (bkz. mock-giris.ts): MEZUN/PAYDAS_TEMSILCISI rolü ileride
 * EBA'lı bir kullanıcıya da verilebilir ve o kişinin dış giriş ekranıyla işi
 * olmaz.
 *
 * ÇIKIŞTA GEREKİYOR: dış kullanıcıyı /giris'e bırakmak, onu hiç giremeyeceği
 * bir kapının önünde bırakmak olurdu (bkz. app/giris/eylemler.ts · cikisEylemi).
 *
 * KULLANICI KİMLİĞİYLE SORULUR, AuthProvider kimliğiyle değil: `dis_kimlik`
 * satırının birincil anahtarı zaten `kullanici_id`'dir, yani bu arama bir
 * birleştirme değil doğrudan anahtar okumasıdır. Oturum nesnesi de artık
 * AuthProvider kimliğini taşımıyor (bkz. lib/yetki/tipler.ts).
 */
export async function disKimlikliMi(kullaniciId: number): Promise<boolean> {
  const kimlik = await prisma.disKimlik.findUnique({
    where: { kullaniciId },
    select: { kullaniciId: true },
  });
  return kimlik !== null;
}

/**
 * Kimliği olmayan e-posta için cevap.
 *
 * Onay bekleyen başvurusu olan kişiye "başvurunuz bekliyor" denir ama YALNIZCA
 * şifresi doğruysa. Bilgi böylece yalnızca başvuruyu gerçekten yapmış olana
 * verilir; e-posta listesi deneyen birine hiçbir şey söylenmez.
 */
async function bekleyenBasvuruCevabi(
  eposta: string,
  sifre: string,
): Promise<DisGirisSonucu> {
  const bekleyen = await prisma.disKullaniciBasvurusu.findFirst({
    where: { eposta, durum: "BEKLIYOR" },
    select: { sifreOzeti: true },
  });

  // Ne kimlik ne bekleyen başvuru var: süre yine aynı olsun (bkz.
  // sahteSifreDogrulamasi).
  let bekleyenDogruMu = false;
  if (bekleyen?.sifreOzeti) {
    bekleyenDogruMu = await sifreDogrula(sifre, bekleyen.sifreOzeti);
  } else {
    await sahteSifreDogrulamasi(sifre);
  }

  if (bekleyenDogruMu) {
    return {
      durum: "BASARISIZ",
      mesaj:
        "Başvurunuz proje yöneticisinin onayını bekliyor. Onaylandığında e-posta ile bilgilendirileceksiniz.",
    };
  }

  return { durum: "BASARISIZ", mesaj: GENEL_HATA };
}
