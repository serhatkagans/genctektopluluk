import {
  ArrowRightLeft,
  Award,
  CalendarClock,
  CalendarDays,
  Check,
  ClipboardCheck,
  FileText,
  Filter,
  Hourglass,
  Landmark,
  MapPin,
  Plus,
  Send,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { DisaAktarmaBagi } from "@/components/DisaAktarmaBagi";
import type {
  BasvuruDurumu,
  EtkinlikKategorisi,
  FaaliyetDurumu,
  Kapsam,
  OnayDurumu,
} from "@/generated/prisma/enums";
import {
  BasvuruRozeti,
  FaaliyetDurumuRozeti,
  KapsamRozeti,
  KategoriRozeti,
  OnayRozeti,
  PencereRozeti,
} from "@/components/FaaliyetRozetleri";
import {
  BilgiKutusu,
  Kart,
  KartBasligi,
  KartIzgarasi,
  OlcumKarti,
  PosterKart,
  Rozet,
  SayfaBasligi,
  SINIF_BIRINCIL_BUTON,
  SINIF_GIRDI,
  SINIF_IKINCIL_BUTON,
} from "@/components/ui";
import { oturumKullanicisiZorunlu } from "@/lib/auth/oturum";
import {
  ilDisiBasvurulariGetir,
  type IlDisiBasvuruSatiri,
} from "@/lib/basvuru/il-disi-veri";
import { prisma } from "@/lib/db";
import { uygulamaYolu } from "@/lib/ortam";
import {
  basvuruPenceresi,
  faaliyetAcmaYetkisiVarMi,
  KAPSAM_ETIKETLERI,
  KAPSAMLAR,
  type KontenjanDurumu,
  kontenjanDurumu,
  type PencereDurumu,
} from "@/lib/faaliyet/kurallar";
import { etkinligeKalanYaz } from "@/lib/faaliyet/takvim";
import { yaklasanEtkinligimiGetir } from "@/lib/faaliyet/yaklasan";
import {
  KATILIM_BICIMI_ETIKETLERI,
  KATILIM_BICIMLERI,
} from "@/lib/kazanim/kurallar";
import { faaliyetKatilimSayisi } from "@/lib/rapor/istatistik";
import { tarihYaz } from "@/lib/tarih";
import {
  basvuruYapabilirMi,
  danismanMi,
  faaliyetDisaAktarabilirMi,
  belgeUretenRoldeMi,
  disKullaniciMi,
  etkinlikRaporlariGorebilirMi,
  ilKoordinatoruMu,
  ogrenciMi,
  projeYoneticisiMi,
} from "@/lib/yetki/izinler";
import { erisimLoglaCoklu } from "@/lib/yetki/log";
import {
  type SorguParametreleri,
  sorguMetni,
  tekil,
} from "../ogrenciler/filtreler";
import {
  faaliyetFiltreleriniCoz,
  faaliyetFiltresiVarMi,
  faaliyetListeFiltresi,
  faaliyetSiralamasi,
  ilAdlariniGetir,
  kisininIlKodu,
  type FaaliyetFiltreleri,
} from "./filtreler";
import { kaynakIlKarariEylemi } from "./il-disi-eylemler";

export const dynamic = "force-dynamic";

/**
 * Faaliyet listesi.
 *
 * Kim hangi faaliyeti görür sorusunun cevabı merkezi kapsam filtresindedir
 * (faaliyetKapsamFiltresi); burada filtre elle yazılmaz. Ekrandaki filtreler
 * yalnızca DARALTIR — adres çubuğuna yazılan bir kapsam değeri onay bekleyen
 * ya da kapsam dışı bir faaliyeti görünür yapmaz.
 */

/**
 * Kırmızı düğme — bu sayfanın başlık düğmeleri için (10 Ağustos 2026).
 *
 * ui.tsx'e genel bir varyant olarak EKLENMEDİ: kırmızı bu projede "hata" ve
 * "geri alınamaz işlem" rengi; paylaşılan bir düğme sınıfı hâline gelseydi
 * silme düğmeleriyle aynı dili konuşan bir gezinme düğmesi ortaya çıkardı.
 * Burada istenen şey vurgu, uyarı değil — o yüzden yerel kalıyor.
 */
const SAYFA_BOYUTU = 50;

const SINIF_KIRMIZI_BUTON =
  "inline-flex items-center gap-2 rounded-md border border-hata-cizgi bg-hata-zemin px-4 py-2 text-sm font-semibold text-hata-metin transition hover:border-hata-metin";

const SINIF_ETIKET = "text-sm font-medium text-metin-yumusak";
const SINIF_SECIM =
  "mt-1 w-full rounded-md border border-cizgi bg-kart px-3 py-2 text-sm text-metin outline-none focus:border-vurgu";

/**
 * İki görünümün paylaştığı kart verisi.
 *
 * Kontenjan, pencere ve "raporu bekliyor" hesapları listeyle ızgarada AYNI
 * olmalı; sorgudan çıkan satır iki yerde ayrı ayrı yorumlansaydı, aynı
 * etkinlik iki görünümde farklı rozet gösterebilirdi. Bu yüzden hesap bir kez
 * yapılır ve iki görünüm de bu yapıyı alır.
 */
interface EtkinlikKarti {
  id: number;
  ad: string;
  aciklama: string;
  tarih: Date;
  duzenleyenBirim: string;
  /** Başvurunun son günü — kartın "37 gün kaldı" balonu bunu sayar. */
  basvuruBitis: Date;
  kapsam: Kapsam;
  etkinlikKategorisi: EtkinlikKategorisi;
  durum: FaaliyetDurumu;
  onayDurumu: OnayDurumu;
  calismaGruplari: { id: number; ad: string }[];
  /** Silinmemiş kapak; yoksa null (ızgarada başlık afişin yerine geçer). */
  kapak: { id: number; dosyaAdi: string } | null;
  kontenjan: KontenjanDurumu;
  pencere: PencereDurumu;
  benimBasvurum: BasvuruDurumu | null;
  raporBekliyor: boolean;
  benimActigim: boolean;
  /** Seçilmiş katılımcı sayısı (Aşama 6c). */
  katilimciSayisi: number;
  /** Etkinlik bitti mi — rapor etiketi yalnızca bitmişlerde anlamlı. */
  bittiMi: boolean;
  /** Bitmiş etkinliğin raporu yazılmış mı (Aşama 6d). */
  raporYazildi: boolean;
}

/**
 * İL DIŞINA GİDEN BAŞVURULAR (11 Ağustos 2026 · istek: "koordinatörün
 * etkinlikler sayfası ile il dışı başvuru sayfalarını birleştirelim, il dışı
 * başvurular kalksın, hepsi etkinliklerde olsun").
 *
 * `/panel/il-disi-basvurular` silindi ve içeriği buraya taşındı. Karar zaten
 * bir ETKİNLİK kararıydı — "öğrencim bu etkinliğe gitsin mi" — ve ayrı bir
 * sekmede durması koordinatörü iki ekran arasında gezdiriyordu: etkinliği
 * burada, ona yapılan başvuruyu orada görüyordu.
 *
 * KURAL DEĞİŞMEDİ, yalnızca yeri: öğrencinin kendi ilinin koordinatörü karar
 * vermeden etkinliğin ili başvuruyu değerlendiremez (bkz. degerlendirmeyeHazirMi)
 * ve ret gerekçesi zorunludur. İkisi de aynı sunucu eyleminde duruyor
 * (kaynakIlKarariEylemi), bu bölüm yalnızca formu basıyor.
 *
 * KAPSAM SORULMUYOR çünkü sorgunun kendisi soruyor: `ilDisiBasvurulariGetir`
 * merkezi filtreden geçiyor ve karar veremeyecek roller boş liste alıyor —
 * bölüm de o zaman hiç basılmıyor.
 */
function IlDisiBasvurular({
  basvurular,
}: {
  basvurular: IlDisiBasvuruSatiri[];
}) {
  const bekleyenler = basvurular.filter(
    (basvuru) => basvuru.kaynakIlOnayDurumu === "BEKLIYOR",
  );
  const kararlilar = basvurular.filter(
    (basvuru) => basvuru.kaynakIlOnayDurumu !== "BEKLIYOR",
  );

  return (
    <Kart id="il-disi" className="scroll-mt-6">
      <KartBasligi
        baslik="İl dışına giden başvurular"
        aciklama={`Öğrencinizin başka bir ilin etkinliğine başvurusu · ${bekleyenler.length} karar bekliyor`}
        Ikon={ArrowRightLeft}
      />

      {/*
        Onayın başvuruyu SONUÇLANDIRMADIĞI burada da yazılı. Karar veren kişi
        "onayladım, öğrenci gidiyor" sanırsa, etkinliğin ilindeki değerlendirme
        beklenirken öğrenciye yanlış bilgi verir.
      */}
      <BilgiKutusu cesit="uyari">
        Onayınız başvuruyu sonuçlandırmaz. Onaydan sonra etkinliği düzenleyen il
        kendi değerlendirmesini yapar; öğrenci ancak orada seçilirse katılır.
      </BilgiKutusu>

      {bekleyenler.length === 0 ? (
        <p className="mt-4 text-metin-yumusak">
          Kararınızı bekleyen başvuru yok.
        </p>
      ) : (
        <ul className="mt-4 space-y-4">
          {bekleyenler.map((basvuru) => (
            <li
              key={basvuru.id}
              className="rounded-kart border border-cizgi p-4"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold text-baslik">
                  {basvuru.ogrenciAdSoyad}
                  {basvuru.ogrenciSinifi && (
                    <span className="ml-2 text-sm font-normal text-metin-yumusak">
                      {basvuru.ogrenciSinifi}
                    </span>
                  )}
                </p>
                <span className="text-sm text-metin-yumusak">
                  {tarihYaz(basvuru.basvuruTarihi)}
                </span>
              </div>

              <p className="mt-1 text-sm text-metin-yumusak">
                {basvuru.okulAdi ?? "—"}
              </p>

              <p className="mt-3 text-metin">
                <Link
                  href={`/panel/etkinlikler/${basvuru.faaliyetId}`}
                  className="font-medium text-vurgu-metin underline underline-offset-2"
                >
                  {basvuru.faaliyetAdi}
                </Link>
                <span className="text-metin-yumusak">
                  {" · "}
                  {basvuru.faaliyetYeri}
                  {" · "}
                  {tarihYaz(basvuru.faaliyetTarihi)}
                </span>
              </p>

              <p className="mt-2 rounded-md bg-zemin px-3 py-2 text-sm text-metin">
                <span className="font-medium">Öğrencinin gerekçesi: </span>
                {basvuru.gerekce}
              </p>

              <form
                action={kaynakIlKarariEylemi}
                className="mt-3 flex flex-wrap items-end gap-3"
              >
                <input type="hidden" name="basvuruId" value={basvuru.id} />
                <label className="block grow">
                  <span className="text-sm font-medium text-metin">
                    Gerekçe{" "}
                    <span className="text-metin-yumusak">(redde zorunlu)</span>
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
                  className="inline-flex items-center gap-1.5 rounded-md bg-olumlu-zemin px-3 py-2 text-sm font-medium text-olumlu-metin transition hover:opacity-90"
                >
                  <Check size={15} aria-hidden />
                  Onayla
                </button>
                <button
                  type="submit"
                  name="karar"
                  value="reddet"
                  className="inline-flex items-center gap-1.5 rounded-md bg-hata-zemin px-3 py-2 text-sm font-medium text-hata-metin transition hover:opacity-90"
                >
                  <X size={15} aria-hidden />
                  Reddet
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      {/*
        GEÇMİŞ KARARLAR katlanabilir: "kimi onayladım" sorusunun cevabı gerekli
        ama bölümün işi bekleyenlerdir. Açık bırakılsaydı, etkinlik listesinin
        üstünde her açılışta uzun bir tablo dururdu.
      */}
      {kararlilar.length > 0 && (
        <details className="mt-5">
          <summary className="cursor-pointer text-sm font-medium text-vurgu-metin">
            Karara bağladıklarım ({kararlilar.length})
          </summary>
          <ul className="mt-2 divide-y divide-cizgi text-sm">
            {kararlilar.map((basvuru) => (
              <li key={basvuru.id} className="py-2">
                <span className="text-metin">{basvuru.ogrenciAdSoyad}</span>
                <span className="text-metin-yumusak">
                  {" · "}
                  {basvuru.faaliyetAdi}
                  {" · "}
                  {basvuru.kaynakIlOnayDurumu === "ONAYLANDI"
                    ? "Onayladınız"
                    : "Reddettiniz"}
                  {basvuru.kaynakIlOnayTarihi
                    ? ` · ${tarihYaz(basvuru.kaynakIlOnayTarihi)}`
                    : ""}
                </span>
                {basvuru.kaynakIlRetGerekcesi && (
                  <span className="block text-xs text-metin-yumusak">
                    {basvuru.kaynakIlRetGerekcesi}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </Kart>
  );
}

/*
 * ROZET METİNLERİ (26 Ağustos 2026 · istek: "etkinlik kartlarında 'rapor
 * yazıldı' yerine 'etkinlik yazıldı', yazılmadıysa 'etkinlik bekliyor'
 * desin").
 *
 * Kartın söylediği şey etkinliğin kendi durumu; "rapor" sözcüğü, raporu
 * yazacak kişinin diliydi. Kart listede etkinliklerin yanında duruyor ve
 * okuyan "hangi etkinlik tamam, hangisi bekliyor" diye bakıyor.
 *
 * ROZETİN KOŞULU DEĞİŞMEDİ: hâlâ raporun yazılıp yazılmadığına bakıyor
 * (bkz. raporBekliyor / raporYazildi) ve yalnızca rapor yazabilenlere
 * basılıyor.
 */
function RaporYazildiRozeti() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-olumlu-zemin px-2.5 py-0.5 text-xs font-medium text-olumlu-metin">
      <FileText size={12} aria-hidden />
      Etkinlik yazıldı
    </span>
  );
}

function RaporRozeti() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-uyari-zemin px-2.5 py-0.5 text-xs font-medium text-uyari-metin">
      <FileText size={12} aria-hidden />
      Etkinlik bekliyor
    </span>
  );
}

/** Rozet şeridi; iki görünümde de aynı sırayla basılır. */
function Rozetler({ kart }: { kart: EtkinlikKarti }) {
  return (
    <>
      <KategoriRozeti kategori={kart.etkinlikKategorisi} />
      <KapsamRozeti kapsam={kart.kapsam} />
      <FaaliyetDurumuRozeti durum={kart.durum} />
      <OnayRozeti onayDurumu={kart.onayDurumu} faaliyetDurumu={kart.durum} />
      <PencereRozeti pencere={kart.pencere} faaliyetDurumu={kart.durum} />
      {kart.benimBasvurum && <BasvuruRozeti durum={kart.benimBasvurum} />}
      {/*
        RAPOR ROZETİ (J3): "raporu bekleyenler" filtresi açıkken hangi kaydın
        neden listelendiği görünmeli; filtresiz listede de bitmiş ama raporsuz
        etkinlik gözden kaçmasın. Yalnızca rapor yazabilenlere basılır
        (koşul kartı hazırlarken uygulandı).
      */}
      {kart.raporBekliyor && <RaporRozeti />}
      {kart.raporYazildi && <RaporYazildiRozeti />}
    </>
  );
}

/**
 * KART GÖRÜNÜMÜ — varsayılan (18 Ağustos 2026 · istek: "etkinliklerin
 * görünümü kötü, sablon/1.png'deki gibi yapalım").
 *
 * ÖNCEKİ IZGARANIN SORUNU BİLGİNİN SAKLI OLMASIYDI. Kare afiş kutusunda
 * başlık dışında her şey — durum, düzenleyen birim, son başvuru, rozetler —
 * yalnızca fareyle üstüne gelince açılan bir katmanda vardı. Dokunmatik
 * cihazda o katman hiç açılmıyor; afişi olmayan etkinlikte kutu da boşa
 * düşüyordu. Yeni kartta aynı bilgiler HER ZAMAN basılı ve sıra sabit:
 *
 *     poster (durum rozeti + kalan gün) → düzenleyen birim → başlık →
 *     rozetler → son başvuru → İncele / Başvur
 *
 * TEK GÖRÜNÜM KALDI (20 Ağustos 2026): ızgara ve liste kalktı, gerekçesi
 * aşağıdaki notta.
 */
function KartGorunumu({
  kartlar,
  acabilir,
  basvurabilir,
}: {
  kartlar: EtkinlikKarti[];
  /** Kişi hiç etkinlik açabiliyor mu — "Açtığım etkinlikler" başlığının koşulu. */
  acabilir: boolean;
  /** Kişi hiç başvurabiliyor mu — "Başvurduğum etkinlikler" başlığının koşulu. */
  basvurabilir: boolean;
}) {
  /*
   * ÜÇ BÖLÜM, HER ROLDE VE HER ZAMAN (20 Ağustos 2026 · istek: "listede en
   * üstte açtığım etkinlikler alt kısımda başvurduğum etkinlikler en altta
   * tüm etkinlikler olarak 3 kategori olsun, her seviye kullanıcı için yap"):
   *
   *   Açtığım etkinlikler     kişinin kendi açtıkları
   *   Başvurduğum etkinlikler başvurusu olan, kendi açmadığı etkinlikler
   *   Tüm etkinlikler         geri kalanlar
   *
   * BAŞLIK BOŞKEN DE BASILIR ve altına ne olduğunu söyleyen bir satır gelir:
   * bölüm kaybolsaydı kişi listeyi her açtığında farklı bir düzenle karşılaşır
   * ve "başvurduklarım nereye gitti" diye sorardı. Boş bölüm de bilgidir —
   * "henüz başvurmadınız" demek, ekranda hiçbir şey olmamasından iyidir.
   *
   * TEK İSTİSNA, O ROLDE HİÇ DOLAMAYACAK BÖLÜM: öğrenci etkinlik açamıyor
   * (bkz. faaliyetAcabilirMi), dış kullanıcı başvuramıyor
   * (bkz. basvuruYapabilirMi). Onlara sonsuza kadar boş kalacak bir başlık
   * göstermek, yapabilecekleri bir şey varmış izlenimi verirdi.
   *
   * BİR KART İKİ BÖLÜMDE BASILMAZ: kendi açtığı bir etkinliğe başvurmuş
   * olabilir; o kart yalnızca "Açtığım"da durur — aynı kartı iki kez
   * göstermek listeyi iki katına çıkarır ve sayıları yalanlar.
   */
  const benim = kartlar.filter((kart) => kart.benimActigim);
  const basvurdugum = kartlar.filter(
    (kart) => !kart.benimActigim && kart.benimBasvurum !== null,
  );
  const digerleri = kartlar.filter(
    (kart) => !kart.benimActigim && kart.benimBasvurum === null,
  );

  return (
    <div className="space-y-6">
      {acabilir && (
        <BolumluKartlar
          baslik="Açtığım etkinlikler"
          kartlar={benim}
          bos="Bu listede sizin açtığınız bir etkinlik yok."
        />
      )}
      {basvurabilir && (
        <BolumluKartlar
          baslik="Başvurduğum etkinlikler"
          kartlar={basvurdugum}
          bos="Bu listede başvurduğunuz bir etkinlik yok."
        />
      )}
      <BolumluKartlar
        baslik="Tüm etkinlikler"
        kartlar={digerleri}
        bos="Geriye başka etkinlik kalmadı."
      />
    </div>
  );
}

/** Başlıklı tek bölüm; boşken de basılır (gerekçe: KartGorunumu başlığı). */
function BolumluKartlar({
  baslik,
  kartlar,
  bos,
}: {
  baslik: string;
  kartlar: EtkinlikKarti[];
  bos: string;
}) {
  return (
    <section>
      <h3 className="mb-3 text-sm font-semibold text-baslik">
        {baslik}
        <span className="ml-2 font-normal text-metin-yumusak">
          {kartlar.length}
        </span>
      </h3>
      {kartlar.length === 0 ? (
        <p className="text-sm text-metin-yumusak">{bos}</p>
      ) : (
        <KartListesi kartlar={kartlar} />
      )}
    </section>
  );
}

/**
 * Posterin rengi DURUMU anlatır, süsleme değildir:
 *
 *   yeşil  başvuru açık        amber  henüz açılmadı
 *   gri    başvuru kapandı     kırmızı  iptal edildi
 *
 * KIRMIZI YALNIZCA İPTALE AYRILDI. İlk denemede "kapandı" kırmızıydı ve
 * listedeki etkinliklerin çoğu kapalı olduğu için ekran baştan aşağı kocaman
 * kırmızı bloklarla doluyordu; kurumsal renk uyarı anlamını yitiriyordu.
 * Kapanmak olağan bir son, iptal ise bir kesinti — alarm rengini hak eden o.
 *
 * Renk TEK BAŞINA bilgi taşımıyor: aynı durum sol üstteki rozette yazıyla da
 * yazılı (renk körlüğü ve ekran okuyucu).
 *
 * AFİŞİ OLAN KARTTA TON NÖTR: afişin kendisi çoğunlukla kurumsal kırmızı ve
 * renkli bir bandın üstünde `object-contain` ile durunca ikisi birbirine
 * karışıyor, afişin kenarı görünmez oluyor. Nötr gri bir paspas afişi bir
 * nesne olarak ayırıyor; durumu zaten rozet söylüyor.
 */
function posterTonu(kart: EtkinlikKarti): "vurgu" | "olumlu" | "uyari" | "notr" {
  if (kart.durum !== "AKTIF") return "vurgu";
  if (kart.kapak) return "notr";
  if (kart.pencere === "ACIK") return "olumlu";
  if (kart.pencere === "ACILMADI") return "uyari";
  return "notr";
}

/**
 * "37 gün kaldı" balonu YALNIZCA başvurusu açık etkinlikte basılır.
 *
 * Kapanmış bir etkinlikte geri sayım göstermek yanıltıcı olurdu; açılmamışta
 * ise sayılan şey başvurunun BAŞLAMASINA kalan süredir, bitişine değil — iki
 * farklı sayıyı aynı balonda göstermek kişiye hangisini okuduğunu sordurur.
 *
 * Gün farkı takvim günü olarak hesaplanıyor: saat farkına bakılsaydı, son gün
 * 23:00'te bakan kişi "0 gün kaldı" görürdü — oysa başvurusu hâlâ açık.
 */
function kalanGunSayisi(bitis: Date, simdi: Date): number {
  const gun = 24 * 60 * 60 * 1000;
  const bitisGunu = Date.UTC(
    bitis.getFullYear(),
    bitis.getMonth(),
    bitis.getDate(),
  );
  const bugun = Date.UTC(
    simdi.getFullYear(),
    simdi.getMonth(),
    simdi.getDate(),
  );
  return Math.round((bitisGunu - bugun) / gun);
}

/** Kartların kendisi; bölümlere ayrılmış hâlde iki kez basılır. */
function KartListesi({ kartlar }: { kartlar: EtkinlikKarti[] }) {
  const simdi = new Date();

  return (
    <KartIzgarasi>
      {kartlar.map((kart) => {
        const kalan =
          kart.durum === "AKTIF" && kart.pencere === "ACIK"
            ? kalanGunSayisi(kart.basvuruBitis, simdi)
            : null;

        return (
          <li key={kart.id}>
            <PosterKart
              baslik={kart.ad}
              yol={`/panel/etkinlikler/${kart.id}`}
              ton={posterTonu(kart)}
              Ikon={CalendarDays}
              kapakYolu={
                kart.kapak
                  ? uygulamaYolu(
                      `/panel/etkinlikler/${kart.id}/ekler/${kart.kapak.id}`,
                    )
                  : undefined
              }
              vurguluCerceve={kart.benimActigim}
              durum={
                <>
                  <FaaliyetDurumuRozeti durum={kart.durum} />
                  <PencereRozeti
                    pencere={kart.pencere}
                    faaliyetDurumu={kart.durum}
                  />
                </>
              }
              kalanGun={
                kalan !== null ? (
                  <>
                    <Hourglass size={11} aria-hidden />
                    {kalan <= 0 ? "Son gün" : `${kalan} gün kaldı`}
                  </>
                ) : undefined
              }
              ustSerit={
                <span className="flex items-center gap-1.5">
                  <Landmark size={13} aria-hidden className="shrink-0" />
                  <span className="truncate">{kart.duzenleyenBirim}</span>
                </span>
              }
              rozetler={
                <>
                  <KapsamRozeti kapsam={kart.kapsam} />
                  <KategoriRozeti kategori={kart.etkinlikKategorisi} />
                  <OnayRozeti
                    onayDurumu={kart.onayDurumu}
                    faaliyetDurumu={kart.durum}
                  />
                  {kart.benimBasvurum && (
                    <BasvuruRozeti durum={kart.benimBasvurum} />
                  )}
                  {kart.raporBekliyor && <RaporRozeti />}
                  {kart.raporYazildi && <RaporYazildiRozeti />}
                </>
              }
              altBilgi={
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays size={13} aria-hidden />
                    Son başvuru: {tarihYaz(kart.basvuruBitis)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Users size={13} aria-hidden />
                    {kart.kontenjan.aktifBasvuru}/{kart.kontenjan.kontenjan}
                  </span>
                  {kart.bittiMi && (
                    <span className="inline-flex items-center gap-1">
                      <UserCheck size={13} aria-hidden />
                      {kart.katilimciSayisi} katılımcı
                    </span>
                  )}
                </span>
              }
              eylem={
                <>
                  <Link
                    href={`/panel/etkinlikler/${kart.id}`}
                    className="inline-flex items-center gap-1.5 rounded-kutu border border-cizgi-guclu bg-kart px-3.5 py-2 text-sm font-medium text-metin transition hover:border-vurgu hover:bg-zemin focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vurgu"
                  >
                    İncele
                  </Link>
                  {/*
                    BAŞVUR DÜĞMESİ BURADA FORM AÇMAZ, detaya götürür: başvuru
                    şartname ve ek belgelerin okunmasını gerektiriyor ve kart
                    üstünden tek tıkla başvurtmak, kişiyi görmediği bir metne
                    taahhüt ettirmek olurdu. Prototipteki akış da aynı
                    (A2 detay → A3 sihirbaz).

                    Yalnızca başvurusu AÇIK ve kişinin HENÜZ BAŞVURMADIĞI
                    etkinlikte basılır — başvurmuş kişiye "Başvur" demek,
                    ikinci bir başvuru yapabileceğini ima ederdi.
                  */}
                  {kart.durum === "AKTIF" &&
                    kart.pencere === "ACIK" &&
                    !kart.benimBasvurum && (
                      <Link
                        href={`/panel/etkinlikler/${kart.id}`}
                        className={SINIF_BIRINCIL_BUTON}
                      >
                        Başvur
                      </Link>
                    )}
                </>
              }
            />
          </li>
        );
      })}
    </KartIzgarasi>
  );
}

/*
  IZGARA VE LİSTE GÖRÜNÜMLERİ KALKTI (20 Ağustos 2026 · istek: "etkinlikler
  sayfasındaki ızgara ve liste görünümü kalksın sadece kart görünümü olsun").

  Tek görünüm kaldı: KART. Izgara afişleri yan yana tarasın diye, liste ise
  "hangisinin raporu eksik" denetimi için duruyordu; ikisi de kartın her zaman
  basılı olan rozetleriyle (durum, kontenjan, rapor) fazlasıyla karşılanıyor.
  Denetim tarafındaki asıl araç zaten filtreler: "Onay bekleyenler" ve
  "Raporu bekleyenler" kutuları yerinde.

  `?gorunum=` parametresi de kalktı; eski bağlantılar artık kart görünümünde
  açılıyor, kırık bir sayfa görmüyorlar.
*/

export default async function FaaliyetlerSayfasi({
  searchParams,
}: {
  searchParams: Promise<SorguParametreleri>;
}) {
  const kullanici = await oturumKullanicisiZorunlu();
  const parametreler = await searchParams;

  const filtreler = faaliyetFiltreleriniCoz(parametreler);
  const filtreVar = faaliyetFiltresiVarMi(filtreler);

  const simdi = new Date();
  const ilAdlari = await ilAdlariniGetir();
  const nerede = faaliyetListeFiltresi(kullanici, filtreler, simdi, ilAdlari);

  /*
   * Kişinin SIRADAKİ kendi etkinliği — ölçüt rol değil kişisel bağdır
   * (seçilmiş başvuru ya da düzenleyenlik); ayrıntı lib/faaliyet/yaklasan.ts
   * başlığında. Sorgu EKRANDAKİ FİLTRELERDEN BAĞIMSIZ: kart listeyi değil
   * kişinin takvimini özetliyor, listeyi bir ile daraltmak onu susturmamalı.
   */
  const yaklasanEtkinligim = await yaklasanEtkinligimiGetir(
    kullanici.id,
    simdi,
  );

  /*
   * Raporsuz sayımının koşulu: EKRANDAKİ FİLTRELERDEN BAĞIMSIZ, kapsamdan
   * değil. Kart "toplam kaç iş bekliyor" diyor; kullanıcı listeyi bir ile
   * daralttığında sayının değişmesi, işin bittiği izlenimi verirdi.
   */
  const raporsuzKosulu = faaliyetListeFiltresi(
    kullanici,
    { ...faaliyetFiltreleriniCoz({}), yalnizcaRaporsuz: true },
    simdi,
  );

  /*
   * SAYFALAMA (15 Ağustos 2026 · Aşama 6a — DEFEKT DÜZELTMESİ).
   *
   * Bu ekran kapsamdaki BÜTÜN etkinlikleri tek sorguyla çekip tek sayfaya
   * basıyordu; dosyada ne `skip` ne `take` vardı. Öğrenci envanterinde iş
   * çoktan doğru yapılmış (`SAYFA_BOYUTU = 50`), etkinlikler ekranı o desenden
   * geride kalmıştı. Ulusal ölçekte hem sayfa ağırlığı hem sorgu süresi sorun
   * çıkarır; küçük veride görünmediği için de fark edilmemiş.
   */
  const sayfaNo = Math.max(
    1,
    Number.parseInt(tekil(parametreler.sayfa) ?? "1", 10) || 1,
  );

  /*
   * MERKEZİN İKİ ÖLÇÜMÜ PANELDEN BURAYA TAŞINDI (27 Ağustos 2026 · istekler:
   * "onay bekleyen etkinlikler kartı etkinlikler bölümüne gidecek" · "etkinlik
   * katılımı kart olarak gitsin"). İkisi de bir ETKİNLİK sayısı; onları arayan
   * kişi bu ekranda.
   *
   * SAYILAR ÜLKE GENELİDİR ve ekrandaki süzgeçlerden bağımsız: kart "şu an
   * listede kaç tane" değil, "toplamda ne var" diyor — raporsuz etkinlik
   * kartıyla aynı kural.
   *
   * Yalnızca merkezde sorgulanıyor; başka rolde `null` kalıyor ve hiç
   * çalışmıyor.
   */
  const merkezMi = projeYoneticisiMi(kullanici);
  const [onayBekleyenSayisi, katilim] = merkezMi
    ? await Promise.all([
        prisma.faaliyet.count({ where: { onayDurumu: "BEKLIYOR" } }),
        faaliyetKatilimSayisi(),
      ])
    : [0, null];

  const [toplam, raporsuzSayisi, faaliyetler, gruplar, iller] =
    await Promise.all([
      prisma.faaliyet.count({ where: nerede }),
      /*
       * RAPORSUZ BİTEN ETKİNLİK SAYISI (26 Ağustos 2026 · istek: "bu kartı
       * etkinlikler sayfasına alalım"). Panelde bir sayaç olarak duruyordu
       * ve tıklayınca raporlar ekranına götürüyordu; sayının karşılığı ise
       * bu ekrandaki listeydi.
       *
       * Sayı KAPSAMDAN BAĞIMSIZ değil: `raporsuzKosulu` aynı kapsam
       * filtresini taşıyor, yani kişi yalnızca kendi yazabileceği raporları
       * sayıyor. Ekrandaki filtrelerden ise BAĞIMSIZ — kart "şu an listede
       * kaç tane" değil, "toplam kaç iş bekliyor" diyor.
       */
      prisma.faaliyet.count({ where: raporsuzKosulu }),
      prisma.faaliyet.findMany({
        where: nerede,
        orderBy: faaliyetSiralamasi(filtreler.sira),
        skip: (sayfaNo - 1) * SAYFA_BOYUTU,
        take: SAYFA_BOYUTU,
        select: {
          id: true,
          ad: true,
          aciklama: true,
          tarih: true,
          kapsam: true,
          etkinlikKategorisi: true,
          temelEtkinlikProgrami: { select: { ad: true } },
          kontenjan: true,
          onayDurumu: true,
          durum: true,
          duzenleyenBirim: true,
          duzenleyenKullaniciId: true,
          bitisTarihi: true,
          basvuruBaslangic: true,
          basvuruBitis: true,
          // Silinen ek kapak olarak bırakılmaz; yine de savunmacı davranıp
          // silinmişse gösterme.
          kapakEk: { select: { id: true, dosyaAdi: true, silindiMi: true } },
          kurum: { select: { ad: true } },
          il: { select: { ad: true } },
          calismaGruplari: {
            select: { calismaGrubu: { select: { id: true, ad: true } } },
          },
          basvurular: { select: { durum: true } },
          // Katılımcı sütunu (Aşama 6c): "kaç kişiye yer verildi" sorusunun
          // cevabı seçilen başvurulardır, toplam başvuru değil.
          _count: { select: { basvurular: { where: { durum: "SECILDI" } } } },
          // Rapor durumu listede gösteriliyor (J3): "raporu bekleyenler"
          // filtresi açıkken hangi kaydın neden listelendiği görünmeli.
          rapor: { select: { faaliyetId: true } },
        },
      }),
      prisma.calismaGrubu.findMany({
        where: { aktif: true },
        orderBy: { siraNo: "asc" },
        select: { id: true, ad: true },
      }),
      /*
       * İL SÜZGECİNİN LİSTESİ (21 Ağustos 2026 · istek: "illere göre de arama
       * yapabilsin tümü ya da il seç"). Liste kapsamla daraltılmıyor: süzgeç
       * yalnızca daraltır, kapsam filtresi kimin neyi göreceğini zaten
       * söylüyor — başka bir ili seçen kişi boş liste görür, o ilin
       * etkinliklerini değil.
       */
      prisma.il.findMany({
        orderBy: { ad: "asc" },
        select: { ilKodu: true, ad: true },
      }),
  ]);

  // Kişi kendi başvuru durumunu listede görür; başkasının başvurusu okunmaz.
  // Katılımcı öğretmen de olabildiği için koşul "öğrenci mi" değil
  // "başvurabilir mi" sorusudur.
  const kendiBasvurulari = basvuruYapabilirMi(kullanici)
    ? await prisma.basvuru.findMany({
        where: {
          katilimciId: kullanici.id,
          faaliyetId: { in: faaliyetler.map((faaliyet) => faaliyet.id) },
        },
        orderBy: { basvuruTarihi: "asc" },
        select: { faaliyetId: true, durum: true },
      })
    : [];
  const basvuruDurumum = new Map(
    kendiBasvurulari.map((basvuru) => [basvuru.faaliyetId, basvuru.durum]),
  );

  await erisimLoglaCoklu(
    faaliyetler.map((faaliyet) => ({
      kullaniciId: kullanici.id,
      islem: "GORUNTULEME" as const,
      hedefTip: "FAALIYET" as const,
      hedefId: faaliyet.id,
      detay: "Etkinlik listesi görüntülendi",
    })),
  );

  const acabilir = faaliyetAcmaYetkisiVarMi(kullanici);
  // Kart görünümündeki "Başvurduğum etkinlikler" bölümünün koşulu; aynı
  // soruyu kendi başvurularının sorgusu da soruyor (bkz. kendiBasvurulari).
  const basvurabilir = basvuruYapabilirMi(kullanici);

  /*
   * Rapor yazabilen roller: danışman öğretmen (kendi açtığı), il koordinatörü
   * (ilindeki her etkinlik) ve merkez. Öğrenci ve dış kullanıcı rapor yazmaz,
   * onlara "raporu bekleyenler" filtresi hiç gösterilmez.
   */
  const raporYazabilir =
    danismanMi(kullanici) ||
    ilKoordinatoruMu(kullanici) ||
    projeYoneticisiMi(kullanici);

  /*
   * ONAY KUYRUĞU FİLTRESİ, onay verebilen rollere gösteriliyor: il koordinatörü
   * ve proje yöneticisi (bkz. faaliyetOnaylayabilirMi). Merkez için bu filtre
   * ekranın asıl işidir — öğrencinin ilinde koordinatör olmadığında bekleyen
   * etkinliğe ulaşabildiği tek toplu görünüm burasıdır.
   *
   * Kapı ROL seviyesinde soruluyor, kayıt seviyesinde değil: hangi bekleyen
   * kaydın kimin kararına düştüğünü kapsam filtresi zaten söylüyor. Danışman
   * öğretmen dışarıda; kendi bekleyen etkinliğini "benim açtıklarım"dan görür,
   * ona onay kuyruğu diye bir liste sunmak yetkisini olduğundan geniş
   * gösterirdi.
   */
  const onaylayabilir =
    ilKoordinatoruMu(kullanici) || projeYoneticisiMi(kullanici);

  /*
   * İl dışı başvurular (11 Ağustos 2026). Sorgu YALNIZCA karar verebilecek
   * roller için çalıştırılıyor; diğerlerinde `ilDisiBasvuruFiltresi` zaten boş
   * liste döndürürdü ama her etkinlik listesi açılışında gereksiz bir sorgu
   * atmanın anlamı yok.
   */
  const ilDisiBasvurular = onaylayabilir
    ? await ilDisiBasvurulariGetir(kullanici)
    : [];

  /*
   * CSV ÖĞRENCİDE YOK (10 Ağustos 2026 · istek: "öğrenci etkinliklerinde CSV
   * indir kalkacak"). Karar izinler.ts'te tek yerde veriliyor
   * (faaliyetDisaAktarabilirMi); rota da aynı kapıyı soruyor.
   */
  const disaAktarabilir = faaliyetDisaAktarabilirMi(kullanici);
  /*
   * Görünüm tercihi filtre DEĞİLDİR: dışa aktarmanın kapsamını değiştirmez ve
   * "Filtreleri temizle" bağlantısını tetiklememeli. Bu yüzden
   * faaliyetFiltreleriniCoz'a girmez, sorgudan da elenir.
   */
  const disaAktarmaSorgusu = sorguMetni(parametreler, ["gorunum", "sayfa"]);
  const disaAktarmaBaglantisi = disaAktarmaSorgusu
    ? `/panel/etkinlikler/disa-aktar?${disaAktarmaSorgusu}`
    : "/panel/etkinlikler/disa-aktar";

  const sonSayfa = Math.max(1, Math.ceil(toplam / SAYFA_BOYUTU));

  /** Sayfa bağlantısı: süzgeçleri, sekmeyi ve görünümü korur. */
  const sayfaSorgusu = (yeniSayfa: number) => {
    const sorgu = new URLSearchParams(sorguMetni(parametreler, ["sayfa"]));
    sorgu.set("sayfa", String(yeniSayfa));
    return sorgu.toString();
  };

  /** Sekme bağlantısı: süzgeçleri ve görünümü korur, sayfayı düşürür. */
  const sekmeSorgusu = (zaman: FaaliyetFiltreleri["zaman"]) => {
    const sorgu = new URLSearchParams(sorguMetni(parametreler, ["zaman", "sayfa"]));
    if (zaman !== "hepsi") sorgu.set("zaman", zaman);
    return sorgu.toString();
  };

  /** Sıralama bağlantısı: süzgeçleri ve sekmeyi korur, sayfayı düşürür. */
  const siraSorgusu = (sira: FaaliyetFiltreleri["sira"]) => {
    const sorgu = new URLSearchParams(sorguMetni(parametreler, ["sira", "sayfa"]));
    if (sira !== "yeni") sorgu.set("sira", sira);
    return sorgu.toString();
  };

  const kartlar: EtkinlikKarti[] = faaliyetler.map((faaliyet) => ({
    katilimciSayisi: faaliyet._count.basvurular,
    bittiMi: (faaliyet.bitisTarihi ?? faaliyet.tarih) <= simdi,
    id: faaliyet.id,
    ad: faaliyet.ad,
    aciklama: faaliyet.aciklama,
    tarih: faaliyet.tarih,
    duzenleyenBirim: faaliyet.duzenleyenBirim,
    basvuruBitis: faaliyet.basvuruBitis,
    kapsam: faaliyet.kapsam,
    etkinlikKategorisi: faaliyet.etkinlikKategorisi,
    durum: faaliyet.durum,
    onayDurumu: faaliyet.onayDurumu,
    calismaGruplari: faaliyet.calismaGruplari.map(
      (etiket) => etiket.calismaGrubu,
    ),
    kapak:
      faaliyet.kapakEk && !faaliyet.kapakEk.silindiMi
        ? { id: faaliyet.kapakEk.id, dosyaAdi: faaliyet.kapakEk.dosyaAdi }
        : null,
    kontenjan: kontenjanDurumu(faaliyet.basvurular, faaliyet.kontenjan),
    pencere: basvuruPenceresi(faaliyet, simdi),
    benimBasvurum: basvuruDurumum.get(faaliyet.id) ?? null,
    raporBekliyor:
      raporYazabilir &&
      faaliyet.rapor === null &&
      faaliyet.durum === "AKTIF" &&
      (faaliyet.bitisTarihi ?? faaliyet.tarih) < simdi,
    /*
     * OLUMLU GÖSTERGE (Aşama 6d). "Raporu bekliyor" rozeti zaten vardı;
     * eksik olan, raporu YAZILMIŞ etkinliğin de listede görünmesiydi. Manisa
     * panelinde bu iş renkli/soluk bir ikonla yapılıyor; burada ETİKET, çünkü
     * renk tek başına bilgi taşımamalı (ekran okuyucu ve renk körlüğü).
     *
     * Yalnızca bitmiş etkinlikte basılır: başlamamış bir etkinliğin raporunun
     * olmaması bir eksiklik değil, olağan durum.
     */
    raporYazildi:
      raporYazabilir &&
      faaliyet.rapor !== null &&
      faaliyet.durum === "AKTIF" &&
      (faaliyet.bitisTarihi ?? faaliyet.tarih) < simdi,
    benimActigim: faaliyet.duzenleyenKullaniciId === kullanici.id,
  }));

  return (
    <div className="space-y-6">
      {/*
        BAŞLIK BLOĞU ARTIK SayfaBasligi'NIN KENDİ DÜZENİ (18 Ağustos 2026 ·
        tasarım yenilemesi). Sarmalayan flex kabı kaldırıldı: bileşen artık
        `rozet` ve `eylem` alıyor ve hizalamayı kendisi kuruyor, yani aynı
        düzen her sayfada tek yerden geliyor.

        10 Ağustos 2026'daki karar KORUNDU — iki düğme hâlâ tek kapta ve sağ
        uca yaslı; `eylem` içeriğini kendi sarmalına alıyor, dolayısıyla
        düğmelerden biri yetkiye göre gizlenirse kalan tek başına sağda durur.
      */}
      <SayfaBasligi
        baslik="Etkinlikler"
        /*
          "← PROFİL" KALKTI (29 Ağustos 2026 · istekler: "pano da profile
          dönüyor" · "vitrin de profile dönüyor").

          Bağlantı `SayfaBasligi`nın VARSAYILANIYDI (bkz. components/ui.tsx) ve
          bu sayfa onu geçmediği için basılıyordu. Varsayılanın gerekçesi
          "Profil'deki kartla açılan, menüde karşılığı olmayan ekranlardan
          çıkılamıyor"du; BU EKRAN O EKRANLARDAN DEĞİL — sol menüde kendi satırı
          var, yani kişi buraya Profil'den geçmek zorunda değil ve dönüşü de
          menüde duruyor. Ekranın altındakiler kendi şeritlerini basıyor.
        */
        geri={null}
        rozet={
          /*
            Sayım açıklamadan rozete taşındı: "· 143 kayıt · 2. sayfa" düz
            cümlenin sonuna eklenince okunmuyordu, oysa listede kaç kayıt
            olduğu bu ekranın en çok bakılan bilgisi.
          */
          <>
            <Rozet cesit="vurgu">{toplam} kayıt</Rozet>
            {toplam > SAYFA_BOYUTU && <Rozet>{sayfaNo}. sayfa</Rozet>}
          </>
        }
        eylem={
          <>
            {/*
            DÜĞMENİN ADI HERKESTE AYNI (12 Ağustos 2026 · istek: "mentör/paydaş
            girişinde de MEB kullanıcılarındaki gibi 'Yeni etkinlik' yazsın").
            7 Ağustos'ta dış kullanıcıya "Etkinlik bildir" yazılmıştı; bildirimin
            onaya düştüğünü zaten kapsam uyarıları anlatıyor, düğmenin role göre
            ad değiştirmesi aynı işi iki adla gösteriyordu.
          */}
            {acabilir && (
              <Link
                href="/panel/etkinlikler/yeni"
                className={SINIF_KIRMIZI_BUTON}
              >
                <Plus size={16} aria-hidden />
                Yeni etkinlik
              </Link>
            )}
            {/*
              ÖĞRENCİDE PASİF DÜĞME (23 Ekim 2026 · istek: "Öğrenci etkinlik
              açamaz, düğme pasif olsun"). Düğme kaldırılmadı, tıklanamaz
              basılıyor; yanındaki ipucu nedenini söylüyor.
            */}
            {!acabilir && (
              <button
                type="button"
                disabled
                title={
                  ogrenciMi(kullanici)
                    ? "Öğrenciler etkinlik açamaz; mevcut etkinliklere başvurabilirsiniz."
                    : "Etkinlikleri proje yöneticisi açar."
                }
                className={`${SINIF_KIRMIZI_BUTON} cursor-not-allowed opacity-50`}
              >
                <Plus size={16} aria-hidden />
                Yeni etkinlik
              </button>
            )}
          {/*
            BELGE OLUŞTUR menüden kalktı (J3); etkinlik seçim ekranına giden yol
            buradan açık kalıyor. Sayfa silinmedi, yalnızca menüden çıktı.

            10 AĞUSTOS 2026 · istek: "etkinliklerde belge oluştur görünür olsun,
            yeni etkinliğin yanına gelsin". Sayfa başlığının altındaki gri düğme
            menüden kalkmış bir ekranın TEK kapısıydı ve kimse bulamıyordu.
            Aynı gün gelen ikinci istekle iki düğme de kırmızı: renk temadan
            geliyor (hata paleti) — beş temanın hepsinde okunur bir kırmızı
            verir, sabit bir #c00 karanlık temada boğulurdu.

            KİMİN GÖRDÜĞÜ DEĞİŞMEDİ: belge yazabilenler, yani rapor yazabilen
            roller. "Görünür olsun" bir yer ve vurgu isteğidir; öğrenciye belge
            üretme kapısı açmaz.
          */}
            {/*
              23 EKİM 2026 · istekler: öğretmen ve koordinatörde "Belge oluştur
              … pasif". Belgeyi yalnızca proje yöneticisi üretir; diğer
              rollerde düğme tıklanamaz basılıyor.
            */}
            {belgeUretenRoldeMi(kullanici) ? (
              <Link href="/panel/belgeler" className={SINIF_KIRMIZI_BUTON}>
                <Award size={16} aria-hidden />
                Belge oluştur
              </Link>
            ) : (
              !disKullaniciMi(kullanici) && (
                <button
                  type="button"
                  disabled
                  title="Belgeleri proje yöneticisi oluşturur."
                  className={`${SINIF_KIRMIZI_BUTON} cursor-not-allowed opacity-50`}
                >
                  <Award size={16} aria-hidden />
                  Belge oluştur
                </button>
              )
            )}
            {/*
              ETKİNLİK RAPORLARI (26 Ağustos 2026 · istek: "bu kartı
              etkinliklere taşı"). Kart Yönetim Paneli'ndeydi ve oradan kalktı;
              rapor bir ETKİNLİĞİN raporu, onu arayan kişi bu ekranda.

              DÜĞME İKİNCİL: "Yeni etkinlik" ve "Belge oluştur" bir şey ÜRETİR,
              bu bir listeye götürür. Üçü de kırmızı olsaydı hangisinin kayıt
              açtığı seçilemezdi.

              KAPI RAPOR YAZABİLENLERDE: ekranın kendi yetkisi de bu
              (koordinatör, merkez ve danışman öğretmen) — kartın panodaki
              hâlinde de böyleydi.
            */}
            {etkinlikRaporlariGorebilirMi(kullanici) ? (
              <Link href="/panel/raporlar" className={SINIF_IKINCIL_BUTON}>
                <FileText size={16} aria-hidden />
                Etkinlik raporları
              </Link>
            ) : (
              !disKullaniciMi(kullanici) && (
                <button
                  type="button"
                  disabled
                  title="Etkinlik raporları listesi proje yöneticisine açıktır."
                  className={`${SINIF_IKINCIL_BUTON} cursor-not-allowed opacity-50`}
                >
                  <FileText size={16} aria-hidden />
                  Etkinlik raporları
                </button>
              )
            )}
          </>
        }
      />

      {/* Etkinlik silindikten sonra buraya dönülüyor (bkz. faaliyetSilEylemi). */}
      {tekil(parametreler.durum) === "silindi" && (
        <BilgiKutusu cesit="olumlu">Etkinlik silindi.</BilgiKutusu>
      )}

      {/*
        YAKLAŞAN ETKİNLİĞİM (31 Ağustos 2026 · istek: "profilde Yaklaşan
        etkinliğim … bu kartı etkinlikler bölümüne kart olarak taşıyalım").

        Kart 13 Ağustos'tan beri Profil'in ölçüm ızgarasındaydı; oradan KALKTI.
        Gerekçe komşularıyla aynı yönde: bir etkinliğin tarihi, sıfatı ve
        bağlantısı bu ekranın konusu — Profil'de kişinin kendi kaydını okuyan
        kartların arasında tek tarihli taahhüt olarak duruyordu ve tıklayınca
        zaten buraya (etkinlik sayfasına) götürüyordu.

        EKRANIN EN ÜSTÜNDE, LİSTENİN VE SÜZGEÇLERİN ÖNÜNDE: liste "hangi
        etkinlikler var" sorusunu cevaplıyor, kart "benim sıradaki hangisi"
        sorusunu. İkincisi bu ekrana gelen kişinin ilk sorusudur ve elli
        satırlık bir listenin altında aranmamalı.

        KAYDI YOKSA HİÇ BASILMIYOR: "yaklaşan etkinliğiniz yok" satırı, altında
        başvurusu açık etkinliklerin listesi dururken bir eksik bildirimi
        olurdu. Aynı kural Profil'deki hâlinde de geçerliydi.

        DEĞER = ETKİNLİK ADI, açıklama = tarih · kalan gün · SIFAT. Sıfat şart:
        aynı kart hem "oraya katılıyorsun" hem "orayı sen düzenliyorsun"
        diyebiliyor ve ikisi çok farklı işler.
      */}
      {yaklasanEtkinligim && (
        <OlcumKarti
          baslik="Yaklaşan etkinliğim"
          ton="vurgu"
          Ikon={CalendarClock}
          deger={yaklasanEtkinligim.ad}
          aciklama={`${tarihYaz(yaklasanEtkinligim.tarih)} · ${etkinligeKalanYaz(
            yaklasanEtkinligim.tarih,
            simdi,
          )} · ${
            yaklasanEtkinligim.sifat === "DUZENLEYEN"
              ? "düzenleyensiniz"
              : "katılımcısınız"
          }`}
          yol={`/panel/etkinlikler/${yaklasanEtkinligim.id}`}
        />
      )}

      {/*
        MERKEZİN ÖLÇÜM ŞERİDİ (27 Ağustos 2026). Kartlar panelden buraya taşındı;
        gerekçe yukarıdaki sorgunun başında yazılı.

        ONAY KARTININ BAĞLANTISI SAYININ KENDİSİYLE AYNI ŞEYİ SÖYLER
        (?onay=bekleyen): kartın paneldeki hâlinde bir tur boyunca sayı ülke
        genelini sayarken bağlantı ulusal kapsam listesine götürüyordu ve
        tıklayan kişi saydığı kayıtları listede bulamıyordu. Süzgeç bu ekranın
        kendi süzgeci, yani kart tıklanınca kişi başka bir sayfaya düşmüyor.

        KATILIM KARTI BAĞLANTISIZ: karşılığı bir liste değil, seçilmiş
        başvuruların toplamı — tıklanacak bir yeri yok.
      */}
      {merkezMi && (
        <div className="grid gap-3 sm:grid-cols-2">
          <OlcumKarti
            baslik="Onay bekleyen etkinlik"
            ton="uyari"
            Ikon={ClipboardCheck}
            deger={String(onayBekleyenSayisi)}
            yol="/panel/etkinlikler?onay=bekleyen"
          />
          {katilim && (
            <OlcumKarti
              baslik="Etkinlik katılımı"
              Ikon={Send}
              deger={String(katilim.toplamKatilim)}
              /*
               * Toplam ve tekil AYRI sorulardır: ilki programın yükünü,
               * ikincisi kaç farklı kişiye ulaşıldığını söyler. Tek sayı
               * gösterilseydi "400 katılım" ile "120 öğrenciye ulaştık"
               * birbirine karışırdı.
               */
              aciklama={`${katilim.tekilKatilimci} farklı kişi · seçilmiş başvurular`}
            />
          )}
        </div>
      )}

      {/*
        RAPORSUZ BİTEN ETKİNLİK (26 Ağustos 2026 · istek: "bu kartı
        etkinlikler sayfasına alalım"). Panelde bir sayaçtı ve raporlar
        ekranına götürüyordu; sayının karşılığı olan liste ise burası.

        SIFIRDA BASILMAZ: "0 etkinlik raporu bekliyor" bir iş değil, bir
        gürültü. Yalnızca rapor yazabilenlere basılır — öğrenciye bekleyen
        rapor göstermek, yapamayacağı bir işi sayması olurdu.

        Bağlantı listeyi SÜZÜYOR (?raporsuz=1): kart tıklanınca aynı ekranda
        yalnızca o etkinlikler kalıyor, kişi başka bir sayfaya düşmüyor.
      */}
      {raporYazabilir && raporsuzSayisi > 0 && (
        <Link href="/panel/etkinlikler?raporsuz=1" className="block">
          <div className="flex items-center gap-4 rounded-kart border border-uyari-cizgi bg-uyari-zemin p-4 transition hover:border-uyari-metin">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-kart text-uyari-metin">
              <FileText size={20} aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block font-semibold text-uyari-metin">
                {raporsuzSayisi} etkinliğin raporu bekliyor
              </span>
              <span className="block text-sm text-uyari-metin">
                Bitti ama raporu yazılmadı. Listeyi süzmek için tıklayın.
              </span>
            </span>
          </div>
        </Link>
      )}
      <form
        method="get"
        className="rounded-kart border border-cizgi bg-kart p-5 shadow-kart"
      >
        {/* Süzgeç değişince seçili tarih sırası korunsun. */}
        {filtreler.sira !== "yeni" && (
          <input type="hidden" name="sira" value={filtreler.sira} />
        )}
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-baslik">
            <Filter size={16} className="text-vurgu-metin" aria-hidden />
            Filtreler
          </h2>
          {filtreVar && (
            <Link
              href="/panel/etkinlikler"
              className="inline-flex items-center gap-1 text-sm font-medium text-vurgu-metin"
            >
              <X size={14} aria-hidden />
              Filtreleri temizle
            </Link>
          )}
        </div>

        {/*
          SÜZGEÇLERİN SIRASI (21 Ağustos 2026 · geri bildirim: "etkinliklerde
          kapsam ve katılım biçimi aynı olmuş").

          İki alan farklı şeyler soruyor ama yan yana iki açılır liste olarak
          birbirinin kopyası gibi duruyordu. Ayrım artık etikette YAZILI:
          kapsam KİMLERİN başvurabildiğini, katılım biçimi etkinliğin NEREDE
          yapıldığını söylüyor. Katılım biçimi de açılır liste değil, tek
          bakışta okunan bir düğme şeridi — üç seçenekli bir alan için liste
          zaten fazlaydı.
        */}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={SINIF_ETIKET}>Ara</span>
            <input
              type="search"
              name="ara"
              defaultValue={filtreler.arama ?? ""}
              placeholder="Etkinlik adı ya da açıklamasında ara"
              className={SINIF_GIRDI}
            />
          </label>

          <label className="block">
            <span className={SINIF_ETIKET}>İl</span>
            <select
              name="il"
              defaultValue={filtreler.ilKodu ?? ""}
              className={SINIF_SECIM}
            >
              <option value="">Tüm iller</option>
              {iller.map((il) => (
                <option key={il.ilKodu} value={il.ilKodu}>
                  {il.ad}
                </option>
              ))}
            </select>
          </label>

          {/*
            ETKİNLİK KATEGORİSİ SÜZGECİ KALKTI (20 Ağustos 2026 · istek:
            "filtre kısmından da etkinlik kategorisi kalksın"). Kategori
            oluşturma formunda da sorulmuyor artık; kayıtlı etkinliklerin
            rozeti yerinde duruyor.
          */}
          <label className="block">
            <span className={SINIF_ETIKET}>Kapsam — kimler başvurabilir</span>
            <select
              name="kapsam"
              defaultValue={filtreler.kapsam ?? ""}
              className={SINIF_SECIM}
            >
              <option value="">Tüm kapsamlar</option>
              {KAPSAMLAR.map((kapsam) => (
                <option key={kapsam} value={kapsam}>
                  {KAPSAM_ETIKETLERI[kapsam]}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className={SINIF_ETIKET}>Çalışma grubu</span>
            <select
              name="grup"
              defaultValue={filtreler.calismaGrubuId ?? ""}
              className={SINIF_SECIM}
            >
              <option value="">Tüm gruplar</option>
              {gruplar.map((grup) => (
                <option key={grup.id} value={grup.id}>
                  {grup.ad}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/*
          KATILIM BİÇİMİ DÜĞME ŞERİDİ. `<input type="radio">` + etiket:
          JavaScript yok, seçili olan işaretli geliyor ve form gönderilince
          `bicim` parametresi olarak gidiyor. "Hepsi" boş değer taşıyor —
          süzgeci kaldırmanın karşılığı.
        */}
        <fieldset className="mt-4">
          <legend className={SINIF_ETIKET}>
            Katılım biçimi — etkinlik nerede yapılıyor
          </legend>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {[
              { deger: "", etiket: "Hepsi" },
              ...KATILIM_BICIMLERI.map((bicim) => ({
                deger: bicim as string,
                etiket: KATILIM_BICIMI_ETIKETLERI[bicim],
              })),
            ].map((secenek) => (
              <label
                key={secenek.deger || "hepsi"}
                className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-cizgi px-3.5 py-1.5 text-sm font-medium text-metin transition hover:border-vurgu has-checked:border-vurgu has-checked:bg-vurgu-zemin has-checked:text-vurgu-metin"
              >
                <input
                  type="radio"
                  name="bicim"
                  value={secenek.deger}
                  defaultChecked={
                    (filtreler.katilimBicimi ?? "") === secenek.deger
                  }
                  className="h-3.5 w-3.5 accent-[var(--renk-birincil)]"
                />
                {secenek.etiket}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-metin">
            <input
              type="checkbox"
              name="acik"
              value="1"
              defaultChecked={filtreler.yalnizcaAcik}
              className="h-4 w-4 rounded border-cizgi accent-[var(--renk-birincil)]"
            />
            Başvurusu açık olanlar
          </label>
          {kisininIlKodu(kullanici) && (
            <label className="flex items-center gap-2 text-sm text-metin">
              <input
                type="checkbox"
                name="ilim"
                value="1"
                defaultChecked={filtreler.yalnizcaIlim}
                className="h-4 w-4 rounded border-cizgi accent-[var(--renk-birincil)]"
              />
              Yalnızca ilimdeki etkinlikler
            </label>
          )}
          {acabilir && (
            <label className="flex items-center gap-2 text-sm text-metin">
              <input
                type="checkbox"
                name="benim"
                value="1"
                defaultChecked={filtreler.yalnizcaBenim}
                className="h-4 w-4 rounded border-cizgi accent-[var(--renk-birincil)]"
              />
              Benim açtıklarım
            </label>
          )}
          {onaylayabilir && (
            <label className="flex items-center gap-2 text-sm text-metin">
              <input
                type="checkbox"
                name="onay"
                value="bekleyen"
                defaultChecked={filtreler.yalnizcaOnayBekleyen}
                className="h-4 w-4 rounded border-cizgi accent-[var(--renk-birincil)]"
              />
              Onay bekleyenler
            </label>
          )}
          {/*
            RAPOR BEKLEYENLER (J3 · 6 Ağustos 2026). Raporlar sekmesi menüden
            kalktı; o ekranın asıl değeri "hangi raporlar eksik" TOPLU
            görünümüydü ve etkinlik detayından tek tek bakmak koordinatörün
            ilindeki eksikleri görmesini imkânsız kılardı. Filtre yalnızca rapor
            YAZABİLENLERE gösteriliyor — kimsenin yazamayacağı bir eksiği
            listelemek gürültüden başka bir şey değil.
          */}
          {raporYazabilir && (
            <label className="flex items-center gap-2 text-sm text-metin">
              <input
                type="checkbox"
                name="raporsuz"
                value="1"
                defaultChecked={filtreler.yalnizcaRaporsuz}
                className="h-4 w-4 rounded border-cizgi accent-[var(--renk-birincil)]"
              />
              Raporu bekleyenler
            </label>
          )}
          <button type="submit" className={SINIF_BIRINCIL_BUTON}>
            Filtrele
          </button>
          {disaAktarabilir && toplam > 0 && (
            /*
             * DOSYA SAYFAYI DEĞİL KÜMENİN TAMAMINI taşır: bağlantı sayfa
             * numarasını içermiyor (`sorguMetni` ondan eleniyor). Sayfa da
             * taşınsaydı indirilen dosya sessizce 50 satırdan ibaret kalırdı.
             */
            <DisaAktarmaBagi yol={disaAktarmaBaglantisi} kayitSayisi={toplam} />
          )}
        </div>
      </form>

      {/*
        İL DIŞI BAŞVURULAR, ETKİNLİK LİSTESİNİN ÜSTÜNDE. Bekleyen bir karar
        varsa o, listeye göz atmaktan önce gelir: koordinatör karar vermeden
        etkinliğin ili başvuruyu değerlendiremiyor, yani bekleyen her satır bir
        yerde duran bir işi tutuyor.

        Bölüm kararı olmayanlara da basılıyor ("Kararınızı bekleyen başvuru
        yok") — sekme kalktığı için kullanıcının "bu iş nereye gitti" sorusunun
        cevabı bir yerde durmalı. Karar veremeyen rollerde liste zaten boş
        geliyor ve bölüm hiç basılmıyor.
      */}
      {onaylayabilir && <IlDisiBasvurular basvurular={ilDisiBasvurular} />}

      {/*
        ZAMAN SEKMELERİ (Aşama 6b). Manisa'da "Devam Eden / Tamamlanan" ayrı
        sekmeler; bizde durum rozeti vardı ama tek tıkla daraltma yoktu.

        SEKME İLE GÖRÜNÜM AYRI EKSEN: Manisa'da ikisi iç içe (Etkinlikler
        sekmesi kart, diğerleri tablo) ve bu, "tamamlananları kart olarak
        görmek" isteyeni çıkmaza sokuyor. Sekme değişince görünüm tercihi ve
        süzgeçler korunuyor, yalnızca sayfa numarası düşüyor — üçüncü sayfadayken
        sekme değiştiren kişi yeni listenin başında olmalı.
      */}
      <nav className="flex flex-wrap gap-2" aria-label="Zaman durumu">
        {(
          [
            ["hepsi", "Tüm etkinlikler"],
            ["devam", "Devam eden"],
            ["tamamlanan", "Tamamlanan"],
          ] as const
        ).map(([deger, etiket]) => (
          <Link
            key={deger}
            href={`/panel/etkinlikler?${sekmeSorgusu(deger)}`}
            aria-current={filtreler.zaman === deger ? "page" : undefined}
            className={
              filtreler.zaman === deger
                ? "rounded-kart bg-vurgu-zemin px-3 py-2 text-sm font-medium text-vurgu-metin"
                : "rounded-kart border border-cizgi px-3 py-2 text-sm text-metin-yumusak"
            }
          >
            {etiket}
          </Link>
        ))}
        {/* Tarih sırası (31 Ekim 2026): sekmelerin yanında, sağa yaslı. */}
        <span className="ml-auto flex items-center gap-2">
          <span className="text-sm text-metin-yumusak">Tarih:</span>
          {(
            [
              ["yeni", "Yeniden eskiye"],
              ["eski", "Eskiden yeniye"],
            ] as const
          ).map(([deger, etiket]) => (
            <Link
              key={deger}
              href={`/panel/etkinlikler?${siraSorgusu(deger)}`}
              aria-current={filtreler.sira === deger ? "true" : undefined}
              className={
                filtreler.sira === deger
                  ? "rounded-kart bg-vurgu-zemin px-3 py-2 text-sm font-medium text-vurgu-metin"
                  : "rounded-kart border border-cizgi px-3 py-2 text-sm text-metin-yumusak"
              }
            >
              {etiket}
            </Link>
          ))}
        </span>
      </nav>

      {faaliyetler.length === 0 ? (
        <Kart className="text-metin-yumusak">
          {filtreVar
            ? "Bu filtrelerle eşleşen etkinlik yok."
            : acabilir
              ? "Kapsamınızda henüz etkinlik yok. İlkini siz açabilirsiniz."
              : "Kapsamınızda henüz duyurulmuş bir etkinlik yok."}
        </Kart>
      ) : (
        <div className="space-y-3">
          <KartGorunumu
            kartlar={kartlar}
            acabilir={acabilir}
            basvurabilir={basvurabilir}
          />

          {/*
            SAYFALAMA (Aşama 6a). Öğrenci envanterindeki düzenin aynısı:
            solda "kaçıncı kayıtlar", sağda gezinme. Sayfa numarası adres
            çubuğunda taşınıyor ki bağlantı paylaşılabilsin; dışa aktarma
            bağlantısından ise eleniyor (dosya kümenin tamamı).
          */}
          {sonSayfa > 1 && (
            <div className="flex items-center justify-between text-sm text-metin-yumusak">
              <span>
                {(sayfaNo - 1) * SAYFA_BOYUTU + 1}–
                {Math.min(sayfaNo * SAYFA_BOYUTU, toplam)} / {toplam} kayıt
              </span>
              <span className="flex gap-2">
                {sayfaNo > 1 && (
                  <Link
                    href={`/panel/etkinlikler?${sayfaSorgusu(sayfaNo - 1)}`}
                    className="rounded-kart border border-cizgi px-3 py-1"
                  >
                    Önceki
                  </Link>
                )}
                {sayfaNo < sonSayfa && (
                  <Link
                    href={`/panel/etkinlikler?${sayfaSorgusu(sayfaNo + 1)}`}
                    className="rounded-kart border border-cizgi px-3 py-1"
                  >
                    Sonraki
                  </Link>
                )}
              </span>
            </div>
          )}
        </div>
      )}

      {/*
        ÇALIŞMA GRUBU NOTU KALKTI (21 Ağustos 2026 · istek). Kural değişmedi —
        etiketler başvuruyu kısıtlamıyor; kalkan, listenin altında her açılışta
        duran bilgi kutusuydu.
      */}
    </div>
  );
}
