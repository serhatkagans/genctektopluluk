import type { RolKodu } from "@/generated/prisma/enums";

/**
 * Danışman öğretmen görevini ALAMAYACAK roller (6 Kasım 2026 · güvenlik
 * incelemesi).
 *
 * "Görevi işaretle" eylemi yalnızca oturum istiyordu; form öğrenciye ekranda
 * gösterilmese de sunucu eylemi doğrudan çağrılabiliyordu. Öğrenci kendine
 * DANISMAN rolü yazıp okulundaki öğrencilerin profiline, iletişim bilgisine ve
 * CV'sine ulaşabiliyordu. Kapı artık kural katmanında: hangi ekrandan
 * çağrılırsa çağrılsın aynı karar verilir.
 *
 *   - OGRENCI: danışmanlık bir öğretmen görevidir.
 *   - MEZUN, PAYDAS_TEMSILCISI: dış kullanıcıdır, okul verisine erişemez.
 *   - PROJE_YONETICISI: zaten her şeyi görür; rol bir şey katmaz, yalnızca
 *     kapsam hesaplarını bulandırır.
 *   - IL_KOORDINATOR: ayrı kural (DanismanlikCakismasiHatasi) — ikisi aynı
 *     anda olamaz, ama koordinatörlük bırakılınca danışman olunabilir.
 */
export const DANISMAN_OLAMAYAN_ROLLER: readonly RolKodu[] = [
  "OGRENCI",
  "MEZUN",
  "PAYDAS_TEMSILCISI",
  "PROJE_YONETICISI",
];

/**
 * Bu kişi danışmanlık görevini ALABİLİR mi? Saf fonksiyon; bırakma her zaman
 * serbesttir, bu yalnızca almayı sorar.
 *
 * Öğrenci profili ayrıca sorulur: rolü bir yanlışlıkla kapanmış bir öğrenci
 * hesabı, profili durdukça yine öğrencidir. Öğretmen profilinin VARLIĞI ise
 * işaret değildir — dış kullanıcı başvurusu da öğretmen profili açıyor.
 */
export function danismanlikAlabilirMi(girdi: {
  aktifRoller: readonly RolKodu[];
  ogrenciProfiliVarMi: boolean;
}): boolean {
  if (girdi.ogrenciProfiliVarMi) return false;
  return !girdi.aktifRoller.some((rol) => DANISMAN_OLAMAYAN_ROLLER.includes(rol));
}
