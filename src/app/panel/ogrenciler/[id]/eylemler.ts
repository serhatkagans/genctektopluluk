"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { oturumKullanicisiZorunlu } from "@/lib/auth/oturum";
import { BILDIRIM_KODLARI } from "@/lib/bildirim/sablon";
import { bildirimGonder } from "@/lib/bildirim/gonder";
import {
  ilKoordinatoruGetir,
  tekOgrenciyiBirak,
  yoneticiDanismanAta,
} from "@/lib/danisman/atama";
import { birakmaGerekcesiniCoz } from "@/lib/danisman/karar";
import { prisma } from "@/lib/db";
import {
  danismanligiSonlandirabilirMi,
  ogrenciCalismaGrubuYonetebilirMi,
  projeYoneticisiMi,
} from "@/lib/yetki/izinler";
import { ogrenciKapsamFiltresi } from "@/lib/yetki/kapsam";
import { erisimLogla } from "@/lib/yetki/log";
import { BulunamadiHatasi, YetkiHatasi } from "@/lib/yetki/tipler";

/**
 * Öğrenciyi çalışma grubuna ekleme ve gruptan çıkarma — danışman, il
 * koordinatörü ve proje yöneticisi için.
 *
 * İki kontrol AYRI AYRI yapılır ve ikisi de zorunludur:
 *   1. rol — `ogrenciCalismaGrubuYonetebilirMi`
 *   2. kapsam — öğrenci merkezi kapsam filtresinden çekilir
 * Rol kontrolü tek başına yetmez; yoksa bir danışman, forma başka bir okulun
 * öğrenci id'sini yazarak o öğrenciyi gruba kaydedebilirdi.
 *
 * Öğrencinin kendi seçimi bu eylemlerden GEÇMEZ; o akış
 * `/panel/calisma-gruplari` ekranındadır.
 */

function ogrenciYolu(ogrenciId: number): string {
  return `/panel/ogrenciler/${ogrenciId}`;
}

function hataylaDon(ogrenciId: number, mesaj: string): never {
  redirect(`${ogrenciYolu(ogrenciId)}?hata=${encodeURIComponent(mesaj)}`);
}

interface Istek {
  ogrenciId: number;
  grupId: number;
}

function istegiCoz(veri: FormData): Istek {
  const ogrenciId = Number.parseInt(String(veri.get("ogrenciId") ?? ""), 10);
  const grupId = Number.parseInt(String(veri.get("grupId") ?? ""), 10);
  if (!Number.isFinite(ogrenciId) || !Number.isFinite(grupId)) {
    throw new BulunamadiHatasi();
  }
  return { ogrenciId, grupId };
}

/** Yetkili kullanıcı + kapsamındaki öğrenci. Biri düşerse akış burada kesilir. */
async function yetkiliOgrenciGetir(ogrenciId: number) {
  const kullanici = await oturumKullanicisiZorunlu();

  if (!ogrenciCalismaGrubuYonetebilirMi(kullanici)) {
    throw new YetkiHatasi(
      "Öğrencinin çalışma gruplarını düzenleme yetkiniz yok.",
    );
  }

  const ogrenci = await prisma.kullanici.findFirst({
    where: { AND: [{ id: ogrenciId }, ogrenciKapsamFiltresi(kullanici)] },
    select: { id: true, ad: true, soyad: true },
  });
  // Kapsam dışı öğrenci "bulunamadı" döner: kaydın varlığı sızmasın
  // (references/permissions.md Bölüm 4).
  if (!ogrenci) throw new BulunamadiHatasi();

  return { kullanici, ogrenci };
}

export async function ogrenciyeGrupEkleEylemi(veri: FormData): Promise<void> {
  const { ogrenciId, grupId } = istegiCoz(veri);
  const { kullanici, ogrenci } = await yetkiliOgrenciGetir(ogrenciId);

  // Pasif gruba yeni kayıt açılmaz; geçmiş seçimler korunur.
  const grup = await prisma.calismaGrubu.findFirst({
    where: { id: grupId, aktif: true },
    select: { id: true, ad: true },
  });
  if (!grup) {
    hataylaDon(ogrenciId, "Seçilen çalışma grubu bulunamadı ya da kapatılmış.");
  }

  /*
   * Öğrenci zaten grupta olabilir (iki sekmeden aynı formu göndermek gibi).
   * Bileşik birincil anahtar ihlali kullanıcıya "beklenmeyen hata" olarak
   * dönmesin diye upsert kullanılıyor; var olan kaydın secimTarihi ve ekleyeni
   * KORUNUR — ilk ekleyen kim ise o kalır.
   */
  await prisma.ogrenciCalismaGrubu.upsert({
    where: {
      ogrenciId_calismaGrubuId: { ogrenciId: ogrenci.id, calismaGrubuId: grup.id },
    },
    update: {},
    create: {
      ogrenciId: ogrenci.id,
      calismaGrubuId: grup.id,
      ekleyenKullaniciId: kullanici.id,
    },
  });

  await erisimLogla({
    kullaniciId: kullanici.id,
    islem: "DEGISIKLIK",
    hedefTip: "OGRENCI",
    hedefId: ogrenci.id,
    detay: `Çalışma grubuna eklendi: ${grup.ad}`,
  });

  revalidatePath(ogrenciYolu(ogrenci.id));
  revalidatePath("/panel/ogrenciler");
  // Öğrenci kendi panelinde ve seçim ekranında değişikliği görsün.
  revalidatePath("/panel");
  revalidatePath("/panel/calisma-gruplari");
  redirect(`${ogrenciYolu(ogrenci.id)}?durum=grup-eklendi`);
}

export async function ogrenciyiGruptanCikarEylemi(
  veri: FormData,
): Promise<void> {
  const { ogrenciId, grupId } = istegiCoz(veri);
  const { kullanici, ogrenci } = await yetkiliOgrenciGetir(ogrenciId);

  /*
   * Pasif grup da çıkarılabilir: kapanmış bir gruptan öğrenciyi almanın önünü
   * kesmenin bir gerekçesi yok, kısıt yalnızca YENİ kayıt açmaya konuldu.
   *
   * Silme gerçek silmedir (görev rollerinde olduğu gibi); iz erişim logunda
   * kalır.
   */
  const grup = await prisma.calismaGrubu.findUnique({
    where: { id: grupId },
    select: { ad: true },
  });

  const sonuc = await prisma.ogrenciCalismaGrubu.deleteMany({
    where: { ogrenciId: ogrenci.id, calismaGrubuId: grupId },
  });
  if (sonuc.count === 0) {
    hataylaDon(ogrenciId, "Öğrenci bu çalışma grubunda değil.");
  }

  await erisimLogla({
    kullaniciId: kullanici.id,
    islem: "SILME",
    hedefTip: "OGRENCI",
    hedefId: ogrenci.id,
    detay: `Çalışma grubundan çıkarıldı: ${grup?.ad ?? grupId}`,
  });

  revalidatePath(ogrenciYolu(ogrenci.id));
  revalidatePath("/panel/ogrenciler");
  revalidatePath("/panel");
  revalidatePath("/panel/calisma-gruplari");
  redirect(`${ogrenciYolu(ogrenci.id)}?durum=grup-cikarildi`);
}

/**
 * TEK bir öğrencinin danışmanlığı bırakılır (J1).
 *
 * KİM BIRAKABİLİR (10 Ağustos 2026 · istek: "Görevi bırak kalkacak · öğretmen
 * öğrenciyi bırakabilsin, gerekirse koordinatör de bırakabilsin"):
 *
 *   1. ÖĞRENCİNİN KENDİ DANIŞMANI — kendi atamasını kapatır.
 *   2. İL KOORDİNATÖRÜ / PROJE YÖNETİCİSİ — kapsamındaki bir öğrencinin
 *      danışmanlığını sonlandırır. "Gerekirse" olan durum budur: öğretmen
 *      ulaşılamaz durumdaysa ya da bağ yürümüyorsa öğrencinin tek çıkışı
 *      koordinatördü ve o kapı yoktu.
 *
 * KAPSAM AYRICA SORULUR: rol yetmez, öğrenci merkezi kapsam filtresinden
 * çekilir — yoksa bir koordinatör forma başka ilin öğrenci kimliğini yazarak o
 * öğrencinin danışmanını düşürebilirdi.
 *
 * ÜÇ ŞEY BİRLİKTE YAPILIR ve hiçbiri isteğe bağlı değil:
 *   1. gerekçe zorunlu tutulur,
 *   2. il koordinatörüne bildirim gider (gerekçeyle birlikte),
 *   3. erişim kaydına yazılır.
 * Sebebi açık bir kötüye kullanım kapısı: "zor" bulunan öğrencinin sessizce
 * bırakılması. Üçü birden olmadan karar görünmez kalır.
 */
export async function danismanligiBirakEylemi(veri: FormData): Promise<void> {
  const kullanici = await oturumKullanicisiZorunlu();

  const ogrenciId = Number.parseInt(String(veri.get("ogrenciId") ?? ""), 10);
  if (!Number.isFinite(ogrenciId)) throw new BulunamadiHatasi();

  const karar = birakmaGerekcesiniCoz(String(veri.get("gerekce") ?? ""));
  if (!karar.olurMu) hataylaDon(ogrenciId, karar.neden);

  const mevcutAtama = await prisma.danismanAtama.findFirst({
    where: { ogrenciId, bitisTarihi: null },
    select: { danismanKullaniciId: true },
  });
  if (!mevcutAtama) {
    hataylaDon(ogrenciId, "Bu öğrencinin açık bir danışmanlık kaydı yok.");
  }

  const kendiOgrencisi = mevcutAtama.danismanKullaniciId === kullanici.id;
  if (!kendiOgrencisi) {
    // Başkasının danışmanlığını yalnızca koordinatör ve merkez sonlandırır…
    if (!danismanligiSonlandirabilirMi(kullanici)) {
      throw new YetkiHatasi(
        "Bu öğrencinin danışmanlığını sonlandırma yetkiniz yok.",
      );
    }
    // …ve yalnızca KENDİ KAPSAMINDAKİ öğrencinin.
    const kapsamda = await prisma.kullanici.findFirst({
      where: { AND: [{ id: ogrenciId }, ogrenciKapsamFiltresi(kullanici)] },
      select: { id: true },
    });
    if (!kapsamda) throw new BulunamadiHatasi();
  }

  const sonuc = await tekOgrenciyiBirak({
    // Kapatılan atama, öğrencinin O ANKİ danışmanınındır; koordinatör
    // bıraktığında da kapanan kayıt öğretmenin kaydıdır.
    danismanKullaniciId: mevcutAtama.danismanKullaniciId,
    ogrenciId,
    gerekce: karar.gerekce,
  });
  if (!sonuc.olurMu) hataylaDon(ogrenciId, sonuc.neden);

  /*
   * Koordinatöre bildirim, bırakma GERÇEKLEŞTİKTEN sonra gönderilir: işlem
   * yarıda kalırsa (ör. devredilecek kimse yok) haber gitmemeli.
   *
   * OKUL VE DANIŞMAN ADI ÖĞRENCİDEN OKUNUR, işlemi yapandan değil: koordinatör
   * bıraktığında bırakan kişi ile danışman aynı kişi değil ve koordinatörün
   * kurum kodu zaten yok. Kendi işlemini kendine bildirmek anlamsız olduğu
   * için bırakan kişi koordinatörün kendisiyse bildirim gönderilmez — kayıt
   * erişim kaydında duruyor.
   */
  const ogrenciKaydi = await prisma.kullanici.findUnique({
    where: { id: ogrenciId },
    select: {
      ilKodu: true,
      kurum: { select: { ad: true, ilKodu: true } },
    },
  });
  const eskiDanisman = await prisma.kullanici.findUnique({
    where: { id: mevcutAtama.danismanKullaniciId },
    select: { ad: true, soyad: true },
  });

  const koordinatorId = await ilKoordinatoruGetir(
    ogrenciKaydi?.kurum?.ilKodu ?? ogrenciKaydi?.ilKodu ?? null,
  );
  if (koordinatorId !== null && koordinatorId !== kullanici.id) {
    await bildirimGonder({
      kullaniciId: koordinatorId,
      kod: BILDIRIM_KODLARI.DANISMANLIK_TEKIL_BIRAKILDI,
      degiskenler: {
        ogrenciAdSoyad: sonuc.ogrenciAdSoyad,
        danismanAdSoyad: eskiDanisman
          ? `${eskiDanisman.ad} ${eskiDanisman.soyad}`
          : "-",
        okulAdi: ogrenciKaydi?.kurum?.ad ?? "-",
        gerekce: karar.gerekce,
        yeniDurum: sonuc.yeniDurum,
      },
    });
  }

  await erisimLogla({
    kullaniciId: kullanici.id,
    islem: "DEGISIKLIK",
    hedefTip: "DANISMAN_ATAMA",
    hedefId: ogrenciId,
    detay: kendiOgrencisi
      ? `Danışmanlık bırakıldı: ${sonuc.ogrenciAdSoyad} · gerekçe: ${karar.gerekce} · ${sonuc.yeniDurum}`
      : `Danışmanlık sonlandırıldı (${eskiDanisman ? `${eskiDanisman.ad} ${eskiDanisman.soyad}` : "-"}): ${sonuc.ogrenciAdSoyad} · gerekçe: ${karar.gerekce} · ${sonuc.yeniDurum}`,
  });

  revalidatePath(ogrenciYolu(ogrenciId));
  revalidatePath("/panel/ogrenciler");
  /*
   * Öğrenci artık kapsamda olmayabilir (başka danışmana geçtiyse); listeye
   * dönülüyor, çünkü detay sayfası 404 verebilir ve bu bir hata gibi görünürdü.
   */
  redirect("/panel/ogrenciler?durum=danismanlik-birakildi");
}

/**
 * Proje yöneticisinin danışman ataması (23 Ekim 2026 · istek: "atamayı
 * yönetici yapsın"; seçim: yalnızca proje yöneticisi).
 *
 * Kural ve bildirimler lib/danisman/atama.ts · yoneticiDanismanAta'da; burası
 * yalnızca yetkiyi sorar.
 */
export async function yoneticiDanismanAtaEylemi(veri: FormData): Promise<void> {
  const kullanici = await oturumKullanicisiZorunlu();
  if (!projeYoneticisiMi(kullanici)) {
    throw new YetkiHatasi("Danışman atamasını yalnızca proje yöneticisi yapar.");
  }

  const ogrenciId = Number.parseInt(String(veri.get("ogrenciId") ?? ""), 10);
  const danismanId = Number.parseInt(String(veri.get("danismanId") ?? ""), 10);
  if (!Number.isFinite(ogrenciId)) throw new BulunamadiHatasi();
  if (!Number.isFinite(danismanId)) {
    hataylaDon(ogrenciId, "Atanacak danışman öğretmeni seçin.");
  }

  const sonuc = await yoneticiDanismanAta(ogrenciId, danismanId);
  if (!sonuc.olurMu) hataylaDon(ogrenciId, sonuc.neden);

  await erisimLogla({
    kullaniciId: kullanici.id,
    islem: "DEGISIKLIK",
    hedefTip: "DANISMAN_ATAMA",
    hedefId: ogrenciId,
    detay: `Proje yöneticisi danışman atadı: ${danismanId}`,
  });

  revalidatePath(ogrenciYolu(ogrenciId));
  revalidatePath("/panel/ogrenciler");
  redirect(
    `${ogrenciYolu(ogrenciId)}?durum=${sonuc.degistiMi ? "danisman-atandi" : "danisman-ayni"}`,
  );
}
