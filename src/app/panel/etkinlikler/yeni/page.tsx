import { CalendarPlus } from "lucide-react";
import Link from "next/link";
import {
  BilgiKutusu,
  Kart,
  KartBasligi,
  KirintiYolu,
  SayfaBasligi,
  SINIF_BIRINCIL_BUTON,
  SINIF_GIRDI,
  SINIF_IKINCIL_BUTON,
} from "@/components/ui";
import { AYAR_ANAHTARLARI, ayarSayi } from "@/lib/ayar";
import { oturumKullanicisiZorunlu } from "@/lib/auth/oturum";
import { prisma } from "@/lib/db";
import {
  KAPSAM_ETIKETLERI,
  kapsamSecenekleri,
  onayDurumuBelirle,
} from "@/lib/faaliyet/kurallar";
import {
  KATILIM_BICIMI_ETIKETLERI,
  KATILIM_BICIMLERI,
} from "@/lib/kazanim/kurallar";
import { girdiTarihi } from "@/lib/tarih";
import {
  danismanKurumKodu,
  disKullaniciMi,
  koordinatorIlKodu,
  ogrenciMi,
  projeYoneticisiMi,
} from "@/lib/yetki/izinler";
import { faaliyetOlusturEylemi } from "../eylemler";

export const dynamic = "force-dynamic";

/**
 * Faaliyet açma formu.
 *
 * Form yalnızca rolün açabildiği kapsamları TEKLİF eder; asıl kontrol sunucu
 * eyleminde tekrarlanır. Yer bilgisi (okul / il) forma sorulmaz, roldan
 * türetilir — tek istisna YEĞİTEK'in il faaliyetinde ili seçmesidir.
 */

const SINIF_ETIKET = "text-sm font-medium text-metin";

export default async function YeniFaaliyetSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ hata?: string }>;
}) {
  const { hata } = await searchParams;
  const kullanici = await oturumKullanicisiZorunlu();
  const kapsamlar = kapsamSecenekleri(kullanici);

  if (kapsamlar.length === 0) {
    return (
      <Kart>
        <KartBasligi
          baslik="Yeni etkinlik"
          aciklama="Etkinlik açma yetkiniz yok. Öğretmen her kapsamda (okul dışı olanlar il koordinatörü onayıyla), il koordinatörü il ve ulusal etkinlik açabilir; mezun, paydaş temsilcisi ve mentör il ve ulusal etkinlik bildirebilir. Öğrenci etkinlik açmaz, mevcut etkinliklere başvurur."
        />
        <Link href="/panel/etkinlikler" className={SINIF_IKINCIL_BUTON}>
          Etkinliklere dön
        </Link>
      </Kart>
    );
  }

  const merkezMi = projeYoneticisiMi(kullanici);
  const ogrenci = ogrenciMi(kullanici);
  // Mezun / paydaş temsilcisi / mentör: etkinliği "bildirir", açmaz — kapsamı
  // il ve ulusal, hepsi onaya tabi (bkz. lib/faaliyet/kurallar.ts).
  const disKullanici = disKullaniciMi(kullanici);
  const kurumKodu = danismanKurumKodu(kullanici) ?? kullanici.kurumKodu;

  const [okul, il, iller, ilceler, gruplar] = await Promise.all([
    kapsamlar.includes("OKUL") && kurumKodu !== null
      ? prisma.kurum.findUnique({
          where: { kurumKodu },
          select: { ad: true },
        })
      : null,
    koordinatorIlKodu(kullanici)
      ? prisma.il.findUnique({
          where: { ilKodu: koordinatorIlKodu(kullanici)! },
          select: { ad: true },
        })
      : null,
    // İl seçimi yalnızca YEĞİTEK'e sorulur; koordinatörün ili roldan gelir.
    merkezMi ? prisma.il.findMany({ orderBy: { ad: "asc" } }) : [],
    /*
     * İlçe daraltması yalnızca ili önceden BİLİNEN kullanıcıya sorulur. YEĞİTEK
     * ili aynı formda seçtiği için ilçe listesi JavaScript'siz doğru
     * doldurulamaz; yanlış ilin ilçesini teklif etmektense hiç sormuyoruz.
     * Sunucu eylemi yine de ilçenin faaliyetin iline ait olduğunu doğrular.
     */
    koordinatorIlKodu(kullanici)
      ? prisma.ilce.findMany({
          where: { ilKodu: koordinatorIlKodu(kullanici)! },
          orderBy: { ad: "asc" },
          select: { ilceKodu: true, ad: true },
        })
      : [],
    prisma.calismaGrubu.findMany({
      where: { aktif: true },
      orderBy: { siraNo: "asc" },
      select: { id: true, ad: true },
    }),
  ]);

  // Sınır koda gömülü değil, sistem ayarından gelir; kullanıcıya da o yazılır.
  const gorselMaksBayt = await ayarSayi(
    AYAR_ANAHTARLARI.GORSEL_MAKS_BAYT,
    5 * 1024 * 1024,
  );

  const bugun = girdiTarihi(new Date());
  const onayaTabiKapsamlar = kapsamlar.filter(
    (kapsam) => onayDurumuBelirle(kullanici, kapsam) === "BEKLIYOR",
  );

  const yerAciklamasi = (kapsam: (typeof kapsamlar)[number]) => {
    if (kapsam === "OKUL") return okul?.ad ?? "okulunuz";
    if (kapsam === "IL") return merkezMi ? "seçtiğiniz il" : (il?.ad ?? "iliniz");
    return "ülke geneli";
  };

  return (
    <div className="space-y-6">
      {/*
        KIRINTI YOLU (29 Ağustos 2026 · istek: "etkinlikler sayfasındaki
        kartlara girince profile dönüyor, o da etkinliklere dönsün").

        Başlığın geri bağlantısı verilmediği için SayfaBasligi VARSAYILANI
        basıyordu: "← Profil". Bu ekrana Profil'den değil etkinlik listesinden
        (ya da etkinliğin kendisinden) geliniyor; şerit o yolu basamaklarıyla
        gösteriyor, `geri={null}` de varsayılanın üste binmesini engelliyor.
      */}
      <KirintiYolu
        basamaklar={[
          { etiket: "Etkinlikler", yol: "/panel/etkinlikler" },
          { etiket: ogrenci ? "Yeni etkinlik önerisi" : "Yeni etkinlik" },
        ]}
      />

      {/*
        12 Ağustos 2026 · istek: dış kullanıcıda da "Yeni etkinlik" yazsın.
        Başlık, Etkinlikler ekranındaki düğmeyle aynı adı taşır; tıklanan
        düğmeyle açılan sayfanın adı ayrışmasın.
      */}
      <SayfaBasligi
        baslik={ogrenci ? "Yeni etkinlik önerisi" : "Yeni etkinlik"}
        geri={null}
        /*
          GÖREVLİNİN AÇIKLAMA SATIRI KALKTI (20 Ağustos 2026 · istek:
          "Etkinliğin yeri açtığınız göreve göre belirlenir; ayrıca seçmenize
          gerek yoktur. Bu yazı kalksın"). Öğrenci ve dış kullanıcıdaki
          satırlar, sordukları soruya (ili kim seçiyor?) cevap verdiği için
          duruyor.
        */
        aciklama={
          ogrenci
            ? "Etkinliğin yeri okul ve il bilginizden gelir; ayrıca seçmenize gerek yoktur."
            : disKullanici
              ? "Etkinliğin ili kayıtlı ilinizden gelir; ayrıca seçmenize gerek yoktur."
              : undefined
        }
      />

      {hata && (
        <div className="rounded-kart border border-hata-cizgi bg-hata-zemin px-4 py-3 text-sm text-hata-metin">
          {hata}
        </div>
      )}

      {onayaTabiKapsamlar.length > 0 &&
        (ogrenci ? (
          <BilgiKutusu cesit="uyari">
            Önerdiğiniz etkinlik, il koordinatörünüz veya YEĞİTEK onayladıktan
            sonra yayına girer. Onaya kadar yalnızca siz ve onaylayacak kişiler
            görebilir; sonucu bildirim olarak alırsınız.
          </BilgiKutusu>
        ) : disKullanici ? (
          /*
            Dış kullanıcının HER etkinliği onaya tabi — kapsamı ne olursa olsun
            (bkz. faaliyetOnayGerekiyorMu). Metin bunu açıkça söylüyor: kişi
            "ulusal olmasaydı hemen yayınlanırdı" diye düşünmemeli.
          */
          <BilgiKutusu cesit="uyari">
            Bildirdiğiniz etkinlik, ilinizin koordinatörü veya YEĞİTEK
            onayladıktan sonra yayına girer. Onaya kadar yalnızca siz ve
            onaylayacak kişiler görebilir; sonucu bildirim olarak alırsınız.
          </BilgiKutusu>
        ) : (
          <BilgiKutusu cesit="uyari">
            Girilen etkinlik il GençTek koordinatörü onayından sonra yayına
            girer.
          </BilgiKutusu>
        ))}

      {/* encType verilmez: sunucu eylemi kullanan formda React'in kendisi
          multipart'a geçer, elle vermek uyarı üretir. */}
      <form action={faaliyetOlusturEylemi} className="space-y-6">
        <Kart>
          <KartBasligi baslik="Etkinlik bilgileri" Ikon={CalendarPlus} />

          <div className="space-y-4">
            {/*
              ETKİNLİK KATEGORİSİ ALANI KALKTI (20 Ağustos 2026 · istek:
              "etkinlik oluştururken Etkinlik kategorisi alanı kalksın").

              Kategori artık SEÇİLEN PROGRAMDAN türetiliyor (bkz.
              eylemler.ts · faaliyetOlusturEylemi): program bir gruba aittir,
              program seçilmezse etkinlik İl Etkinliği sayılır. Kayıtlı
              etkinliklerin kategori rozeti yerinde duruyor.
            */}

            {/*
              PROGRAM ALANI KALKTI (21 Ağustos 2026 · istek: "yeni etkinlik
              oluştururken Program (listede yoksa 'Diğer') bu alan
              olmayacak").

              Alan iki iş yapıyordu: etkinliğin adını sabit listeden getirmek
              ve kategoriyi belirlemek. Açanların çoğu zaten "Diğer"i seçip adı
              elle yazıyordu; liste, iki adım öteden gelen bir soruyu formun
              başına koyuyordu.

              SUNUCU TARAFI DEĞİŞMEDİ (eylemler.ts · faaliyetOlusturEylemi):
              program gönderilmediğinde kategori İl Etkinliği olur ve ad
              aşağıdaki alandan gelir — kural zaten böyleydi. Kayıtlı
              etkinliklerin program bağlantısı ve rozeti yerinde duruyor.
            */}

            <label className="block">
              <span className={SINIF_ETIKET}>Etkinlik adı</span>
              <input
                type="text"
                name="ad"
                required
                maxLength={250}
                className={SINIF_GIRDI}
                placeholder="Örn. Robot Futbol Ligi"
              />
            </label>

            <label className="block">
              <span className={SINIF_ETIKET}>Açıklama</span>
              <textarea
                name="aciklama"
                required
                rows={5}
                className={SINIF_GIRDI}
                placeholder="Etkinliğin içeriği, katılım koşulları, yeri, varsa iş birliği yapılan kurum ve kuruluşlar."
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className={SINIF_ETIKET}>Kapsam</span>
                <select
                  name="kapsam"
                  required
                  defaultValue={kapsamlar[0]}
                  className={SINIF_GIRDI}
                >
                  {kapsamlar.map((kapsam) => (
                    <option key={kapsam} value={kapsam}>
                      {KAPSAM_ETIKETLERI[kapsam]} — {yerAciklamasi(kapsam)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className={SINIF_ETIKET}>Kontenjan</span>
                <input
                  type="number"
                  name="kontenjan"
                  required
                  min={1}
                  defaultValue={20}
                  className={SINIF_GIRDI}
                />
              </label>
            </div>

            {merkezMi && (
              <label className="block">
                <span className={SINIF_ETIKET}>
                  İl <span className="text-metin-yumusak">(il geneli etkinlikte zorunlu)</span>
                </span>
                <select name="ilKodu" defaultValue="" className={SINIF_GIRDI}>
                  <option value="">Seçiniz</option>
                  {iller.map((secenek) => (
                    <option key={secenek.ilKodu} value={secenek.ilKodu}>
                      {secenek.ad}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {ilceler.length > 0 && (
              <label className="block">
                <span className={SINIF_ETIKET}>
                  İlçe{" "}
                  <span className="text-metin-yumusak">
                    (isteğe bağlı, yalnızca il geneli faaliyette kullanılır)
                  </span>
                </span>
                <select name="ilceKodu" defaultValue="" className={SINIF_GIRDI}>
                  <option value="">İl geneli</option>
                  {ilceler.map((ilce) => (
                    <option key={ilce.ilceKodu} value={ilce.ilceKodu}>
                      {ilce.ad}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className={SINIF_ETIKET}>
                  Katılım biçimi{" "}
                  <span className="text-metin-yumusak">(isteğe bağlı)</span>
                </span>
                <select
                  name="katilimBicimi"
                  defaultValue=""
                  className={SINIF_GIRDI}
                >
                  <option value="">Belirtilmedi</option>
                  {KATILIM_BICIMLERI.map((bicim) => (
                    <option key={bicim} value={bicim}>
                      {KATILIM_BICIMI_ETIKETLERI[bicim]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={SINIF_ETIKET}>
                  Hedef kitle{" "}
                  <span className="text-metin-yumusak">(isteğe bağlı)</span>
                </span>
                <input
                  type="text"
                  name="hedefKitle"
                  maxLength={200}
                  placeholder="9. sınıflar, veliler, öğretmenler…"
                  className={SINIF_GIRDI}
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="block">
                <span className={SINIF_ETIKET}>Etkinlik tarihi</span>
                <input
                  type="datetime-local"
                  name="tarih"
                  required
                  className={SINIF_GIRDI}
                />
              </label>
              <label className="block">
                <span className={SINIF_ETIKET}>Etkinlik bitişi</span>
                <input
                  type="datetime-local"
                  name="bitisTarihi"
                  className={SINIF_GIRDI}
                />
                <span className="mt-1 block text-sm text-metin-yumusak">
                  Tek günlükse boş bırakın.
                </span>
              </label>
              <label className="block">
                <span className={SINIF_ETIKET}>Başvuru başlangıcı</span>
                <input
                  type="date"
                  name="basvuruBaslangic"
                  defaultValue={bugun}
                  className={SINIF_GIRDI}
                />
              </label>
              <label className="block">
                <span className={SINIF_ETIKET}>Başvuru bitişi</span>
                <input
                  type="date"
                  name="basvuruBitis"
                  className={SINIF_GIRDI}
                />
              </label>
            </div>
            <p className="-mt-2 text-sm text-metin-yumusak">
              Geçmiş tarihli bir etkinlik giriyorsanız başvuru tarihlerine
              gerek yok: etkinlik listede görünür, başvuruya kapalı olur.
            </p>
            <label className="block">
              {/* "(isteğe bağlı)" notu kalktı (21 Ağustos 2026 · istek):
                  alan zaten `required` değil ve altındaki satır biçim ile
                  boyut sınırını söylüyor. */}
              {/*
                ALAN ADI SADECE "GÖRSEL" (26 Ağustos 2026 · istek: "Tanıtıcı
                görsel bunu sadece görsel yapalım"). Etkinlik açılırken
                yüklenen tek bir dosya var ve ne işe yaradığını altındaki satır
                söylüyor; "tanıtıcı" sıfatı formda ayırt edeceği ikinci bir
                görsel olmadığı için bilgi taşımıyordu.

                EK LİSTESİNDEKİ "Tanıtıcı görsel" ROZETİ DURUYOR: orada
                gerçekten bir ayrım var — yüklenmiş görsellerden hangisinin
                kapak olduğunu o rozet söylüyor.
              */}
              <span className={SINIF_ETIKET}>Görsel</span>
              <input
                type="file"
                name="kapakGorseli"
                accept="image/jpeg,image/png,image/webp"
                className={`${SINIF_GIRDI} file:mr-3 file:rounded-md file:border-0 file:bg-zemin file:px-3 file:py-1 file:text-sm file:text-metin`}
              />
              <span className="mt-1 block text-sm text-metin-yumusak">
                jpg, png veya webp; en fazla{" "}
                {(gorselMaksBayt / (1024 * 1024)).toFixed(0)} MB.
              </span>
            </label>
          </div>
        </Kart>

        <Kart>
          <KartBasligi
            baslik="İlgili çalışma grupları"
            aciklama="Etkinliğin ilgili olduğunu düşündüğünüz çalışma gruplarını işaretleyiniz."
          />
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {gruplar.map((grup) => (
              <label
                key={grup.id}
                className="flex items-center gap-2 rounded-md border border-cizgi px-3 py-2 text-sm text-metin"
              >
                <input
                  type="checkbox"
                  name="grupId"
                  value={grup.id}
                  className="h-4 w-4 rounded border-cizgi accent-[var(--renk-birincil)]"
                />
                {grup.ad}
              </label>
            ))}
          </div>
        </Kart>

        {/*
          "İŞ BİRLİĞİ YAPILAN PAYDAŞLAR" KARTI KALKTI (20 Ağustos 2026 ·
          istek: "İş birliği yapılan paydaşlar bu alan kalkacak").

          Bağ tümden kaybolmadı: paydaş, etkinliğin DETAY ekranından
          bağlanmaya devam ediyor ve katkısı da orada yazılıyor. Açılış formu
          zaten uzundu; iş birliği çoğu zaman etkinlik yürürken netleşiyor.
        */}

        <div className="flex flex-wrap gap-3">
          <button type="submit" className={SINIF_BIRINCIL_BUTON}>
            Etkinliği oluştur
          </button>
          <Link href="/panel/etkinlikler" className={SINIF_IKINCIL_BUTON}>
            Vazgeç
          </Link>
        </div>
      </form>
    </div>
  );
}
