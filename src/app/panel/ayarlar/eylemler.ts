"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { oturumKullanicisiZorunlu } from "@/lib/auth/oturum";
import { ayarDegeriGecerliMi, YONETILEBILIR_AYARLAR } from "@/lib/ayar";
import {
  sablonMetniGecerliMi,
  sablonTanimiGetir,
} from "@/lib/bildirim/sablon";
import { prisma } from "@/lib/db";
import { sistemAyarlariniYonetebilirMi } from "@/lib/yetki/izinler";
import { erisimLogla } from "@/lib/yetki/log";
import { BulunamadiHatasi, YetkiHatasi } from "@/lib/yetki/tipler";

/**
 * Sistem ayarı güncelleme — yalnızca proje yöneticisi.
 *
 * Ayarlar tek tek kaydedilir: aynı formda dosya boyutuyla KVKK metnini birlikte
 * göndermek, birinde yapılan hatanın diğerini de geri almasına yol açardı.
 */
const YOL = "/panel/ayarlar";

export async function ayarKaydetEylemi(veri: FormData): Promise<void> {
  const kullanici = await oturumKullanicisiZorunlu();
  if (!sistemAyarlariniYonetebilirMi(kullanici)) {
    throw new YetkiHatasi("Sistem ayarlarını yalnızca proje yöneticisi düzenler.");
  }

  const anahtar = String(veri.get("anahtar") ?? "");
  const tanim = YONETILEBILIR_AYARLAR.find((ayar) => ayar.anahtar === anahtar);
  if (!tanim) throw new BulunamadiHatasi("Tanımsız ayar.");

  const deger = String(veri.get("deger") ?? "").trim();

  /*
   * Uzun metin (KVKK) boş bırakılabilir: kayıt silinir ve koddaki varsayılan
   * metne dönülür. Diğer ayarlarda boş değer anlamsızdır.
   */
  if (!deger && tanim.bicim === "uzun-metin") {
    await prisma.sistemAyari.deleteMany({ where: { anahtar } });
    await erisimLogla({
      kullaniciId: kullanici.id,
      islem: "DEGISIKLIK",
      hedefTip: "SISTEM_AYARI",
      hedefId: anahtar,
      detay: `Ayar varsayılana döndürüldü: ${tanim.baslik}`,
    });
    revalidatePath(YOL);
    redirect(`${YOL}?durum=varsayilan&anahtar=${anahtar}`);
  }

  const gecersizNedeni = deger
    ? ayarDegeriGecerliMi(tanim.bicim, deger)
    : "Değer boş bırakılamaz.";
  if (gecersizNedeni) {
    redirect(
      `${YOL}?hata=${encodeURIComponent(`${tanim.baslik}: ${gecersizNedeni}`)}`,
    );
  }

  await prisma.sistemAyari.upsert({
    where: { anahtar },
    update: { deger },
    create: { anahtar, deger, aciklama: tanim.yardim },
  });

  await erisimLogla({
    kullaniciId: kullanici.id,
    islem: "DEGISIKLIK",
    hedefTip: "SISTEM_AYARI",
    hedefId: anahtar,
    detay: `Ayar güncellendi: ${tanim.baslik}`,
  });

  revalidatePath(YOL);
  /*
   * KVKK metni değişmiş olabilir. Şerit panel DÜZENİNDE basıldığı için düzenin
   * kendisi tazeleniyor; belgelerin okunduğu bölüm de profilde olduğundan o
   * sayfa ayrıca tazeleniyor. Metin güncellendiği anda herkesten yeniden onay
   * isteniyor (onayiGerekiyorMu), bu yüzden ikisi de eskimemeli.
   */
  revalidatePath("/panel", "layout");
  redirect(`${YOL}?durum=kaydedildi&anahtar=${anahtar}`);
}

// ---------------------------------------------------------------------------
// Çalışma grupları ve etkinlik programları
// ---------------------------------------------------------------------------

async function yoneticiZorunlu() {
  const kullanici = await oturumKullanicisiZorunlu();
  if (!sistemAyarlariniYonetebilirMi(kullanici)) {
    throw new YetkiHatasi("Bu listeyi yalnızca proje yöneticisi yönetir.");
  }
  return kullanici;
}

function siraNoOku(veri: FormData, varsayilan: number): number {
  const sayi = Number.parseInt(String(veri.get("siraNo") ?? ""), 10);
  return Number.isFinite(sayi) && sayi > 0 ? sayi : varsayilan;
}

/**
 * Yeni çalışma grubu ekler.
 *
 * SİLME YOKTUR: kapanan grup pasife alınır, böylece geçmiş öğrenci seçimleri ve
 * faaliyet etiketleri bozulmaz (data-model.md Bölüm 4).
 */
export async function calismaGrubuEkleEylemi(veri: FormData): Promise<void> {
  const kullanici = await yoneticiZorunlu();

  const ad = String(veri.get("ad") ?? "").trim();
  if (!ad) redirect(`${YOL}?hata=${encodeURIComponent("Grup adı zorunludur.")}`);

  const mevcut = await prisma.calismaGrubu.findFirst({
    where: { ad: { equals: ad, mode: "insensitive" } },
    select: { id: true, aktif: true },
  });
  if (mevcut) {
    redirect(
      `${YOL}?hata=${encodeURIComponent(
        mevcut.aktif
          ? "Bu adla bir çalışma grubu zaten var."
          : "Bu adla pasif bir çalışma grubu var; silmek yerine yeniden aktifleştirin.",
      )}`,
    );
  }

  const sonSira = await prisma.calismaGrubu.aggregate({
    _max: { siraNo: true },
  });
  const grup = await prisma.calismaGrubu.create({
    data: { ad, siraNo: siraNoOku(veri, (sonSira._max.siraNo ?? 0) + 1) },
    select: { id: true },
  });

  await erisimLogla({
    kullaniciId: kullanici.id,
    islem: "DEGISIKLIK",
    hedefTip: "CALISMA_GRUBU",
    hedefId: grup.id,
    detay: `Çalışma grubu eklendi: ${ad}`,
  });

  revalidatePath(YOL);
  revalidatePath("/panel/calisma-gruplari");
  redirect(`${YOL}?durum=grup-eklendi`);
}

/**
 * Çalışma grubunun kısa açıklamasını ve uzun tanıtım yazısını kaydeder (boş
 * bırakılan silinir). İkisi aynı formdan gelir (27 Ekim 2026).
 */
export async function calismaGrubuAciklamaEylemi(
  veri: FormData,
): Promise<void> {
  const kullanici = await yoneticiZorunlu();

  const id = Number.parseInt(String(veri.get("id") ?? ""), 10);
  if (!Number.isFinite(id)) throw new BulunamadiHatasi();
  const aciklama =
    String(veri.get("aciklama") ?? "").trim().slice(0, 300) || null;
  const tanitim = String(veri.get("tanitim") ?? "").trim().slice(0, 5000) || null;

  const grup = await prisma.calismaGrubu.update({
    where: { id },
    data: { aciklama, tanitim },
    select: { ad: true },
  });

  await erisimLogla({
    kullaniciId: kullanici.id,
    islem: "DEGISIKLIK",
    hedefTip: "CALISMA_GRUBU",
    hedefId: id,
    detay: `Çalışma grubu açıklaması güncellendi: ${grup.ad}`,
  });

  revalidatePath(YOL);
  revalidatePath("/panel/calisma-gruplari");
  redirect(`${YOL}?durum=grup-aciklama`);
}

export async function calismaGrubuDurumEylemi(veri: FormData): Promise<void> {
  const kullanici = await yoneticiZorunlu();

  const id = Number.parseInt(String(veri.get("id") ?? ""), 10);
  if (!Number.isFinite(id)) throw new BulunamadiHatasi();
  const aktif = veri.get("aktif") === "evet";

  const grup = await prisma.calismaGrubu.update({
    where: { id },
    data: { aktif },
    select: { ad: true },
  });

  await erisimLogla({
    kullaniciId: kullanici.id,
    islem: "DEGISIKLIK",
    hedefTip: "CALISMA_GRUBU",
    hedefId: id,
    detay: `Çalışma grubu ${aktif ? "aktifleştirildi" : "pasife alındı"}: ${grup.ad}`,
  });

  revalidatePath(YOL);
  revalidatePath("/panel/calisma-gruplari");
  redirect(`${YOL}?durum=${aktif ? "grup-aktif" : "grup-pasif"}`);
}

/**
 * Yeni temel etkinlik / çalışma grubu etkinliği programı ekler.
 *
 * Bu liste Temel Etkinlik ve Çalışma Grubu Etkinliği kategorilerinde faaliyetin
 * ADINI belirler; İl Etkinliği'nin burada karşılığı yoktur.
 */
export async function programEkleEylemi(veri: FormData): Promise<void> {
  const kullanici = await yoneticiZorunlu();

  const ad = String(veri.get("ad") ?? "").trim();
  const grup = String(veri.get("grup") ?? "");
  if (!ad) {
    redirect(`${YOL}?hata=${encodeURIComponent("Program adı zorunludur.")}`);
  }
  if (grup !== "TEMEL_ETKINLIK" && grup !== "CALISMA_GRUBU_ETKINLIGI") {
    redirect(`${YOL}?hata=${encodeURIComponent("Program grubu seçilmelidir.")}`);
  }

  const mevcut = await prisma.temelEtkinlikProgrami.findFirst({
    where: { ad: { equals: ad, mode: "insensitive" } },
    select: { id: true, aktif: true },
  });
  if (mevcut) {
    redirect(
      `${YOL}?hata=${encodeURIComponent(
        mevcut.aktif
          ? "Bu adla bir program zaten var."
          : "Bu adla pasif bir program var; silmek yerine yeniden aktifleştirin.",
      )}`,
    );
  }

  const sonSira = await prisma.temelEtkinlikProgrami.aggregate({
    where: { grup },
    _max: { siraNo: true },
  });
  const program = await prisma.temelEtkinlikProgrami.create({
    data: { ad, grup, siraNo: siraNoOku(veri, (sonSira._max.siraNo ?? 0) + 1) },
    select: { id: true },
  });

  await erisimLogla({
    kullaniciId: kullanici.id,
    islem: "DEGISIKLIK",
    hedefTip: "ETKINLIK_PROGRAMI",
    hedefId: program.id,
    detay: `Etkinlik programı eklendi: ${ad} (${grup})`,
  });

  revalidatePath(YOL);
  revalidatePath("/panel/etkinlikler/yeni");
  redirect(`${YOL}?durum=program-eklendi`);
}

export async function programDurumEylemi(veri: FormData): Promise<void> {
  const kullanici = await yoneticiZorunlu();

  const id = Number.parseInt(String(veri.get("id") ?? ""), 10);
  if (!Number.isFinite(id)) throw new BulunamadiHatasi();
  const aktif = veri.get("aktif") === "evet";

  const program = await prisma.temelEtkinlikProgrami.update({
    where: { id },
    data: { aktif },
    select: { ad: true },
  });

  await erisimLogla({
    kullaniciId: kullanici.id,
    islem: "DEGISIKLIK",
    hedefTip: "ETKINLIK_PROGRAMI",
    hedefId: id,
    detay: `Etkinlik programı ${aktif ? "aktifleştirildi" : "pasife alındı"}: ${program.ad}`,
  });

  revalidatePath(YOL);
  revalidatePath("/panel/etkinlikler/yeni");
  redirect(`${YOL}?durum=${aktif ? "program-aktif" : "program-pasif"}`);
}

// ---------------------------------------------------------------------------
// Bildirim şablonları
// ---------------------------------------------------------------------------

/**
 * Şablon metnini günceller.
 *
 * KOD DEĞİŞTİRİLEMEZ ve yeni kod EKLENEMEZ: şablonu tetikleyen olay kodda
 * yaşıyor (bkz. src/lib/bildirim/sablon.ts), veritabanına elle eklenen bir
 * satır kendiliğinden bildirim üretmez. Yönetilen şey metnin kendisidir.
 *
 * Yer tutucular kaydetmeden ÖNCE doğrulanır: metne yazılan {{ogrenci}} gibi
 * tanımsız bir değişken hiçbir zaman dolmayacağı için, hata ancak bildirim
 * kullanıcıya ham süslü parantezle ulaştığında fark edilirdi.
 */
export async function bildirimSablonuKaydetEylemi(
  veri: FormData,
): Promise<void> {
  const kullanici = await yoneticiZorunlu();

  const kod = String(veri.get("kod") ?? "").trim();
  const tanim = sablonTanimiGetir(kod);
  if (!tanim) throw new BulunamadiHatasi("Tanımsız bildirim şablonu.");

  const konu = String(veri.get("konu") ?? "").trim();
  const govde = String(veri.get("govdeSablonu") ?? "").trim();

  for (const [alan, metin] of [
    ["Konu", konu],
    ["Gövde", govde],
  ] as const) {
    const karar = sablonMetniGecerliMi(metin, tanim.degiskenler);
    if (!karar.olurMu) {
      redirect(
        `${YOL}?hata=${encodeURIComponent(
          `${tanim.baslik} · ${alan}: ${karar.neden}`,
        )}#bildirim-sablonlari`,
      );
    }
  }

  const aktif = veri.get("aktif") === "evet";

  await prisma.bildirimSablonu.upsert({
    where: { kod },
    update: { konu, govdeSablonu: govde, aciklama: tanim.aciklama, aktif },
    create: {
      kod,
      konu,
      govdeSablonu: govde,
      aciklama: tanim.aciklama,
      aktif,
    },
  });

  await erisimLogla({
    kullaniciId: kullanici.id,
    islem: "DEGISIKLIK",
    hedefTip: "BILDIRIM_SABLONU",
    hedefId: kod,
    detay: `Bildirim şablonu güncellendi: ${tanim.baslik}${
      aktif ? "" : " (pasif)"
    }`,
  });

  revalidatePath(YOL);
  redirect(`${YOL}?durum=sablon-kaydedildi#bildirim-sablonlari`);
}
