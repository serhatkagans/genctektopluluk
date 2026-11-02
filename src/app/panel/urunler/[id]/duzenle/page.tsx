import { Sparkles } from "lucide-react";
import { notFound } from "next/navigation";
import { KayitDuzenlemeFormu } from "@/components/ProfilDuzenleme";
import {
  BilgiKutusu,
  Kart,
  KartBasligi,
  KirintiYolu,
  SayfaBasligi,
} from "@/components/ui";
import { oturumKullanicisiZorunlu } from "@/lib/auth/oturum";
import { prisma } from "@/lib/db";
import { kazanimEkSinirlariniGetir } from "@/lib/kazanim/ek";
import { kazanimTipiTanimi } from "@/lib/kazanim/kurallar";
import { urunMarketOnayiVerebilirMi } from "@/lib/yetki/izinler";
import { urunYoneticiGuncelleEylemi } from "../../eylemler";

export const dynamic = "force-dynamic";

/**
 * Proje yöneticisinin vitrindeki bir ürünü düzenlediği ekran (2 Kasım 2026 ·
 * istek: "proje yöneticisi için … düzenleme yetkisi de olsun").
 *
 * Sahibinin formuyla AYNI bileşen; yalnızca "vitrinde paylaş" kutusu yok —
 * paylaşım sahibinin tercihidir. Yetkisi olmayan ya da paylaşılmamış ürün
 * 404 döner.
 */
export default async function UrunDuzenleSayfasi({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ hata?: string }>;
}) {
  const { id: hamId } = await params;
  const { hata } = await searchParams;
  const kullanici = await oturumKullanicisiZorunlu();
  if (!urunMarketOnayiVerebilirMi(kullanici)) notFound();

  const id = Number.parseInt(hamId, 10);
  if (!Number.isInteger(id)) notFound();

  const [urun, belgeSinirlari] = await Promise.all([
    prisma.kullaniciKazanim.findFirst({
      where: { id, tip: "URUN", markettePaylasilsin: true },
      include: {
        kullanici: {
          select: {
            ad: true,
            soyad: true,
            roller: { where: { bitisTarihi: null }, select: { rolKodu: true } },
          },
        },
        baglantilar: {
          select: { id: true, adres: true, etiket: true },
          orderBy: { siraNo: "asc" },
        },
      },
    }),
    kazanimEkSinirlariniGetir(),
  ]);
  if (!urun) notFound();

  const sahip = urun.kullanici.roller.some((r) => r.rolKodu === "OGRENCI")
    ? "OGRENCI"
    : "OGRETMEN";
  const tanim = kazanimTipiTanimi(urun.tip, sahip);

  return (
    <div className="space-y-6">
      <KirintiYolu
        basamaklar={[
          { etiket: "GençTek Vitrin", yol: "/panel/urunler" },
          { etiket: urun.baslik, yol: `/panel/urunler/${urun.id}` },
          { etiket: "Düzenle" },
        ]}
      />

      <SayfaBasligi
        baslik={`Ürünü düzenle · ${urun.baslik}`}
        aciklama={`Ekleyen: ${urun.kullanici.ad} ${urun.kullanici.soyad}. Kaydettiğinizde ürün vitrindeki durumunu korur.`}
        geri={null}
      />

      {hata && <BilgiKutusu cesit="hata">{hata}</BilgiKutusu>}

      <Kart>
        <KartBasligi baslik="Ürün bilgileri" Ikon={Sparkles} />
        <div className="mt-4">
          <KayitDuzenlemeFormu
            kazanim={urun}
            tanim={tanim}
            izinliBelgeTipleri={[
              ...belgeSinirlari.izinliGorselTipleri,
              ...belgeSinirlari.izinliBelgeTipleri,
            ]}
            belgeSinirlari={belgeSinirlari}
            guncelleEylemi={urunYoneticiGuncelleEylemi}
            paylasimKutusuVarMi={false}
          />
        </div>
      </Kart>
    </div>
  );
}
