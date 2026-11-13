import { Star, UserCheck, UsersRound } from "lucide-react";
import Link from "next/link";
import { ILLER } from "../../../../../prisma/veri/iller";
import { OtomatikSecimKutusu } from "@/components/SuzgecOtomatikSecim";
import {
  BilgiKutusu,
  Kart,
  KartBasligi,
  SayfaBasligi,
  SINIF_BIRINCIL_BUTON,
  SINIF_GIRDI,
} from "@/components/ui";
import { oturumKullanicisiZorunlu } from "@/lib/auth/oturum";
import { ildekiDanismanlar, koordinatorleriIlleriyleGetir } from "@/lib/danisman/atama";
import { prisma } from "@/lib/db";
import { okulAdiBenzerMi } from "@/lib/okul/benzerlik";
import {
  danismanAtayabilirMi,
  koordinatorIlKodu,
  projeYoneticisiMi,
} from "@/lib/yetki/izinler";
import { ogrenciKapsamFiltresi } from "@/lib/yetki/kapsam";
import { topluDanismanAtaEylemi } from "./eylemler";

export const dynamic = "force-dynamic";

/** Bir seferde listelenen danışmansız öğrenci üst sınırı. */
const OGRENCI_SINIRI = 500;

/**
 * TOPLU DANIŞMAN ATAMASI (23 Ekim 2026 · istekler: "yönetici ildeki
 * öğrencileri listeleyip boştaki öğretmenleri o öğrencilere atayabilecek mi"
 * · "yönetim panelinde toplu atama olsun").
 *
 * TÜM İLLER AÇILIŞTA GELİR (23 Ekim 2026 · istek: "neden tüm listeyi
 * göremiyoruz, illa seçmek gerekiyor; seçince süzsün ama tüm liste de
 * gelebilsin"). İl kutusu bir süzgeçtir ve seçilince kendiliğinden süzer.
 *
 * DANIŞMANSIZ öğrenciler il ve okula göre gruplanır. Okulu
 * listede olmayan öğrencinin elle yazdığı ad, benzer yazılmış adlarla aynı
 * gruba düşer (bkz. lib/okul/benzerlik.ts). Her grubun kendi formu var:
 * öğrenciler işaretli gelir, bir öğretmen seçilir ve hepsi ona atanır.
 *
 * Her grubun öğretmen listesi GRUBUN İLİNDEN gelir (atama kuralı "aynı il",
 * bkz. lib/danisman/atama.ts · yoneticiDanismanAta); grubun okuluyla aynı ya da benzer adlı
 * okuldaki öğretmenler ★ ile işaretli ve üstte. Az öğrencisi olan önce.
 *
 * İL KOORDİNATÖRÜNE AÇIK (11 Kasım 2026 · istek: "koordinatörler kendi
 * ilindeki öğretmenleri danışman olarak atayabilsinler"). Koordinatörde il
 * kendi iline SABİTLENİR, il kutusu basılmaz; adres çubuğuna yazılan `?il=`
 * yok sayılır. Öğrenciler ayrıca merkezi kapsam filtresinden geçer.
 *
 * OKULUNDA DANIŞMAN YOKSA İL KOORDİNATÖRÜ (13 Kasım 2026 · istek: "aynı şeyi
 * il koordinatörü yapsın, o ildeki danışmansız öğrencileri okulda danışman
 * yoksa kendini danışman yapabilsin"). Grubun okulunda (★) danışman öğretmen
 * yoksa ilin koordinatörü de seçenek olur (`IL_KOORDINATOR_FALLBACK`);
 * koordinatörün kendi ekranında ayrıca "Beni danışman yap" düğmesi çıkar.
 */
export default async function TopluDanismanSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ il?: string; durum?: string; hata?: string }>;
}) {
  const kullanici = await oturumKullanicisiZorunlu();
  if (!danismanAtayabilirMi(kullanici)) {
    return (
      <Kart>
        <KartBasligi
          baslik="Toplu danışman ataması"
          aciklama="Bu ekran il koordinatörüne ve proje yöneticisine açıktır."
        />
      </Kart>
    );
  }

  const merkezMi = projeYoneticisiMi(kullanici);
  const { il, durum, hata } = await searchParams;
  const secilenIl = merkezMi
    ? il && /^\d{2}$/.test(il)
      ? il
      : null
    : koordinatorIlKodu(kullanici);
  const ilAdi = ILLER.find((kayit) => kayit.ilKodu === secilenIl)?.ad ?? null;

  const [ogrenciler, ogretmenler, koordinatorler] = await Promise.all([
    prisma.kullanici.findMany({
      where: {
        AND: [
          ogrenciKapsamFiltresi(kullanici),
          {
            aktif: true,
            roller: { some: { rolKodu: "OGRENCI", bitisTarihi: null } },
            ogrenciAtamalari: { none: { bitisTarihi: null } },
          },
          secilenIl
            ? { OR: [{ ilKodu: secilenIl }, { kurum: { ilKodu: secilenIl } }] }
            : {},
        ],
      },
      orderBy: [{ ilKodu: "asc" }, { ad: "asc" }, { soyad: "asc" }],
      take: OGRENCI_SINIRI,
      select: {
        id: true,
        ad: true,
        soyad: true,
        sinif: true,
        ilKodu: true,
        kurumKodu: true,
        beyanOkulAdi: true,
        kurum: { select: { ad: true, ilKodu: true } },
      },
    }),
    ildekiDanismanlar(secilenIl),
    koordinatorleriIlleriyleGetir(secilenIl),
  ]);
  const ilAdiBul = (kod: string | null) =>
    ILLER.find((kayit) => kayit.ilKodu === kod)?.ad ?? "İl bilgisi yok";

  /*
   * OKULA GÖRE GRUPLAMA. Listedeki okulda kurum kodu kesin anahtardır; elle
   * yazılmış adlar benzer yazılmış bir grubun içine düşer. Grup adı ilk
   * gelen öğrencinin okul adıdır.
   */
  type Grup = {
    ilKodu: string | null;
    okulAdi: string;
    kurumKodu: number | null;
    listedeYok: boolean;
    ogrenciler: typeof ogrenciler;
  };
  const gruplar: Grup[] = [];
  for (const ogrenci of ogrenciler) {
    const okulAdi =
      ogrenci.kurum?.ad ?? ogrenci.beyanOkulAdi ?? "Okul bilgisi yok";
    const ogrenciIli = ogrenci.kurum?.ilKodu ?? ogrenci.ilKodu;
    const grup = gruplar.find(
      (g) =>
        g.ilKodu === ogrenciIli &&
        (ogrenci.kurumKodu !== null
          ? g.kurumKodu === ogrenci.kurumKodu
          : g.kurumKodu === null && okulAdiBenzerMi(g.okulAdi, okulAdi)),
    );
    if (grup) grup.ogrenciler.push(ogrenci);
    else
      gruplar.push({
        ilKodu: ogrenciIli,
        okulAdi,
        kurumKodu: ogrenci.kurumKodu,
        listedeYok: ogrenci.kurumKodu === null,
        ogrenciler: [ogrenci],
      });
  }
  // İl adına göre, il içinde kalabalık grup önce.
  gruplar.sort(
    (a, b) =>
      ilAdiBul(a.ilKodu).localeCompare(ilAdiBul(b.ilKodu), "tr") ||
      b.ogrenciler.length - a.ogrenciler.length,
  );

  return (
    <div className="space-y-6">
      <SayfaBasligi
        baslik="Toplu danışman ataması"
        aciklama={
          merkezMi
            ? "Danışmansız öğrencileri il ve okula göre listeler; seçtiğiniz öğrencileri tek seferde bir danışman öğretmene atarsınız. Öğretmen, öğrencinin ilinden seçilir."
            : "İlinizdeki danışmansız öğrencileri okula göre listeler; seçtiğiniz öğrencileri tek seferde ilinizdeki bir danışman öğretmene atarsınız."
        }
        geri={{ yol: "/panel/yonetim", etiket: "Yönetim Paneli" }}
      />

      {durum && <BilgiKutusu cesit="olumlu">{durum}</BilgiKutusu>}
      {hata && <BilgiKutusu cesit="hata">{hata}</BilgiKutusu>}

      {/* İl seçilince kendiliğinden süzer; "Tüm iller" listenin tamamı.
          Koordinatörde il sabit, kutu basılmaz. */}
      {merkezMi && (
        <form method="get" className="flex flex-wrap items-end gap-3">
          <label className="block min-w-60">
            <span className="text-sm font-medium text-metin-yumusak">İl</span>
            <OtomatikSecimKutusu
              ad="il"
              deger={secilenIl}
              bosEtiket="Tüm iller"
              etiket="İl"
              sinif={SINIF_GIRDI}
              secenekler={ILLER.map((kayit) => ({
                deger: kayit.ilKodu,
                etiket: kayit.ad,
              }))}
            />
          </label>
          <noscript>
            <button type="submit" className={SINIF_BIRINCIL_BUTON}>
              Süz
            </button>
          </noscript>
        </form>
      )}

      <>
        {secilenIl && (
          <Kart>
            <KartBasligi
              baslik={`${ilAdi} · danışman öğretmenler`}
              aciklama="Az öğrencisi olan önce. Sayılar şu anki danışmanlıkları gösterir."
              Ikon={UserCheck}
            />
            {ogretmenler.length === 0 ? (
              <p className="text-metin-yumusak">
                Bu ilde danışman rolü açık öğretmen yok. Öğretmenler kayıt
                olduğunda burada görünür.
              </p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {ogretmenler.map((o) => (
                  <li
                    key={o.kullaniciId}
                    className="rounded-full border border-cizgi px-3 py-1 text-sm text-metin"
                  >
                    {o.ad} {o.soyad}
                    <span className="text-metin-yumusak">
                      {" "}
                      · {o.ogrenciSayisi} öğrenci
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Kart>
        )}

        {gruplar.length === 0 ? (
          <BilgiKutusu cesit="olumlu">
            {secilenIl
              ? `${ilAdi} ilinde danışmansız öğrenci yok.`
              : "Danışmansız öğrenci yok."}
          </BilgiKutusu>
        ) : (
          <>
            <p className="text-sm text-metin-yumusak">
              {ogrenciler.length} danışmansız öğrenci, {gruplar.length} okul
              grubu
              {ogrenciler.length === OGRENCI_SINIRI &&
                ` (ilk ${OGRENCI_SINIRI} öğrenci gösteriliyor; atama yaptıkça liste kısalır)`}
              .
            </p>
            {gruplar.map((grup, sira) => {
              // Öğretmen yalnızca grubun ilinden (atama kuralı "aynı il").
              const secenekler = ogretmenler
                .filter((o) => grup.ilKodu !== null && o.ilKodu === grup.ilKodu)
                .map((o) => ({
                  ...o,
                  ayniOkul:
                    (grup.kurumKodu !== null &&
                      o.kurumKodu === grup.kurumKodu) ||
                    okulAdiBenzerMi(o.okulAdi, grup.okulAdi),
                }))
                .sort((a, b) => Number(b.ayniOkul) - Number(a.ayniOkul));
              // Okulunda danışman öğretmen yoksa grubun ilinin koordinatörü.
              const okuldaDanismanVar = secenekler.some((o) => o.ayniOkul);
              const koordinatorSecenekleri = okuldaDanismanVar
                ? []
                : koordinatorler.filter(
                    (k) => grup.ilKodu !== null && k.ilKodu === grup.ilKodu,
                  );
              const kendimKoordinatorMuyum = koordinatorSecenekleri.some(
                (k) => k.kullaniciId === kullanici.id,
              );
              return (
                <Kart key={`${grup.okulAdi}-${sira}`}>
                  <KartBasligi
                    baslik={`${grup.okulAdi} · ${ilAdiBul(grup.ilKodu)}`}
                    aciklama={`${grup.ogrenciler.length} danışmansız öğrenci${grup.listedeYok ? " · okul listede yok, adı öğrencilerin yazdığı gibi" : ""}`}
                    Ikon={UsersRound}
                  />
                  <form action={topluDanismanAtaEylemi} className="space-y-4">
                    <input type="hidden" name="il" value={secilenIl ?? ""} />
                    <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {grup.ogrenciler.map((ogrenci) => (
                        <li key={ogrenci.id}>
                          <label className="flex items-center gap-2 rounded-kutu border border-cizgi px-3 py-2 text-sm text-metin has-checked:border-vurgu">
                            <input
                              type="checkbox"
                              name="ogrenciId"
                              value={ogrenci.id}
                              defaultChecked
                            />
                            <Link
                              href={`/panel/ogrenciler/${ogrenci.id}`}
                              className="hover:text-vurgu-metin hover:underline"
                            >
                              {ogrenci.ad} {ogrenci.soyad}
                            </Link>
                            {ogrenci.sinif && (
                              <span className="text-metin-yumusak">
                                · {ogrenci.sinif}
                              </span>
                            )}
                          </label>
                        </li>
                      ))}
                    </ul>
                    {!okuldaDanismanVar && koordinatorSecenekleri.length > 0 && (
                      <p className="rounded-kutu bg-uyari-zemin px-3 py-2 text-xs text-uyari-metin">
                        {kendimKoordinatorMuyum
                          ? "Bu okulda kayıtlı danışman öğretmen yok. İşaretli öğrencilerin danışmanlığını kendiniz üstlenebilirsiniz."
                          : "Bu okulda kayıtlı danışman öğretmen yok. Öğrencileri listenin sonundaki il koordinatörüne atayabilirsiniz."}
                      </p>
                    )}
                    {secenekler.length === 0 && koordinatorSecenekleri.length === 0 ? (
                      <p className="text-sm text-metin-yumusak">
                        {grup.ilKodu
                          ? `${ilAdiBul(grup.ilKodu)} ilinde atanabilecek danışman öğretmen yok.`
                          : "Öğrencinin ili kayıtlı değil; önce ilini girmesi gerekiyor."}
                      </p>
                    ) : (
                      <div className="flex flex-wrap items-end gap-3">
                        <label className="block min-w-72 flex-1">
                          <span className="text-sm font-medium text-metin">
                            Danışman öğretmen
                          </span>
                          <select
                            name="danismanId"
                            required
                            defaultValue=""
                            className={SINIF_GIRDI}
                          >
                            <option value="">Seçiniz</option>
                            {secenekler.map((o) => (
                              <option key={o.kullaniciId} value={o.kullaniciId}>
                                {o.ayniOkul ? "★ " : ""}
                                {o.ad} {o.soyad}
                                {o.brans ? ` · ${o.brans}` : ""}
                                {o.okulAdi ? ` · ${o.okulAdi}` : ""}
                                {` · ${o.ogrenciSayisi} öğrenci`}
                              </option>
                            ))}
                            {koordinatorSecenekleri.length > 0 && (
                              <optgroup label="İl koordinatörü (okulda danışman yoksa)">
                                {koordinatorSecenekleri.map((k) => (
                                  <option key={k.kullaniciId} value={k.kullaniciId}>
                                    {k.ad} {k.soyad} · İl koordinatörü
                                    {k.kullaniciId === kullanici.id ? " (siz)" : ""}
                                    {` · ${k.ogrenciSayisi} öğrenci`}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                          </select>
                          <span className="mt-1 flex items-center gap-1 text-xs text-metin-yumusak">
                            <Star size={12} aria-hidden /> aynı ya da benzer
                            adlı okuldaki öğretmen
                          </span>
                        </label>
                        <button type="submit" className={SINIF_BIRINCIL_BUTON}>
                          <UserCheck size={16} aria-hidden />
                          İşaretlileri ata
                        </button>
                        {kendimKoordinatorMuyum && (
                          <button
                            type="submit"
                            name="kendim"
                            value="1"
                            formNoValidate
                            className={SINIF_BIRINCIL_BUTON}
                          >
                            <UserCheck size={16} aria-hidden />
                            Beni danışman yap
                          </button>
                        )}
                      </div>
                    )}
                  </form>
                </Kart>
              );
            })}
          </>
        )}
      </>
    </div>
  );
}
