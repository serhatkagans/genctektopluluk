import { Fragment } from "react";
import { AlertTriangle, MapPin } from "lucide-react";
import {
  BilgiKutusu,
  Kart,
  KartBasligi,
  KirintiYolu,
  SayfaBasligi,
  SINIF_BIRINCIL_BUTON,
  SINIF_IKINCIL_BUTON,
} from "@/components/ui";
import { oturumKullanicisiZorunlu } from "@/lib/auth/oturum";
import { DisaAktarmaBagi } from "@/components/DisaAktarmaBagi";
import { uygulamaYolu } from "@/lib/ortam";
import { ACIKLAMA_AZAMI } from "@/lib/rol/koordinator";
import {
  ilKoordinatorDurumlari,
  koordinatorAdaylari,
  kurumDanismanDurumlari,
  type KoordinatorAdayi,
} from "@/lib/rapor/rol-envanteri";
import { rolEnvanteriGorebilirMi } from "@/lib/yetki/izinler";
import { erisimLogla } from "@/lib/yetki/log";
import {
  ilKoordinatorAciklamasiEylemi,
  ilKoordinatoruAtaEylemi,
  ilKoordinatoruKaldirEylemi,
} from "./eylemler";

export const dynamic = "force-dynamic";

/**
 * Rol/Atama Envanteri — yalnızca proje yöneticisi.
 *
 * Proje yöneticisi öğrencileri ve öğretmenleri tek tek zaten görebiliyordu;
 * eksik olan TOPLU görünümdü: hangi il koordinatörsüz, hangi okul danışmansız.
 * Bu ekran o boşluğu kapatır ve atamayı da buradan yaptırır — boşluğu görüp
 * doldurmak tek akış olmalı.
 *
 * Yetki, "Öğrenci/öğretmen verisi görüntüleme" satırından AYRIDIR
 * (references/permissions.md Bölüm 1).
 */

const SINIF_HUCRE = "px-3 py-2 text-sm";
const SINIF_ETIKET = "text-sm font-medium text-metin-yumusak";

function tekil(deger: string | string[] | undefined): string | null {
  const ilk = Array.isArray(deger) ? deger[0] : deger;
  const kirpilmis = ilk?.trim();
  return kirpilmis ? kirpilmis : null;
}

/**
 * LİSTE SIRALAMASI — 27 Ağustos 2026 · istekler: "liste harf sırası olsun ile
 * göre" · "üste excel filtre gibi harfe göre sırala branşa göre sırala a dan z
 * ye z den a ya sırala".
 *
 * ACİLİYET SIRASI KALKTI. 15 Ağustos'ta liste üç kademeye ayrılıyordu (önce
 * öğrencisi olup koordinatörü olmayan iller, sonra diğer boş iller, sonra
 * atanmışlar); gerekçesi "asıl iş öğrencili boş ildedir" idi ve o bulgu
 * kaybolmadı — sayfanın başındaki kırmızı özet ile satırın kendi vurgusu
 * duruyor. Değişen şey, sıranın artık KULLANICININ seçtiği bir şey olması:
 * 81 ilden birini aramak için alfabetik sıra, "hangi branştan kaç koordinatör
 * var" sorusu için branş sırası gerekiyordu ve ikisi de sabit bir sırayla
 * yapılamıyordu.
 *
 * BOŞ DEĞER HER ZAMAN SONA: branşı ya da koordinatörü olmayan iller, yön ne
 * olursa olsun listenin sonunda durur. Z→A seçildiğinde boşlar başa toplansaydı
 * ekranın ilk ekranı bilgisiz satırlarla dolardı.
 */
const SIRALAMALAR = {
  "il-az": "İl adı · A → Z",
  "il-za": "İl adı · Z → A",
  "brans-az": "Branş · A → Z",
  "brans-za": "Branş · Z → A",
} as const;

type Siralama = keyof typeof SIRALAMALAR;

/**
 * GÖRÜNÜM SÜZGECİ (27 Ekim 2026 · istek: "hangi illerde görevli öğretmen var
 * hangisi atamaya uygun bunu ayırt etmek zor oluyor"). 81 satırı tek tek
 * taramak yerine "atamaya hazır" iller tek seçimle ayrılıyor.
 */
const GORUNUMLER = {
  tumu: "Tüm iller",
  atanabilir: "Koordinatörsüz · aday öğretmeni olan",
  bos: "Koordinatörsüz (tümü)",
  dolu: "Koordinatörü olan",
} as const;

type Gorunum = keyof typeof GORUNUMLER;

function gorunumCoz(deger: string | null): Gorunum {
  return deger !== null && deger in GORUNUMLER ? (deger as Gorunum) : "tumu";
}

function siralamaCoz(deger: string | null): Siralama {
  return deger !== null && deger in SIRALAMALAR ? (deger as Siralama) : "il-az";
}

function karsilastir(a: string | null, b: string | null, tersMi: boolean): number {
  /* Boş değer yönden bağımsız olarak sona; bkz. yukarıdaki not. */
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  const fark = a.localeCompare(b, "tr");
  return tersMi ? -fark : fark;
}

export default async function RolEnvanteriSayfasi({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const kullanici = await oturumKullanicisiZorunlu();

  if (!rolEnvanteriGorebilirMi(kullanici)) {
    return (
      <Kart>
        <KartBasligi
          baslik="Rol/atama envanteri"
          aciklama="Bu ekran yalnızca proje yöneticisine açıktır."
        />
      </Kart>
    );
  }

  const parametreler = await searchParams;
  const secilenIl = tekil(parametreler.il);
  const siralama = siralamaCoz(tekil(parametreler.sirala));
  const gorunum = gorunumCoz(tekil(parametreler.goster));
  const hata = tekil(parametreler.hata);
  const durum = tekil(parametreler.durum);

  const [iller, kurumlar, adaylar] = await Promise.all([
    ilKoordinatorDurumlari(),
    kurumDanismanDurumlari(),
    secilenIl ? koordinatorAdaylari(secilenIl) : Promise.resolve([]),
  ]);

  /*
   * Ekran öğretmen adlarını ve okul bazlı öğrenci sayılarını gösterdiği için
   * görüntülenmesi de loglanır (Değişmez 7). Kendi profilini görmek gibi kişinin
   * kendi verisine erişimi loglanmaz; burada başkalarının verisi var.
   */
  await erisimLogla({
    kullaniciId: kullanici.id,
    islem: "GORUNTULEME",
    hedefTip: "ROL",
    hedefId: secilenIl ?? "envanter",
    detay: `Rol/atama envanteri görüntülendi${secilenIl ? ` (il ${secilenIl})` : ""}`,
  });

  const bosIller = iller.filter((il) => il.koordinator === null);
  /*
   * BAŞLIKTA "28 ilde koordinatör yok" TEK BAŞINA YANILTICIYDI: o 28 ilin
   * çoğunda hiç öğrenci yok ve koordinatörsüzlükleri kimseyi etkilemiyor.
   * Sayı, bakan kişiye 28 işlik bir yığın gösteriyordu; gerçekte iş çıkaran
   * il sayısı çok daha az. İkisi de yazılıyor.
   */
  const acilBosIller = bosIller.filter((il) => il.ogrenciSayisi > 0);
  const atanabilirIller = bosIller.filter((il) => il.adaySayisi > 0);
  const atanmamisToplam = iller.reduce(
    (toplam, il) => toplam + il.atanmamisOgrenciSayisi,
    0,
  );
  const danismansizOkullar = kurumlar.filter(
    (kurum) => kurum.danismanSayisi === 0,
  );

  const secilenIlBilgisi = secilenIl
    ? (iller.find((il) => il.ilKodu === secilenIl) ?? null)
    : null;
  /* Aday listesi yalnızca koordinatörsüz bir il seçiliyken açık. */
  const acikIlKodu =
    secilenIlBilgisi && !secilenIlBilgisi.koordinator
      ? secilenIlBilgisi.ilKodu
      : null;

  /*
   * Bağlantılar sıralamayı ve süzgeci taşır: "Koordinatör ata"ya basan kişinin
   * süzdüğü liste açılışta kaybolmasın. Çapa satırın kendisine gider; sayfa
   * bastığınız ilde kalır.
   */
  function adres(il: string | null): string {
    const parca = new URLSearchParams();
    if (il) parca.set("il", il);
    if (siralama !== "il-az") parca.set("sirala", siralama);
    if (gorunum !== "tumu") parca.set("goster", gorunum);
    const sorgu = parca.toString();
    return uygulamaYolu(
      `/panel/rol-envanteri${sorgu ? `?${sorgu}` : ""}${il ? `#il-${il}` : ""}`,
    );
  }

  const gorunenIller = [...iller]
    .filter((il) => {
      if (gorunum === "atanabilir") return !il.koordinator && il.adaySayisi > 0;
      if (gorunum === "bos") return !il.koordinator;
      if (gorunum === "dolu") return il.koordinator !== null;
      return true;
    })
    .sort((a, b) => {
      const tersMi = siralama.endsWith("-za");
      if (siralama.startsWith("brans")) {
        const fark = karsilastir(
          a.koordinator?.brans ?? null,
          b.koordinator?.brans ?? null,
          tersMi,
        );
        /* Aynı branşta ikincil ölçüt her zaman il adı: eşit
           satırların sırası her açılışta değişmesin. */
        if (fark !== 0) return fark;
        return a.ilAdi.localeCompare(b.ilAdi, "tr");
      }
      return karsilastir(a.ilAdi, b.ilAdi, tersMi);
    });

  const dagitilan = Number.parseInt(tekil(parametreler.dagitilan) ?? "", 10);
  const yenidenSecim = Number.parseInt(
    tekil(parametreler.yenidenSecim) ?? "",
    10,
  );
  const atanmamisOlan = Number.parseInt(
    tekil(parametreler.atanmamis) ?? "",
    10,
  );
  const baglanan = Number.parseInt(tekil(parametreler.baglanan) ?? "", 10);

  return (
    <div className="space-y-6">
      {/*
        KIRINTI YOLU (29 Ağustos 2026 · istek: "navigasyon bunu göstersin
        yönetim paneli / rol envanteri şeklinde").

        Yerinde tek başına "← Yönetim Paneli" bağlantısı vardı: geri dönüşü
        veriyordu ama bu ekranın Yönetim Paneli'nin ALTINDA olduğunu
        söylemiyordu — kişi nereye döneceğini görüyor, nerede durduğunu
        görmüyordu. Basamak sırası ekranın gerçek yoludur: buraya yalnızca o
        panonun kartından giriliyor (bkz. panel/yonetim/page.tsx).

        SON BASAMAK BAĞLANTI DEĞİL: bulunulan sayfanın kendisi
        (bkz. components/ui.tsx · KirintiYolu). Bu yüzden SayfaBasligi'nın
        kendi geri bağlantısı da `null` — ikisi bir arada aynı yolu üst üste
        iki kez basardı.
      */}
      <KirintiYolu
        basamaklar={[
          { etiket: "Yönetim Paneli", yol: "/panel/yonetim" },
          { etiket: "Rol envanteri" },
        ]}
      />

      <SayfaBasligi
        geri={null}
        baslik="Rol/atama envanteri"
        aciklama={`${iller.length} il · ${bosIller.length} ilde koordinatör yok (${acilBosIller.length}'i öğrencili, ${atanabilirIller.length}'inde aday öğretmen var) · ${danismansizOkullar.length} okul danışmansız`}
      />

      {/*
        OKUL KIRILIMI BAĞLANTISI KALKTI (27 Ağustos 2026 · istek: "buna gerek
        yok · Okul kırılımını Excel indir"). Ekrandaki okul tablosuyla aynı
        turda gitti; ikisi de aynı ikinci soruyu soruyordu.

        ETİKET ARTIK KIRILIM ADI TAŞIMIYOR (30 Ağustos 2026 · istek: "İl
        kırılımını Excel indir … bunu listeyi excel olarak indir falan yap").
        "İl kırılımı" adı yanındaki okul bağlantısından ayırmak içindi; o
        bağlantı kalkınca tek başına kalan indirmeyi tarif etmiyor, ekranda
        karşılığı olmayan bir ayrım soruyordu. Ekranda görünen liste zaten
        illerin listesi.

        UYARI — İNEN DOSYADA İLÇE VE OKUL SÜTUNU YOKTUR: satırı bir İL'dir
        (bkz. disa-aktar/route.ts · IL_SUTUNLARI). Okul bazlı döküm gerekirse
        Okullar ekranının kendi CSV çıktısı alınır. Route'un `?kirilim=okul`
        dalı SİLİNMEDİ; kalkan yalnızca buradaki kapı.
      */}
      <p className="flex flex-wrap gap-6">
        <DisaAktarmaBagi
          yol="/panel/rol-envanteri/disa-aktar"
          etiket="Listeyi Excel indir"
        />
      </p>

      {durum === "atandi" && (
        <BilgiKutusu cesit="olumlu">
          İl koordinatörü atandı.
          {tekil(parametreler.danismandi) === "1" &&
            " Atanan öğretmenin danışmanlık görevi kapatıldı."}
          {Number.isFinite(dagitilan) &&
            dagitilan > 0 &&
            ` Danışmanlığı kapandığı için ${dagitilan} öğrenci yeniden dağıtıldı.`}
          {Number.isFinite(yenidenSecim) &&
            yenidenSecim > 0 &&
            ` Bunlardan ${yenidenSecim} öğrenciye "danışmanını yeniden seç" bildirimi gitti; seçim yapılana kadar il koordinatörüne bağlı görünürler.`}
          {Number.isFinite(baglanan) &&
            baglanan > 0 &&
            ` Ayrıca ilde koordinatör olmadığı için atanmamış durumda bekleyen ${baglanan} öğrenci yeni koordinatöre bağlandı.`}
        </BilgiKutusu>
      )}

      {durum === "kaldirildi" && (
        <BilgiKutusu cesit="uyari">
          İl koordinatörlüğü kaldırıldı.
          {Number.isFinite(atanmamisOlan) && atanmamisOlan > 0
            ? ` ${atanmamisOlan} öğrenci "atanmamış" duruma düştü; ile yeni koordinatör atandığında otomatik olarak ona bağlanacaklar.`
            : ""}
        </BilgiKutusu>
      )}

      {durum === "aciklama-kaydedildi" && (
        <BilgiKutusu cesit="olumlu">Atama açıklaması kaydedildi.</BilgiKutusu>
      )}

      {/* Açık aday listesi varsa hata onun içinde basılıyor. */}
      {hata && !acikIlKodu && <BilgiKutusu cesit="hata">{hata}</BilgiKutusu>}

      {atanmamisToplam > 0 && (
        <div className="rounded-kart border border-hata-cizgi bg-hata-zemin px-4 py-3 text-sm text-hata-metin">
          <span className="inline-flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
            <span>
              <strong>{atanmamisToplam} öğrencinin danışmanı yok.</strong>{" "}
              Okulları danışmansız ve illerinde koordinatör bulunmuyor. İlgili
              illere koordinatör atandığında bu öğrenciler ayrı bir onay
              gerekmeden koordinatöre bağlanır.
            </span>
          </span>
        </div>
      )}

      {/* --- İl koordinatörü durumu --- */}
      <Kart>
        <KartBasligi
          baslik="İl koordinatörü durumu"
          aciklama="Koordinatörsüz illerde İşlem sütunu o ilde kaç aday öğretmen olduğunu gösterir; Koordinatör ata'ya basınca adaylar ilin hemen altında açılır. Öğrencisi olup koordinatörü olmayan iller vurgulu kalır."
          Ikon={MapPin}
        />

        {/*
          SIRALAMA DENETİMİ (27 Ağustos 2026 · istek: "üste excel filtre gibi
          harfe göre sırala branşa göre sırala a dan z ye z den a ya sırala").

          `<form method="get">`: seçim adres çubuğuna yazılıyor, yani sıra
          paylaşılabilir ve tarayıcının geri düğmesi çalışıyor. JavaScript'e
          bağlı bir açılır liste, sunucuda basılan bu tabloyu yeniden
          sıralayamazdı.

          SEÇİLİ İL KORUNUYOR: aşağıdaki atama bölümü de aynı sorgu dizesinde
          yaşıyor; gizli alan olmasaydı sıralamayı değiştiren kişinin açtığı
          aday listesi kapanırdı.
        */}
        <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
          {secilenIl && <input type="hidden" name="il" value={secilenIl} />}
          <label className="block">
            <span className={SINIF_ETIKET}>Sırala</span>
            <select
              name="sirala"
              defaultValue={siralama}
              className="mt-1 rounded-md border border-cizgi bg-kart px-3 py-2 text-sm text-metin outline-none focus:border-vurgu"
            >
              {Object.entries(SIRALAMALAR).map(([deger, etiket]) => (
                <option key={deger} value={deger}>
                  {etiket}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={SINIF_ETIKET}>Göster</span>
            <select
              name="goster"
              defaultValue={gorunum}
              className="mt-1 rounded-md border border-cizgi bg-kart px-3 py-2 text-sm text-metin outline-none focus:border-vurgu"
            >
              {Object.entries(GORUNUMLER).map(([deger, etiket]) => (
                <option key={deger} value={deger}>
                  {etiket}
                  {deger === "atanabilir" ? ` (${atanabilirIller.length})` : ""}
                  {deger === "bos" ? ` (${bosIller.length})` : ""}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className={SINIF_IKINCIL_BUTON}>
            Uygula
          </button>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] border-collapse">
            <thead>
              <tr className="border-b border-cizgi text-left">
                {/*
                  SIRA NUMARASI SÜTUNU (27 Ağustos 2026 · istek: "il sütununa
                  1 2 3 4 gibi sayılar gelsin · plaka kodlarını kaldır").

                  Numara EKRANDAKİ SIRANIN numarasıdır, ilin kimliği değil:
                  sıralama değişince yeniden başlar. Plaka kodu kalktı çünkü o
                  bir veritabanı anahtarı — aynı gerekçeyle 26 Ağustos'ta rol
                  rozetinden de çıkarılmıştı. Kod hâlâ gerekiyorsa Excel
                  çıktısının ilk sütunu.
                */}
                <th className={`${SINIF_HUCRE} ${SINIF_ETIKET} w-12`}>#</th>
                <th className={`${SINIF_HUCRE} ${SINIF_ETIKET}`}>İl</th>
                <th className={`${SINIF_HUCRE} ${SINIF_ETIKET}`}>Koordinatör</th>
                {/*
                  BRANŞ KENDİ SÜTUNUNDA (27 Ağustos 2026 · istek: "isimle branş
                  yan yana oraya yeni sütun ekleyip branşı ayır"). Adın yanına
                  "· Bilişim Teknolojileri" diye yazıldığında ad sütunu satırdan
                  satıra farklı uzunlukta oluyordu ve branşa göre sıralama da
                  yapılamıyordu — göz, sütun olmayan bir alanı tarayamaz.
                */}
                <th className={`${SINIF_HUCRE} ${SINIF_ETIKET}`}>Branş</th>
                {/*
                  ÖĞRETMEN VE ÖĞRENCİ SÜTUNLARI KALKTI (27 Ağustos 2026 ·
                  istekler: "öğretmen sütununu kaldıralım listeden" ·
                  "öğrenciler sütununu da kaldıralım"). Sayılar Excel
                  çıktısında ve Yönetim Paneli'nin il kırılımında duruyor.

                  ATANMAMIŞ ÖĞRENCİ UYARISI KAYBOLMADI: öğrenci sütununun
                  içinde bir rozetti, sayfanın başındaki kırmızı kutuda toplamı
                  zaten yazıyor.
                */}
                <th className={`${SINIF_HUCRE} ${SINIF_ETIKET}`}>Telefon</th>
                <th className={`${SINIF_HUCRE} ${SINIF_ETIKET}`}>E-posta</th>
                <th className={`${SINIF_HUCRE} ${SINIF_ETIKET}`}>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {gorunenIller
                .map((il, sira) => {
                  const bosMu = il.koordinator === null;
                  /*
                   * VURGU YALNIZCA İŞ ÇIKARAN SATIRDA. Eskiden 28 boş ilin
                   * hepsi sarıya boyanıyordu; ekranın üçte biri tek renk
                   * olunca vurgu vurgu olmaktan çıkıp arka plana dönüşüyordu.
                   * Şimdi yalnızca öğrencisi olup koordinatörü olmayan iller
                   * vurgulu — bakan kişinin gerçekten yapacağı iş o.
                   */
                  const acilMi = bosMu && il.ogrenciSayisi > 0;
                  const acikMi = il.ilKodu === acikIlKodu;
                  return (
                    <Fragment key={il.ilKodu}>
                    <tr
                      id={`il-${il.ilKodu}`}
                      className={`scroll-mt-24 border-b border-cizgi last:border-0 ${
                        acikMi
                          ? "bg-vurgu-zemin"
                          : acilMi
                            ? "bg-uyari-zemin"
                            : ""
                      }`}
                    >
                      <td
                        className={`${SINIF_HUCRE} tabular-nums text-metin-yumusak`}
                      >
                        {sira + 1}
                      </td>
                      <td className={`${SINIF_HUCRE} font-medium text-metin`}>
                        {il.ilAdi}
                      </td>
                      {/*
                        BOŞ İLDE "ATANMADI" YAZMIYOR (27 Ağustos 2026 · istek:
                        "koordinatör sütununda atanmadı kalksın sadece adı
                        soyadı olsun o sütunda"). Boşluk zaten üç yerden
                        okunuyor: satırın vurgusu, sayfa başındaki özet ve aynı
                        satırın "Koordinatör ata" bağlantısı.
                      */}
                      <td className={SINIF_HUCRE}>
                        {il.koordinator ? (
                          <span className="text-metin">
                            {il.koordinator.ad} {il.koordinator.soyad}
                          </span>
                        ) : (
                          <span className="text-metin-yumusak">—</span>
                        )}
                      </td>
                      <td className={`${SINIF_HUCRE} text-metin-yumusak`}>
                        {il.koordinator?.brans || "—"}
                      </td>
                      {/*
                        İLETİŞİM SÜTUNLARI TIKLANABİLİR: `tel:` ve `mailto:`
                        bağlantıları numarayı elle kopyalamayı gereksiz kılıyor.
                        Bilgi kişinin KENDİ girdiği alandan geliyor (bkz.
                        rol-envanteri.ts); hiç girilmemişse hücre "—" basıyor.
                      */}
                      <td className={`${SINIF_HUCRE} tabular-nums`}>
                        {il.koordinator?.telefon ? (
                          <a
                            href={`tel:${il.koordinator.telefon}`}
                            className="text-vurgu-metin"
                          >
                            {il.koordinator.telefon}
                          </a>
                        ) : (
                          <span className="text-metin-yumusak">—</span>
                        )}
                      </td>
                      <td className={SINIF_HUCRE}>
                        {il.koordinator?.eposta ? (
                          <a
                            href={`mailto:${il.koordinator.eposta}`}
                            className="break-all text-vurgu-metin"
                          >
                            {il.koordinator.eposta}
                          </a>
                        ) : (
                          <span className="text-metin-yumusak">—</span>
                        )}
                      </td>
                      <td className={SINIF_HUCRE}>
                        {il.koordinator ? (
                          <div className="space-y-2">
                            <form action={ilKoordinatoruKaldirEylemi}>
                              <input
                                type="hidden"
                                name="kullaniciId"
                                value={il.koordinator.kullaniciId}
                              />
                              <button
                                type="submit"
                                className="rounded-md border border-cizgi px-2.5 py-1 text-xs font-medium text-metin-yumusak transition hover:bg-zemin"
                              >
                                Görevi kaldır
                              </button>
                            </form>
                            {/*
                              AÇIKLAMAYI SONRADAN DÜZENLEME (27 Ağustos 2026 ·
                              istek: "sonradan metni düzenleme de olsun").

                              `<details>` içinde ve satır içinde: aynı desende
                              öğrenci listesindeki "Mentörlüğü kaldır" formu var
                              — her satırda açık duran bir metin kutusu, 81
                              satırlık tabloyu okunamaz hâle getirirdi.

                              ÖZETİN METNİ NOTUN VARLIĞINI SÖYLÜYOR: açmadan da
                              "not var mı" görülebilsin.
                            */}
                            <details>
                              <summary className="cursor-pointer text-xs font-medium text-vurgu-metin">
                                {il.koordinator.aciklama
                                  ? "Açıklamayı düzenle"
                                  : "Açıklama ekle"}
                              </summary>
                              <form
                                action={ilKoordinatorAciklamasiEylemi}
                                className="mt-2 space-y-2"
                              >
                                <input
                                  type="hidden"
                                  name="kullaniciId"
                                  value={il.koordinator.kullaniciId}
                                />
                                <textarea
                                  name="aciklama"
                                  rows={3}
                                  maxLength={ACIKLAMA_AZAMI}
                                  defaultValue={il.koordinator.aciklama ?? ""}
                                  placeholder="Atamanın gerekçesi, görev kapsamı ya da not"
                                  className="w-full min-w-[16rem] rounded-md border border-cizgi bg-kart px-3 py-2 text-sm text-metin outline-none focus:border-vurgu"
                                />
                                <button
                                  type="submit"
                                  className="rounded-md border border-cizgi px-2.5 py-1 text-xs font-medium text-metin-yumusak transition hover:bg-zemin"
                                >
                                  Kaydet
                                </button>
                              </form>
                            </details>
                          </div>
                        ) : il.adaySayisi === 0 ? (
                          /*
                            ADAYI OLMAYAN İLDE BAĞLANTI YOK (27 Ekim 2026):
                            eskiden her boş ilde "Koordinatör ata" vardı, basınca
                            "öğretmen bulunmuyor" yazısı çıkıyordu. Bilgi artık
                            tıklamadan okunuyor.
                          */
                          <span className="text-xs text-metin-yumusak">
                            Aday öğretmen yok
                          </span>
                        ) : acikMi ? (
                          <a
                            href={adres(null)}
                            className="text-xs font-medium text-metin-yumusak"
                          >
                            Kapat ▲
                          </a>
                        ) : (
                          <a
                            href={adres(il.ilKodu)}
                            className="inline-flex flex-col text-xs font-medium text-vurgu-metin"
                          >
                            <span>Koordinatör ata ▼</span>
                            <span className="font-normal text-metin-yumusak">
                              {il.adaySayisi} aday öğretmen
                            </span>
                          </a>
                        )}
                      </td>
                    </tr>
                    {acikMi && (
                      <tr className="border-b border-cizgi bg-vurgu-zemin">
                        <td colSpan={7} className="px-3 pb-4 pt-1">
                          {hata && (
                            <div className="mb-3">
                              <BilgiKutusu cesit="hata">{hata}</BilgiKutusu>
                            </div>
                          )}
                          <AdayTablosu
                            ilKodu={il.ilKodu}
                            ilAdi={il.ilAdi}
                            adaylar={adaylar}
                          />
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  );
                })}
              {gorunenIller.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className={`${SINIF_HUCRE} text-center text-metin-yumusak`}
                  >
                    Bu süzgece uyan il yok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Kart>

      {/*
        "DANIŞMAN ÖĞRETMEN DURUMU" TABLOSU KALKTI (27 Ağustos 2026 · istek:
        "bunu kaldıralım · Danışman öğretmen durumu").

        Bu ekranın sorusu "hangi il koordinatörsüz"; okul kırılımı ikinci bir
        soruydu ve kendi ekranı var: Okullar (/panel/okullar) aynı listeyi
        süzgeçleriyle veriyor, danışmansız okullar ise Okul eksikleri raporunda
        (bkz. lib/rapor/okul-eksikleri.ts). Sayfanın başındaki "N okul
        danışmansız" özeti yerinde duruyor, yani bulgu kaybolmuyor —
        kalkan yalnızca aynı ekrandaki ikinci tablo.
      */}
    </div>
  );
}

/**
 * ADAYLAR SEÇİLEN İLİN HEMEN ALTINDA (27 Ekim 2026 · istek: "üstten ilin
 * yanındaki koordinatör atamaya basıyorum aşağı gidiyor sayfa aşağıdan
 * listeden seçiyorum"). Eskiden aday tablosu sayfanın en altında ayrı bir
 * kartta ve ayrı bir il seçim kutusuyla açılıyordu; kişi bastığı satırı
 * kaybediyordu. Artık tablo satırın altına açılıyor, ayrı il seçimi yok.
 *
 * Danışman öğretmenler de atanabilir; atama engellenmez. Öğretmenin
 * danışmanlığı kapatılır ve öğrencileri devir kurallarına göre yeniden
 * dağıtılır — satırın sarı zemini ve adın altındaki sayı bunu atamadan ÖNCE
 * söyler (domain-rules.md Bölüm 3).
 */
function AdayTablosu({
  ilKodu,
  ilAdi,
  adaylar,
}: {
  ilKodu: string;
  ilAdi: string;
  adaylar: KoordinatorAdayi[];
}) {
  if (adaylar.length === 0) {
    return (
      <p className="text-sm text-metin-yumusak">
        {ilAdi} ilinde koordinatör olarak atanabilecek öğretmen bulunmuyor.
        Öğretmenin en az bir kez giriş yapmış olması gerekir.
      </p>
    );
  }
  return (
    <div className="rounded-md border border-cizgi bg-kart">
      <p className="border-b border-cizgi px-3 py-2 text-sm font-medium text-metin">
        {ilAdi} · {adaylar.length} aday öğretmen
        <span className="ml-2 font-normal text-metin-yumusak">
          Sarı satırlar danışman öğretmendir; atanırsa öğrencileri yeniden
          dağıtılır.
        </span>
      </p>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[52rem] border-collapse">
        <thead>
          <tr className="border-b border-cizgi text-left">
            <th className={`${SINIF_HUCRE} ${SINIF_ETIKET} w-12`}>#</th>
            <th className={`${SINIF_HUCRE} ${SINIF_ETIKET}`}>
              Ad soyad
            </th>
            <th className={`${SINIF_HUCRE} ${SINIF_ETIKET}`}>Branş</th>
            <th className={`${SINIF_HUCRE} ${SINIF_ETIKET}`}>Okul</th>
            <th className={`${SINIF_HUCRE} ${SINIF_ETIKET}`}>
              Telefon
            </th>
            <th className={`${SINIF_HUCRE} ${SINIF_ETIKET}`}>
              E-posta
            </th>
            <th className={`${SINIF_HUCRE} ${SINIF_ETIKET}`}>İşlem</th>
          </tr>
        </thead>
        <tbody>
          {adaylar.map((aday, sira) => (
            <tr
              key={aday.kullaniciId}
              className={`border-b border-cizgi last:border-0 ${
                aday.danismanMi ? "bg-uyari-zemin" : ""
              }`}
            >
              <td
                className={`${SINIF_HUCRE} tabular-nums text-metin-yumusak`}
              >
                {sira + 1}
              </td>
              <td className={`${SINIF_HUCRE} font-medium text-metin`}>
                {aday.ad} {aday.soyad}
                {/*
                  DANIŞMANLIK UYARISI ADIN ALTINDA KALIYOR: satırın
                  sarı zemini "burada bir bedel var" diyor, sayı ise
                  bedelin ne kadar olduğunu — kaç öğrencinin yeniden
                  dağıtılacağını — söylüyor. Atama engellenmiyor
                  (domain-rules.md Bölüm 3); yalnızca sonucu atamadan
                  ÖNCE okunuyor.
                */}
                {aday.danismanMi && (
                  <span className="mt-1 block text-xs font-medium text-uyari-metin">
                    Danışman öğretmen ·{" "}
                    {aday.danismanliktakiOgrenciSayisi} öğrenci yeniden
                    dağıtılacak
                  </span>
                )}
              </td>
              <td className={`${SINIF_HUCRE} text-metin-yumusak`}>
                {aday.brans || "—"}
              </td>
              <td className={`${SINIF_HUCRE} text-metin-yumusak`}>
                {aday.kurumAdi || "—"}
              </td>
              <td className={`${SINIF_HUCRE} tabular-nums`}>
                {aday.telefon ? (
                  <a
                    href={`tel:${aday.telefon}`}
                    className="text-vurgu-metin"
                  >
                    {aday.telefon}
                  </a>
                ) : (
                  <span className="text-metin-yumusak">—</span>
                )}
              </td>
              <td className={SINIF_HUCRE}>
                {aday.eposta ? (
                  <a
                    href={`mailto:${aday.eposta}`}
                    className="break-all text-vurgu-metin"
                  >
                    {aday.eposta}
                  </a>
                ) : (
                  <span className="text-metin-yumusak">—</span>
                )}
              </td>
              <td className={SINIF_HUCRE}>
                {/*
                  AÇIKLAMA ATAMANIN KENDİ FORMUNDA (27 Ağustos 2026 ·
                  istek: "koordinatör atarken açıklama yazılabilecek
                  bir alan").

                  Her adayın kendi formu var — tek ortak metin kutusu
                  olsaydı hangi adaya yazıldığı belirsizleşirdi.
                  Zorunlu değil: notu olmayan atama geçerli bir
                  atamadır. Yazılmazsa sonradan da eklenebiliyor
                  (üstteki tablo · "Açıklama ekle").
                */}
                <form
                  action={ilKoordinatoruAtaEylemi}
                  className="space-y-2"
                >
                  <input
                    type="hidden"
                    name="kullaniciId"
                    value={aday.kullaniciId}
                  />
                  <input
                    type="hidden"
                    name="ilKodu"
                    value={ilKodu}
                  />
                  <textarea
                    name="aciklama"
                    rows={2}
                    maxLength={ACIKLAMA_AZAMI}
                    placeholder="Açıklama (isteğe bağlı)"
                    className="w-full min-w-[14rem] rounded-md border border-cizgi bg-kart px-3 py-2 text-sm text-metin outline-none focus:border-vurgu"
                  />
                  <button
                    type="submit"
                    className={SINIF_BIRINCIL_BUTON}
                  >
                    Koordinatör yap
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </div>
  );
}
