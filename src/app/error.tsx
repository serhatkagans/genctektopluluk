"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  hataKimligiUret,
  istemciHatasiBildir,
} from "@/lib/istemci-hata-bildir";
import { surumHatasiMi, surumIcinYenile } from "@/lib/surum-yenileme";

/**
 * Beklenmeyen hata ekranı.
 *
 * Kullanıcıya teknik ayrıntı GÖSTERİLMEZ: yığın izi ve sorgu metni kişisel veri
 * sızdırabilir. Ayrıntı sunucu günlüğüne yazılır, kullanıcı yalnızca hatanın
 * kimliğini görür ve destek istediğinde onu iletir.
 *
 * EKRAN ARTIK SESSİZ DEĞİL (21 Ağustos 2026 · istek: "arada hata veriyor ancak
 * hata kayıtlarına nedeni işlenmiyor"). Burada yalnızca `console.error`
 * çağrılıyordu: sunucuda oluşan hatalar `instrumentation.ts` üzerinden günlüğe
 * düşüyor ama TARAYICIDA patlayan bir bileşenin hiçbir izi kalmıyordu — üstelik
 * o durumda `digest` de üretilmediği için kullanıcı ekranda numara bile
 * göremiyor, yöneticinin arayacağı bir ip ucu hiç doğmuyordu.
 *
 * Hata artık sunucuya bildiriliyor (lib/istemci-hata-bildir.ts) ve kimliği
 * olmayana yerel bir kimlik üretiliyor; ikisi de aynı günlüğe düşüyor, ekranda
 * gösterilen numara hata kayıtlarında aranabiliyor.
 */
export default function HataEkrani({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  /*
   * Kimlik İLK RENDER'DA bir kez üretiliyor (`useState` tembel başlangıcı):
   * yerel kimlik rastgele ve doğrudan render gövdesinde hesaplansaydı her
   * yeniden çizimde değişir, kullanıcı ekrandan okuduğu numarayı yazarken sayı
   * gözünün önünde başkalaşırdı. Bildirim ise yan etki olduğu için efektte.
   */
  const [kimlik] = useState(() => hataKimligiUret(error));

  useEffect(() => {
    // Güncelleme sonrası eski sürüm hatası: sayfa bir kez kendiliğinden
    // yenilenir, bildirim yapılmaz (bkz. lib/surum-yenileme.ts).
    if (surumHatasiMi(error) && surumIcinYenile()) return;
    console.error("İşlenmeyen hata:", error);
    istemciHatasiBildir(error, kimlik);
  }, [error, kimlik]);

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-12">
      <p className="mb-4 text-sm font-semibold tracking-wide text-metin-yumusak">
        GençTek Bilgi Sistemi
      </p>
      <div className="rounded-kart border border-hata-cizgi bg-hata-zemin px-6 py-5 text-hata-metin">
        <h1 className="flex items-center gap-2 text-lg font-semibold">
          <AlertTriangle size={20} aria-hidden />
          Beklenmeyen bir hata oluştu
        </h1>
        <p className="mt-2 text-sm">
          İşleminiz tamamlanamadı. Sayfayı yenilemeyi deneyebilir, sorun
          sürerse okul idareniz aracılığıyla destek isteyebilirsiniz.
        </p>
        {/*
          Kimlik, `digest` YOKKEN de basılıyor: istemci hatasında Next digest
          üretmiyor ve numarasız bir hata ekranı, kullanıcıya "destek isteyin"
          derken elini boş bırakıyordu. Yerel kimlik `i-` önekiyle geliyor;
          günlükte de aynı değer duruyor (bkz. lib/istemci-hata-bildir.ts).
        */}
        {kimlik && (
          <p className="mt-3 text-sm">
            Hata kimliği: <code className="font-mono">{kimlik}</code>
          </p>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-md bg-birincil px-4 py-2 text-sm font-semibold text-birincil-metin transition hover:bg-birincil-koyu"
        >
          <RotateCcw size={16} aria-hidden />
          Yeniden dene
        </button>
        <Link
          href="/panel"
          className="inline-flex items-center gap-2 rounded-md border border-cizgi px-4 py-2 text-sm font-medium text-metin transition hover:bg-zemin"
        >
          Panele dön
        </Link>
      </div>
    </main>
  );
}
