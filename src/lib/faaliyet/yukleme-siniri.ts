import { paylasilanHizSiniri } from "../hiz-siniri";
import { YUKLEME_PENCERE_DAKIKA, YUKLEME_SINIRI } from "./ek-kurallar";

/**
 * Kullanıcı başına dosya yükleme sayacı — etkinlik eki, rapor görseli ve
 * kazanım eki hepsi aynı kovayı paylaşır (bkz. ek-kurallar.ts · gerekçe).
 *
 * Anahtar kullanıcı kimliği, IP değil: yükleme oturum isteyen bir iş ve
 * aynı okul ağındaki (NAT) öğretmenler birbirinin hakkını tüketmemeli.
 */
const yuklemeSiniri = paylasilanHizSiniri({
  kova: "dosya-yukleme",
  pencereMs: YUKLEME_PENCERE_DAKIKA * 60_000,
  sinir: YUKLEME_SINIRI,
});

export function yuklemeSiniriniAstiMi(kullaniciId: number): Promise<boolean> {
  return yuklemeSiniri.takildiMi(`kullanici:${kullaniciId}`);
}
