/**
 * GÜNCELLEME SONRASI KENDİLİĞİNDEN YENİLEME (31 Ekim 2026).
 *
 * Canlıda görülen: sunucu güncellendiğinde sayfası açık kalan kullanıcının
 * tarayıcısı, yeni derlemede artık bulunmayan eski parçaları (chunk) ya da
 * eski sunucu eylemlerini istiyor; sayfa "Beklenmeyen bir hata" ekranına
 * düşüyor ve kişi yenileyene kadar çalışmıyor. Hata günlüğünde bugün dört kez
 * "Failed to load chunk …" görüldü.
 *
 * Bu hatalar kodda değil, SÜRÜM FARKINDA: yapılacak tek doğru şey sayfayı
 * yeni sürümle yeniden yüklemek. Hata ekranı bunu kendisi yapar. Döngüye
 * girmemek için oturumda 30 saniyede en fazla bir yenileme yapılır; ikinci
 * kez aynı hata gelirse olağan hata ekranı ve bildirimi devreye girer.
 */

const SURUM_HATASI =
  /Failed to load chunk|Loading chunk [\w-]+ failed|ChunkLoadError|Failed to fetch dynamically imported module|Importing a module script failed|Server Action .* was not found|Failed to find Server Action/i;

const ANAHTAR = "genctek-surum-yenileme";
const ARALIK_MS = 30_000;

/** Hata, eski sürümle yeni sunucu arasındaki farktan mı kaynaklanıyor? */
export function surumHatasiMi(hata: { name?: string; message?: string }): boolean {
  return (
    hata.name === "ChunkLoadError" || SURUM_HATASI.test(hata.message ?? "")
  );
}

/**
 * Sayfayı bir kez yeniler. Yeniledi ise `true` döner (çağıran bildirim
 * yapmasın); kısa süre önce zaten yenilendiyse `false`.
 */
export function surumIcinYenile(): boolean {
  try {
    const son = Number(sessionStorage.getItem(ANAHTAR) ?? "0");
    if (Date.now() - son < ARALIK_MS) return false;
    sessionStorage.setItem(ANAHTAR, String(Date.now()));
  } catch {
    // Depolama kapalıysa (gizli pencere vb.) son yenileme bilinemez; döngü
    // riskine girmemek için yenilenmez, olağan hata ekranı gösterilir.
    return false;
  }
  window.location.reload();
  return true;
}
