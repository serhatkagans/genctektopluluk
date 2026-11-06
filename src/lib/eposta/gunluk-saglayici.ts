import type { EpostaIletisi, EpostaSaglayici } from "./tipler";

/**
 * Geliştirme sağlayıcısı: iletiyi göndermez, sunucu günlüğüne yazar.
 *
 * Varsayılan budur. Yanlışlıkla gerçek öğrencilere posta gitmesindense hiç
 * gitmemesi yeğdir; SMTP bilgisi girilene kadar sistem bu kipte çalışır ve
 * akışın geri kalanı (bildirim kaydı, durum alanı) gerçek gönderimdeki gibi
 * işler.
 */
export class GunlukEpostaSaglayici implements EpostaSaglayici {
  async gonder(ileti: EpostaIletisi): Promise<void> {
    /*
     * ÜRETİMDE GÖVDE YAZILMAZ (6 Kasım 2026 · güvenlik incelemesi). Gövde
     * şifre sıfırlama bağlantısını jetonuyla taşıyor; SMTP ayarı unutulmuş bir
     * sunucuda günlüğü okuyabilen herkes herhangi bir hesabın şifresini
     * sıfırlayabilirdi. Üretimde yalnızca alıcı ve konu kalır.
     */
    const govde =
      process.env.NODE_ENV === "production"
        ? "(gövde üretimde günlüğe yazılmaz)"
        : ileti.govde;
    console.info(`[eposta:gunluk] ${ileti.alici} · ${ileti.konu}\n${govde}`);
  }
}
