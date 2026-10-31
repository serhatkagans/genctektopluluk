import type { Prisma } from "@/generated/prisma/client";

/**
 * SUNUCU TARAFI ÇİFT KAYIT ENGELİ (31 Ekim 2026 · istek: "takılınca bir daha
 * tıklamışım, 3 kere eklemiş").
 *
 * Tarayıcıdaki kalkan (components/CiftGonderimKalkani.tsx) ikinci tıklamayı
 * çoğu zaman keser ama tek güvence olamaz: iki sekme, sayfa yenileme ya da
 * kalkan yüklenmeden gelen tıklama yine iki istek gönderir.
 *
 * Akış: aynı kullanıcının aynı türdeki kayıt işlemleri bir veritabanı
 * kilidiyle SIRAYA sokulur, sonra "aynı kayıt az önce açıldı mı" bakılır.
 * Kilit olmadan aynı anda gelen iki istek ikisi de "yok" görüp ikisi de
 * yazardı.
 */

/** Aynı içeriğin tekrarı sayılacağı süre. */
export const CIFT_KAYIT_PENCERESI_MS = 2 * 60 * 1000;

/** Kilit ad alanları — farklı işlemler birbirini beklemesin. */
export const CIFT_KAYIT_ALANI = {
  FAALIYET: 7101,
  KAZANIM: 7102,
} as const;

/**
 * Transaction sonuna kadar süren, kullanıcıya özel kilidi alır.
 * Transaction bitince kendiliğinden kalkar.
 */
export async function kullaniciKilidiAl(
  islem: Prisma.TransactionClient,
  alan: (typeof CIFT_KAYIT_ALANI)[keyof typeof CIFT_KAYIT_ALANI],
  kullaniciId: number,
): Promise<void> {
  await islem.$queryRaw`SELECT 1 AS kilit FROM pg_advisory_xact_lock(${alan}::int, ${kullaniciId}::int)`;
}

/** Penceredeki en eski kabul edilen oluşturma anı. */
export function ciftKayitSiniri(simdi: Date = new Date()): Date {
  return new Date(simdi.getTime() - CIFT_KAYIT_PENCERESI_MS);
}
