"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { oturumKullanicisiZorunlu } from "@/lib/auth/oturum";
import { prisma } from "@/lib/db";
import {
  mesajMetniniCoz,
  mesajYazilabilirMi,
} from "@/lib/iletisim/kurallar";
import { danismanMi, ilKoordinatoruMu, projeYoneticisiMi } from "@/lib/yetki/izinler";
import { yazismaKapsamFiltresi } from "@/lib/yetki/kapsam";
import { erisimLogla } from "@/lib/yetki/log";
import { BulunamadiHatasi, YetkiHatasi } from "@/lib/yetki/tipler";
import {
  BAGLANTILARIM_KAPALI_ACIKLAMASI,
  baglantilarimKapaliMi,
} from "@/lib/yazisma/politika";

/**
 * Yazışma eylemleri: mesaj yazma, moderasyon ve kapatma.
 *
 * MESAJ YAZMAK ile OKUMAK ayrı yetkilerdir. Danışman ve koordinatör
 * yazışmaları okur ama TARAF DEĞİLSE yazamaz — gözetim, sohbete katılma hakkı
 * vermez. Yazma kapısı bu yüzden taraf olmaya bakar, kapsam filtresine değil.
 */

function hataylaDon(yol: string, mesaj: string): never {
  redirect(`${yol}?hata=${encodeURIComponent(mesaj)}`);
}

export async function mesajYazEylemi(veri: FormData): Promise<void> {
  const kullanici = await oturumKullanicisiZorunlu();
  if (baglantilarimKapaliMi(kullanici)) {
    throw new YetkiHatasi(BAGLANTILARIM_KAPALI_ACIKLAMASI);
  }

  const yazismaId = Number.parseInt(String(veri.get("yazismaId") ?? ""), 10);
  if (!Number.isFinite(yazismaId)) throw new BulunamadiHatasi();

  const yol = `/panel/yazismalar/${yazismaId}`;

  const yazisma = await prisma.yazisma.findFirst({
    where: {
      AND: [
        { baglantiIstegiId: yazismaId },
        yazismaKapsamFiltresi(kullanici),
      ],
    },
    select: {
      baglantiIstegiId: true,
      kapatildiMi: true,
      baglantiIstegi: {
        select: {
          onayDurumu: true,
          isteyenKullaniciId: true,
          hedefKullaniciId: true,
        },
      },
    },
  });
  if (!yazisma) throw new BulunamadiHatasi();

  // TARAF olmayan yazamaz; okuma yetkisi yazma yetkisi vermez.
  const tarafMi =
    yazisma.baglantiIstegi.isteyenKullaniciId === kullanici.id ||
    yazisma.baglantiIstegi.hedefKullaniciId === kullanici.id;
  if (!tarafMi) {
    throw new YetkiHatasi(
      "Bu yazışmayı okuyabilirsiniz ama taraf olmadığınız için mesaj yazamazsınız.",
    );
  }

  const izin = mesajYazilabilirMi({
    onayDurumu: yazisma.baglantiIstegi.onayDurumu,
    yazismaKapatildiMi: yazisma.kapatildiMi,
  });
  if (!izin.olurMu) hataylaDon(yol, izin.neden ?? "Mesaj yazılamaz.");

  const karar = mesajMetniniCoz(String(veri.get("icerik") ?? ""));
  if (!karar.olurMu) hataylaDon(yol, karar.neden);

  await prisma.mesaj.create({
    data: {
      yazismaId: yazisma.baglantiIstegiId,
      yazanKullaniciId: kullanici.id,
      icerik: karar.icerik,
    },
  });

  /*
   * Mesaj GÖNDERİMİ loglanır, içeriği değil: erişim kaydı "kim ne zaman ne
   * yaptı" sorusunu cevaplar, mesajın kendisi zaten tabloda duruyor.
   */
  await erisimLogla({
    kullaniciId: kullanici.id,
    islem: "DEGISIKLIK",
    hedefTip: "PROFIL",
    hedefId: yazisma.baglantiIstegiId,
    detay: "Yazışmaya mesaj gönderildi",
  });

  revalidatePath(yol);
  redirect(yol);
}

/**
 * Mesajı gizler (moderasyon). SİLME YOKTUR: içerik korunur çünkü şikâyet
 * incelemesinde silinmiş bir mesaj en çok ihtiyaç duyulan kayıttır.
 *
 * Yalnızca gözetim yetkisi olanlar gizleyebilir; taraflar kendi mesajını
 * geri alamaz — alabilseydi moderasyon kaydı kullanıcının elinde olurdu.
 */
export async function mesajGizleEylemi(veri: FormData): Promise<void> {
  const kullanici = await oturumKullanicisiZorunlu();

  if (
    !danismanMi(kullanici) &&
    !ilKoordinatoruMu(kullanici) &&
    !projeYoneticisiMi(kullanici)
  ) {
    throw new YetkiHatasi("Mesaj gizleme yetkiniz yok.");
  }

  const mesajId = Number.parseInt(String(veri.get("mesajId") ?? ""), 10);
  if (!Number.isFinite(mesajId)) throw new BulunamadiHatasi();

  // Kapsam: yalnızca görebildiği yazışmadaki mesajı gizleyebilir.
  const mesaj = await prisma.mesaj.findFirst({
    where: {
      AND: [{ id: mesajId }, { yazisma: yazismaKapsamFiltresi(kullanici) }],
    },
    select: { id: true, yazismaId: true, gizlendiMi: true },
  });
  if (!mesaj) throw new BulunamadiHatasi();

  const yol = `/panel/yazismalar/${mesaj.yazismaId}`;
  if (mesaj.gizlendiMi) hataylaDon(yol, "Bu mesaj zaten gizlenmiş.");

  await prisma.mesaj.update({
    where: { id: mesaj.id },
    data: {
      gizlendiMi: true,
      gizleyenKullaniciId: kullanici.id,
      // Tarih İMHA PENCERESİNİ başlatır (bkz. lib/kvkk/imha.ts): gizlenen
      // içerik moderasyon süresi dolunca gerçekten imha edilir.
      gizlenmeTarihi: new Date(),
    },
  });

  await erisimLogla({
    kullaniciId: kullanici.id,
    islem: "SILME",
    hedefTip: "PROFIL",
    hedefId: mesaj.yazismaId,
    detay: `Yazışmada mesaj gizlendi (mesaj ${mesaj.id})`,
  });

  revalidatePath(yol);
  redirect(`${yol}?durum=gizlendi`);
}

/** Yazışmayı kapatır: yeni mesaj yazılamaz, geçmiş korunur. */
export async function yazismaKapatEylemi(veri: FormData): Promise<void> {
  const kullanici = await oturumKullanicisiZorunlu();

  if (
    !danismanMi(kullanici) &&
    !ilKoordinatoruMu(kullanici) &&
    !projeYoneticisiMi(kullanici)
  ) {
    throw new YetkiHatasi("Yazışma kapatma yetkiniz yok.");
  }

  const yazismaId = Number.parseInt(String(veri.get("yazismaId") ?? ""), 10);
  if (!Number.isFinite(yazismaId)) throw new BulunamadiHatasi();

  const yazisma = await prisma.yazisma.findFirst({
    where: {
      AND: [{ baglantiIstegiId: yazismaId }, yazismaKapsamFiltresi(kullanici)],
    },
    select: { baglantiIstegiId: true },
  });
  if (!yazisma) throw new BulunamadiHatasi();

  await prisma.yazisma.update({
    where: { baglantiIstegiId: yazisma.baglantiIstegiId },
    data: { kapatildiMi: true },
  });

  await erisimLogla({
    kullaniciId: kullanici.id,
    islem: "DEGISIKLIK",
    hedefTip: "PROFIL",
    hedefId: yazisma.baglantiIstegiId,
    detay: "Yazışma kapatıldı",
  });

  revalidatePath(`/panel/yazismalar/${yazismaId}`);
  redirect(`/panel/yazismalar/${yazismaId}?durum=kapatildi`);
}
