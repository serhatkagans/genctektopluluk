import type { OnayDurumu, TalepTuru } from "@/generated/prisma/enums";

/**
 * İletişim modülü kuralları — analiz isteği Bölüm 6.
 *
 * TEK CÜMLELİK TASARIM İLKESİ: gizli kanal yoktur.
 *
 * Yazışmalar, tarafların danışman öğretmenlerine, illerinin koordinatörlerine
 * ve proje yöneticilerine tam içerikle görünür. Kullanıcıların çoğu 18 yaş
 * altı; mahremiyet vaadi verilmiyor çünkü verilseydi tutulamazdı. Bu kural
 * ekranda kalıcı olarak yazılı ve aydınlatma metninde beyan edilmiş durumda —
 * gizli görünen ama okunan bir kanal, hiç olmamasından kötüdür.
 *
 * Saf tutulur: veritabanına ve oturuma bakmaz, birim testle kapsanır.
 */

const TALEP_BASLIK_MAKS = 200;
const TALEP_ICERIK_MAKS = 2000;
const ISTEK_MESAJ_MAKS = 1000;
const MESAJ_MAKS = 2000;

/**
 * PANODA GÖRÜNEN ONAY DURUMLARI (14 Ağustos 2026 · istek: "panodaki öğrenci
 * ilanları şimdilik proje yöneticilerine düşsün oradan onay versin").
 *
 * İKİ DEĞER, TEK ANLAM: `ONAY_GEREKMEZ` onaydan hiç geçmemiş ilandır (öğrenci
 * dışındakilerin açtıkları ve sütun eklenmeden önce açılmış olanlar),
 * `ONAYLANDI` ise geçmiş olandır. Panonun sorusu "onaylandı mı" değil "bugün
 * görünüyor mu" ve cevabı bu ikisidir.
 *
 * Liste sorgularında `where: { onayDurumu: { in: PANODA_GORUNEN_ONAY_DURUMLARI } }`
 * diye kullanılır; tek yerden okunuyor ki panoya bir ekran daha bakmaya
 * başladığında (mentör sayfası, bağlantı isteği) filtre unutulmasın.
 */
export const PANODA_GORUNEN_ONAY_DURUMLARI: OnayDurumu[] = [
  "ONAY_GEREKMEZ",
  "ONAYLANDI",
];

/**
 * İlanın panoda görünür olması için: kapatılmamış, süresi dolmamış ve onaydan
 * düşmemiş.
 *
 * ONAY 14 AĞUSTOS 2026'DA EKLENDİ. Kapanmış ilanla onay bekleyen ilan aynı
 * kapıdan geçiyor çünkü ikisinin de sonucu aynı: ilan panoda yok, üstünde
 * işlem yapılamaz. Cevap yazma ve bağlantı isteği bu yardımcıya bakıyor —
 * ayrı ayrı kontrol edilselerdi biri güncellenip diğeri unutulurdu.
 */
export function talepAktifMi(talep: {
  kapatildiMi: boolean;
  sonGecerlilik: Date;
  onayDurumu: OnayDurumu;
  simdi: Date;
}): boolean {
  if (talep.kapatildiMi) return false;
  if (!PANODA_GORUNEN_ONAY_DURUMLARI.includes(talep.onayDurumu)) return false;
  return talep.sonGecerlilik >= talep.simdi;
}

/**
 * Talep türleri.
 *
 * SABİT LİSTE, çalışma grupları gibi yönetim ekranından büyütülebilir değil:
 * her biri ekranda ayrı bir anlam taşıyor (sponsor ilanı ile ekip arkadaşı
 * ilanı aynı kitleye bakmıyor). Yeni bir tür enum'a eklenir — bu bir
 * migration'dır ve öyle olmalı: tür listesi büyüdüğünde kimin ne göreceği
 * yeniden düşünülmeli.
 *
 * 7 AĞUSTOS 2026 · istekteki dört başlık: "Destek Talebi / Mentöre sor /
 * Genel / Ekip Arkadaşı arama".
 *
 * - `MENTORE_SOR` **yeni tür**. `TEKNIK_DESTEK`'ten ayrı: o bir SORUNU
 *   çözdürmek için açılır ("kodum çalışmıyor"), bu bir YOL sorar ("hangi alana
 *   gitmeliyim"). Tek türde toplansalardı mentor arayan öğrenci teknik
 *   soruların arasında kaybolurdu.
 * - `TEKNIK_DESTEK` ve `DUYURU` **yalnızca etiket olarak** yeniden
 *   adlandırıldı ("Destek talebi", "Genel"). Enum değerleri korundu: etiket
 *   değişikliği için veri taşımak, geri alınması pahalı bir işi bedavaya
 *   yapmak olurdu.
 * - `SPONSOR` **kapatılmadı** — açılmış ilanları türsüz bırakmamak için
 *   listede duruyor. İstekteki dörtlüde yok ama var olan ilanların bir süzgeci
 *   olmalı.
 *
 * Sıra istekteki sırayla aynı; ekrandaki süzgeç ve seçim listesi bunu okur.
 */
/*
 * `GENEL` 14 AĞUSTOS 2026'DA EKLENDİ (istek: "kategoriler olsun, teknik destek
 * talebi, duyuru / tanıtım desteği, ekip arkadaşı arama ve genel şeklinde").
 *
 * `DUYURU`YU YENİDEN "Genel" YAPMAK YETMEZDİ: o değerin etiketi bir zamanlar
 * "Genel"di ve 11 Ağustos'ta "Duyuru / tanıtım desteği" oldu; istek ikisini
 * AYNI ANDA listeliyor, yani artık iki ayrı kategori. Etiket değiştirmek,
 * duyuru ilanlarını sessizce "genel" kutusuna taşımak olurdu.
 */
export const TALEP_TURLERI: TalepTuru[] = [
  "TEKNIK_DESTEK",
  "MENTORE_SOR",
  "DUYURU",
  "EKIP_ARKADASI",
  "GENEL",
  "SPONSOR",
];

/*
 * ETİKETLER 11 AĞUSTOS 2026'DA GÜNCELLENDİ (istek: "destek talebi - teknik
 * destek talebi olsun … duyuru tanıtım desteği açılsın").
 *
 * İkisi de yalnızca ETİKET değişikliği; enum değerleri korundu. "Destek
 * talebi" neyin desteği olduğunu söylemiyordu ve panoda mentör talebiyle
 * karışıyordu; "Genel" ise ilanın ne olduğunu hiç anlatmıyordu.
 */
export const TALEP_TURU_ETIKETLERI: Record<TalepTuru, string> = {
  TEKNIK_DESTEK: "Teknik destek talebi",
  MENTORE_SOR: "Mentöre sor",
  DUYURU: "Duyuru / tanıtım desteği",
  EKIP_ARKADASI: "Ekip arkadaşı arama",
  GENEL: "Genel",
  SPONSOR: "Sponsor",
};

/** Türü olmayan eski ilanlar için filtre ve rozet etiketi. */
export const TALEP_TURU_BELIRTILMEMIS = "Tür belirtilmemiş";

/**
 * PANODAN AÇILABİLEN TÜRLER (10 Ağustos 2026 · istek: panoda "alt alta iki
 * alan olacak … biri destek talebi aç diğeri mentör talebi aç").
 *
 * Ekranda tür seçimi kalmadı: iki ayrı form var ve türü form belirliyor. Gizli
 * form alanı kurcalanabilir bir alandır, o yüzden kapı sunucuda da duruyor —
 * ekrandan kaldırılan bir seçeneğin istekle geri gelebilmesi, kaldırılmamış
 * olması demektir.
 *
 * KALAN TÜRLER OKUNMAYA DEVAM EDER: ekip arkadaşı, genel ve sponsor ilanları
 * panoda listeleniyor, rozetleri basılıyor ve tür süzgecinde seçilebiliyor;
 * yalnızca YENİSİ açılamıyor. Bu ayrım bilinçli — açılmış ilanları görünmez
 * yapmak, sahiplerinin beklediği bağlantıyı sessizce keserdi.
 */
/*
 * 14 AĞUSTOS 2026 · istek: "talep oluştururken kategori olsun … teknik destek
 * talebi, duyuru / tanıtım desteği, ekip arkadaşı arama ve genel".
 *
 * TÜR SEÇİMİ GERİ GELDİ ama 10 Ağustos'taki hâline değil: o gün kalkan şey tek
 * formda "hangi türü seçmeliyim" kararıydı ve o karar hâlâ yok — mentör talebi
 * AYRI ekranda, türü sabit. Geri gelen, destek/duyuru formunun içindeki
 * KATEGORİ listesi (bkz. PANO_KATEGORILERI).
 */
export const PANODAN_ACILABILIR_TURLER: TalepTuru[] = [
  "TEKNIK_DESTEK",
  "MENTORE_SOR",
  "DUYURU",
  "EKIP_ARKADASI",
  "GENEL",
];

/**
 * Destek/duyuru formundaki KATEGORİ listesi (14 Ağustos 2026).
 *
 * `MENTORE_SOR` burada YOK: mentör talebinin kendi ekranı ve kendi mentör
 * havuzu var, kategori listesine konsaydı aynı ilan iki ayrı kapıdan
 * açılabilirdi. `SPONSOR` da yok — 11 Ağustos'ta kaldırılmıştı, açılmış
 * ilanları listede durmaya devam ediyor.
 *
 * SÜZGEÇ LİSTESİYLE AYNI DÖRTLÜ (bkz. SUZGEC_TURLERI): istek ikisini tek
 * cümlede söylüyor ("pano daki arama kutusundaki kategoriler olsun"), yani
 * kullanıcı ne açabiliyorsa ona göre süzebiliyor.
 */
export const PANO_KATEGORILERI: TalepTuru[] = [
  "TEKNIK_DESTEK",
  "DUYURU",
  "EKIP_ARKADASI",
  "GENEL",
];

/**
 * TÜR SÜZGECİNDE GÖSTERİLEN türler (11 Ağustos 2026 · istek: "Talep türü
 * sponsoru kaldıralım").
 *
 * `TALEP_TURLERI`DEN AYRI BİR LİSTE ve ayrılığın sebebi şu: o liste enum'un
 * TAMAMIDIR ve iki işi daha var — `talepTuruGecerliMi` doğrulaması ile rozet
 * etiketlerinin kaynağı. Sponsor oradan silinseydi, açılmış sponsor ilanları
 * "geçersiz tür" sayılır ve panodaki rozetleri bozulurdu; oysa istek yalnızca
 * SÜZGEÇTEN kaldırmak.
 *
 * SPONSOR İLANLARI PANODA DURMAYA DEVAM EDER — listede görünür, rozeti basılır.
 * Kaybolan tek şey, o türe göre süzme seçeneği. Açılmış ilanları görünmez
 * yapmak, sahiplerinin beklediği bağlantıyı sessizce keserdi (aynı gerekçe
 * PANODAN_ACILABILIR_TURLER notunda da var).
 */
/*
 * MENTÖRE SOR DA SÜZGEÇTEN KALKTI (11 Ağustos 2026 · istek: "panodan arama
 * kısmında … mentöre sor kalksın"). Sponsorla aynı ilke: tür ENUM'da duruyor,
 * ilanı açılmaya devam ediyor ve panoda rozetiyle listeleniyor — kaybolan tek
 * şey o türe göre süzme seçeneği.
 */
/*
 * 14 Ağustos 2026'DA LİSTE İSTENEN DÖRTLÜYE OTURDU: enum'a `GENEL` eklenince
 * bu iki çıkarmadan geriye tam olarak istekteki kategoriler kalıyor (teknik
 * destek talebi, duyuru / tanıtım desteği, ekip arkadaşı arama, genel). Süzgeç
 * yine ÇIKARARAK kuruluyor, elle sayarak değil: enum'a yeni bir tür
 * eklendiğinde süzgeçte kendiliğinden görünmesi doğru varsayılan.
 */
const SUZGECTEN_CIKARILANLAR: TalepTuru[] = ["SPONSOR", "MENTORE_SOR"];

export const SUZGEC_TURLERI: TalepTuru[] = TALEP_TURLERI.filter(
  (tur) => !SUZGECTEN_CIKARILANLAR.includes(tur),
);

export function talepTuruGecerliMi(deger: string): deger is TalepTuru {
  return (TALEP_TURLERI as string[]).includes(deger);
}

export interface TalepGirdisi {
  baslik: string;
  icerik: string;
  sonGecerlilik: Date | null;
  tur: string | null;
}

export type TalepKarari =
  | {
      olurMu: true;
      baslik: string;
      icerik: string;
      sonGecerlilik: Date;
      tur: TalepTuru;
    }
  | { olurMu: false; neden: string };

/** Panoya ilan açarken en fazla ileri gidilebilecek gün sayısı. */
export const TALEP_AZAMI_GUN = 180;

/**
 * İlan girdisini çözer; yeni ilanda da DÜZENLEMEDE de aynı kapı.
 *
 * `izinliTurler` VARSAYILANDAN AYRILABİLİYOR (14 Ağustos 2026 · düzenleme
 * yetkisi): açılmış eski bir ilan artık açılamayan bir türde olabilir (sponsor,
 * mentöre sor). Düzenleme o ilanın KENDİ türünü listeye ekleyerek çağırıyor —
 * aksi hâlde tek bir yazım hatasını düzeltmek, ilanın türünü değiştirmeye
 * zorlardı.
 */
export function talebiCoz(
  girdi: TalepGirdisi,
  simdi: Date,
  izinliTurler: TalepTuru[] = PANODAN_ACILABILIR_TURLER,
): TalepKarari {
  const baslik = girdi.baslik.trim();
  const icerik = girdi.icerik.trim();

  /*
   * TÜR YENİ İLANLARDA ZORUNLU (6 Ağustos 2026). Sütun NULL kabul etmeye devam
   * ediyor ve eski ilanlar geriye dönük DOLDURULMADI: türü bilinmeyen bir ilana
   * "duyuru" demek, filtrelenen listeyi sessizce yanlışlardı. Kural yalnızca bu
   * kapıdan geçen yeni ilana uygulanır.
   */
  const ham = (girdi.tur ?? "").trim();
  if (!ham) return { olurMu: false, neden: "Talep türü seçilmelidir." };
  if (!talepTuruGecerliMi(ham)) {
    return { olurMu: false, neden: "Talep türü anlaşılamadı." };
  }
  const tur: TalepTuru = ham;
  /*
   * Kategori ekrandaki seçim listesinden geliyor (destek/duyuru formu) ya da
   * gizli alandan (mentör talebi). İkisi de kurcalanabilir alanlardır; kapı bu
   * yüzden sunucuda duruyor — ekrandan kaldırılmış bir seçeneğin istekle geri
   * gelebilmesi, kaldırılmamış olması demektir.
   */
  if (!izinliTurler.includes(tur)) {
    return {
      olurMu: false,
      neden: "Bu kategoride ilan açılamaz.",
    };
  }

  if (!baslik) return { olurMu: false, neden: "İlan başlığı boş bırakılamaz." };
  if (baslik.length > TALEP_BASLIK_MAKS) {
    return {
      olurMu: false,
      neden: `Başlık en fazla ${TALEP_BASLIK_MAKS} karakter olabilir.`,
    };
  }
  if (!icerik) return { olurMu: false, neden: "İlan metni boş bırakılamaz." };
  if (icerik.length > TALEP_ICERIK_MAKS) {
    return {
      olurMu: false,
      neden: `İlan metni en fazla ${TALEP_ICERIK_MAKS} karakter olabilir.`,
    };
  }

  if (girdi.sonGecerlilik === null) {
    return { olurMu: false, neden: "Son geçerlilik tarihi seçilmelidir." };
  }
  if (girdi.sonGecerlilik <= simdi) {
    return {
      olurMu: false,
      neden: "Son geçerlilik tarihi bugünden sonra olmalıdır.",
    };
  }

  /*
   * Üst sınır var çünkü sınırsız ilan pano çürümesi demek: iki yıl önce
   * açılmış, sahibi mezun olmuş bir ilan listede durmaya devam ederdi.
   */
  const azami = new Date(simdi.getTime() + TALEP_AZAMI_GUN * 86_400_000);
  if (girdi.sonGecerlilik > azami) {
    return {
      olurMu: false,
      neden: `Son geçerlilik en fazla ${TALEP_AZAMI_GUN} gün sonrası olabilir.`,
    };
  }

  return {
    olurMu: true,
    baslik,
    icerik,
    sonGecerlilik: girdi.sonGecerlilik,
    tur,
  };
}

/**
 * Bağlantı isteği gönderilebilir mi?
 *
 * Kendine istek gönderilemez ve aynı kişiye ikinci bir BEKLEYEN istek
 * açılamaz — reddedilen bir isteği tekrar tekrar göndermek taciz aracına
 * dönüşürdü. Karara bağlanmış istek geçmişte kalır, yenisi açılabilir.
 */
export function baglantiIstegiGonderilebilirMi(girdi: {
  isteyenId: number;
  hedefId: number;
  bekleyenIstekVarMi: boolean;
  onayliBaglantiVarMi: boolean;
}): { olurMu: boolean; neden?: string } {
  if (girdi.isteyenId === girdi.hedefId) {
    return { olurMu: false, neden: "Kendinize bağlantı isteği gönderemezsiniz." };
  }
  if (girdi.onayliBaglantiVarMi) {
    return {
      olurMu: false,
      neden: "Bu kişiyle zaten bir yazışmanız var.",
    };
  }
  if (girdi.bekleyenIstekVarMi) {
    return {
      olurMu: false,
      neden: "Bu kişiye gönderdiğiniz bir istek zaten onay bekliyor.",
    };
  }
  return { olurMu: true };
}

/**
 * ONAY GEREKTİRMEYEN YAZIŞMA (21 Ağustos 2026 · istek: "Bağlantılarım kısmı
 * değişecek, kendi okulundaki herkesi görecek mesaj atacak, okul
 * temsilcilerinin hepsini görecek mesaj atabilecek").
 *
 * Kural şuraya kadar değişmedi: birebir yazışma, danışman öğretmenin ya da il
 * koordinatörünün onayından geçen bir bağlantıyla açılır. Bu fonksiyon iki
 * İSTİSNA tanımlıyor ve ikisinin de ortak gerekçesi, tarafların BİRBİRİNİ
 * ZATEN TANIYOR OLMASI:
 *
 *   · AYNI OKUL — aynı binadaki iki kişinin konuşmak için onay beklemesi,
 *     sistemin dışında zaten var olan bir teması sistem içinde yasaklamaktı.
 *   · OKUL TEMSİLCİSİ — görevi tam olarak "kendisine ulaşılabilmesi"dir;
 *     temsilciye yazmak için onay istemek, görevi işlevsiz bırakıyordu.
 *   · AYNI EKİP (31 Ağustos 2026 · istek: "Ekibindeki herkesi görsün
 *     tıklanınca ve bireysel ve toplu mesaj atabilsin ekiptekilere") — ekip
 *     zaten onaysız bir yazışma kanalıdır: üyeler ekip sohbetinde birbirlerine
 *     yazıyor (bkz. lib/ekip/kurallar.ts · ekipSohbetineYazabilirMi) ve o
 *     kanalı açan karar, ilin koordinatörünün kişileri aynı ekibe koymuş
 *     olmasıdır. Toplu kanalı açık olan iki kişiye birebir yazışmayı
 *     yasaklamak, aynı iki kişiyi aynı odada tutup fısıldaşmalarını yasaklamak
 *     gibiydi — üstelik ikisi de aynı gözetime tabi.
 *
 * GÖZETİM DEĞİŞMEDİ: bu yolla açılan yazışmayı da danışman öğretmen, il
 * koordinatörü ve proje yöneticisi okuyabiliyor (bkz. yazismaKapsamFiltresi).
 * Kalkan onay kapısıdır, denetim değil.
 *
 * Dış kullanıcının (mezun, paydaş) kurum kodu YOKTUR: iki tarafın da kodu
 * dolu ve eşit olmalı, yoksa "okulsuz" iki kişi aynı okuldan sayılırdı.
 */
export function dogrudanYazisilabilirMi(girdi: {
  isteyenId: number;
  hedefId: number;
  isteyenKurumKodu: number | null;
  hedefKurumKodu: number | null;
  /** Hedef, yürürlükteki dönemde okul temsilcisi mi? */
  hedefOkulTemsilcisiMi: boolean;
  /**
   * İki taraf AÇIK bir ekipte birlikte mi (ya da isteyen o ekibi yönetiyor mu)?
   *
   * İSTEĞE BAĞLI ALAN ve varsayılanı `false`: kararı soran her çağıran ekip
   * bağını hesaplamak zorunda değil — panodaki kişi listesi gibi ekiplerle
   * hiç ilgilenmeyen yollar eskisi gibi çalışıyor. Bilgiyi VERMEYEN çağıran
   * dar tarafta kalıyor, geniş tarafta değil.
   */
  ayniEkiptenMi?: boolean;
  /**
   * İsteyen dış kullanıcı (mezun, paydaş) mı? ZORUNLU alan.
   *
   * DIŞ KULLANICIYA OKUL TEMSİLCİSİ KISAYOLU YOK (6 Kasım 2026 · güvenlik
   * incelemesi). İstisnaların gerekçesi "taraflar birbirini zaten tanıyor";
   * okul temsilcisi bir öğrencidir ve çoğu reşit değildir, ülkedeki her
   * mezunun ya da paydaşın onu tanıdığı varsayılamaz. Kısayol açıkken bir dış
   * kullanıcı 81 ildeki bütün okul temsilcileriyle onaysız yazışma
   * açabiliyordu. Dış kullanıcı panodan bağlantı isteği gönderir; aynı ekipte
   * olduğu kişilerle (ekip sohbetinde zaten yazışıyorlar) doğrudan yazışır.
   */
  isteyenDisKullaniciMi: boolean;
}): { olurMu: boolean; neden?: string } {
  if (girdi.isteyenId === girdi.hedefId) {
    return { olurMu: false, neden: "Kendinize mesaj gönderemezsiniz." };
  }

  const ayniOkul =
    girdi.isteyenKurumKodu !== null &&
    girdi.isteyenKurumKodu === girdi.hedefKurumKodu;
  const temsilciKisayolu = girdi.hedefOkulTemsilcisiMi && !girdi.isteyenDisKullaniciMi;

  if (ayniOkul || temsilciKisayolu || girdi.ayniEkiptenMi === true) {
    return { olurMu: true };
  }

  return {
    olurMu: false,
    neden:
      "Bu kişiyle doğrudan yazışamazsınız; panodan bağlantı isteği gönderin.",
  };
}

export interface IstekKarari {
  onaylandiMi: boolean;
  gerekce: string;
}

export type IstekSonucu =
  | { olurMu: true; durum: OnayDurumu; gerekce: string | null }
  | { olurMu: false; neden: string };

/**
 * Bağlantı isteğine verilen karar.
 *
 * Ret gerekçesi zorunlu: öğrenci neden bağlanamadığını öğrenmeli. Onayda
 * söylenecek bir şey yok.
 */
export function istekKarariniCoz(karar: IstekKarari): IstekSonucu {
  const gerekce = karar.gerekce.trim();
  if (karar.onaylandiMi) {
    return { olurMu: true, durum: "ONAYLANDI", gerekce: gerekce || null };
  }
  if (!gerekce) {
    return {
      olurMu: false,
      neden: "Ret gerekçesi zorunludur: öğrenci nedenini görmeli.",
    };
  }
  return { olurMu: true, durum: "REDDEDILDI", gerekce };
}

/**
 * PANO İLANININ ONAY/RET KARARI (14 Ağustos 2026).
 *
 * `istekKarariniCoz` ile AYNI KURAL, yeni bir kopya değil: onayda gerekçe
 * isteğe bağlı, redde zorunlu. İki ayrı işlev yazılsaydı, "ret gerekçesi
 * zorunlu mudur" sorusunun sistemde iki cevabı olurdu ve biri zamanla
 * yumuşardı. Ad ayrı çünkü çağıran ekran bağlantı isteğine değil ilana bakıyor.
 */
export const ilanKarariniCoz = istekKarariniCoz;

/**
 * İlan sahibinin "Açık ilanlarım" listesinde okuduğu durum etiketi.
 *
 * `ONAY_GEREKMEZ` ETİKETSİZDİR (null): onaydan hiç geçmemiş ilan yayımdadır ve
 * ona "onay gerekmez" rozeti basmak, olmayan bir süreci varmış gibi gösterirdi.
 */
export const PANO_ILANI_DURUM_ETIKETLERI: Record<OnayDurumu, string | null> = {
  ONAY_GEREKMEZ: null,
  BEKLIYOR: "Onay bekliyor",
  ONAYLANDI: "Onaylandı",
  REDDEDILDI: "Reddedildi",
};

/**
 * Yazışmaya mesaj yazılabilir mi?
 *
 * İKİ DURUM YAZDIRIR: onaydan geçmiş bağlantı (`ONAYLANDI`) ve onay
 * gerektirmeyen doğrudan yazışma (`ONAY_GEREKMEZ` — okul içi ve okul
 * temsilcileri). İkincisi 26 Ağustos 2026'da eklendi; o güne kadar doğrudan
 * yazışma kaydı "onaylandı" diye açılmaya çalışılıyor ve veritabanı kısıtına
 * takılıyordu (bkz. baglanti-eylemleri.ts).
 */
export function mesajYazilabilirMi(girdi: {
  onayDurumu: OnayDurumu;
  yazismaKapatildiMi: boolean;
}): { olurMu: boolean; neden?: string } {
  if (girdi.onayDurumu !== "ONAYLANDI" && girdi.onayDurumu !== "ONAY_GEREKMEZ") {
    return { olurMu: false, neden: "Bu bağlantı onaylanmadı." };
  }
  if (girdi.yazismaKapatildiMi) {
    return {
      olurMu: false,
      neden: "Bu yazışma kapatıldı; yeni mesaj yazılamaz.",
    };
  }
  return { olurMu: true };
}

export function mesajMetniniCoz(
  metin: string,
): { olurMu: true; icerik: string } | { olurMu: false; neden: string } {
  const icerik = metin.trim();
  if (!icerik) return { olurMu: false, neden: "Mesaj boş olamaz." };
  if (icerik.length > MESAJ_MAKS) {
    return {
      olurMu: false,
      neden: `Mesaj en fazla ${MESAJ_MAKS} karakter olabilir.`,
    };
  }
  return { olurMu: true, icerik };
}

/**
 * Panodaki ilana yazılan CEVAP metni (13 Ağustos 2026 · mentör sayfası).
 *
 * Sınır mesajlarla aynı (`MESAJ_MAKS`): cevap da bir metin kutusudur ve
 * mentörden kısa, okunabilir bir yanıt bekleniyor. Ayrı bir sabit tanımlamak,
 * iki sınırın zamanla ayrışmasına ve "hangi kutuda ne kadar yazabiliyorum"
 * sorusuna yol açardı.
 */
export function cevapMetniniCoz(
  metin: string,
): { olurMu: true; icerik: string } | { olurMu: false; neden: string } {
  const icerik = metin.trim();
  if (!icerik) return { olurMu: false, neden: "Cevap boş olamaz." };
  if (icerik.length > MESAJ_MAKS) {
    return {
      olurMu: false,
      neden: `Cevap en fazla ${MESAJ_MAKS} karakter olabilir.`,
    };
  }
  return { olurMu: true, icerik };
}

export function istekMesajiniCoz(
  metin: string,
): { olurMu: true; mesaj: string } | { olurMu: false; neden: string } {
  const mesaj = metin.trim();
  if (!mesaj) {
    return {
      olurMu: false,
      neden: "Kendinizi tanıtan bir mesaj yazın; istek buna göre değerlendirilir.",
    };
  }
  if (mesaj.length > ISTEK_MESAJ_MAKS) {
    return {
      olurMu: false,
      neden: `Mesaj en fazla ${ISTEK_MESAJ_MAKS} karakter olabilir.`,
    };
  }
  return { olurMu: true, mesaj };
}

/**
 * Ekranda kalıcı olarak gösterilecek uyarı.
 *
 * Sabit olarak burada duruyor ki her ekranda aynı cümle çıksın; farklı
 * yerlerde farklı ifadelerle yazılsaydı bazıları zamanla yumuşar ve
 * "aslında kimse okumuyor" izlenimi doğardı.
 */
export const GIZLILIK_UYARISI =
  "Bu sistemdeki yazışmalar gizli değildir. Mesajlarınızı danışman öğretmeniniz, il koordinatörünüz ve proje yöneticileri okuyabilir.";
