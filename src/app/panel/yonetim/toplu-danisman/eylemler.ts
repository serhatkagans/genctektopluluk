"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { oturumKullanicisiZorunlu } from "@/lib/auth/oturum";
import { danismanAtayaniCoz, yoneticiDanismanAta } from "@/lib/danisman/atama";
import { erisimLogla } from "@/lib/yetki/log";
import { YetkiHatasi } from "@/lib/yetki/tipler";

const YOL = "/panel/yonetim/toplu-danisman";

/**
 * Toplu danışman ataması (23 Ekim 2026 · istek: "yönetim panelinde toplu
 * atama olsun"). Seçilen her öğrenci için tekil atamanın aynısı çalışır
 * (bkz. lib/danisman/atama.ts · yoneticiDanismanAta): kural ve bildirimler
 * tek yerde.
 *
 * İl koordinatörü de kullanır (11 Kasım 2026). Öğrenci id'leri formdan
 * geldiği için il kısıtı her öğrencide yoneticiDanismanAta içinde yeniden
 * sorulur; başka ilin öğrencisi "atanamadı" sayısına düşer.
 */
export async function topluDanismanAtaEylemi(veri: FormData): Promise<void> {
  const kullanici = await oturumKullanicisiZorunlu();
  const atayan = danismanAtayaniCoz(kullanici);
  if (!atayan) {
    throw new YetkiHatasi(
      "Danışman atamasını il koordinatörü ya da proje yöneticisi yapar.",
    );
  }

  // Koordinatörün ekranında il sabit; formdaki değere bakılmaz.
  const il =
    atayan.rol === "IL_KOORDINATOR" ? "" : String(veri.get("il") ?? "");
  const donus = (sorgu: string) =>
    il ? `${YOL}?il=${encodeURIComponent(il)}&${sorgu}` : `${YOL}?${sorgu}`;

  /*
   * "Beni danışman yap" (13 Kasım 2026): il koordinatörü okulunda danışman
   * olmayan öğrencileri kendine alır. Uygunluk (öğrencinin ilinin
   * koordinatörü mü) yoneticiDanismanAta içinde sorulur.
   */
  const danismanId =
    veri.get("kendim") === "1"
      ? kullanici.id
      : Number.parseInt(String(veri.get("danismanId") ?? ""), 10);
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
    const sonuc = await yoneticiDanismanAta(ogrenciId, danismanId, atayan);
    if (sonuc.olurMu) atanan += 1;
    else hatalar.push(sonuc.neden);
  }

  await erisimLogla({
    kullaniciId: kullanici.id,
    islem: "DEGISIKLIK",
    hedefTip: "DANISMAN_ATAMA",
    hedefId: danismanId,
    detay: `Toplu danışman ataması (${atayan.rol === "IL_KOORDINATOR" ? `il koordinatörü, ${atayan.ilKodu}` : "proje yöneticisi"}): ${atanan}/${ogrenciIdleri.length} öğrenci → ${danismanId}`,
  });

  revalidatePath(YOL);
  revalidatePath("/panel/ogrenciler");

  const mesaj =
    hatalar.length === 0
      ? `${atanan} öğrenciye danışman atandı.`
      : `${atanan} öğrenciye danışman atandı, ${hatalar.length} öğrenciye atanamadı: ${[...new Set(hatalar)].join(" ")}`;
  redirect(donus(`${hatalar.length === 0 ? "durum" : "hata"}=${encodeURIComponent(mesaj)}`));
}
