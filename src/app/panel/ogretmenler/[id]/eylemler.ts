"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { oturumKullanicisiZorunlu } from "@/lib/auth/oturum";
import { danismanAtayaniCoz, yoneticiDanismanAta } from "@/lib/danisman/atama";
import { prisma } from "@/lib/db";
import { ogrenciKapsamFiltresi, ogretmenKapsamFiltresi } from "@/lib/yetki/kapsam";
import { erisimLogla } from "@/lib/yetki/log";
import { BulunamadiHatasi, YetkiHatasi } from "@/lib/yetki/tipler";

/**
 * ÖĞRETMEN SAYFASINDAN ÖĞRENCİ ATAMA (14 Kasım 2026 · istek: "öğrenci adına
 * tıklayıp danışman ata seçiliyor ama öğretmen adına tıklayınca danışman ata
 * yok").
 *
 * Öğrenci sayfasındaki "Danışman ata"nın ters yönü; kural ve bildirimler
 * aynı yerde (lib/danisman/atama.ts · yoneticiDanismanAta): öğretmen
 * öğrencinin ilinde danışman olmalı, koordinatör yalnızca kendi ilinde atar.
 * Burası rolü ve iki kişinin de bakanın kapsamında olduğunu sorar.
 */
export async function ogretmeneOgrenciAtaEylemi(veri: FormData): Promise<void> {
  const kullanici = await oturumKullanicisiZorunlu();
  const atayan = danismanAtayaniCoz(kullanici);
  if (!atayan) {
    throw new YetkiHatasi(
      "Danışman atamasını il koordinatörü ya da proje yöneticisi yapar.",
    );
  }

  const ogretmenId = Number.parseInt(String(veri.get("ogretmenId") ?? ""), 10);
  const ogrenciId = Number.parseInt(String(veri.get("ogrenciId") ?? ""), 10);
  if (!Number.isInteger(ogretmenId)) throw new BulunamadiHatasi();
  const yol = `/panel/ogretmenler/${ogretmenId}`;

  const ogretmen = await prisma.kullanici.findFirst({
    where: { AND: [{ id: ogretmenId }, ogretmenKapsamFiltresi(kullanici)] },
    select: { id: true, ad: true, soyad: true },
  });
  if (!ogretmen) throw new BulunamadiHatasi();

  if (!Number.isInteger(ogrenciId)) {
    redirect(`${yol}?hata=${encodeURIComponent("Atanacak öğrenciyi seçin.")}`);
  }
  const ogrenci = await prisma.kullanici.findFirst({
    where: { AND: [{ id: ogrenciId }, ogrenciKapsamFiltresi(kullanici)] },
    select: { id: true },
  });
  if (!ogrenci) throw new BulunamadiHatasi();

  const sonuc = await yoneticiDanismanAta(ogrenciId, ogretmenId, atayan);
  if (!sonuc.olurMu) {
    redirect(`${yol}?hata=${encodeURIComponent(sonuc.neden)}`);
  }

  await erisimLogla({
    kullaniciId: kullanici.id,
    islem: "DEGISIKLIK",
    hedefTip: "DANISMAN_ATAMA",
    hedefId: ogrenciId,
    detay: `${atayan.rol === "IL_KOORDINATOR" ? "İl koordinatörü" : "Proje yöneticisi"} öğretmen sayfasından danışman atadı: ${ogretmenId}`,
  });

  revalidatePath(yol);
  revalidatePath(`/panel/ogrenciler/${ogrenciId}`);
  revalidatePath("/panel/ogrenciler");
  revalidatePath("/panel/ogretmenler");
  redirect(`${yol}?durum=${sonuc.degistiMi ? "ogrenci-atandi" : "ogrenci-zaten"}`);
}
