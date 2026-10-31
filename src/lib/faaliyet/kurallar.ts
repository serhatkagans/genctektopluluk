import type {
  BasvuruDurumu,
  EtkinlikKategorisi,
  FaaliyetDurumu,
  Kapsam,
  OnayDurumu,
  RolKodu,
  TemelEtkinlikGrubu,
} from "@/generated/prisma/enums";
import {
  danismanKurumKodu,
  danismanMi,
  disKullaniciMi,
  faaliyetOnayGerekiyorMu,
  ilKoordinatoruMu,
  koordinatorIlKodu,
  mezunMu,
  ogrenciMi,
  projeYoneticisiMi,
} from "../yetki/izinler";
import { girdiTarihi } from "../tarih";
import type { OturumKullanicisi } from "../yetki/tipler";

/**
 * Faaliyet iş kuralları — references/domain-rules.md Bölüm 5 ve 6.
 *
 * Saf tutulur: veritabanına gitmez, tarih üretmez (şimdiki zaman parametre
 * olarak alınır). Böylece "başvuru penceresi açık mı", "kontenjan doldu mu"
 * gibi kararlar birim testle sınanabilir.
 */

/** Dar kapsamdan geniş kapsama; ekranlardaki sıralama da budur. */
export const KAPSAMLAR: Kapsam[] = ["OKUL", "IL", "ULUSAL", "ULUSLARARASI"];

export const KAPSAM_ETIKETLERI: Record<Kapsam, string> = {
  OKUL: "Okul içi",
  IL: "İl geneli",
  ULUSAL: "Ulusal",
  ULUSLARARASI: "Uluslararası",
};

export const ONAY_DURUMU_ETIKETLERI: Record<OnayDurumu, string> = {
  ONAY_GEREKMEZ: "Yayında",
  BEKLIYOR: "Onay bekliyor",
  ONAYLANDI: "Onaylandı",
  REDDEDILDI: "Reddedildi",
};

export const BASVURU_DURUMU_ETIKETLERI: Record<BasvuruDurumu, string> = {
  BEKLIYOR: "Değerlendirmede",
  SECILDI: "Seçildi",
  YEDEK: "Yedek",
  REDDEDILDI: "Reddedildi",
  GERI_CEKILDI: "Geri çekildi",
  IPTAL_EDILDI: "Etkinlik iptal edildi",
};

export const FAALIYET_DURUMU_ETIKETLERI: Record<FaaliyetDurumu, string> = {
  AKTIF: "Aktif",
  IPTAL_EDILDI: "İptal edildi",
};

// ---------------------------------------------------------------------------
// Etkinlik kategorisi
// ---------------------------------------------------------------------------

/**
 * Etkinlik kategorisi KAPSAMDAN BAĞIMSIZDIR. Kapsam kimin başvurabileceğini
 * (okul / il / ulusal), kategori etkinliğin ne olduğunu söyler. Her kapsam her
 * kategoriyle birleşebilir; ikisini birbirine bağlamayın.
 */
export const ETKINLIK_KATEGORILERI: EtkinlikKategorisi[] = [
  "TEMEL_ETKINLIK",
  "CALISMA_GRUBU_ETKINLIGI",
  "IL_ETKINLIGI",
];

export const ETKINLIK_KATEGORISI_ETIKETLERI: Record<
  EtkinlikKategorisi,
  string
> = {
  TEMEL_ETKINLIK: "Temel Etkinlik",
  CALISMA_GRUBU_ETKINLIGI: "Çalışma Grubu Etkinliği",
  IL_ETKINLIGI: "İl Etkinliği",
};

export const ETKINLIK_KATEGORISI_ACIKLAMALARI: Record<
  EtkinlikKategorisi,
  string
> = {
  TEMEL_ETKINLIK:
    "GençTek'in ulusal düzeyde her yıl tekrarlanan programları. Adı sabit listeden seçilir.",
  CALISMA_GRUBU_ETKINLIGI:
    "Çalışma grubu öğrencilerinin yıl boyunca planlayıp yürüttüğü programlar. Adı sabit listeden seçilir.",
  IL_ETKINLIGI:
    "İl koordinatörlüğünün kendi iline özel tasarladığı temalı etkinlik. Adını siz belirlersiniz.",
};

/**
 * Adı sabit programların iki grubu.
 *
 * Değerleri EtkinlikKategorisi'nin ilk iki değeriyle aynıdır ve etiketleri de
 * oradan okunur (ETKINLIK_KATEGORISI_ETIKETLERI); ayrı bir etiket tablosu
 * açmak, iki listenin zamanla birbirinden ayrılması demekti.
 */
export const TEMEL_ETKINLIK_GRUPLARI: TemelEtkinlikGrubu[] = [
  "TEMEL_ETKINLIK",
  "CALISMA_GRUBU_ETKINLIGI",
];

/**
 * Kategorinin sabit program listesinden ad seçmesi gerekiyor mu?
 *
 * İl Etkinliği'nin referans listesi YOKTUR — faaliyetin ad alanı zaten temayı
 * taşır. Diğer iki kategoride ad serbest metin DEĞİLDİR, programdan gelir.
 */
export function programSecimiGerekiyorMu(
  kategori: EtkinlikKategorisi,
): boolean {
  return kategori !== "IL_ETKINLIGI";
}

/** Kategorinin karşılık geldiği referans tablosu grubu. */
export function kategoriProgramGrubu(
  kategori: EtkinlikKategorisi,
): TemelEtkinlikGrubu | null {
  return kategori === "IL_ETKINLIGI" ? null : kategori;
}

export interface EtkinlikKategorisiGirdisi {
  kategori: EtkinlikKategorisi;
  /** Seçilen programın grubu; program seçilmediyse null. */
  programGrubu: TemelEtkinlikGrubu | null;
  /** İl etkinliğinde zorunlu olan serbest faaliyet adı. */
  serbestAd: string | null;
}

/**
 * Kategori ile program eşleşmesini doğrular.
 *
 * Veritabanı kısıtı "program dolu mu / boş mu" sorusunu tutar ama programın
 * DOĞRU GRUPTAN olduğunu tutamaz (kısıt iki tabloya birden bakamaz), o kontrol
 * burada yapılır.
 */
export function etkinlikKategorisiDogrula(
  girdi: EtkinlikKategorisiGirdisi,
): { olurMu: boolean; neden?: string } {
  if (!programSecimiGerekiyorMu(girdi.kategori)) {
    if (!girdi.serbestAd) {
      return { olurMu: false, neden: "İl Etkinliği'nde ad alanı zorunludur." };
    }
    return { olurMu: true };
  }

  /*
   * "DİĞER" YOLU: program seçilmediyse ama faaliyetin adı yazıldıysa kayıt
   * geçerlidir. Eskiden Temel Etkinlik ve Çalışma Grubu Etkinliği'nde ad
   * ZORUNLU olarak listeden geliyordu; listede olmayan bir etkinlik açmak
   * isteyen kişi kategoriyi İl Etkinliği'ne çevirmek zorunda kalıyor ve
   * etkinliğin gerçek niteliğini kaybediyordu.
   *
   * Program seçildiğinde grup kontrolü aynen sürüyor: yanlış gruptan program
   * seçilemez.
   */
  if (girdi.programGrubu === null) {
    if (girdi.serbestAd) return { olurMu: true };
    return {
      olurMu: false,
      neden: `${ETKINLIK_KATEGORISI_ETIKETLERI[girdi.kategori]} için listeden bir program seçin ya da "Diğer" işaretleyip etkinlik adını yazın.`,
    };
  }

  if (girdi.programGrubu !== kategoriProgramGrubu(girdi.kategori)) {
    return {
      olurMu: false,
      neden: "Seçilen program bu etkinlik kategorisine ait değil.",
    };
  }

  return { olurMu: true };
}

/**
 * Kullanıcının açabileceği kapsamlar.
 *
 * ÖĞRETMEN HER KAPSAMDA (26 Ağustos 2026 · istek: "yeni etkinlik oluştururken
 * kapsam kısmında sadece okul içinde oluşturabiliyor, bunu il geneli, ulusal …
 * açabilsin — öğretmen için bunlar").
 *
 * Kural katmanı bunu ZATEN SÖYLÜYORDU: `faaliyetAcabilirMi` danışmana her
 * kapsamı açıyor ve `faaliyetOnayGerekiyorMu` 20 Ağustos 2026'dan beri okul
 * dışı kapsamları il koordinatörünün onayına gönderiyor. Ekranın açıklama
 * satırı da "öğretmen her kapsamda (okul dışı olanlar il koordinatörü
 * onayıyla)" diyordu. Geride kalan tek yer bu listeydi; öğretmen formda
 * yalnızca "Okul içi" görüyordu.
 *
 * YEĞİTEK'e okul
 * kapsamı SUNULMAZ: tek bir okulun faaliyetini o okulun sorumlusu açar, merkez
 * il ve ulusal düzeyde çalışır. Yetki matrisi (faaliyetAcabilirMi) merkeze okul
 * kapsamını da açık bırakır; burada yalnızca ekranda teklif edilenleri
 * belirliyoruz.
 *
 * Öğrenciye üç kapsam da açıktır çünkü hiçbiri kendiliğinden yayına girmez;
 * öğrencinin açtığı faaliyet her durumda onay bekler (bkz. onayDurumuBelirle).
 * Sıralama bilinçli olarak dar kapsamdan geniş kapsama: formda ilk seçenek
 * varsayılan olur ve öğrencinin olağan işi kendi okulundadır.
 *
 * MEZUN / PAYDAŞ / MENTÖR: il ve ulusal (7 Ağustos 2026 · "Etkinlik Bildir").
 * Okul kapsamı yok — kurum kodları olmadığı için "kendi okulu" diye bir yer
 * yok ve bir okulun içine etkinlik açmak o okulun sorumlusunun işidir.
 * Onları da onay koruyor: açtıkları hiçbir etkinlik doğrudan yayına girmez.
 */
export function kapsamSecenekleri(kullanici: OturumKullanicisi): Kapsam[] {
  if (projeYoneticisiMi(kullanici)) return ["IL", "ULUSAL", "ULUSLARARASI"];
  /*
   * ÖĞRETMEN VE KOORDİNATÖR DE ETKİNLİK AÇAMAZ (23 Ekim 2026 · istekler:
   * öğretmen ve koordinatör sayfalarında "Etkinlikler öğrencilerle aynı …
   * Yeni etkinlik, Belge oluştur, Etkinlik raporları pasif"). Etkinliği
   * proje yöneticisi açar; mezun/paydaş/mentör bildirimi (onaya düşen) sürüyor.
   */
  if (ilKoordinatoruMu(kullanici)) return [];
  /*
   * ÖĞRENCİ ETKİNLİK AÇAMAZ (23 Ekim 2026 · istek: "Öğrenci etkinlik açamaz,
   * düğme pasif olsun"). Liste boş döndüğü için form, kaydetme eylemi ve
   * "Yeni etkinlik" düğmesi birlikte kapanır; düğme etkinlikler ekranında
   * pasif olarak basılır. Öğrenci mevcut etkinliklere başvurur.
   */
  if (ogrenciMi(kullanici)) return [];
  if (disKullaniciMi(kullanici)) return ["IL", "ULUSAL", "ULUSLARARASI"];
  // Danışman öğretmen de açamaz (23 Ekim 2026; yukarıdaki nota bakın).
  return [];
}

export function faaliyetAcmaYetkisiVarMi(
  kullanici: OturumKullanicisi,
): boolean {
  return kapsamSecenekleri(kullanici).length > 0;
}

/**
 * İl koordinatörünün açtığı ulusal faaliyet ve öğrencinin açtığı HER faaliyet
 * onay bekler.
 */
export function onayDurumuBelirle(
  kullanici: OturumKullanicisi,
  kapsam: Kapsam,
): OnayDurumu {
  return faaliyetOnayGerekiyorMu(kullanici, kapsam)
    ? "BEKLIYOR"
    : "ONAY_GEREKMEZ";
}

export class FaaliyetKuralHatasi extends Error {
  constructor(mesaj: string) {
    super(mesaj);
    this.name = "FaaliyetKuralHatasi";
  }
}

export interface FaaliyetYeri {
  kurumKodu: number | null;
  ilKodu: string | null;
}

/**
 * Faaliyetin yer alanlarını kullanıcının kapsamından üretir.
 *
 * Yer bilgisi FORMDAN GELMEZ, roldan gelir: aksi halde bir danışman öğretmen
 * başka okulun adına, bir koordinatör başka ilin adına faaliyet açabilirdi.
 * Tek istisna, YEĞİTEK'in il faaliyeti açarken ili seçmesidir.
 *
 * Öğrenci de aynı kuralın içindedir: okul içi önerisi kendi okuluna, il geneli
 * önerisi kendi iline yazılır. Öğrencinin ili rolden değil kayıtlı ilinden gelir
 * çünkü öğrenci rolünün il kapsamı yoktur.
 */
export function faaliyetYeriBelirle(
  kullanici: OturumKullanicisi,
  kapsam: Kapsam,
  secilenIlKodu?: string | null,
): FaaliyetYeri {
  switch (kapsam) {
    case "OKUL": {
      const kurumKodu = danismanKurumKodu(kullanici) ?? kullanici.kurumKodu;
      if (kurumKodu === null) {
        throw new FaaliyetKuralHatasi(
          "Okul içi etkinlik için okul bilgisi olan bir görev gerekir.",
        );
      }
      return { kurumKodu, ilKodu: null };
    }
    case "IL": {
      const ilKodu = projeYoneticisiMi(kullanici)
        ? (secilenIlKodu ?? null)
        : (koordinatorIlKodu(kullanici) ?? kullanici.ilKodu);
      if (!ilKodu) {
        throw new FaaliyetKuralHatasi("İl geneli etkinlik için il seçilmeli.");
      }
      return { kurumKodu: null, ilKodu };
    }
    /*
     * ULUSAL VE ULUSLARARASI AYNI YERDE: ikisi de ne bir okula ne bir
     * ile bağlıdır (26 Ağustos 2026). Ayrımları yerde değil, kartta ve
     * raporlamada — bu yüzden ayrı bir kapsam değeri.
     */
    case "ULUSAL":
    case "ULUSLARARASI":
      return { kurumKodu: null, ilKodu: null };
  }
}

/**
 * Faaliyet kartında görünen "düzenleyen birim" metni.
 *
 * Birim KAPSAMDAN değil AÇANDAN türer. İl koordinatörünün açtığı ulusal
 * faaliyet de onun koordinatörlüğünün adıyla anılır: merkez onayladı diye
 * faaliyet merkeze mal edilmez, çünkü katılımcı "bunu kim düzenliyor" sorusunun
 * cevabını burada arar.
 */
export function duzenleyenBirimBelirle(
  kullanici: OturumKullanicisi,
  kapsam: Kapsam,
  adlar: { okulAdi?: string | null; ilAdi?: string | null },
): string {
  /*
   * Öğrenci girişimi kartta AÇIKÇA yazılır. Katılımcı "bunu kim düzenliyor"
   * sorusunun cevabını buradan okur ve öğrencilerin kurduğu bir etkinlik,
   * koordinatörlüğün açtığından farklı bir şeydir — okulun adıyla anılması
   * etkinliği okul yönetimine mal ederdi.
   */
  if (ogrenciMi(kullanici)) {
    const yer = kapsam === "OKUL" ? adlar.okulAdi : adlar.ilAdi;
    return yer ? `${yer} · Öğrenci girişimi` : "Öğrenci girişimi";
  }
  /*
   * DIŞ KULLANICININ ETKİNLİĞİ KOORDİNATÖRLÜĞE MAL EDİLMEZ (7 Ağustos 2026).
   *
   * Aşağıdaki kural "il kapsamı + koordinatör değilse İl Koordinatörlüğü"
   * diyor; bu satır olmasaydı bir paydaşın önerdiği etkinlik kartta "Ankara İl
   * Koordinatörlüğü" imzasıyla çıkardı. Katılımcı "bunu kim düzenliyor"
   * sorusunun cevabını burada arıyor — öğrenci girişimindeki gerekçenin aynısı.
   */
  if (disKullaniciMi(kullanici)) {
    const sifat = mezunMu(kullanici) ? "Mezun girişimi" : "Paydaş girişimi";
    return adlar.ilAdi ? `${adlar.ilAdi} · ${sifat}` : sifat;
  }
  if (kapsam === "OKUL") return adlar.okulAdi ?? "Okul";
  if (ilKoordinatoruMu(kullanici) || (kapsam === "IL" && !projeYoneticisiMi(kullanici))) {
    return adlar.ilAdi ? `${adlar.ilAdi} İl Koordinatörlüğü` : "İl Koordinatörlüğü";
  }
  // YEĞİTEK'in açtığı il faaliyeti de merkez adına düzenlenir.
  if (kapsam === "IL") {
    return adlar.ilAdi ? `MEB YEĞİTEK · ${adlar.ilAdi}` : "MEB YEĞİTEK";
  }
  return "MEB YEĞİTEK";
}

export type PencereDurumu = "ACILMADI" | "ACIK" | "KAPANDI";

export function basvuruPenceresi(
  faaliyet: { basvuruBaslangic: Date; basvuruBitis: Date },
  simdi: Date,
): PencereDurumu {
  if (simdi < faaliyet.basvuruBaslangic) return "ACILMADI";
  if (simdi > faaliyet.basvuruBitis) return "KAPANDI";
  return "ACIK";
}

/**
 * Kontenjanı dolduran başvuru durumları.
 *
 * Kontenjan yalnızca SEÇİLENLERİ değil TÜM AKTİF BAŞVURULARI sınırlar: red ve
 * geri çekme dışındaki her başvuru bir yer tutar. Reddedilen ya da geri çekilen
 * başvurunun yeri anında boşalır.
 */
export const AKTIF_BASVURU_DURUMLARI: BasvuruDurumu[] = [
  "BEKLIYOR",
  "SECILDI",
  "YEDEK",
];

export interface KontenjanDurumu {
  kontenjan: number;
  secilen: number;
  bekleyen: number;
  yedek: number;
  /** Yer tutan başvuru sayısı: BEKLIYOR + SECILDI + YEDEK. */
  aktifBasvuru: number;
  kalanYer: number;
  doluMu: boolean;
}

/**
 * Kontenjan durumu — CANLI hesaplanır, sayaç tutulmaz.
 *
 * Statik bir sayaç tutulsaydı red/geri çekme sonrası açılan yerler sistemde
 * "dolu" görünmeye devam ederdi. Her başvuru denemesinde aktif başvurular
 * yeniden sayılır.
 */
export function kontenjanDurumu(
  basvurular: { durum: BasvuruDurumu }[],
  kontenjan: number,
): KontenjanDurumu {
  const say = (durum: BasvuruDurumu) =>
    basvurular.filter((basvuru) => basvuru.durum === durum).length;

  const secilen = say("SECILDI");
  const bekleyen = say("BEKLIYOR");
  const yedek = say("YEDEK");
  const aktifBasvuru = secilen + bekleyen + yedek;

  return {
    kontenjan,
    secilen,
    bekleyen,
    yedek,
    aktifBasvuru,
    kalanYer: Math.max(kontenjan - aktifBasvuru, 0),
    doluMu: aktifBasvuru >= kontenjan,
  };
}

/**
 * Kontenjan bu değerin altına DÜŞÜRÜLEMEZ.
 *
 * Zaten seçilmiş öğrencilerin seçimini geri almak anlamına gelirdi; düzenleme
 * ekranı bunu engeller (ör. 40 kişi seçilmişse kontenjan 30 yapılamaz).
 */
export function kontenjanAltSiniri(durum: KontenjanDurumu): number {
  return Math.max(durum.secilen, 1);
}

export function kontenjanDegisikligiGecerliMi(
  yeniKontenjan: number,
  durum: KontenjanDurumu,
): { olurMu: boolean; neden?: string } {
  if (!Number.isInteger(yeniKontenjan) || yeniKontenjan < 1) {
    return { olurMu: false, neden: "Kontenjan en az 1 olmalıdır." };
  }
  if (yeniKontenjan < durum.secilen) {
    return {
      olurMu: false,
      neden: `Kontenjan seçilen öğrenci sayısının (${durum.secilen}) altına düşürülemez.`,
    };
  }
  return { olurMu: true };
}

/**
 * Öğrencinin başvurabilmesi için: faaliyet iptal edilmemiş ve yayında olmalı,
 * pencere açık olmalı, aktif bir başvurusu bulunmamalı ve kontenjan dolmamış
 * olmalı.
 *
 * KONTENJAN ARTIK İLK BAŞVURUYU DA ENGELLER. Kontenjan aktif başvuru sayısını
 * sınırlar (yedek dahil); dolduğunda sistem yeni başvuru kabul etmez. Bir
 * başvuru reddedilir veya geri çekilirse yer anında açılır — bu yüzden dolu
 * olup olmadığı her denemede yeniden sayılır, sayaç tutulmaz.
 */
export function basvuruYapilabilirMi(girdi: {
  pencere: PencereDurumu;
  onayDurumu: OnayDurumu;
  faaliyetDurumu?: FaaliyetDurumu;
  mevcutBasvuruDurumu?: BasvuruDurumu | null;
  kontenjanDoluMu?: boolean;
}): { olurMu: boolean; neden?: string } {
  if (girdi.faaliyetDurumu === "IPTAL_EDILDI") {
    return { olurMu: false, neden: "Bu etkinlik iptal edildi." };
  }
  if (girdi.onayDurumu === "BEKLIYOR") {
    return { olurMu: false, neden: "Etkinlik henüz onaylanmadı." };
  }
  if (girdi.onayDurumu === "REDDEDILDI") {
    return { olurMu: false, neden: "Etkinlik reddedildi." };
  }
  if (girdi.pencere === "ACILMADI") {
    return { olurMu: false, neden: "Başvurular henüz açılmadı." };
  }
  if (girdi.pencere === "KAPANDI") {
    return { olurMu: false, neden: "Başvuru süresi doldu." };
  }
  if (
    girdi.mevcutBasvuruDurumu &&
    girdi.mevcutBasvuruDurumu !== "GERI_CEKILDI" &&
    girdi.mevcutBasvuruDurumu !== "IPTAL_EDILDI"
  ) {
    return { olurMu: false, neden: "Bu etkinliğe zaten başvurdunuz." };
  }
  if (girdi.kontenjanDoluMu) {
    return {
      olurMu: false,
      neden: "Kontenjan doldu; bu etkinliğe yeni başvuru alınamıyor.",
    };
  }
  return { olurMu: true };
}

// ---------------------------------------------------------------------------
// Katılımcı tipi ve vekaleten başvuru
// ---------------------------------------------------------------------------

/**
 * Katılımcının öğrenci mi öğretmen mi olduğu VERİDE TUTULMAZ, aktif rolünden
 * okunur (bkz. prisma/schema.prisma · Basvuru). Kopyalanan bir tip alanı,
 * öğrenci mezun olduğunda ya da öğretmen görev değiştirdiğinde eskirdi.
 */
export type KatilimciTipi = "OGRENCI" | "OGRETMEN";

export const KATILIMCI_TIPI_ETIKETLERI: Record<KatilimciTipi, string> = {
  OGRENCI: "Öğrenci",
  OGRETMEN: "Öğretmen",
};

export function katilimciTipi(
  roller: readonly { rolKodu: RolKodu }[],
): KatilimciTipi {
  return roller.some((rol) => rol.rolKodu === "OGRENCI")
    ? "OGRENCI"
    : "OGRETMEN";
}

/**
 * Danışman öğretmen / il koordinatörü başkasının adına başvurabilir mi?
 *
 * Üç sınır var:
 *   1. Vekaleten başvuru YALNIZCA ÖĞRENCİ için yapılır. Analiz dokümanı 4.2
 *      bunu öğrenci adına başvuru olarak tanımlıyor; bir öğretmenin başka bir
 *      öğretmen adına başvurması, katılımın kişisel kararı olmasına aykırı.
 *   2. Kişi kendi adına "vekaleten" başvuramaz — o zaten normal başvurudur ve
 *      veritabanında da kısıtla (ck_basvuru_vekalet_baskasi) engellenir.
 *   3. Öğrencinin o faaliyete aktif başvurusu varsa ikincisi açılmaz; bu
 *      kontrol basvuruYapilabilirMi'de, mevcut başvuru durumu üzerinden yapılır.
 *
 * Kapsam kontrolü (öğrenci bu kişinin kapsamında mı) BURADA YOKTUR ve
 * çağıranın sorumluluğundadır: bu dosya veritabanına bakmaz.
 */
export function vekaletenBasvuruGecerliMi(girdi: {
  hedefTipi: KatilimciTipi;
  vekilKullaniciId: number;
  hedefKullaniciId: number;
}): { olurMu: boolean; neden?: string } {
  if (girdi.hedefTipi !== "OGRENCI") {
    return {
      olurMu: false,
      neden: "Adına başvuru yalnızca öğrenciler için yapılabilir.",
    };
  }
  if (girdi.vekilKullaniciId === girdi.hedefKullaniciId) {
    return {
      olurMu: false,
      neden: "Kendi adınıza başvuruyu doğrudan yapabilirsiniz.",
    };
  }
  return { olurMu: true };
}

/**
 * Ulusal faaliyete başvuran öğrencinin danışmanına kopya bildirim gider mi?
 *
 * Kural yalnızca BAŞKA İLDEN yapılan başvuruyu kapsar
 * (references/domain-rules.md Bölüm 8): danışmanın haberdar olması gereken şey,
 * öğrencisinin kendi ilinin dışındaki bir organizasyona katılacak olmasıdır.
 * Onay aranmaz, bildirim salt haber niteliğindedir.
 *
 * YEĞİTEK'in açtığı ulusal faaliyetin bir ili yoktur; öğrenci "dışarıya"
 * başvurmuş sayılmaz ve kopya gitmez. Aksi halde her merkezî etkinlikte
 * ülkedeki bütün danışmanlar bildirim yağmuruna tutulurdu.
 */
export function danismanaKopyaGerekiyorMu(girdi: {
  kapsam: Kapsam;
  ogrenciIlKodu: string | null;
  /** Faaliyeti düzenleyen birimin ili; merkez düzenlediyse null. */
  duzenleyenIlKodu: string | null;
}): boolean {
  /*
   * ULUSLARARASI DA KOPYA ÜRETİR (26 Ağustos 2026): kural "öğrenci kendi
   * ilinin dışındaki bir çağrıya başvurdu" diyor ve yurt dışı katılımı
   * olan etkinlik bunun en uç hâli. Kapsam ULUSAL diye sabitlenseydi yeni
   * değer sessizce kuralın dışında kalırdı.
   */
  if (girdi.kapsam !== "ULUSAL" && girdi.kapsam !== "ULUSLARARASI") {
    return false;
  }
  if (girdi.duzenleyenIlKodu === null) return false;
  return girdi.ogrenciIlKodu !== girdi.duzenleyenIlKodu;
}

/**
 * Başvuru "seçildi" yapılabilir mi?
 *
 * Kontenjan aktif başvuruyu zaten sınırladığı için seçilen sayısı normal akışta
 * kontenjanı aşamaz; bu kontrol kontenjanın sonradan düşürüldüğü ya da veri
 * elle değiştirildiği durumlar için savunma hattıdır. Yedek ve red sınırsızdır:
 * ikisi de yer TUTMAZ değil, tutulan yeri serbest bırakır ya da korur.
 */
export function degerlendirmeYapilabilirMi(
  yeniDurum: BasvuruDurumu,
  durum: KontenjanDurumu,
): { olurMu: boolean; neden?: string } {
  if (yeniDurum === "SECILDI" && durum.secilen >= durum.kontenjan) {
    return {
      olurMu: false,
      neden: `Kontenjan dolu (${durum.secilen}/${durum.kontenjan}). Öğrenciyi yedek listesine alabilirsiniz.`,
    };
  }
  if (yeniDurum === "GERI_CEKILDI") {
    return {
      olurMu: false,
      neden: "Başvuruyu yalnızca öğrencinin kendisi geri çekebilir.",
    };
  }
  if (yeniDurum === "IPTAL_EDILDI") {
    return {
      olurMu: false,
      neden:
        "Bu durum yalnızca etkinlik iptal edildiğinde sistem tarafından yazılır.",
    };
  }
  return { olurMu: true };
}

// ---------------------------------------------------------------------------
// Faaliyet düzenleme ve iptal
// ---------------------------------------------------------------------------

/**
 * Onaylanmış ulusal faaliyette KRİTİK alanların değişmesi onayı düşürür.
 *
 * Proje yöneticisi belli bir tarihe ve kapsama onay verdi; bunlar değişirse
 * onay artık başka bir faaliyete ait olur. Yalnızca kontenjan ARTIŞI istisnadır:
 * daha çok öğrenciye kapı açmak onayın konusunu değiştirmez.
 */
export function yenidenOnayGerekiyorMu(girdi: {
  onayDurumu: OnayDurumu;
  tarihDegistiMi: boolean;
  kontenjanAzaldiMi: boolean;
}): boolean {
  if (girdi.onayDurumu !== "ONAYLANDI") return false;
  return girdi.tarihDegistiMi || girdi.kontenjanAzaldiMi;
}

/** İptal edilmiş faaliyet yeni içerik (yorum, dosya) kabul etmez. */
export function faaliyetIcerikAlabilirMi(durum: FaaliyetDurumu): boolean {
  return durum === "AKTIF";
}

// ---------------------------------------------------------------------------
// Faaliyet süresi
// ---------------------------------------------------------------------------

/**
 * Çok günlü faaliyetlerin süresi.
 *
 * Süre ayrı bir SAYI OLARAK TUTULMAZ, iki tarihten hesaplanır. Sayı tutulsaydı
 * tarih değiştiğinde güncellenmesi unutulur ve ekranda tarihle çelişen bir süre
 * görünürdü — "3 gün sürecek" yazan ama iki tarihi arası iki ay olan faaliyet.
 *
 * Bitiş yoksa faaliyet tek günlüktür; bu bir eksik veri değil, olağan durumdur.
 */
export function faaliyetSuresiGecerliMi(
  tarih: Date,
  bitisTarihi: Date | null,
): { olurMu: boolean; neden?: string } {
  if (bitisTarihi === null) return { olurMu: true };
  if (bitisTarihi < tarih) {
    return {
      olurMu: false,
      neden: "Etkinlik bitişi başlangıcından önce olamaz.",
    };
  }
  return { olurMu: true };
}

/**
 * Faaliyetin kaç gün sürdüğü. Aynı gün başlayıp biten faaliyet 1 gündür.
 *
 * Hesap gün başlarına indirgenerek yapılır: 1 Mart 18:00 – 2 Mart 09:00 arası
 * 15 saattir ama iki ayrı gündür ve kullanıcı "2 gün" bekler. Saat farkıyla
 * bölmek bunu "1 gün" gösterirdi.
 */
export function faaliyetSuresiGun(
  tarih: Date,
  bitisTarihi: Date | null,
): number {
  if (bitisTarihi === null) return 1;
  // Gün Türkiye takvimine göre sayılır (31 Ekim 2026): sunucu UTC'de
  // çalıştığı için yerel saat getirileri gece yarısına yakın etkinliği bir
  // gün eksik sayıyordu.
  const gun = (t: Date) => Date.parse(`${girdiTarihi(t)}T00:00:00Z`);
  const fark = gun(bitisTarihi) - gun(tarih);
  if (fark <= 0) return 1;
  return Math.round(fark / 86_400_000) + 1;
}

/** Süreyi ekranda yazmak için: "1 gün", "3 gün", "2 ay 5 gün" değil — sade. */
export function faaliyetSuresiYaz(
  tarih: Date,
  bitisTarihi: Date | null,
): string {
  return `${faaliyetSuresiGun(tarih, bitisTarihi)} gün`;
}
