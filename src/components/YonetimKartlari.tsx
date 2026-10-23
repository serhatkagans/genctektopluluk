import {
  BadgeCheck,
  CalendarDays,
  ChevronRight,
  CircleAlert,
  Compass,
  GraduationCap,
  Handshake,
  Map as Harita,
  MapPin,
  Package,
  School,
  UserCog,
  Users,
  UsersRound,
} from "lucide-react";
import Link from "next/link";

/**
 * Yönetim panosunun kart parçaları.
 *
 * Pano tek bir düzen kullanır: il, ilçe ve okul kırılımlarının üçü de aynı
 * kartla basılır, alt menüler de kart olarak durur. Üç ayrı ekranda üç ayrı
 * kart yazılsaydı sayıların yeri ve adı basamaktan basamağa kayardı; oysa
 * kullanıcı hep aynı üç sayıyı arıyor.
 */

/**
 * Kart içindeki tek bir satır: solda ne olduğu, sağda sayısı.
 *
 * Üç sayı YAN YANA DURMUYOR. Öyleydi ve okunmuyordu: kart üç sütuna
 * bölündüğünde "Danışman öğretmen" etiketi iki satıra kırılıyor, altındaki
 * sayı komşularından aşağı kayıyor ve kart bir tablo değil dağınık bir sayı
 * yığını gibi görünüyordu. Alt alta üç satırda etiket kırılsa da hizalar
 * bozulmuyor.
 */
function OlcumSatiri({
  deger,
  etiket,
  Ikon,
}: {
  deger: number;
  etiket: string;
  Ikon: React.ComponentType<{ size?: number; className?: string }>;
}) {
  return (
    <div className="flex items-center gap-2">
      <Ikon size={14} className="shrink-0 text-vurgu-metin" aria-hidden />
      <dt className="flex-1 text-sm text-metin-yumusak">{etiket}</dt>
      <dd className="font-baslik text-lg font-extrabold text-baslik">{deger}</dd>
    </div>
  );
}

/**
 * Toplam şeridindeki sayı — geniş alanda alt alta okunur.
 *
 * ALT SATIR SAYIYI NİTELER, ikinci bir ölçüm değildir: "1.204 okul" başlı
 * başına bir iş çıkarmaz, "312'sinde danışman öğretmen yok" çıkarır. Ayrı bir ölçüm
 * kutusu olsaydı şerit ikiye katlanır ve hangi sayının hangisinin içinde olduğu
 * kaybolurdu.
 */
function Olcum({
  deger,
  etiket,
  Ikon,
  alt,
  altYol,
  uyari = false,
}: {
  deger: number;
  etiket: string;
  Ikon: React.ComponentType<{ size?: number; className?: string }>;
  alt?: string;
  /** Verilirse alt satır, boşluğun doldurulacağı ekrana bağlanır. */
  altYol?: string;
  /** Alt satır bir eksiği söylüyorsa uyarı rengine geçer. */
  uyari?: boolean;
}) {
  const altSinif = uyari ? "text-uyari-metin" : "text-metin-yumusak";

  return (
    <div>
      <dt className="flex items-center gap-1 text-xs text-metin-yumusak">
        <Ikon size={13} className="shrink-0 text-vurgu-metin" aria-hidden />
        {etiket}
      </dt>
      <dd className="mt-1 font-baslik text-2xl font-extrabold text-baslik">
        {deger}
      </dd>
      {alt &&
        (altYol ? (
          <dd className={`mt-0.5 text-xs ${altSinif}`}>
            <Link href={altYol} className="underline underline-offset-2">
              {alt}
            </Link>
          </dd>
        ) : (
          <dd className={`mt-0.5 text-xs ${altSinif}`}>{alt}</dd>
        ))}
    </div>
  );
}

/**
 * Bir birimin (il / ilçe / okul) kartı.
 *
 * `okulSayisi` verilmezse okul sütunu basılmaz: okul kartında "kaç okul"
 * sorusunun karşılığı yoktur, kartın kendisi zaten bir okuldur.
 */
export function BirimKarti({
  ad,
  altBilgi,
  okulSayisi,
  ogretmenSayisi,
  danismanOgretmenSayisi,
  ogrenciSayisi,
  faaliyetSayisi,
  uyarilar,
  yol,
  baglantilar,
  Ikon = School,
}: {
  ad: string;
  /** İkinci satır: okul türü, görevdeki danışman, ilçe sayısı gibi. */
  altBilgi?: string;
  okulSayisi?: number;
  ogretmenSayisi: number;
  danismanOgretmenSayisi: number;
  ogrenciSayisi: number;
  /** Yalnızca il kartında: bu eğitim-öğretim yılının etkinlikleri. */
  faaliyetSayisi?: number;
  /** Kartın altındaki eksik listesi (bkz. yonetim-kurallari · birimUyarilari). */
  uyarilar?: readonly string[];
  /** Verilirse kart kırılımın bir alt basamağına iner. */
  yol?: string;
  /**
   * Kartın altındaki ayrı bağlantılar — kırılımın SON basamağı için.
   *
   * `yol` ile birlikte KULLANILMAZ: kartın tamamı bağlantıyken içine ikinci bir
   * bağlantı koymak geçersiz HTML olurdu. Okul kartında kartın kendisi bir yere
   * gitmez, çünkü okulun altında bir basamak yok; oradan çıkan iki yol var
   * (öğrenci listesi, öğretmen listesi) ve ikisi de aynı ağırlıkta.
   */
  baglantilar?: readonly { etiket: string; yol: string }[];
  /** Poster bandındaki filigran; basamağa göre değişir (il, ilçe, okul). */
  Ikon?: React.ComponentType<{ size?: number; className?: string }>;
}) {
  const icerik = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-baslik">{ad}</p>
          {altBilgi && (
            <p className="mt-0.5 truncate text-sm text-metin-yumusak">
              {altBilgi}
            </p>
          )}
        </div>
        {yol && (
          <ChevronRight
            size={18}
            className="mt-0.5 shrink-0 text-metin-yumusak"
            aria-hidden
          />
        )}
      </div>
      <dl className="mt-4 space-y-1.5">
        {okulSayisi !== undefined && (
          <OlcumSatiri deger={okulSayisi} etiket="Okul" Ikon={School} />
        )}
        {/*
          ÖĞRETMEN, DANIŞMANIN ÜSTÜNDE: ikincisi birincisinin alt kümesidir
          (görev almış öğretmen). Alt küme üstte olsaydı iki sayının ilişkisi
          okunmaz, "300 öğretmenin 80'i danışman" yerine iki bağımsız sayı
          gibi görünürdü.
        */}
        <OlcumSatiri
          deger={ogretmenSayisi}
          etiket="Öğretmen"
          Ikon={Users}
        />
        <OlcumSatiri
          deger={danismanOgretmenSayisi}
          etiket="Danışman öğretmen"
          Ikon={UserCog}
        />
        <OlcumSatiri
          deger={ogrenciSayisi}
          etiket="Öğrenci"
          Ikon={GraduationCap}
        />
        {faaliyetSayisi !== undefined && (
          <OlcumSatiri
            deger={faaliyetSayisi}
            etiket="Etkinlik"
            Ikon={CalendarDays}
          />
        )}
      </dl>
      {/*
        UYARILAR ÖLÇÜMLERİN ALTINDA VE AYRI: yukarısı "burada ne var", burası
        "burada ne eksik". İkisi aynı listede olsaydı eksikler sayıların
        arasında kaybolur, kart da hangisinin haber hangisinin iş olduğunu
        söylemezdi.
      */}
      {uyarilar && uyarilar.length > 0 && (
        <p className="mt-3 flex items-start gap-1.5 text-xs text-uyari-metin">
          <CircleAlert size={13} className="mt-0.5 shrink-0" aria-hidden />
          <span>{uyarilar.join(" · ")}</span>
        </p>
      )}
      {baglantilar && baglantilar.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1 border-t border-cizgi pt-3 text-sm">
          {baglantilar.map((baglanti) => (
            <Link
              key={baglanti.yol}
              href={baglanti.yol}
              className="font-medium text-vurgu-metin underline underline-offset-2"
            >
              {baglanti.etiket}
            </Link>
          ))}
        </div>
      )}
    </>
  );

  /*
    POSTER BANDI BİRİM KARTINDA DA (21 Ağustos 2026 · aynı istek). Rengi
    kartın kendi durumundan geliyor: eksiği olan birim amber, olmayan kırmızı
    bantla açılıyor — bant böylece süs değil, listeyi tararken "burada iş var"
    diyen ilk işaret. İnce (h-10): birim kartı sayı taşıyor, poster onların
    üstünde bir blok gibi durmamalı.
  */
  const ton = uyarilar && uyarilar.length > 0 ? "uyari" : "vurgu";
  const govde = (
    <>
      <div className={`poster poster-${ton} grid h-10 place-items-center`}>
        <Ikon size={18} className="text-white/50" aria-hidden />
      </div>
      <div className="p-5">{icerik}</div>
    </>
  );

  const sinif =
    "block overflow-hidden rounded-kart border border-cizgi bg-kart shadow-kart";

  return yol ? (
    <Link
      href={yol}
      className={`${sinif} transition hover:-translate-y-1 hover:border-vurgu hover:shadow-yuksek`}
    >
      {govde}
    </Link>
  ) : (
    <div className={sinif}>{govde}</div>
  );
}

/**
 * Panoya taşınan menülerin kartı (Öğrenciler, Öğretmenler, Paydaşlar, Görev
 * Rolleri).
 *
 * Üst menüden kalkan sekmeler burada alt menü olarak duruyor: sekme sayısı
 * azalırken ekranların girişi kaybolmasın diye. Birim kartıyla aynı çerçeveyi
 * paylaşır ama sayı basmaz — ölçüm kartı gibi görünseydi başlığındaki sayının
 * ne olduğu sorulurdu.
 */
export function KisayolKarti({
  baslik,
  aciklama,
  Ikon,
  yol,
  bekleyen,
  ton = "vurgu",
  pasifNedeni,
}: {
  baslik: string;
  /**
   * İSTEĞE BAĞLI (21 Ağustos 2026 · istek: panodaki açıklamaların kalkması).
   * Kartın adı yeterince anlatıyorsa satır hiç basılmaz; verilirse başlığın
   * altında durur.
   */
  aciklama?: string;
  Ikon: React.ComponentType<{ size?: number; className?: string }>;
  yol: string;
  /**
   * KARAR BEKLEYEN İŞ SAYISI (26 Ağustos 2026 · istek: onay kartlarında
   * bekleyen sayısı görünsün).
   *
   * Onay kuyrukları kısayol kartıydı: kuyrukta iş olup olmadığı ancak karta
   * tıklayınca görülüyordu. Bildirim gidiyor ama bildirimi kaçıran yönetici
   * için ekranda hiçbir iz kalmıyordu.
   *
   * SIFIR ROZET BASMAZ: "0 bekliyor" rozeti, boş kuyruğu da yapılacak iş
   * gibi gösterirdi. `undefined` ise kartın sayacı yok demektir — çoğu
   * kısayol bir envanter, kuyruk değil.
   */
  bekleyen?: number;
  /**
   * Poster bandının rengi. RENK BİLGİ TAŞIR, süs değil — panelin ölçüm
   * kartlarındaki aileyle aynı sözlük:
   *
   *   · `vurgu`  — kişi ve kayıt envanterleri (Öğrenciler, Okullar, Paydaşlar)
   *   · `uyari`  — eksik ya da karar bekleyen iş (Okul Eksik Durumları, onay
   *                kuyrukları, hata kayıtları)
   *   · `olumlu` — kişinin KENDİ işi (Mentörlüğüm, Ekiplerim, başvuru/talep
   *                açma kartları)
   *   · `notr`   — sistem ve denetim ekranları (Ayarlar, Erişim Kayıtları)
   *
   * Varsayılan `vurgu`: yönetim panosundaki kartların çoğu bir envanterdir.
   */
  ton?: "vurgu" | "olumlu" | "uyari" | "notr";
  /**
   * PASİF KART (23 Ekim 2026 · istek: koordinatörde "Ekipler pasif olsun").
   * Verilirse kart bağlantı olmaz, soluk basılır ve açıklama yerine bu metin
   * yazar.
   */
  pasifNedeni?: string;
}) {
  if (pasifNedeni) {
    return (
      <div
        aria-disabled="true"
        title={pasifNedeni}
        className="flex h-full cursor-not-allowed flex-col overflow-hidden rounded-kart border border-cizgi bg-kart opacity-50 shadow-kart"
      >
        <div className="poster poster-notr relative grid h-16 place-items-center">
          <Ikon size={26} className="text-white/50" aria-hidden />
        </div>
        <div className="p-5">
          <p className="font-semibold text-baslik">{baslik}</p>
          <p className="mt-0.5 text-sm text-metin-yumusak">{pasifNedeni}</p>
        </div>
      </div>
    );
  }
  return (
    /*
      PANELDEKİ ÖLÇÜM KARTIYLA AYNI GÖRÜNÜM (21 Ağustos 2026 · istek: "yönetim
      panellerindeki vs tüm kartları paneldeki kartlar gibi süslü renkli yap").

      Kartlar düz beyaz kutulardı: panelin üstünde poster bantlı, renkli ve
      imlece yükselerek karşılık veren kartlar dururken yönetim panosu aynı
      sistemin başka bir tasarımı gibi görünüyordu. Bant `OlcumKarti`taki
      ölçüyle aynı (h-16) ve ikon posterin içinde yarı saydam bir filigran —
      posterin üstüne çıplak metin basılmıyor (bkz. globals.css · .poster).
    */
    <Link
      href={yol}
      className="group flex h-full flex-col overflow-hidden rounded-kart border border-cizgi bg-kart shadow-kart transition hover:-translate-y-1 hover:border-vurgu hover:shadow-yuksek focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vurgu"
    >
      <div
        className={`poster poster-${ton} relative grid h-16 place-items-center`}
      >
        <Ikon size={26} className="text-white/50" aria-hidden />
        {/*
          Rozet POSTERİN İÇİNDE, başlığın yanında değil: kart listesi göz
          gezdirilerek okunuyor ve bant, satırdaki en yüksek kontrastlı yer.
          Sayı posterin kendi zeminini taşıyor (bkz. globals.css · .poster) —
          üstüne çıplak metin basılmıyor.
        */}
        {bekleyen !== undefined && bekleyen > 0 && (
          <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-bold text-hata-metin">
            <span className="tabular-nums">{bekleyen}</span>
            bekliyor
          </span>
        )}
      </div>
      <div className="flex flex-1 items-start gap-3 p-5">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-baslik">{baslik}</p>
          {aciklama && (
            <p className="mt-0.5 text-sm text-metin-yumusak">{aciklama}</p>
          )}
        </div>
        <ChevronRight
          size={18}
          className="mt-0.5 shrink-0 text-metin-yumusak transition group-hover:text-vurgu-metin"
          aria-hidden
        />
      </div>
    </Link>
  );
}

/**
 * Kart listesinin üstündeki toplam şeridi.
 *
 * Sayılar kartlardan toplanır (bkz. lib/rapor/yonetim-kurallari.ts ·
 * ozetToplami); ayrı sorgulansaydı şeritteki toplam kartların toplamını
 * tutmayabilirdi.
 *
 * İL VE İLÇE ÖLÇÜMLERİ BASAMAĞA GÖRE VERİLİR, hepsi her ekranda basılmaz:
 * ilçenin okul listesinde "toplam ilçe" diye bir sayı yoktur, il koordinatörünün
 * panosunda da "toplam il" sorusunun karşılığı yok — ili zaten kendisi.
 */
export function ToplamSeridi({
  il,
  ilce,
  okul,
  ogretmen,
  danismanOgretmen,
  ogrenci,
  faaliyet,
  koordinatorsuzIl = 0,
  danismansizOkul = 0,
  danismansizOgrenci = 0,
  raporsuzFaaliyet = 0,
  okulEtiketi = "okul",
  mentor,
  paydas,
  okulTemsilcisi,
  ekip,
  urun,
}: {
  /** Yalnızca merkezin il kırılımında. */
  il?: number;
  /** Okul listesinde verilmez. */
  ilce?: number;
  okul: number;
  ogretmen: number;
  danismanOgretmen: number;
  ogrenci: number;
  /** Yalnızca il kırılımında — faaliyetin ilçesi boş olabilir. */
  faaliyet?: number;
  koordinatorsuzIl?: number;
  danismansizOkul?: number;
  danismansizOgrenci?: number;
  raporsuzFaaliyet?: number;
  okulEtiketi?: string;
  /*
   * EKOSİSTEM ÖLÇÜLERİ (26 Ağustos 2026 · istek: "o özete mentör sayıları
   * paydaş sayıları etkinlik sayıları okul temsilcisi sayıları, ekip sayısı
   * ekle, topluluk ekip kulüp, kaç ürün var").
   *
   * HEPSİ İSTEĞE BAĞLI ve verilmeyen basılmıyor: şerit üç ayrı kırılımda
   * kullanılıyor (il, ilçe, okul) ve bu sayıların hepsi her basamakta anlamlı
   * değil — okul kırılımında "kaç paydaş" diye bir soru yok.
   */
  mentor?: number;
  paydas?: number;
  okulTemsilcisi?: number;
  ekip?: number;
  urun?: number;
}) {
  return (
    <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {il !== undefined && (
        <Olcum
          deger={il}
          etiket="İl"
          Ikon={MapPin}
          /*
           * Merkezin bu ekranda aradığı ilk boşluk: koordinatörü olmayan il.
           * Sayı, atamanın yapıldığı ekrana bağlanıyor — uyarıyı görüp nereye
           * gideceğini aramak zorunda kalmasın.
           */
          alt={
            koordinatorsuzIl > 0
              ? `${koordinatorsuzIl} ilde koordinatör yok`
              : "Her ilde koordinatör var"
          }
          altYol={koordinatorsuzIl > 0 ? "/panel/rol-envanteri" : undefined}
          uyari={koordinatorsuzIl > 0}
        />
      )}
      {/*
        ETİKETLERDEN "TOPLAM" ÖN EKİ KALKTI (26 Ağustos 2026 · istek: "toplam
        yazıları kalksın ilçe okul vs yazsın sadece").
        Şeridin tamamı zaten bir toplam; her satırda tekrarlanması, sayıya bir
        şey katmadan altı etiketin de ilk kelimesini aynı yapıyordu.
      */}
      {ilce !== undefined && <Olcum deger={ilce} etiket="İlçe" Ikon={Harita} />}
      <Olcum
        deger={okul}
        etiket={okulEtiketi}
        Ikon={School}
        // Okulu olmayan birimde "her okulda danışman öğretmen var" demek boş bir
        // övgü olurdu; alt satır yalnızca sayılacak okul varken çıkar.
        alt={
          okul === 0
            ? undefined
            : danismansizOkul > 0
              ? `${danismansizOkul} okulda danışman öğretmen yok`
              : "Her okulda danışman öğretmen var"
        }
        uyari={danismansizOkul > 0}
      />
      <Olcum deger={ogretmen} etiket="Öğretmen" Ikon={Users} />
      {/*
        "DANIŞMAN ÖĞRETMEN" ÖLÇÜSÜ KALDIRILDI (26 Ağustos 2026 · istek: "Toplam
        danışman öğretmen 2 bunu sil").

        Sayı, "Öğretmen" ölçüsünün bir alt kümesiydi ve yan yana durunca iki
        bağımsız büyüklük gibi okunuyordu. Aradaki fark zaten okunabiliyor:
        okul ölçüsünün altındaki "N okulda danışman öğretmen yok" satırı,
        danışmanlığın eksik olduğu YERİ söylüyor — sayının kendisinden daha
        işe yarar bir bilgi.

        `danismanOgretmen` PROP'U DURUYOR: çağıranlar (il, ilçe ve okul
        kırılımları) onu hesaplayıp geçiyor ve kaldırılması üç dosyada zincirleme
        değişiklik demekti; ölçü yeniden istendiğinde tek satırla geri gelir.
      */}
      <Olcum
        deger={ogrenci}
        etiket="Öğrenci"
        Ikon={GraduationCap}
        /*
         * Danışmansız öğrenci ÖĞRENCİ SAYISININ ALTINDA duruyor, ayrı bir kutu
         * değil: ikisi aynı kümenin bütünü ve eksiği. Ayrı ölçüm olsaydı
         * "kaç öğrenci var" ile "kaçı takipsiz" iki bağımsız sayı gibi okunurdu.
         */
        alt={
          danismansizOgrenci > 0
            ? `${danismansizOgrenci} öğrencinin danışmanı yok`
            : undefined
        }
        altYol={danismansizOgrenci > 0 ? "/panel/ogrenciler" : undefined}
        uyari={danismansizOgrenci > 0}
      />
      {faaliyet !== undefined && (
        <Olcum
          deger={faaliyet}
          etiket="Bu yılın etkinlikleri"
          Ikon={CalendarDays}
          alt={
            raporsuzFaaliyet > 0
              ? `${raporsuzFaaliyet} etkinliğin raporu eksik`
              : undefined
          }
          altYol={raporsuzFaaliyet > 0 ? "/panel/raporlar" : undefined}
          uyari={raporsuzFaaliyet > 0}
        />
      )}
      {/*
        EKOSİSTEM ÖLÇÜLERİ — kişi ve yer sayılarının ardından geliyor. Sıra
        rastgele değil: önce "kim var" (öğretmen, öğrenci), sonra "ne
        yapılıyor" (etkinlik, ürün), sonra "nasıl örgütlenmiş" (mentör, ekip,
        temsilci, paydaş).
      */}
      {urun !== undefined && (
        <Olcum deger={urun} etiket="Ürün" Ikon={Package} />
      )}
      {mentor !== undefined && (
        <Olcum
          deger={mentor}
          etiket="Mentör"
          Ikon={Compass}
          /* ONAYLI olanlar sayılıyor: bekleyen başvuru henüz bir mentör değil. */
          alt="Onaylanmış mentörlükler"
        />
      )}
      {ekip !== undefined && (
        <Olcum
          deger={ekip}
          etiket="Ekip"
          Ikon={UsersRound}
          /*
            "topluluk ekip kulüp" (istek) TEK SAYIDA: üçü de sistemde tek bir
            kayıt türü — okul takımı, çalışma grubu ve il GençTek ekibi aynı
            `Ekip` tablosunda duruyor (bkz. şemadaki EkipTuru). Ayrı ayrı
            sayılsalardı şeride üç kutu daha girer ve toplamları yine bu sayı
            olurdu; türe göre kırılım Ekiplerim ekranındaki süzgeçte.
          */
          alt="Okul takımı, çalışma grubu ve il ekipleri"
        />
      )}
      {okulTemsilcisi !== undefined && (
        <Olcum
          deger={okulTemsilcisi}
          etiket="Okul temsilcisi"
          Ikon={BadgeCheck}
          alt="Bu eğitim-öğretim yılı"
        />
      )}
      {paydas !== undefined && (
        <Olcum deger={paydas} etiket="Paydaş" Ikon={Handshake} />
      )}
    </dl>
  );
}

/*
  YOL İZİ BİLEŞENİ KALKTI (29 Ağustos 2026 · istek: "yönetim panelindeki tüm
  kartlara uygula").

  Panelde iki ayrı şerit bileşeni vardı: buradaki `YolIzi` (ChevronRight ile
  "Yönetim Paneli › Bolu") ve `components/ui.tsx`ʼteki `KirintiYolu` ("/" ile).
  Aynı işi iki farklı görünümle yapıyorlardı; öğrenci listesi gibi bir ekranda
  hangisinin basılacağı süzgeçlere göre değişiyordu, yani kullanıcı aynı
  ekranda iki farklı şerit görebiliyordu. Basamak yapısı ({ etiket, yol? })
  zaten birebir aynıydı — çağıranların tümü KirintiYolu'na geçti.
*/
