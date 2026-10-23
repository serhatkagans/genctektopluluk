import {
  BadgeCheck,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Filter,
  Hourglass,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { DisaAktarmaBagi } from "@/components/DisaAktarmaBagi";
import { OtomatikSecimKutusu } from "@/components/SuzgecOtomatikSecim";
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
  BilgiKutusu,
  Kart,
  KartBasligi,
  KirintiYolu,
  SayfaBasligi,
  SINIF_BIRINCIL_BUTON,
  SINIF_IKINCIL_BUTON,
} from "@/components/ui";
import { envanterYolIzi } from "../envanter-yolu";
import { oturumKullanicisiZorunlu } from "@/lib/auth/oturum";
import { BILISIM_YOLCULUGU_GRUPLARI } from "@/lib/kazanim/kurallar";
import {
  gorevRoluAtaEylemi,
  gorevRoluKaldirEylemi,
} from "@/app/panel/gorev-rolleri/eylemler";
import { danismanligiBirakEylemi } from "./[id]/eylemler";
import type { MentorlukDurumu } from "@/generated/prisma/enums";
import {
  DANISMAN_KALDIRMA_GEREKCESI_ASGARI,
  KALDIRMA_DUZEYI_ETIKETLERI,
  kaldirmaTalebiOnayMercii,
  MENTORLUK_DURUM_ETIKETLERI,
  MENTORLUK_DURUM_SINIFLARI,
} from "@/lib/mentor/kurallar";
import { ogrenciyiDanismanligaAlEylemi } from "./eylemler";
import { ATAMAYI_YALNIZCA_YONETICI_YAPAR } from "@/lib/danisman/politika";
import {
  mentorlukKaldirmaTalebiKararEylemi,
  ogrenciMentorluguKararEylemi,
} from "./mentorluk-eylemleri";
import {
  danismanTalebiniOnaylaEylemi,
  danismanTalebiniReddetEylemi,
} from "./talep-eylemleri";
import { bekleyenTalepleriGetir } from "@/lib/danisman/talep";
import { tarihSaatYaz, tarihYaz } from "@/lib/tarih";
import type { OturumKullanicisi } from "@/lib/yetki/tipler";
import { prisma } from "@/lib/db";
import { egitimOgretimYillariGetir } from "@/lib/rapor/secenekler";
import { gorevRolAdi } from "@/lib/yetki/etiketler";
import { ogrenciListeFiltresi as ogrenciListesiFiltresi } from "@/lib/yetki/kapsam";
import {
  danismanMi,
  mentorlukKaldirmaTalebiniOnaylayabilirMi,
  type MentorlukKaldirmaYetkisi,
  ogrenciMentorluguKaldirmaDuzeyi,
  ogrenciMentorluguneKararVerebilirMi,
  ilKoordinatoruMu,
  koordinatorIlKodu,
  ogrenciEnvanteriGorebilirMi,
  calismaGrubuYoneticisiAtayabilirMi,
  ogrenciTemsilciligiAtayabilirMi,
  type TemsilcilikRolu,
  projeYoneticisiMi,
} from "@/lib/yetki/izinler";
import { erisimLoglaCoklu } from "@/lib/yetki/log";
import {
  filtreVarMi,
  ogrenciFiltreleriniCoz,
  SINIF_SECENEKLERI,
  type SorguParametreleri,
  sayiVeyaNull,
  sorguMetni,
  tekil,
} from "./filtreler";

export const dynamic = "force-dynamic";

/** Sütun süzgeçlerinin bağlandığı form; bkz. components/SutunSuzgeci.tsx. */
const SUZGEC_FORMU = "ogrenci-suzgeci";

/**
 * Öğrenci envanteri.
 *
 * Liste, merkezi kapsam filtresinden geçer — filtre burada elle yazılmaz.
 * Öğrenci rolü bu ekrandan hiçbir şey görmez: bir öğrenci hiçbir koşulda başka
 * bir öğrencinin listesini veya kişisel verisini göremez.
 *
 * Ekrandaki filtreler yalnızca DARALTIR. Adres çubuğuna elle yazılan bir il
 * kodu kapsamı genişletmez, çünkü filtreler kapsam koşuluyla AND'lenir
 * (bkz. ogrenciListeFiltresi).
 */

const SINIF_ETIKET = "text-sm font-medium text-metin-yumusak";
const SINIF_SECIM =
  "mt-1 w-full rounded-md border border-cizgi bg-kart px-3 py-2 text-sm text-metin outline-none focus:border-vurgu";

const SAYFA_BOYUTU = 50;

const SINIF_SAYFA_BUTON =
  "inline-flex items-center gap-1 rounded-md border border-cizgi px-3 py-1.5 text-sm font-medium text-metin transition hover:bg-zemin";

/**
 * TEMSİLCİLİK SÜTUNLARI (26 Ağustos 2026 · istek: "bu listeye yeni sütunlar
 * ekleyelim: il temsilcisi yap/kaldır, ilçe temsilcisi yap/kaldır, okul
 * temsilcisi yap/kaldır butonları olsun; il koordinatörleri bunların atamasını
 * yapabilsin").
 *
 * ÖNCEDEN YALNIZCA OKUL TEMSİLCİSİ VARDI ve dosyada "İl ve ilçe temsilciliği
 * BURADA YOK — onları il koordinatörü kendi ekranından atıyor" diye yazılıydı.
 * O ayrım koordinatörü iki ekran arasında gezdiriyordu: öğrenciyi burada
 * buluyor, görevi Görev Rolleri ekranında yeniden arıyordu. Görev Rolleri
 * ekranı KALKMADI — ilin bütün görevlilerini tek listede görmek ayrı bir
 * sorudur; burada cevaplanan "şu öğrenciye görev vereyim mi".
 *
 * ---------------------------------------------------------------------------
 * GENİŞLİK: ÜÇ SÜTUN, KISA DÜĞME (aynı gün, iki turda bulundu)
 * ---------------------------------------------------------------------------
 * İlk hâlde üç sütun vardı ve düğmeler rolün tam adını yazıyordu ("Okul
 * Temsilcisi yap"); tablo ona sütuna çıkınca yatay kaydırma doğdu (istek: "bu
 * halde sığmadı, altta scroll çıktı"). İkinci turda üçü tek sütunda rozete
 * indirildi — kaydırma bitti ama okunurluk gitti (istek: "tekrar 3 sütun
 * yapalım çok sıkışık oldu").
 *
 * Kalan çözüm ikisinin ortası ve asıl israfı hedefliyor: DÜĞME ROL ADINI
 * TEKRARLAMIYOR. "Okul temsilcisi" sütununun altında "Okul Temsilcisi yap"
 * yazmak aynı iki kelimeyi her satırda ikinci kez basmaktı; başlık zaten hangi
 * görev olduğunu söylüyor, düğmeye düşen iş yalnızca eylemi söylemek.
 *
 * KAYDIRMA KALDIRILMADI: sarmalayıcıdaki `overflow-x-auto` duruyor, çünkü
 * yeterince dar bir ekranda dokuz sütunlu bir tablo yine kayar — kaldırılsaydı
 * kayma yerine sütunların ezilmesi olurdu.
 *
 * BİLEŞEN ROL BAŞINA ÜÇE BÖLÜNMEDİ: üçünün de yaptığı iş aynı (varsa kaldır,
 * yoksa ata) ve fark yalnızca etiketle kapsam sütununda.
 *
 * YETKİ İKİ KEZ SORULUYOR: burada (basılmayacak düğmeyi basmamak için) ve
 * eylemin içinde (form gövdesi kurcalanabilir). Buradaki kapı ile eylemdeki
 * kapı AYNI fonksiyondan geliyor — ayrı yazılsalardı biri gevşer, öteki
 * sıkışırdı (bkz. izinler.ts · ogrenciTemsilciligiAtayabilirMi).
 */
function TemsilcilikHucresi({
  rolKodu,
  ogrenci,
  kullanici,
  kendiOgrencisi,
  donusYolu,
}: {
  rolKodu: TemsilcilikRolu;
  ogrenci: {
    id: number;
    ilKodu: string | null;
    ilceKodu: string | null;
    kurumKodu: number | null;
    gorevRolleri: { id: number; rolKodu: string }[];
  };
  kullanici: OturumKullanicisi;
  /*
   * Danışman öğretmen okulundaki DANIŞMANSIZ öğrencileri de listeliyor
   * (10 Ağustos 2026); görev verme yetkisi ise yalnızca kendi öğrencilerinde.
   * Koordinatörde bu değerin bir hükmü yok — onun kapısı ilinden açılıyor.
   */
  kendiOgrencisi: boolean;
  donusYolu: string;
}) {
  const tamAd = TEMSILCILIK_ADLARI[rolKodu];
  const mevcut = ogrenci.gorevRolleri.find(
    (gorev) => gorev.rolKodu === rolKodu,
  );
  const yetkili = ogrenciTemsilciligiAtayabilirMi(
    kullanici,
    rolKodu,
    ogrenci,
    kendiOgrencisi,
  );

  /*
   * YETKİSİ OLMAYAN GÖREVİ GÖRÜR, DEĞİŞTİREMEZ: satırda görev varsa rozet
   * basılıyor. "—" yazılsaydı, görevli bir öğrenci başkasının ekranında
   * görevsiz görünürdü — oysa sütunun ilk işi durumu söylemek.
   */
  if (!yetkili) {
    return mevcut ? (
      <span
        title={`${tamAd} (değiştirme yetkiniz yok)`}
        className="rounded-full bg-rol-ogrenci-zemin px-2 py-0.5 text-xs text-rol-ogrenci-metin"
      >
        Görevli
      </span>
    ) : (
      <span className="text-metin-yumusak">—</span>
    );
  }

  if (mevcut) {
    return (
      <form action={gorevRoluKaldirEylemi}>
        <input type="hidden" name="gorevId" value={mevcut.id} />
        <input type="hidden" name="donusYolu" value={donusYolu} />
        <button
          type="submit"
          title={`${tamAd} görevini kaldır`}
          className="whitespace-nowrap rounded-md border border-cizgi px-2.5 py-1.5 text-sm font-medium text-metin-yumusak transition hover:bg-zemin hover:text-hata-metin"
        >
          Kaldır
        </button>
      </form>
    );
  }

  return (
    <form action={gorevRoluAtaEylemi}>
      <input type="hidden" name="ogrenciId" value={ogrenci.id} />
      <input type="hidden" name="rolKodu" value={rolKodu} />
      <input type="hidden" name="donusYolu" value={donusYolu} />
      <button
        type="submit"
        title={`${tamAd} yap`}
        className="whitespace-nowrap rounded-md border border-cizgi px-2.5 py-1.5 text-sm font-medium text-metin transition hover:bg-zemin"
      >
        Görev ver
      </button>
    </form>
  );
}

/**
 * ÇALIŞMA GRUBU TEMSİLCİSİ — "Çalışma grupları" sütununun altındaki atama
 * kutusu (26 Ağustos 2026 · istek: "Çalışma grupları bu sütuna 14 çalışma
 * grubundan temsilcisi yap/kaldır şeklinde açılan listeden seçsin").
 *
 * ---------------------------------------------------------------------------
 * NİYE AYRI BİR SÜTUN DEĞİL
 * ---------------------------------------------------------------------------
 * Görev bir GRUBA veriliyor ve o sütun zaten öğrencinin gruplarını yazıyor;
 * yan yana iki sütun aynı sözcüğü ("çalışma grubu") iki başlıkta tekrarlardı.
 * Üstelik tablo temsilcilik sütunlarıyla birlikte dokuza çıkmış durumda —
 * onuncu sütun aynı gün çözülen genişlik sorununu geri getirirdi.
 *
 * ---------------------------------------------------------------------------
 * AÇILIR LİSTE NİYE GEREKLİ (diğer üç görevde yok)
 * ---------------------------------------------------------------------------
 * İl, ilçe ve okul temsilciliğinin kapsamı ÖĞRENCİNİN KAYDINDAN türüyor —
 * öğrencinin ili bellidir, seçilecek bir şey yoktur. Çalışma grubunun kapsamı
 * ise kayıttan türemiyor: bir öğrenci birden çok gruba üye olabilir, hiçbirine
 * üye olmadan da bir grubun temsilcisi yapılabilir. Bu yüzden grup FORMDAN
 * geliyor ve eylem onu veritabanına karşı doğruluyor (bkz.
 * gorev-rolleri/eylemler.ts — kapatılmış bir gruba temsilci atanamaz).
 *
 * ÜYELİK ŞARTI KOŞULMADI: "önce gruba üye yap, sonra temsilci yap" iki adımlık
 * bir zorunluluk olurdu ve üyelik ayrı bir yetkiden geçiyor
 * (ogrenciCalismaGrubuYonetebilirMi). Temsilcilik bir görevdir, üyeliğin
 * derecesi değil.
 *
 * DÖNEM BAŞINA GRUP BAŞINA TEK KİŞİ: eylem bunu kontrol ediyor ve dolu grupta
 * "zaten X üzerinde" diyerek reddediyor. Liste burada doluları elemiyor —
 * elemek için her satırda 18 grubun durumunu sorgulamak gerekirdi ve cevap
 * zaten bir tık ötede.
 */
function CalismaGrubuTemsilciligi({
  ogrenci,
  kullanici,
  gruplar,
  donusYolu,
}: {
  ogrenci: {
    id: number;
    ilKodu: string | null;
    gorevRolleri: {
      id: number;
      rolKodu: string;
      calismaGrubu: { ad: string } | null;
    }[];
  };
  kullanici: OturumKullanicisi;
  gruplar: { id: number; ad: string }[];
  donusYolu: string;
}) {
  const yetkili = calismaGrubuYoneticisiAtayabilirMi(kullanici, ogrenci.ilKodu);
  const mevcut = ogrenci.gorevRolleri.find(
    (gorev) => gorev.rolKodu === "CALISMA_GRUBU_YONETICISI",
  );

  /*
   * YETKİSİ OLMAYAN GÖREVİ GÖRÜR, DEĞİŞTİREMEZ — üç temsilcilik sütunundaki
   * kararın aynısı. Görevsiz satırda hiçbir şey basılmıyor.
   */
  if (!yetkili) {
    return mevcut ? (
      <span className="mt-1.5 block text-xs font-medium text-vurgu-metin">
        {mevcut.calismaGrubu?.ad ?? "Çalışma grubu"} temsilcisi
      </span>
    ) : null;
  }

  if (mevcut) {
    return (
      <form action={gorevRoluKaldirEylemi} className="mt-1.5">
        <input type="hidden" name="gorevId" value={mevcut.id} />
        <input type="hidden" name="donusYolu" value={donusYolu} />
        <span className="block text-xs font-medium text-vurgu-metin">
          {mevcut.calismaGrubu?.ad ?? "Çalışma grubu"} temsilcisi
        </span>
        <button
          type="submit"
          title="Çalışma Grubu Temsilcisi görevini kaldır"
          className="mt-1 rounded-md border border-cizgi px-2 py-0.5 text-xs font-medium text-metin-yumusak transition hover:bg-zemin hover:text-hata-metin"
        >
          Temsilciliği kaldır
        </button>
      </form>
    );
  }

  /*
   * Boş seçenek `required` ile birlikte: grup seçmeden gönderilen form, sunucuya
   * gidip hata sayfasıyla dönmek yerine tarayıcıda duruyor. Eylem yine de
   * kontrol ediyor — tarayıcı doğrulaması bir koruma değil, bir kolaylık.
   */
  return (
    <form
      action={gorevRoluAtaEylemi}
      className="mt-1.5 flex flex-wrap items-center gap-1"
    >
      <input type="hidden" name="ogrenciId" value={ogrenci.id} />
      <input type="hidden" name="rolKodu" value="CALISMA_GRUBU_YONETICISI" />
      <input type="hidden" name="donusYolu" value={donusYolu} />
      <select
        name="calismaGrubuId"
        required
        defaultValue=""
        aria-label="Temsilcilik verilecek çalışma grubu"
        className="max-w-[10rem] rounded-md border border-cizgi bg-kart px-1.5 py-0.5 text-xs text-metin outline-none focus:border-vurgu"
      >
        <option value="">Grup seçin…</option>
        {gruplar.map((grup) => (
          <option key={grup.id} value={grup.id}>
            {grup.ad}
          </option>
        ))}
      </select>
      <button
        type="submit"
        title="Seçilen çalışma grubunun temsilcisi yap"
        className="rounded-md border border-cizgi px-2 py-0.5 text-xs font-medium text-metin transition hover:bg-zemin"
      >
        Temsilcisi yap
      </button>
    </form>
  );
}

/**
 * Sütun başlıkları ve `title` metinleri TEK YERDE, sıra da burada.
 *
 * Sıra kapsamın genişliğine göre daralıyor (il → ilçe → okul); tablo soldan
 * sağa okunurken görevin kapsamı da daralıyor.
 *
 * BAŞLIK KÜÇÜK HARFLE ("İl temsilcisi"), `title` BÜYÜK HARFLE ("İl
 * Temsilcisi"): ilki tablonun diğer sütun başlıklarıyla ("Çalışma grupları")
 * aynı dili konuşuyor, ikincisi görevin resmî adı.
 */
const TEMSILCILIK_ADLARI: Record<TemsilcilikRolu, string> = {
  IL_TEMSILCISI: "İl Temsilcisi",
  ILCE_TEMSILCISI: "İlçe Temsilcisi",
  OKUL_TEMSILCISI: "Okul Temsilcisi",
};

const TEMSILCILIK_BASLIKLARI: Record<TemsilcilikRolu, string> = {
  IL_TEMSILCISI: "İl temsilcisi",
  ILCE_TEMSILCISI: "İlçe temsilcisi",
  OKUL_TEMSILCISI: "Okul temsilcisi",
};

const TEMSILCILIK_SIRASI: TemsilcilikRolu[] = [
  "IL_TEMSILCISI",
  "ILCE_TEMSILCISI",
  "OKUL_TEMSILCISI",
];

/**
 * Satır başına "Danışmanlığı bırak" hücresi.
 *
 * LİSTENİN İÇİNDE (26 Ağustos 2026 · istek: "Danışmanlığımdaki öğrenciler …
 * komple kalksın … bu listeye ekleyelim butonları, yani danışmanlığı bırak
 * butonları").
 *
 * Aynı öğrenciler ekranda iki kez duruyordu: üstte "Danışmanlığımdaki
 * öğrenciler" kartı, altta envanter tablosu. Kart kalktı, düğme satırına
 * indi — öğretmen zaten baktığı listeden bırakabiliyor.
 *
 * GEREKÇE KATLI DURUYOR: kutu her satırda açık olsaydı tablo okunamazdı ve
 * düğmeye doğrudan basılamaması yanlışlıkla bırakmayı da zorlaştırıyor.
 * Gerekçe zorunlu (bkz. birakmaGerekcesiniCoz) çünkü il koordinatörüne
 * bildirim olarak gidiyor.
 */
function DanismanlikHucresi({
  ogrenciId,
  kendiOgrencisi,
}: {
  ogrenciId: number;
  kendiOgrencisi: boolean;
}) {
  if (!kendiOgrencisi) {
    return <span className="text-metin-yumusak">—</span>;
  }

  return (
    <details>
      <summary className="cursor-pointer text-sm font-medium text-vurgu-metin">
        Danışmanlığı bırak
      </summary>
      {/*
        Uyarı GEREKÇENİN YANINDA: bırakmanın sonucu, kararın verildiği
        yerde okunmalı. Listenin tepesinde tek satır olarak durduğunda
        düğmeye basan kişi onu çoktan geçmiş oluyordu.
      */}
      <p className="mt-2 text-sm text-metin-yumusak">
        Öğrenci danışmansız kalır ve okulundaki bir öğretmeni kendisi
        seçebilir; gerekçe il koordinatörünüze iletilir.
      </p>
      <form
        action={danismanligiBirakEylemi}
        className="mt-2 flex flex-wrap items-end gap-2"
      >
        <input type="hidden" name="ogrenciId" value={ogrenciId} />
        <label className="block grow">
          <span className="text-sm font-medium text-metin">Gerekçe</span>
          <input
            type="text"
            name="gerekce"
            required
            minLength={10}
            maxLength={500}
            placeholder="Öğrencinin ilgi alanı başka bir öğretmenin branşına daha yakın."
            className={SINIF_SECIM}
          />
        </label>
        <button type="submit" className={SINIF_IKINCIL_BUTON}>
          Bırak
        </button>
      </form>
    </details>
  );
}
/**
 * MENTÖRLÜK HÜCRESİ (26 Ağustos 2026 · istek: "danışman öğretmen kendi
 * öğrencilerinden mentör ise o da görünsün … eğer öğrenci başvurduysa buradan
 * onaylasın, mentör yap / mentörlüğü kaldır butonu olsun").
 *
 * DURUM HERKESE, DÜĞME KARAR SAHİBİNE. Rozet bir bilgidir; merkez de ilindeki
 * mentörleri listeden görebilmeli. Karar öğrenciyi tanıyana ait: danışmanı ve
 * 27 Ağustos 2026'dan beri ilinin koordinatörü (istek: "il koordinatörü de
 * öğrencinin mentörlük başvurusunu onaylayabilsin"). Kimin karar verdiğini bu
 * bileşen değil izinler.ts · ogrenciMentorluguneKararVerebilirMi söylüyor;
 * `kararVerebilir` false ise hücre yalnızca durumu yazıyor.
 *
 * ROZET RENKLERİ ORTAK SÖZLÜKTEN (MENTORLUK_DURUM_SINIFLARI): aynı durum,
 * panodaki "Mentörlüğüm" kartında ve merkezin onay kuyruğunda da aynı renkte
 * duruyor. Burada ayrı bir renk seçilseydi "onay bekliyor" iki ekranda iki
 * farklı şey gibi okunurdu.
 *
 * BAŞVURUSU OLMAYAN ÖĞRENCİDE DÜĞME YOK, "Başvurmadı" yazıyor. Mentörlük
 * çalışma grubu ve konu seçimiyle kurulan bir kayıttır (bkz.
 * mentorlukKabulEdilirMi); danışmanın boş bir kayıt açması, havuzda uzmanlık
 * satırı boş bir mentör kartı demek olurdu. Gerekçesi kural katmanında
 * (ogrenciMentorlukKarariGecerliMi) ve eylem oradan da reddediyor — hücre
 * yalnızca teklif etmiyor.
 *
 * KALDIRMA GEREKÇE İSTER ve `details` içinde açılıyor — aynı tablodaki
 * "Danışmanlığı bırak" hücresiyle bilerek aynı biçim: satır içinde duran bir
 * metin kutusu, tablo genişliğini altı öğrencide bir kaydırırdı.
 */
/**
 * Hücrenin okuduğu kaldırma talebi — YALNIZCA BEKLEYENİ taşır.
 *
 * Karara bağlanmış talep ekranda hiç görünmüyor: kabul edildiyse mentörlük
 * zaten kalkmış (rozet onu yazıyor), reddedildiyse mentörlük hiç kesintiye
 * uğramamış. Geçmiş talepleri satırda taşımak, listeyi artık sonucu olmayan
 * bir kayıt geçmişiyle doldururdu — kimin ne zaman ne istediği erişim
 * kaydında duruyor.
 */
interface BekleyenKaldirmaTalebi {
  gerekce: string;
  istekTarihi: Date;
  isteyenKullaniciId: number;
  isteyenDuzeyi: "DANISMAN" | "IL_KOORDINATOR";
  isteyen: { ad: string; soyad: string };
}

function MentorlukHucresi({
  ogrenciId,
  durum,
  kararVerebilir,
  kaldirmaDuzeyi,
  talep,
  talebiKararaBaglayabilir,
  donusYolu,
}: {
  ogrenciId: number;
  durum: MentorlukDurumu | null;
  kararVerebilir: boolean;
  /** Kaldırma bu kişide hangi düzeyden yapılır; yetkisi yoksa null. */
  kaldirmaDuzeyi: MentorlukKaldirmaYetkisi | null;
  /** Karara bağlanmamış kaldırma talebi; yoksa null. */
  talep: BekleyenKaldirmaTalebi | null;
  talebiKararaBaglayabilir: boolean;
  donusYolu: string;
}) {
  const rozet =
    durum === null ? null : (
      <span
        className={`inline-block rounded-full px-2 py-0.5 text-xs ${MENTORLUK_DURUM_SINIFLARI[durum]}`}
      >
        {MENTORLUK_DURUM_ETIKETLERI[durum]}
      </span>
    );

  /*
    BEKLEYEN TALEP HER ŞEYİN ÖNÜNE GEÇER ve durumu HERKESE yazılır — karar
    mercii olmayan danışman da öğrencisinin mentörlüğünün askıda olduğunu
    görmeli. Rozet hâlâ "Onaylandı" diyor çünkü öğrenci gerçekten mentör; alt
    satır bunun neden yanıltıcı okunmaması gerektiğini söylüyor.
  */
  if (talep) {
    return (
      <div className="space-y-2">
        {rozet}
        <p className="text-xs text-uyari-metin">
          Kaldırma talebi onay bekliyor ·{" "}
          {kaldirmaTalebiOnayMercii(talep.isteyenDuzeyi)}
        </p>
        <p className="text-xs text-metin-yumusak">
          {talep.isteyen.ad} {talep.isteyen.soyad} (
          {KALDIRMA_DUZEYI_ETIKETLERI[talep.isteyenDuzeyi]}) ·{" "}
          {tarihYaz(talep.istekTarihi)}
          <br />
          Gerekçe: {talep.gerekce}
        </p>
        {!talebiKararaBaglayabilir ? null : (
          <div className="space-y-2">
            {/*
              ONAYDA GEREKÇE SORULMAZ: öğrenciye giden metin talebin kendi
              gerekçesidir (bkz. mentorlukKaldirmaTalebiKararEylemi). İkinci
              bir gerekçe kutusu, onaylayanın cümlesinin talebi açanınkinin
              yerine geçmesi demekti.
            */}
            <form action={mentorlukKaldirmaTalebiKararEylemi}>
              <input type="hidden" name="ogrenciId" value={ogrenciId} />
              <input type="hidden" name="donusYolu" value={donusYolu} />
              <input type="hidden" name="karar" value="ONAYLA" />
              <button type="submit" className={SINIF_IKINCIL_BUTON}>
                Talebi onayla, mentörlüğü kaldır
              </button>
            </form>
            <details>
              <summary className="cursor-pointer text-sm font-medium text-vurgu-metin">
                Talebi reddet
              </summary>
              <p className="mt-2 text-sm text-metin-yumusak">
                Öğrenci mentör olarak kalır; gerekçeniz talebi açan kişiye
                bildirim olarak iletilir.
              </p>
              <form
                action={mentorlukKaldirmaTalebiKararEylemi}
                className="mt-2 flex flex-wrap items-end gap-2"
              >
                <input type="hidden" name="ogrenciId" value={ogrenciId} />
                <input type="hidden" name="donusYolu" value={donusYolu} />
                <input type="hidden" name="karar" value="REDDET" />
                <label className="block grow">
                  <span className="text-sm font-medium text-metin">
                    Ret gerekçesi
                  </span>
                  <input
                    type="text"
                    name="retGerekcesi"
                    required
                    maxLength={500}
                    placeholder="Öğrenciyle görüştüm; mentörlüğe devam edecek."
                    className={SINIF_SECIM}
                  />
                </label>
                <button type="submit" className={SINIF_IKINCIL_BUTON}>
                  Reddet
                </button>
              </form>
            </details>
          </div>
        )}
      </div>
    );
  }

  if (!kararVerebilir) {
    return rozet ?? <span className="text-metin-yumusak">—</span>;
  }

  if (durum === null) {
    return <span className="text-metin-yumusak">Başvurmadı</span>;
  }

  /*
    AYNI DÜĞME, İKİ FARKLI SONUÇ (28 Ağustos 2026 · istek: "hiyerarşi olsun …
    proje yöneticisine onay yok"). Merkezinki anında uygulanıyor,
    danışmanınki ve koordinatörünki onaya gidiyor. Metin bunu ÖNCEDEN söyler:
    onaya gideceğini basmadan öğrenmeyen öğretmen, kaldırdığını sanıp
    öğrenciyi havuzda görmeye devam ederdi.
  */
  const talepDuzeyi =
    kaldirmaDuzeyi === null || kaldirmaDuzeyi === "MERKEZ"
      ? null
      : kaldirmaDuzeyi;
  const kaldirmaAciklamasi =
    talepDuzeyi === null
      ? "Öğrenci mentör havuzundan çıkar ve ilanlara cevap yazamaz; gerekçeniz ona bildirim olarak iletilir."
      : `Talebiniz ${kaldirmaTalebiOnayMercii(talepDuzeyi)} onayına gider. Öğrenci karar verilene kadar mentör kalır; gerekçeniz onay mercine, onaylanırsa öğrenciye iletilir.`;

  return (
    <div className="space-y-2">
      {rozet}
      {durum === "ONAYLANDI" ? (
        <details>
          <summary className="cursor-pointer text-sm font-medium text-vurgu-metin">
            {talepDuzeyi
              ? "Mentörlüğü kaldırmayı iste"
              : "Mentörlüğü kaldır"}
          </summary>
          {/*
            Uyarı gerekçenin yanında: kaldırmanın sonucu, kararın verildiği
            yerde okunmalı (emsali DanismanlikHucresi).
          */}
          <p className="mt-2 text-sm text-metin-yumusak">
            {kaldirmaAciklamasi}
          </p>
          <form
            action={ogrenciMentorluguKararEylemi}
            className="mt-2 flex flex-wrap items-end gap-2"
          >
            <input type="hidden" name="ogrenciId" value={ogrenciId} />
            <input type="hidden" name="donusYolu" value={donusYolu} />
            <input type="hidden" name="karar" value="KALDIR" />
            <label className="block grow">
              <span className="text-sm font-medium text-metin">Gerekçe</span>
              <input
                type="text"
                name="gerekce"
                required
                minLength={DANISMAN_KALDIRMA_GEREKCESI_ASGARI}
                maxLength={500}
                placeholder="Öğrenci yoğun sınav döneminde; mentörlüğe ara veriyoruz."
                className={SINIF_SECIM}
              />
            </label>
            <button type="submit" className={SINIF_IKINCIL_BUTON}>
              {talepDuzeyi ? "Onaya gönder" : "Kaldır"}
            </button>
          </form>
        </details>
      ) : (
        <form action={ogrenciMentorluguKararEylemi}>
          <input type="hidden" name="ogrenciId" value={ogrenciId} />
          <input type="hidden" name="donusYolu" value={donusYolu} />
          <input type="hidden" name="karar" value="ONAYLA" />
          <button type="submit" className={SINIF_IKINCIL_BUTON}>
            Mentör yap
          </button>
        </form>
      )}
    </div>
  );
}

/** Sayfa bağlantısı üretirken mevcut filtreler korunur. */
function sayfaBaglantisi(
  parametreler: SorguParametreleri,
  sayfa: number,
): string {
  const sorgu = new URLSearchParams(sorguMetni(parametreler, ["sayfa"]));
  if (sayfa > 1) sorgu.set("sayfa", String(sayfa));
  const metin = sorgu.toString();
  return metin ? `/panel/ogrenciler?${metin}` : "/panel/ogrenciler";
}

export default async function OgrencilerSayfasi({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const kullanici = await oturumKullanicisiZorunlu();

  /*
   * KAPI ÖĞRENCİDEN GENİŞ (11 Ağustos 2026). Önceden yalnızca öğrenci
   * eleniyordu; mezun, paydaş temsilcisi, mentör ve görev almamış öğretmen
   * ekranı açıp "0 kayıt" görüyordu. Veri sızmıyordu (kapsam filtresi
   * varsayılan olarak hiçbir şey döndürmüyor) ama boş liste "sistemde öğrenci
   * yok" diye okunur ve erişimi tek bir filtre dalı tutuyordu
   * (bkz. ogrenciEnvanteriGorebilirMi).
   */
  if (!ogrenciEnvanteriGorebilirMi(kullanici)) {
    return (
      <Kart>
        <KartBasligi
          baslik="Öğrenciler"
          aciklama="Bu ekrana erişim yetkiniz yok."
        />
      </Kart>
    );
  }

  const parametreler = await searchParams;
  const filtreler = ogrenciFiltreleriniCoz(parametreler);
  const filtreVar = filtreVarMi(filtreler);

  /*
   * SINIF SÜZGECİNİN SEÇENEKLERİ (31 Ağustos 2026, sütun süzgeçleriyle
   * birlikte karttan tabloya taşındı).
   *
   * ADRESTEN GELEN TANINMAYAN DEĞER DE LİSTEYE GİRİYOR: eski bir yer imi ya
   * da elle yazılmış bir sorgu "10/B" gönderebilir. Seçenek eklenmezse süzgeç
   * uygulanmış olduğu hâlde kutu "Tüm sınıflar" görünür ve kullanıcı eksik
   * listeye bakıp nedenini anlayamazdı. Karar 10 Ağustos'ta verilmişti,
   * taşınırken korundu.
   */
  const sinifSuzgecSecenekleri = [
    ...SINIF_SECENEKLERI.map((secenek) => ({
      deger: secenek.deger,
      etiket: secenek.etiket,
    })),
    ...(filtreler.sinif &&
    !SINIF_SECENEKLERI.some((secenek) => secenek.deger === filtreler.sinif)
      ? [{ deger: filtreler.sinif, etiket: filtreler.sinif }]
      : []),
  ];

  /*
   * Okul Temsilcisi sütunu, atama yetkisi OLABİLECEK kişilere basılır: danışman
   * öğretmen (kendi okulu) ve proje yöneticisi. İl koordinatörü bu sütunu
   * görmez — o, il ve ilçe temsilcisini Görev Rolleri ekranından atıyor ve
   * ilindeki her okulun temsilcisini belirlemek onun işi değil.
   *
   * Satır bazında yetki ayrıca sorulur (bkz. OkulTemsilcisiHucresi).
   */
  /*
   * HANGİ TEMSİLCİLİK SÜTUNU BASILIR (26 Ağustos 2026).
   *
   * Sütun, kişinin O GÖREVİ HİÇ verebileceği durumda basılıyor; satır bazında
   * yetki ayrıca soruluyor (bkz. TemsilcilikHucresi). Ayrım gerekli çünkü
   * danışman öğretmen İl/İlçe Temsilcisi atayamaz — o iki sütun onun ekranında
   * baştan sona "—" dolu iki şerit olur, üstelik tablonun genişliğini de
   * karşılıksız artırırdı. Öğretmen tek sütun görüyor, koordinatör ve merkez
   * üçünü.
   */
  const temsilcilikRolleri = TEMSILCILIK_SIRASI.filter((rolKodu) =>
    rolKodu === "OKUL_TEMSILCISI"
      ? danismanMi(kullanici) ||
        ilKoordinatoruMu(kullanici) ||
        projeYoneticisiMi(kullanici)
      : ilKoordinatoruMu(kullanici) || projeYoneticisiMi(kullanici),
  );

  /*
   * Danışmanlık sütunu YALNIZCA DANIŞMANA basılır: bırakma, danışmanın
   * kendi görevini sonlandırması. Koordinatör ve merkez de bir öğrencinin
   * danışmanlığını sonlandırabiliyor ama onların yolu öğrencinin kendi
   * kaydı — ilin tamamını gören listeye satır satır bırakma düğmesi koymak,
   * yanlışlıkla basılması en kolay yeri seçmek olurdu.
   */
  const danismanlikYonetebilir = danismanMi(kullanici);

  /*
   * Atama sonrası bu ekrana, FİLTRELER KORUNARAK dönülür: 400 kişilik bir
   * listede filtreleyip atama yapan öğretmen, işlem sonrası baştan filtrelemek
   * zorunda kalmamalı. Durum/hata parametreleri eylemde ekleniyor.
   */
  const mevcutSorgu = sorguMetni(parametreler, ["durum", "hata"]);

  /*
   * DANIŞMAN DEĞİŞİKLİĞİ ONAY KUYRUĞU (20 Ağustos 2026 · istek: "danışman
   * öğretmen seçiminde öğretmene veya il koordinatörüne onay düşsün").
   *
   * KUYRUK BU EKRANIN BAŞINDA çünkü kararın sonucu bu listedir: onaylayan
   * öğretmen öğrenciyi hemen altında görür, reddeden görmez. Ayrı bir onay
   * ekranı açmak, günde bir talep gelen öğretmeni hiç uğramayacağı bir
   * sayfaya yollardı.
   *
   * Kimin neyi göreceğini kural katmanı belirliyor: öğretmen kendisinden
   * istenenleri, koordinatör ilindeki bütün bekleyenleri
   * (bkz. lib/danisman/talep.ts · bekleyenTalepleriGetir).
   */
  const bekleyenTalepler = await bekleyenTalepleriGetir(
    kullanici.id,
    ilKoordinatoruMu(kullanici) ? koordinatorIlKodu(kullanici) : null,
  );
  const donusYolu = mevcutSorgu
    ? `/panel/ogrenciler?${mevcutSorgu}`
    : "/panel/ogrenciler";

  const gorevDurumu = tekil(parametreler.durum);
  const gorevHatasi = tekil(parametreler.hata);

  /*
   * DANIŞMAN ÖĞRETMENLİĞİ İŞARETİ (7 Ağustos 2026). Yalnızca okulunda görev
   * alabilecek öğretmene sorulur: il koordinatörünün ve YEĞİTEK personelinin
   * okulu yoktur ve koordinatör aynı anda danışman olamaz.
   */
  const danismanlikIsaretiGosterilir =
    !ilKoordinatoruMu(kullanici) &&
    !projeYoneticisiMi(kullanici) &&
    kullanici.kurumKodu !== null;

  /*
   * Okulundaki DANIŞMANSIZ öğrenciler. Yalnızca görev almış danışmana
   * sorulur — işaretlememiş öğretmen zaten kimseyi alamaz (eylem de
   * reddediyor) ve ona boş bir liste göstermenin karşılığı yok.
   */
  const danismansizlar =
    // Öğretmen öğrenci alamaz: atamayı proje yöneticisi yapar (23 Ekim 2026).
    !ATAMAYI_YALNIZCA_YONETICI_YAPAR &&
    danismanMi(kullanici) &&
    kullanici.kurumKodu !== null
      ? await prisma.kullanici.findMany({
          where: {
            kurumKodu: kullanici.kurumKodu,
            roller: { some: { rolKodu: "OGRENCI", bitisTarihi: null } },
            ogrenciAtamalari: { none: { bitisTarihi: null } },
          },
          orderBy: [{ sinif: "asc" }, { ad: "asc" }],
          take: 50,
          select: { id: true, ad: true, soyad: true, sinif: true },
        })
      : [];


  // Filtre seçenekleri de kapsamla sınırlıdır: proje yöneticisi tüm illeri,
  // il koordinatörü yalnızca kendi ilinin okullarını, danışman öğretmen ise
  // hiç yer seçeneği görmez (tek okulu vardır).
  const koordinatorIli = koordinatorIlKodu(kullanici);
  const seciliIl = filtreler.ilKodu ?? koordinatorIli;

  const [iller, ilceler, okullar, gruplar, yilSecenekleri] =
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
      prisma.calismaGrubu.findMany({
        where: { aktif: true },
        orderBy: { siraNo: "asc" },
        select: { id: true, ad: true },
      }),
      egitimOgretimYillariGetir(),
    ]);

  /*
   * Yıllara göre karşılaştırma (analiz dokümanı 1.2).
   *
   * Sayım, seçili yıl filtresi DIŞINDAKİ filtrelerle yapılır: "İstanbul'daki
   * oyun tasarımı öğrencileri yıllara göre nasıl değişti" sorusu ancak yıl
   * kısıtı kaldırıldığında cevaplanır. Aksi halde tablo tek satıra düşer ve
   * karşılaştırma diye bir şey kalmazdı.
   */
  const karsilastirmaFiltresi = ogrenciListesiFiltresi(kullanici, {
    ...filtreler,
    egitimOgretimYili: null,
  });
  const yilDagilimi = await prisma.kullanici.groupBy({
    by: ["egitimOgretimYili"],
    where: karsilastirmaFiltresi,
    _count: { _all: true },
    orderBy: { egitimOgretimYili: "desc" },
  });

  /*
   * Sayfalama. Liste tek sayfada dökülmez: envanter büyüdüğünde hem ekran
   * kullanılamaz hale gelir hem de HER görüntülenen öğrenci için erişim logu
   * yazıldığından log tablosu gereksiz şişer. Loglanan, gerçekten gösterilen
   * sayfadır.
   */
  const nerede = ogrenciListesiFiltresi(kullanici, filtreler);
  const toplam = await prisma.kullanici.count({ where: nerede });
  const sonSayfa = Math.max(1, Math.ceil(toplam / SAYFA_BOYUTU));
  const istenenSayfa = sayiVeyaNull(tekil(parametreler.sayfa)) ?? 1;
  const sayfa = Math.min(Math.max(1, istenenSayfa), sonSayfa);

  const ogrenciler = await prisma.kullanici.findMany({
    where: nerede,
    skip: (sayfa - 1) * SAYFA_BOYUTU,
    take: SAYFA_BOYUTU,
    select: {
      id: true,
      ad: true,
      soyad: true,
      sinif: true,
      kurum: { select: { ad: true } },
      beyanOkulAdi: true,
      il: { select: { ad: true } },
      ilce: { select: { ad: true } },
      calismaGruplari: {
        select: { calismaGrubu: { select: { ad: true } } },
      },
      /*
       * Temsilcilikler listede de görünür: koordinatör "ilimde kim temsilci"
       * sorusunun cevabını tek tek profillere girmeden alabilmeli. Yalnızca
       * içinde bulunulan dönem — geçmiş görevler profilin katkı kartında.
       */
      // Okul Temsilcisi ataması bu ekrana taşındı (J2); kaldırma formu görev
      // kaydının kimliğini istiyor, bu yüzden `id` de seçiliyor.
      kurumKodu: true,
      /*
       * İL VE İLÇE KODU (26 Ağustos 2026): temsilcilik sütunlarının yetki
       * sorusu bunlara bakıyor (bkz. ogrenciTemsilciligiAtayabilirMi) ve görev
       * kaydı da bu kapsam sütunlarıyla açılıyor. Yukarıdaki `il`/`ilce`
       * seçimleri yalnızca ADI getiriyor — ad bir kimlik değil.
       */
      ilKodu: true,
      ilceKodu: true,
      /*
       * DÖNEM KARŞILAŞTIRMASI ÖĞRENCİNİN KENDİ YILIYLA (10 Ağustos 2026 ·
       * istek: "Temsilcilik kısmında öğrenci il ilçe temsilcisi ise o da
       * görünsün").
       *
       * Süzgeç BAKAN KİŞİNİN yılına bakıyordu: öğretmenin kaydındaki
       * eğitim-öğretim yılı öğrencininkinden farklı olduğunda — dönem
       * geçişinde senkron sırası ya da yeni açılmış öğretmen kaydı yeter —
       * sütun herkeste "—" görünüyordu ve bu bir veri eksikliği gibi değil,
       * "kimse temsilci değil" gibi okunuyordu. Kıyas artık öğrencinin kendi
       * dönemiyle yapılıyor; öğrenci profili de aynı kuralı kullanıyor
       * (ogrenciler/[id]/page.tsx).
       *
       * Süzgeç sorgudan JS'e taşındı çünkü Prisma iç içe `where` içinde ana
       * satırın alanına başvuramıyor; görev kayıtları öğrenci başına birkaç
       * satır olduğu için bunun bir bedeli yok.
       */
      egitimOgretimYili: true,
      gorevRolleri: {
        select: {
          id: true,
          rolKodu: true,
          egitimOgretimYili: true,
          il: { select: { ad: true } },
          ilce: { select: { ad: true } },
          kurum: { select: { ad: true } },
          /*
            ÇALIŞMA GRUBU TEMSİLCİLİĞİNİN KAPSAMI BİR YER DEĞİL, BİR GRUP
            (26 Ağustos 2026): "Çalışma grupları" sütunu hangi grubun temsilcisi
            olduğunu yazıyor ve `gorevRolAdi` de bu adı okuyor.
          */
          calismaGrubuId: true,
          calismaGrubu: { select: { ad: true } },
        },
      },
      /*
        MENTÖRLÜK DURUMU LİSTEDE (26 Ağustos 2026 · istek: "danışman öğretmen
        kendi öğrencilerinden mentör ise o da görünsün"). Kayıt birebir
        (Mentorluk.kullaniciId birincil anahtar), yani satır başına tek sorgu
        değil tek `join` — listede N+1 doğurmuyor.
      */
      mentorluk: {
        select: {
          durum: true,
          /*
            BEKLEYEN KALDIRMA TALEBİ (28 Ağustos 2026 · istek: "hiyerarşi
            olsun"). Talep açıkken hücre ne "Mentörlüğü kaldır" ne de "Mentör
            yap" düğmesi basıyor; onun yerine kararı bekleyen kişiye onay/ret
            formu çıkıyor. Aynı `join` üzerinden geldiği için listeye ek sorgu
            yükü getirmiyor.
          */
          kaldirmaTalebi: {
            select: {
              durum: true,
              gerekce: true,
              istekTarihi: true,
              isteyenKullaniciId: true,
              isteyenDuzeyi: true,
              isteyen: { select: { ad: true, soyad: true } },
            },
          },
        },
      },
      ogrenciAtamalari: {
        where: { bitisTarihi: null },
        select: {
          // Kimlik de seçiliyor: "bu benim öğrencim mi" sorusu ad-soyaddan
          // değil kimlikten sorulur (bkz. OkulTemsilcisiHucresi).
          danismanKullaniciId: true,
          danisman: { select: { ad: true, soyad: true } },
        },
      },
    },
    orderBy: [{ ad: "asc" }, { soyad: "asc" }],
  });

  // Her veri görüntüleme işlemi loglanır.
  /*
   * ==========================================================================
   * TOPLULUKLAR / EKİPLER LİSTESİ (31 Ağustos 2026 · istek: "burada alta bir
   * liste daha ekle, öğrencilerinin girdiği topluluk ekip vs olsun")
   * ==========================================================================
   *
   * KAPSAM ÜSTTEKİ LİSTEYLE AYNI (`nerede`): kayıtlar `kullanici` ilişkisi
   * üzerinden o filtreye bağlanıyor. Ayrı bir kapsam koşulu yazılsaydı iki
   * liste ayrışır ve alttaki, üstte hiç görünmeyen bir öğrencinin kaydını
   * gösterebilirdi — kapsam filtresi bu ekranda tek bir yerden okunmalı.
   *
   * SÜZGEÇLER DE GEÇERLİ: `nerede` filtrelerin çözülmüş hâlini taşıyor, yani
   * "9. sınıflar" süzülünce alttaki liste de 9. sınıfların toplulukları
   * oluyor. İki liste aynı soruyu iki açıdan cevaplıyor; süzgeç yalnızca
   * birine işleseydi hangisinin geçerli olduğu belirsiz kalırdı.
   *
   * SAYFALAMA YOK, TAVAN VAR: liste bir envanter değil, üstteki listenin yan
   * okuması. İkinci bir sayfalama denetimi aynı ekranda iki "sonraki sayfa"
   * düğmesi demekti ve hangisinin neyi çevirdiği karışırdı. Tavana dayanan
   * kullanıcı süzgeçle daraltıyor — kart bunu yazıyor.
   *
   * KAYIT BEYANDIR, doğrulanmış bir üyelik değil (bkz. şema · KazanimTipi ·
   * TOPLULUK). Kart başlığı bunu söylüyor ki liste bir "resmî ekip envanteri"
   * sanılmasın; gerçek ekip kayıtları Ekipler ekranında.
   */
  const TOPLULUK_TAVANI = 100;

  const topluluklar = await prisma.kullaniciKazanim.findMany({
    where: { tip: "TOPLULUK", kullanici: nerede },
    orderBy: [{ tarih: "desc" }, { olusturmaTarihi: "desc" }],
    take: TOPLULUK_TAVANI,
    select: {
      id: true,
      baslik: true,
      aciklama: true,
      tarih: true,
      duzenleyen: true,
      kullanici: {
        select: {
          id: true,
          ad: true,
          soyad: true,
          sinif: true,
          kurum: { select: { ad: true } },
        },
      },
    },
  });

  const toplulukToplami = await prisma.kullaniciKazanim.count({
    where: { tip: "TOPLULUK", kullanici: nerede },
  });

  /*
   * ERİŞİM KAYDI İKİ LİSTEYİ DE KAPSIYOR ve kimlikler TEKİLLEŞTİRİLİYOR:
   * alttaki listede görünen öğrenci üstteki sayfada da olabilir ve aynı
   * görüntüleme iki kez yazılsaydı denetim kaydı, olmayan bir erişimi
   * sayardı. Alt listede görünen ama üstteki SAYFADA olmayan öğrenci ise
   * gerçekten görüntülenmiştir — adı ve okulu ekranda basılıyor.
   */
  const goruntulenenler = new Map<number, string>();
  for (const ogrenci of ogrenciler) {
    goruntulenenler.set(ogrenci.id, "Öğrenci listesi görüntülendi");
  }
  for (const kayit of topluluklar) {
    if (!goruntulenenler.has(kayit.kullanici.id)) {
      goruntulenenler.set(
        kayit.kullanici.id,
        "Öğrenci listesi · topluluk ve ekip kayıtları görüntülendi",
      );
    }
  }

  await erisimLoglaCoklu(
    [...goruntulenenler].map(([hedefId, detay]) => ({
      kullaniciId: kullanici.id,
      islem: "GORUNTULEME" as const,
      hedefTip: "OGRENCI" as const,
      hedefId,
      detay,
    })),
  );

  const kapsamAciklamasi = projeYoneticisiMi(kullanici)
    ? "Tüm iller"
    : ilKoordinatoruMu(kullanici)
      ? "Kendi iliniz"
      : danismanMi(kullanici)
        ? "Danışmanlığınızdaki öğrenciler"
        : "Kapsamınız dışında";

  const yerFiltresiVar = iller.length > 0 || okullar.length > 0;

  /*
   * YOL İZİ — kırılımdan gelindiğinde basılır (12 Ağustos 2026 · istek:
   * "ilçeden öğrencilere geçince navigasyon kayboluyor, tarayıcının geri
   * düğmesine basmak gerekiyor"). Düz listede `null` döner ve şerit hiç
   * çıkmaz; ne zaman çıktığı için bkz. app/panel/envanter-yolu.ts.
   */
  const yolIziAdimlari = await envanterYolIzi(
    kullanici,
    "Öğrenciler",
    filtreler,
  );

  const disaAktarmaSorgusu = sorguMetni(parametreler, ["sayfa"]);
  const disaAktarmaBaglantisi = disaAktarmaSorgusu
    ? `/panel/ogrenciler/disa-aktar?${disaAktarmaSorgusu}`
    : "/panel/ogrenciler/disa-aktar";

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
        /*
          BAŞLIK KAPSAMI SÖYLER (26 Ağustos 2026 · istek: "üstteki öğrenciler
          yazısı öğrencilerim olsun").

          Danışman öğretmene bu ekran YALNIZCA kendi danışmanlığındaki
          öğrencileri gösteriyor (bkz. kapsam.ts · ogrenciListeFiltresi) ve
          buraya Panel'deki "Öğrencilerim" kartından geliyor; başlık "Öğrenciler"
          derken listeyi olduğundan geniş gösteriyordu.

          KOORDİNATÖR VE MERKEZ "ÖĞRENCİLER" KALIR: onların listesi bir ilin ya
          da ülkenin tamamı, hiçbiri kendi öğrencisi değil — "Öğrencilerim"
          orada yanlış olurdu. Ayrım, kapsam filtresini belirleyen koşulun
          aynısı.
        */
        baslik={danismanMi(kullanici) ? "Öğrencilerim" : "Öğrenciler"}
        /*
          KAPSAM SATIRI KALKTI (26 Ağustos 2026 · istek: "Görüntüleme kapsamı:
          Danışmanlığınızdaki öğrenciler · 2 kayıt silelim"). Kapsamı liste
          zaten gösteriyor ve kaç kayıt olduğu da listenin kendisinden
          görülüyor; sayfa bilgisi listenin altındaki sayfalama şeridinde
          duruyor (bkz. "Sayfa X / Y").
        */
      />

      {gorevDurumu === "atandi" && (
        <BilgiKutusu cesit="olumlu">Okul Temsilcisi görevi atandı.</BilgiKutusu>
      )}
      {gorevDurumu === "kaldirildi" && (
        <BilgiKutusu cesit="olumlu">
          Okul Temsilcisi görevi kaldırıldı.
        </BilgiKutusu>
      )}
      {gorevDurumu === "danismanlik-birakildi" && (
        <BilgiKutusu cesit="olumlu">
          Danışmanlık bırakıldı. Gerekçe il koordinatörünüze iletildi ve erişim
          kaydına yazıldı; öğrenci yeni danışmanına bağlandı.
        </BilgiKutusu>
      )}
      {gorevDurumu === "danismanlik-alindi" && (
        <BilgiKutusu cesit="olumlu">
          GençTek danışman öğretmeni olarak görev aldınız. Okulunuzdaki
          öğrenciler sizi danışman seçim listesinde görecek.
        </BilgiKutusu>
      )}
      {gorevDurumu === "mentor-yapildi" && (
        <BilgiKutusu cesit="olumlu">
          Öğrenci onaylı mentör oldu. Mentör havuzunda görünecek ve panodaki
          ilanlara cevap yazabilecek; kendisine bildirim gitti.
        </BilgiKutusu>
      )}
      {gorevDurumu === "mentorluk-kaldirildi" && (
        <BilgiKutusu cesit="olumlu">
          Mentörlük kaldırıldı. Öğrenci havuzdan çıktı ve gerekçeniz ona
          bildirim olarak iletildi.
        </BilgiKutusu>
      )}
      {gorevDurumu === "kaldirma-talebi-acildi" && (
        <BilgiKutusu cesit="olumlu">
          Mentörlüğü kaldırma talebiniz onaya gönderildi. Öğrenci, karar
          verilene kadar mentör olarak kalır; kararı verecek mercie bildirim
          gitti.
        </BilgiKutusu>
      )}
      {gorevDurumu === "kaldirma-talebi-onaylandi" && (
        <BilgiKutusu cesit="olumlu">
          Talep onaylandı ve mentörlük kaldırıldı. Öğrenciye talepteki gerekçe
          bildirim olarak iletildi; talebi açan kişiye de karar bildirildi.
        </BilgiKutusu>
      )}
      {gorevDurumu === "kaldirma-talebi-reddedildi" && (
        <BilgiKutusu cesit="olumlu">
          Talep reddedildi. Öğrenci mentör olarak kaldı ve gerekçeniz talebi
          açan kişiye iletildi; öğrenciye bildirim gitmedi.
        </BilgiKutusu>
      )}
      {/*
        TANINMAYAN `durum` DEĞERİ HAM BASILIYORDU: bilinen kodların listesi
        aşağıdaki dallarla birlikte büyümemiş, "talep-onaylandi" gibi kodlar
        hem kendi cümlesiyle hem de çıplak slug hâliyle iki kutu olarak
        çıkıyordu. Liste 26 Ağustos 2026'da bu dosyadaki bütün kodlarla
        eşitlendi; ham gösterim yalnızca gerçekten tanınmayan bir değer için
        kalıyor (elle yazılmış bir adres gibi).
      */}
      {gorevDurumu &&
        ![
          "atandi",
          "kaldirildi",
          "danismanlik-birakildi",
          "danismanlik-alindi",
          "talep-onaylandi",
          "talep-reddedildi",
          "mentor-yapildi",
          "mentorluk-kaldirildi",
          "kaldirma-talebi-acildi",
          "kaldirma-talebi-onaylandi",
          "kaldirma-talebi-reddedildi",
        ].includes(gorevDurumu) && (
          <BilgiKutusu cesit="olumlu">{gorevDurumu}</BilgiKutusu>
        )}
      {gorevDurumu === "talep-onaylandi" && (
        <BilgiKutusu cesit="olumlu">
          Danışman değişikliği onaylandı; öğrenci artık yeni danışmanına bağlı.
        </BilgiKutusu>
      )}
      {gorevDurumu === "talep-reddedildi" && (
        <BilgiKutusu cesit="olumlu">
          Talep reddedildi. Öğrencinin danışmanı değişmedi ve gerekçeniz ona
          iletildi.
        </BilgiKutusu>
      )}
      {gorevHatasi && <BilgiKutusu cesit="hata">{gorevHatasi}</BilgiKutusu>}

      {/*
        BEKLEYEN TALEPLER — SAYFANIN EN BAŞINDA, listeden önce. Kuyruk bir
        yapılacak listesi; öğrenci tablosunun altında dursaydı üç yüz satırlık
        listenin ardında kalırdı.

        KUTU YALNIZCA TALEP VARKEN basılıyor: boş bir "bekleyen talep yok"
        kartı, hiç talep almayan öğretmenin ekranında kalıcı bir gürültü
        olurdu — sayacın yeri panel ("Dikkat gerektirenler").
      */}
      {bekleyenTalepler.length > 0 && (
        <div id="danisman-talepleri" className="scroll-mt-6">
          <Kart>
            <KartBasligi
              baslik={`Danışman değişikliği talepleri (${bekleyenTalepler.length})`}
              aciklama="Öğrenciler danışmanlarını değiştirmek istiyor. Karar verilene kadar mevcut danışmanları devam eder; reddederseniz gerekçeniz öğrenciye iletilir."
              Ikon={Hourglass}
            />
            <ul className="space-y-3">
              {bekleyenTalepler.map((talep) => (
                <li
                  key={talep.id}
                  className="rounded-kart border border-uyari-cizgi bg-uyari-zemin p-4"
                >
                  <p className="font-medium text-metin">
                    <Link
                      href={`/panel/ogrenciler/${talep.ogrenci.id}`}
                      className="underline underline-offset-2"
                    >
                      {talep.ogrenci.ad} {talep.ogrenci.soyad}
                    </Link>
                    {talep.ogrenci.sinif && (
                      <span className="ml-2 text-sm text-metin-yumusak">
                        {talep.ogrenci.sinif}
                      </span>
                    )}
                  </p>
                  {/*
                    KİMDEN KİME açıkça yazılıyor. Koordinatörün ekranında
                    talepler başka öğretmenler için de gelebiliyor; yalnızca
                    öğrencinin adı basılsaydı kimin danışmanlığının
                    tartışıldığı görünmezdi.
                  */}
                  <p className="mt-1 text-sm text-metin-yumusak">
                    {talep.oncekiDanisman
                      ? `${talep.oncekiDanisman.ad} ${talep.oncekiDanisman.soyad} → `
                      : ""}
                    {talep.istenenDanisman.ad} {talep.istenenDanisman.soyad}
                    {" · "}
                    {tarihSaatYaz(talep.olusturmaTarihi)}
                  </p>

                  <div className="mt-3 flex flex-wrap items-start gap-3">
                    <form action={danismanTalebiniOnaylaEylemi}>
                      <input type="hidden" name="talepId" value={talep.id} />
                      <button type="submit" className={SINIF_BIRINCIL_BUTON}>
                        <BadgeCheck size={15} aria-hidden />
                        Onayla
                      </button>
                    </form>

                    {/*
                      RET GEREKÇESİ AYNI SATIRDA İSTENİYOR, ayrı bir ekranda
                      değil: gerekçe zorunlu (kural katmanı reddediyor) ve iki
                      adımlı bir akış, öğretmeni "reddet"e basıp yarıda
                      bırakmaya iterdi — talep de kuyrukta kalırdı.
                    */}
                    <form
                      action={danismanTalebiniReddetEylemi}
                      className="flex flex-wrap items-start gap-2"
                    >
                      <input type="hidden" name="talepId" value={talep.id} />
                      <input
                        type="text"
                        name="gerekce"
                        required
                        minLength={5}
                        maxLength={500}
                        placeholder="Ret gerekçesi (öğrenci görecek)"
                        className="w-72 rounded-md border border-cizgi bg-kart px-3 py-2 text-sm text-metin"
                      />
                      <button type="submit" className={SINIF_IKINCIL_BUTON}>
                        <X size={15} aria-hidden />
                        Reddet
                      </button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          </Kart>
        </div>
      )}



      {/*
        DANIŞMANSIZ ÖĞRENCİLER (7 Ağustos 2026 · istek: "Öğrenci ekleme /
        Danışmanı olduğu öğrencileri seçme").

        Yalnızca KENDİ OKULUNDAKİ ve DANIŞMANSIZ öğrenciler listelenir; var
        olan bir atamanın üzerine yazılmıyor (gerekçe: eylemler.ts). Liste
        boşsa bölüm hiç basılmaz — "eklenecek kimse yok" bilgisi zaten
        öğrenci listesinde görünüyor.
      */}
      {danismansizlar.length > 0 && (
        <Kart>
          <KartBasligi
            baslik="Okulumdaki danışmansız öğrenciler"
            aciklama={`${danismansizlar.length} öğrencinin danışmanı yok. Danışmanlığınıza aldığınızda öğrenciye bildirim gider.`}
            Ikon={UserPlus}
          />
          <ul className="divide-y divide-cizgi">
            {danismansizlar.map((ogrenci) => (
              <li
                key={ogrenci.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <Link
                    href={`/panel/ogrenciler/${ogrenci.id}`}
                    className="font-medium text-metin transition hover:text-vurgu-metin hover:underline"
                  >
                    {ogrenci.ad} {ogrenci.soyad}
                  </Link>
                  <p className="text-sm text-metin-yumusak">
                    {ogrenci.sinif ? `${ogrenci.sinif}. sınıf` : "—"}
                  </p>
                </div>
                <form action={ogrenciyiDanismanligaAlEylemi}>
                  <input type="hidden" name="ogrenciId" value={ogrenci.id} />
                  <input type="hidden" name="donusYolu" value={donusYolu} />
                  <button type="submit" className={SINIF_IKINCIL_BUTON}>
                    <UserPlus size={15} aria-hidden />
                    Danışmanı ol
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </Kart>
      )}

      {/*
        FORMA `id` VERİLDİ (31 Ağustos 2026): sütun süzgeçleri tablonun içinde,
        yani bu formun DIŞINDA duruyor ve ona `form="ogrenci-suzgeci"` ile
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
              href="/panel/ogrenciler"
              className="inline-flex items-center gap-1 text-sm font-medium text-vurgu-metin"
            >
              <X size={14} aria-hidden />
              Filtreleri temizle
            </Link>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/*
            AD, İL, İLÇE, OKUL VE SINIF SÜZGEÇLERİ SÜTUN BAŞLIKLARINA TAŞINDI
            (31 Ağustos 2026 · istek: "bu da aynı" — Okullar ve Öğretmenler
            ekranındaki sütun süzgeçlerinin aynısı).

            KARTTAN SİLİNDİLER, KOPYALANMADILAR: aynı `name` iki denetimde
            bulunsaydı form ikisini de gönderir ve sütundaki kutuya yazan kişi
            karttaki boş kutunun kazandığını görürdü (gerekçenin tamamı
            components/SutunSuzgeci.tsx içinde).

            KARTTA YALNIZCA SÜTUNU OLMAYAN SÜZGEÇLER KALIYOR: eğitim-öğretim
            yılı, görev/rol, çalışma grubu ve "Profilde ara". Dördü de satırın
            TÜMÜNÜ süzüyor, tek bir sütunu değil — "Görev / rol" süzgeci
            örneğin üç ayrı temsilcilik sütununa birden bakıyor.
          */}
          {yerFiltresiVar && (
            <>
              <label className="block">
                <span className={SINIF_ETIKET}>İl</span>
                {/*
                  İL SEÇİLİR SEÇİLMEZ SÜZÜYOR (31 Ağustos 2026 · istek: "önce
                  ili seçiyorum ilçe seçilemiyor … dinamik olamaz mı"): hemen
                  altındaki ilçe ve okul kutuları sunucuda, seçili ile göre
                  hazırlanıyor ve il gönderilmeden ikisi de kapalı kalıyordu.
                  Kutu kendi formunu gönderiyor; "Filtrele" düğmesi yerinde
                  duruyor ve JavaScript kapalıyken ekran eskisi gibi çalışıyor
                  (bkz. components/SuzgecOtomatikSecim.tsx).
                */}
                <OtomatikSecimKutusu
                  ad="il"
                  deger={filtreler.ilKodu}
                  bosEtiket={
                    iller.length <= 1 ? (iller[0]?.ad ?? "—") : "Tüm iller"
                  }
                  etiket="İl"
                  devreDisi={iller.length <= 1}
                  sinif={SINIF_SECIM}
                  secenekler={iller.map((il) => ({
                    deger: il.ilKodu,
                    etiket: il.ad,
                  }))}
                />
              </label>

              <label className="block">
                <span className={SINIF_ETIKET}>İlçe</span>
                <select
                  name="ilce"
                  defaultValue={filtreler.ilceKodu ?? ""}
                  className={SINIF_SECIM}
                  disabled={ilceler.length === 0}
                >
                  <option value="">
                    {ilceler.length === 0 ? "Önce il seçin" : "Tüm ilçeler"}
                  </option>
                  {ilceler.map((ilce) => (
                    <option key={ilce.ilceKodu} value={ilce.ilceKodu}>
                      {ilce.ad}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className={SINIF_ETIKET}>Okul</span>
                <select
                  name="okul"
                  defaultValue={
                    filtreler.kurumKodu ? String(filtreler.kurumKodu) : ""
                  }
                  className={SINIF_SECIM}
                  disabled={okullar.length === 0}
                >
                  <option value="">
                    {okullar.length === 0 ? "Önce il seçin" : "Tüm okullar"}
                  </option>
                  {okullar.map((okul) => (
                    <option key={okul.kurumKodu} value={okul.kurumKodu}>
                      {okul.ad}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}


          <label className="block">
            <span className={SINIF_ETIKET}>Eğitim-öğretim yılı</span>
            <select
              name="yil"
              defaultValue={filtreler.egitimOgretimYili ?? ""}
              className={SINIF_SECIM}
            >
              <option value="">Tüm yıllar</option>
              {yilSecenekleri.map((yil) => (
                <option key={yil} value={yil}>
                  {yil}
                </option>
              ))}
            </select>
          </label>

          {/*
            GÖREV/ROL SÜZGECİ (27 Ağustos 2026 · istek: "üstteki filtrelere yeni
            bir rol alanı ilçe temsilcisi il temsilcisi okul temsilcisi mentör
            şeklinde açılan liste filtresi olsun").

            Dördün üçü bir GÖREV kaydı, "Mentör" ise onaylanmış bir mentörlük —
            ayrımın gerekçesi kapsam katmanında (kapsam.ts · gorevRolu). Tek
            listede durmaları ekranın sorusunun ortak olmasından: "bu öğrenci ne
            yapıyor".

            Çalışma grubu temsilciliği burada YOK: kapsamı bir yer değil bir
            grup ve bir alt satırdaki "Çalışma grubu" süzgeci zaten o ekseni
            veriyor.
          */}
          <label className="block">
            <span className={SINIF_ETIKET}>Görev / rol</span>
            <select
              name="gorev"
              defaultValue={filtreler.gorevRolu ?? ""}
              className={SINIF_SECIM}
            >
              <option value="">Tüm öğrenciler</option>
              <option value="IL_TEMSILCISI">İl temsilcisi</option>
              <option value="ILCE_TEMSILCISI">İlçe temsilcisi</option>
              <option value="OKUL_TEMSILCISI">Okul temsilcisi</option>
              <option value="MENTOR">Mentör</option>
            </select>
          </label>

          <label className="block">
            <span className={SINIF_ETIKET}>Çalışma grubu</span>
            <select
              name="grup"
              defaultValue={
                filtreler.calismaGrubuId ? String(filtreler.calismaGrubuId) : ""
              }
              className={SINIF_SECIM}
            >
              <option value="">Tüm gruplar</option>
              {gruplar.map((grup) => (
                <option key={grup.id} value={grup.id}>
                  {grup.ad}
                </option>
              ))}
            </select>
          </label>


          {/*
            PROFİLDE ARAMA (26 Ağustos 2026 · istekler: "Deneyim türü bu
            filtre ürünlere göre, topluluklara göre, deneyimlerime göre
            filtrelesin" · "bunu da profilde ara olarak değiştir" · "Deneyim
            adında ara bunu silelim").

            Burada iki süzgeç vardı: tek tek kazanım TİPLERİNİ listeleyen bir
            açılır kutu ve başlıkta metin arayan bir yazı alanı. Tip listesi
            kişinin profilde gördüğü başlıklarla örtüşmüyordu (profilde üç
            grup, süzgeçte sekiz tip) ve serbest arama, aynı şeyin üç ayrı
            yazımını üç ayrı sonuç yapıyordu. Geriye profildeki üç başlık
            kaldı: Ürünlerim · Deneyimlerim · Topluluklarım.
          */}
          <label className="block">
            <span className={SINIF_ETIKET}>Profilde ara</span>
            <select
              name="kazanim"
              defaultValue={filtreler.kazanimGrubu ?? ""}
              className={SINIF_SECIM}
            >
              <option value="">Tüm kayıtlar</option>
              {BILISIM_YOLCULUGU_GRUPLARI.map((grup) => (
                <option key={grup.kod} value={grup.kod}>
                  {grup.baslik}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-metin">
            <input
              type="checkbox"
              name="danismansiz"
              value="1"
              defaultChecked={filtreler.danismansizMi}
              className="h-4 w-4 rounded border-cizgi accent-[var(--renk-birincil)]"
            />
            Yalnızca danışmanı olmayanlar
          </label>
          <button type="submit" className={SINIF_BIRINCIL_BUTON}>
            Filtrele
          </button>
          {toplam > 0 && (
            // Bağlantı, formun o anki hâlini değil ADRESTEKİ filtreleri taşır:
            // indirilen dosya ekranda görünen listeyle birebir aynı olmalı.
            <DisaAktarmaBagi yol={disaAktarmaBaglantisi} kayitSayisi={toplam} />
          )}
        </div>
      </form>

      {/*
        Yıllara göre karşılaştırma. Yıl filtresi dışındaki filtreler uygulanmış
        hâliyle sayılır; tek yıl varsa tablo gösterilmez, karşılaştıracak bir
        şey yoktur.
      */}
      {yilDagilimi.length > 1 && (
        <Kart>
          <KartBasligi
            baslik="Eğitim-öğretim yıllarına göre karşılaştırma"
            aciklama="Seçili yıl filtresi dışındaki filtrelerle sayılmıştır."
            Ikon={CalendarRange}
          />
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-cizgi text-metin-yumusak">
                <tr>
                  <th className="py-2 pr-4 font-medium">Eğitim-öğretim yılı</th>
                  <th className="py-2 pr-4 font-medium">Öğrenci sayısı</th>
                  <th className="py-2 font-medium">Bir önceki yıla göre</th>
                </tr>
              </thead>
              <tbody>
                {yilDagilimi.map((satir, sira) => {
                  // Liste yeniden eskiye sıralı; "önceki yıl" bir sonraki satır.
                  const oncekiYil = yilDagilimi[sira + 1];
                  const fark = oncekiYil
                    ? satir._count._all - oncekiYil._count._all
                    : null;

                  return (
                    <tr
                      key={satir.egitimOgretimYili}
                      className="border-b border-cizgi last:border-0"
                    >
                      <td className="py-2 pr-4 font-medium text-metin">
                        <Link
                          href={`/panel/ogrenciler?${(() => {
                            const sorgu = new URLSearchParams(
                              sorguMetni(parametreler, ["sayfa", "yil"]),
                            );
                            sorgu.set("yil", satir.egitimOgretimYili);
                            return sorgu.toString();
                          })()}`}
                          className="transition hover:text-vurgu-metin hover:underline"
                        >
                          {satir.egitimOgretimYili}
                        </Link>
                      </td>
                      <td className="py-2 pr-4 text-metin-yumusak">
                        {satir._count._all}
                      </td>
                      <td className="py-2 text-metin-yumusak">
                        {fark === null
                          ? "—"
                          : fark === 0
                            ? "değişmedi"
                            : fark > 0
                              ? `+${fark}`
                              : String(fark)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Kart>
      )}

      {ogrenciler.length === 0 ? (
        <Kart className="text-metin-yumusak">
          {filtreVar
            ? "Bu filtrelerle eşleşen öğrenci yok."
            : "Kapsamınızda görüntülenecek öğrenci yok."}
        </Kart>
      ) : (
        <div className="overflow-x-auto rounded-kart border border-cizgi bg-kart shadow-kart">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-cizgi bg-zemin text-metin-yumusak">
              <tr>
                <th className="px-4 py-3 font-medium">Ad Soyad</th>
                <th className="px-4 py-3 font-medium">Sınıf</th>
                <th className="px-4 py-3 font-medium">Okul</th>
                <th className="px-4 py-3 font-medium">İl / İlçe</th>
                {/*
                  "ROLLER" SÜTUNU KALKTI (27 Ağustos 2026 · istek: "bu sütunu
                  kaldır · Roller").

                  Sütun görev rozetlerini basıyordu (İl/İlçe/Okul Temsilcisi,
                  Çalışma Grubu Yöneticisi) ve üçü zaten kendi sütunlarında
                  atanıp gösteriliyor — aynı bilgi satırda iki kez duruyordu.
                  Öğrencinin "OGRENCI" rolü ise herkeste aynı, bir ayrım
                  taşımıyor.
                */}
                {/*
                  MENTÖRLÜK, ÇALIŞMA GRUPLARININ HEMEN YANINDA (26 Ağustos 2026 ·
                  istek: "Çalışma grupları bu sutunun yanına mentörlük durumu
                  olsun"); 29 Ağustos 2026'da ikisinin sırası değişti
                  (istek: "Çalışma grubu temsilcisi · Mentörlük bu iki sutunun
                  yerini değiştir"), komşuluk korundu. Komşuluk bilinçli: mentörlüğün kapsamı da çalışma
                  gruplarından oluşuyor (bkz. mentorlukKabulEdilirMi), yani iki
                  sütun aynı soruyu iki açıdan cevaplıyor — "hangi alanlarda
                  çalışıyor" ve "o alanlarda yol gösteriyor mu".

                  SÜTUN HERKESE BASILIR, DÜĞMELER DEĞİL: durum bir bilgidir ve
                  koordinatör de merkez de ilindeki mentörleri görebilmeli;
                  karar ise yalnızca öğrencinin kendi danışmanının
                  (bkz. MentorlukHucresi).
                */}
                <th className="px-4 py-3 font-medium">Mentörlük</th>
                {/*
                  BAŞLIK "ÇALIŞMA GRUBU TEMSİLCİSİ" (27 Ağustos 2026 · istek:
                  "bu sütunun adı Çalışma grupları · Çalışma grubu temsilcisi
                  olsun").

                  ÜYELİK LİSTESİ DE KALKTI: sütun eskiden önce öğrencinin üye
                  olduğu grupları ("Oyun Tasarımı, Siber Güvenlik") yazıyor,
                  altına temsilcilik kutusunu koyuyordu. Yeni ad yalnızca
                  ikincisini vaat ediyor ve istek de "nerenin temsilcisi olduğu
                  görünsün, detaya gerek yok" diyor. Üyelikler kaybolmadı:
                  öğrencinin kendi sayfasında duruyor ve üstteki "Çalışma
                  grubu" süzgeci hâlâ gruba göre listeyi daraltıyor.
                */}
                <th className="px-4 py-3 font-medium">
                  Çalışma grubu temsilcisi
                </th>
                {danismanlikYonetebilir && (
                  <th className="px-4 py-3 font-medium">Danışmanlık</th>
                )}
                {temsilcilikRolleri.map((rolKodu) => (
                  <th
                    key={rolKodu}
                    className="px-4 py-3 font-medium whitespace-nowrap"
                  >
                    {TEMSILCILIK_BASLIKLARI[rolKodu]}
                  </th>
                ))}
              </tr>

              {/*
                SÜZGEÇ SATIRI. Süzgeci olan sütunlar Öğretmenler ekranıyla aynı
                mantıkla seçildi: kişiyi ve okulunu DARALTAN alanlar. Mentörlük,
                çalışma grubu temsilciliği, danışmanlık ve temsilcilik sütunları
                boş kalıyor — üçü de karttaki "Görev / rol" ve "Çalışma grubu"
                süzgeçlerinin konusu ve orada zaten sorulabiliyor; aynı soruyu
                iki yerden sormak, hangisinin kazandığını belirsiz bırakırdı.

                İL/İLÇE TEK HÜCREDE İKİ KUTU: sütun başlığı da tek. İl
                seçilmeden ilçe kapalı — ilçe listesi ilden türüyor.

                DÜĞMENİN `colSpan`I DEĞİŞKEN: danışmanlık sütunu yalnızca
                yönetebilene, temsilcilik sütunları da role göre basılıyor.
                Sabit bir sayı yazsaydım tablo o kullanıcılarda kayardı.
              */}
              <SutunSuzgecSatiri>
                <SutunMetinSuzgeci
                  form={SUZGEC_FORMU}
                  ad="ara"
                  deger={filtreler.ara}
                  ipucu="Ad veya soyad"
                />
                <SutunSecimSuzgeci
                  form={SUZGEC_FORMU}
                  ad="sinif"
                  deger={filtreler.sinif}
                  bosEtiket="Tüm sınıflar"
                  etiket="Sınıf"
                  secenekler={sinifSuzgecSecenekleri}
                />
                <SutunSecimSuzgeci
                  form={SUZGEC_FORMU}
                  ad="okul"
                  deger={
                    filtreler.kurumKodu ? String(filtreler.kurumKodu) : null
                  }
                  bosEtiket={
                    okullar.length === 0 ? "Önce il seçin" : "Tüm okullar"
                  }
                  etiket="Okul"
                  devreDisi={okullar.length === 0}
                  secenekler={okullar.map((okul) => ({
                    deger: String(okul.kurumKodu),
                    etiket: okul.ad,
                  }))}
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
                <SutunSuzgecDugmesi
                  form={SUZGEC_FORMU}
                  colSpan={
                    2 +
                    (danismanlikYonetebilir ? 1 : 0) +
                    temsilcilikRolleri.length
                  }
                />
              </SutunSuzgecSatiri>
            </thead>
            <tbody>
              {ogrenciler.map((ogrenci) => {
                // İçinde bulunulan dönemin görevleri; geçmiş dönem görevleri
                // profilin katkı kartında duruyor.
                const gorevler = ogrenci.gorevRolleri.filter(
                  (gorev) =>
                    gorev.egitimOgretimYili === ogrenci.egitimOgretimYili,
                );
                /*
                  KARARA BAĞLANMIŞ TALEP HÜCREYE HİÇ GİRMEZ (28 Ağustos 2026):
                  satır tek bir talep taşıyor ve o satır yeni talepte üzerine
                  yazılıyor, yani eski kararlar burada birikmiyor. Süzme
                  ekranda yapılıyor, sorguda değil — talep kaydı zaten birebir
                  geliyor ve `where` koşulu, hücrenin okuduğu koşulla ayrışmaya
                  açık ikinci bir yer olurdu.
                */
                const talepKaydi = ogrenci.mentorluk?.kaldirmaTalebi ?? null;
                const bekleyenKaldirmaTalebi =
                  talepKaydi && talepKaydi.durum === "BEKLIYOR"
                    ? talepKaydi
                    : null;
                return (
                  <tr
                    key={ogrenci.id}
                    className="border-b border-cizgi last:border-0"
                  >
                    <td className="px-4 py-3 font-medium text-metin">
                      {/*
                       * Profil bağlantısı kapsam kontrolü YERİNE geçmez:
                       * hedef sayfa aynı merkezi filtreden yeniden geçer ve
                       * kapsam dışı id'de 404 döner. Buradaki bağlantı
                       * yalnızca gezinme kolaylığı.
                       */}
                      <Link
                        href={`/panel/ogrenciler/${ogrenci.id}`}
                        className="transition hover:text-vurgu-metin hover:underline"
                      >
                        {ogrenci.ad} {ogrenci.soyad}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-metin-yumusak">
                      {ogrenci.sinif ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-metin-yumusak">
                      {ogrenci.kurum?.ad ??
                        (ogrenci.beyanOkulAdi
                          ? `${ogrenci.beyanOkulAdi} (listede yok)`
                          : "—")}
                    </td>
                    <td className="px-4 py-3 text-metin-yumusak">
                      {ogrenci.il?.ad ?? "—"}
                      {ogrenci.ilce?.ad ? ` / ${ogrenci.ilce.ad}` : ""}
                    </td>
                    <td className="px-4 py-3">
                      <MentorlukHucresi
                        ogrenciId={ogrenci.id}
                        durum={ogrenci.mentorluk?.durum ?? null}
                        kararVerebilir={ogrenciMentorluguneKararVerebilirMi(
                          kullanici,
                          ogrenci,
                          ogrenci.ogrenciAtamalari[0]?.danismanKullaniciId ===
                            kullanici.id,
                        )}
                        kaldirmaDuzeyi={ogrenciMentorluguKaldirmaDuzeyi(
                          kullanici,
                          ogrenci,
                          ogrenci.ogrenciAtamalari[0]?.danismanKullaniciId ===
                            kullanici.id,
                        )}
                        talep={bekleyenKaldirmaTalebi}
                        talebiKararaBaglayabilir={
                          bekleyenKaldirmaTalebi !== null &&
                          mentorlukKaldirmaTalebiniOnaylayabilirMi(
                            kullanici,
                            bekleyenKaldirmaTalebi,
                            ogrenci,
                          )
                        }
                        donusYolu={donusYolu}
                      />
                    </td>
                    <td className="px-4 py-3 text-metin-yumusak">
                      <CalismaGrubuTemsilciligi
                        ogrenci={{ ...ogrenci, gorevRolleri: gorevler }}
                        kullanici={kullanici}
                        gruplar={gruplar}
                        donusYolu={donusYolu}
                      />
                    </td>
                    {/*
                      OKUL TEMSİLCİSİ ATAMASI (J2 · 5 Ağustos 2026). Görev
                      Rolleri sekmesi danışman öğretmenin menüsünden kalktı;
                      atama artık burada. İl ve ilçe temsilciliği BURADA YOK —
                      onları il koordinatörü kendi ekranından atıyor, çünkü
                      koordinatörün listesi ilin tamamı ve ilçe bazlı atamayı
                      burada yapmak filtre kurmayı zorunlu kılardı.

                      Yetki iki kez sorulur: burada (düğmeyi hiç basmamak için)
                      ve eylemin içinde (form kurcalanabilir).
                    */}
                    {danismanlikYonetebilir && (
                      <td className="px-4 py-3">
                        <DanismanlikHucresi
                          ogrenciId={ogrenci.id}
                          kendiOgrencisi={
                            ogrenci.ogrenciAtamalari[0]?.danismanKullaniciId ===
                            kullanici.id
                          }
                        />
                      </td>
                    )}
                    {/*
                      Hücreye DÖNEMİ SÜZÜLMÜŞ liste veriliyor: geçmiş dönemde
                      temsilci olmuş bir öğrenciye bu yıl "Görevi kaldır"
                      göstermek, olmayan bir görevi kaldırmayı teklif etmek
                      olurdu.
                    */}
                    {/*
                      Hücreye DÖNEMİ SÜZÜLMÜŞ liste veriliyor: geçmiş dönemde
                      temsilci olmuş bir öğrenciye bu yıl "Kaldır" göstermek,
                      olmayan bir görevi kaldırmayı teklif etmek olurdu.
                    */}
                    {temsilcilikRolleri.map((rolKodu) => (
                      <td key={rolKodu} className="px-4 py-3">
                        <TemsilcilikHucresi
                          rolKodu={rolKodu}
                          ogrenci={{ ...ogrenci, gorevRolleri: gorevler }}
                          kullanici={kullanici}
                          kendiOgrencisi={
                            ogrenci.ogrenciAtamalari[0]?.danismanKullaniciId ===
                            kullanici.id
                          }
                          donusYolu={donusYolu}
                        />
                      </td>
                    ))}
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
      {/*
        ==================================================================
        TOPLULUKLAR / EKİPLER (31 Ağustos 2026 · istek: "burada alta bir liste
        daha ekle, öğrencilerinin girdiği topluluk ekip vs olsun")
        ==================================================================

        SAYFALAMANIN ALTINDA, danışmanlık dipnotunun üstünde: üstteki listenin
        yan okuması olduğu için onun bittiği yerde başlıyor. Üstte bir sütun
        olarak durmadı çünkü bir öğrencinin birden çok topluluğu olabiliyor ve
        satıra sığmayan bir liste, tabloyu okunmaz hâle getirirdi.

        BOŞ HÂLDE DE BASILIYOR: kart hiç görünmeseydi, kayıt girilmediği için
        mi yoksa özellik olmadığı için mi boş olduğu anlaşılmazdı.
      */}
      <Kart>
        <KartBasligi
          baslik="Topluluklar / ekipler / kulüpler"
          aciklama={
            toplulukToplami > TOPLULUK_TAVANI
              ? `Kapsamınızdaki öğrencilerin kendi girdiği kayıtlar · ${toplulukToplami} kayıttan ilk ${TOPLULUK_TAVANI}'i · daraltmak için yukarıdaki süzgeçleri kullanın`
              : `Kapsamınızdaki öğrencilerin kendi girdiği kayıtlar · ${toplulukToplami} kayıt`
          }
          Ikon={Users}
        />

        {topluluklar.length === 0 ? (
          <p className="text-metin-yumusak">
            Bu süzgeçlerle topluluk, ekip ya da kulüp kaydı bulunamadı.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-cizgi text-metin-yumusak">
                <tr>
                  <th className="py-2 pr-4 font-medium">Topluluk / ekip</th>
                  <th className="py-2 pr-4 font-medium">Öğrenci</th>
                  <th className="py-2 pr-4 font-medium">Okul</th>
                  {/*
                    "Bağlı olduğu kurum" alanı (`duzenleyen`) topluluk
                    kaydında kulübün bağlı olduğu kuruluşu taşıyor — öğrencinin
                    okulundan farklı olabilir (belediye gençlik merkezi, bir
                    dernek). İki sütun ayrı duruyor ki karışmasın.
                  */}
                  <th className="py-2 pr-4 font-medium">Bağlı kurum</th>
                  <th className="py-2 font-medium">Tarih</th>
                </tr>
              </thead>
              <tbody>
                {topluluklar.map((kayit) => (
                  <tr key={kayit.id} className="border-b border-cizgi last:border-0">
                    <td className="py-2 pr-4">
                      <span className="font-medium text-metin">
                        {kayit.baslik}
                      </span>
                      {/*
                        AÇIKLAMA KIRPILIYOR: kayıt alanı çok satırlı ve
                        "toplulukta üstlendiğiniz görevi de açıklayınız" diyor
                        — tam metin satırı sayfa boyuna çıkarırdı. Tamamı
                        öğrencinin kendi sayfasında.
                      */}
                      {kayit.aciklama && (
                        <p className="mt-0.5 line-clamp-2 text-metin-yumusak">
                          {kayit.aciklama}
                        </p>
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      <Link
                        href={`/panel/ogrenciler/${kayit.kullanici.id}`}
                        className="font-medium text-vurgu-metin underline underline-offset-2"
                      >
                        {kayit.kullanici.ad} {kayit.kullanici.soyad}
                      </Link>
                      {kayit.kullanici.sinif && (
                        <span className="text-metin-yumusak">
                          {" · "}
                          {kayit.kullanici.sinif}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-metin-yumusak">
                      {kayit.kullanici.kurum?.ad ?? "—"}
                    </td>
                    <td className="py-2 pr-4 text-metin-yumusak">
                      {kayit.duzenleyen ?? "—"}
                    </td>
                    <td className="py-2 text-metin-yumusak">
                      {kayit.tarih ? tarihYaz(kayit.tarih) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Kart>

      {/*
        DANIŞMANLIK ROZETİ SAYFANIN ALTINDA (26 Ağustos 2026 · istek:
        "GençTek danışman öğretmenliği … bunu kaldıralım ama bunu alta
        alalım: Danışman öğretmen olarak görev alıyorsunuz").

        Kart ekranın tepesinde iki paragraf açıklamayla duruyordu: görevin
        nasıl alındığı ve öğrencinin nasıl bırakılacağı. İkisi de buraya
        gelen kişinin bildiği şeyler — görevi var (yoksa bu ekranı açamıyor)
        ve bırakma artık listenin kendi satırında. Geriye durumu söyleyen
        tek satır kaldı; bir başlık değil, bir dipnot.
      */}
      {danismanlikIsaretiGosterilir && (
        <p className="inline-flex items-center gap-2 rounded-full bg-olumlu-zemin px-3 py-1 text-sm font-medium text-olumlu-metin">
          <BadgeCheck size={15} aria-hidden />
          Danışman öğretmen olarak görev alıyorsunuz.
        </p>
      )}
    </div>
  );
}
