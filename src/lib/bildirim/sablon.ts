/**
 * Bildirim şablonu doldurma ve şablon TANIMLARI.
 *
 * Şablon metinleri veritabanında tutulur (bildirim_sablonu) ve Yönetim
 * ekranından düzenlenir; kodda yalnızca hangi kodun hangi olayda gittiği ve
 * hangi değişkenleri taşıdığı yazılıdır. Kod listesi burada durmak zorunda:
 * şablonu tetikleyen olay kodda yaşıyor, veritabanına elle yeni bir satır
 * eklemek kendiliğinden yeni bir bildirim üretmez.
 *
 * Bu dosya veritabanına BAKMAZ; kurallar birim testlerle doğrulanır.
 */

export const BILDIRIM_KODLARI = {
  BASVURU_SONUCU: "BASVURU_SONUCU",
  DANISMAN_DEGISTI: "DANISMAN_DEGISTI",
  DANISMAN_YENIDEN_SECIM: "DANISMAN_YENIDEN_SECIM",
  /**
   * Danışman öğretmen TEK bir öğrencinin danışmanlığını bıraktı; ilin
   * koordinatörüne gider. Gerekçe metne dahildir — bırakma kararı görünür
   * olmadan hesap verilebilir olmaz.
   */
  DANISMANLIK_TEKIL_BIRAKILDI: "DANISMANLIK_TEKIL_BIRAKILDI",
  /**
   * Öğrenci bir öğretmeni danışman seçti; SEÇİLEN ÖĞRETMENE gider
   * (11 Ağustos 2026).
   *
   * Öğrenci danışmanını onay aranmadan seçtiği için bu bildirim, bağın
   * kurulduğunu öğretmene duyuran tek şeydir; olmadığında öğretmen kendi
   * danışmanlığını ancak listesine bakarak fark ediyordu.
   *
   * OTOMATİK ATAMADA GÖNDERİLMEZ: okulun tek danışmanına öğrencilerin ilk
   * girişte kendiliğinden bağlanması ayrı bir olaydır ve o akış kişinin
   * kararıyla doğmaz.
   */
  OGRENCI_DANISMAN_SECTI: "OGRENCI_DANISMAN_SECTI",
  /**
   * Öğrenci danışmanlığı sonlandırdı — başkasını seçerek ya da hiç kimseyi
   * seçmeden; ESKİ ÖĞRETMENE gider (11 Ağustos 2026).
   *
   * Tek şablon, iki olay: metindeki {{neOldu}} ikisini ayırıyor. Ayrı
   * şablonlar, aynı cümlenin iki kopyasını yönetim ekranında ayrı ayrı
   * güncellemek demekti.
   */
  OGRENCI_DANISMANLIKTAN_AYRILDI: "OGRENCI_DANISMANLIKTAN_AYRILDI",
  /**
   * Öğrenci danışman DEĞİŞİKLİĞİ istedi — İSTENEN ÖĞRETMENE gider
   * (20 Ağustos 2026 · istek: "danışman öğretmen seçiminde öğretmene veya il
   * koordinatörüne onay düşsün").
   *
   * OGRENCI_DANISMAN_SECTI'DEN AYRI: o, olmuş bitmiş bir bağı haber verir;
   * bu, cevap bekleyen bir istektir. Aynı şablonla gönderilseydi öğretmen
   * "listenizde görünüyor" diyen bir metin okur ve öğrenciyi listesinde
   * bulamazdı.
   */
  DANISMAN_TALEBI_GELDI: "DANISMAN_TALEBI_GELDI",
  /** Değişiklik onaylandı — ÖĞRENCİYE gider. */
  DANISMAN_TALEBI_ONAYLANDI: "DANISMAN_TALEBI_ONAYLANDI",
  /** Değişiklik reddedildi — ÖĞRENCİYE, gerekçesiyle birlikte gider. */
  DANISMAN_TALEBI_REDDEDILDI: "DANISMAN_TALEBI_REDDEDILDI",
  KOORDINATOR_DEVREDILEBILIR_OGRENCI: "KOORDINATOR_DEVREDILEBILIR_OGRENCI",
  ONAY_BEKLEYEN_ULUSAL_FAALIYET: "ONAY_BEKLEYEN_ULUSAL_FAALIYET",
  /** Öğrenci faaliyet açtı; il koordinatörüne ve YEĞİTEK'e birlikte gider. */
  ONAY_BEKLEYEN_OGRENCI_FAALIYETI: "ONAY_BEKLEYEN_OGRENCI_FAALIYETI",
  /** Danışman öğretmen faaliyet açtı; ilin koordinatörü onaylayacak. */
  ONAY_BEKLEYEN_OGRETMEN_FAALIYETI: "ONAY_BEKLEYEN_OGRETMEN_FAALIYETI",
  /**
   * Mezun / paydaş temsilcisi / mentör etkinlik bildirdi; öğrencininki gibi hem
   * ilin koordinatörüne hem YEĞİTEK'e gider (7 Ağustos 2026).
   *
   * ÖĞRENCİ ŞABLONU KULLANILMADI: o metin "okulundan" diye başlıyor ve dış
   * kullanıcının okulu yok. Onaylayan kişinin ekranında "hangi okuldan geldi"
   * yerine "kim, hangi sıfatla" yazması gerekiyor — karar buna bakılarak
   * veriliyor.
   */
  ONAY_BEKLEYEN_DIS_KULLANICI_ETKINLIGI: "ONAY_BEKLEYEN_DIS_KULLANICI_ETKINLIGI",
  /** Öğrencinin kendi ili, il dışı başvurusuna karar verdi. */
  IL_DISI_BASVURU_KARARI: "IL_DISI_BASVURU_KARARI",
  /** Merkezin tüm öğrenci/öğretmenlere gönderdiği serbest metinli duyuru. */
  TOPLU_DUYURU: "TOPLU_DUYURU",
  /** Öğrencinin bağlantı isteği onay bekliyor; danışman/koordinatöre gider. */
  ONAY_BEKLEYEN_BAGLANTI: "ONAY_BEKLEYEN_BAGLANTI",
  /** Bağlantı isteğine karar verildi; isteği yapana gider. */
  BAGLANTI_ISTEGI_KARARI: "BAGLANTI_ISTEGI_KARARI",
  /** Bağlantı onaylandı ve yazışma açıldı; karşı tarafa gider. */
  YENI_YAZISMA: "YENI_YAZISMA",
  /**
   * Panodaki ilana cevap yazıldı; İLANI AÇANA gider (13 Ağustos 2026).
   *
   * Cevap panoda açıkta duruyor ama ilan sahibinin panoya kendiliğinden geri
   * dönmesini beklemek, cevabın çoğu zaman hiç okunmaması demekti.
   */
  TALEBE_CEVAP_GELDI: "TALEBE_CEVAP_GELDI",
  /**
   * İl koordinatörünün kurduğu bir ekibe eklendiniz; EKLENEN KİŞİYE gider
   * (13 Ağustos 2026).
   *
   * Ekip, kişinin kendiliğinden uğramayacağı bir ekran; haberi olmadan üyesi
   * olduğu sohbete yazılanlar okunmadan kalırdı. Metin, sohbetin gözetime açık
   * olduğunu da söylüyor.
   */
  EKIBE_EKLENDINIZ: "EKIBE_EKLENDINIZ",
  /**
   * Ekip sohbetine yeni mesaj yazıldı; DİĞER ÜYELERE ve ekibi kuran
   * koordinatöre gider (13 Ağustos 2026).
   *
   * Metin mesajın kendisini TAŞIMAZ: tekrar engeli içerik karşılaştırdığı için
   * sabit metin, arka arkaya gelen mesajları tek bildirime indiriyor; ayrıca
   * bildirimin e-posta kopyası sohbet içeriğini dışarı taşımıyor.
   */
  EKIPTE_YENI_MESAJ: "EKIPTE_YENI_MESAJ",
  /**
   * GençTek görevine başvuru yapıldı; PROJE YÖNETİCİLERİNE gider
   * (21 Ağustos 2026).
   *
   * Kuyruğun sessiz kalmaması için baştan konuldu: mentörlükte bu bildirim
   * sonradan eklendi ve arada kalan başvurular haftalarca görülmedi.
   */
  ONAY_BEKLEYEN_GENCTEK_GOREVI: "ONAY_BEKLEYEN_GENCTEK_GOREVI",
  ONAY_BEKLEYEN_URUN: "ONAY_BEKLEYEN_URUN",
  URUN_MARKET_KARARI: "URUN_MARKET_KARARI",
  /** Görev başvurusu karara bağlandı; BAŞVURANA gider, gerekçesiyle. */
  GENCTEK_GOREV_KARARI: "GENCTEK_GOREV_KARARI",
  /** Faaliyet onaylandı ya da reddedildi; faaliyeti açana gider. */
  FAALIYET_ONAY_SONUCU: "FAALIYET_ONAY_SONUCU",
  DANISMANA_KOPYA_ULUSAL_BASVURU: "DANISMANA_KOPYA_ULUSAL_BASVURU",
  OGRENCI_ATANAMADI: "OGRENCI_ATANAMADI",
  FAALIYET_IPTAL_EDILDI: "FAALIYET_IPTAL_EDILDI",
  /** Danışman öğretmen ya da il koordinatörü öğrenci adına başvuru yaptı. */
  ADINA_BASVURU_YAPILDI: "ADINA_BASVURU_YAPILDI",
  /** Adına yapılan başvuru, başvuran öğretmen tarafından geri çekildi. */
  ADINA_BASVURU_GERI_CEKILDI: "ADINA_BASVURU_GERI_CEKILDI",
  /**
   * Seçilmiş bir katılımcı başvurusunu geri çekti; kontenjanda yer açıldı.
   * Etkinliği DÜZENLEYENE gider.
   *
   * Yalnızca SEÇİLEN çekildiğinde gönderilir. Bekleyen ya da yedek başvurunun
   * çekilmesi de yer açar ama düzenleyenin yapacağı bir şey yoktur; her geri
   * çekmede haber gitseydi, gerçekten karar gerektiren tek durum kalabalığın
   * içinde kaybolurdu.
   */
  KONTENJANDA_YER_ACILDI: "KONTENJANDA_YER_ACILDI",
  /** Öğrenci adına başvuran öğretmene giden sonuç kopyası. */
  ADINA_BASVURU_SONUCU: "ADINA_BASVURU_SONUCU",
  /**
   * EBA dışı giriş başvurusu (mezun/paydaş) onay bekliyor; proje
   * yöneticilerine gider.
   *
   * Başvuranın KENDİSİNE giden karar bildirimi burada YOKTUR ve olamaz:
   * reddedilen kişinin sistemde kullanıcı kaydı hiç açılmaz, oysa panel
   * bildirimi bir kullanıcıya yazılır. Karar, doğrudan e-postayla iletilir
   * (bkz. lib/dis-kimlik/eposta.ts).
   */
  ONAY_BEKLEYEN_DIS_BASVURU: "ONAY_BEKLEYEN_DIS_BASVURU",
  /**
   * Mentörlük başvurusu onay bekliyor; PROJE YÖNETİCİLERİNE gider
   * (13 Ağustos 2026 · inceleme bulgusu).
   *
   * Sistemdeki tek sessiz onay kuyruğu buydu: başvuru kaydediliyor, kimseye
   * haber gitmiyordu. Kuyruk ekranı da menüde değil (Yönetim Paneli'nde kart),
   * yani başvuru merkez o kartı kendiliğinden açana kadar bekliyordu — oysa
   * dış giriş başvurusu, etkinlik onayı ve bağlantı isteği için uyarı vardı.
   *
   * KOORDİNATÖRE GİTMEZ: kararı yalnızca merkez veriyor
   * (bkz. mentorlukOnaylayabilirMi · 11 Ağustos 2026). Bilgi amaçlı kopya da
   * gönderilmiyor; yapacağı bir şey olmayan uyarı, yapılacak olanı gölgeler.
   */
  ONAY_BEKLEYEN_MENTORLUK: "ONAY_BEKLEYEN_MENTORLUK",
  /**
   * ÖĞRENCİNİN mentörlük başvurusu; öğrencinin İLİNİN KOORDİNATÖRÜNE gider
   * (16 Kasım 2026 · istek: "öğrencim mentör olarak başvurdu, onayı bize
   * düşecekti ama göremiyorum … koordinatörler mentör onayı verebilsin").
   *
   * Yukarıdaki "koordinatöre gitmez" kuralı merkezin KUYRUĞU için doğru
   * kalıyor; ama 27 Ağustos 2026'dan beri koordinatör ilindeki öğrencinin
   * mentörlüğüne karar verebiliyor (bkz. ogrenciMentorluguneKararVerebilirMi).
   * Yani bu uyarının "yapacağı bir şey" var — Öğrenciler ekranındaki
   * Mentörlük sütunu. Ayrı şablon, çünkü metin farklı ekrana gönderiyor.
   */
  ONAY_BEKLEYEN_OGRENCI_MENTORLUK: "ONAY_BEKLEYEN_OGRENCI_MENTORLUK",
  /**
   * Mentörlük başvurusu karara bağlandı; BAŞVURANA gider (13 Ağustos 2026).
   *
   * Emsali `BAGLANTI_ISTEGI_KARARI`: onay/ret her iki uçta da duyurulur.
   * Panel'deki "Mentörlüklerim" kartı durumu zaten yazıyor ama kişinin karardan
   * haberdar olması için panele uğramasını beklemek, onayla açılan
   * "Mentörlüğüm" sekmesinin haftalarca fark edilmemesi demekti.
   */
  MENTORLUK_KARARI: "MENTORLUK_KARARI",
  /**
   * Bir öğrencinin mentörlüğünün kaldırılması istendi; ONAY MERCİİNE gider
   * (28 Ağustos 2026 · istek: "hiyerarşi olsun … öğretmeninkini koordinatör ve
   * proje yöneticisi, koordinatörünkini de proje yöneticisi onaylasın").
   *
   * ALICI TALEBİN DÜZEYİNE GÖRE DEĞİŞİR ve bu, projedeki öbür onay
   * bildirimlerinden ayrıldığı nokta: danışmanın talebi ilin koordinatörüne VE
   * merkeze, koordinatörün talebi yalnızca merkeze düşer (bkz.
   * mentorlukKaldirmaTalebiniOnaylayabilirMi). Koordinatöre "yapacağı bir şey
   * olmayan uyarı" gitmiyor — kendi talebinde zaten karar mercii değil.
   *
   * ÖĞRENCİYE GİTMEZ: henüz kaldırılmış bir şey yok. Reddedilebilecek bir
   * talep için "mentörlüğünüz kaldırılıyor" demek, sonucu olmayan bir kaygı
   * üretirdi; karar onaylandığında MENTORLUK_KARARI zaten gidiyor.
   */
  MENTORLUK_KALDIRMA_TALEBI: "MENTORLUK_KALDIRMA_TALEBI",
  /**
   * Kaldırma talebi karara bağlandı; TALEBİ AÇANA gider (28 Ağustos 2026).
   *
   * Emsali PANO_ILANI_KARARI: onay da ret de duyurulur. Ret hâlinde talebi
   * açan öğretmen, öğrencinin mentör KALDIĞINI başka hiçbir yerden öğrenmez —
   * ekrandaki rozet onaylı görünmeye devam eder ve bu, kaldırma isteğinin
   * unutulduğu izlenimi verirdi.
   */
  MENTORLUK_KALDIRMA_KARARI: "MENTORLUK_KALDIRMA_KARARI",
  /**
   * Öğrencinin açtığı pano ilanı onay bekliyor; PROJE YÖNETİCİLERİNE gider
   * (14 Ağustos 2026).
   *
   * Uyarısız bir onay kuyruğu, günlerce bakılmayan kuyruktur ve buradaki
   * bedeli öğrenci ödüyor: ilanı o süre boyunca panoda hiç görünmüyor. Emsali
   * ONAY_BEKLEYEN_MENTORLUK — o da tam bu gerekçeyle eklenmişti.
   *
   * KOORDİNATÖRE GİTMEZ: kararı yalnızca merkez veriyor (bkz.
   * panoIlaniOnaylayabilirMi) ve pano kapsam filtresiz olduğu için ilin
   * koordinatörünün yapacağı bir şey yok.
   */
  ONAY_BEKLEYEN_PANO_ILANI: "ONAY_BEKLEYEN_PANO_ILANI",
  /**
   * Pano ilanı karara bağlandı; İLANI AÇANA gider (14 Ağustos 2026).
   *
   * Onay da ret de duyurulur (emsali BAGLANTI_ISTEGI_KARARI): onayda öğrenci
   * ilanının yayımlandığını, rette gerekçesini öğrenir. Ret gerekçesi metne
   * girer — gerekçesiz ret, öğrenciye ilanını düzeltip yeniden açması için
   * hiçbir bilgi bırakmaz.
   */
  PANO_ILANI_KARARI: "PANO_ILANI_KARARI",
  /** Gecelik erişim günlüğü taramasında bulunan olağan dışı örüntü; merkeze gider. */
  ERISIM_ANOMALISI: "ERISIM_ANOMALISI",
  /**
   * İlgili kişi KVKK başvurusu açtı; PROJE YÖNETİCİLERİNE gider (2 Eylül 2026
   * · Genelge 4/ç).
   *
   * Uyarısız bir kuyruk günlerce bakılmayan kuyruktur; buradaki bedeli ise
   * kanun ödetiyor — başvurunun otuz günlük yanıt süresi var (m.13/2) ve
   * merkezin ekrana kendiliğinden uğramasını beklemek süreyi tesadüfe
   * bağlamak olurdu. Metinde son tarih yazılı.
   *
   * KOORDİNATÖRE GİTMEZ: veri sorumlusu YEĞİTEK'tir ve başvuruyu yalnızca
   * merkez yanıtlar. Kopya çıkarmak, ilin koordinatörüne yapacağı bir şey
   * olmayan ama içinde kişinin talebi yazan bir bildirim göndermek olurdu.
   */
  KVKK_BASVURUSU_ALINDI: "KVKK_BASVURUSU_ALINDI",
  /**
   * Başvuru sonuçlandı; BAŞVURANA gider (2 Eylül 2026).
   *
   * Kanun cevabın ilgili kişiye ULAŞMASINI arıyor; panele yazılıp orada
   * beklemesi yetmez. Bildirim, kişinin kayıtlı adresine e-posta kopyası
   * olarak da gidiyor (bkz. lib/bildirim/eposta-kopyasi.ts) ve yanıt metninin
   * tamamı gövdeye giriyor — özet geçilseydi kişi cevabı öğrenmek için yine
   * panele girmek zorunda kalırdı.
   */
  KVKK_BASVURUSU_YANITLANDI: "KVKK_BASVURUSU_YANITLANDI",
} as const;

export type BildirimKodu =
  (typeof BILDIRIM_KODLARI)[keyof typeof BILDIRIM_KODLARI];

export interface BildirimSablonTanimi {
  kod: BildirimKodu;
  baslik: string;
  /** Şablonun hangi olayda ve kime gittiği. */
  aciklama: string;
  /** Konuda ve gövdede kullanılabilecek yer tutucular. */
  degiskenler: readonly string[];
}

/**
 * Yönetim ekranının gösterdiği şablon listesi.
 *
 * Değişken adları burada yazılı olduğu için ekran, metne elle yazılmış hatalı
 * bir yer tutucuyu ({{ogrenci}} gibi) KAYDETMEDEN ÖNCE yakalayabiliyor. Aksi
 * halde hata ancak bildirim gittiğinde, kullanıcının gözüne ham süslü parantez
 * olarak görünürdü.
 */
export const BILDIRIM_SABLON_TANIMLARI: readonly BildirimSablonTanimi[] = [
  {
    kod: BILDIRIM_KODLARI.BASVURU_SONUCU,
    baslik: "Başvuru sonucu",
    aciklama:
      "Başvurusu değerlendirilen katılımcıya gider (seçildi / yedek / reddedildi).",
    degiskenler: ["ogrenciAdSoyad", "faaliyetAdi", "sonuc"],
  },
  {
    kod: BILDIRIM_KODLARI.DANISMAN_DEGISTI,
    baslik: "Danışman değişikliği",
    aciklama:
      "Danışmanı değişen öğrenciye gider. Yeni danışmanın adı metne YAZILMAZ; öğrenci panelinden görür.",
    degiskenler: [],
  },
  {
    kod: BILDIRIM_KODLARI.DANISMAN_YENIDEN_SECIM,
    baslik: "Yeniden danışman seçimi",
    aciklama:
      "Danışmanı görevden ayrıldığı için yeniden seçim yapması gereken öğrenciye gider.",
    degiskenler: [],
  },
  {
    kod: BILDIRIM_KODLARI.DANISMANLIK_TEKIL_BIRAKILDI,
    baslik: "Öğrencinin danışmanlığı bırakıldı",
    aciklama:
      "Danışman öğretmen tek bir öğrencinin danışmanlığını bıraktığında ilin koordinatörüne gider. Gerekçe metinde yer alır; öğrencinin yeni durumu da yazılır.",
    degiskenler: [
      "ogrenciAdSoyad",
      "danismanAdSoyad",
      "okulAdi",
      "gerekce",
      "yeniDurum",
    ],
  },
  {
    kod: BILDIRIM_KODLARI.OGRENCI_DANISMAN_SECTI,
    baslik: "Öğrenci sizi danışman seçti",
    aciklama:
      "Bir öğrenci danışman öğretmen olarak sizi seçtiğinde size gider. Onay istenmez; bildirim bağın kurulduğunu haber verir.",
    degiskenler: ["ogrenciAdSoyad", "sinif"],
  },
  {
    kod: BILDIRIM_KODLARI.DANISMAN_TALEBI_GELDI,
    baslik: "Danışman değişikliği talebi",
    aciklama:
      "Danışmanı olan bir öğrenci sizi danışman seçtiğinde size gider. Bağ HENÜZ KURULMAZ; öğrenci sizin ya da il koordinatörünün onayını bekler.",
    degiskenler: ["ogrenciAdSoyad", "sinif"],
  },
  {
    kod: BILDIRIM_KODLARI.DANISMAN_TALEBI_ONAYLANDI,
    baslik: "Danışman değişikliğiniz onaylandı",
    aciklama:
      "Öğrencinin danışman değişikliği talebi onaylandığında öğrenciye gider.",
    degiskenler: ["danismanAdSoyad"],
  },
  {
    kod: BILDIRIM_KODLARI.DANISMAN_TALEBI_REDDEDILDI,
    baslik: "Danışman değişikliğiniz reddedildi",
    aciklama:
      "Talep reddedildiğinde öğrenciye gider. Gerekçe metnin içindedir; gerekçesiz ret kabul edilmiyor.",
    degiskenler: ["danismanAdSoyad", "gerekce"],
  },
  {
    kod: BILDIRIM_KODLARI.OGRENCI_DANISMANLIKTAN_AYRILDI,
    baslik: "Öğrenci danışmanlığınızdan ayrıldı",
    aciklama:
      "Öğrenci başka bir danışman seçtiğinde ya da danışmanlığı hiç kimseyi seçmeden sonlandırdığında eski danışmanına gider. Hangisi olduğu {{neOldu}} ile yazılır.",
    degiskenler: ["ogrenciAdSoyad", "neOldu"],
  },
  {
    kod: BILDIRIM_KODLARI.KOORDINATOR_DEVREDILEBILIR_OGRENCI,
    baslik: "Devredilebilir öğrenci uyarısı",
    aciklama:
      "Bir okulda danışman öğretmen göreve başladığında, o okulun öğrencilerini taşıyan il koordinatörüne gider.",
    degiskenler: ["okulAdi", "ogrenciSayisi"],
  },
  {
    kod: BILDIRIM_KODLARI.ONAY_BEKLEYEN_ULUSAL_FAALIYET,
    baslik: "Onay bekleyen ulusal etkinlik",
    aciklama:
      "İl koordinatörü ulusal etkinlik açtığında proje yöneticilerine gider.",
    degiskenler: ["faaliyetAdi", "duzenleyenAdSoyad"],
  },
  {
    kod: BILDIRIM_KODLARI.ONAY_BEKLEYEN_OGRENCI_FAALIYETI,
    baslik: "Onay bekleyen öğrenci etkinliği",
    aciklama:
      "Öğrenci etkinlik açtığında hem öğrencinin ilinin koordinatörüne hem proje yöneticilerine gider. İkisi de onaylayabilir.",
    degiskenler: ["faaliyetAdi", "duzenleyenAdSoyad", "kapsam", "okulAdi"],
  },
  {
    kod: BILDIRIM_KODLARI.ONAY_BEKLEYEN_OGRETMEN_FAALIYETI,
    baslik: "Onay bekleyen öğretmen etkinliği",
    aciklama:
      "Danışman öğretmen etkinlik açtığında okulun ilindeki koordinatöre gider. İlde koordinatör yoksa proje yöneticilerine düşer, etkinlik askıda kalmaz.",
    degiskenler: ["faaliyetAdi", "duzenleyenAdSoyad", "kapsam", "okulAdi"],
  },
  {
    kod: BILDIRIM_KODLARI.ONAY_BEKLEYEN_DIS_KULLANICI_ETKINLIGI,
    baslik: "Onay bekleyen mezun/paydaş etkinliği",
    aciklama:
      "Mezun, paydaş temsilcisi ya da mentör etkinlik bildirdiğinde hem kişinin ilinin koordinatörüne hem proje yöneticilerine gider. İkisi de onaylayabilir.",
    degiskenler: ["faaliyetAdi", "duzenleyenAdSoyad", "kapsam", "sifat"],
  },
  {
    kod: BILDIRIM_KODLARI.IL_DISI_BASVURU_KARARI,
    baslik: "İl dışı başvuru kararı",
    aciklama:
      "Öğrenci başka bir ilin etkinliğine başvurduğunda, kendi ilinin koordinatörü karar verince öğrenciye gider. Onay başvurunun bittiği anlamına GELMEZ; sıra etkinliğin ilindeki değerlendirmeye geçer.",
    degiskenler: ["ogrenciAdSoyad", "faaliyetAdi", "sonuc", "gerekce"],
  },
  {
    kod: BILDIRIM_KODLARI.TOPLU_DUYURU,
    baslik: "Toplu duyuru",
    aciklama:
      "Proje yöneticisinin Duyurular ekranından gönderdiği serbest metinli duyuru. Metni gönderen yazar; buradaki şablon yalnızca sarmalayıcıdır.",
    degiskenler: ["baslik", "icerik"],
  },
  {
    kod: BILDIRIM_KODLARI.ONAY_BEKLEYEN_BAGLANTI,
    baslik: "Onay bekleyen bağlantı isteği",
    aciklama:
      "Öğrenci başka bir kullanıcıyla iletişim kurmak istediğinde danışmanına ve ilinin koordinatörüne gider.",
    degiskenler: ["isteyenAdSoyad", "hedefAdSoyad", "talepBasligi"],
  },
  {
    kod: BILDIRIM_KODLARI.BAGLANTI_ISTEGI_KARARI,
    baslik: "Bağlantı isteği sonucu",
    aciklama:
      "İsteği yapan öğrenciye gider. Onaylandıysa yazışma açılmıştır; reddedildiyse gerekçe yazılıdır.",
    degiskenler: ["hedefAdSoyad", "sonuc", "gerekce"],
  },
  {
    kod: BILDIRIM_KODLARI.TALEBE_CEVAP_GELDI,
    baslik: "Panodaki ilana cevap geldi",
    aciklama:
      "Mentör ya da bir başka kullanıcı panodaki ilana cevap yazdığında İLANI AÇANA gider.",
    degiskenler: ["talepBasligi", "cevaplayanAdSoyad"],
  },
  {
    kod: BILDIRIM_KODLARI.EKIBE_EKLENDINIZ,
    baslik: "Ekibe eklendiniz",
    aciklama:
      "İl koordinatörü (ya da proje yöneticisi) kişiyi bir ekibe eklediğinde o kişiye gider.",
    degiskenler: ["ekipAdi", "ekleyenAdSoyad"],
  },
  {
    kod: BILDIRIM_KODLARI.EKIPTE_YENI_MESAJ,
    baslik: "Ekipte yeni mesaj",
    aciklama:
      "Ekip sohbetine mesaj yazıldığında diğer üyelere ve ekibi kuran koordinatöre gider. Metin mesajı taşımaz; yalnızca hangi ekipte olduğunu söyler.",
    degiskenler: ["ekipAdi"],
  },
  {
    kod: BILDIRIM_KODLARI.YENI_YAZISMA,
    baslik: "Yeni yazışma açıldı",
    aciklama:
      "Bağlantı onaylandığında KARŞI TARAFA gider: biri kendisiyle iletişim kurmak istedi ve izin verildi.",
    degiskenler: ["isteyenAdSoyad"],
  },
  {
    kod: BILDIRIM_KODLARI.FAALIYET_ONAY_SONUCU,
    baslik: "Etkinlik onay sonucu",
    aciklama:
      "Onaya sunulan etkinlik sonuçlandığında etkinliği açan kullanıcıya gider.",
    degiskenler: ["faaliyetAdi", "sonuc", "kararVerenAdSoyad"],
  },
  {
    kod: BILDIRIM_KODLARI.DANISMANA_KOPYA_ULUSAL_BASVURU,
    baslik: "Danışmana ulusal başvuru kopyası",
    aciklama:
      "Öğrenci kendi ili dışındaki ulusal etkinliğe başvurduğunda danışmanına gider. Onay değildir, salt haberdir.",
    degiskenler: ["ogrenciAdSoyad", "faaliyetAdi"],
  },
  {
    kod: BILDIRIM_KODLARI.OGRENCI_ATANAMADI,
    baslik: "Öğrenciye danışman atanamadı",
    aciklama:
      "Okulunda danışman öğretmen ve ilinde koordinatör bulunmadığında proje yöneticilerine gider.",
    degiskenler: ["ogrenciAdSoyad", "ilKodu"],
  },
  {
    kod: BILDIRIM_KODLARI.FAALIYET_IPTAL_EDILDI,
    baslik: "Etkinlik iptal edildi",
    aciklama: "Etkinlik iptal edildiğinde aktif başvuru sahiplerine gider.",
    degiskenler: ["faaliyetAdi", "gerekce"],
  },
  {
    kod: BILDIRIM_KODLARI.ADINA_BASVURU_YAPILDI,
    baslik: "Adınıza başvuru yapıldı",
    aciklama:
      "Danışman öğretmen ya da il koordinatörü öğrenci adına başvurduğunda öğrenciye gider.",
    degiskenler: ["ogrenciAdSoyad", "faaliyetAdi", "basvuranAdSoyad"],
  },
  {
    kod: BILDIRIM_KODLARI.ADINA_BASVURU_GERI_CEKILDI,
    baslik: "Adınıza yapılan başvuru geri çekildi",
    aciklama:
      "Öğrenci adına yapılan başvuru, başvuran öğretmen tarafından geri çekildiğinde öğrenciye gider.",
    degiskenler: ["ogrenciAdSoyad", "basvuranAdSoyad"],
  },
  {
    kod: BILDIRIM_KODLARI.KONTENJANDA_YER_ACILDI,
    baslik: "Kontenjanda yer açıldı",
    aciklama:
      "Seçilmiş bir katılımcı başvurusunu geri çektiğinde etkinliği düzenleyene gider. Yedek sayısı metne yazılır; düzenleyen yedekten çağırma kararını buna göre verir.",
    degiskenler: [
      "faaliyetAdi",
      "katilimciAdSoyad",
      "yedekSayisi",
      "kalanYer",
    ],
  },
  {
    kod: BILDIRIM_KODLARI.ADINA_BASVURU_SONUCU,
    baslik: "Adına başvurulan öğrencinin sonucu",
    aciklama:
      "Öğrenci adına başvuran öğretmene, başvuru değerlendirildiğinde gider.",
    degiskenler: ["ogrenciAdSoyad", "faaliyetAdi", "sonuc"],
  },
  {
    kod: BILDIRIM_KODLARI.ONAY_BEKLEYEN_DIS_BASVURU,
    baslik: "Onay bekleyen dış giriş başvurusu",
    aciklama:
      "EBA hesabı olmayan biri (mezun / paydaş temsilcisi) giriş başvurusu yaptığında proje yöneticilerine gider.",
    degiskenler: ["basvuranAdSoyad", "tur", "ilAdi"],
  },
  {
    kod: BILDIRIM_KODLARI.ONAY_BEKLEYEN_MENTORLUK,
    baslik: "Onay bekleyen mentörlük başvurusu",
    aciklama:
      "Bir kullanıcı mentörlük başvurusu yaptığında proje yöneticilerine gider. Başvuran öğrenciyse ilinin koordinatörüne ayrıca ONAY_BEKLEYEN_OGRENCI_MENTORLUK gider.",
    degiskenler: ["basvuranAdSoyad", "kapsam"],
  },
  {
    kod: BILDIRIM_KODLARI.ONAY_BEKLEYEN_OGRENCI_MENTORLUK,
    baslik: "Onay bekleyen öğrenci mentörlük başvurusu",
    aciklama:
      "Bir öğrenci mentörlük başvurusu yaptığında öğrencinin ilinin koordinatörüne gider. Karar Öğrenciler ekranındaki Mentörlük sütunundan verilir.",
    degiskenler: ["basvuranAdSoyad", "kapsam"],
  },
  {
    kod: BILDIRIM_KODLARI.MENTORLUK_KARARI,
    baslik: "Mentörlük başvurusu sonucu",
    aciklama:
      "Başvuruyu yapan kişiye gider. Onaylandıysa Mentörlüğüm sekmesi açılmıştır; reddedildiyse gerekçe yazılıdır.",
    degiskenler: ["sonuc", "gerekce"],
  },
  {
    kod: BILDIRIM_KODLARI.MENTORLUK_KALDIRMA_TALEBI,
    baslik: "Onay bekleyen mentörlük kaldırma talebi",
    aciklama:
      "Danışman öğretmen ya da il koordinatörü bir öğrencinin mentörlüğünü kaldırmak istediğinde, kararı verecek mercie gider: öğretmenin talebi ilin koordinatörüne ve merkeze, koordinatörün talebi yalnızca merkeze. Öğrenci karar çıkana kadar mentör kalır.",
    degiskenler: [
      "ogrenciAdSoyad",
      "isteyenAdSoyad",
      "isteyenGorevi",
      "gerekce",
    ],
  },
  {
    kod: BILDIRIM_KODLARI.MENTORLUK_KALDIRMA_KARARI,
    baslik: "Mentörlük kaldırma talebi sonucu",
    aciklama:
      "Talebi açan danışman ya da koordinatöre gider. Onayda mentörlük kaldırılmıştır; rette öğrenci mentör kalır ve gerekçe yazılıdır.",
    degiskenler: [
      "ogrenciAdSoyad",
      "kararVerenAdSoyad",
      "sonuc",
      "gerekce",
    ],
  },
  {
    kod: BILDIRIM_KODLARI.ONAY_BEKLEYEN_GENCTEK_GOREVI,
    baslik: "Onay bekleyen GençTek görev başvurusu",
    aciklama:
      "Bir kullanıcı panodaki GençTek görevlerinden birine başvurduğunda proje yöneticilerine gider. Kararı yalnızca merkez verir.",
    degiskenler: ["basvuranAdSoyad", "gorevAdi"],
  },
  {
    kod: BILDIRIM_KODLARI.GENCTEK_GOREV_KARARI,
    baslik: "GençTek görev başvurusu sonucu",
    aciklama:
      "Başvuruyu yapan kişiye gider. Reddedildiyse gerekçe yazılıdır; onaylandıysa görev listesinde yer alır.",
    degiskenler: ["gorevAdi", "sonuc", "gerekce"],
  },
  {
    kod: BILDIRIM_KODLARI.ONAY_BEKLEYEN_URUN,
    baslik: "Onay bekleyen ürün",
    aciklama:
      "Bir kullanıcı ürününü markette paylaşmayı seçtiğinde proje yöneticilerine gider. Ürün, onaylanana kadar markette yalnızca sahibine görünür.",
    degiskenler: ["sahipAdSoyad", "urunAdi"],
  },
  {
    kod: BILDIRIM_KODLARI.URUN_MARKET_KARARI,
    baslik: "Ürün market kararı",
    aciklama:
      "Ürünü paylaşan kişiye gider. Onaylandıysa ürün markette görünür; reddedildiyse gerekçe yazılıdır.",
    degiskenler: ["urunAdi", "sonuc", "gerekce"],
  },
  {
    kod: BILDIRIM_KODLARI.ONAY_BEKLEYEN_PANO_ILANI,
    baslik: "Onay bekleyen pano ilanı",
    aciklama:
      "Öğrenci panoya ilan açtığında proje yöneticilerine gider. İlan, onaylanana kadar panoda görünmez. Kararı yalnızca merkez verir; il koordinatörüne kopya çıkmaz.",
    degiskenler: ["acanAdSoyad", "talepBasligi", "tur"],
  },
  {
    kod: BILDIRIM_KODLARI.PANO_ILANI_KARARI,
    baslik: "Pano ilanı sonucu",
    aciklama:
      "İlanı açan öğrenciye gider. Onaylandıysa ilan panoda yayımlanmıştır; reddedildiyse gerekçe yazılıdır.",
    degiskenler: ["talepBasligi", "sonuc", "gerekce"],
  },
  {
    kod: BILDIRIM_KODLARI.ERISIM_ANOMALISI,
    baslik: "Olağan dışı erişim örüntüsü",
    aciklama:
      "Gecelik denetim yüksek hacimli öğrenci erişimi veya mesai dışı toplu dışa aktarım bulduğunda proje yöneticilerine gider.",
    degiskenler: [
      "kullaniciAdSoyad",
      "anomaliTuru",
      "gun",
      "logSayisi",
      "benzersizHedefSayisi",
    ],
  },
  {
    kod: BILDIRIM_KODLARI.KVKK_BASVURUSU_ALINDI,
    baslik: "Yeni KVKK başvurusu",
    aciklama:
      "İlgili kişi kişisel verileriyle ilgili başvuru yaptığında proje yöneticilerine gider. Kanunî yanıt süresi otuz gündür; son tarih metne yazılır.",
    degiskenler: ["basvuranAdSoyad", "konular", "sonTarih"],
  },
  {
    kod: BILDIRIM_KODLARI.KVKK_BASVURUSU_YANITLANDI,
    baslik: "KVKK başvurusu yanıtı",
    aciklama:
      "Başvurusu sonuçlanan ilgili kişiye gider. Yanıt metninin tamamı gövdeye girer; özet geçilirse kişi cevabı öğrenmek için panele girmek zorunda kalır.",
    degiskenler: ["tarih", "sonuc", "yanit"],
  },
];

export function sablonTanimiGetir(
  kod: string,
): BildirimSablonTanimi | undefined {
  return BILDIRIM_SABLON_TANIMLARI.find((tanim) => tanim.kod === kod);
}

const YER_TUTUCU = /\{\{(\w+)\}\}/g;

/** Metindeki tüm {{yerTutucu}} adlarını tekrarsız verir. */
export function yerTutuculariCikar(metin: string): string[] {
  const bulunanlar = new Set<string>();
  for (const eslesme of metin.matchAll(YER_TUTUCU)) {
    bulunanlar.add(eslesme[1]);
  }
  return [...bulunanlar];
}

/**
 * Şablon metnini doğrular.
 *
 * TANIMSIZ yer tutucu hatadır: metne yazılan {{ogrenci}} hiçbir zaman
 * dolmayacağı için bildirim kullanıcıya ham süslü parantezle ulaşır. Tanımlı
 * bir değişkenin KULLANILMAMASI ise hata değildir — metni kısaltmak metni
 * yazanın hakkı.
 */
export function sablonMetniGecerliMi(
  metin: string,
  izinliDegiskenler: readonly string[],
): { olurMu: boolean; neden?: string } {
  const kirpilmis = metin.trim();
  if (!kirpilmis) {
    return { olurMu: false, neden: "Metin boş bırakılamaz." };
  }

  const tanimsizlar = yerTutuculariCikar(kirpilmis).filter(
    (ad) => !izinliDegiskenler.includes(ad),
  );
  if (tanimsizlar.length > 0) {
    return {
      olurMu: false,
      neden: `Tanımsız değişken: ${tanimsizlar
        .map((ad) => `{{${ad}}}`)
        .join(", ")}. Kullanılabilir: ${izinliDegiskenler
        .map((ad) => `{{${ad}}}`)
        .join(", ")}`,
    };
  }

  return { olurMu: true };
}

/** Şablondaki {{degisken}} yer tutucularını doldurur. */
export function sablonuDoldur(
  sablon: string,
  degiskenler: Record<string, string>,
): string {
  return sablon.replace(YER_TUTUCU, (tamEslesme, anahtar: string) => {
    return degiskenler[anahtar] ?? tamEslesme;
  });
}
