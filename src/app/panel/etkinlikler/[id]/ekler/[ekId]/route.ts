import { oturumKullanicisi } from "@/lib/auth/oturum";
import { prisma } from "@/lib/db";
import { depolama } from "@/lib/depolama";
import { faaliyetKapsamiCikar, gorunurFaaliyetGetir } from "@/lib/faaliyet/erisim";
import { faaliyetIcerigiGorunurMu } from "@/lib/yetki/izinler";
import { erisimLogla } from "@/lib/yetki/log";

export const dynamic = "force-dynamic";

/**
 * Faaliyet ekini indirir.
 *
 * Dosyalar public bir dizinden servis EDİLMEZ: her istek önce oturumdan,
 * sonra faaliyetin kapsam filtresinden geçer. Aksi halde okul içi bir
 * faaliyetin görselinin adresini bilen herkes indirebilirdi.
 *
 * Kapsam dışı faaliyette 403 değil 404 döner — kaydın varlığı sızmasın
 * (references/permissions.md Bölüm 4).
 */
export async function GET(
  _istek: Request,
  { params }: { params: Promise<{ id: string; ekId: string }> },
) {
  const { id, ekId } = await params;

  const kullanici = await oturumKullanicisi();
  if (!kullanici) {
    return new Response("Bulunamadı", { status: 404 });
  }

  const faaliyet = await gorunurFaaliyetGetir(
    kullanici,
    Number.parseInt(id, 10),
  );
  if (!faaliyet) {
    return new Response("Bulunamadı", { status: 404 });
  }
  // Etkinlik görünse de içeriği dış kullanıcıya her yerde açık değil (bkz.
  // faaliyetIcerigiGorunurMu).
  if (!faaliyetIcerigiGorunurMu(kullanici, faaliyetKapsamiCikar(faaliyet))) {
    return new Response("Bulunamadı", { status: 404 });
  }

  const ek = await prisma.faaliyetEk.findFirst({
    where: {
      id: Number.parseInt(ekId, 10),
      faaliyetId: faaliyet.id,
      silindiMi: false,
    },
    select: {
      id: true,
      dosyaAdi: true,
      depolamaYolu: true,
      mimeTipi: true,
    },
  });
  if (!ek) {
    return new Response("Bulunamadı", { status: 404 });
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
    hedefTip: "FAALIYET_EK",
    hedefId: ek.id,
    detay: `Etkinlik eki indirildi: ${ek.dosyaAdi}`,
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
