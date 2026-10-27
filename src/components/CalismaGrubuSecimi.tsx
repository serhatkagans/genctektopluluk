"use client";

import { useState } from "react";
import { SINIF_BIRINCIL_BUTON } from "@/components/ui";
import { CALISMA_GRUBU_UST_SINIRI } from "@/lib/ogrenci/calisma-grubu-sinir";

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
 * Kutular kilitlenmiyor; sınır kaydederken uygulanıyor, ekranda önceden
 * söyleniyor.
 *
 * LİSTEDE YALNIZCA ADLAR, AÇIKLAMALAR ALTTA (27 Ekim 2026 · istek: "çalışma
 * gruplarının altındaki kısa açıklamaları kaldıralım … seçtikleri
 * [grupların] açıklamaları sayfanın altında olsun, birden fazla seçerse ayrı
 * ayrı alt alta"). Bu yüzden istemci bileşeni: işaretlenen grubun tanıtımı
 * kaydetmeden, anında altta belirir. Sıra listedeki sıradır.
 */
export function CalismaGrubuSecimi({
  gruplar,
  seciliIdler,
  kaydetEylemi,
  donusYolu,
}: {
  gruplar: {
    id: number;
    ad: string;
    aciklama?: string | null;
    tanitim?: string | null;
  }[];
  seciliIdler: Set<number> | number[];
  kaydetEylemi: (veri: FormData) => Promise<void>;
  /**
   * Kaydettikten sonra dönülecek adres. Panelim'den kaydeden kişiyi başka bir
   * ekrana atmamak için gerekli: eylem tek, çağıran iki.
   */
  donusYolu: string;
}) {
  const [secili, setSecili] = useState<Set<number>>(() => new Set(seciliIdler));

  function degistir(id: number, isaretli: boolean) {
    setSecili((onceki) => {
      const yeni = new Set(onceki);
      if (isaretli) yeni.add(id);
      else yeni.delete(id);
      return yeni;
    });
  }

  const secilenGruplar = gruplar.filter((grup) => secili.has(grup.id));

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
            <label className="flex h-full cursor-pointer items-center gap-3 rounded-kart border border-cizgi px-4 py-3 transition hover:border-vurgu hover:bg-vurgu-zemin">
              <input
                type="checkbox"
                name="grupId"
                value={grup.id}
                checked={secili.has(grup.id)}
                onChange={(olay) => degistir(grup.id, olay.target.checked)}
                className="h-4 w-4 shrink-0 rounded border-cizgi accent-[var(--renk-birincil)]"
              />
              <span className="text-metin">{grup.ad}</span>
            </label>
          </li>
        ))}
      </ul>
      <button type="submit" className={`${SINIF_BIRINCIL_BUTON} mt-6`}>
        Kaydet
      </button>

      {secilenGruplar.length > 0 && (
        <section
          aria-label="Seçtiğiniz çalışma grupları"
          className="mt-8 space-y-6 border-t border-cizgi pt-6"
        >
          {secilenGruplar.map((grup) => (
            <article key={grup.id}>
              <h3 className="font-semibold text-baslik">{grup.ad}</h3>
              {grup.aciklama && (
                <p className="mt-1 text-sm font-medium text-metin">
                  {grup.aciklama}
                </p>
              )}
              {grup.tanitim && (
                <p className="mt-2 text-sm leading-relaxed text-metin-yumusak">
                  {grup.tanitim}
                </p>
              )}
            </article>
          ))}
        </section>
      )}
    </form>
  );
}
