/**
 * Yalnızca geliştirmede çalışması gereken örnek veri betiklerinin kilidi
 * (6 Kasım 2026 · güvenlik incelemesi).
 *
 * Betikler `dotenv/config` ile çalıştıkları dizindeki `.env`'i okur; sunucuda
 * yanlışlıkla çalıştırılırsa canlı veritabanına yazarlar. `veri:dis-kullanici`
 * örneğin depoda açıkça yazılı bir şifreyle onaylı üç hesap açıyordu.
 *
 * Kip mock değilse ya da NODE_ENV production ise betik durur. Bilerek
 * çalıştırmak gerekiyorsa `--canli-veritabanina-yaz` bayrağı verilir.
 */
export function uretimdeDur(betikAdi: string): void {
  const kip = process.env.AUTH_PROVIDER ?? "mock";
  const uretimMi = process.env.NODE_ENV === "production" || kip !== "mock";
  if (!uretimMi || process.argv.includes("--canli-veritabanina-yaz")) return;

  console.error(
    `${betikAdi} yalnızca geliştirme içindir (AUTH_PROVIDER="${kip}", NODE_ENV="${process.env.NODE_ENV ?? ""}").\n` +
      "Bu veritabanına örnek veri yazılmadı. Bilerek yazmak için: -- --canli-veritabanina-yaz",
  );
  process.exit(1);
}
