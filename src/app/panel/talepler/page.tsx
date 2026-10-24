import {
  BadgeCheck,
  Compass,
  CalendarClock,
  ClipboardCheck,
  Filter,
  GraduationCap,
  Handshake,
  LifeBuoy,
  Megaphone,
  X,
} from "lucide-react";
import Link from "next/link";
import { DisaAktarmaBagi } from "@/components/DisaAktarmaBagi";
import { RolEtiketi, RolsuzEtiketi } from "@/components/RolEtiketi";
import {
  BilgiKutusu,
  Kart,
  KartBasligi,
  KartIzgarasi,
  PosterKart,
  Rozet,
  SayfaBasligi,
  SINIF_GIRDI,
  SINIF_IKINCIL_BUTON,
} from "@/components/ui";
import { KisayolKarti } from "@/components/YonetimKartlari";
import { oturumKullanicisiZorunlu } from "@/lib/auth/oturum";
import { prisma } from "@/lib/db";
import {
  PANO_ILANI_DURUM_ETIKETLERI,
  PANO_KATEGORILERI,
  PANODA_GORUNEN_ONAY_DURUMLARI,
  TALEP_TURU_BELIRTILMEMIS,
  TALEP_TURU_ETIKETLERI,
  SUZGEC_TURLERI,
  talepTuruGecerliMi,
} from "@/lib/iletisim/kurallar";
import type { RolKodu, TalepTuru } from "@/generated/prisma/enums";
import { tarihYaz } from "@/lib/tarih";
import {
  gencTekGoreviYonetebilirMi,
  mentorlukOnaylayabilirMi,
  mentorlukBasvurabilirMi,
  panodaIlanAcabilirMi,
  panoIlaniOnaylayabilirMi,
  panoIlaniOnayGerekiyorMu,
} from "@/lib/yetki/izinler";
import { IlanDuzenlemeFormu } from "./formlar";
import { talepKapatEylemi } from "./eylemler";

export const dynamic = "force-dynamic";

/**
 * Pano (eski adıyla Talep Panosu) — analiz isteği Bölüm 6, Aşama 1.
 *
 * İLAN PANOSUDUR, mesajlaşma değil: kullanıcı "şu konuda desteğe ihtiyacım
 * var" diye talep açar, panoyu gören herkes okur. Kişiden kişiye temas
 * içermediği için modülün en düşük riskli parçası ve tek başına işe yarıyor.
 *
 * ============================================================================
 * KARTLAR ÜSTTE, İLANLAR ALTTA (14 Ağustos 2026)
 * ============================================================================
 * İstek: "panoda kart olsun, kartlarda destek/duyuru talebi, mentör talebi bide
 * mentör olmak için başvur, en üstte kart olsun o sayfaya gitsin, yani panoda
 * sadece kartlar altında da duyurular olsun".
 *
 * Ekran üç formu birden taşıyordu (destek, mentör talebi, mentörlük başvurusu)
 * ve panoya BAKMAYA gelen kullanıcı — çoğunluk bu — hepsini geçmek zorundaydı.
 * Formlar kendi sayfalarına taşındı; panoda yerlerine birer kart var. Pano
 * yeniden tek işi yapıyor: ilanları göstermek.
 *
 * Pano KAPSAM FİLTRESİZ: ilanlar ülke genelinde görünür. Amaç zaten farklı
 * illerden öğrencilerin birbirini bulması; il sınırı konsaydı pano kendi
 * amacını baltalardı. Görünen tek kişisel veri ad, okul ve il — iletişim
 * bilgisi bağlantı onaylanmadan paylaşılmaz.
 *
 * ÖĞRENCİ İLANLARI ONAYDAN GEÇER (aynı gün · istek: "panodaki öğrenci ilanları
 * şimdilik proje yöneticilerine düşsün oradan onay versin"): onay bekleyen ilan
 * listede YOK, yalnızca sahibinin "Açık ilanlarım" bölümünde durumuyla görünür.
 */

/**
 * Talebi açanın rol kodları — aynı rolden birden fazla kayıt varsa (ör. iki
 * okulda danışmanlık) rozet iki kez basılmasın diye tekilleştirilir.
 */
function acanRolleri(roller: { rolKodu: RolKodu }[]): RolKodu[] {
  return [...new Set(roller.map((rol) => rol.rolKodu))];
}

const DURUM_MESAJLARI: Record<string, string> = {
  acildi: "Talebiniz panoya eklendi.",
  /*
   * ÖĞRENCİYE AYRI İLETİ (14 Ağustos 2026): "panoya eklendi" demek yanlış
   * olurdu — ilan onaylanana kadar panoda görünmüyor. Kişi ilanını listede
   * arayıp bulamayınca sistemin yuttuğunu düşünürdü.
   */
  "onaya-gonderildi":
    "İlanınız proje yöneticisinin onayına gönderildi. Onaylandığında panoda yayımlanır ve size bildirim gelir.",
  duzenlendi: "İlan güncellendi.",
  "duzenlendi-onaya":
    "İlanınız güncellendi ve yeniden proje yöneticisinin onayına düştü; karar verilene kadar panoda görünmez.",
  kapatildi: "İlanınız kapatıldı; listede görünmüyor.",
};

export default async function TaleplerSayfasi({
  searchParams,
}: {
  searchParams: Promise<{
    durum?: string;
    hata?: string;
    grup?: string;
    ara?: string;
    tur?: string;
  }>;
}) {
  const kullanici = await oturumKullanicisiZorunlu();
  const { durum, hata, grup, ara, tur } = await searchParams;

  /*
   * İKİ AYRI YETKİ, İKİ AYRI SORU:
   * - `acabilir`: ilan açma kartları basılsın mı (proje yöneticisi dâhil
   *   herkes · 14 Ağustos 2026).
   * - `onaylayabilir`: onay kuyruğu kartı.
   *
   * "Bağlantı kurabilir mi" sorusu 21 Ağustos 2026'da düştü: bağlantı isteği
   * akışı tümüyle kalktı (istek: "bağlantılarımdan normal mesaj göndermeyi
   * tamamen kaldır").
   */
  const acabilir = panodaIlanAcabilirMi(kullanici);
  const mentorBasvurabilir = mentorlukBasvurabilirMi(kullanici);
  const onayaDuser = panoIlaniOnayGerekiyorMu(kullanici);
  const onaylayabilir = panoIlaniOnaylayabilirMi(kullanici);
  const simdi = new Date();

  const grupId = Number.parseInt(grup ?? "", 10);
  const aramaMetni = (ara ?? "").trim();

  /*
   * Kategori süzgeci. "belirtilmemis" ayrı bir seçenek: türü olmayan ESKİ
   * ilanlar (alan 6 Ağustos 2026'da eklendi) hiçbir tür filtresine düşmezdi ve
   * pano filtrelenince sessizce kaybolurlardı.
   */
  const seciliTur = talepTuruGecerliMi(tur ?? "") ? (tur as TalepTuru) : null;
  const tursuzIstendi = tur === "belirtilmemis";

  const [
    gruplar,
    talepler,
    kendiTalepleri,
    bekleyenIlanSayisi,
    bekleyenGorevSayisi,
  ] = await Promise.all([
    prisma.calismaGrubu.findMany({
      where: { aktif: true },
      orderBy: { siraNo: "asc" },
      select: { id: true, ad: true },
    }),
    prisma.talep.findMany({
      where: {
        AND: [
          {
            kapatildiMi: false,
            sonGecerlilik: { gte: simdi },
            /*
              ONAY BEKLEYEN İLAN PANODA YOK (14 Ağustos 2026). Reddedilen de
              yok. Görünen iki durum tek listeden geliyor (bkz.
              PANODA_GORUNEN_ONAY_DURUMLARI) — filtre üç ekranda tekrarlanıyor
              ve elle yazılsaydı biri güncellenip diğeri unutulurdu.
            */
            onayDurumu: { in: PANODA_GORUNEN_ONAY_DURUMLARI },
          },
          Number.isFinite(grupId) ? { calismaGrubuId: grupId } : {},
          seciliTur ? { tur: seciliTur } : tursuzIstendi ? { tur: null } : {},
          aramaMetni
            ? {
                OR: [
                  { baslik: { contains: aramaMetni, mode: "insensitive" } },
                  { icerik: { contains: aramaMetni, mode: "insensitive" } },
                ],
              }
            : {},
        ],
      },
      orderBy: { olusturmaTarihi: "desc" },
      take: 60,
      select: {
        id: true,
        tur: true,
        baslik: true,
        icerik: true,
        sonGecerlilik: true,
        olusturmaTarihi: true,
        calismaGrubu: { select: { ad: true } },
        acan: {
          select: {
            id: true,
            ad: true,
            soyad: true,
            sinif: true,
            brans: true,
            kurum: { select: { ad: true } },
            il: { select: { ad: true } },
            /*
              TALEBİ KİM AÇTI (10 Ağustos 2026 · istek: "talebi öğretmen mi
              öğrenci mi açmış görünsün"). Sınıf/branş alanı dolaylı bir
              ipucuydu ve ikisi de boşsa hiçbir şey söylemiyordu; rol açıkça
              yazılıyor. Yalnızca SÜREN roller — görevi bitmiş bir öğretmeni
              hâlâ danışman diye göstermek yanlış olurdu.
            */
            roller: {
              where: { bitisTarihi: null },
              select: { rolKodu: true },
            },
          },
        },
        /*
         * MENTÖR CEVAPLARI İLANIN ALTINDA (13 Ağustos 2026 · mentör sayfası).
         * Cevap mentör ekranından yazılıyor ama okunacağı yer burası: ilan
         * sahibi bildirimle panoya geliyor ve cevabı ilanının altında buluyor.
         * Gizlenmiş cevap basılmaz.
         */
        cevaplar: {
          where: { gizlendiMi: false },
          orderBy: { olusturmaTarihi: "asc" },
          select: {
            id: true,
            icerik: true,
            olusturmaTarihi: true,
            yazanKullaniciId: true,
            yazan: { select: { ad: true, soyad: true } },
          },
        },
      },
    }),
    /*
     * KENDİ İLANLARI, ONAY DURUMUYLA (14 Ağustos 2026). Onay bekleyen ve
     * REDDEDİLEN ilanlar da bu listede: panodan düşen ilanın sahibine hiçbir iz
     * bırakmamak, "ilanım silinmiş" izlenimi verirdi. Ret gerekçesi de satırda
     * yazıyor — bildirim okunmamış olabilir ve gerekçe, öğrencinin yeni ilanı
     * nasıl yazacağını belirleyen tek bilgi.
     */
    prisma.talep.findMany({
      where: { acanKullaniciId: kullanici.id, kapatildiMi: false },
      orderBy: { olusturmaTarihi: "desc" },
      select: {
        id: true,
        tur: true,
        baslik: true,
        icerik: true,
        sonGecerlilik: true,
        onayDurumu: true,
        retGerekcesi: true,
      },
    }),
    /* Kuyruk sayısı yalnızca karar verecek kişi için sorgulanıyor. */
    onaylayabilir
      ? prisma.talep.count({
          where: { onayDurumu: "BEKLIYOR", kapatildiMi: false },
        })
      : 0,
    /*
     * GÖREV BAŞVURULARI DA AYNI KUYRUKTA (26 Ağustos 2026): kart artık
     * "Onay kuyruğu" ve açtığı ekran ikisini birden gösteriyor. Yalnızca
     * ilan sayılsaydı, bekleyen görev başvurusu varken kart sessiz kalırdı.
     */
    gencTekGoreviYonetebilirMi(kullanici)
      ? prisma.gencTekGorevBasvurusu.count({ where: { onayDurumu: "BEKLIYOR" } })
      : 0,
    /* Ürün sayımı 27 Ağustos 2026'da kalktı: kuyruk GençTek Vitrin ekranına
       taşındı ve orada kendi başlığında sayılıyor. */
  ]);

  /*
   * İLAN KARTININ SAYISI (27 Ağustos 2026). Görev başvuruları kendi kartına,
   * ürünler ise GençTek Vitrin ekranına taşındı — üçü de kendi kapısında
   * sayılıyor ve hiçbiri iki kez sayılmıyor.
   */
  const bekleyenSayisi = bekleyenIlanSayisi;

  /* Mentörlük kuyruğu bu ekrana 27 Ağustos 2026'da taşındı (Yönetim
     Paneli'ndeki kartın yerine). */
  const bekleyenMentorluk = mentorlukOnaylayabilirMi(kullanici)
    ? await prisma.mentorluk.count({ where: { durum: "BEKLIYOR" } })
    : 0;
  const bekleyenGorevBasvurusu = bekleyenGorevSayisi;

  const filtreVar =
    Boolean(aramaMetni) || Number.isFinite(grupId) || Boolean(tur);

  return (
    <div className="space-y-6">
      {/*
        AÇIKLAMA SATIRI KALKTI (21 Ağustos 2026 · istek). Kimin göreceği
        kuralı değişmedi — pano yalnızca giriş yapmış kullanıcıya açık; kalkan,
        her açılışta başlığın altında duran metin.
      */}
      <SayfaBasligi
        baslik="Pano"
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
          <>
            <Rozet cesit="vurgu">{talepler.length} ilan</Rozet>
            {filtreVar && <Rozet>filtreli</Rozet>}
          </>
        }
      />

      {/*
        Dosya panoyu MODERE EDENE (merkez) veriliyor, panoyu gören herkese
        değil: ekranda süzülerek akan ilanlar dosyada ilan sahiplerinin
        ad-okul-il bilgisini toplu hâle getiriyor. Gerekçenin tamamı rotanın
        başında.
      */}
      {panoIlaniOnaylayabilirMi(kullanici) && (
        <p>
          <DisaAktarmaBagi
            yol="/panel/talepler/disa-aktar"
            etiket="Tüm ilanları Excel indir"
          />
        </p>
      )}

      {durum && DURUM_MESAJLARI[durum] && (
        <BilgiKutusu cesit="olumlu">{DURUM_MESAJLARI[durum]}</BilgiKutusu>
      )}
      {hata && <BilgiKutusu cesit="hata">{hata}</BilgiKutusu>}

      {/*
        KARTLAR EN ÜSTTE (14 Ağustos 2026 · istek: "en üstte kart olsun o
        sayfaya gitsin"). Her kart bir sayfaya gidiyor; formların hiçbiri artık
        panonun içinde değil.
      */}
      <div className="grid gap-3 sm:grid-cols-2">
        {acabilir && (
          <>
            <KisayolKarti
              baslik="Destek / duyuru talebi aç"
              Ikon={LifeBuoy}
              yol="/panel/talepler/yeni"
              ton="olumlu"
            />
            <KisayolKarti
              baslik="Mentör talebi aç"
              Ikon={GraduationCap}
              yol="/panel/talepler/mentor-talebi"
              ton="olumlu"
            />
          </>
        )}
        {/*
          GENÇTEK GÖREVLERİ KARTI SOL MENÜYE TAŞINDI (24 Ekim 2026 · istek:
          "panodaki gençtek görevlerim var o soldaki menüye taşınacaktı").
          Başvuru ekranı aynı adreste; kapısı artık menüdeki "GençTek
          görevlerim" satırı (bkz. panel/layout.tsx).
        */}
        {mentorBasvurabilir && (
          <KisayolKarti
            baslik="Mentör olmak için başvur"
            Ikon={Handshake}
            yol="/panel/talepler/mentor-basvuru"
            ton="olumlu"
          />
        )}
        {/*
          ONAY KUYRUKLARI ÜÇ AYRI KART (27 Ağustos 2026 · istek: "panodaki onay
          kuyruğu kartını çoklayalım · birinde mentör onayları · gençtek görevi
          onayları").

          TEK KART ÜÇ FARKLI İŞİ SAYIYORDU: pano ilanları, görev başvuruları ve
          market ürünleri. Rozetteki sayı toplamdı, yani "7 iş bekliyor" diyen
          bir kart tıklanana kadar hangi işin beklediğini söylemiyordu. Üç kart
          üç soruya ayrı ayrı cevap veriyor ve her biri kendi ekranına gidiyor.

          MENTÖR VE GÖREV KARTLARI YÖNETİM PANELİ'NDEN TAŞINDI (aynı istek:
          "mentör onayları zaten yönetim panelinde var, buraya taşınacak o
          kart"). Orada kalmalarının gerekçesi "merkezin onay işleri tek panoda
          toplansın" idi; o pano artık burası — ikisi de bir BAŞVURUNUN
          karara bağlanması ve panonun kimliği zaten bu.

          KART SIFIRDA DA BASILIYOR, yalnızca rozeti düşüyor: kaybolan kart,
          kuyruğun var olduğunu unutturur.
        */}
        {mentorlukOnaylayabilirMi(kullanici) && (
          <KisayolKarti
            baslik="Mentör onayları"
            aciklama={
              bekleyenMentorluk > 0
                ? `${bekleyenMentorluk} başvuru kararınızı bekliyor`
                : undefined
            }
            Ikon={Compass}
            yol="/panel/mentorluk"
            ton="uyari"
          />
        )}
        {gencTekGoreviYonetebilirMi(kullanici) && (
          <KisayolKarti
            baslik="GençTek görevi onayları"
            aciklama={
              bekleyenGorevBasvurusu > 0
                ? `${bekleyenGorevBasvurusu} başvuru kararınızı bekliyor`
                : undefined
            }
            Ikon={BadgeCheck}
            yol="/panel/genctek-gorevleri"
            ton="uyari"
          />
        )}
        {onaylayabilir && (
          <KisayolKarti
            baslik="İlan onayları"
            /*
              Açıklama yerine yalnızca SAYI kalıyor (21 Ağustos 2026 · istek:
              panodaki açıklamalar kalksın): "kaç ilan kararımı bekliyor"
              tanım değil, karar verdiren bilgidir. Sıfırken satır hiç
              basılmıyor.

              SAYI ARTIK GÖREV BAŞVURULARINI İÇERMİYOR: onlar kendi kartında
              sayılıyor ve iki kartın aynı işi iki kez sayması, toplamı
              anlamsız kılardı. Kartın açtığı ekran ikisini birden gösteriyor —
              orada bir daralma yok, yalnızca rozet kendi işini sayıyor.
            */
            aciklama={
              bekleyenSayisi > 0
                ? `${bekleyenSayisi} iş kararınızı bekliyor`
                : undefined
            }
            Ikon={ClipboardCheck}
            yol="/panel/talepler/onaylar"
            ton="uyari"
          />
        )}
      </div>

      <form method="get" className="rounded-kart border border-cizgi bg-kart p-5 shadow-kart">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-baslik">
            <Filter size={16} className="text-vurgu-metin" aria-hidden />
            Ara
          </h2>
          {filtreVar && (
            <Link
              href="/panel/talepler"
              className="inline-flex items-center gap-1 text-sm font-medium text-vurgu-metin"
            >
              <X size={14} aria-hidden />
              Temizle
            </Link>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="text-sm font-medium text-metin-yumusak">
              Kategori
            </span>
            <select
              name="tur"
              defaultValue={seciliTur ?? (tursuzIstendi ? "belirtilmemis" : "")}
              className={SINIF_GIRDI}
            >
              <option value="">Tümü</option>
              {/*
                SÜZGEÇ LİSTESİ AYRI (11 Ağustos 2026 · "sponsoru kaldıralım").
                TALEP_TURLERI enum'un tamamıdır ve doğrulama ile rozet
                etiketlerini de besler; sponsor oradan silinseydi açılmış
                sponsor ilanları geçersiz tür sayılırdı.

                14 Ağustos 2026'da liste istekteki dörtlüye oturdu: teknik
                destek talebi, duyuru / tanıtım desteği, ekip arkadaşı arama,
                genel. Talep formundaki kategori listesiyle aynı.
              */}
              {SUZGEC_TURLERI.map((deger) => (
                <option key={deger} value={deger}>
                  {TALEP_TURU_ETIKETLERI[deger]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-metin-yumusak">
              İlan metninde ara
            </span>
            <input
              type="search"
              name="ara"
              defaultValue={aramaMetni}
              placeholder="görüntü işleme, mobil uygulama…"
              className={SINIF_GIRDI}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-metin-yumusak">
              Çalışma alanı
            </span>
            <select
              name="grup"
              defaultValue={Number.isFinite(grupId) ? String(grupId) : ""}
              className={SINIF_GIRDI}
            >
              <option value="">Tümü</option>
              {gruplar.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.ad}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button type="submit" className={`${SINIF_IKINCIL_BUTON} mt-3`}>
          Ara
        </button>
      </form>

      {/*
        KART DÜZENİ (21 Ağustos 2026 · istek: "panodaki ilanlar kart düzeni
        gibi özet olacak, aynı etkinlikler gibi").

        İlanlar önce alt alta, TAM METİNLERİYLE basılıyordu: altmış ilanlık bir
        panoda ekranın tamamı tek bir kaydırma sütunuydu ve hangi ilanın nerede
        bittiği okunmuyordu. Şimdi etkinliklerle aynı bileşen (PosterKart) ve
        aynı ızgara kullanılıyor — kart özeti taşıyor, metnin tamamı ve
        bağlantı isteği kutusu ilanın kendi sayfasında (talepler/[id]).

        İçerikten ilk satırlar özet olarak basılıyor: başlık tek başına "ne
        aradığını" söylemeyebiliyor ve kartın işi, açmaya değer olup olmadığını
        söylemek.
      */}
      <section id="ilanlar" className="scroll-mt-6 space-y-4">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-baslik">
            <Megaphone size={18} className="text-vurgu-metin" aria-hidden />
            Panodaki ilanlar
          </h2>
          <p className="text-sm text-metin-yumusak">
            {talepler.length} ilan{filtreVar ? " (filtreli)" : ""}
          </p>
        </div>

        {talepler.length === 0 ? (
          <Kart className="text-metin-yumusak">
            {filtreVar
              ? "Aramanıza uyan ilan yok."
              : "Panoda henüz ilan yok. İlkini siz açabilirsiniz."}
          </Kart>
        ) : (
          <KartIzgarasi>
            {talepler.map((talep) => {
              const roller = acanRolleri(talep.acan.roller);
              return (
                <li key={talep.id} id={`talep-${talep.id}`} className="scroll-mt-24">
                  <PosterKart
                    baslik={talep.baslik}
                    yol={`/panel/talepler/${talep.id}`}
                    ton={talep.acan.id === kullanici.id ? "vurgu" : "notr"}
                    vurguluCerceve={talep.acan.id === kullanici.id}
                    Ikon={Megaphone}
                    kalanGun={
                      <>
                        <CalendarClock size={11} aria-hidden />
                        {tarihYaz(talep.sonGecerlilik)}
                      </>
                    }
                    ustSerit={
                      <span className="flex items-center gap-1.5">
                        {roller.length > 0 ? (
                          roller.map((rolKodu) => (
                            <RolEtiketi key={rolKodu} rolKodu={rolKodu} />
                          ))
                        ) : (
                          <RolsuzEtiketi />
                        )}
                        <span className="truncate">
                          {talep.acan.ad} {talep.acan.soyad}
                        </span>
                      </span>
                    }
                    rozetler={
                      <>
                        {/*
                          Kategori rozeti önce basılıyor: ilanın NE ARADIĞI,
                          hangi çalışma alanına ait olduğundan önce okunmalı.
                          Türü olmayan eski ilanlar da açıkça etiketleniyor —
                          rozetsiz bırakmak onları "duyuru" sanılabilir hâle
                          getirirdi.
                        */}
                        <Rozet cesit="vurgu">
                          {talep.tur
                            ? TALEP_TURU_ETIKETLERI[talep.tur]
                            : TALEP_TURU_BELIRTILMEMIS}
                        </Rozet>
                        {talep.calismaGrubu && (
                          <Rozet>{talep.calismaGrubu.ad}</Rozet>
                        )}
                        {talep.cevaplar.length > 0 && (
                          <Rozet cesit="olumlu">
                            {talep.cevaplar.length} mentör cevabı
                          </Rozet>
                        )}
                      </>
                    }
                    altBilgi={
                      <span className="line-clamp-3 whitespace-pre-line">
                        {talep.icerik}
                      </span>
                    }
                    eylem={
                      <Link
                        href={`/panel/talepler/${talep.id}`}
                        className={SINIF_IKINCIL_BUTON}
                      >
                        İncele
                      </Link>
                    }
                  />
                </li>
              );
            })}
          </KartIzgarasi>
        )}
      </section>

      {kendiTalepleri.length > 0 && (
        <Kart>
          {/* Açıklama satırı kalktı (21 Ağustos 2026 · istek): düzenleme ve
              kapatma düğmeleri satırların içinde zaten duruyor. */}
          <KartBasligi baslik="Açık ilanlarım" />
          <ul className="divide-y divide-cizgi">
            {kendiTalepleri.map((talep) => {
              /*
                ONAY ROZETİ (14 Ağustos 2026). `ONAY_GEREKMEZ` etiketsizdir:
                onaydan hiç geçmeyen ilan yayımdadır ve ona rozet basmak,
                olmayan bir süreci varmış gibi gösterirdi.
              */
              const durumEtiketi =
                PANO_ILANI_DURUM_ETIKETLERI[talep.onayDurumu];
              return (
                <li key={talep.id} className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-metin">
                      {talep.baslik}
                      {durumEtiketi && (
                        <span className="ml-2 inline-block align-middle">
                          {/*
                            18 Ağustos 2026: elle yazılmış hap, ortak `Rozet`e
                            çevrildi. Bekleyen ilan artık UYARI rengine düşüyor,
                            eskiden reddedilen dışındaki her durumla aynı
                            kırmızı vurguyu paylaşıyordu — "onay bekliyor" ile
                            "onaya gerek yok" tek renkte görünüyordu.
                          */}
                          <Rozet
                            cesit={
                              talep.onayDurumu === "REDDEDILDI"
                                ? "hata"
                                : talep.onayDurumu === "BEKLIYOR"
                                  ? "uyari"
                                  : "vurgu"
                            }
                          >
                            {durumEtiketi}
                          </Rozet>
                        </span>
                      )}
                      <span className="ml-2 text-sm text-metin-yumusak">
                        {tarihYaz(talep.sonGecerlilik)} tarihine kadar
                      </span>
                      {talep.onayDurumu === "BEKLIYOR" && (
                        <span className="mt-0.5 block text-sm text-metin-yumusak">
                          Proje yöneticisi onaylayana kadar panoda görünmez.
                        </span>
                      )}
                      {talep.onayDurumu === "REDDEDILDI" && (
                        <span className="mt-0.5 block text-sm text-metin-yumusak">
                          Gerekçe: {talep.retGerekcesi ?? "—"}
                        </span>
                      )}
                    </span>
                    <form action={talepKapatEylemi}>
                      <input type="hidden" name="talepId" value={talep.id} />
                      <button type="submit" className={SINIF_IKINCIL_BUTON}>
                        Kapat
                      </button>
                    </form>
                  </div>
                  <IlanDuzenlemeFormu
                    talep={talep}
                    kategoriler={PANO_KATEGORILERI}
                    donus="pano"
                    onayUyarisi={onayaDuser}
                  />
                </li>
              );
            })}
          </ul>
        </Kart>
      )}
    </div>
  );
}
