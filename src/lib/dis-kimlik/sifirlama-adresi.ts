/**
 * Parola sıfırlama bağlantısının host'unu seçer.
 *
 * NİYE VAR: bağlantının adresi istek başlıklarından türetilir (bkz.
 * app/sifre-sifirlama/eylemler.ts) ama `Host` ve `X-Forwarded-Host`
 * başlıklarını İSTEĞİ YAPAN belirler. Ters vekil bu başlığı ezmiyorsa,
 * saldırgan kurbanın adresi için sıfırlama isteyip başlığa kendi alan adını
 * yazabilir; kurban postasındaki bağlantıya tıkladığında jeton saldırganın
 * sunucusuna gider. Kural burada saf tutuluyor ki doğrudan sınanabilsin.
 */

/**
 * @param host İstek başlıklarından okunan host (güvenilmez).
 * @param izinliler Yapılandırmadaki host listesi; küçük harfli olduğu varsayılır
 *   (bkz. lib/ortam.ts · IZINLI_HOST_LISTESI).
 */
export function sifirlamaHostuSec(
  host: string,
  izinliler: readonly string[],
): string {
  /*
   * Liste boşsa doğrulama yapılmaz. Bu YALNIZCA geliştirmede olabilir:
   * üretimde IZINLI_HOSTLAR zorunludur ve eksikse uygulama hiç açılmaz
   * (bkz. lib/ortam.ts). Geliştirmede localhost'un portu sık değişir; her
   * değişiklikte yapılandırma güncellemek çalışmayı durdururdu.
   */
  if (izinliler.length === 0) return host;

  if (izinliler.includes(host.trim().toLowerCase())) return host;

  /*
   * Eşleşme yoksa İSTEK REDDEDİLMEZ, listedeki ilk host'a düşülür.
   *
   * Hata fırlatmak iki şeyi bozardı: (1) sıfırlama eyleminin sonucu her
   * durumda aynı olmalı, farklı davranış bu ekranı "hangi adres kayıtlı"
   * sorusuna cevap veren bir araca çevirir (bkz. eylemler.ts); (2) yanlış
   * yapılandırılmış bir vekil yüzünden başlık beklenmedik gelirse gerçek
   * kullanıcı şifresini hiç sıfırlayamazdı. Bu hâliyle bağlantı her zaman
   * doğru alan adını gösterir.
   */
  return izinliler[0];
}

/**
 * Sıfırlama bağlantısının şeması (30 Ekim 2026).
 *
 * `x-forwarded-proto` başlığına GÜVENİLMEZ: canlıda Apache bu başlığı
 * yazmıyor, Next.js de kendi iç bağlantısına bakıp "http" dolduruyor. Sonuç,
 * e-postadaki bağlantının http ile başlaması ve jetonun ilk açılışta
 * şifresiz gitmesiydi. Yerel geliştirme (localhost, 127.0.0.1, [::1]) dışında
 * bağlantı her zaman https'tir.
 */
export function sifirlamaSemasiSec(host: string): "http" | "https" {
  const ad = host.trim().toLowerCase().replace(/:\d+$/, "");
  return ["localhost", "127.0.0.1", "[::1]"].includes(ad) ? "http" : "https";
}
