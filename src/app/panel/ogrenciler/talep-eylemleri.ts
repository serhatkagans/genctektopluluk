"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { oturumKullanicisiZorunlu } from "@/lib/auth/oturum";
import {
  talebeKararVerebilirMi,
  talebiOnayla,
  talebiReddet,
} from "@/lib/danisman/talep";
import {
  ATAMAYI_YALNIZCA_YONETICI_YAPAR,
  YONETICI_ATAR_ACIKLAMASI,
} from "@/lib/danisman/politika";
import { erisimLogla } from "@/lib/yetki/log";
import { YetkiHatasi } from "@/lib/yetki/tipler";

/**
 * Danışman değişikliği taleplerine verilen kararlar (20 Ağustos 2026).
 *
 * ---------------------------------------------------------------------------
 * NİYE `ogrenciler/` ALTINDA
 * ---------------------------------------------------------------------------
 * Kuyruk "Öğrencilerim" ekranının başında duruyor ve karar veren kişi orada:
 * danışman öğretmen ya da il koordinatörü. Eylemler `danisman-secim/` altında
 * dursaydı, öğrencinin kendi seçim kapısına ait dosyada BAŞKASININ karar
 * verdiği işlemler bulunurdu — o dosyanın tamamı "yalnızca öğrencinin
 * kendisi" kuralıyla yazılmış durumda.
 *
 * ---------------------------------------------------------------------------
 * YETKİ HER ÇAĞRIDA VERİTABANINDAN SORULUYOR
 * ---------------------------------------------------------------------------
 * Rol kontrolü YETMEZ: "danışman öğretmenim" demek "bu talebin muhatabıyım"
 * demek değil. Kural katmanı talebin istenen öğretmeni mi, yoksa öğrencinin
 * ilinin koordinatörü mü olduğuna bakıyor (bkz. lib/danisman/talep.ts ·
 * talebeKararVerebilirMi). Ekranda düğmenin görünmemesi bir koruma değildir;
 * form gövdesine başka bir talep kimliği yazılabilir.
 */

const YOL = "/panel/ogrenciler";

function talepKimligi(veri: FormData): number {
  const id = Number.parseInt(String(veri.get("talepId") ?? ""), 10);
  if (!Number.isFinite(id)) {
    redirect(`${YOL}?hata=${encodeURIComponent("Geçersiz talep.")}`);
  }
  return id;
}

async function yetkiyiDogrula(talepId: number, kullaniciId: number) {
  if (!(await talebeKararVerebilirMi(talepId, kullaniciId))) {
    throw new YetkiHatasi(
      "Bu danışman talebine karar verme yetkiniz yok ya da talep zaten karara bağlanmış.",
    );
  }
}

function yollariTazele(): void {
  revalidatePath(YOL);
  // Karardan sonra kuyruk sayacı ve "Dikkat gerektirenler" satırı da değişir.
  revalidatePath("/panel");
}

export async function danismanTalebiniOnaylaEylemi(
  veri: FormData,
): Promise<void> {
  const kullanici = await oturumKullanicisiZorunlu();
  const talepId = talepKimligi(veri);
  await yetkiyiDogrula(talepId, kullanici.id);

  /*
   * Onay bir atamadır; atamayı artık yalnızca proje yöneticisi yapar
   * (23 Ekim 2026 · bkz. politika.ts). Bekleyen talep reddedilebilir.
   */
  if (ATAMAYI_YALNIZCA_YONETICI_YAPAR) {
    redirect(
      `${YOL}?hata=${encodeURIComponent(YONETICI_ATAR_ACIKLAMASI)}#danisman-talepleri`,
    );
  }

  const sonuc = await talebiOnayla(talepId, kullanici.id);
  if (!sonuc.olurMu) {
    yollariTazele();
    redirect(`${YOL}?hata=${encodeURIComponent(sonuc.neden)}#danisman-talepleri`);
  }

  await erisimLogla({
    kullaniciId: kullanici.id,
    islem: "DEGISIKLIK",
    hedefTip: "DANISMAN_ATAMA",
    hedefId: talepId,
    detay: `Danışman değişikliği onaylandı: ${sonuc.ogrenciAdSoyad}`,
  });

  yollariTazele();
  redirect(`${YOL}?durum=talep-onaylandi#danisman-talepleri`);
}

export async function danismanTalebiniReddetEylemi(
  veri: FormData,
): Promise<void> {
  const kullanici = await oturumKullanicisiZorunlu();
  const talepId = talepKimligi(veri);
  await yetkiyiDogrula(talepId, kullanici.id);

  const sonuc = await talebiReddet(
    talepId,
    kullanici.id,
    String(veri.get("gerekce") ?? ""),
  );
  if (!sonuc.olurMu) {
    redirect(`${YOL}?hata=${encodeURIComponent(sonuc.neden)}#danisman-talepleri`);
  }

  await erisimLogla({
    kullaniciId: kullanici.id,
    islem: "DEGISIKLIK",
    hedefTip: "DANISMAN_ATAMA",
    hedefId: talepId,
    detay: `Danışman değişikliği reddedildi: ${sonuc.ogrenciAdSoyad}`,
  });

  yollariTazele();
  redirect(`${YOL}?durum=talep-reddedildi#danisman-talepleri`);
}
