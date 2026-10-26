"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type {
  BasvuruDurumu,
  EtkinlikKategorisi,
  Kapsam,
} from "@/generated/prisma/enums";
import { oturumKullanicisiZorunlu } from "@/lib/auth/oturum";
import {
  BILDIRIM_KODLARI,
  type BildirimHedefi,
  bildirimGonder,
  ilKoordinatorlerineBildir,
  projeYoneticilerineBildir,
} from "@/lib/bildirim/gonder";
import { prisma } from "@/lib/db";
import { ekKaydet, ekSinirlariniGetir } from "@/lib/faaliyet/ek-kaydet";
import {
  faaliyetKapsamiCikar,
  faaliyetSatiriniKilitle,
  gorunurFaaliyetGetir,
} from "@/lib/faaliyet/erisim";
import {
  BASVURU_DURUMU_ETIKETLERI,
  basvuruPenceresi,
  basvuruYapilabilirMi,
  danismanaKopyaGerekiyorMu,
  degerlendirmeYapilabilirMi,
  duzenleyenBirimBelirle,
  FaaliyetKuralHatasi,
  type FaaliyetYeri,
  faaliyetYeriBelirle,
  KAPSAM_ETIKETLERI,
  kapsamSecenekleri,
  katilimciTipi,
  vekaletenBasvuruGecerliMi,
  kontenjanDegisikligiGecerliMi,
  kontenjanDurumu,
  onayDurumuBelirle,
  faaliyetSuresiGecerliMi,
  yenidenOnayGerekiyorMu,
} from "@/lib/faaliyet/kurallar";
import {
  baslangicOnayDurumu,
  degerlendirmeyeHazirMi,
} from "@/lib/basvuru/il-disi";
import {
  yoklamaAlinabilirMi,
  yoklamaDegeriCoz,
} from "@/lib/belge/kapi";
import { katilimBicimiGecerliMi } from "@/lib/kazanim/kurallar";
import { gunBasi, gunSonu, yerelTarihSaat } from "@/lib/tarih";
import {
  baskasiAdinaBasvurabilirMi,
  basvuruDegerlendirebilirMi,
  basvuruYapabilirMi,
  danismanMi,
  disKullaniciMi,
  ekYukleyebilirMi,
  faaliyetIptalEdebilirMi,
  faaliyetOnaylayabilirMi,
  faaliyetRaporuYazabilirMi,
  koordinatorIlKodu,
  mezunMu,
  ogrenciMi,
} from "@/lib/yetki/izinler";
import {
  ogrenciKapsamFiltresi,
  paydasKapsamFiltresi,
} from "@/lib/yetki/kapsam";
import { erisimLogla } from "@/lib/yetki/log";
import { BulunamadiHatasi, YetkiHatasi } from "@/lib/yetki/tipler";

/**
 * Faaliyet ve başvuru sunucu eylemleri.
 *
 * Kararlar burada verilmez; src/lib/faaliyet/kurallar.ts ve src/lib/yetki
 * içindeki saf fonksiyonlara sorulur. Bu dosyanın işi formu çözümlemek,
 * kuralı çağırmak, veritabanına yazmak ve loglamaktır.
 */

function metin(veri: FormData, alan: string): string {
  return String(veri.get(alan) ?? "").trim();
}

function sayi(veri: FormData, alan: string): number | null {
  const deger = Number.parseInt(metin(veri, alan), 10);
  return Number.isFinite(deger) ? deger : null;
}

function hataylaDon(yol: string, mesaj: string): never {
  redirect(`${yol}?hata=${encodeURIComponent(mesaj)}`);
}

/**
 * Bildirimin işaret ettiği etkinlik — panelde "Etkinliğe git" düğmesi olur.
 *
 * Hedef bildirim YAZILIRKEN kaydediliyor: gövdede yalnızca etkinliğin adı
 * geçiyor ve aynı adı taşıyan iki etkinlik olabilir, yani okuma tarafında
 * addan kimliğe gitmek kullanıcıyı yanlış kayda götürebilirdi
 * (bkz. lib/bildirim/hedef.ts).
 */
function etkinlikHedefi(faaliyetId: number): BildirimHedefi {
  return { tip: "FAALIYET", id: faaliyetId };
}

// ---------------------------------------------------------------------------
// Faaliyet açma
// ---------------------------------------------------------------------------

export async function faaliyetOlusturEylemi(veri: FormData): Promise<void> {
  const kullanici = await oturumKullanicisiZorunlu();
  const yol = "/panel/etkinlikler/yeni";

  const kapsam = metin(veri, "kapsam") as Kapsam;
  // Yetki kontrolü formdan gelen değere değil, rolün açabildiği kapsamlara
  // bakar: forma elle eklenen bir "ULUSAL" değeri burada düşer.
  if (!kapsamSecenekleri(kullanici).includes(kapsam)) {
    throw new YetkiHatasi("Bu kapsamda etkinlik açma yetkiniz yok.");
  }

  /*
   * KATEGORİ ARTIK SORULMUYOR (20 Ağustos 2026 · istek: "etkinlik oluştururken
   * etkinlik kategorisi alanı kalksın, filtre kısmından da etkinlik kategorisi
   * kalksın").
   *
   * Kolon duruyor — kayıtlı etkinliklerin rozeti ve dışa aktarma sütunu ondan
   * okunuyor — ama değeri artık SEÇİLEN PROGRAMDAN türetiliyor: her program
   * bir gruba aittir (Temel Etkinlik / Çalışma Grubu Etkinliği), program
   * seçilmediyse etkinlik İl Etkinliği'dir.
   *
   * Kategori-program eşleşmesini ayrıca doğrulamaya gerek kalmadı: kategori
   * artık programın kendisinden geldiği için ikisi tanımı gereği uyumlu
   * (eski doğrulama lib/faaliyet/kurallar.ts'te duruyor).
   */
  const programId = sayi(veri, "temelEtkinlikProgramiId");
  const program =
    programId !== null
      ? await prisma.temelEtkinlikProgrami.findFirst({
          where: { id: programId, aktif: true },
          select: { id: true, ad: true, grup: true },
        })
      : null;
  const etkinlikKategorisi: EtkinlikKategorisi =
    program?.grup ?? "IL_ETKINLIGI";

  const serbestAd = metin(veri, "ad");
  const ad = program?.ad ?? serbestAd;
  const aciklama = metin(veri, "aciklama");
  if (!ad || !aciklama) {
    hataylaDon(yol, "Etkinlik adı ve açıklaması zorunludur.");
  }

  const tarih = yerelTarihSaat(metin(veri, "tarih") || null);
  if (!tarih) {
    hataylaDon(yol, "Etkinlik tarihi zorunludur.");
  }
  // Bitiş isteğe bağlıdır: boş bırakılan faaliyet tek günlüktür.
  const faaliyetBitisi = yerelTarihSaat(metin(veri, "bitisTarihi") || null);

  /*
   * GEÇMİŞ TARİHLİ ETKİNLİK (26 Ekim 2026 · istek: "geriye dönük birkaç
   * etkinlik gireyim, başvuramasalar da görsün"). Etkinlik bitmişse başvuru
   * tarihleri sorulmaz: başvuru penceresi etkinliğin başladığı ana kurulur (o
   * an geçmişte olduğu için),
   * yani kayıt "başvuru kapandı" olarak görünür. Önceden formdaki başvuru
   * başlangıcı kendiliğinden BUGÜN geldiği için geçmiş bir başvuru bitişi
   * "bitiş başlangıçtan önce olamaz" diye reddediliyordu.
   */
  const gecmisEtkinlikMi = (faaliyetBitisi ?? tarih) < new Date();
  const basvuruBaslangic = gecmisEtkinlikMi
    ? tarih
    : gunBasi(metin(veri, "basvuruBaslangic") || null);
  const basvuruBitis = gecmisEtkinlikMi
    ? tarih
    : gunSonu(metin(veri, "basvuruBitis") || null);
  if (!basvuruBaslangic || !basvuruBitis) {
    hataylaDon(yol, "Başvuru tarihleri zorunludur.");
  }
  if (basvuruBitis < basvuruBaslangic) {
    hataylaDon(yol, "Başvuru bitişi başlangıçtan önce olamaz.");
  }

  const sureKarari = faaliyetSuresiGecerliMi(tarih, faaliyetBitisi);
  if (!sureKarari.olurMu) {
    hataylaDon(yol, sureKarari.neden ?? "Etkinlik süresi geçersiz.");
  }

  /*
   * Katılım biçimi ve hedef kitle İSTEĞE BAĞLI: her faaliyette söylenecek bir
   * şey olmayabilir ve zorunlu kılmak kullanıcıyı rastgele seçmeye iter.
   * Geçersiz bir enum değeri gelirse sessizce boş bırakılır.
   */
  const katilimBicimiHam = metin(veri, "katilimBicimi");
  const katilimBicimi = katilimBicimiGecerliMi(katilimBicimiHam)
    ? katilimBicimiHam
    : null;
  const hedefKitle = metin(veri, "hedefKitle").slice(0, 200) || null;

  const kontenjan = sayi(veri, "kontenjan");
  if (kontenjan === null || kontenjan < 1) {
    hataylaDon(yol, "Kontenjan en az 1 olmalıdır.");
  }

  let yer: FaaliyetYeri;
  try {
    // Yer bilgisi formdan değil roldan gelir; tek istisna YEĞİTEK'in il seçimi.
    yer = faaliyetYeriBelirle(kullanici, kapsam, metin(veri, "ilKodu") || null);
  } catch (hata) {
    if (hata instanceof FaaliyetKuralHatasi) hataylaDon(yol, hata.message);
    throw hata;
  }

  /*
   * Birim adı için gereken il, faaliyetin ili DEĞİL düzenleyenin ilidir:
   * ulusal faaliyette yer alanları boş kalır ama kartta yine "İstanbul İl
   * Koordinatörlüğü" yazması gerekir. Öğrencinin rol kapsamı olmadığı için
   * onun ili kayıtlı ilinden okunur.
   */
  const birimIlKodu =
    yer.ilKodu ?? koordinatorIlKodu(kullanici) ?? kullanici.ilKodu;

  /*
   * Okul adı, faaliyetin okulu YOKKEN de gerekebiliyor: öğrencinin açtığı il ya
   * da ulusal öneride onaycıya "hangi okuldan geldi" bilgisi gidiyor. Bu yüzden
   * yerin okulu boşsa kullanıcının kendi okuluna düşülüyor.
   */
  const birimKurumKodu = yer.kurumKodu ?? kullanici.kurumKodu;

  const [okul, il] = await Promise.all([
    birimKurumKodu
      ? prisma.kurum.findUnique({
          where: { kurumKodu: birimKurumKodu },
          // ilKodu: öğretmen faaliyetinin onayı OKULUN iline gider; kişinin
          // kayıtlı ili görev yaptığı okulun ilinden farklı olabilir.
          select: { ad: true, ilKodu: true },
        })
      : null,
    birimIlKodu
      ? prisma.il.findUnique({
          where: { ilKodu: birimIlKodu },
          select: { ad: true },
        })
      : null,
  ]);

  // İlçe yalnızca daraltıcı bir etikettir ve faaliyetin ili dışına çıkamaz.
  const ilceKodu = metin(veri, "ilceKodu") || null;
  const gecerliIlce =
    ilceKodu && yer.ilKodu
      ? await prisma.ilce.findFirst({
          where: { ilceKodu, ilKodu: yer.ilKodu },
          select: { ilceKodu: true },
        })
      : null;

  const gruplar = veri
    .getAll("grupId")
    .map((deger) => Number.parseInt(String(deger), 10))
    .filter((deger) => Number.isFinite(deger));
  const gecerliGruplar = await prisma.calismaGrubu.findMany({
    where: { id: { in: gruplar }, aktif: true },
    select: { id: true },
  });

  /*
   * İŞ BİRLİĞİ YAPILAN PAYDAŞLAR (J4 · 6 Ağustos 2026). Formdan gelen kimlikler
   * KAPSAM FİLTRESİNDEN geçirilir: istek elle kurcalanıp başka ilin paydaş
   * kimliği yazıldığında o kurum bağlanmamalı. Pasife alınmış kurum da yeni
   * etkinliğe bağlanmaz (aynı kural detay ekranında da var).
   */
  const paydasIdleri = veri
    .getAll("paydasId")
    .map((deger) => Number.parseInt(String(deger), 10))
    .filter((deger) => Number.isFinite(deger));
  const gecerliPaydaslar =
    paydasIdleri.length > 0
      ? await prisma.paydas.findMany({
          where: {
            AND: [
              { id: { in: paydasIdleri } },
              { aktif: true },
              paydasKapsamFiltresi(kullanici),
            ],
          },
          select: { id: true },
        })
      : [];

  const onayDurumu = onayDurumuBelirle(kullanici, kapsam);

  const faaliyet = await prisma.faaliyet.create({
    data: {
      ad,
      aciklama,
      tarih,
      bitisTarihi: faaliyetBitisi,
      katilimBicimi,
      hedefKitle,
      kapsam,
      etkinlikKategorisi,
      temelEtkinlikProgramiId: program?.id ?? null,
      kurumKodu: yer.kurumKodu,
      ilKodu: yer.ilKodu,
      ilceKodu: gecerliIlce?.ilceKodu ?? null,
      kontenjan,
      duzenleyenKullaniciId: kullanici.id,
      duzenleyenBirim: duzenleyenBirimBelirle(kullanici, kapsam, {
        okulAdi: okul?.ad,
        ilAdi: il?.ad,
      }),
      onayDurumu,
      basvuruBaslangic,
      basvuruBitis,
      calismaGruplari: {
        create: gecerliGruplar.map((grup) => ({ calismaGrubuId: grup.id })),
      },
      paydaslar: {
        create: gecerliPaydaslar.map((paydas) => ({ paydasId: paydas.id })),
      },
    },
    select: { id: true },
  });

  /*
   * Tanıtıcı görsel isteğe bağlıdır. Görsel kabul edilmezse faaliyet geri
   * ALINMAZ — tarihleri ve kontenjanı doğru girilmiş bir faaliyeti yalnızca
   * dosya yüzünden silmek kullanıcıyı formu baştan doldurmaya zorlardı.
   * Faaliyet açılır, kullanıcı detay ekranında gerekçeyle uyarılır.
   */
  const kapak = veri.get("kapakGorseli");
  let kapakUyarisi: string | null = null;
  if (kapak instanceof File && kapak.size > 0) {
    const sonuc = await ekKaydet({
      faaliyetId: faaliyet.id,
      yukleyenKullaniciId: kullanici.id,
      dosya: kapak,
      sinirlar: await ekSinirlariniGetir(),
      kapakYap: true,
    });
    if (!sonuc.olurMu) {
      kapakUyarisi = sonuc.neden ?? "Tanıtıcı görsel yüklenemedi.";
    }
  }

  /*
   * Onay bildirimi iki ayrı akıştır.
   *
   * Öğrencinin açtığı faaliyette uyarı HEM ilin koordinatörüne HEM merkeze
   * gider; ikisi de onaylayabilir ve ilk verilen karar geçerlidir. Koordinatöre
   * de gitmesi şart: merkez sırası gelene kadar bekleyen bir okul içi öğrenci
   * etkinliği pratikte ölürdü. İl koordinatörü yoksa (boş il) uyarı merkeze
   * gitmeye devam eder, öneri kaybolmaz.
   */
  if (onayDurumu === "BEKLIYOR") {
    if (ogrenciMi(kullanici)) {
      const degiskenler = {
        faaliyetAdi: ad,
        duzenleyenAdSoyad: `${kullanici.ad} ${kullanici.soyad}`,
        kapsam: KAPSAM_ETIKETLERI[kapsam],
        okulAdi: okul?.ad ?? "—",
      };
      /*
       * BİLDİRİM, ETKİNLİĞİN İLİNE GİDER — öğrencinin kayıtlı iline değil
       * (11 Ağustos 2026). Onay yetkisi etkinliğin iline bakıyor
       * (`ilKoordinatoruOnaylayabilirMi`: faaliyet.ilKodu → okulun ili →
       * düzenleyenin ili) ama bildirim yalnızca `kullanici.ilKodu`ya
       * gidiyordu. Okulu başka ilde olan bir öğrencide ikisi ayrışıyor ve
       * sonuç ters oluyordu: haberi alan koordinatör onaylayamıyor,
       * onaylayabilen koordinatörün haberi olmuyor. Öğretmen dalında bu zaten
       * doğru yazılmıştı (`okul?.ilKodu ?? kullanici.ilKodu`).
       */
      await ilKoordinatorlerineBildir(
        yer.ilKodu ?? okul?.ilKodu ?? kullanici.ilKodu,
        BILDIRIM_KODLARI.ONAY_BEKLEYEN_OGRENCI_FAALIYETI,
        degiskenler,
        etkinlikHedefi(faaliyet.id),
      );
      /*
       * MERKEZ HER HÂLÜKÂRDA HABERDAR EDİLİR (istek · 11 Ağustos 2026:
       * "öğrenci etkinlik açarsa il koordinatöründen hariç her halükarda proje
       * yöneticisi de onay verebilsin"). Gönderim koordinatöre ulaşıp
       * ulaşmadığına BAKMAZ — öğretmen dalındaki gibi "koordinatör yoksa
       * merkeze düş" değil, ikisi birden. Yetki tarafında da öyle:
       * `faaliyetOnaylayabilirMi` proje yöneticisine her faaliyette evet der.
       */
      await projeYoneticilerineBildir(
        BILDIRIM_KODLARI.ONAY_BEKLEYEN_OGRENCI_FAALIYETI,
        degiskenler,
        etkinlikHedefi(faaliyet.id),
      );
    } else if (disKullaniciMi(kullanici)) {
      /*
       * Mezun / paydaş temsilcisi / mentör etkinliği (7 Ağustos 2026 · "Etkinlik
       * Bildir"). Öğrencidekiyle AYNI çift gönderim: hem ilin koordinatörü hem
       * merkez onaylayabilir, ilk karar geçerlidir.
       *
       * Şablon ayrı: dış kullanıcının okulu yok, onaylayanın ekranında "hangi
       * okuldan geldi" yerine kişinin SIFATI yazıyor — karar buna bakılarak
       * veriliyor.
       */
      const degiskenler = {
        faaliyetAdi: ad,
        duzenleyenAdSoyad: `${kullanici.ad} ${kullanici.soyad}`,
        kapsam: KAPSAM_ETIKETLERI[kapsam],
        sifat: mezunMu(kullanici) ? "Mezun" : "Paydaş temsilcisi",
      };
      // Öğrenci dalıyla aynı çözüm: hedef, etkinliğin ili (11 Ağustos 2026).
      await ilKoordinatorlerineBildir(
        yer.ilKodu ?? kullanici.ilKodu,
        BILDIRIM_KODLARI.ONAY_BEKLEYEN_DIS_KULLANICI_ETKINLIGI,
        degiskenler,
        etkinlikHedefi(faaliyet.id),
      );
      await projeYoneticilerineBildir(
        BILDIRIM_KODLARI.ONAY_BEKLEYEN_DIS_KULLANICI_ETKINLIGI,
        degiskenler,
        etkinlikHedefi(faaliyet.id),
      );
    } else if (danismanMi(kullanici)) {
      /*
       * Öğretmen faaliyetinde uyarı YALNIZCA ilin koordinatörüne gider; merkez
       * de onaylayabilir ama her okulun her etkinliği YEĞİTEK'e bildirilseydi
       * bildirim listesi kullanılamaz hâle gelirdi.
       *
       * İlde koordinatör yoksa faaliyet ASKIDA KALIRDI: bildirim kimseye
       * gitmez, kimse onaylamaz. Bu yüzden gönderim sayısı sıfırsa uyarı
       * merkeze düşürülüyor.
       */
      const degiskenler = {
        faaliyetAdi: ad,
        duzenleyenAdSoyad: `${kullanici.ad} ${kullanici.soyad}`,
        kapsam: KAPSAM_ETIKETLERI[kapsam],
        okulAdi: okul?.ad ?? "—",
      };
      const ulasan = await ilKoordinatorlerineBildir(
        okul?.ilKodu ?? kullanici.ilKodu,
        BILDIRIM_KODLARI.ONAY_BEKLEYEN_OGRETMEN_FAALIYETI,
        degiskenler,
        etkinlikHedefi(faaliyet.id),
      );
      if (ulasan === 0) {
        await projeYoneticilerineBildir(
          BILDIRIM_KODLARI.ONAY_BEKLEYEN_OGRETMEN_FAALIYETI,
          degiskenler,
          etkinlikHedefi(faaliyet.id),
        );
      }
    } else {
      await projeYoneticilerineBildir(
        BILDIRIM_KODLARI.ONAY_BEKLEYEN_ULUSAL_FAALIYET,
        {
          faaliyetAdi: ad,
          duzenleyenAdSoyad: `${kullanici.ad} ${kullanici.soyad}`,
        },
        etkinlikHedefi(faaliyet.id),
      );
    }
  }

  await erisimLogla({
    kullaniciId: kullanici.id,
    islem: "DEGISIKLIK",
    hedefTip: "FAALIYET",
    hedefId: faaliyet.id,
    detay: `Etkinlik açıldı: ${ad} (${kapsam} · ${etkinlikKategorisi})`,
  });

  revalidatePath("/panel/etkinlikler");
  redirect(
    kapakUyarisi
      ? `/panel/etkinlikler/${faaliyet.id}?durum=olusturuldu&hata=${encodeURIComponent(
          `Etkinlik açıldı ancak tanıtıcı görsel eklenemedi: ${kapakUyarisi}`,
        )}`
      : `/panel/etkinlikler/${faaliyet.id}?durum=olusturuldu`,
  );
}

// ---------------------------------------------------------------------------
// Faaliyet düzenleme ve iptal
// ---------------------------------------------------------------------------

/**
 * Düzenleme yetkisi: faaliyeti AÇAN kullanıcı, düzenleyen görevden ayrıldıysa
 * ilin koordinatörü, ve her durumda proje yöneticisi.
 *
 * Ek yükleme yetkisiyle aynı kapı kullanılıyor: ikisi de "bu faaliyet senin mi"
 * sorusunun cevabıdır, ayrı bir izin ağacı açmaya gerek yok. İPTAL bu kapının
 * dışındadır ve daha dardır (bkz. faaliyetIptalEdebilirMi).
 */
async function duzenlenebilirFaaliyetGetir(faaliyetId: number) {
  const kullanici = await oturumKullanicisiZorunlu();
  const faaliyet = await gorunurFaaliyetGetir(kullanici, faaliyetId);
  if (!faaliyet) throw new BulunamadiHatasi();

  const kapsam = faaliyetKapsamiCikar(faaliyet);
  if (!ekYukleyebilirMi(kullanici, kapsam)) {
    throw new YetkiHatasi("Bu etkinliği düzenleme yetkiniz yok.");
  }

  return { kullanici, faaliyet, kapsam, yol: `/panel/etkinlikler/${faaliyetId}` };
}

/**
 * Faaliyetin tarih ve kontenjanını günceller.
 *
 * İki kural burada birleşiyor:
 *   1. Kontenjan, seçilmiş öğrenci sayısının ALTINA düşürülemez — seçim geri
 *      alınmış olurdu.
 *   2. Onaylanmış ulusal faaliyette tarih değişirse onay DÜŞER: proje
 *      yöneticisi belli bir tarihe onay vermişti. Kontenjan artışı istisnadır.
 */
export async function faaliyetDuzenleEylemi(veri: FormData): Promise<void> {
  const faaliyetId = sayi(veri, "faaliyetId");
  if (faaliyetId === null) throw new BulunamadiHatasi();

  const { kullanici, faaliyet, kapsam, yol } =
    await duzenlenebilirFaaliyetGetir(faaliyetId);

  if (faaliyet.durum === "IPTAL_EDILDI") {
    hataylaDon(yol, "İptal edilmiş etkinlik düzenlenemez.");
  }

  const tarih = yerelTarihSaat(metin(veri, "tarih") || null);
  const basvuruBaslangic = gunBasi(metin(veri, "basvuruBaslangic") || null);
  const basvuruBitis = gunSonu(metin(veri, "basvuruBitis") || null);
  if (!tarih || !basvuruBaslangic || !basvuruBitis) {
    hataylaDon(yol, "Etkinlik tarihi ve başvuru tarihleri zorunludur.");
  }
  if (basvuruBitis < basvuruBaslangic) {
    hataylaDon(yol, "Başvuru bitişi başlangıçtan önce olamaz.");
  }

  // Bitiş isteğe bağlıdır: boş bırakılan faaliyet tek günlüktür.
  const faaliyetBitisi = yerelTarihSaat(metin(veri, "bitisTarihi") || null);
  const sureKarari = faaliyetSuresiGecerliMi(tarih, faaliyetBitisi);
  if (!sureKarari.olurMu) {
    hataylaDon(yol, sureKarari.neden ?? "Etkinlik süresi geçersiz.");
  }

  const yeniKontenjan = sayi(veri, "kontenjan");
  if (yeniKontenjan === null) {
    hataylaDon(yol, "Kontenjan en az 1 olmalıdır.");
  }

  const durum = kontenjanDurumu(faaliyet.basvurular, faaliyet.kontenjan);
  const kontenjanKarari = kontenjanDegisikligiGecerliMi(yeniKontenjan, durum);
  if (!kontenjanKarari.olurMu) {
    hataylaDon(yol, kontenjanKarari.neden ?? "Kontenjan güncellenemedi.");
  }

  const tarihDegistiMi =
    tarih.getTime() !== faaliyet.tarih.getTime() ||
    basvuruBaslangic.getTime() !== faaliyet.basvuruBaslangic.getTime() ||
    basvuruBitis.getTime() !== faaliyet.basvuruBitis.getTime() ||
    // Süre de tarihin parçasıdır: onaylanmış 1 günlük faaliyeti 3 aya
    // uzatmak onayın konusunu değiştirir.
    (faaliyetBitisi?.getTime() ?? null) !==
      (faaliyet.bitisTarihi?.getTime() ?? null);

  const onayDusuyorMu = yenidenOnayGerekiyorMu({
    onayDurumu: faaliyet.onayDurumu,
    tarihDegistiMi,
    kontenjanAzaldiMi: yeniKontenjan < faaliyet.kontenjan,
  });

  await prisma.faaliyet.update({
    where: { id: faaliyet.id },
    data: {
      tarih,
      bitisTarihi: faaliyetBitisi,
      basvuruBaslangic,
      basvuruBitis,
      kontenjan: yeniKontenjan,
      ...(onayDusuyorMu
        ? {
            onayDurumu: "BEKLIYOR" as const,
            onaylayanKullaniciId: null,
            onayTarihi: null,
          }
        : {}),
    },
  });

  /*
   * Onay düştüğünde uyarı, faaliyeti AÇANA göre yönlendirilir: öğrenci
   * faaliyetinin onaycıları arasında ilin koordinatörü de var ve düzenleme
   * sonrası yeniden onay onlara da düşmeli, yoksa faaliyet açılışta gördükleri
   * bir öneriyi ikinci kez hiç görmezlerdi.
   */
  if (onayDusuyorMu) {
    if (kapsam.duzenleyenDanismanMi && !kapsam.duzenleyenOgrenciMi) {
      const degiskenler = {
        faaliyetAdi: faaliyet.ad,
        duzenleyenAdSoyad: `${faaliyet.duzenleyen.ad} ${faaliyet.duzenleyen.soyad}`,
        kapsam: KAPSAM_ETIKETLERI[faaliyet.kapsam],
        okulAdi: faaliyet.kurum?.ad ?? "—",
      };
      const ulasan = await ilKoordinatorlerineBildir(
        kapsam.kapsamIlKodu ?? null,
        BILDIRIM_KODLARI.ONAY_BEKLEYEN_OGRETMEN_FAALIYETI,
        degiskenler,
        etkinlikHedefi(faaliyet.id),
      );
      if (ulasan === 0) {
        await projeYoneticilerineBildir(
          BILDIRIM_KODLARI.ONAY_BEKLEYEN_OGRETMEN_FAALIYETI,
          degiskenler,
          etkinlikHedefi(faaliyet.id),
        );
      }
    } else if (kapsam.duzenleyenOgrenciMi) {
      const degiskenler = {
        faaliyetAdi: faaliyet.ad,
        duzenleyenAdSoyad: `${faaliyet.duzenleyen.ad} ${faaliyet.duzenleyen.soyad}`,
        kapsam: KAPSAM_ETIKETLERI[faaliyet.kapsam],
        okulAdi: faaliyet.kurum?.ad ?? "—",
      };
      await ilKoordinatorlerineBildir(
        kapsam.kapsamIlKodu ?? null,
        BILDIRIM_KODLARI.ONAY_BEKLEYEN_OGRENCI_FAALIYETI,
        degiskenler,
        etkinlikHedefi(faaliyet.id),
      );
      await projeYoneticilerineBildir(
        BILDIRIM_KODLARI.ONAY_BEKLEYEN_OGRENCI_FAALIYETI,
        degiskenler,
        etkinlikHedefi(faaliyet.id),
      );
    } else if (kapsam.duzenleyenDisKullaniciMi) {
      /*
       * Dış kullanıcının etkinliği düzenlendi ve onay yeniden düştü. Açılıştaki
       * gönderimin aynısı: koordinatör açılışta gördüğü öneriyi ikinci kez de
       * görmeli, yoksa değişmiş bir etkinliği eski hâliyle onaylamış olurdu.
       *
       * Sıfat düzenleyenin ROLÜNDEN okunuyor, oturumdan değil: etkinliği
       * düzenleyen kişi koordinatör de olabilir.
       */
      const degiskenler = {
        faaliyetAdi: faaliyet.ad,
        duzenleyenAdSoyad: `${faaliyet.duzenleyen.ad} ${faaliyet.duzenleyen.soyad}`,
        kapsam: KAPSAM_ETIKETLERI[faaliyet.kapsam],
        sifat: faaliyet.duzenleyen.roller.some(
          (rol) => rol.rolKodu === "MEZUN",
        )
          ? "Mezun"
          : "Paydaş temsilcisi",
      };
      await ilKoordinatorlerineBildir(
        kapsam.kapsamIlKodu ?? null,
        BILDIRIM_KODLARI.ONAY_BEKLEYEN_DIS_KULLANICI_ETKINLIGI,
        degiskenler,
        etkinlikHedefi(faaliyet.id),
      );
      await projeYoneticilerineBildir(
        BILDIRIM_KODLARI.ONAY_BEKLEYEN_DIS_KULLANICI_ETKINLIGI,
        degiskenler,
        etkinlikHedefi(faaliyet.id),
      );
    } else {
      await projeYoneticilerineBildir(
        BILDIRIM_KODLARI.ONAY_BEKLEYEN_ULUSAL_FAALIYET,
        {
          faaliyetAdi: faaliyet.ad,
          duzenleyenAdSoyad: `${kullanici.ad} ${kullanici.soyad}`,
        },
        etkinlikHedefi(faaliyet.id),
      );
    }
  }

  await erisimLogla({
    kullaniciId: kullanici.id,
    islem: "DEGISIKLIK",
    hedefTip: "FAALIYET",
    hedefId: faaliyet.id,
    detay: `Etkinlik düzenlendi: ${faaliyet.ad}${
      onayDusuyorMu ? " · kritik alan değişti, onay yeniden bekleniyor" : ""
    }`,
  });

  revalidatePath("/panel/etkinlikler");
  revalidatePath(yol);
  redirect(`${yol}?durum=${onayDusuyorMu ? "duzenlendi-onay" : "duzenlendi"}`);
}

/**
 * Faaliyeti iptal eder.
 *
 * İptal SİLME DEĞİLDİR: faaliyet listelerde "İptal edildi" etiketiyle kalır,
 * mevcut yorum ve dosyalar geçmiş kaydı olarak görünür. Kapanan şey yeni
 * başvuru ve yeni içeriktir. Aktif başvurular (BEKLIYOR/SECILDI/YEDEK)
 * IPTAL_EDILDI'ye geçer — öğrencinin kendi geri çekmesinden ayrı bir durumdur,
 * çünkü bunu sistem tetikledi.
 */
export async function faaliyetIptalEylemi(veri: FormData): Promise<void> {
  const faaliyetId = sayi(veri, "faaliyetId");
  if (faaliyetId === null) throw new BulunamadiHatasi();

  const { kullanici, faaliyet, kapsam, yol } =
    await duzenlenebilirFaaliyetGetir(faaliyetId);

  // Düzenleyebilmek iptal için yetmez: devralan koordinatör faaliyeti kapatamaz.
  if (!faaliyetIptalEdebilirMi(kullanici, kapsam)) {
    throw new YetkiHatasi(
      "Etkinliği yalnızca açan kullanıcı veya proje yöneticisi iptal edebilir.",
    );
  }

  if (faaliyet.durum === "IPTAL_EDILDI") {
    hataylaDon(yol, "Bu etkinlik zaten iptal edilmiş.");
  }

  // İptal gerekçesi İSTEĞE BAĞLIDIR; boş bırakılabilir.
  const gerekce = metin(veri, "iptalGerekcesi") || null;

  const etkilenenler = await prisma.$transaction(async (islem) => {
    await islem.faaliyet.update({
      where: { id: faaliyet.id },
      data: {
        durum: "IPTAL_EDILDI",
        iptalGerekcesi: gerekce,
        iptalEdenKullaniciId: kullanici.id,
        iptalTarihi: new Date(),
      },
    });

    const kapatilacaklar = await islem.basvuru.findMany({
      where: { faaliyetId: faaliyet.id, durum: { in: ["BEKLIYOR", "SECILDI", "YEDEK"] } },
      select: { id: true, katilimciId: true },
    });

    await islem.basvuru.updateMany({
      where: { id: { in: kapatilacaklar.map((basvuru) => basvuru.id) } },
      data: {
        durum: "IPTAL_EDILDI",
        degerlendirenKullaniciId: kullanici.id,
        degerlendirmeTarihi: new Date(),
      },
    });

    return kapatilacaklar;
  });

  for (const basvuru of etkilenenler) {
    await bildirimGonder({
      kullaniciId: basvuru.katilimciId,
      kod: BILDIRIM_KODLARI.FAALIYET_IPTAL_EDILDI,
      degiskenler: {
        faaliyetAdi: faaliyet.ad,
        gerekce: gerekce ?? "Belirtilmedi.",
      },
      // İptal edilen etkinlik listede kalıyor; başvuran kişi gerekçeyi ve
      // iptal rozetini kaydın kendisinde görebilmeli.
      hedef: etkinlikHedefi(faaliyet.id),
    });
  }

  await erisimLogla({
    kullaniciId: kullanici.id,
    islem: "DEGISIKLIK",
    hedefTip: "FAALIYET",
    hedefId: faaliyet.id,
    detay: `Etkinlik iptal edildi: ${faaliyet.ad} · ${etkilenenler.length} başvuru kapatıldı`,
  });

  revalidatePath("/panel/etkinlikler");
  revalidatePath(yol);
  redirect(`${yol}?durum=iptal-edildi&kapanan=${etkilenenler.length}`);
}

// ---------------------------------------------------------------------------
// Faaliyet onayı
// ---------------------------------------------------------------------------

/**
 * Onaya sunulmuş faaliyeti sonuçlandırır.
 *
 * İki kaynak var: il koordinatörünün açtığı ulusal faaliyet (yalnızca YEĞİTEK
 * onaylar) ve öğrencinin açtığı faaliyet (öğrencinin ilinin koordinatörü de
 * onaylayabilir). Karar hangi kapıdan gelirse gelsin tektir; ikinci bir onay
 * adımı YOKTUR, ilk verilen karar faaliyeti sonuçlandırır.
 */
export async function faaliyetOnayEylemi(veri: FormData): Promise<void> {
  const kullanici = await oturumKullanicisiZorunlu();

  const faaliyetId = sayi(veri, "faaliyetId");
  if (faaliyetId === null) throw new BulunamadiHatasi();

  const karar = metin(veri, "karar");
  if (karar !== "onayla" && karar !== "reddet") {
    throw new BulunamadiHatasi("Geçersiz karar.");
  }

  /*
   * Faaliyet merkezi kapsam filtresinden çekiliyor: onay yetkisi faaliyete
   * bağlı olduğu için (koordinatör yalnızca KENDİ İLİNDEKİ öğrencinin
   * önerisini onaylar) kaydı görmeden karar verilemez. Kapsam dışı kayıt 404.
   */
  const faaliyet = await gorunurFaaliyetGetir(kullanici, faaliyetId);
  if (!faaliyet) throw new BulunamadiHatasi();

  if (!faaliyetOnaylayabilirMi(kullanici, faaliyetKapsamiCikar(faaliyet))) {
    throw new YetkiHatasi("Bu etkinliği onaylama yetkiniz yok.");
  }

  if (faaliyet.onayDurumu !== "BEKLIYOR") {
    hataylaDon(
      `/panel/etkinlikler/${faaliyetId}`,
      "Bu etkinlik zaten sonuçlandırılmış.",
    );
  }

  await prisma.faaliyet.update({
    where: { id: faaliyetId },
    data: {
      onayDurumu: karar === "onayla" ? "ONAYLANDI" : "REDDEDILDI",
      onaylayanKullaniciId: kullanici.id,
      onayTarihi: new Date(),
    },
  });

  /*
   * Faaliyeti açan kişi sonucu öğrenmeli. Kararı kendisi verdiyse (proje
   * yöneticisi kendi faaliyetini onaylamaz ama veri elle değişebilir) kendine
   * bildirim gitmez.
   */
  if (faaliyet.duzenleyenKullaniciId !== kullanici.id) {
    await bildirimGonder({
      kullaniciId: faaliyet.duzenleyenKullaniciId,
      kod: BILDIRIM_KODLARI.FAALIYET_ONAY_SONUCU,
      degiskenler: {
        faaliyetAdi: faaliyet.ad,
        sonuc: karar === "onayla" ? "onaylandı" : "reddedildi",
        kararVerenAdSoyad: `${kullanici.ad} ${kullanici.soyad}`,
      },
      hedef: etkinlikHedefi(faaliyet.id),
    });
  }

  await erisimLogla({
    kullaniciId: kullanici.id,
    islem: "DEGISIKLIK",
    hedefTip: "FAALIYET",
    hedefId: faaliyetId,
    detay: `Etkinlik ${karar === "onayla" ? "onaylandı" : "reddedildi"}: ${faaliyet.ad}`,
  });

  revalidatePath("/panel/etkinlikler");
  revalidatePath(`/panel/etkinlikler/${faaliyetId}`);
  redirect(
    `/panel/etkinlikler/${faaliyetId}?durum=${karar === "onayla" ? "onaylandi" : "reddedildi"}`,
  );
}

// ---------------------------------------------------------------------------
// Başvuru
// ---------------------------------------------------------------------------

/**
 * Faaliyete başvuru.
 *
 * ÜÇ akış tek eylemden geçer (analiz dokümanı 4.2):
 *   1. Öğrenci kendi adına başvurur.
 *   2. Öğretmen kendi adına başvurur — katılımcı öğrenci olmak zorunda değil.
 *   3. Danışman öğretmen / il koordinatörü ÖĞRENCİSİ adına başvurur.
 *
 * Üçünü ayrı eyleme bölmek, kontenjan kilidi ve pencere kontrolü gibi asıl işi
 * üç kez yazmak olurdu; ayrılan tek şey KİMİN adına yazıldığıdır.
 */
export async function basvuruYapEylemi(veri: FormData): Promise<void> {
  const kullanici = await oturumKullanicisiZorunlu();

  const faaliyetId = sayi(veri, "faaliyetId");
  if (faaliyetId === null) throw new BulunamadiHatasi();

  // Kapsam dışındaki faaliyete başvuru denemesi 404 döner.
  const faaliyet = await gorunurFaaliyetGetir(kullanici, faaliyetId);
  if (!faaliyet) throw new BulunamadiHatasi();

  const yol = `/panel/etkinlikler/${faaliyetId}`;
  const gerekce = metin(veri, "gerekce");
  if (!gerekce) {
    hataylaDon(yol, "Başvuru gerekçesi zorunludur.");
  }

  /*
   * Vekaleten başvuru: form "katilimciId" taşıyorsa ve bu kişi başvuranın
   * kendisi değilse, öğrenci adına başvuru yapılıyordur.
   */
  const istenenKatilimciId = sayi(veri, "katilimciId");
  const vekaletenMi =
    istenenKatilimciId !== null && istenenKatilimciId !== kullanici.id;

  let katilimciId = kullanici.id;
  let adinaBasvuranKullaniciId: number | null = null;
  let katilimciAdSoyad = `${kullanici.ad} ${kullanici.soyad}`;
  let katilimciIlKodu = kullanici.ilKodu;

  if (vekaletenMi) {
    if (!baskasiAdinaBasvurabilirMi(kullanici)) {
      throw new YetkiHatasi("Başkası adına başvuru yetkiniz yok.");
    }

    /*
     * Öğrenci KAPSAM filtresinden geçirilerek aranır: kapsam dışı bir öğrenci
     * "bulunamaz". Rol kontrolü tek başına yeterli olsaydı bir danışman,
     * ilinin öbür ucundaki öğrenci adına başvuru yapabilirdi.
     */
    const ogrenci = await prisma.kullanici.findFirst({
      where: {
        AND: [{ id: istenenKatilimciId }, ogrenciKapsamFiltresi(kullanici)],
      },
      select: {
        id: true,
        ad: true,
        soyad: true,
        ilKodu: true,
        roller: { where: { bitisTarihi: null }, select: { rolKodu: true } },
      },
    });
    if (!ogrenci) {
      hataylaDon(yol, "Öğrenci bulunamadı ya da görüntüleme kapsamınızda değil.");
    }

    const vekaletKarari = vekaletenBasvuruGecerliMi({
      hedefTipi: katilimciTipi(ogrenci.roller),
      vekilKullaniciId: kullanici.id,
      hedefKullaniciId: ogrenci.id,
    });
    if (!vekaletKarari.olurMu) {
      hataylaDon(yol, vekaletKarari.neden ?? "Adına başvuru yapılamaz.");
    }

    katilimciId = ogrenci.id;
    adinaBasvuranKullaniciId = kullanici.id;
    katilimciAdSoyad = `${ogrenci.ad} ${ogrenci.soyad}`;
    katilimciIlKodu = ogrenci.ilKodu;
  } else if (!basvuruYapabilirMi(kullanici)) {
    // Kendi adına başvuru: proje yöneticisi dışında herkes yapabilir.
    throw new YetkiHatasi(
      "Etkinliği düzenleyen merkez, kendi etkinliğine katılımcı olarak başvuramaz.",
    );
  }

  /*
   * Kontenjan CANLI sayılır ve kayıt işlemiyle aynı transaction içinde
   * kontrol edilir. Ekranda gördüğü sayıya güvenen iki öğrenci aynı anda
   * başvurursa dışarıda yapılan sayım kontenjanı aştırırdı; ayrıca reddedilen
   * veya geri çekilen bir başvurunun açtığı yer anında kullanılabilir olmalı
   * (sabit sayaç tutulmuyor, bu yüzden yer "dolu" takılı kalmaz).
   */
  /*
   * Merkezin düzenlediği faaliyetin ili yoktur; düzenleyenin kişisel ili
   * faaliyetin ili sayılmaz. Transaction'dan önce hesaplanır çünkü hem başvuru
   * kaydı hem sonraki bildirimler kullanıyor.
   */
  const duzenleyenMerkezMi = faaliyet.duzenleyen.roller.some(
    (rol) => rol.rolKodu === "PROJE_YONETICISI",
  );

  const basvuruSonucu = await prisma.$transaction(async (islem) => {
    // Sayımdan önce kilit: aksi halde son yeri iki öğrenci birden alabilir.
    await faaliyetSatiriniKilitle(islem, faaliyetId);

    const guncelBasvurular = await islem.basvuru.findMany({
      where: { faaliyetId },
      select: { durum: true },
    });

    const mevcut = await islem.basvuru.findFirst({
      where: { faaliyetId, katilimciId },
      orderBy: { basvuruTarihi: "desc" },
      select: { durum: true },
    });

    const karar = basvuruYapilabilirMi({
      pencere: basvuruPenceresi(faaliyet, new Date()),
      onayDurumu: faaliyet.onayDurumu,
      faaliyetDurumu: faaliyet.durum,
      mevcutBasvuruDurumu: mevcut?.durum ?? null,
      kontenjanDoluMu: kontenjanDurumu(guncelBasvurular, faaliyet.kontenjan)
        .doluMu,
    });
    if (!karar.olurMu) {
      return {
        hata: karar.neden ?? "Bu etkinliğe başvuramazsınız.",
        basvuruId: null,
        kaynakIlOnayiBekliyorMu: false,
      };
    }

    // Geri çekilen başvuru güncellenmez, yenisi açılır: kısmi unique index geri
    // çekilmişleri dışarıda bıraktığı için ikisi bir arada durabilir ve
    // öğrencinin başvuru geçmişi korunur.
    /*
     * İl DIŞI başvuru, öğrencinin kendi ilinin koordinatörünün onayını bekler
     * (analiz Bölüm 4: "önce başvuran öğrencinin koordinatörü onaylayacak").
     * Faaliyetin ili kapsam alanlarından okunamaz; okul içi faaliyette okulun,
     * ulusal faaliyette düzenleyenin ilidir.
     */
    const faaliyetIlKodu =
      faaliyet.ilKodu ??
      faaliyet.kurum?.ilKodu ??
      (duzenleyenMerkezMi ? null : faaliyet.duzenleyen.ilKodu);

    const olusan = await islem.basvuru.create({
      data: {
        faaliyetId,
        katilimciId,
        adinaBasvuranKullaniciId,
        gerekce,
        kaynakIlOnayDurumu: baslangicOnayDurumu(katilimciIlKodu, faaliyetIlKodu),
      },
      select: { id: true, kaynakIlOnayDurumu: true },
    });
    return {
      hata: null,
      basvuruId: olusan.id,
      kaynakIlOnayiBekliyorMu: olusan.kaynakIlOnayDurumu === "BEKLIYOR",
    };
  });

  if (basvuruSonucu.hata !== null || basvuruSonucu.basvuruId === null) {
    hataylaDon(yol, basvuruSonucu.hata ?? "Başvuru kaydedilemedi.");
  }
  const basvuru = { id: basvuruSonucu.basvuruId };

  /*
   * Ulusal faaliyette danışman onayı ARANMAZ; danışmana yalnızca kopya bildirim
   * gider (references/domain-rules.md Bölüm 8) ve bu yalnızca öğrenci KENDİ İLİ
   * DIŞINDAKİ bir faaliyete başvurduğunda geçerlidir. Merkezin (YEĞİTEK)
   * düzenlediği faaliyetin ili olmadığından düzenleyen ili null sayılır.
   * Bildirim akışı kesmesin diye danışman yoksa sessizce atlanır.
   */

  if (
    danismanaKopyaGerekiyorMu({
      kapsam: faaliyet.kapsam,
      ogrenciIlKodu: katilimciIlKodu,
      duzenleyenIlKodu: duzenleyenMerkezMi ? null : faaliyet.duzenleyen.ilKodu,
    })
  ) {
    const atama = await prisma.danismanAtama.findFirst({
      where: { ogrenciId: katilimciId, bitisTarihi: null },
      select: { danismanKullaniciId: true },
    });
    // Başvuruyu danışmanın kendisi yaptıysa kendine kopya göndermek gereksiz.
    if (atama && atama.danismanKullaniciId !== kullanici.id) {
      await bildirimGonder({
        kullaniciId: atama.danismanKullaniciId,
        kod: BILDIRIM_KODLARI.DANISMANA_KOPYA_ULUSAL_BASVURU,
        degiskenler: {
          ogrenciAdSoyad: katilimciAdSoyad,
          faaliyetAdi: faaliyet.ad,
        },
        hedef: etkinlikHedefi(faaliyet.id),
      });
    }
  }

  /*
   * Adına başvurulan öğrenci HABERDAR EDİLİR. Katılım kişinin kendi
   * zamanını ve emeğini bağlayan bir karardır; öğrencinin başvurudan
   * habersiz kalması, sonucu okunmayan bir seçim yapılması demek olurdu.
   * Öğrenci uygun görmezse başvuruyu kendisi geri çekebilir.
   */
  if (vekaletenMi) {
    await bildirimGonder({
      kullaniciId: katilimciId,
      kod: BILDIRIM_KODLARI.ADINA_BASVURU_YAPILDI,
      degiskenler: {
        ogrenciAdSoyad: katilimciAdSoyad,
        faaliyetAdi: faaliyet.ad,
        basvuranAdSoyad: `${kullanici.ad} ${kullanici.soyad}`,
      },
      hedef: etkinlikHedefi(faaliyet.id),
    });
  }

  await erisimLogla({
    kullaniciId: kullanici.id,
    islem: "DEGISIKLIK",
    hedefTip: "BASVURU",
    hedefId: basvuru.id,
    detay: vekaletenMi
      ? `${katilimciAdSoyad} adına etkinliğe başvuruldu: ${faaliyet.ad}`
      : `Etkinliğe başvuruldu: ${faaliyet.ad}`,
  });

  revalidatePath(yol);
  redirect(`${yol}?durum=basvuruldu`);
}

/**
 * Başvurunun geri çekilmesi — tuttuğu kontenjan yeri boşalır.
 *
 * BEKLEYEN BAŞVURU KADAR SEÇİLEN VE YEDEK BAŞVURU DA GERİ ÇEKİLEBİLİR.
 * Kontenjanı üçü birden doldurduğu için (kurallar.ts · AKTIF_BASVURU_DURUMLARI)
 * yeri asıl açan hareket, seçilmiş birinin katılamayacağını söylemesidir;
 * yalnızca "beklemede"ye izin verilseydi vazgeçen katılımcı yeri etkinlik
 * gününe kadar tutar, yedekteki kimse çağrılamazdı.
 *
 * Yer açılması için ayrıca bir şey yapılmaz: kontenjan CANLI sayılır ve geri
 * çekilen başvuru aktif sayılmaz (kurallar.ts · kontenjanDurumu). Sayaç
 * tutulsaydı burada elle azaltmak gerekir, bir yerde unutulduğunda etkinlik
 * boş yerine rağmen "dolu" görünürdü.
 */
export async function basvuruGeriCekEylemi(veri: FormData): Promise<void> {
  const kullanici = await oturumKullanicisiZorunlu();

  const basvuruId = sayi(veri, "basvuruId");
  if (basvuruId === null) throw new BulunamadiHatasi();

  /*
   * Sahiplik kontrolü sorgunun içinde: başkasının başvurusu hiç bulunmaz.
   *
   * Başvuruyu KATILIMCI ve varsa onun adına başvuran kişi geri çekebilir.
   * İkincisi olmasaydı, danışmanın yanlışlıkla açtığı bir başvuruyu yalnızca
   * öğrenci kapatabilirdi; ilkini kaldırmak ise öğrenciyi kendi adına verilmiş
   * bir karara mahkûm ederdi.
   */
  const basvuru = await prisma.basvuru.findFirst({
    where: {
      id: basvuruId,
      OR: [
        { katilimciId: kullanici.id },
        { adinaBasvuranKullaniciId: kullanici.id },
      ],
    },
    select: {
      id: true,
      faaliyetId: true,
      durum: true,
      katilimciId: true,
      katilimci: { select: { ad: true, soyad: true } },
      faaliyet: {
        select: { ad: true, kontenjan: true, duzenleyenKullaniciId: true },
      },
    },
  });
  if (!basvuru) throw new BulunamadiHatasi();

  const yol = `/panel/etkinlikler/${basvuru.faaliyetId}`;
  if (basvuru.durum === "GERI_CEKILDI") {
    hataylaDon(yol, "Bu başvuru zaten geri çekilmiş.");
  }
  // Faaliyet iptal edildiğinde başvuru sistem tarafından zaten kapatıldı;
  // öğrencinin ayrıca geri çekmesi anlamsız ve kapanma nedenini bozar.
  if (basvuru.durum === "IPTAL_EDILDI") {
    hataylaDon(yol, "Etkinlik iptal edildiği için başvurunuz kapatıldı.");
  }
  /*
   * Reddedilen başvuru geri çekilemez. Yer zaten tutmuyor, yani açılacak bir
   * kontenjan yok; geri çekmek yalnızca değerlendirme sonucunu geri çekilmiş
   * gibi göstererek red kaydını silikleştirirdi.
   */
  if (basvuru.durum === "REDDEDILDI") {
    hataylaDon(yol, "Reddedilen başvuru geri çekilemez.");
  }

  const secilmisti = basvuru.durum === "SECILDI";

  await prisma.basvuru.update({
    where: { id: basvuru.id },
    data: { durum: "GERI_CEKILDI", geriCekmeTarihi: new Date() },
  });

  /*
   * Seçilmiş katılımcı çekildiğinde DÜZENLEYEN haberdar edilir: yer açıldığını
   * bilmezse yedek listesi olduğu gibi bekler ve etkinlik eksik katılımcıyla
   * yapılır. Bekleyen/yedek çekilmesinde bildirim GİTMEZ — yer yine açılır ama
   * düzenleyenin vereceği bir karar yoktur (bkz. sablon.ts ·
   * KONTENJANDA_YER_ACILDI).
   *
   * Sayım güncellemeden SONRA yapılıyor; önce sayılsaydı çekilen başvuru hâlâ
   * yer tutuyor görünür ve mesajda bir eksik yer yazardı.
   */
  if (secilmisti && basvuru.faaliyet.duzenleyenKullaniciId !== kullanici.id) {
    const guncelBasvurular = await prisma.basvuru.findMany({
      where: { faaliyetId: basvuru.faaliyetId },
      select: { durum: true },
    });
    const durum = kontenjanDurumu(guncelBasvurular, basvuru.faaliyet.kontenjan);

    await bildirimGonder({
      kullaniciId: basvuru.faaliyet.duzenleyenKullaniciId,
      kod: BILDIRIM_KODLARI.KONTENJANDA_YER_ACILDI,
      degiskenler: {
        faaliyetAdi: basvuru.faaliyet.ad,
        katilimciAdSoyad: `${basvuru.katilimci.ad} ${basvuru.katilimci.soyad}`,
        yedekSayisi: String(durum.yedek),
        kalanYer: String(durum.kalanYer),
      },
      hedef: etkinlikHedefi(basvuru.faaliyetId),
    });
  }

  // Adına başvurulan kişi, başvurunun kapandığından da haberdar olmalı.
  if (basvuru.katilimciId !== kullanici.id) {
    await bildirimGonder({
      kullaniciId: basvuru.katilimciId,
      kod: BILDIRIM_KODLARI.ADINA_BASVURU_GERI_CEKILDI,
      degiskenler: {
        ogrenciAdSoyad: `${basvuru.katilimci.ad} ${basvuru.katilimci.soyad}`,
        basvuranAdSoyad: `${kullanici.ad} ${kullanici.soyad}`,
      },
      hedef: etkinlikHedefi(basvuru.faaliyetId),
    });
  }

  await erisimLogla({
    kullaniciId: kullanici.id,
    islem: "DEGISIKLIK",
    hedefTip: "BASVURU",
    hedefId: basvuru.id,
    detay:
      basvuru.katilimciId === kullanici.id
        ? "Başvuru geri çekildi"
        : `${basvuru.katilimci.ad} ${basvuru.katilimci.soyad} adına yapılan başvuru geri çekildi`,
  });

  revalidatePath(yol);
  redirect(`${yol}?durum=geri-cekildi`);
}

export async function basvuruDegerlendirEylemi(veri: FormData): Promise<void> {
  const kullanici = await oturumKullanicisiZorunlu();

  const basvuruId = sayi(veri, "basvuruId");
  const yeniDurum = metin(veri, "yeniDurum") as BasvuruDurumu;
  if (basvuruId === null) throw new BulunamadiHatasi();
  if (!["SECILDI", "YEDEK", "REDDEDILDI"].includes(yeniDurum)) {
    throw new BulunamadiHatasi("Geçersiz değerlendirme sonucu.");
  }

  const basvuru = await prisma.basvuru.findUnique({
    where: { id: basvuruId },
    select: {
      id: true,
      durum: true,
      kaynakIlOnayDurumu: true,
      katilimciId: true,
      katilimci: { select: { ad: true, soyad: true } },
      adinaBasvuranKullaniciId: true,
      faaliyet: {
        select: {
          id: true,
          ad: true,
          kapsam: true,
          kurumKodu: true,
          ilKodu: true,
          duzenleyenKullaniciId: true,
          onayDurumu: true,
          kontenjan: true,
          durum: true,
        },
      },
    },
  });
  if (!basvuru) throw new BulunamadiHatasi();

  if (basvuru.faaliyet.durum === "IPTAL_EDILDI") {
    hataylaDon(
      `/panel/etkinlikler/${basvuru.faaliyet.id}`,
      "İptal edilmiş etkinliğin başvuruları değerlendirilemez.",
    );
  }

  /*
   * SIRA KORUNUR: öğrencinin kendi ilinin koordinatörü karar vermeden bu
   * başvuru değerlendirilemez. Aksi halde öğrenci, kendi ili izin vermeden
   * başka bir ilin etkinliğine seçilmiş olurdu.
   */
  if (!degerlendirmeyeHazirMi(basvuru.kaynakIlOnayDurumu)) {
    hataylaDon(
      `/panel/etkinlikler/${basvuru.faaliyet.id}`,
      basvuru.kaynakIlOnayDurumu === "BEKLIYOR"
        ? "Bu başvuru, öğrencinin kendi ilinin koordinatörünün onayını bekliyor. Onay verilene kadar değerlendirilemez."
        : "Öğrencinin kendi ilinin koordinatörü bu başvuruyu reddetti; değerlendirilemez.",
    );
  }

  // Rol yetmez: yalnızca faaliyeti AÇAN kullanıcı değerlendirir.
  if (
    !basvuruDegerlendirebilirMi(
      kullanici,
      faaliyetKapsamiCikar(basvuru.faaliyet),
    )
  ) {
    throw new YetkiHatasi("Bu başvuruyu değerlendirme yetkiniz yok.");
  }

  const yol = `/panel/etkinlikler/${basvuru.faaliyet.id}`;

  /*
   * Kontenjan kontrolü işlem içinde YENİDEN sayılır. Ekranda gördüğü sayıya
   * göre karar veren iki değerlendirici aynı anda "seçildi" derse, ekrandan
   * gelen sayı kontenjanı aşmaya izin verirdi.
   */
  const hata = await prisma.$transaction(async (islem) => {
    await faaliyetSatiriniKilitle(islem, basvuru.faaliyet.id);

    const guncelBasvurular = await islem.basvuru.findMany({
      where: { faaliyetId: basvuru.faaliyet.id },
      select: { durum: true },
    });

    const karar = degerlendirmeYapilabilirMi(
      yeniDurum,
      kontenjanDurumu(guncelBasvurular, basvuru.faaliyet.kontenjan),
    );
    if (!karar.olurMu) return karar.neden ?? "Değerlendirme yapılamadı.";

    await islem.basvuru.update({
      where: { id: basvuru.id },
      data: {
        durum: yeniDurum,
        degerlendirenKullaniciId: kullanici.id,
        degerlendirmeTarihi: new Date(),
      },
    });
    return null;
  });

  if (hata) hataylaDon(yol, hata);

  const katilimciAdi = `${basvuru.katilimci.ad} ${basvuru.katilimci.soyad}`;

  await bildirimGonder({
    kullaniciId: basvuru.katilimciId,
    kod: BILDIRIM_KODLARI.BASVURU_SONUCU,
    degiskenler: {
      ogrenciAdSoyad: katilimciAdi,
      faaliyetAdi: basvuru.faaliyet.ad,
      sonuc: BASVURU_DURUMU_ETIKETLERI[yeniDurum],
    },
    hedef: etkinlikHedefi(basvuru.faaliyet.id),
  });

  /*
   * Başvuruyu öğrenci adına yapan öğretmen de sonucu görür: takip ettiği
   * başvurunun akıbetini öğrenmek için öğrenciye sormak zorunda kalmamalı.
   * Değerlendiren kişi ile aynıysa kendine bildirim gitmez.
   */
  if (
    basvuru.adinaBasvuranKullaniciId !== null &&
    basvuru.adinaBasvuranKullaniciId !== kullanici.id
  ) {
    await bildirimGonder({
      kullaniciId: basvuru.adinaBasvuranKullaniciId,
      kod: BILDIRIM_KODLARI.ADINA_BASVURU_SONUCU,
      degiskenler: {
        ogrenciAdSoyad: katilimciAdi,
        faaliyetAdi: basvuru.faaliyet.ad,
        sonuc: BASVURU_DURUMU_ETIKETLERI[yeniDurum],
      },
      hedef: etkinlikHedefi(basvuru.faaliyet.id),
    });
  }

  await erisimLogla({
    kullaniciId: kullanici.id,
    islem: "DEGISIKLIK",
    hedefTip: "BASVURU",
    hedefId: basvuru.id,
    detay: `Başvuru değerlendirildi: ${BASVURU_DURUMU_ETIKETLERI[yeniDurum]}`,
  });

  revalidatePath(yol);
  redirect(`${yol}?durum=degerlendirildi`);
}

// ---------------------------------------------------------------------------
// Yoklama
// ---------------------------------------------------------------------------

/**
 * Etkinlik sonrası yoklamanın işaretlenmesi (12 Ağustos 2026).
 *
 * İSTEK: "öğrenci etkinliğe gelmedi ama GençTek Yolculuğum'da katıldı
 * görünüyor, bunun kontrolünü nasıl sağlarız".
 *
 * FORMUN TAMAMI TEK SEFERDE yazılır, kişi başına ayrı düğme yoktur: yoklama
 * listenin tamamı üzerinde verilen tek bir karardır ve satır satır kaydedilseydi
 * yarım kalmış bir yoklama ile hiç alınmamış yoklama birbirinden ayırt
 * edilemezdi. Formda karşılığı olmayan başvuru DEĞİŞMEZ — ekranda görünmeyen
 * bir satırın işareti silinmemeli.
 *
 * YETKİ RAPORLA AYNI KAPI (`faaliyetRaporuYazabilirMi`): yoklama da rapor da
 * "etkinliği yürüten kişinin etkinlik hakkındaki beyanı"dır ve ikisini farklı
 * kişilere açmanın bir gerekçesi yok. Etkinliği açmamış il koordinatörü de
 * işaretleyebilir; yürütücü görevden ayrıldığında yoklama alınamaz kalmamalı.
 */
export async function yoklamaKaydetEylemi(veri: FormData): Promise<void> {
  const kullanici = await oturumKullanicisiZorunlu();

  const faaliyetId = sayi(veri, "faaliyetId");
  if (faaliyetId === null) throw new BulunamadiHatasi();

  const yol = `/panel/etkinlikler/${faaliyetId}`;

  const faaliyet = await gorunurFaaliyetGetir(kullanici, faaliyetId);
  if (!faaliyet) throw new BulunamadiHatasi();

  if (!faaliyetRaporuYazabilirMi(kullanici, faaliyetKapsamiCikar(faaliyet))) {
    throw new YetkiHatasi("Bu etkinliğin yoklamasını alma yetkiniz yok.");
  }

  const kapi = yoklamaAlinabilirMi({
    bittiMi: (faaliyet.bitisTarihi ?? faaliyet.tarih) <= new Date(),
    iptalMi: faaliyet.durum === "IPTAL_EDILDI",
  });
  if (!kapi.olurMu) hataylaDon(yol, kapi.neden ?? "Yoklama alınamaz.");

  /*
   * Yalnızca SEÇİLMİŞ başvurular yoklamaya girer: yedekteki ya da reddedilmiş
   * kişi zaten katılımcı değil ve "gelmedi" işareti onun için bir şey
   * söylemezdi.
   */
  const basvurular = await prisma.basvuru.findMany({
    where: { faaliyetId, durum: "SECILDI" },
    select: { id: true, katildiMi: true },
  });

  const simdi = new Date();
  const sonuclar = basvurular.map((basvuru) => ({
    id: basvuru.id,
    onceki: basvuru.katildiMi,
    yeni: yoklamaDegeriCoz(metin(veri, `yoklama-${basvuru.id}`) || null),
  }));
  const degisenler = sonuclar.filter((satir) => satir.yeni !== satir.onceki);

  if (degisenler.length > 0) {
    await prisma.$transaction(
      degisenler.map((satir) =>
        prisma.basvuru.update({
          where: { id: satir.id },
          data: {
            katildiMi: satir.yeni,
            // İşaret kaldırıldığında beyan sahibi de silinir: kimsenin
            // beyanı olmayan bir yoklamada imza durmamalı.
            yoklamaAlanKullaniciId: satir.yeni === null ? null : kullanici.id,
            yoklamaTarihi: satir.yeni === null ? null : simdi,
          },
        }),
      ),
    );
  }

  const gelen = sonuclar.filter((satir) => satir.yeni === true).length;

  await erisimLogla({
    kullaniciId: kullanici.id,
    islem: "DEGISIKLIK",
    hedefTip: "FAALIYET",
    hedefId: faaliyetId,
    detay: `Yoklama alındı: ${gelen}/${basvurular.length} katılımcı geldi`,
  });

  revalidatePath(yol);
  redirect(`${yol}?durum=yoklama-kaydedildi`);
}
