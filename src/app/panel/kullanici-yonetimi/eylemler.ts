"use server";

import { revalidatePath } from "next/cache";
import { oturumKullanicisiZorunlu } from "@/lib/auth/oturum";
import {
  adSoyadDuzelt,
  aktiflikDegistir,
  geciciSifreVer,
  type IslemSonucu,
  kaydiSil,
  kilidiAc,
} from "@/lib/kullanici-yonetimi/islemler";
import { SILME_ONAY_KELIMESI } from "@/lib/kullanici-yonetimi/kurallar";
import { kullaniciYoneticisiCoz } from "@/lib/yetki/izinler";

/**
 * Kullanıcı yönetimi eylemleri (28 Ekim 2026). Tek giriş kapısı: formdaki
 * `islem` alanı hangi işin yapılacağını söyler. Sonuç `useActionState` ile
 * ekrana döner — geçici şifre adres çubuğuna ya da günlüğe düşmesin diye
 * yönlendirme yapılmaz.
 */

export type YonetimDurumu = (IslemSonucu & { kullaniciId: number }) | null;

export async function kullaniciIslemiEylemi(
  _onceki: YonetimDurumu,
  veri: FormData,
): Promise<YonetimDurumu> {
  const oturum = await oturumKullanicisiZorunlu();
  const kullaniciId = Number.parseInt(String(veri.get("kullaniciId") ?? ""), 10);

  // Proje yöneticisi ya da kendi ilinde il koordinatörü (13 Kasım 2026).
  const yapan = kullaniciYoneticisiCoz(oturum);
  if (!yapan) {
    return {
      kullaniciId,
      olduMu: false,
      mesaj: "Kullanıcı yönetimi il koordinatörüne ve proje yöneticisine açık.",
    };
  }

  const islem = String(veri.get("islem") ?? "");
  let sonuc: IslemSonucu;

  switch (islem) {
    case "sifre":
      sonuc = await geciciSifreVer(yapan, kullaniciId);
      break;
    case "ad":
      sonuc = await adSoyadDuzelt(
        yapan,
        kullaniciId,
        String(veri.get("ad") ?? ""),
        String(veri.get("soyad") ?? ""),
      );
      break;
    case "kilit":
      sonuc = await kilidiAc(yapan, kullaniciId);
      break;
    case "pasif":
      sonuc = await aktiflikDegistir(yapan, kullaniciId, false);
      break;
    case "aktif":
      sonuc = await aktiflikDegistir(yapan, kullaniciId, true);
      break;
    case "sil": {
      const onay = String(veri.get("onay") ?? "").trim().toLocaleUpperCase("tr");
      if (onay !== SILME_ONAY_KELIMESI) {
        sonuc = {
          olduMu: false,
          mesaj: `Silmek için kutuya ${SILME_ONAY_KELIMESI} yazın.`,
        };
        break;
      }
      sonuc = await kaydiSil(yapan, kullaniciId);
      break;
    }
    default:
      sonuc = { olduMu: false, mesaj: "Tanımsız işlem." };
  }

  if (sonuc.olduMu) revalidatePath("/panel/kullanici-yonetimi");
  return { ...sonuc, kullaniciId };
}
