import {
  BadgeCheck,
  CalendarCheck,
  CalendarPlus,
  GraduationCap,
  Layers,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import {
  KatildigiEtkinlikler,
  type KazanimEylemleri,
  KazanimListesi,
  type KazanimSatiri,
} from "@/components/OgrenciProfilBolumleri";
import { Kart, KartBasligi } from "@/components/ui";
import type {
  FaaliyetDurumu,
  GorevRolKodu,
  OnayDurumu,
} from "@/generated/prisma/enums";
import { ONAY_DURUMU_ETIKETLERI } from "@/lib/faaliyet/kurallar";
import type { KazanimSonucu } from "@/lib/kazanim/getir";
import { tarihYaz } from "@/lib/tarih";
import { gorevRolAdi } from "@/lib/yetki/etiketler";

/**
 * "GençTek Yolculuğum" — kişinin GençTek İÇİNDEKİ geçmişi tek kartta:
 * temsilcilikleri, çalışma grupları, düzenlediği etkinlikler, katıldığı
 * etkinlikler ve verdiği akran eğitimleri.
 *
 * Bunlar ayrı kartlarda dururken hiçbiri tek başına "bu öğrenci ne yapıyor"
 * sorusunu cevaplamıyordu; temsilcilik danışman kartının dibinde, gruplar
 * bambaşka bir kartta, düzenlediği etkinlikler ise hiç görünmüyordu. Kart aynı
 * bileşenden hem öğrencinin kendi ekranına hem danışman/koordinatörün gördüğü
 * profile basılır — iki ekran ayrı yazılsaydı birine eklenen bölüm ötekinde
 * eksik kalırdı.
 *
 * Katılım ve akran eğitimi bölümleri İSTEĞE BAĞLIDIR: veri verilmediğinde hiç
 * basılmazlar. Katkılarım ekranı bu iki listeyi kendi kartlarında gösteriyor,
 * ikisini birden basmak aynı listeyi aynı sayfada iki kez göstermek olurdu.
 */

export interface KatkiGorevi {
  rolKodu: GorevRolKodu;
  egitimOgretimYili: string;
  il?: { ad: string } | null;
  ilce?: { ad: string } | null;
  kurum?: { ad: string } | null;
  /** CALISMA_GRUBU_YONETICISI rolünün kapsamı (7 Ağustos 2026). */
  calismaGrubu?: { ad: string } | null;
}

export interface KatkiGrubu {
  calismaGrubuId: number;
  secimTarihi: Date;
  calismaGrubu: { ad: string; aktif: boolean };
  ekleyen?: { ad: string; soyad: string } | null;
}

export interface KatkiFaaliyeti {
  id: number;
  ad: string;
  tarih: Date;
  durum: FaaliyetDurumu;
  onayDurumu: OnayDurumu;
}

const SINIF_ROZET =
  "inline-flex items-center gap-1.5 rounded-full bg-rol-ogrenci-zemin px-3 py-1 text-sm text-rol-ogrenci-metin";

function BolumBasligi({
  Ikon,
  baslik,
  adet,
}: {
  Ikon: React.ComponentType<{ size?: number; className?: string }>;
  baslik: string;
  adet: number;
}) {
  return (
    <h3 className="flex items-center gap-2 text-sm font-semibold text-baslik">
      <Ikon size={15} className="text-vurgu-metin" />
      {baslik}
      <span className="font-normal text-metin-yumusak">{adet}</span>
    </h3>
  );
}

/**
 * GÖREV BÖLÜMÜ AYRI BİLEŞEN (22 Ağustos 2026 · istek: "/panel/gorevlerim'de
 * temsilcilikler vb. ve GençTek görevleri gösterilecek sadece").
 *
 * Görevlerim ekranı yolculuğun tamamını değil yalnızca bu bölümü basıyor;
 * bölüm KatkiKarti'nın içinde gömülü kalsaydı ya kart olduğu gibi
 * kopyalanacaktı ya da aynı işaretleme iki dosyada ayrı ayrı yaşayacaktı.
 * Kaynak tek: temsilcilikler atama kaydından, organizasyonlar etkinlik
 * kaydından düşer; ikisi de elle eklenmez.
 */
export function KatkiGorevBolumu({
  kendiMi,
  gorevler,
  faaliyetler,
  egitimOgretimYili,
  organizasyonlarGorunsun = true,
}: {
  kendiMi: boolean;
  gorevler: KatkiGorevi[];
  faaliyetler: KatkiFaaliyeti[];
  egitimOgretimYili: string;
  /**
   * "Görev aldığı GençTek organizasyonları" alt listesi basılsın mı?
   *
   * 22 AĞUSTOS 2026 · istek: "/panel/gorevlerim'den Görev aldığı GençTek
   * organizasyonları bunu kaldır". Bayrak ÇAĞIRANA ait, bileşene değil:
   * profildeki yolculuk kartında liste duruyor — orası kişinin GençTek
   * geçmişini gösteren yer ve düzenlediği etkinlikler o geçmişin parçası.
   */
  organizasyonlarGorunsun?: boolean;
}) {
  /*
    GÖREVLERİM (7 Ağustos 2026 · istek): "Görevlerim (İl Temsilcisi/Okul
    Temsilcisi/Çalışma Grubu Yöneticisi / Görev Aldığı GençTek
    Organizasyonları)".

    İki liste TEK BAŞLIK altında toplandı: verilen temsilcilikler ve
    görev alınan organizasyonlar. Ayrı başlıklarda dururken ikisi de
    "bu kişiye ne görev verilmiş" sorusunun yarısını cevaplıyordu.
    İçeride ayrı alt listeler olarak duruyorlar çünkü kaynakları farklı:
    biri atama kaydı, öbürü etkinlik kaydı.

    İKİSİ DE OTOMATİKTİR: temsilcilik koordinatör/danışman tarafından
    atanır, organizasyon etkinlik açıldığında düşer. Öğrenci bu bölüme
    elle bir şey ekleyemez (istek: "Diğer alanlar ... otomatik olarak
    profiline gelmeli").
  */
  return (
    <div>
      <BolumBasligi
        Ikon={BadgeCheck}
        baslik={kendiMi ? "Görevlerim" : "Görevleri"}
        adet={
          gorevler.length + (organizasyonlarGorunsun ? faaliyetler.length : 0)
        }
      />

      <div className="mt-2">
        <h4 className="text-sm font-medium text-metin">Temsilcilikler</h4>
        {gorevler.length === 0 ? (
          <p className="mt-1 text-sm text-metin-yumusak">
            {kendiMi
              ? "Henüz bir temsilciliğin yok."
              : "Temsilcilik görevi verilmemiş."}
          </p>
        ) : (
          <ul className="mt-1.5 flex flex-wrap gap-2">
            {gorevler.map((gorev) => (
              <li
                key={`${gorev.rolKodu}-${gorev.egitimOgretimYili}`}
                className={SINIF_ROZET}
              >
                <BadgeCheck size={14} aria-hidden />
                {gorevRolAdi(gorev)}
                {/*
                 * Geçmiş dönem görevi silinmez, dönemiyle birlikte durur:
                 * "geçen yıl il temsilcisiydi" bir katkıdır ve kartın işi
                 * tam olarak bunu göstermektir.
                 */}
                {gorev.egitimOgretimYili !== egitimOgretimYili && (
                  <span className="text-xs opacity-80">
                    {gorev.egitimOgretimYili}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {organizasyonlarGorunsun && (
        <div className="mt-4">
          <h4 className="flex items-center gap-1.5 text-sm font-medium text-metin">
            <CalendarPlus size={14} className="text-vurgu-metin" aria-hidden />
            Görev aldığı GençTek organizasyonları
          </h4>
          {faaliyetler.length === 0 ? (
            <p className="mt-1 text-sm text-metin-yumusak">
              {kendiMi
                ? "Henüz bir organizasyonda görev almadın."
                : "Henüz bir organizasyonda görev almamış."}
            </p>
          ) : (
            <ul className="mt-1.5 divide-y divide-cizgi">
              {faaliyetler.map((faaliyet) => (
                <li key={faaliyet.id} className="py-2.5 first:pt-0 last:pb-0">
                  <Link
                    href={`/panel/etkinlikler/${faaliyet.id}`}
                    className="font-medium text-metin transition hover:text-vurgu-metin"
                  >
                    {faaliyet.ad}
                  </Link>
                  <p className="mt-0.5 text-sm text-metin-yumusak">
                    {tarihYaz(faaliyet.tarih)} ·{" "}
                    {faaliyet.durum === "IPTAL_EDILDI"
                      ? "İptal edildi"
                      : ONAY_DURUMU_ETIKETLERI[faaliyet.onayDurumu]}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {/*
            "YENİ ETKİNLİK ÖNER" BAĞLANTISI KALKTI (23 Ekim 2026 · istek:
            "Öğrenci etkinlik açamaz"). Kart yalnızca öğrencide basılıyor ve
            bağlantı artık yetki hatasına çıkıyordu.
          */}
        </div>
      )}
    </div>
  );
}

/**
 * ÇALIŞMA GRUPLARI BÖLÜMÜ (22 Ağustos 2026 · istek: "Görevlerim'de
 * temsilcilikler, çalışma grupları ve panodaki GençTek görevleri olacak").
 *
 * KatkiGorevBolumu ile aynı gerekçe: Görevlerim ekranı yolculuk kartının
 * tamamını değil bu iki bölümü basıyor, işaretleme tek yerde duruyor.
 */
export function KatkiGrupBolumu({
  kendiMi,
  gruplar,
}: {
  kendiMi: boolean;
  gruplar: KatkiGrubu[];
}) {
  /*
     ÇALIŞMA GRUPLARIM EN SONDA (7 Ağustos 2026 · istekteki sıra:
     Görevlerim · Verdiğim Akran Eğitimleri · Katıldığım GençTek
     Etkinlikleri · Çalışma Gruplarım).

     Bu bölüm, GençTek Yolculuğum içinde öğrencinin KENDİ SEÇTİĞİ tek
     şeydir; gerisi otomatik düşer (istek: "Öğrenci sadece çalışma grubu
     seçimi yapabilmeli"). Düzenleme bağlantısı bu yüzden Panel'e iner.
   */
  return (
    <div>
      <BolumBasligi
        Ikon={Layers}
        baslik={kendiMi ? "Çalışma gruplarım" : "Çalışma grupları"}
        adet={gruplar.length}
      />
      {gruplar.length === 0 ? (
        <p className="mt-1.5 text-sm text-metin-yumusak">
          {kendiMi
            ? "Henüz çalışma grubu seçmedin."
            : "Çalışma grubu seçilmemiş."}
        </p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-2">
          {gruplar.map((secim) => (
            <li
              key={secim.calismaGrubuId}
              className="inline-flex items-center gap-1.5 rounded-full bg-vurgu-zemin px-3 py-1 text-sm text-vurgu-metin"
              title={
                secim.ekleyen
                  ? `${secim.ekleyen.ad} ${secim.ekleyen.soyad} ekledi`
                  : "kendi seçimi"
              }
            >
              {secim.calismaGrubu.ad}
              {!secim.calismaGrubu.aktif && (
                <span className="rounded-full bg-uyari-zemin px-2 text-xs text-uyari-metin">
                  kapatıldı
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {kendiMi && (
        <Link
          href="/panel#calisma-gruplarim"
          className="mt-2 inline-block text-sm font-medium text-vurgu-metin underline underline-offset-2"
        >
          Grup seçimimi Panel&apos;den düzenle →
        </Link>
      )}
    </div>
  );
}

export function KatkiKarti({
  kendiMi,
  gorevler,
  gruplar,
  faaliyetler,
  egitimOgretimYili,
  katilim = null,
  kazanimlar,
  ...kazanimEylemleri
}: {
  /** Metinler "sen" ve "o" arasında bu bayrakla ayrılır. */
  kendiMi: boolean;
  gorevler: KatkiGorevi[];
  gruplar: KatkiGrubu[];
  faaliyetler: KatkiFaaliyeti[];
  /** İçinde bulunulan dönem; geçmiş dönem görevleri ayrıca işaretlenir. */
  egitimOgretimYili: string;
  /**
   * Katıldığı GençTek etkinlikleri — başvuru geçmişinden TÜRETİLİR, beyan
   * değildir. Verilmezse bölüm hiç basılmaz.
   */
  katilim?: KazanimSonucu | null;
  /**
   * Kişinin beyan ettiği kazanım kayıtları. Bunlardan yalnızca GençTek
   * tarafındaki (AKRAN_EGITIMI) burada gösterilir; gerisi "Bilişim
   * Yolculuğum" bölümüne aittir.
   */
  kazanimlar?: KazanimSatiri[];
} & KazanimEylemleri) {
  const akranEgitimleri = (kazanimlar ?? []).filter(
    (kazanim) => kazanim.tip === "AKRAN_EGITIMI",
  );

  return (
    <Kart>
      <KartBasligi
        baslik={kendiMi ? "GençTek Yolculuğum" : "GençTek yolculuğu"}
        aciklama={
          kendiMi
            ? "GençTek içindeki geçmişin: görevlerin, verdiğin akran eğitimleri, katıldığın etkinlikler ve çalışma grupların. Buradaki tek seçimin çalışma gruplarıdır; gerisi görev aldıkça ve adına belge üretildikçe kendiliğinden düşer."
            : "Öğrencinin GençTek içindeki geçmişi: görevleri, verdiği akran eğitimleri, katıldığı etkinlikler ve çalışma grupları."
        }
        Ikon={Sparkles}
      />

      <div className="space-y-6">
        <KatkiGorevBolumu
          kendiMi={kendiMi}
          gorevler={gorevler}
          faaliyetler={faaliyetler}
          egitimOgretimYili={egitimOgretimYili}
        />

        {/*
          AKRAN EĞİTİMLERİ KATILIMDAN ÖNCE (istekteki sıra). Bu bölüm hâlâ
          kişinin BEYANIDIR — öğretmen onayına bağlanması ayrı bir madde olarak
          kayıt altına alındı (YAPILACAKLAR.md · 7 Ağustos eki).
        */}
        {kazanimlar && (
          <div>
            <BolumBasligi
              Ikon={GraduationCap}
              baslik={kendiMi ? "Verdiğim akran eğitimleri" : "Verdiği akran eğitimleri"}
              adet={akranEgitimleri.length}
            />
            {akranEgitimleri.length === 0 ? (
              <p className="mt-1.5 text-sm text-metin-yumusak">
                {kendiMi
                  ? "Henüz akran eğitimi kaydı girmedin."
                  : "Akran eğitimi kaydı girilmemiş."}
              </p>
            ) : (
              <div className="mt-2">
                <KazanimListesi
                  kazanimlar={akranEgitimleri}
                  {...kazanimEylemleri}
                />
              </div>
            )}
          </div>
        )}

        {/*
          Katıldığı etkinlikler TÜRETİLMİŞ listedir, beyan değil: kişinin adına
          BELGE üretildiğinde düşer (7 Ağustos 2026 · lib/kazanim/
          katilim-kurallar.ts). Elle eklenip silinemez.
        */}
        {katilim && (
          <div>
            <BolumBasligi
              Ikon={CalendarCheck}
              baslik="Katıldığı GençTek etkinlikleri"
              adet={katilim.katilimlar.length}
            />
            <p className="mt-1 text-sm text-metin-yumusak">
              Etkinlik sonunda yoklamada &quot;geldi&quot; işaretlendiğinde ya da
              adına belge üretildiğinde kendiliğinden düşer.
            </p>
            <div className="mt-2">
              <KatildigiEtkinlikler kazanim={katilim} />
            </div>
          </div>
        )}

        {/*
          "BEYAN ETTİĞİ GENÇTEK ETKİNLİKLERİ" KALDIRILDI (7 Ağustos 2026).
          İstek: "Beyan Ettiği GençTek Etkinlikleri kaldırılacak".

          Bölüm, sisteme hiç girilmemiş eski etkinliklerin elle beyanını
          gösteriyordu. Katılım artık ÜRETİLEN BELGEDEN doğuyor (yukarıdaki
          "Katıldığı GençTek etkinlikleri"), dolayısıyla beyan ikinci ve
          doğrulanmamış bir kaynak olarak kalıyordu: aynı etkinlik profilde
          biri doğrulanmış biri beyan olmak üzere iki kez görünebiliyordu.

          Tip de kapatıldı (lib/kazanim/kurallar.ts · ARSIVLENMIS_TIPLER);
          girilmiş eski kayıtlar SİLİNMEDİ, Panelim'in düzenleme bölümünde
          görünüp silinebiliyorlar.
        */}


        <KatkiGrupBolumu kendiMi={kendiMi} gruplar={gruplar} />
      </div>
    </Kart>
  );
}
