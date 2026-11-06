import type { SmsIletisi, SmsSaglayici } from "./tipler";

/**
 * Geliştirme sağlayıcısı: iletiyi göndermez, sunucu günlüğüne yazar.
 *
 * SMS'te yanlış yapılandırmanın bedeli e-postadan yüksek: ileti geri alınamaz,
 * ücretlidir ve alıcının çoğu 18 yaş altı. Bu yüzden varsayılan kapalıdır ve
 * "gunluk" kipi, gerçek gönderim yapılmadan akışın tamamının denenmesini
 * sağlar.
 */
export class GunlukSmsSaglayici implements SmsSaglayici {
  async gonder(ileti: SmsIletisi): Promise<void> {
    // Üretimde gövde yazılmaz (bkz. eposta/gunluk-saglayici.ts).
    const govde =
      process.env.NODE_ENV === "production"
        ? "(gövde üretimde günlüğe yazılmaz)"
        : ileti.govde;
    console.info(`[sms:gunluk] ${ileti.alici}\n${govde}`);
  }
}
