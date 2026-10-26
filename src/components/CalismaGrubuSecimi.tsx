import { SINIF_BIRINCIL_BUTON } from "@/components/ui";
import { CALISMA_GRUBU_UST_SINIRI } from "@/lib/ogrenci/calisma-grubu";

/**
 * Çalışma grubu seçim formu.
 *
 * İKİ YERDE BASILIR: Panelim sayfasının içindeki bölüm ve `/panel/calisma-
 * gruplari` ekranı. Sekme menüden kalktı ama sayfa silinmedi (bildirim
 * e-postalarında ve yer imlerinde adresi var); ikisi ayrı ayrı yazılsaydı
 * birine eklenen bir grup ya da kural ötekinde eksik kalırdı.
 *
 * ÜST SINIR VAR: en fazla `CALISMA_GRUBU_UST_SINIRI` grup (20 Ağustos 2026 ·
 * istek: "öğrenciler max 5 çalışma grubunda görülebilsin"). Sayı buradan
 * yazılmıyor, kural dosyasından okunuyor — sunucu aynı sabitle reddediyor.
 *
 * KUTULAR TARAYICIDA KİLİTLENMİYOR: sayfada JavaScript yok ve altıncı kutuyu
 * sunucuya gitmeden kapatmanın bir yolu yok. Sınır kaydederken uygulanıyor,
 * ekranda ise önceden söyleniyor — öğrenci altı işaretleyip "neden olmadı"
 * diye sormamalı.
 */
export function CalismaGrubuSecimi({
  gruplar,
  seciliIdler,
  kaydetEylemi,
  donusYolu,
}: {
  gruplar: { id: number; ad: string; aciklama?: string | null }[];
  seciliIdler: Set<number>;
  kaydetEylemi: (veri: FormData) => Promise<void>;
  /**
   * Kaydettikten sonra dönülecek adres. Panelim'den kaydeden kişiyi başka bir
   * ekrana atmamak için gerekli: eylem tek, çağıran iki.
   */
  donusYolu: string;
}) {
  return (
    <form action={kaydetEylemi}>
      <input type="hidden" name="donusYolu" value={donusYolu} />
      <p className="mb-4 text-sm text-metin-yumusak">
        En fazla <strong>{CALISMA_GRUBU_UST_SINIRI}</strong> çalışma grubu
        seçebilirsiniz.
      </p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {gruplar.map((grup) => (
          <li key={grup.id}>
            <label className="flex h-full cursor-pointer items-start gap-3 rounded-kart border border-cizgi px-4 py-3 transition hover:border-vurgu hover:bg-vurgu-zemin">
              <input
                type="checkbox"
                name="grupId"
                value={grup.id}
                defaultChecked={seciliIdler.has(grup.id)}
                className="mt-1 h-4 w-4 shrink-0 rounded border-cizgi accent-[var(--renk-birincil)]"
              />
              <span>
                <span className="block text-metin">{grup.ad}</span>
                {grup.aciklama && (
                  <span className="mt-0.5 block text-xs leading-snug text-metin-yumusak">
                    {grup.aciklama}
                  </span>
                )}
              </span>
            </label>
          </li>
        ))}
      </ul>
      <button type="submit" className={`${SINIF_BIRINCIL_BUTON} mt-6`}>
        Kaydet
      </button>
    </form>
  );
}
