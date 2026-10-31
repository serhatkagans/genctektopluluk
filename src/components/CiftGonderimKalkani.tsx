"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * ÇİFT GÖNDERİM KALKANI (31 Ekim 2026 · istek: "takılınca bir daha tıklamışım,
 * 3 kere eklemiş; çocuklar sertifika girerken 20 kere eklemiş").
 *
 * Formların gönder düğmesi istek sürerken hiçbir şey göstermiyordu; sunucu
 * yavaş cevap verince kişi yeniden tıklıyor ve her tıklama yeni bir kayıt
 * açıyordu. Uygulamada 60'tan fazla form var, hepsine tek tek bekleme durumu
 * eklemek yerine kalkan kök düzende BÜTÜN formları korur:
 *
 *   - Bir form gönderildiği anda "gönderiliyor" diye işaretlenir; işaret
 *     dururken aynı formun yeni gönderimi tarayıcıda durdurulur (React'e hiç
 *     ulaşmaz, sunucuya istek gitmez).
 *   - Düğmeler `disabled` YAPILMAZ: devre dışı düğmenin adı/değeri form
 *     verisinden düşer ve `islem=onayla` gibi alanlar kaybolurdu. Yalnızca
 *     görünüm değişir (bkz. globals.css · data-gonderiliyor).
 *   - İşaret, sayfa adresi değişince (eylem yönlendirdi) ya da süre dolunca
 *     kalkar. Süre, dosya indiren ve yönlendirmeyen formların kilitli
 *     kalmaması için.
 *
 * Asıl güvence sunucudadır (aynı kaydın kısa sürede tekrarı orada da
 * engelleniyor); bu kalkan kişiye "işleniyor" bilgisini verir ve gereksiz
 * istekleri keser.
 */

const KILIT_SURESI_MS = 30_000;

/**
 * Bekleme durumunu kendisi yöneten (useActionState) ve gönderimden sonra
 * sayfayı değiştirmeyen formlar `data-cift-gonderim="serbest"` ile dışarıda
 * kalır; yoksa başarılı bir işlemden sonra 30 saniye kilitli kalırlardı.
 */
function serbestMi(form: HTMLFormElement): boolean {
  return form.dataset.ciftGonderim === "serbest";
}

function kilidiKaldir(form: HTMLFormElement) {
  delete form.dataset.gonderiliyor;
  form.removeAttribute("aria-busy");
  form
    .querySelectorAll("[data-gonderilen]")
    .forEach((dugme) => dugme.removeAttribute("data-gonderilen"));
}

function kilitleriKaldir() {
  document
    .querySelectorAll<HTMLFormElement>("form[data-gonderiliyor]")
    .forEach(kilidiKaldir);
}

export function CiftGonderimKalkani() {
  const yol = usePathname();
  const sorgu = useSearchParams();

  useEffect(() => {
    const zamanlayicilar = new WeakMap<HTMLFormElement, number>();

    // Yakalama evresinde, React'ten ÖNCE çalışır.
    function yakala(olay: SubmitEvent) {
      const form = olay.target;
      if (!(form instanceof HTMLFormElement) || serbestMi(form)) return;
      if (form.dataset.gonderiliyor) {
        olay.preventDefault();
        olay.stopImmediatePropagation();
      }
    }

    // Kabarcık evresinde, React'ten SONRA: gönderim gerçekten başladıysa kilitle.
    function kilitle(olay: SubmitEvent) {
      const form = olay.target;
      if (!(form instanceof HTMLFormElement) || serbestMi(form)) return;
      if (form.dataset.gonderiliyor) return;
      // Tarayıcı doğrulaması geçmediyse submit olayı zaten tetiklenmez.
      form.dataset.gonderiliyor = "1";
      form.setAttribute("aria-busy", "true");
      /*
       * "KAYDEDİLİYOR…" (31 Ekim 2026 · istek). Basılan düğme işaretlenir,
       * yazıyı CSS basar (globals.css · data-gonderilen). Düğmenin metnine
       * dokunulmaz: o düğüm React'in, elle değiştirmek sonraki çizimi bozardı.
       * Enter ile gönderilen formda basılan düğme yoktur; ilk gönder düğmesi
       * işaretlenir.
       */
      const dugme =
        olay.submitter ??
        form.querySelector('button[type="submit"], button:not([type])');
      // Süzgeç gibi yalnızca liste getiren (GET) formlarda yazı basılmaz:
      // orada kaydedilen bir şey yok.
      if (form.getAttribute("method")?.toLowerCase() !== "get") {
        dugme?.setAttribute("data-gonderilen", "1");
      }
      const onceki = zamanlayicilar.get(form);
      if (onceki) window.clearTimeout(onceki);
      zamanlayicilar.set(
        form,
        window.setTimeout(() => kilidiKaldir(form), KILIT_SURESI_MS),
      );
    }

    document.addEventListener("submit", yakala, true);
    window.addEventListener("submit", kilitle);
    // Geri tuşuyla önbellekten dönülen sayfada kilit kalmasın.
    window.addEventListener("pageshow", kilitleriKaldir);
    return () => {
      document.removeEventListener("submit", yakala, true);
      window.removeEventListener("submit", kilitle);
      window.removeEventListener("pageshow", kilitleriKaldir);
    };
  }, []);

  /*
   * Eylem AYNI SAYFAYA döndüyse (?durum=… / ?hata=…) form yeniden
   * kullanılabilir: yorum yazan kişi ikincisini yazabilmeli, hatayı düzelten
   * kişi yeniden gönderebilmeli.
   *
   * BAŞKA SAYFAYA geçildiyse kilit KALKMAZ. Canlıda görülen (31 Ekim 2026):
   * 3 MB görselli etkinlik 11 saniyede kaydedildi, adres /etkinlikler/58'e
   * geçti ama yeni sayfa gelene kadar form ekranda kaldı; o arada iki tıklama
   * daha #59 ve #60'ı açtı. Eski form sayfadan kalkınca kilit de onunla gider.
   */
  const oncekiYol = useRef(yol);
  useEffect(() => {
    if (oncekiYol.current === yol) kilitleriKaldir();
    oncekiYol.current = yol;
  }, [yol, sorgu]);

  return null;
}
