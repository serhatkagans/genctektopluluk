import {
  Bug,
  Compass,
  GraduationCap,
  Handshake,
  Map as Harita,
  MapPin,
  Megaphone,
  Rocket,
  Search,
  Settings,
  School,
  ShieldCheck,
  ShieldUser,
  UserCheck,
  UserCog,
  Users,
  UsersRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { DisaAktarmaBagi } from "@/components/DisaAktarmaBagi";
import {
  Kart,
  KartBasligi,
  Rozet,
  SayfaBasligi,
  SINIF_IKINCIL_BUTON,
} from "@/components/ui";
import {
  BirimKarti,
  KisayolKarti,
  ToplamSeridi,
} from "@/components/YonetimKartlari";
import { oturumKullanicisiZorunlu } from "@/lib/auth/oturum";
import { prisma } from "@/lib/db";
import {
  EKIPLER_KAPALI_ACIKLAMASI,
  ekiplerKapaliMi,
  ekipYonetebilirMi,
} from "@/lib/ekip/kurallar";
import { acikKvkkBasvuruSayisi } from "@/lib/kvkk/basvuru";
import { egitimOgretimYili } from "@/lib/ogretmen/gorev-yillari";
import { ilerlemeYuzdesi, YOL_HARITASI } from "@/lib/proje/yol-haritasi";
import { onayliMentorMu } from "@/lib/mentor/veri";
import {
  birimUyarilari,
  illeriSuz,
  ilSiralamasiCoz,
  ozetToplami,
} from "@/lib/rapor/yonetim-kurallari";
import {
  buYilinFaaliyetleri,
  ilceOzetleriniGetir,
  ilOzetleriniGetir,
} from "@/lib/rapor/yonetim-ozeti";
import {
  gencTekGoreviYonetebilirMi,
  hataKayitlariniGorebilirMi,
  ilKoordinatoruMu,
  koordinatorIlKodu,
  kvkkBasvurulariniYanitlayabilirMi,
  ogrenciEnvanteriGorebilirMi,
  ogretmenEnvanteriGorebilirMi,
  panoIlaniOnaylayabilirMi,
  paydasGorebilirMi,
  projeYoneticisiMi,
  rolEnvanteriGorebilirMi,
  topluMesajGonderebilirMi,
  yonetimPanosuGorebilirMi,
} from "@/lib/yetki/izinler";

export const dynamic = "force-dynamic";

const SINIF_ETIKET = "text-sm font-medium text-metin-yumusak";
const SINIF_SECIM =
  "mt-1 w-full rounded-md border border-cizgi bg-kart px-3 py-2 text-sm text-metin outline-none focus:border-vurgu";

/**
 * YÖNETİM PANELİ (11 Ağustos 2026 · istek: "il koordinatörü ve proje yöneticisi
 * için yönetim paneli olacak, burada olan her şey kart düzeninde olacak").
 *
 * İki işi birden yapar:
 *
 *   1. KIRILIM. Merkez tüm illeri, il koordinatörü kendi ilinin ilçelerini
 *      görür; her kartta o birimdeki okul, öğretmen, danışman öğretmen, öğrenci
 *      ve (ilde) etkinlik sayısı yazar, altında da o birimin EKSİKLERİ durur.
 *      Karta tıklandıkça bir basamak inilir: il → ilçe → okul.
 *   2. ALT MENÜ. Üst menüden kalkan yönetim sekmeleri (Öğrenciler, Öğretmenler,
 *      Paydaşlar, Görev Rolleri, Mentörlük) burada kart olarak duruyor.
 *
 * MERKEZ İLE KOORDİNATÖR AYNI EKRANI PAYLAŞIR, yalnızca başladıkları basamak
 * farklı. Ayrı iki sayfa yazılsaydı ikisinde de aynı kart düzeni ve aynı
 * sayımlar iki kez durur, birinde yapılan düzeltme öbüründe unutulurdu.
 */
export default async function YonetimSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ ara?: string; sirala?: string }>;
}) {
  const { ara, sirala } = await searchParams;
  const kullanici = await oturumKullanicisiZorunlu();

  if (!yonetimPanosuGorebilirMi(kullanici)) {
    return (
      <Kart>
        <KartBasligi
          baslik="Yönetim Paneli"
          aciklama="Bu ekrana erişim yetkiniz yok."
        />
      </Kart>
    );
  }

  const merkezMi = projeYoneticisiMi(kullanici);
  /*
   * Mentörlük bir ROL DEĞİL, onaya bağlı bir kayıt; bu yüzden koşul
   * veritabanından soruluyor (bkz. lib/mentor/veri.ts · onayliMentorMu).
   *
   * MERKEZ HİÇ SORMUYOR (28 Ağustos 2026 · istek: "proje yöneticisinden
   * kaldıralım ona gerek yok"): kart merkezde basılmadığı için cevabın da
   * kullanılacağı bir yer kalmadı — koşul `&&` ile kısa devre yapıyor ve
   * merkezin her yönetim panosu açılışından bir sorgu düşüyor.
   */
  const onayliMentor = !merkezMi && (await onayliMentorMu(kullanici.id));
  const ilKodu = koordinatorIlKodu(kullanici);

  /*
   * Merkezde il, koordinatörde ilçe kırılımı. Koordinatör için il basamağı
   * atlanıyor: tek ili var ve o basamak ona tek kartlık bir ara sayfa olurdu.
   */
  const tumIller = merkezMi ? await ilOzetleriniGetir() : [];
  const ilceler = !merkezMi && ilKodu ? await ilceOzetleriniGetir(ilKodu) : [];
  const il =
    !merkezMi && ilKodu
      ? await prisma.il.findUnique({
          where: { ilKodu },
          select: { ad: true },
        })
      : null;

  /*
   * ONAY KUYRUKLARININ BEKLEYEN SAYILARI (26 Ağustos 2026 · istek:
   * kartlarda bekleyen sayısı görünsün).
   *
   * Üç kuyruk üç ayrı tabloda: görev başvurusu, mentörlük ve pano ilanı.
   * Her sayı YALNIZCA kartı basılan yetkide sorgulanıyor — yetkisi olmayan
   * için sayılan bir kuyruk, hiç görülmeyecek bir gidiş dönüş olurdu.
   *
   * Sayı `count`, liste değil: kart yalnızca kaç iş beklediğini söylüyor,
   * kimin beklediğini kuyruğun kendi ekranı gösteriyor.
   */
  /*
   * MENTÖRLÜK SAYIMI BURADAN KALKTI (27 Ağustos 2026): kartı panoya taşındı ve
   * sayıyı orada kendi kartı yapıyor. Görev başvurusu sayımı DURUYOR, çünkü
   * aşağıdaki "Onay kuyruğu" kartı birleşik ekrana gidiyor ve rozeti o ekranın
   * gösterdiği her şeyi saymalı.
   */
  const [bekleyenGorevBasvurusu, bekleyenIlan, acikKvkkBasvurusu] =
    await Promise.all([
      gencTekGoreviYonetebilirMi(kullanici)
        ? prisma.gencTekGorevBasvurusu.count({
            where: { onayDurumu: "BEKLIYOR" },
          })
        : Promise.resolve(0),
      panoIlaniOnaylayabilirMi(kullanici)
        ? prisma.talep.count({
            where: { onayDurumu: "BEKLIYOR", kapatildiMi: false },
          })
        : Promise.resolve(0),
      /* Ürün sayımı 27 Ağustos 2026'da kalktı: kuyruk GençTek Vitrin
         ekranına taşındı ve orada kendi başlığında sayılıyor. */
      /* KVKK başvuruları (2 Eylül 2026): sayım kuralı öbürleriyle aynı —
         yalnızca kartı basılan yetkide sorulur. Sayı, açık durumların
         kümesini lib/kvkk/basvuru-kurallar.ts'ten okuyor; buradaki `where`
         ile ekranın listesi aynı tanımı paylaşsın diye ortak fonksiyon
         kullanılıyor. */
      kvkkBasvurulariniYanitlayabilirMi(kullanici)
        ? acikKvkkBasvuruSayisi()
        : Promise.resolve(0),
    ]);
  /*
   * EKOSİSTEM SAYILARI (26 Ağustos 2026 · istek: "o özete mentör sayıları
   * paydaş sayıları etkinlik sayıları okul temsilcisi sayıları, ekip sayısı
   * ekle, topluluk ekip kulüp, kaç ürün var").
   *
   * KAPSAM `ilSuzgeci`: koordinatörde kendi ili, merkezde ülke geneli (boş
   * nesne, hiçbir satırı elemiyor). Kırılım kartlarındaki sayılarla aynı
   * kapsamı paylaşıyorlar — şerit "aşağıdaki kartların toplamı" olmalı.
   *
   * SAYILAR ÖZET TABLOSUNDAN DEĞİL, DOĞRUDAN SAYILIYOR: `ilOzetleriniGetir`
   * il başına okul/öğretmen/öğrenci taşıyor ve beşini de eklemek o sorgunun
   * dönüşünü her ekranda büyütürdü — buradaki beş `count`, ilçe kartlarının
   * hiçbirinde kullanılmıyor.
   *
   * DÖNEMLİ OLAN TEK SAYI OKUL TEMSİLCİSİ: görev kaydı eğitim-öğretim yılına
   * bağlı (bkz. OgrenciGorevRolu) ve geçen yılın temsilcisini bu yılın
   * özetinde saymak, boşalan bir görevi dolu göstermek olurdu. Mentörlük,
   * paydaş, ekip ve ürün dönemli değil.
   */
  const ilSuzgeci = ilKodu ? { ilKodu } : {};
  const buYil = egitimOgretimYili(new Date());

  const [
    mentorSayisi,
    paydasSayisi,
    okulTemsilcisiSayisi,
    ekipSayisi,
    urunSayisi,
    etkinlikSayisi,
  ] = await Promise.all([
      prisma.mentorluk.count({
        /* Yalnızca ONAYLI: bekleyen başvuru henüz bir mentör değil. */
        where: { durum: "ONAYLANDI", kullanici: ilSuzgeci },
      }),
      prisma.paydas.count({ where: ilSuzgeci }),
      prisma.ogrenciGorevRolu.count({
        where: {
          rolKodu: "OKUL_TEMSILCISI",
          egitimOgretimYili: buYil,
          /* Görevin kapsamı okul; ili o okulun kaydından geliyor. */
          ...(ilKodu ? { kurum: { ilKodu } } : {}),
        },
      }),
      /* Kapatılan ekip bir arşiv, sayıma girmiyor. */
      prisma.ekip.count({ where: { aktif: true, ...ilSuzgeci } }),
      prisma.kullaniciKazanim.count({
        where: { tip: "URUN", kullanici: ilSuzgeci },
      }),
      /*
       * ETKİNLİK SAYISI DOĞRUDAN SAYILIYOR, ilçe kartlarından toplanmıyor:
       * faaliyetin ilçesi boş olabilir (il ve ulusal kapsamlı etkinlikler bir
       * ilçeye bağlı değil) ve ilçe özetleri faaliyet taşımıyor. Toplansaydı
       * koordinatörün özetinde sıfır yazardı.
       */
      prisma.faaliyet.count({
        where: { AND: [buYilinFaaliyetleri(), ilSuzgeci] },
      }),
    ]);

  const siralama = ilSiralamasiCoz(sirala);
  const aranan = ara?.trim() ?? "";
  const iller = illeriSuz(tumIller, { ara: aranan, sirala: siralama });

  /*
   * TOPLAM SÜZÜLMÜŞ LİSTEDEN HESAPLANIR, tamamından değil: şerit her zaman
   * "aşağıda duran kartların toplamı"dır. Ülke toplamı sabit kalsaydı, tek il
   * arayan kişi kartında 12 okul görüp şeritte 1.204 okul okurdu.
   */
  const toplam = ozetToplami(merkezMi ? iller : ilceler);
  const suzgecVar = aranan !== "" || siralama !== "ad";


  return (
    <div className="space-y-6">
      <SayfaBasligi
        /*
          "PROFİL" GERİ BAĞLANTISI KALKTI (27 Ağustos 2026 · istek: "üstteki
          profil navigasyonunu kaldır bu sayfadaki").

          Bağlantı `SayfaBasligi`'nın VARSAYILANIYDI (bkz. components/ui.tsx ·
          `geri = { yol: "/panel", etiket: "Profil" }`), bu sayfa onu hiç
          geçmediği için basılıyordu. Varsayılanın gerekçesi "menüde karşılığı
          olmayan kartlara inen kullanıcı geri dönemiyor"du; Yönetim Paneli o
          ekranlardan biri DEĞİL — sol menüde kendi satırı var ve Profil de
          menünün ilk satırı, yani bağlantı hiçbir yeni yol açmıyordu.

          Buradan açılan kartlar geri bağlantısını korur ve "/panel/yonetim"
          gösterir: onların üst basamağı bu ekrandır. Değişen yalnızca panonun
          kendi tepesi.
        */
        geri={null}
        baslik="Yönetim Paneli"
        /*
          MERKEZİN AÇIKLAMA CÜMLESİ KALKTI (27 Ağustos 2026 · istek: "yönetim
          panelinden bu açıklamayı sil"). Cümlenin ilk yarısını yanındaki
          "Ülke geneli" rozeti zaten söylüyordu, ikinci yarısı ("bir ile
          tıklayarak…") ise aşağıdaki il kartlarının kendisiyle öğreniliyor.

          KOORDİNATÖRÜNKİ DURUYOR ve bilerek: onun panosunda kırılım ilçe
          düzeyinde başlıyor, yani tıklanacak basamak bir tane ve cümle o tek
          basamağı adlandırıyor. İstek de yalnızca merkezin gördüğü satırı
          gösteriyordu.
        */
        aciklama={
          merkezMi
            ? undefined
            : `${il?.ad ?? "İliniz"} ilindeki ilçeler ve yönetim ekranları. Bir ilçeye tıklayarak okullarını görebilirsiniz.`
        }
        rozet={
          /*
            KAPSAM ROZETİ (18 Ağustos 2026 · tasarım yenilemesi). Aynı ekran iki
            bambaşka kapsamda açılıyor — merkez 81 ili, koordinatör tek ilini
            görüyor — ve bu bilgi yalnızca açıklama cümlesinin içinde geçiyordu.
            Ekran görüntüsü paylaşıldığında ya da iki rol yan yana konuşurken
            "sen neye bakıyorsun" sorusunun cevabı bir cümle okumayı
            gerektiriyordu; rozet onu başlığın hemen üstüne çıkarıyor.
          */
          <Rozet cesit="vurgu" Ikon={MapPin}>
            {merkezMi ? "Ülke geneli" : `${il?.ad ?? "İliniz"} ili`}
          </Rozet>
        }
      />

      {/*
        KOORDİNATÖRÜN İKİ ÖLÇÜM KARTI KALDIRILDI (26 Ağustos 2026 · istek:
        "yönetim panelinden İlimdeki öğrenciler … Onay bekleyen etkinlik bu
        kartları kaldır").

        Kartlar aynı gün profil sayfasından buraya taşınmıştı; iki tur sonra
        ikisi de kalktı. Sayıların karşılığı duruyor ve bir tık ötede: öğrenci
        sayısı aşağıdaki Öğrenciler kartının açtığı listede, bekleyen etkinlik
        ise Etkinlikler ekranındaki onay süzgecinde. Pano artık tek bir dil
        konuşuyor — hepsi kısayol kartı, aralarında sayı gösteren iki kart yok.
      */}

      {/*
        ALT MENÜ KARTLARI. Sırası üst menüdeki eski sırayı korur: kullanıcı
        sekmeleri soldan sağa nasıl okuyorduysa kartları da öyle okuyor.

        Her kart KENDİ YETKİSİNİ sorar; pano kapısını geçmiş olmak kartların
        hepsini hak etmek anlamına gelmiyor (bkz. yonetimPanosuGorebilirMi).
      */}
      <Kart>
        {/*
          KART BAŞLIĞI KALKTI (27 Ağustos 2026 · istek: "bunu da sil ·
          Yönetim ekranları · Üst menüden kaldırılan yönetim sekmeleri
          burada."). Kartların her biri zaten nereye götürdüğünü adıyla ve
          açıklamasıyla söylüyor; üstlerindeki başlık bunu bir kez daha
          söylüyordu. Alt açıklama ise sekmelerin bir zamanlar üst menüde
          durduğunu anlatıyordu — bugünün kullanıcısı için bir bilgi değil.

          Emsali aynı ay panelde yapıldı: "Dikkat gerektirenler" başlığı da
          kartların üstünden kalkmış, `aria-label` ile yerini korumuştu.
        */}
        <div
          aria-label="Yönetim ekranları"
          className="grid gap-3 sm:grid-cols-2"
        >
          {/*
            İL KOORDİNATÖRLERİ EN BAŞTA (27 Ağustos 2026 · istek: "yönetim
            panelinde kart listesinin başına il koordinatörleri kartı
            gelsin").

            Kart = eski "Rol/Atama Envanteri" (11 Ağustos 2026 · istek:
            "yönetim paneline bir de koordinatörler sayfası gelecek, rol atama
            envanteri koordinatör kartına gelecek"); adı bu turda "İl
            koordinatörleri" oldu, adresi ve yetkisi aynı kaldı.

            SIRANIN GEREKÇESİ, aşağıdaki dört kartınkiyle aynı mantığın bir üst
            basamağı: kapsam genişten dara iniyor. Merkez için ilin muhatabı
            okuldan da önce gelir — bir ilde işi olan kişinin ilk sorusu
            "orada kim var" olur. Kart YALNIZCA MERKEZDE basılıyor
            (`rolEnvanteriGorebilirMi`), yani koordinatörün panosu eskisi gibi
            Okullar kartıyla açılıyor.
          */}
          {rolEnvanteriGorebilirMi(kullanici) && (
            <KisayolKarti
              baslik="İl koordinatörleri"
              aciklama="İl koordinatörü atamaları, boş iller ve rol geçmişi"
              Ikon={UserCog}
              yol="/panel/rol-envanteri"
            />
          )}
          {/*
            SONRAKİ DÖRT KART: OKULLAR · ÖĞRETMENLER · ÖĞRENCİLER · PAYDAŞLAR
            (26 Ağustos 2026 · istekler: "il koordinatörünün yönetim panelinde
            ilk kart okullar olsun" · "kartlarda 2. sırada öğretmenler kartı
            olsun" · "3. sırada öğrenciler olsun" · "4. kart paydaşlar olsun").

            Paydaşlar kartı zaten dördüncüydü ve yerinde bırakıldı; sıra burada
            yazılı olsun diye anılıyor.

            SIRA ROLE BAĞLI DEĞİL: ilk turda yalnızca koordinatörde
            değiştirilmişti, merkezinki eski sırasında bırakılmıştı — aynı pano
            iki rolde iki farklı sırayla açılıyordu ve ekran görüntüsü
            paylaşıldığında "bende öyle değil" cevabı doğuyordu. Tek sıra
            herkeste.

            ESKİ SIRA üst menüdeki sekme sırasıydı (Öğrenciler önce). Yeni sıra
            KAPSAMIN GENİŞLİĞİNE göre daralıyor: okul bir yerdir ve içinde
            öğretmen, öğretmenin altında öğrenci vardır — ilinde bir işi olan
            kişi önce "hangi okul" diye soruyor.

            OKULLAR KARTININ KENDİ YETKİ SORUSU YOK ve bu eskiden de böyleydi:
            pano kapısını geçen herkes (merkez ve koordinatör) okul arayabilir.
          */}
          <KisayolKarti
            baslik="Okullar"
            aciklama={
              merkezMi
                ? "Ülke genelinde okul arama — ad, ilçe ya da kurum kodu"
                : "İlinizdeki okullar ve kişi sayıları"
            }
            Ikon={School}
            yol="/panel/okullar"
          />
          {ogretmenEnvanteriGorebilirMi(kullanici) && (
            <KisayolKarti
              baslik="Öğretmenler"
              aciklama="Danışman öğretmenler ve görev almamış öğretmenler"
              Ikon={Users}
              yol="/panel/ogretmenler"
            />
          )}
          {ogrenciEnvanteriGorebilirMi(kullanici) && (
            <KisayolKarti
              baslik="Öğrenciler"
              aciklama={
                merkezMi
                  ? "Ülke genelindeki öğrenci envanteri, süzgeçler ve CSV çıktısı"
                  : "İlinizdeki öğrenci envanteri, süzgeçler ve CSV çıktısı"
              }
              Ikon={GraduationCap}
              yol="/panel/ogrenciler"
            />
          )}
          {paydasGorebilirMi(kullanici) && (
            <KisayolKarti
              baslik="Paydaşlar"
              aciklama="İş birliği yapılan kurumlar ve iletişim kişileri"
              Ikon={Handshake}
              yol="/panel/paydaslar"
            />
          )}
          {/*
            "EKİP YÖNETİMİ" KARTI EKİPLERİM'İN İÇİNE ALINDI (26 Ağustos 2026 ·
            istek: "bunu ekiplerimin içine al: Ekip Yönetimi").

            İki ekran 15 Ağustos'ta ayrılmıştı ve ayrımın kendisi duruyor:
            `panel/ekipler` "benim ekiplerim", `panel/ekip-yonetimi` ilin bütün
            ekiplerinin envanteri — koordinatör kendi ekibini yüzlerce kaydın
            içinde aramamalı. Değişen yalnızca ENVANTERE GİDEN KAPI: panoda
            ayrı bir kart olmaktansa, ENVANTER LİSTESİNİN KENDİSİ Ekiplerim
            ekranına indi (istek: "ekip yönetimindeki liste ekiplerime
            gelecek"). Ekip işine bakan kişi zaten oradan başlıyor.
          */}
          {/*
            "OKUL EKSİK DURUMLARI" KARTI KALDIRILDI (26 Ağustos 2026 · istek:
            "bu kartları sil").

            EKRAN DURUYOR (/panel/okul-eksikleri) ve yetkisi değişmedi; kalkan
            yalnızca buradaki kapı. Kaldırılabilmesinin sebebi aynı gün yapılan
            taşıma: pano artık Okullar kartıyla açılıyor ve o ekran aynı
            listeyi süzgeçleriyle veriyor.
          */}
          {/*
            "GÖREV ROLLERİ" KARTI KALDIRILDI (26 Ağustos 2026 · istek: "bu kartı
            kaldır: Görev rolleri").

            Kartın işi aynı gün ÖĞRENCİLER LİSTESİNE indi: İl / İlçe / Okul
            temsilcisi görevleri artık öğrencinin kendi satırında veriliyor
            (bkz. ogrenciler/page.tsx · TemsilcilikHucresi). Görev vermek için
            önce buraya, sonra ayrı bir ekranda öğrenciyi yeniden aramak
            gerekmiyor.

            EKRAN SİLİNMEDİ (/panel/gorev-rolleri): ilin bütün görevlilerini tek
            listede görmek ve CSV almak ayrı bir sorudur. Yalnızca panodaki
            kapısı kalktı.
          */}
          {/*
            GENÇTEK GÖREVLERİ (21 Ağustos 2026 · istek: "yönetim panelinde yeni
            kart gençtek görevlerini görebilsin"). Mentörlük kartının yanında:
            ikisi de merkezin karara bağladığı başvuru kuyruğu.
          */}
          {/*
            "MENTÖRLER" VE "GENÇTEK GÖREVLERİ" KARTLARI PANOYA TAŞINDI
            (27 Ağustos 2026 · istek: "panodaki onay kuyruğu kartını
            çoklayalım · birinde mentör onayları, gençtek görevi onayları ·
            mentör onayları zaten yönetim panelinde var, buraya taşınacak o
            kart").

            İkisi de bir BAŞVURUNUN karara bağlanması ve panonun kimliği zaten
            bu. Buradaki gerekçe "merkezin onay işleri tek panoda toplansın"
            idi; o pano artık /panel/talepler. Ekranlar ve yetkileri değişmedi
            (`mentorlukOnaylayabilirMi`, `gencTekGoreviYonetebilirMi`); kalkan
            yalnızca bu iki kapı.
          */}
          {/*
            PANO İLANLARI (14 Ağustos 2026 · istek: "panodaki öğrenci ilanları
            şimdilik proje yöneticilerine düşsün oradan onay versin").

            Kartın ikizi panonun kendi ekranında da var: merkez ilanları zaten
            orada okuyor ve karar oradan bir tık uzakta olmalı. Buradaki kopya,
            mentörlük kuyruğuyla aynı yerde durması içindir — merkezin onay
            işleri tek panoda toplanıyor.
          */}
          {panoIlaniOnaylayabilirMi(kullanici) && (
            <KisayolKarti
              baslik="Onay kuyruğu"
              aciklama="Onay bekleyen pano ilanları ve görev başvuruları"
              Ikon={Megaphone}
              yol="/panel/talepler/onaylar"
              /*
                SAYI İKİ KUYRUĞUN TOPLAMI (26 Ağustos 2026): ekran ikisini
                birden gösteriyor, rozet de öyle saymalı. Görev başvuruları
                GençTek Görevleri kartında da sayılıyor — aynı iş iki
                kapıdan görünüyor ve bu bilerek: merkez onayları tek
                ekranda toplamak istedi, görev ekranı ise ilan yönetimini
                de taşıyor.
              */
              bekleyen={bekleyenIlan + bekleyenGorevBasvurusu}
              ton="uyari"
            />
          )}
          {/*
            ÜÇ "KENDİM YAPAYIM" KARTI KALDIRILDI (26 Ağustos 2026 · istek: "bu
            kartları sil"): "Destek / duyuru talebi aç", "Mentör talebi aç" ve
            "Mentör olarak başvur".

            Üçü de 14 Ağustos'ta buraya PANODAN KOPYALANMIŞTI ve gerekçesi
            "merkez günlük işini tek ekrandan yürütsün" idi. Kopya oldukları
            için kaldırılmaları hiçbir kapıyı kapatmıyor: üçünün de aslı
            panoda (/panel/talepler) duruyor, adresleri ve yetkileri
            değişmedi.

            Kalkmalarının sebebi panonun kimliği: bu ekran İLİN İŞLERİNİ
            yönetiyor — okullar, öğretmenler, öğrenciler, onay kuyrukları.
            "Kendim mentör olarak başvurayım" ise kişinin kendi işi ve
            yönetim kartlarının arasında yabancı duruyordu.
          */}
          {/*
            MENTÖRLÜĞÜM (15 Ağustos 2026 · istek: "koordinatör sayfasında
            mentörlüğüm isminde bir menü var, onu yönetim paneline kart olarak
            koy").

            Sekme koordinatör ve merkezde MENÜDEN KALKTI, kart olarak buraya
            geldi — "Ekiplerim" kartıyla aynı gerekçe: mentörlük koordinatörün
            günlük işi değil, ihtiyaç oldukça açtığı bir kapı.

            KART ARTIK YALNIZCA İL KOORDİNATÖRÜNDE (28 Ağustos 2026 · istek:
            "proje yöneticisinden kaldıralım ona gerek yok"). Merkezin mentörlük
            işi kendi kaydını okumak değil, BAŞKALARININ başvurusunu karara
            bağlamak — o da bu panodaki mentörlük onay kuyruğunda. İki kart yan
            yana durunca hangisinin merkezin işi olduğu belirsizleşiyordu.

            Merkezdeki bir kişi onaylı mentörse sayfası kapanmadı:
            /panel/mentorlugum yerinde ve Profil'deki "Mentörlüklerim" kartı
            oraya götürüyor (bkz. app/panel/page.tsx).

            KOŞUL YİNE VERİTABANINDAN (`onayliMentorMu`), rolden değil: kart
            yalnızca onaylı mentörde basılıyor, yoksa 404 dönen bir kapıya
            davet edilmiş olurdu.
          */}
          {onayliMentor && (
            <KisayolKarti
              baslik="Mentörlüğüm"
              aciklama="Size gelen mentörlük talepleri ve verdiğiniz cevaplar"
              Ikon={Compass}
              yol="/panel/mentorlugum"
              ton="olumlu"
            />
          )}
          {/*
            EKİPLERİM (13 Ağustos 2026 · istek: "il koordinatörü ekipler
            kurabilsin … bunu da yönetim paneline kart olarak ekleyelim, ismi
            ekiplerim olsun").

            Kart, ekibin kurulduğu ve yönetildiği tek kapıdır: menüde sekmesi
            yok, çünkü ekip günlük bir iş değil — koordinatörün ihtiyaç
            duyduğunda kurduğu bir topluluk. Üyeler ekiplerine kendi
            panellerindeki karttan giriyor (bkz. app/panel/page.tsx).

            Yetki `ekipYonetebilirMi`: il koordinatörü ve merkez. Yönetim
            panosunu zaten bu ikisi açıyor ama kart yine de koşullu — panoya
            ileride başka bir rol girerse ekip kurma kapısı sessizce açılmasın.
          */}
          {/*
            "YEĞİTEK OKUL SORUMLUSU" KARTI KALKTI (27 Ağustos 2026 · istek: "bu
            kartı buradan kaldırıp … öğretmenler panelinin içine sütun olarak
            ekleyelim").

            Kart 13 Ağustos'ta ayrı bir liste ekranına açılıyordu; işaret ise
            bir öğretmenin özelliği — kendi satırında okunması gereken bir
            sütun. Ayrı ekranda dururken "bu öğretmen sorumlu mu" sorusunun
            cevabı öğretmen listesinde yoktu ve iki liste arasında ada göre
            eşleştirme gerekiyordu.

            EKRAN SİLİNMEDİ (/panel/okul-sorumlulari) ve yetkisi değişmedi;
            kalkan yalnızca buradaki kapı — işaretin kendisi artık Öğretmenler
            listesinin bir sütunu.
          */}
          {/*
            TOPLU DANIŞMAN ATAMASI (23 Ekim 2026 · istek: "yönetim panelinde
            toplu atama olsun"). Atamayı yalnızca proje yöneticisi yapıyor.
          */}
          {projeYoneticisiMi(kullanici) && (
            <KisayolKarti
              baslik="Toplu danışman ataması"
              aciklama="İldeki danışmansız öğrencileri okullarına göre öğretmenlere atayın"
              Ikon={UserCheck}
              yol="/panel/yonetim/toplu-danisman"
              ton="uyari"
            />
          )}
          {(ekipYonetebilirMi(kullanici) || ekiplerKapaliMi(kullanici)) && (
            <KisayolKarti
              baslik="Ekipler"
              aciklama="İlinizde kurduğunuz ekipler, üyeleri ve ekip sohbetleri"
              Ikon={UsersRound}
              yol="/panel/ekipler"
              ton="olumlu"
              // Koordinatörde kart pasif (23 Ekim 2026 · "Ekipler pasif olsun").
              pasifNedeni={
                ekiplerKapaliMi(kullanici) ? EKIPLER_KAPALI_ACIKLAMASI : undefined
              }
            />
          )}
          {/*
            "ETKİNLİK RAPORLARI" KARTI ETKİNLİKLER EKRANINA TAŞINDI (26 Ağustos
            2026 · istek: "bu kartı etkinliklere taşı").

            15 Ağustos'ta buraya konmuştu çünkü ekranın HİÇ KAPISI YOKTU: menüde
            sekmesi yok, tek girişi Panelim'deki "Raporsuz biten etkinlik" ölçüm
            kartıydı ve sayı sıfırlanınca yol da kapanıyordu. Kapı sorunu
            çözüldü; şimdi kapı doğru yere taşındı — rapor bir ETKİNLİĞİN
            raporu ve onu arayan kişi etkinlikler ekranında.

            Yetki değişmedi: ekran koordinatör, merkez ve rapor yazabilen
            danışman öğretmene açık; düğme de rapor yazabilenlere basılıyor.
          */}
          {/*
            MERKEZİN ÜÇ EKRANI (11 Ağustos 2026). Panonun kuruluş gerekçesi
            "yönetim ekranlarının girişi burada olsun"du ama merkeze özel bu üç
            sekme bir süre üst menüde de kaldı.

            SEKMELERİ 14 AĞUSTOS 2026'DA KALKTI (istek: "yönetim panelinde
            erişim kayıtları ve mesaj gönder ve sistem ayarları kart olarak var
            menüden kaldır"). Aynı üç ekranın iki kapısı vardı; kapı artık
            burası. Sayfalar ve yetkileri değişmedi.
          */}
          {/*
            TOPLU MESAJ (31 Ağustos 2026 · istekler: "il koordinatörü yönetim
            panelinde toplu mesaj kartı ekle, ilindeki tüm öğrenciler, tüm
            öğretmenler, ilçe temsilcisi, il temsilcisi, eklediği ekiplere ayrı
            ayrı her ekip için ayrı toplu mesaj" · "proje yöneticisi de sadece
            öğrenci ve öğretmenlere değil ekiplere topluluklara ayrı ayrı toplu
            mesaj atabilsin").

            KART "Erişim Kayıtları / Sistem Ayarları" ÜÇLÜSÜNDEN ÇIKARILDI:
            orada `rolEnvanteriGorebilirMi` ile basılıyordu, yani yalnızca
            merkezde. Kendi izin kapısı var (`topluMesajGonderebilirMi`) çünkü
            kitle artık gönderenin kapsamı kadar — koordinatörün mesajı ilini
            aşmıyor. Aynı kapıyı paylaşsalardı koordinatöre toplu mesaj açmak,
            ona bildirim şablonlarını ve erişim kayıtlarını da açardı.
          */}
          {topluMesajGonderebilirMi(kullanici) && (
            <KisayolKarti
              baslik="Toplu Mesaj"
              aciklama={
                merkezMi
                  ? "Öğrencilere, öğretmenlere, ekiplere ve topluluklara ayrı ayrı bildirim"
                  : "İlinizdeki öğrenci, öğretmen, temsilci ve ekiplere ayrı ayrı bildirim"
              }
              Ikon={Megaphone}
              yol="/panel/duyurular"
              ton="notr"
            />
          )}
          {rolEnvanteriGorebilirMi(kullanici) && (
            <>
              <KisayolKarti
                baslik="Erişim Kayıtları"
                aciklama="Kimin hangi kaydı görüntülediği — KVKK denetimi"
                Ikon={ShieldCheck}
                yol="/panel/erisim-loglari"
                ton="notr"
              />
              <KisayolKarti
                baslik="Sistem Ayarları"
                aciklama="Çalışma grupları, etkinlik programları ve sistem ayarları"
                Ikon={Settings}
                yol="/panel/ayarlar"
                ton="notr"
              />
            </>
          )}
          {/*
            HATA KAYITLARI (18 Ağustos 2026 · inceleme bulgusu).

            Kullanıcı beklenmeyen bir hatada ekranda yalnızca bir numara
            görüyor ("Hata kimliği: 598556021") ve o numaranın karşılığı
            günlüğe yazılıyordu — ama okunmasının tek yolu sunucuda
            `npm run hata:ara` çalıştırmaktı. Numarayı bildiren kişi ile
            sunucuya girebilen kişi aynı kişi değil; ekranın olmaması,
            tutulan kaydı proje yöneticisi için okunamaz kılıyordu.

            YETKİ AYRI SORULUYOR (`hataKayitlariniGorebilirMi`), yukarıdaki üç
            kartın koşuluna eklenmedi: iki ekranın merkeze kapalı olma
            gerekçesi farklı — biri kişisel veri, öbürü sunucunun iç yapısı
            (bkz. lib/yetki/izinler.ts).
          */}
          {hataKayitlariniGorebilirMi(kullanici) && (
            <KisayolKarti
              baslik="Hata Kayıtları"
              aciklama="Kullanıcının bildirdiği hata kimliğinin karşılığı: hangi adres, hangi hata, ne zaman"
              Ikon={Bug}
              yol="/panel/hata-kayitlari"
              ton="uyari"
            />
          )}
          {/*
            KVKK BAŞVURULARI (2 Eylül 2026 · Genelge 4/ç).

            Kuyruğun SAYACI VAR ve olması şart: başvurunun kanunî yanıt süresi
            otuz gün (KVKK m.13) ve bildirimi kaçıran yönetici için ekranda
            başka hiçbir iz kalmıyordu. Ton `uyari` — kart bir envanter değil,
            süresi işleyen bir iş kuyruğu.

            YETKİ AYRI SORULUYOR (`kvkkBasvurulariniYanitlayabilirMi`):
            merkeze kapalı olma gerekçesi hata kayıtlarınınkinden de erişim
            kayıtlarınınkinden de farklı — başvuru VERİ SORUMLUSUNA yapılır ve
            veri sorumlusu YEĞİTEK'tir.
          */}
          {kvkkBasvurulariniYanitlayabilirMi(kullanici) && (
            <KisayolKarti
              baslik="KVKK Başvuruları"
              aciklama="İlgili kişilerin kişisel veri başvuruları; yasal yanıt süresi 30 gün"
              Ikon={ShieldUser}
              yol="/panel/kvkk-basvurulari"
              bekleyen={acikKvkkBasvurusu}
              ton="uyari"
            />
          )}
          {/*
            PROJE İLERLEME DURUMU (3 Eylül 2026 · istek: "proje yöneticisi
            yönetim paneline proje-ilerleme kartı ekleyip … neler yapılmış
            tarih tarih").

            YALNIZCA MERKEZ (`projeYoneticisiMi`), yukarıdaki kartların
            koşullarından hiçbirine eklenmedi: liste yayına alınmamış
            çalışmaları, sunucu ayarlarını ve açık maddeleri içeriyor —
            `yonetimPanosuGorebilirMi` ile açılsaydı seksen bir ilin
            koordinatörüne de açılırdı.

            AÇIKLAMAYA YÜZDE BASILIYOR: kart bir envanter değil, bir durum
            özeti; sayı olmadan kişinin ilerlemeyi öğrenmek için karta
            tıklaması gerekirdi. `bekleyen` rozeti KULLANILMIYOR — bu bir iş
            kuyruğu değil, kuyruk sayacı "yapılacak 8 iş var" gibi okunurdu.
          */}
          {projeYoneticisiMi(kullanici) && (
            <KisayolKarti
              baslik="Proje İlerleme Durumu"
              aciklama={`Yol haritası tarih tarih: ${YOL_HARITASI.length} madde, genel ilerleme %${ilerlemeYuzdesi(YOL_HARITASI)}`}
              Ikon={Rocket}
              yol="/panel/proje-ilerleme"
              ton="notr"
            />
          )}
        </div>
      </Kart>

      <Kart>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <KartBasligi
            /*
              KOORDİNATÖRDE BAŞLIK "İL ÖZETİ" (26 Ağustos 2026 · istek:
              "yönetim panelindeki İlçeler başlığı il özeti olsun … en alttaki
              ilçe listesinden bahsediyorum").

              Kartın içeriği iki parçadan oluşuyor: üstte İLİN toplamları
              (ekosistem şeridi), altta ilçe kartları. "İlçeler" adı yalnızca
              alt yarısını anlatıyordu ve şerit büyüdükçe (mentör, ekip, ürün…)
              başlıkla içerik daha da ayrıştı. Merkezde "İller" kalıyor: orada
              şerit ülke geneli, kartlar da illerin kendisi.
            */
            baslik={merkezMi ? "İller" : "İl özeti"}
            aciklama={
              merkezMi
                ? "Her kartta ildeki okul, öğretmen, öğrenci ve etkinlik sayısı"
                : "İlinizin toplamları ve ilçe kırılımı"
            }
            Ikon={MapPin}
          />
          {/*
            DOSYA, EKRANDA GÖRÜNEN LİSTENİN AYNISI: arama ve sıralama adresten
            geldiği için indirme bağlantısına da aynı parametreler ekleniyor.
            Ölçütler taşınmasaydı "koordinatörsüz iller" listesini süzen kişi,
            indirdiği dosyada 81 ilin tamamını bulurdu.
          */}
          <DisaAktarmaBagi
            yol={`/panel/yonetim/disa-aktar${
              suzgecVar
                ? `?${new URLSearchParams({
                    ...(aranan ? { ara: aranan } : {}),
                    ...(siralama !== "ad" ? { sirala: siralama } : {}),
                  }).toString()}`
                : ""
            }`}
          />
        </div>

        {/*
          SÜZGEÇ YALNIZCA MERKEZDE: koordinatörün ilçe sayısı onlarla ölçülür ve
          zaten tek ekranda görünür; 81 il ise aranmadan bulunmuyordu. Form GET
          ile çalışıyor, yani sonuç adres çubuğunda duruyor ve paylaşılabiliyor.
        */}
        {merkezMi && (
          <form method="get" className="mb-5 grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={SINIF_ETIKET}>İl ara</span>
                <input
                  type="search"
                  name="ara"
                  defaultValue={aranan}
                  placeholder="İl adı"
                  className={SINIF_SECIM}
                />
              </label>
              <label className="block">
                <span className={SINIF_ETIKET}>Sıralama</span>
                <select
                  name="sirala"
                  defaultValue={siralama}
                  className={SINIF_SECIM}
                >
                  <option value="ad">İl adına göre</option>
                  <option value="ogrenci">Öğrencisi çok olan üstte</option>
                  <option value="bosluk">Eksiği çok olan üstte</option>
                </select>
              </label>
            </div>
            <div className="flex items-end gap-3">
              <button type="submit" className={SINIF_IKINCIL_BUTON}>
                <Search size={16} aria-hidden />
                Uygula
              </button>
              {suzgecVar && (
                <Link
                  href="/panel/yonetim"
                  className="inline-flex items-center gap-1 pb-2 text-sm font-medium text-vurgu-metin"
                >
                  <X size={14} aria-hidden />
                  Temizle
                </Link>
              )}
            </div>
          </form>
        )}

        <div className="mb-5 rounded-kart border border-cizgi bg-zemin px-5 py-5">
          <ToplamSeridi
            /*
             * İl sayısı ozetToplami'den gelmez, KART SAYISININ KENDİSİDİR:
             * il kartında "kaç il" diye bir alan yok, listenin uzunluğu o sayı.
             * Koordinatör görünümünde ölçüm hiç basılmıyor — tek ili var.
             */
            il={merkezMi ? iller.length : undefined}
            ilce={toplam.ilce}
            okul={toplam.okul}
            ogretmen={toplam.ogretmen}
            danismanOgretmen={toplam.danismanOgretmen}
            ogrenci={toplam.ogrenci}
            /*
              ETKİNLİK SAYISI ARTIK KOORDİNATÖRDE DE (26 Ağustos 2026 · istek:
              "etkinlik sayıları … ekle"). Daha önce yalnızca merkezde
              basılıyordu çünkü ilçe özetleri faaliyet taşımıyor — faaliyetin
              ilçesi boş olabilir. Koordinatörün sayısı ilçe kartlarından
              TOPLANMIYOR, ilin kendi toplamı olarak `ilOzeti`den geliyor.
            */
            faaliyet={merkezMi ? toplam.faaliyet : etkinlikSayisi}
            mentor={mentorSayisi}
            paydas={paydasSayisi}
            okulTemsilcisi={okulTemsilcisiSayisi}
            ekip={ekipSayisi}
            urun={urunSayisi}
            koordinatorsuzIl={toplam.koordinatorsuzIl}
            danismansizOkul={toplam.danismansizOkul}
            danismansizOgrenci={toplam.danismansizOgrenci}
            raporsuzFaaliyet={toplam.raporsuzFaaliyet}
          />
        </div>

        {merkezMi ? (
          iller.length === 0 ? (
            <p className="text-sm text-metin-yumusak">
              &ldquo;{aranan}&rdquo; aramasıyla eşleşen il yok.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {iller.map((il) => (
                <BirimKarti
                  key={il.ilKodu}
                  Ikon={MapPin}
                  ad={il.ad}
                  /*
                   * İlçe sayısı kartın alt satırında: tıklanınca ne kadar liste
                   * açılacağını önceden söylüyor. Koordinatör adı ise merkezin
                   * bu ekranda aradığı ilk bilgi — koordinatörsüz il,
                   * doldurulacak bir boşluktur (bkz. istatistik.ts).
                   */
                  altBilgi={`${il.ilceSayisi} ilçe · ${
                    il.koordinatorAdi ?? "Koordinatör atanmadı"
                  }`}
                  okulSayisi={il.okulSayisi}
                  ogretmenSayisi={il.ogretmenSayisi}
                  danismanOgretmenSayisi={il.danismanOgretmenSayisi}
                  ogrenciSayisi={il.ogrenciSayisi}
                  faaliyetSayisi={il.faaliyetSayisi}
                  uyarilar={birimUyarilari(il)}
                  yol={`/panel/yonetim/il/${il.ilKodu}`}
                />
              ))}
            </div>
          )
        ) : ilceler.length === 0 ? (
          <p className="text-sm text-metin-yumusak">
            İlinize bağlı ilçe kaydı bulunamadı.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ilceler.map((ilce) => (
              <BirimKarti
                key={ilce.ilceKodu}
                Ikon={Harita}
                ad={ilce.ad}
                okulSayisi={ilce.okulSayisi}
                ogretmenSayisi={ilce.ogretmenSayisi}
                danismanOgretmenSayisi={ilce.danismanOgretmenSayisi}
                ogrenciSayisi={ilce.ogrenciSayisi}
                /*
                 * Şeritteki eksiklerin hangi ilçeden geldiği ancak kartta
                 * görünür; toplam "nerede iş var" der, kart "kimde" der.
                 */
                uyarilar={birimUyarilari(ilce)}
                yol={`/panel/yonetim/ilce/${ilce.ilceKodu}`}
              />
            ))}
          </div>
        )}
      </Kart>

      {/*
        Kırılımın dışındaki tek çıkış: ilin tamamının listesi. Kartlar ilçe
        ilçe gidiyor, "ilimdeki bütün öğrenciler" ise tek tıkla açılmalı.
      */}
      {!merkezMi && ilKodu && (
        <p className="text-sm text-metin-yumusak">
          İlin tamamı:{" "}
          <Link
            href="/panel/ogrenciler"
            className="font-medium text-vurgu-metin underline underline-offset-2"
          >
            öğrenciler
          </Link>{" "}
          ·{" "}
          <Link
            href="/panel/ogretmenler"
            className="font-medium text-vurgu-metin underline underline-offset-2"
          >
            öğretmenler
          </Link>
        </p>
      )}
    </div>
  );
}
