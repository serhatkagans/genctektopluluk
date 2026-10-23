import {
  epostaGecerliMi,
  epostaNormalle,
  TELEFON_BICIMI,
} from "../dis-kimlik/kurallar";
import {
  AD_UST_SINIRI,
  adNormalle,
  BRANS_UST_SINIRI,
  KAYIT_OKUL_TURLERI,
  okulSecimiCoz,
  sinifCoz,
} from "../kayit/kurallar";

/**
 * Öğrenci panelindeki "Genel bilgiler" ve "Danışman öğretmen bilgileri"
 * kuralları (23 Ekim 2026 · istek: "Kimlik bilgileri başlığı yerine genel
 * bilgiler yazılacak … mevcut yapı düzenlenebilir olsun").
 *
 * Saf tutulur: veritabanına gitmez, birim testle kapsanır. Okulun gerçekten
 * seçilen il/ilçede ve türde olup olmadığı veritabanı istediği için
 * ogrenci/genel-bilgiler.ts'te denetlenir.
 *
 * Kayıt formuyla AYNI parçalardan kurulur (kayit/kurallar.ts): bir alanı
 * kayıtta kabul edip panelde reddetmek, ya da tersi, kişiye çelişki gibi
 * görünürdü.
 */

/**
 * Formun kimin için basıldığı (23 Ekim 2026 · istek: öğretmen ve koordinatör
 * sayfalarında "Kimlik bilgileri öğrenci bilgileri ile aynı olacak, bu sefer
 * öğretmene göre ayarlı sınıf olmayacak"). Öğretmende sınıf yerine branş.
 */
export type GenelBilgilerTipi = "OGRENCI" | "OGRETMEN";

export interface GenelBilgilerGirdisi {
  ad: string;
  soyad: string;
  cinsiyet: string;
  ilKodu: string;
  ilceKodu: string;
  okulTuru: string;
  kurumKodu: string;
  beyanOkulAdi: string;
  sinifSeviyesi: string;
  sube: string;
  /** Yalnızca öğretmende. */
  brans: string;
}

export interface GenelBilgiler {
  ad: string;
  soyad: string;
  cinsiyet: "E" | "K";
  ilKodu: string;
  ilceKodu: string;
  okulTuru: string;
  kurumKodu: number | null;
  beyanOkulAdi: string | null;
  /** Öğrencide dolu, öğretmende null. */
  sinif: string | null;
  /** Öğretmende dolu, öğrencide null. */
  brans: string | null;
}

export type GenelBilgilerKarari =
  | { olurMu: true; bilgiler: GenelBilgiler }
  | { olurMu: false; neden: string };

export function genelBilgileriCoz(
  girdi: GenelBilgilerGirdisi,
  tip: GenelBilgilerTipi = "OGRENCI",
): GenelBilgilerKarari {
  const ad = adNormalle(girdi.ad);
  const soyad = adNormalle(girdi.soyad);
  if (!ad || !soyad) {
    return { olurMu: false, neden: "Ad ve soyad zorunludur." };
  }
  if (ad.length > AD_UST_SINIRI || soyad.length > AD_UST_SINIRI) {
    return {
      olurMu: false,
      neden: `Ad ve soyad en fazla ${AD_UST_SINIRI} karakter olabilir.`,
    };
  }

  if (girdi.cinsiyet !== "E" && girdi.cinsiyet !== "K") {
    return { olurMu: false, neden: "Cinsiyet seçilmelidir." };
  }

  const ilKodu = girdi.ilKodu.trim();
  if (!/^\d{2}$/.test(ilKodu)) {
    return { olurMu: false, neden: "İl seçilmelidir." };
  }
  /*
   * İLÇE ZORUNLU: listeden seçilen okulda ilçe okulun kaydından da okunabilir,
   * ama okulu listede olmayan öğrencinin ilçesini başka hiçbir yer söylemiyor.
   * İlçenin bu ile ait olduğu veritabanında denetlenir.
   */
  const ilceKodu = girdi.ilceKodu.trim();
  if (!/^\d{4}$/.test(ilceKodu)) {
    return { olurMu: false, neden: "İlçe seçilmelidir." };
  }

  const okulTuru = girdi.okulTuru.trim();
  if (!KAYIT_OKUL_TURLERI.includes(okulTuru)) {
    return { olurMu: false, neden: "Okul türünüzü seçin." };
  }

  const okulKarari = okulSecimiCoz(girdi.kurumKodu, girdi.beyanOkulAdi);
  if (!okulKarari.olurMu) return okulKarari;

  let sinif: string | null = null;
  let brans: string | null = null;
  if (tip === "OGRENCI") {
    const sinifKarari = sinifCoz(girdi.sinifSeviyesi, girdi.sube);
    if (!sinifKarari.olurMu) return sinifKarari;
    sinif = sinifKarari.sinif;
  } else {
    brans = adNormalle(girdi.brans);
    if (!brans) return { olurMu: false, neden: "Branşınızı yazın." };
    if (brans.length > BRANS_UST_SINIRI) {
      return {
        olurMu: false,
        neden: `Branş en fazla ${BRANS_UST_SINIRI} karakter olabilir.`,
      };
    }
  }

  return {
    olurMu: true,
    bilgiler: {
      ad,
      soyad,
      cinsiyet: girdi.cinsiyet,
      ilKodu,
      ilceKodu,
      okulTuru,
      kurumKodu: okulKarari.kurumKodu,
      beyanOkulAdi: okulKarari.beyanOkulAdi,
      sinif,
      brans,
    },
  };
}

// ---------------------------------------------------------------------------
// Danışman öğretmen bilgisi (öğrencinin beyanı)
// ---------------------------------------------------------------------------

export interface DanismanBilgisiGirdisi {
  ad: string;
  soyad: string;
  brans: string;
  telefon: string;
  eposta: string;
}

/** `ogrenci_profil.beyan_danisman_*` sütunlarıyla birebir. */
export interface DanismanBilgisi {
  beyanDanismanAd: string | null;
  beyanDanismanSoyad: string | null;
  beyanDanismanBrans: string | null;
  beyanDanismanTelefon: string | null;
  beyanDanismanEposta: string | null;
}

export type DanismanBilgisiKarari =
  | { olurMu: true; bilgi: DanismanBilgisi }
  | { olurMu: false; neden: string };

/**
 * HEPSİ BOŞ GELİRSE KAYIT TEMİZLENİR (istek: "Danışman öğretmeniniz yoksa boş
 * bırakın"). Bir alan doluysa ad ve soyad birlikte istenir: yalnızca telefonu
 * olan bir satır kimin telefonu olduğunu söylemez.
 */
export function danismanBilgisiCoz(
  girdi: DanismanBilgisiGirdisi,
): DanismanBilgisiKarari {
  const ad = adNormalle(girdi.ad);
  const soyad = adNormalle(girdi.soyad);
  const brans = adNormalle(girdi.brans);
  const telefon = girdi.telefon.trim().replace(/\s+/g, " ");
  const eposta = epostaNormalle(girdi.eposta);

  if (!ad && !soyad && !brans && !telefon && !eposta) {
    return {
      olurMu: true,
      bilgi: {
        beyanDanismanAd: null,
        beyanDanismanSoyad: null,
        beyanDanismanBrans: null,
        beyanDanismanTelefon: null,
        beyanDanismanEposta: null,
      },
    };
  }

  if (!ad || !soyad) {
    return {
      olurMu: false,
      neden: "Danışman öğretmeninizin adını ve soyadını yazın.",
    };
  }
  if (ad.length > AD_UST_SINIRI || soyad.length > AD_UST_SINIRI) {
    return {
      olurMu: false,
      neden: `Ad ve soyad en fazla ${AD_UST_SINIRI} karakter olabilir.`,
    };
  }
  if (brans.length > BRANS_UST_SINIRI) {
    return {
      olurMu: false,
      neden: `Branş en fazla ${BRANS_UST_SINIRI} karakter olabilir.`,
    };
  }
  if (
    telefon &&
    (!TELEFON_BICIMI.test(telefon) || telefon.replace(/\D/g, "").length < 10)
  ) {
    return {
      olurMu: false,
      neden: "Danışman öğretmeninizin telefon numarası geçerli değil.",
    };
  }
  if (eposta && !epostaGecerliMi(eposta)) {
    return {
      olurMu: false,
      neden: "Danışman öğretmeninizin e-posta adresi geçerli değil.",
    };
  }

  return {
    olurMu: true,
    bilgi: {
      beyanDanismanAd: ad,
      beyanDanismanSoyad: soyad,
      beyanDanismanBrans: brans || null,
      beyanDanismanTelefon: telefon || null,
      beyanDanismanEposta: eposta || null,
    },
  };
}
