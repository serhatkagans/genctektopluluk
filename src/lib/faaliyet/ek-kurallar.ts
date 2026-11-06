/**
 * Faaliyet eki (dosya/görsel) kabul kuralları — references/domain-rules.md
 * Bölüm 7.
 *
 * Saf tutulur: dosya sistemine ve veritabanına gitmez, sınırlar parametre
 * olarak gelir. Sınırların kendisi `sistem_ayari` tablosundadır, koda gömülmez
 * (proje yöneticisi değiştirebilmeli).
 */

export type EkTuru = "GORSEL" | "BELGE";

export interface EkSinirlari {
  izinliGorselTipleri: string[];
  izinliBelgeTipleri: string[];
  gorselMaksBayt: number;
  belgeMaksBayt: number;
}

export function ekTuruBelirle(
  mimeTipi: string,
  sinirlar: EkSinirlari,
): EkTuru | null {
  if (sinirlar.izinliGorselTipleri.includes(mimeTipi)) return "GORSEL";
  if (sinirlar.izinliBelgeTipleri.includes(mimeTipi)) return "BELGE";
  return null;
}

function megabayt(bayt: number): string {
  return `${(bayt / (1024 * 1024)).toFixed(0)} MB`;
}

/**
 * Tip ve boyut kontrolü. İzin verilmeyen dosya sessizce yutulmaz, açık gerekçe
 * döner (kenar durum: "izin verilmeyen dosya tipi/boyutu → açık hata mesajı").
 */
export function ekKabulEdilirMi(
  dosya: { mimeTipi: string; boyutBayt: number; dosyaAdi: string },
  sinirlar: EkSinirlari,
): { olurMu: boolean; neden?: string; tur?: EkTuru } {
  if (!dosya.dosyaAdi.trim()) {
    return { olurMu: false, neden: "Dosya seçilmedi." };
  }
  if (dosya.boyutBayt <= 0) {
    return { olurMu: false, neden: "Boş dosya yüklenemez." };
  }

  const tur = ekTuruBelirle(dosya.mimeTipi, sinirlar);
  if (!tur) {
    const izinliler = [
      ...sinirlar.izinliGorselTipleri,
      ...sinirlar.izinliBelgeTipleri,
    ].join(", ");
    return {
      olurMu: false,
      neden: `"${dosya.mimeTipi}" tipinde dosya yüklenemez. İzin verilenler: ${izinliler}`,
    };
  }

  const sinir =
    tur === "GORSEL" ? sinirlar.gorselMaksBayt : sinirlar.belgeMaksBayt;
  if (dosya.boyutBayt > sinir) {
    return {
      olurMu: false,
      neden: `Dosya ${megabayt(dosya.boyutBayt)} boyutunda; ${
        tur === "GORSEL" ? "görsel" : "belge"
      } için üst sınır ${megabayt(sinir)}.`,
    };
  }

  return { olurMu: true, tur };
}

/** Yorum içeriği boş olamaz (veritabanı kısıtıyla da korunur). */
export function yorumKabulEdilirMi(icerik: string): {
  olurMu: boolean;
  neden?: string;
} {
  const kirpilmis = icerik.trim();
  if (!kirpilmis) return { olurMu: false, neden: "Yorum boş olamaz." };
  if (kirpilmis.length > 2000) {
    return { olurMu: false, neden: "Yorum en fazla 2000 karakter olabilir." };
  }
  return { olurMu: true };
}

/*
 * ADET VE HIZ SINIRLARI (6 Kasım 2026 · güvenlik incelemesi).
 *
 * Yalnızca dosya başına boyut sınırı vardı. Yetkili bir hesap (öğrenci de,
 * kendi kazanımına) betikle binlerce dosya yükleyip sunucu diskini
 * doldurabiliyordu; disk başka uygulamalarla ortak. Kayıt başına adet tavanı
 * ve kullanıcı başına saatlik yükleme sınırı bu yolu kapatıyor.
 *
 * Değerler gerçek kullanımın rahat üstünde: bir etkinliğe tipik olarak on beş
 * kadar fotoğraf yükleniyor.
 */
export const FAALIYET_MAKS_EK = 50;
export const KAZANIM_MAKS_EK = 20;
export const YUKLEME_PENCERE_DAKIKA = 60;
export const YUKLEME_SINIRI = 100;

/** Kayda bir ek daha eklenebilir mi? */
export function ekAdediUygunMu(
  mevcutAdet: number,
  tavan: number,
): { olurMu: boolean; neden?: string } {
  if (mevcutAdet >= tavan) {
    return {
      olurMu: false,
      neden: `Bu kayda en fazla ${tavan} dosya eklenebilir. Yenisini eklemek için önce eskilerden birini silin.`,
    };
  }
  return { olurMu: true };
}

export const YUKLEME_SINIRI_MESAJI = `Kısa sürede çok fazla dosya yüklendi. Bir süre sonra tekrar deneyin (saatte en fazla ${YUKLEME_SINIRI} dosya).`;
