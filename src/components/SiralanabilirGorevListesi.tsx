"use client";

import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import { useState, useTransition, type DragEvent, type ReactNode } from "react";

type Oge = { id: number; aktif: boolean; icerik: ReactNode };

/**
 * GençTek görev ilanlarının sürükle-bırak listesi (27 Ekim 2026 · istek:
 * "fare ile sürüklenebilir yapabilsin proje yöneticisi").
 *
 * Satırın içeriği (düzenleme formu, Kapat düğmesi) sunucuda basılıp hazır
 * gelir; bu bileşen yalnızca sırayı tutar. Sürükleme tutamaktan başlar, satırın
 * tamamından değil: satır sürüklenebilir olsaydı içindeki form alanlarında
 * metin seçmek sürüklemeye dönerdi.
 *
 * AÇIK VE KAPALI AYRI GRUP: açık görevler her zaman önce gelir (26 Ekim 2026
 * kuralı), bu yüzden bir görev yalnızca kendi grubunun içinde taşınır.
 *
 * Yukarı/aşağı düğmeleri dokunmatik ekran ve klavye içindir; tarayıcının
 * sürükle-bırakı dokunmayla çalışmıyor.
 */
export function SiralanabilirGorevListesi({
  ogeler,
  siralaEylemi,
}: {
  ogeler: Oge[];
  siralaEylemi: (idler: number[]) => Promise<{ hata: string | null }>;
}) {
  const [sira, setSira] = useState(() => ogeler.map((oge) => oge.id));
  const [suruklenen, setSuruklenen] = useState<number | null>(null);
  const [hedef, setHedef] = useState<number | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [kaydediliyor, baslat] = useTransition();

  const harita = new Map(ogeler.map((oge) => [oge.id, oge]));
  const ayniGrup = (a: number, b: number) =>
    harita.get(a)?.aktif === harita.get(b)?.aktif;

  function kaydet(yeni: number[]) {
    const onceki = sira;
    setSira(yeni);
    setHata(null);
    baslat(async () => {
      try {
        const sonuc = await siralaEylemi(yeni);
        if (sonuc.hata) {
          setSira(onceki);
          setHata(sonuc.hata);
        }
      } catch {
        setSira(onceki);
        setHata("Sıra kaydedilemedi; sayfayı yenileyip tekrar deneyin.");
      }
    });
  }

  /** `id`'yi `hedefId`'nin yerine koyar; aşağı taşınırken hedefin altına. */
  function tasi(id: number, hedefId: number) {
    if (id === hedefId || !ayniGrup(id, hedefId)) return;
    const eskiYer = sira.indexOf(id);
    const hedefYer = sira.indexOf(hedefId);
    const yeni = sira.filter((x) => x !== id);
    const yeniHedefYer = yeni.indexOf(hedefId);
    yeni.splice(eskiYer < hedefYer ? yeniHedefYer + 1 : yeniHedefYer, 0, id);
    kaydet(yeni);
  }

  /** Aynı gruptaki bir üst ya da alt komşu; yoksa null. */
  function komsu(id: number, yon: -1 | 1): number | null {
    const yer = sira.indexOf(id) + yon;
    const aday = sira[yer];
    return aday !== undefined && ayniGrup(id, aday) ? aday : null;
  }

  function bitir() {
    setSuruklenen(null);
    setHedef(null);
  }

  function surukleBasla(olay: DragEvent<HTMLSpanElement>, id: number) {
    setSuruklenen(id);
    olay.dataTransfer.effectAllowed = "move";
    olay.dataTransfer.setData("text/plain", String(id));
    const satir = olay.currentTarget.closest("li");
    if (satir) olay.dataTransfer.setDragImage(satir, 20, 20);
  }

  return (
    <div>
      {hata && (
        <p
          role="alert"
          className="mb-3 rounded-kutu border border-hata-cizgi bg-hata-zemin px-3 py-2 text-sm text-hata-metin"
        >
          {hata}
        </p>
      )}
      <p className="mb-2 text-sm text-metin-yumusak" aria-live="polite">
        {kaydediliyor
          ? "Sıra kaydediliyor…"
          : "Sırayı değiştirmek için soldaki tutamaktan sürükleyin ya da oklarla taşıyın. Görevler panoda bu sırayla görünür."}
      </p>
      <ul className="divide-y divide-cizgi">
        {sira.map((id) => {
          const oge = harita.get(id);
          if (!oge) return null;
          const ust = komsu(id, -1);
          const alt = komsu(id, 1);
          const hedefMi =
            hedef === id && suruklenen !== null && suruklenen !== id;
          return (
            <li
              key={id}
              onDragOver={(olay) => {
                if (suruklenen === null || !ayniGrup(suruklenen, id)) return;
                olay.preventDefault();
                olay.dataTransfer.dropEffect = "move";
                if (hedef !== id) setHedef(id);
              }}
              onDrop={(olay) => {
                olay.preventDefault();
                if (suruklenen !== null) tasi(suruklenen, id);
                bitir();
              }}
              className={`flex gap-2 py-3 transition-colors ${
                suruklenen === id ? "opacity-50" : ""
              } ${hedefMi ? "bg-secili-zemin" : ""}`}
            >
              <div className="flex shrink-0 flex-col items-center gap-0.5 pt-0.5">
                <button
                  type="button"
                  onClick={() => ust !== null && tasi(id, ust)}
                  disabled={ust === null || kaydediliyor}
                  aria-label="Yukarı taşı"
                  className="rounded p-0.5 text-metin-yumusak hover:text-metin disabled:opacity-30"
                >
                  <ChevronUp size={16} aria-hidden />
                </button>
                <span
                  draggable={!kaydediliyor}
                  onDragStart={(olay) => surukleBasla(olay, id)}
                  onDragEnd={bitir}
                  title="Sürükleyerek sırala"
                  className="cursor-grab rounded p-0.5 text-metin-yumusak hover:text-metin active:cursor-grabbing"
                >
                  <GripVertical size={18} aria-hidden />
                </span>
                <button
                  type="button"
                  onClick={() => alt !== null && tasi(id, alt)}
                  disabled={alt === null || kaydediliyor}
                  aria-label="Aşağı taşı"
                  className="rounded p-0.5 text-metin-yumusak hover:text-metin disabled:opacity-30"
                >
                  <ChevronDown size={16} aria-hidden />
                </button>
              </div>
              <div className="min-w-0 flex-1">{oge.icerik}</div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
