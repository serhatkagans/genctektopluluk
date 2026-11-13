"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { SINIF_GIRDI } from "@/components/ui";

/**
 * ARAMALI DANIŞMAN SEÇİMİ (13 Kasım 2026 · istek: "liste isme göre sıralı
 * değil, bide listenin yanına ismini yazsak danışmanı kolay yoldan
 * bulabilsek").
 *
 * Yerel `<select>` olduğu gibi kalır (form `danismanId`yi ondan gönderir,
 * JavaScript kapalıyken de çalışır); üstündeki kutuya yazılan her kelime
 * seçeneğin metninde geçmeli. Seçili seçenek süzgeçten etkilenmez — yazarken
 * seçimin sessizce boşalması, yanlış kişiye "Ata" denmesinden kötüdür.
 */
export type DanismanSecenegi = {
  deger: string;
  etiket: string;
  /** Optgroup başlığı; aynı başlıklılar birlikte gösterilir. */
  grup: string;
};

function sadele(metin: string): string {
  return metin.toLocaleLowerCase("tr-TR");
}

export function AramaliDanismanSecimi({
  ad,
  secenekler,
  varsayilan,
  aramaIpucu = "Danışmanın adını yazın…",
  aramaEtiketi = "Danışman ara",
  birim = "kişi",
}: {
  ad: string;
  secenekler: DanismanSecenegi[];
  varsayilan: string;
  /** Kullanıcı yönetiminde okul seçimi için de kullanılır (13 Kasım 2026). */
  aramaIpucu?: string;
  aramaEtiketi?: string;
  /** Sonuç sayısının birimi: "kişi", "okul". */
  birim?: string;
}) {
  const [arama, setArama] = useState("");
  const [secili, setSecili] = useState(varsayilan);

  const gruplar = useMemo(() => {
    const kelimeler = sadele(arama).split(/\s+/).filter(Boolean);
    const sonuc = new Map<string, DanismanSecenegi[]>();
    for (const secenek of secenekler) {
      const metin = sadele(secenek.etiket);
      const uyar =
        secenek.deger === secili || kelimeler.every((kelime) => metin.includes(kelime));
      if (!uyar) continue;
      sonuc.set(secenek.grup, [...(sonuc.get(secenek.grup) ?? []), secenek]);
    }
    return [...sonuc.entries()];
  }, [arama, secenekler, secili]);

  const bulunan = gruplar.reduce(
    (toplam, [, liste]) =>
      toplam + liste.filter((secenek) => secenek.deger !== secili).length,
    0,
  );

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-metin-yumusak"
          aria-hidden
        />
        <input
          type="search"
          value={arama}
          onChange={(olay) => setArama(olay.target.value)}
          onKeyDown={(olay) => {
            // Enter formu göndermesin: kişi henüz seçmedi, yalnızca arıyor.
            if (olay.key === "Enter") olay.preventDefault();
          }}
          placeholder={aramaIpucu}
          aria-label={aramaEtiketi}
          autoComplete="off"
          className={`${SINIF_GIRDI} !mt-0 !pl-9`}
        />
      </div>
      <select
        name={ad}
        required
        value={secili}
        onChange={(olay) => setSecili(olay.target.value)}
        className={`${SINIF_GIRDI} !mt-0`}
      >
        <option value="">
          {arama && bulunan === 0 ? "Eşleşen yok" : "Seçiniz"}
        </option>
        {gruplar.map(([grup, liste]) => (
          <optgroup key={grup} label={grup}>
            {liste.map((secenek) => (
              <option key={secenek.deger} value={secenek.deger}>
                {secenek.etiket}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {arama && (
        <p className="text-xs text-metin-yumusak">
          {bulunan === 0 ? "Bu adla eşleşen yok." : `${bulunan} ${birim} eşleşti.`}
        </p>
      )}
    </div>
  );
}
