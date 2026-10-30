import type { GonderimDurumu } from "@/generated/prisma/enums";
import { prisma } from "../db";
import { eposta, epostaEtkinMi } from "../eposta";

/**
 * Panel bildiriminin e-posta kopyası.
 *
 * İki kural bu dosyanın tamamını açıklar:
 *
 * 1. E-posta ASLA iş akışını kesmez. Posta sunucusu erişilemezse başvuru
 *    değerlendirmesi ya da danışman devri yarıda kalmamalı; bildirim zaten
 *    panele yazıldı, bilgi kaybolmadı.
 * 2. Başarısızlık sessizce yutulmaz. Sonuç bildirim kaydına işlenir; "e-posta
 *    gelmedi" şikâyetinde hiç denenmediği mi yoksa sunucudan mı döndüğü
 *    ayırt edilebilir.
 */

/** Kişinin bildirim adresini iki profil tablosundan hangisindeyse getirir. */
export async function bildirimAdresiGetir(
  kullaniciId: number,
): Promise<string | null> {
  const kayit = await prisma.kullanici.findUnique({
    where: { id: kullaniciId },
    select: {
      ogrenciProfil: { select: { eposta: true } },
      ogretmenProfil: { select: { eposta: true } },
      kayitKimlik: { select: { eposta: true } },
    },
  });

  const adres =
    kayit?.ogrenciProfil?.eposta ??
    kayit?.ogretmenProfil?.eposta ??
    kayit?.kayitKimlik?.eposta ??
    null;

  return adres?.trim() ? adres.trim() : null;
}

interface KopyaIstegi {
  bildirimId: number;
  kullaniciId: number;
  baslik: string;
  icerik: string;
}

export async function epostaKopyasiGonder(istek: KopyaIstegi): Promise<void> {
  if (!epostaEtkinMi()) return;

  const adres = await bildirimAdresiGetir(istek.kullaniciId);
  // Adres yok: hata değil. İletişim bilgisi zorunlu değildir ve olmaması
  // kişinin tercihidir.
  if (!adres) return;

  let durum: GonderimDurumu = "GONDERILDI";
  let hataMetni: string | null = null;

  try {
    await eposta().gonder({
      alici: adres,
      konu: istek.baslik,
      govde: `${istek.icerik}\n\nBu ileti GençTek Bilgi Sistemi tarafından gönderildi. Ayrıntı için panelinize giriş yapın.`,
    });
  } catch (hata) {
    durum = "BASARISIZ";
    hataMetni = hata instanceof Error ? hata.message : String(hata);
    console.error(`E-posta gönderilemedi (bildirim ${istek.bildirimId}):`, hata);
  }

  await prisma.bildirim.update({
    where: { id: istek.bildirimId },
    data: { epostaDurumu: durum, epostaHatasi: hataMetni },
  });
}
