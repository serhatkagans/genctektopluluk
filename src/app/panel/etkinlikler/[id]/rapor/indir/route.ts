import { oturumKullanicisi } from "@/lib/auth/oturum";
import { prisma } from "@/lib/db";
import { yoklamaOzeti } from "@/lib/belge/kapi";
import {
  faaliyetKapsamiCikar,
  gorunurFaaliyetGetir,
} from "@/lib/faaliyet/erisim";
import {
  ETKINLIK_KATEGORISI_ETIKETLERI,
  faaliyetSuresiYaz,
  KAPSAM_ETIKETLERI,
} from "@/lib/faaliyet/kurallar";
import { RAPOR_ALAN_ADLARI } from "@/lib/faaliyet/rapor-kurallar";
import { KATILIM_BICIMI_ETIKETLERI } from "@/lib/kazanim/kurallar";
import { csvAdParcasi, csvBelgesi, csvYaniti } from "@/lib/rapor/csv";
import {
  faaliyetRaporuHtml,
  type RaporVerisi,
  wordYaniti,
} from "@/lib/rapor/faaliyet-raporu";
import { tarihSaatYaz, tarihYaz } from "@/lib/tarih";
import { faaliyetRaporuYazabilirMi, yetkiDevrolduMu } from "@/lib/yetki/izinler";
import { ulusalBasvuranFiltresi } from "@/lib/yetki/kapsam";
import { erisimLogla } from "@/lib/yetki/log";

export const dynamic = "force-dynamic";

/**
 * Faaliyet raporu — Word (`?bicim=word`) ya da Excel/CSV (varsayılan).
 *
 * YETKİ raporu YAZABİLENLERLE aynıdır: faaliyeti açan, yetki devrolmuşsa ilin
 * koordinatörü ve proje yöneticisi. Raporu yazan kişinin onu indirememesi
 * anlamsız olurdu.
 *
 * Kapsam dışında 403 değil 404 döner — kaydın varlığı sızmasın.
 */
export async function GET(
  istek: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const kullanici = await oturumKullanicisi();
  if (!kullanici) {
    return new Response("Bulunamadı", { status: 404 });
  }

  const faaliyet = await gorunurFaaliyetGetir(kullanici, Number.parseInt(id, 10));
  if (!faaliyet) {
    return new Response("Bulunamadı", { status: 404 });
  }

  const kapsamBilgisi = faaliyetKapsamiCikar(faaliyet);
  if (!faaliyetRaporuYazabilirMi(kullanici, kapsamBilgisi)) {
    return new Response("Bulunamadı", { status: 404 });
  }

  /*
   * ULUSAL ETKİNLİKTE KATILIMCI LİSTESİ DEĞERLENDİRME EKRANIYLA AYNI KAPIDAN
   * (6 Kasım 2026 · güvenlik incelemesi). Raporu yazabilen il koordinatörü,
   * kendi ilinde düzenlenmiş ama başkasının açtığı ulusal etkinlikte 81 ilden
   * seçilen katılımcıların adını, okulunu ve ilini indirebiliyordu; ekranda
   * aynı liste ona kapalı (yetki matrisi §3: düzenleyene).
   */
  const ulusalMi =
    faaliyet.kapsam === "ULUSAL" || faaliyet.kapsam === "ULUSLARARASI";
  const basvuruKosulu = ulusalMi
    ? ulusalBasvuranFiltresi(
        kullanici,
        faaliyet.id,
        yetkiDevrolduMu(kullanici, kapsamBilgisi),
      )
    : { faaliyetId: faaliyet.id };

  const [basvurular, ekler, rapor] = await Promise.all([
    prisma.basvuru.findMany({
      where: basvuruKosulu,
      orderBy: [{ durum: "asc" }, { basvuruTarihi: "asc" }],
      select: {
        durum: true,
        katilimciId: true,
        katildiMi: true,
        katilimci: {
          select: {
            ad: true,
            soyad: true,
            sinif: true,
            brans: true,
            kurum: { select: { ad: true } },
            il: { select: { ad: true } },
          },
        },
      },
    }),
    prisma.faaliyetEk.findMany({
      where: { faaliyetId: faaliyet.id, silindiMi: false, mimeTipi: { startsWith: "image/" } },
      select: { dosyaAdi: true },
    }),
    /*
     * Raporun YAZILI kısmı. Çıktının asıl içeriği budur; ilk sürümde
     * okunmuyordu ve indirilen belgede değerlendirme boş çıkıyordu.
     */
    prisma.faaliyetRaporu.findUnique({
      where: { faaliyetId: faaliyet.id },
      select: {
        degerlendirme: true,
        kazanimlar: true,
        guncellemeTarihi: true,
        yazan: { select: { ad: true, soyad: true } },
      },
    }),
  ]);

  const secilenler = basvurular.filter((basvuru) => basvuru.durum === "SECILDI");

  /*
   * YOKLAMA ÇIKTIYA DA İŞLER (26 Ağustos 2026 · istek: "yoklamayı alıyorum
   * sonra rapor oluşturunca katılmayan öğrenciler de katıldı gibi görünüyor").
   *
   * Burası eskiden seçilmiş başvuruları "Katılan" sayıyor ve hepsini katılımcı
   * listesine basıyordu. Seçilmek "katılabilir" demek; gelmedi işaretlenen kişi
   * indirilen belgede katılmış görünüyordu. Ekran zaten yoklamayı sayıyordu
   * (bkz. rapor sayfasındaki yoklamaOzeti) — çelişen tek yer dışarıya verilen
   * nüshaydı.
   *
   * GELMEYENLER LİSTEDEN ÇIKAR, sayı olarak durur: kimin gelmediği raporu
   * yazanın bilgisi ama katılımcı listesi katılanların listesidir. Yoklaması
   * alınmamış kişi listede kalır ve durumu açıkça yazılır; sessizce atılsaydı
   * yoklama alınmamış bir etkinliğin raporu boş katılımcıyla çıkardı.
   */
  const ozet = yoklamaOzeti(secilenler);
  const listelenenler = secilenler.filter(
    (basvuru) => basvuru.katildiMi !== false,
  );
  const tekiller = new Set(listelenenler.map((basvuru) => basvuru.katilimciId));

  const veri: RaporVerisi = {
    faaliyetAdi: faaliyet.ad,
    aciklama: faaliyet.aciklama,
    kapsam: KAPSAM_ETIKETLERI[faaliyet.kapsam],
    kategori: ETKINLIK_KATEGORISI_ETIKETLERI[faaliyet.etkinlikKategorisi],
    yer:
      faaliyet.kurum?.ad ??
      (faaliyet.il
        ? `${faaliyet.il.ad}${faaliyet.ilce ? ` / ${faaliyet.ilce.ad}` : ""}`
        : "Ülke geneli"),
    tarih: faaliyet.bitisTarihi
      ? `${tarihSaatYaz(faaliyet.tarih)} — ${tarihSaatYaz(faaliyet.bitisTarihi)}`
      : tarihSaatYaz(faaliyet.tarih),
    sure: faaliyetSuresiYaz(faaliyet.tarih, faaliyet.bitisTarihi),
    katilimBicimi: faaliyet.katilimBicimi
      ? KATILIM_BICIMI_ETIKETLERI[faaliyet.katilimBicimi]
      : null,
    hedefKitle: faaliyet.hedefKitle,
    duzenleyen: `${faaliyet.duzenleyen.ad} ${faaliyet.duzenleyen.soyad}`,
    duzenleyenBirim: faaliyet.duzenleyenBirim,
    kontenjan: faaliyet.kontenjan,
    toplamBasvuru: basvurular.length,
    secilenSayisi: secilenler.length,
    gelenSayisi: ozet.gelen,
    gelmeyenSayisi: ozet.gelmeyen,
    isaretlenmeyenSayisi: ozet.isaretlenmeyen,
    tekilKatilimci: tekiller.size,
    katilimcilar: listelenenler.map((basvuru) => ({
      adSoyad: `${basvuru.katilimci.ad} ${basvuru.katilimci.soyad}`,
      sinifVeyaBrans: basvuru.katilimci.sinif ?? basvuru.katilimci.brans,
      okul: basvuru.katilimci.kurum?.ad ?? null,
      il: basvuru.katilimci.il?.ad ?? null,
      katildiMi: basvuru.katildiMi,
    })),
    gorselAdlari: ekler.map((ek) => ek.dosyaAdi),
    degerlendirme: rapor?.degerlendirme ?? null,
    kazanimlar: rapor?.kazanimlar ?? null,
    raporYazan: rapor ? `${rapor.yazan.ad} ${rapor.yazan.soyad}` : null,
    raporTarihi: rapor ? tarihSaatYaz(rapor.guncellemeTarihi) : null,
    olusturan: `${kullanici.ad} ${kullanici.soyad}`,
    olusturmaTarihi: tarihSaatYaz(new Date()),
  };

  await erisimLogla({
    kullaniciId: kullanici.id,
    islem: "GORUNTULEME",
    hedefTip: "FAALIYET",
    hedefId: faaliyet.id,
    detay: `Etkinlik raporu indirildi: ${faaliyet.ad}`,
  });

  const dosyaAdi = `genctek-rapor-${csvAdParcasi(faaliyet.ad, "faaliyet")}`;

  if (new URL(istek.url).searchParams.get("bicim") === "word") {
    return wordYaniti(dosyaAdi, faaliyetRaporuHtml(veri));
  }

  /*
   * Excel çıktısı CSV'dir. HTML tablo `.xls` uzantısıyla verilseydi Excel
   * "dosya biçimi uzantıyla uyuşmuyor" uyarısı gösterirdi; CSV uyarısız açılır.
   * Özet satırları listenin ÜSTÜNDE: raporu açan önce sayıyı görmeli.
   */
  const belge = csvBelgesi(
    ["Alan", "Değer"],
    [
      ["Etkinlik", veri.faaliyetAdi],
      ["Kapsam", veri.kapsam],
      ["Etkinlik kategorisi", veri.kategori],
      ["Yer", veri.yer],
      ["Tarih", veri.tarih],
      ["Süre", veri.sure],
      ["Katılım biçimi", veri.katilimBicimi ?? "—"],
      ["Hedef kitle", veri.hedefKitle ?? "—"],
      ["Düzenleyen", veri.duzenleyen],
      ["Kontenjan", veri.kontenjan],
      ["Toplam başvuru", veri.toplamBasvuru],
      ["Seçilen", veri.secilenSayisi],
      ["Yoklamada gelen", veri.gelenSayisi],
      ["Gelmeyen", veri.gelmeyenSayisi],
      ["Yoklaması alınmayan", veri.isaretlenmeyenSayisi],
      ["Farklı kişi sayısı", veri.tekilKatilimci],
      ["", ""],
      /*
       * Değerlendirme CSV'de de yer alır. Satır sonları hücre içinde korunur;
       * csvHucresi tırnaklama yaptığı için Excel çok satırlı hücreyi doğru
       * okur.
       */
      [RAPOR_ALAN_ADLARI.degerlendirme, veri.degerlendirme ?? "Rapor henüz yazılmadı."],
      [RAPOR_ALAN_ADLARI.kazanimlar, veri.kazanimlar ?? "—"],
      ["Raporu yazan", veri.raporYazan ?? "—"],
      ["Rapor tarihi", veri.raporTarihi ?? "—"],
      ["", ""],
      ["Katılımcı", "Sınıf / Branş · Okul / İl · Katılım"],
      ...veri.katilimcilar.map((katilimci) => [
        katilimci.adSoyad,
        `${katilimci.sinifVeyaBrans ?? "—"} · ${katilimci.okul ?? katilimci.il ?? "—"} · ${
          katilimci.katildiMi === true ? "Geldi" : "Yoklama alınmadı"
        }`,
      ]),
    ],
  );

  return csvYaniti(dosyaAdi, belge);
}
