import { prisma } from "../db";

// Sınır ayrı dosyada: seçim formu tarayıcıda çalışıyor ve bu dosya veritabanı
// içe aktarıyor (27 Ekim 2026).
export {
  CALISMA_GRUBU_UST_SINIRI,
  calismaGrubuSayisiAsildiMi,
} from "./calisma-grubu-sinir";

/**
 * Çalışma grubu seçim ekranının verisi.
 *
 * Panelim'deki bölüm ile `/panel/calisma-gruplari` sayfası AYNI sorguyu
 * kullanır: iki yerde ayrı yazılsaydı biri pasif grupları gizlemeyi unutabilir
 * ve öğrenciye kapatılmış bir grup teklif edilirdi.
 *
 * Yalnızca AKTİF gruplar listelenir; geçmiş seçimler pasif gruplarda korunur
 * ama yeniden seçilemez (bkz. calisma-gruplari/eylemler.ts).
 */
export async function calismaGruplariniGetir(ogrenciId: number): Promise<{
  gruplar: {
    id: number;
    ad: string;
    aciklama: string | null;
    tanitim: string | null;
  }[];
  seciliIdler: Set<number>;
}> {
  const [gruplar, secimler] = await Promise.all([
    prisma.calismaGrubu.findMany({
      where: { aktif: true },
      orderBy: { siraNo: "asc" },
      select: { id: true, ad: true, aciklama: true, tanitim: true },
    }),
    prisma.ogrenciCalismaGrubu.findMany({
      where: { ogrenciId },
      select: { calismaGrubuId: true },
    }),
  ]);

  return {
    gruplar,
    seciliIdler: new Set(secimler.map((secim) => secim.calismaGrubuId)),
  };
}
