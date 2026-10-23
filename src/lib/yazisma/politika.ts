import { disKullaniciMi, projeYoneticisiMi } from "../yetki/izinler";
import type { OturumKullanicisi } from "../yetki/tipler";

/**
 * "BAĞLANTILARIM" KAPALI (23 Ekim 2026 · istekler: öğrenci, öğretmen ve
 * koordinatör sayfalarında "Bağlantılarım pasif").
 *
 * Açık kalanlar: proje yöneticisi ve dış kullanıcılar (mezun, paydaş, mentör);
 * onlar için istek gelmedi. Menüde satır pasif görünür; sayfa, yazışma detayı
 * ve mesaj/yazışma açma eylemleri kapanır. Veri silinmez: kural kaldırıldığında
 * eski yazışmalar olduğu gibi geri gelir.
 */
export function baglantilarimKapaliMi(kullanici: OturumKullanicisi): boolean {
  return !projeYoneticisiMi(kullanici) && !disKullaniciMi(kullanici);
}

export const BAGLANTILARIM_KAPALI_ACIKLAMASI = "Bağlantılarım şu an kapalı.";
