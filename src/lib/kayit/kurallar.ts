import { egitimOgretimYili } from "../ogretmen/gorev-yillari";
import {
  epostaGecerliMi,
  epostaNormalle,
  sifreKarariniVer,
  TELEFON_BICIMI,
} from "../dis-kimlik/kurallar";
import {
  BILINEN_OKUL_TURLERI,
  OKUL_TURU_DIGER,
  okulTuruSecenekleri,
} from "../okul/turler";

/**
 * Kayıtla giriş kuralları — EBA SSO gelene kadar (17 Eylül 2026 · istek:
 * "login ekranında kayıt olacak kullanıcı ve sonra giriş yapacak").
 *
 * Öğrenci ve öğretmen kendi kaydını açar; sonraki girişler T.C. kimlik no +
 * şifreyle yapılır. Şifre alt sınırı, kilit ve özetleme dış kullanıcı
 * girişiyle AYNI kurallardan geçer (dis-kimlik/kurallar.ts, sifre.ts): iki
 * ayrı şifre politikası tutmanın bir kazancı yok.
 *
 * Bu dosya veritabanına bakmaz; kararlar birim testle sınanır. Okulun
 * gerçekten o ilde olup olmadığı veritabanı gerektirdiği için kayit/kayit.ts'te
 * denetlenir.
 */

export type KayitTipi = "OGRENCI" | "OGRETMEN";

export const KAYIT_TIPLERI: { kod: KayitTipi; etiket: string }[] = [
  { kod: "OGRENCI", etiket: "Öğrenci" },
  { kod: "OGRETMEN", etiket: "Öğretmen" },
];

export function kayitTipiMi(deger: string): deger is KayitTipi {
  return deger === "OGRENCI" || deger === "OGRETMEN";
}

/**
 * Okul seçiminde "Okulum listede yok" seçeneğinin değeri (23 Ekim 2026).
 * Kurum kodu her zaman pozitif tam sayı olduğu için bir kodla karışmaz.
 */
export const OKUL_LISTEDE_YOK = "LISTEDE_YOK";

/**
 * Kayıtta öğrencinin seçebileceği okul türleri (23 Ekim 2026 · istek: "öğrenci
 * girişinde okul türü de gelsin, yani öğrenci okul türünü listeden
 * seçebilsin"). Süzgeçlerdeki standart listenin aynısı, "Diğer" en sonda.
 */
export const KAYIT_OKUL_TURLERI: readonly string[] = okulTuruSecenekleri();

/**
 * Seçilen okul türü, listeden seçilen okulun kaydındaki türle uyuşuyor mu?
 * "Diğer", standart listede olmayan türlerin tümünü karşılar (bkz.
 * okul/turler.ts · okulTuruKosulu).
 */
export function okulTuruUyarMi(secilen: string, okulunTuru: string): boolean {
  if (secilen === OKUL_TURU_DIGER) {
    return !BILINEN_OKUL_TURLERI.includes(okulunTuru);
  }
  return secilen === okulunTuru;
}

/** Lise seviyeleri; GençTek lise öğrencilerine açık. */
export const SINIF_SEVIYELERI = ["9", "10", "11", "12"] as const;

/**
 * T.C. kimlik numarası biçim ve sağlama kontrolü.
 *
 * NÜFUS KAYDINA SORMAZ — MERNİS erişimi yok. Yakaladığı şey yazım hatasıdır:
 * 11 hane, ilk hane 0 değil, 10. ve 11. haneler resmî sağlama kuralına uyar.
 * Uydurma ama kurala uyan bir numara geçer; pilotun "belli kişilerle"
 * yapılması bu boşluğun kabul edilme sebebi.
 */
export function tcKimlikNoGecerliMi(deger: string): boolean {
  if (!/^[1-9][0-9]{10}$/.test(deger)) return false;
  const h = [...deger].map(Number);
  const tekler = h[0] + h[2] + h[4] + h[6] + h[8];
  const ciftler = h[1] + h[3] + h[5] + h[7];
  const onuncu = (((tekler * 7 - ciftler) % 10) + 10) % 10;
  if (onuncu !== h[9]) return false;
  const ilkOnToplam = h.slice(0, 10).reduce((a, b) => a + b, 0);
  return ilkOnToplam % 10 === h[10];
}

/** Boşlukları atar; kişi numarayı "123 456 789 01" diye yazabilir. */
export function tcKimlikNoNormalle(deger: string): string {
  return deger.replace(/\s+/g, "");
}

/** Ekrandan gelen ham kayıt girdisi. */
export interface KayitGirdisi {
  tip: string;
  tcKimlikNo: string;
  ad: string;
  soyad: string;
  cinsiyet: string;
  ilKodu: string;
  /** Kurum kodu ya da `OKUL_LISTEDE_YOK`. */
  kurumKodu: string;
  /** Okul listede yoksa kişinin yazdığı ad. */
  beyanOkulAdi: string;
  /** Yalnızca öğrencide zorunlu. */
  okulTuru: string;
  eposta: string;
  telefon: string;
  sinifSeviyesi: string;
  sube: string;
  brans: string;
  sifre: string;
  sifreTekrar: string;
}

/** Doğrulanmış kayıt; şifre henüz özetlenmemiş. */
export interface KayitKaydi {
  tip: KayitTipi;
  tcKimlikNo: string;
  ad: string;
  soyad: string;
  cinsiyet: "E" | "K";
  ilKodu: string;
  /** Okul listede yoksa null; o zaman `beyanOkulAdi` dolu. */
  kurumKodu: number | null;
  beyanOkulAdi: string | null;
  /** Öğrencinin seçtiği okul türü; öğretmende null. */
  okulTuru: string | null;
  eposta: string;
  telefon: string;
  sinif: string | null;
  brans: string | null;
  egitimOgretimYili: string;
  sifre: string;
}

export type KayitKarari =
  | { olurMu: true; kayit: KayitKaydi }
  | { olurMu: false; neden: string };

export const AD_UST_SINIRI = 100;
export const BRANS_UST_SINIRI = 100;

/**
 * Ad ve soyad, e-Okul'daki yazıma yakın dursun diye Türkçe büyük harfe
 * çevrilmez; yalnızca fazla boşluk atılır. Kişinin yazdığı biçim korunur.
 */
export function adNormalle(deger: string): string {
  return deger.trim().replace(/\s+/g, " ");
}

/**
 * Sınıf seviyesi ve şubeden `kullanici.sinif` değerini kurar ("12-A").
 * Kayıt formu ile paneldeki "Genel bilgiler" aynı kuralı kullanır.
 */
export function sinifCoz(
  seviye: string,
  subeHam: string,
): { olurMu: true; sinif: string } | { olurMu: false; neden: string } {
  if (!(SINIF_SEVIYELERI as readonly string[]).includes(seviye)) {
    return { olurMu: false, neden: "Sınıfınızı seçin." };
  }
  /*
   * Şube İSTEĞE BAĞLI: bazı okullarda şube yok ya da öğrenci bilmiyor.
   * `kullanici.sinif` 10 karakter; "12-A" biçimi e-Okul'dakiyle aynı.
   */
  const sube = subeHam.trim().toLocaleUpperCase("tr-TR");
  if (sube && !/^[A-ZÇĞİÖŞÜ]{1,2}$/.test(sube)) {
    return { olurMu: false, neden: "Şube bir ya da iki harf olmalı (ör. A)." };
  }
  return { olurMu: true, sinif: sube ? `${seviye}-${sube}` : seviye };
}

/** `kurum.ad` sütunuyla aynı sınır. */
export const OKUL_ADI_UST_SINIRI = 250;

export type OkulSecimiKarari =
  | { olurMu: true; kurumKodu: number | null; beyanOkulAdi: string | null }
  | { olurMu: false; neden: string };

/**
 * Okul açılır listesinden gelen değeri çözer: ya bir kurum kodu ya da
 * "Okulum listede yok" ile yazılmış bir ad.
 */
export function okulSecimiCoz(
  kurumKoduHam: string,
  beyanOkulAdiHam: string,
): OkulSecimiKarari {
  const kurumMetni = kurumKoduHam.trim();
  if (kurumMetni === OKUL_LISTEDE_YOK) {
    const beyanOkulAdi = adNormalle(beyanOkulAdiHam);
    if (!beyanOkulAdi) {
      return { olurMu: false, neden: "Okulunuzun adını yazın." };
    }
    if (beyanOkulAdi.length > OKUL_ADI_UST_SINIRI) {
      return {
        olurMu: false,
        neden: `Okul adı en fazla ${OKUL_ADI_UST_SINIRI} karakter olabilir.`,
      };
    }
    return { olurMu: true, kurumKodu: null, beyanOkulAdi };
  }
  const kurumKodu = Number(kurumMetni);
  if (!/^[1-9][0-9]*$/.test(kurumMetni) || !Number.isSafeInteger(kurumKodu)) {
    return {
      olurMu: false,
      neden: 'Okulunuzu listeden seçin ya da "Okulum listede yok" seçeneğini kullanın.',
    };
  }
  return { olurMu: true, kurumKodu, beyanOkulAdi: null };
}

export function kayitGirdisiniCoz(
  girdi: KayitGirdisi,
  simdi: Date,
): KayitKarari {
  if (!kayitTipiMi(girdi.tip)) {
    return { olurMu: false, neden: "Öğrenci mi öğretmen mi olduğunuzu seçin." };
  }
  const tip = girdi.tip;

  const tcKimlikNo = tcKimlikNoNormalle(girdi.tcKimlikNo);
  if (!tcKimlikNoGecerliMi(tcKimlikNo)) {
    return { olurMu: false, neden: "T.C. kimlik numarası geçerli değil." };
  }

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

  let okulTuru: string | null = null;
  if (tip === "OGRENCI") {
    okulTuru = girdi.okulTuru.trim();
    if (!KAYIT_OKUL_TURLERI.includes(okulTuru)) {
      return { olurMu: false, neden: "Okul türünüzü seçin." };
    }
  }

  const okulKarari = okulSecimiCoz(girdi.kurumKodu, girdi.beyanOkulAdi);
  if (!okulKarari.olurMu) return okulKarari;
  const { kurumKodu, beyanOkulAdi } = okulKarari;

  /*
   * E-POSTA VE TELEFON ZORUNLU (23 Ekim 2026 · istek: "eposta telefon girişi de
   * alalım"). Profildeki iletişim alanlarına yazılır; kişi sonradan profilinden
   * değiştirebilir.
   */
  const eposta = epostaNormalle(girdi.eposta);
  if (!epostaGecerliMi(eposta)) {
    return { olurMu: false, neden: "E-posta adresi geçerli değil." };
  }
  const telefon = girdi.telefon.trim().replace(/\s+/g, " ");
  // Biçim gevşek (paydaş envanteriyle aynı); yine de en az 10 rakam aranır,
  // yoksa "+(-)./" gibi işaret dizileri geçerdi.
  if (!TELEFON_BICIMI.test(telefon) || telefon.replace(/\D/g, "").length < 10) {
    return { olurMu: false, neden: "Telefon numarası geçerli değil." };
  }

  let sinif: string | null = null;
  let brans: string | null = null;

  if (tip === "OGRENCI") {
    const sinifKarari = sinifCoz(girdi.sinifSeviyesi, girdi.sube);
    if (!sinifKarari.olurMu) return sinifKarari;
    sinif = sinifKarari.sinif;
  } else {
    brans = adNormalle(girdi.brans);
    if (!brans) {
      return { olurMu: false, neden: "Branşınızı yazın." };
    }
    if (brans.length > BRANS_UST_SINIRI) {
      return {
        olurMu: false,
        neden: `Branş en fazla ${BRANS_UST_SINIRI} karakter olabilir.`,
      };
    }
  }

  if (girdi.sifre !== girdi.sifreTekrar) {
    return { olurMu: false, neden: "Şifre ile tekrarı aynı değil." };
  }
  const sifreKarari = sifreKarariniVer(girdi.sifre, { ad, soyad, eposta });
  if (!sifreKarari.olurMu) {
    return { olurMu: false, neden: sifreKarari.neden };
  }
  // Şifre kimlik numarasını içeremez: numarayı bilen kişi sayısı az değil.
  if (girdi.sifre.includes(tcKimlikNo)) {
    return {
      olurMu: false,
      neden: "Şifre T.C. kimlik numaranızı içeremez.",
    };
  }

  return {
    olurMu: true,
    kayit: {
      tip,
      tcKimlikNo,
      ad,
      soyad,
      cinsiyet: girdi.cinsiyet,
      ilKodu,
      kurumKodu,
      beyanOkulAdi,
      okulTuru,
      eposta,
      telefon,
      sinif,
      brans,
      egitimOgretimYili: egitimOgretimYili(simdi),
      sifre: girdi.sifre,
    },
  };
}
