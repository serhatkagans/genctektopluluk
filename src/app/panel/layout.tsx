import { LogOut } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cikisEylemi } from "@/app/giris/eylemler";
import {
  PanelGezinme,
  type GezinmeBaglantisi,
} from "@/components/PanelGezinme";
import { RolEtiketi, RolsuzEtiketi } from "@/components/RolEtiketi";
import { TemaSecici } from "@/components/TemaSecici";
import { oturumKullanicisi } from "@/lib/auth/oturum";
import { ilkGirisKilidiVarMi } from "@/lib/kvkk/onay";
import { onayliMentorMu } from "@/lib/mentor/veri";
import { uygulamaYolu } from "@/lib/ortam";
import { aktifTema } from "@/lib/tema";
import { rolIlAdlariniGetir } from "@/lib/yetki/rol-il-adlari";
import {
  BAGLANTILARIM_KAPALI_ACIKLAMASI,
  baglantilarimKapaliMi,
} from "@/lib/yazisma/politika";
import {
  disKullaniciMi,
  ogrenciMi,
  projeYoneticisiMi,
  rolEnvanteriGorebilirMi,
  yonetimPanosuGorebilirMi,
} from "@/lib/yetki/izinler";

export const dynamic = "force-dynamic";

export default async function PanelDuzeni({
  children,
}: {
  children: React.ReactNode;
}) {
  const [kullanici, tema] = await Promise.all([
    oturumKullanicisi(),
    aktifTema(),
  ]);
  if (!kullanici) {
    redirect("/giris");
  }

  /*
   * Rol rozetinin yanındaki il ADI; sorgu ve gerekçesi ortak yardımcıda
   * (bkz. lib/yetki/rol-il-adlari.ts). Paneldeki vitrin de aynı adları
   * kullanıyor.
   */
  const ilAdlari = await rolIlAdlariniGetir(kullanici);

  /*
   * İLK GİRİŞ KAPISI GERİ AÇILDI (2 Eylül 2026).
   *
   * 21 Ağustos'ta kapatılmıştı ("KVKK'lar panelden kalkacak, açılışta çerez
   * politikası ile ilgili popup gelecek bir kerelik") ve yerine
   * `CerezBildirimi` konmuştu. O bildirim iki cümlelik bir BİLGİLENDİRME:
   * belge göstermiyor, onay almıyor ve "gördüm" işaretini kullanıcı başına
   * değil TARAYICI başına tutuyor — bir kez kapatıldıktan sonra başka bir
   * hesapla girildiğinde de çıkmıyor. Metinlerin okutulup onaylanması yeniden
   * istendiği için kapı geri açıldı; çerez bildirimi de yerinde duruyor,
   * çünkü çerez kullanımı aydınlatma metninin anlattığından farklı bir konu.
   *
   * KİLİT YALNIZCA GERÇEK İLK GİRİŞTE: hiç onayı olmayan kişi panele giremez.
   * Sonradan eklenen belge ya da güncellenen metin kimseyi kapıda bırakmaz —
   * bir metin güncellemesi tüm ilin koordinatörünü aynı anda dışarıda
   * bırakabilirdi (bkz. lib/kvkk/onay.ts · ilkGirisKilidiVarMi). Onaylanan
   * belgeler sonradan Kişisel Verilerim ekranından okunur.
   */
  if (await ilkGirisKilidiVarMi(kullanici)) {
    redirect("/onay");
  }

  /*
   * MENÜ KÜÇÜLDÜ (7 Ağustos 2026 · istek: "menü sayısı azalacak").
   *
   * Öğrencide altı sekme kaldı: Profil · Panel · Etkinlikler · Bağlantılarım ·
   * Pano · Market. Kalkanlar:
   *
   *   · "Katkılarım" — içeriğinin tamamı artık profilde (Görevlerim, katılım
   *     geçmişi, Katkı Nişanlarım). Sayfa SİLİNMEDİ; öğretmen tarafında hâlâ
   *     kendi kartlarını basıyor ve profilden bağlantı veriliyor.
   *   · "Algoritmam" — Panel'in içinde bölüm oldu ("Özdeğerlendirme
   *     Envanterleri"). Sayfa duruyor, envanter çözme oradan yürüyor.
   *
   * Yeniden adlandırılanlar: "Panelim" → "Panel", "Ürünlerim" → "Market"
   * (istek listesindeki başlıklar). "Profil" 20 Ağustos'ta Panel'in içine
   * girdi ve sekmesi kalktı.
   *
   * YÖNETİM SEKMELERİ KALDI: altı sekme herkeste ortak, koordinatör ve merkez
   * bunlara ek olarak kendi ekranlarını görmeye devam ediyor. Onları da
   * kaldırmak, koordinatörün ilindeki öğrenciye ulaşacağı hiçbir giriş
   * bırakmazdı.
   */
  /*
   * GRUP ADLARI (18 Ağustos 2026 · kenar çubuğuna geçiş). Menü dizisi değişmedi
   * — sıra ve kimin neyi gördüğü aynı; her satıra yalnızca hangi başlığın
   * altında duracağı ve ikonu eklendi. Dört başlık var: Genel (kişinin
   * kendisi), Çalışma (işin yapıldığı ekranlar), İletişim (başkasıyla temas),
   * Ekosistem (vitrin).
   */
  /*
   * "PROFİL" SEKMESİ KALKTI (20 Ağustos 2026 · istek: "panel ile profil
   * birleşecek tek panel kalacak, düzenleme ve görüntüleme panelden olacak").
   *
   * İki sekme aynı bilgiyi iki yüzeye bölüyordu: Profil gösteriyor, Panel
   * düzenliyordu. Menüde ikisinin yan yana durması, kullanıcıya her kayıt için
   * "bu hangisinde?" sorusunu sordurdu. Profil ekranının TAMAMI Panel'in
   * içinde ve `/panel/profil` adresi oraya yönleniyor
   * (bkz. app/panel/profil/page.tsx).
   */
  const baglantilar: GezinmeBaglantisi[] = [
    /*
     * SEKMENİN ADI "PROFİL" (25 Ağustos 2026 · istek: "menüdeki panel ismini
     * komple profil yapalım, panel sayfası değil profil sayfası olsun").
     *
     * 20 Ağustos'ta Profil sekmesi Panel'in içine girmişti; ekran o gün
     * fiilen profil oldu (kimlik, CV, çalışma grupları, kartlar) ama adı
     * "Panel" kaldı ve kişi profilini menüde arayamıyordu. Değişen yalnızca
     * ETİKET: adres `/panel` — kayıtlı bağlantılar, yer imleri ve
     * yönlendirmeler kırılmasın.
     */
    { yol: "/panel", etiket: "Profil", grup: "Genel", ikon: "LayoutGrid" },
    /*
     * KİŞİSEL VERİLERİM — ilgili kişi başvuru formu (2 Eylül 2026 ·
     * Genelge 4/ç: aydınlatma metninin yanı sıra başvuru formu da platformda
     * bulunmalı).
     *
     * MENÜ SATIRI 4 EYLÜL 2026'DA YALNIZCA PROJE YÖNETİCİSİNE İNDİ (istek:
     * "fazla göz önünde olmaması lazım, proje yöneticisi için dursun;
     * öğretmen, koordinatör, öğrenci, paydaş, mentör vs. için görünürlüğünü
     * kaldıralım").
     *
     * KALKAN YALNIZCA GÖRÜNÜRLÜK: `/panel/kisisel-verilerim` herkese açık
     * durmaya devam ediyor — sayfada da eylemde de rol kapısı YOK
     * (bkz. kisisel-verilerim/eylemler.ts · "yetki kapısı yok ve olmamalı").
     * Adresi bilen ya da aydınlatma metnindeki yönlendirmeyi izleyen herkes
     * formu doldurup başvurusunu takip edebiliyor; değişen tek şey, satırın
     * kenar çubuğunda herkese basılmaması.
     *
     * NEDEN SAYFA DA KAPATILMADI: başvuru bir HAKTIR (KVKK m.11) ve
     * yürürlükteki aydınlatma metni hakkın bu ekrandan kullanılacağını
     * yazıyor (bkz. lib/kvkk/kurallar.ts). Sayfayı role bağlamak, metnin
     * gösterdiği kapıyı kilitler ve ekranın var oluş sebebini — kişiyi
     * sistemin dışına yollamamayı — ortadan kaldırırdı.
     *
     * ERİŞİLEBİLİRLİK AÇIĞI AYNI GÜN KAPATILDI: 2 Eylül'de bu satır tam da
     * m.13'ün aradığı ERİŞİLEBİLİRLİK için konmuştu ve menüden kalkınca form,
     * pratikte yalnızca adresini bilenin bulabildiği bir yüzeye dönüyordu.
     * Karşılığı sayfa altlığına kondu: her panel ekranının en altında,
     * gezinmenin dışında tek satırlık sessiz bir bağlantı (bkz. aşağıda
     * PanelCercevesi · "ALT BİLGİ"). Altlık YALNIZCA bu satırı menüde
     * görmeyene basılır, yani kimsede iki kapı olmuyor.
     */
    ...(projeYoneticisiMi(kullanici)
      ? [
          {
            yol: "/panel/kisisel-verilerim",
            etiket: "Kişisel Verilerim",
            grup: "Genel",
            ikon: "ShieldUser",
          } as const,
        ]
      : []),
  ];

  /*
   * MEZUN / PAYDAŞ / MENTÖR MENÜSÜ: Profil · Panel · Etkinlikler · Pano · Market
   * (7 Ağustos 2026 · istek: "mezun paydaş mentör sayfasında şu sekmeler
   * olacak" — Profil, Panel, Etkinlikler).
   *
   * PANO 11 AĞUSTOS'TA EKLENDİ (istek: "panelde panoya git var ama üst menüde
   * de pano olması gerekiyor"). Panel sayfası panoyu bu kullanıcının iki
   * hakkından biri olarak anlatıp oraya bir düğme koyuyordu; menüde
   * karşılığının olmaması, panodan çıkan kişiye geri dönecek bir yol
   * bırakmıyordu.
   *
   * MARKET 13 AĞUSTOS'TA EKLENDİ (istek: "mezun, paydaş ve mentör girişlerine
   * market gelecek, onlarda market görünmüyor"). Vitrin bu rollere BAŞTAN BERİ
   * açıktı (bkz. aşağıdaki Market notu: "mezunun ekosistemde göreceği ilk şey
   * buydu"); eksik olan yalnızca menüdeki satırdı, yani sayfa vardı ama kapısı
   * yoktu. Ürün ekleme de bu rollerde çalışıyor — kayıt formu Panel'de.
   *
   * BAĞLANTILARIM ve AKIŞ EKLENDİ (13 Ağustos 2026 · inceleme bulgusu).
   * İkisi de Market'le aynı durumdaydı: sayfa açıktı, kapısı yoktu.
   *
   *   · Bağlantılarım — bu roller yazışmalara erişebiliyor. Sekme
   *     basılmadığı için mezun, açılmış bir yazışmanın mesajını okuyacak
   *     hiçbir yol bulamıyordu: bildirimin "git" düğmesi de yok
   *     (BildirimHedefTipi yalnızca FAALIYET ve EKIP).
   *
   * YETKİ DEĞİŞMEDİ, yalnızca kapı açıldı: iki sayfa da baştan beri bu
   * rollere açıktı ve kapsam filtreleri yerinde duruyor.
   */
  /*
   * MENTÖRLÜĞÜM SEKMESİ — YALNIZCA ONAYLI MENTÖRDE (13 Ağustos 2026 · istek:
   * "mentörlerin kendi sayfası olsun … talepleri inceleyip cevap yazacak").
   *
   * Koşul veritabanına gidiyor, role değil: mentörlük bir rol değil onaya bağlı
   * bir kayıttır (bkz. lib/mentor/veri.ts · onayliMentorMu). Sorgu menüde
   * duruyor çünkü sekmenin varlığı da bir yetki bildirimi — sayfa 404 dönerken
   * menüde adının görünmesi, kullanıcıyı kapalı bir kapıya yollardı.
   *
   * ARTIK YALNIZCA DIŞ KULLANICI MENÜSÜNDE (28 Ağustos 2026): iç kullanıcıdan
   * kaldırıldı, gerekçesi aşağıda. Tanım bu yüzden dış kullanıcı dönüşünden
   * önce duruyor — sorguyu ödeyen tek menü o.
   */
  const mentorSekmesi: GezinmeBaglantisi[] = (await onayliMentorMu(kullanici.id))
    ? [
        {
          yol: "/panel/mentorlugum",
          etiket: "Mentörlüğüm",
          grup: "Çalışma",
          ikon: "Handshake",
        },
      ]
    : [];

  if (disKullaniciMi(kullanici)) {
    baglantilar.push({
      yol: "/panel/etkinlikler",
      etiket: "Etkinlikler",
      grup: "Çalışma",
      ikon: "CalendarDays",
    });
    // Sıra iç kullanıcı menüsüyle aynı: aynı sekmenin iki rolde farklı yerde
    // durması, ekranı birine anlatırken "sende kaçıncı sırada?" sorusunu
    // doğururdu.
    baglantilar.push({
      yol: "/panel/yazismalar",
      etiket: "Bağlantılarım",
      grup: "İletişim",
      ikon: "MessagesSquare",
    });
    baglantilar.push({
      yol: "/panel/talepler",
      etiket: "Pano",
      grup: "İletişim",
      ikon: "ClipboardList",
    });
    /*
     * MEZUN, PAYDAŞ VE MENTÖRDE SEKME DURUYOR (28 Ağustos 2026 · istek: "dış
     * kullanıcıyı eski haline getirmeyi unutma"). İç kullanıcıdan kaldırılırken
     * bir tur boyunca buradan da kalkmıştı; oysa istek öğrenci menüsü içindi.
     *
     * Ayrım keyfî değil: dış kullanıcının menüsü zaten altı satır ve
     * mentörlük, mezun ile paydaşın ekosistemdeki ASIL işi — öğrencinin
     * yanında ise sekiz sekmenin arasına giren ikincil bir kutu.
     */
    // Pano'daki kart menüye taşındı (24 Ekim 2026); dış kullanıcı da başvurabiliyor.
    baglantilar.push({
      yol: "/panel/talepler/genctek-gorevleri",
      etiket: "GençTek görevlerim",
      grup: "Çalışma",
      ikon: "BadgeCheck",
    });
    baglantilar.push(...mentorSekmesi);
    baglantilar.push({
      yol: "/panel/urunler",
      /* "Market" → "GençTek Vitrin" (27 Ağustos 2026 · istek: "market ismi
         değişsin gençtek vitrin olsun"). Ekranın kendisi zaten bir VİTRİN
         olarak tarif ediliyordu (bkz. urunler/page.tsx · kart notu); "market"
         alışveriş çağrıştırıyordu, oysa burada satılan bir şey yok. Adres ve
         yetki değişmedi.

         PARANTEZ İÇİNDE "(Showcase)" (aynı gün · istek: "gençtek vitrinin adı
         GençTek Vitrin (Showcase) olsun menüdeki"). Yalnızca MENÜ ETİKETİ;
         sayfa başlığı, kart adları ve adres Türkçe kaldı. Aynı satır aşağıda
         bir kez daha geçiyor (dış kullanıcı menüsü erken dönüşle kapanıyor) —
         ikisi birlikte değişmeli, yoksa iki rol menüde iki farklı ad okur. */
      etiket: "GençTek Vitrin (Showcase)",
      grup: "Ekosistem",
      ikon: "Store",
    });
    return (
      <PanelCercevesi
        kullanici={kullanici}
        tema={tema}
        baglantilar={baglantilar}
        ilAdlari={ilAdlari}
      >
        {children}
      </PanelCercevesi>
    );
  }

  /*
   * YÖNETİM PANELİ, PANEL'İN HEMEN ARDINDA (11 Ağustos 2026 · istek: "öğrenciler
   * ve öğretmenler sekmesi kalkacak yönetim paneli sekmesine gelecek, paydaşlar
   * ve okullar da yönetim paneline gelecek, görev rolleri de").
   *
   * Beş sekme tek sekmeye indi: Öğrenciler · Öğretmenler · Paydaşlar · Görev
   * Rolleri · Mentörlük artık panonun İÇİNDE kart olarak duruyor
   * (bkz. app/panel/yonetim/page.tsx). Ekranların hiçbiri silinmedi ve hiçbir
   * yetki daralmadı — değişen tek şey, oraya hangi kapıdan girildiği.
   *
   * Yeri eskiden Öğrenciler'in durduğu yer: koordinatörün ve merkezin günlük
   * işi bu sekmede başlıyor.
   */
  if (yonetimPanosuGorebilirMi(kullanici)) {
    baglantilar.push({
      yol: "/panel/yonetim",
      etiket: "Yönetim Paneli",
      grup: "Çalışma",
      ikon: "ShieldCheck",
    });
  }

  /*
   * DANIŞMAN ÖĞRETMENDE "ÖĞRENCİLERİM" SEKMESİ KALKTI (13 Ağustos 2026 · istek:
   * "danışman öğretmenin öğrencilerim menüsü kalkacak, panelde zaten
   * danışmanlığımdaki öğrenciler var, danışmanlığımdaki öğrenciler öğrencilerim
   * olacak").
   *
   * Sekme 7 Ağustos'ta, listeye gidecek başka yol olmadığı için konmuştu; o
   * gerekçe artık geçerli değil — Panel'de aynı ekrana giden sayılı kart duruyor
   * ve adı isteğe uyarak "Öğrencilerim" oldu (bkz. app/panel/page.tsx). Aynı
   * listeye koordinatör ve merkez de kendi kartlarından giriyor, yani üç rolde
   * de kapı tek biçimde panelde.
   *
   * SAYFA SİLİNMEDİ ve YETKİ DARALMADI: `/panel/ogrenciler` adresle çalışmaya,
   * danışman kendi öğrencilerini görmeye ve Okul Temsilcisi atamaya devam
   * ediyor (bkz. ogrenciEnvanteriGorebilirMi). Değişen tek şey menüdeki satır.
   */

  /*
   * "Çalışma Gruplarım" ve "Danışmanım" MENÜDE YOK (B3/C1 · 5 Ağustos 2026).
   * İkisi de Panelim sayfasının içinde bölüm olarak duruyor ve seçim oradan
   * yapılıyor. Sayfaları SİLİNMEDİ: `/panel/danisman-secim` aynı zamanda giriş
   * kapısıdır (danışmansız öğrenci oraya düşer), `/panel/calisma-gruplari` ise
   * bildirim e-postalarındaki ve yer imlerindeki adreslerde duruyor.
   */

  /*
   * "KATKILARIM" ve "ALGORITMAM" SEKMELERİ KALKTI (7 Ağustos 2026).
   *
   * Katkılarım'ın içeriği profile taşındı: Görevlerim, katılım geçmişi ve
   * Katkı Nişanlarım orada. Ekran silinmedi — öğretmen tarafında kendi
   * kartlarını basmaya devam ediyor ve profilden bağlantı veriliyor.
   *
   * Algoritmam, Panel'in içinde "Özdeğerlendirme Envanterleri" bölümü oldu.
   * Sayfa duruyor ve envanterler oradan çözülüyor; yalnızca menüdeki satır
   * kalktı. Envanter sonuçları hâlâ KİŞİYE ÖZELDİR: hiçbir yetkili ekranında
   * görünmez (bkz. app/panel/algoritmam/eylemler.ts).
   */

  // Faaliyetler herkese açıktır; kimin ne göreceğini kapsam filtresi belirler.
  // Görev almamış öğretmen de okulunun ve ulusal faaliyetleri görür; mezun ve
  // paydaş temsilcisi ulusal ve kendi ilindeki etkinlikleri takvim olarak görür
  // ama başvuramaz (bkz. basvuruYapabilirMi).
  baglantilar.push({
    yol: "/panel/etkinlikler",
    etiket: "Etkinlikler",
    grup: "Çalışma",
    ikon: "CalendarDays",
  });

  /*
   * GENÇTEK GÖREVLERİM SOL MENÜDE (23 Ekim 2026 · istekler: öğretmen sayfasında
   * "Gençtek görevlerim yine ana menüde", koordinatör sayfasında "Gençtek
   * görevleri sol menüde"). Öğrencide giriş Panel'deki kart; öğretmen ve
   * koordinatörün kendi görevleri bu ekranda.
   *
   * PANODAKİ KART MENÜYE TAŞINDI (24 Ekim 2026 · istekler: "panodaki gençtek
   * görevlerim var o soldaki menüye taşınacaktı" · "başvurulabilir olanları
   * görüp başvuracak"). Satır artık açık görevlerin başvuru ekranına gidiyor
   * ve ÖĞRENCİDE DE basılıyor — Pano'daki kart herkese açıktı. Aldığı
   * görevlerin listesi (/panel/gorevlerim) o ekrandan bağlantıyla açılıyor.
   * Proje yöneticisi görevleri yönetir; onun kapısı Pano'daki onay kartı.
   */
  if (!projeYoneticisiMi(kullanici)) {
    baglantilar.push({
      yol: "/panel/talepler/genctek-gorevleri",
      etiket: "GençTek görevlerim",
      grup: "Çalışma",
      ikon: "BadgeCheck",
    });
  }

  /*
   * "Bağlantılarım" (eski adı Yazışmalar) herkese açık; kimin ne göreceğini
   * kapsam filtresi belirler. Öğrenci kendi yazışmalarını, danışman
   * öğrencilerininkini, koordinatör ilindekileri görür.
   *
   * İSTEKTEKİ ALT BAŞLIKLAR: "Mesajlar · Sohbet · Bağlantılarım". Mesajlar ve
   * bağlantı onayları bu ekranın içinde; **Sohbet (grup) HENÜZ YOK** — G
   * maddesi S19/S20 cevaplarını bekliyor.
   */
  baglantilar.push({
    yol: "/panel/yazismalar",
    etiket: "Bağlantılarım",
    grup: "İletişim",
    ikon: "MessagesSquare",
    // Öğrencide satır pasif (23 Ekim 2026 · bkz. lib/yazisma/politika.ts).
    pasifNedeni: baglantilarimKapaliMi(kullanici)
      ? BAGLANTILARIM_KAPALI_ACIKLAMASI
      : undefined,
  });

  /*
   * AKIŞ TAMAMEN KALKTI (21 Ağustos 2026 · istek: "akışı da kaldır"). 12
   * Ağustos'ta ayrı sekme, 14 Ağustos'ta Bağlantılarım'ın içinde bir bölümdü;
   * şimdi bölüm de eylemleri de yok. `/panel/akis` adresi 404 vermesin diye
   * duruyor ve Bağlantılarım'a yönlendiriyor.
   */

  /*
   * "İLETİŞİM ONAYLARI" ARTIK AYRI EKRAN DEĞİL (12 Ağustos 2026 · istek:
   * "yazışmalar ve bağlantılar isminde iki bölüm var, onları birleştirip
   * linkedin tarzı bir bölüm yapmak istiyorum · menüdeki bağlantılarım
   * alanında olsun").
   *
   * 7 Ağustos'ta sekmesi kalkmış, girişi bu sayfanın başına bir kart olarak
   * konmuştu; o kart da kalktı. Bekleyen istekler doğrudan Bağlantılarım'ın
   * içinde, bağlantı listesinin üstünde basılıyor. `/panel/baglantilar` adresi
   * duruyor ve buraya yönlendiriyor.
   */

  /*
   * Pano (eski adıyla Talep Panosu) SİSTEMDEKİ HERKESE açık — proje yöneticisi
   * dahil (13 Ağustos 2026 · istek: "proje yöneticisinin pano sayfası
   * görünmüyor, diğer kullanıcılarda var").
   *
   * Sekme daha önce merkez personelinde basılmıyordu çünkü görme ile ilan açma
   * tek izinden geçiyordu ve merkez ilan açmıyor. Sonuç, sistemin en canlı
   * kullanıcı alanının onu yönetenden gizlenmesiydi. İkisi ayrıldı: merkez
   * panoyu okumaya başladı.
   *
   * 14 AĞUSTOS 2026'DA İLAN AÇMA DA AÇILDI (istekler: "proje yöneticisi panodan
   * destek talebi açabilsin", "mentör talebi açabilsin proje yöneticisi") —
   * bkz. panodaIlanAcabilirMi. Merkeze kapalı kalan tek şey BAĞLANTI İSTEĞİ
   * (panodaEslesmeArayabilirMi): ilan açık bir metindir, bağlantı isteği kişiye
   * yönelen ve onaydan geçen bir temastır.
   *
   * PANO EKOSİSTEM DIŞINA AÇILMAZ (S21 · 6 Ağustos 2026): ilanları yalnızca
   * sisteme girmiş kullanıcılar görür. Sponsor ilanı da bu kuralın içindedir —
   * dışarıya açık bir ilan sayfası istenirse bu ayrı bir karardır ve KVKK
   * tarafı yeniden değerlendirilmelidir (ilanı açan çoğunlukla 18 yaş altı).
   */
  baglantilar.push({
    yol: "/panel/talepler",
    etiket: "Pano",
    grup: "İletişim",
    ikon: "ClipboardList",
  });

  /*
   * "MENTÖRLÜĞÜM" İÇ KULLANICI MENÜSÜNDE YOK (28 Ağustos 2026 · istek: "birisi
   * mentör olarak başvurup mentörlüğüne onay verildiğinde sol menüde
   * Mentörlüğüm diye yeni menü öğesi ekleniyor … orada mentörlüğüm menüsü
   * olmamalı" — örnek hesap onaylı mentör bir ÖĞRENCİYDİ).
   *
   * Sekme 15 Ağustos'ta koordinatör ve merkezden kalkmıştı; bugün öğrenci ve
   * danışmandan da kalktı. Menünün onay geldiğinde KENDİLİĞİNDEN uzaması
   * istenmeyen davranıştı: kişi ezberlediği sıranın değiştiğini fark ediyor
   * ama bunu neyin yaptığını anlamıyordu.
   *
   * DIŞ KULLANICIDA (mezun, paydaş, mentör) SEKME DURUYOR — yukarıya bakın.
   *
   * SAYFA VE YETKİ DURUYOR, DEĞİŞEN KAPI. /panel/mentorlugum yerinde ve her
   * onaylı mentöre açık; öğrenci ve danışman oraya Profil'deki
   * "Mentörlüklerim" kartından giriyor (bkz. app/panel/page.tsx) — kart rolü
   * olan herkeste basılıyor ve onaylıda doğrudan bu sayfaya gidiyor.
   * Koordinatör ve merkezin kapısı ise Yönetim Paneli'ndeki "Mentörlüğüm"
   * kartı (bkz. app/panel/yonetim/page.tsx), 15 Ağustos'tan beri orada.
   */

  /*
   * ÜRÜNLERİM (GençTek Market) HERKESE AÇIK (I · 6 Ağustos 2026).
   *
   * İstekteki sekme adı "Ürünlerim" ama içerik bir vitrindir: öğrenci
   * ürünleri, öğretmen ürünleri ve kişinin kendi ürünleri aynı ekranda
   * süzgeçle ayrılıyor. Bu yüzden Algoritmam gibi tek role bağlanmadı —
   * öğretmenin de ürünü olabiliyor ve istekte "Öğretmen Ürünleri" ayrı bir
   * süzgeç olarak sayılmış.
   *
   * DIŞ KULLANICILAR da görüyor: mezunun ekosistemde göreceği ilk şey buydu
   * ve market, A1'in gerekçesindeki "mezun bağını sürdürsün" beklentisine
   * karşılık gelen tek ekran. Vitrin ekosistem içine kapalı; dışarıya açık
   * bir ürün sayfası ayrı bir karardır (pano ile aynı ilke · S21).
   */
  baglantilar.push({
    yol: "/panel/urunler",
    /* Etiket dış kullanıcı menüsündekiyle AYNI olmalı (bkz. yukarıdaki not ·
       "(Showcase)" 27 Ağustos 2026). */
    etiket: "GençTek Vitrin (Showcase)",
    grup: "Ekosistem",
    ikon: "Store",
  });

  /*
   * PAYDAŞLAR, GÖREV ROLLERİ ve MENTÖRLÜK SEKMELERİ KALKTI (11 Ağustos 2026);
   * üçü de yönetim panosunda kart oldu. Yetkileri değişmedi: paydaş kaydını
   * yine koordinatör ve merkez açıyor, il/ilçe temsilciliğini yine onlar
   * veriyor, mentör başvurusunu yine onlar onaylıyor.
   *
   * Danışman öğretmen bu üç ekranı zaten menüsünde görmüyordu (B3/J2/J4 ·
   * 5 Ağustos 2026) ve durumu değişmedi: Okul Temsilcisi'ni Öğrencilerim
   * ekranından veriyor, paydaşı etkinlik detayından bağlıyor.
   *
   * RAPORLAR ve BELGE OLUŞTUR da menüde değil (J3 · 6 Ağustos 2026): ikisi de
   * etkinlikten doğan işler ve girişleri etkinlik detayında. "Hangi raporlar
   * eksik" toplu görünümü Etkinlikler ekranındaki "Raporu bekleyenler"
   * süzgecinde.
   *
   * HİÇBİR SAYFA SİLİNMEDİ: adresler ve e-postalardaki bağlantılar çalışmaya
   * devam ediyor.
   */

  /*
   * İL DIŞI BAŞVURULAR SEKMESİ KALKTI (11 Ağustos 2026 · istek: "koordinatörün
   * etkinlikler sayfası ile il dışı başvuru sayfalarını birleştirelim, il dışı
   * başvurular kalksın, hepsi etkinliklerde olsun").
   *
   * Sayfa da silindi, menüden çıkarılmakla kalmadı. Karar zaten etkinliğe ait
   * bir karardı — "öğrencim bu etkinliğe gitsin mi" — ve ayrı bir sekmede
   * durması koordinatörü iki ekran arasında gezdiriyordu: etkinliği burada,
   * başvurusunu orada görüyordu. Liste artık Etkinlikler ekranının bir bölümü
   * (`#il-disi`) ve karar ayrıca her etkinliğin başvuru satırından da
   * verilebiliyor.
   */

  /*
   * DIŞ GİRİŞ BAŞVURULARI SEKMESİ KALKTI (11 Ağustos 2026 · istek: "dış giriş
   * başvuruları sayfası paydaşların içine gelecek"). Ekranın girişi artık
   * Paydaşlar sayfasının başında; ikisi aynı işin iki ucu — biri kurumu, öbürü
   * o kurumu temsil eden kişiyi sisteme alıyor.
   *
   * ROL/ATAMA ENVANTERİ SEKMESİ DE KALKTI (aynı gün · istek: "rol atama
   * envanteri koordinatör kartına gelecek"): yönetim panosunda "Koordinatörler"
   * kartı olarak duruyor. Ekranın içeriği zaten koordinatör envanteridir.
   *
   * İkisinin de sayfası ve yetkisi yerinde; değişen yalnızca kapı.
   */
  /*
   * ERİŞİM KAYITLARI · MESAJ GÖNDER · SİSTEM AYARLARI SEKMELERİ KALKTI
   * (14 Ağustos 2026 · istek: "yönetim panelinde erişim kayıtları ve mesaj
   * gönder ve sistem ayarları kart olarak var menüden kaldır").
   *
   * Üçü 11 Ağustos'ta Yönetim Paneli'ne kart olarak inmişti ama sekmeleri de
   * bırakılmıştı ("ikisi de günlük iş"); sonuç, merkezin menüsünde aynı üç
   * ekranın iki ayrı kapısıydı. Kapı artık tek: Yönetim Paneli
   * (bkz. app/panel/yonetim/page.tsx).
   *
   * SAYFALAR VE YETKİLER DEĞİŞMEDİ — her biri kendi `rolEnvanteriGorebilirMi`
   * / `sistemAyarlariniYonetebilirMi` kontrolünü kendi içinde yapmaya devam
   * ediyor; kaldırılan yalnızca menü satırı.
   */

  /*
   * KVKK/belge sekmesi MENÜDE YOK (5 Ağustos 2026). Belgeler artık profilin en
   * altında (`/panel#kvkk`): metin üye olurken okutuluyor, sonrasında lazım
   * olduğunda panelden açılıyor. Menüden kaldırmak erişimi kapatmak
   * DEĞİLDİR — onayladığı belgeye erişemeyen kullanıcı KVKK açısından
   * savunulamaz; bu yüzden bölüm kaldırılmadı, taşındı.
   */

  return (
    <PanelCercevesi
      ilAdlari={ilAdlari}
      kullanici={kullanici}
      tema={tema}
      baglantilar={baglantilar}
    >
      {children}
    </PanelCercevesi>
  );
}

/**
 * Panelin dış çerçevesi: üst bar, rol etiketleri, onay şeridi ve gezinme.
 *
 * AYRI BİLEŞEN çünkü düzen iki yerden dönüyor: dış kullanıcı menüsü erken
 * dönüşle kapanıyor (üç sekme) ve kalan roller aşağıdan. İki kopya JSX,
 * birinde yapılan bir değişikliğin öbüründe unutulması demek olurdu.
 */
function PanelCercevesi({
  kullanici,
  tema,
  baglantilar,
  ilAdlari,
  children,
}: {
  kullanici: NonNullable<Awaited<ReturnType<typeof oturumKullanicisi>>>;
  tema: Awaited<ReturnType<typeof aktifTema>>;
  baglantilar: GezinmeBaglantisi[];
  /*
   * Rol etiketlerinde basılacak İL ADLARI, il koduna göre (26 Ağustos 2026).
   * Çerçeve saf bir bileşen — veriyi kendisi çekmiyor, düzen bileşeni veriyor.
   */
  ilAdlari: Map<string, string>;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      {/*
        İNCE KOYU ŞERİT. Kurum kimliği ve tema seçimi buraya indi: ikisi de
        günlük işin parçası değil, sayfanın her yerinde aynı duran künye
        bilgisi. Beyaz menü barında yer kapladıklarında kullanıcının adını ve
        çıkış düğmesini sıkıştırıyorlardı.
      */}
      {/*
        `yazdirma-disi` (18 Ağustos 2026): şerit, menü barı ve kenar çubuğu
        yazdırmada basılmaz — gezinme kâğıtta tıklanamaz ve sayfanın üçte
        birini yer. Kural globals.css'teki @media print bloğunda; buradaki üç
        işaret o kuralın tutunduğu yerler. Yeni bir panel ekranı eklerken
        ayrıca bir şey yapmak gerekmiyor, çatı zaten işaretli.
      */}
      <div className="yazdirma-disi bg-serit text-serit-metin">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-3 px-6 py-2">
          <p className="text-[11px] font-semibold tracking-widest uppercase">
            T.C. Millî Eğitim Bakanlığı · YEĞİTEK
          </p>
          <TemaSecici aktif={tema} />
        </div>
      </div>

      {/*
        BEYAZ MENÜ BARI. `sticky`: kenar çubuğuna geçince sayfalar uzadı ve
        aşağı inen kullanıcının kimliğini/çıkışını görecek yeri kalmıyordu.
      */}
      <header className="yazdirma-disi sticky top-0 z-30 border-b border-ust-bar-cizgi bg-ust-bar">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-4 px-6 py-3">
          <Link href="/panel" className="flex items-center gap-3">
            {/*
              Logo artık beyaz kutu İÇİNDE DEĞİL: bar beyaza döndüğü için
              kırmızı logo doğrudan zemine oturuyor (açılış ekranında durum
              tersi — orada zemin kırmızı ve kutu şart).

              next/image kullanılmıyor: dosya public dizininde, boyutu sabit.
              Yol uygulamaYolu()'ndan geçiyor çünkü uygulama alt dizine kurulu.
            */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={uygulamaYolu("/genc.png")}
              alt=""
              aria-hidden
              className="size-10 object-contain"
            />
            <span>
              <span className="block text-[10px] font-bold tracking-widest text-vurgu-metin uppercase">
                MEB · YEĞİTEK
              </span>
              <span className="block font-baslik text-lg leading-tight font-extrabold text-ust-bar-metin">
                GençTek
              </span>
              <span className="block text-xs text-ust-bar-metin-yumusak">
                Genç Bilişim Ekosistemi
              </span>
            </span>
          </Link>

          <div className="flex flex-wrap items-center gap-3">
            {/*
              ROL ADIN ALTINDA (21 Ağustos 2026 · istek: "sol menü üstündeki
              YETKİM / Öğrenci kalksın, öğrenci adının altına öğrenci yazısı
              gelsin — sağ üstteki öğrenci adı").

              Kenar çubuğunun tepesindeki "Yetkim" kutusu kalktı: menünün
              başında duran bir kutu, menüyü aşağı itiyordu ve rol bilgisi
              zaten kimliğin bir parçası — adın altında duracağı yer burası.

              Birden fazla rol yan yana basılıyor: il koordinatörü aynı anda
              danışman olabiliyor ve rollerden yalnızca birini yazmak, kişinin
              menüde neden fazladan başlık gördüğünü açıklamazdı.
            */}
            <div className="text-right">
              <p className="text-sm font-semibold text-ust-bar-metin">
                {kullanici.ad} {kullanici.soyad}
              </p>
              <div className="mt-1 flex flex-wrap justify-end gap-1">
                {kullanici.roller.length === 0 ? (
                  <RolsuzEtiketi />
                ) : (
                  kullanici.roller.map((rol) => (
                    <RolEtiketi
                      key={rol.rolKodu}
                      rolKodu={rol.rolKodu}
                      ekBilgi={
                        rol.ilKodu === null
                          ? undefined
                          : (ilAdlari.get(rol.ilKodu) ?? undefined)
                      }
                    />
                  ))
                )}
              </div>
            </div>
            <form action={cikisEylemi}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-kutu border border-cizgi-guclu px-3 py-2 text-sm font-medium text-ust-bar-metin-yumusak transition hover:border-vurgu hover:text-vurgu-metin"
              >
                <LogOut size={15} aria-hidden />
                Çıkış
              </button>
            </form>
          </div>
        </div>
      </header>

      {/*
        GÖVDE: kenar çubuğu + içerik.

        Kenar çubuğu dar ekranda GİZLENMİYOR, üste geçiyor: PanelGezinme 1024
        pikselin altında kendini yatay kaydırılan bir rozet şeridine çeviriyor
        (bkz. components/PanelGezinme.tsx). Bu yüzden `aside` iki durumda da
        basılır — `hidden lg:block` verilseydi telefonda menü hiç görünmezdi.
      */}
      <div className="mx-auto flex max-w-[1240px] flex-col gap-8 px-6 py-8 lg:flex-row">
        <aside className="yazdirma-disi lg:w-56 lg:shrink-0">
          <div className="lg:sticky lg:top-24">
            {/*
              "YETKİM" KUTUSU KALKTI (21 Ağustos 2026 · istek). Roller üst
              barda, adın hemen altında basılıyor.
            */}

            <PanelGezinme baglantilar={baglantilar} />
          </div>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>

      {/*
        ALT BİLGİ — İLGİLİ KİŞİ BAŞVURUSUNUN GÖRÜNÜR KAPISI (4 Eylül 2026).

        Aynı gün "Kişisel Verilerim" menü satırı yalnızca proje yöneticisine
        indirildi (istek: "fazla göz önünde olmasın"). Satır kalkınca form,
        pratikte yalnızca adresini bilenin bulabildiği bir yüzeye dönüyordu ve
        KVKK m.13'ün aradığı ERİŞİLEBİLİRLİK ile Genelge 4/ç bunu karşılamaz:
        bulunması aramayı bilmeyi gerektiren bir başvuru yolu, olmayan bir
        başvuru yoludur. Üstelik yürürlükteki aydınlatma metni hakların "Kişisel
        Verilerim ekranındaki formla" kullanılacağını YAZIYOR
        (bkz. lib/kvkk/kurallar.ts) — gösterdiği kapının bulunabilir olması
        gerekiyor.

        MENÜ SATIRI DEĞİL, ALT BİLGİ: istek satırın göz önünde olmamasıydı,
        erişimin kapanması değil. Sayfa altlığı ikisini birden karşılıyor —
        her panel ekranının en altında, gezinmenin dışında, tek satır ve sessiz.
        Kimseyi durdurmuyor, kimseye bir şey okutmuyor, menüdeki sırayı
        değiştirmiyor.

        YALNIZCA MENÜDE GÖRMEYENE BASILIR: proje yöneticisinde satır zaten
        kenar çubuğunda ve aynı ekrana iki kapı, kullanıcıya "bunlar farklı
        şeyler mi?" sorusunu sordururdu. Koşul menüdeki gateyle AYNI yardımcıyı
        soruyor (projeYoneticisiMi) — iki ayrı ölçüt yazılsaydı biri
        değiştiğinde öbürü sessizce ayrışır, kullanıcı ya iki kapı ya hiç kapı
        görürdü.

        Çerçeve `kullanici`yi zaten alıyor ve koşulu KENDİ soruyor; düzenden
        prop olarak geçirilseydi iki ayrı çağrı yerinde (dış kullanıcı erken
        dönüşü ve normal dönüş) tek tek verilmesi gerekirdi — bu dosyanın
        bileşeni tam olarak o unutulma yüzünden tek yere toplanmıştı.

        `yazdirma-disi`: gezinme gibi, kâğıtta işi yok.
      */}
      {!projeYoneticisiMi(kullanici) && (
        <footer className="yazdirma-disi border-t border-cizgi">
          <div className="mx-auto max-w-[1240px] px-6 py-4">
            <Link
              href="/panel/kisisel-verilerim"
              className="text-xs text-metin-yumusak underline-offset-4 transition hover:text-vurgu-metin hover:underline"
            >
              Kişisel verileriniz: haklarınız ve başvuru formu
            </Link>
          </div>
        </footer>
      )}
    </div>
  );
}
