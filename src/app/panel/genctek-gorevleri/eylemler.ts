"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { oturumKullanicisiZorunlu } from "@/lib/auth/oturum";
import {
  BILDIRIM_KODLARI,
  bildirimGonder,
  projeYoneticilerineBildir,
} from "@/lib/bildirim/gonder";
import { prisma } from "@/lib/db";
import {
  gorevBasvurusuKabulEdilirMi,
  gorevKarariGecerliMi,
  gorevTanimiGecerliMi,
} from "@/lib/gorev/kurallar";
import { gencTekGoreviYonetebilirMi } from "@/lib/yetki/izinler";
import { erisimLogla } from "@/lib/yetki/log";
import { BulunamadiHatasi, YetkiHatasi } from "@/lib/yetki/tipler";

/**
 * GENÇTEK GÖREVLERİ — başvuru, karar ve ilan yönetimi (21 Ağustos 2026).
 *
 * İKİ EKRAN, İKİ DÖNÜŞ ADRESİ: başvuru panodaki görev listesinden yapılıyor ve
 * oraya dönüyor; karar ile ilan açma Yönetim Paneli'ndeki ekranda. Kişi işi
 * hangi ekranda yaptıysa sonucunu da orada okumalı.
 *
 * BAŞVURU KENDİ KAYDI ÜZERİNDE çalışır: `kullaniciId` hiçbir yerde form
 * girdisinden okunmaz. Karar ise başkasının kaydına dokunuyor ve bu yüzden
 * yetki kapısından geçiyor (gencTekGoreviYonetebilirMi).
 */

const PANO = "/panel/talepler/genctek-gorevleri";
const YONETIM = "/panel/genctek-gorevleri";
const ONAYLAR = "/panel/talepler/onaylar";

function panoyaDon(sorgu: string): never {
  revalidatePath(PANO);
  revalidatePath(YONETIM);
  redirect(`${PANO}?${sorgu}`);
}

/** Karar Onay kuyruğu ekranından verildiğinde oraya dönülür. */
function onaylarDonusu(sorgu: string): never {
  revalidatePath(ONAYLAR);
  revalidatePath(YONETIM);
  revalidatePath(PANO);
  redirect(`${ONAYLAR}?${sorgu}`);
}

function yonetimeDon(sorgu: string): never {
  revalidatePath(YONETIM);
  revalidatePath(PANO);
  redirect(`${YONETIM}?${sorgu}`);
}

/** Panodaki "Başvur" formu. */
export async function gorevBasvurEylemi(veri: FormData): Promise<void> {
  const kullanici = await oturumKullanicisiZorunlu();

  const gorevId = Number.parseInt(String(veri.get("gorevId") ?? ""), 10);
  if (!Number.isFinite(gorevId)) throw new BulunamadiHatasi();

  /*
   * Görevin AÇIK olduğu ve kontenjanın dolmadığı veritabanından okunuyor:
   * ekranda görünen düğmeye değil kaydın kendisine bakılıyor. Kapatılmış bir
   * görevin kimliğini elle yazan biri için ilan fiilen açık kalmamalı.
   */
  const gorev = await prisma.gencTekGorevi.findUnique({
    where: { id: gorevId },
    select: {
      id: true,
      ad: true,
      aktif: true,
      kontenjan: true,
      _count: { select: { basvurular: { where: { onayDurumu: "ONAYLANDI" } } } },
    },
  });
  if (!gorev) throw new BulunamadiHatasi();

  const mevcut = await prisma.gencTekGorevBasvurusu.findUnique({
    where: { gorevId_kullaniciId: { gorevId: gorev.id, kullaniciId: kullanici.id } },
    select: { id: true, onayDurumu: true },
  });

  const karar = gorevBasvurusuKabulEdilirMi({
    gorevAktifMi: gorev.aktif,
    kontenjan: gorev.kontenjan,
    onayliBasvuruSayisi: gorev._count.basvurular,
    mesaj: String(veri.get("mesaj") ?? ""),
    bekleyenBasvurusuVarMi: mevcut?.onayDurumu === "BEKLIYOR",
    zatenGorevliMi: mevcut?.onayDurumu === "ONAYLANDI",
  });
  if (!karar.olurMu) {
    panoyaDon(`hata=${encodeURIComponent(karar.neden)}`);
  }

  /*
   * REDDEDİLMİŞ BAŞVURU YENİDEN AÇILIR, yeni satır açılmaz: kişi başına görev
   * başına tek satır var (bkz. şema · @@unique). Ret gerekçesi de siliniyor —
   * yeni başvuru eski kararın gerekçesiyle birlikte durmamalı.
   */
  await prisma.gencTekGorevBasvurusu.upsert({
    where: { gorevId_kullaniciId: { gorevId: gorev.id, kullaniciId: kullanici.id } },
    create: {
      gorevId: gorev.id,
      kullaniciId: kullanici.id,
      mesaj: karar.mesaj,
    },
    update: {
      mesaj: karar.mesaj,
      onayDurumu: "BEKLIYOR",
      kararVerenKullaniciId: null,
      kararTarihi: null,
      retGerekcesi: null,
    },
  });

  /*
   * Bildirim KAYITTAN SONRA: gönderimde oluşacak bir sorun başvurunun kendisini
   * düşürmemeli. Kararı yalnızca merkez veriyor, uyarı da yalnızca oraya
   * gidiyor.
   */
  await projeYoneticilerineBildir(BILDIRIM_KODLARI.ONAY_BEKLEYEN_GENCTEK_GOREVI, {
    basvuranAdSoyad: `${kullanici.ad} ${kullanici.soyad}`,
    gorevAdi: gorev.ad,
  });

  await erisimLogla({
    kullaniciId: kullanici.id,
    islem: "DEGISIKLIK",
    hedefTip: "PROFIL",
    hedefId: kullanici.id,
    detay: `GençTek görev başvurusu: ${gorev.ad}`,
  });

  panoyaDon("durum=basvuruldu");
}

/**
 * Onay / ret formu — İKİ EKRANDAN çağrılıyor (26 Ağustos 2026 · istek:
 * "/panel/talepler/onaylar buraya da gitmesi gerekiyordu").
 *
 * Kuyruk hem Yönetim Paneli'ndeki GençTek Görevleri ekranında hem de
 * merkezin onay işlerini topladığı Onay kuyruğu ekranında basılıyor.
 * `donus` alanı yalnızca SONUCUN OKUNACAĞI YERİ seçer — kişi işi hangi
 * ekranda yaptıysa oraya dönmeli. Yetkiyi değiştirmez: kapı aşağıda,
 * form girdisinden bağımsız soruluyor.
 */
export async function gorevKararEylemi(veri: FormData): Promise<void> {
  const kullanici = await oturumKullanicisiZorunlu();
  if (!gencTekGoreviYonetebilirMi(kullanici)) {
    throw new YetkiHatasi("Görev başvurularını karara bağlayamazsınız.");
  }

  /*
   * Dönüş adresi FORMDAN geliyor ama serbest metin değil: tanınmayan her
   * değer yönetim ekranına düşüyor. Adres olarak alınsaydı, form girdisi
   * kullanıcıyı istediği yere yönlendiren bir kapı olurdu.
   */
  const onaylaraDon = veri.get("donus") === "onaylar";
  /*
   * TÜR AÇIKÇA YAZILIYOR: TypeScript, `never` dönen bir çağrının akışı
   * kestiğini yalnızca değişkenin türü açıkça bildirilmişse anlıyor. Yazılmadan
   * bırakılırsa `karar` daralmıyor ve aşağıdaki alanlar erişilemez görünüyor.
   */
  const don: (sorgu: string) => never = onaylaraDon
    ? onaylarDonusu
    : yonetimeDon;

  const basvuruId = Number.parseInt(String(veri.get("basvuruId") ?? ""), 10);
  if (!Number.isFinite(basvuruId)) throw new BulunamadiHatasi();

  const basvuru = await prisma.gencTekGorevBasvurusu.findUnique({
    where: { id: basvuruId },
    select: {
      id: true,
      onayDurumu: true,
      kullaniciId: true,
      gorev: { select: { ad: true } },
    },
  });
  if (!basvuru) throw new BulunamadiHatasi();

  const karar = gorevKarariGecerliMi({
    mevcutDurum: basvuru.onayDurumu,
    onaylandiMi: veri.get("karar") === "onayla",
    gerekce: String(veri.get("gerekce") ?? ""),
    kendiBasvurusuMu: basvuru.kullaniciId === kullanici.id,
  });
  if (!karar.olurMu) {
    don(`hata=${encodeURIComponent(karar.neden)}`);
  }

  await prisma.gencTekGorevBasvurusu.update({
    where: { id: basvuru.id },
    data: {
      onayDurumu: karar.durum,
      kararVerenKullaniciId: kullanici.id,
      kararTarihi: new Date(),
      retGerekcesi: karar.durum === "REDDEDILDI" ? karar.gerekce : null,
    },
  });

  await bildirimGonder({
    kullaniciId: basvuru.kullaniciId,
    kod: BILDIRIM_KODLARI.GENCTEK_GOREV_KARARI,
    degiskenler: {
      gorevAdi: basvuru.gorev.ad,
      sonuc: karar.durum === "ONAYLANDI" ? "onaylandı" : "reddedildi",
      gerekce: karar.gerekce ?? "—",
    },
  });

  await erisimLogla({
    kullaniciId: kullanici.id,
    islem: "DEGISIKLIK",
    hedefTip: "PROFIL",
    hedefId: basvuru.kullaniciId,
    detay: `GençTek görev başvurusu ${
      karar.durum === "ONAYLANDI" ? "onaylandı" : "reddedildi"
    }: ${basvuru.gorev.ad}`,
  });

  don("durum=karar-verildi");
}

/** Yeni görev ilanı açar (Yönetim Paneli). */
export async function gorevEkleEylemi(veri: FormData): Promise<void> {
  const kullanici = await oturumKullanicisiZorunlu();
  if (!gencTekGoreviYonetebilirMi(kullanici)) {
    throw new YetkiHatasi("Görev ilanı açamazsınız.");
  }

  const karar = gorevTanimiGecerliMi({
    ad: String(veri.get("ad") ?? ""),
    aciklama: String(veri.get("aciklama") ?? ""),
    kontenjan: String(veri.get("kontenjan") ?? ""),
  });
  if (!karar.olurMu) {
    yonetimeDon(`hata=${encodeURIComponent(karar.neden)}`);
  }

  /*
   * Sıra numarası listenin SONUNA yazılıyor: yeni ilan, merkezin öncelik
   * sırasını bozup panonun başına geçmemeli. Sıra değiştirmek ayrı bir iş ve
   * bugün istenmedi.
   */
  const sonSira = await prisma.gencTekGorevi.aggregate({
    _max: { siraNo: true },
  });

  const gorev = await prisma.gencTekGorevi.create({
    data: {
      ad: karar.ad,
      aciklama: karar.aciklama,
      kontenjan: karar.kontenjan,
      siraNo: (sonSira._max.siraNo ?? 0) + 10,
    },
    select: { id: true, ad: true },
  });

  await erisimLogla({
    kullaniciId: kullanici.id,
    islem: "DEGISIKLIK",
    hedefTip: "SISTEM_AYARI",
    hedefId: gorev.id,
    detay: `GençTek görevi açıldı: ${gorev.ad}`,
  });

  yonetimeDon("durum=gorev-eklendi");
}

/**
 * Var olan bir görev ilanını düzenler (22 Ağustos 2026 · istek: "görev
 * ilanları düzenlenebilsin").
 *
 * İlan yalnızca açılıp kapatılabiliyordu: adında yazım hatası olan ya da
 * kontenjanı değişen bir görev için tek yol yenisini açıp eskisini kapatmaktı
 * — bu da başvuruları eski ilanda bırakıp listeyi ikiye bölüyordu.
 *
 * KURAL AYNI KAYNAKTAN (`gorevTanimiGecerliMi`): ilan açma ile düzenleme aynı
 * alanları alıyor, iki ayrı doğrulama yazılsaydı biri güncellenip öbürü geride
 * kalırdı.
 *
 * KONTENJAN GÖREVDEKİ KİŞİ SAYISININ ALTINA İNEMEZ: inebilseydi ilan "5/3 kişi
 * görevde" der ve kimin görevden çıkarılacağı sorusunu ekrana bırakırdı. Görevi
 * daraltmak isteyen önce kişileri çıkarmalı — o ayrı ve bilinçli bir karar.
 */
export async function gorevDuzenleEylemi(veri: FormData): Promise<void> {
  const kullanici = await oturumKullanicisiZorunlu();
  if (!gencTekGoreviYonetebilirMi(kullanici)) {
    throw new YetkiHatasi("Görev ilanını değiştiremezsiniz.");
  }

  const gorevId = Number.parseInt(String(veri.get("gorevId") ?? ""), 10);
  if (!Number.isFinite(gorevId)) throw new BulunamadiHatasi();

  const gorev = await prisma.gencTekGorevi.findUnique({
    where: { id: gorevId },
    select: {
      id: true,
      ad: true,
      _count: {
        select: { basvurular: { where: { onayDurumu: "ONAYLANDI" } } },
      },
    },
  });
  if (!gorev) throw new BulunamadiHatasi();

  const karar = gorevTanimiGecerliMi({
    ad: String(veri.get("ad") ?? ""),
    aciklama: String(veri.get("aciklama") ?? ""),
    kontenjan: String(veri.get("kontenjan") ?? ""),
  });
  if (!karar.olurMu) {
    yonetimeDon(`hata=${encodeURIComponent(karar.neden)}`);
  }

  if (karar.kontenjan !== null && karar.kontenjan < gorev._count.basvurular) {
    yonetimeDon(
      `hata=${encodeURIComponent(
        `Kontenjan, görevdeki kişi sayısından (${gorev._count.basvurular}) az olamaz.`,
      )}`,
    );
  }

  await prisma.gencTekGorevi.update({
    where: { id: gorev.id },
    data: {
      ad: karar.ad,
      aciklama: karar.aciklama,
      kontenjan: karar.kontenjan,
    },
  });

  await erisimLogla({
    kullaniciId: kullanici.id,
    islem: "DEGISIKLIK",
    hedefTip: "SISTEM_AYARI",
    hedefId: gorev.id,
    detay: `GençTek görevi düzenlendi: ${gorev.ad}${
      gorev.ad === karar.ad ? "" : ` → ${karar.ad}`
    }`,
  });

  yonetimeDon("durum=gorev-duzenlendi");
}

/**
 * Görevi başvuruya açar ya da kapatır.
 *
 * SİLME YOK: kapatılan görevin başvuruları ve kararları kayıttır. Kapalı görev
 * listede görünür ama yeni başvuru kabul etmez (bkz. gorevBasvurusuKabulEdilirMi).
 */
export async function gorevDurumEylemi(veri: FormData): Promise<void> {
  const kullanici = await oturumKullanicisiZorunlu();
  if (!gencTekGoreviYonetebilirMi(kullanici)) {
    throw new YetkiHatasi("Görev ilanını değiştiremezsiniz.");
  }

  const gorevId = Number.parseInt(String(veri.get("gorevId") ?? ""), 10);
  if (!Number.isFinite(gorevId)) throw new BulunamadiHatasi();

  const gorev = await prisma.gencTekGorevi.findUnique({
    where: { id: gorevId },
    select: { id: true, ad: true, aktif: true },
  });
  if (!gorev) throw new BulunamadiHatasi();

  await prisma.gencTekGorevi.update({
    where: { id: gorev.id },
    data: { aktif: !gorev.aktif },
  });

  await erisimLogla({
    kullaniciId: kullanici.id,
    islem: "DEGISIKLIK",
    hedefTip: "SISTEM_AYARI",
    hedefId: gorev.id,
    detay: `GençTek görevi ${gorev.aktif ? "kapatıldı" : "yeniden açıldı"}: ${gorev.ad}`,
  });

  yonetimeDon(gorev.aktif ? "durum=gorev-kapatildi" : "durum=gorev-acildi");
}
