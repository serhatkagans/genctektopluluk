import {
  ChevronLeft,
  ChevronRight,
  Filter,
  ShieldCheck,
  X,
} from "lucide-react";
import Link from "next/link";
import { DisaAktarmaBagi } from "@/components/DisaAktarmaBagi";
import {
  SutunMetinSuzgeci,
  SutunSecimSuzgeci,
  SutunSuzgecBoslugu,
  SutunSuzgecDugmesi,
  SutunSuzgecHucresi,
  SutunSuzgecSatiri,
  SuzgecSecimKutusu,
} from "@/components/SutunSuzgeci";
import {
  Kart,
  KartBasligi,
  KirintiYolu,
  SayfaBasligi,
  SINIF_BIRINCIL_BUTON,
} from "@/components/ui";
import { envanterYolIzi } from "../envanter-yolu";
import { oturumKullanicisiZorunlu } from "@/lib/auth/oturum";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { okulTuruSecenekleri } from "@/lib/okul/turler";
import {
  gorevYillariSecenekleri,
  okulTurleriGetir,
} from "@/lib/rapor/secenekler";
import {
  danismanMi,
  ilKoordinatoruMu,
  koordinatorIlKodu,
  ogretmenEnvanteriGorebilirMi,
  projeYoneticisiMi,
} from "@/lib/yetki/izinler";
import { ogretmenListeFiltresi } from "@/lib/yetki/kapsam";
import { erisimLoglaCoklu } from "@/lib/yetki/log";
import {
  sayiVeyaNull,
  type SorguParametreleri,
  sorguMetni,
  tekil,
} from "../ogrenciler/filtreler";
import {
  ogretmenFiltreleriniCoz,
  ogretmenFiltresiVarMi,
} from "./filtreler";

export const dynamic = "force-dynamic";

/**
 * Danışman öğretmen envanteri — analiz dokümanı Bölüm 2.
 *
 * Liste merkezi kapsam filtresinden geçer (ogretmenKapsamFiltresi): danışman
 * öğretmen kendi okulunu, il koordinatörü kendi ilini, YEĞİTEK tüm ülkeyi
 * görür. Ekrandaki filtreler yalnızca DARALTIR; adres çubuğuna yazılan bir il
 * kodu kapsamı genişletmez.
 *
 * "Görev aldığı eğitim-öğretim yılı(ları)" ayrı bir sütunda tutulmaz, rol
 * kayıtlarının tarihlerinden türetilir (bkz. src/lib/ogretmen/gorev-yillari.ts).
 */

const SINIF_ETIKET = "text-sm font-medium text-metin-yumusak";
const SINIF_SECIM =
  "mt-1 w-full rounded-md border border-cizgi bg-kart px-3 py-2 text-sm text-metin outline-none focus:border-vurgu";
const SINIF_SAYFA_BUTON =
  "inline-flex items-center gap-1 rounded-md border border-cizgi px-3 py-1.5 text-sm font-medium text-metin transition hover:bg-zemin";

/** Sütun süzgeçlerinin bağlandığı form; bkz. components/SutunSuzgeci.tsx. */
const SUZGEC_FORMU = "ogretmen-suzgeci";

const SAYFA_BOYUTU = 50;

function sayfaBaglantisi(
  parametreler: SorguParametreleri,
  sayfa: number,
): string {
  const sorgu = new URLSearchParams(sorguMetni(parametreler, ["sayfa"]));
  if (sayfa > 1) sorgu.set("sayfa", String(sayfa));
  const metin = sorgu.toString();
  return metin ? `/panel/ogretmenler?${metin}` : "/panel/ogretmenler";
}

/**
 * LİSTE SIRALAMASI (27 Ağustos 2026 · istek: "buraya filtreler sıralalar
 * eklensin, excel gibi sırala vs").
 *
 * SIRA VERİTABANINDA VERİLİYOR, ekranda değil: liste sayfalı (SAYFA_BOYUTU)
 * ve yalnızca o sayfanın 50 satırı çekiliyor. JS'te sıralansaydı yalnızca
 * görünen sayfa kendi içinde sıralanır, "Z'den A'ya" seçildiğinde birinci
 * sayfada yine A'lar dururdu.
 *
 * İKİNCİL ÖLÇÜT HER ZAMAN AD-SOYAD: aynı branştan ya da aynı okuldan onlarca
 * satır var ve eşitlerin sırası sabit olmazsa sayfa 2'ye geçince kayıtlar yer
 * değiştirir (aynı kişi iki kez görünebilir).
 *
 * BOŞ DEĞER: Postgres `NULL`ları varsayılan olarak sona koyar (`nulls: "last"`
 * ile açıkça yazılıyor) — branşı girilmemiş öğretmen, yön ne olursa olsun
 * listenin sonunda.
 */
/*
 * SIRALAMA SÜZGECİ KALDIRILDI (31 Ağustos 2026 · istek: "bu sayfada sıralama
 * filtresini kaldır").
 *
 * Altı seçenekli bir açılır liste vardı (ad/branş/okul × A→Z, Z→A) ve
 * `SIRALAMALAR`, `ogretmenSiralamasiCoz`, `ogretmenSirasi` üçlüsüyle
 * kuruluyordu. Üçü de silindi; geride "her zaman varsayılanı döndüren" bir
 * çözümleyici bırakmak, okuyan kişiye hâlâ bir seçim varmış izlenimi verirdi.
 *
 * SIRA SABİTLENDİ: ad, sonra soyad, A→Z. Listenin işi bir kişiyi BULMAK ve
 * alfabetik sıra bunun için yeterli; sütun süzgeçleri geldiği için "branşa göre
 * sırala" da artık "branşı süz" ile karşılanıyor — sıralama, aradığı branşı
 * listenin ortasında bulmayı gerektiriyordu, süzgeç doğrudan gösteriyor.
 */
const OGRETMEN_SIRASI: Prisma.KullaniciOrderByWithRelationInput[] = [
  { ad: "asc" },
  { soyad: "asc" },
];

export default async function OgretmenlerSayfasi({
  searchParams,
}: {
  searchParams: Promise<SorguParametreleri>;
}) {
  const kullanici = await oturumKullanicisiZorunlu();

  if (!ogretmenEnvanteriGorebilirMi(kullanici)) {
    return (
      <Kart>
        <KartBasligi
          baslik="Öğretmenler"
          aciklama="Bu ekrana erişim yetkiniz yok."
        />
      </Kart>
    );
  }

  const parametreler = await searchParams;
  const filtreler = ogretmenFiltreleriniCoz(parametreler);
  const filtreVar = ogretmenFiltresiVarMi(filtreler);

  const koordinatorIli = koordinatorIlKodu(kullanici);
  const seciliIl = filtreler.ilKodu ?? koordinatorIli;

  const [iller, ilceler, okullar, okulTurleri, gorevYiliSecenekleri] =
    await Promise.all([
      projeYoneticisiMi(kullanici)
        ? prisma.il.findMany({ orderBy: { ad: "asc" } })
        : koordinatorIli
          ? prisma.il.findMany({ where: { ilKodu: koordinatorIli } })
          : [],
      seciliIl
        ? prisma.ilce.findMany({
            where: { ilKodu: seciliIl },
            orderBy: { ad: "asc" },
          })
        : [],
      seciliIl
        ? prisma.kurum.findMany({
            where: { ilKodu: seciliIl, aktif: true },
            orderBy: { ad: "asc" },
            select: { kurumKodu: true, ad: true },
          })
        : [],
      okulTurleriGetir(seciliIl ?? null),
      gorevYillariSecenekleri(),
    ]);

  const nerede = ogretmenListeFiltresi(kullanici, filtreler);
  const toplam = await prisma.kullanici.count({ where: nerede });
  const sonSayfa = Math.max(1, Math.ceil(toplam / SAYFA_BOYUTU));
  const istenenSayfa = sayiVeyaNull(tekil(parametreler.sayfa)) ?? 1;
  const sayfa = Math.min(Math.max(1, istenenSayfa), sonSayfa);

  const ogretmenler = await prisma.kullanici.findMany({
    where: nerede,
    skip: (sayfa - 1) * SAYFA_BOYUTU,
    take: SAYFA_BOYUTU,
    select: {
      id: true,
      ad: true,
      soyad: true,
      brans: true,
      /*
        OKULUN İL VE İLÇESİ DE ÇEKİLİYOR (31 Ağustos 2026 · istek: "sütunda
        sadece il adı çıkıyor, il / ilçe adı olsun").

        SEBEP VERİDEYDİ: kullanıcı kaydındaki `ilce_kodu` çoğu öğretmende BOŞ
        (413 kayıttan 55'inde il bile yok) — e-Okul senkronu kişiye ilçe
        yazmıyor, ilçe OKULUN kaydında duruyor. Hücre kişinin kendi alanına
        bakıyordu ve o boş olduğu için yalnızca il basılıyordu.

        SIRA ÖNEMLİ: önce kişinin kendi alanı, yoksa okulunkine düşülüyor.
        Tersi olsaydı, okulu değiştirilmiş ama kaydı güncellenmemiş bir
        öğretmende ekran kişinin kaydıyla çelişirdi.
      */
      kurum: {
        select: {
          ad: true,
          okulTuru: true,
          il: { select: { ad: true } },
          ilce: { select: { ad: true } },
        },
      },
      // Kayıtta okulunu listede bulamayan öğretmenin yazdığı ad.
      beyanOkulAdi: true,
      /*
        İLETİŞİM SÜTUNLARI (27 Ağustos 2026 · istek: "öğretmenin eposta adresi
        ve telefon sütunlarını ekle").

        Kaynak `OgretmenProfil` — kişinin KENDİ girdiği bilgi; e-Okul'dan
        gelmiyor ve gecelik senkronda üzerine yazılmıyor (bkz. schema.prisma).
        Profili hiç açılmamış öğretmende ikisi de boş kalır ve hücre "—" basar.
      */
      ogretmenProfil: {
        select: {
          eposta: true,
          telefon: true,
          /*
            YEĞİTEK OKUL SORUMLUSU İŞARETİ (27 Ağustos 2026 · istek: "bu kartı
            buradan kaldırıp … öğretmenler panelinin içine sütun olarak
            ekleyelim").

            İşaret bir ROL DEĞİL (bkz. permissions.md): hiçbir veri erişimi
            vermiyor, öğretmen kendisi koyuyor ve onay aranmıyor. Tek karşılığı
            merkezin listesinde görünmekti; artık öğretmenin kendi satırında.
          */
          yegitekOkulSorumlusu: true,
        },
      },
      il: { select: { ad: true } },
      ilce: { select: { ad: true } },
      /*
        ROL KAYITLARI ARTIK ÇEKİLMİYOR (27 Ağustos 2026): tek tüketicileri
        kalkan "Görev" ve "Görev yılları" sütunlarıydı. Görev yılı SÜZGECİ
        duruyor ve o `where` içinde çalışıyor (bkz. ogretmenListeFiltresi),
        satırların kendi rol kayıtlarını okumuyor.
      */
      _count: {
        select: {
          danismanAtamalari: { where: { bitisTarihi: null } },
          /*
            "ETKİNLİK" SÜTUNU KALDIRILDI (27 Ağustos 2026 · istek: "listeden
            etkinlik sütununu kaldıralım"). Sayının kaynağı olan
            `kazanimlar: { where: { tip: "GENCTEK_ETKINLIGI" } }` sayımı da
            birlikte gitti — bu listede başka tüketicisi yoktu.

            Bilgi kaybolmadı: öğretmenin kendi sayfasındaki Deneyimlerim şeridi
            aynı kayıtları tek tek listeliyor (bkz. ogretmenler/[id]).
          */
        },
      },
    },
    orderBy: OGRETMEN_SIRASI,
  });

  await erisimLoglaCoklu(
    ogretmenler.map((ogretmen) => ({
      kullaniciId: kullanici.id,
      islem: "GORUNTULEME" as const,
      hedefTip: "OGRETMEN" as const,
      hedefId: ogretmen.id,
      detay: "Öğretmen listesi görüntülendi",
    })),
  );

  const kapsamAciklamasi = projeYoneticisiMi(kullanici)
    ? "Tüm iller"
    : ilKoordinatoruMu(kullanici)
      ? "Kendi iliniz"
      : danismanMi(kullanici)
        ? "Kendi okulunuz"
        : "Kapsamınız dışında";

  const yerFiltresiVar = iller.length > 0 || okullar.length > 0;

  /*
   * YOL İZİ — kırılımdan gelindiğinde basılır (12 Ağustos 2026 · istek:
   * "ilçeden öğretmenlere geçince navigasyon kayboluyor, tarayıcının geri
   * düğmesine basmak gerekiyor"). Düz listede `null` döner ve şerit hiç
   * çıkmaz; ne zaman çıktığı için bkz. app/panel/envanter-yolu.ts.
   */
  const yolIziAdimlari = await envanterYolIzi(
    kullanici,
    "Öğretmenler",
    filtreler,
  );

  const disaAktarmaSorgusu = sorguMetni(parametreler, ["sayfa"]);
  const disaAktarmaBaglantisi = disaAktarmaSorgusu
    ? `/panel/ogretmenler/disa-aktar?${disaAktarmaSorgusu}`
    : "/panel/ogretmenler/disa-aktar";

  return (
    <div className="space-y-6">
      {yolIziAdimlari && <KirintiYolu basamaklar={yolIziAdimlari} />}

      <SayfaBasligi
        /*
          GERİ BAĞLANTISI YOK, ŞERİT VAR (29 Ağustos 2026 · istek: "yönetim
          panelindeki tüm kartlara uygula").

          Panodan gelen kullanıcının yolu yukarıdaki kırıntı şeridinde duruyor
          (kırılımdan gelindiyse il/ilçe/okul basamaklarıyla birlikte); burada
          bir de "← Yönetim Paneli" basmak aynı yolu iki kez yazardı.

          PANOYU AÇAMAYAN KULLANICIDA ŞERİT BASILMAZ (danışman öğretmen —
          bkz. app/panel/envanter-yolu.ts; 26 Ağustos 2026 · istek: "en üstte
          Yönetim Paneli linki var, basınca boş sayfa geliyor, profil sayfasına
          dönsün"). Onun bu ekrana geldiği yer Panel'deki kart, dolayısıyla
          dönüşü de Panel — şeridin `null` döndüğü tek hâl bu ve geri bağlantısı
          da tam orada devreye giriyor.
        */
        geri={yolIziAdimlari ? null : { yol: "/panel", etiket: "Panel" }}
        baslik="Öğretmenler"
        aciklama={
          toplam > SAYFA_BOYUTU
            ? `Görüntüleme kapsamı: ${kapsamAciklamasi} · ${toplam} kayıt · sayfa ${sayfa}/${sonSayfa}`
            : `Görüntüleme kapsamı: ${kapsamAciklamasi} · ${toplam} kayıt`
        }
      />

      {/*
        FORMA `id` VERİLDİ (31 Ağustos 2026): sütun süzgeçleri tablonun içinde,
        yani bu formun DIŞINDA duruyor ve ona `form="ogretmen-suzgeci"` ile
        bağlanıyor (bkz. components/SutunSuzgeci.tsx).
      */}
      <form
        id={SUZGEC_FORMU}
        method="get"
        className="rounded-kart border border-cizgi bg-kart p-5 shadow-kart"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-baslik">
            <Filter size={16} className="text-vurgu-metin" aria-hidden />
            Filtreler
          </h2>
          {filtreVar && (
            <Link
              href="/panel/ogretmenler"
              className="inline-flex items-center gap-1 text-sm font-medium text-vurgu-metin"
            >
              <X size={14} aria-hidden />
              Filtreleri temizle
            </Link>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/*
            İL, İLÇE, OKUL, OKUL TÜRÜ, BRANŞ VE AD SÜZGEÇLERİ SÜTUN
            BAŞLIKLARINA TAŞINDI (31 Ağustos 2026 · istek: "bu sayfada aynı" —
            Okullar ekranındaki sütun süzgeçlerinin aynısı).

            KARTTAN SİLİNDİLER, KOPYALANMADILAR: aynı `name` iki denetimde
            bulunsaydı form ikisini de gönderir ve sütundaki kutuya yazan kişi
            karttaki boş kutunun kazandığını görürdü (gerekçenin tamamı
            components/SutunSuzgeci.tsx içinde).

            KARTTA YALNIZCA SÜTUNU OLMAYAN SÜZGEÇ KALIYOR: "Görev aldığı yıl"
            bir sütunu süzmüyor — görev yılları sütunu 27 Ağustos'ta listeden
            kalktı ve bilgi öğretmenin kendi katkı kartında duruyor.
          */}
          <label className="block">
            <span className={SINIF_ETIKET}>Görev aldığı yıl</span>
            <select
              name="yil"
              defaultValue={filtreler.gorevYili ?? ""}
              className={SINIF_SECIM}
            >
              <option value="">Tüm yıllar</option>
              {gorevYiliSecenekleri.map((yil) => (
                <option key={yil} value={yil}>
                  {yil}
                </option>
              ))}
            </select>
          </label>

        </div>

        {/*
          "YALNIZCA DANIŞMAN ÖĞRETMENLER" VE "YALNIZCA GÖREV ALMAMIŞLAR"
          KUTULARI KALKTI (27 Ağustos 2026 · istek: "bunu yapınca … öğretmen
          sayfasındaki bu alana gerek kalmayacak").

          İkisi de aynı ayrımı soruyordu ve o ayrım kalktı: öğretmen ilk
          girişinde doğrudan danışman oluyor (bkz. lib/kullanici/sagla.ts),
          yani "görev almamış öğretmen" artık yalnızca okul bilgisi eksik olan
          kayıt demek — bir süzgeç değil, bir veri düzeltmesi.

          KURAL KATMANI DURUYOR (`yalnizcaDanismanlar`, `yalnizcaGorevsizler`):
          görevini BIRAKAN öğretmen hâlâ rolsüz kalabiliyor, yani soru tümüyle
          anlamsız değil. Kalkan yalnızca ekrandaki iki kutu.
        */}
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <button type="submit" className={SINIF_BIRINCIL_BUTON}>
            Filtrele
          </button>
          {toplam > 0 && (
            <DisaAktarmaBagi yol={disaAktarmaBaglantisi} kayitSayisi={toplam} />
          )}
        </div>
      </form>

      {ogretmenler.length === 0 ? (
        <Kart className="text-metin-yumusak">
          {filtreVar
            ? "Bu filtrelerle eşleşen öğretmen yok."
            : "Kapsamınızda görüntülenecek öğretmen yok."}
        </Kart>
      ) : (
        <div className="overflow-x-auto rounded-kart border border-cizgi bg-kart shadow-kart">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-cizgi bg-zemin text-metin-yumusak">
              <tr>
                <th className="px-4 py-3 font-medium">Ad Soyad</th>
                <th className="px-4 py-3 font-medium">Branş</th>
                <th className="px-4 py-3 font-medium">İl / İlçe</th>
                {/*
                  "GÖREV" SÜTUNU YERİNE "OKUL TÜRÜ" (27 Ağustos 2026 · istek:
                  "bu sütunu kaldır · Görev · yerine okul türü sütunu ekle").

                  Görev sütunu rol rozetlerini basıyordu; aynı bilgi kişinin
                  kendi sayfasında ve sağ üstteki rozetlerde zaten var. Okul
                  türü ise bu listede hiç yoktu — "ilimde kaç imam hatip
                  lisesinde danışman var" sorusunun cevabı okunamıyordu.

                  "GÖREV YILLARI" SÜTUNU SİLİNDİ (aynı istek): rol kayıtlarının
                  tarihlerinden türetiliyordu ve satır başına birkaç yıl
                  basıyordu. Bilgi kaybolmadı — öğretmenin profilindeki katkı
                  kartında görev dönemleri yazıyor.
                */}
                <th className="px-4 py-3 font-medium">Okul türü</th>
                {/*
                  OKUL SÜTUNU İKİ SÜTUN SAĞA ALINDI (31 Ağustos 2026 · istek:
                  "listede okul adı iki sütun sağa kaysın, il ilçe ve okul
                  türünden sonra gelsin").

                  YENİ SIRA DARDAN GENİŞE DEĞİL, GENİŞTEN DARA: önce kişinin
                  kendisi (ad, branş), sonra yeri (il/ilçe → okul türü → okul).
                  Okul adı, il ve türüyle birlikte okunduğunda anlam kazanan en
                  dar basamak; başta durduğunda satırın en uzun hücresi olarak
                  kişiyle yer bilgisinin arasına giriyordu.

                  SÜZGEÇ SATIRI DA AYNI SIRAYA TAŞINDI: sütun süzgeci, altında
                  durduğu sütunu süzmezse başlıklar yalan söyler.
                */}
                <th className="px-4 py-3 font-medium">Okul</th>
                <th className="px-4 py-3 font-medium">Öğrenci</th>
                <th className="px-4 py-3 font-medium">Okul sorumlusu</th>
                <th className="px-4 py-3 font-medium">Telefon</th>
                <th className="px-4 py-3 font-medium">E-posta</th>
              </tr>

              {/*
                SÜZGEÇ SATIRI. Süzgeci olan sütunlar Okullar ekranıyla aynı
                mantıkla seçildi: kişiyi ve okulunu DARALTAN alanlar. Öğrenci
                sayısı, okul sorumlusu, telefon ve e-posta boş kalıyor —
                sayıyı süzmek karşılaştırma gerektirir, iletişim alanları ise
                aramanın değil ulaşmanın konusu.

                İL/İLÇE TEK HÜCREDE İKİ KUTU: sütun başlığı da tek ("İl /
                İlçe"). İl seçilmeden ilçe kapalı — ilçe listesi ilden türüyor.

                OKUL BİR AÇILIR LİSTE, metin kutusu değil: filtre kurum
                KODUYLA çalışıyor (`okul` parametresi bir sayıdır, bkz.
                filtreler.ts) ve okul adı yazdırmak, aynı adı taşıyan iki
                okulu ayırt edemezdi.
              */}
              <SutunSuzgecSatiri>
                <SutunMetinSuzgeci
                  form={SUZGEC_FORMU}
                  ad="ara"
                  deger={filtreler.ara}
                  ipucu="Ad veya soyad"
                />
                <SutunMetinSuzgeci
                  form={SUZGEC_FORMU}
                  ad="brans"
                  deger={filtreler.brans}
                  ipucu="Branş"
                />
                {yerFiltresiVar ? (
                  <SutunSuzgecHucresi>
                    <SuzgecSecimKutusu
                      form={SUZGEC_FORMU}
                      ad="il"
                      deger={filtreler.ilKodu}
                      bosEtiket={
                        iller.length <= 1 ? (iller[0]?.ad ?? "—") : "Tüm iller"
                      }
                      etiket="İl"
                      devreDisi={iller.length <= 1}
                      secenekler={iller.map((il) => ({
                        deger: il.ilKodu,
                        etiket: il.ad,
                      }))}
                    />
                    <SuzgecSecimKutusu
                      form={SUZGEC_FORMU}
                      ad="ilce"
                      deger={filtreler.ilceKodu}
                      bosEtiket={
                        ilceler.length === 0 ? "Önce il seçin" : "Tüm ilçeler"
                      }
                      etiket="İlçe"
                      devreDisi={ilceler.length === 0}
                      secenekler={ilceler.map((ilce) => ({
                        deger: ilce.ilceKodu,
                        etiket: ilce.ad,
                      }))}
                    />
                  </SutunSuzgecHucresi>
                ) : (
                  <SutunSuzgecBoslugu />
                )}
                <SutunSecimSuzgeci
                  form={SUZGEC_FORMU}
                  ad="okulTuru"
                  deger={filtreler.okulTuru}
                  bosEtiket="Tüm okul türleri"
                  etiket="Okul türü"
                  secenekler={okulTuruSecenekleri(okulTurleri)
                    .filter((tur) => tur !== "")
                    .map((tur) => ({ deger: tur, etiket: tur }))}
                />
                <SutunSecimSuzgeci
                  form={SUZGEC_FORMU}
                  ad="okul"
                  deger={
                    filtreler.kurumKodu ? String(filtreler.kurumKodu) : null
                  }
                  bosEtiket={okullar.length === 0 ? "Önce il seçin" : "Tüm okullar"}
                  etiket="Okul"
                  devreDisi={okullar.length === 0}
                  secenekler={okullar.map((okul) => ({
                    deger: String(okul.kurumKodu),
                    etiket: okul.ad,
                  }))}
                />
                <SutunSuzgecDugmesi form={SUZGEC_FORMU} colSpan={4} />
              </SutunSuzgecSatiri>
            </thead>
            <tbody>
              {ogretmenler.map((ogretmen) => {
                return (
                  <tr
                    key={ogretmen.id}
                    className="border-b border-cizgi last:border-0"
                  >
                    <td className="px-4 py-3 font-medium text-metin">
                      {/*
                       * Bağlantı kapsam kontrolü YERİNE geçmez: hedef sayfa
                       * aynı merkezi filtreden yeniden geçer ve kapsam dışı
                       * id'de 404 döner.
                       */}
                      <Link
                        href={`/panel/ogretmenler/${ogretmen.id}`}
                        className="transition hover:text-vurgu-metin hover:underline"
                      >
                        {ogretmen.ad} {ogretmen.soyad}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-metin-yumusak">
                      {ogretmen.brans ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-metin-yumusak">
                      {ogretmen.il?.ad ?? ogretmen.kurum?.il?.ad ?? "—"}
                      {(() => {
                        const ilce =
                          ogretmen.ilce?.ad ?? ogretmen.kurum?.ilce?.ad;
                        return ilce ? ` / ${ilce}` : "";
                      })()}
                    </td>
                    <td className="px-4 py-3 text-metin-yumusak">
                      {ogretmen.kurum?.okulTuru ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-metin-yumusak">
                      {ogretmen.kurum?.ad ??
                        (ogretmen.beyanOkulAdi
                          ? `${ogretmen.beyanOkulAdi} (listede yok)`
                          : "—")}
                    </td>
                    <td className="px-4 py-3 text-metin-yumusak">
                      {ogretmen._count.danismanAtamalari}
                    </td>
                    {/*
                      İLETİŞİM SÜTUNLARI TIKLANABİLİR: `tel:` ve `mailto:` —
                      rol envanterindeki koordinatör tablosuyla aynı biçim.
                    */}
                    {/*
                      İŞARET SÜTUNU: yalnızca işareti OLAN satırda bir şey
                      yazıyor. "Hayır" basılsaydı sütun, olmayan bir durumu 80
                      satır boyunca tekrarlardı — sorulan şey "kim sorumlu",
                      "kim değil" değil.
                    */}
                    <td className="px-4 py-3">
                      {ogretmen.ogretmenProfil?.yegitekOkulSorumlusu ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-olumlu-zemin px-2 py-0.5 text-xs font-medium text-olumlu-metin">
                          <ShieldCheck size={13} aria-hidden />
                          YEĞİTEK
                        </span>
                      ) : (
                        <span className="text-metin-yumusak">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {ogretmen.ogretmenProfil?.telefon ? (
                        <a
                          href={`tel:${ogretmen.ogretmenProfil.telefon}`}
                          className="text-vurgu-metin"
                        >
                          {ogretmen.ogretmenProfil.telefon}
                        </a>
                      ) : (
                        <span className="text-metin-yumusak">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {ogretmen.ogretmenProfil?.eposta ? (
                        <a
                          href={`mailto:${ogretmen.ogretmenProfil.eposta}`}
                          className="break-all text-vurgu-metin"
                        >
                          {ogretmen.ogretmenProfil.eposta}
                        </a>
                      ) : (
                        <span className="text-metin-yumusak">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {sonSayfa > 1 && (
        <nav
          aria-label="Sayfalama"
          className="flex flex-wrap items-center justify-between gap-3"
        >
          <p className="text-sm text-metin-yumusak">
            {(sayfa - 1) * SAYFA_BOYUTU + 1}–
            {Math.min(sayfa * SAYFA_BOYUTU, toplam)} / {toplam} kayıt
          </p>
          <div className="flex items-center gap-2">
            {sayfa > 1 ? (
              <Link
                href={sayfaBaglantisi(parametreler, sayfa - 1)}
                className={SINIF_SAYFA_BUTON}
              >
                <ChevronLeft size={15} aria-hidden />
                Önceki
              </Link>
            ) : (
              <span className={`${SINIF_SAYFA_BUTON} opacity-40`}>
                <ChevronLeft size={15} aria-hidden />
                Önceki
              </span>
            )}
            <span className="text-sm text-metin-yumusak">
              Sayfa {sayfa} / {sonSayfa}
            </span>
            {sayfa < sonSayfa ? (
              <Link
                href={sayfaBaglantisi(parametreler, sayfa + 1)}
                className={SINIF_SAYFA_BUTON}
              >
                Sonraki
                <ChevronRight size={15} aria-hidden />
              </Link>
            ) : (
              <span className={`${SINIF_SAYFA_BUTON} opacity-40`}>
                Sonraki
                <ChevronRight size={15} aria-hidden />
              </span>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}
