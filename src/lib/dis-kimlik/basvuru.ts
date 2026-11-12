import type { OnayDurumu } from "@/generated/prisma/enums";
import { BILDIRIM_KODLARI, bildirimGonder } from "../bildirim/gonder";
import { prisma } from "../db";
/*
 * Eğitim-öğretim yılı hesabı öğretmen envanteriyle AYNI kaynaktan okunur.
 * Modül adı ("ogretmen") burada yanıltıcı duruyor ama kopyasını çıkarmak iki
 * yerde iki farklı yıl sınırı riski demekti; sınırın tek yerde durması modülün
 * adından önemli.
 */
import { disBasvurudanMentorlukAc } from "../mentor/veri";
import { egitimOgretimYili } from "../ogretmen/gorev-yillari";
import { erisimLogla } from "../yetki/log";
import {
  basvuruAlindiEpostasi,
  basvuruOnaylandiEpostasi,
  basvuruReddedildiEpostasi,
  bekleyenBasvuruEpostasi,
  zatenKayitliEpostasi,
} from "./eposta";
import {
  basvuruKonumu,
  type DisBasvuruKaydi,
  TUR_ETIKETLERI,
  turunRolu,
} from "./kurallar";
import { sifreOzetle } from "./sifre";

/**
 * EBA dışı giriş başvurusunun veritabanı tarafı.
 *
 * TEMEL KURAL: onaylanana kadar `kullanici` satırı AÇILMAZ. Başvuru bir
 * kullanıcı değildir; açılsaydı onaysız kişi kapsam filtrelerine, envanter
 * sayılarına ve öğretmen listesine sızardı (ogretmenKapsamFiltresi "öğrenci
 * rolü olmayan herkes" der).
 *
 * Kararlar burada değil ./kurallar.ts'de verilir; bu dosya yalnızca doğrulanmış
 * bir kaydı yazar, okur ve karara bağlar.
 */

export type BasvuruSonucu =
  | { durum: "ALINDI"; basvuruId: number }
  /**
   * Başvuru AÇILMADI ama ekran bunu söylemez (27 Ağustos 2026 · güvenlik
   * incelemesi). Çağıran bu durumu "ALINDI" ile aynı şekilde karşılar; fark
   * yalnızca adresin gerçek sahibine giden e-postada görünür.
   */
  | { durum: "SESSIZ" }
  | { durum: "REDDEDILDI"; mesaj: string };

/**
 * Yeni başvuru açar.
 *
 * ÇAKIŞMA KONTROLLERİ (hepsi aynı gerekçeyle: aynı e-posta iki hesap
 * doğuramaz):
 *   1. Aynı e-postayla BEKLEYEN başvuru varsa yenisi alınmaz. Veritabanında da
 *      kısmi unique index var (ux_dis_basvuru_bekleyen_eposta).
 *   2. E-posta zaten bir dış kimliğe bağlıysa kişi kayıtlıdır — kayıt değil
 *      giriş yapmalı.
 *
 * ÇAKIŞMA EKRANA SÖYLENMEZ (27 Ağustos 2026 · güvenlik incelemesi). İki kontrol
 * de eskiden kullanıcıya "bu adres sistemde kayıtlı" / "onay bekleyen başvuru
 * var" diyordu; bu, kimlik istemeyen bir uçta ÇALIŞAN BİR ORACLE'dı — elinde
 * adres listesi olan biri formu tek tek doldurup kimin üye olduğunu
 * öğrenebiliyordu. Artık ikisi de `SESSIZ` dönüyor, ekran "başvurunuz alındı"
 * diyor ve gerçek durumu yalnızca adresin SAHİBİ kendi gelen kutusunda görüyor.
 *
 * ZAMANLAMA DA EŞİTLENİYOR: mesajlar susturulup şifre özeti atlanırsa fark bu
 * kez SÜREDE görünürdü — gerçek başvuru scrypt çalıştırır (yüzlerce ms),
 * çakışan başvuru anında dönerdi. `sifreOzetle` bu yüzden çakışma yollarında da
 * çağrılıyor, sonucu atılıyor. Eşitleme tam değildir (gerçek yol ayrıca yazma
 * ve bildirim yapar), ama baskın terim kapanır; kalan farkı sömürmek başvuru
 * hız sınırının (app/basvuru/eylemler.ts) altında pratik değil.
 *
 * REDDEDİLMİŞ BAŞVURU ENGEL DEĞİLDİR: tekrar başvuru serbest (bkz. ret
 * gerekçesinin zorunlu olma sebebi).
 */
export async function disBasvuruOlustur(
  kayit: DisBasvuruKaydi,
  simdi: Date = new Date(),
): Promise<BasvuruSonucu> {
  const mevcutKimlik = await prisma.disKimlik.findUnique({
    where: { eposta: kayit.eposta },
    select: { kullaniciId: true },
  });
  if (mevcutKimlik) {
    await sifreOzetle(kayit.sifre);
    await zatenKayitliEpostasi(kayit.eposta);
    return { durum: "SESSIZ" };
  }

  const bekleyen = await prisma.disKullaniciBasvurusu.findFirst({
    where: { eposta: kayit.eposta, durum: "BEKLIYOR" },
    select: { id: true },
  });
  if (bekleyen) {
    await sifreOzetle(kayit.sifre);
    await bekleyenBasvuruEpostasi(kayit.eposta);
    return { durum: "SESSIZ" };
  }

  /*
   * Referans doğrulamaları: paydaş kaydı var mı ve AKTİF mi, okul kodu
   * referans tablosunda mı. Veritabanı yabancı anahtarı zaten kırılmayı
   * engeller ama hata mesajı kullanıcıya anlaşılır gelmezdi.
   */
  if (kayit.paydasId !== null) {
    const paydas = await prisma.paydas.findUnique({
      where: { id: kayit.paydasId },
      select: { aktif: true },
    });
    if (!paydas || !paydas.aktif) {
      return {
        durum: "REDDEDILDI",
        mesaj: "Seçilen paydaş kurumu bulunamadı. Listeden yeniden seçin.",
      };
    }
  }

  if (kayit.mezunKurumKodu !== null) {
    const kurum = await prisma.kurum.findUnique({
      where: { kurumKodu: kayit.mezunKurumKodu },
      select: { kurumKodu: true },
    });
    if (!kurum) {
      return {
        durum: "REDDEDILDI",
        mesaj: "Seçilen okul bulunamadı. Okulu boş bırakabilirsiniz.",
      };
    }
  }

  const sifreOzeti = await sifreOzetle(kayit.sifre);

  const basvuru = await prisma.disKullaniciBasvurusu.create({
    data: {
      tur: kayit.tur,
      ad: kayit.ad,
      soyad: kayit.soyad,
      eposta: kayit.eposta,
      telefon: kayit.telefon,
      ilKodu: kayit.ilKodu,
      ulke: kayit.ulke,
      yurtDisiSehir: kayit.yurtDisiSehir,
      sifreOzeti,
      mezunKurumKodu: kayit.mezunKurumKodu,
      mezunOkulAdi: kayit.mezunOkulAdi,
      guncelDurum: kayit.guncelDurum,
      universite: kayit.universite,
      bolum: kayit.bolum,
      calistigiKurum: kayit.calistigiKurum,
      pozisyon: kayit.pozisyon,
      mezuniyetYili: kayit.mezuniyetYili,
      paydasId: kayit.paydasId,
      gorevUnvani: kayit.gorevUnvani,
      beyan: kayit.beyan,
      aydinlatmaOnayTarihi: simdi,
      // Mentörlük isteği (7 Ağustos 2026 · tek form). Onayla birlikte
      // `mentorluk` kaydına taşınır; başvuru satırı dondurulmuş bir belgedir.
      mentorlukIstiyor: kayit.mentorlukIstiyor,
      mentorlukKonulari: kayit.mentorlukKonulari,
      mentorlukGrupIdleri: kayit.mentorlukGrupIdleri,
    },
    select: {
      id: true,
      ulke: true,
      yurtDisiSehir: true,
      il: { select: { ad: true } },
    },
  });

  await basvuruAlindiEpostasi(kayit.eposta, `${kayit.ad} ${kayit.soyad}`);
  await projeYoneticilerineHaberVer(
    `${kayit.ad} ${kayit.soyad}`,
    TUR_ETIKETLERI[kayit.tur],
    basvuruKonumu(basvuru),
  );

  return { durum: "ALINDI", basvuruId: basvuru.id };
}

/**
 * Onay kuyruğunu izleyen proje yöneticileri.
 *
 * Bildirim tek tek gönderiliyor çünkü panel bildirimi kullanıcı başına bir
 * satırdır; toplu gönderim diye bir kavram yok (bkz. lib/bildirim/gonder.ts).
 */
async function projeYoneticilerineHaberVer(
  basvuranAdSoyad: string,
  tur: string,
  ilAdi: string,
): Promise<void> {
  const yoneticiler = await prisma.kullaniciRol.findMany({
    where: { rolKodu: "PROJE_YONETICISI", bitisTarihi: null },
    select: { kullaniciId: true },
  });

  for (const yonetici of yoneticiler) {
    await bildirimGonder({
      kullaniciId: yonetici.kullaniciId,
      kod: BILDIRIM_KODLARI.ONAY_BEKLEYEN_DIS_BASVURU,
      degiskenler: { basvuranAdSoyad, tur, ilAdi },
    });
  }
}

// ---------------------------------------------------------------------------
// Listeleme
// ---------------------------------------------------------------------------

/** Onay ekranının gösterdiği alanlar. Şifre özeti BİLİNÇLİ olarak yok. */
const BASVURU_ALANLARI = {
  id: true,
  tur: true,
  ad: true,
  soyad: true,
  eposta: true,
  telefon: true,
  ilKodu: true,
  ulke: true,
  yurtDisiSehir: true,
  mezuniyetYili: true,
  mezunOkulAdi: true,
  guncelDurum: true,
  universite: true,
  bolum: true,
  calistigiKurum: true,
  pozisyon: true,
  mentorlukIstiyor: true,
  mentorlukKonulari: true,
  gorevUnvani: true,
  beyan: true,
  durum: true,
  kararTarihi: true,
  retGerekcesi: true,
  olusturmaTarihi: true,
  aydinlatmaOnayTarihi: true,
  il: { select: { ad: true } },
  mezunKurum: { select: { ad: true } },
  paydas: { select: { id: true, ad: true, tur: true } },
  kararVeren: { select: { ad: true, soyad: true } },
  olusanKullanici: { select: { id: true } },
} as const;

export type BasvuruSatiri = Awaited<
  ReturnType<typeof basvurulariListele>
>[number];

export async function basvurulariListele(
  durum: OnayDurumu | "TUMU" = "BEKLIYOR",
) {
  return prisma.disKullaniciBasvurusu.findMany({
    where: durum === "TUMU" ? {} : { durum },
    select: BASVURU_ALANLARI,
    // Bekleyenler en ESKİDEN başlar (sıra beklemişin hakkı), karara bağlananlar
    // zaten tarih sırasıyla okunuyor.
    orderBy: { olusturmaTarihi: durum === "BEKLIYOR" ? "asc" : "desc" },
  });
}

export async function bekleyenBasvuruSayisi(): Promise<number> {
  return prisma.disKullaniciBasvurusu.count({ where: { durum: "BEKLIYOR" } });
}

// ---------------------------------------------------------------------------
// Karar
// ---------------------------------------------------------------------------

export type KararSonucu =
  | { olduMu: true; mesaj: string }
  | { olduMu: false; neden: string };

/**
 * Başvuruyu onaylar: kullanıcı, rolü, iletişim profili ve giriş kimliği tek
 * transaction'da açılır.
 *
 * NEDEN TEK TRANSACTION: yarım kalmış bir onay, giriş kimliği olmayan bir
 * kullanıcı (hiç giremez) ya da rolü olmayan bir hesap (girer ama hiçbir yere
 * ait değildir) bırakırdı. İkisi de elle düzeltilmesi gereken durumlar.
 *
 * authProviderId `dis-<başvuruId>` biçimindedir. Oturum katmanı yalnızca bu
 * kimliği taşır ve hangi yoldan gelindiğini bilmez — EBA entegrasyonu
 * geldiğinde de değişmeyecek olan sınır budur. Önek, mock sağlayıcının
 * seçilebilir kimlik listesine bu kullanıcıların KARIŞMAMASINI da sağlar
 * (o liste "uretilen-" önekine bakar).
 */
export async function basvuruyuOnayla(
  basvuruId: number,
  kararVerenKullaniciId: number,
  simdi: Date = new Date(),
): Promise<KararSonucu> {
  const basvuru = await prisma.disKullaniciBasvurusu.findUnique({
    where: { id: basvuruId },
    select: {
      id: true,
      tur: true,
      ad: true,
      soyad: true,
      eposta: true,
      telefon: true,
      ilKodu: true,
      sifreOzeti: true,
      mentorlukIstiyor: true,
      mentorlukKonulari: true,
      mentorlukGrupIdleri: true,
      durum: true,
    },
  });

  if (!basvuru) return { olduMu: false, neden: "Başvuru bulunamadı." };
  if (basvuru.durum !== "BEKLIYOR") {
    return { olduMu: false, neden: "Bu başvuru zaten karara bağlanmış." };
  }
  if (!basvuru.sifreOzeti) {
    // Şifre özeti karar anında taşınıp NULL'lanıyor; bekleyen bir başvuruda
    // boş olması veri bozulmasıdır ve sessizce geçilmemeli.
    return {
      olduMu: false,
      neden:
        "Başvurunun giriş bilgisi eksik. Kişiden yeniden başvurmasını isteyin.",
    };
  }

  await prisma.$transaction(async (islem) => {
    const kullanici = await islem.kullanici.create({
      data: {
        authProviderId: `dis-${basvuru.id}`,
        ad: basvuru.ad,
        soyad: basvuru.soyad,
        /*
         * Cinsiyet "B" (belirtilmedi): dış başvuruda sorulmuyor. Alan e-Okul
         * kaynaklı olduğu için zorunlu tanımlı ama mezundan/paydaştan
         * istenmesinin hiçbir işlevsel karşılığı yok — toplanmayan veri en
         * güvenli veridir.
         */
        cinsiyet: "B",
        kurumKodu: null,
        ilKodu: basvuru.ilKodu,
        ilceKodu: null,
        sinif: null,
        brans: null,
        egitimOgretimYili: egitimOgretimYili(simdi),
      },
      select: { id: true },
    });

    await islem.kullaniciRol.create({
      data: {
        kullaniciId: kullanici.id,
        rolKodu: turunRolu(basvuru.tur),
        atayanKullaniciId: kararVerenKullaniciId,
      },
    });

    /*
     * İletişim bilgisi ogretmen_profil'de tutulur. Tablonun adı tarihseldir;
     * içeriği "öğrenci OLMAYAN kullanıcının iletişim bilgisi"dir ve YEĞİTEK
     * personeli de aynı satırı kullanıyor. Ayrı bir tablo açmak, profil
     * ekranını üç kaynaklı hâle getirirdi.
     */
    await islem.ogretmenProfil.create({
      data: {
        kullaniciId: kullanici.id,
        eposta: basvuru.eposta,
        telefon: basvuru.telefon,
      },
    });

    await islem.disKimlik.create({
      data: {
        kullaniciId: kullanici.id,
        eposta: basvuru.eposta,
        sifreOzeti: basvuru.sifreOzeti as string,
      },
    });

    /*
     * MENTÖRLÜK, ONAYLA BİRLİKTE AÇILIR (7 Ağustos 2026).
     *
     * Ayrı bir onay adımı YOK: proje yöneticisi başvurunun tamamını zaten
     * onayladı ve mentörlük isteği o başvurunun içindeydi. İkinci bir kuyruğa
     * düşürmek, aynı kararı iki kez sormak olurdu.
     *
     * Grup kimlikleri burada YENİDEN doğrulanıyor: başvuru ile karar arasında
     * geçen sürede bir grup pasife alınmış olabilir.
     */
    if (basvuru.mentorlukIstiyor) {
      await disBasvurudanMentorlukAc(islem, {
        kullaniciId: kullanici.id,
        kararVerenKullaniciId,
        konular: basvuru.mentorlukKonulari,
        grupIdleri: basvuru.mentorlukGrupIdleri,
      });
    }

    await islem.disKullaniciBasvurusu.update({
      where: { id: basvuru.id },
      data: {
        durum: "ONAYLANDI",
        kararVerenKullaniciId,
        kararTarihi: simdi,
        olusanKullaniciId: kullanici.id,
        // Sır, karara bağlanmış başvuru satırında durmaz; dis_kimlik'e taşındı.
        sifreOzeti: null,
      },
    });
  });

  await erisimLogla({
    kullaniciId: kararVerenKullaniciId,
    islem: "DEGISIKLIK",
    hedefTip: "DIS_BASVURU",
    hedefId: basvuru.id,
    detay: `Dış giriş başvurusu onaylandı: ${basvuru.ad} ${basvuru.soyad} (${TUR_ETIKETLERI[basvuru.tur]})`,
  });

  await basvuruOnaylandiEpostasi(
    basvuru.eposta,
    `${basvuru.ad} ${basvuru.soyad}`,
  );

  return {
    olduMu: true,
    mesaj: `${basvuru.ad} ${basvuru.soyad} onaylandı; giriş yapabilir.`,
  };
}

/**
 * Başvuruyu reddeder.
 *
 * Kayıt SİLİNMEZ: "bu kişi neden alınmadı" sorusunun cevabı gerekiyor ve aynı
 * kişi tekrar başvurabiliyor. Şifre özeti burada da NULL'lanır — reddedilen
 * başvuruda sırrı tutmanın hiçbir karşılığı yok.
 */
export async function basvuruyuReddet(
  basvuruId: number,
  kararVerenKullaniciId: number,
  gerekce: string,
  simdi: Date = new Date(),
): Promise<KararSonucu> {
  const basvuru = await prisma.disKullaniciBasvurusu.findUnique({
    where: { id: basvuruId },
    select: { id: true, ad: true, soyad: true, eposta: true, durum: true },
  });

  if (!basvuru) return { olduMu: false, neden: "Başvuru bulunamadı." };
  if (basvuru.durum !== "BEKLIYOR") {
    return { olduMu: false, neden: "Bu başvuru zaten karara bağlanmış." };
  }

  await prisma.disKullaniciBasvurusu.update({
    where: { id: basvuru.id },
    data: {
      durum: "REDDEDILDI",
      kararVerenKullaniciId,
      kararTarihi: simdi,
      retGerekcesi: gerekce,
      sifreOzeti: null,
    },
  });

  await erisimLogla({
    kullaniciId: kararVerenKullaniciId,
    islem: "DEGISIKLIK",
    hedefTip: "DIS_BASVURU",
    hedefId: basvuru.id,
    detay: `Dış giriş başvurusu reddedildi: ${basvuru.ad} ${basvuru.soyad}`,
  });

  await basvuruReddedildiEpostasi(
    basvuru.eposta,
    `${basvuru.ad} ${basvuru.soyad}`,
    gerekce,
  );

  return {
    olduMu: true,
    mesaj: `${basvuru.ad} ${basvuru.soyad} başvurusu reddedildi.`,
  };
}
