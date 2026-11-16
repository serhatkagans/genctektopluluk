import Link from "next/link";
import { Rozet } from "@/components/ui";
import { YOLCULUK_SEVIYELERI } from "@/lib/yolculuk/kurallar";
import type { SeviyeDagilimi } from "@/lib/yolculuk/ogrencilerim";

/**
 * GENÇTEK YOLCULUĞUNUN AŞAMA ŞERİDİ — yedi seviye ve kişinin durduğu basamak.
 *
 * AYRI BİLEŞEN (22 Ağustos 2026 · istek: "panelde GençTek Yolculuğum'un altına
 * … 'Buradasın' bunu da ekleyelim"). Şerit yalnızca yolculuk ekranındaydı;
 * panele de gerekince kopyalanacaktı ve aynı işaretleme iki dosyada ayrı ayrı
 * yaşayacaktı — seviye eklendiğinde ya da renkler değiştiğinde biri geride
 * kalırdı.
 *
 * ŞERİTTE HİÇ YILDIZ YOK (31 Ağustos 2026 · istek: "bu başlıktaki yıldızlar
 * kalsın ama alttaki yıldızlar kalksın").
 *
 * Tarihçesi: önce basamakların altında "8 puan ve üzeri" yazıyordu ve
 * yolculuğu bir sayı cetveline çeviriyordu; 28 Ağustos'ta yerine "3 yıldız"
 * geldi. O satır da kalktı — basamağın kaçıncı olduğunu başındaki SIRA
 * NUMARASI söylüyor ve kişinin kendi yıldızları sayfanın başlığında, seviye
 * adının yanında duruyor (bkz. SeviyeYildizlari). Yıldız artık yalnızca
 * KİŞİNİN durumunu anlatıyor, cetvelin çentiklerini değil.
 *
 * İKİ KİP, TEK ŞERİT (28 Ağustos 2026 · istek: "kaç öğrencisi Hello World
 * aşamasında onu yazdırıyoruz"):
 *   · `seviyeKodu` → kişinin kendi yolculuğu; durduğu basamak "Buradasın" ile
 *     işaretli, sonrası soluk.
 *   · `dagilim`   → öğretmenin ekranı; her basamakta kaç öğrenci olduğu ve
 *     basamağın öğretmene göre yazılmış açıklaması. Burada "buradasın" yok,
 *     çünkü şeritte duran öğretmen değil öğrencileri; soluk olanlar da
 *     ulaşılmamış basamaklar değil ÖĞRENCİSİ OLMAYAN basamaklar.
 *
 * Şerit ikiye BÖLÜNMEDİ: basamakların sırası, adı ve görünümü tek yerde
 * kalsın diye. İki bileşen olsaydı seviye eklendiğinde biri geride kalırdı —
 * bu dosyanın var oluş sebebi zaten o.
 *
 * SEVİYE KODU DIŞARIDAN GELİYOR, hesap içeride yapılmıyor: kişinin seviyesi
 * `lib/yolculuk` hesabından doğuyor ve bileşenin işi onu çizmek. İki yerde iki
 * ayrı formül, kartın "Üretimde" derken şeridin "Harekette"yi işaretlemesi
 * demek olurdu.
 */
export function YolculukSeridi({
  seviyeKodu,
  dagilim,
  listeBaglantilari,
  seciliListeKodu,
}: {
  seviyeKodu?: string;
  dagilim?: SeviyeDagilimi[];
  /**
   * Öğretmen kipinde basamağın sayısını o basamaktaki öğrencilerin listesine
   * bağlar (16 Kasım 2026 · istek: "keşifte kim varmış görmek istiyorum").
   * Verilmezse sayı düz metin kalır (panel kartı).
   */
  listeBaglantilari?: Record<string, string>;
  /** Listesi açık olan basamak; kartı vurgulu çizilir. */
  seciliListeKodu?: string | null;
}) {
  const seviyeSirasi = YOLCULUK_SEVIYELERI.findIndex(
    (seviye) => seviye.kod === seviyeKodu,
  );
  const ogrenciSayisi = (kod: string): number =>
    dagilim?.find((satir) => satir.seviye.kod === kod)?.ogrenciSayisi ?? 0;

  return (
    /*
      Yatay kaydırma ŞERİDİN KENDİ KUTUSUNDA: yedi aşama dar ekranda sığmıyor
      ve sayfanın tamamının yana kaymasına izin verilmiyor.
    */
    <ol className="flex gap-3 overflow-x-auto pb-1">
      {YOLCULUK_SEVIYELERI.map((seviye, sira) => {
        const sayi = ogrenciSayisi(seviye.kod);
        // Öğretmen kipinde "ulaşıldı", öğrencisi olan basamak demektir.
        const ulasildi = dagilim ? sayi > 0 : sira <= seviyeSirasi;
        const suAn = dagilim
          ? seciliListeKodu === seviye.kod
          : sira === seviyeSirasi;
        return (
          <li
            key={seviye.kod}
            aria-current={suAn ? "step" : undefined}
            className={`min-w-52 flex-1 rounded-kart border p-4 transition ${
              suAn
                ? "border-vurgu bg-vurgu-zemin"
                : ulasildi
                  ? "border-cizgi bg-kart"
                  : "border-cizgi bg-zemin opacity-60"
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  ulasildi
                    ? "bg-birincil text-birincil-metin"
                    : "bg-kart text-metin-yumusak"
                }`}
              >
                {sira + 1}
              </span>
              <p className="font-semibold text-baslik">{seviye.ad}</p>
            </div>
            {/*
              BASAMAK YILDIZI ŞERİTTEN KALKTI (31 Ağustos 2026 · istek: "bu
              başlıktaki yıldızlar kalsın ama alttaki yıldızlar kalksın").

              28 Ağustos'ta "8 puan ve üzeri" satırının yerine gelmişti; işi
              basamağın kaç yıldıza karşılık geldiğini söylemekti. Ama o bilgiyi
              başındaki SIRA NUMARASI zaten söylüyor (üçüncü basamak = üç
              yıldız) ve kişinin kendi yıldızları sayfanın başlığında, seviye
              adının yanında duruyor (bkz. SeviyeYildizlari). Şerit böylece yedi
              kart boyunca aynı sayıyı iki kez yazmayı bırakıyor.
            */}
            <p className="mt-2 text-sm text-metin-yumusak">
              {dagilim ? seviye.ogretmenAciklamasi : seviye.aciklama}
            </p>
            {suAn && !dagilim && (
              <span className="mt-3 inline-block">
                <Rozet cesit="vurgu">Buradasın</Rozet>
              </span>
            )}
            {/*
              SIFIR DA YAZILIR: "0 öğrenci" boş bir basamağı gösteriyor ve
              öğretmenin bakması gereken yer çoğu zaman orası. Satır
              gizlenseydi kart, sayısı olmayanla sayısı yazılmayan arasında
              fark bırakmazdı.
            */}
            {dagilim &&
              (listeBaglantilari?.[seviye.kod] && sayi > 0 ? (
                <Link
                  href={listeBaglantilari[seviye.kod]}
                  className="mt-3 inline-block font-baslik text-lg font-extrabold text-vurgu-metin underline-offset-4 hover:underline"
                >
                  {sayi} öğrenci →
                </Link>
              ) : (
                <p className="mt-3 font-baslik text-lg font-extrabold text-baslik">
                  {sayi} öğrenci
                </p>
              ))}
          </li>
        );
      })}
    </ol>
  );
}
