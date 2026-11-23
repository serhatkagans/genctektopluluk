/**
 * PROJE İLERLEME DURUMU — yol haritası verisi ve saf kuralları (3 Eylül 2026).
 *
 * ---------------------------------------------------------------------------
 * NİYE VAR
 * ---------------------------------------------------------------------------
 * Sistemde ne yapıldığının tarih tarih kaydı bugüne kadar YALNIZCA git
 * geçmişindeydi. Orası doğru kaynak ama proje yöneticisinin eline geçmiyor:
 * commit listesini okumak için depoya erişmek, başlıkları teknik bağlamıyla
 * eşleştirmek ve "bu sunucuda çalışıyor mu" sorusunu ayrıca sormak gerekiyor.
 * Bu ekran o üç işi tek listeye indiriyor.
 *
 * ---------------------------------------------------------------------------
 * DURUM ELLE TUTULUR, ÜRETİLMEZ
 * ---------------------------------------------------------------------------
 * Maddelerin durumu git'ten TÜRETİLEMEZ ve türetilmeye çalışılmamalı:
 * commit'lenmiş olmak yayında olmak değildir. Sunucuya yayın ayrı bir komutla
 * (`dagitim/guncelle.sh`) elle yapılıyor; bir işin sunucuda koşup koşmadığını
 * depo bilmiyor. `TESTTE` tam olarak bu aralığı anlatıyor: kod hazır ve
 * denendi, sunucuda henüz yok.
 *
 * Bu yüzden dosya elle güncellenir. Bir madde yayına çıktığında durumu
 * `YAYINDA` yapılır ve `yayinTarihi` yazılır — `bitis` işin bittiği,
 * `yayinTarihi` sunucuya çıktığı gündür; ikisi aynı gün olmak zorunda değil.
 *
 * ---------------------------------------------------------------------------
 * TARİHLER Date DEĞİL, DÜZ METİN
 * ---------------------------------------------------------------------------
 * Tarihler `Date` olarak tutulsaydı takvim günü saat dilimine göre kayardı:
 * `new Date("2026-07-30")` UTC gece yarısıdır ve sunucunun dilimi UTC iken bir
 * gün geriye düşen biçimlendirmeler bu projede zaten yaşandı (bkz.
 * lib/tarih.ts). Burada saat bilgisi hiç yok — yalnızca takvim günü var — bu
 * yüzden metin olarak tutulup metin olarak biçimlendiriliyor.
 */

export type IlerlemeDurumu =
  | "PLANLANDI"
  | "TASARIMDA"
  | "GELISTIRILIYOR"
  | "TESTTE"
  | "YAYINDA";

/** Özet şeridinin ve rozetlerin sırası: en erken aşamadan yayına. */
export const DURUM_SIRASI: readonly IlerlemeDurumu[] = [
  "PLANLANDI",
  "TASARIMDA",
  "GELISTIRILIYOR",
  "TESTTE",
  "YAYINDA",
];

export const DURUM_ETIKETI: Record<IlerlemeDurumu, string> = {
  PLANLANDI: "Planlandı",
  TASARIMDA: "Tasarımda",
  GELISTIRILIYOR: "Geliştiriliyor",
  TESTTE: "Testte",
  YAYINDA: "Yayında",
};

/**
 * Genel ilerlemede bir maddenin ağırlığı.
 *
 * İLERLEME "BİTEN MADDE / TOPLAM MADDE" DEĞİL. Öyle olsaydı testteki üç
 * madde, hiç başlanmamış bir maddeyle aynı sayılırdı; oysa aralarındaki fark
 * işin neredeyse tamamı. Ara aşamalar eşit basamaklarla puanlanıyor: bir madde
 * her aşama atladığında yüzde aynı miktarda artıyor.
 */
export const DURUM_AGIRLIGI: Record<IlerlemeDurumu, number> = {
  PLANLANDI: 0,
  TASARIMDA: 0.25,
  GELISTIRILIYOR: 0.5,
  TESTTE: 0.75,
  YAYINDA: 1,
};

/**
 * Rozet rengi. Renk sözlüğü panelin geri kalanıyla aynı: `olumlu` biten iş,
 * `uyari` üstünde çalışılan iş, `notr` henüz başlanmamış iş.
 *
 * `hata` KULLANILMIYOR: hiçbir madde arızalı değil, en fazla beklemede.
 * Kırmızı rozet, ertelenmiş bir işi bozuk bir işten ayırt edilemez kılardı.
 */
export const DURUM_ROZETI: Record<
  IlerlemeDurumu,
  "notr" | "olumlu" | "uyari" | "vurgu"
> = {
  PLANLANDI: "notr",
  TASARIMDA: "notr",
  GELISTIRILIYOR: "uyari",
  TESTTE: "vurgu",
  YAYINDA: "olumlu",
};

export type YolHaritasiMaddesi = {
  /** Ekranda basılan sıra numarası; listedeki yerinden bağımsız sabit kalır. */
  sira: number;
  baslik: string;
  durum: IlerlemeDurumu;
  /** Tek cümlelik ne olduğu — madde listesinin üstünde durur. */
  ozet: string;
  /** İşin başladığı takvim günü, `YYYY-AA-GG`. */
  baslangic: string;
  /** İş birden çok güne yayıldıysa son gün. Tek günlük işlerde verilmez. */
  bitis?: string;
  /**
   * Sunucuya çıktığı gün. YAYINDA olmayan maddede bulunmaz; YAYINDA olup da
   * yazılmamışsa yayın günü kayıt altına alınmamış demektir.
   */
  yayinTarihi?: string;
  /** Maddenin kapsamı — ekranda madde madde basılır. */
  maddeler: string[];
  /** İz sürmek için ilgili commit'ler; ekranda basılmaz, kaynak notudur. */
  commitler?: string[];
  /** Durum neden bu — özellikle YAYINDA olmayan maddelerde şart. */
  not?: string;
};

/**
 * GENÇTEK YOL HARİTASI.
 *
 * Sıra KRONOLOJİK, öncelik sırası değil: liste "ne zaman ne yapıldı"yı
 * anlatıyor, "önce hangisi yapılmalı"yı değil. Bitmemiş işler bu yüzden
 * listenin sonunda toplanıyor — başa da alınabilirlerdi ama o zaman ekran bir
 * yapılacaklar listesine dönüşür ve yapılanların tarih tarih dökümü olma işini
 * kaybederdi.
 */
export const YOL_HARITASI: readonly YolHaritasiMaddesi[] = [
  {
    sira: 1,
    baslik: "Çekirdek sistem ve veri modeli",
    durum: "YAYINDA",
    ozet:
      "GençTek Bilgi Sistemi'nin ilk sürümü: roller, kapsam yetkileri ve temel envanterler ayağa kalktı.",
    baslangic: "2026-07-30",
    yayinTarihi: "2026-07-30",
    maddeler: [
      "Öğrenci, danışman öğretmen, il koordinatörü ve merkez rolleri",
      "Kapsam filtresi fail-closed kuruldu: yetkisi olmayan kayıt hiç sorgulanmıyor",
      "Prisma şeması, migrasyonlar ve başlangıç verisi",
      "Panel, giriş ve profil ekranlarının ilk hâli",
    ],
    commitler: ["578d074"],
  },
  {
    sira: 2,
    baslik: "Paydaş envanteri ve SMS bildirim kanalı",
    durum: "YAYINDA",
    ozet:
      "Paydaş temsilcileri sisteme girdi; bildirimler e-postanın yanında SMS ile de gidebiliyor.",
    baslangic: "2026-07-31",
    yayinTarihi: "2026-07-31",
    maddeler: [
      "Paydaş kurumu ve temsilci envanteri",
      "Katılımcı temelli etkinlik başvurusu",
      "SMS bildirim kanalı ve şablonları",
    ],
    commitler: ["5370f2c"],
  },
  {
    sira: 3,
    baslik: "İl koordinatörü rapor modülü",
    durum: "YAYINDA",
    ozet:
      "İl koordinatörü kendi ilinin faaliyet raporunu üretiyor; öğretmen faaliyetlerini onaylıyor.",
    baslangic: "2026-07-31",
    yayinTarihi: "2026-07-31",
    maddeler: [
      "Faaliyet raporu sayfası ve gizlilik taahhütnamesi",
      "Öğretmen faaliyet onayı",
      "İl dışı başvuruda çift onay: kaynak il ve hedef il",
      "Rapor çıktısına değerlendirme ve kazanımlar eklendi",
    ],
    commitler: ["2c8f457", "3174100", "5764c71", "d24bc46"],
  },
  {
    sira: 4,
    baslik: "Merkez istatistikleri ve toplu duyuru",
    durum: "YAYINDA",
    ozet:
      "Merkez ekosistemin sayılarını tek ekrandan görüyor ve seçtiği kitleye toplu bildirim gönderiyor.",
    baslangic: "2026-07-31",
    bitis: "2026-08-31",
    yayinTarihi: "2026-08-31",
    maddeler: [
      "Ekosistem istatistikleri ve faaliyet raporu",
      "Toplu duyuru: öğrenci, öğretmen, ekip ve topluluklara ayrı ayrı",
      "İl koordinatörünün toplu mesajı kendi iliyle sınırlı",
    ],
    commitler: ["62627fe", "b84db81"],
  },
  {
    sira: 5,
    baslik: "İletişim modülü: bağlantı, yazışma, moderasyon",
    durum: "YAYINDA",
    ozet:
      "Kullanıcılar bağlantı kurup yazışıyor; 18 yaş altı için gözetim kuralları devrede.",
    baslangic: "2026-07-31",
    bitis: "2026-08-26",
    yayinTarihi: "2026-08-26",
    maddeler: [
      "Veri modeli, görünürlük filtreleri ve moderasyon",
      "Bağlantı onayı ve yazışma tek ekranda: Bağlantılarım",
      "18 yaş altı yazışması danışman gözetiminde",
      "Doğrudan yazışma açıldı; okunmamış satır kırmızı çerçeveli",
    ],
    commitler: ["02cef76", "55c05cd", "a01e87f", "74dec65", "a20b3a7"],
  },
  {
    sira: 6,
    baslik: "Öğrenci paneli ve kişisel gelişim",
    durum: "YAYINDA",
    ozet:
      "Öğrencinin kendi ekranı: katkısı, kazanımları, rotası ve öz değerlendirmesi.",
    baslangic: "2026-07-31",
    bitis: "2026-08-26",
    yayinTarihi: "2026-08-26",
    maddeler: [
      "Katkı kartı, bağlantılar, ilçe temsilciliği ve faaliyet önerisi",
      "Kazanım sekmelerine GençTek etkinlikleri ve Diğer eklendi",
      "Algoritmam öz değerlendirme envanteri",
      "Profil bölümleri sadeleşti; öğretmen profili öğrenciyle aynı oldu",
    ],
    commitler: ["a7388b4", "faa7a56", "001c746"],
  },
  {
    sira: 7,
    baslik: "Profil fotoğrafı ve kişisel dosyalar",
    durum: "YAYINDA",
    ozet: "Her kullanıcı kendi fotoğrafını ve özgeçmişini yükleyebiliyor.",
    baslangic: "2026-07-31",
    bitis: "2026-08-11",
    yayinTarihi: "2026-08-11",
    maddeler: [
      "Profil fotoğrafı yükleme ve silme",
      "PDF özgeçmiş",
      "Yüklenen dosyalar depolama dizininde tutuluyor, depoda değil",
    ],
    commitler: ["69bfc0e", "fbea1d8"],
  },
  {
    sira: 8,
    baslik: "Yedekleme ve geri yükleme",
    durum: "YAYINDA",
    ozet:
      "Veritabanı gecelik yedekleniyor; geri yükleme provası yapıldı ve kırık komut düzeltildi.",
    baslangic: "2026-07-31",
    yayinTarihi: "2026-07-31",
    maddeler: [
      "Yedekleme cron'u (dagitim/yedek.sh)",
      "Geri yükleme provası — yedek gerçekten açılıyor mu, denendi",
      "DAGITIM.md'deki hatalı cron kullanıcısı düzeltildi",
    ],
    commitler: ["94937ac", "1bf42eb"],
  },
  {
    sira: 9,
    baslik: "Katılım ve teşekkür belgesi",
    durum: "YAYINDA",
    ozet:
      "Resmî şablon üzerine yazdırılabilir belge; tek yazdırmayla N sayfalık tek PDF.",
    baslangic: "2026-07-31",
    bitis: "2026-08-26",
    yayinTarihi: "2026-08-26",
    maddeler: [
      "Katılım ve teşekkür belgesi, resmî şablon üzerine",
      "Toplu belge üretimi: tek yazdırma, tek PDF",
      "Menüye Belge Oluştur girişi",
      "Belge metni GençTek kalıbına döndü; iki türde ortak",
      "Belge yalnız yoklamada katılmış görünene üretiliyor",
    ],
    commitler: ["fa3360c", "a760237", "0606f9b", "768dc67", "8fb7629"],
  },
  {
    sira: 10,
    baslik: "Çalışma grupları ve etkinlik akışı",
    durum: "YAYINDA",
    ozet:
      "Etkinlik öneri–onay–başvuru–değerlendirme zinciri ve çalışma grubu listesi tamamlandı.",
    baslangic: "2026-07-31",
    bitis: "2026-08-26",
    yayinTarihi: "2026-08-26",
    maddeler: [
      "Bilişim Hukuku, Güvenli İnternet, GençX ve Diğer grupları",
      "Yeni faaliyet formuna katılım biçimi, hedef kitle ve Diğer",
      "Öğretmen il ve ulusal etkinlik açabiliyor",
      "Etkinlik sayfası açılır bölümlere ayrıldı; bilgi notu ve belgeleme ayrı",
      "İptal edilen etkinlikte onay ve pencere rozetleri gizleniyor",
    ],
    commitler: ["3b468d0", "3d3debe", "d2fa2ce", "bc6fb46", "faa3fd8"],
  },
  {
    sira: 11,
    baslik: "Ağustos istek turları",
    durum: "YAYINDA",
    ozet:
      "5–14 Ağustos arasında toplanan kullanıcı istekleri turlar hâlinde kapatıldı.",
    baslangic: "2026-08-05",
    bitis: "2026-08-14",
    yayinTarihi: "2026-08-14",
    maddeler: [
      "5–6 Ağustos listesi: 25 madde tamamlandı, biten maddeler arşive taşındı",
      "7 Ağustos: profil/panel ayrımı, mentörlük, menü küçültme",
      "10 Ağustos: danışman bırakma, market sadeleştirme, bildirim hedefi",
      "11 Ağustos: onay kuyrukları, danışman bırakma, PDF özgeçmiş",
      "12 Ağustos: yoklama, belge kapısı, bildirim arşivi, görev rolleri süzgeci",
    ],
    commitler: ["1a23e71", "65fa95f", "d60895a", "ae66ee2", "fbea1d8", "3b9cbd8"],
  },
  {
    sira: 12,
    baslik: "Bağlantılarım ve ekosistem akışı",
    durum: "YAYINDA",
    ozet:
      "Ekosistemin sosyal katmanı: hakkımda, gönderi, yorum ve gönderiden doğrudan bağlantı.",
    baslangic: "2026-08-12",
    bitis: "2026-08-21",
    yayinTarihi: "2026-08-21",
    maddeler: [
      "Akış: hakkımda, gönderi ve yorum",
      "Akıştaki gönderiden bağlantı kurma",
      "Bağlantılarım'a Gönderdiğim istekler",
      "Gözetim satırında aynı okulun iki kez yazılması düzeltildi",
    ],
    commitler: ["25ddaa8", "030b5d7", "890c87b", "f1956f0"],
  },
  {
    sira: 13,
    baslik: "Mentörlük",
    durum: "YAYINDA",
    ozet:
      "Akran ve uzman mentörlüğü; başvuru, onay ve mentörlükten ayrılma hiyerarşiye bağlandı.",
    baslangic: "2026-08-13",
    bitis: "2026-08-28",
    yayinTarihi: "2026-08-28",
    maddeler: [
      "Mentör sayfası ve panoda mentör havuzu ızgarası",
      "Öğrenci de mentörlüğe başvurabiliyor (onaya tabi)",
      "Mentör onayı merkezde",
      "Mentörlük kaldırma hiyerarşisi, referanslar ve özgeçmiş",
      "Mentörlük bir rol değil, onaya bağlı kayıt",
    ],
    commitler: ["13dd018", "cba613f", "4c6881b", "8933f57", "cda82e4"],
  },
  {
    sira: 14,
    baslik: "Yönetim paneli",
    durum: "YAYINDA",
    ozet:
      "İl koordinatörü ve merkez için kart düzeninde tek giriş; kırılım il → ilçe → okul.",
    baslangic: "2026-08-11",
    bitis: "2026-08-31",
    yayinTarihi: "2026-08-31",
    maddeler: [
      "Her birim kartında okul, öğretmen, danışman, öğrenci ve etkinlik sayısı",
      "Kartın altında o birimin eksikleri",
      "Erişim kayıtları, toplu mesaj ve sistem ayarları üst menüden karta taşındı",
      "Onay kartlarında bekleyen iş sayısı",
      "İl kişi listesi, sütun süzgeçleri ve okul temsilcim kartı",
    ],
    commitler: ["4c6881b", "93b7261", "b84db81"],
  },
  {
    sira: 15,
    baslik: "Excel raporlama, envanter ve grafikler",
    durum: "YAYINDA",
    ozet:
      "Manisa karşılaştırmasından çıkan eksikler kapatıldı: okul/ekip envanteri ve grafikli raporlar.",
    baslangic: "2026-08-15",
    yayinTarihi: "2026-08-15",
    maddeler: [
      "Excel (xlsx) raporlama",
      "Okul ve ekip envanteri",
      "Yönetim grafikleri",
      "Ekranların çoğuna dışa aktarma bağlantısı",
    ],
    commitler: ["59c4d6f"],
  },
  {
    sira: 16,
    baslik: "Güvenlik turu I",
    durum: "YAYINDA",
    ozet:
      "Üretimde sahte giriş kapatıldı; oturum ömrü ve host doğrulaması geldi.",
    baslangic: "2026-08-16",
    yayinTarihi: "2026-08-16",
    maddeler: [
      "Üretimde mock giriş engeli",
      "Oturum ömrü sınırı",
      "Host başlığı doğrulaması",
      "Şema kayması giderildi: beş indeks schema.prisma'ya işlendi",
    ],
    commitler: ["f191572", "ef6a54d"],
  },
  {
    sira: 17,
    baslik: "Tasarım yenilemesi",
    durum: "YAYINDA",
    ozet:
      "Prototipin görsel dili sisteme taşındı: poster bantlı kartlar, rozetler, zaman çizelgesi.",
    baslangic: "2026-08-18",
    bitis: "2026-08-21",
    yayinTarihi: "2026-08-21",
    maddeler: [
      "Posterli etkinlik kartı ve zengin raporlama",
      "Ortak bileşen kümesi: Kart, Rozet, Ölçü kartı, İlerleme çubuğu",
      "Yönetim panosu kartları da panel kartlarıyla aynı görünüme geçti",
      "Açılış ekranına ve sekme simgesine GençTek logosu",
    ],
    commitler: ["f6f201a", "679cacf", "5007f9a"],
  },
  {
    sira: 18,
    baslik: "Dağıtım hattı",
    durum: "YAYINDA",
    ozet:
      "Yayın hedefi genctek7'ye taşındı; sunucu depodan anonim HTTPS ile çekiyor.",
    baslangic: "2026-08-07",
    bitis: "2026-08-18",
    yayinTarihi: "2026-08-18",
    maddeler: [
      "Yayın betiği ve dağıtım belgesi gerçek duruma çekildi",
      "Sunucu dağıtım anahtarı yerine anonim HTTPS ile çekiyor",
      "Alt dizin kurulumunda kırılan ham yollar düzeltildi",
      "Yerel başlatma ve durdurma betikleri",
    ],
    commitler: ["2107038", "f4cda27", "b789104", "88d9152"],
  },
  {
    sira: 19,
    baslik: "Hata kayıtları ve izleme",
    durum: "YAYINDA",
    ozet:
      "Kullanıcının ekranda gördüğü hata kimliğinin karşılığı panelden okunabiliyor.",
    baslangic: "2026-08-19",
    bitis: "2026-08-21",
    yayinTarihi: "2026-08-21",
    maddeler: [
      "Hata kayıtları ekranı, aya göre dosyalama ve arama",
      "Tarayıcı hataları da sunucuya kayda geçiyor",
      "Günlüğe yazılamıyorsa ekran bunu söylüyor — boş liste yanıltmıyor",
      "Günlüğe kişisel veri yazılmıyor",
    ],
    commitler: ["a99016d", "c71ba92"],
  },
  {
    sira: 20,
    baslik: "Market ve talep panosu",
    durum: "YAYINDA",
    ozet:
      "Ürün vitrini onaya bağlandı; talep panosu ilanlarıyla birlikte çalışıyor.",
    baslangic: "2026-08-14",
    bitis: "2026-08-28",
    yayinTarihi: "2026-08-28",
    maddeler: [
      "Market vitrini onaya bağlandı, Onay bekliyor rozeti",
      "Ürün onayı her kapıda soruluyor",
      "Pano ilan onayı ve kategoriler",
      "Panoda ilanlar en üste alındı",
      "Vitrin kapağı",
    ],
    commitler: ["6bb0784", "17ae63e", "12c143e", "e13d0d4", "cda82e4"],
  },
  {
    sira: 21,
    baslik: "Güvenlik turu II",
    durum: "YAYINDA",
    ozet:
      "Giriş yüzeyi sertleştirildi: hız sınırları, atomik sayaç ve hesap varlığı sızıntısının kapatılması.",
    baslangic: "2026-08-27",
    yayinTarihi: "2026-08-27",
    maddeler: [
      "Atomik giriş denemesi sayacı",
      "Giriş ve parola sıfırlama uçlarına hız sınırı",
      "Parola sıfırlama isteğine bekleme süresi",
      "Başvuru ekranı hesabın var olup olmadığını artık açık etmiyor",
      "next 16.3.3'e yükseltildi",
    ],
    commitler: ["05fc78a", "edbd20b", "1e67621"],
  },
  {
    sira: 22,
    baslik: "Portal için açık uçlar",
    durum: "YAYINDA",
    ozet:
      "Herkese açık portalın beslendiği iki uç: etkinlikler ve ekosistem sayıları.",
    baslangic: "2026-08-20",
    bitis: "2026-08-28",
    yayinTarihi: "2026-08-28",
    maddeler: [
      "/api/acik-etkinlikler — portalın etkinlik listesi",
      "/api/acik-istatistik — ekosistem sayıları",
      "Açık uca il sayısı eklendi: ekosistem kaç ilde var",
      "Açık uçlar kişisel veri döndürmüyor",
    ],
    commitler: ["3761681", "ef64a63", "afb04c1"],
  },
  {
    sira: 23,
    baslik: "Gezinme düzeni",
    durum: "YAYINDA",
    ozet:
      "Panelde tek kırıntı yolu: her ekranda nereden gelindiği ve nerede olunduğu yazıyor.",
    baslangic: "2026-08-20",
    bitis: "2026-08-30",
    yayinTarihi: "2026-08-30",
    maddeler: [
      "Her sayfa başlığında geri bağlantısı",
      "Yönetim panelinden açılan tüm ekranlarda kırıntı yolu",
      "Giriş ekranında görev almamış öğretmen kalmadı",
      "İndirmeler bağlantı değil düğme oldu",
    ],
    commitler: ["980438e", "4a9de4a"],
  },
  {
    sira: 24,
    baslik: "GençTek Yolculuğum ve görevler",
    durum: "YAYINDA",
    ozet:
      "Bilişim Yolculuğum bölümlere ayrıldı; GençTek görevleri yönetilebilir ve başvurulabilir hâle geldi.",
    baslangic: "2026-08-21",
    bitis: "2026-08-28",
    yayinTarihi: "2026-08-28",
    maddeler: [
      "GençTek Yolculuğum ve görev listesi ayrıldı",
      "Görev başvuruları Onay kuyruğu ekranında karara bağlanıyor",
      "Görev başvurusu bildirimleri",
      "Yolculukta puan yerine yıldız; öğretmene toplu yolculuk ekranı",
    ],
    commitler: ["90eb9ee", "c8a5965", "e40c5ac", "4ba3a2b", "4a90bc1"],
  },
  {
    sira: 25,
    baslik: "Panel saatleri İstanbul saatiyle",
    durum: "YAYINDA",
    ozet:
      "Kayıtlar üç saat geride görünüyordu; tüm ekranlarda saat İstanbul diliminde basılıyor.",
    baslangic: "2026-09-02",
    yayinTarihi: "2026-09-03",
    maddeler: [
      "Sunucu UTC koşuyor, ekran İstanbul saatiyle basıyor",
      "Erişim kayıtlarındaki üç saatlik kayma kapandı",
      "Tarih süzgeçleri de aynı dilimde değerlendiriliyor",
    ],
    commitler: ["5313d30"],
  },
  {
    sira: 26,
    baslik: "KVKK Genelge uyumu",
    durum: "YAYINDA",
    ozet:
      "Genelge 2/d, 3/e-3/g ve 4/ç maddeleri karşılandı: oturum izleri, imha politikası ve ilgili kişi başvurusu.",
    baslangic: "2026-09-02",
    yayinTarihi: "2026-09-03",
    maddeler: [
      "2/d — oturum izleri ve olağan dışı erişim örüntülerinin izlenmesi",
      "4/ç — ilgili kişi başvuru kuyruğu; yasal yanıt süresi 30 gün",
      "3/e ve 3/g — saklama süresi dolan verinin imha politikası",
      "İmha işinin zamanlayıcısı eklendi: gecelik iş aylardır sessizce ölüyormuş",
      "İlk girişte onay kapısı; onay tek düğmeyle veriliyor",
    ],
    commitler: ["41dfc1f", "a8d06eb", "9aa36ad", "0f48912"],
  },
  {
    sira: 27,
    baslik: "Üç kopya çalışma ve yayın betiği",
    durum: "YAYINDA",
    ozet:
      "Uygulama üç kopya koşuyor; yayın hepsini sırayla yeniliyor ve izlenmeyen dosyaya artık takılmıyor.",
    baslangic: "2026-09-02",
    yayinTarihi: "2026-09-03",
    maddeler: [
      "Üç kopya (cluster) çalışma; yayın kopyaları sırayla yeniliyor",
      "guncelle.sh, pull'dan önce izlenmeyen dosyaları yoldan çekiyor",
      "Yerel başlatma şemayı kendisi kuruyor",
    ],
    commitler: ["dfafbf1", "e8e39c7"],
  },
  {
    sira: 28,
    baslik: "Oturum gövdesi ve dış kimlik düzeni",
    durum: "YAYINDA",
    ozet:
      "Oturum çerezi artık kullanıcı kimliğini taşıyor; dış kimlik giriş akışı buna göre düzenlendi.",
    baslangic: "2026-09-03",
    yayinTarihi: "2026-09-03",
    maddeler: [
      "lib/auth/oturum-govde.ts ve oturum.ts yeniden düzenlendi",
      "Dış kimlik giriş akışı ve yetki tipleri buna göre güncellendi",
      "tests/oturum-govde.test.ts ile korunuyor",
    ],
    commitler: ["98d7262"],
  },
  {
    sira: 29,
    baslik: "EBA / MEBBİS / e-Devlet tekil girişi",
    durum: "TASARIMDA",
    ozet:
      "Kurumsal kimlik entegrasyonunun sözleşmesi yazıldı; servis erişimi bekleniyor.",
    baslangic: "2026-08-16",
    maddeler: [
      "Hangi kaynaktan hangi alanın isteneceği belirlendi (10 kimlik alanı)",
      "SSO'dan gelmemesi gereken sütunlar listelendi",
      "Karara bağlanacak 5 noktanın biri kapandı: authProviderId TCKN olacak",
      "Kalan 4 nokta kurumdan yanıt bekliyor",
      "Yazılacak dosya belli: src/lib/auth/eba-provider.ts",
    ],
    not:
      "Belge hazır (kurulum/sso-veri-talebi.md) ama kod yazılmadı — kurum servislerine erişim gelmeden yazılamaz.",
  },
  {
    sira: 30,
    baslik: "Sunucu MTU kara deliği düzeltmesi",
    durum: "YAYINDA",
    ozet:
      "Panelde ara ara çıkan 'Beklenmeyen bir hata' ekranının nedeni bulundu ve düzeltme sunucuya uygulandı.",
    baslangic: "2026-08-21",
    bitis: "2026-09-03",
    yayinTarihi: "2026-09-03",
    maddeler: [
      "Neden bulundu: sunucu 1500 MTU ile gönderiyor, hat taşımıyor, ICMP uyarısı dönmüyor",
      "Büyük yanıtlar (yönetim panosu 63 KB) ilk tampondan sonra sessizce ölüyor",
      "Uygulandı: net.ipv4.tcp_mtu_probing=1, kalıcısı /etc/sysctl.d/99-mtu.conf",
      "iptables TCPMSS clamp'i gerekmedi; yedek adım olarak duruyor",
    ],
    not:
      "Sunucu ayarı, kod değil: yayın betiğiyle taşınmaz, sunucu yeniden kurulursa 99-mtu.conf yeniden yazılmalı. Düzeltme ÖLÇÜLEREK doğrulanamadı — 3 Eylül'de arıza zaten üretilemiyordu (259 KB yanıt, öncesi 15/15, sonrası 15/15). Kalıcı koruma olarak duruyor: kara delik tekrar oluşursa çekirdek boyu kendi düşürür.",
  },
  {
    sira: 31,
    baslik: "Üretim veritabanı havuzu",
    durum: "YAYINDA",
    ozet:
      "Havuz kopya başına 4 bağlantıydı — yerel geliştirme değeriydi; üretimde 20'ye çıkarıldı.",
    baslangic: "2026-08-21",
    bitis: "2026-09-03",
    yayinTarihi: "2026-09-03",
    maddeler: [
      "Üretim .env'ine &connection_limit=20 eklendi; kod değişmedi",
      "Kopya başına 4 -> 20; üç kopyayla toplam 12 -> 60",
      "max_connections 100, 3'ü rezerve: gecelik işlerle en kötü hâl 80",
      "idleTimeoutMillis 1000 ms hâlâ yerel değer — ayrı iş, sabit yerelle paylaşımlı",
    ],
    not:
      "Sunucu ayarı, kod değil: .env yayın betiğiyle taşınmaz, sunucu yeniden kurulursa parametre yeniden eklenmeli. Sınırı adaptör değil src/lib/db-havuz.ts okuyor; havuzSiniriniCoz bu adres için 20 döndürüyor (öncesi 4).",
  },
  {
    sira: 32,
    baslik: "Sunucudaki kişisel veri dosyasının imhası",
    durum: "YAYINDA",
    ozet:
      "Kişi aktarımı için sunucuya bırakılan, gerçek kişisel veri taşıyan dosya imha edildi.",
    baslangic: "2026-08-28",
    bitis: "2026-09-03",
    yayinTarihi: "2026-09-03",
    maddeler: [
      "/opt/genctek/genctek-kisiler.json silindi — 389 KB, herkese okunur duruyordu",
      "Betikler artık /tmp'ye bırakılıyor, /opt/genctek içine değil",
      "DAGITIM.md ters vekil bölümü zaten güncelmiş; yanlış olan servis dosyasıydı (bkz. 33)",
    ],
    not:
      "KVKK saklama politikasının kapsamı DIŞINDAYDI: imha işi veritabanına bakıyor, elle bırakılmış bir dosyayı bilmiyor. Dosya bir çıktıydı — kisi-disa-aktar.ts üretir, kisi-ice-aktar.ts yerelde okur; silinmesi kullanıcıları etkilemez, gerekirse yeniden üretilir.",
  },
  {
    sira: 33,
    baslik: "Servis birimleri depoyla sunucu arasında ayrışmıştı",
    durum: "YAYINDA",
    ozet:
      "Depodaki servis dosyasıyla kurulum yapan çalışmayan bir servis kuruyordu; kopya şablonu ise depoda hiç yoktu.",
    baslangic: "2026-09-03",
    yayinTarihi: "2026-09-03",
    maddeler: [
      "genctek.service: ExecStart /usr/bin/node -> /opt/node24/bin/node (sistem Node'u 16, Prisma 7 onunla ölüyor)",
      "Aynı dosyada PORT 3000 -> 3010; ters vekilin Apache olduğu not düşüldü",
      "genctek@.service depoya eklendi: üç kopyalı kurulum depodan yeniden kurulamıyordu",
      "guncelle.sh: yeniden başlatma beklenirken çıkan 'Connection refused' gürültüsü susturuldu",
    ],
    not:
      "Sunucudaki birimler zaten DOĞRUYDU; yanlış olan depodaki kopyalardı — sunucuda elle düzeltilip geri yazılmamışlardı. İkisi artık sunucudakiyle birebir aynı. guncelle.sh'teki yeniden deneme döngüsü de zaten vardı ve çalışıyordu: susturulan yalnızca beklenen hataların gürültüsü, çünkü başarılı yayını bozuk gösterip çıktıdaki hataları yok saymayı öğretiyordu.",
  },
  {
    sira: 34,
    baslik: "Yazılı bilgi güvenliği prosedürleri",
    durum: "YAYINDA",
    ozet:
      "İhlal müdahale planı, yapay zekâ kullanım kuralı ve yetki gözden geçirme prosedürü yazıldı; boş kayıt şablonlarıyla birlikte.",
    baslangic: "2026-09-03",
    yayinTarihi: "2026-09-03",
    maddeler: [
      "Veri ihlali müdahale ve bildirim planı: 72 saat ÇÖZÜM süresi değil, bildirim üst sınırı",
      "Olay ekibi role bağlandı; ad/telefon/e-posta üretimin kontrollü işletim kopyasına bırakıldı",
      "Yapay zekâ kullanım kuralı: onaylı araç yok, üretim verisi geliştirme/testte kullanılamaz",
      "Yetki ve servis hesabı gözden geçirme: üç ayda bir, anahtar rotasyon süreleriyle",
      "Üretime çıkış kontrol listesine üç madde eklendi (DAGITIM.md)",
    ],
    commitler: ["1874696"],
    not:
      "KOD DEĞİL YAZILI KONTROL: çalışma zamanı davranışını değiştirmiyor, ekranlarda görünmüyor. tests/guvenlik-prosedurleri.test.ts belgelerin metnini değil ANLAMINI kilitliyor (72 saatin tanımı, yasak veri sınıfları, rotasyon süreleri) — belge sessizce gevşetilirse test düşer. Depoda yalnızca BOŞ şablonlar var; tamamlanmış inceleme kayıtları erişimi sınırlı kurum alanında tutulur.",
  },
  {
    sira: 35,
    baslik: "Dış inceleme bulguları: yükleme, istemci adresi ve oturum",
    durum: "YAYINDA",
    ozet:
      "Yüklenen dosyanın içeriği imzasıyla doğrulanıyor, istemci IP'si güvenilir biçimde çözülüyor ve oturumlar toplu iptal edilebiliyor.",
    baslangic: "2026-09-03",
    bitis: "2026-09-03",
    yayinTarihi: "2026-09-03",
    maddeler: [
      "Dosya imzası: depoya yazan dört yolun hepsi ilk baytları tipiyle karşılaştırıyor",
      "X-Forwarded-For zincirin SONUNDAN okunuyor; erişim kaydına sahte IP yazdırılamıyor",
      "x-real-ip yedeği kaldırıldı: başlığı vekilin mi istemcinin mi yazdığı görünmüyordu",
      "kullanici.oturum_surumu: şifre sıfırlamada açık oturumların hepsi düşüyor",
      "Dış girişe IP başına hız sınırı — hesap kilidi şifre püskürtmesini görmüyordu",
      "nosniff'in ikinci kaynağı kaldırıldı; tek kaynak next.config.ts",
    ],
    commitler: [
      "3fb1003",
      "e889eb0",
      "bffd4c9",
      "3a21569",
      "0c6dc28",
      "ceeeba0",
    ],
  },
  {
    sira: 36,
    baslik: "Açık istatistik ucunda sunucu tarafı önbellek",
    durum: "YAYINDA",
    ozet:
      "Tanıtım portalının hero panelini besleyen altı sayım sorgusu her ziyaretçide değil, beş dakikada bir çalışıyor.",
    baslangic: "2026-09-03",
    bitis: "2026-09-03",
    yayinTarihi: "2026-09-03",
    maddeler: [
      "Önbellek rotanın değil SORGULARIN etrafında (unstable_cache)",
      "Uç dinamik kaldı: derleme anında veritabanı gerektirmemesi için",
      "Süre, yanıttaki Cache-Control max-age ile aynı (300 sn) tutuldu",
    ],
    commitler: ["d27ad1b"],
  },
  {
    sira: 37,
    baslik: "Hız sınırı sayacı kopyalar arasında ortaklaştı",
    durum: "YAYINDA",
    ozet:
      "Sayaçlar süreç belleğinden veritabanına taşındı; üç kopyaya bölünen sınırlar artık yazıldığı değeri uyguluyor.",
    baslangic: "2026-09-03",
    bitis: "2026-09-03",
    yayinTarihi: "2026-09-03",
    maddeler: [
      "hiz_siniri_penceresi tablosu; sayım tek deyimde ve atomik (ON CONFLICT ... RETURNING)",
      "Veritabanına ulaşılamazsa süreç içi yedeğe düşülür, sınır kaldırılmaz",
      "Başvuru 5/10dk ve hata bildirimi 10/dk artık gerçekten o değer (fiilen 15 ve 30'du)",
      "Hata bildirimindeki süreç tavanı bilerek süreç başına kaldı",
      "Penceresi geçmiş satırlar gecelik bakımda siliniyor",
    ],
    commitler: ["72a4aef", "bdc86f1"],
    not:
      "Sunucuda çalışıyor: migration 3 Eylül 2026 yayınında uygulandı, üç kopya da o sürümle yeniden başladı ve ortak sayaç tablosuna yazıyor. Madde bir gün TESTTE göründü çünkü yayın bu kaydı güncellemeden yapıldı; durum git'ten türetilmediği için ancak elle düzeltilir. İlk commit (72a4aef) ara çözümdü — sınırları elle üçe bölüyordu, kopya sayısını koda gömdüğü için sayı değiştiği gün sessizce yanlışa düşerdi; ikincisi (bdc86f1) sayacı kopyaların dışına taşıdı.",
  },
  /*
   * 38–50: 4 EYLÜL – 14 KASIM 2026 ARASI TOPLU KAYIT (14 Kasım 2026 · istek:
   * "bunların hepsini yönetim panelinde Proje İlerleme Durumu alanına sürüm
   * geçmişi gibi ekliyor muydun" → "2 yi yap"). Bu aralıkta liste
   * güncellenmemişti; 64 commit konularına göre gruplandı.
   *
   * YAYIN GÜNÜ: 38–39 GençTek Topluluk kurulumuyla (23 Ekim) yayına girdi.
   * Diğerlerinde commit günü yazıldı; bu ekip her işi aynı gün
   * dagitim/topluluk-kur.sh ile yayına alıyordu ama sunucu günlüğüyle tek
   * tek doğrulanmadı. 14 Kasım yayınları doğrulandı (betiğin sağlık
   * kontrolü ve tarayıcıda ekran).
   */
  {
    sira: 38,
    baslik: "Kişisel Verilerim görünürlüğü ve yük testi betiği",
    durum: "YAYINDA",
    ozet:
      "Kişisel Verilerim menüde yalnızca proje yöneticisinde; başvuru formuna herkes için sayfa altından giriş; yük testi betiği depoya girdi.",
    baslangic: "2026-09-04",
    yayinTarihi: "2026-10-23",
    maddeler: [
      "Kişisel Verilerim satırı yalnızca proje yöneticisinin menüsünde",
      "KVKK başvuru formuna her panel ekranının altından sessiz bir bağlantı (m.13 erişilebilirliği)",
      "Yük testi betiği: hedef adres (TEST_URL) zorunlu, yanlış uygulamayı ölçmesin",
    ],
    commitler: ["610d222", "897557a", "a6475d9"],
  },
  {
    sira: 39,
    baslik: "Kayıtla giriş: T.C. kimlik no ve şifre",
    durum: "YAYINDA",
    ozet:
      "EBA girişi gelene kadar öğrenci ve öğretmen kendi hesabını açıyor, T.C. kimlik no ve şifreyle giriyor.",
    baslangic: "2026-09-17",
    bitis: "2026-09-26",
    yayinTarihi: "2026-10-23",
    maddeler: [
      "Kayıt ekranı: tür ve il, sonra T.C., ad soyad, okul, sınıf/şube ya da branş, şifre",
      "Giriş: T.C. + şifre; kilit ve hız sınırı dış kullanıcı girişiyle aynı kurallar",
      "İlk proje yöneticisi hesabını açan betik; kullanıcı verilerini silme betiği",
      "Yöneticinin kullanıcı adıyla girişi denendi ve geri alındı",
      "Pilot tanıtım verisi: Ankara ve İstanbul'da 6 kişi ve vitrin ürünleri",
    ],
    commitler: ["44a6114", "7082ca6", "89a63bb", "dd8edc6", "7174156"],
  },
  {
    sira: 40,
    baslik: "GençTek Topluluk sitesinin kurulumu",
    durum: "YAYINDA",
    ozet:
      "aiotechs.cloud/genctektopluluk ayrı veritabanı ve servisle yayına alındı; kayıt, genel bilgiler ve rol sınırlamaları topluluğa göre ayarlandı.",
    baslangic: "2026-10-23",
    yayinTarihi: "2026-10-23",
    maddeler: [
      "Kurulum, veri ve Apache betikleri; port ilk kurulumda boş porttan seçiliyor",
      "Kayıtta okul listede yoksa elle yazılıyor; e-posta ve telefon alınıyor",
      "Öğrenci, öğretmen ve koordinatörde düzenlenebilir Genel bilgiler",
      "Danışman atamasını proje yöneticisi yapar; il bazlı toplu danışman ataması",
      "Danışman rolü okuldan bağımsız; örnek ve test verisi temizlendi",
    ],
    commitler: ["da8f53d", "7efd5fd", "4c0440c", "abcdd89", "8d7590b"],
  },
  {
    sira: 41,
    baslik: "Takvimden etkinlik aktarımı",
    durum: "YAYINDA",
    ozet:
      "GençTek takvimindeki etkinlikler ulusal kapsamla, düzenleyen birimin ilinde sisteme aktarıldı.",
    baslangic: "2026-10-24",
    bitis: "2026-10-27",
    yayinTarihi: "2026-10-24",
    maddeler: [
      "Önümüzdeki iki ayın etkinlikleri ve toplantıları (tanışma toplantıları hariç)",
      "Tüm aktarılan etkinlikler ulusal; herkes görüyor",
      "Seçilen etkinlikleri numarasıyla ekleyen betik",
    ],
    commitler: ["780e136", "7fcae52", "a7e80c5"],
  },
  {
    sira: 42,
    baslik: "GençTek görevleri ve açılış sayfası",
    durum: "YAYINDA",
    ozet:
      "Başvurulabilir GençTek görevleri sol menüden açılıyor; proje yöneticisi görevleri sürükleyerek sıralıyor.",
    baslangic: "2026-10-24",
    bitis: "2026-10-27",
    yayinTarihi: "2026-10-27",
    maddeler: [
      "Pano'daki görev kartı sol menüye taşındı",
      "Kapatılan görev listede kalıyor, yalnızca başvuruya kapanıyor",
      "Proje yöneticisi görevleri sürükleyerek sıralıyor",
      "Açılış sayfasından E-Devlet ile Giriş düğmesi kaldırıldı",
      "Sol menüde alt sayfada yalnızca en uzun eşleşen satır seçili",
    ],
    commitler: ["9ae35a8", "3cb71a2", "1911606", "2f39ce4", "27adbf3"],
  },
  {
    sira: 43,
    baslik: "Etkinlik, çalışma grubu ve vitrin düzenlemeleri",
    durum: "YAYINDA",
    ozet:
      "Geçmiş tarihli etkinlik girilebiliyor; çalışma gruplarına açıklama geldi; vitrinde ekleyen kişi yazıyor.",
    baslangic: "2026-10-26",
    bitis: "2026-10-27",
    yayinTarihi: "2026-10-27",
    maddeler: [
      "Geçmiş tarihli etkinlik eklenebiliyor, başvurusu kapalı açılıyor",
      "Çalışma gruplarına kısa açıklama; Ayarlar'dan düzenleniyor, seçimde altta görünüyor",
      "Vitrin rozeti: \"Ekleyen öğretmen/öğrenci\"",
    ],
    commitler: ["6786753", "47a1f7f", "daf6778", "b6672fe", "508e9ee"],
  },
  {
    sira: 44,
    baslik: "Kullanıcı yönetimi ve şifre işlemleri",
    durum: "YAYINDA",
    ozet:
      "Yönetim Paneli'nde Kullanıcı Yönetimi; Şifremi unuttum; il koordinatörü kendi ilinde kayıt düzenleyip şifre yenileyebiliyor.",
    baslangic: "2026-10-28",
    bitis: "2026-11-14",
    yayinTarihi: "2026-11-14",
    maddeler: [
      "Arama, geçici şifre, kilit açma, pasife alma ve kayıt silme (KVKK imha akışıyla)",
      "Şifremi unuttum: yalnızca T.C. soruluyor, bağlantı kayıtlı e-postaya https ile gidiyor",
      "Proje yöneticisi hesaplarına e-posta; iletişim e-postası zorunlu ve denetleniyor",
      "Ad soyad düzeltme ve tüm alanları düzenleme sayfası",
      "Kullanıcı yönetimi il koordinatörüne açıldı (kendi ilindeki öğrenci ve öğretmen)",
      "İl koordinatörü de geçici şifre verebiliyor; e-posta değiştirme proje yöneticisinde",
      "Açık öğretim liseleri kapsam dışı",
    ],
    commitler: [
      "f5f773b",
      "54707d3",
      "a95aa10",
      "c226a59",
      "c9e5971",
      "b6acd3e",
      "25f40d3",
      "5a05a7d",
    ],
  },
  {
    sira: 45,
    baslik: "Etkinlik yönetimi, tarih ve ilçe düzeltmeleri",
    durum: "YAYINDA",
    ozet:
      "Etkinlikler herkese görünür, başvuru kendi il/okulla sınırlı; etkinlik silme ve tam düzenleme; Türkiye'nin bütün ilçeleri.",
    baslangic: "2026-10-31",
    bitis: "2026-11-10",
    yayinTarihi: "2026-11-10",
    maddeler: [
      "Çift gönderim kalkanı ve sunucuda kopya engeli",
      "Etkinlik silme, tam düzenleme, tarihe göre sıralama ve il süzgeci",
      "Form tarihleri Türkiye saatiyle (sunucuda 3 saat kayıyordu)",
      "Bütün ilçeler, hazırlık sınıfı; kayıtta ilçe seçimi; Bursa'ya Büyükşehir",
      "Kayıt formu hatada silinmiyor, şube yazımı esnek",
      "Vitrinde proje yöneticisi ürünü düzenleyip kaldırabiliyor",
      "Tema geçişi anında",
    ],
    commitler: [
      "b554e68",
      "b7955a3",
      "e6a8467",
      "7227386",
      "1e50994",
      "ad5a213",
      "92b5613",
      "7ed60dc",
    ],
  },
  {
    sira: 46,
    baslik: "Güvenlik sıkılaştırması ve bağımlılık güncellemesi",
    durum: "YAYINDA",
    ozet:
      "Rol kapıları, kapsam ve hız sınırları sıkılaştı; Next.js, React ve diğer bağımlılıklar güncellendi.",
    baslangic: "2026-11-06",
    yayinTarihi: "2026-11-06",
    maddeler: [
      "Danışman yalnızca kendisine atanmış öğrencileri görüyor",
      "Şifre sıfırlamada IP sınırı; giriş ve sıfırlamada sabit yanıt süresi",
      "Dış kullanıcıya etkinlik ekleri yalnızca ulusal ve kendi ilinde",
      "Kazanım silinince dosyaları da siliniyor; yükleme adedi ve saatlik sınır",
      "next 16.4.5, React 19.3.1, nodemailer, zod ve sharp güncellendi",
    ],
    commitler: ["15e0907", "3286bc8"],
  },
  {
    sira: 47,
    baslik: "Okul eşleştirme",
    durum: "YAYINDA",
    ozet:
      "Okulunu elle yazan kişiler benzer yazımlara göre gruplanıp gerçek okula bağlanıyor; kimse okula bağlı değildi.",
    baslangic: "2026-11-09",
    bitis: "2026-11-14",
    yayinTarihi: "2026-11-14",
    maddeler: [
      "Elle yazılan okul adları il içinde benzerliğe göre gruplanıyor (harf, yazım hatası, kısaltmalar)",
      "Grup kayıtlı okula bağlanıyor ya da yeni okul ekleniyor; benzer okul önceden seçili",
      "Koordinatör kendi ilinde, proje yöneticisi tüm illerde",
      "Tekrar eden okulu birleştirme; ayırarak geri alma",
      "Öğrenci listesinde okulsuz öğrenciye \"Okula bağla\"",
      "Kartlarda ilçe, yazılan okul adı ve \"Başlıkla aynı / Farklı yazım\" etiketi",
    ],
    commitler: [
      "d740774",
      "db7a55b",
      "97c9aa1",
      "c2c7893",
      "3795d08",
      "31ec048",
      "297f7db",
      "ab1bb15",
    ],
    not:
      "Ekrandan eklenen okul 900000001'den başlayan GEÇİCİ kurum kodu alıyor. EBA girişine geçmeden önce bu okullar gerçek MEB kodlarına taşınmalı.",
  },
  {
    sira: 48,
    baslik: "Danışman atama ve rol envanteri",
    durum: "YAYINDA",
    ozet:
      "İl koordinatörü kendi ilinde danışman atıyor; atama öğretmen sayfasından da yapılabiliyor; rol envanterinde arama.",
    baslangic: "2026-10-27",
    bitis: "2026-11-14",
    yayinTarihi: "2026-11-14",
    maddeler: [
      "Rol envanteri: koordinatörsüz illerde aday öğretmen sayısı ve Göster süzgeci",
      "Danışman ataması il koordinatörüne açıldı (kendi ilinde)",
      "Atama listesinde aynı okul üstte; yazdıkça daraltan arama",
      "İlin koordinatörü de danışman seçilebiliyor; toplu atamada \"Beni danışman yap\"",
      "Öğretmen sayfasından öğrenci atama",
      "Rol envanterinde koordinatör adı ya da il ile arama",
    ],
    commitler: [
      "3b82e81",
      "8dd1685",
      "07c4882",
      "29cdd04",
      "fa8d412",
      "e02ef67",
    ],
  },
  {
    sira: 49,
    baslik: "Kayıt ekranında mezun ve mentör; açılış sayfası",
    durum: "YAYINDA",
    ozet:
      "Kayıt ekranına mezun ve mentör geldi; yurt dışı seçeneği; açılış sayfasında Giriş Yap ve Kayıt Ol düğmeleri.",
    baslangic: "2026-11-10",
    bitis: "2026-11-12",
    yayinTarihi: "2026-11-12",
    maddeler: [
      "Mezun ve mentör başvurusu; hesap proje yöneticisi onayıyla açılıyor, giriş e-postayla",
      "\"Şu an ne yapıyorsunuz\": üniversite, şirket çalışanı, şirket sahibi, diğer",
      "İl listesinde Yurt dışı: ülke ve şehir zorunlu",
      "Açılışta \"Giriş Yap\" ve \"Kayıt Ol\" düğmeleri",
      "Rol rozeti: \"İl Koordinatörü\"",
    ],
    commitler: ["3a11fac", "7f0ee27", "4638559", "f5a866d", "ebbd8a2"],
  },
  {
    sira: 50,
    baslik: "Öğretmen listesinde filtreler",
    durum: "YAYINDA",
    ozet:
      "Öğretmenler ekranında bütün filtreler etiketli olarak kartta; okul adı, okul kaydı, öğrenci ve okul sorumlusu filtreleri eklendi.",
    baslangic: "2026-11-14",
    yayinTarihi: "2026-11-14",
    maddeler: [
      "Ad soyad, branş, okul adı, okul türü, il, ilçe, okul, görev yılı",
      "Okula bağlı / okulu listede yok; öğrencisi olan / olmayan; YEĞİTEK okul sorumlusu",
      "İl ve ilçe filtresi kişide boşsa okulun il/ilçesine bakıyor",
    ],
    commitler: ["87b5619"],
  },
];

/**
 * Genel ilerleme yüzdesi — aşama ağırlıklarının ortalaması.
 *
 * Boş listede 0 döner; sıfıra bölmeyi önlemek için değil, "hiç madde yoksa
 * ilerleme yoktur" doğru cevap olduğu için.
 */
export function ilerlemeYuzdesi(
  maddeler: readonly YolHaritasiMaddesi[],
): number {
  if (maddeler.length === 0) return 0;

  const toplam = maddeler.reduce(
    (birikim, madde) => birikim + DURUM_AGIRLIGI[madde.durum],
    0,
  );

  return Math.round((toplam / maddeler.length) * 100);
}

/**
 * Her durumda kaç madde olduğu.
 *
 * HİÇ MADDESİ OLMAYAN DURUM DA 0 İLE DÖNER: özet şeridi beş kutuyu her zaman
 * aynı sırada basıyor. Eksik anahtar dönseydi şerit maddeler ilerledikçe
 * daralıp genişler, kutuların yeri kayardı.
 */
export function durumSayilari(
  maddeler: readonly YolHaritasiMaddesi[],
): Record<IlerlemeDurumu, number> {
  const sayilar = Object.fromEntries(
    DURUM_SIRASI.map((durum) => [durum, 0]),
  ) as Record<IlerlemeDurumu, number>;

  for (const madde of maddeler) {
    sayilar[madde.durum] += 1;
  }

  return sayilar;
}

const AY_ADLARI = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];

/** `2026-07-31` → `31 Temmuz 2026`. Geçersiz girdi olduğu gibi döner. */
export function gunYaz(tarih: string): string {
  const parcalar = /^(\d{4})-(\d{2})-(\d{2})$/.exec(tarih);
  if (!parcalar) return tarih;

  const [, yil, ay, gun] = parcalar;
  const ayAdi = AY_ADLARI[Number(ay) - 1];
  if (!ayAdi) return tarih;

  return `${Number(gun)} ${ayAdi} ${yil}`;
}

/**
 * Maddenin tarih satırı.
 *
 * AYNI AY İÇİNDEKİ ARALIKTA AY BİR KEZ YAZILIR ("26 – 28 Ağustos 2026"):
 * "26 Ağustos 2026 – 28 Ağustos 2026" iki kat uzun ve aradaki farkı okumayı
 * zorlaştırıyor. Aynı gün başlayıp biten iş tek tarih basar.
 */
export function tarihAraligiYaz(madde: YolHaritasiMaddesi): string {
  if (!madde.bitis || madde.bitis === madde.baslangic) {
    return gunYaz(madde.baslangic);
  }

  const ayniAy = madde.baslangic.slice(0, 7) === madde.bitis.slice(0, 7);
  if (ayniAy) {
    const gun = Number(madde.baslangic.slice(8, 10));
    return `${gun} – ${gunYaz(madde.bitis)}`;
  }

  return `${gunYaz(madde.baslangic)} – ${gunYaz(madde.bitis)}`;
}
