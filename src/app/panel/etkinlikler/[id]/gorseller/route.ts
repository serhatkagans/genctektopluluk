import { oturumKullanicisi } from "@/lib/auth/oturum";
import { prisma } from "@/lib/db";
import { depolama } from "@/lib/depolama";
import { faaliyetKapsamiCikar, gorunurFaaliyetGetir } from "@/lib/faaliyet/erisim";
import { faaliyetIcerigiGorunurMu } from "@/lib/yetki/izinler";
import { erisimLoglaCoklu } from "@/lib/yetki/log";
import { zipAdiTemizle, zipOlustur } from "@/lib/zip";

export const dynamic = "force-dynamic";

/**
 * Etkinliğin görsellerini TEK ZIP olarak indirir (12 Ağustos 2026).
 *
 * İSTEK: "etkinlik raporu sayfasında etkinliğe dair kaç görsel yüklendiyse
 * onları toplu indirecek bir düğme lazım; sıkıştırıp hepsini indirmek mümkün
 * olur mu."
 *
 * Görseller tek tek de indirilebiliyordu (`/ekler/[ekId]`) ama on beş fotoğrafı
 * tek tek kaydetmek, raporunu haber metnine ekleyecek öğretmenin işini
 * gereksiz yere uzatıyordu.
 *
 * YETKİ TEK TEK İNDİRMEYLE AYNI KAPI: oturum + faaliyetin görünürlüğü. Toplu
 * indirme yeni bir erişim açmıyor, aynı dosyaları tek istekte veriyor —
 * kapsam dışı faaliyette 404 döner ve kaydın varlığı sızmaz.
 *
 * YALNIZCA GÖRSEL: PDF ve diğer belgeler dışarıda. Düğmenin adı "etkinlik
 * görsellerini indir" ve arşive sessizce başka dosya koymak, kullanıcının
 * indirdiğini bilmediği bir şeyi indirmesi olurdu.
 *
 * TAMAMI BELLEKTE: dosyalar birkaç MB ve sayıları onlarla ifade ediliyor
 * (bkz. lib/zip.ts · kapsam notu). Akış (streaming) gerekirse orası da
 * değişmeli.
 */
export async function GET(
  _istek: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const kullanici = await oturumKullanicisi();
  if (!kullanici) return new Response("Bulunamadı", { status: 404 });

  const faaliyet = await gorunurFaaliyetGetir(kullanici, Number.parseInt(id, 10));
  if (!faaliyet) return new Response("Bulunamadı", { status: 404 });
  // Tek tek indirmeyle aynı içerik kapısı (bkz. faaliyetIcerigiGorunurMu).
  if (!faaliyetIcerigiGorunurMu(kullanici, faaliyetKapsamiCikar(faaliyet))) {
    return new Response("Bulunamadı", { status: 404 });
  }

  const ekler = await prisma.faaliyetEk.findMany({
    where: {
      faaliyetId: faaliyet.id,
      silindiMi: false,
      mimeTipi: { startsWith: "image/" },
    },
    orderBy: { yuklenmeTarihi: "asc" },
    select: {
      id: true,
      dosyaAdi: true,
      depolamaYolu: true,
      yuklenmeTarihi: true,
    },
  });

  if (ekler.length === 0) {
    return new Response("Bu etkinliğe yüklenmiş görsel yok.", { status: 404 });
  }

  /*
   * OKUNAMAYAN DOSYA ARŞİVİ DÜŞÜRMEZ, atlanır: kaydı olup dosyası kayıp bir ek
   * yüzünden on beş fotoğrafın tamamı indirilemez olsaydı, kullanıcı hangi
   * dosyanın sorun çıkardığını da öğrenemezdi. Kaç dosyanın atlandığı yanıt
   * başlığında yazıyor ve sunucu günlüğüne düşüyor.
   */
  const girisler: { ad: string; icerik: Buffer; tarih: Date }[] = [];
  const atlananlar: string[] = [];

  for (const ek of ekler) {
    try {
      girisler.push({
        ad: ek.dosyaAdi,
        icerik: await depolama().oku(ek.depolamaYolu),
        tarih: ek.yuklenmeTarihi,
      });
    } catch {
      atlananlar.push(ek.dosyaAdi);
    }
  }

  if (atlananlar.length > 0) {
    console.error("Toplu görsel indirmede okunamayan dosyalar", {
      faaliyetId: faaliyet.id,
      atlananlar,
    });
  }

  if (girisler.length === 0) {
    return new Response("Görsellerin dosyaları okunamadı.", { status: 404 });
  }

  const arsiv = zipOlustur(girisler);

  // Her görsel için ayrı erişim kaydı: tek tek indirmede de öyle yazılıyor ve
  // KVKK denetiminde "bu dosyayı kim gördü" sorusu dosya bazında soruluyor.
  await erisimLoglaCoklu(
    ekler.map((ek) => ({
      kullaniciId: kullanici.id,
      islem: "GORUNTULEME" as const,
      hedefTip: "FAALIYET_EK" as const,
      hedefId: ek.id,
      detay: `Etkinlik görselleri toplu indirildi: ${ek.dosyaAdi}`,
    })),
  );

  const dosyaAdi = `${zipAdiTemizle(faaliyet.ad)} - gorseller.zip`;

  return new Response(new Uint8Array(arsiv), {
    headers: {
      "Content-Type": "application/zip",
      // Dosya adı Türkçe karakter içerebilir; RFC 5987 biçimi kullanılır.
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(dosyaAdi)}`,
      "Content-Length": String(arsiv.byteLength),
      "X-Atlanan-Dosya": String(atlananlar.length),
      "Cache-Control": "private, no-store",
    },
  });
}
