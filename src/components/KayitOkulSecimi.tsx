"use client";

import { useState } from "react";
import { SINIF_GIRDI } from "@/components/ui";
import {
  KAYIT_OKUL_TURLERI,
  OKUL_LISTEDE_YOK,
  okulTuruUyarMi,
} from "@/lib/kayit/kurallar";

/**
 * Kayıt formunun okul seçimi (23 Ekim 2026 · istekler: "öğrenci girişinde okul
 * türü de gelsin, yani öğrenci okul türünü listeden seçebilsin" · "listede
 * yoksa giriş yapamıyor onu da input ile okul isimlerini alalım").
 *
 * Öğrencide önce okul türü seçilir, okul listesi o türe daralır. Listenin
 * sonunda "Okulum listede yok" seçeneği var; seçilince okul adı kutusu açılır.
 *
 * Süzme yalnızca kolaylıktır: sunucu, seçilen okulun türüyle seçilen türü
 * ayrıca karşılaştırır (bkz. lib/kayit/kayit.ts).
 */
export function KayitOkulSecimi({
  okullar,
  ilAdi,
  turSecilsin,
}: {
  okullar: { kurumKodu: number; ad: string; okulTuru: string }[];
  ilAdi: string;
  /** Yalnızca öğrencide okul türü sorulur. */
  turSecilsin: boolean;
}) {
  const [tur, setTur] = useState("");
  const [okul, setOkul] = useState("");

  const gosterilenler =
    turSecilsin && tur
      ? okullar.filter((o) => okulTuruUyarMi(tur, o.okulTuru))
      : okullar;
  const listedeYok = okul === OKUL_LISTEDE_YOK;
  // Öğrenci türü seçmeden okul seçemez; liste aksi hâlde süzülmemiş gelirdi.
  const okulKapali = turSecilsin && !tur;

  return (
    <>
      {turSecilsin && (
        <label className="block sm:col-span-2">
          <span className="text-sm font-medium text-metin-yumusak">
            Okul türü
          </span>
          <select
            name="okulTuru"
            required
            value={tur}
            onChange={(olay) => {
              setTur(olay.target.value);
              // "Okulum listede yok" seçimi ilçe/tür değişince kaybolmasın.
              setOkul((o) => (o === OKUL_LISTEDE_YOK ? o : ""));
            }}
            className={SINIF_GIRDI}
          >
            <option value="">Seçiniz</option>
            {KAYIT_OKUL_TURLERI.map((secenek) => (
              <option key={secenek} value={secenek}>
                {secenek}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="block sm:col-span-2">
        <span className="text-sm font-medium text-metin-yumusak">Okul</span>
        <select
          name="kurumKodu"
          required
          disabled={okulKapali}
          value={okul}
          onChange={(olay) => setOkul(olay.target.value)}
          className={SINIF_GIRDI}
        >
          <option value="">
            {okulKapali ? "Önce okul türünü seçin" : "Seçiniz"}
          </option>
          {gosterilenler.map((o) => (
            <option key={o.kurumKodu} value={o.kurumKodu}>
              {o.ad}
            </option>
          ))}
          <option value={OKUL_LISTEDE_YOK}>Okulum listede yok</option>
        </select>
        <span className="mt-1 block text-xs text-metin-yumusak">
          {turSecilsin && tur
            ? `${ilAdi} ilindeki ${tur === "Diğer" ? "diğer türdeki" : tur} okulları listeleniyor.`
            : `Yalnızca ${ilAdi} ilindeki okullar listeleniyor.`}
        </span>
      </label>

      {listedeYok && (
        <label className="block sm:col-span-2">
          <span className="text-sm font-medium text-metin-yumusak">
            Okulunuzun adı
          </span>
          <input
            name="beyanOkulAdi"
            required
            maxLength={250}
            placeholder="Örn. Çankaya Atatürk Anadolu Lisesi"
            className={SINIF_GIRDI}
          />
          <span className="mt-1 block text-xs text-metin-yumusak">
            Okulunuz sonradan proje yöneticisi tarafından listeye eklenir.
          </span>
        </label>
      )}
    </>
  );
}
