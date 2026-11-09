import { Link2, School, Unlink, UsersRound } from "lucide-react";
import Link from "next/link";
import { ILLER } from "../../../../../prisma/veri/iller";
import {
  BilgiKutusu,
  Kart,
  KartBasligi,
  Rozet,
  SayfaBasligi,
  SINIF_BIRINCIL_BUTON,
  SINIF_GIRDI,
  SINIF_IKINCIL_BUTON,
} from "@/components/ui";
import { oturumKullanicisiZorunlu } from "@/lib/auth/oturum";
import { prisma } from "@/lib/db";
import {
  enSikDeger,
  geciciKurumKoduMu,
  kisileriGrupla,
  okulAdiDuzelt,
  okulOnerisi,
  okulTuruTahmin,
} from "@/lib/okul/eslestirme";
import {
  ilBazindaOkulsuzSayilari,
  ildekiOkullar,
  okulsuzKisiler,
} from "@/lib/okul/eslestirme-islem";
import { okulTuruSecenekleri } from "@/lib/okul/turler";
import {
  koordinatorIlKodu,
  okulEslestirebilirMi,
  projeYoneticisiMi,
} from "@/lib/yetki/izinler";
import {
  okulaBaglaEylemi,
  okulAdiDegistirEylemi,
  okuldanAyirEylemi,
} from "./eylemler";

export const dynamic = "force-dynamic";

const YOL = "/panel/yonetim/okul-eslestirme";

/**
 * OKUL EŞLEŞTİRME (9 Kasım 2026 · istekler: "proje yöneticisi aynı adla
 * yazılmış öğrencileri grup halinde görür ve tek tıkla doğru okula bağlar" ·
 * "koordinatör ilindekileri atasın ya da bağlasın" · "gerçek okulları olsun
 * herkesin"). Gerekçe ve geçici kurum kodu: lib/okul/eslestirme.ts.
 *
 * AKIŞ: okulunu elle yazmış kişiler (öğrenci, danışman öğretmen, il
 * koordinatörü) benzer yazımlara göre gruplanır. Her grupta kişiler işaretli
 * gelir; okul ya ilin kayıtlı okullarından seçilir (benzer adlı olan önceden
 * seçili) ya da aynı formda yeni eklenir. Eklenen okul o andan itibaren kayıt
 * ve profil ekranlarının okul listesinde de çıkar — yeni gelen artık elle
 * yazmaz.
 *
 * KOORDİNATÖR kendi ilini görür, il seçemez. MERKEZ önce il özetini görür ve
 * bir il seçer: 81 ilin bütün grupları tek sayfada yüzlerce form ederdi.
 *
 * GERİ ALINABİLİR: alttaki "Bu ildeki okullar" bölümünde her okulun
 * kişileri listelenir; yanlış bağlanan kişi "Ayır" ile listeye geri döner.
 */
export default async function OkulEslestirmeSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ il?: string; durum?: string; hata?: string }>;
}) {
  const kullanici = await oturumKullanicisiZorunlu();
  if (!okulEslestirebilirMi(kullanici)) {
    return (
      <Kart>
        <KartBasligi
          baslik="Okul eşleştirme"
          aciklama="Bu ekran il koordinatörüne ve proje yöneticisine açıktır."
        />
      </Kart>
    );
  }

  const { il, durum, hata } = await searchParams;
  const merkez = projeYoneticisiMi(kullanici);
  const ilKodu = merkez
    ? il && /^\d{2}$/.test(il)
      ? il
      : null
    : koordinatorIlKodu(kullanici);
  const ilAdi = (kod: string | null) =>
    ILLER.find((kayit) => kayit.ilKodu === kod)?.ad ?? "—";

  const baslik = (
    <>
      <SayfaBasligi
        baslik="Okul eşleştirme"
        aciklama="Okulunu kayıtta elle yazan kişileri gerçek okuluna bağlayın. Aynı okulu yazanlar bir grupta; okulu listeden seçin ya da yoksa ekleyin."
        geri={{ yol: "/panel/yonetim", etiket: "Yönetim Paneli" }}
      />
      {durum && <BilgiKutusu cesit="olumlu">{durum}</BilgiKutusu>}
      {hata && <BilgiKutusu cesit="hata">{hata}</BilgiKutusu>}
    </>
  );

  // Merkez, il seçmeden: illerin özeti.
  if (!ilKodu) {
    const sayilar = await ilBazindaOkulsuzSayilari();
    const satirlar = ILLER.map((kayit) => ({
      ...kayit,
      sayi: sayilar.get(kayit.ilKodu) ?? 0,
    }))
      .filter((satir) => satir.sayi > 0)
      .sort((a, b) => b.sayi - a.sayi || a.ad.localeCompare(b.ad, "tr"));
    const toplam = satirlar.reduce((t, s) => t + s.sayi, 0);
    return (
      <div className="space-y-6">
        {baslik}
        <Kart>
          <KartBasligi
            baslik="Okulu eşleşmemiş kişiler"
            aciklama={
              toplam === 0
                ? "Okulunu elle yazmış kimse kalmadı."
                : `${toplam} kişi, ${satirlar.length} il. Bir il seçin.`
            }
            Ikon={School}
          />
          {satirlar.length > 0 && (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {satirlar.map((satir) => (
                <li key={satir.ilKodu}>
                  <Link
                    href={`${YOL}?il=${satir.ilKodu}`}
                    className="flex items-center justify-between rounded-kutu border border-cizgi px-3 py-2 text-sm text-metin transition hover:border-vurgu hover:bg-zemin"
                  >
                    <span>{satir.ad}</span>
                    <span className="text-metin-yumusak">{satir.sayi} kişi</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Kart>
      </div>
    );
  }

  const [kisiler, okullar, ilceler] = await Promise.all([
    okulsuzKisiler(ilKodu),
    ildekiOkullar(ilKodu),
    prisma.ilce.findMany({
      where: { ilKodu },
      orderBy: { ad: "asc" },
      select: { ilceKodu: true, ad: true },
    }),
  ]);
  const ilceAdi = (kod: string | null) =>
    ilceler.find((ilce) => ilce.ilceKodu === kod)?.ad ?? null;
  const gruplar = kisileriGrupla(kisiler);
  const turler = okulTuruSecenekleri();
  const geciciOkulVar = okullar.some((okul) => geciciKurumKoduMu(okul.kurumKodu));

  return (
    <div className="space-y-6">
      {baslik}

      {merkez && (
        <p className="text-sm">
          <Link href={YOL} className="text-vurgu-metin hover:underline">
            ← Tüm iller
          </Link>
        </p>
      )}

      <BilgiKutusu>
        <strong>{ilAdi(ilKodu)}</strong> · {kisiler.length} kişinin okulu
        eşleşmemiş, {gruplar.length} grup. Grupta yanlış kişi varsa işaretini
        kaldırın; o kişi listede kalır. Bağlanan kişinin ilçesi okulun ilçesi
        olur. Eklediğiniz okul kayıt ekranındaki okul listesinde de çıkar.
      </BilgiKutusu>

      {gruplar.length === 0 ? (
        <BilgiKutusu cesit="olumlu">
          {ilAdi(ilKodu)} ilinde okulu eşleşmemiş kimse kalmadı.
        </BilgiKutusu>
      ) : (
        gruplar.map((grup, sira) => {
          const oneri = okulOnerisi(grup.okulAdi, okullar);
          const varsayilanIlce =
            enSikDeger(grup.kisiler.map((kisi) => kisi.ilceKodu)) ?? "";
          const varsayilanTur =
            enSikDeger(grup.kisiler.map((kisi) => kisi.beyanOkulTuru)) ??
            okulTuruTahmin(grup.okulAdi) ??
            "";
          return (
            <Kart key={`${grup.okulAdi}-${sira}`}>
              <KartBasligi
                baslik={grup.okulAdi}
                aciklama={`${grup.kisiler.length} kişi bu adla ya da benzeriyle yazmış`}
                Ikon={UsersRound}
              />
              <form action={okulaBaglaEylemi} className="space-y-4">
                <input type="hidden" name="il" value={ilKodu} />
                <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {grup.kisiler.map((kisi) => (
                    <li key={kisi.id}>
                      <label className="flex items-start gap-2 rounded-kutu border border-cizgi px-3 py-2 text-sm text-metin has-checked:border-vurgu">
                        <input
                          type="checkbox"
                          name="kisiId"
                          value={kisi.id}
                          defaultChecked
                          className="mt-1"
                        />
                        <span className="min-w-0">
                          <span className="font-medium">
                            {kisi.ad} {kisi.soyad}
                          </span>
                          <span className="block text-xs text-metin-yumusak">
                            {kisi.rol}
                            {kisi.sinif ? ` · ${kisi.sinif}. sınıf` : ""}
                            {kisi.brans ? ` · ${kisi.brans}` : ""}
                            {ilceAdi(kisi.ilceKodu)
                              ? ` · ${ilceAdi(kisi.ilceKodu)}`
                              : " · ilçe yok"}
                          </span>
                          {okulAdiDuzelt(kisi.beyanOkulAdi) !== grup.okulAdi ? (
                            <span className="block break-words text-xs text-metin-yumusak">
                              yazdığı: “{kisi.beyanOkulAdi}”
                            </span>
                          ) : null}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>

                <div className="grid gap-3 rounded-kutu border border-cizgi p-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                  <label className="block">
                    <span className="text-sm font-medium text-metin">
                      Bağlanacak okul
                    </span>
                    <select
                      name="kurumKodu"
                      defaultValue={oneri ? String(oneri.kurumKodu) : "yeni"}
                      className={SINIF_GIRDI}
                    >
                      <option value="yeni">+ Yeni okul olarak ekle (sağdaki bilgilerle)</option>
                      {okullar.map((okul) => (
                        <option key={okul.kurumKodu} value={okul.kurumKodu}>
                          {oneri?.kurumKodu === okul.kurumKodu ? "★ " : ""}
                          {okul.ad}
                          {okul.ilce?.ad ? ` · ${okul.ilce.ad}` : ""}
                        </option>
                      ))}
                    </select>
                    {oneri && (
                      <span className="mt-1 block text-xs text-metin-yumusak">
                        ★ adı benzeyen kayıtlı okul önceden seçildi.
                      </span>
                    )}
                  </label>

                  <fieldset className="grid gap-3 sm:grid-cols-3">
                    <legend className="sr-only">Yeni okul bilgileri</legend>
                    <label className="block sm:col-span-3">
                      <span className="text-sm font-medium text-metin">
                        Yeni okulun adı
                      </span>
                      <input
                        name="yeniAd"
                        defaultValue={grup.okulAdi}
                        maxLength={250}
                        className={SINIF_GIRDI}
                      />
                    </label>
                    <label className="block sm:col-span-2">
                      <span className="text-sm font-medium text-metin">İlçe</span>
                      <select
                        name="yeniIlce"
                        defaultValue={varsayilanIlce}
                        className={SINIF_GIRDI}
                      >
                        <option value="">Seçiniz</option>
                        {ilceler.map((ilce) => (
                          <option key={ilce.ilceKodu} value={ilce.ilceKodu}>
                            {ilce.ad}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-sm font-medium text-metin">Tür</span>
                      <select
                        name="yeniTur"
                        defaultValue={varsayilanTur}
                        className={SINIF_GIRDI}
                      >
                        <option value="">Seçiniz</option>
                        {turler.map((tur) => (
                          <option key={tur} value={tur}>
                            {tur}
                          </option>
                        ))}
                      </select>
                    </label>
                    <p className="text-xs text-metin-yumusak sm:col-span-3">
                      Bu alanlar yalnızca “Yeni okul olarak ekle” seçiliyken
                      kullanılır.
                    </p>
                  </fieldset>
                </div>

                <button type="submit" className={SINIF_BIRINCIL_BUTON}>
                  <Link2 size={16} aria-hidden />
                  İşaretlileri okula bağla
                </button>
              </form>
            </Kart>
          );
        })
      )}

      <Kart>
        <KartBasligi
          baslik={`${ilAdi(ilKodu)} · kayıtlı okullar`}
          aciklama={
            okullar.length === 0
              ? "Bu ilde henüz kayıtlı okul yok; yukarıdan eklediğiniz okullar burada listelenir."
              : `${okullar.length} okul. Yanlış bağlanan kişiyi “Ayır” ile listeye geri gönderebilirsiniz.`
          }
          Ikon={School}
        />
        {geciciOkulVar && (
          <p className="mb-3 text-xs text-metin-yumusak">
            “Geçici kod” rozetli okullar bu ekrandan eklendi; MEB kurum kodu
            henüz girilmedi.
          </p>
        )}
        {okullar.length > 0 && (
          <ul className="space-y-2">
            {okullar.map((okul) => {
              const gecici = geciciKurumKoduMu(okul.kurumKodu);
              return (
                <li key={okul.kurumKodu}>
                  <details className="rounded-kutu border border-cizgi">
                    <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-3 py-2 text-sm text-metin">
                      <span className="font-medium">{okul.ad}</span>
                      <span className="text-metin-yumusak">
                        {okul.ilce?.ad ?? "—"} · {okul.okulTuru} ·{" "}
                        {okul.kisiler.length} kişi
                      </span>
                      {gecici && <Rozet cesit="uyari">Geçici kod</Rozet>}
                    </summary>
                    <div className="space-y-3 border-t border-cizgi px-3 py-3">
                      {gecici && (
                        <form
                          action={okulAdiDegistirEylemi}
                          className="flex flex-wrap items-end gap-2"
                        >
                          <input type="hidden" name="kurumKodu" value={okul.kurumKodu} />
                          <label className="block min-w-64 flex-1">
                            <span className="text-xs font-medium text-metin-yumusak">
                              Okulun adı
                            </span>
                            <input
                              name="ad"
                              defaultValue={okul.ad}
                              maxLength={250}
                              required
                              className={SINIF_GIRDI}
                            />
                          </label>
                          <button type="submit" className={SINIF_IKINCIL_BUTON}>
                            Adı kaydet
                          </button>
                        </form>
                      )}
                      {okul.kisiler.length === 0 ? (
                        <p className="text-sm text-metin-yumusak">
                          Bu okula bağlı kimse yok.
                        </p>
                      ) : (
                        <ul className="grid gap-2 sm:grid-cols-2">
                          {okul.kisiler.map((kisi) => (
                            <li
                              key={kisi.id}
                              className="flex items-center justify-between gap-2 rounded-kutu bg-zemin px-3 py-1.5 text-sm"
                            >
                              <span className="min-w-0">
                                {kisi.ad} {kisi.soyad}
                                <span className="text-metin-yumusak">
                                  {" "}
                                  · {kisi.rol}
                                </span>
                              </span>
                              <form action={okuldanAyirEylemi}>
                                <input type="hidden" name="kisiId" value={kisi.id} />
                                <button
                                  type="submit"
                                  title="Okul bağlantısını kaldır"
                                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-metin-yumusak transition hover:bg-kart hover:text-hata-metin"
                                >
                                  <Unlink size={12} aria-hidden />
                                  Ayır
                                </button>
                              </form>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </Kart>
    </div>
  );
}
