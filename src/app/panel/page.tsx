import {
  ArrowRight,
  Award,
  BadgeCheck,
  Camera,
  CalendarDays,
  CheckSquare,
  Compass,
  FileDown,
  FileText,
  GraduationCap,
  Handshake,
  IdCard,
  Layers,
  Link2,
  Mail,
  MapPin,
  Pencil,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCheck,
  UserRound,
  Users,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import {
  BilgiKutusu,
  Kart,
  KartBasligi,
  KatlanabilirKart,
  OlcumKarti,
  Rozet,
  RozetSeridi,
  SINIF_BIRINCIL_BUTON,
  SINIF_GIRDI,
  SINIF_IKINCIL_BUTON,
  SINIF_VITRIN_BUTON,
  SINIF_VITRIN_IKINCIL_BUTON,
  Vitrin,
} from "@/components/ui";
import {
  KatilimKarti,
  SaltOkunurAlan,
} from "@/components/OgrenciProfilBolumleri";
import {
  CvDuzenleme,
  DanismanlikDuzenleme,
  DestekGruplariDuzenleme,
  FotografDuzenleme,
  GirilenKayitlar,
  IletisimDuzenleme,
  KayitEklemeFormu,
  ProfilFotografi,
  ReferansDuzenleme,
} from "@/components/ProfilDuzenleme";
import { SeviyeYildizlari } from "@/components/SeviyeYildizlari";
import { YolculukSeridi } from "@/components/YolculukSeridi";
import { oturumKullanicisiZorunlu } from "@/lib/auth/oturum";
import { danismanSecimVerisiGetir } from "@/lib/danisman/atama";
import { calismaGruplariniGetir } from "@/lib/ogrenci/calisma-grubu";
import { REFERANS_AZAMI_SAYI } from "@/lib/referans/kurallar";
import {
  danismanBilgisiEylemi,
  danismanlikEylemi,
  destekGruplariEylemi,
  genelBilgilerEylemi,
  ilOkulVerisiGetir,
  profilFotoSilEylemi,
  profilFotoYukleEylemi,
  profilGuncelleEylemi,
} from "./profil/eylemler";
import { ILLER } from "../../../prisma/veri/iller";
import { DanismanBilgisiDuzenleme } from "@/components/DanismanBilgisiDuzenleme";
import { GenelBilgilerDuzenleme } from "@/components/GenelBilgilerDuzenleme";
import { OKUL_LISTEDE_YOK } from "@/lib/kayit/kurallar";
import {
  genelBilgilerDuzenlenebilirMi,
  genelBilgilerTipi,
} from "@/lib/ogrenci/genel-bilgiler";
import { formOkulTuru } from "@/lib/okul/turler";
import {
  EKIPLER_KAPALI_ACIKLAMASI,
  ekiplerKapaliMi,
} from "@/lib/ekip/kurallar";
import {
  referansEkleEylemi,
  referansGuncelleEylemi,
  referansSilEylemi,
} from "./profil/referans-eylemleri";
import {
  cvEkNotuKaydetEylemi,
  cvSilEylemi,
  cvYukleEylemi,
  kazanimBelgeEkleEylemi,
  kazanimBelgeSilEylemi,
  kazanimEkleEylemi,
  kazanimSilEylemi,
} from "./profil/kazanim-eylemleri";
import { kazanimEkSinirlariniGetir } from "@/lib/kazanim/ek";
import {
  kayitEklemeGruplari,
  kazanimGrupCapasi,
  kazanimTipiGecerliMi,
} from "@/lib/kazanim/kurallar";
import { profilFotoSinirlariniGetir } from "@/lib/kullanici/profil-foto";
import { MENTORLUK_DURUM_ETIKETLERI } from "@/lib/mentor/kurallar";
import { mentorluguGetir } from "@/lib/mentor/veri";
import { ogretmenKatkiSayilariGetir } from "@/lib/ogretmen/katki";
import { seviyeAdiTirnakli } from "@/lib/yolculuk/kurallar";
import { ogrencilerimYolculuguGetir } from "@/lib/yolculuk/ogrencilerim";
import { yolculugumuGetir } from "@/lib/yolculuk/veri";
import { katkiKartiMetni } from "@/lib/ogretmen/katki-ozeti";
import { HAKKINDA_MAKS } from "@/lib/akis/kurallar";
import { ekipSayimiGetir } from "@/lib/ekip/veri";
import { hakkindaKaydetEylemi } from "./profil/hakkinda-eylemi";
import { cvSinirlariniGetir } from "@/lib/ogrenci/cv";
import { CV_EK_NOTU_AZAMI } from "@/lib/ogrenci/cv-kurallar";
import { uygulamaYolu } from "@/lib/ortam";
import { ilKoordinatoruOzeti } from "@/lib/rol/koordinator";
import { okulTemsilcileriniGetir } from "@/lib/rol/okul-temsilcisi";
import { prisma } from "@/lib/db";
import { seritteGosterilecekler } from "@/lib/faaliyet/takvim";
import {
  kazanimlariGetir,
  ogretmenKazanimlariGetir,
} from "@/lib/kazanim/getir";
import { katkiVerisiGetir } from "@/lib/ogrenci/katki";
import {
  kullaniciRolEtiketi,
  vitrinRolUnvani,
} from "@/lib/yetki/etiketler";
import { rolIlAdlariniGetir } from "@/lib/yetki/rol-il-adlari";
import { tarihSaatYaz } from "@/lib/tarih";
import { tarihYaz } from "@/lib/tarih";
import {
  basvuruYapabilirMi,
  disKullaniciMi,
  mezunMu,
  danismanMi,
  ilKoordinatoruMu,
  koordinatorIlKodu,
  mentorlukBasvurabilirMi,
  ogrenciMi,
  referansTutabilirMi,
  projeYoneticisiMi,
} from "@/lib/yetki/izinler";
import {
  faaliyetKapsamFiltresi,
  ogrenciKapsamFiltresi,
} from "@/lib/yetki/kapsam";
import {
  yegitekSorumlusuIsaretiEylemi,
} from "./eylemler";
import { danismanlikIsaretiEylemi } from "./ogrenciler/eylemler";

export const dynamic = "force-dynamic";

/**
 * Panelim'den yapılan işlemlerin geri bildirimi.
 *
 * Seçim eylemleri iki yerden çağrılıyor (buradaki bölümler ve eski sekme
 * sayfaları); dönüş adresine göre mesaj burada da basılmalı, yoksa öğrenci
 * kaydettikten sonra hiçbir onay görmez ve işlemin geçtiğinden emin olamaz.
 *
 * Profil düzenleme mesajları da buraya EKLENDİ (7 Ağustos 2026): formlar
 * profilden Panelim'e taşındı, dolayısıyla eylemlerin dönüş adresi de burası.
 */
const DURUM_MESAJLARI: Record<string, string> = {
  secildi: "Danışman öğretmeniniz kaydedildi.",
  birakildi:
    "Danışmanlık sonlandırıldı ve öğretmene bilgi verildi. Yeni danışmanınızı istediğiniz zaman seçebilirsiniz.",
  kaydedildi: "Çalışma grubu seçiminiz kaydedildi.",
  "iletisim-kaydedildi": "İletişim bilgileriniz kaydedildi.",
  "genel-bilgiler-kaydedildi": "Genel bilgileriniz kaydedildi.",
  "danisman-bilgisi-kaydedildi": "Danışman öğretmen bilgileriniz kaydedildi.",
  "kazanim-eklendi": "Kayıt profiline eklendi.",
  "kazanim-silindi": "Kayıt silindi.",
  "cv-yuklendi": "CV'niz yüklendi.",
  "cv-silindi": "CV'niz kaldırıldı.",
  "foto-yuklendi": "Profil fotoğrafınız güncellendi.",
  "foto-silindi": "Profil fotoğrafınız kaldırıldı.",
  "belge-eklendi": "Destekleyici belge eklendi.",
  "belge-silindi": "Destekleyici belge kaldırıldı.",
  // "Hakkımda" iki ekrandan da kaydedilebiliyor; ileti ikisinde de basılmalı.
  "hakkinda-kaydedildi": "Hakkımda metniniz kaydedildi.",
  "yegitek-isaretlendi":
    "YEĞİTEK Okul Sorumlusu olarak işaretlendiniz. Proje yöneticisi listesinde görünüyorsunuz.",
  "yegitek-kaldirildi": "YEĞİTEK Okul Sorumlusu işaretiniz kaldırıldı.",
  /*
   * Mentörlük iletileri panoya taşındı (13 Ağustos 2026): başvuru bölümü orada
   * ve eylemler oraya dönüyor (bkz. talepler/page.tsx · DURUM_MESAJLARI).
   */
  "destek-gruplari-kaydedildi":
    "Katkı verebileceğiniz çalışma grupları kaydedildi.",
};

export default async function PanelSayfasi({
  searchParams,
}: {
  searchParams: Promise<{
    hata?: string;
    durum?: string;
    bolum?: string;
    /*
     * Kayıt formunun türü (22 Ağustos 2026): çok tipli grupta (Deneyimlerim)
     * seçilen tür adreste taşınıyor — sayfada JavaScript yok ve form o türe
     * göre sunucuda basılmak zorunda.
     */
    tur?: string;
  }>;
}) {
  const {
    hata: seciimHatasi,
    durum: secimDurumu,
    bolum: acilacakBolum,
    tur: istenenTur,
  } = await searchParams;
  const kullanici = await oturumKullanicisiZorunlu();

  /*
   * Yalnızca SAYI çekiliyor: bildirim listesi bu ekrandan kalktığı için
   * (bkz. aşağıdaki "BİLDİRİMLER BÖLÜMÜ KALKTI" notu) satırların kendisine
   * ihtiyaç yok. Sorgu `bildirim(kullanici_id, okundu_mu)` dizinine oturuyor.
   */
  const okunmamisMesajSayisi = await prisma.bildirim.count({
    where: { kullaniciId: kullanici.id, okunduMu: false },
  });

  const kapsamdakiOgrenciSayisi = await prisma.kullanici.count({
    where: ogrenciKapsamFiltresi(kullanici),
  });

  /*
   * ÖĞRENCİNİN SEÇİM BÖLÜMLERİ (C1 · 5 Ağustos 2026).
   *
   * "Çalışma Gruplarım" ve "Danışmanım" sekmeleri menüden kalktı; ikisi de
   * artık bu sayfanın içinde bölüm. Sorgular ve formlar sekmelerdekiyle AYNI
   * kaynaktan geliyor (lib/danisman/atama.ts, lib/ogrenci/calisma-grubu.ts) —
   * ayrı yazılsalardı iki yüzey zamanla ayrışırdı.
   */
  const danismanVerisi = ogrenciMi(kullanici)
    ? await danismanSecimVerisiGetir(kullanici)
    : null;
  const atama = danismanVerisi?.atama ?? null;

  const calismaGruplari = ogrenciMi(kullanici)
    ? await calismaGruplariniGetir(kullanici.id)
    : null;
  const grupSayisi = calismaGruplari?.seciliIdler.size ?? 0;

  /*
   * ---------------------------------------------------------------------
   * PROFİL DÜZENLEME VERİSİ (C4 · 7 Ağustos 2026)
   * ---------------------------------------------------------------------
   * Formlar 7 Ağustos 2026'da profilden buraya taşındı; 20 Ağustos'ta
   * gösterim de geldi ve iki yüzey tek ekranda birleşti. Formların ihtiyaç
   * duyduğu veri bu yüzden burada hazırlanıyor.
   *
   * Sorgular TEK SEFERDE ve paralel: Panelim kullanıcının ilk gördüğü ekran
   * ve zaten yarım düzine sorgu çalıştırıyor; art arda beklemek açılışı
   * gözle görülür yavaşlatırdı. Hepsi oturumdaki kişinin kendi satırlarına
   * bakıyor ve birincil anahtar/dizin üzerinden gidiyor.
   *
   * Bölümler KATLI geliyor (aşağıda), yani içerikleri açılmadan görünmüyor —
   * ama veri yine de sunucuda hazırlanmak zorunda: sayfada JavaScript yok ve
   * `<details>` açıldığında sunucuya gidilmiyor.
   */
  const [
    profilKaydi,
    fotoSinirlari,
    cvSinirlari,
    belgeSinirlari,
  ] = await Promise.all([
    prisma.kullanici.findUniqueOrThrow({
      where: { id: kullanici.id },
      select: {
        ad: true,
        soyad: true,
        kurumKodu: true,
        fotoYuklenmeTarihi: true,
        /*
         * KİMLİK ALANLARI (20 Ağustos 2026 · istek: "panel ile profil
         * birleşecek"). Profil ekranı kapandı; salt okunur kimlik bloğu
         * buraya taşındığı için e-Okul'dan gelen alanlar da bu sorguya girdi.
         * Hepsi aynı satırdan okunuyor, ek sorgu yok.
         */
        cinsiyet: true,
        sinif: true,
        brans: true,
        kurum: { select: { ad: true, okulTuru: true, ilceKodu: true } },
        // Kayıtta okulunu listede bulamayan kişinin yazdığı ad ve tür.
        beyanOkulAdi: true,
        beyanOkulTuru: true,
        // Öğrencinin "Genel bilgiler" formunun başlangıç değerleri.
        ilKodu: true,
        ilceKodu: true,
        il: { select: { ad: true } },
        ilce: { select: { ad: true } },
        /*
         * DIŞ KULLANICININ KURUM/GÖREV KAYNAĞI. Başvuru DONDURULMUŞ bir
         * belgedir; burası yalnızca kişinin kendi alanları BOŞKEN
         * gösterilecek ilk değeri veriyor.
         */
        disBasvurusu: {
          select: {
            tur: true,
            gorevUnvani: true,
            mezuniyetYili: true,
            paydas: { select: { ad: true } },
            mezunKurum: { select: { ad: true } },
          },
        },
        /*
         * Seçilen çalışma grupları — "Çalışma gruplarım" bölümünde seçiliyor,
         * aynı bölümün başında rozet olarak görünüyor.
         */
        destekGruplari: {
          orderBy: { calismaGrubu: { siraNo: "asc" } },
          select: { calismaGrubu: { select: { id: true, ad: true } } },
        },
        /*
         * HAKKIMDA (13 Ağustos 2026 · istek: "panele hakkımda bölümü ekle,
         * profilde görünsün, elle uzmanlıklarını üzerinde çalıştığı projeleri
         * yazsın"). Alan zaten vardı ve yalnızca Akış'tan düzenlenebiliyordu;
         * Akış'a hiç uğramayan kullanıcı için görünmez bir alandı.
         */
        hakkinda: true,
        ogrenciProfil: true,
        ogretmenProfil: {
          select: {
            eposta: true,
            telefon: true,
            cvDosyaAdi: true,
            cvYuklenmeTarihi: true,
            // "Eklemek istedikleriniz" metni (31 Ağustos 2026).
            cvEkNotu: true,
            // Dosyanın VAR OLUP OLMADIĞI bu sütundan anlaşılıyor.
            cvDepolamaYolu: true,
            /*
             * Dış kullanıcının kendi yazdıkları (7 Ağustos 2026). Öğretmende de
             * seçiliyor ama formu basılmıyor: alan listesini role göre ikiye
             * bölmek, aynı sorgunun iki sürümünü doğururdu ve seçilen sütunlar
             * öğretmende zaten null.
             */
            githubUrl: true,
            kisiselSiteUrl: true,
            linkedinUrl: true,
            instagramUrl: true,
            kurumAdi: true,
            gorevUnvani: true,
            aciklama: true,
            // YEĞİTEK Okul Sorumluluğu bölümünün durumu (13 Ağustos 2026).
            yegitekOkulSorumlusu: true,
            yegitekIsaretlemeTarihi: true,
          },
        },
        kazanimlar: {
          // Kullanıcının girdiği tarih boş olabildiği için ikinci sıralama
          // ölçütü gerekiyor; yoksa tarihsiz kayıtların sırası belirsiz kalır.
          orderBy: [{ tarih: "desc" }, { olusturmaTarihi: "desc" }],
          include: {
            ekler: {
              select: { id: true, dosyaAdi: true },
              orderBy: { yuklenmeTarihi: "asc" },
            },
            baglantilar: {
              select: { id: true, adres: true, etiket: true },
              orderBy: { siraNo: "asc" },
            },
          },
        },
      },
    }),
    // Fotoğraf sınırları role bakılmadan alınır: bölüm herkeste var.
    profilFotoSinirlariniGetir(),
    // CV artık öğretmende de var (7 Ağustos 2026); sınırlar ortak.
    cvSinirlariniGetir(),
    /*
     * "Rotam" hedefleri BURADA SORGULANMIYOR (14 Ağustos 2026 · istek: "rotam
     * kalksın"): bölüm Panelim'den kalktı, veri de onunla birlikte. Hedefler
     * profil ekranında okunmaya devam ediyor.
     */
    /*
     * KAYIT BÖLÜMLERİ İÇİN (22 Ağustos 2026 · istek: "diğerlerini direk panele
     * alt alta alıyoruz açılır şekilde"). Destekleyici belge sınırları etkinlik
     * ekleriyle ORTAKTIR (lib/kazanim/ek.ts).
     *
     * GENÇTEK PROGRAM LİSTESİ ARTIK ÇEKİLMİYOR: kayıt formundaki "GençTek
     * etkinliği" açılır listesi kalktı ve adı kişi kendisi yazıyor.
     */
    kazanimEkSinirlariniGetir(),
  ]);

  /*
   * KAYIT BÖLÜMLERİ (22 Ağustos 2026 · istek: "paneldeki Bilişim Yolculuğum
   * kartı kalkacak, içindekiler panelin altına sırayla ayrı gruplara açılır
   * gelecek: Ürünlerim, Deneyimlerim, Topluluklarım / Ekiplerim").
   *
   * Bölümler 21 Ağustos'ta panelden çıkıp kendi sayfasına taşınmıştı; kart da
   * o sayfaya götürüyordu. Şimdi kart kalktı ve formlar panelin altındaki
   * katlanır kutulara döndü — kayıt girmek panelden ayrılmayı gerektirmiyor.
   *
   * ADRESTEKİ TÜR YALNIZCA KENDİ BÖLÜMÜNÜ İLGİLENDİRİR: `?tur=` çok tipli tek
   * gruptan (Deneyimlerim) gelir. Öbür bölümler kendi ilk türünde kalır —
   * bir bölümdeki seçimin yandaki bölümün formunu değiştirmesi, ortak formdan
   * kalma bir davranıştı.
   */
  const kazanimSahibi = ogrenciMi(kullanici) ? "OGRENCI" : "OGRETMEN";
  const kayitGruplari = kayitEklemeGruplari(kazanimSahibi);
  const seciliKayitTuru =
    istenenTur && kazanimTipiGecerliMi(istenenTur) ? istenenTur : null;
  const izinliBelgeTipleri = [
    ...belgeSinirlari.izinliGorselTipleri,
    ...belgeSinirlari.izinliBelgeTipleri,
  ];

  /*
   * MENTÖRLÜK (7 Ağustos 2026). Öğrenciye sorulmaz — mentörlük 18 yaş altı bir
   * kullanıcıyla birebir yazışma hakkı doğurur ve karşı taraf yetişkin olmalı
   * (bkz. lib/yetki/izinler.ts · mentorlukBasvurabilirMi).
   *
   * Grup listesi çalışma grubu seçimindekiyle AYNI kaynaktan gelir; pasife
   * alınmış grup teklif edilmez.
   */
  /*
   * YALNIZCA KENDİ KAYDI ÇEKİLİYOR (13 Ağustos 2026). Başvuru formu panoya
   * taşındığı için grup listesine ve seçili gruplara burada gerek kalmadı;
   * panelde kalan tek şey durumu gösteren kart.
   */
  const mentorlugum = mentorlukBasvurabilirMi(kullanici)
    ? await mentorluguGetir(kullanici.id)
    : null;

  /*
   * Üyesi olunan AKTİF ekip sayısı — "Ekiplerim" kartı için (13 Ağustos 2026).
   * Herkese soruluyor: ekibe öğrenci de öğretmen de mezun da eklenebiliyor ve
   * tek `count` sorgusu, rol dallanması yazmaktan ucuz.
   */
  const ekipSayim = await ekipSayimiGetir(kullanici.id);

  /*
   * REFERANSLAR (28 Ağustos 2026). YALNIZCA ÖĞRENCİDE sorgulanıyor: bölüm
   * yalnızca orada basılıyor ve satırlar üçüncü kişilerin iletişim bilgisi —
   * gösterilmeyecek bir veriyi belleğe almanın sebebi yok.
   *
   * Sıra ekleme sırasıdır (bkz. şema · KullaniciReferansi): liste elle
   * sıralanacak kadar uzun değil.
   */
  const referanslar = referansTutabilirMi(kullanici)
    ? await prisma.kullaniciReferansi.findMany({
        where: { kullaniciId: kullanici.id },
        orderBy: { olusturmaTarihi: "asc" },
        select: {
          id: true,
          adSoyad: true,
          kurum: true,
          telefon: true,
          eposta: true,
        },
      })
    : [];

  /*
   * "ÇALIŞMA GRUPLARI" — dış kullanıcının katkı verebileceği alanlar
   * (7 Ağustos 2026 · istek: "2. sekme Panel · Foto ekle ·
   * Mentörlüklerim/desteklerim · Çalışma Grupları").
   *
   * Mentörlük verisinden AYRI sorgu ve ayrı tablo: mentörlük onaya tabi bir
   * görevdir, burası yalnızca bir beyandır. Grup listesi ikisinde de aynı
   * kaynaktan geliyor — pasife alınmış grup hiçbirinde teklif edilmez.
   */
  const destekVerisi = disKullaniciMi(kullanici)
    ? await Promise.all([
        prisma.calismaGrubu.findMany({
          where: { aktif: true },
          orderBy: { siraNo: "asc" },
          select: { id: true, ad: true },
        }),
        prisma.kullaniciDestekGrubu.findMany({
          where: { kullaniciId: kullanici.id },
          select: { calismaGrubuId: true },
        }),
      ])
    : null;

  /*
   * ---------------------------------------------------------------------
   * PROFİL GÖSTERİM VERİSİ (20 Ağustos 2026 · istek: "panel ile profil
   * birleşecek tek panel kalacak, düzenleme ve görüntüleme panelden olacak")
   * ---------------------------------------------------------------------
   * 7 Ağustos'ta yüzey ikiye bölünmüştü: `/panel/profil` GÖSTERİR, `/panel`
   * DÜZENLER. Bölünme, girdiği kaydın nerede göründüğünü merak eden
   * kullanıcıyı iki ekran arasında gezdiriyordu — her düzenleme bölümünün
   * altında "profilimde nasıl göründüğünü gör" bağlantısı, her profil
   * kartının altında "Panelim'den düzenle" bağlantısı vardı ve ikisi aynı
   * bilgiyi iki kez basıyordu.
   *
   * Yüzey artık TEK: gösterim de düzenleme de burada. Profil ekranı silindi
   * ve adresi buraya yönleniyor (bkz. app/panel/profil/page.tsx).
   *
   * Sorgular paralel; hepsi oturumdaki kişinin kendi satırlarına bakıyor.
   */
  const ogrenci = ogrenciMi(kullanici);

  const [kazanim, katki, ogretmenKazanim, ogrencileri] = await Promise.all([
    // Rozetler ve katkı kartı öğrenciye özgüdür; öğretmenin karşılığı ayrı
    // fonksiyondan gelir (kaynakları bambaşka tablolar).
    ogrenci ? kazanimlariGetir(kullanici.id) : Promise.resolve(null),
    ogrenci ? katkiVerisiGetir(kullanici.id) : Promise.resolve(null),
    ogrenci ? Promise.resolve(null) : ogretmenKazanimlariGetir(kullanici.id),
    /*
     * Danışmanlığındaki öğrenciler. Kapsam filtresi KULLANILMIYOR: soru "bu
     * kişinin kapsamında kimler var" değil, "kimin danışmanı" — ikisi farklı.
     */
    ogrenci
      ? Promise.resolve([])
      : prisma.danismanAtama.findMany({
          where: { danismanKullaniciId: kullanici.id, bitisTarihi: null },
          orderBy: { baslangicTarihi: "desc" },
          select: {
            ogrenci: { select: { id: true, ad: true, soyad: true, sinif: true } },
          },
        }),
      /*
       * "Rotam" hedefleri BURADA SORGULANMIYOR (20 Ağustos 2026 · istek:
       * "rotam komple kalkacak"): ekranda hiçbir yerde basılmıyor, dolayısıyla
       * her panel açılışında okunmasının da anlamı yok. Kayıtlar tabloda
       * duruyor.
       */
    ]);

  // Koordinatörün sorumlu olduğu il, kişinin kayıtlı ilinden farklı olabilir;
  // adı ayrıca getirilir çünkü ham "34" kodu ekranda hiçbir şey anlatmıyor.
  const sorumluIlKodu = koordinatorIlKodu(kullanici);
  const sorumluIl = sorumluIlKodu
    ? await prisma.il.findUnique({
        where: { ilKodu: sorumluIlKodu },
        select: { ad: true },
      })
    : null;

  /*
   * KOORDİNATÖRÜN İL SAYIMI BURADAN KALKTI (26 Ağustos 2026): saydığı
   * "İlimdeki kişiler" kartı Yönetim Paneli'ne devredildi (yukarıdaki nota
   * bakın). Sorgular kopyalanmadı — oradaki il kartı aynı sayıları kendi
   * özetinden okuyor (bkz. lib/rapor/yonetim-ozeti.ts).
   */

  const disKullanici = disKullaniciMi(kullanici);
  const disProfil = profilKaydi.ogretmenProfil;
  const basvuru = profilKaydi.disBasvurusu;

  /*
   * Kurum ve görev: önce kişinin kendi yazdığı, yoksa başvurudaki değer.
   * Onay anında KOPYALANMADI; başvuru tek doğruluk kaynağı olarak duruyor ve
   * kişi kendi değerini yazdığı anda bu düşüş sona eriyor.
   */
  const kurumAdi =
    disProfil?.kurumAdi ?? basvuru?.paydas?.ad ?? basvuru?.mezunKurum?.ad ?? null;
  const gorevUnvani = disProfil?.gorevUnvani ?? basvuru?.gorevUnvani ?? null;

  const okulBilgisiVar = profilKaydi.kurumKodu !== null;

  /*
   * ÖĞRENCİNİN "GENEL BİLGİLER" FORMU (23 Ekim 2026). Kişinin ilindeki ilçe ve
   * okul listeleri ilk açılışta sunucuda hazırlanıyor; il değişirse form
   * yenisini kendisi istiyor (bkz. GenelBilgilerDuzenleme).
   */
  // Öğrenci, öğretmen ve il koordinatörü (23 Ekim 2026); diğerlerinde null.
  const genelTip = genelBilgilerTipi(kullanici);
  const genelBilgilerDuzenlenebilir =
    genelTip !== null && genelBilgilerDuzenlenebilirMi();
  const genelIlVerisi =
    genelBilgilerDuzenlenebilir && profilKaydi.ilKodu
      ? await ilOkulVerisiGetir(profilKaydi.ilKodu)
      : { ilceler: [], okullar: [] };

  /*
   * Kimlik kartı kapalı dururken başlığın altında görünen üç değer: kişinin
   * sistemdeki görevi, içinde bulunduğu yıl ve bağlı olduğu yer. Adı soyadı
   * ÖZETE GİRMİYOR — sayfanın en üstündeki karşılamada zaten yazıyor ve iki
   * satır arayla tekrar etmesi bilgi eklemiyordu.
   */
  const kimlikOzeti = [
    kullaniciRolEtiketi(kullanici),
    // Öğrencinin "Genel bilgiler"inde eğitim-öğretim yılı yok (23 Ekim 2026).
    genelTip ? null : kullanici.egitimOgretimYili,
    profilKaydi.kurum?.ad ??
      profilKaydi.beyanOkulAdi ??
      profilKaydi.il?.ad ??
      null,
  ].filter(Boolean) as string[];

  /*
   * KAPALI BÖLÜMLERİN ÖZETLERİ (21 Ağustos 2026 · istek: "İletişim bilgilerim,
   * Kayıtlarım, Özgeçmişim (CV) bunların da özetleri görülsün doldurunca
   * mutlaka").
   *
   * YALNIZCA DOLU ALAN BASILIR (istek: "sadece doldurduğunda doldurduğu
   * veriler gelsin"). Doldurulmuş alanın DEĞERİ başlığın altında duruyor;
   * kişi kayıtlı telefonunu görmek için bölümü açmak zorunda kalmasın. Boş
   * bölüm ise hiçbir şey yazmıyor: "henüz yok" satırları, ekranı bilgi değil
   * eksik listesi gibi okutuyordu.
   */
  const kendiProfilim = ogrenci
    ? profilKaydi.ogrenciProfil
    : profilKaydi.ogretmenProfil;
  /*
   * ROLE GÖRE ELEME YOK (22 Ağustos 2026 · istek: "eklenenler gözükmüyor,
   * eğer veri varsa gösterilir olsun tüm kullanıcı düzeylerinde"): özet artık
   * "bu rol bu alanı düzenleyebilir mi" diye sormuyor, "bu alan dolu mu" diye
   * soruyor. Eski hâlinde kurum/görev yalnızca dış kullanıcıda basılıyordu ve
   * bağlantılar hiç basılmıyordu — girilen veri ekranda karşılığı olmayan bir
   * yere düşüyordu. Doldurulmamış alan yine hiçbir şey yazmaz.
   */
  /*
   * Adresler protokolsüz basılıyor: "https://" özet satırında bilgi taşımıyor,
   * yalnızca yan yana duran değerlerin arasını uzatıyor.
   */
  const adresiKisalt = (adres: string | null | undefined) =>
    adres ? adres.replace(/^https?:\/\//i, "").replace(/\/$/, "") : null;
  const iletisimOzeti = [
    kendiProfilim?.eposta,
    kendiProfilim?.telefon,
    kurumAdi,
    gorevUnvani,
    adresiKisalt(kendiProfilim?.githubUrl),
    adresiKisalt(kendiProfilim?.linkedinUrl),
    adresiKisalt(kendiProfilim?.instagramUrl),
    adresiKisalt(kendiProfilim?.kisiselSiteUrl),
  ].filter(Boolean) as string[];
  const cvOzeti = kendiProfilim?.cvDosyaAdi ?? null;
  const cvTarihi = kendiProfilim?.cvYuklenmeTarihi ?? null;

  /*
   * Adresin sonundaki sürüm damgası, yeni fotoğraf yüklendiğinde tarayıcının
   * eskisini göstermesini engeller: rota kısa ömürlü bir ön bellek bıraktığı
   * için adres değişmezse görsel güncellenmiş görünmezdi.
   */
  const fotoAdresi = profilKaydi.fotoYuklenmeTarihi
    ? uygulamaYolu(
        `/panel/profil/foto?s=${profilKaydi.fotoYuklenmeTarihi.getTime()}`,
      )
    : null;

  /*
   * Danışmanlık işareti yalnızca okulunda görev alabilecek öğretmene sorulur.
   * YEĞİTEK personelinin ve il koordinatörünün okulu yoktur (kurum kodu boş),
   * ayrıca il koordinatörü aynı anda danışman olamaz — bu bölümü onlara
   * göstermek yapılamayacak bir işi teklif etmek olurdu.
   */
  const danismanlikSecimiGosterilir =
    !ogrenciMi(kullanici) &&
    !ilKoordinatoruMu(kullanici) &&
    !projeYoneticisiMi(kullanici) &&
    profilKaydi.kurumKodu !== null;

  /*
   * Öğretmenin bağlı olduğu il koordinatörü.
   *
   * Koordinatörün KENDİSİNE gösterilmez (kendi adını kart olarak görmesi
   * anlamsız), proje yöneticisine de gösterilmez (tek bir ile bağlı değil).
   * Öğrenciye de gösterilmez: onun muhatabı danışman öğretmenidir.
   */
  /*
   * MERKEZİN ÜÇ SORGUSU BURADAN KALKTI (27 Ağustos 2026): ekosistem sayımı,
   * etkinlik katılımı ve bekleyen işler. Kartları başka ekranlara taşındı ya
   * da tümüyle kaldırıldı (aşağıdaki notlara bakın); sorgular kalsaydı her
   * panel açılışında sonucu hiçbir yere basılmayan sayımlar çalışırdı.
   */

  /*
   * "İl koordinatörüm" kartı, ilinde kime bağlı olduğunu bilmesi gereken okul
   * personeline VE ÖĞRENCİYE gösterilir. Dış kullanıcılar (mezun, paydaş
   * temsilcisi) DIŞARIDA: koşul yalnızca "ili var ve koordinatör değil"
   * deseydi, kart onlara da koordinatörün adını ve e-postasını basardı — dar
   * başlangıç kararına aykırı.
   *
   * ÖĞRENCİ 26 AĞUSTOS 2026'DA İÇERİ ALINDI (istek: "öğrenci panelinde ilk
   * kartta danışman öğretmenim var, oraya bir de il koordinatörüm kartı
   * ekleyelim"). Başlangıçta öğrenci dışarıdaydı; gerekçe "öğrencinin muhatabı
   * danışman öğretmenidir" idi. Doğru ama eksik: danışmanı atanmamış öğrencinin
   * ilde soracağı kimse kalmıyordu ve koordinatörün adı zaten ilin herkese açık
   * bilgisi. Kartın gösterdiği veri (ad, e-posta) öğretmene basılanla aynı.
   */
  const koordinatorGosterilir =
    !ilKoordinatoruMu(kullanici) &&
    !projeYoneticisiMi(kullanici) &&
    !disKullaniciMi(kullanici) &&
    kullanici.ilKodu !== null;

  const ilKoordinatorum = koordinatorGosterilir
    ? await ilKoordinatoruOzeti(kullanici.ilKodu as string)
    : null;

  /*
   * "OKUL TEMSİLCİM" KARTI (31 Ağustos 2026 · istek: "Öğrenci panelinde
   * danışman öğretmeni kartının yanına okul temsilcim kartı eklensin").
   *
   * İL KOORDİNATÖRÜ KARTIYLA AYNI SORUYU okulun ölçeğinde soruyor: "burada
   * kime bağlıyım". İkisi arasındaki fark muhatabın kim olduğu — koordinatör
   * bir öğretmen, okul temsilcisi bir AKRAN. Öğrencinin okul içindeki ilk
   * muhatabı odur ve adını bilmediği sürece ona gidemez.
   *
   * YALNIZCA ÖĞRENCİDE: okul temsilciliği bir öğrenci görevidir ve karşılığı
   * öğretmende yok — öğretmenin okuldaki muhatabı okul idaresidir.
   *
   * TEMSİLCİNİN KENDİSİ DIŞARIDA: kendi adını "okul temsilcim" başlığı
   * altında okumak bilgi değil, tuhaflık olurdu. Aynı eleme koordinatör
   * kartında da var (koordinatorGosterilir).
   *
   * KART OKUL KAYDI OLMAYAN ÖĞRENCİDE DE BASILMAZ: temsilcilik bir okula
   * bağlanıyor, okulu bilinmeyen öğrencinin temsilcisi de hesaplanamaz.
   */
  const okulTemsilcileri =
    ogrenciMi(kullanici) && kullanici.kurumKodu !== null
      ? await okulTemsilcileriniGetir(
          kullanici.kurumKodu,
          kullanici.egitimOgretimYili,
        )
      : [];

  const okulTemsilcisiGosterilir =
    ogrenciMi(kullanici) &&
    kullanici.kurumKodu !== null &&
    !okulTemsilcileri.some((temsilci) => temsilci.id === kullanici.id);

  const simdi = new Date();

  /*
   * Başvuru şeridinin kaynağı: kapsamdaki faaliyetler. Takvim bölümü
   * kalktığı için (aşağıdaki nota bakınız) bu sorgu artık yalnızca
   * "başvurusu açık etkinlikler" şeridini besliyor.
   *
   * Pencere son 90 günle sınırlı: şerit bir arşiv değil, "şu sıralar ne var"
   * demektir; arşive Etkinlikler ekranından bakılır.
   */
  const doksanGunOnce = new Date(simdi.getTime() - 90 * 24 * 60 * 60 * 1000);
  const takvimFaaliyetleri = await prisma.faaliyet.findMany({
    where: {
      AND: [faaliyetKapsamFiltresi(kullanici), { tarih: { gte: doksanGunOnce } }],
    },
    orderBy: { tarih: "asc" },
    select: {
      id: true,
      ad: true,
      tarih: true,
      kapsam: true,
      durum: true,
      onayDurumu: true,
      duzenleyenBirim: true,
      basvuruBaslangic: true,
      basvuruBitis: true,
    },
  });

  /*
   * Şeride yalnızca YAYINDAKİ faaliyetler girer: onay bekleyen bir faaliyet
   * düzenleyenine görünüyor olabilir ama "başvuru açık" demek yanıltıcı olurdu.
   */
  const seritKayitlari = basvuruYapabilirMi(kullanici)
    ? seritteGosterilecekler(
        takvimFaaliyetleri.filter(
          (faaliyet) =>
            faaliyet.onayDurumu === "ONAY_GEREKMEZ" ||
            faaliyet.onayDurumu === "ONAYLANDI",
        ),
        simdi,
      )
    : /*
       * Şerit "başvuru açık" der; başvuramayana göstermek yanıltıcı olurdu.
       * Merkez personeli ve dış kullanıcılar etkinlikleri takvimde görmeye
       * devam eder, sadece bu çağrı şeridini görmez.
       */
      [];
  const acikFaaliyetSayisi = seritKayitlari.length;

  /*
   * KOORDİNATÖRÜN ONAY KUYRUĞU SAYIMI BURADAN KALKTI (26 Ağustos 2026).
   * Saydığı iki kart da başka ekranlara taşındı (yukarıdaki nota bakın);
   * etkinlik onayı artık Yönetim Paneli'nde, il dışı başvuru ise Etkinlikler
   * ekranındaki bölümün kendi başlığında sayılıyor.
   */

  /*
   * BAŞVURUYA AÇIK FAALİYET SORGUSU KALKTI (13 Ağustos 2026). Panelin altındaki
   * liste kaldırıldığı için (bkz. aşağıdaki not) tek tüketicisi kalmamıştı;
   * sorgu durmaya devam etseydi her panel açılışında beş faaliyet ve onların
   * tüm başvuruları boşuna okunurdu.
   *
   * SAYI KAYBOLMADI: karttaki `acikFaaliyetSayisi` mesaj şeridinin kayıtlarından
   * (`seritKayitlari`) geliyor ve o sorgu duruyor.
   */

  /*
   * KATILIM SAYIMI KALKTI (20 Ağustos 2026 · üç etkinlik kartının
   * kaldırılmasıyla birlikte): tek okuyucusu "Katıldığım etkinlikler"
   * kartıydı. Katılım LİSTESİ profildeki katkı kartında durmaya devam
   * ediyor (bkz. lib/kazanim/getir.ts · katilimGecmisiGetir).
   */

  /*
   * Katkı kartının özeti — yalnızca kartı BASILAN rollerde sorulur (danışman
   * öğretmen ve il koordinatörü). Herkese sorulsaydı öğrencinin ve merkezin
   * panelinde hiç kullanılmayan üç sayım daha açılırdı.
   */
  /*
   * SAYIMLAR ÖĞRENCİ DIŞINDAKİ HERKESTE (21 Ağustos 2026): "Görevlerim" kartı
   * artık her rolde basılıyor ve sayısını buradan alıyor. Üç `count`
   * sorgusundan ibaret; ayrıca katkı kartının özeti de aynı kaynaktan
   * besleniyor — iki ayrı sorgu, aynı üç sayıyı iki kez saymak olurdu.
   */
  const ogretmenKatkiSayilari = ogrenci
    ? null
    : await ogretmenKatkiSayilariGetir(kullanici.id);


  /*
   * ÜST KARTLARIN SAYILARI (21 Ağustos 2026). Kartlar kendi sayfalarına
   * götürüyor; buradaki tek iş, sayfaya girmeden önce okunacak sayıyı vermek.
   *
   * Görev sayısı temsilcilik ve organizasyonu TOPLAR: ikisi de "bu kişiye ne
   * görev verilmiş" sorusunun yarısı ve kart tek sayı gösteriyor. Öğretmende
   * karşılığı görev geçmişi ile düzenlediği etkinliklerdir.
   */
  /*
   * GENÇTEK GÖREVLERİ DE SAYIYA GİRİYOR (22 Ağustos 2026): Görevlerim ekranı
   * artık merkezin açtığı ekiplerden alınan görevleri de listeliyor. Kart o
   * ekranın sayısını söylüyor — ikisi ayrışsaydı kartta "2" yazarken sayfada
   * üç görev durabilirdi. Yalnızca ONAYLANMIŞ olanlar: bekleyen başvuru henüz
   * görev değil.
   */
  const gencTekGorevSayisi = await prisma.gencTekGorevBasvurusu.count({
    where: { kullaniciId: kullanici.id, onayDurumu: "ONAYLANDI" },
  });
  const gorevSayisi =
    (katki
      ? katki.gorevler.length + katki.faaliyetler.length
      : (ogretmenKatkiSayilari?.gorev ?? 0) +
        (ogretmenKatkiSayilari?.faaliyet ?? 0)) + gencTekGorevSayisi;

  /*
   * Kartın gösterdiği seviye, sayfadakiyle AYNI hesaptan geliyor
   * (lib/yolculuk/veri.ts): iki yerde iki ayrı formül olsaydı kart "Üretimde"
   * derken sayfa "Harekette" diyebilirdi.
   */
  const yolculuk = ogrenci ? await yolculugumuGetir(kullanici) : null;
  /*
   * Öğretmen ve koordinatörün panosunda da AŞAMA DAĞILIMI duruyor (28 Ağustos
   * 2026 · istek: "öğretmen koordinatörün Öğrencilerimin GençTek Yolculuğu
   * bunu neden kaldırdın"). Bir tur boyunca panodan çıkarılmıştı; gerekçe
   * maliyetti (aşağıya bakın) ama kaldırılan şey ekranın asıl bilgisiydi:
   * kaç öğrencinin hangi basamakta olduğu.
   */
  const ogrencilerimYolculugu = ogrenci
    ? null
    : await ogrencilerimYolculuguGetir(kullanici);

  const rolsuzMu = kullanici.roller.length === 0;

  /* Vitrindeki unvan ilin ADIYLA yazılıyor; plaka kodu ekrana çıkmaz. */
  const rolIlAdlari = await rolIlAdlariniGetir(kullanici);

  return (
    <div className="space-y-8">
      {/*
        VİTRİN (18 Ağustos 2026 · tasarım yenilemesi). Panel sistemin açılış
        ekranı: kullanıcı giriş yaptıktan sonra buraya düşüyor ve rengi tam
        güçte gördüğü tek yer burası olmalı — gövdenin geri kalanı beyaz
        kartlardan oluşuyor, her sayfaya kırmızı blok koymak vurguyu değersiz
        kılardı.

        Düğmeler kenar çubuğundakilerin TEKRARI DEĞİL: kenar çubuğu nereye
        gidilebileceğini sayar, buradaki iki düğme bugün ne yapılacağını söyler
        — açık başvuru varsa etkinliklere, yoksa panoya.
      */}
      <Vitrin
        /*
          ÜST BAŞLIK BİR SLOGAN, BİR VERİ DEĞİL (20 Ağustos 2026 · istekler:
          "2025 2026 eğitim öğretim yılı kalksın bannerdaki, sektörün yeni
          liderleri yazısı gelsin" · "hoş geldiniz yerine sadece adı soyadı
          yazsın").

          Eğitim-öğretim yılı KAYBOLMADI: aşağıdaki "Kimlik bilgileri"
          kartında kendi satırında duruyor — orası zaten kaydın ne dediğini
          okuyan yer. Vitrinde tuttuğu yer ise kişinin adının üstüydü.
          ÖĞRENCİDE ARTIK GÖSTERİLMİYOR (23 Ekim 2026 · istek: "eğitim öğretim
          yılı ve kurum kodu kalkacak"): öğrencinin kartı "Genel bilgiler"e
          döndü ve yıl o listede yok. Değer kayıtta duruyor.

          Başlık artık ad ve soyad: "Hoş geldiniz" her açılışta aynı şeyi
          söyleyen bir dolgu cümlesiydi ve kişinin soyadını dışarıda
          bırakıyordu.
        */
        ustBaslik="Sektörün yeni liderleri"
        baslik={`${profilKaydi.ad} ${profilKaydi.soyad}`}
        eylem={
          <>
            <Link href="/panel/etkinlikler" className={SINIF_VITRIN_BUTON}>
              <CalendarDays size={16} aria-hidden />
              Etkinlikler
              {acikFaaliyetSayisi > 0 && (
                <span className="rounded-full bg-vurgu-zemin px-2 py-0.5 text-xs font-bold">
                  {acikFaaliyetSayisi} açık
                </span>
              )}
            </Link>
            {/*
              "PANOYA GİT" DÜĞMESİ KALKTI (22 Ağustos 2026 · istek: "panelde
              banner üzerindeki panoya git butonu kalksın"). Pano kenar
              çubuğunda kendi sekmesiyle duruyor; vitrindeki ikinci kapı,
              yanındaki mesaj düğmesinin yerini daraltmaktan başka bir iş
              görmüyordu.
            */}
            {/*
              OKUNMAMIŞ MESAJ DÜĞMESİ (21 Ağustos 2026 · istek: "okunmamış
              mesajlar kayıyor onu üste al · Etkinlikler, Panoya git bunların
              yanına bir buton ve şu kadar okunmamış mesajın var diye buton
              olsun").

              Aynı bilgiyi taşıyan sarı akan şerit KALKTI: akan metnin
              üzerine tıklamak zordu ve sayı, akışın solunda parantez içinde
              kalıyordu. Düğme sabit duruyor ve sayıyı doğrudan söylüyor.

              HEDEF ARTIK BİLDİRİMLER EKRANI (22 Ağustos 2026 · istek: "panelde
              en alttaki bildirimleri kaldıralım, tamamını başka sayfaya
              taşıyıp, bannerdaki butona tıklayınca o sayfaya gitsin"). Önce
              sayfanın altındaki `#bildirimler` bölümüne iniyordu; o bölüm
              yalnızca son beş okunmamışı gösteriyordu ve artık yok.

              SIFIRDA DÜĞME KAYBOLMUYOR, METNİ DEĞİŞİYOR (22 Ağustos 2026 ·
              istek: "tüm mesajları okuduysa o buton kayboluyor; okuduysa tüm
              mesajlara ya da bildirimlere git butonuna dönüşsün"). Önce sayı
              sıfırken hiç basılmıyordu — gerekçesi "tıklanacak bir şey yok"tu,
              oysa okunmuş bildirimler duruyor ve onlara gitmenin başka kapısı
              yok. Düğmenin gidip gelmesi vitrindeki düğme sırasını da her
              açılışta değiştiriyordu.
            */}
            {/*
              YOL HAM YAZILIR, `uygulamaYolu()` İLE DEĞİL: `<Link>` basePath'i
              kendisi ekler. Önek burada bir kez daha eklendiğinde alt dizine
              kurulu sunucuda adres `/genctek/genctek/panel/bildirimler` olup
              404 veriyordu; yerelde TEMEL_YOL boş olduğu için hata görünmezdi
              (bkz. lib/ortam.ts · uygulamaYolu).
            */}
            <Link
              href="/panel/bildirimler"
              className={SINIF_VITRIN_IKINCIL_BUTON}
            >
              <Mail size={16} aria-hidden />
              {okunmamisMesajSayisi > 0
                ? `${okunmamisMesajSayisi} okunmamış mesajın var`
                : "Bildirimlere git"}
            </Link>
            {/*
              ÖZGEÇMİŞ İNDİRME VİTRİNE ÇIKTI (28 Ağustos 2026 · istek: "nerdev
              cv indir butonu bannera koy").

              Önce "Özgeçmişim (CV)" kartının içindeydi ve orası kapalı bir
              katlanır kutu: bağlantı, açılmayan bir kutunun içinde kalınca
              kimse bulamadı. Vitrin, panelin her açılışında görünen tek yer.

              KARTTAKİ İKİNCİ KAPI KAPANDI, bağlantı taşındı — çoğaltılmadı:
              aynı işi yapan iki düğme, "Panoya git" düğmesinin 22 Ağustos'ta
              kaldırılma gerekçesiyle aynı sakıncayı doğururdu.

              `<a>` VE `uygulamaYolu` — `<Link>` DEĞİL: dosya indirmede istemci
              tarafı gezinmenin yapacağı bir şey yok ve ham yol, TEMEL_YOL
              altında yayımlanan kurulumda ters vekile düşerdi (aynı ayrım
              DisaAktarmaBagi'nda yazılı; yanındaki `<Link>`ler önek eklemeyi
              kendileri hallettiği için ham yol yazıyor).
            */}
            <a
              href={uygulamaYolu("/panel/ozgecmis")}
              className={SINIF_VITRIN_IKINCIL_BUTON}
            >
              <FileDown size={16} aria-hidden />
              {/*
                METİN "OLUŞTUR" (28 Ağustos 2026 · istek: "bannerdaki özgeçmiş
                indir butonu özgeçmiş oluştur olsun").

                Düğme gerçekten de bir belge ÜRETİYOR: profildeki kayıtlardan
                o an yazılan yeni bir dosya iniyor, hazır duran bir eki
                indirmiyor. "İndir" deseydi, kişinin kendi yüklediği CV
                dosyasıyla (aynı sayfadaki "Özgeçmişim (CV)" bölümü) karışırdı.
              */}
              Özgeçmiş oluştur
            </a>
          </>
        }
        /*
          KİMLİK BAŞLIĞIN KENDİSİ (21 Ağustos 2026 · istek: "bu yazı kalksın
          resim sola gelsin, isminin altına okul vs gelsin").

          Önce vitrinin SAĞ kolonunda kendi kutusu vardı: fotoğraf, ad, rol ve
          okul bir arada. Ad iki kez basılıyordu — bir kez başlık olarak, bir
          kez de o kutunun içinde — ve okul adın yanındaki ayrı bir kutuda
          kalıyordu. Blok dağıtıldı: fotoğraf başlığın soluna, rol ve okul adın
          altına geçti; sağ kolon tümüyle kalktı.

          "Bugün sizi bekleyen işler…" cümlesi de gitti: her açılışta aynı şeyi
          söylüyordu ve hemen altındaki düğmeler zaten bugün nereye
          gidileceğini yazıyor.
        */
        gorsel={
          <>
            {/*
              FOTOĞRAF DÜĞMESİ VE FORMU BURADA, TEK PARÇA (20 Ağustos 2026 ·
              istekler: "resim ekleme ve görüntüleme banner üzerine gelsin ve
              üzerinde tıklayınca değişsin" · "paneldeki altta bulunan
              fotoğrafıma gerek kalmadı … bannerdaki görsel ekleme bağımsız
              olsun").

              Önce aşağıdaki katlanır "Fotoğrafım" bölümüne BAĞLANIYORDU; o
              bölüm kalktı ve bağlantının gideceği yer kalmadı. Yükleme formu
              bu yüzden vitrinin içine indi: fotoğrafa tıklamak formu AÇAR,
              başka bir ekrana ya da başka bir bölüme götürmez.

              JAVASCRIPT YOK: `<details>`in kendi davranışı. Fotoğraf
              `<summary>`nin içinde, yani her zaman görünür; form yalnızca
              açıkken basılıyor.

              `group`: örtü ve ok yalnızca imleç üstüne gelince, odaklanınca ya
              da form açıkken görünür — vitrin sistemin açılış cümlesi ve
              üstünde sürekli duran bir düğme kalabalığı istemiyoruz.
            */}
            <details className="group/foto">
              <summary
                aria-label={
                  fotoAdresi
                    ? "Profil fotoğrafımı değiştir"
                    : "Profil fotoğrafı ekle"
                }
                className="relative w-fit cursor-pointer list-none rounded-full outline-offset-4"
              >
                <ProfilFotografi
                  ad={profilKaydi.ad}
                  soyad={profilKaydi.soyad}
                  adres={fotoAdresi}
                />
                <span
                  aria-hidden
                  className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-full bg-black/55 text-[11px] font-semibold text-white opacity-0 transition group-hover/foto:opacity-100 group-focus-within/foto:opacity-100 group-open/foto:opacity-100"
                >
                  <Camera size={18} />
                  {fotoAdresi ? "Değiştir" : "Ekle"}
                </span>
              </summary>

              {/*
                FORM VİTRİNİN İÇİNDE, o yüzden kendi renkleriyle basılıyor:
                `SINIF_GIRDI` beyaz zemin varsayar ve kırmızı bandın üstünde
                okunmazdı.
              */}
              <div className="mt-4 w-full min-w-56 space-y-3 rounded-kutu border border-vitrin-cizgi bg-black/20 p-4">
                <form action={profilFotoYukleEylemi} className="space-y-2">
                  <label className="block text-sm font-medium text-vitrin-metin">
                    {fotoAdresi ? "Yeni fotoğraf seç" : "Fotoğraf seç"}
                    <input
                      type="file"
                      name="foto"
                      required
                      accept={fotoSinirlari.izinliTipler.join(",")}
                      className="mt-1.5 block w-full text-sm text-vitrin-metin-yumusak file:mr-3 file:rounded-kutu file:border-0 file:bg-white/90 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-metin"
                    />
                  </label>
                  <p className="text-xs text-vitrin-metin-yumusak">
                    En fazla{" "}
                    {(fotoSinirlari.maksBayt / (1024 * 1024)).toFixed(0)} MB ·
                    tek kopya tutulur, yeni yükleme öncekinin yerine geçer.
                  </p>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 rounded-kutu bg-white px-3.5 py-2 text-sm font-semibold text-metin transition hover:bg-white/90"
                  >
                    <Camera size={15} aria-hidden />
                    Yükle
                  </button>
                </form>

                {fotoAdresi && (
                  <form action={profilFotoSilEylemi}>
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 rounded-kutu border border-vitrin-cizgi px-3.5 py-2 text-sm font-medium text-vitrin-metin transition hover:bg-white/10"
                    >
                      <Trash2 size={15} aria-hidden />
                      Fotoğrafı kaldır
                    </button>
                  </form>
                )}
              </div>
            </details>
          </>
        }
        altBaslik={
          <>
            {/*
              VİTRİNDE KURUMSAL UNVAN (27 Ağustos 2026 · istekler: "proje
              yöneticisi bunu genç bilişim ekosistemi koordinatörlüğü olsun /
              yeğitek … bannera" · "koordinatör için bannera da yazalım / il
              koordinatörü diye").

              Kısa rol etiketi ("Proje yöneticisi", "İl koordinatörü") burada
              bir kimlik cümlesi kurmuyordu: biri kurumun adını hiç anmıyor,
              öbürü hangi ilin koordinatörü olduğunu söylemiyordu. Etiketin
              kendisi DEĞİŞMEDİ — tablolarda, rozetlerde ve CSV'lerde yine kısa
              hâli geçiyor (bkz. etiketler.ts · VITRIN_ROL_UNVANLARI).
            */}
            <p className="text-sm font-semibold text-vitrin-metin-yumusak">
              {vitrinRolUnvani(kullanici, rolIlAdlari)}
            </p>
            {/*
              Okul satırı yalnızca okul kaydı olanda: dış kullanıcının (mezun,
              paydaş) okulu yoktur ve boş satır eksik veri gibi görünürdü.
            */}
            {(okulBilgisiVar || profilKaydi.beyanOkulAdi) && (
              <p className="mt-1 text-sm text-vitrin-metin-yumusak">
                {[
                  profilKaydi.kurum?.ad ?? profilKaydi.beyanOkulAdi,
                  profilKaydi.ilce?.ad,
                  profilKaydi.il?.ad,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </>
        }
      />

      {/* Başvurusu açık faaliyetler, takvimden ÖNCE ve akan şerit hâlinde:
          kaçırılırsa geri dönüşü olmayan tek bilgi budur. */}
      {secimDurumu && DURUM_MESAJLARI[secimDurumu] && (
        <BilgiKutusu cesit="olumlu">
          {DURUM_MESAJLARI[secimDurumu]}
        </BilgiKutusu>
      )}
      {seciimHatasi && <BilgiKutusu cesit="hata">{seciimHatasi}</BilgiKutusu>}

      {/*
        Dış kullanıcının panelinde ölçüm kartlarının çoğu boş kalır (başvurusu,
        danışmanı, çalışma grubu yok). Boş bir ekran bırakmak yerine ne
        yapabileceği açıkça yazılıyor — ve ne YAPAMAYACAĞI da: yetki kapsamı
        dar başladı, kullanıcı bunu ekranda görmeli, denemelerinden çıkarmaya
        çalışmamalı.
      */}
      {disKullaniciMi(kullanici) && (
        <div className="rounded-kart border border-cizgi bg-kart p-6 shadow-kart">
          <h2 className="font-semibold text-baslik">
            {mezunMu(kullanici) ? "Mezun hesabınız" : "Paydaş temsilcisi hesabınız"}
          </h2>
          {/*
            METİN MENÜYLE AYNI ŞEYİ SÖYLEMELİ (13 Ağustos 2026 · inceleme
            bulgusu). Kutu "onaylanan bağlantılar üzerinden yazışabilirsiniz"
            diyordu ama Bağlantılarım sekmesi bu rollerde basılmıyordu; vaadin
            karşılığı ekranda yoktu. Sekme eklendi (bkz. panel/layout.tsx) ve
            cümle, bugün açık olan üç alanın tamamını sayıyor.
          */}
          <p className="mt-2 text-metin-yumusak">
            Etkinlik takvimini ve panoyu görebilir, panoda ilan açabilir,
            onaylanan bağlantılar üzerinden yazışabilir, akışta paylaşım
            yapabilir ve markete ürün ekleyebilirsiniz. Öğrenci ve öğretmen
            kayıtlarına erişiminiz yoktur; etkinliklere katılımcı olarak
            başvuru şu an açık değildir.
          </p>
          <Link href="/panel/talepler" className={`${SINIF_BIRINCIL_BUTON} mt-4`}>
            Panoya git
          </Link>
        </div>
      )}

      {/*
        "GÖREVİ İŞARETLE" KARTI KALKTI (27 Ağustos 2026 · istek: "bu onay var
        buna gerek yok, sisteme giriş yapınca direk danışman olsun").

        Kart, rolsüz öğretmene tek bir düğme gösteriyordu ve kimse o düğmeyi
        reddetmiyordu — herkesin geçtiği boş bir kapıydı. Rol artık ilk girişte
        veriliyor (bkz. lib/kullanici/sagla.ts), yani bu ekranı gören rolsüz
        öğretmen kalmıyor.

        GERİYE TEK DURUM KALDI: okul bilgisi olmayan öğretmen. Ona rol
        verilemiyor (danışmanlık bir okula bağlanır) ve yapacağı şey de bir
        tıklama değil, kayıt düzeltmesi — o yüzden düğme değil açıklama
        basılıyor.
      */}
      {rolsuzMu && kullanici.kurumKodu === null && (
        <div className="rounded-kart border border-uyari-cizgi bg-uyari-zemin p-6">
          <h2 className="font-semibold text-uyari-metin">
            Okul bilginiz görünmüyor
          </h2>
          <p className="mt-2 text-uyari-metin">
            Danışman öğretmen görevi okulunuza bağlanıyor; kaydınızda okul
            bilgisi olmadığı için görev tanımlanamadı. Okul kaydınız
            tamamlandığında görev kendiliğinden açılır.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/*
          İL KOORDİNATÖRÜM — IZGARANIN İLK KARTI (26 Ağustos 2026 · istek:
          "danışman öğretmen profil sayfasında ilk kart İl koordinatörüm
          olsun").

          Kart daha önce sayım kartlarının ardında, ızgaranın ortasındaydı.
          Okul personeli için burası bir sayım değil BİR MUHATAP: ile dair
          her soruda önce onu arıyor.

          ÖĞRENCİDE DE AYNI YERDE (26 Ağustos 2026 · istek: "öğrenci panelinde
          ... il koordinatörüm kartı ekleyelim, aynı öğretmen sayfasındaki gibi
          en başa gelsin"). Kart burada durduğu için öğrencide de ızgaranın ilk
          kartı oluyor; "Danışman öğretmenim" onun hemen ardından geliyor.
          Koordinatörün ve merkezin ızgara sırası değişmiyor
          (koordinatorGosterilir onları eliyor).
        */}
        {koordinatorGosterilir && (
          <OlcumKarti
            baslik="İl koordinatörüm"
            Ikon={MapPin}
            deger={
              ilKoordinatorum
                ? `${ilKoordinatorum.ad} ${ilKoordinatorum.soyad}`
                : "Atanmadı"
            }
            /*
              AÇIKLAMA SATIRI (e-posta) KALKTI (26 Ağustos 2026 · istek: "il
              koordinatörü kartının altında mail adresi yazıyor onu kaldır,
              ayrı sayfa yaptık zaten").

              Kart artık bir muhatabın ADINI söylüyor, adresi değil: ulaşma
              bilgisinin tamamı — fotoğraf, unvan, tıklanabilir mailto —
              /panel/il-koordinatorum sayfasında ve kart oraya gidiyor. Aynı
              adresi iki yerde basmak, kartı da tıklamaya değmez gösteriyordu.
            */
            /*
              KART TIKLANABİLİR (26 Ağustos 2026 · istek: "bu kartı tıklanabilir
              istemiştim, koordinatör resmi ve epostası çıkacaktı yeni sayfada").

              Hedef öğretmen envanteri DEĞİL kendi sayfası: envanter kaydı görev
              geçmişini ve CV'yi de gösteriyor, üstelik öğrenciye kapalı. Buraya
              bakan kişinin sorusu tek — "ona nasıl ulaşırım".

              Koordinatör atanmamışken de bağlantı duruyor: sayfa o durumu
              açıkça söylüyor ve kişiye ne yapacağını yazıyor.
            */
            yol="/panel/il-koordinatorum"
          />
        )}

        {/*
          "YAKLAŞAN ETKİNLİĞİM" KARTI ETKİNLİKLER EKRANINA TAŞINDI (31 Ağustos
          2026 · istek: "profilde Yaklaşan etkinliğim … bu kartı etkinlikler
          bölümüne kart olarak taşıyalım").

          Kart 13 Ağustos'tan beri buradaydı ve ızgaranın en önünde duruyordu:
          gerekçesi "buradaki tek tarihli taahhüt bu"ydu. Yeni yeri o gerekçeyi
          bozmuyor, kartı konusunun yanına koyuyor — tıklandığında zaten
          etkinlik sayfasına gidiyordu ve komşuları (danışman, gruplar, başvuru
          adedi) kişinin KENDİ kaydını okuyor.

          VERİ VE SORGU SİLİNMEDİ, TAŞINDI: `yaklasanEtkinligimiGetir` artık
          app/panel/etkinlikler/page.tsx içinde çağrılıyor ve kart orada
          listenin üstünde basılıyor. Kayıt yoksa basmama kuralı da korundu.
        */}

        {ogrenciMi(kullanici) && (
          <>
            {/*
              KARTLAR SEÇİM SAYFALARINA GİDİYOR (14 Ağustos 2026 · istek:
              "bunlar kart olarak var alttakiler kalksın").

              12 Ağustos 2026'da bu iki kart aynı sayfanın altındaki katlanır
              bölüme iniyordu (`?bolum=…#capa`); o bölümler kalkınca hedef
              seçimin kendi sayfası oldu. Sayfalar zaten duruyordu ve danışmanı
              olmayan öğrencinin giriş kapısı hâlâ orası.
            */}
            <OlcumKarti
              baslik="Danışman öğretmenim"
              /*
                DANIŞMANI VARKEN NÖTR (22 Ağustos 2026 · istek: "danışman
                öğretmenim kartı yeşil olmasın, gri olsun"). Yeşil bir başarı
                rengi; danışmanı olmak öğrencinin başardığı bir şey değil,
                olağan durumu. Kart yeşil olduğunda ızgaradaki tek renkli kutu
                oydu ve gözü kendine çekiyordu.

                ATANMADIĞINDA SARI KALIYOR: orada gerçekten bekleyen bir iş var
                ve kartın tek işi onu göstermek.
              */
              ton={atama ? "notr" : "uyari"}
              Ikon={UserCheck}
              deger={
                atama
                  ? `${atama.danisman.ad} ${atama.danisman.soyad}`
                  : "Atanmadı"
              }
              /*
                AÇIKLAMA KARTIN NE YAPTIĞINI DEĞİL, NE ANLATTIĞINI YAZAR
                (20 Ağustos 2026 · istek: "panelde Değiştirmek için tıklayın
                güncelleme için tıklayın yazılar kalksın kartlardaki").

                Kartın tıklanabilir olduğunu zaten kendisi söylüyor: imleç
                değişiyor ve kenarlığı vurguya dönüyor. "Tıklayın" demek, o
                satırı bilgi taşımayan bir yönergeye çeviriyordu — danışmanı
                olmayan öğrenci ise ne yapması gerektiğini değerin kendisinden
                ("Atanmadı") okuyor.
              */
              yol="/panel/danisman-secim"
            />
            {/*
              OKUL TEMSİLCİM — DANIŞMANIN HEMEN YANINDA (31 Ağustos 2026 ·
              istek: "danışman öğretmeni kartının yanına okul temsilcim kartı
              eklensin").

              Yer tesadüf değil: ızgaranın bu ilk üç kartı öğrencinin
              MUHATAPLARINI sayıyor — il koordinatörü (il), danışman öğretmen
              (okuldaki öğretmeni), okul temsilcisi (okuldaki akranı). Sayım
              kartları ("Çalışma gruplarım", "Öz değerlendirmelerim") bunların
              ardından geliyor ve farklı bir soruya cevap veriyor.

              TON NÖTR, DANIŞMAN KARTININ AKSİNE ATANMAMIŞKEN DE SARI DEĞİL:
              danışmanı olmayan öğrencinin önünde yapacağı bir iş var (kendi
              danışmanını seçiyor), temsilcisi olmayanın ise yok — görevi
              öğretmeni ya da koordinatör veriyor. Sarı, kişiye ait olmayan bir
              eksiği ona borç gibi gösterirdi.
            */}
            {okulTemsilcisiGosterilir && (
              <OlcumKarti
                baslik="Okul temsilcim"
                Ikon={UserRound}
                deger={
                  okulTemsilcileri.length === 0
                    ? "Atanmadı"
                    : `${okulTemsilcileri[0].ad} ${okulTemsilcileri[0].soyad}`
                }
                yol="/panel/okul-temsilcim"
              />
            )}
            {/*
              KART ADLARI TEK KALIPTA (25 Ağustos 2026 · istek: "öğrenci
              kartlarının ismi standart olsun: Çalışma gruplarım, Öz
              değerlendirmelerim, GençTek görevlerim, Mentörlüklerim").

              "Çalışma grubu seçimim" işi (seçim), "Öz değerlendirme" aracı
              (envanter) adlandırıyordu; komşularının hepsi "benim" diyen bir
              çoğuldu. Adres ve içerik aynı, değişen yalnızca kart adı.
            */}
            <OlcumKarti
              baslik="Çalışma gruplarım"
              Ikon={Layers}
              deger={String(grupSayisi)}
              yol="/panel/calisma-gruplari"
            />
            {/*
              ÖZDEĞERLENDİRME ENVANTERLERİ ARTIK KART (14 Ağustos 2026 · istek:
              "öz değerlendirme envanteri kartlara gelecek, alttan kalkacak").

              Alttaki katlanır bölüm zaten yalnızca bir cümle ve bir düğme
              taşıyordu; envanterin kendisi `/panel/algoritmam` ekranında.
              Katlanır bir kabuğun ardında duran tek düğme, kartın kendisinden
              fazlasını yapmıyordu.
            */}
            {/*
              EKRANIN ADI DEĞİŞTİ (20 Ağustos 2026 · istek: "Algoritmam öz
              değerlendirme olsun"). Adres aynı kaldı — bkz.
              app/panel/algoritmam/page.tsx.
            */}
            <OlcumKarti
              baslik="Öz değerlendirmelerim"
              Ikon={Compass}
              deger="Envanterler"
              yol="/panel/algoritmam"
            />
            {/*
              BAŞVURU İLE KATILIM AYRI İKİ SAYI ve yan yana duruyorlar: biri
              "istedim", öbürü "gerçekten oldum". Yoklama geldiğinden beri
              (12 Ağustos 2026) ikisinin farkı gerçek bir bilgi — başvurusu
              seçilmiş ama gelmemiş öğrencide sayılar ayrışır.

              Kart AYNI SAYFADAKİ katkı kartına iner (20 Ağustos 2026 ·
              panel-profil birleşmesi): katılan etkinliklerin LİSTESİ orada.
              Buraya ikinci bir liste konulmadı.
            */}
          </>
        )}

        {/*
          ÜÇ KART, ÜÇ SAYFA (21 Ağustos 2026 · istekler: "Kayıtlarım ve katkı
          nişanlarımı panelden kaldır alttan, üst alanda kart olarak gelsin
          kendi sayfaları olsun" · "yaptığı görevler Görevlerim kart olarak
          yukarı taşınacak").

          Üçü de HERKESTE basılıyor: kayıt girmek, nişan kazanmak ve görev
          almak öğretmende de var — kartların içeriği role göre değişiyor,
          varlığı değil. Sayı kartın üstünde çünkü kartın işi, sayfaya girmeden
          önce "burada bir şey var mı" sorusunu cevaplamak.
        */}
        {/*
          KART YALNIZCA ÖĞRENCİDE (26 Ağustos 2026 · istek: "öğretmendeki
          GençTek görevlerim ve katkı kartım kartlarını silelim profildeki").

          Görev alma öğretmende de var ama onun görevleri ayrı yerlerden
          okunuyor (danışmanlık, düzenlediği etkinlikler, rol envanteri);
          kartın saydığı GençTek görev başvurusu pratikte öğrencinin işi.
          Sayfa duruyor, yalnızca öğretmenin panosunda kartı basılmıyor.
        */}
        {ogrenciMi(kullanici) && (
          <OlcumKarti
            baslik="GençTek görevlerim"
            Ikon={BadgeCheck}
            deger={String(gorevSayisi)}
            yol="/panel/gorevlerim"
          />
        )}
        {danismanMi(kullanici) && (
          <>
            {/*
              SAYI GÖSTEREN KART TIKLANABİLİR OLMALI (12 Ağustos 2026 · istek:
              "İlimdeki öğrenciler kartına tıklanmıyor, diğer kartlar tıklanabilir
              vaziyette"). Kartın gösterdiği sayı bir listenin uzunluğu; o listeye
              gitmenin yolu kartın kendisidir. Üç rolde de hedef aynı ekran,
              kapsamı kullanıcıdan geliyor (bkz. ogrenciKapsamFiltresi).
            */}
            {/*
              KARTIN ADI "ÖĞRENCİLERİM" (13 Ağustos 2026 · istek: "danışman
              öğretmenin öğrencilerim menüsü kalkacak … danışmanlığımdaki
              öğrenciler öğrencilerim olacak").

              Kart artık öğretmenin o ekrana giden TEK kapısı: menüdeki sekme
              aynı istekle kalktı (bkz. app/panel/layout.tsx). Adının menüden
              kalkan sekmeyle aynı olması bilinçli — öğretmen aradığı yeri eski
              adıyla arıyor.

              Sayı okul kapsamıdır, danışmanlık listesi değil (bkz.
              ogrenciKapsamFiltresi); açıklama satırı bunu yazıyor.
            */}
            <OlcumKarti
              baslik="Öğrencilerim"
              Ikon={Users}
              deger={String(kapsamdakiOgrenciSayisi)}
              yol="/panel/ogrenciler"
            />
          </>
        )}



        {/*
          İL KOORDİNATÖRÜNÜN ÜÇ ÖLÇÜM KARTI BURADAN KALKTI (26 Ağustos 2026 ·
          istekler: "İlimdeki öğrenciler … Onay bekleyen etkinlik bu iki kartı
          yönetim paneline alalım" · "İl dışına giden başvuru bu kartı da
          etkinliklerim menüsüne alıyoruz").

          Üçü de SAYFANIN ÜSTÜNDEN, İŞİN YANINA taşındı — sayı bir listenin
          uzunluğuydu ve o listeler başka ekranlarda duruyor:

            · "İlimdeki öğrenciler" ve "Onay bekleyen etkinlik" → Yönetim
              Paneli (bkz. panel/yonetim/page.tsx · koordinatör ölçüm şeridi),
            · "İl dışına giden başvuru" → Etkinlikler ekranı; oradaki
              "İl dışına giden başvurular" bölümü bekleyen sayısını zaten
              başlığında yazıyor (bkz. etkinlikler/page.tsx · IlDisiBasvurular),
              yani taşınacak yeni bir kart gerekmedi, buradaki kopya kalktı.

          Koordinatörün profil sayfası böylece kendi kaydına ait bir sayfa
          kalıyor; ilin işleri ilin panosunda.
        */}

        {/*
          MERKEZİN ÜÇ ÖLÇÜM KARTI BURADAN KALKTI (27 Ağustos 2026 · istekler:
          "proje yöneticisinden bu kart kalksın · Kayıtlı öğrenciler" · "onay
          bekleyen etkinlikler kartı etkinlikler bölümüne gidecek" · "etkinlik
          katılımı kart olarak gitsin").

          Koordinatörün kartlarında bir tur önce (26 Ağustos) verilen kararın
          aynısı, bu kez merkez için: sayı bir listenin uzunluğuydu ve o
          listeler başka ekranlarda duruyor.

            · "Kayıtlı öğrenciler" → Yönetim Paneli'ndeki Öğrenciler kartı aynı
              listeyi süzgeçleriyle açıyor; buradaki sayaç onun kopyasıydı,
            · "Onay bekleyen etkinlik" ve "Etkinlik katılımı" → Etkinlikler
              ekranı (bkz. etkinlikler/page.tsx · merkez ölçüm şeridi).

          Merkezin profil sayfası böylece kendi kaydına ait bir sayfa kalıyor;
          ülkenin işleri kendi ekranlarında.
        */}

        {/*
          ÜÇ ETKİNLİK KARTI KALKTI (20 Ağustos 2026 · istek: "panelde etkinlik
          başvurularım, katıldığım etkinlikler, başvurusu açık etkinlikler
          kartları kalkacak").

          Kalkanlar: "Etkinlik başvurularım", "Katıldığım etkinlikler" (hem
          öğrenci hem diğer roller için) ve "Başvurusu açık etkinlik". Üçü de
          Etkinlikler ekranındaki kategorilerin (başvurduğum / tüm
          etkinlikler) sayıca tekrarıydı; katılım listesi ise aşağıdaki katkı
          bölümünde duruyor.

          Başvuru şeridi YERİNDE: o bir sayaç değil, "şimdi başvurabilirsin"
          çağrısı.
        */}

        {/*
          EKİPLERİM — ÜYENİN KAPISI (13 Ağustos 2026 · istek: "ekiplere
          katılanlarla mesajlaşma sohbet yapabilsin").

          Ekibi il koordinatörü kuruyor ve onun girişi Yönetim Paneli'ndeki
          kart. Üye ise yönetim panosunu açamaz; ekibine gidecek bir yolu
          olmasaydı, eklendiğine dair bildirimi alıp hiçbir yere
          gidemeyecekti.

          KART YALNIZCA ÜYELİĞİ OLANDA basılıyor: hiçbir ekibe eklenmemiş
          kullanıcıya boş bir kart göstermek, ondan yapması beklenen bir şey
          varmış izlenimi verirdi — ekibe kendi kendine katılamıyor.
        */}
        {(ekipSayim > 0 || ekiplerKapaliMi(kullanici)) && (
          <OlcumKarti
            baslik="Ekiplerim"
            Ikon={UsersRound}
            deger={String(ekipSayim)}
            yol="/panel/ekipler"
            // Koordinatörde kart pasif (23 Ekim 2026 · "Ekipler pasif olsun").
            pasifNedeni={
              ekiplerKapaliMi(kullanici) ? EKIPLER_KAPALI_ACIKLAMASI : undefined
            }
          />
        )}

        {/*
          MENTÖRLÜKLERİM (13 Ağustos 2026 · istek: "mentörlüklerim isminde
          panele kartların oraya bir kartı ekle").

          Başvuru formu panoya taşındı; bu kart onun panelde bıraktığı iz ve
          aynı zamanda TEK GİRİŞİ — çapasıyla birlikte doğrudan bölüme iniyor.

          DEĞER DURUMU YAZAR, sayı değil: mentörlük tek kayıttır, "1" demek
          hiçbir şey anlatmazdı. Kaydı olmayan kişi "Başvurulmadı" görür ve
          karta tıklayınca başvuru formuna gider — kartın işi zaten o soruyu
          sordurmak.
        */}
        {mentorlugum !== null || mentorlukBasvurabilirMi(kullanici) ? (
          <OlcumKarti
            baslik="Mentörlüklerim"
            ton={mentorlugum?.durum === "ONAYLANDI" ? "olumlu" : "notr"}
            Ikon={GraduationCap}
            deger={
              mentorlugum
                ? MENTORLUK_DURUM_ETIKETLERI[mentorlugum.durum]
                : "Başvurulmadı"
            }
            /*
              KAPSAM SATIRI KALKTI (25 Ağustos 2026 · istek: "mentörlüklerim
              kartının altında … o mentörlüğe ait açıklama görünmesin").
              Kart bir DURUM kartı: grup ve konu listesi eklenince kart
              komşularından taşıyordu. Kapsamın yeri kendi ekranı
              (/panel/mentorlugum) ve orada zaten yazıyor.
            */
            /*
              ONAYLI MENTÖR KENDİ SAYFASINA GİDER, başvuru formuna değil
              (13 Ağustos 2026): onaylanmış kişinin sorusu "başvurum ne oldu"
              değil, "bana ne soruldu".
            */
            yol={
              mentorlugum?.durum === "ONAYLANDI"
                ? "/panel/mentorlugum"
                : "/panel/talepler/mentor-basvuru#mentorlugum"
            }
          />
        ) : null}
      </div>

      {/*
        "KATKI NİŞANLARIM" KARTI "GENÇTEK YOLCULUĞUM" OLDU (21 Ağustos 2026 ·
        istek). Kart artık nişan sayısını değil SEVİYEYİ gösteriyor: yolculuk
        bir merdiven ve kişinin ilk sorduğu şey "hangi basamaktayım".

        IZGARADAN ÇIKIP ALTINA İNDİ (22 Ağustos 2026 · istek: "GençTek
        Yolculuğum'u panelde kartların altına alalım"). Izgaradaki sekizde bir
        kutuda seviye adından başkası sığmıyordu; sıradaki eşiğe ne kadar
        kaldığı ancak sayfayı açınca görülüyordu. Şerit, kazanılan genişliği
        İLERLEME ÇUBUĞUNA harcıyor — yolculuğun tek sorusu "ne kadar kaldı".

        Çubuk iki eşik ARASINI ölçüyor, toplam puanı değil; hesap sayfadakiyle
        aynı yerden geliyor (lib/yolculuk/kurallar.ts · `yuzde`).

        ÖĞRETMENDE KART ÖĞRENCİLERİ SAYIYOR (28 Ağustos 2026 · istek:
        "öğretmen tarafında 'GençTek Yolculuğum' yerine 'Öğrencilerimin GençTek
        Yolculuğu' yazıyoruz"): öğretmene kendi seviyesi değil, kapsamındaki
        öğrenci sayısı gösteriliyor ve kart aynı sayfaya götürüyor.

        DAĞILIMIN BEDELİ PANODA DA ÖDENİYOR: her basamağın öğrenci sayısını
        bulmak, kapsamdaki bütün öğrencilerin kayıtlarını taramak demek ve
        proje yöneticisinde bu il il değil ülke çapında bir hesap. Bir tur
        boyunca bu yüzden yalnızca sayı gösterilmişti; ama şeridi olmayan kart
        öğretmene "12 öğrencin var" demekten başka bir şey söylemiyordu.
        Sorgu sayısı öğrenci sayısından bağımsız tutuluyor
        (bkz. lib/yolculuk/ogrencilerim.ts); yavaşlarsa çare şeridi kaldırmak
        değil, hesabı önbelleğe almaktır.

        SAYI YERİNE YILDIZ (28 Ağustos 2026): kartta "42 puan" ve "3 puan
        kaldı" yazıyordu. Yolculuk ekranıyla aynı dili konuşması gerekiyor —
        orada puan kaldırılıp burada bırakılsaydı, aynı yolculuk iki ekranda
        iki ayrı ölçüyle anlatılırdı.
      */}
      <Link
        href="/panel/genctek-yolculugum"
        className="flex overflow-hidden rounded-kart border border-cizgi bg-kart shadow-kart transition hover:-translate-y-1 hover:border-vurgu hover:shadow-yuksek focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vurgu"
      >
        {/*
          Poster bandı DİKEY: ölçüm kartlarında üstte yatay bir bant duruyor,
          burada kart yatık olduğu için aynı bant sol raya dönüyor. Kartların
          dili değişmiyor, yönü değişiyor.
        */}
        <div className="poster poster-notr grid w-16 shrink-0 place-items-center sm:w-24">
          <Award size={26} className="text-white/50" aria-hidden />
        </div>
        <div className="flex-1 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <div>
              <p className="text-sm font-medium text-metin-yumusak">
                {yolculuk
                  ? "GençTek Yolculuğum"
                  : "Öğrencilerimin GençTek Yolculuğu"}
              </p>
              <p className="mt-1 font-baslik text-3xl leading-tight font-extrabold text-baslik">
                {yolculuk
                  ? yolculuk.seviye.ad
                  : `${kapsamdakiOgrenciSayisi} öğrenci`}
              </p>
            </div>
            {yolculuk && <SeviyeYildizlari yildiz={yolculuk.yildiz} />}
          </div>
          {yolculuk ? (
            <>
              <div
                className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-zemin"
                role="progressbar"
                aria-valuenow={yolculuk.yuzde}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${yolculuk.seviye.ad} seviyesindeki ilerlemeniz`}
              >
                <div
                  className="h-full rounded-full bg-birincil transition-all"
                  style={{ width: `${yolculuk.yuzde}%` }}
                />
              </div>
              <p className="mt-2 text-sm text-metin-yumusak">
                {yolculuk.sonraki
                  ? `Sonraki seviyen ${seviyeAdiTirnakli(yolculuk.sonraki.ad)}`
                  : "En üst seviyedesiniz."}
              </p>
            </>
          ) : (
            <p className="mt-3 text-sm text-metin-yumusak">
              {ogrencilerimYolculugu && ogrencilerimYolculugu.ogrenciSayisi > 0
                ? `Öğrencilerinin çoğu ${seviyeAdiTirnakli(
                    ogrencilerimYolculugu.dagilim.reduce((enIyi, satir) =>
                      satir.ogrenciSayisi > enIyi.ogrenciSayisi ? satir : enIyi,
                    ).seviye.ad,
                  )} aşamasında.`
                : "Kapsamında henüz öğrenci yok."}
            </p>
          )}
        </div>
      </Link>

      {/*
        AŞAMA ŞERİDİ ŞERİDİN ALTINDA (22 Ağustos 2026 · istek: "panelde GençTek
        Yolculuğum'un altına … 'Buradasın' bunu da ekleyelim").

        Üstteki şerit "neredesin ve ne kadar kaldı" diyor; bu liste "yol neye
        benziyor" diyor. İkincisi olmadan seviye adı ("Keşifte") kişiye kaçıncı
        basamakta olduğunu ve sıradakinin ne olduğunu söylemiyordu.

        BAĞLANTI DEĞİL: üstündeki kart zaten yolculuk ekranına götürüyor;
        şeridin kendisi okunacak bir liste. İşaretleme yolculuk ekranıyla TEK
        BİLEŞENDEN geliyor (components/YolculukSeridi.tsx) — kopyalansaydı
        seviye eklendiğinde biri geride kalırdı.
      */}
      {yolculuk ? (
        <YolculukSeridi seviyeKodu={yolculuk.seviye.kod} />
      ) : (
        ogrencilerimYolculugu && (
          <YolculukSeridi dagilim={ogrencilerimYolculugu.dagilim} />
        )
      )}

      {/*
        BÖLÜM ÖLÇÜM KARTLARININ HEMEN ARDINA ALINDI (13 Ağustos 2026).

        Eskiden katlanır profil bölümlerinin (Fotoğrafım, Hakkımda, Kayıtlarım,
        CV) ALTINDA duruyordu. Merkezde bu göze batmıyordu; danışman ve
        koordinatöre açılınca sorun oldu: "2 bağlantı isteği bekliyor" satırı,
        beş katlanır kartın altında kaldığı için ekranda fiilen görünmüyordu ve
        bölümü onlara açmanın tek gerekçesi zaten görünürlüktü.

        Sıra artık işin aciliyetine göre: tarihli taahhüt (ölçüm kartları) →
        bekleyen iş → takvim → bildirimler. Katlanır bölümler kişinin kendi
        kaydını düzenlediği yer ve hiçbirinde bekleyen bir iş yok.
      */}
      {/*
        "DİKKAT GEREKTİRENLER" IZGARASI TÜMÜYLE KALKTI (27 Ağustos 2026 ·
        istekler: "ikinci etkinlik kartı kalksın · Onay bekleyen etkinlik" ·
        "bu kart kalksın · Bekleyen il dışı başvuru").

        Izgara 13 Ağustos'ta altı satırla açılmıştı; satırlar tur tur kendi
        ekranlarına taşındı ve bu iki kart sonuncularıydı. İkisinin de karşılığı
        bir tık ötede duruyor: bekleyen etkinlik onayı Etkinlikler ekranındaki
        onay süzgecinde (koordinatörde ayrıca Yönetim Paneli'nde), il dışı
        başvuru ise aynı ekrandaki "İl dışına giden başvurular" bölümünün kendi
        başlığında sayılıyor.

        `bekleyenIsleriGetir` SORGUSU DA KALKTI: tek tüketicisi buydu, kalsaydı
        her panel açılışında boşuna çalışırdı. Kural katmanı duruyor
        (lib/rapor/istatistik.ts), yeniden bir kuyruk gerektiğinde oradan
        okunur.
      */}

      {/*
        EKOSİSTEM SAYILARI, DİĞER İKİ KART GRUBUNUN HEMEN ALTINDA (14 Ağustos
        2026 · istek: "proje yöneticisini panel sayfasında 3 farklı başlıkta
        kart grubu oluşturulmuş, bunların Ekosistem sayıları olanı alta kaymış
        diğer iki kartın altına al bunu").

        Bölüm sayfanın en dibindeydi: proje yöneticisinin panelinde ölçüm
        kartları ve "Dikkat gerektirenler" üstte, ekosistem sayıları ise yedi
        katlanır düzenleme bölümünün ardındaydı. Üçü de aynı türden — okunmak
        için basılmış kart ızgaraları — ve şimdi arka arkaya duruyorlar.
      */}
      {/*
        "EKOSİSTEM SAYILARI" BÖLÜMÜ KALKTI (27 Ağustos 2026 · istek: "bu
        başlıktaki tüm kartlar kalkacak · Ekosistem sayıları").

        Yedi kart da ülke geneli sayımdı ve hiçbiri tıklanabilir değildi: panel
        kişinin KENDİ kaydının sayfası, ülkenin sayıları ise yönetim ekranının
        sorusu. Sayılar kaybolmadı — il/ilçe/okul kırılımı ve toplamları Yönetim
        Paneli'nde duruyor (bkz. panel/yonetim/page.tsx · il özeti şeridi),
        temsilci ve koordinatör sayıları ise İl koordinatörleri ile Öğrenciler
        ekranlarının kendi listelerinde.

        `merkezIstatistikleriniGetir` sorgusu da kalktı; tek tüketicisi buydu.
      */}

      {/*
        HAKKIMDA — BÜTÜN KART IZGARALARININ ALTINDA VE SATIR İÇİ DÜZENLENİR
        (20 Ağustos 2026 · istekler: "hakkımda bölümü kartların altına gelsin,
        düzenlemek istediğinde üzerine tıklayıp değişsin, alta doğru
        açılmasın sağdaki aç kapatlara gerek yok" ve "paneldeki hakkımda
        bölümünü kartların altına al").

        İlk yerleştirmede ölçüm kartlarının hemen altındaydı ve "Dikkat
        gerektirenler" ile "Ekosistem sayıları" ızgaralarını aşağı itiyordu:
        üçü de kart ızgarası, aralarına bir form kutusu girince panel iki kez
        başlıyor gibi oluyordu. Şimdi kartların TAMAMI bitince geliyor —
        okunacak şeyler önce, düzenlenecek şeyler sonra.

        Bölüm aşağıda, katlanır bölümlerin arasındaydı: başlığı, açıklaması ve
        sağında "Aç / Kapat" rozeti olan bir kutu. Üç sorun vardı — metin
        kapalı kutunun ardında hiç görünmüyordu, açmak sayfayı aşağı doğru
        büyütüyordu ve kişinin kendini anlattığı tek cümle, yedi formun arasına
        gömülmüştü.

        Şimdi metnin KENDİSİ duruyor ve tıklanınca YERİNDE forma dönüşüyor:
        metin gider, textarea gelir. Kart aşağı doğru açılmıyor, içeriği
        değişiyor.

        JAVASCRIPT YOK. `<details>` yine kullanılıyor ama katlanır kutu gibi
        değil: gösterim `<summary>`nin İÇİNDE ve `group-open:hidden` ile
        kayboluyor, form da açılınca onun yerine geçiyor. "Aç/Kapat" rozeti
        yok — tıklanacak şey metnin kendisi.

        `list-none` + `[&::-webkit-details-marker]:hidden`: tarayıcının
        varsayılan üçgen imi basılmasın; burada açılan bir liste yok, düzenlenen
        bir metin var.
      */}
      <Kart>
        <details className="group">
          <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 className="flex items-center gap-2.5 text-lg font-bold text-baslik">
                <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-kutu bg-vurgu-zemin text-vurgu-metin">
                  <UserRound size={17} />
                </span>
                Hakkımda
              </h2>
              {/*
                Kalem yalnızca KAPALIYKEN görünür: form açıldığında düzenleme
                işaretinin durması, tıklanacak ikinci bir şey varmış gibi
                görünürdü.
              */}
              <span className="text-metin-yumusak transition group-hover:text-vurgu-metin group-open:hidden">
                <Pencil size={16} aria-hidden />
              </span>
            </div>
            {/*
              Metin YOKSA hiçbir şey basılmıyor (21 Ağustos 2026 · istekler:
              "hakkımdanın açıklamasını da sil" · "sadece doldurduğunda
              doldurduğu veriler gelsin"). Burada eskiden "yazmak için buraya
              tıklayın" davetiyesi duruyordu; kart zaten başlığı ve kalemiyle
              tıklanabilir olduğunu söylüyor.
            */}
            {/*
              ÖZET ÜÇ SATIR (22 Ağustos 2026 · istek: "Hakkımda özeti 3 satır
              görünsün; 1500 karakter girince hepsi görünüyor"). Metin
              kırpılmadan basılıyordu ve uzun bir "Hakkımda", altındaki bütün
              bölümleri ekranın dışına itiyordu — kapalı bir kutunun özeti,
              kutunun kendisinden uzun olmamalı.

              KIRPMA GÖRSEL, VERİ DEĞİL: metnin tamamı kutuya tıklanınca açılan
              formda duruyor ve profilde tam hâliyle görünüyor.
            */}
            {profilKaydi.hakkinda && (
              <p className="mt-3 line-clamp-3 whitespace-pre-line text-metin group-open:hidden">
                {profilKaydi.hakkinda}
              </p>
            )}
          </summary>

          <form action={hakkindaKaydetEylemi} className="mt-4 space-y-3">
            <input type="hidden" name="donusYolu" value="/panel" />
            <label className="block">
              <span className="text-sm font-medium text-metin">
                Hakkımda metni
              </span>
              <textarea
                name="hakkinda"
                rows={5}
                maxLength={HAKKINDA_MAKS}
                defaultValue={profilKaydi.hakkinda ?? ""}
                placeholder="Örn. Gömülü sistemler ve görüntü işleme üzerine çalışıyorum. Şu an okulumun TEKNOFEST takımında bir tarım drone'u projesi yürütüyorum."
                className={SINIF_GIRDI}
              />
              <span className="mt-1 block text-sm text-metin-yumusak">
                En fazla {HAKKINDA_MAKS} karakter. Telefon ve adres gibi
                iletişim bilgilerinizi buraya YAZMAYIN.
              </span>
            </label>
            <button type="submit" className={SINIF_BIRINCIL_BUTON}>
              Kaydet
            </button>
          </form>

          {/*
            YEĞİTEK OKUL SORUMLULUĞU ARTIK BURADA (26 Ağustos 2026 · istek:
            "profilden YEĞİTEK Okul Sorumluluğu bu bölümü kaldıralım ama …
            üstteki hakkımda içine checkbox ile eklesin").

            Kendi katlanır bölümü vardı ve içinde tek bir düğme duruyordu:
            "YEĞİTEK Okul Sorumlusuyum" / "İşareti kaldır". Tek işaret için
            bir bölüm, profilde açılıp kapanan kutulardan birini boşa
            harcıyordu. İşaret kişinin kendisini tarif ettiği bir beyan,
            yani Hakkımda ile aynı cins bilgi.

            AYRI FORM, aynı kutunun içinde: metin ile işaret ayrı eylemlere
            gidiyor (biri hakkindaKaydetEylemi, öbürü yegitek…). Tek forma
            konsaydı metni düzeltmek istemeyen kişi de her kaydedişte
            işaretini yeniden göndermek zorunda kalırdı.

            KUTU İŞARETSİZ GÖNDERİLİRSE alan hiç gelmez ve eylem bunu
            "sorumlu değil" olarak okur — işaretin kaldırılma yolu da bu.
          */}
          {danismanMi(kullanici) && (
            <form
              action={yegitekSorumlusuIsaretiEylemi}
              className="mt-4 border-t border-cizgi pt-4"
            >
              <label className="flex items-start gap-2.5 text-metin">
                <input
                  type="checkbox"
                  name="sorumluMu"
                  value="evet"
                  defaultChecked={
                    profilKaydi.ogretmenProfil?.yegitekOkulSorumlusu ?? false
                  }
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-cizgi accent-[var(--renk-birincil)]"
                />
                <span>
                  YEĞİTEK Okul Sorumlusuyum
                  {profilKaydi.ogretmenProfil?.yegitekIsaretlemeTarihi && (
                    <span className="block text-sm text-metin-yumusak">
                      {tarihYaz(
                        profilKaydi.ogretmenProfil.yegitekIsaretlemeTarihi,
                      )}{" "}
                      tarihinde işaretlendi
                    </span>
                  )}
                </span>
              </label>
              <button
                type="submit"
                className={`${SINIF_IKINCIL_BUTON} mt-3`}
              >
                İşareti kaydet
              </button>
            </form>
          )}
        </details>
      </Kart>

      {/*
        DANIŞMAN VE ÇALIŞMA GRUBU BÖLÜMLERİ KALKTI (14 Ağustos 2026 · istek:
        "panelde Danışman öğretmenim / Çalışma gruplarım … bunlar kart olarak
        var alttakiler kalksın").

        İkisi de sayfanın üstünde ZATEN kart olarak duruyordu (12 Ağustos
        2026'da tıklanabilir yapılmışlardı) ve kartlar aynı sayfanın altındaki
        katlanır bölüme iniyordu: aynı iş, aynı ekranda iki kez. Kartlar artık
        seçim SAYFALARINA gidiyor (`/panel/danisman-secim`,
        `/panel/calisma-gruplari`) — o sayfalar hiç silinmemişti, danışmansız
        öğrencinin giriş kapısı hâlâ orası (SKILL.md · Değişmezler 2).

        Seçim formu tek bileşenden basılmaya devam ediyor (DanismanSecimi,
        CalismaGrubuSecimi); kaybolan tek şey Panelim'deki ikinci kopya.
      */}

      {/*
        "KATKI GİRİŞİ" KARTI KALDIRILDI (7 Ağustos 2026). Kart, profildeki
        forma giden bir kestirmeydi ("Yeni kayıt ekle", "Sertifika ekle",
        "Topluluk ekle"). Form artık aşağıdaki "Kayıtlarım" bölümünde, aynı
        sayfada; kestirme kalsaydı kullanıcıyı bulunduğu sayfadan çıkarıp geri
        getiren bir bağlantıya dönüşürdü. Sertifika ve topluluk girişleri o
        bölümün sekmelerinde duruyor.
      */}

      {/*
        ---------------------------------------------------------------------
        PROFİLİM (20 Ağustos 2026 · istek: "panel ile profil birleşecek tek
        panel kalacak, düzenleme ve görüntüleme panelden olacak")
        ---------------------------------------------------------------------
        Buradan aşağısı kişinin KENDİ KAYDI: önce e-Okul'dan gelen kimlik
        (değiştirilemez), sonra kendi doldurduğu katlanır bölümler, en sonda
        da bu kayıtların hesaplanmış görünümü (katkı kartı, nişanlar,
        yolculuk) ve KVKK onayları.

        Bölümler KATLI: Panel kullanıcının ilk gördüğü ekran ve asıl işi
        (başvurusu açık etkinlikler, takvim) formların altında kalmamalı.
        Hiçbiri `baslangictaAcik` değil — danışman ve çalışma grubu
        seçimlerinden farkı bu: onlar yapılması GEREKEN işler, bunlar
        istendiğinde yapılan düzenlemeler.

        "PROFİLİMDE NASIL GÖRÜNÜYOR" BAĞLANTILARI KALKTI: her bölümün altında
        profile giden bir bağlantı vardı ve gittiği ekran artık burası.
      */}

      {/*
        `h2` (SayfaBasligi DEĞİL): o bileşen `h1` basıyor ve sayfanın `h1`i
        vitrindeki karşılama. İki `h1`, ekran okuyucuda sayfanın iki başlığı
        varmış gibi görünürdü.
      */}
      {/*
        `id="profilim"`: profil bölgesinin başlangıcı adreslenebilir olmalı —
        eski `/panel/profil` yer imleri ekranın en üstüne düşüyor ve kişinin
        kendi kaydı sayfanın ortasında başlıyor.
      */}
      {/*
        "PROFİLİM" BAŞLIĞI KALKTI (22 Ağustos 2026 · istek: "panelden bu yazıyı
        kaldır: Profilim"). Altındaki kutuların hepsi zaten kendi adını
        taşıyor; başlık bir grup adı olmaktan çıkıp sayfanın ortasında duran
        tek satırlık bir etikete dönmüştü.

        `id` KALIYOR ama artık boş bir çapa: eski `/panel/profil` yer imleri ve
        profile giden bağlantılar buraya iniyor. Kaldırılsaydı o adresler
        sayfanın en tepesine düşerdi.
      */}
      <div id="profilim" className="scroll-mt-6" />

      {/*
        ÖĞRENCİDE "GENEL BİLGİLER" (23 Ekim 2026 · istek: "Kimlik bilgileri
        başlığı yerine genel bilgiler yazılacak. Ad soyad cinsiyet okul okul
        türü ilçe il girecek sınıf kalacak, eğitim öğretim yılı ve kurum kodu
        kalkacak, mevcut yapı düzenlenebilir olsun").

        Diğer kullanıcı tiplerinde aşağıdaki salt okunur "Kimlik bilgileri"
        olduğu gibi duruyor. EBA kipinde öğrencide de alanlar salt okunur
        basılıyor: orada kaynak e-Okul (bkz. genelBilgilerDuzenlenebilirMi).
      */}
      {genelTip ? (
        <>
          <KatlanabilirKart
            baslik="Genel bilgiler"
            Ikon={IdCard}
            capa="genel-bilgiler"
            duzenlenebilir
            ozet={<p>{kimlikOzeti.join(" · ")}</p>}
            baslangictaAcik={acilacakBolum === "genel-bilgiler"}
          >
            {genelBilgilerDuzenlenebilir ? (
              <GenelBilgilerDuzenleme
                tip={genelTip}
                baslangic={{
                  ad: profilKaydi.ad,
                  soyad: profilKaydi.soyad,
                  cinsiyet: profilKaydi.cinsiyet,
                  ilKodu: profilKaydi.ilKodu ?? "",
                  ilceKodu:
                    profilKaydi.ilceKodu ?? profilKaydi.kurum?.ilceKodu ?? "",
                  okulTuru: formOkulTuru(
                    profilKaydi.kurum?.okulTuru ?? profilKaydi.beyanOkulTuru,
                  ),
                  okul:
                    profilKaydi.kurumKodu !== null
                      ? String(profilKaydi.kurumKodu)
                      : profilKaydi.beyanOkulAdi
                        ? OKUL_LISTEDE_YOK
                        : "",
                  beyanOkulAdi: profilKaydi.beyanOkulAdi ?? "",
                  sinif: profilKaydi.sinif ?? "",
                  brans: profilKaydi.brans ?? "",
                }}
                iller={ILLER}
                ilkIlceler={genelIlVerisi.ilceler}
                ilkOkullar={genelIlVerisi.okullar}
                kaydetEylemi={genelBilgilerEylemi}
                veriGetir={ilOkulVerisiGetir}
              />
            ) : (
              <dl className="grid gap-5 sm:grid-cols-2">
                <SaltOkunurAlan etiket="Ad" deger={profilKaydi.ad} />
                <SaltOkunurAlan etiket="Soyad" deger={profilKaydi.soyad} />
                <SaltOkunurAlan
                  etiket="Cinsiyet"
                  deger={profilKaydi.cinsiyet === "K" ? "Kadın" : "Erkek"}
                />
                <SaltOkunurAlan
                  etiket="Okul"
                  deger={profilKaydi.kurum?.ad ?? profilKaydi.beyanOkulAdi}
                />
                <SaltOkunurAlan
                  etiket="Okul türü"
                  deger={
                    profilKaydi.kurum?.okulTuru ?? profilKaydi.beyanOkulTuru
                  }
                />
                <SaltOkunurAlan
                  etiket="İlçe"
                  deger={profilKaydi.ilce?.ad ?? null}
                />
                <SaltOkunurAlan etiket="İl" deger={profilKaydi.il?.ad ?? null} />
                {genelTip === "OGRENCI" ? (
                  <SaltOkunurAlan etiket="Sınıf" deger={profilKaydi.sinif} />
                ) : (
                  <SaltOkunurAlan etiket="Branş" deger={profilKaydi.brans} />
                )}
              </dl>
            )}
          </KatlanabilirKart>

          {/*
            DANIŞMAN ÖĞRETMEN BİLGİLERİ (23 Ekim 2026 · istek: "Öğrencinin
            Danışman öğretmen bilgilerini girebileceği bir alan olsun").
            Öğrencinin beyanı; sistemdeki danışman ataması değil. YALNIZCA
            ÖĞRENCİDE: öğretmen ve koordinatör de "Genel bilgiler"i görüyor.
          */}
          {ogrenci && (
          <KatlanabilirKart
            baslik="Danışman öğretmen bilgileri"
            Ikon={UserCheck}
            capa="danisman-ogretmen-bilgileri"
            duzenlenebilir
            ozet={
              profilKaydi.ogrenciProfil?.beyanDanismanAd ? (
                <p>
                  {[
                    `${profilKaydi.ogrenciProfil.beyanDanismanAd} ${profilKaydi.ogrenciProfil.beyanDanismanSoyad ?? ""}`.trim(),
                    profilKaydi.ogrenciProfil.beyanDanismanBrans,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              ) : undefined
            }
            baslangictaAcik={acilacakBolum === "danisman-ogretmen-bilgileri"}
          >
            <DanismanBilgisiDuzenleme
              bilgi={profilKaydi.ogrenciProfil}
              kaydetEylemi={danismanBilgisiEylemi}
            />
          </KatlanabilirKart>
          )}
        </>
      ) : (
      <KatlanabilirKart
        baslik="Kimlik bilgileri"
        Ikon={IdCard}
        capa="kimlik-bilgileri"
        /*
          KAPALI AÇILIYOR (22 Ağustos 2026 · istek: "Kimlik bilgileri bu da
          özet olsun tıklanınca büyüsün"). On beş satırlık salt okunur dökümdü
          ve panelin en üstünde duruyordu: kişi kendi düzenleyebildiği
          bölümlere inmek için her seferinde onu geçiyordu. Özette kimliği
          tanıtan üç değer var, gerisi bir tık uzakta.

          `duzenlenebilir` (22 Ağustos 2026 · istek: "Kimlik bilgileri sağ
          tarafta aç kapa yazısını diğerleri gibi kalem yapalım"): kutunun
          içindeki alanlar salt okunur ama sağdaki işaretin işi ekranın
          tutarlılığı — paneldeki diğer katlanır kutuların hepsinde kalem var
          ve tek bir "Aç / Kapat" rozeti sırıtıyordu.
        */
        duzenlenebilir
        ozet={<p>{kimlikOzeti.join(" · ")}</p>}
      >
        <div className="mb-5">
          <RozetSeridi>
            <Rozet cesit="vurgu" Ikon={IdCard}>
              {kullaniciRolEtiketi(kullanici)}
            </Rozet>
            <Rozet>{kullanici.egitimOgretimYili}</Rozet>
          </RozetSeridi>
        </div>
        <dl className="grid gap-5 sm:grid-cols-2">
          <SaltOkunurAlan etiket="Ad" deger={profilKaydi.ad} />
          <SaltOkunurAlan etiket="Soyad" deger={profilKaydi.soyad} />
          {/*
            Üç değer var, iki değil: dış başvuruda (mezun, paydaş) cinsiyet
            SORULMUYOR ve kayıt "B" ile açılıyor. İkili bir gösterim,
            sorulmamış bir bilgiyi "Erkek" diye uydururdu.
          */}
          <SaltOkunurAlan
            etiket="Cinsiyet"
            deger={
              profilKaydi.cinsiyet === "K"
                ? "Kadın"
                : profilKaydi.cinsiyet === "E"
                  ? "Erkek"
                  : "Belirtilmedi"
            }
          />
          <SaltOkunurAlan
            etiket="Eğitim-öğretim yılı"
            deger={kullanici.egitimOgretimYili}
          />
          {okulBilgisiVar && (
            <>
              <SaltOkunurAlan
                etiket="Okul"
                deger={profilKaydi.kurum?.ad ?? null}
              />
              <SaltOkunurAlan
                etiket="Kurum kodu"
                deger={String(profilKaydi.kurumKodu)}
              />
              <SaltOkunurAlan
                etiket="Okul türü"
                deger={profilKaydi.kurum?.okulTuru ?? null}
              />
            </>
          )}
          {!okulBilgisiVar && profilKaydi.beyanOkulAdi && (
            <>
              <SaltOkunurAlan
                etiket="Okul (listede yok)"
                deger={profilKaydi.beyanOkulAdi}
              />
              {profilKaydi.beyanOkulTuru && (
                <SaltOkunurAlan
                  etiket="Okul türü"
                  deger={profilKaydi.beyanOkulTuru}
                />
              )}
            </>
          )}
          {profilKaydi.il && (
            <SaltOkunurAlan etiket="İl" deger={profilKaydi.il.ad} />
          )}
          {profilKaydi.ilce && (
            <SaltOkunurAlan etiket="İlçe" deger={profilKaydi.ilce.ad} />
          )}
          {/*
            KURUM VE GÖREV yalnızca dış kullanıcıda. Öğretmenin kurumu okuldur
            ve yukarıda zaten yazıyor. Alanlar salt okunur DEĞİL; girişleri
            aşağıdaki "Bilgilerim" bölümünde.
          */}
          {disKullanici && (
            <>
              <SaltOkunurAlan etiket="Kurum" deger={kurumAdi} />
              <SaltOkunurAlan etiket="Görevi" deger={gorevUnvani} />
              {basvuru?.mezuniyetYili && (
                <SaltOkunurAlan
                  etiket="Mezuniyet yılı"
                  deger={String(basvuru.mezuniyetYili)}
                />
              )}
            </>
          )}
          {ogrenci ? (
            <SaltOkunurAlan etiket="Sınıf" deger={profilKaydi.sinif} />
          ) : (
            profilKaydi.brans && (
              <SaltOkunurAlan etiket="Branş" deger={profilKaydi.brans} />
            )
          )}
          <SaltOkunurAlan
            etiket="Sistem görevi"
            deger={kullaniciRolEtiketi(kullanici)}
          />
          {sorumluIlKodu && (
            <SaltOkunurAlan
              etiket="Sorumlu olduğu il"
              deger={
                sorumluIl ? `${sorumluIl.ad} (${sorumluIlKodu})` : sorumluIlKodu
              }
            />
          )}
        </dl>
      </KatlanabilirKart>
      )}

      {/*
        "FOTOĞRAFIM" BÖLÜMÜ KALKTI (20 Ağustos 2026 · istek: "paneldeki altta
        bulunan fotoğrafıma gerek kalmadı o zaten üstte olacak, alttakini
        kaldıralım ama banner üzerindeki alttaki ile ilişkili kalkınca
        bannerdaki görsel ekleme bağımsız olsun").

        Yükleme ve kaldırma formu VİTRİNE taşındı, silinmedi: fotoğrafa
        tıklayınca orada açılıyor (bkz. sayfanın başındaki `<details>`).
        Eylemler aynı eylemler; değişen tek şey formun durduğu yer.
      */}


      <KatlanabilirKart
        baslik={
          // Dış kullanıcıda bölüm yalnızca iletişim değil kurum, görev ve katkı
          // açıklamasını da taşıyor; başlık bunu söylemezse kişi profilindeki
          // alanları burada aramaz.
          disKullaniciMi(kullanici) ? "Bilgilerim" : "İletişim bilgilerim"
        }
        /*
          ÖĞRENCİDE AÇIKLAMA YOK (21 Ağustos 2026 · istek: "Bu alanları siz
          düzenleyebilirsiniz; profilinizde görünür. paneldeki bu açıklama
          silinsin"). Başlık ve alanların kendisi zaten ne olduğunu söylüyordu.
          Dış kullanıcıda ve öğretmende satır KALIYOR: orada açıklama başka bir
          şey söylüyor — bölümün iletişim dışında ne taşıdığını ve bilgiyi
          kimin göreceğini.
        */
        Ikon={Mail}
        capa="iletisim-bilgilerim"
        duzenlenebilir
        ozet={
          iletisimOzeti.length > 0 ? <p>{iletisimOzeti.join(" · ")}</p> : undefined
        }
        baslangictaAcik={acilacakBolum === "iletisim-bilgilerim"}
      >
        <IletisimDuzenleme
          iletisim={
            ogrenciMi(kullanici)
              ? profilKaydi.ogrenciProfil
              : profilKaydi.ogretmenProfil
          }
          baglantilar={
            ogrenciMi(kullanici)
              ? profilKaydi.ogrenciProfil
              : profilKaydi.ogretmenProfil
          }
          /*
            Kurum/görev/açıklama YALNIZCA dış kullanıcıda basılır; `null`
            geçildiğinde bileşen o alanları hiç göstermiyor. Öğretmenin kurumu
            okuludur ve kimlik bilgilerinden gelir, elle yazılmaz.
          */
          kurumBilgileri={
            disKullaniciMi(kullanici) ? profilKaydi.ogretmenProfil : null
          }
          ogrenci={ogrenciMi(kullanici)}
          kaydetEylemi={profilGuncelleEylemi}
        />
      </KatlanabilirKart>

      {/*
        "DANIŞMAN ÖĞRETMENLİĞİM" BÖLÜMÜ BURADAN KALKTI (7 Ağustos 2026 · istek:
        "GençTek Danışman Öğretmenliği Öğrencilerim sekmesine geçsin").
        İşaret ve durum artık Öğrencilerim ekranının başında — görevle o ekran
        aynı işin parçası.
      */}

      {/*
        "MENTÖR OLARAK BAŞVUR" BÖLÜMÜ PANODA (13 Ağustos 2026 · istek: "panelde
        mentör olarak başvur kalksın … paneldeki Mentör olarak başvur kısmını
        panoya al").

        Gerekçe yerin kendisinde: mentörlüğün karşılığı panoda — "Mentör talebi
        aç" formu ve mentör havuzu ızgarası orada. Başvuru burada dururken kişi,
        kabul ettiği görevin ne işe yaradığını göremiyordu.

        Panelde yerine SAYI KARTI kondu ("Mentörlüklerim"); yetki, kayıt ve
        onay akışı değişmedi (bkz. mentorluk/eylemler.ts).
      */}

      {/*
        ÇALIŞMA GRUPLARI (7 Ağustos 2026 · istek: dış kullanıcı panelinde
        "Mentörlüklerim/desteklerim · Çalışma Grupları").

        MENTÖRLÜK KARTININ ALTINDA ve ondan AYRI: mentörlük onaya giden bir
        başvurudur, gönderim onaylı kaydı yeniden onaya düşürür. Burası
        yalnızca bir beyandır ve kaydetmek onay gerektirmez. Tek forma
        alınsalardı destek alanını güncellemek isteyen kişi mentörlüğünü de
        onaya düşürürdü.
      */}
      {destekVerisi && (
        <KatlanabilirKart
          baslik="Çalışma gruplarım"
          Ikon={Layers}
          capa="katki-alanlarim"
          duzenlenebilir
          baslangictaAcik={acilacakBolum === "katki-alanlarim"}
        >
          {/*
            SEÇİLİ GRUPLAR ÖNCE, FORM SONRA (20 Ağustos 2026 · birleşme).
            Profilde bu seçim rozet olarak görünüyordu; o ekran kapandı.
            Rozetler işaret kutularının tekrarı değil ÖZETİ: on beş kutunun
            içinden hangi ikisinin işaretli olduğu, tek satırda okunur.
          */}
          {profilKaydi.destekGruplari.length > 0 && (
            <ul className="mb-5 flex flex-wrap gap-2">
              {profilKaydi.destekGruplari.map(({ calismaGrubu }) => (
                <li
                  key={calismaGrubu.id}
                  className="rounded-full bg-vurgu-zemin px-3 py-1 text-sm text-vurgu-metin"
                >
                  {calismaGrubu.ad}
                </li>
              ))}
            </ul>
          )}
          <DestekGruplariDuzenleme
            gruplar={destekVerisi[0]}
            seciliGrupIdleri={destekVerisi[1].map(
              (satir) => satir.calismaGrubuId,
            )}
            kaydetEylemi={destekGruplariEylemi}
          />
        </KatlanabilirKart>
      )}

      <KatlanabilirKart
        /*
          BAŞLIK "EKLEMEK İSTEDİKLERİM" (31 Ağustos 2026 · istek: "bunu eklemek
          istediklerim yapacaktık başlığı, açıklamayı da sil buradaki").

          Bölüm 28 Ağustos'a kadar yalnızca yüklenen PDF'i tutuyordu ve adı
          "Özgeçmişim (CV)" idi; bugün metin alanı da eklenince ad, içindekinin
          yarısını anlatır oldu. Yeni ad ikisini birden kapsıyor: kişinin
          özgeçmişine EKLEMEK İSTEDİĞİ şeyler — yazdığı metin ve yüklediği
          dosya.

          ÇAPA "cvm" OLARAK KALDI: dışarıdan gelen bağlantılar (eylemlerin
          dönüş adresleri, `?bolum=cvm`) bu çapaya iniyor ve adı değiştirmek
          eski bağlantıları sessizce kapalı bir sayfaya düşürürdü.
        */
        baslik="Eklemek istediklerim"
        /*
          ÖĞRENCİDE AÇIKLAMA YOK (21 Ağustos 2026 · istek). Öğretmende satır
          kalıyor: CV'yi kimin göreceği orada hâlâ sorulan bir soru.
        */
        Ikon={FileText}
        capa="cvm"
        duzenlenebilir
        ozet={
          cvOzeti ? (
            <p>
              {cvOzeti}
              {cvTarihi && (
                <span className="text-metin-yumusak">
                  {" "}
                  · {tarihYaz(cvTarihi)} tarihinde yüklendi
                </span>
              )}
            </p>
          ) : undefined
        }
        baslangictaAcik={acilacakBolum === "cvm"}
      >
        {/*
          PROFİLDEN ÜRETİLEN ÖZGEÇMİŞ (28 Ağustos 2026 · istek: "profildeki her
          şeyi cv formatında Word olarak indirebilsin, güzel bir cv formatı
          olsun").

          YÜKLENEN CV'NİN YERİNE GEÇMİYOR, YANINDA DURUYOR: alttaki form kişinin
          kendi pdf'ini saklıyor, bu bağlantı sistemdeki veriden bir belge
          üretiyor. İkisi aynı kartta çünkü kişinin "özgeçmişim" diye aradığı
          yer burası; ayrı bir bölüm açılsaydı aynı soru panelde iki başlıkla
          karşılanırdı.

          `<a>` VE `uygulamaYolu` — `<Link>` DEĞİL: dosya indirmede istemci
          tarafı gezinmenin yapacağı bir şey yok ve ham yol, TEMEL_YOL altında
          yayımlanan kurulumda ters vekile düşerdi (bkz. DisaAktarmaBagi).
        */}
        {/*
          BAĞLANTI DEĞİL, İŞARET: indirme düğmesi vitrine taşındı (28 Ağustos
          2026 · istek: "nerdev cv indir butonu bannera koy"). Satır burada
          kalıyor çünkü "özgeçmişim" diye bakılan yer bu kart; düğmeyi burada
          da basmak aynı işi yapan ikinci bir kapı olurdu.
        */}
{/*
          GİRİŞ PARAGRAFI KALKTI (31 Ağustos 2026 · istek: "açıklamayı da sil
          buradaki"). Üç iş yapıyordu ve üçünün de karşılığı yerinde:
            · bölümün ne olduğunu söylüyordu → başlık artık onu söylüyor,
            · yüklenen dosya ile üretilen belgenin farkını anlatıyordu →
              kutunun içindeki iki alan (metin ve dosya) kendi etiketleriyle
              duruyor,
            · "Özgeçmiş oluştur" düğmesinin yerini tarif ediyordu → düğme
              vitrinde, sayfanın en üstünde ve kendi adını taşıyor.
          Kapağın altında dört satır okumadan hiçbir şey yapılamayan bir kutu,
          kısa iki formdan uzundu.
        */}
        <CvDuzenleme
          cv={
            ogrenciMi(kullanici)
              ? profilKaydi.ogrenciProfil
              : profilKaydi.ogretmenProfil
          }
          kullaniciId={kullanici.id}
          ogrenci={ogrenciMi(kullanici)}
          izinliTipler={cvSinirlari.izinliTipler}
          ekNotuAzami={CV_EK_NOTU_AZAMI}
          yukleEylemi={cvYukleEylemi}
          notKaydetEylemi={cvEkNotuKaydetEylemi}
          silEylemi={cvSilEylemi}
        />
      </KatlanabilirKart>

      {/*
        KAYIT BÖLÜMLERİ PANELE GERİ DÖNDÜ (22 Ağustos 2026 · istek: "paneldeki
        Bilişim Yolculuğum kartı kalkacak, içindekiler panelin altına sırayla
        ayrı gruplara açılır gelecek … diğerlerini direk panele alt alta
        alıyoruz açılır şekilde").

        21 Ağustos'ta kendi sayfasına çıkmışlardı ve panelde yerlerine bir kart
        vardı; kart kalktığı için sayfanın kapısı da kalmadı. /panel/bilisim-
        yolculugum SİLİNDİ, eski bağlantılar bu bölümlerin çapalarına
        yönlendiriliyor (bkz. kazanimGrupCapasi).

        HER GRUP KENDİ KUTUSU, KENDİ FORMU: ortak formda hangi başlığa kayıt
        girildiği yalnızca seçili sekmeden anlaşılıyordu. Sıra
        `kayitEklemeGruplari` sırasıdır — profildeki başlık sırasıyla aynı.
      */}
      {kayitGruplari.map(({ grup, tanimlar }) => {
        const capa = kazanimGrupCapasi(grup.kod);
        const seciliTanim =
          tanimlar.find((tanim) => tanim.tip === seciliKayitTuru) ??
          tanimlar[0];
        /*
          ÖZET ARTIK SAYI DEĞİL, KAYITLARIN KENDİSİ (22 Ağustos 2026 · istek:
          "Topluluklarım / Ekiplerim ekleyince özetleri görünsün").

          Önce "3 kayıt" yazıyordu; kişi ne girdiğini görmek için kutuyu açmak
          zorundaydı ve kutu açılınca yalnızca EKLEME FORMU çıkıyordu — girilen
          kayıtlar panelde başka hiçbir yerde görünmüyor ("Girdiğim kayıtlar"
          bölümü kalktı). Başlıklar özette durunca kutu kapalıyken de "ne
          eklemiştim" sorusunun cevabı ekranda.

          BOŞ GRUPTA HİÇ BASILMIYOR: "0 kayıt" satırı ekranı bilgi değil eksik
          listesi gibi okuturdu (aynı kural İletişim bilgilerimde).

          ÜÇ GRUPTA DA aynı: istek Topluluklarım için geldi ama Ürünlerim ve
          Deneyimlerim de aynı sebeple aynı durumdaydı.
        */
        const grubunKayitlari = profilKaydi.kazanimlar.filter((kazanim) =>
          grup.tipler.includes(kazanim.tip),
        );

        return (
          <KatlanabilirKart
            key={grup.kod}
            baslik={grup.baslik}
            aciklama={grup.aciklama}
            Ikon={Sparkles}
            capa={capa}
            duzenlenebilir
            baslangictaAcik={acilacakBolum === capa}
            ozet={
              grubunKayitlari.length > 0 ? (
                /*
                  `line-clamp-2`: yirmi kayıt giren kişide özet, kutunun
                  kendisinden uzun olurdu. Sayı başta duruyor — kırpılan
                  listede kaç kaydın olduğu yine okunuyor.
                */
                <p className="line-clamp-2">
                  <span className="font-medium">
                    {grubunKayitlari.length} kayıt
                  </span>
                  {" · "}
                  {grubunKayitlari.map((kazanim) => kazanim.baslik).join(" · ")}
                </p>
              ) : undefined
            }
          >
            {/*
              GİRİLEN KAYITLAR FORMUN ÜSTÜNDE (25 Ağustos 2026 · istek: "bu üç
              başlıkta … daha önce girilen etkinlik için ismi ve düzenleme
              kısmı var; onu formların üstüne alalım, yani üstte gözüksün bu
              düzenleme ve liste").

              24 Ağustos'ta liste formun ALTINDAYDI: kutuyu açan kişi önce sekiz
              alanlı boş bir formla karşılaşıyor, girdiği kaydı görmek için
              onu geçmek zorunda kalıyordu. Kutuyu açmanın asıl sebebi çoğu
              zaman "ne girmiştim / şunu düzelteyim" — ekleme ikinci iş.

              Her satır kaydın kendi sayfasına gidiyor (bkz.
              panel/kayitlarim/[id]); düzenlemenin başka kapısı yok.
            */}
            <GirilenKayitlar kazanimlar={grubunKayitlari} tanimlar={tanimlar} />
            <KayitEklemeFormu
              grup={grup}
              tanimlar={tanimlar}
              seciliTanim={seciliTanim}
              izinliBelgeTipleri={izinliBelgeTipleri}
              belgeSinirlari={belgeSinirlari}
              ekleEylemi={kazanimEkleEylemi}
            />
          </KatlanabilirKart>
        );
      })}

      {/*
        REFERANSLARIM (28 Ağustos 2026 · istek: "Öğrenciler için profile
        referanslar bölümü ekleyelim. Referans için ad soyad telefon kurum
        eposta").

        ÖĞRETMENDE DE VAR (31 Ağustos 2026 · istek: "Öğretmene de referans
        ekleme olsun öğrenci gibi"). 28 Ağustos'taki not "öğretmene de açılmak
        istenirse tek koşul değişiyor" diyordu; değişen tam olarak o koşul
        oldu. Referans üretilen özgeçmişin parçası ve özgeçmiş öğretmende de
        üretiliyor — bölümün onda olmaması, aynı belgeyi iki ayrı iskeletle
        çıkarıyordu. Bölümün içi, sınırı ve doğrulaması aynı (bkz.
        lib/yetki/izinler.ts · referansTutabilirMi).

        DIŞ KULLANICI (mezun, paydaş temsilcisi) DIŞARIDA: satırlar üçüncü
        kişilerin iletişim bilgisi ve o kapıyı açmak ayrı bir karar.

        EN ALTTA, DÜZENLENEBİLİR BÖLÜMLERİN SONUNDA (28 Ağustos 2026 · istek:
        "profilde bu görünmüyor en alta gelecekti"). Önce İletişim
        bilgilerim'in hemen ardındaydı; gerekçe ikisinin de "bana nasıl
        ulaşılır" sorusunu cevaplamasıydı. Bir CV'de referanslar en sonda
        durur ve profilin sırası belgeninkini izliyor. Buradan aşağısı
        DÜZENLENMEZ, HESAPLANIR (katkı kartı, nişanlar, katılım geçmişi) —
        yani bu, kişinin doldurduğu son kutu.

        ÖZETTE YALNIZCA SAYI, AD YOK: satırlar üçüncü kişilerin iletişim
        bilgisi ve kutu kapalıyken profilin üstünde durmalarının bir sebebi
        yok — kişi kaç referans yazdığını bilmek için açmak zorunda değil,
        kimlerin telefonunun ekranda durduğunu ise kendisi seçmeli.
      */}
      {referansTutabilirMi(kullanici) && (
        <KatlanabilirKart
          baslik="Referanslarım"
          /*
            AÇIKLAMASI KALKTI (28 Ağustos 2026 · istek: "Hakkınızda görüşüne
            başvurulabilecek kişiler. Ürettiğiniz özgeçmişe eklenir; panelde
            sizden başkası görmez. açıklamayı sil") — aynı gün Topluluklarım
            bölümünde de yapılan sadeleştirme.

            Cümlenin taşıdığı iki bilgi KAYBOLMADI, kutunun içinde duruyor:
            formun altındaki satır referansa ulaşılabilir olması gerektiğini ve
            bilginin üçüncü bir kişiye ait olduğunu söylüyor (bkz.
            ProfilDuzenleme · ReferansDuzenleme). Başlık zaten bölümün ne
            olduğunu söylüyordu; açıklama aynı şeyi kapağın üstünde ikinci kez
            tekrarlıyordu.
          */
          Ikon={UserCheck}
          capa="referanslarim"
          duzenlenebilir
          ozet={
            referanslar.length > 0 ? (
              <p>{referanslar.length} referans</p>
            ) : undefined
          }
          baslangictaAcik={acilacakBolum === "referanslarim"}
        >
          <ReferansDuzenleme
            referanslar={referanslar}
            azamiSayi={REFERANS_AZAMI_SAYI}
            ekleEylemi={referansEkleEylemi}
            guncelleEylemi={referansGuncelleEylemi}
            silEylemi={referansSilEylemi}
          />
        </KatlanabilirKart>
      )}

      {/*
        "GİRDİĞİM KAYITLAR" BÖLÜMÜ KALKTI (22 Ağustos 2026 · istek: "panelde
        Girdiğim kayıtlar bunu kaldır en altta").

        Bölüm girilen bütün kayıtları tipe göre listeliyor, her satırda silme ve
        "destekleyici belge ekle" formunu taşıyordu.

        BUNUNLA BİRLİKTE GİDEN İKİ İŞ: kayıt silme ve var olan bir kayda
        sonradan belge ekleme/çıkarma. Sunucu eylemleri (kazanimSilEylemi,
        kazanimBelgeEkleEylemi, kazanimBelgeSilEylemi) DURUYOR ve yetki
        kontrolleri yerinde — yalnızca onları çağıran ekran yok. Bu işler geri
        istendiğinde bölüm yeniden basılabilir ya da kayıtlar grup kutularının
        içine dağıtılabilir.
      */}


      {/*
        ---------------------------------------------------------------------
        KAYITLARIMIN GÖRÜNEN HÂLİ (20 Ağustos 2026 · birleşme)
        ---------------------------------------------------------------------
        Buradan aşağısı DÜZENLENMEZ, HESAPLANIR: katkı kartı, nişanlar,
        katılım geçmişi ve danışmanlık listesi girilen kayıtlardan türer.
        Katlanır değiller — düzenleme bölümlerinden farkları bu: bir formun
        kapalı durması "işin yoksa açma" demektir, bir sayımın kapalı durması
        onu görünmez yapardı.
      */}

      {/*
        ÖĞRENCİLERİM — danışman öğretmenin karşılığı. Liste profilden geldi;
        ekranın kendisi (`/panel/ogrenciler`) yerinde ve bağlantı oraya
        gidiyor.
      */}
      {/*
        "ÖĞRENCİLERİM" KARTI KALKTI (26 Ağustos 2026 · istek: "profilden
        Öğrencilerim … bu alanı kaldır").

        Kart, danışmanlıktaki öğrencileri hap biçiminde listeleyip altına
        "Öğrencilerim ekranına git" bağlantısı koyuyordu. Aynı liste kendi
        ekranında filtreleri, arama kutusu ve satır eylemleriyle duruyor;
        panele düşen kopya yalnızca adları gösteriyordu. Panelin üstündeki
        "Öğrencilerim" ölçüm kartı o ekrana zaten götürüyor.
      */}

      {/*
        "İLİMDEKİ KİŞİLER" KARTI KALKTI (26 Ağustos 2026 · istek: "İlimdeki
        kişiler · Öğrenci 3 · Öğretmen 4 · Danışmansız öğrenci 0 · Öğrenciler
        ekranına git → Öğretmenler ekranına git → panelden bunu da silelim").

        Kart üç sayı ve iki bağlantıdan ibaretti; üçünün de karşılığı, aynı
        gün buraya taşınan diğer kartlarla birlikte Yönetim Paneli'nde: il
        kartı ilin öğrenci ve öğretmen sayısını zaten yazıyor, koordinatörün
        ölçüm şeridi de öğrenci sayısını başa alıyor (bkz.
        panel/yonetim/page.tsx). "Ekrana git" bağlantılarının işini oradaki
        Öğrenciler ve Öğretmenler kısayol kartları görüyor.

        Koordinatörün profil sayfası, aynı gün kalkan üç ölçüm kartıyla
        birlikte artık yalnızca kendi kaydını gösteriyor.
      */}

      {/*
        "GENÇTEK YOLCULUĞUM" VE "KATKI NİŞANLARIM" KENDİ SAYFALARINA TAŞINDI
        (21 Ağustos 2026 · istekler: "Şu bölüm kalkacak: GençTek Yolculuğum.
        Ancak yaptığı görevler Görevlerim kart olarak yukarı taşınacak" ·
        "Kayıtlarım ve katkı nişanlarımı panelden kaldır alttan").

        Yeni adresler: /panel/gorevlerim ve /panel/nisanlarim. İkisinin de
        panelde bir kartı var; kartlar sayıyı gösteriyor, sayfalar listeyi.
      */}

      {/*
        "KATILDIĞI GENÇTEK ETKİNLİKLERİ" KARTI KALKTI (26 Ağustos 2026 ·
        istek: "bu alanı kaldırıp öğrenci sayfasındaki … ile aynı yap").

        Kart, adına belge üretilen etkinlikleri sayıyordu ve öğretmenlerin
        çoğunda "0 etkinlik" yazıyordu — belge çoğunlukla katılımcı öğrenciye
        üretiliyor. Profilin öğretmen tarafı artık öğrencininkiyle aynı üç
        bölümden oluşuyor: Ürünlerim · Deneyimlerim · Topluluklarım
        (bkz. lib/kazanim/kurallar.ts · BILISIM_YOLCULUGU_GRUPLARI).

        VERİ DURUYOR: katılım hesabı (lib/kazanim/getir.ts) yerinde ve
        Katkılarım ekranında okunuyor; kalkan yalnızca panodaki kart.
      */}

      {/*
        ÖĞRETMENİN KATKI NİŞANLARI DA /panel/nisanlarim ekranında (21 Ağustos
        2026): iki rol aynı sayfayı kullanıyor, ölçütleri farklı kaynaklardan
        besleniyor.
      */}

      {/*
        ROTAM EKRANDAN TAMAMEN KALKTI (20 Ağustos 2026 · istek: "rotam komple
        kalkacak").

        Bölümün GİRİŞİ 14 Ağustos'ta kaldırılmıştı; 20 Ağustos'ta panel ile
        profil birleşince girilmiş hedefler kısa süre burada listelendi, o
        liste de kalktı. Panelde artık hiçbir izi yok.

        VERİ SİLİNMEDİ ve eylemler duruyor (`profil/hedef-eylemleri.ts`):
        kullanıcıların girdiği hedefler `kullanici_hedefi` tablosunda. Ekran
        kararıyla veri silmek geri alınamaz bir iş olurdu; bölüm geri
        istenirse kayıtlar yerinde.
      */}

      {/*
        KVKK / ONAY BELGELERİ BÖLÜMÜ KALKTI (21 Ağustos 2026 · istek: "KVKK'lar
        panelden kalkacak … kvkk olmasın") VE BURAYA GERİ GELMEDİ.

        2 Eylül 2026'da onay yeniden istenmeye başlandı ama bu bölüm olarak
        değil: belgeler ilk girişte kapıda okutuluyor (app/onay) ve sonradan
        Kişisel Verilerim ekranından okunuyor. Panelin ortasında üçüncü bir
        kopya, aynı metni üç yerde güncel tutmak demekti.

        Metinler ve verilmiş onaylar DURUYOR (lib/kvkk/*, `kullanici_onayi`).
      */}

      {/*
        ÖZDEĞERLENDİRME ENVANTERLERİ — Algoritmam (7 Ağustos 2026).
        İstek: "Özdeğerlendirme Envanterler- Algoritmam (ileride yz)".

        Sekme menüden kalktı, giriş buraya geldi. Envanterin KENDİSİ
        `/panel/algoritmam` ekranında kalıyor: madde madde ilerleyen bir
        uygulama ve katlanabilir bir bölüme sığmaz. Buradaki iş, girişi
        vermek ve sonucun kime görünür olduğunu söylemek.

        "İleride yz" — yapay zekâ ile öz değerlendirme sonraki faza bırakıldı
        (YAPILACAKLAR.md · K).
      */}
      {/*
        BÖLÜM KALKTI, KART KALDI (14 Ağustos 2026 · istek: "öz değerlendirme
        envanteri kartlara gelecek, alttan kalkacak"). Giriş yukarıdaki ölçüm
        kartlarında; envanterin kendisi `/panel/algoritmam` ekranında ve
        "sonuçlar yalnızca sana görünür" cümlesi o ekranın başında yazıyor.
      */}

      {/*
        ROTAM YALNIZCA ÖĞRENCİDE (11 Ağustos 2026 · istek: "rotam sadece
        öğrencide olacak, öğretmen koordinatör yönetici paydaş mentör bunlarda
        rotam olmayacak").

        Bölüm önce dış kullanıcılardan (7 ve 11 Ağustos), şimdi de yetişkin
        rollerin tamamından kalktı. Gerekçe aynı yerde birleşiyor: Rotam bir
        GELİŞİM aracıdır — "öğrenmek istediğim konu, katılmak istediğim
        yarışma". Öğretmenin, koordinatörün ve merkez personelinin sistemle
        ilişkisi gelişme değil YÜRÜTME; onlara hedef listesi sunmak, sistemin
        onları da yetiştirilecek biri gibi gördüğünü söylerdi.

        SAYFA VE EYLEMLER SİLİNMEDİ: hedef eylemleri rol kısıtı taşımıyor
        (bkz. hedef-eylemleri.ts) ve daha önce hedef girmiş bir öğretmenin
        kayıtları duruyor. Kalkan şey bölümün BASILMASI; kayıtlar profilinde
        görünmeye devam ediyor.
      */}
      {/*
        ROTAM PANELDEN KALKTI (14 Ağustos 2026 · istek: "rotam kalksın").

        Bölüm 7 ve 11 Ağustos'ta önce dış kullanıcılardan, sonra bütün yetişkin
        rollerden çekilmişti; şimdi öğrencide de basılmıyor, yani Panelim'de
        hiç yok.

        KAYITLAR VE EYLEMLER SİLİNMEDİ: hedef eylemleri rol kısıtı taşımıyor
        (bkz. hedef-eylemleri.ts) ve girilmiş hedefler PROFİLDE görünmeye devam
        ediyor. Kalkan şey Panelim'deki giriş bölümü — veri silinseydi geri
        alınamazdı, oysa bu bir ekran kararı.
      */}


      {/*
        "BAŞVURUYA AÇIK ETKİNLİKLER" ve "KATILDIĞIM ETKİNLİKLER" LİSTELERİ
        KALKTI (13 Ağustos 2026 · istek: "başvuruya açık etkinlikler panelde hem
        kartlarda hem altta var, alttaki kalkacak, kartlarda zaten var o
        duracak" · "paneldeki alttaki Katıldığım etkinlikler kalkacak, kartlarda
        zaten var").

        İkisi de yukarıdaki ölçüm kartlarında SAYIYLA duruyor ve kartlar
        tıklanabilir: "Başvurusu açık etkinlik" → /panel/etkinlikler?acik=1,
        "Katıldığım etkinlikler" → katılım listesi. Aynı bilgi hem kartta hem
        altta liste hâlinde basılınca panel iki kez aynı şeyi söylüyordu ve
        asıl işleri (Mevcut durum, Kayıtlarım, takvim) aşağı itiyordu.

        VERİ AKIŞI DURUYOR: `seritKayitlari` ve `katilimGecmisi` kartların
        sayılarını beslemeye devam ediyor, listeler yalnızca basılmıyor.
      */}

      {/*
        "ETKİNLİK TAKVİMİ" BÖLÜMÜ KALKTI (20 Ağustos 2026 · istek: "Etkinlik
        takvimi bunu kaldıralım").

        Bugün / Yaklaşan / Geçmiş üçlüsü panelin en uzun bölümüydü ve aynı
        bilgiyi başka yerler daha kısa veriyor: sıradaki kendi etkinliği
        yukarıdaki kartta, başvurusu açık olanlar şeritte, tamamı ise
        Etkinlikler ekranında (/panel/etkinlikler) filtreleriyle duruyor.

        VERİ AKIŞI DURUYOR: `takvimFaaliyetleri` sorgusu, başvuru şeridini
        (`seritKayitlari`) beslediği için yerinde kaldı; yalnızca takvim
        bölümü basılmıyor.
      */}
      {/*
        "BİLDİRİMLER" BÖLÜMÜ KALKTI (22 Ağustos 2026 · istek: "panelde en
        alttaki bildirimleri kaldıralım, tamamını başka sayfaya taşıyıp,
        bannerdaki '3 okunmamış mesajı var' butonuna tıklayınca o sayfaya
        gitsin").

        Buradaki liste zaten yalnızca son beş OKUNMAMIŞ satırdı ve tamamı
        /panel/bildirimler ekranında duruyor — süzgeçleri, sayfalaması ve
        okunmuş kayıtlarıyla. İki yüzey aynı işi yaparken vitrindeki düğme
        kişiyi eksik olana indiriyordu; artık doğrudan tam listeye götürüyor.

        VERİ AKIŞI DURUYOR: okunmamış sayısı (`okunmamisMesajSayisi`) vitrindeki
        düğme için hâlâ hesaplanıyor, yalnızca liste basılmıyor.
      */}
    </div>
  );
}
