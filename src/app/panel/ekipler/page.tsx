import { MessageSquare, Users, UsersRound } from "lucide-react";
import Link from "next/link";
import {
  BilgiKutusu,
  Kart,
  KartBasligi,
  KirintiYolu,
  SayfaBasligi,
  SINIF_BIRINCIL_BUTON,
  SINIF_GIRDI,
} from "@/components/ui";
import { EkipEnvanteri } from "@/components/EkipEnvanteri";
import { IlKisiListesi } from "@/components/IlKisiListesi";
import { oturumKullanicisiZorunlu } from "@/lib/auth/oturum";
import { prisma } from "@/lib/db";
import {
  EKIP_FORM_TURLERI,
  EKIP_TURU_ETIKETLERI,
  EKIPLER_KAPALI_ACIKLAMASI,
  ekiplerKapaliMi,
  ekipYonetebilirMi,
} from "@/lib/ekip/kurallar";
import { redirect } from "next/navigation";
import { ekipleriGetir } from "@/lib/ekip/veri";
import { koordinatorIlKodu, projeYoneticisiMi } from "@/lib/yetki/izinler";
import type { SorguParametreleri } from "../ogrenciler/filtreler";
import { ekibeUyeEkleEylemi, ekipKurEylemi } from "./eylemler";

export const dynamic = "force-dynamic";

/**
 * Ekip kurma formunun `id`si.
 *
 * Sayfanın ALTINDAKİ kişi listesindeki kutucuklar buraya bağlanıyor: HTML'in
 * `form` özniteliği, bir denetimi DOM'da uzakta duran bir forma bağlıyor
 * (aynı numara sütun süzgeçlerinde de kullanılıyor).
 */
const KUR_FORMU = "ekip-kur";

/**
 * EKİPLERİM (13 Ağustos 2026).
 *
 * İSTEK: "il koordinatörü ekipler kurabilsin, ekip ismini kendileri girsin,
 * ekiplere katılanlarla mesajlaşma sohbet yapabilsin, bunu da yönetim paneline
 * kart olarak ekleyelim, ismi ekiplerim olsun" · "bir koordinatör pek çok ekip
 * kurabilsin kurmak isterse, hepsi birbirinden ayrı".
 *
 * EKRAN İKİ KİTLEYE BİRDEN AÇIK ve tek liste basıyor:
 *   · koordinatör/merkez — kurduğu ve yönettiği ekipler, kurma formuyla,
 *   · üye (öğrenci, öğretmen, mezun…) — üyesi olduğu ekipler, formsuz.
 *
 * Ayrı iki ekran yapılsaydı koordinatörün kendi üyesi olduğu ekip iki yerde
 * birden görünürdü; ekip listesi ikisinde de aynı liste.
 *
 * HER EKİP BİRBİRİNDEN AYRI: kendi adı, kendi üye listesi, kendi sohbeti.
 * Sayı sınırı yok — koordinatör kaç ekip isterse kurar.
 */

const DURUM_MESAJLARI: Record<string, string> = {
  "ekip-kapatildi":
    "Ekip kapatıldı. Sohbet ve üye listesi kayıtta duruyor, yeni mesaj yazılamaz.",
};

export default async function EkiplerSayfasi({
  searchParams,
}: {
  /*
   * Süzgeç parametreleri de buraya geliyor (26 Ağustos 2026): ekip envanteri
   * bu sayfada basıldığı için arama, tür ve sayfa değerleri artık bu adresin
   * sorgu dizesinde taşınıyor (bkz. EkipEnvanteri · `yol`).
   */
  searchParams: Promise<SorguParametreleri & { durum?: string; hata?: string }>;
}) {
  const kullanici = await oturumKullanicisiZorunlu();
  // Ekipler il koordinatörüne kapalı (23 Ekim 2026 · bkz. ekiplerKapaliMi).
  if (ekiplerKapaliMi(kullanici)) {
    redirect(`/panel?hata=${encodeURIComponent(EKIPLER_KAPALI_ACIKLAMASI)}`);
  }
  const parametreler = await searchParams;
  const { durum, hata } = parametreler;

  const yonetebilir = ekipYonetebilirMi(kullanici);
  const merkezMi = projeYoneticisiMi(kullanici);

  /*
   * OKUL VE DANIŞMAN SEÇİMİ FORMDAN KALKTI (31 Ağustos 2026 · istekler: "okul
   * seçimi kapanacak Okul" · "Danışman öğretmen (isteğe bağlı, sonradan
   * atanabilir) bunu da kaldırdık").
   *
   * İKİ SORGU DA SİLİNDİ, GİZLENMEDİ: alanları ekranda saklayıp veriyi
   * çekmeye devam etmek, her açılışta ödenen iki gereksiz sorgu olurdu.
   * Formun sorduğu şey artık ekibin ADI, açıklaması ve türü — kimlerin
   * ekibe gireceği aşağıdaki kişi listesinden ve ekibin kendi sayfasındaki
   * "Üye ekle" süzgecinden görülüyor.
   *
   * İL LİSTESİ YALNIZCA MERKEZE gerekiyor ve duruyor: koordinatörün ekibi
   * kendi iline bağlanır ve ona seçim sorulmaz (bkz. eylemler.ts). Merkezin
   * ili olmadığı için ekibin ilini seçmek zorunda.
   */
  const koordinatorIli = merkezMi ? null : koordinatorIlKodu(kullanici);

  const [ekipler, iller, koordinatorIliKaydi] = await Promise.all([
    ekipleriGetir(kullanici),
    merkezMi
      ? prisma.il.findMany({
          orderBy: { ad: "asc" },
          select: { ilKodu: true, ad: true },
        })
      : [],
    /*
     * İLİN ADI: kişi listesinin başlığında yazıyor ("Manisa kişi listesi").
     * Koordinatöre ili PLAKA KODUYLA söylememek bu panelde 26 Ağustos'ta
     * verilmiş bir karar; başlıkta "34" yazsaydı aynı hataya dönülürdü.
     */
    koordinatorIli
      ? prisma.il.findUnique({
          where: { ilKodu: koordinatorIli },
          select: { ad: true },
        })
      : null,
  ]);

  const acikEkipler = ekipler.filter((ekip) => ekip.aktif);
  const kapaliEkipler = ekipler.filter((ekip) => !ekip.aktif);

  return (
    <div className="space-y-6">
      {/*
        KIRINTI YOLU (29 Ağustos 2026 · istekler: "navigasyon bunu göstersin
        yönetim paneli / rol envanteri şeklinde" · "yönetim panelindeki tüm
        kartlara uygula").

        Yerinde tek başına "← Yönetim Paneli" bağlantısı vardı: dönülecek
        yeri söylüyor, bulunulan yeri söylemiyordu. Şerit ikisini birden
        basıyor ve panodan açılan HER ekranda aynı biçimde duruyor.

        SON BASAMAK BAĞLANTI DEĞİL (bkz. components/ui.tsx · KirintiYolu);
        SayfaBasligi'nın geri bağlantısı bu yüzden `null` — ikisi bir arada
        aynı yolu üst üste iki kez basardı.
      */}
      <KirintiYolu
        basamaklar={[
          { etiket: "Yönetim Paneli", yol: "/panel/yonetim" },
          { etiket: "Ekiplerim" },
        ]}
      />

      <SayfaBasligi
        geri={null}
        baslik="Ekiplerim"
        aciklama={
          yonetebilir
            ? "İlinizde ekipler kurun, üyelerini seçin ve ekip sohbetinden yazışın."
            : "Eklendiğiniz ekipler ve ekip sohbetleri."
        }
      />

      {durum && DURUM_MESAJLARI[durum] && (
        <BilgiKutusu cesit="olumlu">{DURUM_MESAJLARI[durum]}</BilgiKutusu>
      )}
      {hata && <BilgiKutusu cesit="hata">{hata}</BilgiKutusu>}

      {/*
        SOHBET UYARISI BU EKRANDAN KALKTI (26 Ağustos 2026 · istek: "bunu sil:
        Ekip sohbeti gizli değildir…").

        Burası ekiplerin LİSTESİ; sohbet burada değil, ekibin kendi sayfasında.
        Uyarı, yazma kutusunun bulunmadığı bir ekranda her açılışta okunan
        kalıcı bir şerit hâline gelmişti. Metnin kendisi (`EKIP_SOHBET_UYARISI`)
        duruyor ve ekip sayfasında da aynı istekle kaldırıldı — gözetim
        kuralının kendisi değişmedi, yalnızca ekrandaki tekrarı kalktı.
      */}

      {/*
        İLİN BÜTÜN EKİPLERİ, KENDİ EKİPLERİMİN ÜSTÜNDE (26 Ağustos 2026 · istek:
        "ekip yönetimindeki liste ekiplerime gelecek").

        Envanter ayrı bir ekrandı ve Yönetim Paneli'nde kartı vardı; ikisi de
        aynı gün kalktı. 15 Ağustos'ta ayrı tutulma gerekçesi "koordinatör kendi
        ekibini yüzlerce kaydın içinde aramamalı" idi ve o gerekçe KORUNUYOR:
        liste karışmadı, iki ayrı kart olarak alt alta duruyor — üstte ilin
        tamamı (süzgeçli, sayfalı), altta kişinin kendi ekipleri.

        SIRA: envanter önce, çünkü ekip yönetmeye gelen kişinin ilk sorusu "şu
        ekip nerede" ve kendi ekipleri o listenin de içinde. Kendi ekipleri
        altta, sohbet ve kurma formuyla birlikte duruyor.

        YALNIZCA YÖNETENLERE: bu sayfayı ekibe eklenmiş her kullanıcı açabiliyor,
        envanteri ise yalnızca il koordinatörü ve merkez görebilir
        (bkz. ekipYonetebilirMi). Kapı burada soruluyor — bileşen sormuyor.
      */}
      {yonetebilir && (
        <EkipEnvanteri
          kullanici={kullanici}
          parametreler={parametreler}
          yol="/panel/ekipler"
        />
      )}

      {/*
        "EKİPLERİM" KARTI YALNIZCA YÖNETMEYENLERE (26 Ağustos 2026 · istek:
        "Ekipler … Ekiplerim … İstanbul ekiplerimi kaldır").

        Aynı gün ilin bütün ekipleri bu sayfaya inince koordinatörün ekranında
        aynı ekip İKİ KEZ görünmeye başladı: üstteki envanterde bir satır,
        altta bir kart. Envanter zaten kendi ekiplerini de içeriyor (ilin
        tamamı) ve daha fazlasını gösteriyor — tür, danışman, üye ve mesaj
        sayısı.

        KART SİLİNMEDİ, KOŞULA BAĞLANDI: envanteri göremeyen kullanıcı için
        (ekibe eklenmiş öğrenci ya da öğretmen) bu kart ekiplerine giden TEK
        yol. Silinseydi onlar ekiplerini hiç göremezdi.

        "Kapatılan ekipler" kartı AŞAĞIDA HERKESTE duruyor: envanter varsayılan
        olarak yalnızca açık ekipleri listeliyor, yani orada ikizi yok.
      */}
      {!yonetebilir && (
      <Kart>
          {/*
            BAŞLIK "AÇIK EKİPLER" DEĞİL "EKİPLERİM" (26 Ağustos 2026 · istekler:
            "ekiplerimde Açık ekipler bunu kaldır" → "Açık ekipler bu ekiplerim
            olsun").
  
            Önce tamamen kaldırılmıştı; sayfanın başlığı zaten "Ekiplerim" olduğu
            için kart başlığı gereksiz görünüyordu. Aynı gün ilin BÜTÜN ekiplerini
            gösteren envanter bu sayfanın üstüne gelince durum değişti: iki liste
            alt alta durunca hangisinin kimin olduğunu söyleyen bir başlık gerekli
            oldu. "Açık" ayrımını yapmıyor çünkü onu alttaki "Kapatılan ekipler"
            kartı zaten söylüyor.
          */}
          <KartBasligi
            baslik="Ekiplerim"
            aciklama={`${acikEkipler.length} ekip`}
            Ikon={UsersRound}
          />
          {acikEkipler.length === 0 ? (
            <p className="text-metin-yumusak">
              {yonetebilir
                ? "Henüz ekip kurmadınız. Aşağıdaki formdan ilkini kurabilirsiniz."
                : "Henüz bir ekibe eklenmediniz. İl koordinatörünüz sizi eklediğinde burada görünür."}
            </p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {acikEkipler.map((ekip) => (
                <li key={ekip.id}>
                  {/*
                    KART TIKLANABİLİR: ekibin kendisi bir sohbet ekranıdır ve
                    listedeki satırın işi oraya götürmek. Ayrı bir "aç" düğmesi,
                    aynı işi iki tıklamaya bölerdi.
                  */}
                  <Link
                    href={`/panel/ekipler/${ekip.id}`}
                    className="flex h-full flex-col rounded-kart border border-cizgi bg-kart p-4 shadow-kart transition hover:border-vurgu hover:shadow-yuksek"
                  >
                    <span className="font-semibold text-baslik">{ekip.ad}</span>
                    {ekip.aciklama && (
                      <span className="mt-1 line-clamp-2 text-sm text-metin-yumusak">
                        {ekip.aciklama}
                      </span>
                    )}
                    <span className="mt-3 flex flex-wrap items-center gap-3 text-sm text-metin-yumusak">
                      <span className="inline-flex items-center gap-1">
                        <Users size={14} aria-hidden />
                        {ekip.uyeSayisi} üye
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MessageSquare size={14} aria-hidden />
                        {ekip.mesajSayisi} mesaj
                      </span>
                      <span>{ekip.ilAdi}</span>
                      {ekip.uyesiyimMi && (
                        <span className="rounded-full bg-olumlu-zemin px-2 py-0.5 text-xs font-semibold text-olumlu-metin">
                          Üyesiniz
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Kart>
      )}

      {yonetebilir && (
        <Kart>
          {/*
            AÇIKLAMA SATIRI KALKTI (26 Ağustos 2026 · istek: "bunu sil: Ekibin
            adını siz koyarsınız…"). Cümle formun kendisinin söylediğini
            anlatıyordu: altındaki ilk alanın adı zaten "Ekip adı".
          */}
          <KartBasligi baslik="Yeni ekip kur" Ikon={UsersRound} />
          {/*
            FORMA `id` VERİLDİ (31 Ağustos 2026 · istek: "ekibi oluşturduktan
            sonra geliyor, ben ekibi oluştururken eklemek istiyorum"): aşağıdaki
            kişi listesindeki kutucuklar `form="ekip-kur"` ile bu forma
            bağlanıyor ve "Ekibi kur" düğmesiyle birlikte gönderiliyor
            (bkz. components/IlKisiListesi.tsx · secimFormu).
          */}
          <form action={ekipKurEylemi} id={KUR_FORMU} className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-metin">Ekip adı</span>
              <input
                type="text"
                name="ad"
                required
                maxLength={150}
                placeholder="Örn. TEKNOFEST Hazırlık Ekibi"
                className={SINIF_GIRDI}
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-metin">
                Açıklama{" "}
                <span className="font-normal text-metin-yumusak">
                  (isteğe bağlı)
                </span>
              </span>
              <textarea
                name="aciklama"
                rows={2}
                maxLength={500}
                placeholder="Ekibin ne için kurulduğunu bir iki cümleyle yazın."
                className={SINIF_GIRDI}
              />
            </label>

            {merkezMi ? (
              <label className="block sm:w-72">
                <span className="text-sm font-medium text-metin">
                  Ekibin ili
                </span>
                <select name="ilKodu" required className={SINIF_GIRDI}>
                  <option value="">Seçin</option>
                  {iller.map((il) => (
                    <option key={il.ilKodu} value={il.ilKodu}>
                      {il.ad}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              /*
                "Ekip, il kodunuz 34 olan ilinize bağlanır" SATIRI KALKTI
                (26 Ağustos 2026 · istek: "bunu sil"). İki kusuru vardı:
                koordinatöre ilini PLAKA KODUYLA söylüyordu (aynı gün her yerde
                düzeltilen hata) ve söylediği şey zaten kaçınılmaz — koordinatör
                tek ilin sorumlusu, ekibi başka bir ile bağlayamaz. Kural
                yerinde: il, merkez dışındaki kullanıcı için sunucuda
                sabitleniyor (bkz. eylemler.ts · ekipKurEylemi).
              */
              null
            )}

            {/*
              EKİP TÜRÜ (15 Ağustos 2026 · Aşama 5; liste 31 Ağustos 2026'da
              kısaldı).

              OKUL TAKIMI BU FORMDAN SEÇİLEMİYOR: okul seçimi aynı gün kalktı
              (aşağıdaki nota bakın) ve okulu olmayan bir okul takımı ne
              veritabanı kısıtından (`ck_ekip_okul_takimi_kurum`) ne kural
              katmanından geçer. Liste `EKIP_FORM_TURLERI`den geliyor; enum,
              etiketler ve kurulmuş okul takımları olduğu gibi duruyor.
            */}
            <label className="block sm:w-72">
              <span className="text-sm font-medium text-metin">Ekip türü</span>
              <select name="tur" defaultValue="CALISMA_GRUBU" className={SINIF_GIRDI}>
                {EKIP_FORM_TURLERI.map((tur) => (
                  <option key={tur} value={tur}>
                    {EKIP_TURU_ETIKETLERI[tur]}
                  </option>
                ))}
              </select>
            </label>

            {/*
              OKUL SEÇİMİ KALDIRILDI (31 Ağustos 2026 · istek: "okul seçimi
              kapanacak Okul").

              SONUCU: bu formdan OKUL TAKIMI kurulamıyor ve tür listesinden de
              çıkarıldı (bkz. lib/ekip/kurallar.ts · EKIP_FORM_TURLERI). Alan
              gizlenip tür listede bırakılsaydı, Okul Takımı seçen kişi
              "Okul takımı için okul seçilmesi zorunludur" hatasını alır ve
              seçemeyeceği bir alanın eksikliğinden şikâyet edilirdi.

              KURAL VE VERİTABANI KISITI YERİNDE (`ck_ekip_okul_takimi_kurum`,
              `ekipKapsaminiCoz`): kurulmuş okul takımları listelerde,
              süzgeçlerde ve raporlarda aynen duruyor.

              DANIŞMAN ÖĞRETMEN SEÇİMİ DE KALDIRILDI (aynı gün · istek:
              "Danışman öğretmen (isteğe bağlı, sonradan atanabilir) bunu da
              kaldırdık"). Alan zaten isteğe bağlıydı; `danisman_kullanici_id`
              sütunu ve "danışmansız ekipler" süzgeci yerinde duruyor —
              değişen, ekibi kurarken sorulan soru.
            */}

            {/*
              DÜĞMENİN ALTINDAKİ CÜMLE: kutucuklar ekranın AŞAĞISINDA, formun
              görsel sınırının dışında duruyor. "Ekibi kur"a basan kişi orada
              işaretlediklerinin de gideceğini bilmezse, kutucukları boşuna
              işaretlemiş sanır.
            */}
            <button type="submit" className={SINIF_BIRINCIL_BUTON}>
              <UsersRound size={16} aria-hidden />
              Ekibi kur
            </button>
            <p className="text-sm text-metin-yumusak">
              Aşağıdaki kişi listesinden işaretlediğiniz kişiler ekiple birlikte
              eklenir ve kendilerine bildirim gider.
            </p>
          </form>
        </Kart>
      )}

      {/*
        İLİN KİŞİ LİSTESİ (31 Ağustos 2026 · istek: "Burada liste çıksın
        ilindeki öğretmen listesi, öğrenci listesi … bu alandaki listenin
        filtreleri … görsel gibi olsun").

        NİYE BU EKRANDA: aynı gün formdan okul ve danışman seçimi kalktı, yani
        ekibi kuran kişi artık kimseyi bir açılır listeden seçmiyor. Kimlerle
        çalışacağını görmesi gereken yer ekibi kurduğu ekran ve listenin
        sorusu tam olarak bu: "ilimde kim var, hangi görevde, nasıl ulaşırım".

        FORMUN ALTINDA: kart sırası işin sırasını izliyor — ekip envanteri
        (hangi ekipler var), ekip kurma formu, sonra kişiler. Üste konsaydı
        elli satırlık bir tablo, kurma formunu ekranın dışına iterdi.

        YALNIZCA YÖNETENLERE ve kapı burada soruluyor (bileşen sormuyor): bu
        sayfayı ekibe eklenmiş her kullanıcı açabiliyor, ilin kişi listesi ise
        iletişim bilgisi taşıyor ve envanter yetkisi olmayan bir öğrenciye
        açılamaz.

        KAPSAM ÇAĞIRANDAN: koordinatörde kendi ili, merkezde ülke geneli
        (`ilKodu = null`). Merkezin ili yok ve listeyi ona kapatmak, aynı
        soruyu ülke ölçeğinde soramaması demekti — liste zaten sayfalı ve
        süzgeçli.
      */}
      {yonetebilir && (
        <IlKisiListesi
          kullanici={kullanici}
          parametreler={parametreler}
          yol="/panel/ekipler"
          ilKodu={koordinatorIli}
          ilAdi={koordinatorIliKaydi?.ad ?? null}
          /*
            EKİBE EKLEME SÜTUNU (31 Ağustos 2026 · istek: "öğrenci listesi
            geliyor altta ama kişi ekleme yok, ekip için öğrenci nasıl
            seçecek").

            AÇIK EKİPLER VERİLİYOR, hepsi değil: kapatılmış ekip bir arşivdir
            ve sunucu eylemi de ona üye eklemiyor — listede görünseydi
            seçilebilen ama her seferinde hata veren bir seçenek olurdu.

            EKLEDİKTEN SONRA EKİBİN SAYFASINA GİDİLİYOR (eylemin kendi
            yönlendirmesi): kişi oraya düşünce üye listesini ve sohbeti bir
            arada görüyor, "eklendi mi" diye listeye bakmak gerekmiyor.

            SÜTUN MERKEZDE BASILMIYOR: merkezin ekip listesi ülke genelidir ve
            her satıra yüzlerce seçenekli bir açılır liste koymak, ekranı da
            sayfayı da kullanılmaz kılardı. Üstelik üye, ekibin İLİNDEN olmak
            zorunda (eylem bunu sunucuda soruyor) — merkezin doğru yolu ekibin
            kendi sayfasındaki "Üye ekle" süzgeci, çünkü orada ekip zaten
            seçilmiş durumda.
          */
          ekipler={
            koordinatorIli
              ? acikEkipler.map((ekip) => ({ id: ekip.id, ad: ekip.ad }))
              : []
          }
          ekleEylemi={ekibeUyeEkleEylemi}
          /*
            "YENİ EKİBE" KUTUCUK SÜTUNU: formun `id`si veriliyor, kutucuklar
            HTML'in `form` özniteliğiyle ona bağlanıyor.

            MERKEZDE BASILMIYOR (ekleme sütunuyla aynı gerekçe): merkezin
            listesi ülke geneli ama üye, ekibin İLİNDEN olmak zorunda —
            işaretlenen kişilerin çoğu sunucuda sessizce elenirdi ve kullanıcı
            "neden eklenmedi" sorusunun cevabını hiçbir yerde bulamazdı.
          */
          secimFormu={koordinatorIli ? KUR_FORMU : null}
          /*
            SÜTUN YOKSA SEBEBİ YAZILIYOR (31 Ağustos 2026 · istek: "hâlâ ekip
            nasıl öğrenci seçeceğini göremiyorum"): ekleme sütunu açık ekip
            yoksa gizleniyor ve gizlenirken hiçbir şey söylemiyordu.
          */
          eklemeNotu={
            koordinatorIli
              ? "Kurulu bir ekibe eklemek için önce yukarıdan ekibi kurun; kurarken de aşağıdaki kutucuklardan kişi seçebilirsiniz."
              : "Merkezde üyeler ekibin kendi sayfasındaki “Üye ekle” süzgecinden eklenir: üye, ekibin iliyle aynı ilde olmak zorunda."
          }
        />
      )}

      {/*
        KAPALI EKİPLER AYRI BÖLÜMDE, gizlenmiyor: kapatılan ekibin sohbeti bir
        kayıttır ve "ekibim kayboldu" durumu, kapatmayı geri alınamaz bir
        silmeye çevirirdi.
      */}
      {kapaliEkipler.length > 0 && (
        <Kart>
          <KartBasligi
            baslik="Kapatılmış ekipler"
            aciklama={`${kapaliEkipler.length} ekip · sohbet okunur, yeni mesaj yazılamaz`}
          />
          <ul className="divide-y divide-cizgi">
            {kapaliEkipler.map((ekip) => (
              <li key={ekip.id} className="py-2.5">
                <Link
                  href={`/panel/ekipler/${ekip.id}`}
                  className="font-medium text-metin transition hover:text-vurgu-metin hover:underline"
                >
                  {ekip.ad}
                </Link>
                <span className="ml-2 text-sm text-metin-yumusak">
                  {ekip.ilAdi} · {ekip.uyeSayisi} üye · {ekip.mesajSayisi} mesaj
                </span>
              </li>
            ))}
          </ul>
        </Kart>
      )}
    </div>
  );
}
