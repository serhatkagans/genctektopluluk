"use client";

import { useState } from "react";
import { SINIF_GIRDI } from "@/components/ui";
import {
  GUNCEL_DURUM_ETIKETLERI,
  GUNCEL_DURUMLAR,
} from "@/lib/dis-kimlik/kurallar";

/**
 * Mezun ve mentör başvurusunda "şu an ne yapıyorsunuz" bölümü (12 Kasım 2026 ·
 * istekler: "Mezun, üniversite, çalışıyor", "bir şirket çalışanı, şirketi olan
 * da olabilir").
 *
 * Seçilen duruma göre alanlar açılır. Hangi alanın zorunlu olduğuna sunucu
 * karar verir (bkz. lib/dis-kimlik/kurallar.ts · guncelDurumuCoz); burada
 * yalnızca gösterim var. Gizlenen alanlar DOM'dan kalkar ki forma
 * eski değerleri taşımasın.
 */
export function GuncelDurumAlanlari() {
  const [durum, setDurum] = useState("");

  const universiteMi = durum === "UNIVERSITE";
  const kurumSorulur =
    durum === "SIRKET_CALISANI" || durum === "SIRKET_SAHIBI" || durum === "DIGER";

  const kurumEtiketi =
    durum === "SIRKET_SAHIBI"
      ? "Şirketinizin adı"
      : durum === "SIRKET_CALISANI"
        ? "Çalıştığınız şirket"
        : "Çalıştığınız kurum (isteğe bağlı)";
  const pozisyonEtiketi =
    durum === "SIRKET_CALISANI"
      ? "Pozisyonunuz"
      : "Pozisyonunuz / unvanınız (isteğe bağlı)";

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="text-sm font-medium text-metin-yumusak">
          Şu anki durumunuz
        </legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {GUNCEL_DURUMLAR.map((kod) => (
            <label
              key={kod}
              className="flex cursor-pointer items-center gap-2 rounded-md border border-cizgi px-3 py-2 text-sm text-metin has-checked:border-vurgu"
            >
              <input
                type="radio"
                name="guncelDurum"
                value={kod}
                required
                checked={durum === kod}
                onChange={() => setDurum(kod)}
              />
              {GUNCEL_DURUM_ETIKETLERI[kod]}
            </label>
          ))}
        </div>
      </fieldset>

      {universiteMi && (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-metin-yumusak">
              Üniversite
            </span>
            <input
              name="universite"
              required
              maxLength={250}
              className={SINIF_GIRDI}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-metin-yumusak">
              Bölüm
            </span>
            <input name="bolum" required maxLength={150} className={SINIF_GIRDI} />
          </label>
        </div>
      )}

      {kurumSorulur && (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-metin-yumusak">
              {kurumEtiketi}
            </span>
            <input
              name="calistigiKurum"
              required={durum !== "DIGER"}
              maxLength={250}
              className={SINIF_GIRDI}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-metin-yumusak">
              {pozisyonEtiketi}
            </span>
            <input
              name="pozisyon"
              required={durum === "SIRKET_CALISANI"}
              maxLength={150}
              placeholder={durum === "SIRKET_SAHIBI" ? "Kurucu" : undefined}
              className={SINIF_GIRDI}
            />
          </label>
        </div>
      )}
    </div>
  );
}
