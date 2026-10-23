import { ArrowLeft, Check, Download, FileText, Pencil } from "lucide-react";
import Link from "next/link";

/**
 * Ekranların paylaştığı arayüz parçaları. Renkler burada da anlam adıyla
 * yazılır (bkz. globals.css), böylece iki tema tek kaynaktan beslenir.
 *
 * 18 AĞUSTOS 2026 · TASARIM YENİLEMESİ. Bu dosya sistemin görsel dilinin
 * merkezi: 57 sayfa `Kart`ı, 100'ü aşkın yer buton sınıflarını buradan alıyor.
 * Yenileme de bu yüzden buradan yürüdü — sayfaları tek tek elden geçirmek 32
 * bin satır TSX demekti, oysa kartın çerçevesini ve gölgesini burada
 * değiştirmek hepsini birden kaldırıyor.
 *
 * Dışa verilen eski adların HİÇBİRİ değişmedi; yalnızca çıktıları yenilendi.
 * Yeni eklenenler: Rozet, OlcuKarti, Vitrin, RozetSeridi ve (aynı gün, ikinci
 * turda) prototipin karşılığı bulunmayan parçaları: ZamanCizelgesi,
 * AnahtarDegerListesi, BelgeListesi, AdimGostergesi, IlerlemeCubugu,
 * PosterKart.
 */

/*
 * DÜĞMELER.
 *
 * Birincil düğme gölgeli: kırmızı zeminli bir düğme düz basıldığında sayfadaki
 * bir etiketten ayırt edilemiyordu. Gölge onu yüzeyin üstüne kaldırıyor.
 *
 * İkincil düğmenin çerçevesi `cizgi-guclu` — dekoratif `cizgi` DEĞİL.
 * Kullanıcının tıklayacağı bir sınırın zeminine karşı en az 3:1 olması gerekir
 * (WCAG 1.4.11); kartın kenarı için bu şart yoktur (bkz. globals.css).
 */
export const SINIF_BIRINCIL_BUTON =
  "inline-flex items-center gap-2 rounded-kutu bg-birincil px-4 py-2.5 text-sm font-semibold text-birincil-metin shadow-kart transition hover:bg-birincil-koyu focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vurgu disabled:opacity-50 disabled:shadow-none";

export const SINIF_IKINCIL_BUTON =
  "inline-flex items-center gap-2 rounded-kutu border border-cizgi-guclu bg-kart px-4 py-2.5 text-sm font-medium text-metin transition hover:border-vurgu hover:bg-zemin focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vurgu disabled:opacity-50";

/*
 * VİTRİN ÜSTÜNDEKİ DÜĞME. Vitrin koyu nötr bir yüzey; oraya beyaz zeminli
 * ikincil düğme konsa yüzeyi delerdi. Vitrinin kendi ailesinden ayrı bir çift
 * gerekiyor: birincisi tam kırmızı (koyu zeminde marka rengi ancak burada
 * görünüyor), ikincisi saydam beyaz.
 */
export const SINIF_VITRIN_BUTON =
  "inline-flex items-center gap-2 rounded-kutu bg-vitrin-secili-zemin px-5 py-2.5 text-sm font-semibold text-vitrin-secili-metin shadow-kart transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vitrin-metin";

export const SINIF_VITRIN_IKINCIL_BUTON =
  "inline-flex items-center gap-2 rounded-kutu border border-vitrin-cizgi bg-white/10 px-5 py-2.5 text-sm font-semibold text-vitrin-metin transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vitrin-metin";

/*
 * GİRDİ. Çerçeve yine `cizgi-guclu`: form denetiminin sınırı işlevseldir.
 * Odakta çerçeve rengi değişmekle kalmıyor, halka da basılıyor — yalnızca renk
 * değişimi renk körü kullanıcıda odağın nerede olduğunu göstermiyor.
 */
export const SINIF_GIRDI =
  "mt-1 w-full rounded-kutu border border-cizgi-guclu bg-kart px-3.5 py-2.5 text-metin outline-none transition focus:border-vurgu focus:ring-2 focus:ring-vurgu/25";

export function Kart({
  children,
  className = "",
  id,
}: {
  children: React.ReactNode;
  className?: string;
  /** Adres çapası; bir bağlantı doğrudan bu karta inebilsin diye. */
  id?: string;
}) {
  return (
    <section
      id={id}
      className={`rounded-kart border border-cizgi bg-kart p-6 shadow-kart ${className}`}
    >
      {children}
    </section>
  );
}

export function KartBasligi({
  baslik,
  aciklama,
  Ikon,
}: {
  baslik: string;
  aciklama?: string;
  Ikon?: React.ComponentType<{ size?: number; className?: string }>;
}) {
  return (
    <div className="mb-5">
      <h2 className="flex items-center gap-2.5 text-lg font-bold text-baslik">
        {/*
          İkon artık kutu içinde: yalın ikon başlığın yanında iliştirilmiş
          duruyordu, açık kırmızı zeminli kare onu başlığın bir parçası yapıyor.
        */}
        {Ikon && (
          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-kutu bg-vurgu-zemin text-vurgu-metin">
            <Ikon size={17} />
          </span>
        )}
        {baslik}
      </h2>
      {aciklama && (
        <p className="mt-1.5 text-sm text-metin-yumusak">{aciklama}</p>
      )}
    </div>
  );
}

/**
 * Sayfanın en üstündeki başlık bloğu.
 *
 * `rozet` ve `eylem` SONRADAN eklendi ve ikisi de isteğe bağlı: çağıran 57
 * sayfanın hiçbiri değişmeden çalışmaya devam ediyor. Eylem sağa yaslanıyor
 * çünkü sayfanın birincil işi (yeni kayıt, dışa aktarma) başlıkla aynı hizada
 * aranıyor.
 */
export function SayfaBasligi({
  baslik,
  aciklama,
  rozet,
  eylem,
  geri = { yol: "/panel", etiket: "Profil" },
}: {
  baslik: string;
  aciklama?: string;
  rozet?: React.ReactNode;
  eylem?: React.ReactNode;
  /**
   * Başlığın üstündeki geri bağlantısı. Varsayılan Panel'dir; kendi geri
   * bağlantısı olan ekranlar `null` geçer (bkz. aşağıdaki not).
   *
   * YÖNETİM PANELİNDEN AÇILAN EKRANLAR "/panel/yonetim" GEÇER (21 Ağustos
   * 2026 · istekler: "yönetim panelinin navigasyonunda hep panele link var
   * Panel şeklinde, o panel zaten soldaki menüde var" · "yönetim panelindeki
   * tüm kartların yönetim paneli yolunu gösteren navigasyonu olsun").
   *
   * Varsayılan "Panel", kişiyi GELDİĞİ yere değil bir üst basamağa
   * atıyordu; üstelik Panel sol menüde zaten duruyor, yani bağlantı hiçbir
   * yeni yol açmıyordu. Geri bağlantısının işi, kartın açtığı ekrandan
   * kartların durduğu ekrana dönmektir.
   */
  geri?: { yol: string; etiket: string } | null;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {/*
          GERİ BAĞLANTISI HER SAYFA BAŞLIĞINDA (20 Ağustos 2026 · istek:
          "paneldeki kartlara inince panelden uzaklaşıyor, üste navigasyon
          linki gelsin … tarayıcıdaki geri butonuna basması gerek").

          Paneldeki kartların yarısı menüde KARŞILIĞI OLMAYAN ekranlara
          gidiyor: danışman seçimi, çalışma grupları, öz değerlendirme,
          kazanımlar, bildirimler, raporlar. Kenar çubuğu duruyor ama o
          ekranlardan hiçbirini işaretlemiyor; kullanıcı kartla girdiği yerden
          çıkmak için tarayıcının geri düğmesine kalıyordu.

          VARSAYILAN DEĞER BİLEŞENDE, ÇAĞIRANDA DEĞİL: kırk dokuz ekran var ve
          bağlantıyı tek tek eklemek, unutulan ekranlar bırakırdı. Kendi geri
          bağlantısı olan ayrıntı sayfaları (öğrenci kaydı, ekip, pano formları)
          `geri={null}` geçiyor — onların doğru üst adresi Panel değil, geldikleri
          liste.
        */}
        {geri && (
          <Link
            href={geri.yol}
            className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-vurgu-metin transition hover:underline"
          >
            <ArrowLeft size={15} aria-hidden />
            {geri.etiket}
          </Link>
        )}
        {rozet && <div className="mb-2 flex flex-wrap gap-1.5">{rozet}</div>}
        <h1 className="text-[26px] leading-tight font-extrabold text-baslik">
          {baslik}
        </h1>
        {aciklama && (
          <p className="mt-2 max-w-[70ch] text-metin-yumusak">{aciklama}</p>
        )}
      </div>
      {eylem && <div className="flex shrink-0 flex-wrap gap-2">{eylem}</div>}
    </div>
  );
}

/**
 * Kırıntı yolu (breadcrumb).
 *
 * Derin sayfaların başında nerede olunduğunu ve bir üste nasıl dönüleceğini
 * gösterir. Önceden bu iş sayfa başına elle yazılan "← Etkinlikler" gibi tek
 * bir bağlantıyla yapılıyordu; o bağlantı geri dönüşü veriyor ama hiyerarşiyi
 * göstermiyordu — üç basamak aşağıdaki bir ekranda kişinin kaçıncı katta
 * olduğunu söyleyen hiçbir şey yoktu.
 *
 * SON BASAMAK BAĞLANTI DEĞİLDİR: bulunulan sayfanın kendisidir ve kendine
 * giden bir bağlantı, tıklandığında hiçbir şey olmadığı için bozuk sanılır.
 * `aria-current="page"` ekran okuyucuya da bunu söyler.
 */
export function KirintiYolu({
  basamaklar,
}: {
  /** Sırayla en üstten bulunulan sayfaya. Son basamağın `yol`u verilmez. */
  basamaklar: { etiket: string; yol?: string }[];
}) {
  return (
    <nav aria-label="Kırıntı yolu">
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-metin-yumusak">
        {basamaklar.map((basamak, sira) => (
          <li key={basamak.etiket} className="flex items-center gap-1.5">
            {sira > 0 && (
              <span aria-hidden className="opacity-50">
                /
              </span>
            )}
            {basamak.yol ? (
              <Link
                href={basamak.yol}
                className="font-medium text-vurgu-metin hover:underline"
              >
                {basamak.etiket}
              </Link>
            ) : (
              <span aria-current="page">{basamak.etiket}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/**
 * Durum rozeti (chip).
 *
 * Sistemde durum bilgisi bugüne kadar düz metinle yazılıyordu ("Başvuru
 * açık", "Onay bekliyor"); listede on satır arasında hangisinin ne olduğu
 * ancak okunarak anlaşılıyordu. Rozet bunu göz taramasıyla ayırt edilir hale
 * getiriyor.
 *
 * Renkler durum ailelerinden geliyor, yeni renk tanımlanmadı: olumlu / uyarı /
 * hata / vurgu zaten iki temada da kontrast kontrolünden geçmiş çiftler.
 */
export function Rozet({
  cesit = "notr",
  Ikon,
  children,
}: {
  cesit?: "notr" | "olumlu" | "uyari" | "hata" | "vurgu";
  Ikon?: React.ComponentType<{ size?: number; className?: string }>;
  children: React.ReactNode;
}) {
  const sinif = {
    notr: "bg-zemin text-metin-yumusak",
    olumlu: "bg-olumlu-zemin text-olumlu-metin",
    uyari: "bg-uyari-zemin text-uyari-metin",
    hata: "bg-hata-zemin text-hata-metin",
    vurgu: "bg-vurgu-zemin text-vurgu-metin",
  }[cesit];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${sinif}`}
    >
      {Ikon && <Ikon size={12} />}
      {children}
    </span>
  );
}

/** Rozetleri aralıklı ve satır atlayabilir biçimde dizer. */
export function RozetSeridi({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-1.5">{children}</div>;
}

/**
 * Ölçü kutusu (KPI).
 *
 * Panel ve yönetim ekranlarının başında duran sayı kutusu. Sayı büyük ve
 * başlık yazısıyla basılıyor — bir ölçünün işlevi uzaktan okunabilmesidir;
 * gövde puntosunda basılan sayı, yanındaki etiketten ayrışmıyordu.
 *
 * `yon` alt satırın rengini belirler: artış olumlu yeşil, azalış uyarı sarısı,
 * yorumsuz bilgi nötr. Rengi çağıran seçmiyor ki aynı anlam iki ekranda iki
 * farklı renge düşmesin.
 */
export function OlcuKarti({
  etiket,
  deger,
  altBilgi,
  yon = "notr",
  Ikon,
}: {
  etiket: string;
  deger: React.ReactNode;
  altBilgi?: string;
  yon?: "notr" | "olumlu" | "uyari";
  Ikon?: React.ComponentType<{ size?: number; className?: string }>;
}) {
  const altSinif = {
    notr: "text-metin-yumusak",
    olumlu: "text-olumlu-metin",
    uyari: "text-uyari-metin",
  }[yon];

  return (
    <div className="rounded-kart border border-cizgi bg-kart p-5 shadow-kart">
      <div className="flex items-center gap-2 text-sm font-medium text-metin-yumusak">
        {Ikon && <Ikon size={15} className="text-vurgu-metin" />}
        {etiket}
      </div>
      <div className="mt-2 font-baslik text-3xl font-extrabold text-baslik">
        {deger}
      </div>
      {altBilgi && <div className={`mt-1 text-xs ${altSinif}`}>{altBilgi}</div>}
    </div>
  );
}

/**
 * ÖLÇÜM KARTI — panel ve yönetim panosunun sayı kartı.
 *
 * BURAYA 26 AĞUSTOS 2026'DA TAŞINDI (istek: "İlimdeki öğrenciler … Onay
 * bekleyen etkinlik bu iki kartı yönetim paneline alalım"). Panel'in içinde
 * yerel bir bileşendi; kart iki ekranda birden görünmeye başlayınca kopyalamak
 * yerine buraya alındı — kopya, birinin poster bandı değişince ötekinin geride
 * kalması demekti.
 *
 * `OlcuKarti` İLE KARIŞTIRILMAMALI (yukarıda): o, çerçeveli sade bir KPI
 * kutusu ve rapor ekranlarının şeridinde dört yan yana duruyor. Bu ise poster
 * bandıyla açılan, tıklanabilir, tek başına duran bir kart.
 *
 * PANELİN ÖLÇÜM KARTI — ETKİNLİK KARTIYLA AYNI DİL (20 Ağustos 2026 · istek:
 * "kartları, etkinlikler gibi görsel ve güzel görünümlü hale getir").
 *
 * Kart eskiden düz beyaz bir kutuydu: sol üstte etiket, sağ üstte küçük bir
 * ikon kutusu, altında sayı. Etkinlikler ekranındaki kart ise gradyanlı bir
 * POSTER bandıyla açılıyor, ikon o bandın içinde filigran duruyor ve kart
 * imleç üstüne gelince bir tık yükseliyor (bkz. components/ui.tsx ·
 * PosterKart). Aynı sistemin iki ekranı iki ayrı kart dili konuşuyordu.
 *
 * Buradaki kart PosterKart'ı KULLANMIYOR, dilini ödünç alıyor. Sebebi
 * içeriğin farkı: PosterKart bir KAYDI tanıtır — başlık, rozetler, alt bilgi
 * ve düğmeler taşır. Burada tanıtılacak kayıt yok, tek bir SAYI var ve o
 * sayının kartın en iri öğesi olması gerekiyor. PosterKart'a "sayı kipi"
 * eklemek, iki ekranın kartını da bulanıklaştırırdı.
 *
 * TON BİLGİ TAŞIR, süs değil: `uyari` bekleyen bir iş olduğunu, `olumlu`
 * tamamlanmış bir şeyi, `vurgu` kişinin kendi tarihli taahhüdünü söyler.
 * Çağıran vermezse nötr kalır — rastgele renk dağıtmak, rengin anlamını
 * silerdi.
 */
export function OlcumKarti({
  baslik,
  deger,
  aciklama,
  Ikon,
  yol,
  ton = "notr",
  pasifNedeni,
}: {
  baslik: string;
  deger: string;
  aciklama?: string;
  Ikon: React.ComponentType<{ size?: number; className?: string }>;
  /** Verilirse kart, ilgili ekrana giden bir bağlantı olur. */
  yol?: string;
  /** Poster bandının rengi; bilgi taşır (bkz. başlıktaki not). */
  ton?: "vurgu" | "olumlu" | "uyari" | "notr";
  /**
   * PASİF KART (23 Ekim 2026). Verilirse `yol` yok sayılır, kart soluk basılır
   * ve açıklama yerine bu metin yazar.
   */
  pasifNedeni?: string;
}) {
  if (pasifNedeni) {
    yol = undefined;
    aciklama = pasifNedeni;
  }
  const icerik = (
    <>
      {/*
        POSTER BANDI. Etkinlik kartındakinden ALÇAK (h-28 değil h-16): orada
        bandın işi afişi taşımak, burada yalnızca kartı renkle açmak — 112
        piksellik bir bant, üç satırlık bir sayımın üstünde başlı başına bir
        blok olurdu.
      */}
      <div className={`poster poster-${ton} relative grid h-16 place-items-center`}>
        <Ikon size={26} className="text-white/50" />
      </div>

      <div className="flex flex-1 flex-col p-5">
        <p className="text-sm font-medium text-metin-yumusak">{baslik}</p>
        {/*
          Sayı başlık yazısıyla ve büyük basılıyor: bir sayımın işlevi uzaktan
          okunabilmesidir, gövde puntosunda etiketinden ayrışmıyordu.
        */}
        <p className="mt-1 font-baslik text-3xl leading-tight font-extrabold text-baslik">
          {deger}
        </p>
        {aciklama && (
          <p className="mt-1.5 text-sm text-metin-yumusak">{aciklama}</p>
        )}
      </div>
    </>
  );

  /*
   * `overflow-hidden`: poster bandının köşeleri kartın yuvarlatmasını taşmasın.
   * `hover:-translate-y-1` yalnızca bağlantı olan kartta — gidilecek yeri
   * olmayan bir kartın imlece tepki vermesi, tıklanabilir olduğunu söylerdi.
   */
  const sinif =
    "flex h-full flex-col overflow-hidden rounded-kart border border-cizgi bg-kart shadow-kart";

  return yol ? (
    <Link
      href={yol}
      className={`${sinif} transition hover:-translate-y-1 hover:border-vurgu hover:shadow-yuksek focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vurgu`}
    >
      {icerik}
    </Link>
  ) : (
    <div
      aria-disabled={pasifNedeni ? "true" : undefined}
      title={pasifNedeni}
      className={pasifNedeni ? `${sinif} cursor-not-allowed opacity-50` : sinif}
    >
      {icerik}
    </div>
  );
}

/** Ölçü kutularını dörtlü ızgaraya dizer; darda ikiye, telefonda tek sütuna iner. */
export function OlcuSeridi({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
  );
}

/**
 * Vitrin — sayfanın üstündeki koyu gradyan blok.
 *
 * Gradyan, doku ve maske `.vitrin` sınıfında (globals.css); burada yalnızca
 * içerik düzeni var. Sayfanın ağırlık merkezi burası: gövde beyaz kartlardan
 * oluşuyor ve koyu yüzey yalnızca burada kullanılıyor.
 *
 * `tamGenislik` ekranın iki ucuna dayanan bir blok verir (açılış ve panel üstü
 * böyle); kapalıyken içerik kolonuyla hizalı bir kart olur.
 */
export function Vitrin({
  ustBaslik,
  baslik,
  altBaslik,
  aciklama,
  eylem,
  gorsel,
  yan,
  className = "",
}: {
  ustBaslik?: React.ReactNode;
  baslik: React.ReactNode;
  /**
   * Başlığın hemen altına, açıklamadan ÖNCE basılan satırlar (rol, okul).
   *
   * `aciklama`dan ayrı bir alan: açıklama bir cümle ve `<p>` olarak basılıyor,
   * buraya gelen içerik ise kendi içinde birden çok satır taşıyabiliyor —
   * `<p>` içine `<p>` koymak geçersiz HTML olurdu.
   */
  altBaslik?: React.ReactNode;
  aciklama?: React.ReactNode;
  eylem?: React.ReactNode;
  /**
   * Başlık kolonunun SOLUNA basılan görsel (profil fotoğrafı gibi).
   *
   * Sağdaki `yan` kolonundan farkı: `yan` kendi başına duran bir kutu, bu ise
   * başlığın parçası — dar ekranda başlığın üstüne kayar, yan yana durduğunda
   * ise adla aynı hizada kalır.
   */
  gorsel?: React.ReactNode;
  /** Sağ kolona basılacak içerik (özet kutusu, kısayollar). */
  yan?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`vitrin rounded-kart ${className}`}>
      <div
        className={`grid gap-8 px-7 py-9 ${yan ? "lg:grid-cols-[1.15fr_0.85fr] lg:items-center" : ""}`}
      >
        <div className="min-w-0">
          {ustBaslik && (
            <span className="inline-flex items-center gap-2 rounded-full border border-vitrin-cizgi bg-white/10 px-3 py-1 text-[11px] font-bold tracking-widest text-vitrin-metin uppercase">
              {ustBaslik}
            </span>
          )}
          <div
            className={
              gorsel ? "mt-4 flex flex-wrap items-center gap-5" : undefined
            }
          >
            {gorsel && <div className="shrink-0">{gorsel}</div>}
            <div className="min-w-0">
              <h1
                className={`text-3xl leading-tight font-extrabold text-vitrin-metin sm:text-[34px] ${gorsel ? "" : "mt-4"}`}
              >
                {baslik}
              </h1>
              {altBaslik && <div className="mt-2">{altBaslik}</div>}
              {aciklama && (
                <p className="mt-3 max-w-[54ch] text-vitrin-metin-yumusak">
                  {aciklama}
                </p>
              )}
            </div>
          </div>
          {eylem && <div className="mt-6 flex flex-wrap gap-3">{eylem}</div>}
        </div>
        {yan && <div className="min-w-0">{yan}</div>}
      </div>
    </div>
  );
}

/**
 * Katlanabilir kart.
 *
 * Panelim, çalışma grubu ve danışman seçimi içine gömülünce uzun bir forma
 * dönüşme riski taşıyor: öğrencinin ilk gördüğü ekran bu ve asıl işi (başvurusu
 * açık etkinlikler, takvim) formların altında kalmamalı. Bölümler bu yüzden
 * varsayılan olarak KAPALI; `baslangictaAcik` yalnızca kullanıcının bir işlem
 * yapması gerektiğinde (danışmanı yoksa gibi) açık gelir.
 *
 * JavaScript YOK: `<details>` tarayıcının kendi davranışı, sayfanın geri kalanı
 * gibi sunucuda basılıyor.
 */
export function KatlanabilirKart({
  baslik,
  aciklama,
  Ikon,
  baslangictaAcik = false,
  capa,
  duzenlenebilir = false,
  ozet,
  children,
}: {
  baslik: string;
  aciklama?: string;
  Ikon?: React.ComponentType<{ size?: number; className?: string }>;
  baslangictaAcik?: boolean;
  /** Adres çapası; eylemler işlem sonrası bu bölüme geri döner. */
  capa?: string;
  /**
   * Bölüm bir FORM açıyorsa `true` (21 Ağustos 2026 · istek: "paneldeki
   * iletişim bilgileri özgeçmişim vs de bulunan sağdaki aç kapa alanı
   * silinsin, hakkımda alanı gibi kalem işareti kalsın düzenlenebilir
   * anlamında").
   *
   * "Aç / Kapat" rozeti yerine kalem basılır: rozet bölümün ne yaptığını
   * değil, kutunun ne yapacağını söylüyordu. Panelde bu kutuların içi hep
   * düzenleme formu — kalem, açmadan önce bunu söylüyor.
   *
   * Varsayılan `false`: aynı kart okunacak bir liste de taşıyabiliyor
   * (yazışmalardaki istek listeleri gibi) ve orada kalem yanlış söz verirdi.
   *
   * SAYFA BİRLİĞİ ROZETTEN ÖNCE GELİR (26 Ağustos 2026 · istek: "bazılarının
   * sağ tarafta aç kapa yazıyor bazılarında kalem işareti var hepsinde kalem
   * olsun"): bir sayfadaki bölümlerin kimisi rozetli kimisi kalemli olunca
   * işaret farkı, bölümler arasında olmayan bir fark anlatıyor. Böyle bir
   * sayfada okunacak bölüm de `true` alır — bkz. etkinlik detayı.
   */
  duzenlenebilir?: boolean;
  /**
   * Kapalıyken başlığın altında görünen özet (21 Ağustos 2026 · istek:
   * "İletişim bilgilerim, Kayıtlarım, Özgeçmişim (CV) bunların da özetleri
   * görülsün doldurunca mutlaka").
   *
   * Kapalı kutu, içinin dolu mu boş mu olduğunu söylemiyordu: kişi kayıtlı
   * telefonunu görmek için bile bölümü açmak zorundaydı. Özet AÇILINCA
   * gizleniyor — formun kendisi zaten aynı değerleri gösteriyor ve iki kopya
   * yan yana durursa hangisinin güncel olduğu belirsizleşir.
   */
  ozet?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      id={capa}
      className="scroll-mt-6 rounded-kart border border-cizgi bg-kart shadow-kart"
    >
      <details open={baslangictaAcik} className="group">
        <summary className="cursor-pointer list-none px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2.5 text-lg font-bold text-baslik">
              {Ikon && (
                <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-kutu bg-vurgu-zemin text-vurgu-metin">
                  <Ikon size={17} />
                </span>
              )}
              {baslik}
            </h2>
            {/*
              İki işaret, iki iş: düzenleme bölümünde kalem, okunacak bölümde
              "Aç / Kapat" rozeti. Rozetin etiketi açık/kapalı durumuna göre
              değişiyor — "Aç / kapat" her iki durumda aynı yazdığı için
              düğmenin ne yapacağı okunmuyordu.

              Kalem yalnızca KAPALIYKEN görünür (Hakkımda kartındaki gibi):
              form açıkken düzenleme işaretinin durması, tıklanacak ikinci bir
              şey varmış gibi görünürdü.

              Değişim CSS ile — `<details>` açıkken `group-open` sınıfı
              geliyor, JavaScript'e gerek yok.
            */}
            {duzenlenebilir ? (
              <span className="text-metin-yumusak transition group-hover:text-vurgu-metin group-open:hidden">
                <Pencil size={16} aria-hidden />
              </span>
            ) : (
              <span className="rounded-full bg-zemin px-3 py-1 text-xs font-semibold text-vurgu-metin">
                <span className="group-open:hidden">Aç</span>
                <span className="hidden group-open:inline">Kapat</span>
              </span>
            )}
          </div>
          {aciklama && (
            <p className="mt-1.5 text-sm text-metin-yumusak">{aciklama}</p>
          )}
          {ozet && (
            <div className="mt-3 text-sm text-metin group-open:hidden">
              {ozet}
            </div>
          )}
        </summary>
        <div className="border-t border-cizgi px-6 py-5">{children}</div>
      </details>
    </section>
  );
}

export function BilgiKutusu({
  cesit = "bilgi",
  className = "",
  children,
}: {
  cesit?: "bilgi" | "uyari" | "hata" | "olumlu";
  className?: string;
  children: React.ReactNode;
}) {
  /*
   * Sol kenardaki kalın şerit sonradan eklendi: dört çeşit yalnızca zemin
   * tonuyla ayrılıyordu ve açık zeminler birbirine yakın. Şerit, rengi düşük
   * ayrımlı ekranlarda ve renk körlüğünde de görünür kılıyor.
   */
  const sinif = {
    bilgi: "border-cizgi border-l-cizgi-guclu bg-kart text-metin",
    uyari: "border-uyari-cizgi/50 border-l-uyari-cizgi bg-uyari-zemin text-uyari-metin",
    hata: "border-hata-cizgi/50 border-l-hata-cizgi bg-hata-zemin text-hata-metin",
    olumlu:
      "border-olumlu-cizgi/50 border-l-olumlu-cizgi bg-olumlu-zemin text-olumlu-metin",
  }[cesit];

  return (
    <div
      className={`rounded-kutu border border-l-4 px-4 py-3 text-sm ${sinif} ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * POSTERLİ KART — sablon/1.png'deki yarışma kartının karşılığı
 * (18 Ağustos 2026 · istek: "etkinliklerin görünümü kötü, 1.png'deki gibi
 * yapalım").
 *
 * Düzen yukarıdan aşağı: gradyanlı poster bandı → düzenleyen birim şeridi →
 * başlık → rozetler → son başvuru satırı → düğmeler.
 *
 * ÖNCEKİ IZGARA NEYDİ, NEDEN DEĞİŞTİ. Eskiden kart kare bir afiş kutusuydu ve
 * bilgi yalnızca üstüne gelince açılan bir katmanda vardı. Afişi olmayan
 * etkinlikte kutu boş bir zemine düşüyordu ve kartlar birbirinden ayırt
 * edilemiyordu; dokunmatik cihazda katman hiç açılmadığı için başlık dışında
 * hiçbir şey okunmuyordu. Yeni kartta bilgi HER ZAMAN basılı — üstüne gelmek
 * gerekmiyor.
 *
 * AFİŞ KIRPILMIYOR (10 Ağustos 2026 kararı korundu): kapak varsa poster
 * bandının içinde `object-contain` durur, `object-cover` değil. Bandın artan
 * yeri gradyanla dolar. Afiş yoksa gradyanın ortasına yarı saydam bir filigran
 * ikon basılır — 1.png'deki davranışın aynısı.
 *
 * Poster üstüne ÇIPLAK METİN BASILMAZ; oraya konan her şey (durum rozeti,
 * kalan gün balonu) kendi zeminini taşır. Gerekçe globals.css'teki `.poster`
 * notunda: gradyanların amber ucu beyaza karşı gövde eşiğini geçmiyor.
 *
 * TÜM KART TIKLANABİLİR DEĞİL, başlık bağlantıdır ve `after:inset-0` ile
 * tıklama alanı karta yayılır. Böylece karttaki ikinci düğme ("Başvur")
 * yutulmuyor — sarmalayıcı `<a>` kullanılsaydı iç içe bağlantı geçersiz HTML
 * olurdu.
 */
export function PosterKart({
  baslik,
  yol,
  ton = "notr",
  Ikon,
  kapakYolu,
  durum,
  kalanGun,
  ustSerit,
  rozetler,
  altBilgi,
  eylem,
  vurguluCerceve = false,
}: {
  baslik: string;
  yol: string;
  ton?: "vurgu" | "olumlu" | "uyari" | "notr";
  /** Afiş yokken posterin ortasına basılan filigran ikon. */
  Ikon?: React.ComponentType<{ size?: number; className?: string }>;
  /** Kapak görselinin adresi; verilirse filigranın yerine geçer. */
  kapakYolu?: string;
  /** Sol üstteki durum rozeti. */
  durum?: React.ReactNode;
  /** Sağ altta "37 gün kaldı" gibi bir bilgi. */
  kalanGun?: React.ReactNode;
  /** Posterin hemen altındaki ince şerit: düzenleyen birim. */
  ustSerit?: React.ReactNode;
  rozetler?: React.ReactNode;
  altBilgi?: React.ReactNode;
  eylem?: React.ReactNode;
  /** Kendi açtığı kayıt gibi ayrıcalıklı kartlarda çerçeveyi vurgular. */
  vurguluCerceve?: boolean;
}) {
  return (
    <article
      className={`group relative flex h-full flex-col overflow-hidden rounded-kart border bg-kart shadow-kart transition hover:-translate-y-1 hover:shadow-yuksek ${
        vurguluCerceve ? "border-vurgu" : "border-cizgi"
      }`}
    >
      <div
        className={`poster poster-${ton} relative grid h-28 place-items-center`}
      >
        {kapakYolu ? (
          /*
            AFİŞ MUTLAK KONUMLU, akışta değil.

            Önce `h-full w-full` ile basılıyordu ve görsel poster bandını
            taşırıp altındaki birim şeridiyle rozetlerin üstüne biniyordu:
            `place-items-center` ızgara öğesini ortalıyor, ortalanan öğede
            yüzde yükseklik kabın yüksekliğine değil öğenin kendi içeriğine
            çözülüyor ve `h-full` bir sınır koymuyor.

            `absolute inset-0` bandın dört kenarına çiviliyor; görsel artık
            hiçbir koşulda 112 pikseli aşamaz. `object-contain` de afişin
            tamamını gösterir — kırpma yok (10 Ağustos 2026 kararı).
          */
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={kapakYolu}
            alt=""
            className="absolute inset-0 h-full w-full object-contain p-1.5"
          />
        ) : (
          Ikon && <Ikon size={38} className="text-white/50" />
        )}
        {durum && <div className="absolute top-2.5 left-2.5">{durum}</div>}
        {kalanGun && (
          <span className="absolute right-2.5 bottom-2.5 inline-flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-bold text-white">
            {kalanGun}
          </span>
        )}
      </div>

      {ustSerit && (
        <div className="mx-3 mt-3 truncate rounded-kutu border border-cizgi bg-zemin px-2.5 py-1.5 text-xs font-medium text-metin-yumusak">
          {ustSerit}
        </div>
      )}

      <div className="flex flex-1 flex-col gap-2.5 p-3.5">
        <h3 className="leading-snug font-bold text-baslik">
          <Link
            href={yol}
            className="after:absolute after:inset-0 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vurgu"
          >
            {baslik}
          </Link>
        </h3>
        {rozetler && <div className="flex flex-wrap gap-1.5">{rozetler}</div>}
        {altBilgi && (
          <div className="mt-auto pt-0.5 text-xs text-metin-yumusak">
            {altBilgi}
          </div>
        )}
        {/*
          Eylemler kartın tıklama alanının ÜSTÜNDE durmalı (`relative`), yoksa
          başlık bağlantısının yayılan `after` katmanı onları yutar.
        */}
        {eylem && (
          <div className="relative flex flex-wrap gap-2 pt-0.5">{eylem}</div>
        )}
      </div>
    </article>
  );
}

/** Posterli kartları üçlü ızgaraya dizer; darda ikiye, telefonda tek sütuna iner. */
export function KartIzgarasi({ children }: { children: React.ReactNode }) {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {children}
    </ul>
  );
}

/**
 * ZAMAN ÇİZELGESİ — prototipteki `.tl`.
 *
 * Bir sürecin adımlarını sırasıyla gösterir (başvuru takvimi, bir talebin
 * geçtiği onaylar). Bu bilgi bugüne kadar düz tarih listesiyle veriliyordu ve
 * "sırayla olan işler" olduğu görünmüyordu.
 *
 * NOKTA VE ÇİZGİ HİÇ BASILMIYOR — CSS'ten geliyor, dolayısıyla ekran okuyucu
 * sıradan bir `<ol>` duyar. Sıra bilgisi zaten listenin kendisinde.
 *
 * Durumu ÇAĞIRAN belirler çünkü "şimdi"nin tanımı ekrana göre değişiyor:
 * takvimde bugünün tarihi, onay akışında bekleyen basamak.
 */
export function ZamanCizelgesi({
  adimlar,
}: {
  adimlar: {
    baslik: string;
    aciklama?: React.ReactNode;
    durum?: "gecmis" | "simdi" | "gelecek";
  }[];
}) {
  return (
    <ol className="relative">
      {adimlar.map((adim, sira) => {
        const durum = adim.durum ?? "gelecek";
        const sonMu = sira === adimlar.length - 1;

        return (
          <li
            key={`${adim.baslik}-${sira}`}
            className={`relative pl-7 ${sonMu ? "pb-0" : "pb-5"}`}
          >
            {!sonMu && (
              <span
                aria-hidden
                className="absolute top-4 bottom-0 left-[6px] w-px bg-cizgi"
              />
            )}
            <span
              aria-hidden
              className={`absolute top-1.5 left-0 size-3 rounded-full ring-4 ${
                durum === "gecmis"
                  ? "bg-olumlu-cizgi ring-olumlu-zemin"
                  : durum === "simdi"
                    ? "bg-birincil ring-vurgu-zemin"
                    : "bg-cizgi-guclu ring-zemin"
              }`}
            />
            <p
              className={`text-sm ${
                durum === "simdi"
                  ? "font-bold text-baslik"
                  : durum === "gecmis"
                    ? "font-medium text-metin-yumusak"
                    : "font-semibold text-metin"
              }`}
            >
              {adim.baslik}
            </p>
            {adim.aciklama && (
              <div className="mt-0.5 text-sm text-metin-yumusak">
                {adim.aciklama}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * ANAHTAR–DEĞER LİSTESİ — prototipteki `.kv`.
 *
 * Tek bir kaydın künyesi: etiket solda sabit sütunda, değer sağda. Detay
 * sayfaları bugüne kadar bunu kendi ızgaralarıyla kuruyordu ve etiket sütunu
 * sayfadan sayfaya kayıyordu.
 *
 * `<dl>` KULLANILIYOR, tablo değil: bu bir veri tablosu değil, bir kaydın
 * özellikleri. Tabloyla basıldığında ekran okuyucu gereksiz bir ızgara duyurur.
 *
 * Dar ekranda etiket ve değer alt alta düşer — sabit etiket sütunu telefon
 * genişliğinde değere iki kelime yer bırakıyordu.
 */
export function AnahtarDegerListesi({
  satirlar,
}: {
  satirlar: { etiket: string; deger: React.ReactNode }[];
}) {
  return (
    <dl className="divide-y divide-cizgi">
      {satirlar.map((satir) => (
        <div
          key={satir.etiket}
          className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:gap-4"
        >
          <dt className="shrink-0 text-sm font-semibold text-metin-yumusak sm:w-44">
            {satir.etiket}
          </dt>
          <dd className="min-w-0 text-sm text-metin">{satir.deger}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * BELGE LİSTESİ — prototipteki `.doclist`.
 *
 * Şartname, kılavuz, form gibi eklerin listesi. TÜM SATIR tıklanabilir:
 * yalnızca dosya adının bağlantı olduğu listede tıklama hedefi 14 piksellik
 * bir metin oluyor.
 *
 * Varsayılan davranış AÇMAKTIR, indirmek değil: şartnameyi okumak isteyen
 * kişiyi indirmeye zorlamak en sık yapılan işi yavaşlatır.
 */
export function BelgeListesi({
  belgeler,
}: {
  belgeler: { ad: string; yol: string; aciklama?: string; indir?: boolean }[];
}) {
  return (
    <ul className="flex flex-col gap-2">
      {belgeler.map((belge) => (
        <li key={belge.yol}>
          <a
            href={belge.yol}
            download={belge.indir ? "" : undefined}
            className="flex items-center gap-3 rounded-kutu border border-cizgi px-3.5 py-3 transition hover:border-vurgu hover:bg-zemin focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vurgu"
          >
            <span
              aria-hidden
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-kutu bg-vurgu-zemin text-vurgu-metin"
            >
              <FileText size={16} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-metin">
                {belge.ad}
              </span>
              {belge.aciklama && (
                <span className="block truncate text-xs text-metin-yumusak">
                  {belge.aciklama}
                </span>
              )}
            </span>
            <Download
              size={15}
              aria-hidden
              className="ml-auto shrink-0 text-metin-yumusak"
            />
          </a>
        </li>
      ))}
    </ul>
  );
}

/**
 * İLERLEME ÇUBUĞU — prototipteki `.progress`.
 *
 * `role="progressbar"` ve `aria-valuenow` ŞART: çubuk saf görsel bir şerit
 * olsaydı ekran okuyucu kullanıcısı ilerlemenin nerede olduğunu hiç
 * öğrenemezdi. `etiket` verildiğinde yüzde GÖRÜNÜR metin olarak da basılır —
 * rengi göremeyen kişi için çubuğun tek anlamlı karşılığı odur.
 */
export function IlerlemeCubugu({
  deger,
  toplam,
  etiket,
}: {
  deger: number;
  toplam: number;
  etiket?: string;
}) {
  const oran =
    toplam > 0 ? Math.min(100, Math.round((deger / toplam) * 100)) : 0;

  return (
    <div>
      {etiket && (
        <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-metin-yumusak">
          <span>{etiket}</span>
          <span>%{oran}</span>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={deger}
        aria-valuemin={0}
        aria-valuemax={toplam}
        aria-label={etiket ?? "İlerleme"}
        className="h-2 w-full overflow-hidden rounded-full bg-zemin"
      >
        <div
          className="h-full rounded-full bg-birincil transition-[width]"
          style={{ width: `${oran}%` }}
        />
      </div>
    </div>
  );
}

/**
 * ADIM GÖSTERGESİ (stepper) — prototipteki `.stepper`.
 *
 * Çok adımlı bir işlemin neresinde olunduğunu gösterir. Tamamlanan adım yeşil
 * ve TİK işaretli, bulunulan adım kırmızı ve numaralı, gelecek adım soluk.
 *
 * Tik işareti rengin yanına bilinçli kondu: tamamlanmış ile bulunulan adımı
 * yalnızca yeşil/kırmızı ayrımıyla anlatmak, en yaygın renk körlüğü türünde
 * (kırmızı–yeşil) ayrımı tamamen yok ediyor.
 *
 * `yol` verilen GEÇMİŞ adım bağlantı olur; ileri adım düz metindir — oraya
 * varmadan atlanmamalı.
 */
export function AdimGostergesi({
  adimlar,
  aktif,
}: {
  adimlar: { etiket: string; yol?: string }[];
  /** Bulunulan adımın sırası, 0'dan başlar. */
  aktif: number;
}) {
  return (
    <nav aria-label="Adımlar">
      <ol className="flex flex-col gap-1">
        {adimlar.map((adim, sira) => {
          const bitti = sira < aktif;
          const simdi = sira === aktif;

          const govde = (
            <>
              <span
                aria-hidden
                className={`inline-flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
                  bitti
                    ? "border-olumlu-cizgi bg-olumlu-cizgi text-white"
                    : simdi
                      ? "border-birincil bg-birincil text-birincil-metin"
                      : "border-cizgi-guclu bg-kart text-metin-yumusak"
                }`}
              >
                {bitti ? <Check size={14} /> : sira + 1}
              </span>
              <span
                className={`text-sm ${
                  simdi
                    ? "font-bold text-baslik"
                    : bitti
                      ? "font-medium text-metin"
                      : "text-metin-yumusak"
                }`}
              >
                {adim.etiket}
              </span>
            </>
          );

          return (
            <li key={adim.etiket}>
              {adim.yol && bitti ? (
                <Link
                  href={adim.yol}
                  className="flex items-center gap-3 rounded-kutu px-2 py-1.5 transition hover:bg-zemin"
                >
                  {govde}
                </Link>
              ) : (
                <span
                  aria-current={simdi ? "step" : undefined}
                  className="flex items-center gap-3 px-2 py-1.5"
                >
                  {govde}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
