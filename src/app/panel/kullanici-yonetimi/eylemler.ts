"use server";

import { revalidatePath } from "next/cache";
import { oturumKullanicisiZorunlu } from "@/lib/auth/oturum";
import {
  aktiflikDegistir,
  geciciSifreVer,
  type IslemSonucu,
  kaydiSil,
  kilidiAc,
} from "@/lib/kullanici-yonetimi/islemler";
import { SILME_ONAY_KELIMESI } from "@/lib/kullanici-yonetimi/kurallar";
import { kullaniciYonetebilirMi } from "@/lib/yetki/izinler";

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
  const yonetici = await oturumKullanicisiZorunlu();
  const kullaniciId = Number.parseInt(String(veri.get("kullaniciId") ?? ""), 10);

  if (!kullaniciYonetebilirMi(yonetici)) {
    return {
      kullaniciId,
      olduMu: false,
      mesaj: "Kullanıcı yönetimi yalnızca proje yöneticisine açık.",
    };
  }

  const islem = String(veri.get("islem") ?? "");
  let sonuc: IslemSonucu;

  switch (islem) {
    case "sifre":
      sonuc = await geciciSifreVer(yonetici.id, kullaniciId);
      break;
    case "kilit":
      sonuc = await kilidiAc(yonetici.id, kullaniciId);
      break;
    case "pasif":
      sonuc = await aktiflikDegistir(yonetici.id, kullaniciId, false);
      break;
    case "aktif":
      sonuc = await aktiflikDegistir(yonetici.id, kullaniciId, true);
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
      sonuc = await kaydiSil(yonetici.id, kullaniciId);
      break;
    }
    default:
      sonuc = { olduMu: false, mesaj: "Tanımsız işlem." };
  }

  if (sonuc.olduMu) revalidatePath("/panel/kullanici-yonetimi");
  return { ...sonuc, kullaniciId };
}
