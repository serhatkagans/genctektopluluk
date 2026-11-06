import { prisma } from "../db";
import { depolama } from "../depolama";
import {
  KAZANIM_MAKS_EK,
  YUKLEME_SINIRI_MESAJI,
  ekAdediUygunMu,
  ekKabulEdilirMi,
  type EkSinirlari,
} from "../faaliyet/ek-kurallar";
import { yuklemeSiniriniAstiMi } from "../faaliyet/yukleme-siniri";
import { ekSinirlariniGetir } from "../faaliyet/ek-kaydet";
import { dosyaImzasiUyuyorMu } from "../guvenlik/dosya-imzasi";
import { gorselMi } from "./kapak";

/**
 * Kazanım kaydının destekleyici belgeleri — "etkinliğe dair fotoğraf, belge".
 *
 * SINIRLAR FAALİYET EKİYLE ORTAKTIR (`IZINLI_GORSEL_TIPLERI`,
 * `IZINLI_BELGE_TIPLERI`, `GORSEL_MAKS_BAYT`, `BELGE_MAKS_BAYT`). Bu bilinçli:
 * ikisi de aynı türde içerik taşıyor — bir etkinliğin fotoğrafı ve belgesi.
 * CV'nin ayrı sınırları olmasının sebebi tür farkıydı (orada doc/docx kabul
 * ediliyor, burada edilmiyor); burada öyle bir fark yok. Ayrışırlarsa
 * yapılacak tek şey bu dosyaya kendi ayar anahtarlarını vermektir.
 *
 * Yetki kontrolü BURADA YAPILMAZ; çağıranın işidir. Bu dosya yalnızca "kural
 * uygunsa depola ve kaydet" adımını tek yerde tutar.
 */

export async function kazanimEkSinirlariniGetir(): Promise<EkSinirlari> {
  return ekSinirlariniGetir();
}

export interface KazanimEkSonucu {
  olurMu: boolean;
  neden?: string;
  ekId?: number;
}

export async function kazanimEkiKaydet(girdi: {
  kazanimId: number;
  dosya: File;
  sinirlar: EkSinirlari;
  /** Ürün kapağı olarak yüklendiyse true (bkz. lib/kazanim/kapak.ts). */
  kapakMi?: boolean;
}): Promise<KazanimEkSonucu> {
  const { dosya } = girdi;

  const karar = ekKabulEdilirMi(
    { mimeTipi: dosya.type, boyutBayt: dosya.size, dosyaAdi: dosya.name },
    girdi.sinirlar,
  );
  if (!karar.olurMu) return { olurMu: false, neden: karar.neden };

  // Adet ve hız sınırı — disk doldurmaya karşı (bkz. faaliyet/ek-kurallar.ts).
  const kazanim = await prisma.kullaniciKazanim.findUnique({
    where: { id: girdi.kazanimId },
    select: { kullaniciId: true, _count: { select: { ekler: true } } },
  });
  if (!kazanim) return { olurMu: false, neden: "Kayıt bulunamadı." };
  const adet = ekAdediUygunMu(kazanim._count.ekler, KAZANIM_MAKS_EK);
  if (!adet.olurMu) return { olurMu: false, neden: adet.neden };
  if (await yuklemeSiniriniAstiMi(kazanim.kullaniciId)) {
    return { olurMu: false, neden: YUKLEME_SINIRI_MESAJI };
  }

  /*
   * Kapak yalnızca GÖRSEL olabilir. Alan `accept="image/*"` ile basılıyor ama
   * o yalnızca dosya seçicinin süzgeci; elle gönderilen bir istek pdf'i kapak
   * diye işaretleyebilirdi ve vitrin kartı kırık resim gösterirdi.
   */
  const kapakMi = girdi.kapakMi === true && gorselMi(dosya.type);

  /* İçerik iddia edilen tiple uyuşmalı — gerekçe: guvenlik/dosya-imzasi.ts. */
  const icerik = Buffer.from(await dosya.arrayBuffer());
  const imza = dosyaImzasiUyuyorMu(icerik, dosya.type);
  if (!imza.olurMu) return { olurMu: false, neden: imza.neden };

  const anahtar = await depolama().yaz({
    icerik,
    dosyaAdi: dosya.name,
    mimeTipi: dosya.type,
  });

  const ek = await prisma.kazanimEk.create({
    data: {
      kazanimId: girdi.kazanimId,
      dosyaAdi: dosya.name.slice(0, 255),
      depolamaYolu: anahtar,
      mimeTipi: dosya.type,
      boyutBayt: BigInt(dosya.size),
      kapakMi,
    },
    select: { id: true },
  });

  /* Yeni kapak geldiyse eskisinin işareti düşer: kazanım başına tek kapak. */
  if (kapakMi) {
    await prisma.kazanimEk.updateMany({
      where: { kazanimId: girdi.kazanimId, kapakMi: true, id: { not: ek.id } },
      data: { kapakMi: false },
    });
  }

  return { olurMu: true, ekId: ek.id };
}

/**
 * Birden çok dosyayı sırayla kaydeder ve İLK hatada durur.
 *
 * Kayıt oluşturulduktan SONRA çağrıldığı için hata dosyaları düşürür ama
 * kazanım kaydını iptal etmez: kullanıcı yazdığı metni kaybetmesin, eksik
 * dosyayı sonradan ekleyebilsin. Çağıran, dönen uyarıyı ekranda göstermeli.
 */
export async function kazanimEkleriniKaydet(girdi: {
  kazanimId: number;
  dosyalar: File[];
  sinirlar: EkSinirlari;
}): Promise<{ eklenen: number; uyari?: string }> {
  let eklenen = 0;

  for (const dosya of girdi.dosyalar) {
    const sonuc = await kazanimEkiKaydet({
      kazanimId: girdi.kazanimId,
      dosya,
      sinirlar: girdi.sinirlar,
    });
    if (!sonuc.olurMu) {
      return { eklenen, uyari: `${dosya.name}: ${sonuc.neden}` };
    }
    eklenen += 1;
  }

  return { eklenen };
}

/**
 * Eki siler — hem veritabanından hem depolamadan.
 *
 * Sahiplik kontrolü sorgunun İÇİNDE: `kazanim.kullaniciId` koşulu olmadan,
 * forma başkasının ek kimliğini yazan kullanıcı o dosyayı silebilirdi.
 * Depolamadaki dosya satır silindikten SONRA kaldırılır; sıra tersine
 * çevrilseydi silme yarıda kaldığında kayıt var, dosya yok durumu doğardı.
 */
export async function kazanimEkiSil(girdi: {
  ekId: number;
  kullaniciId: number;
}): Promise<{ silindiMi: boolean; dosyaAdi?: string }> {
  const ek = await prisma.kazanimEk.findFirst({
    where: { id: girdi.ekId, kazanim: { kullaniciId: girdi.kullaniciId } },
    select: { id: true, dosyaAdi: true, depolamaYolu: true },
  });
  if (!ek) return { silindiMi: false };

  await prisma.kazanimEk.delete({ where: { id: ek.id } });

  try {
    await depolama().sil(ek.depolamaYolu);
  } catch {
    // Dosya zaten yoksa ya da depolama yanıt vermiyorsa işlem geri alınmaz:
    // kullanıcı açısından ek kalkmıştır. Artık dosya, saklama bakımında düşer.
  }

  return { silindiMi: true, dosyaAdi: ek.dosyaAdi };
}
