import { BadgeCheck, Check, X } from "lucide-react";
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
import { gorevKararEylemi } from "@/app/panel/genctek-gorevleri/eylemler";

/**
 * GençTek görev başvurularının karar kuyruğu.
 *
 * İKİ EKRANDA BASILIYOR (26 Ağustos 2026 · istek: "genctek görevleri hâlâ proje
 * yöneticisi onayına gitmiyor" → "/panel/talepler/onaylar buraya da gitmesi
 * gerekiyordu").
 *
 * Kuyruk baştan beri Yönetim Paneli'ndeki GençTek Görevleri ekranındaydı —
 * başvurular kaydediliyor, bildirim de gidiyordu. Eksik olan, merkezin onay
 * işlerini topladığı yerde görünmemesiydi: aynı kişi pano ilanlarını
 * `/panel/talepler/onaylar` ekranında karara bağlıyor ve görev başvurusunu
 * orada bulamıyordu.
 *
 * BİLEŞENE ÇIKARILDI, KOPYALANMADI: iki ekranda iki ayrı karar formu dursaydı
 * biri değişip öbürü geride kalırdı — gerekçenin zorunlu olduğu yer, düğme
 * adları, gösterilen alanlar. Karar eylemi de tek: `gorevKararEylemi`.
 *
 * `donus` yalnızca NEREYE DÖNÜLECEĞİNİ söyler, yetkiyi değiştirmez: eylem kendi
 * kapısını yeniden soruyor (gencTekGoreviYonetebilirMi). Kişi işi hangi
 * ekranda yaptıysa sonucunu da orada okumalı.
 */

export interface GorevBasvuruSatiri {
  id: number;
  mesaj: string;
  olusturmaTarihi: Date;
  gorev: { ad: string };
  kullanici: {
    ad: string;
    soyad: string;
    sinif: string | null;
    brans: string | null;
    kurum: { ad: string } | null;
    il: { ad: string } | null;
  };
}

export function GorevBasvuruKuyrugu({
  basvurular,
  donus,
  aciklama,
}: {
  /** Yalnızca KARAR BEKLEYENLER; süzme çağıranın işi. */
  basvurular: GorevBasvuruSatiri[];
  /** Karar verildikten sonra dönülecek ekran. */
  donus: "yonetim" | "onaylar";
  aciklama?: string;
}): React.ReactElement {
  return (
    <Kart>
      <KartBasligi
        baslik={`Karar bekleyen görev başvuruları (${basvurular.length})`}
        aciklama={aciklama}
        Ikon={BadgeCheck}
      />
      {basvurular.length === 0 ? (
        <p className="text-metin-yumusak">Karar bekleyen başvuru yok.</p>
      ) : (
        <ul className="space-y-4">
          {basvurular.map((basvuru) => (
            <li key={basvuru.id} className="rounded-kart border border-cizgi p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold text-baslik">
                  {basvuru.kullanici.ad} {basvuru.kullanici.soyad}
                </p>
                <Rozet cesit="vurgu">{basvuru.gorev.ad}</Rozet>
              </div>
              <p className="mt-0.5 text-sm text-metin-yumusak">
                {[
                  basvuru.kullanici.sinif ?? basvuru.kullanici.brans,
                  basvuru.kullanici.kurum?.ad,
                  /* İl okul olsa da yazılıyor (25 Kasım 2026 · istek: "hangi
                     ilden görebiliyor muyuz"); okul adı ili söylemiyor. */
                  basvuru.kullanici.il?.ad,
                  tarihSaatYaz(basvuru.olusturmaTarihi),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <p className="mt-3 whitespace-pre-line text-metin">
                {basvuru.mesaj}
              </p>

              {/*
                ONAY VE RET AYNI FORMDA, iki düğmeyle: gerekçe alanı ikisinde de
                basılı ama yalnızca ret onu ZORUNLU kılıyor (bkz.
                gorevKarariGecerliMi). Ayrı formlar, gerekçeyi yazıp yanlış
                düğmeye basmayı kolaylaştırırdı.
              */}
              <form
                action={gorevKararEylemi}
                className="mt-4 flex flex-wrap items-end gap-2"
              >
                <input type="hidden" name="basvuruId" value={basvuru.id} />
                <input type="hidden" name="donus" value={donus} />
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
                  Onayla
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
