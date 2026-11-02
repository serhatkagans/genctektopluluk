"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { oturumKullanicisiZorunlu } from "@/lib/auth/oturum";
import { prisma } from "@/lib/db";
import {
  BILDIRIM_KODLARI,
  bildirimGonder,
  projeYoneticilerineBildir,
} from "@/lib/bildirim/gonder";
import {
  kazanimEkiKaydet,
  kazanimEkSinirlariniGetir,
} from "@/lib/kazanim/ek";
import { kazanimKabulEdilirMi } from "@/lib/kazanim/kurallar";
import {
  urunMarketKarariGecerliMi,
  urunPaylasimOnayAlanlari,
  urunVitrindeMi,
} from "@/lib/market/kurallar";
import { urunMarketOnayiVerebilirMi } from "@/lib/yetki/izinler";
import { erisimLogla } from "@/lib/yetki/log";
import { BulunamadiHatasi, YetkiHatasi } from "@/lib/yetki/tipler";

/**
 * Market eylemleri (I).
 *
 * ŞİMDİLİK TEK EYLEM VAR: paylaşımı açıp kapatmak.
 *
 * NEDEN BU EYLEM GEREKLİ. "Bu ürünü markette paylaş" kutusu işaretlenmeden
 * eklenmiş bir ürünü markete çıkarmanın yolu, ürünü profilden düzenlemekten
 * geçiyor; oysa "Kendi ürünlerim" sekmesi o ürünü zaten gösteriyor ve
 * kullanıcı onu MARKETTE görüyor. Anahtar, gördüğü yerde bir işi
 * yapabilmesi için burada duruyor.
 */

const KOK = "/panel/urunler";

export async function paylasimiDegistirEylemi(veri: FormData): Promise<void> {
  const kullanici = await oturumKullanicisiZorunlu();

  const id = Number.parseInt(String(veri.get("urunId") ?? ""), 10);
  if (!Number.isFinite(id)) throw new BulunamadiHatasi();

  /*
   * `kullaniciId` koşulu şart: olmadan sorgulanırsa başkasının ürününün
   * paylaşımı kapatılabilir ya da AÇILABİLİRDİ — ikincisi daha ağır, kişinin
   * paylaşmamayı seçtiği kaydı vitrine çıkarmak olurdu.
   *
   * Bulunamayan kayıt 404 verir (403 değil): 403, "böyle bir ürün var ama
   * senin değil" bilgisini sızdırırdı.
   */
  const urun = await prisma.kullaniciKazanim.findFirst({
    where: { id, kullaniciId: kullanici.id, tip: "URUN" },
    select: {
      id: true,
      baslik: true,
      markettePaylasilsin: true,
      marketOnayDurumu: true,
    },
  });
  if (!urun) throw new BulunamadiHatasi();

  const yeniDurum = !urun.markettePaylasilsin;

  /*
   * PAYLAŞIM AÇILINCA ONAY İSTENİR (26 Ağustos 2026 · istek: "markette
   * paylaşılmadı yerine onay bekliyor yazsın ve proje yöneticisine gitsin
   * onaya, öğretmen için de").
   *
   * DAHA ÖNCE ONAYLANMIŞSA yeniden sorulmaz: kişi ürününü vitrinden çekip
   * geri koyduğunda aynı ürün için ikinci kez sıraya girmesi, kararı veren
   * merkezi de bekleyeni de boşuna meşgul ederdi. Onaylanan şey hâlâ aynı
   * şey — ürünün İÇERİĞİ değiştiğinde onay zaten orada tazeleniyor (bkz.
   * profil/kazanim-eylemleri.ts · kazanimGuncelleEylemi · `onayTazelensin`).
   *
   * PAYLAŞIM KAPATILIRKEN KARARA DOKUNULMAZ: tercih ile karar ayrı alanlar.
   */
  /*
   * SAHİBİ KARARI ZATEN VEREBİLİYORSA ÜRÜN DOĞRUDAN YAYIMLANIR (28 Ağustos
   * 2026). Gerekçe kural katmanında: lib/market/kurallar.ts.
   */
  const onay = urunPaylasimOnayAlanlari({
    sahipKullaniciId: kullanici.id,
    kendiKararVerebilirMi: urunMarketOnayiVerebilirMi(kullanici),
    simdi: new Date(),
  });

  const onayYazilsinMi = yeniDurum && urun.marketOnayDurumu !== "ONAYLANDI";

  await prisma.kullaniciKazanim.update({
    where: { id: urun.id },
    data: {
      markettePaylasilsin: yeniDurum,
      ...(onayYazilsinMi ? onay.alanlar : {}),
    },
  });

  /*
   * Kuyruk sessiz değil: kararı verecek merkez uyarılıyor. Bildirim KAYITTAN
   * SONRA — gönderimde çıkacak bir sorun paylaşımın kendisini düşürmemeli.
   */
  if (onayYazilsinMi && onay.bildirimGerekliMi) {
    await projeYoneticilerineBildir(BILDIRIM_KODLARI.ONAY_BEKLEYEN_URUN, {
      sahipAdSoyad: `${kullanici.ad} ${kullanici.soyad}`,
      urunAdi: urun.baslik,
    });
  }

  /*
   * SAYAÇLAR SIFIRLANMIYOR. Paylaşım kapatılıp yeniden açıldığında eski
   * görüntülenme ve ziyaret sayıları duruyor: sayaç ürünün geçmişidir, vitrinde
   * kaldığı sürenin değil. Sıfırlansaydı, paylaşımı bir an kapatmak ürünün
   * bütün geçmişini silerdi.
   */

  await erisimLogla({
    kullaniciId: kullanici.id,
    islem: "DEGISIKLIK",
    hedefTip: "PROFIL",
    hedefId: kullanici.id,
    detay: `Markette paylaşım ${yeniDurum ? "açıldı" : "kapatıldı"}: ${urun.baslik}`,
  });

  /*
   * Üç yol da tazeleniyor: ürün detayı, market listesi ve profil. Ürün
   * profildeki "Bilişim Yolculuğum" listesinde de paylaşım rozetiyle
   * görünüyor; yalnızca market tazelenseydi profildeki rozet eski kalırdı.
   *
   * Yönlendirme YOK — aynı adrese yönlendirmek sayfayı tazelemiyor
   * (bkz. panel/algoritmam/eylemler.ts).
   */
  revalidatePath(`${KOK}/${urun.id}`);
  revalidatePath(KOK);
  revalidatePath("/panel");
}

/**
 * Ürünün markette yayımlanma kararı (26 Ağustos 2026).
 *
 * KARARI YALNIZCA MERKEZ VERİR (bkz. urunMarketOnayiVerebilirMi): market
 * ülke geneline açık tek bir vitrin ve bir ilin koordinatörünün ülke çapında
 * görünecek bir ürünü yayımlaması, kapsamının dışında bir karar olurdu.
 *
 * RETTE GEREKÇE ZORUNLU: gerekçesiz ret, sahibine neyi düzelteceğini
 * söylemez (bkz. urunMarketKarariGecerliMi).
 */
export async function urunMarketKarariEylemi(veri: FormData): Promise<void> {
  const kullanici = await oturumKullanicisiZorunlu();
  if (!urunMarketOnayiVerebilirMi(kullanici)) {
    throw new YetkiHatasi("Ürün market kararını veremezsiniz.");
  }

  const urunId = Number.parseInt(String(veri.get("urunId") ?? ""), 10);
  if (!Number.isFinite(urunId)) throw new BulunamadiHatasi();

  const urun = await prisma.kullaniciKazanim.findFirst({
    where: { id: urunId, tip: "URUN" },
    select: {
      id: true,
      baslik: true,
      kullaniciId: true,
      marketOnayDurumu: true,
    },
  });
  if (!urun) throw new BulunamadiHatasi();

  const karar = urunMarketKarariGecerliMi({
    mevcutDurum: urun.marketOnayDurumu,
    onaylandiMi: veri.get("karar") === "onayla",
    gerekce: String(veri.get("gerekce") ?? ""),
  });
  if (!karar.olurMu) {
    redirect(`${KOK}?hata=${encodeURIComponent(karar.neden)}`);
  }

  await prisma.kullaniciKazanim.update({
    where: { id: urun.id },
    data: {
      marketOnayDurumu: karar.durum,
      marketKararVerenKullaniciId: kullanici.id,
      marketKararTarihi: new Date(),
      marketRetGerekcesi: karar.durum === "REDDEDILDI" ? karar.gerekce : null,
    },
  });

  await bildirimGonder({
    kullaniciId: urun.kullaniciId,
    kod: BILDIRIM_KODLARI.URUN_MARKET_KARARI,
    degiskenler: {
      urunAdi: urun.baslik,
      sonuc: karar.durum === "ONAYLANDI" ? "onaylandı" : "reddedildi",
      gerekce: karar.gerekce ?? "—",
    },
  });

  await erisimLogla({
    kullaniciId: kullanici.id,
    islem: "DEGISIKLIK",
    hedefTip: "PROFIL",
    hedefId: urun.kullaniciId,
    detay: `Ürün market kararı (${
      karar.durum === "ONAYLANDI" ? "onaylandı" : "reddedildi"
    }): ${urun.baslik}`,
  });

  revalidatePath(KOK);
  revalidatePath(`${KOK}/${urun.id}`);
  /*
   * DÖNÜŞ VİTRİNE (27 Ağustos 2026): kuyruk oraya taşındı. Kararı verdikten
   * sonra genel onay ekranına düşmek, kişiyi kuyruğun artık olmadığı bir
   * sayfaya göndermek olurdu.
   */
  redirect(`${KOK}?durum=urun-karari`);
}

/**
 * Proje yöneticisinin vitrindeki bir ürünü DÜZENLEMESİ (2 Kasım 2026 · istek:
 * "proje yöneticisi için vitrinde onaylanmış yayınlanmış ürünleri kaldırma
 * olsun, düzenleme yetkisi de olsun").
 *
 * Sahibinin düzenlemesiyle (profil/kazanim-eylemleri.ts · kazanimGuncelleEylemi)
 * aynı kural katmanından geçer; ayrıldığı noktalar:
 *   · Kayıt sahibine SABİTLENMEZ — yetki rolden gelir.
 *   · Yalnızca PAYLAŞILMIŞ ürün düzenlenir: sahibinin kendine sakladığı kayda
 *     merkezin dokunması için bir sebep yok.
 *   · Paylaşım tercihi ve onay durumu DEĞİŞMEZ: düzeltmeyi kararı veren kişi
 *     yapıyor, ürünü yeniden kuyruğa sokmak anlamsız olurdu.
 */
export async function urunYoneticiGuncelleEylemi(
  veri: FormData,
): Promise<void> {
  const kullanici = await oturumKullanicisiZorunlu();
  if (!urunMarketOnayiVerebilirMi(kullanici)) {
    throw new YetkiHatasi("Vitrindeki ürünleri düzenleyemezsiniz.");
  }

  const id = Number.parseInt(String(veri.get("kazanimId") ?? ""), 10);
  if (!Number.isFinite(id)) throw new BulunamadiHatasi();

  const mevcut = await prisma.kullaniciKazanim.findFirst({
    where: { id, tip: "URUN", markettePaylasilsin: true },
    select: { id: true, tip: true, tarih: true, kullaniciId: true },
  });
  if (!mevcut) throw new BulunamadiHatasi();

  const duzenleYolu = `${KOK}/${mevcut.id}/duzenle`;

  const karar = kazanimKabulEdilirMi(
    {
      tip: mevcut.tip,
      baslik: String(veri.get("baslik") ?? ""),
      aciklama: String(veri.get("aciklama") ?? ""),
      tarih: mevcut.tarih,
      baglantiUrl: String(veri.get("baglantiUrl") ?? ""),
      derece: "",
      duzenleyen: "",
      katilimBicimi: "",
      hedefKitle: "",
      gelistirenEkip: String(veri.get("gelistirenEkip") ?? ""),
      markettePaylasilsin: true,
      baglantilar: veri.getAll("baglantiAdres").map((adres, sira) => ({
        adres: String(adres),
        etiket: String(veri.getAll("baglantiEtiket")[sira] ?? ""),
      })),
    },
    { mevcutKayit: true },
  );
  if (!karar.olurMu) {
    redirect(`${duzenleYolu}?hata=${encodeURIComponent(karar.neden)}`);
  }

  await prisma.$transaction([
    prisma.kazanimBaglanti.deleteMany({ where: { kazanimId: mevcut.id } }),
    prisma.kullaniciKazanim.update({
      where: { id: mevcut.id },
      data: {
        baslik: karar.kayit.baslik,
        aciklama: karar.kayit.aciklama,
        gelistirenEkip: karar.kayit.gelistirenEkip,
        baglantiUrl: karar.kayit.baglantiUrl,
        baglantilar: { create: karar.baglantilar },
      },
    }),
  ]);

  /* Yeni görsel seçildiyse kapak onunla değişir; boşsa mevcut kapak kalır. */
  let kapakUyarisi: string | undefined;
  const gorsel = veri.get("urunGorseli");
  if (gorsel instanceof File && gorsel.size > 0) {
    const sonuc = await kazanimEkiKaydet({
      kazanimId: mevcut.id,
      dosya: gorsel,
      sinirlar: await kazanimEkSinirlariniGetir(),
      kapakMi: true,
    });
    if (!sonuc.olurMu) kapakUyarisi = `${gorsel.name}: ${sonuc.neden}`;
  }

  await erisimLogla({
    kullaniciId: kullanici.id,
    islem: "DEGISIKLIK",
    hedefTip: "PROFIL",
    hedefId: mevcut.kullaniciId,
    detay: `Vitrindeki ürün proje yöneticisince düzenlendi: ${karar.kayit.baslik}`,
  });

  revalidatePath(KOK);
  revalidatePath(`${KOK}/${mevcut.id}`);
  revalidatePath("/panel");
  if (kapakUyarisi) {
    redirect(
      `${duzenleYolu}?hata=${encodeURIComponent(
        `Ürün güncellendi ancak görsel yüklenemedi — ${kapakUyarisi}`,
      )}`,
    );
  }
  redirect(`${KOK}/${mevcut.id}?durum=urun-guncellendi`);
}

/**
 * Proje yöneticisinin yayımdaki bir ürünü VİTRİNDEN KALDIRMASI (2 Kasım 2026).
 *
 * Ürün SİLİNMEZ: sahibinin beyanıdır ve profilinde kalır. Kaldırma bir
 * merkez kararıdır ve ret ile aynı alana yazılır — sahibi ürününde "markette
 * yayımlanmadı" görür, düzenleyip yeniden gönderebilir. Gerekçe isteğe bağlı;
 * boşsa sahibine standart bir cümle gider.
 */
export async function urunVitrindenKaldirEylemi(
  veri: FormData,
): Promise<void> {
  const kullanici = await oturumKullanicisiZorunlu();
  if (!urunMarketOnayiVerebilirMi(kullanici)) {
    throw new YetkiHatasi("Ürünü vitrinden kaldıramazsınız.");
  }

  const urunId = Number.parseInt(String(veri.get("urunId") ?? ""), 10);
  if (!Number.isFinite(urunId)) throw new BulunamadiHatasi();

  const urun = await prisma.kullaniciKazanim.findFirst({
    where: { id: urunId, tip: "URUN" },
    select: {
      id: true,
      baslik: true,
      kullaniciId: true,
      markettePaylasilsin: true,
      marketOnayDurumu: true,
    },
  });
  if (!urun) throw new BulunamadiHatasi();
  if (!urunVitrindeMi(urun)) {
    redirect(
      `${KOK}/${urun.id}?hata=${encodeURIComponent("Bu ürün zaten vitrinde değil.")}`,
    );
  }

  const gerekce =
    String(veri.get("gerekce") ?? "").trim().slice(0, 500) ||
    "Proje yöneticisi ürünü vitrinden kaldırdı.";

  await prisma.kullaniciKazanim.update({
    where: { id: urun.id },
    data: {
      marketOnayDurumu: "REDDEDILDI",
      marketKararVerenKullaniciId: kullanici.id,
      marketKararTarihi: new Date(),
      marketRetGerekcesi: gerekce,
    },
  });

  await bildirimGonder({
    kullaniciId: urun.kullaniciId,
    kod: BILDIRIM_KODLARI.URUN_MARKET_KARARI,
    degiskenler: {
      urunAdi: urun.baslik,
      sonuc: "vitrinden kaldırıldı",
      gerekce,
    },
  });

  await erisimLogla({
    kullaniciId: kullanici.id,
    islem: "DEGISIKLIK",
    hedefTip: "PROFIL",
    hedefId: urun.kullaniciId,
    detay: `Ürün vitrinden kaldırıldı: ${urun.baslik}`,
  });

  revalidatePath(KOK);
  revalidatePath(`${KOK}/${urun.id}`);
  revalidatePath("/panel");
  redirect(`${KOK}?durum=urun-kaldirildi`);
}
