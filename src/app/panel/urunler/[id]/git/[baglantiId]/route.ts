import { oturumKullanicisi } from "@/lib/auth/oturum";
import { prisma } from "@/lib/db";
import { baglantiGecerliMi } from "@/lib/kazanim/kurallar";
import { urunGorunurMu } from "@/lib/market/kurallar";
import { urunMarketOnayiVerebilirMi } from "@/lib/yetki/izinler";

export const dynamic = "force-dynamic";

/**
 * Ürün bağlantısına giderken sayacı artıran ara durak (I).
 *
 * NEDEN ARA DURAK VAR. "Bağlantı ziyareti" sayacı ancak sunucudan geçen bir
 * istekle artabilir; kullanıcı sayfadan dış adrese doğrudan giderse tarayıcı
 * sunucuya haber vermez ve sayaç hiç işlemezdi.
 *
 * NEDEN AÇIK YÖNLENDİRİCİ DEĞİL. Adres istekten OKUNMUYOR, veritabanındaki
 * satırdan geliyor: yalnızca ürünün kendi kayıtlı bağlantılarına gidilebilir.
 * Adres parametre olarak alınsaydı bu yol, GençTek alan adının arkasına
 * gizlenmiş bir açık yönlendirici (open redirect) olurdu — oltalama
 * bağlantıları için birebir malzeme.
 *
 * KAPSAM: ürünü göremeyen kişi bağlantısına da gidemez. Paylaşılmamış ürünün
 * bağlantısını yalnızca sahibi açabilir.
 */
export async function GET(
  _istek: Request,
  { params }: { params: Promise<{ id: string; baglantiId: string }> },
) {
  const { id: hamId, baglantiId: hamBaglantiId } = await params;

  const kullanici = await oturumKullanicisi();
  if (!kullanici) return new Response("Bulunamadı", { status: 404 });

  const urunId = Number.parseInt(hamId, 10);
  const baglantiId = Number.parseInt(hamBaglantiId, 10);
  if (!Number.isInteger(urunId) || !Number.isInteger(baglantiId)) {
    return new Response("Bulunamadı", { status: 404 });
  }

  /*
   * Bağlantı ÜRÜNLE BİRLİKTE sorgulanıyor: `kazanimId` koşulu olmadan
   * okunsaydı, bir ürünün kimliğiyle başka bir kaydın bağlantısına gidilebilir
   * ve sayaç yanlış ürüne yazılırdı.
   */
  const baglanti = await prisma.kazanimBaglanti.findFirst({
    where: { id: baglantiId, kazanimId: urunId },
    select: {
      adres: true,
      kazanim: {
        select: {
          id: true,
          tip: true,
          kullaniciId: true,
          markettePaylasilsin: true,
          marketOnayDurumu: true,
        },
      },
    },
  });

  if (
    !baglanti ||
    baglanti.kazanim.tip !== "URUN" ||
    !urunGorunurMu(
      {
        sahipKullaniciId: baglanti.kazanim.kullaniciId,
        markettePaylasilsin: baglanti.kazanim.markettePaylasilsin,
        marketOnayDurumu: baglanti.kazanim.marketOnayDurumu,
      },
      kullanici.id,
      urunMarketOnayiVerebilirMi(kullanici),
    )
  ) {
    return new Response("Bulunamadı", { status: 404 });
  }

  /*
   * PROTOKOL YENİDEN DOĞRULANIYOR. Adres yazılırken zaten http/https şartına
   * tabi (bkz. lib/kazanim/kurallar.ts) ama o kuraldan ÖNCE yazılmış satırlar
   * olabilir ve buradaki çıktı bir `Location` başlığıdır. Yazma tarafındaki
   * bir kuralın okuma tarafını da koruduğunu varsaymak, tam olarak böyle
   * yerlerde kırılır.
   */
  if (!baglantiGecerliMi(baglanti.adres)) {
    return new Response("Bulunamadı", { status: 404 });
  }

  /*
   * SAHİBİNİN KENDİ TIKLAMASI DA SAYILIYOR — görüntülenmeden farklı.
   * Görüntülenmede sahibi elenmişti çünkü kişi kendi ürün sayfasını sık açar
   * (düzenlemek, kontrol etmek için). Bağlantıya gitmek ise iradeli bir
   * eylemdir ve sahibinin kendi deposuna gitmesi de bir ziyarettir; ayırmak
   * için ek bir kural koymak, sayının anlamını açıklamayı zorlaştırırdı.
   */
  await prisma.kullaniciKazanim.update({
    where: { id: baglanti.kazanim.id },
    data: { baglantiTiklamasi: { increment: 1 } },
  });

  /*
   * 302 (geçici) — 301 DEĞİL. Kalıcı yönlendirme tarayıcıda önbelleğe alınır
   * ve sonraki tıklamalar sunucuya hiç uğramaz; sayaç bir daha artmazdı.
   *
   * `Referrer-Policy: no-referrer`: hedef site, kullanıcının hangi panel
   * sayfasından geldiğini görmemeli.
   */
  return new Response(null, {
    status: 302,
    headers: {
      Location: baglanti.adres,
      "Referrer-Policy": "no-referrer",
      "Cache-Control": "no-store",
    },
  });
}
