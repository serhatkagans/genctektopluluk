import { prisma } from "../db";

/**
 * Bir öğrencinin aynı anda kayıtlı olabileceği çalışma grubu sayısı
 * (20 Ağustos 2026 · istek: "öğrenciler max 5 çalışma grubunda görülebilsin").
 *
 * ÖNCEKİ KARARIN TERSİ ve bilerek öyle. Sistemde bir zamanlar
 * `OGRENCI_CALISMA_GRUBU_UST_SINIRI` ayarı vardı, "en fazla 3" kısıtıyla
 * birlikte kaldırılmıştı ve kodda "buraya sayı kontrolü eklemeyin" notları
 * duruyordu. Sınır geri geldi; notlar bu yüzden güncellendi, silinmedi —
 * kaldırılmış bir kısıtın neden geri döndüğü, kısıtın kendisi kadar önemli.
 *
 * SİSTEM AYARI DEĞİL, KOD SABİTİ: kaldırılan ayar tabloya geri konmadı.
 * Sayı, ekranda öğrenciye söylenen bir cümlenin parçası ("en fazla 5") ve
 * çalışma zamanında değişebilen bir değer, iki yüzeyi de belirsizleştirirdi.
 * Değişmesi gerekirse burası tek yer.
 *
 * GEÇMİŞ SEÇİMLER GERİYE DÖNÜK KIRILMAZ: sınır yalnızca YENİ kayıtta
 * uygulanır. Beş üstü seçimi olan öğrenci (sınırdan önce yapılmış ya da
 * danışmanı/koordinatörü eklemiş olabilir) ekranda hepsini görmeye devam
 * eder; kaydetmek istediğinde beşe inmesi istenir.
 */
export const CALISMA_GRUBU_UST_SINIRI = 5;

/** Seçim sayısı sınırı aşıyor mu? */
export function calismaGrubuSayisiAsildiMi(secilenSayisi: number): boolean {
  return secilenSayisi > CALISMA_GRUBU_UST_SINIRI;
}

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
  gruplar: { id: number; ad: string; aciklama: string | null }[];
  seciliIdler: Set<number>;
}> {
  const [gruplar, secimler] = await Promise.all([
    prisma.calismaGrubu.findMany({
      where: { aktif: true },
      orderBy: { siraNo: "asc" },
      select: { id: true, ad: true, aciklama: true },
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
