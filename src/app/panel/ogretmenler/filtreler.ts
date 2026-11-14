import { egitimOgretimYiliAraligi } from "@/lib/ogretmen/gorev-yillari";
import type { OgretmenListeFiltreleri } from "@/lib/yetki/kapsam";
import {
  sayiVeyaNull,
  type SorguParametreleri,
  tekil,
} from "../ogrenciler/filtreler";

/**
 * Öğretmen envanteri filtrelerinin adres çubuğundan okunması.
 *
 * Ekran ve CSV dışa aktarma aynı çözümlemeyi kullanır; ikisi ayrı yazılırsa
 * indirilen dosya ekranda görünenden farklı bir küme olur.
 */

/** Ekranda seçili değerleri göstermek için ham hâli de taşınır. */
export interface OgretmenFiltreDurumu extends OgretmenListeFiltreleri {
  /** "2025-2026" — aralığa çevrilmiş hâli `gorevAraligi` alanındadır. */
  gorevYili: string | null;
}

export function ogretmenFiltreleriniCoz(
  parametreler: SorguParametreleri,
): OgretmenFiltreDurumu {
  const gorevYili = tekil(parametreler.yil);
  // Biçimi tutmayan yıl sessizce düşer: filtre yalnızca daralttığı için
  // geçersiz değeri reddetmek yerine yok saymak yeterli (aralık null kalır).
  const aralik = gorevYili ? egitimOgretimYiliAraligi(gorevYili) : null;

  return {
    ilKodu: tekil(parametreler.il),
    ilceKodu: tekil(parametreler.ilce),
    kurumKodu: sayiVeyaNull(tekil(parametreler.okul)),
    okulTuru: tekil(parametreler.okulTuru),
    brans: tekil(parametreler.brans),
    ara: tekil(parametreler.ara),
    yalnizcaDanismanlar: tekil(parametreler.danisman) === "1",
    yalnizcaGorevsizler: tekil(parametreler.gorevsiz) === "1",
    gorevYili: aralik ? gorevYili : null,
    gorevAraligi: aralik,
    okulAra: tekil(parametreler.okulAra)?.trim().slice(0, 100) || null,
    okulDurumu: secenekVeyaNull(tekil(parametreler.okulDurumu), ["bagli", "yok"] as const),
    ogrenciDurumu: secenekVeyaNull(tekil(parametreler.ogrenci), ["var", "yok"] as const),
    yalnizcaOkulSorumlulari: tekil(parametreler.sorumlu) === "1",
  };
}

/** Listede olmayan değer sessizce düşer: filtre yalnızca daraltır. */
function secenekVeyaNull<T extends string>(
  deger: string | null,
  secenekler: readonly T[],
): T | null {
  return secenekler.includes(deger as T) ? (deger as T) : null;
}

export function ogretmenFiltresiVarMi(
  filtreler: OgretmenFiltreDurumu,
): boolean {
  return Object.values(filtreler).some(
    (deger) => deger !== null && deger !== false && deger !== undefined,
  );
}
