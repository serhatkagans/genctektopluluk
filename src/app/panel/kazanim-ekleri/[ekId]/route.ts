import { oturumKullanicisi } from "@/lib/auth/oturum";
import { prisma } from "@/lib/db";
import { depolama } from "@/lib/depolama";
import { urunVitrindeMi } from "@/lib/market/kurallar";
import {
  ogrenciKapsamFiltresi,
  ogretmenKapsamFiltresi,
} from "@/lib/yetki/kapsam";
import { erisimLogla } from "@/lib/yetki/log";

export const dynamic = "force-dynamic";

/**
 * Kazanım kaydının destekleyici belgesini indirir.
 *
 * Dosya public bir dizinden servis EDİLMEZ: her istek önce oturumdan, sonra
 * KAYIT SAHİBİNİN kapsam filtresinden geçer. Görünürlük kuralı kaydın kendisiyle
 * aynıdır — kazanımı görebilen belgesini de görür, göremeyen ikisini de göremez.
 *
 * İki filtre birden deneniyor çünkü kazanım kaydı öğrencide de öğretmende de
 * var; sahibin hangisi olduğunu bilmeden tek filtreye sormak, öğretmenin
 * belgesini kimseye açmamak (ya da tersi) demekti.
 *
 * Kapsam dışında 403 değil 404 döner — kaydın varlığı sızmasın
 * (references/permissions.md Bölüm 4).
 */
export async function GET(
  _istek: Request,
  { params }: { params: Promise<{ ekId: string }> },
) {
  const { ekId } = await params;

  const kullanici = await oturumKullanicisi();
  if (!kullanici) {
    return new Response("Bulunamadı", { status: 404 });
  }

  const id = Number.parseInt(ekId, 10);
  if (!Number.isInteger(id)) {
    return new Response("Bulunamadı", { status: 404 });
  }

  const ek = await prisma.kazanimEk.findUnique({
    where: { id },
    select: {
      id: true,
      dosyaAdi: true,
      depolamaYolu: true,
      mimeTipi: true,
      kazanim: {
        select: {
          kullaniciId: true,
          tip: true,
          markettePaylasilsin: true,
          marketOnayDurumu: true,
        },
      },
    },
  });
  if (!ek) {
    return new Response("Bulunamadı", { status: 404 });
  }

  const sahipId = ek.kazanim.kullaniciId;

  /*
   * MARKETTE PAYLAŞILAN ÜRÜNÜN GÖRSELİ KAPSAM FİLTRESİNDEN MUAFTIR (I).
   *
   * Kapsam filtresi "bu kişinin kaydını görebilir misin" diye sorar ve iki
   * öğrenci birbirini göremez. Markette paylaşılan ürünün görselinde bu kural
   * yanlış sonuç veriyordu: ürün vitrinde herkese açıkken görselleri yalnızca
   * sahibine ve danışmanına yükleniyor, herkes için kırık resim görünüyordu.
   *
   * Muafiyetin dayanağı SAHİBİNİN AÇIK TERCİHİ: "Bu ürünü markette paylaş"
   * kutusu varsayılan olarak KAPALI ve işaretlemek, kaydı ekosisteme açmak
   * demek (bkz. D5). Paylaşım kapatıldığı anda görsel de yeniden kapanır.
   *
   * Muafiyet DARDIR — yalnızca tip=URUN ve yalnızca paylaşım açıkken. Diğer
   * kazanım tiplerinin (sertifika, ürün olmayan kayıtlar) ekleri eskisi gibi
   * kapsam filtresine tabidir; sertifikanın görseli kimseye açılmaz.
   *
   * VİTRİN KURALIYLA AYNI (6 Kasım 2026 · güvenlik incelemesi): yalnızca
   * "paylaşılsın" kutusu soruluyordu; onay bekleyen ya da REDDEDİLEN ürünün
   * dosyaları da herkese iniyordu. Artık vitrinde görünmeyen ürünün dosyası da
   * görünmez. Onay verecek proje yöneticisi kapsam filtresinden zaten geçer.
   */
  const markettePaylasilanUrun =
    ek.kazanim.tip === "URUN" && urunVitrindeMi(ek.kazanim);

  if (sahipId !== kullanici.id && !markettePaylasilanUrun) {
    const gorunur = await prisma.kullanici.findFirst({
      where: {
        OR: [
          { AND: [{ id: sahipId }, ogrenciKapsamFiltresi(kullanici)] },
          { AND: [{ id: sahipId }, ogretmenKapsamFiltresi(kullanici)] },
        ],
      },
      select: { id: true },
    });
    if (!gorunur) {
      return new Response("Bulunamadı", { status: 404 });
    }
  }

  let icerik: Buffer;
  try {
    icerik = await depolama().oku(ek.depolamaYolu);
  } catch {
    // Kayıt var ama dosya yok: 500 yerine 404 daha dürüst bir cevap.
    return new Response("Bulunamadı", { status: 404 });
  }

  await erisimLogla({
    kullaniciId: kullanici.id,
    islem: "GORUNTULEME",
    hedefTip: "PROFIL",
    hedefId: sahipId,
    detay: `Kazanım belgesi indirildi: ${ek.dosyaAdi}`,
  });

  return new Response(new Uint8Array(icerik), {
    headers: {
      "Content-Type": ek.mimeTipi,
      // Dosya adı ASCII dışı karakter içerebilir; RFC 5987 biçimi kullanılır.
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(ek.dosyaAdi)}`,
      "Content-Length": String(icerik.byteLength),
      // Kapsam kontrolünden geçen içerik ara belleklerde tutulmamalı.
      "Cache-Control": "private, no-store",
    },
  });
}
