import { BookOpen, Compass, Filter, Flame, Rocket, Users } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { OtomatikSecimKutusu } from "@/components/SuzgecOtomatikSecim";
import {
  Kart,
  KartBasligi,
  SayfaBasligi,
  SINIF_IKINCIL_BUTON,
} from "@/components/ui";
import { SeviyeYildizlari } from "@/components/SeviyeYildizlari";
import { YolculukSeridi } from "@/components/YolculukSeridi";
import { oturumKullanicisiZorunlu } from "@/lib/auth/oturum";
import { prisma } from "@/lib/db";
import {
  koordinatorIlKodu,
  ogrenciMi,
  projeYoneticisiMi,
} from "@/lib/yetki/izinler";
import {
  PUAN_KAYNAKLARI,
  YOLCULUK_SEVIYELERI,
  seviyeAdiTirnakli,
} from "@/lib/yolculuk/kurallar";
import {
  type OgrencilerimYolculugu,
  ogrencilerimYolculuguGetir,
} from "@/lib/yolculuk/ogrencilerim";
import { yolculugumuGetir } from "@/lib/yolculuk/veri";

export const dynamic = "force-dynamic";

/**
 * GENÇTEK YOLCULUĞUM — seviye ve ilerleme tek ekranda (21 Ağustos 2026).
 *
 * İstek: "katkı nişanlarımı gençtek yolculuğum yapalım, aşamalar şunlar
 * olacak: 'Hello World' · Keşifte · Harekette · Üretimde · Katkıda · Ufuk Açan
 * · İz Bırakan … bunu ayrı bir sayfa yapalım." Düzen, paylaşılan iki taslak
 * görselden esinlendi: üstte mevcut seviye ve ilerleme, altında seviye şeridi,
 * yanında yolculuğu neyin ilerlettiği ve nasıl ilerlediği.
 *
 * SEVİYE ŞERİDİ HEP TAM BASILIR: kazanılmamış seviyeler de soluk olarak
 * duruyor. Yalnızca ulaşılanları göstermek, yolun nereye çıktığını gizlerdi —
 * bir merdivenin görünmeyen basamağı kimseyi çıkmaya çağırmaz.
 *
 * NİŞAN BÖLÜMÜ KALDIRILDI (21 Ağustos 2026 · istek: "katkı nişanları kalmış").
 * Sayfa ilk kurulduğunda "Katkı Nişanlarım" kartı da buraya konmuştu; istek
 * nişanları yolculuğun YERİNE koymaktı, yanına değil. İki rozet dizisi alt
 * alta durunca kişi hangisinin ilerlemesini gösterdiğini ayırt edemiyordu.
 *
 * Kartın kendisi (components/OgrenciProfilBolumleri · KatkiNisanlariKarti) ve
 * nişan hesabı SİLİNMEDİ: öğretmen tarafındaki Katkılarım ekranı
 * (app/panel/kazanimlarim) hâlâ aynı bileşenden basılıyor.
 *
 * PUAN EKRANDAN KALDIRILDI (28 Ağustos 2026 · istek: "puanları
 * göstermiyoruz, belki bir yıldız iki yıldız üç yıldız … puan demeyelim").
 * Sayfada artık ne "puan" sözcüğü ne de bir toplam var; yerini seviyenin
 * yıldızı aldı. Hesap yerinde duruyor (lib/yolculuk/kurallar.ts) — seviyeyi ve
 * ilerleme çubuğunu hâlâ o üretiyor, yalnızca kişiye gösterilmiyor.
 *
 * "KAÇ PUAN KALDI" DA GİTTİ: ilerlemeyi çubuk anlatıyor, sıradaki basamağı
 * adıyla söylüyoruz. Kalanı sayıyla vermek, kaldırılan sayıyı ikinci bir
 * cümleyle geri getirmek olurdu.
 *
 * ---------------------------------------------------------------------------
 * EKRAN İKİYE AYRILDI (28 Ağustos 2026)
 * ---------------------------------------------------------------------------
 * İstek: "öğretmen tarafında 'GençTek Yolculuğum' yerine 'Öğrencilerimin
 * GençTek Yolculuğu' yazıyoruz … kaç öğrencisi Hello World aşamasında onu
 * yazdırıyoruz".
 *
 * ÖĞRETMENE GÖSTERİLEN KİŞİ DEĞİŞTİ, yalnızca başlık değil: eskiden öğretmen
 * de kendi seviyesini, kendi yıldızını ve kendi defterini görüyordu. Başlığı
 * değiştirip içeriği bırakmak, öğretmenin kendi kaydını öğrencilerininmiş gibi
 * etiketlerdi — ekranın en yanıltıcı hâli bu olurdu.
 *
 * ÖĞRETMENİN KENDİ YILDIZI ARTIK YOK. Bu bir eksilme değil, tercih: bir
 * öğretmenin GençTek'teki karşılığı kendi rozet sayısı değil, öğrencilerinin
 * nereye geldiğidir.
 *
 * DİL DE DEĞİŞTİ: basamak açıklamaları öğretmen ekranında üçüncü şahsa
 * geçiyor ("Öğrencileriniz ekosisteme adım atıyor"), defter satırları ise
 * "…oldular" hâline. Metinler `lib/yolculuk/kurallar.ts` içinde ayrı
 * alanlarda duruyor; şahıs ekini kodda çevirmeye çalışmak Türkçede sağlam
 * yapılamaz.
 */
const SINIF_ETIKET = "text-sm font-medium text-metin-yumusak";
const SINIF_SECIM =
  "mt-1 w-full rounded-md border border-cizgi bg-kart px-3 py-2 text-sm text-metin outline-none focus:border-vurgu";

function tekil(deger: string | string[] | undefined): string | null {
  const ilk = Array.isArray(deger) ? deger[0] : deger;
  return ilk && ilk.trim() !== "" ? ilk.trim() : null;
}

/** Aşama listesinde basılan öğrenci satırı. */
interface ListeOgrencisi {
  id: number;
  ad: string;
  soyad: string;
  sinif: string | null;
  kurum: { ad: string } | null;
  il: { ad: string } | null;
  ilce: { ad: string } | null;
}

/**
 * YER SÜZGECİ ve AŞAMA LİSTESİ (16 Kasım 2026 · istekler: "144 öğrenci
 * 1. aşamada, 1 öğrenci keşifte … keşifte kim varmış görmek istiyorum";
 * "danışman okulundaki, koordinatör ilinde seçtiği ilçedeki, yönetici seçtiği
 * il ve ilçedeki öğrencilerin durumlarını görsün").
 *
 *   · Proje yöneticisi: il + ilçe seçer.
 *   · İl koordinatörü: il sabit (kendi ili), ilçe seçer.
 *   · Danışman: yer seçimi yok — kapsamı zaten kendi öğrencileri.
 *
 * Süzgeç kapsamın üstüne eklenir (ogrenciListeFiltresi); adres çubuğuna
 * yazılan başka bir il, kapsam dışındaki kimseyi göstermez.
 */
export default async function GencTekYolculugumSayfasi({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const kullanici = await oturumKullanicisiZorunlu();

  if (!ogrenciMi(kullanici)) {
    const parametreler = await searchParams;
    const merkez = projeYoneticisiMi(kullanici);
    const koordinatorIli = merkez ? null : koordinatorIlKodu(kullanici);
    const ilKodu = merkez ? tekil(parametreler.il) : koordinatorIli;
    const ilceKodu = ilKodu ? tekil(parametreler.ilce) : null;
    const seviyeKodu = tekil(parametreler.seviye);
    const seciliSeviye =
      YOLCULUK_SEVIYELERI.find((seviye) => seviye.kod === seviyeKodu) ?? null;
    const yerSecebilir = merkez || koordinatorIli !== null;

    const [ogrencilerim, iller, ilceler] = await Promise.all([
      ogrencilerimYolculuguGetir(kullanici, { ilKodu, ilceKodu }),
      merkez ? prisma.il.findMany({ orderBy: { ad: "asc" } }) : [],
      ilKodu
        ? prisma.ilce.findMany({ where: { ilKodu }, orderBy: { ad: "asc" } })
        : [],
    ]);

    /* Liste, sayımı üreten aynı kimliklerden: sayı ile liste ayrışamaz. */
    const listeIdleri = seciliSeviye
      ? (ogrencilerim.seviyeOgrencileri[seciliSeviye.kod] ?? [])
      : [];
    const liste: ListeOgrencisi[] =
      listeIdleri.length > 0
        ? await prisma.kullanici.findMany({
            where: { id: { in: listeIdleri } },
            orderBy: [{ ad: "asc" }, { soyad: "asc" }],
            select: {
              id: true,
              ad: true,
              soyad: true,
              sinif: true,
              kurum: { select: { ad: true } },
              il: { select: { ad: true } },
              ilce: { select: { ad: true } },
            },
          })
        : [];

    const adres = (seviye: string | null): string => {
      const sorgu = new URLSearchParams();
      if (merkez && ilKodu) sorgu.set("il", ilKodu);
      if (ilceKodu) sorgu.set("ilce", ilceKodu);
      if (seviye) sorgu.set("seviye", seviye);
      const metin = sorgu.toString();
      return `/panel/genctek-yolculugum${metin ? `?${metin}` : ""}`;
    };
    const listeBaglantilari = Object.fromEntries(
      YOLCULUK_SEVIYELERI.map((seviye) => [
        seviye.kod,
        `${adres(seviye.kod)}#asama-listesi`,
      ]),
    );

    return (
      <OgretmenGorunumu
        ogrencilerim={ogrencilerim}
        suzgec={
          yerSecebilir ? (
            <YerSuzgeci
              merkez={merkez}
              ilKodu={ilKodu}
              ilceKodu={ilceKodu}
              seviyeKodu={seciliSeviye?.kod ?? null}
              iller={iller}
              ilceler={ilceler}
            />
          ) : null
        }
        listeBaglantilari={listeBaglantilari}
        seciliSeviye={seciliSeviye}
        liste={liste}
        listeyiKapat={adres(null)}
      />
    );
  }

  const yolculuk = await yolculugumuGetir(kullanici);
  return <OgrenciGorunumu yolculuk={yolculuk} />;
}

/**
 * ÖĞRETMENİN GÖRÜNÜMÜ — sayılar, kendi seviyesi değil.
 *
 * "Nasıl ilerliyor" listesi burada ÖĞRENCİ kalemlerini gösteriyor (danışmanlık
 * ve etkinlik düzenleme değil): ekranın öznesi öğrenciler olduğu için, onların
 * yolunu ilerleten şeyler yazılıyor.
 */
function YerSuzgeci({
  merkez,
  ilKodu,
  ilceKodu,
  seviyeKodu,
  iller,
  ilceler,
}: {
  merkez: boolean;
  ilKodu: string | null;
  ilceKodu: string | null;
  seviyeKodu: string | null;
  iller: { ilKodu: string; ad: string }[];
  ilceler: { ilceKodu: string; ad: string }[];
}) {
  return (
    <form
      method="get"
      className="rounded-kart border border-cizgi bg-kart p-5 shadow-kart"
    >
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-baslik">
        <Filter size={16} className="text-vurgu-metin" aria-hidden />
        Yer
      </h2>
      {seviyeKodu && <input type="hidden" name="seviye" value={seviyeKodu} />}
      <div className="grid gap-4 sm:grid-cols-3">
        {merkez && (
          <label className="block">
            <span className={SINIF_ETIKET}>İl</span>
            {/* İl değişince ilçe listesi sunucuda yeniden kuruluyor; kutu
                kendi formunu gönderiyor (bkz. SuzgecOtomatikSecim.tsx). */}
            <OtomatikSecimKutusu
              ad="il"
              deger={ilKodu}
              bosEtiket="Tüm iller"
              etiket="İl"
              sinif={SINIF_SECIM}
              secenekler={iller.map((il) => ({
                deger: il.ilKodu,
                etiket: il.ad,
              }))}
            />
          </label>
        )}
        <label className="block">
          <span className={SINIF_ETIKET}>İlçe</span>
          <select
            key={ilKodu ?? "yok"}
            name="ilce"
            defaultValue={ilceKodu ?? ""}
            className={SINIF_SECIM}
            disabled={ilceler.length === 0}
          >
            <option value="">
              {ilceler.length === 0 ? "Önce il seçin" : "Tüm ilçeler"}
            </option>
            {ilceler.map((ilce) => (
              <option key={ilce.ilceKodu} value={ilce.ilceKodu}>
                {ilce.ad}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-3">
          <button type="submit" className={SINIF_IKINCIL_BUTON}>
            Göster
          </button>
          {(ilceKodu || (merkez && ilKodu)) && (
            <Link
              href="/panel/genctek-yolculugum"
              className="py-2 text-sm font-medium text-vurgu-metin"
            >
              Temizle
            </Link>
          )}
        </div>
      </div>
    </form>
  );
}

function OgretmenGorunumu({
  ogrencilerim,
  suzgec,
  listeBaglantilari,
  seciliSeviye,
  liste,
  listeyiKapat,
}: {
  ogrencilerim: OgrencilerimYolculugu;
  suzgec: ReactNode;
  listeBaglantilari: Record<string, string>;
  seciliSeviye: { kod: string; ad: string } | null;
  liste: ListeOgrencisi[];
  listeyiKapat: string;
}) {
  const kaynaklar = PUAN_KAYNAKLARI.filter(
    (kaynak) => kaynak.kimde === "herkes" || kaynak.kimde === "ogrenci",
  );

  /*
   * En kalabalık basamak: öğretmenin ilk bakışta aradığı bilgi. Eşitlikte
   * dizide önce gelen kazanıyor, yani ALTTAKİ basamak — yolculuğun sorunu
   * yukarıda değil aşağıda birikmedir.
   */
  const enKalabalik = ogrencilerim.dagilim.reduce((enIyi, satir) =>
    satir.ogrenciSayisi > enIyi.ogrenciSayisi ? satir : enIyi,
  );

  return (
    <div className="space-y-6">
      <SayfaBasligi
        baslik="Öğrencilerimin GençTek Yolculuğu"
        aciklama={`${ogrencilerim.ogrenciSayisi} öğrenci`}
      />

      {suzgec}

      <div className="overflow-hidden rounded-kart border border-cizgi bg-kart shadow-kart">
        <div className="poster poster-vurgu flex flex-wrap items-center justify-between gap-4 px-6 py-6">
          <div className="flex items-center gap-4">
            <span className="inline-flex size-14 shrink-0 items-center justify-center rounded-full bg-white/20 text-white">
              <Users size={26} aria-hidden />
            </span>
            <div>
              <p className="text-[11px] font-bold tracking-widest text-white/80 uppercase">
                Yolculuktaki öğrencilerin
              </p>
              <p className="font-baslik text-2xl leading-tight font-extrabold text-white">
                {ogrencilerim.ogrenciSayisi} öğrenci
              </p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <p className="text-metin">
            {ogrencilerim.ogrenciSayisi === 0
              ? "Kapsamında henüz öğrenci yok; öğrenciler eklendikçe aşamalar burada dolacak."
              : `Öğrencilerinin çoğu ${seviyeAdiTirnakli(
                  enKalabalik.seviye.ad,
                )} aşamasında.`}
          </p>
        </div>
      </div>

      <Kart>
        <KartBasligi baslik="Öğrencilerimin GençTek Yolculuğu" Ikon={Compass} />
        <YolculukSeridi
          dagilim={ogrencilerim.dagilim}
          listeBaglantilari={listeBaglantilari}
          seciliListeKodu={seciliSeviye?.kod ?? null}
        />
        <p className="mt-3 text-sm text-metin-yumusak">
          Bir aşamadaki öğrencileri görmek için öğrenci sayısına tıklayın.
        </p>
      </Kart>

      {seciliSeviye && (
        <Kart>
          <span id="asama-listesi" className="block scroll-mt-24" />
          <div className="flex flex-wrap items-start justify-between gap-2">
            <KartBasligi
              baslik={`${seciliSeviye.ad} aşamasındaki öğrenciler (${liste.length})`}
              Ikon={Users}
            />
            <Link
              href={listeyiKapat}
              className="text-sm font-medium text-vurgu-metin"
            >
              Listeyi kapat
            </Link>
          </div>
          {liste.length === 0 ? (
            <p className="text-metin-yumusak">Bu aşamada öğrenci yok.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-cizgi text-metin-yumusak">
                    <th className="px-3 py-2 font-medium">Ad Soyad</th>
                    <th className="px-3 py-2 font-medium">Sınıf</th>
                    <th className="px-3 py-2 font-medium">Okul</th>
                    <th className="px-3 py-2 font-medium">İl / İlçe</th>
                  </tr>
                </thead>
                <tbody>
                  {liste.map((ogrenci) => (
                    <tr
                      key={ogrenci.id}
                      className="border-b border-cizgi last:border-0"
                    >
                      <td className="px-3 py-2 font-medium text-metin">
                        {/* Hedef sayfa kapsamı yeniden denetliyor. */}
                        <Link
                          href={`/panel/ogrenciler/${ogrenci.id}`}
                          className="hover:text-vurgu-metin hover:underline"
                        >
                          {ogrenci.ad} {ogrenci.soyad}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-metin-yumusak">
                        {ogrenci.sinif ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-metin-yumusak">
                        {ogrenci.kurum?.ad ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-metin-yumusak">
                        {ogrenci.il?.ad ?? "—"}
                        {ogrenci.ilce?.ad ? ` / ${ogrenci.ilce.ad}` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Kart>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/*
          ÖĞRENCİLERİMİN SEYİR DEFTERİ (istek: "o okuldaki öğrencilerin tüm
          sayılarını yazdırabiliyor muyuz? Ekosisteme kayıt oldular x5 …").
          Satırlar kapsamdaki BÜTÜN öğrencilerin toplamı ve sayılar puan değil
          kayıt adedi.
        */}
        <Kart>
          <KartBasligi baslik="Öğrencilerimin Seyir Defteri" Ikon={BookOpen} />
          {ogrencilerim.dokum.length === 0 ? (
            <p className="text-metin-yumusak">
              Öğrencilerinin seyir defterine işlenecek bir kayıt henüz yok.
            </p>
          ) : (
            <ul className="divide-y divide-cizgi">
              {ogrencilerim.dokum.map((satir) => (
                <li
                  key={satir.kod}
                  className="flex flex-wrap items-baseline justify-between gap-2 py-2.5"
                >
                  <span className="text-metin">{satir.etiket}</span>
                  <span className="font-baslik font-bold text-baslik">
                    × {satir.adet}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Kart>

        <Kart>
          <KartBasligi
            baslik="Öğrencilerimin GençTek Yolculuğu nasıl ilerler?"
            Ikon={Flame}
          />
          {/*
            GENİŞ ZAMAN, ÜÇÜNCÜ ÇOĞUL ŞAHIS (`topluYolEtiketi`): aynı liste
            öğrencinin ekranında emir kipinde duruyor ("Mentör ol"). Öğretmene
            emir kipiyle yazılsaydı, öğrencilerinin yolu öğretmene verilmiş bir
            görev listesi gibi okunurdu.
          */}
          <ul className="grid gap-2 sm:grid-cols-2">
            {kaynaklar.map((kaynak) => (
              <li
                key={kaynak.kod}
                className="rounded-kutu border border-cizgi px-3 py-2 text-sm text-metin"
              >
                {kaynak.topluYolEtiketi}
              </li>
            ))}
          </ul>
        </Kart>
      </div>
    </div>
  );
}

/** Öğrencinin kendi yolculuğu — sayfanın ilk ve asıl hâli. */
function OgrenciGorunumu({
  yolculuk,
}: {
  yolculuk: Awaited<ReturnType<typeof yolculugumuGetir>>;
}) {
  /*
   * Liste ÖĞRENCİ kalemleriyle sınırlı: danışmanlık ve etkinlik düzenleme
   * öğretmen tarafının işi; öğrenciye yapamayacağı bir yolu göstermek listeyi
   * ulaşılmaz kılardı.
   */
  const kaynaklar = PUAN_KAYNAKLARI.filter(
    (kaynak) => kaynak.kimde === "herkes" || kaynak.kimde === "ogrenci",
  );

  return (
    <div className="space-y-6">
      <SayfaBasligi
        baslik="GençTek Yolculuğum"
        aciklama={yolculuk.seviye.ad}
      />

      {/*
        MEVCUT SEVİYE KARTI — sayfanın tek "vitrin"i. Poster bandı ölçüm
        kartlarıyla aynı dili konuşuyor; üstünde çıplak metin değil kendi
        zeminini taşıyan rozetler duruyor (bkz. globals.css · .poster).
      */}
      <div className="overflow-hidden rounded-kart border border-cizgi bg-kart shadow-kart">
        <div className="poster poster-vurgu flex flex-wrap items-center justify-between gap-4 px-6 py-6">
          <div className="flex items-center gap-4">
            <span className="inline-flex size-14 shrink-0 items-center justify-center rounded-full bg-white/20 text-white">
              <Rocket size={26} aria-hidden />
            </span>
            <div>
              <p className="text-[11px] font-bold tracking-widest text-white/80 uppercase">
                Şu anki seviyen
              </p>
              <p className="font-baslik text-2xl leading-tight font-extrabold text-white">
                {yolculuk.seviye.ad}
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-black/30 px-3.5 py-1.5">
            <SeviyeYildizlari yildiz={yolculuk.yildiz} ton="poster" />
          </span>
        </div>

        <div className="p-6">
          <p className="text-metin">{yolculuk.seviye.aciklama}</p>

          {/*
            İLERLEME ÇUBUĞU İKİ EŞİK ARASINI ölçüyor, toplam puanı değil: üst
            seviyelerde toplam üzerinden çizilen çubuk neredeyse hiç
            kıpırdamaz ve ilerlemeyi görünmez kılardı.
          */}
          <div
            className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-zemin"
            role="progressbar"
            aria-valuenow={yolculuk.yuzde}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${yolculuk.seviye.ad} seviyesindeki ilerlemeniz`}
          >
            <div
              className="h-full rounded-full bg-birincil transition-all"
              style={{ width: `${yolculuk.yuzde}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-metin-yumusak">
            {yolculuk.sonraki
              ? `Sonraki seviyen ${seviyeAdiTirnakli(yolculuk.sonraki.ad)}`
              : "En üst seviyedesin. Buradan sonrası, ardında bıraktığın iz."}
          </p>
        </div>
      </div>

      <Kart>
        <KartBasligi baslik="GençTek Yolculuğum" Ikon={Compass} />
        <YolculukSeridi seviyeKodu={yolculuk.seviye.kod} />
      </Kart>

      <div className="grid gap-6 lg:grid-cols-2">
        {/*
          SEYİR DEFTERİ (28 Ağustos 2026 · istek: "Puanım nereden geliyor
          yerine Seyir Defteri. Puanların toplamı siliyoruz, toplam yerine
          seviyeyi yazdırabilirsin"). Kartın işi değişmedi — yolculuğu neyin
          ilerlettiğini gösteriyor — ama satırların sağındaki sayı artık PUAN
          DEĞİL KAYIT ADEDİ: "3" burada "üç etkinliğe katıldın" demek, "üç
          puan kazandın" değil. Sayı yine de duruyor çünkü kişinin kendi
          geçmişini sayması gizlenecek bir şey değil; gizlenen, o geçmişi tek
          bir yarış puanına indiren toplamdı.
        */}
        <Kart>
          <KartBasligi baslik="Seyir Defteri" Ikon={BookOpen} />
          {yolculuk.dokum.length === 0 ? (
            <p className="text-metin-yumusak">
              Seyir defterine işlenecek bir kaydın henüz yok.
            </p>
          ) : (
            <ul className="divide-y divide-cizgi">
              {yolculuk.dokum.map((satir) => (
                <li
                  key={satir.kod}
                  className="flex flex-wrap items-baseline justify-between gap-2 py-2.5"
                >
                  <span className="text-metin">{satir.etiket}</span>
                  <span className="font-baslik font-bold text-baslik">
                    × {satir.adet}
                  </span>
                </li>
              ))}
              {/*
                TOPLAM SATIRI SEVİYEYE DÖNDÜ: eskiden burada puanların toplamı
                vardı. Dökümün altında duran şeyin "hepsi bir araya gelince ne
                oldu" sorusunu cevaplaması gerekiyor; cevabı artık bir sayı
                değil, ulaşılan basamağın adı.
              */}
              <li className="flex flex-wrap items-baseline justify-between gap-2 py-2.5">
                <span className="font-semibold text-baslik">Seviyen</span>
                <span className="font-baslik text-lg font-extrabold text-vurgu-metin">
                  {yolculuk.seviye.ad}
                </span>
              </li>
            </ul>
          )}
        </Kart>

        <Kart>
          <KartBasligi
            baslik="GençTek Yolculuğum nasıl ilerliyor?"
            Ikon={Flame}
          />
          {/*
            Maddelerin YANINDAKİ SAYI KALDIRILDI. Her satırda "+2" yazmak,
            sayfadan çıkarılan puanı liste hâlinde geri getirir ve okuyanı
            "hangisi daha çok getiriyor" hesabına sokardı — oysa buranın
            söylemesi gereken, yolculuğun nelerle ilerlediği.

            ALTTAKİ "kendiliğinden hesaplanır, elle verilmez" NOTU DA SİLİNDİ
            (istek). Not, puanın elle verilmediğini savunmak için vardı; ortada
            gösterilen bir puan kalmayınca savunacağı bir şey de kalmadı.

            Maddeler EMİR KİPİNDE (`yolEtiketi`): burası yapılabilecekleri
            sayıyor, Seyir Defteri ise yapılmış olanları.
          */}
          <ul className="grid gap-2 sm:grid-cols-2">
            {kaynaklar.map((kaynak) => (
              <li
                key={kaynak.kod}
                className="rounded-kutu border border-cizgi px-3 py-2 text-sm text-metin"
              >
                {kaynak.yolEtiketi}
              </li>
            ))}
          </ul>
        </Kart>
      </div>

    </div>
  );
}
