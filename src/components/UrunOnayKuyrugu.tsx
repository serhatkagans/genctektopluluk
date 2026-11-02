import { Check, Package, X } from "lucide-react";
import Link from "next/link";
import React from "react";
import {
  Kart,
  KartBasligi,
  Rozet,
  SINIF_BIRINCIL_BUTON,
  SINIF_GIRDI,
  SINIF_IKINCIL_BUTON,
} from "@/components/ui";
import { tarihSaatYaz } from "@/lib/tarih";
import { urunMarketKarariEylemi } from "@/app/panel/urunler/eylemler";

/**
 * Markette yayımlanmayı bekleyen ürünler.
 *
 * 26 Ağustos 2026 · istek: "markette paylaşılmadı yerine onay bekliyor yazsın
 * ve proje yöneticisine gitsin onaya, öğretmen içinde".
 *
 * Market vitrini onaydan geçmiyordu: "paylaş" işaretini koyan herkesin ürünü
 * doğrudan ülke geneline açık vitrine çıkıyordu. Kuyruk, merkezin öbür onay
 * işlerinin yanına kondu — pano ilanları ve GençTek görev başvurularıyla aynı
 * ekranda.
 *
 * KURAL ÖĞRENCİ / ÖĞRETMEN AYRIMI YAPMAZ: istek öğretmeni işaret ediyor ("bir
 * de öğretmen için") ama vitrin ikisinin ürününü yan yana gösteriyor ve
 * ikisinin de sorumluluğu aynı. Ayrı kural yazmak, öğrencinin ürününü
 * onaysız yayımlamak olurdu.
 */

export interface OnayBekleyenUrun {
  id: number;
  baslik: string;
  aciklama: string | null;
  gelistirenEkip: string | null;
  olusturmaTarihi: Date;
  kullanici: {
    ad: string;
    soyad: string;
    kurum: { ad: string } | null;
    il: { ad: string } | null;
  };
}

export function UrunOnayKuyrugu({
  urunler,
}: {
  /** Yalnızca KARAR BEKLEYENLER; süzme çağıranın işi. */
  urunler: OnayBekleyenUrun[];
}): React.ReactElement {
  return (
    <Kart>
      <KartBasligi
        baslik={`Vitrinde yayım bekleyen ürünler (${urunler.length})`}
        aciklama="Onaylanan ürün GençTek Vitrin'de herkese görünür. Reddedilen ürün silinmez; sahibinde kalır ve gerekçe kendisine iletilir."
        Ikon={Package}
      />
      {urunler.length === 0 ? (
        <p className="text-metin-yumusak">Karar bekleyen ürün yok.</p>
      ) : (
        <ul className="space-y-4">
          {urunler.map((urun) => (
            <li key={urun.id} className="rounded-kart border border-cizgi p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                {/*
                  BAŞLIK ÜRÜNÜN KENDİ SAYFASINA GİDİYOR: karar vermek için
                  ürünün açıklamasını, görsellerini ve bağlantılarını görmek
                  gerekiyor ve onlar burada değil, ürün sayfasında. Onay
                  bekleyen ürünü merkez de görebiliyor (bkz. urunGorunurMu —
                  kapı sahibine ve vitrine bakıyor; merkez kuyruğa bu
                  bağlantıyla giriyor).
                */}
                <Link
                  href={`/panel/urunler/${urun.id}`}
                  className="font-semibold text-baslik underline-offset-2 hover:text-vurgu-metin hover:underline"
                >
                  {urun.baslik}
                </Link>
                <Rozet cesit="vurgu">
                  {urun.kullanici.ad} {urun.kullanici.soyad}
                </Rozet>
              </div>
              <p className="mt-0.5 text-sm text-metin-yumusak">
                {[
                  urun.gelistirenEkip,
                  urun.kullanici.kurum?.ad ?? urun.kullanici.il?.ad,
                  tarihSaatYaz(urun.olusturmaTarihi),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {/*
                AÇIKLAMA KESİLMEDEN (2 Kasım 2026 · istek: "vitrine bir şeyler
                giriliyor ama ne olduğu belli değil, onaylayacak kişi ne
                olduğunu göremiyor"). Dört satırda kesiliyordu; karar
                verilecek metin yarım okunmamalı.
              */}
              {urun.aciklama && (
                <p className="mt-3 whitespace-pre-line text-metin">
                  {urun.aciklama}
                </p>
              )}
              <p className="mt-2">
                <Link
                  href={`/panel/urunler/${urun.id}`}
                  className="text-sm font-medium text-vurgu-metin underline underline-offset-2"
                >
                  Görselleri ve bağlantılarıyla ürün sayfasını aç
                </Link>
              </p>

              {/*
                ONAY VE RET AYNI FORMDA, iki düğmeyle: gerekçe alanı ikisinde de
                basılı ama yalnızca ret onu ZORUNLU kılıyor (bkz.
                urunMarketKarariGecerliMi).
              */}
              <form
                action={urunMarketKarariEylemi}
                className="mt-4 flex flex-wrap items-end gap-2"
              >
                <input type="hidden" name="urunId" value={urun.id} />
                <label className="block grow">
                  <span className="text-sm font-medium text-metin">
                    Gerekçe{" "}
                    <span className="text-metin-yumusak">(rette zorunlu)</span>
                  </span>
                  <input
                    type="text"
                    name="gerekce"
                    maxLength={500}
                    className={SINIF_GIRDI}
                  />
                </label>
                <button
                  type="submit"
                  name="karar"
                  value="onayla"
                  className={SINIF_BIRINCIL_BUTON}
                >
                  <Check size={15} aria-hidden />
                  Yayımla
                </button>
                <button
                  type="submit"
                  name="karar"
                  value="reddet"
                  className={SINIF_IKINCIL_BUTON}
                >
                  <X size={15} aria-hidden />
                  Reddet
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </Kart>
  );
}
