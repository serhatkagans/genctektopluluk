import { CEREZ_YOLU } from "@/lib/ortam";
import { TEMA_CEREZI, TEMALAR, type Tema } from "@/lib/tema";
import { TemaDugmeleri } from "./TemaDugmeleri";

/**
 * İki tema arasında geçiş. Kendi arka planını taşıdığı için hem koyu hem açık
 * üst barda okunur kalır.
 *
 * Geçiş tarayıcıda anında yapılır (bkz. TemaDugmeleri); çerez ve sunucu
 * yolu burada okunup istemci bileşenine verilir, çünkü lib/tema ve lib/ortam
 * yalnızca sunucuda çalışır.
 */
export function TemaSecici({ aktif }: { aktif: Tema }) {
  return (
    <TemaDugmeleri
      aktif={aktif}
      temalar={TEMALAR.map(({ kod, aciklama }) => ({ kod, aciklama }))}
      cerezAdi={TEMA_CEREZI}
      cerezYolu={CEREZ_YOLU}
    />
  );
}
