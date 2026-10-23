"use client";

import { Check } from "lucide-react";
import { useState, useTransition } from "react";
import { SINIF_BIRINCIL_BUTON, SINIF_GIRDI } from "@/components/ui";
import {
  KAYIT_OKUL_TURLERI,
  OKUL_LISTEDE_YOK,
  okulTuruUyarMi,
  SINIF_SEVIYELERI,
} from "@/lib/kayit/kurallar";

type Ilce = { ilceKodu: string; ad: string };
type Okul = { kurumKodu: number; ad: string; okulTuru: string; ilceKodu: string };

/**
 * Öğrencinin "Genel bilgiler" formu (23 Ekim 2026 · istek: "Ad soyad cinsiyet
 * okul okul türü ilçe il girecek sınıf kalacak … mevcut yapı düzenlenebilir
 * olsun").
 *
 * İstemci bileşeni, çünkü okul listesi il, ilçe ve türe bağlı: il değişince
 * ilçe ve okul listeleri sunucudan gelir (`veriGetir`), ilçe ve tür seçimi
 * listeyi tarayıcıda daraltır. Sunucu, seçilen okulun il/ilçe/tür uyumunu
 * ayrıca denetler (bkz. lib/ogrenci/genel-bilgiler.ts).
 */
export function GenelBilgilerDuzenleme({
  tip = "OGRENCI",
  baslangic,
  iller,
  ilkIlceler,
  ilkOkullar,
  kaydetEylemi,
  veriGetir,
}: {
  /** Öğretmen formunda sınıf yerine branş sorulur. */
  tip?: "OGRENCI" | "OGRETMEN";
  baslangic: {
    ad: string;
    soyad: string;
    cinsiyet: string;
    ilKodu: string;
    ilceKodu: string;
    okulTuru: string;
    /** Kurum kodu, `OKUL_LISTEDE_YOK` ya da boş. */
    okul: string;
    beyanOkulAdi: string;
    sinif: string;
    brans: string;
  };
  iller: { ilKodu: string; ad: string }[];
  ilkIlceler: Ilce[];
  ilkOkullar: Okul[];
  kaydetEylemi: (veri: FormData) => Promise<void>;
  veriGetir: (ilKodu: string) => Promise<{ ilceler: Ilce[]; okullar: Okul[] }>;
}) {
  const [ilKodu, setIlKodu] = useState(baslangic.ilKodu);
  const [ilceKodu, setIlceKodu] = useState(baslangic.ilceKodu);
  const [tur, setTur] = useState(baslangic.okulTuru);
  const [okul, setOkul] = useState(baslangic.okul);
  const [ilceler, setIlceler] = useState(ilkIlceler);
  const [okullar, setOkullar] = useState(ilkOkullar);
  const [yukleniyor, baslat] = useTransition();

  // "12-A" → seviye 12, şube A.
  const [ilkSeviye, ilkSube = ""] = baslangic.sinif.split("-");

  /*
   * İLÇE İSTEĞE BAĞLI (23 Ekim 2026): gerçek MEB ilçe listesi henüz
   * yüklenmedi. İlçe seçildiyse okul listesi ona göre daralır, seçilmediyse
   * ilin tamamından süzülür. Listesi boş ilde kutu kapalı basılır.
   */
  const ilceVar = ilceler.length > 0;
  const gosterilenler = okullar.filter(
    (o) =>
      (!ilceKodu || o.ilceKodu === ilceKodu) &&
      (!tur || okulTuruUyarMi(tur, o.okulTuru)),
  );
  const okulKapali = !tur || yukleniyor;

  function ilDegisti(yeni: string) {
    setIlKodu(yeni);
    setIlceKodu("");
    // Elle yazılan okul adı il değişince de korunur; listedeki seçim sıfırlanır.
    setOkul((o) => (o === OKUL_LISTEDE_YOK ? o : ""));
    setIlceler([]);
    setOkullar([]);
    if (!yeni) return;
    baslat(async () => {
      const veri = await veriGetir(yeni);
      setIlceler(veri.ilceler);
      setOkullar(veri.okullar);
    });
  }

  return (
    <form action={kaydetEylemi} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-metin">Ad</span>
          <input
            name="ad"
            required
            maxLength={100}
            defaultValue={baslangic.ad}
            autoComplete="given-name"
            className={SINIF_GIRDI}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-metin">Soyad</span>
          <input
            name="soyad"
            required
            maxLength={100}
            defaultValue={baslangic.soyad}
            autoComplete="family-name"
            className={SINIF_GIRDI}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-metin">Cinsiyet</span>
          <select
            name="cinsiyet"
            required
            defaultValue={
              baslangic.cinsiyet === "K" || baslangic.cinsiyet === "E"
                ? baslangic.cinsiyet
                : ""
            }
            className={SINIF_GIRDI}
          >
            <option value="">Seçiniz</option>
            <option value="K">Kadın</option>
            <option value="E">Erkek</option>
          </select>
        </label>
        {tip === "OGRETMEN" ? (
          // Öğretmende sınıf yok, yerine branş (23 Ekim 2026).
          <label className="block">
            <span className="text-sm font-medium text-metin">Branş</span>
            <input
              name="brans"
              required
              maxLength={100}
              defaultValue={baslangic.brans}
              placeholder="Bilişim Teknolojileri"
              className={SINIF_GIRDI}
            />
          </label>
        ) : (
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm font-medium text-metin">Sınıf</span>
            <select
              name="sinifSeviyesi"
              required
              defaultValue={
                (SINIF_SEVIYELERI as readonly string[]).includes(ilkSeviye)
                  ? ilkSeviye
                  : ""
              }
              className={SINIF_GIRDI}
            >
              <option value="">Seçiniz</option>
              {SINIF_SEVIYELERI.map((seviye) => (
                <option key={seviye} value={seviye}>
                  {seviye}. sınıf
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-metin">Şube</span>
            <input
              name="sube"
              maxLength={2}
              placeholder="A"
              defaultValue={ilkSube}
              className={SINIF_GIRDI}
            />
          </label>
        </div>
        )}
      </div>

      <div className="grid gap-4 border-t border-cizgi pt-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-metin">İl</span>
          <select
            name="ilKodu"
            required
            value={ilKodu}
            onChange={(olay) => ilDegisti(olay.target.value)}
            className={SINIF_GIRDI}
          >
            <option value="">Seçiniz</option>
            {iller.map((il) => (
              <option key={il.ilKodu} value={il.ilKodu}>
                {il.ad}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium text-metin">
            İlçe (isteğe bağlı)
          </span>
          <select
            name="ilceKodu"
            required={false}
            disabled={!ilKodu || yukleniyor || !ilceVar}
            value={ilceKodu}
            onChange={(olay) => {
              setIlceKodu(olay.target.value);
              // "Okulum listede yok" seçimi ilçe/tür değişince kaybolmasın.
              setOkul((o) => (o === OKUL_LISTEDE_YOK ? o : ""));
            }}
            className={SINIF_GIRDI}
          >
            <option value="">
              {yukleniyor
                ? "Yükleniyor…"
                : ilKodu && !ilceVar
                  ? "Bu il için ilçe listesi yok"
                  : "Seçiniz"}
            </option>
            {ilceler.map((ilce) => (
              <option key={ilce.ilceKodu} value={ilce.ilceKodu}>
                {ilce.ad}
              </option>
            ))}
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className="text-sm font-medium text-metin">Okul türü</span>
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
        <label className="block sm:col-span-2">
          <span className="text-sm font-medium text-metin">Okul</span>
          <select
            name="kurumKodu"
            required
            disabled={okulKapali}
            value={okul}
            onChange={(olay) => setOkul(olay.target.value)}
            className={SINIF_GIRDI}
          >
            <option value="">
              {!tur ? "Önce okul türünü seçin" : "Seçiniz"}
            </option>
            {gosterilenler.map((o) => (
              <option key={o.kurumKodu} value={o.kurumKodu}>
                {o.ad}
              </option>
            ))}
            <option value={OKUL_LISTEDE_YOK}>Okulum listede yok</option>
          </select>
        </label>
        {okul === OKUL_LISTEDE_YOK && (
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium text-metin">
              Okulunuzun adı
            </span>
            <input
              name="beyanOkulAdi"
              required
              maxLength={250}
              defaultValue={baslangic.beyanOkulAdi}
              placeholder="Örn. Çankaya Atatürk Anadolu Lisesi"
              className={SINIF_GIRDI}
            />
          </label>
        )}
      </div>

      <button type="submit" className={SINIF_BIRINCIL_BUTON}>
        <Check size={16} aria-hidden />
        Kaydet
      </button>
    </form>
  );
}
