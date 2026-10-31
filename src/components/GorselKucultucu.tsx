"use client";

import { useEffect } from "react";

/**
 * GÖRSEL KÜÇÜLTÜCÜ (31 Ekim 2026 · istek: "görselin otomatik küçültülmesi").
 *
 * Canlıda görülen: 3,3 MB'lık bir PNG ile açılan etkinlik 11 saniyede
 * kaydedildi; bekleyen kişi yeniden tıkladı ve etkinlik üç kez açıldı. Süreyi
 * dosyanın TARAYICIDAN SUNUCUYA gidişi belirliyor — sunucuda küçültmek bu
 * bekleyişi kısaltmazdı. Bu yüzden küçültme tarayıcıda, gönderimden ÖNCE:
 *
 *   - Bir dosya kutusunda görsel seçilince (jpg, png, webp) uzun kenarı
 *     EN_BUYUK_KENAR'ı ya da boyutu ESIK_BAYT'ı aşıyorsa yeniden çizilir.
 *   - PNG/WebP, kutu WebP kabul ediyorsa WebP'ye çevrilir (saydamlık korunur);
 *     etmiyorsa kendi biçiminde kalır. JPG yine JPG olur.
 *   - Sonuç asıl dosyadan büyükse asıl dosya bırakılır. PDF ve diğer belgelere
 *     dokunulmaz. Tarayıcı desteklemezse (eski tarayıcı) hiçbir şey değişmez.
 *   - Küçültme sürerken form gönderilirse gönderim bekletilir, iş bitince
 *     kendiliğinden yapılır.
 *
 * Sunucudaki boyut ve tür denetimleri olduğu gibi duruyor; bu katman yalnızca
 * gönderilen dosyayı küçültür.
 */

const EN_BUYUK_KENAR = 2000;
const ESIK_BAYT = 1024 * 1024;
const KALITE = 0.85;
const GORSEL_TURLERI = ["image/jpeg", "image/png", "image/webp"];

function webpKabulMu(girdi: HTMLInputElement): boolean {
  const kabul = girdi.accept.toLowerCase();
  return (
    kabul === "" || kabul.includes("image/webp") || kabul.includes("image/*")
  );
}

async function kucult(dosya: File, webpOlabilir: boolean): Promise<File> {
  if (!GORSEL_TURLERI.includes(dosya.type)) return dosya;

  const bitmap = await createImageBitmap(dosya);
  const uzunKenar = Math.max(bitmap.width, bitmap.height);
  if (uzunKenar <= EN_BUYUK_KENAR && dosya.size <= ESIK_BAYT) {
    bitmap.close();
    return dosya;
  }

  const oran = Math.min(1, EN_BUYUK_KENAR / uzunKenar);
  const genislik = Math.round(bitmap.width * oran);
  const yukseklik = Math.round(bitmap.height * oran);
  const tuval = document.createElement("canvas");
  tuval.width = genislik;
  tuval.height = yukseklik;
  const cizim = tuval.getContext("2d");
  if (!cizim) {
    bitmap.close();
    return dosya;
  }
  cizim.drawImage(bitmap, 0, 0, genislik, yukseklik);
  bitmap.close();

  const hedefTur =
    dosya.type === "image/jpeg"
      ? "image/jpeg"
      : webpOlabilir
        ? "image/webp"
        : dosya.type;
  const blob = await new Promise<Blob | null>((coz) =>
    tuval.toBlob(coz, hedefTur, KALITE),
  );
  // Tarayıcı istenen türü üretemediyse (toBlob png'ye düşer) dokunma.
  if (!blob || blob.type !== hedefTur || blob.size >= dosya.size) return dosya;

  const uzanti = hedefTur === "image/jpeg" ? "jpg" : hedefTur.split("/")[1];
  const ad = dosya.name.replace(/\.[^.]+$/, "") + "." + uzanti;
  return new File([blob], ad, { type: hedefTur, lastModified: Date.now() });
}

export function GorselKucultucu() {
  useEffect(() => {
    if (
      typeof createImageBitmap !== "function" ||
      typeof DataTransfer !== "function"
    ) {
      return;
    }

    // Küçültmesi süren formlar ve bittiğinde gönderilecek düğme.
    const bekleyenler = new Map<HTMLFormElement, Promise<void>>();
    const gonderilecek = new WeakMap<HTMLFormElement, HTMLElement | null>();

    function degisti(olay: Event) {
      const girdi = olay.target;
      if (!(girdi instanceof HTMLInputElement) || girdi.type !== "file") return;
      const dosyalar = Array.from(girdi.files ?? []);
      if (!dosyalar.some((dosya) => GORSEL_TURLERI.includes(dosya.type))) {
        return;
      }

      const form = girdi.form;
      const is = (async () => {
        try {
          const yeniler = await Promise.all(
            dosyalar.map((dosya) =>
              kucult(dosya, webpKabulMu(girdi)).catch(() => dosya),
            ),
          );
          if (yeniler.every((yeni, sira) => yeni === dosyalar[sira])) return;
          const aktarim = new DataTransfer();
          yeniler.forEach((yeni) => aktarim.items.add(yeni));
          girdi.files = aktarim.files;
        } finally {
          if (form) bekleyenler.delete(form);
        }
      })();

      if (form) {
        bekleyenler.set(form, is);
        is.then(() => {
          if (!gonderilecek.has(form)) return;
          const dugme = gonderilecek.get(form);
          gonderilecek.delete(form);
          form.requestSubmit(
            dugme instanceof HTMLButtonElement ||
              dugme instanceof HTMLInputElement
              ? dugme
              : undefined,
          );
        });
      }
    }

    // Küçültme bitmeden gönderilen form bekletilir (React'e ulaşmadan).
    function gonderiliyor(olay: SubmitEvent) {
      const form = olay.target;
      if (!(form instanceof HTMLFormElement) || !bekleyenler.has(form)) return;
      olay.preventDefault();
      olay.stopImmediatePropagation();
      gonderilecek.set(form, olay.submitter);
    }

    document.addEventListener("change", degisti, true);
    document.addEventListener("submit", gonderiliyor, true);
    return () => {
      document.removeEventListener("change", degisti, true);
      document.removeEventListener("submit", gonderiliyor, true);
    };
  }, []);

  return null;
}
