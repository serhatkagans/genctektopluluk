import type { OnayDurumu } from "@/generated/prisma/enums";

/**
 * GENÇTEK GÖREVLERİ — başvuru ve karar kuralları (21 Ağustos 2026).
 *
 * İstek: "Panoda yeni kart GençTek Görevlerim isminde kart olsun, içinde
 * başvur butonları olacak … yönetim panelinde yeni kart gençtek görevlerini
 * görebilsin."
 *
 * Bu dosya veritabanına BAKMAZ: kararı veren saf fonksiyonlar burada, verinin
 * okunduğu yer eylemlerde (app/panel/genctek-gorevleri/eylemler.ts). Ayrım,
 * kuralların birim testle doğrulanabilmesi için.
 */

/** Başvuru metninin üst sınırı — kararın dayanağı bu metin. */
export const GOREV_MESAJI_AZAMI = 1000;

export const GOREV_DURUM_ETIKETLERI: Record<OnayDurumu, string> = {
  ONAY_GEREKMEZ: "Onay gerekmez",
  BEKLIYOR: "Onay bekliyor",
  ONAYLANDI: "Görevdesiniz",
  REDDEDILDI: "Reddedildi",
};

export const GOREV_DURUM_SINIFLARI: Record<OnayDurumu, string> = {
  ONAY_GEREKMEZ: "bg-zemin text-metin-yumusak",
  BEKLIYOR: "bg-uyari-zemin text-uyari-metin",
  ONAYLANDI: "bg-olumlu-zemin text-olumlu-metin",
  REDDEDILDI: "bg-hata-zemin text-hata-metin",
};

export type BasvuruSonucu =
  | { olurMu: true; mesaj: string }
  | { olurMu: false; neden: string };

/**
 * Başvurunun kabul edilip edilmeyeceği.
 *
 * MESAJ ZORUNLU: kararı verecek kişi, başvuranın kendini anlattığı metinden
 * başka hiçbir şeye bakmıyor. Boş bir başvuru, "bu kişiyi neden alalım"
 * sorusunu cevapsız bırakır ve kuyruğu karar verilemez satırlarla doldurur.
 *
 * KAPALI GÖREVE BAŞVURULMAZ: kapatılan görev listede görünür ama formu
 * basılmaz; kimliğini elle yazan biri için de fiilen açık kalmamalı.
 *
 * KONTENJAN DOLUYSA BAŞVURU ALINMAZ. Ölçüt ONAYLANMIŞ başvurulardır, bekleyen
 * değil: bekleyenleri saymak, kararı verilmemiş başvuruların yeni başvuruyu
 * engellemesi demek olurdu — merkez hepsini reddetse bile görev kapalı
 * görünürdü.
 */
export function gorevBasvurusuKabulEdilirMi(girdi: {
  gorevAktifMi: boolean;
  kontenjan: number | null;
  onayliBasvuruSayisi: number;
  mesaj: string;
  /** Kişinin bu görevde KARAR BEKLEYEN başvurusu var mı? */
  bekleyenBasvurusuVarMi: boolean;
  /** Kişi bu göreve zaten kabul edilmiş mi? */
  zatenGorevliMi: boolean;
}): BasvuruSonucu {
  if (!girdi.gorevAktifMi) {
    return { olurMu: false, neden: "Bu görev başvuruya kapalı." };
  }
  if (girdi.zatenGorevliMi) {
    return { olurMu: false, neden: "Bu görevde zaten yer alıyorsunuz." };
  }
  if (girdi.bekleyenBasvurusuVarMi) {
    return {
      olurMu: false,
      neden: "Bu göreve yaptığınız başvuru zaten karar bekliyor.",
    };
  }
  if (
    girdi.kontenjan !== null &&
    girdi.onayliBasvuruSayisi >= girdi.kontenjan
  ) {
    return { olurMu: false, neden: "Bu görevin kontenjanı doldu." };
  }

  const mesaj = girdi.mesaj.trim();
  if (!mesaj) {
    return {
      olurMu: false,
      neden:
        "Neden bu görevde yer almak istediğinizi yazın; başvurunuz buna göre değerlendirilecek.",
    };
  }
  if (mesaj.length > GOREV_MESAJI_AZAMI) {
    return {
      olurMu: false,
      neden: `Başvuru metni en fazla ${GOREV_MESAJI_AZAMI} karakter olabilir.`,
    };
  }

  return { olurMu: true, mesaj };
}

export type KararSonucu =
  | { olurMu: true; durum: OnayDurumu; gerekce: string | null }
  | { olurMu: false; neden: string };

/**
 * Onay/ret kararının geçerliliği.
 *
 * YALNIZCA BEKLEYEN bir başvuru karara bağlanabilir: karara bağlanmış bir
 * kaydı ikinci kez onaylamak sessizce karar tarihini kaydırır ve "ne zaman
 * karar verildi" sorusunun cevabını bozar.
 *
 * KİMSE KENDİ BAŞVURUSUNU KARARA BAĞLAYAMAZ. Proje yöneticisi de göreve
 * başvurabiliyor; yetki listesi "kim karar verebilir" sorusunu cevaplıyor, bu
 * koşul "kendi işini onaylayamaz" ilkesini — ikisi ayrı sorular ve ikisi de
 * gerekli (aynı ayrım mentörlük ve etkinlik onayında da var).
 *
 * RET GEREKÇESİ ZORUNLU: gerekçesiz ret, kişiye tekrar başvururken neyi
 * düzelteceğini söylemez.
 */
export function gorevKarariGecerliMi(girdi: {
  mevcutDurum: OnayDurumu;
  onaylandiMi: boolean;
  gerekce: string;
  kendiBasvurusuMu: boolean;
}): KararSonucu {
  if (girdi.kendiBasvurusuMu) {
    return {
      olurMu: false,
      neden:
        "Kendi görev başvurunuzu karara bağlayamazsınız; kararı bir proje yöneticisi meslektaşınız versin.",
    };
  }
  if (girdi.mevcutDurum !== "BEKLIYOR") {
    return { olurMu: false, neden: "Bu başvurunun kararı zaten verilmiş." };
  }

  const gerekce = girdi.gerekce.trim();
  if (girdi.onaylandiMi) {
    return { olurMu: true, durum: "ONAYLANDI", gerekce: gerekce || null };
  }
  if (!gerekce) {
    return {
      olurMu: false,
      neden: "Ret gerekçesi zorunludur: başvuran nedenini görmeli.",
    };
  }
  return { olurMu: true, durum: "REDDEDILDI", gerekce };
}

export type GorevSonucu =
  | { olurMu: true; ad: string; aciklama: string; kontenjan: number | null }
  | { olurMu: false; neden: string };

/**
 * Yeni görev ilanının geçerliliği (Yönetim Paneli).
 *
 * AÇIKLAMA ZORUNLU: panoda yalnızca başlık gösteren bir kart, kişiye neye
 * başvurduğunu söylemez. Kontenjan isteğe bağlı — sınırsız görev de var.
 */
export function gorevTanimiGecerliMi(girdi: {
  ad: string;
  aciklama: string;
  kontenjan: string;
}): GorevSonucu {
  const ad = girdi.ad.trim();
  const aciklama = girdi.aciklama.trim();

  if (!ad || !aciklama) {
    return { olurMu: false, neden: "Görev adı ve açıklaması zorunludur." };
  }
  if (ad.length > 200) {
    return { olurMu: false, neden: "Görev adı en fazla 200 karakter olabilir." };
  }

  const kontenjanMetni = girdi.kontenjan.trim();
  if (!kontenjanMetni) {
    return { olurMu: true, ad, aciklama, kontenjan: null };
  }

  const kontenjan = Number.parseInt(kontenjanMetni, 10);
  if (!Number.isInteger(kontenjan) || kontenjan < 1) {
    return {
      olurMu: false,
      neden: "Kontenjan boş bırakılabilir ya da 1'den büyük bir sayı olmalıdır.",
    };
  }

  return { olurMu: true, ad, aciklama, kontenjan };
}
