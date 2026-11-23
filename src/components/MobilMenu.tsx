"use client";

import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { PanelGezinme, type GezinmeBaglantisi } from "./PanelGezinme";

/**
 * TELEFONDA PANEL MENÜSÜ (23 Kasım 2026 · kullanıcı dönütü: "mobil yerleşim
 * pek iyi değil, çıkış butonu mobilde göze batıyor").
 *
 * Eski dar ekran düzeni: üst bar kendini iki-üç satıra büküyordu (logo, ad +
 * rol rozetleri, çerçeveli Çıkış düğmesi) ve yapışkan olduğu için ekranın
 * üçte birini kalıcı olarak kaplıyordu; altında da yatay kaydırılan bir rozet
 * şeridi vardı — öğelerin yarısı ekran dışında kalıyor, kaydırılabildiği de
 * anlaşılmıyordu. Çıkış, en çok dokunulan yerde en belirgin düğmeydi.
 *
 * Şimdi 1024 pikselin altında üst bar tek satır: logo ve "Menü" düğmesi.
 * Menü açılınca sırasıyla kimlik (ad + roller), geniş ekrandaki dikey liste,
 * tema seçimi ve EN ALTTA sessiz bir Çıkış satırı geliyor. Geniş ekran
 * düzeni değişmedi.
 *
 * Kimlik ve alt bölüm sunucuda basılıp `ReactNode` olarak geliyor: rol
 * etiketleri sunucu verisi (il adları), çıkış da sunucu eylemi — ikisini de
 * istemciye taşımak gerekmiyor.
 *
 * SAYFA DEĞİŞİNCE KAPANIR: açık durum, açıldığı ADRESLE birlikte tutuluyor;
 * bağlantıya basılıp adres değişince `acik` kendiliğinden false oluyor.
 * Etkide setState yapıp ayrıca kapatmaya gerek kalmıyor.
 */
export function MobilMenu({
  baglantilar,
  kimlik,
  alt,
}: {
  baglantilar: GezinmeBaglantisi[];
  kimlik: React.ReactNode;
  alt: React.ReactNode;
}) {
  const yol = usePathname();
  const [acikOlduguYol, setAcikOlduguYol] = useState<string | null>(null);
  const acik = acikOlduguYol === yol;
  const kapat = () => setAcikOlduguYol(null);

  // Açıkken arkadaki sayfa kaymasın; Esc menüyü kapatsın.
  useEffect(() => {
    if (!acik) return;
    const onceki = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const tus = (olay: KeyboardEvent) => {
      if (olay.key === "Escape") setAcikOlduguYol(null);
    };
    window.addEventListener("keydown", tus);
    return () => {
      document.body.style.overflow = onceki;
      window.removeEventListener("keydown", tus);
    };
  }, [acik]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-expanded={acik}
        aria-controls="mobil-panel-menusu"
        onClick={() => (acik ? kapat() : setAcikOlduguYol(yol))}
        className="relative z-10 inline-flex items-center gap-1.5 rounded-kutu border border-cizgi px-3 py-2 text-sm font-medium text-ust-bar-metin transition hover:border-vurgu"
      >
        {acik ? <X size={18} aria-hidden /> : <Menu size={18} aria-hidden />}
        {acik ? "Kapat" : "Menü"}
      </button>

      {acik && (
        <>
          <div
            aria-hidden
            onClick={kapat}
            className="fixed inset-0 bg-black/40"
          />
          <div
            id="mobil-panel-menusu"
            className="absolute inset-x-0 top-full max-h-[calc(100dvh-4.5rem)] overflow-y-auto border-b border-ust-bar-cizgi bg-ust-bar shadow-lg"
          >
            <div className="space-y-4 px-4 py-4">
              <div className="border-b border-cizgi pb-4">{kimlik}</div>
              <PanelGezinme baglantilar={baglantilar} />
              <div className="border-t border-cizgi pt-4">{alt}</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
