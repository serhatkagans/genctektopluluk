import {
  Camera,
  Check,
  FileText,
  GraduationCap,
  Layers,
  Link2,
  Mail,
  Pencil,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import type { KazanimTipi } from "@/generated/prisma/enums";
import { KayitTuruSecici } from "@/components/KayitTuruSecici";
import {
  KazanimListesi,
  type KazanimSatiri,
} from "@/components/OgrenciProfilBolumleri";
import {
  SINIF_BIRINCIL_BUTON,
  SINIF_GIRDI,
  SINIF_IKINCIL_BUTON,
} from "@/components/ui";
import {
  DUZENLEYEN_SECENEKLERI,
  KATILIM_BICIMI_ETIKETLERI,
  KATILIM_BICIMLERI,
  type KazanimGrubu,
  type KazanimSahibi,
  type KazanimTipiTanimi,
  kazanimGrupCapasi,
  kazanimTipleri,
} from "@/lib/kazanim/kurallar";
import { KATKI_ACIKLAMASI_AZAMI } from "@/lib/dis-kimlik/profil-kurallar";
import {
  type BaglantiAlani,
  BAGLANTI_TANIMLARI,
} from "@/lib/ogrenci/iletisim-kurallar";
import { basHarfler, profilFotoTipAdlari } from "@/lib/kullanici/profil-foto-kurallar";
import {
  MENTOR_KONULARI_AZAMI,
  MENTORLUK_DURUM_ETIKETLERI,
  MENTORLUK_DURUM_SINIFLARI,
} from "@/lib/mentor/kurallar";
import { cvTipAdlari } from "@/lib/ogrenci/cv-kurallar";
import { uygulamaYolu } from "@/lib/ortam";
import { girdiTarihi, tarihSaatYaz, tarihYaz } from "@/lib/tarih";

/**
 * Profil bilgilerinin DÜZENLENDİĞİ bölümler (C4 · 7 Ağustos 2026).
 *
 * ---------------------------------------------------------------------------
 * NEDEN AYRI DOSYA
 * ---------------------------------------------------------------------------
 * Formlar 7 Ağustos 2026'da profilden panele taşındı; 20 Ağustos'ta iki ekran
 * tamamen birleşti ve `/panel` hem gösteren hem düzenleyen tek yüzey oldu
 * (istek: "panel ile profil birleşecek tek panel kalacak, düzenleme ve
 * görüntüleme panelden olacak").
 *
 * Formlar Panel sayfasının içine gömülseydi o dosya iki bine yaklaşırdı;
 * buraya alınınca Panel bölümleri sıralamakla kalıyor.
 *
 * Bölümler KART BASMAZ: hepsi Panelim'de `KatlanabilirKart` içinde duruyor ve
 * kart içinde kart iç içe çerçeve üretirdi (DanismanSecimi ile aynı desen).
 *
 * Eylemler PROP olarak geliyor, doğrudan içe aktarılmıyor: bileşen
 * `src/components` altında, eylemler `src/app/panel/profil` altında. Aynı
 * desen DanismanSecimi ve RotamKarti'nda da kullanılıyor.
 */

type Eylem = (veri: FormData) => Promise<void>;

// ---------------------------------------------------------------------------
// Fotoğraf
// ---------------------------------------------------------------------------

export interface FotoSinirlari {
  izinliTipler: string[];
  maksBayt: number;
}

export function FotografDuzenleme({
  ad,
  soyad,
  fotoAdresi,
  sinirlar,
  yukleEylemi,
  silEylemi,
}: {
  ad: string;
  soyad: string;
  /** Sürüm damgalı adres; yoksa baş harfler basılır. */
  fotoAdresi: string | null;
  sinirlar: FotoSinirlari;
  yukleEylemi: Eylem;
  silEylemi: () => Promise<void>;
}) {
  return (
    <div className="flex flex-wrap items-start gap-6">
      <ProfilFotografi ad={ad} soyad={soyad} adres={fotoAdresi} />

      <div className="min-w-60 grow space-y-3">
        <form action={yukleEylemi} className="space-y-3">
          <label className="block">
            <span className="text-sm font-medium text-metin">
              {fotoAdresi ? "Fotoğrafı değiştir" : "Fotoğraf yükle"}
            </span>
            <input
              type="file"
              name="foto"
              required
              accept={sinirlar.izinliTipler.join(",")}
              className={SINIF_GIRDI}
            />
            <span className="mt-1 block text-sm text-metin-yumusak">
              {profilFotoTipAdlari(sinirlar.izinliTipler)} · en fazla{" "}
              {(sinirlar.maksBayt / (1024 * 1024)).toFixed(0)} MB
            </span>
          </label>
          <button type="submit" className={SINIF_BIRINCIL_BUTON}>
            Yükle
          </button>
        </form>

        {fotoAdresi && (
          <form action={silEylemi}>
            <button type="submit" className={SINIF_IKINCIL_BUTON}>
              <Trash2 size={16} aria-hidden />
              Fotoğrafı kaldır
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

/**
 * Fotoğrafın kendisi — profilde ve düzenleme bölümünde AYNI bileşenden basılır.
 *
 * `next/image` KULLANILMIYOR: optimizasyon görseli kendi sunucusundan çekmeye
 * çalışır, oysa bu dosya public dizinde değil oturum arkasında bir rotadan
 * geliyor. Boyut zaten 112px ve üst sınır 2 MB.
 *
 * Fotoğraf yoksa boş kare değil BAŞ HARFLER gösteriliyor: "henüz yüklenmedi"
 * ile "yüklendi ama gösterilemiyor" ayırt edilebilsin.
 */
export function ProfilFotografi({
  ad,
  soyad,
  adres,
}: {
  ad: string;
  soyad: string;
  adres: string | null;
}) {
  if (!adres) {
    return (
      <div
        aria-hidden
        className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full border border-cizgi bg-zemin text-2xl font-semibold text-metin-yumusak"
      >
        {basHarfler(ad, soyad)}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={adres}
      alt="Profil fotoğrafınız"
      width={112}
      height={112}
      className="h-28 w-28 shrink-0 rounded-full border border-cizgi object-cover"
    />
  );
}

// ---------------------------------------------------------------------------
// İletişim bilgileri
// ---------------------------------------------------------------------------

export interface IletisimDegerleri {
  eposta: string | null;
  telefon: string | null;
}

/** Dış kullanıcının profil alanları — `ogretmen_profil` sütunlarıyla aynı ad. */
export interface KurumBilgileri {
  kurumAdi: string | null;
  gorevUnvani: string | null;
  aciklama: string | null;
}

export function IletisimDuzenleme({
  iletisim,
  baglantilar,
  kurumBilgileri,
  ogrenci,
  kaydetEylemi,
}: {
  iletisim: IletisimDegerleri | null;
  /**
   * Mesleki bağlantı adresleri.
   *
   * ÖĞRENCİ VE DIŞ KULLANICIDA sorulur; sütunlar iki ayrı tabloda ama alan
   * adları aynı (`ogrenci_profil` / `ogretmen_profil`). Öğretmen ve
   * koordinatörde sorulmaz: onların GençTek'teki yeri okulları ve görevleriyle
   * belli, GitHub adresi sistemin işine yaramıyor. Dış kullanıcıda tam tersi.
   *
   * Tip yalnızca BAĞLANTI alanlarını istiyor, tüm profil satırını değil:
   * çağıran satırın tamamını geçebilir (fazla alanlar yok sayılır) ama
   * bileşen başka bir sütuna erişemez.
   */
  baglantilar: Partial<Record<BaglantiAlani, string | null>> | null;
  /**
   * Dış kullanıcının kurumu, görevi ve katkı açıklaması (7 Ağustos 2026).
   * Verilmezse bu alanlar hiç basılmaz — öğrencinin ve öğretmenin kurumu
   * kimlik bilgilerinden gelir, elle yazılmaz.
   */
  kurumBilgileri?: KurumBilgileri | null;
  ogrenci: boolean;
  kaydetEylemi: Eylem;
}) {
  /*
   * BAĞLANTILAR ARTIK HERKESE SORULUYOR (26 Ağustos 2026 · istekler: "İletişim
   * bilgilerim il koordinatörünün bu alanına linkedin ve instagram alanı da
   * ekleyelim" · "bunları hatta öğrenci ve öğretmenlerin iletişim bilgileri
   * alanına da ekleyelim instagram linkedin").
   *
   * Kutular öğrenciye ve dış kullanıcıya sorulup ÖĞRETMENE VE KOORDİNATÖRE
   * sorulmuyordu; gerekçe "onların GençTek'teki yeri okulları ve görevleriyle
   * belli, GitHub adresi sistemin işine yaramıyor" idi. Bu gerekçe kimin
   * ADRESE İHTİYACI OLDUĞUNU değil, kimin ADRESİNİ ARADIĞINI ölçüyordu:
   * koordinatörün kendi sayfası (bkz. panel/il-koordinatorum) açıldıktan sonra
   * ona ulaşmak isteyen öğrenci de öğretmen de aynı soruyu soruyor. Sütunlar
   * `ogretmen_profil` tablosunda zaten vardı ve boş duruyordu.
   *
   * `ogrenci` bayrağı KALDI: yalnızca yardım metnini seçiyor — öğrencinin
   * adresini kimlerin göreceği ayrıca yazılıyor.
   */
  const baglantiSorulsun = true;

  return (
    <form action={kaydetEylemi} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-metin">
            E-posta <span className="text-hata-metin">*</span>
          </span>
          {/* Zorunlu (30 Ekim 2026): şifre sıfırlama bağlantısı bu adrese gider. */}
          <input
            type="email"
            name="eposta"
            required
            maxLength={150}
            defaultValue={iletisim?.eposta ?? ""}
            className={SINIF_GIRDI}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-metin">Telefon</span>
          <input
            type="tel"
            name="telefon"
            defaultValue={iletisim?.telefon ?? ""}
            className={SINIF_GIRDI}
          />
        </label>
      </div>

      {/*
        KURUM VE GÖREV yalnızca dış kullanıcıda ve SERBEST METİN.
        Paydaş envanterinden seçtirilmedi: envanter, etkinliklerde iş birliği
        yapılan kurumların kaydıdır ve il koordinatörlerince yönetilir (S18);
        mezunun çalıştığı şirketin oraya girmesi gerekmiyor.
      */}
      {kurumBilgileri && (
        <div className="grid gap-4 border-t border-cizgi pt-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-metin">Kurum</span>
            <input
              type="text"
              name="kurumAdi"
              maxLength={150}
              placeholder="Çalıştığınız kurum ya da şirket"
              defaultValue={kurumBilgileri.kurumAdi ?? ""}
              className={SINIF_GIRDI}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-metin">Görevi</span>
            <input
              type="text"
              name="gorevUnvani"
              maxLength={150}
              placeholder="Yazılım mühendisi, Ar-Ge sorumlusu…"
              defaultValue={kurumBilgileri.gorevUnvani ?? ""}
              className={SINIF_GIRDI}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium text-metin">
              Açıklamalar · katkı sağlayabileceğim şeyler
            </span>
            <textarea
              name="aciklama"
              rows={4}
              maxLength={KATKI_ACIKLAMASI_AZAMI}
              placeholder="Hangi konularda destek verebilirsiniz? Mekân, eğitmen, staj, sponsorluk, teknik danışmanlık…"
              defaultValue={kurumBilgileri.aciklama ?? ""}
              className={SINIF_GIRDI}
            />
            <span className="mt-1 block text-sm text-metin-yumusak">
              Profilinizde görünür; sizinle iletişime geçmek isteyenler burayı
              okur. En fazla {KATKI_ACIKLAMASI_AZAMI} karakter.
            </span>
          </label>
        </div>
      )}

      {baglantiSorulsun && (
        <fieldset className="space-y-4 border-t border-cizgi pt-4">
          <legend className="flex items-center gap-2 text-sm font-medium text-metin">
            <Link2 size={15} aria-hidden />
            Bağlantılarım
          </legend>
          <p className="text-sm text-metin-yumusak">
            {ogrenci
              ? "İsteğe bağlıdır. Girdiğiniz adresleri danışmanınız, il koordinatörünüz ve proje yöneticisi profilinizde görür."
              : "İsteğe bağlıdır. Girdiğiniz adresler profilinizde görünür."}{" "}
            &quot;https://&quot; yazmasanız da olur.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {BAGLANTI_TANIMLARI.map((tanim) => (
              <label key={tanim.alan} className="block">
                <span className="text-sm font-medium text-metin">
                  {tanim.etiket}
                </span>
                <input
                  type="text"
                  name={tanim.alan}
                  maxLength={200}
                  placeholder={tanim.ornek}
                  defaultValue={baglantilar?.[tanim.alan] ?? ""}
                  className={SINIF_GIRDI}
                />
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <button type="submit" className={SINIF_BIRINCIL_BUTON}>
        Kaydet
      </button>
    </form>
  );
}

/**
 * Katkı verebileceği çalışma gruplarının seçimi (7 Ağustos 2026).
 *
 * MENTÖRLÜK FORMUNDAN AYRI: orası onaya giden bir başvurudur ve gönderim
 * mevcut kaydı BEKLIYOR'a düşürür. Burası yalnızca bir beyandır — kaydet,
 * bitti. İkisi tek forma alınsaydı destek alanını güncellemek isteyen kişi
 * onaylı mentörlüğünü de yeniden onaya düşürürdü.
 */
export function DestekGruplariDuzenleme({
  gruplar,
  seciliGrupIdleri,
  kaydetEylemi,
}: {
  gruplar: { id: number; ad: string }[];
  seciliGrupIdleri: number[];
  kaydetEylemi: Eylem;
}) {
  const secili = new Set(seciliGrupIdleri);

  return (
    <form action={kaydetEylemi} className="space-y-4">
      <fieldset>
        <legend className="text-sm font-medium text-metin">
          Hangi çalışma gruplarına katkı verebilirsiniz?
        </legend>
        <p className="mt-1 mb-2 text-sm text-metin-yumusak">
          Birden fazla seçebilirsiniz. Seçiminiz profilinizde görünür; kimseye
          erişim açmaz ve onay gerektirmez.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {gruplar.map((grup) => (
            <label
              key={grup.id}
              className="flex items-center gap-2 rounded-md border border-cizgi px-3 py-2 text-sm text-metin"
            >
              <input
                type="checkbox"
                name="calismaGrubuId"
                value={grup.id}
                defaultChecked={secili.has(grup.id)}
                className="h-4 w-4 rounded border-cizgi accent-[var(--renk-birincil)]"
              />
              {grup.ad}
            </label>
          ))}
        </div>
      </fieldset>

      <button type="submit" className={SINIF_BIRINCIL_BUTON}>
        <Layers size={15} aria-hidden />
        Kaydet
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Referanslarım (28 Ağustos 2026)
// ---------------------------------------------------------------------------

export interface ReferansSatiri {
  id: number;
  adSoyad: string;
  kurum: string | null;
  telefon: string | null;
  eposta: string | null;
}

/**
 * Referansın dört alanı — ekleme ve düzenleme formunun ortak gövdesi.
 *
 * `referans` verilmezse boş ekleme formu, verilirse dolu düzenleme formu
 * çıkıyor: alan adları, uzunluk sınırları ve zorunluluk işareti tek yerde
 * duruyor, yani sunucudaki kuralla (bkz. referansKabulEdilirMi) eşleşmesi
 * gereken tek bir yüzey var.
 *
 * ÖRNEK METİNLER (`placeholder`) DÜZENLEMEDE DE DURUYOR: kutuyu boşaltan
 * kişiye oraya ne yazılacağını yine söylüyorlar ve dolu bir kutuda zaten
 * görünmüyorlar.
 */
function ReferansAlanlari({ referans }: { referans?: ReferansSatiri }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block">
        <span className="text-sm font-medium text-metin">
          Ad soyad <span className="text-hata-metin">*</span>
        </span>
        <input
          type="text"
          name="adSoyad"
          required
          maxLength={150}
          defaultValue={referans?.adSoyad ?? ""}
          placeholder="Ayşe Yılmaz"
          className={SINIF_GIRDI}
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-metin">Kurum</span>
        <input
          type="text"
          name="kurum"
          maxLength={200}
          defaultValue={referans?.kurum ?? ""}
          placeholder="Beşiktaş Anadolu Lisesi — Bilişim öğretmeni"
          className={SINIF_GIRDI}
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-metin">Telefon</span>
        <input
          type="tel"
          name="telefon"
          maxLength={20}
          defaultValue={referans?.telefon ?? ""}
          placeholder="0 532 111 22 33"
          className={SINIF_GIRDI}
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-metin">E-posta</span>
        <input
          type="email"
          name="eposta"
          maxLength={150}
          defaultValue={referans?.eposta ?? ""}
          placeholder="ogretmen@meb.k12.tr"
          className={SINIF_GIRDI}
        />
      </label>
    </div>
  );
}

/**
 * REFERANSLARIM (istek: "Öğrenciler için profile referanslar bölümü
 * ekleyelim. Referans için ad soyad telefon kurum eposta").
 *
 * ---------------------------------------------------------------------------
 * LİSTE ÜSTTE, FORM ALTTA
 * ---------------------------------------------------------------------------
 * Bölüm açıldığında önce girilmiş referanslar okunuyor; kişi çoğu zaman
 * "kimleri yazmıştım" diye bakmak için açıyor, her seferinde boş bir formla
 * karşılaşmak listeyi formun altına itiyordu.
 *
 * HER SATIRIN KENDİ DÜZENLEME FORMU VAR (31 Ağustos 2026 · istek:
 * "Referanslarda eklenen referansı düzenleme olsun"). 28 Ağustos'ta karar
 * "sil ve yeniden yaz"dı; gerekçesinin neden yanlış olduğu sunucu eyleminin
 * başlığında yazılı (referans-eylemleri.ts · referansGuncelleEylemi).
 *
 * FORM KAPALI GELİYOR — `<details>`, JavaScript yok. Üç referansın altına üç
 * açık form basmak, bölümü art arda üç formdan oluşan bir duvara çevirirdi;
 * kutuyu açan kişi çoğu zaman "kimleri yazmıştım" diye bakıyor. Alanlar
 * `defaultValue` ile dolu geliyor: düzenleme, yeniden yazmak değil.
 *
 * ALANLARIN KENDİSİ EKLEME FORMUYLA AYNI (`ReferansAlanlari`): iki yerde ayrı
 * yazılsalardı biri değişince öteki eskir, üstelik zorunluluk yıldızı ile
 * `maxLength` değerleri sunucudaki kuralla eşleşmeyi bırakırdı.
 *
 * SİLME ONAY SORMUYOR: satır tek tıkla yeniden yazılabilir ve `confirm()`
 * tarayıcı kipi açıyor — sunucu eylemiyle çalışan bir formda o kip, geri
 * alınamaz bir işlem izlenimi verirdi. Yeniden yazması bir dakikalık.
 *
 * AÇIKLAMA SATIRI KALKTI (28 Ağustos 2026 · istek: "Telefon ve e-postadan en
 * az birini yazın… sil"). İki şey söylüyordu ve ikisi de KURAL olarak yerinde
 * duruyor: telefon/e-postadan biri boş bırakılırsa kayıt zaten kabul
 * edilmiyor ve gerekçesi hata metninde dönüyor (bkz. referansKabulEdilirMi);
 * satırın üçüncü bir kişiye ait olduğu ise kaydın GÖRÜNÜRLÜĞÜNÜ belirliyor —
 * yalnızca sahibi görüyor (bkz. şema · KullaniciReferansi). Ekrandaki cümle
 * bir uyarıydı, davranışın kendisi değil.
 */
export function ReferansDuzenleme({
  referanslar,
  azamiSayi,
  ekleEylemi,
  guncelleEylemi,
  silEylemi,
}: {
  referanslar: ReferansSatiri[];
  azamiSayi: number;
  ekleEylemi: Eylem;
  guncelleEylemi: Eylem;
  silEylemi: Eylem;
}) {
  const doluMu = referanslar.length >= azamiSayi;

  return (
    <div className="space-y-4">
      {referanslar.length > 0 && (
        <ul className="space-y-2">
          {referanslar.map((referans) => (
            <li
              key={referans.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-kutu border border-cizgi px-3 py-2"
            >
              <div className="min-w-0">
                <p className="font-medium text-metin">{referans.adSoyad}</p>
                <p className="text-sm text-metin-yumusak">
                  {[referans.kurum, referans.telefon, referans.eposta]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <form action={silEylemi}>
                <input
                  type="hidden"
                  name="referansId"
                  value={referans.id}
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-hata-metin"
                >
                  <Trash2 size={15} aria-hidden />
                  Sil
                </button>
              </form>

              {/*
                DÜZENLEME KUTUSU SATIRIN TAM GENİŞLİĞİNDE (`basis-full`): ad ile
                Sil düğmesi aynı satırda kalıyor, form ise altlarına açılıyor —
                aksi hâlde dört alanlı form, silme düğmesinin yanındaki dar
                sütuna sıkışırdı.
              */}
              <details className="basis-full">
                <summary className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-vurgu-metin">
                  <Pencil size={15} aria-hidden />
                  Düzenle
                </summary>
                <form action={guncelleEylemi} className="mt-3 space-y-4">
                  <input
                    type="hidden"
                    name="referansId"
                    value={referans.id}
                  />
                  <ReferansAlanlari referans={referans} />
                  <button type="submit" className={SINIF_BIRINCIL_BUTON}>
                    <Check size={15} aria-hidden />
                    Değişikliği kaydet
                  </button>
                </form>
              </details>
            </li>
          ))}
        </ul>
      )}

      {doluMu ? (
        <p className="text-sm text-metin-yumusak">
          En fazla {azamiSayi} referans ekleyebilirsiniz. Yeni bir referans
          için önce birini silin.
        </p>
      ) : (
        <form action={ekleEylemi} className="space-y-4">
          <ReferansAlanlari />

          <button type="submit" className={SINIF_BIRINCIL_BUTON}>
            <Plus size={15} aria-hidden />
            Referans ekle
          </button>
        </form>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Danışman öğretmenliği (öğretmenin kendi işareti)
// ---------------------------------------------------------------------------

export function DanismanlikDuzenleme({
  gorevAliyorMu,
  eylem,
}: {
  gorevAliyorMu: boolean;
  eylem: Eylem;
}) {
  return (
    <>
      <form action={eylem}>
        <input
          type="hidden"
          name="gorevAlmakIstiyor"
          value={gorevAliyorMu ? "hayir" : "evet"}
        />
        {gorevAliyorMu ? (
          <div className="flex flex-wrap items-center gap-4">
            <p className="inline-flex items-center gap-2 rounded-full bg-olumlu-zemin px-3 py-1 text-sm font-medium text-olumlu-metin">
              <ShieldCheck size={15} aria-hidden />
              Danışman öğretmen olarak görev alıyorsunuz.
            </p>
            <button type="submit" className={SINIF_IKINCIL_BUTON}>
              Görevi bırak
            </button>
          </div>
        ) : (
          <button type="submit" className={SINIF_BIRINCIL_BUTON}>
            GençTek danışman öğretmeni olarak görev almak istiyorum
          </button>
        )}
      </form>
      {gorevAliyorMu && (
        <p className="mt-3 text-sm text-metin-yumusak">
          Görevi bıraktığınızda danışmanlığınızdaki öğrenciler okuldaki diğer
          danışmanlara ya da il koordinatörüne devredilir.
        </p>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Mentörlük
// ---------------------------------------------------------------------------

export interface MentorlukDurumuGorunumu {
  durum: "BEKLIYOR" | "ONAYLANDI" | "REDDEDILDI" | "BIRAKILDI";
  konular: string | null;
  retGerekcesi: string | null;
  seciliGrupIdleri: number[];
}

/**
 * "Mentör başvurusu yap" (7 Ağustos 2026).
 *
 * İstek: "Öğretmen hesabında 'mentör başvurusu yap' bölümü ekleyelim. hangi
 * çalışma grubunda mentörlük yapabilir seçsin. hatta mümkünse diğer mentörlük
 * konuları ekleyebilsin?"
 *
 * Form HER DURUMDA basılır — reddedilmiş ya da bırakılmış bir mentörlük
 * yeniden başvurulabilir olmalı; kaydın durumunu gösterip formu gizlemek,
 * kişiyi çıkışsız bir ekranda bırakırdı. Gönderim mevcut kaydı BEKLIYOR'a
 * döndürür.
 *
 * Seçim ÇOKLU: bir öğretmen hem robotikte hem siber güvenlikte mentörlük
 * yapabilir. Serbest konu alanı, sabit grup listesinin taşımadığı her şey
 * için (istekteki "diğer mentörlük konuları").
 */
export function MentorlukDuzenleme({
  mevcut,
  gruplar,
  basvurEylemi,
  birakEylemi,
}: {
  mevcut: MentorlukDurumuGorunumu | null;
  gruplar: { id: number; ad: string }[];
  basvurEylemi: Eylem;
  birakEylemi: () => Promise<void>;
}) {
  const secili = new Set(mevcut?.seciliGrupIdleri ?? []);

  return (
    <>
      {mevcut && (
        <div className="mb-5 rounded-kart border border-cizgi bg-zemin p-4">
          <p className="text-sm font-medium text-metin">
            Başvuru durumunuz:{" "}
            <span
              className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${MENTORLUK_DURUM_SINIFLARI[mevcut.durum]}`}
            >
              {MENTORLUK_DURUM_ETIKETLERI[mevcut.durum]}
            </span>
          </p>
          {mevcut.durum === "REDDEDILDI" && mevcut.retGerekcesi && (
            <p className="mt-2 text-sm text-hata-metin">
              Gerekçe: {mevcut.retGerekcesi}
            </p>
          )}
          {mevcut.durum === "ONAYLANDI" && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <p className="text-sm text-metin-yumusak">
                Panodaki &quot;Mentöre sor&quot; ilanlarında mentör olarak
                görünüyorsunuz.
              </p>
              <form action={birakEylemi}>
                <button type="submit" className={SINIF_IKINCIL_BUTON}>
                  Mentörlüğü bırak
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      <form action={basvurEylemi} className="space-y-4">
        <fieldset>
          <legend className="text-sm font-medium text-metin">
            Hangi çalışma gruplarında mentörlük yapabilirsiniz?
          </legend>
          {/*
            ZORUNLU OLDUĞU BURADA YAZIYOR (21 Ağustos 2026 · istek: "listeden
            bir tik seçmeden başvurusu onaylanmasın"). Kuralı yalnızca sunucu
            uygulasaydı kişi formu gönderdikten SONRA hatayla karşılaşırdı;
            kural yine sunucuda (bkz. mentorlukKabulEdilirMi), bu satır onu
            önceden söylüyor.
          */}
          <p className="mt-1 mb-2 text-sm text-metin-yumusak">
            En az bir grup işaretleyin; birden fazla seçebilirsiniz.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {gruplar.map((grup) => (
              <label
                key={grup.id}
                className="flex items-center gap-2 rounded-md border border-cizgi px-3 py-2 text-sm text-metin"
              >
                <input
                  type="checkbox"
                  name="calismaGrubuId"
                  value={grup.id}
                  defaultChecked={secili.has(grup.id)}
                  className="h-4 w-4 rounded border-cizgi accent-[var(--renk-birincil)]"
                />
                {grup.ad}
              </label>
            ))}
          </div>
        </fieldset>

        {/*
          ETİKET "UZMANLIĞINIZ VE YETKİNLİĞİNİZ" (13 Ağustos 2026 · istek:
          "mentörlükte yazan Diğer mentörlük konularınız yerine uzmanlığınız ve
          yetkinliğiniz hakkında bilgilendiriniz yazsın").

          "(listede olmayanlar)" KALKTI (21 Ağustos 2026 · istek: "buradaki
          listede olmayanları kaldıralım · Bizleri bilgilendiriniz.,
          kullandığınız programlar deneyimleriniz, katıldığınız organizasyonlar
          vb yazsın").

          Alan artık yukarıdaki listenin ARTIĞI değil: grup seçimi neyi
          yapabildiğini söylüyor, bu alan bunu neye dayanarak söylediğini —
          kullanılan programlar, deneyim, katılınan organizasyonlar. Panoda
          mentörü seçen öğrencinin okuduğu satır da bu.
        */}
        <label className="block">
          <span className="text-sm font-medium text-metin">
            Uzmanlığınız ve yetkinliğiniz hakkında bilgilendiriniz
          </span>
          <span className="mt-1 mb-2 block text-sm text-metin-yumusak">
            Bizleri bilgilendiriniz: kullandığınız programlar, deneyimleriniz,
            katıldığınız organizasyonlar vb.
          </span>
          <textarea
            name="konular"
            rows={3}
            maxLength={MENTOR_KONULARI_AZAMI}
            placeholder="Fusion 360 ve Arduino ile çalışıyorum; TEKNOFEST 2025 robotik yarışmasına katıldım…"
            defaultValue={mevcut?.konular ?? ""}
            className={SINIF_GIRDI}
          />
        </label>

        <button type="submit" className={SINIF_BIRINCIL_BUTON}>
          <GraduationCap size={15} aria-hidden />
          {mevcut ? "Başvurumu güncelle" : "Mentör başvurusu yap"}
        </button>
        <p className="text-sm text-metin-yumusak">
          Başvurunuz proje yöneticisinin onayına
          gider. Güncelleme, onaylanmış bir başvuruyu yeniden onaya düşürür.
        </p>
      </form>
    </>
  );
}

// ---------------------------------------------------------------------------
// CV
// ---------------------------------------------------------------------------

export interface CvDurumu {
  cvDosyaAdi: string | null;
  cvYuklenmeTarihi: Date | null;
  /** "Eklemek istedikleriniz" metni; yazılmadıysa null. */
  cvEkNotu: string | null;
}

/**
 * BÖLÜM ARTIK İKİ ŞEY ALIYOR: DOSYA VE METİN (31 Ağustos 2026 · istek: "CV
 * yükle bunu eklemek istedikleriniz yap, dosya ekleme kalsın metin ekleme
 * alanı olsun").
 *
 * Dosya yükleme olduğu gibi duruyor; yanına, üretilen özgeçmişe girecek
 * serbest bir metin alanı geldi. İhtiyaç şuradan: bölüm yalnızca PDF kabul
 * ediyordu ve ekleyeceği şey bir dosyaya değmeyecek kadar kısa olan kişinin
 * (bir sertifika adı, bir kurs) yazacak yeri yoktu.
 *
 * İKİ AYRI FORM, İKİ AYRI EYLEM: tek formda olsalardı dosya alanı zorunlu
 * olduğu için metnini düzeltmek isteyen kişi PDF'ini her seferinde yeniden
 * seçerdi. Metni kaydetmek dosyaya, dosyayı kaldırmak metne dokunmuyor.
 *
 * METİN ÖNCE, DOSYA SONRA: yazmak herkesin yapabileceği iş, PDF yüklemek
 * hazırlığı olanın.
 */
export function CvDuzenleme({
  cv,
  kullaniciId,
  ogrenci = true,
  izinliTipler,
  ekNotuAzami,
  yukleEylemi,
  notKaydetEylemi,
  silEylemi,
}: {
  cv: CvDurumu | null;
  kullaniciId: number;
  /** İndirme rotası role göre değişir (7 Ağustos 2026 · öğretmen CV'si). */
  ogrenci?: boolean;
  izinliTipler: string[];
  ekNotuAzami: number;
  yukleEylemi: Eylem;
  notKaydetEylemi: Eylem;
  silEylemi: () => Promise<void>;
}) {
  const cvVar = Boolean(cv?.cvDosyaAdi);
  const cvYolu = ogrenci
    ? `/panel/ogrenciler/${kullaniciId}/cv`
    : `/panel/ogretmenler/${kullaniciId}/cv`;

  return (
    <>
      {/*
        METİN ALANI (31 Ağustos 2026).

        GÖRÜNEN ETİKETİ YOK, yalnızca yönlendirme satırı var (31 Ağustos 2026 ·
        istek: "bunu eklemek istediklerim yapacaktık başlığı"): kutunun başlığı
        artık "Eklemek istediklerim" ve alanın üstüne aynı sözü ikinci kez
        yazmak, kişinin bir satır önce okuduğunu tekrar ederdi. Kalan satır
        tekrar değil — metnin NEREYE gittiğini söylüyor.

        `aria-label` KALIYOR: görünen etiketi kaldırmak, alanı kimliksiz
        bırakmak değil (aynı karar aşağıdaki dosya alanında da verildi).
      */}
      <form action={notKaydetEylemi} className="mb-6 space-y-3">
        <label className="block">
          <span className="mb-2 block text-sm text-metin-yumusak">
            Özgeçmişinizde yer almasını istediğiniz, panelde başka bir bölüme
            girmeyen bilgiler: sertifikalar, kurslar, ilgi alanları, ek
            açıklamalar. Yazdığınız metin “Özgeçmiş oluştur” ile ürettiğiniz
            Word belgesine kendi başlığıyla girer.
          </span>
          <textarea
            name="ekNotu"
            aria-label="Özgeçmişe eklenecek metin"
            rows={5}
            maxLength={ekNotuAzami}
            placeholder="Cisco CCNA eğitimini tamamladım. Okul robotik kulübünde takım kaptanıyım…"
            defaultValue={cv?.cvEkNotu ?? ""}
            className={SINIF_GIRDI}
          />
        </label>
        {/*
          BOŞ KAYDETMEK GEÇERLİ: alanı temizlemek, yazılanı geri almanın tek
          yolu — bir metin kutusunun yanına ikinci bir "sil" düğmesi koymaya
          değmez (bkz. cvEkNotuKabulEdilirMi).
        */}
        <button type="submit" className={SINIF_IKINCIL_BUTON}>
          <FileText size={15} aria-hidden />
          Metni kaydet
        </button>
      </form>

      <p className="mb-4 text-sm text-metin-yumusak">
        Dosya olarak yüklemek isterseniz kabul edilen biçimler:{" "}
        {cvTipAdlari(izinliTipler)}.
      </p>

      {cvVar && cv && (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-kart border border-cizgi bg-zemin p-4">
          {/*
            Yeni sekmede açılır (7 Ağustos 2026 · istek). `<Link>` değil `<a>`:
            hedef bir rota, sayfa değil — ham `<a href>` basePath almadığı için
            `uygulamaYolu()` şart.
          */}
          <a
            href={uygulamaYolu(cvYolu)}
            target="_blank"
            rel="noopener noreferrer"
            className={SINIF_IKINCIL_BUTON}
          >
            <FileText size={15} aria-hidden />
            {cv.cvDosyaAdi}
          </a>
          <span className="text-sm text-metin-yumusak">
            {cv.cvYuklenmeTarihi
              ? `${tarihSaatYaz(cv.cvYuklenmeTarihi)} tarihinde yüklendi`
              : ""}
          </span>
          <form action={silEylemi} className="ml-auto">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-md border border-cizgi px-2.5 py-1.5 text-sm font-medium text-metin-yumusak transition hover:bg-kart hover:text-hata-metin"
            >
              <Trash2 size={14} aria-hidden />
              Kaldır
            </button>
          </form>
        </div>
      )}

      <form action={yukleEylemi} className="space-y-4">
        {/*
          ALAN ETİKETİ EKRANDAN KALKTI (22 Ağustos 2026 · istek: "Yeni CV yükle
          bu yazıyı kaldır"). Alan tek başına duruyor ve hemen altındaki düğme
          ("CV yükle" / "CV'yi değiştir") ne olacağını zaten yazıyordu.

          `aria-label` KALIYOR: etiket silinseydi ekran okuyucu dosya alanını
          adsız okurdu — görünen etiketi kaldırmak, alanı kimliksiz bırakmak
          değil.
        */}
        <label className="block">
          <input
            type="file"
            name="cv"
            required
            aria-label={cvVar ? "Yeni CV dosyası" : "CV dosyası"}
            accept={izinliTipler.join(",")}
            className="block w-full text-sm text-metin file:mr-3 file:rounded-md file:border file:border-cizgi file:bg-kart file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-metin"
          />
        </label>
        {/*
          "YENİ DOSYA MEVCUT CV'NİZİN YERİNE GEÇER" UYARISI KALKTI (22 Ağustos
          2026 · istek). Düğmenin üzerinde zaten "CV'yi değiştir" yazıyor —
          değiştirmenin ne demek olduğunu ayrıca anlatan bir satır, kişinin
          bildiği şeyi tekrar ediyordu.

          DAVRANIŞ DEĞİŞMEDİ: yükleme eskisinin yerine geçmeye devam ediyor
          (bkz. lib/ogrenci/cv.ts · cvKaydet); kalkan yalnızca metin.
        */}
        <button type="submit" className={SINIF_BIRINCIL_BUTON}>
          {cvVar ? "CV'yi değiştir" : "CV yükle"}
        </button>
      </form>
    </>
  );
}

// ---------------------------------------------------------------------------
// Kazanım kayıtları: ekleme formu + mevcut kayıtların yönetimi
// ---------------------------------------------------------------------------

export interface BelgeSinirlari {
  gorselMaksBayt: number;
  belgeMaksBayt: number;
}

/**
 * Kazanım kaydının ALANLARI — ekleme ve düzenleme formlarının ortak gövdesi.
 *
 * TEK YERDE (24 Ağustos 2026): kayıtlar artık kendi sayfasında düzenlenebiliyor
 * (bkz. panel/kayitlarim/[id]) ve düzenleme formuna ayrı bir JSX yazılsaydı,
 * birine eklenen alan öbüründe eksik kalırdı — dosyanın en baştaki kararı bu.
 *
 * `kayit` verildiğinde alanlar o kaydın değerleriyle dolu basılır; verilmezse
 * boş form çıkar. Alanların HANGİSİNİN basılacağı ikisinde de aynı yerden,
 * tipin tanımından okunur.
 */
function KazanimAlanlari({
  tanim,
  kayit,
  izinliBelgeTipleri,
  belgeSinirlari,
  belgeAlaniVarMi,
}: {
  tanim: KazanimTipiTanimi;
  /** Düzenlenen kayıt; yeni kayıt formunda yok. */
  kayit?: KazanimSatiri;
  izinliBelgeTipleri: string[];
  belgeSinirlari: BelgeSinirlari;
  belgeAlaniVarMi: boolean;
}) {
  /*
   * ESKİ SERBEST METİN LİSTEYE EKLENİR (bkz. DUZENLEYEN_SECENEKLERI): alan 22
   * Ağustos'ta listeye çevrildi ve o tarihten önce "MEB" yazan bir kaydın
   * değeri hiçbir seçeneğe uymuyor. Eklenmeseydi tarayıcı ilk seçeneği seçili
   * gösterir, kişi alana hiç dokunmadan kaydettiğinde değer silinirdi.
   */
  const duzenleyenSecenekleri =
    kayit?.duzenleyen && !DUZENLEYEN_SECENEKLERI.includes(kayit.duzenleyen)
      ? [...DUZENLEYEN_SECENEKLERI, kayit.duzenleyen]
      : DUZENLEYEN_SECENEKLERI;

  /*
   * Bağlantı satırları: girilmiş olanlar + en az bir boş satır (yeni kayıtta
   * üç boş satır). Sayfada JavaScript yok, "satır ekle" düğmesi yapılamıyor;
   * dolu kayda hiç boş satır bırakılmasaydı yeni bağlantı eklenemezdi.
   */
  const mevcutBaglantilar = kayit?.baglantilar ?? [];
  const baglantiSatirlari = [
    ...mevcutBaglantilar.map((baglanti) => ({
      adres: baglanti.adres,
      etiket: baglanti.etiket ?? "",
    })),
    ...Array.from({ length: Math.max(3 - mevcutBaglantilar.length, 1) }, () => ({
      adres: "",
      etiket: "",
    })),
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {/*
        GençTek etkinliği listeden seçilir; "Diğer" bırakılırsa ad serbest
        yazılır. İki alan da AYNI ANDA basılır — sunucu hangisinin
        dolduğuna bakıp adı ona göre belirler.
      */}
      {/*
        "GENÇTEK ETKİNLİĞİ" AÇILIR LİSTESİ KALKTI (22 Ağustos 2026 ·
        istekler: "GençTek etkinliği bu alanı ve açılır listeyi kaldır" ·
        "yalnızca 'Diğer' seçtiyseniz sil").

        Liste, kaydın adını GençTek program kataloğundan seçtiriyordu ve
        seçildiğinde alttaki ad alanı boş bırakılıyordu; iki alan tek bir
        soruyu ("bu kaydın adı ne") iki farklı yoldan soruyordu. Ad artık
        HER TÜRDE elle yazılıyor ve bu yüzden HER TÜRDE zorunlu.

        SONUCU: yeni kayıtlar `temelEtkinlikProgramiId` taşımıyor, yani
        katalogdaki programa bağlanmıyorlar. Daha önce bağlanmış kayıtlar
        bağlantılarını KORUYOR. Kural katmanındaki `programSecimiVarMi`
        dalı yerinde duruyor (bkz. kazanimKabulEdilirMi) — form artık o
        alanı göndermiyor, kural da bu yüzden hiç çalışmıyor.
      */}
      <label className="block sm:col-span-2">
        <span className="text-sm font-medium text-metin">
          {tanim.baslikEtiketi}
        </span>
        <input
          type="text"
          name="baslik"
          required
          defaultValue={kayit?.baslik ?? ""}
          maxLength={250}
          placeholder={tanim.baslikOrnegi}
          className={SINIF_GIRDI}
        />
      </label>

      {/*
        "Belirtmek istemiyorum" KALDIRILDI ve alan zorunlu oldu. Boş seçenek
        yerine seçilemez bir yer tutucu duruyor: `required` tek başına, ilk
        seçenek geçerli bir değer olduğunda hiçbir şey yapmazdı.
      */}
      {tanim.katilimBicimiVarMi && (
        <label className="block">
          <span className="text-sm font-medium text-metin">
            Katılım biçimi
          </span>
          <select
            name="katilimBicimi"
            required
            defaultValue={kayit?.katilimBicimi ?? ""}
            className={SINIF_GIRDI}
          >
            <option value="" disabled>
              Seçiniz
            </option>
            {KATILIM_BICIMLERI.map((bicim) => (
              <option key={bicim} value={bicim}>
                {KATILIM_BICIMI_ETIKETLERI[bicim]}
              </option>
            ))}
          </select>
        </label>
      )}

      {tanim.hedefKitleVarMi && (
        <label className="block">
          <span className="text-sm font-medium text-metin">Hedef kitle</span>
          <input
            type="text"
            name="hedefKitle"
            defaultValue={kayit?.hedefKitle ?? ""}
            maxLength={200}
            placeholder="9. sınıflar, veliler, öğretmenler"
            className={SINIF_GIRDI}
          />
        </label>
      )}

      {tanim.duzenleyenVarMi && (
        <label className="block">
          <span className="text-sm font-medium text-metin">Düzenleyen</span>
          {/*
            LİSTEDEN SEÇİLİYOR (22 Ağustos 2026 · istek). Serbest metinken
            aynı düzey herkeste başka türlü yazılıyordu ("MEB", "Millî
            Eğitim Bakanlığı", "Bakanlık") ve alan sayılabilir bir bilgi
            taşımıyordu.

            BOŞ SEÇENEK VAR ve varsayılan o: alan isteğe bağlı, ilk
            seçeneğin geçerli bir değer olması kişinin seçmediği bir düzeyi
            seçmiş gibi kaydederdi.
          */}
          <select
            name="duzenleyen"
            defaultValue={kayit?.duzenleyen ?? ""}
            className={SINIF_GIRDI}
          >
            <option value="">Belirtmek istemiyorum</option>
            {duzenleyenSecenekleri.map((secenek) => (
              <option key={secenek} value={secenek}>
                {secenek}
              </option>
            ))}
          </select>
        </label>
      )}

      {/*
        ÜRÜNE ÖZGÜ ALANLAR (D5). PROGRAM DOSYASI YÜKLENMİYOR — istek
        "şimdilik sadece tanıtım yapsınlar" diyor.
      */}
      {tanim.urunAlanlariVarMi && (
        <>
          <label className="block">
            <span className="text-sm font-medium text-metin">
              Geliştiren ekip{" "}
              <span className="font-normal text-metin-yumusak">
                (isteğe bağlı)
              </span>
            </span>
            <input
              type="text"
              name="gelistirenEkip"
              defaultValue={kayit?.gelistirenEkip ?? ""}
              maxLength={250}
              placeholder="Kendim · ya da ekip arkadaşlarının adları"
              className={SINIF_GIRDI}
            />
          </label>

          {/*
            ÜRÜN GÖRSELİ — VİTRİN KAPAĞI (28 Ağustos 2026 · istek: "vitrine
            ürün eklerken bir tane ürün görseli ekleyebilelim").

            AYRI BİR DOSYA ALANI DEĞİL, aynı `kazanim_ek` deposuna yazılan tek
            bir görsel: fark, kaydın kapak olarak İŞARETLENMESİ. Destekleyici
            görsellerden ayrı bir alan açılmasının sebebi niyet farkı — kart
            için seçilen görsel ile "etkinlikten fotoğraflar" aynı şey değil ve
            hangisinin vitrine çıkacağını sistemin tahmin etmesi gerekmemeli.

            TEK DOSYA: `multiple` yok. Kart tek görsel basıyor, ikincisini
            almak kullanıcıya hangisinin görüneceğini söylemeden dosya
            yükletmek olurdu; gerisi destekleyici görsellere gider.

            Alan kayıt EKLEME ekranında da DÜZENLEME ekranında da basılır:
            düzenlemede yeni dosya seçilirse kapak onunla değişir, boş
            bırakılırsa mevcut kapak korunur (bkz. kazanimGuncelleEylemi).
          */}
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium text-metin">
              Ürün görseli{" "}
              <span className="font-normal text-metin-yumusak">
                (isteğe bağlı)
              </span>
            </span>
            <input
              type="file"
              name="urunGorseli"
              accept="image/*"
              className={SINIF_GIRDI}
            />
            <span className="mt-1 block text-xs text-metin-yumusak">
              Vitrinde ürün kartının kapağı olarak görünür. En fazla{" "}
              {(belgeSinirlari.gorselMaksBayt / (1024 * 1024)).toFixed(0)} MB.
              {kayit ? " Seçmezseniz mevcut kapak korunur." : ""}
            </span>
          </label>

          <label className="flex items-start gap-2 sm:col-span-2">
            <input
              type="checkbox"
              name="markettePaylasilsin"
              value="evet"
              defaultChecked={kayit?.markettePaylasilsin === true}
              className="mt-1 h-4 w-4 rounded border-cizgi accent-[var(--renk-birincil)]"
            />
            {/*
              AÇIKLAMA SATIRI KALKTI, BAĞLANTI KALDI (22 Ağustos 2026 ·
              istekler: "İşaretlemezseniz ürün yalnızca sizde kalır…"
              cümlesi · "İşaretlerseniz ürününüz GençTek Market'te
              listelenir… linki markette paylaşın yanına koy, bu yazıyı
              kaldır").

              Tek satırlık bir onay kutusunun altında dört satırlık
              açıklama duruyordu ve ikisi de aynı şeyi söylüyordu. Kalan
              tek gerçek bilgi marketin NEREDE olduğuydu; o da artık
              etiketin yanındaki bağlantı.

              BAĞLANTI YENİ SEKMEDE: aynı sekmede açılsaydı kişi doldurduğu
              formdan çıkar ve yazdıkları giderdi.
            */}
            <span className="text-sm text-metin">
              <span className="font-medium">Bu ürünü vitrinde paylaş</span>{" "}
              <Link
                href="/panel/urunler"
                target="_blank"
                rel="noopener noreferrer"
                className="text-vurgu-metin underline underline-offset-2"
              >
                GençTek Vitrin
              </Link>
            </span>
          </label>

          <fieldset className="sm:col-span-2">
            <legend className="text-sm font-medium text-metin">
              Bağlantılar{" "}
              <span className="font-normal text-metin-yumusak">
                (isteğe bağlı)
              </span>
            </legend>
            {/*
              "BOŞ SATIRLAR YOK SAYILIR" CÜMLESİ KALKTI (22 Ağustos 2026 ·
              istek). Formda sabit sayıda satır basılıyor ve doldurulmayanı
              atmak kullanıcının beklediği davranış — söylenmesi gereken bir
              şey değil. Kural yerinde duruyor (bkz. kazanimKabulEdilirMi).
            */}
            <p className="mt-1 mb-2 text-sm text-metin-yumusak">
              Ürünün deposu, canlı sürümü ve tanıtım videosu indirme
              linkleri ayrı ayrı yüklenebilir.
            </p>
            {/*
              Sabit üç satır: JavaScript olmadan "satır ekle" düğmesi
              yapılamıyor ve sunucuya gidip gelmek formu sıfırlardı.
            */}
            {/*
              ETİKET ALANI KALKTI (22 Ağustos 2026 · istek: "kaynak kod
              giriş alanını kaldıralım"). Her satırın yanında "kaynak kod"
              yer tutuculu bir ad kutusu vardı; adres zaten kendini
              anlatıyor ve iki kutulu satır formu iki kat uzatıyordu.

              ALAN SUNUCUDA HÂLÂ OKUNUYOR: eylem `baglantiEtiket` dizisini
              paralel okuyor ve gelmediğinde boş kabul ediyor
              (bkz. kazanim-eylemleri.ts). Etiketsiz bağlantı gösterimde
              adresiyle basılır; DAHA ÖNCE etiketle girilmiş kayıtlar
              etiketlerini korur.
            */}
            <div className="space-y-2">
              {baglantiSatirlari.map((satir, sira) => (
                <div key={sira}>
                  <input
                    type="url"
                    name="baglantiAdres"
                    defaultValue={satir.adres}
                    maxLength={500}
                    placeholder="https://"
                    className={SINIF_GIRDI}
                    aria-label={`${sira + 1}. bağlantı adresi`}
                  />
                  {/*
                    ETİKET GİZLİ ALANDA TAŞINIYOR: form etiket sormuyor ama
                    eski kayıtların etiketi var (bkz. yukarıdaki not) ve
                    düzenleme kaydı yeniden yazdığı için gönderilmezse
                    silinirdi. Sunucu iki diziyi SIRAYLA eşliyor
                    (adres[i] ↔ etiket[i]); bu yüzden her adres satırının
                    yanında bir etiket alanı basılır — boş olsa bile.
                  */}
                  <input
                    type="hidden"
                    name="baglantiEtiket"
                    defaultValue={satir.etiket}
                  />
                </div>
              ))}
            </div>
          </fieldset>
        </>
      )}

      {tanim.dereceVarMi && (
        <label className="block">
          <span className="text-sm font-medium text-metin">
            Gösterdiğiniz başarı
          </span>
          <input
            type="text"
            name="derece"
            defaultValue={kayit?.derece ?? ""}
            maxLength={120}
            placeholder="Türkiye 1.si"
            className={SINIF_GIRDI}
          />
        </label>
      )}

      {/*
        TARİH ÜRÜNDE SORULMUYOR (22 Ağustos 2026 · istek: "Tarih alanını
        kaldır, otomatik atsın"). Ürünün tarihi, kaydın girildiği gündür ve
        kişi onu bilmiyor da değil — yazmasının bir karşılığı yok.

        ÖBÜR TÜRLERDE KALIYOR: sertifikanın, derecenin ve dış etkinliğin
        tarihi GEÇMİŞTE ve kaydın kendisidir. "Bugün" atamak, üç yıl önce
        alınmış sertifikayı bugün alınmış göstermek olurdu.

        Alan hiç GÖNDERİLMEDİĞİNDE sunucu o günü yazıyor
        (bkz. kazanim-eylemleri.ts) — boş bırakılmış bir alanla karışmasın
        diye ayrım "gönderildi mi" üzerinden kuruluyor.
      */}
      {!tanim.urunAlanlariVarMi && (
        <label className="block">
          <span className="text-sm font-medium text-metin">Tarih</span>
          <input
            type="date"
            name="tarih"
            defaultValue={kayit?.tarih ? girdiTarihi(kayit.tarih) : ""}
            className={SINIF_GIRDI}
          />
        </label>
      )}

      {/*
        TEK BAĞLANTI ALANI ÜRÜNDE BASILMIYOR (22 Ağustos 2026 · istek:
        "Bağlantı (isteğe bağlı) bu alanı kaldıralım").

        Üründe hemen yukarıda üç satırlık "Bağlantılar" alanı var ve bu
        tek kutu onun yanında ikinci bir bağlantı yeri gibi duruyordu:
        kişi adresi hangisine yazacağını seçmek zorunda kalıyordu.

        ÖBÜR TÜRLERDE KALIYOR: sertifikanın, derecenin ve dış etkinliğin
        üçlü bağlantı alanı yok — orada bu kutu, kaydın belgesine giden
        TEK yol. Hepsinden kaldırmak, beş türde bağlantı girmeyi
        kapatırdı.
      */}
      {!tanim.urunAlanlariVarMi && (
        <label className="block">
          <span className="text-sm font-medium text-metin">
            Bağlantı (isteğe bağlı)
          </span>
          <input
            type="url"
            name="baglantiUrl"
            defaultValue={kayit?.baglantiUrl ?? ""}
            maxLength={500}
            placeholder="https://"
            className={SINIF_GIRDI}
          />
        </label>
      )}

      <label className="block sm:col-span-2">
        <span className="text-sm font-medium text-metin">
          Açıklama (isteğe bağlı)
        </span>
        <textarea
          name="aciklama"
          defaultValue={kayit?.aciklama ?? ""}
          rows={3}
          maxLength={2000}
          placeholder={tanim.aciklamaOrnegi}
          className={SINIF_GIRDI}
        />
      </label>

      {/*
        BELGE ALANI YALNIZCA EKLEME FORMUNDA (24 Ağustos 2026): var olan
        bir kaydın belgeleri kendi sayfasında ayrı ayrı ekleniyor ve
        kaldırılıyor (bkz. panel/kayitlarim/[id]). Aynı alan düzenleme
        formunda da dursaydı, kaydın metnini düzeltmek isteyen kişi
        zorunlu tipte (sertifika) her kaydedişte belgeyi YENİDEN yüklemek
        zorunda kalırdı.
      */}
      {/*
        Destekleyici belgeler. Kayıt oluşturulduktan SONRA yazılır; dosya
        reddedilirse kayıt geri alınmaz, uyarı gösterilir ve dosya sonradan
        eklenebilir (bkz. kazanimEkleEylemi).
      */}
      {belgeAlaniVarMi && (
        <label className="block sm:col-span-2">
          {/*
            ALAN ETİKETİ EKRANDAN KALKTI (22 Ağustos 2026 · istek:
            "Destekleyici belgeler (isteğe bağlı) bu yazı kalksın"). Altındaki
            boyut satırı zaten neyin yükleneceğini söylüyor.

            `aria-label` KALIYOR: görünen etiketi kaldırmak, alanı ekran
            okuyucuda adsız bırakmak değil (aynı karar CV alanında da
            verildi).
          */}
          <input
            type="file"
            name="belgeler"
            multiple
            /*
              ZORUNLU OLAN TİPLER VAR (22 Ağustos 2026 · istek: "belge
              yüklemek zorunlu olsun burada"). Tarayıcı doğrulaması tek
              başına yeterli değil — sunucu da aynı koşulu ayrıca sınıyor
              (bkz. kazanimEkleEylemi).
            */
            required={tanim.belgeZorunluMu}
            aria-label={
              tanim.belgeZorunluMu
                ? "Belge"
                : "Destekleyici belgeler (isteğe bağlı)"
            }
            accept={izinliBelgeTipleri.join(",")}
            className="mt-1 block w-full text-sm text-metin file:mr-3 file:rounded-md file:border file:border-cizgi file:bg-kart file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-metin"
          />
          {/*
            YALNIZCA BOYUT SINIRI KALDI (22 Ağustos 2026 · istek). Cümlenin
            başındaki "ekleyebilirsiniz" alanın kendisinin söylediğini
            tekrarlıyordu; sondaki "danışmanınız ve koordinatörünüz de görür"
            ise bir gizlilik uyarısıydı — kaldırılması GÖRÜNÜRLÜĞÜ
            değiştirmiyor, yalnızca uyarıyı kaldırıyor: belgeler danışman ve
            koordinatör tarafından görülmeye devam ediyor.
          */}
          <span className="mt-1 block text-sm text-metin-yumusak">
            {tanim.belgeZorunluMu && "Belge yüklemek zorunludur. "}
            Görsel için en fazla{" "}
            {(belgeSinirlari.gorselMaksBayt / (1024 * 1024)).toFixed(0)} MB,
            belge için{" "}
            {(belgeSinirlari.belgeMaksBayt / (1024 * 1024)).toFixed(0)} MB.
          </span>
        </label>
      )}
    </div>
  );
}

/**
 * BİR GRUBUN kendi "yeni kayıt ekle" formu.
 *
 * Profilden Panelim'e TAŞINDI (7 Ağustos 2026), kopyalanmadı: aynı kaydın iki
 * ayrı formdan girilmesi, birine eklenen alanın öbüründe eksik kalması
 * demek olurdu.
 *
 * HER BAŞLIK KENDİ FORMUNU BASIYOR (21 Ağustos 2026 · istek: "ürünlerim
 * altında kendi formu, deneyimlerim altında kendi formu, gençtek yolculuğum
 * altında kendi formu olacak; bu üç başlık için ortak form olmasın").
 *
 * ÖNCESİ: tek bir form vardı, üstünde bütün grupların sekmeleri sıralanıyordu
 * ve hangi başlığa kayıt girildiği yalnızca seçili sekmeden anlaşılıyordu.
 * Başlıklar formun sahibi değil, formun ayarı gibi duruyordu. Şimdi bölüm
 * neyse form odur; sayfa grupları dolaşıp her birine bunu basıyor
 * (bkz. kayitEklemeGruplari · app/panel/page.tsx).
 *
 * BİLEŞEN YİNE TEK: alanları tanımlayan yer burası. Üç forma üç ayrı JSX
 * yazılsaydı, birine eklenen alan öbürlerinde eksik kalırdı — dosyanın en
 * baştaki kararı bu.
 *
 * Sayfada JAVASCRIPT YOK: türe göre alan gösterip gizlemenin yolu olmadığı
 * için form, seçili tür neyse sunucuda ona göre basılır ve tür adreste taşınır
 * (`?tur=...`). Bu yüzden tek tipli gruplarda (Ürünlerim, Topluluklarım,
 * GençTek) hiç tür seçimi basılmaz: seçecek bir şey yok.
 */
export function KayitEklemeFormu({
  grup,
  tanimlar,
  seciliTanim,
  izinliBelgeTipleri,
  belgeSinirlari,
  ekleEylemi,
}: {
  grup: KazanimGrubu;
  /** Grubun elle girilebilen tipleri; biri seçili olan. */
  tanimlar: KazanimTipiTanimi[];
  seciliTanim: KazanimTipiTanimi;
  izinliBelgeTipleri: string[];
  belgeSinirlari: BelgeSinirlari;
  ekleEylemi: Eylem;
}) {
  return (
    <>
      {/*
        ÇOK TİPLİ GRUPTA LİSTE (10 Ağustos 2026 · istek: "Deneyimlerim … bunu 4
        ayrı seçenek olmasın, formda aşağı açılan listeden seçsin"). Tipler
        BİRLEŞMEDİ — alan kuralları tipe göre değişiyor — yalnızca seçim biçimi
        değişti. Liste artık kendi bölümünün içinde: seçilen tür yalnızca bu
        formu değiştiriyor, öbür başlıkların formuna dokunmuyor.
      */}
      {tanimlar.length > 1 && (
        <div className="mb-4">
          <span className="block text-sm font-medium text-metin">
            Kayıt türü
          </span>
          <div className="mt-1.5">
            <KayitTuruSecici
              etiket={grup.baslik}
              capa={kazanimGrupCapasi(grup.kod)}
              secenekler={tanimlar.map((tanim) => ({
                tip: tanim.tip,
                baslik: tanim.baslik,
              }))}
              seciliTip={seciliTanim.tip}
            />
          </div>
        </div>
      )}

      {/* Açıklaması olmayan türde satır hiç basılmaz — boş bir <p>, tür
          şeridiyle formun arasını sebepsiz açardı. */}
      {seciliTanim.aciklama && (
        <p className="mb-4 text-sm text-metin-yumusak">
          {seciliTanim.aciklama}
        </p>
      )}

      <form action={ekleEylemi} className="space-y-4">
        <input type="hidden" name="tip" value={seciliTanim.tip} />

        <KazanimAlanlari
          tanim={seciliTanim}
          izinliBelgeTipleri={izinliBelgeTipleri}
          belgeSinirlari={belgeSinirlari}
          belgeAlaniVarMi
        />

        <button type="submit" className={SINIF_BIRINCIL_BUTON}>
          <Plus size={15} aria-hidden />
          Ekle
        </button>
      </form>
    </>
  );
}

/**
 * Grup kutusunun İÇİNDEKİ "girdiğim kayıtlar" listesi (24 Ağustos 2026 ·
 * istek: "her bir bölümün altına liste şeklinde girdiği verileri görebilsin,
 * tıklayınca sayfasına gidip düzenleyebilsin"). 25 Ağustos 2026'da ekleme
 * formunun ÜSTÜNE alındı (istek: "onu formların üstüne alalım").
 *
 * ÖNCESİ: grup kutusu açıldığında yalnızca EKLEME FORMU çıkıyordu. Kişi kaydı
 * giriyor, kutunun özetinde "2 kayıt" yazısını görüyor ama ne girdiğini
 * göremiyordu — düzenlemenin yolu da hiç yoktu ("Girdiğim kayıtlar" bölümü 22
 * Ağustos'ta kalkmıştı ve kayıtların tek göründüğü yer orasıydı).
 *
 * SATIR BAĞLANTIDIR, form değil: düzenleme kaydın kendi sayfasında yapılıyor
 * (bkz. panel/kayitlarim/[id]). Sekiz alanlı bir düzenleme formunu her satırın
 * altına basmak, üç kayıt giren kişide grubu okunamaz hâle getirirdi.
 *
 * ÇOK TİPLİ GRUPTA (Deneyimlerim) TÜR SATIRDA YAZAR: ekleme formunun tür
 * seçimi yalnızca formu değiştirir, liste grubun BÜTÜN kayıtlarını gösterir —
 * seçili türe göre süzülseydi kişi girdiği kaydı yine bulamazdı.
 */
export function GirilenKayitlar({
  kazanimlar,
  tanimlar,
}: {
  kazanimlar: KazanimSatiri[];
  /** Grubun tip tanımları — satırdaki tür etiketi buradan okunur. */
  tanimlar: KazanimTipiTanimi[];
}) {
  /*
   * AYIRICI ÇİZGİ ALTTA: liste 25 Ağustos 2026'da ekleme formunun ÜSTÜNE
   * alındı (bkz. panel/page.tsx), dolayısıyla ayırıcı listeyle formun ARASINDA
   * duruyor — üstte kalsaydı kutu başlığının hemen ardından ikinci bir çizgi
   * çıkardı.
   */
  /*
   * BOŞ BÖLÜM SESSİZ (26 Ağustos 2026 · istek: "Ürünlerim bölümündeki 'Bu
   * bölümde henüz kaydınız yok. Aşağıdaki formdan ekleyebilirsiniz.' yazısı
   * kalksın").
   *
   * Cümlenin ikinci yarısı ekranın kendisini tarif ediyordu: form zaten
   * hemen altında duruyor ve boş liste bunu söylemeye gerek bırakmıyor.
   * Hiçbir kaydı olmayan kişinin profili üç bölümde üç kez aynı cümleyi
   * okuyordu.
   */
  if (kazanimlar.length === 0) return null;

  return (
    <div className="mb-6 border-b border-cizgi pb-4">
      <h3 className="text-sm font-semibold text-baslik">
        Girdiğim kayıtlar
        <span className="ml-2 font-normal text-metin-yumusak">
          {kazanimlar.length}
        </span>
      </h3>
      <ul className="mt-2 divide-y divide-cizgi">
        {kazanimlar.map((kazanim) => {
          const tanim = tanimlar.find((aday) => aday.tip === kazanim.tip);
          const altBilgiler = [
            /*
             * Tür yalnızca ÇOK TİPLİ grupta yazılır: "Ürünlerim → Ürün" iki kez
             * aynı şeyi söylerdi (aynı kural profildeki tip başlıklarında).
             */
            tanimlar.length > 1 ? (tanim?.baslik ?? null) : null,
            kazanim.derece,
            kazanim.tarih ? tarihYaz(kazanim.tarih) : null,
            kazanim.ekler && kazanim.ekler.length > 0
              ? `${kazanim.ekler.length} belge`
              : null,
          ].filter((deger): deger is string => Boolean(deger));

          return (
            <li key={kazanim.id}>
              <Link
                href={`/panel/kayitlarim/${kazanim.id}`}
                className="-mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-2.5 transition hover:bg-zemin"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-metin">
                    {kazanim.baslik}
                  </span>
                  {altBilgiler.length > 0 && (
                    <span className="mt-0.5 block truncate text-sm text-metin-yumusak">
                      {altBilgiler.join(" · ")}
                    </span>
                  )}
                </span>
                {/*
                  Kalem ikonu, satırın TIKLANABİLİR olduğunu ve nereye
                  götürdüğünü söylüyor: düz bir başlık listesi salt gösterim
                  gibi okunuyordu.
                */}
                <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-vurgu-metin">
                  <Pencil size={14} aria-hidden />
                  Düzenle
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Var olan bir kaydın DÜZENLEME formu — kaydın kendi sayfasında (24 Ağustos
 * 2026).
 *
 * Alanlar ekleme formuyla AYNI bileşenden gelir (bkz. KazanimAlanlari); burada
 * değişen üç şey var:
 *
 *   1. Tür SEÇİLMEZ, kaydın tipi neyse odur. Türü değiştirmek, alan kuralları
 *      tipe bağlı olduğu için (derece yalnızca yarışmada, ürün alanları
 *      yalnızca üründe) kaydın yarısını sessizce düşürürdü.
 *   2. Belge alanı basılmaz: belgeler sayfanın kendi bölümünde yönetiliyor.
 *   3. Düğme "Kaydet" — "Ekle" ikinci bir kayıt açacakmış gibi okunuyordu.
 */
export function KayitDuzenlemeFormu({
  kazanim,
  tanim,
  izinliBelgeTipleri,
  belgeSinirlari,
  guncelleEylemi,
}: {
  kazanim: KazanimSatiri;
  tanim: KazanimTipiTanimi;
  izinliBelgeTipleri: string[];
  belgeSinirlari: BelgeSinirlari;
  guncelleEylemi: Eylem;
}) {
  return (
    <form action={guncelleEylemi} className="space-y-4">
      {/*
        Kaydın kimliği formda taşınıyor; TİPİ TAŞINMIYOR — sunucu onu kendi
        satırından okuyor (bkz. kazanimGuncelleEylemi). Gizli alandan gelseydi
        isteği elle kurcalayan biri kaydın tipini değiştirebilirdi.
      */}
      <input type="hidden" name="kazanimId" value={kazanim.id} />

      <KazanimAlanlari
        tanim={tanim}
        kayit={kazanim}
        izinliBelgeTipleri={izinliBelgeTipleri}
        belgeSinirlari={belgeSinirlari}
        belgeAlaniVarMi={false}
      />

      <button type="submit" className={SINIF_BIRINCIL_BUTON}>
        <Check size={15} aria-hidden />
        Kaydet
      </button>
    </form>
  );
}

/**
 * Girilmiş kayıtların YÖNETİMİ: silme ve destekleyici belge ekleme/çıkarma.
 *
 * Profilde aynı kayıtlar eylemsiz basılıyor (salt görüntüleme); düzenleme
 * yalnızca burada. Liste `kazanimTipleri(..., { arsivDahil: true })` ile
 * bölümleniyor: kapatılmış tipin (GençTek etkinliği beyanı) eski kayıtları
 * profilde artık görünmüyor ve kullanıcı onları ancak buradan silebilir —
 * başlıksız bir yığın hâlinde gösterilselerdi ne oldukları anlaşılmazdı.
 */
export function KayitYonetimi({
  kazanimlar,
  sahip,
  silmeEylemi,
  belgeEkleEylemi,
  belgeSilEylemi,
  izinliBelgeTipleri,
}: {
  kazanimlar: KazanimSatiri[];
  sahip: KazanimSahibi;
  silmeEylemi: Eylem;
  belgeEkleEylemi: Eylem;
  belgeSilEylemi: Eylem;
  izinliBelgeTipleri: string[];
}) {
  const eylemler = {
    silmeEylemi,
    belgeEkleEylemi,
    belgeSilEylemi,
    izinliBelgeTipleri,
  };

  const bolumler = kazanimTipleri(sahip, { arsivDahil: true })
    .map((tanim) => ({
      tanim,
      kayitlar: kazanimlar.filter((kazanim) => kazanim.tip === tanim.tip),
    }))
    /*
     * BOŞ BÖLÜM BASILMAZ — profildeki gösterimden farklı olarak. Orada boş
     * başlık "bu bölüm var ama doldurulmamış" bilgisini veriyor; burada
     * yönetilecek bir şey yok demek ve sekiz boş başlık, dolu olanı arayan
     * kullanıcıyı yorardı.
     */
    .filter((bolum) => bolum.kayitlar.length > 0);

  if (bolumler.length === 0) {
    return (
      <p className="text-metin-yumusak">
        Henüz kayıt girmediniz. Yukarıdaki formdan ekleyebilirsiniz.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {bolumler.map(({ tanim, kayitlar }) => (
        <div key={tanim.tip}>
          <h3 className="text-sm font-semibold text-baslik">
            {tanim.baslik}
            <span className="ml-2 font-normal text-metin-yumusak">
              {kayitlar.length}
            </span>
          </h3>
          <div className="mt-2">
            <KazanimListesi kazanimlar={kayitlar} {...eylemler} />
          </div>
        </div>
      ))}
    </div>
  );
}

/*
 * ARŞİV NOTU KALKTI (21 Ağustos 2026 · istek: "Bu kayıt türü kapatıldı ve
 * profilinizde görünmüyor … bu yazı kalkacak"). Kapatılmış tipin kayıtları
 * listede duruyor; başlığın altında duran uzun uyarı, listeyi okumadan önce
 * okunması gereken bir metin hâline gelmişti. Kaydın neden profile düşmediği
 * bilgisi kayıt formunda zaten yazıyor (bkz. lib/kazanim/kurallar.ts).
 */

/*
 * "PROFİLİMDE NASIL GÖRÜNÜYOR" VE "PANELDEN DÜZENLE" BAĞLANTILARI SİLİNDİ
 * (20 Ağustos 2026 · panel-profil birleşmesi).
 *
 * İkisi de bölünmenin bedeliydi: her düzenleme bölümünün altında profile,
 * her profil kartının altında panele giden bir satır duruyordu. Tek yüzeyde
 * gidilecek bir "öbür ekran" yok — değer ile onu değiştiren form artık aynı
 * kartın içinde.
 */

/** Profildeki başlık ikonları — iki ekranın aynı ikonu kullanması için. */
export const DUZENLEME_IKONLARI = {
  foto: Camera,
  iletisim: Mail,
  danismanlik: ShieldCheck,
  cv: FileText,
  kayit: Sparkles,
} as const;
