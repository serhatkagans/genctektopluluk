import {
  CalendarCheck,
  ChartColumn,
  CircleAlert,
  Download,
  FileSpreadsheet,
  FileText,
  Printer,
  ShieldCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { Cizgi } from "@/components/grafik/Cizgi";
import { DikeyBar } from "@/components/grafik/DikeyBar";
import { YatayBar } from "@/components/grafik/YatayBar";
import {
  BilgiKutusu,
  IlerlemeCubugu,
  Kart,
  KartBasligi,
  KirintiYolu,
  OlcuKarti,
  OlcuSeridi,
  SayfaBasligi,
  SINIF_GIRDI,
  SINIF_IKINCIL_BUTON,
} from "@/components/ui";
import { YazdirButonu } from "@/components/YazdirButonu";
import { oturumKullanicisiZorunlu } from "@/lib/auth/oturum";
import { prisma } from "@/lib/db";
import {
  ETKINLIK_KATEGORISI_ETIKETLERI,
  faaliyetSuresiYaz,
  TEMEL_ETKINLIK_GRUPLARI,
} from "@/lib/faaliyet/kurallar";
import { enBuyukler, yillaraGoreSay } from "@/lib/rapor/grafik-verisi";
import { tarihSaatYaz, tarihYaz } from "@/lib/tarih";
import {
  danismanMi,
  etkinlikRaporlariGorebilirMi,
  faaliyetDisaAktarabilirMi,
  ilKoordinatoruMu,
  projeYoneticisiMi,
} from "@/lib/yetki/izinler";
import { uygulamaYolu } from "@/lib/ortam";
import { raporlanabilirFaaliyetFiltresi } from "@/lib/yetki/kapsam";

export const dynamic = "force-dynamic";

/**
 * Faaliyet raporları modülü — analiz isteği Bölüm 4.
 *
 * İl koordinatörünün "ilimde hangi faaliyet bitti, hangisinin raporu eksik"
 * sorusunu tek ekranda cevaplar. Raporun kendisi faaliyetin rapor sayfasında
 * yazılır; burası bir GÖREV LİSTESİDİR, ikinci bir yazma yolu değil.
 *
 * Sıralama bilinçli: raporu eksik olanlar üstte. Yazılmış raporlar aşağıda
 * kalır çünkü onlar iş değil, kayıttır.
 */
export default async function RaporlarSayfasi() {
  const kullanici = await oturumKullanicisiZorunlu();

  // 23 Ekim 2026: liste yalnızca proje yöneticisine açık (bkz.
  // etkinlikRaporlariGorebilirMi).
  if (!etkinlikRaporlariGorebilirMi(kullanici)) {
    return (
      <Kart>
        <KartBasligi
          baslik="Etkinlik raporları"
          aciklama="Bu ekran proje yöneticisine açıktır. Bir etkinliğin raporunu etkinliğin kendi sayfasından yazabilirsiniz."
        />
      </Kart>
    );
  }

  const simdi = new Date();

  /*
   * BİTMİŞ faaliyetler: çok günlüde bitiş, tek günlükte tarih ölçüt alınır.
   * Prisma tek sorguda "bitisTarihi varsa ona, yoksa tarihe bak" diyemediği
   * için iki koşul OR'lanıyor.
   */
  const bitmisler = await prisma.faaliyet.findMany({
    where: {
      AND: [
        raporlanabilirFaaliyetFiltresi(kullanici),
        { durum: "AKTIF" },
        {
          OR: [
            { bitisTarihi: { not: null, lte: simdi } },
            { bitisTarihi: null, tarih: { lte: simdi } },
          ],
        },
      ],
    },
    orderBy: { tarih: "desc" },
    select: {
      id: true,
      ad: true,
      tarih: true,
      bitisTarihi: true,
      kurum: { select: { ad: true } },
      il: { select: { ad: true } },
      duzenleyen: { select: { ad: true, soyad: true } },
      rapor: {
        select: {
          guncellemeTarihi: true,
          yazan: { select: { ad: true, soyad: true } },
        },
      },
      _count: { select: { basvurular: true } },
    },
  });

  /*
   * ÇIKTI FORMUNUN LİSTELERİ (14 Ağustos 2026). Yalnızca merkez için
   * sorgulanıyor: form da yalnızca ona basılıyor ve iki küçük sorgu, formu
   * görmeyen danışman öğretmenin ekranına eklenmemeli.
   *
   * AKTİF OLANLAR: pasife alınmış bir grup/program yeni etkinlikte
   * seçilemiyor; çıktı formunda görünmesi, artık kullanılmayan bir seçeneği
   * canlıymış gibi gösterirdi. Geçmiş etkinlikleri "Tümü" dosyasında yerinde
   * duruyor.
   */
  const [calismaGruplari, programlar] = projeYoneticisiMi(kullanici)
    ? await Promise.all([
        prisma.calismaGrubu.findMany({
          where: { aktif: true },
          orderBy: { siraNo: "asc" },
          select: { id: true, ad: true },
        }),
        prisma.temelEtkinlikProgrami.findMany({
          where: { aktif: true },
          orderBy: [{ grup: "asc" }, { siraNo: "asc" }],
          select: { id: true, ad: true, grup: true },
        }),
      ])
    : [[], []];

  /*
   * GRAFİK VERİSİ (15 Ağustos 2026 · Aşama 7).
   *
   * Kapsam `raporlanabilirFaaliyetFiltresi` — ekranın geri kalanıyla aynı.
   * Grafik başka bir kapsamdan beslenseydi, aynı ekrandaki iki sayı birbirini
   * tutmazdı.
   *
   * YIL EKSENİ İÇİN TARİH SÜZGECİ YOK: eğilim grafiğinin tamamı isteniyor,
   * yalnızca bu yıl değil. Bitmişlik koşulu da yok — "kaç etkinlik yapıldı"
   * sorusu planlananı da kapsıyor ve grafiğin başlığı bunu söylüyor.
   */
  const grafikFaaliyetleri = await prisma.faaliyet.findMany({
    where: { AND: [raporlanabilirFaaliyetFiltresi(kullanici), { durum: "AKTIF" }] },
    select: {
      tarih: true,
      calismaGruplari: { select: { calismaGrubu: { select: { ad: true } } } },
    },
  });

  const yillik = yillaraGoreSay(grafikFaaliyetleri.map((f) => f.tarih));

  /*
   * BİR ETKİNLİK BAĞLI OLDUĞU HER GRUPTA SAYILIR ve bu bir hata değil, sorunun
   * kendisi: "Yapay Zekâ grubuna kaç etkinlik dokundu" sorusunun cevabı,
   * etkinlik üç gruba birden bağlıysa üçünde de sayılmasıdır
   * (`kirilim-istatistigi.ts` ile aynı ilke). Bu yüzden barların toplamı
   * etkinlik sayısını AŞAR; grafiğin açıklaması bunu yazıyor.
   */
  const grupSayimi = new Map<string, number>();
  for (const faaliyet of grafikFaaliyetleri) {
    for (const bag of faaliyet.calismaGruplari) {
      const ad = bag.calismaGrubu.ad;
      grupSayimi.set(ad, (grupSayimi.get(ad) ?? 0) + 1);
    }
  }
  const grupDagilimi = enBuyukler(
    [...grupSayimi].map(([etiket, deger]) => ({ etiket, deger })),
    8,
  );

  const eksikler = bitmisler.filter((faaliyet) => faaliyet.rapor === null);
  const yazilanlar = bitmisler.filter((faaliyet) => faaliyet.rapor !== null);

  /*
   * Bitmiş etkinliklerin toplam başvurusu. `_count.basvurular` SEÇİLMİŞ değil
   * TÜM başvuruları sayıyor (etkinlikler ekranındaki katılımcı sayacından
   * farkı bu) — burada sorulan "kaç kişi bu etkinliklere başvurdu", "kaçı
   * kabul edildi" değil. Ölçünün etiketi de bunu söylüyor.
   */
  const toplamKatilimci = bitmisler.reduce(
    (toplam, faaliyet) => toplam + faaliyet._count.basvurular,
    0,
  );

  /*
   * KAPSAM ŞERİDİNİN METNİ. `raporlanabilirFaaliyetFiltresi`nin üç dalıyla
   * BİREBİR aynı olmak zorunda (bkz. lib/yetki/kapsam.ts): şerit ekrandaki
   * sayının neyin toplamı olduğunu söylüyor ve filtre değişip metin
   * değişmezse, ekran kendi kapsamı hakkında yanlış bilgi verir.
   */
  const kapsamAdi = projeYoneticisiMi(kullanici)
    ? "Proje yöneticisi"
    : ilKoordinatoruMu(kullanici)
      ? "İl koordinatörü"
      : "Danışman öğretmen";

  const kapsamAciklamasi = projeYoneticisiMi(kullanici)
    ? "Tüm iller · tüm etkinlikler"
    : ilKoordinatoruMu(kullanici)
      ? "İliniz · ilinizdeki kurum ve öğretmenlerin etkinlikleri · kendi açtıklarınız"
      : "Yalnızca kendi açtığınız etkinlikler";

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
          { etiket: "Etkinlik raporları" },
        ]}
      />

      <SayfaBasligi
        geri={null}
        baslik="Etkinlik raporları"
        aciklama="Ekranda görüntüle, Excel olarak dışa aktar. Her rol yalnızca kendi kapsamındaki raporu görür."
      />

      {/*
        KAPSAM ŞERİDİ (18 Ağustos 2026 · istek: "raporlama görsel olarak zayıf,
        görsellerdeki gibi zenginleştir" — şablondaki "Görüntülenen kayıtlar …
        yetki kapsamıyla sınırlıdır" satırının karşılığı).

        SÜSLEME DEĞİL, DÜZELTME: bu ekrandaki her sayı `raporlanabilirFaaliyet-
        Filtresi`nden geçiyor ve iki farklı rol aynı ekranda farklı sayılar
        görüyor. Bunu hiçbir yerde yazmıyorduk; il koordinatörü "toplam 40
        etkinlik" görüp bunu ülke geneli sanabilirdi. Şerit, sayının neyin
        toplamı olduğunu söylüyor.
      */}
      <BilgiKutusu>
        <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
          <ShieldCheck size={15} aria-hidden className="text-vurgu-metin" />
          Görüntülenen kayıtlar
          <b>{kapsamAdi}</b>
          yetki kapsamıyla sınırlıdır.
          <span className="text-metin-yumusak">{kapsamAciklamasi}</span>
        </span>
      </BilgiKutusu>

      {/*
        ÖLÇÜ ŞERİDİ. Ekran bugüne kadar doğrudan listelerle açılıyordu ve
        "kaç rapor eksik" sorusunun cevabı yalnızca sayfa başlığındaki bir
        cümlecikte vardı; geri kalan üç sayı hiç yoktu, listeler sayılarak
        bulunuyordu.

        DÖRT ÖLÇÜ BİRBİRİNİN TEKRARI DEĞİL: ilki iş hacmi, ikincisi bekleyen
        iş, üçüncüsü biten iş, dördüncüsü ikisinin oranı. Oran ayrı bir kutuyu
        hak ediyor çünkü 3/4 ile 300/400 aynı yüzde ama aynı durum değil —
        kutular yan yana okunduğunda ikisi de görünüyor.

        YÖN RENGİ ANLAMDAN GELİYOR, çağıran seçmiyor: bekleyen iş uyarı sarısı,
        biten iş olumlu yeşil. Aynı anlamın iki ekranda iki renge düşmemesi
        için karar OlcuKarti'nın içinde (bkz. components/ui.tsx).
      */}
      <OlcuSeridi>
        <OlcuKarti
          etiket="Biten etkinlik"
          deger={bitmisler.length}
          altBilgi="Kapsamınızda, iptal edilmemiş"
          Ikon={CalendarCheck}
        />
        <OlcuKarti
          etiket="Raporu bekleyen"
          deger={eksikler.length}
          altBilgi={eksikler.length > 0 ? "İşlem bekliyor" : "Eksik yok"}
          yon={eksikler.length > 0 ? "uyari" : "olumlu"}
          Ikon={CircleAlert}
        />
        <OlcuKarti
          etiket="Raporu yazılan"
          deger={yazilanlar.length}
          altBilgi="Tamamlandı"
          yon="olumlu"
          Ikon={FileText}
        />
        <OlcuKarti
          etiket="Toplam katılımcı"
          deger={toplamKatilimci.toLocaleString("tr-TR")}
          altBilgi="Biten etkinliklerin başvuruları"
          Ikon={Users}
        />
      </OlcuSeridi>

      {/*
        TAMAMLANMA ORANI ÖLÇÜ KUTUSU DEĞİL ÇUBUK: yüzde tek başına bir sayı
        ama sorulan şey "ne kadarı bitti" — bu bir ilerleme, bir ölçüm değil.
        Çubuk kalanı da gösteriyor, kutu göstermezdi.

        Hiç bitmiş etkinlik yokken BASILMAZ: 0/0'ın yüzdesi yok ve "%0
        tamamlandı" demek, yapılmamış bir işi yapılmamış göstermek olurdu —
        oysa ortada iş yok.
      */}
      {bitmisler.length > 0 && (
        <Kart>
          <IlerlemeCubugu
            deger={yazilanlar.length}
            toplam={bitmisler.length}
            etiket={`Rapor tamamlanma · ${yazilanlar.length} / ${bitmisler.length} etkinlik`}
          />
        </Kart>
      )}

      {/*
        GRAFİKLER (Aşama 7). Panel bugüne kadar tamamen sayılarla çalışıyordu;
        "geçen yıla göre ne oldu" ve "hangi çalışma grubu daha çok çalıştı"
        soruları listede okunamıyordu.

        İKİSİ DE TEK SERİ: her bar/nokta bir kategori ya da bir yıl, ayrı seri
        değil. Bu yüzden LEJANT YOK — seriyi başlık adlandırıyor (dataviz
        kuralı) — ve her bara ayrı renk verilmiyor; kategoriyi zaten etiket
        söylüyor.

        Grafikler yalnızca VERİ VARSA basılıyor: tek yıllık veride çizgi
        "eğilim" iddiası taşır ama eğilim yoktur (bileşen iki noktadan azında
        null döner), boş grup listesinde de bar grafiği anlamsızdır.
      */}
      {/*
        GRAFİKLER (Aşama 7; 18 Ağustos 2026'da iki sütuna alındı).

        ESKİDEN TEK KART, ALT ALTA İKİ GRAFİKTİ ve ekranın üst yarısı boyunca
        tek bir sütun uzuyordu; geniş ekranda sağ taraf tamamen boştu. İki
        grafik AYNI ANDA okunacak şeyler — "ne zaman" ve "hangi grupta" — yan
        yana durunca gözün ikisi arasında gidip gelmesi bir kaydırma değil bir
        bakış oluyor.

        İKİSİ DE TEK SERİ: her bar bir dönem ya da bir kategori, ayrı seri
        değil. Bu yüzden LEJANT YOK — seriyi başlık adlandırıyor (dataviz
        kuralı) — ve her bara ayrı renk verilmiyor; kategoriyi zaten etiket
        söylüyor.

        Grafikler yalnızca VERİ VARSA basılıyor; biri yoksa öbürü tüm genişliği
        alır (`lg:col-span-2` yerine tek çocuk kalır ve ızgara kendiliğinden
        toparlar).
      */}
      {(yillik.length >= 2 || grupDagilimi.length > 0) && (
        <div className="grid gap-5 lg:grid-cols-2">
          {/*
            ZAMAN SERİSİ DİKEY, KATEGORİ YATAY (18 Ağustos 2026).

            Yıl etiketleri kısa ve sıralı; soldan sağa okunan yön zamanın
            yönüdür. Yatay bara yatırıldığında "sonra" aşağı doğru okunuyordu.
            Çalışma grubu ise tam tersi: adları uzun ve sırasız, yatayda
            sarıyorlar. Seçim veri türünün kararı, yer darlığının değil
            (gerekçe DikeyBar'ın başındaki notta).

            ÇOK DÖNEMDE ÇİZGİ (15 Ağustos 2026 · geri bildirim: "üstteki grafik
            anlaşılır değil"). Eşik beş: dört dönem ve altında kıyas okunuyor,
            beşten sonra eğilim başlıyor ve çizgi asıl işini yapıyor. Az
            dönemde çizgi, iki nokta arasını doldurup "aradaki bir anda değer
            2,5'ti" ima ediyordu — eğitim-öğretim yılı kesikli bir kova.
          */}
          {yillik.length >= 2 && (
            <Kart>
              <KartBasligi baslik="Zaman içinde" Ikon={ChartColumn} />
              {yillik.length < 5 ? (
                <DikeyBar
                  baslik="Eğitim-öğretim yılına göre etkinlik sayısı"
                  aciklama="Kapsamınızdaki iptal edilmemiş etkinlikler."
                  sutunlar={yillik}
                  birim="etkinlik"
                />
              ) : (
                <Cizgi
                  baslik="Eğitim-öğretim yılına göre etkinlik sayısı"
                  aciklama="Kapsamınızdaki iptal edilmemiş etkinlikler."
                  noktalar={yillik}
                  birim="etkinlik"
                />
              )}
            </Kart>
          )}

          {grupDagilimi.length > 0 && (
            <Kart>
              <KartBasligi baslik="Çalışma grubu kırılımı" Ikon={ChartColumn} />
              <YatayBar
                baslik="Çalışma grubuna göre etkinlik"
                aciklama="Bir etkinlik bağlı olduğu her grupta sayılır; barların toplamı etkinlik sayısını aşar."
                satirlar={grupDagilimi}
                birim="etkinlik"
              />
            </Kart>
          )}
        </div>
      )}

      {/*
        TAMAMLANAN ETKİNLİK RAPORLARI — XLSX (15 Ağustos 2026).

        Manisa GençTek panelindeki "Raporları Excel İndir" düğmesinin karşılığı
        (Manisa farkları turu). Aşağıdaki istatistik kartından
        FARKLI bir soruyu cevaplıyor: orası "hangi programda kaç etkinlik oldu"
        diye sayıyor, burası her etkinliğin kendi satırını ve raporunun metnini
        veriyor.

        YERİ İSTATİSTİĞİN ÜSTÜ: ekranı açan kişinin aradığı şey genelde bu.

        SAYFA KAPISINDAN AYRI BİR KAPI: ekranı danışman da görüyor ama dosyayı
        indirme kararı `faaliyetDisaAktarabilirMi`nin (rotadaki kapının aynısı).
        İkisi ayrı sorulmasaydı, ekranda görünen bir düğme rotada 404 verirdi.
      */}
      {faaliyetDisaAktarabilirMi(kullanici) && (
        <Kart className="yazdirma-disi">
          <KartBasligi
            baslik="Dışa aktarma"
            aciklama="Biten her etkinliğin katılımcı, fotoğraf ve belge sayıları ile raporunun tam metni. Raporu yazılmamış etkinlikler de listede yer alır."
            Ikon={FileSpreadsheet}
          />
          {/*
            İKİ DÜĞME, İKİ FARKLI ÇIKTI (18 Ağustos 2026 · istek: "Excel'e
            aktarma yanında PDF'e aktar da ekleyelim", sablon/4.png).

            AYNI ŞEYİN İKİ BİÇİMİ DEĞİLLER ve açıklama bunu söylüyor:

              Excel  Etkinlik başına BİR SATIR olan veri dosyası. Süzülür,
                     sıralanır, başka bir tabloya yapıştırılır.
              PDF    EKRANIN KENDİSİ — ölçüler, grafikler ve rapor listeleri.
                     Sunuma ve dosyalamaya gider, veri işlemeye değil.

            İkisini "aynı raporun iki biçimi" diye sunmak, PDF'i açan kişinin
            içinde Excel'deki satırları aramasına yol açardı.

            PDF SUNUCUDA ÜRETİLMİYOR: tarayıcının yazdırma penceresi açılıyor
            ve "PDF olarak kaydet" oradan seçiliyor. Gerekçe globals.css'teki
            @media print notunda — projenin katılım belgeleri de 31 Temmuz'dan
            beri böyle üretiliyor.
          */}
          <div className="flex flex-wrap gap-2">
            {/* Dosya indirmesi: `<Link>` değil `<a>` (bkz. DisaAktarmaBagi). */}
            <a
              href={uygulamaYolu("/panel/raporlar/dokum")}
              className={SINIF_IKINCIL_BUTON}
            >
              <Download size={16} aria-hidden />
              Excel&apos;e Aktar ({bitmisler.length} etkinlik)
            </a>
            <YazdirButonu className={SINIF_IKINCIL_BUTON}>
              <Printer size={16} aria-hidden />
              PDF&apos;e Aktar
            </YazdirButonu>
          </div>
          <p className="mt-2 text-sm text-metin-yumusak">
            <b>Excel:</b> kapsamınızdaki bitmiş etkinlikler, etkinlik başına bir
            satır. İptal edilenler ve tarihi gelmemiş olanlar dosyada yer almaz;
            tarih sütunu gerçek tarih biçimindedir, dosya Excel&apos;de tarihe
            göre sıralanabilir. <b>PDF:</b> bu ekranın çıktısı — ölçüler,
            grafikler ve rapor listeleri. Açılan yazdırma penceresinde hedef
            olarak &laquo;PDF olarak kaydet&raquo; seçilir.
          </p>
        </Kart>
      )}

      {/*
        PROGRAM / ÇALIŞMA GRUBU İSTATİSTİĞİ (14 Ağustos 2026 · istek: "proje
        yöneticisi için tüm illerde ve okullarda … istatistiğini csv formatında
        çıktı alabileceğimiz bir alan olabilir mi, ama program ve çalışma
        gruplarını ayrı ayrı alsın").

        YERİ RAPORLAR EKRANI: burası zaten "etkinliklerden ne çıktı" sorusunun
        ekranı ve merkezin kartı Yönetim Paneli'nden buraya bakıyor. Ayrı bir
        sayfa açmak, tek forma sahip bir ekran daha demekti.

        FORM, ALTI AYRI BAĞLANTI DEĞİL: kırılım × düzey altı dosya eder ve
        bunları alt alta bağlantı olarak dizmek, yıl süzgecine yer bırakmazdı.
        `method="get"` ile doğrudan çıktı rotasına gidiyor — sunucu eylemi yok,
        çünkü işin sonucu bir dosya indirmesi.
      */}
      {/* Süzgeç formu kâğıtta işe yaramaz: doldurulamayan bir form basılmaz. */}
      {projeYoneticisiMi(kullanici) && (
        <Kart className="yazdirma-disi">
          <KartBasligi
            baslik="Program ve çalışma grubu istatistiği"
            aciklama="Ülke geneli. Program ve çalışma grubu AYRI dosyalardır: bir etkinliğin programı en fazla bir, çalışma grubu birden çok olabilir."
            Ikon={FileText}
          />
          <form
            method="get"
            action={uygulamaYolu("/panel/raporlar/istatistik")}
            className="grid gap-4 sm:grid-cols-3"
          >
            <label className="block">
              <span className="text-sm font-medium text-metin-yumusak">
                Kırılım
              </span>
              <select name="kirilim" defaultValue="program" className={SINIF_GIRDI}>
                <option value="program">Program</option>
                <option value="grup">Çalışma grubu</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-metin-yumusak">
                Düzey
              </span>
              <select name="duzey" defaultValue="il" className={SINIF_GIRDI}>
                <option value="ulke">Ülke geneli</option>
                <option value="il">İl kırılımı</option>
                <option value="okul">Okul kırılımı</option>
              </select>
            </label>
            {/*
              GERÇEK LİSTELER (14 Ağustos 2026 · istek: "Çalışma grubu ve
              Program … kategorileri gelmiyor çıktı alma sayfasında, ben
              bunları istemiştim").

              İlk sürümde yalnızca "kırılım" seçiliyordu; kullanıcı hangi
              grupların ve programların olduğunu göremiyor, tek bir grubun
              dosyasını da alamıyordu. Listeler etkinlik formundakiyle AYNI
              kaynaktan (aktif çalışma grupları ve etkinlik programları)
              geliyor — ekrana elle yazılsalardı iki liste zamanla ayrışırdı.

              İKİSİ DE "Tümü" ile başlıyor: çıktının varsayılanı, seçim
              yapılmadan alınan tam dosyadır.
            */}
            <label className="block">
              <span className="text-sm font-medium text-metin-yumusak">
                Çalışma grubu
              </span>
              <select name="grup" defaultValue="" className={SINIF_GIRDI}>
                <option value="">Tümü</option>
                {calismaGruplari.map((grup) => (
                  <option key={grup.id} value={grup.id}>
                    {grup.ad}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-metin-yumusak">
                Program
              </span>
              <select name="program" defaultValue="" className={SINIF_GIRDI}>
                <option value="">Tümü</option>
                {/*
                  Programlar GRUPLANARAK basılıyor (Temel Etkinlik / Çalışma
                  Grubu Etkinliği): etkinlik formunda da bu ayrım var ve düz
                  bir liste, "bu program hangi kategoriye ait" sorusunu
                  cevapsız bırakırdı.
                */}
                {TEMEL_ETKINLIK_GRUPLARI.map((grupKodu) => {
                  const secenekler = programlar.filter(
                    (program) => program.grup === grupKodu,
                  );
                  if (secenekler.length === 0) return null;
                  return (
                    <optgroup
                      key={grupKodu}
                      label={ETKINLIK_KATEGORISI_ETIKETLERI[grupKodu]}
                    >
                      {secenekler.map((program) => (
                        <option key={program.id} value={program.id}>
                          {program.ad}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-metin-yumusak">
                Eğitim öğretim yılı
              </span>
              <input
                type="text"
                name="yil"
                placeholder="2025-2026 (boş = tüm yıllar)"
                pattern="\d{4}-\d{4}"
                className={SINIF_GIRDI}
              />
            </label>
            {/*
              İKİ BİÇİM, TEK FORM (18 Ağustos 2026 · geri bildirim: "bu
              başlıkta excel rapor yok csv var").

              EKRAN YANLIŞ SÖYLÜYORDU. Formda `bicim` alanı hiç yoktu ve
              rotanın varsayılanı `xlsx` (bkz. lib/rapor/disa-aktarma ·
              bicimCoz); yani "CSV indir" yazan düğme Excel dosyası
              indiriyordu. Başlık, açıklama ve düğme üç ayrı yerde "CSV" derken
              kullanıcının eline .xlsx geçiyordu — çıktı doğruydu, etiket
              yalandı.

              Rota İKİSİNİ DE ürettiği için doğru düzeltme etiketi değiştirmek
              değil, seçimi kullanıcıya vermek: Excel varsayılan (üstteki döküm
              çıktısıyla aynı biçim, aynı beklenti), CSV ikinci düğme.

              GİZLİ ALAN DEĞİL, İKİNCİ SUBMIT DÜĞMESİ: bir gönderme düğmesinin
              `name`/`value` çifti YALNIZCA tıklanan düğme için gönderilir.
              Böylece tek form iki hedefe gidiyor, JavaScript'e gerek kalmıyor
              ve sayfanın geri kalanı gibi sunucuda basılıyor.
            */}
            <div className="flex flex-wrap gap-2 sm:col-span-3">
              <button type="submit" className={SINIF_IKINCIL_BUTON}>
                <FileSpreadsheet size={16} aria-hidden />
                Excel indir
              </button>
              <button
                type="submit"
                name="bicim"
                value="csv"
                className={SINIF_IKINCIL_BUTON}
              >
                <Download size={16} aria-hidden />
                CSV indir
              </button>
              {/*
                DOSYANIN NE SAYDIĞI EKRANDA YAZILI: çalışma grubu dosyasında
                etkinlik sütununun toplamı gerçek etkinlik sayısını aşar (bir
                etkinlik üç gruba bağlıysa üçünde de sayılır) ve bu, dosyayı
                açan kişi uyarılmazsa hata sanılır.
              */}
              <p className="mt-2 text-sm text-metin-yumusak">
                İptal edilen etkinlikler sayılmaz. Çalışma grubu kırılımında bir
                etkinlik bağlı olduğu her grupta sayılır; programı ya da grubu
                olmayan etkinlikler ayrı bir satırda toplanır, hiçbiri dosyadan
                düşmez.
              </p>
            </div>
          </form>
        </Kart>
      )}

      {bitmisler.length === 0 ? (
        <Kart className="text-metin-yumusak">
          Kapsamınızda henüz bitmiş bir etkinlik yok. Etkinlik bitiş tarihini
          geçtiğinde burada listelenir.
        </Kart>
      ) : (
        <>
          <Kart>
            <KartBasligi
              baslik="Raporu bekleyenler"
              aciklama="Biten ama raporu yazılmamış etkinlikler."
              Ikon={CircleAlert}
            />
            {eksikler.length === 0 ? (
              <BilgiKutusu cesit="olumlu">
                Biten tüm etkinliklerin raporu yazılmış.
              </BilgiKutusu>
            ) : (
              <ul className="divide-y divide-cizgi">
                {eksikler.map((faaliyet) => (
                  <li
                    key={faaliyet.id}
                    className="flex flex-wrap items-baseline justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/panel/etkinlikler/${faaliyet.id}/rapor`}
                        className="font-medium text-vurgu-metin underline underline-offset-2"
                      >
                        {faaliyet.ad}
                      </Link>
                      <p className="mt-0.5 text-sm text-metin-yumusak">
                        {faaliyet.kurum?.ad ?? faaliyet.il?.ad ?? "Ülke geneli"}
                        {" · "}
                        {faaliyet.duzenleyen.ad} {faaliyet.duzenleyen.soyad}
                        {" · "}
                        {faaliyet._count.basvurular} başvuru
                      </p>
                    </div>
                    <span className="text-sm text-metin-yumusak">
                      {tarihYaz(faaliyet.bitisTarihi ?? faaliyet.tarih)}
                      {" · "}
                      {faaliyetSuresiYaz(faaliyet.tarih, faaliyet.bitisTarihi)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Kart>

          {yazilanlar.length > 0 && (
            <Kart>
              <KartBasligi
                baslik="Raporu yazılanlar"
                aciklama="Rapor düzeltilebilir; silinmez."
                Ikon={CalendarCheck}
              />
              {/*
                IZGARA (12 Ağustos 2026 · istek: "yazılan etkinlik raporları da
                ızgara görünümü olsun"). Mentör kartlarıyla aynı kurulum:
                `auto-fill` ile sütun sayısı içeriğe göre değişiyor.

                YALNIZCA BU BÖLÜM IZGARA, üstteki "Raporu bekleyenler" liste
                kaldı ve ayrım kasıtlı: bekleyenler bir GÖREV LİSTESİDİR,
                yukarıdan aşağı okunup bitirilir; yazılanlar ise bir ARŞİVDİR
                ve orada aranan şey tek tek satırlar değil "hangi etkinliğin
                raporu var" bütünü. İki bölümün farklı görünmesi, ekranı açan
                kişinin işinin hangisi olduğunu da söylüyor.
              */}
              <ul className="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-4">
                {yazilanlar.map((faaliyet) => (
                  <li
                    key={faaliyet.id}
                    className="flex flex-col rounded-kart border border-cizgi p-4"
                  >
                    <Link
                      href={`/panel/etkinlikler/${faaliyet.id}/rapor`}
                      className="flex items-start gap-2 font-medium text-metin transition hover:text-vurgu-metin"
                    >
                      <FileText
                        size={16}
                        className="mt-0.5 shrink-0 text-vurgu-metin"
                        aria-hidden
                      />
                      <span className="underline underline-offset-2">
                        {faaliyet.ad}
                      </span>
                    </Link>

                    <p className="mt-2 text-sm text-metin-yumusak">
                      {faaliyet.kurum?.ad ?? faaliyet.il?.ad ?? "Ülke geneli"}
                      {" · "}
                      {faaliyet._count.basvurular} başvuru
                    </p>

                    {/*
                      `mt-auto`: kartlar ızgarada aynı yüksekliğe uzuyor;
                      etkinlik adı iki satıra taşan kartla tek satırlık kartın
                      alt bilgisi aynı hizada dursun.
                    */}
                    <div className="mt-auto pt-3 text-sm text-metin-yumusak">
                      <p>
                        Bitiş: {tarihYaz(faaliyet.bitisTarihi ?? faaliyet.tarih)}
                      </p>
                      <p className="mt-0.5">
                        Raporu yazan: {faaliyet.rapor?.yazan.ad}{" "}
                        {faaliyet.rapor?.yazan.soyad}
                      </p>
                      <p className="mt-0.5">
                        {faaliyet.rapor
                          ? tarihSaatYaz(faaliyet.rapor.guncellemeTarihi)
                          : "—"}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </Kart>
          )}
        </>
      )}
    </div>
  );
}
