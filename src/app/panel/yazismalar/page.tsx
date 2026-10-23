import {
  BadgeCheck,
  MessageSquare,
  MessagesSquare,
  School,
  Send,
  Users,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BAGLANTILARIM_KAPALI_ACIKLAMASI,
  baglantilarimKapaliMi,
} from "@/lib/yazisma/politika";
import {
  BilgiKutusu,
  Kart,
  KartBasligi,
  SayfaBasligi,
  SINIF_GIRDI,
} from "@/components/ui";
import { oturumKullanicisiZorunlu } from "@/lib/auth/oturum";
import { prisma } from "@/lib/db";
import { ekipleriGetir } from "@/lib/ekip/veri";
import { basHarfler } from "@/lib/kullanici/profil-foto-kurallar";
import { tarihSaatYaz } from "@/lib/tarih";
import {
  danismanMi,
  ilKoordinatoruMu,
  projeYoneticisiMi,
} from "@/lib/yetki/izinler";
import { yazismaKapsamFiltresi } from "@/lib/yetki/kapsam";
import { dogrudanYazismaAcEylemi } from "./baglanti-eylemleri";

export const dynamic = "force-dynamic";

/**
 * Bağlantılarım — tek ekran (12 Ağustos 2026 · istek: "yazışmalar ve
 * bağlantılar isminde iki bölüm var, onları birleştirip linkedin tarzı bir
 * bölüm yapmak istiyorum", "menüdeki bağlantılarım alanında olsun").
 *
 * ESKİDEN İKİ EKRANDI ve ikisi de "bağlantı" diyordu:
 *   - `/panel/yazismalar` → onaylanmış bağlantıların mesaj listesi,
 *   - `/panel/baglantilar` → bekleyen bağlantı isteklerinin onay ekranı.
 * Menüde tek giriş ("Bağlantılarım") vardı, ikincisine oradan bir kart
 * üzerinden geçiliyordu. Artık ikisi de burada: LinkedIn'in "Ağım" ekranı gibi
 * ÖNCE davetler, SONRA bağlantılar. `/panel/baglantilar` silinmedi, buraya
 * yönlendiriyor (yer imleri ve bildirim e-postalarındaki adresler için).
 *
 * ROL AYRIMI KORUNDU, YETKİ GENİŞLEMEDİ: onay bölümü yalnızca karar verebilene
 * basılır (danışman / il koordinatörü / proje yöneticisi) ve her iki liste de
 * kendi merkezi kapsam filtresinden geçer. Öğrenci bu sayfada yalnızca kendi
 * bağlantılarını görür — birleştirme, onun ekranına yeni hiçbir şey eklemez.
 *
 * "Taraf mıyım" ayrımı burada YAPILIR ama gözetimi gizlemez: taraf olduğu
 * satırda karşı taraf tek isimle, gözetim satırında çift isimle yazılır
 * (bkz. `tarafMi`). Danışman "kimin konuşması" bilgisini kaybetmemeli.
 *
 * GÖRÜNÜM (12 Ağustos · "pek linkedin gibi de olmamış çok basit"): liste artık
 * KART İÇİNDE KUTU değil, tek kartın içinde ayırıcı çizgiyle bölünmüş satırlar
 * — LinkedIn'in bağlantı listesi böyle. Avatar büyütüldü, eylemler hap biçimli
 * düğme oldu, davet satırında düğmeler sağa alındı (form artık satırın önünü
 * kapatmıyor) ve listeye süzgeç şeridi eklendi.
 */

/*
 * İLETİLER SADELEŞTİ (21 Ağustos 2026): bağlantı isteği ve akış kalkınca
 * onların iletileri de kalktı. Geriye, bu ekranda gerçekten olabilecek tek
 * olay kaldı — mesajın gizlenmesi.
 */
const DURUM_MESAJLARI: Record<string, string> = {
  gizlendi: "İçerik kaldırıldı. Silinmedi; yetkililer görmeye devam eder.",
};


/** Hap biçimli eylem düğmeleri — LinkedIn'in satır sonu düğmeleri gibi. */
const SINIF_HAP_VURGU =
  "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-vurgu px-4 py-1.5 text-sm font-semibold text-vurgu-metin transition group-hover:bg-vurgu-zemin";

const SINIF_HAP_OLUMLU =
  "inline-flex items-center gap-1.5 rounded-full bg-olumlu-zemin px-4 py-2 text-sm font-semibold text-olumlu-metin transition hover:opacity-90";

const SINIF_HAP_HATA =
  "inline-flex items-center gap-1.5 rounded-full border border-cizgi px-4 py-2 text-sm font-medium text-metin transition hover:border-hata-cizgi hover:bg-hata-zemin hover:text-hata-metin";

/**
 * Baş harf çemberi — stil `mentorluk/page.tsx`'teki mentör kimliğiyle aynı,
 * yeni bir tasarım dili çıkmasın diye. Profil fotoğrafı BİLEREK kapsam dışı:
 * fotoğrafı servis eden route yalnızca onaylı mentör ve kişinin kendisi için
 * var; bağlantı listesine fotoğraf koymak "kim kimin fotoğrafını görebilir"
 * kararını gerektirir ve o ayrı bir iştir.
 */
function BasHarfCemberi({ ad, soyad }: { ad: string; soyad: string }) {
  return (
    <span
      aria-hidden
      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-vurgu-zemin text-lg font-semibold text-vurgu-metin"
    >
      {basHarfler(ad, soyad)}
    </span>
  );
}

/**
 * Gözetim satırının çemberi. Baş harf BASILMAZ: satır iki kişiyi birden
 * gösteriyor, tek kişinin baş harfini basmak "bu senin bağlantın" izlenimi
 * verirdi. Nötr çember + `Users` ikonu, satırın gözetim olduğunu avatardan
 * itibaren söyler.
 */
function GozetimCemberi() {
  return (
    <span
      aria-hidden
      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-cizgi bg-zemin text-metin-yumusak"
    >
      <Users size={22} />
    </span>
  );
}

/** "11-A · Atatürk Anadolu Lisesi" — boş alanlar atlanır, ayraç kalmaz. */
function altBasligiYaz(parcalar: (string | null | undefined)[]): string {
  return parcalar.filter((parca) => parca && parca.trim()).join(" · ");
}

const SUZGECLER = ["tumu", "benim", "gozetim"] as const;
type Suzgec = (typeof SUZGECLER)[number];

export default async function BaglantilarimSayfasi({
  searchParams,
}: {
  searchParams: Promise<{
    durum?: string;
    hata?: string;
    suzgec?: string;
    kisi?: string;
  }>;
}) {
  const kullanici = await oturumKullanicisiZorunlu();
  // Bağlantılarım öğrenciye kapalı (23 Ekim 2026 · bkz. lib/yazisma/politika.ts).
  if (baglantilarimKapaliMi(kullanici)) {
    redirect(`/panel?hata=${encodeURIComponent(BAGLANTILARIM_KAPALI_ACIKLAMASI)}`);
  }
  const { durum, hata, suzgec, kisi } = await searchParams;
  const kisiAramasi = (kisi ?? "").trim();

  const secili: Suzgec = SUZGECLER.includes(suzgec as Suzgec)
    ? (suzgec as Suzgec)
    : "tumu";

  const onayVerebilir =
    danismanMi(kullanici) ||
    ilKoordinatoruMu(kullanici) ||
    projeYoneticisiMi(kullanici);

  /*
   * İki liste TEK TURDA çekilir. İstek listesi yalnızca karar verebilen için
   * sorgulanır: onay yetkisi olmayanda `baglantiKarariFiltresi` zaten boş küme
   * döndürüyor, o sorguyu hiç açmamak bir gidiş dönüş kazandırır.
   */
  /*
   * OKUL İÇİ VE OKUL TEMSİLCİSİ LİSTELERİ (21 Ağustos 2026 · istek:
   * "Bağlantılarım kısmı değişecek, kendi okulundaki herkesi görecek mesaj
   * atacak, okul temsilcilerinin hepsini görecek mesaj atabilecek").
   *
   * İki liste de ONAY KAPISININ DIŞINDA kalan kümedir; kimin girdiğine kural
   * katmanı karar veriyor (lib/iletisim/kurallar.ts · dogrudanYazisilabilirMi)
   * ve eylem aynı kuralı yeniden soruyor — ekranda görünmek yetki değildir.
   *
   * ELLİ SATIRLA SINIRLI ve arama kutusu var: kalabalık bir okulda liste
   * yüzlerce satır olurdu ve kimse yüz satırı taramaz.
   */
  const KISI_SINIRI = 50;
  const kisiSecimi = {
    id: true,
    ad: true,
    soyad: true,
    sinif: true,
    brans: true,
    kurum: { select: { ad: true } },
  } as const;
  const aramaKosulu = kisiAramasi
    ? {
        OR: [
          { ad: { contains: kisiAramasi, mode: "insensitive" as const } },
          { soyad: { contains: kisiAramasi, mode: "insensitive" as const } },
        ],
      }
    : {};

  /*
   * EKİPLER DE BU EKRANDA (31 Ağustos 2026 · istek: "Bağlantılarımda il
   * koordinatörleri ekiplerini görebilsin, orada ekip listesi olacak ve
   * tıklanabilir olsun").
   *
   * LİSTE `ekipleriGetir` ile geliyor, yeni bir sorgu yazılmadı: aynı
   * fonksiyon Ekiplerim ekranını da besliyor ve kimin hangi ekibi göreceği
   * kararı orada (üye + ilin koordinatörü + merkez). Burada ikinci bir sorgu
   * yazılsaydı, kapsam kuralının iki kopyası olurdu.
   *
   * KAPALI EKİPLER BURADA YOK: bu ekranın sorusu "kiminle konuşabilirim" ve
   * arşive dönmüş ekibe yeni mesaj yazılamıyor. Arşiv, Ekiplerim ekranında
   * kendi bölümünde duruyor.
   */
  const [yazismalar, okumalar, okuldakiler, temsilciler, tumEkipler] =
    await Promise.all([
    prisma.yazisma.findMany({
      where: yazismaKapsamFiltresi(kullanici),
      orderBy: { olusturmaTarihi: "desc" },
      take: 100,
      select: {
        baglantiIstegiId: true,
        kapatildiMi: true,
        olusturmaTarihi: true,
        baglantiIstegi: {
          select: {
            isteyenKullaniciId: true,
            hedefKullaniciId: true,
            isteyen: {
              select: {
                ad: true,
                soyad: true,
                sinif: true,
                brans: true,
                kurum: { select: { ad: true } },
              },
            },
            hedef: {
              select: {
                ad: true,
                soyad: true,
                sinif: true,
                brans: true,
                kurum: { select: { ad: true } },
              },
            },
            talep: { select: { baslik: true } },
          },
        },
        _count: { select: { mesajlar: true } },
        /*
         * SON MESAJ, okunmamış işareti ve sıralama için (26 Ağustos 2026).
         * Gizlenmiş mesaj sayılmıyor: moderasyonun kaldırdığı bir metin için
         * "yeni mesaj var" demek, okumaya gidip hiçbir şey bulamamak olurdu.
         */
        mesajlar: {
          where: { gizlendiMi: false },
          orderBy: { olusturmaTarihi: "desc" },
          take: 1,
          select: { yazanKullaniciId: true, olusturmaTarihi: true },
        },
      },
    }),
    /*
     * Kişinin okuma işaretleri. Yazışma başına tek satır ve yalnızca AÇILMIŞ
     * yazışmalar için var; satırı olmayan yazışmada gelen her mesaj
     * okunmamıştır (bkz. model YazismaOkuma).
     */
    prisma.yazismaOkuma.findMany({
      where: { kullaniciId: kullanici.id },
      select: { yazismaId: true, sonOkumaTarihi: true },
    }),
    /*
     * Kendi okulundan kişiler. `kurumKodu` yoksa (mezun, paydaş) sorgu hiç
     * açılmıyor: okulsuz kişinin "okulundaki herkes" kümesi boştur ve
     * `kurumKodu: null` ile sorulsaydı bütün okulsuz kullanıcılar birbirinin
     * okul arkadaşı sayılırdı.
     */
    kullanici.kurumKodu === null
      ? Promise.resolve([])
      : prisma.kullanici.findMany({
          where: {
            AND: [
              { aktif: true, kurumKodu: kullanici.kurumKodu },
              { id: { not: kullanici.id } },
              aramaKosulu,
            ],
          },
          orderBy: [{ ad: "asc" }, { soyad: "asc" }],
          take: KISI_SINIRI,
          select: kisiSecimi,
        }),
    /*
     * Okul temsilcileri — ülke genelinde ve YÜRÜRLÜKTEKİ DÖNEMDE görevli
     * olanlar. Geçen yılın temsilcisi bugün o görevde değil; listeye girmesi
     * "bana ulaşabilirsin" demek olurdu.
     */
    prisma.kullanici.findMany({
      where: {
        AND: [
          { aktif: true },
          { id: { not: kullanici.id } },
          {
            gorevRolleri: {
              some: {
                rolKodu: "OKUL_TEMSILCISI",
                egitimOgretimYili: kullanici.egitimOgretimYili,
              },
            },
          },
          aramaKosulu,
        ],
      },
      orderBy: [{ ad: "asc" }, { soyad: "asc" }],
      take: KISI_SINIRI,
      select: kisiSecimi,
    }),
    ekipleriGetir(kullanici),
  ]);

  /*
   * Satırlar önce ZENGİNLEŞTİRİLİR, sonra süzülür. Süzgeç şeridi "0 sonuç"
   * gösterebilmeli ve sayıları başlıkta yazabilmeli; bunun için her iki kümenin
   * de sayısı lazım, dolayısıyla süzme sorguda değil burada yapılır (liste
   * zaten `take: 100`).
   */
  const sonOkumalar = new Map(
    okumalar.map((okuma) => [okuma.yazismaId, okuma.sonOkumaTarihi]),
  );

  const satirlar = yazismalar.map((yazisma) => {
    const { isteyen, hedef, talep } = yazisma.baglantiIstegi;
    const bendenMi = yazisma.baglantiIstegi.isteyenKullaniciId === kullanici.id;
    const tarafMi =
      bendenMi || yazisma.baglantiIstegi.hedefKullaniciId === kullanici.id;

    /*
     * TARAF OLUNAN SATIR KARŞI TARAFI GÖSTERİR, ÇİFTİ DEĞİL: LinkedIn kartı
     * "sen ↔ o" demez. Kendi adını her satırda okumak bilgi taşımıyor.
     *
     * GÖZETİM SATIRI ÇİFT İSİM KALIR: bakan kişi bağlantının tarafı değil,
     * tek isme indirmek konuşmanın kime ait olduğunu gizlerdi.
     */
    const karsiTaraf = bendenMi ? hedef : isteyen;

    /*
     * Gözetim satırında iki kurum yazılır ama AYNI KURUMSA TEK KEZ: "Kadıköy
     * Anadolu Lisesi → Kadıköy Anadolu Lisesi" okuyana hiçbir şey söylemiyor.
     * Okul arkadaşlarının bağlantısı en sık görülen durum.
     */
    const kurumlar = [
      ...new Set([isteyen.kurum?.ad, hedef.kurum?.ad].filter(Boolean)),
    ].join(" → ");

    /*
     * OKUNMAMIŞ MI (26 Ağustos 2026 · istek: "yeni mesaj ya da okunmamış mesaj
     * varsa kırmızı çerçeve olsun").
     *
     * Üç koşul birden: görünür bir son mesaj VAR, onu BAŞKASI yazmış ve
     * yazışma o mesajdan sonra AÇILMAMIŞ. Kendi yazdığı mesaj okunmamış
     * sayılsaydı, mesaj gönderen herkes kendi satırını kırmızı görürdü.
     */
    const sonMesaj = yazisma.mesajlar[0] ?? null;
    const sonOkuma = sonOkumalar.get(yazisma.baglantiIstegiId) ?? null;
    const okunmamisMi =
      sonMesaj !== null &&
      sonMesaj.yazanKullaniciId !== kullanici.id &&
      (sonOkuma === null || sonMesaj.olusturmaTarihi > sonOkuma);

    return {
      id: yazisma.baglantiIstegiId,
      tarafMi,
      okunmamisMi,
      // Sıralama son harekete göre; hiç mesaj yoksa yazışmanın açılma anı.
      sonHareket: sonMesaj?.olusturmaTarihi ?? yazisma.olusturmaTarihi,
      karsiTaraf,
      baslik: tarafMi
        ? `${karsiTaraf.ad} ${karsiTaraf.soyad}`
        : `${isteyen.ad} ${isteyen.soyad} ↔ ${hedef.ad} ${hedef.soyad}`,
      altBaslik: tarafMi
        ? altBasligiYaz([
            karsiTaraf.sinif ?? karsiTaraf.brans,
            karsiTaraf.kurum?.ad,
          ])
        : kurumlar,
      meta: [
        `${yazisma._count.mesajlar} mesaj`,
        // Gösterilen tarih SON HAREKET: liste de ona göre sıralı.
        tarihSaatYaz(sonMesaj?.olusturmaTarihi ?? yazisma.olusturmaTarihi),
        talep?.baslik,
        yazisma.kapatildiMi ? "kapatıldı" : null,
      ]
        .filter(Boolean)
        .join(" · "),
    };
  });

  /*
   * SIRALAMA SON HAREKETE GÖRE (26 Ağustos 2026 · istek: "gelen mesajlar en
   * altta … üste alalım"). Liste yazışmanın AÇILMA tarihine göre diziliydi;
   * eski bir bağlantıya bugün gelen mesaj listenin dibinde kalıyordu ve
   * okunmamış çerçevesi de oraya basılırdı, yani görünmezdi.
   */
  satirlar.sort((a, b) => b.sonHareket.getTime() - a.sonHareket.getTime());

  const benimSayisi = satirlar.filter((s) => s.tarafMi).length;
  const gozetimSayisi = satirlar.length - benimSayisi;

  const gorunen = satirlar.filter((satir) =>
    secili === "benim"
      ? satir.tarafMi
      : secili === "gozetim"
        ? !satir.tarafMi
        : true,
  );

  /*
   * Süzgeç şeridi yalnızca İKİ TÜR DE VARSA basılır: sadece kendi bağlantıları
   * olan öğrenciye "Tümü / Bağlantılarım / Gözetim" göstermek, üçü de aynı
   * listeyi veren üç düğme demek olurdu.
   */
  const suzgecGoster = benimSayisi > 0 && gozetimSayisi > 0;

  // Bekleyen istek sayısı kalktı (21 Ağustos 2026): bağlantı isteği akışı yok.
  const ozet = `${satirlar.length} bağlantı`;

  const ekipler = tumEkipler.filter((ekip) => ekip.aktif);

  return (
    <div className="space-y-6">
      {/*
        "← PROFİL" KALKTI (29 Ağustos 2026 · istek: "bağlantılarımda hâlâ profil
        navigasyonu var").

        Bağlantı `SayfaBasligi`nın VARSAYILANIYDI (bkz. components/ui.tsx) ve bu
        sayfa onu geçmediği için basılıyordu. Varsayılanın gerekçesi "Profil'deki
        kartla açılan, menüde karşılığı olmayan ekranlardan çıkılamıyor"du; bu
        ekranın sol menüde kendi satırı var (İletişim · Bağlantılarım), yani
        buraya Profil'den geçmek gerekmiyor ve dönüş yolu menüde duruyor.
      */}
      <SayfaBasligi baslik="Bağlantılarım" aciklama={ozet} geri={null} />

      {durum && DURUM_MESAJLARI[durum] && (
        <BilgiKutusu cesit="olumlu">{DURUM_MESAJLARI[durum]}</BilgiKutusu>
      )}
      {hata && <BilgiKutusu cesit="hata">{hata}</BilgiKutusu>}

      {/*
        LİSTE YALNIZCA YAZIŞMA VARSA BASILIR (21 Ağustos 2026 · istek:
        "bağlantılarım sayfasının en altından bunu kaldıralım: Bağlantılarım /
        Görüntüleyebileceğiniz bağlantı yok").

        Yazışması olmayan kişi için kart, boş bir başlık ve bir olumsuz
        cümleden ibaretti; üstelik sayfanın asıl işi artık yukarıdaki iki
        kartta — okuluyla ve okul temsilcileriyle yazışmayı oradan başlatıyor.
        Yazışması olanda liste yerinde duruyor.
      */}
      {satirlar.length > 0 && (
      <Kart>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-baslik">
            <MessagesSquare size={18} className="text-vurgu-metin" />
            Bağlantılarım
          </h2>

          {suzgecGoster && (
            /*
              Süzgeç JAVASCRIPT'SİZ: her sekme bir bağlantı, sayfa sunucuda
              yeniden basılıyor. Ekranın geri kalanı da böyle çalışıyor.
            */
            <nav className="flex gap-1 rounded-full border border-cizgi p-1">
              {(
                [
                  ["tumu", "Tümü", satirlar.length],
                  ["benim", "Bağlantılarım", benimSayisi],
                  ["gozetim", "Gözetim", gozetimSayisi],
                ] as const
              ).map(([kod, etiket, sayi]) => (
                <Link
                  key={kod}
                  href={
                    kod === "tumu"
                      ? "/panel/yazismalar"
                      : `/panel/yazismalar?suzgec=${kod}`
                  }
                  aria-current={secili === kod ? "page" : undefined}
                  className={`rounded-full px-3 py-1 text-sm transition ${
                    secili === kod
                      ? "bg-secili-zemin font-semibold text-secili-metin"
                      : "text-metin-yumusak hover:text-metin"
                  }`}
                >
                  {etiket} <span className="tabular-nums">{sayi}</span>
                </Link>
              ))}
            </nav>
          )}
        </div>

        {gorunen.length === 0 ? (
          <p className="text-metin-yumusak">
            {satirlar.length === 0
              ? "Görüntüleyebileceğiniz bağlantı yok."
              : "Bu süzgeçte bağlantı yok."}
          </p>
        ) : (
          /*
            TEK KART, AYIRICI ÇİZGİLİ SATIRLAR — kart içinde ayrı ayrı çerçeveli
            kutular değil (12 Ağustos · "çok basit"). Negatif kenar boşluğu,
            çizgilerin kartın tam genişliğinde durması için: LinkedIn listesi
            böyle, satır kenarda kesilmiyor.
          */
          <ul className="-mx-6 -mb-6 divide-y divide-cizgi border-t border-cizgi">
            {gorunen.map((satir) => (
              <li key={satir.id} className="group">
                {/*
                  SATIRIN TAMAMI TIKLANIR. Sağdaki eylem bir <span>: iki hedef
                  de aynı adres ve <a> içine <a> geçersiz HTML.

                  OKUNMAMIŞ SATIR KIRMIZI ÇERÇEVELİ (26 Ağustos 2026 · istek:
                  "yeni mesaj ya da okunmamış mesaj varsa kırmızı çerçeve
                  olsun"). Çerçeve satırın İÇİNDE: ayırıcı çizgili listede dış
                  kenarlık komşu satırların çizgileriyle çakışıyordu.

                  Renk TEK BAŞINA taşımıyor: yanında "yeni" rozeti ve ekran
                  okuyucu için gizli bir metin var — kırmızıyı ayırt edemeyen
                  kullanıcı da hangi satırın beklediğini görüyor.
                */}
                <Link
                  href={`/panel/yazismalar/${satir.id}`}
                  className={`flex items-center gap-4 px-6 py-4 transition hover:bg-zemin ${
                    satir.okunmamisMi
                      ? "rounded-kutu border-2 border-hata-cizgi bg-hata-zemin"
                      : ""
                  }`}
                >
                  {satir.tarafMi ? (
                    <BasHarfCemberi
                      ad={satir.karsiTaraf.ad}
                      soyad={satir.karsiTaraf.soyad}
                    />
                  ) : (
                    <GozetimCemberi />
                  )}

                  <span className="min-w-0 grow">
                    <span className="block truncate text-base font-semibold text-baslik underline-offset-2 group-hover:text-vurgu-metin group-hover:underline">
                      {satir.baslik}
                      {satir.okunmamisMi && (
                        <span className="ml-2 align-middle rounded-full bg-hata-zemin px-2 py-0.5 text-xs font-semibold text-hata-metin">
                          yeni
                          <span className="sr-only"> — okunmamış mesaj var</span>
                        </span>
                      )}
                    </span>
                    {satir.altBaslik && (
                      <span className="block truncate text-sm text-metin">
                        {satir.altBaslik}
                      </span>
                    )}
                    <span className="mt-1 block text-xs text-metin-yumusak">
                      {satir.meta}
                    </span>
                  </span>

                  {!satir.tarafMi && (
                    <span className="hidden shrink-0 rounded-full border border-cizgi px-2.5 py-0.5 text-xs text-metin-yumusak sm:inline">
                      gözetim
                    </span>
                  )}
                  <span className={`hidden sm:inline-flex ${SINIF_HAP_VURGU}`}>
                    {satir.tarafMi ? "Mesaj" : "Aç"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Kart>
      )}

      {/*
        GİZLİLİK UYARISI KUTUSU KALKTI (21 Ağustos 2026 · istek: "Bu sistemdeki
        yazışmalar gizli değildir … bu yazı kalkacak"). Kural değişmedi —
        yazışmaları yetkililer okuyabiliyor ve cümle `lib/iletisim/kurallar.ts`
        içinde duruyor; kalkan, her açılışta sayfanın tepesini kaplayan sarı
        kutuydu.
      */}

      {/*
        DOĞRUDAN YAZIŞMA KARTI (21 Ağustos 2026 · istek: "kendi okulundaki
        herkesi görecek mesaj atacak, okul temsilcilerinin hepsini görecek
        mesaj atabilecek").

        DAVETLERİN ÜSTÜNDE değil ALTINDA olmalıydı ama kart burada duruyor
        çünkü davetler yalnızca karar verecek kişide basılıyor; sıradan
        kullanıcının ekranında bu kart en üstteki iştir.

        "Mesaj gönder" düğmesi bir FORM: sunucu eylemi kuralı yeniden soruyor
        ve yazışmayı açıp doğrudan konuşmaya götürüyor. Bağlantı isteği kutusu
        burada YOK — bu iki küme için onay kapısı zaten kapalı değil.
      */}
      {/*
        İKİ KATEGORİ, İKİ KART (21 Ağustos 2026 · istek: "bağlantılarımda
        okulumdan ve okul temsilcilerini ayır alt alta farklı kartlara gelsin bu
        kategoriler").

        Önce tek kartın içinde iki sütundu; yan yana duran iki liste, dar
        ekranda alt alta kayınca hangisinin hangi başlığa ait olduğu
        kayboluyordu. Şimdi her kategori kendi kartında, alt alta.

        ARAMA KUTUSU İKİSİNİ BİRDEN SÜZÜYOR ve bu yüzden kartların ÜSTÜNDE:
        her karta ayrı kutu koymak, aynı adı iki kez aratmak demekti.
      */}
      {/*
        EKİPLERİM (31 Ağustos 2026 · istek: "Bağlantılarımda il koordinatörleri
        ekiplerini görebilsin, orada ekip listesi olacak ve tıklanabilir olsun.
        Ekibindeki herkesi görsün tıklanınca ve bireysel ve toplu mesaj
        atabilsin ekiptekilere").

        NİYE BURADA: bu ekran "kiminle konuşabilirim" sorusunun ekranı ve ekip,
        onay beklemeden konuşulabilen üçüncü kümedir (okulum, okul temsilcileri
        ve ekiplerim). Ekiplerim ekranı ekibi YÖNETMEK için; burada duran satır
        onun kopyası değil, konuşma kapısı.

        SATIR TIKLANABİLİR ve ekibin kendi sayfasına gidiyor: orada üyelerin
        tamamı, her satırında birebir "Mesaj" düğmesiyle, ve hepsine birden
        yazılan ekip sohbeti var. İkisini bu listeye sığdırmak, aynı ekranı iki
        kez yapmak olurdu.

        KART YALNIZCA EKİBİ OLANA BASILIYOR: ekibi olmayan kullanıcıya boş bir
        başlık ve bir olumsuz cümle göstermemek, bu sayfada daha önce de
        verilmiş bir karar (bkz. yukarıdaki yazışma listesi).
      */}
      {ekipler.length > 0 && (
        <Kart id="ekiplerim">
          <KartBasligi
            baslik="Ekiplerim"
            aciklama="Ekibe tıklayın: üyelerin tamamını görür, ekip sohbetinden hepsine birden ya da tek tek yazarsınız."
            Ikon={UsersRound}
          />
          <ul className="divide-y divide-cizgi rounded-kart border border-cizgi">
            {ekipler.map((ekip) => (
              <li key={ekip.id}>
                <Link
                  href={`/panel/ekipler/${ekip.id}`}
                  className="flex flex-wrap items-center gap-3 px-3 py-2.5 transition hover:bg-zemin"
                >
                  <span
                    aria-hidden
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cizgi bg-zemin text-vurgu-metin"
                  >
                    <UsersRound size={18} />
                  </span>
                  <span className="min-w-0 grow">
                    <span className="block truncate font-medium text-metin">
                      {ekip.ad}
                    </span>
                    <span className="block truncate text-sm text-metin-yumusak">
                      {ekip.ilAdi} · {ekip.uyeSayisi} üye
                      {ekip.uyesiyimMi ? " · üyesiniz" : ""}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-vurgu-metin">
                    <MessageSquare size={14} aria-hidden />
                    {ekip.mesajSayisi} mesaj
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Kart>
      )}

      <Kart>
        <KartBasligi
          baslik="Kişi ara"
          aciklama="Okulunuzdaki kişiler ve okul temsilcileri arasında arayın. Bu kişilerle onay beklemeden yazışabilirsiniz; yazışmalarınızı danışman öğretmeniniz, il koordinatörünüz ve proje yöneticileri okuyabilir."
          Ikon={Users}
        />
        {/* Arama JAVASCRIPT'SİZ: GET formu aynı sayfayı yeniden bastırıyor. */}
        <form method="get" className="flex flex-wrap items-end gap-2">
          {/* Açık süzgeç sekmesi kaybolmasın diye adresle birlikte taşınıyor. */}
          {suzgec && <input type="hidden" name="suzgec" value={suzgec} />}
          <label className="block grow">
            <span className="sr-only">Kişi ara</span>
            <input
              type="search"
              name="kisi"
              defaultValue={kisiAramasi}
              placeholder="Ad ya da soyad"
              className={SINIF_GIRDI}
            />
          </label>
          <button
            type="submit"
            className="rounded-kutu border border-cizgi-guclu bg-kart px-4 py-2.5 text-sm font-medium text-metin transition hover:border-vurgu"
          >
            Ara
          </button>
        </form>
      </Kart>

      <Kart id="okulumdan">
        <KartBasligi
          baslik="Okulumdan"
          aciklama="Kendi okulunuzdaki kayıtlı kullanıcılar."
          Ikon={School}
        />
        <KisiListesi
          bosMesaji={
            kullanici.kurumKodu === null
              ? "Kayıtlı bir okulunuz yok."
              : kisiAramasi
                ? "Aramanıza uyan kişi yok."
                : "Okulunuzda başka kayıtlı kullanıcı yok."
          }
          kisiler={okuldakiler}
          siniri={KISI_SINIRI}
        />
      </Kart>

      <Kart id="temsilciler">
        <KartBasligi
          baslik="Okul temsilcileri"
          aciklama="Bu dönem görevli okul temsilcileri — okulunuz fark etmeksizin yazışabilirsiniz."
          Ikon={BadgeCheck}
        />
        <KisiListesi
          bosMesaji={
            kisiAramasi
              ? "Aramanıza uyan temsilci yok."
              : "Bu dönem atanmış okul temsilcisi yok."
          }
          kisiler={temsilciler}
          siniri={KISI_SINIRI}
        />
      </Kart>

      {/*
        BAĞLANTI İSTEĞİ AKIŞI TAMAMEN KALKTI (21 Ağustos 2026 · istek:
        "bağlantılarımdan normal mesaj göndermeyi tamamen kaldır").

        Kalkanlar: Davetler (onay kuyruğu), "Gönderdiğim istekler", karara
        bağlananlar arşivi ve panodan istek gönderme kutusu. Yerine geçen tek
        yol, üstteki doğrudan mesaj kartı — okul içi ve okul temsilcileri.

        VERİ SİLİNMEDİ: `baglanti_istegi` tablosu ve daha önce açılmış
        yazışmalar duruyor; aşağıdaki liste onları göstermeye devam ediyor.
      */}

      {/*
        AKIŞ BÖLÜMÜ DE KALKTI (21 Ağustos 2026 · istek: "Akış · Kendini tanıt,
        çalışmanı paylaş · 2 gönderi — akışı da kaldır"). Gönderi ve yorum
        kayıtları tabloda duruyor; kalkan, onları basan bölüm.
      */}

    </div>
  );
}

/**
 * Doğrudan yazışılabilecek kişilerin listesi.
 *
 * Satır bir BAĞLANTI DEĞİL, bir düğme: kişinin profiline gitmiyor, yazışmayı
 * açıyor. Profil bağlantısı da konabilirdi ama iki hedefli satır, dokunmatik
 * ekranda hangisinin ne yaptığını belirsizleştiriyordu.
 *
 * Liste dolduğunda son satırda uyarı var: elli kişiden fazlası varsa kullanıcı
 * "hepsi bu kadar" sanmamalı, aramayı daraltmalı.
 */
function KisiListesi({
  kisiler,
  bosMesaji,
  siniri,
}: {
  kisiler: {
    id: number;
    ad: string;
    soyad: string;
    sinif: string | null;
    brans: string | null;
    kurum: { ad: string } | null;
  }[];
  bosMesaji: string;
  siniri: number;
}) {
  return (
    <div>
      {kisiler.length === 0 ? (
        <p className="text-sm text-metin-yumusak">{bosMesaji}</p>
      ) : (
        <ul className="divide-y divide-cizgi rounded-kart border border-cizgi">
          {kisiler.map((kisi) => (
            <li
              key={kisi.id}
              className="flex flex-wrap items-center gap-3 px-3 py-2.5"
            >
              <BasHarfCemberi ad={kisi.ad} soyad={kisi.soyad} />
              <div className="min-w-0 grow">
                <p className="truncate font-medium text-metin">
                  {kisi.ad} {kisi.soyad}
                </p>
                <p className="truncate text-sm text-metin-yumusak">
                  {[kisi.sinif ?? kisi.brans, kisi.kurum?.ad]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </p>
              </div>
              <form action={dogrudanYazismaAcEylemi}>
                <input type="hidden" name="hedefId" value={kisi.id} />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-kutu border border-cizgi-guclu bg-kart px-3 py-1.5 text-sm font-medium text-metin transition hover:border-vurgu hover:bg-zemin"
                >
                  <Send size={14} aria-hidden />
                  Mesaj gönder
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
      {kisiler.length === siniri && (
        <p className="mt-2 text-xs text-metin-yumusak">
          İlk {siniri} kişi listelendi; aramayı daraltın.
        </p>
      )}
    </div>
  );
}
