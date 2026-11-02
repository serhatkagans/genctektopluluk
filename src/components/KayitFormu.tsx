"use client";

import { UserPlus } from "lucide-react";
import Link from "next/link";
import React, { useRef, useState, useTransition } from "react";
import { BilgiKutusu, SINIF_BIRINCIL_BUTON } from "@/components/ui";

type GirdiOgesi = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function girdiMi(oge: Element): oge is GirdiOgesi {
  return (
    oge instanceof HTMLInputElement ||
    oge instanceof HTMLSelectElement ||
    oge instanceof HTMLTextAreaElement
  );
}

/** Alanın ekrandaki adı: etiketin içindeki ilk yazı. */
function alanAdi(oge: GirdiOgesi): string {
  return (
    oge.closest("label")?.querySelector("span")?.textContent?.trim() ||
    "Bu alan"
  );
}

function gecersizlikMesaji(oge: GirdiOgesi): string {
  const ad = alanAdi(oge);
  const durum = oge.validity;
  if (durum.valueMissing) return `"${ad}" alanını doldurun.`;
  if (oge.name === "tcKimlikNo") return "T.C. kimlik numarası 11 rakam olmalı.";
  if (durum.tooShort && oge instanceof HTMLInputElement) {
    return `${ad} en az ${oge.minLength} karakter olmalı.`;
  }
  if (durum.typeMismatch) return `${ad} geçerli görünmüyor.`;
  return `${ad}: ${oge.validationMessage || "geçersiz değer."}`;
}

/**
 * Kayıt formunun kabuğu (2 Kasım 2026 · istekler: "full doldurmama rağmen bu
 * hatayı aldım" · "mobilden şifreniz 10 karakter olmalıdır uyarısı çıkmıyor,
 * buton çalışmıyor sandım").
 *
 * İKİ SORUN VARDI:
 *   1. Sunucu bir hata bulduğunda sayfayı yeniden açıyordu; kişinin yazdığı
 *      her şey siliniyordu. Artık eylem mesajı geri döndürüyor ve form
 *      olduğu gibi kalıyor.
 *   2. Tarayıcının kendi uyarı balonları (zorunlu alan, şifre uzunluğu) bazı
 *      telefonlarda görünmüyor; düğme hiçbir şey yapmıyor gibi duruyordu.
 *      Denetim burada yapılıyor ve mesaj düğmenin hemen üstünde YAZIYLA
 *      çıkıyor, hatalı alana da odaklanılıyor.
 */
export function KayitFormu({
  eylem,
  sifreAltSiniri,
  children,
}: {
  eylem: (veri: FormData) => Promise<{ hata: string } | undefined>;
  sifreAltSiniri: number;
  children: React.ReactNode;
}): React.ReactElement {
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, baslat] = useTransition();
  const hataKutusu = useRef<HTMLDivElement>(null);

  function hataGoster(mesaj: string, oge?: GirdiOgesi) {
    setHata(mesaj);
    if (oge) {
      oge.focus();
      oge.scrollIntoView({ block: "center", behavior: "smooth" });
    } else {
      requestAnimationFrame(() =>
        hataKutusu.current?.scrollIntoView({ block: "center", behavior: "smooth" }),
      );
    }
  }

  function gonder(olay: React.FormEvent<HTMLFormElement>) {
    olay.preventDefault();
    const form = olay.currentTarget;

    for (const oge of Array.from(form.elements)) {
      if (girdiMi(oge) && oge.willValidate && !oge.validity.valid) {
        hataGoster(gecersizlikMesaji(oge), oge);
        return;
      }
    }

    /*
     * Şifre uzunluğu ayrıca sayılıyor: tarayıcı `minLength`'i yalnızca elle
     * yazılan değerde denetliyor, otomatik doldurulan şifre gözden kaçabiliyor.
     */
    const sifre = form.elements.namedItem("sifre");
    const tekrar = form.elements.namedItem("sifreTekrar");
    if (sifre instanceof HTMLInputElement && tekrar instanceof HTMLInputElement) {
      if (sifre.value.length < sifreAltSiniri) {
        hataGoster(
          `Şifreniz en az ${sifreAltSiniri} karakter olmalı (şu an ${sifre.value.length}).`,
          sifre,
        );
        return;
      }
      if (sifre.value !== tekrar.value) {
        hataGoster("Şifre ile tekrarı aynı değil.", tekrar);
        return;
      }
    }

    setHata(null);
    const veri = new FormData(form);
    baslat(async () => {
      const sonuc = await eylem(veri);
      if (sonuc?.hata) hataGoster(sonuc.hata);
    });
  }

  return (
    <form noValidate onSubmit={gonder} className="mt-6 space-y-8">
      {children}

      {hata && (
        <div ref={hataKutusu} role="alert">
          <BilgiKutusu cesit="hata">{hata}</BilgiKutusu>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={bekliyor}
          className={SINIF_BIRINCIL_BUTON}
        >
          <UserPlus size={16} aria-hidden />
          {bekliyor ? "Kaydediliyor…" : "Kayıt ol"}
        </button>
        <Link href="/giris" className="text-sm font-medium text-vurgu-metin">
          Zaten hesabım var
        </Link>
      </div>
    </form>
  );
}
