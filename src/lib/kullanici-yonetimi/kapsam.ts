import type { Prisma } from "@/generated/prisma/client";
import type { RolKodu } from "@/generated/prisma/enums";
import type { KullaniciYoneticisi } from "../yetki/izinler";

/**
 * KULLANICI YÖNETİMİNİN KAPSAMI (13 Kasım 2026).
 *
 * Proje yöneticisi bütün hesapları görür (başka bir proje yöneticisine
 * dokunamaması islemler.ts'te).
 *
 * İl koordinatörü yalnızca KENDİ İLİNDEKİ ÖĞRENCİ VE ÖĞRETMENLERİ görür:
 *   · kaydındaki il ya da okulunun ili koordinatörün ili,
 *   · açık rollerinde proje yöneticisi, il koordinatörü, mezun ya da paydaş
 *     temsilcisi YOK. Rol aranmaz, rol DIŞLANIR: okulsuz kaydolan öğretmene
 *     danışman rolü verilmiyor (kullanici/sagla.ts) ve bu kişiler tam da
 *     düzeltilmesi gereken kayıtlar,
 *   · dış kimlikle (mezun/paydaş başvurusuyla) açılmış hesap değil.
 */
export const KOORDINATORUN_DOKUNAMADIGI_ROLLER: RolKodu[] = [
  "PROJE_YONETICISI",
  "IL_KOORDINATOR",
  "MEZUN",
  "PAYDAS_TEMSILCISI",
];

export function yonetilebilirKullaniciFiltresi(
  yonetici: KullaniciYoneticisi,
): Prisma.KullaniciWhereInput {
  if (yonetici.rol === "PROJE_YONETICISI") return {};
  return {
    disKimlik: { is: null },
    roller: {
      none: { bitisTarihi: null, rolKodu: { in: KOORDINATORUN_DOKUNAMADIGI_ROLLER } },
    },
    OR: [{ ilKodu: yonetici.ilKodu }, { kurum: { ilKodu: yonetici.ilKodu } }],
  };
}
