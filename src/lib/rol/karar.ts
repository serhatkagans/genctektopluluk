import type { RolKodu } from "@/generated/prisma/enums";

/**
 * İl koordinatörü atamasının saf kararları — references/domain-rules.md Bölüm 3.
 *
 * Veritabanına giden iş (rol kaydını kapatıp açmak, öğrencileri dağıtmak)
 * src/lib/rol/koordinator.ts içindedir; burada yalnızca "bu atama olur mu" ve
 * "kaç öğrenci etkilendi" soruları yanıtlanır. Ayrı durmalarının nedeni bu iki
 * sorunun birim testle sınanabilmesi: dağıtım bir kez çalıştıktan sonra geri
 * sayılamaz, yanlış kararın izi de kalmaz.
 */

export type KoordinatorAtamaEngeli =
  | "KULLANICI_YOK"
  | "OGRENCIYE_VERILMEZ"
  | "DIS_KULLANICIYA_VERILMEZ"
  | "ZATEN_KOORDINATOR"
  | "GECERSIZ_IL"
  | "IL_DOLU";

export const KOORDINATOR_ATAMA_ENGEL_MESAJLARI: Record<
  KoordinatorAtamaEngeli,
  string
> = {
  KULLANICI_YOK: "Kullanıcı bulunamadı.",
  OGRENCIYE_VERILMEZ: "İl koordinatörlüğü yalnızca öğretmenlere verilir.",
  DIS_KULLANICIYA_VERILMEZ:
    "İl koordinatörlüğü mezun ya da paydaş temsilcisi hesabına verilemez.",
  ZATEN_KOORDINATOR: "Bu öğretmen zaten il koordinatörü olarak görevli.",
  GECERSIZ_IL: "Geçersiz il.",
  IL_DOLU:
    "Bu ilde görevli bir il koordinatörü zaten var. Önce mevcut görevi kaldırın.",
};

/**
 * Atamayı engelleyen ilk durumu döndürür, engel yoksa null.
 *
 * DANIŞMAN ROLÜ ENGEL DEĞİLDİR: danışman öğretmen il koordinatörü yapılabilir
 * (karara bağlanmış madde). Danışmanlığı kapanır ve öğrencileri devir
 * kurallarına göre dağıtılır — bu yüzden burada elenmez.
 */
export function koordinatorAtamaEngeli(girdi: {
  hedefVarMi: boolean;
  hedefAktifMi: boolean;
  hedefRolKodlari: RolKodu[];
  ilTanimliMi: boolean;
  ildeGorevliKoordinatorVarMi: boolean;
}): KoordinatorAtamaEngeli | null {
  if (!girdi.hedefVarMi || !girdi.hedefAktifMi) return "KULLANICI_YOK";
  if (girdi.hedefRolKodlari.includes("OGRENCI")) return "OGRENCIYE_VERILMEZ";
  /*
   * Dış kullanıcı (6 Kasım 2026 · güvenlik incelemesi): kimliği EBA'dan
   * gelmeyen, kurumu olmayan bir hesaba bir ilin bütün öğrenci verisini
   * açan rol verilmemeli. Yalnızca öğrenci rolü eleniyordu.
   */
  if (
    girdi.hedefRolKodlari.includes("MEZUN") ||
    girdi.hedefRolKodlari.includes("PAYDAS_TEMSILCISI")
  ) {
    return "DIS_KULLANICIYA_VERILMEZ";
  }
  if (girdi.hedefRolKodlari.includes("IL_KOORDINATOR")) {
    return "ZATEN_KOORDINATOR";
  }
  if (!girdi.ilTanimliMi) return "GECERSIZ_IL";
  if (girdi.ildeGorevliKoordinatorVarMi) return "IL_DOLU";
  return null;
}

export interface KoordinatorAtamaSonucu {
  koordinatorKullaniciId: number;
  /** Atanan kişi bu işlemden önce danışman öğretmen miydi? */
  danismanliktanAlindiMi: boolean;
  /** Danışmanlığı kapandığı için başka bir danışmana devredilen öğrenciler. */
  devredilenOgrenciSayisi: number;
  /** "Yeniden seç" bildirimi gönderilen, geçici olarak koordinatöre bağlananlar. */
  yenidenSecimBekleyen: number;
  /** Koordinatör boşluğu yüzünden atamasız kalmışken bu atamayla bağlananlar. */
  sahipsizkenBaglananOgrenciSayisi: number;
}

/**
 * "X öğrenci yeniden dağıtıldı" uyarısındaki sayı.
 *
 * Yalnızca atananın DANIŞMANLIĞI kapandığı için yer değiştiren öğrencileri
 * sayar. Koordinatör boşluğu yüzünden atamasız kalmışken bu atamayla bağlanan
 * öğrenciler buraya girmez: onlar dağıtılmadı, tersine sahipsizlikten çıktı ve
 * ayrı bir cümleyle bildirilir. İkisi tek sayıda toplanırsa proje yöneticisi
 * "danışman değişikliğinden kaç öğrenci etkilendi" sorusunun cevabını yanlış
 * okur.
 */
export function yenidenDagitilanOgrenciSayisi(
  sonuc: KoordinatorAtamaSonucu,
): number {
  return sonuc.devredilenOgrenciSayisi + sonuc.yenidenSecimBekleyen;
}
