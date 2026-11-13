"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { oturumKullanicisiZorunlu } from "@/lib/auth/oturum";
import { prisma } from "@/lib/db";
import { geciciKurumKoduMu } from "@/lib/okul/eslestirme";
import {
  kisileriOkulaBagla,
  kisiyiOkuldanAyir,
  okulAdiniDegistir,
  okulEkle,
  okullariBirlestir,
} from "@/lib/okul/eslestirme-islem";
import { okulEslestirebilirMi } from "@/lib/yetki/izinler";
import { YetkiHatasi } from "@/lib/yetki/tipler";

const YOL = "/panel/yonetim/okul-eslestirme";

function metin(veri: FormData, ad: string): string {
  return String(veri.get(ad) ?? "").trim();
}

function geriDon(il: string, sorgu: Record<string, string>): never {
  const parametreler = new URLSearchParams({ il, ...sorgu });
  redirect(`${YOL}?${parametreler.toString()}`);
}

function yenile() {
  revalidatePath(YOL);
  revalidatePath("/panel/yonetim");
  revalidatePath("/panel/ogrenciler");
  revalidatePath("/panel/ogretmenler");
}

async function yetkiliKullanici(ilKodu: string | null) {
  const kullanici = await oturumKullanicisiZorunlu();
  if (!okulEslestirebilirMi(kullanici, ilKodu)) {
    throw new YetkiHatasi("Bu ildeki okul eşleştirmesini yapamazsınız.");
  }
  return kullanici;
}

/**
 * Bir gruptaki işaretli kişileri okula bağlar. Okul ya listeden seçilir
 * (`kurumKodu` sayı) ya da aynı formda yeni eklenir (`kurumKodu=yeni`).
 */
export async function okulaBaglaEylemi(veri: FormData): Promise<void> {
  const il = metin(veri, "il");
  if (!/^\d{2}$/.test(il)) throw new YetkiHatasi("İl bilgisi eksik.");
  const kullanici = await yetkiliKullanici(il);

  const kisiIdleri = veri
    .getAll("kisiId")
    .map((deger) => Number.parseInt(String(deger), 10))
    .filter(Number.isInteger);
  if (kisiIdleri.length === 0) {
    geriDon(il, { hata: "En az bir kişi işaretleyin." });
  }

  const secim = metin(veri, "kurumKodu");
  let kurumKodu: number;
  let okulYeniMi = false;

  if (secim === "yeni") {
    const sonuc = await okulEkle({
      ad: metin(veri, "yeniAd"),
      ilKodu: il,
      ilceKodu: metin(veri, "yeniIlce"),
      okulTuru: metin(veri, "yeniTur"),
      ekleyenId: kullanici.id,
    });
    if (!sonuc.olurMu) geriDon(il, { hata: sonuc.neden });
    kurumKodu = sonuc.deger.kurumKodu;
    okulYeniMi = sonuc.deger.yeniMi;
  } else {
    kurumKodu = Number.parseInt(secim, 10);
    if (!Number.isInteger(kurumKodu)) {
      geriDon(il, { hata: "Bağlanacak okulu seçin ya da yeni okul ekleyin." });
    }
    // Okul formdaki ilden olmalı: koordinatörün yetkisi o ile göre soruldu.
    const okul = await prisma.kurum.findUnique({
      where: { kurumKodu },
      select: { ilKodu: true },
    });
    if (!okul || okul.ilKodu !== il) {
      geriDon(il, { hata: "Seçilen okul bu ilde değil." });
    }
  }

  const sonuc = await kisileriOkulaBagla(kurumKodu, kisiIdleri, kullanici.id);
  yenile();
  if (!sonuc.olurMu) geriDon(il, { hata: sonuc.neden });

  const { baglanan, atlanan } = sonuc.deger;
  const mesaj =
    `${baglanan} kişi okula bağlandı` +
    (okulYeniMi ? " (okul listeye eklendi)" : "") +
    (atlanan > 0
      ? `; ${atlanan} kişi atlandı (bu arada okula bağlanmış ya da ili farklı).`
      : ".");
  geriDon(il, { durum: mesaj });
}

/** Yanlış bağlamayı geri alır; kişi eşleştirme listesine döner. */
export async function okuldanAyirEylemi(veri: FormData): Promise<void> {
  const kisiId = Number.parseInt(metin(veri, "kisiId"), 10);
  const kisi = Number.isInteger(kisiId)
    ? await prisma.kullanici.findUnique({
        where: { id: kisiId },
        select: { kurum: { select: { ilKodu: true } } },
      })
    : null;
  const il = kisi?.kurum?.ilKodu ?? null;
  const kullanici = await yetkiliKullanici(il);
  if (!il) throw new YetkiHatasi("Kişi bir okula bağlı değil.");

  const sonuc = await kisiyiOkuldanAyir(kisiId, kullanici.id);
  yenile();
  if (!sonuc.olurMu) geriDon(il, { hata: sonuc.neden });
  geriDon(il, { durum: "Kişinin okul bağlantısı kaldırıldı; yeniden eşleştirme listesinde." });
}

/** Ekrandan eklenmiş (geçici kodlu) okulun adını düzeltir. */
export async function okulAdiDegistirEylemi(veri: FormData): Promise<void> {
  const kurumKodu = Number.parseInt(metin(veri, "kurumKodu"), 10);
  const okul = Number.isInteger(kurumKodu)
    ? await prisma.kurum.findUnique({
        where: { kurumKodu },
        select: { ilKodu: true },
      })
    : null;
  const kullanici = await yetkiliKullanici(okul?.ilKodu ?? null);
  if (!okul) throw new YetkiHatasi("Okul bulunamadı.");
  /*
   * Yalnızca ekrandan eklenen okulun adı değişir. MEB kodlu okulun adı
   * resmî listeden gelir; burada değiştirilseydi bir sonraki yüklemede
   * sessizce geri dönerdi.
   */
  if (!geciciKurumKoduMu(kurumKodu)) {
    geriDon(okul.ilKodu, { hata: "Bu okulun adı MEB listesinden geliyor, buradan değişmez." });
  }

  const sonuc = await okulAdiniDegistir(kurumKodu, metin(veri, "ad"), kullanici.id);
  yenile();
  if (!sonuc.olurMu) geriDon(okul.ilKodu, { hata: sonuc.neden });
  geriDon(okul.ilKodu, { durum: "Okulun adı güncellendi." });
}

/**
 * Aynı okulun iki kaydını birleştirir: geçici kodlu kayıttaki her şey seçilen
 * okula taşınır, eski kayıt pasife alınır. Geri alınamaz; onay kutusu ister.
 * Hedefin de aynı ilde olduğunu okullariBirlestir denetler.
 */
export async function okulBirlestirEylemi(veri: FormData): Promise<void> {
  const kurumKodu = Number.parseInt(metin(veri, "kurumKodu"), 10);
  const okul = Number.isInteger(kurumKodu)
    ? await prisma.kurum.findUnique({
        where: { kurumKodu },
        select: { ilKodu: true },
      })
    : null;
  const kullanici = await yetkiliKullanici(okul?.ilKodu ?? null);
  if (!okul) throw new YetkiHatasi("Okul bulunamadı.");

  const hedefKodu = Number.parseInt(metin(veri, "hedefKodu"), 10);
  if (!Number.isInteger(hedefKodu)) {
    geriDon(okul.ilKodu, { hata: "Birleştirilecek asıl okulu seçin." });
  }
  if (metin(veri, "onay") !== "evet") {
    geriDon(okul.ilKodu, { hata: "Birleştirmek için onay kutusunu işaretleyin." });
  }

  const sonuc = await okullariBirlestir(kurumKodu, hedefKodu, kullanici.id);
  yenile();
  if (!sonuc.olurMu) geriDon(okul.ilKodu, { hata: sonuc.neden });
  geriDon(okul.ilKodu, {
    durum: `Okullar birleştirildi; ${sonuc.deger.kisi} kişi taşındı, tekrar eden kayıt listeden kaldırıldı.`,
  });
}
