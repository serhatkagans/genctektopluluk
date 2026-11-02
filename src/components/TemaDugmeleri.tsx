"use client";

import React, { useState } from "react";
import { temaDegistirEylemi } from "@/app/tema-eylemi";

const BIR_YIL_SANIYE = 60 * 60 * 24 * 365;

/** Çerezi yazar ve sayfanın rengini hemen değiştirir. */
function temayiUygula(cerezAdi: string, cerezYolu: string, kod: string) {
  document.cookie = `${cerezAdi}=${kod}; path=${cerezYolu}; max-age=${BIR_YIL_SANIYE}; samesite=lax`;
  document.documentElement.dataset.tema = kod;
}

/**
 * TEMA ANINDA DEĞİŞİR (2 Kasım 2026 · istek: "B D arası geçince kaydediliyor
 * yazıyor, 20 saniyeden fazla öyle kalıyor").
 *
 * Önceden her tıklama sunucu eylemine gidiyor, sunucu da bütün paneli
 * (pano sorgularıyla birlikte) yeniden çiziyordu. Adres değişmediği için
 * çift gönderim kalkanının kilidi de 30 saniye kalkmıyordu. Şimdi çerez
 * tarayıcıda yazılır ve <html data-tema> anında değiştirilir; sunucuya hiç
 * gidilmez. Sunucu sonraki sayfa açılışında aynı çerezi okur, renk atlaması
 * olmaz.
 *
 * JavaScript kapalıysa form eskisi gibi sunucu eylemiyle çalışır.
 */
export function TemaDugmeleri({
  aktif,
  temalar,
  cerezAdi,
  cerezYolu,
}: {
  aktif: string;
  temalar: { kod: string; aciklama: string }[];
  cerezAdi: string;
  cerezYolu: string;
}): React.ReactElement {
  const [secili, setSecili] = useState(aktif);

  function degistir(olay: React.FormEvent<HTMLFormElement>, kod: string) {
    olay.preventDefault();
    temayiUygula(cerezAdi, cerezYolu, kod);
    setSecili(kod);
  }

  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-cizgi bg-kart p-0.5">
      <span className="px-2 text-[11px] font-medium tracking-wide text-metin-yumusak uppercase">
        Tema
      </span>
      {temalar.map((tema) => {
        const seciliMi = tema.kod === secili;
        return (
          <form
            action={temaDegistirEylemi}
            key={tema.kod}
            data-cift-gonderim="serbest"
            onSubmit={(olay) => degistir(olay, tema.kod)}
          >
            <input type="hidden" name="tema" value={tema.kod} />
            <button
              type="submit"
              title={tema.aciklama}
              aria-pressed={seciliMi}
              className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase transition ${
                seciliMi
                  ? "bg-secili-zemin text-secili-metin"
                  : "text-metin-yumusak hover:text-metin"
              }`}
            >
              {tema.kod}
            </button>
          </form>
        );
      })}
    </div>
  );
}
