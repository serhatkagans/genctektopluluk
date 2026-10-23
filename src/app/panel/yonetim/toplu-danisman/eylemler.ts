"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { oturumKullanicisiZorunlu } from "@/lib/auth/oturum";
import { yoneticiDanismanAta } from "@/lib/danisman/atama";
import { projeYoneticisiMi } from "@/lib/yetki/izinler";
import { erisimLogla } from "@/lib/yetki/log";
import { YetkiHatasi } from "@/lib/yetki/tipler";

const YOL = "/panel/yonetim/toplu-danisman";

/**
 * Toplu danışman ataması (23 Ekim 2026 · istek: "yönetim panelinde toplu
 * atama olsun"). Seçilen her öğrenci için tekil atamanın aynısı çalışır
 * (bkz. lib/danisman/atama.ts · yoneticiDanismanAta): kural ve bildirimler
 * tek yerde.
 */
export async function topluDanismanAtaEylemi(veri: FormData): Promise<void> {
  const kullanici = await oturumKullanicisiZorunlu();
  if (!projeYoneticisiMi(kullanici)) {
    throw new YetkiHatasi("Danışman atamasını yalnızca proje yöneticisi yapar.");
  }

  const il = String(veri.get("il") ?? "");
  const donus = (sorgu: string) =>
    `${YOL}?il=${encodeURIComponent(il)}&${sorgu}`;

  const danismanId = Number.parseInt(String(veri.get("danismanId") ?? ""), 10);
  const ogrenciIdleri = veri
    .getAll("ogrenciId")
    .map((deger) => Number.parseInt(String(deger), 10))
    .filter(Number.isFinite);

  if (!Number.isFinite(danismanId)) {
    redirect(donus(`hata=${encodeURIComponent("Danışman öğretmeni seçin.")}`));
  }
  if (ogrenciIdleri.length === 0) {
    redirect(donus(`hata=${encodeURIComponent("En az bir öğrenci işaretleyin.")}`));
  }

  let atanan = 0;
  const hatalar: string[] = [];
  for (const ogrenciId of ogrenciIdleri) {
    const sonuc = await yoneticiDanismanAta(ogrenciId, danismanId);
    if (sonuc.olurMu) atanan += 1;
    else hatalar.push(sonuc.neden);
  }

  await erisimLogla({
    kullaniciId: kullanici.id,
    islem: "DEGISIKLIK",
    hedefTip: "DANISMAN_ATAMA",
    hedefId: danismanId,
    detay: `Toplu danışman ataması: ${atanan}/${ogrenciIdleri.length} öğrenci → ${danismanId}`,
  });

  revalidatePath(YOL);
  revalidatePath("/panel/ogrenciler");

  const mesaj =
    hatalar.length === 0
      ? `${atanan} öğrenciye danışman atandı.`
      : `${atanan} öğrenciye danışman atandı, ${hatalar.length} öğrenciye atanamadı: ${[...new Set(hatalar)].join(" ")}`;
  redirect(donus(`${hatalar.length === 0 ? "durum" : "hata"}=${encodeURIComponent(mesaj)}`));
}
