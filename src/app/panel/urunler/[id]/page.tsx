import {
  Eye,
  EyeOff,
  ExternalLink,
  Pencil,
  Store,
  Users,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Kart,
  KirintiYolu,
  SayfaBasligi,
  SINIF_BIRINCIL_BUTON,
  SINIF_IKINCIL_BUTON,
} from "@/components/ui";
import { oturumKullanicisiZorunlu } from "@/lib/auth/oturum";
import { prisma } from "@/lib/db";
import {
  sahipKumesi,
  sayacArtmaliMi,
  sayiYaz,
  urunGorunurMu,
  urunVitrinDurumu,
} from "@/lib/market/kurallar";
import { gorselMi, kapakEkiSec } from "@/lib/kazanim/kapak";
import { uygulamaYolu } from "@/lib/ortam";
import { tarihYaz } from "@/lib/tarih";
import { erisimLogla } from "@/lib/yetki/log";
import { paylasimiDegistirEylemi } from "../eylemler";

export const dynamic = "force-dynamic";

/**
 * Market ürün detayı (I).
 *
 * GÖRÜNTÜLENME SAYACI BURADA ARTAR. Sayacı bir GET isteğinde artırmak genelde
 * kaçınılan bir şeydir ama vitrin sayacının tanımı tam olarak budur: sayfanın
 * açılması. Sahibinin kendi bakışı sayılmaz (bkz. sayacArtmaliMi).
 *
 * TEKİLLEŞTİRME YOK: aynı kişi iki kez bakarsa iki sayılır. Tekil ziyaretçi
 * saymak kişi başına görüntüleme kaydı ya da çerez işaretlemesi gerektirirdi;
 * vitrin sayacı için bu maliyet gereksiz (bkz. göç dosyası).
 */
export default async function UrunDetaySayfasi({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: hamId } = await params;
  const kullanici = await oturumKullanicisiZorunlu();

  const id = Number.parseInt(hamId, 10);
  if (!Number.isInteger(id)) notFound();

  const urun = await prisma.kullaniciKazanim.findFirst({
    where: { id, tip: "URUN" },
    select: {
      id: true,
      baslik: true,
      aciklama: true,
      gelistirenEkip: true,
      tarih: true,
      baglantiUrl: true,
      markettePaylasilsin: true,
      marketOnayDurumu: true,
      goruntulenmeSayisi: true,
      baglantiTiklamasi: true,
      kullaniciId: true,
      kullanici: {
        select: {
          ad: true,
          soyad: true,
          roller: { where: { bitisTarihi: null }, select: { rolKodu: true } },
        },
      },
      baglantilar: {
        select: { id: true, adres: true, etiket: true },
        orderBy: { siraNo: "asc" },
      },
      ekler: {
        select: { id: true, dosyaAdi: true, mimeTipi: true, kapakMi: true },
        orderBy: { yuklenmeTarihi: "asc" },
      },
    },
  });

  /*
   * Paylaşılmamış ürüne başkası ERİŞEMEZ. 403 değil 404: 403, "böyle bir ürün
   * var ama sana kapalı" bilgisini sızdırırdı (permissions.md · Bölüm 4).
   */
  if (
    !urun ||
    !urunGorunurMu(
      {
        sahipKullaniciId: urun.kullaniciId,
        markettePaylasilsin: urun.markettePaylasilsin,
        marketOnayDurumu: urun.marketOnayDurumu,
      },
      kullanici.id,
    )
  ) {
    notFound();
  }

  const kendisiMi = urun.kullaniciId === kullanici.id;

  if (sayacArtmaliMi(urun.kullaniciId, kullanici.id)) {
    await prisma.kullaniciKazanim.update({
      where: { id: urun.id },
      data: { goruntulenmeSayisi: { increment: 1 } },
    });

    // Sayaç bir vitrin sayısıdır, denetim kaydı değil: kimin baktığı erişim
    // loguna ayrıca yazılır.
    await erisimLogla({
      kullaniciId: kullanici.id,
      islem: "GORUNTULEME",
      hedefTip: "PROFIL",
      hedefId: urun.kullaniciId,
      detay: `Markette ürün görüntülendi: ${urun.baslik}`,
    });
  }

  // Yalnızca görseller basılıyor; diğer belgeler bağlantı olarak veriliyor.
  const tumGorseller = urun.ekler.filter((ek) => gorselMi(ek.mimeTipi));
  const digerEkler = urun.ekler.filter((ek) => !gorselMi(ek.mimeTipi));

  /*
   * ÜRÜN GÖRSELİ (kapak) SAYFANIN BAŞINDA, tek başına (28 Ağustos 2026 ·
   * istek). Vitrin kartında görünen görsel detayda da ilk görünmeli; kapak
   * "destekleyici görseller" ızgarasının içinde ikinci sırada durursa,
   * sahibinin kart için seçtiği görselin hangisi olduğu okunmaz.
   *
   * Kapak aşağıdaki ızgaradan ÇIKARILIR: aynı dosyayı iki kez basmak, ikinci
   * bir görsel yüklenmiş izlenimi verirdi.
   */
  const kapak = kapakEkiSec(urun.ekler);
  const gorseller = tumGorseller.filter((ek) => ek.id !== kapak?.id);
  const kume = sahipKumesi(urun.kullanici.roller.map((r) => r.rolKodu));

  return (
    <div className="space-y-6">
      {/*
        KIRINTI YOLU (29 Ağustos 2026 · istek: "vitrin de profile dönüyor").
        Yerinde tek başına "← GençTek Vitrin" bağlantısı vardı: dönülecek yeri
        söylüyor, bulunulan yeri söylemiyordu. Şerit ikisini birden basıyor ve
        panelin her yerinde aynı biçimde (bkz. components/ui.tsx · KirintiYolu).
      */}
      <KirintiYolu
        basamaklar={[
          { etiket: "GençTek Vitrin", yol: "/panel/urunler" },
          { etiket: urun.baslik },
        ]}
      />

      <SayfaBasligi
        baslik={urun.baslik}
        aciklama={
          urun.gelistirenEkip
            ? `${urun.gelistirenEkip} · ${urun.kullanici.ad} ${urun.kullanici.soyad}`
            : `${urun.kullanici.ad} ${urun.kullanici.soyad}`
        }
        /* Yol yukarıdaki şeritte; varsayılan "← Profil" onun altına ikinci
           bir navigasyon basardı. */
        geri={null}
      />

      {/*
        ÜRÜN GÖRSELİ · KAPAK. Başlığın hemen altında, tek başına: vitrin
        kartında görünen görsel burada da ilk görünür.

        `object-contain` ve sınırlı yükseklik — karttaki kırpma (`object-cover`)
        ızgarada eşit kutular için gerekliydi, detayda ise görselin tamamı
        görünmeli; sahibinin yüklediği afişin yazısını kesmek burada kayıp olur.
      */}
      {kapak && (
        <Kart className="p-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={uygulamaYolu(`/panel/kazanim-ekleri/${kapak.id}`)}
            alt={kapak.dosyaAdi}
            className="max-h-[26rem] w-full rounded-kart bg-zemin object-contain"
          />
        </Kart>
      )}

      {/*
        PAYLAŞIM ANAHTARI. Kutuyu işaretlemeden eklenen ürün, o hâliyle markete
        hiç çıkamıyordu; anahtar bu boşluğu kapatıyor — gerekçesi eylemler.ts'te.

        METİN DÖRT DURUMU BİRDEN SÖYLER (26 Ağustos 2026 · istek: "markette bir
        ürün paylaştım ama markette paylaşılmadı yazıyor, bu onaya gitmiyor
        mu"). Önceden yalnızca kişinin TERCİHİNE bakıyordu: onay bekleyen ürün
        için "markette paylaşılıyor" yazıyor, reddedilen üründe de aynı cümle
        duruyordu. Karar `urunVitrinDurumu`dan geliyor — market listesindeki
        rozetle aynı kaynak.
      */}
      {kendisiMi && (
        <Kart className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-metin">
            {
              {
                VITRINDE: (
                  <>
                    Bu ürün <strong>markette paylaşılıyor</strong> —
                    GençTek&apos;e girmiş herkes görebilir.
                  </>
                ),
                ONAY_BEKLIYOR: (
                  <>
                    Bu ürün <strong>onay bekliyor</strong> — proje yöneticisi
                    karar verene kadar markette yalnızca sen görüyorsun.
                  </>
                ),
                REDDEDILDI: (
                  <>
                    Bu ürün <strong>markette yayımlanmadı</strong> — gerekçe
                    bildirimlerinde yazıyor. Düzenleyip yeniden gönderebilirsin.
                  </>
                ),
                PAYLASILMADI: (
                  <>
                    Bu ürün <strong>markette paylaşılmadı</strong> — yalnızca
                    sen görüyorsun. Paylaştığında önce proje yöneticisinin
                    onayına gider.
                  </>
                ),
              }[
                urunVitrinDurumu({
                  markettePaylasilsin: urun.markettePaylasilsin,
                  marketOnayDurumu: urun.marketOnayDurumu,
                })
              ]
            }
          </p>
          <form action={paylasimiDegistirEylemi}>
            <input type="hidden" name="urunId" value={urun.id} />
            <button
              type="submit"
              className={
                urun.markettePaylasilsin
                  ? SINIF_IKINCIL_BUTON
                  : SINIF_BIRINCIL_BUTON
              }
            >
              {urun.markettePaylasilsin ? (
                <>
                  <EyeOff size={15} aria-hidden />
                  Paylaşımı kaldır
                </>
              ) : (
                <>
                  <Store size={15} aria-hidden />
                  Markette paylaş
                </>
              )}
            </button>
          </form>
        </Kart>
      )}

      <Kart className="space-y-4">
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-metin-yumusak">
          <span className="inline-flex items-center gap-1.5">
            <Users size={14} aria-hidden />
            {kume === "OGRENCI"
              ? "Ekleyen öğrenci"
              : kume === "OGRETMEN"
                ? "Ekleyen öğretmen"
                : "Ekosistem ürünü"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Eye size={14} aria-hidden />
            {sayiYaz(urun.goruntulenmeSayisi)} görüntülenme
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ExternalLink size={14} aria-hidden />
            {sayiYaz(urun.baglantiTiklamasi)} bağlantı ziyareti
          </span>
          {urun.tarih && <span>{tarihYaz(urun.tarih)}</span>}
        </p>

        {urun.aciklama && (
          <p className="whitespace-pre-line text-metin">{urun.aciklama}</p>
        )}
      </Kart>

      {gorseller.length > 0 && (
        <Kart>
          <h2 className="text-lg font-semibold text-baslik">
            Destekleyici görseller
          </h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {gorseller.map((ek) => (
              <li key={ek.id}>
                {/*
                  Görsel, kapsam kontrollü ek yolundan servis ediliyor; public
                  bir dizinden DEĞİL. Markette paylaşılan ürünün görseli o
                  yolda ayrıca muaf tutuldu (bkz. kazanim-ekleri/[ekId]).

                  Boyut bilinmediği için `Image` yerine düz `img`: next/image
                  genişlik–yükseklik ya da `fill` ister, ikisi de burada
                  uydurma bir değer olurdu.
                */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={uygulamaYolu(`/panel/kazanim-ekleri/${ek.id}`)}
                  alt={ek.dosyaAdi}
                  className="w-full rounded-lg border border-cizgi"
                />
              </li>
            ))}
          </ul>
        </Kart>
      )}

      {(urun.baglantilar.length > 0 || urun.baglantiUrl) && (
        <Kart>
          <h2 className="text-lg font-semibold text-baslik">Bağlantılar</h2>
          <ul className="mt-3 space-y-2">
            {/*
              Bağlantılar SAYACI ARTIRAN yönlendirme yolundan geçiyor
              (`/git/<id>`), doğrudan dış adrese değil. Doğrudan verilseydi
              "bağlantı ziyareti" sayacı hiç artmazdı — tarayıcı sayfadan
              çıkarken sunucuya haber vermiyor.
            */}
            {urun.baglantilar.map((baglanti) => (
              <li key={baglanti.id}>
                <a
                  href={uygulamaYolu(
                    `/panel/urunler/${urun.id}/git/${baglanti.id}`,
                  )}
                  rel="noopener noreferrer nofollow"
                  target="_blank"
                  className="inline-flex items-center gap-1.5 text-vurgu-metin hover:underline"
                >
                  <ExternalLink size={14} aria-hidden />
                  {baglanti.etiket ?? baglanti.adres}
                </a>
              </li>
            ))}
            {/*
              Eski tek alanlı bağlantı (`baglantiUrl`) hâlâ dolu olabilir:
              çoklu bağlantıya geçerken taşıma YAPILMADI (bkz. D5). Sayacın
              dışında kalıyor — yönlendirme yolu satır kimliğine göre çalışıyor
              ve bu alanın kimliği yok.
            */}
            {urun.baglantiUrl && (
              <li>
                <a
                  href={urun.baglantiUrl}
                  rel="noopener noreferrer nofollow"
                  target="_blank"
                  className="inline-flex items-center gap-1.5 text-vurgu-metin hover:underline"
                >
                  <ExternalLink size={14} aria-hidden />
                  {urun.baglantiUrl}
                </a>
              </li>
            )}
          </ul>
        </Kart>
      )}

      {digerEkler.length > 0 && (
        <Kart>
          <h2 className="text-lg font-semibold text-baslik">Belgeler</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {digerEkler.map((ek) => (
              <li key={ek.id}>
                <a
                  href={uygulamaYolu(`/panel/kazanim-ekleri/${ek.id}`)}
                  className="text-vurgu-metin hover:underline"
                >
                  {ek.dosyaAdi}
                </a>
              </li>
            ))}
          </ul>
        </Kart>
      )}

      {kendisiMi && (
        <Kart>
          {/* `?tur=URUN#kayit-ekle`: bkz. market listesindeki aynı bağlantı. */}
          <Link
            href="/panel?bolum=urunlerim&tur=URUN#urunlerim"
            className="inline-flex items-center gap-1.5 text-sm text-vurgu-metin hover:underline"
          >
            <Pencil size={14} aria-hidden />
            Ürünlerini Panel&apos;deki &quot;Kayıtlarım&quot; bölümünden
            yönetebilirsin
          </Link>
        </Kart>
      )}
    </div>
  );
}
