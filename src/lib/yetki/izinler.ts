import type { Kapsam, RolKodu } from "@/generated/prisma/enums";
import type { FaaliyetKapsami, OturumKullanicisi } from "./tipler";

/**
 * Açtığı etkinlik İL KOORDİNATÖRÜNÜN onayına tabi olan roller.
 *
 * TEK KAYNAK (11 Ağustos 2026). Bu liste iki yerde birden gerekiyor:
 *
 *   1. `ilKoordinatoruOnaylayabilirMi` — koordinatör bu kaydı onaylayabilir mi?
 *   2. `faaliyetKapsamFiltresi` — koordinatör bu kaydı GÖREBİLİR mi?
 *
 * İkisi iki ayrı dosyada elle yazılıyordu ve İKİ KEZ AYRIŞTI: önce danışman
 * öğretmen onaya tabi kılınıp filtre unutuldu, sonra aynısı mezun/paydaş/mentör
 * için tekrarlandı. Sonuç her seferinde aynı sessiz kilitlenme oldu —
 * koordinatöre "onayınızı bekliyor" bildirimi gidiyor, bildirimdeki bağlantı
 * 404 veriyor, etkinlik sonsuza kadar BEKLIYOR'da kalıyor. Hiçbir yerde hata
 * görünmüyor.
 *
 * Artık ikisi de bu diziden türüyor; yeni bir rol eklemek tek satır.
 */
export const KOORDINATOR_ONAYINA_TABI_ROLLER: readonly RolKodu[] = [
  "OGRENCI",
  "DANISMAN",
  "MEZUN",
  "PAYDAS_TEMSILCISI",
];

/**
 * references/permissions.md Bölüm 1'deki yetki matrisinin birebir karşılığı.
 *
 * Buradaki fonksiyonlar saf tutulur (veritabanına gitmez) ki birim testle
 * eksiksiz kapsanabilsinler. Sık yapılan hatayı önlemek için her fonksiyon
 * hem ROLÜ hem KAPSAMI sorar: "il koordinatörü mü" yeterli değildir,
 * "bu kayıt onun ilinde mi" de sorulmalıdır.
 */

export function projeYoneticisiMi(kullanici: OturumKullanicisi): boolean {
  return kullanici.roller.some((rol) => rol.rolKodu === "PROJE_YONETICISI");
}

export function ilKoordinatoruMu(kullanici: OturumKullanicisi): boolean {
  return kullanici.roller.some((rol) => rol.rolKodu === "IL_KOORDINATOR");
}

export function danismanMi(kullanici: OturumKullanicisi): boolean {
  return kullanici.roller.some((rol) => rol.rolKodu === "DANISMAN");
}

export function ogrenciMi(kullanici: OturumKullanicisi): boolean {
  return kullanici.roller.some((rol) => rol.rolKodu === "OGRENCI");
}

export function mezunMu(kullanici: OturumKullanicisi): boolean {
  return kullanici.roller.some((rol) => rol.rolKodu === "MEZUN");
}

export function paydasTemsilcisiMi(kullanici: OturumKullanicisi): boolean {
  return kullanici.roller.some((rol) => rol.rolKodu === "PAYDAS_TEMSILCISI");
}

/**
 * Kimliği EBA'dan (mock aşamada AuthProvider'dan) GELMEYEN kullanıcı: mezun ve
 * paydaş temsilcisi.
 *
 * NİYE TEK KAVRAM: ikisinin yetki tablosu bugün aynı — "yalnızca kendi
 * profilini, etkinlik takvimini ve talep panosunu görür". Her kapıda iki rolü
 * ayrı ayrı saymak, birinin unutulduğu bir kapı bırakırdı ve unutulan kapı
 * hata vermez, sessizce veri gösterirdi. İkisinin yetkisi gerçekten ayrışırsa
 * o kapıda ayrı ayrı sorulur, bu fonksiyon kaldırılmaz.
 *
 * DİKKAT: Bu, "kullanıcının kurum kodu yok" demek DEĞİLDİR. YEĞİTEK personeli
 * de kurumsuzdur ama kimliği AuthProvider'dan gelir ve yetkisi en geniştir.
 */
export function disKullaniciMi(kullanici: OturumKullanicisi): boolean {
  return mezunMu(kullanici) || paydasTemsilcisiMi(kullanici);
}

/**
 * Profilinde REFERANS tutabilir mi?
 *
 * ÖĞRETMEN 31 AĞUSTOS 2026'DA İÇERİ ALINDI (istek: "Öğretmene de referans
 * ekleme olsun öğrenci gibi"). Bölüm 28 Ağustos'ta yalnızca öğrenciye
 * açılmıştı ve gerekçesi "istek öğrenci için geldi" idi — bir kural değil, bir
 * kapsam. Referans, üretilen özgeçmişin parçası ve özgeçmiş öğretmende de
 * üretiliyor; bölümün onda olmaması, aynı belgenin iki iskeletle çıkması
 * demekti.
 *
 * DIŞ KULLANICI DIŞARIDA (mezun, paydaş temsilcisi): kayıt ÜÇÜNCÜ BİR KİŞİNİN
 * iletişim bilgisidir ve tabloya kimin yazabildiği dar başlamıştı. Onlara
 * açmak ayrı bir karar — bugün kimse istemedi ve istenmemiş bir yetki için
 * üçüncü kişilerin telefonlarını toplayan bir kutu açılmaz.
 *
 * SINIR VE DOĞRULAMA DEĞİŞMİYOR: en fazla üç satır, telefon ya da e-postadan
 * en az biri zorunlu (bkz. lib/referans/kurallar.ts). Rol, kaç referans
 * tutulacağını değiştirmiyor — bir öğretmenin referansı da bir öğrencininki
 * kadar yer tutar.
 */
export function referansTutabilirMi(kullanici: OturumKullanicisi): boolean {
  return !disKullaniciMi(kullanici);
}

/**
 * EBA dışı giriş başvurularını görme ve karara bağlama yetkisi.
 *
 * Yalnızca proje yöneticisi: talebin kendisi böyle ("onayı proje yöneticisine
 * düşecek"). İl koordinatörüne açılması bir ürün kararıdır — başvuran kişinin
 * ili belli olsa da mezun/paydaş kabulü ekosistem düzeyinde bir karardır.
 */
export function disBasvuruYonetebilirMi(kullanici: OturumKullanicisi): boolean {
  return projeYoneticisiMi(kullanici);
}

/**
 * Mentörlük başvurusu YAPABİLİR mi? (7 Ağustos 2026)
 *
 * ROLÜ OLAN HERKES: öğrenci, öğretmen, il koordinatörü, proje yöneticisi,
 * mezun ve paydaş temsilcisi. Dışarıdan gelenler bunu başvuru formundan
 * istiyor; içerideki kullanıcılar panodaki "Mentör olarak başvur" ekranından.
 *
 * ÖĞRENCİ 14 AĞUSTOS 2026'DA GİRDİ (istekler: "öğrenci de mentör olarak
 * başvurabilsin", "ama onay olsun onun için").
 *
 * ÖNCEKİ KURAL ve neden değişti: öğrenci hariç tutuluyordu çünkü mentörlük
 * "18 yaş altı bir kullanıcıyla birebir yazışma hakkı doğurur ve o hakkın
 * karşı tarafı yetişkin olmalıdır" deniyordu. Bu cümlenin ilk yarısı YANLIŞTI:
 * mentörlük tek başına yazışma hakkı doğurmuyor —
 *
 *   · mentörün ilana yazdığı CEVAP açıktır, panoda herkes okur
 *     (bkz. mentorlugum/eylemler.ts · mentör sayfası),
 *   · birebir yazışma yine BAĞLANTI İSTEĞİNDEN ve danışman/koordinatör
 *     onayından geçer (bkz. baglantiIstegiGonderilebilirMi ve
 *     baglantiKarariFiltresi). Mentör olmak bu kapıyı açmıyor.
 *
 * Yani öğrenci mentör olduğunda kazandığı şey, panodaki ilanlara açıkta cevap
 * yazabilmek — akran desteğinin ta kendisi ve bu sistemin kurulma sebebi.
 *
 * KAPI ONAYDIR: başvuru `BEKLIYOR` açılır ve kararı YALNIZCA proje yöneticisi
 * verir (bkz. mentorlukOnaylayabilirMi). Kural "her öğrenci mentördür" değil,
 * "merkezin uygun gördüğü öğrenci mentör olabilir".
 *
 * ROLSÜZ KULLANICI DIŞARIDA KALMAYA DEVAM EDİYOR: rolü olmayan kayıt
 * (ör. görev almamış öğretmen) mentör havuzuna sıfattan yoksun düşerdi.
 */
export function mentorlukBasvurabilirMi(kullanici: OturumKullanicisi): boolean {
  return kullanici.roller.length > 0;
}

/**
 * Mentörlük başvurusunu ONAYLAYABİLİR mi?
 *
 * YALNIZCA PROJE YÖNETİCİSİ (11 Ağustos 2026 · istek: "il koordinatörü
 * mentörlüğe başvurunca kendi kendini onaylıyor, mentörlük onaylarını sadece
 * proje yöneticisi onay verebilsin").
 *
 * İL KOORDİNATÖRÜ ÇIKARILDI ve gerekçesi bir kenar durum değil, kuralın
 * kendisiydi: koordinatör de mentör olabiliyor (bkz. mentorlukBasvurabilirMi)
 * ve kuyruk kendi iliyle sınırlı olduğu için kendi başvurusu her zaman kendi
 * ekranına düşüyordu. Kimse kendi işini onaylamaz — aynı ilke etkinlik
 * onayında da var (bkz. ilKoordinatoruOnaylayabilirMi · "kendi açtığı elenir").
 *
 * "Başvuran kendisi değilse onaylasın" gibi bir kaçamak YETMEZDİ: bir ilde tek
 * koordinatör var, yani o kişinin başvurusuna bakacak ikinci bir koordinatör
 * yok. Kararın sahibi ilin üstündeki merkez olmalı.
 *
 * KOORDİNATÖR MENTÖRLERİ GÖRMEYE DEVAM EDER: onay kuyruğu kapandı ama panodaki
 * mentör havuzu ve ilindeki mentörlerin listesi yerinde — kaybolan yalnızca
 * KARAR yetkisi.
 */
export function mentorlukOnaylayabilirMi(
  kullanici: OturumKullanicisi,
): boolean {
  return projeYoneticisiMi(kullanici);
}

/**
 * BİR ÖĞRENCİNİN mentörlüğüne karar verebilir mi? (26 Ağustos 2026 · danışman;
 * 27 Ağustos 2026 · istek: "il koordinatörü de öğrencinin mentörlük
 * başvurusunu onaylayabilsin")
 *
 * BU KAPI `mentorlukOnaylayabilirMi` DEĞİLDİR ve onun gerekçesini de
 * çürütmüyor. Yukarıdaki kural merkezin KUYRUĞUNUN kapısı ve koordinatörü
 * oradan çıkaran sebep "kimse kendi işini onaylamaz" idi: koordinatör kendi
 * mentörlük başvurusunu kendi ekranında görüyordu. Burada karar verilen kayıt
 * BAŞKASININ — kendi ilindeki bir öğrencinin — mentörlüğü; o sakınca doğmuyor.
 * Yine de kendi kaydına düşmesin diye açıkça eleniyor (aşağıda), çünkü bu
 * fonksiyon ileride öğrenci olmayan listelerde de çağrılabilir.
 *
 * KOORDİNATÖR NİYE EKLENDİ: danışmanı olmayan öğrencinin başvurusu bu ekranda
 * kimseye düğme basmıyordu ve merkezin ülke genelindeki kuyruğunda bir ada
 * dönüşüyordu — orada "bu öğrenci akranlarına yol gösterebilir mi" sorusunun
 * cevabı yok. İl koordinatörü öğrenciye danışmandan uzak ama merkezden çok
 * daha yakın duruyor; ilindeki öğrenciyi zaten temsilciliğe de o atıyor
 * (bkz. ilTemsilcisiAtayabilirMi).
 *
 * MERKEZ DE İÇERİDE (27 Ağustos 2026 · istek: "proje yöneticisine mentörlük
 * ata kaldır da olsun"). Bir tur önce dışarıda bırakılmıştı; gerekçe "merkezin
 * kendi kuyruğu var, buradaki düğme onun kopyası olur" idi. Kopya değil:
 * kuyruk yalnızca BEKLEYEN başvuruyu karara bağlıyor, buradaki düğme ise daha
 * önce reddedilmiş bir öğrenciyi yeniden mentör yapabiliyor ve onaylı bir
 * mentörlüğü gerekçesiyle kaldırabiliyor (bkz. mentor/kurallar.ts ·
 * ogrenciMentorlukKarariGecerliMi). Merkezin kapsamı da zaten ülke geneli —
 * il koordinatörüne açılan kapının kapalı kalması için bir sebep yok.
 *
 * KAPSAM ÖĞRENCİNİN İLİ: koordinatörün listesi zaten iliyle sınırlı ama liste
 * bir yetki değildir — süzgeç kurcalanabilir, bu yüzden il kodu burada da
 * karşılaştırılıyor (emsali ilTemsilcisiAtayabilirMi).
 */
export function ogrenciMentorluguneKararVerebilirMi(
  kullanici: OturumKullanicisi,
  ogrenci: { id: number; ilKodu: string | null },
  kendiOgrencisiMi: boolean,
): boolean {
  if (ogrenci.id === kullanici.id) return false;
  if (projeYoneticisiMi(kullanici)) return true;
  if (danismanMi(kullanici) && kendiOgrencisiMi) return true;
  return (
    ogrenci.ilKodu !== null &&
    ilKoordinatoruMu(kullanici) &&
    koordinatorIlKodu(kullanici) === ogrenci.ilKodu
  );
}

/**
 * ÖĞRENCİNİN MENTÖRLÜĞÜNÜ HANGİ DÜZEYDEN KALDIRABİLİR? (28 Ağustos 2026)
 *
 * İSTEK: "Mentör olarak atanan öğrencinin danışman öğretmeni, il koordinatörü
 * ve proje yöneticisi iptal edebilsin, hiyerarşi olsun: öğretmeninkini
 * koordinatör ve proje yöneticisi, koordinatörünkini de proje yöneticisi
 * onaylasın, proje yöneticisine onay yok".
 *
 * ---------------------------------------------------------------------------
 * NİYE `boolean` DEĞİL DÜZEY DÖNÜYOR
 * ---------------------------------------------------------------------------
 * Kaldırma artık tek bir kapı değil: aynı düğmeye basan üç kişiden birininki
 * anında uygulanıyor, ikisininki onaya gidiyor. "Kaldırabilir mi" sorusunun
 * cevabı üçünde de EVET; ayrışan şey SONUCU. Bu ayrım tek bir yerde
 * durmasaydı, eylem "proje yöneticisi mi" diye kendi başına sorar ve yetki
 * kuralının yarısı izinler.ts'te yarısı eylem dosyasında kalırdı.
 *
 * EN YÜKSEK DÜZEY KAZANIR. Bir kişi hem danışman hem il koordinatörü olabilir
 * (yaygın: koordinatörlerin çoğu aynı zamanda okulunda danışman). Sıra
 * merkezden aşağı doğru okunur; tersi olsaydı koordinatör, kendi öğrencisi
 * için DANISMAN düzeyinden talep açar ve o talebi onaylayacak mercii kendisi
 * olurdu (talebi açan kendi talebini onaylayamıyor — bkz. aşağısı — yani
 * öğrencinin mentörlüğü merkeze kadar gitmeden kaldırılamazdı).
 *
 * KAPSAM SORULARI `ogrenciMentorluguneKararVerebilirMi` İLE AYNI: kendi kaydı
 * elenir, koordinatörde öğrencinin ili karşılaştırılır, danışmanda aktif
 * atama aranır. İki fonksiyon aynı üç koşulu soruyor ama farklı sorulara cevap
 * veriyor ("karar verebilir mi" · "hangi düzeyden") ve ayrı duruyorlar:
 * mentör YAPMA kararının hiyerarşisi yok, kaldırmanınki var.
 */
export type MentorlukKaldirmaYetkisi =
  /** Kaldırma ANINDA uygulanır; onaya gitmez. */
  | "MERKEZ"
  | "IL_KOORDINATOR"
  | "DANISMAN";

export function ogrenciMentorluguKaldirmaDuzeyi(
  kullanici: OturumKullanicisi,
  ogrenci: { id: number; ilKodu: string | null },
  kendiOgrencisiMi: boolean,
): MentorlukKaldirmaYetkisi | null {
  if (ogrenci.id === kullanici.id) return null;
  if (projeYoneticisiMi(kullanici)) return "MERKEZ";
  if (
    ogrenci.ilKodu !== null &&
    ilKoordinatoruMu(kullanici) &&
    koordinatorIlKodu(kullanici) === ogrenci.ilKodu
  ) {
    return "IL_KOORDINATOR";
  }
  if (danismanMi(kullanici) && kendiOgrencisiMi) return "DANISMAN";
  return null;
}

/**
 * Bekleyen kaldırma talebini karara bağlayabilir mi? (28 Ağustos 2026)
 *
 * HİYERARŞİ TEK CÜMLEDE: danışmanın talebini ilin koordinatörü ya da merkez,
 * koordinatörün talebini yalnızca merkez karara bağlar.
 *
 * "VE" DEĞİL "YA DA" OKUNDU (istek: "öğretmeninkini koordinatör ve proje
 * yöneticisi … onaylasın"): iki ayrı imza değil, iki yetkili merci. İki
 * imza istenseydi ilinde koordinatörü olmayan bir okulun öğretmeni hiçbir
 * mentörlüğü kaldıramaz, talep süresiz askıda kalırdı — oysa koordinatörsüz
 * iller olağan (bkz. ilKoordinatorlerineBildir).
 *
 * KENDİ TALEBİNİ ONAYLAYAMAZ ve bu, hiyerarşinin tamamını taşıyan koşul:
 * onaysız kaldırma yetkisi yalnızca merkezde ve merkez bu tabloya hiç talep
 * yazmıyor. Koşul olmasaydı, danışman düzeyinden talep açan bir koordinatör
 * kendi talebini bir sonraki tıklamada onaylardı — yani hiyerarşi, arada bir
 * ekran daha olan bir kendi kendine onaya dönerdi (emsali:
 * mentorlukKarariGecerliMi · kendiBasvurusuMu).
 *
 * TALEBİN DÜZEYİ SATIRDAN OKUNUR, ROLDEN YENİDEN HESAPLANMAZ: talebi açanın
 * rolü aradan geçen sürede değişebilir ve o değişiklik, açılmış bir talebi
 * sessizce başka bir onay kapısına taşırdı.
 */
export function mentorlukKaldirmaTalebiniOnaylayabilirMi(
  kullanici: OturumKullanicisi,
  talep: {
    isteyenKullaniciId: number;
    isteyenDuzeyi: "DANISMAN" | "IL_KOORDINATOR";
  },
  ogrenci: { ilKodu: string | null },
): boolean {
  if (talep.isteyenKullaniciId === kullanici.id) return false;
  if (projeYoneticisiMi(kullanici)) return true;
  /* Koordinatörün talebini yalnızca merkez karara bağlar. */
  if (talep.isteyenDuzeyi !== "DANISMAN") return false;
  return (
    ogrenci.ilKodu !== null &&
    ilKoordinatoruMu(kullanici) &&
    koordinatorIlKodu(kullanici) === ogrenci.ilKodu
  );
}

/**
 * GençTek görev ilanlarını açar ve başvuruları karara bağlar mı?
 *
 * MENTÖRLÜKLE AYNI KAPI (21 Ağustos 2026 · istek: "yönetim panelinde yeni kart
 * gençtek görevlerini görebilsin"): görevler ülke genelinde tek bir ekipten
 * yönetiliyor ve ilan merkezin çağrısıdır — bir ilin koordinatörünün ülke
 * çapında geçerli bir göreve kişi alması, kapsamının dışında bir karar olurdu.
 *
 * "Kendi başvurusunu karara bağlayamaz" kuralı burada DEĞİL, kural katmanında
 * (lib/gorev/kurallar.ts · gorevKarariGecerliMi): bu fonksiyon "kim karar
 * verebilir" sorusunu cevaplıyor, o koşul "hangi kayda" sorusunu.
 */
/**
 * Ürünün markette yayımlanma kararını verebilir mi? (26 Ağustos 2026)
 *
 * YALNIZCA MERKEZ: market ülke geneline açık tek bir vitrin. Bir ilin
 * koordinatörünün ülke çapında görünecek bir ürünü yayımlaması, GençTek
 * görevlerinde olduğu gibi kapsamının dışında bir karar olurdu.
 */
export function urunMarketOnayiVerebilirMi(
  kullanici: OturumKullanicisi,
): boolean {
  return projeYoneticisiMi(kullanici);
}

export function gencTekGoreviYonetebilirMi(
  kullanici: OturumKullanicisi,
): boolean {
  return projeYoneticisiMi(kullanici);
}

/** İl koordinatörünün sorumlu olduğu il. Rol yoksa null. */
export function koordinatorIlKodu(
  kullanici: OturumKullanicisi,
): string | null {
  return (
    kullanici.roller.find((rol) => rol.rolKodu === "IL_KOORDINATOR")?.ilKodu ??
    null
  );
}

/** Danışman öğretmenin sorumlu olduğu okul. Rol yoksa null. */
export function danismanKurumKodu(
  kullanici: OturumKullanicisi,
): number | null {
  return (
    kullanici.roller.find((rol) => rol.rolKodu === "DANISMAN")?.kurumKodu ??
    null
  );
}

// ---------------------------------------------------------------------------
// Faaliyet
// ---------------------------------------------------------------------------

/**
 * Danışman öğretmen HER KAPSAMDA faaliyet açabilir; güvence kapsamda değil
 * onayda (20 Ağustos 2026 · istek: "öğretmen etkinlik oluştururken kendi
 * okulunda etkinlik oluşturabiliyor, türkiye geneli örnek espor gibi bir
 * etkinlik oluşturmak istediğinde il koordinatörüne onaya gidecek").
 *
 * Kendi okulu öğretmenin sorumluluk alanıdır ve oraya açtığı etkinlik doğrudan
 * yayına girer; okulunun dışına çıkan her kapsam ilin koordinatörüne uğrar
 * (bkz. faaliyetOnayGerekiyorMu). İl kapsamı istekte adı geçmese de aynı
 * ölçüye tabi: okul dışına çıkan her çağrı onaya gider.
 *
 * ÖĞRENCİ FAALİYET AÇAMAZ (20 Ağustos 2026 · istek: "öğrencilerin etkinlik
 * oluşturmasına gerek yok sadece mevcutlara katılabilsin"). Öğrenci mevcut
 * etkinliklere başvurmaya devam ediyor (bkz. basvuruYapabilirMi); kalkan şey
 * yalnızca etkinlik AÇMA kapısı.
 *
 * MEZUN, PAYDAŞ TEMSİLCİSİ VE MENTÖR DE AÇABİLİR (7 Ağustos 2026 · istek:
 * "3. sekme Etkinlikler · Etkinlik Bildir · Görüntüle"). Öğrencideki mantığın
 * aynısı: kapsam serbest, güvence onayda — açtıkları hiçbir etkinlik
 * kendiliğinden yayına girmiyor.
 *
 * OKUL KAPSAMI HARİÇ: dış kullanıcının kurum kodu yoktur, "kendi okulu" diye
 * bir yer yok. Bir okulun içine etkinlik açmak, o okulun sorumlusunun işidir
 * (bkz. faaliyetYeriBelirle — kurumsuz kullanıcıda zaten hata veriyor).
 *
 * DİKKAT: bu, dış kullanıcının etkinliğe KATILIMCI olarak başvurabildiği
 * anlamına gelmez; o kapı ayrıdır ve kapalı kalmaya devam ediyor
 * (bkz. basvuruYapabilirMi).
 */
export function faaliyetAcabilirMi(
  kullanici: OturumKullanicisi,
  kapsam: Kapsam,
): boolean {
  if (projeYoneticisiMi(kullanici)) return true;
  if (ilKoordinatoruMu(kullanici)) return true;
  if (disKullaniciMi(kullanici)) return kapsam !== "OKUL";
  if (danismanMi(kullanici)) return true;
  return false;
}

/**
 * Faaliyet onaya tabi mi?
 *
 * İki durum var:
 *   1. İl koordinatörünün açtığı ULUSAL faaliyet — ülke geneline açılan bir
 *      çağrıyı merkez görmeden yayına almıyoruz.
 *   2. Öğrencinin açtığı HER faaliyet — kapsamı ne olursa olsun. Öğrenci
 *      etkinliği düzenleyebilir ama 18 yaş altı bir kullanıcının açtığı
 *      çağrının okul dışına (hatta okul içine) sorumlusuz çıkması olmaz.
 */
export function faaliyetOnayGerekiyorMu(
  kullanici: OturumKullanicisi,
  kapsam: Kapsam,
): boolean {
  if (projeYoneticisiMi(kullanici)) return false;
  /*
   * Öğrenci artık faaliyet AÇAMIYOR (bkz. faaliyetAcabilirMi). Bu satır yine
   * de duruyor: kapı bir gün yeniden açılırsa öğrencinin çağrısının sessizce
   * onaysız yayına girmesi, unutulması en pahalı hata olurdu.
   */
  if (ogrenciMi(kullanici)) return true;
  /*
   * Mezun, paydaş temsilcisi ve mentörün açtığı HER etkinlik — kapsamı ne
   * olursa olsun. Gerekçe öğrencidekinden farklı: yaş değil, EKOSİSTEM DIŞI
   * kimlik. Bu kişilerin kimliği EBA'dan gelmiyor, bir okul ya da il görevine
   * bağlı değiller; adlarına ilan edilen bir MEB etkinliğinin sorumlusu
   * olmadan yayına çıkması olmaz.
   */
  if (disKullaniciMi(kullanici)) return true;
  /*
   * 3. Danışman öğretmenin açtığı faaliyet — OKUL KAPSAMI HARİÇ ilin
   *    koordinatörü görmeden yayına girmez (20 Ağustos 2026 · istek:
   *    "öğretmen … kendi okulunda etkinlik oluşturabiliyor, türkiye geneli …
   *    bir etkinlik oluşturmak istediğinde il koordinatörüne onaya gidecek").
   *
   * Kendi okulu öğretmenin zaten sorumlu olduğu yer: her okul içi etkinliği
   * koordinatör kuyruğuna sokmak, öğretmeni kendi sınıfındaki bir çalışma
   * için beklemeye alıyordu. Okul dışına çıkan her kapsam onaya gider.
   *
   * MEVCUT KAYITLAR ETKİLENMEZ: bu karar yalnızca yeni açılan faaliyette
   * verilir, veritabanındaki satırlar olduğu gibi kalır.
   */
  if (danismanMi(kullanici)) return kapsam !== "OKUL";
  /*
   * Koordinatörün açtığı ULUSAL ve ULUSLARARASI çağrı merkez görmeden
   * yayına girmez; ikisi de ülke sınırlarının ötesine ya da tamamına
   * hitap ediyor.
   */
  return (
    (kapsam === "ULUSAL" || kapsam === "ULUSLARARASI") &&
    ilKoordinatoruMu(kullanici)
  );
}

/**
 * İl koordinatörü bu faaliyeti onaylayabilir mi?
 *
 * Kapı, faaliyeti KİMİN açtığına bakar: öğrenci, danışman öğretmen ve dış
 * kullanıcı (mezun/paydaş/mentör) ilin koordinatörünün sorumluluk alanındadır.
 * Koordinatörün ve merkezin kendi açtığı faaliyet buradan geçmez — kimse kendi
 * işini onaylamaz.
 *
 * DIŞ KULLANICI DA BURADAN GEÇER (7 Ağustos 2026): ilinin koordinatörü, mezunu
 * ya da paydaş kurumu tanıyan en yakın sorumludur. Kapı yalnızca merkeze
 * bırakılsaydı, bir paydaşın önerdiği il etkinliği YEĞİTEK sırası gelene kadar
 * beklerdi.
 *
 * Onay merkeze bırakılsaydı bir okulun kendi içindeki etkinlik YEĞİTEK sırası
 * gelene kadar bekler ve pratikte ölürdü; ilin koordinatörü hem kişiyi hem
 * okulu tanıyan en yakın sorumludur. Merkez de yetkilidir (bkz.
 * faaliyetOnaylayabilirMi), hangisi önce karar verirse faaliyet sonuçlanır —
 * ayrı bir sıra kurulmaz.
 */
export function ilKoordinatoruOnaylayabilirMi(
  kullanici: OturumKullanicisi,
  faaliyet: FaaliyetKapsami,
): boolean {
  /*
   * Üç bayrak, KOORDINATOR_ONAYINA_TABI_ROLLER'ın karşılığıdır: öğrenci,
   * danışman öğretmen ve dış kullanıcı (mezun + paydaş temsilcisi). Bayraklar
   * `faaliyetKapsamiCikar`da aynı rollerden üretiliyor; liste değişirse orası
   * ve buradaki üçlü birlikte güncellenmeli — testi
   * `yetki-izinler.test.ts` tutuyor.
   */
  const onayaTabi =
    faaliyet.duzenleyenOgrenciMi === true ||
    faaliyet.duzenleyenDanismanMi === true ||
    faaliyet.duzenleyenDisKullaniciMi === true;
  if (!onayaTabi) return false;
  if (!ilKoordinatoruMu(kullanici)) return false;

  const faaliyetIli = faaliyet.kapsamIlKodu ?? faaliyet.ilKodu;
  return faaliyetIli !== null && koordinatorIlKodu(kullanici) === faaliyetIli;
}

/**
 * Faaliyeti onaylama/reddetme yetkisi.
 *
 * Faaliyet verilmezse yalnızca "her koşulda onaylayabilen" proje yöneticisi
 * geçer; il koordinatörünün yetkisi hangi faaliyet olduğuna bağlıdır ve
 * faaliyetsiz sorulduğunda yanıt "hayır"dır.
 */
export function faaliyetOnaylayabilirMi(
  kullanici: OturumKullanicisi,
  faaliyet?: FaaliyetKapsami,
): boolean {
  if (projeYoneticisiMi(kullanici)) return true;
  if (!faaliyet) return false;
  return ilKoordinatoruOnaylayabilirMi(kullanici, faaliyet);
}

/**
 * Faaliyetin kullanıcıya görünüp görünmediğini söyler. Onay bekleyen faaliyet
 * yalnızca düzenleyene, onaylamaya yetkili olana ve proje yöneticisine görünür.
 */
export function faaliyetGorunurMu(
  kullanici: OturumKullanicisi,
  faaliyet: FaaliyetKapsami,
): boolean {
  if (projeYoneticisiMi(kullanici)) return true;
  if (faaliyet.duzenleyenKullaniciId === kullanici.id) return true;
  // Onaylayacak kişi, onaylayacağı şeyi görmek zorunda.
  if (ilKoordinatoruOnaylayabilirMi(kullanici, faaliyet)) return true;
  if (!faaliyet.onayliMi) return false;

  switch (faaliyet.kapsam) {
    case "OKUL":
      return (
        faaliyet.kurumKodu !== null &&
        faaliyet.kurumKodu === kullanici.kurumKodu
      );
    case "IL":
      return faaliyet.ilKodu !== null && faaliyet.ilKodu === kullanici.ilKodu;
    case "ULUSAL":
    case "ULUSLARARASI":
      return true;
  }
}

/**
 * Faaliyeti açan kullanıcı görevden ayrıldığında değerlendirme ve moderasyon
 * yetkisi boşta kalmaz; faaliyetin iline bakan il koordinatörüne düşer
 * (references/domain-rules.md Bölüm 11). Proje yöneticisi zaten her durumda
 * yetkilidir, o yüzden burada aranmaz.
 *
 * Devir YALNIZCA düzenleyen görevden ayrıldığında olur: görevdeki bir
 * öğretmenin faaliyetine kendi ilinin koordinatörü karışamaz.
 */
export function yetkiDevrolduMu(
  kullanici: OturumKullanicisi,
  faaliyet: FaaliyetKapsami,
): boolean {
  if (faaliyet.duzenleyenGorevdeMi !== false) return false;
  if (!ilKoordinatoruMu(kullanici)) return false;

  const faaliyetIli = faaliyet.kapsamIlKodu ?? faaliyet.ilKodu;
  return faaliyetIli !== null && koordinatorIlKodu(kullanici) === faaliyetIli;
}

/**
 * Ek yükleme yetkisi yalnızca faaliyeti açan kullanıcıdadır. Rol kontrolü tek
 * başına yeterli değildir: aynı rolden başka bir danışman, başkasının
 * faaliyetine dosya ekleyemez.
 */
/**
 * Faaliyet raporunu yazabilir mi?
 *
 * Ek yükleme yetkisinden GENİŞTİR ve bu bilinçlidir: il koordinatörü, ilindeki
 * HER biten faaliyetin raporunu yazabilir — o faaliyeti kendisi açmamış olsa
 * bile. Raporlama ilin sorumluluğudur; okulundaki bir öğretmen etkinliği
 * yapıp raporu yazmadan görevden ayrılırsa faaliyet raporsuz kalmamalı.
 *
 * Ek yükleme yetkisi bundan dar kalmaya devam ediyor: koordinatörün başkasının
 * faaliyetine dosya eklemesi ayrı bir müdahaledir ve gerekmiyor.
 *
 * Kapsayan roller: faaliyeti açan, ilin koordinatörü, yetki devrolmuşsa
 * koordinatör ve proje yöneticisi.
 */
export function faaliyetRaporuYazabilirMi(
  kullanici: OturumKullanicisi,
  faaliyet: FaaliyetKapsami,
): boolean {
  if (ekYukleyebilirMi(kullanici, faaliyet)) return true;

  if (!ilKoordinatoruMu(kullanici)) return false;
  const faaliyetIli = faaliyet.kapsamIlKodu ?? faaliyet.ilKodu;
  return faaliyetIli !== null && koordinatorIlKodu(kullanici) === faaliyetIli;
}

/**
 * KATILIM / TEŞEKKÜR BELGESİ ÜRETEBİLİR Mİ?
 *
 * ---------------------------------------------------------------------------
 * YALNIZCA İL KOORDİNATÖRÜ VE PROJE YÖNETİCİSİ (31 Ağustos 2026)
 * ---------------------------------------------------------------------------
 * İki istek bu kapıyı aynı gün iki kez daralttı:
 *   · "Öğrenci açtığı etkinlik için belge oluşturamasın … etkinliği öğrenci
 *     oluştursa bile il koordinatörü belge oluşturabilsin o etkinliğe dair."
 *   · "Öğretmen de belge oluşturamasın, sadece koordinatör ve proje
 *     yöneticileri belge üretebilsin."
 *
 * Belge, rapor ve yoklama 12 Ağustos'tan beri TEK soruyla açılıyordu: "bu
 * etkinliğin hakkında beyanda bulunabilecek kişi mi" (bkz.
 * faaliyetRaporuYazabilirMi). Üçü aynı kaldığı sürece bu doğruydu; artık
 * değil — belge ötekilerden BAŞKA bir şey yapıyor.
 *
 * Rapor bir BEYANDIR: etkinliği yürüten kişi ne olduğunu yazar, yanlışsa
 * kendisi hesap verir. Belge ise bir ONAY: karşı tarafın GençTek Yolculuğu'na
 * katılım düşürüyor ve elden ele dolaşan resmî şablonlu bir kâğıt olarak
 * GençTek adına söz veriyor. Bu imzanın sahibi, etkinliği yürüten kişi değil
 * PROGRAMIN SORUMLUSUDUR.
 *
 * ---------------------------------------------------------------------------
 * ETKİNLİĞİ AÇAN KİŞİ BURAYA GİRMİYOR — bilerek
 * ---------------------------------------------------------------------------
 * Kapı `ekYukleyebilirMi`yi ÇAĞIRMIYOR; onu çağırsaydı "etkinliği açan kişi"
 * kolu geri gelir ve öğrenci de öğretmen de kendi etkinliğine belge basardı.
 * Bugün etkinliği kim açarsa açsın, belgeyi ilin koordinatörü üretiyor.
 *
 * Yoklama ve rapor DOKUNULMADI: etkinliği yürüten öğretmen (ya da öğrenci)
 * kimin geldiğini işaretlemeye ve ne olduğunu yazmaya devam ediyor. Onlar
 * beyan, belge onay — ve belgenin ön koşulu zaten o beyanın yazılmış olması
 * (bkz. lib/belge/kapi.ts · belgeKapisi).
 *
 * ---------------------------------------------------------------------------
 * KOORDİNATÖRDE İL KOŞULU VAR
 * ---------------------------------------------------------------------------
 * `faaliyetRaporuYazabilirMi`nin koordinatör kolundaki ölçünün aynısı: kendi
 * ilindeki etkinlik. Başka ilin koordinatörü, o ilin öğrencisine GençTek
 * katılımı düşüremez. Proje yöneticisinde koşul yok — merkezin tek bir ile
 * bağlılığı yok.
 */
export function faaliyetBelgesiUretebilirMi(
  kullanici: OturumKullanicisi,
  faaliyet: FaaliyetKapsami,
): boolean {
  // 23 Ekim 2026 · istek: koordinatörde "Belge oluştur … pasif". Belgeyi
  // yalnızca proje yöneticisi üretir; `faaliyet` artık sorulmuyor.
  void faaliyet;
  return projeYoneticisiMi(kullanici);
}

/**
 * ETKİNLİK RAPORLARI LİSTESİNİ GÖREBİLİR Mİ? (23 Ekim 2026 · istekler:
 * öğretmen ve koordinatör sayfalarında "Etkinlik raporları … pasif").
 *
 * `/panel/raporlar` toplu listesi artık yalnızca proje yöneticisine açık.
 * Tek bir etkinliğin raporu ve yoklaması `faaliyetRaporuYazabilirMi` ile
 * etkinlik sayfasında yazılmaya devam ediyor.
 */
export function etkinlikRaporlariGorebilirMi(
  kullanici: OturumKullanicisi,
): boolean {
  return projeYoneticisiMi(kullanici);
}

/**
 * BELGE ÜRETEBİLEN BİR ROLDE Mİ? — etkinlikten bağımsız soru.
 *
 * "Belge oluştur" giriş ekranı (`/panel/belgeler`) hangi etkinliğe bakacağını
 * daha bilmiyor; sorusu "bu kişi hiç belge üretebilir mi". Etkinlik başına
 * sorulan kapı bunun üstüne biniyor ve ondan DARDIR (il koşulu orada).
 *
 * İkisi ayrı ayrı yazılmıyor: bu fonksiyon rolü, öteki rolü VE kapsamı
 * soruyor. Giriş ekranı yalnızca rolü sorabilir çünkü listelediği etkinlikler
 * zaten kapsam filtresinden geçiyor.
 */
export function belgeUretenRoldeMi(kullanici: OturumKullanicisi): boolean {
  // 23 Ekim 2026: koordinatörden alındı (bkz. faaliyetBelgesiUretebilirMi).
  return projeYoneticisiMi(kullanici);
}

export function ekYukleyebilirMi(
  kullanici: OturumKullanicisi,
  faaliyet: FaaliyetKapsami,
): boolean {
  if (projeYoneticisiMi(kullanici)) return true;
  if (faaliyet.duzenleyenKullaniciId === kullanici.id) return true;
  return yetkiDevrolduMu(kullanici, faaliyet);
}

/**
 * İptal yetkisi düzenleme yetkisinden DARDIR: yalnızca faaliyeti açan kullanıcı
 * ve proje yöneticisi (references/domain-rules.md Bölüm 6).
 *
 * Düzenleyen görevden ayrıldığında değerlendirme ve moderasyon ilin
 * koordinatörüne devrolur ama iptal devrolmaz — başkasının kurduğu bir
 * organizasyonu kapatmak, başvurmuş tüm öğrencileri etkileyen ve geri
 * alınamayan bir karardır. Koordinatörün gerçekten iptal etmesi gerekiyorsa
 * proje yöneticisine başvurur.
 */
export function faaliyetIptalEdebilirMi(
  kullanici: OturumKullanicisi,
  faaliyet: FaaliyetKapsami,
): boolean {
  if (projeYoneticisiMi(kullanici)) return true;
  return faaliyet.duzenleyenKullaniciId === kullanici.id;
}

/**
 * BAŞKASININ yürüttüğü danışmanlığı sonlandırabilir mi? (10 Ağustos 2026 ·
 * istek: "öğretmen öğrenciyi bırakabilsin, gerekirse koordinatör de
 * bırakabilsin")
 *
 * İl koordinatörü ve proje yöneticisi. Danışmanın KENDİ öğrencisini bırakması
 * bu kapıdan geçmez — o zaten kendi kaydıdır ve ayrı sorulur.
 *
 * Danışman öğretmen buraya girmez ve bu bilinçli: bir öğretmenin başka bir
 * öğretmenin öğrencisini danışmanlıktan çıkarabilmesi, öğrenci çekme kapısı
 * açardı (aynı gerekçeyle "yalnızca danışmansız öğrenci alınabilir" kuralı
 * var — bkz. ogrenciyiDanismanligaAlEylemi).
 *
 * KAPSAM BURADA SORULMAZ: bu fonksiyon "ekranda düğme olsun mu" sorusuna
 * cevap verir; "bu öğrenci onun kapsamında mı" sorusu merkezi kapsam
 * filtresine aittir ve eylemde ayrıca sorulur.
 */
export function danismanligiSonlandirabilirMi(
  kullanici: OturumKullanicisi,
): boolean {
  return ilKoordinatoruMu(kullanici) || projeYoneticisiMi(kullanici);
}

/**
 * Etkinlik listesi CSV olarak indirilebilir mi? (10 Ağustos 2026 · istek:
 * "öğrenci etkinliklerinde CSV indir kalkacak")
 *
 * ÖĞRENCİ HARİÇ herkes. Gerekçe gizlilik DEĞİL: dosya zaten kişinin ekranda
 * gördüğü kayıtlardan fazlasını içermiyor, başvuran adı da hiç girmiyor
 * (bkz. etkinlikler/disa-aktar). Kapının sebebi İŞLEV: CSV bir raporlama
 * aracı ve raporlama öğrencinin işi değil — öğrenci için etkinlik listesi
 * başvurulacak bir çağrı panosu, dökümü alınacak bir kayıt tablosu değil.
 *
 * KAPI HEM EKRANDA HEM ROTADA sorulur: bağlantıyı gizlemek yetmez, adres
 * çubuğuna /panel/etkinlikler/disa-aktar yazan öğrenci de dosyayı almamalı.
 */
export function faaliyetDisaAktarabilirMi(
  kullanici: OturumKullanicisi,
): boolean {
  return !ogrenciMi(kullanici);
}

// ---------------------------------------------------------------------------
// Yorum
// ---------------------------------------------------------------------------

/**
 * Faaliyeti görebilen herkes yorum yazabilir — dış kullanıcılar HARİÇ.
 *
 * İstisnanın sebebi: mezun ve paydaş temsilcisi ulusal ve kendi ilindeki
 * etkinlikleri takvimde görüyor, dolayısıyla "görebiliyorsa yazabilir" kuralı
 * onlara faaliyet altında söz hakkı verirdi. Faaliyet yorumları ağırlıklı
 * olarak 18 yaş altı katılımcıların bulunduğu bir alan ve moderasyonu
 * faaliyeti açan kişide; oraya, etkinliğe katılamayan bir dış kullanıcıyı
 * sokmak dar başlangıç kararıyla bağdaşmıyor.
 *
 * Bu bir yasak değil SIRALAMA: mezunun etkinlik altında konuşması istenirse
 * açılacak yer burasıdır, ama önce o yorumun kime görüneceği ve kimin
 * moderasyonunda olduğu kararlaştırılmalı.
 */
export function yorumYazabilirMi(
  kullanici: OturumKullanicisi,
  faaliyet: FaaliyetKapsami,
): boolean {
  if (disKullaniciMi(kullanici)) return false;
  return faaliyetGorunurMu(kullanici, faaliyet);
}

/**
 * Silme yetkisi: yorum sahibi, faaliyeti açan kullanıcı veya proje yöneticisi.
 * Öğrenci yalnızca kendi yorumunu silebilir. Düzenleyen görevden ayrıldıysa
 * moderasyon yetkisi ilin koordinatörüne devrolur — 18 yaş altı kullanıcıların
 * olduğu bir faaliyet moderatörsüz kalamaz.
 */
export function yorumSilebilirMi(
  kullanici: OturumKullanicisi,
  yorum: { yazanKullaniciId: number },
  faaliyet: FaaliyetKapsami,
): boolean {
  if (projeYoneticisiMi(kullanici)) return true;
  if (yorum.yazanKullaniciId === kullanici.id) return true;
  if (faaliyet.duzenleyenKullaniciId === kullanici.id) return true;
  return yetkiDevrolduMu(kullanici, faaliyet);
}

// ---------------------------------------------------------------------------
// Başvuru
// ---------------------------------------------------------------------------

/**
 * Kişi faaliyete KATILIMCI olarak başvurabilir mi?
 *
 * Öğrenciler ve öğretmenler başvurur. Öğretmenin katılımcı olması bir istisna
 * değildir: analiz dokümanı 4.2 katılımcıyı "öğretmen/öğrenci" diye sayıyor ve
 * eğitici etkinliklerin bir kısmı zaten öğretmene yöneliktir. Görev almamış
 * öğretmen de başvurabilir — GençTek'e katılmanın yolu genelde buradan geçer.
 *
 * Proje yöneticisi (YEĞİTEK) dışarıdadır: ulusal faaliyetleri düzenleyen ve
 * onaylayan taraf kendi açtığı etkinliğe katılımcı olarak başvurmaz.
 *
 * MEZUN VE PAYDAŞ TEMSİLCİSİ DE DIŞARIDADIR. Bu, kalıcı bir karar değil DAR
 * BAŞLANGIÇTIR: iki rol yeni ve ne yapabilecekleri satır satır kararlaştırılmış
 * değil. Eksik yetki sonradan verilebilir; fazla verilmiş yetkiyle görülen veri
 * geri alınamaz. Mezunun etkinliğe eğitmen/katılımcı olarak girmesi istenirse
 * burada açılacak — ama başvuru, katılımcı listesi ve belge akışlarının o rolde
 * ne anlama geldiği önce kararlaştırılmalı.
 */
export function basvuruYapabilirMi(kullanici: OturumKullanicisi): boolean {
  return !projeYoneticisiMi(kullanici) && !disKullaniciMi(kullanici);
}

/**
 * Panoyu (eski adıyla Talep Panosu) GÖREBİLİR Mİ?
 *
 * `basvuruYapabilirMi`den AYRI tutuldu: pano bir ilan tahtasıdır, faaliyete
 * başvurmakla ilgisi yok. Mezun ve paydaş temsilcisi panoyu görür (sponsorluk,
 * teknik destek, mentorluk ilanları ekosistemin en doğal buluşma noktası) ama
 * faaliyete katılımcı olarak başvuramaz.
 *
 * PROJE YÖNETİCİSİNE DE AÇILDI (13 Ağustos 2026 · istek: "proje yöneticisinin
 * pano sayfası görünmüyor, diğer kullanıcılarda var"). Önce görme ve ilan açma
 * tek kapıdan geçiyordu; merkez personeli ilan açmadığı için pano da menüsünden
 * düşüyordu. Oysa panoyu görmemek, sistemdeki en canlı kullanıcı alanını
 * yönetenden gizlemek demekti: merkez, hangi konularda destek ve mentör
 * arandığını göremiyordu. Görme ile İLAN AÇMA bu yüzden ayrıldı — açma kapısı
 * `panodaEslesmeArayabilirMi`de ve merkez orada hâlâ dışarıda.
 *
 * Görme yetkisi artık herkeste; fonksiyon yine de duruyor çünkü panonun
 * ekosistem dışına kapalı olması (S21) bir karardır ve tek bir yerde yazılı
 * kalmalı — dışarıya açık ilan sayfası istenirse değişecek yer burasıdır.
 */
export function talepPanosuGorebilirMi(_kullanici: OturumKullanicisi): boolean {
  return true;
}

/**
 * Panoda İLAN AÇABİLİR ve BAĞLANTI İSTEĞİ GÖNDEREBİLİR mi?
 *
 * Panonun yazan tarafı. İkisi tek fonksiyonda: ilan açmak da bağlantı isteği
 * göndermek de aynı şeyin iki ucudur — panoda eşleşme aramak. Ayrı izin adları
 * uydurmak, aynı kuralın iki yerde ayrışmasına açık kapı bırakırdı.
 *
 * Merkez personeli dışarıda: YEĞİTEK'in takım arkadaşı ya da mentör araması
 * diye bir durum yok, onun duyuru kanalı ayrı (bkz. /panel/duyurular). Panoyu
 * okuması ise serbest (bkz. talepPanosuGorebilirMi).
 */
/*
 * 21 Ağustos 2026: bu kapının ÇAĞIRANI KALMADI. Bağlantı isteği akışı tümüyle
 * kalktı (istek: "bağlantılarımdan normal mesaj göndermeyi tamamen kaldır") ve
 * doğrudan yazışma kendi kuralından geçiyor (lib/iletisim/kurallar.ts ·
 * dogrudanYazisilabilirMi). Tanım duruyor: kimin kişiye YÖNELEN bir temas
 * kurabileceği sorusu, istek akışı geri gelirse aynı cevabı vermeli — ve
 * testleri o cevabı tutuyor.
 */
export function panodaEslesmeArayabilirMi(
  kullanici: OturumKullanicisi,
): boolean {
  return !projeYoneticisiMi(kullanici);
}

/**
 * Panoda İLAN AÇABİLİR mi? (14 Ağustos 2026 · istekler: "proje yöneticisi
 * panodan destek talebi açabilsin", "mentör talebi açabilsin proje yöneticisi")
 *
 * `panodaEslesmeArayabilirMi`DEN AYRILDI. O işlev 13 Ağustos'a kadar iki işi
 * birden yapıyordu: ilan açmak ve bağlantı isteği göndermek. Merkez ikisinden
 * de dışarıdaydı, gerekçe de "YEĞİTEK'in takım arkadaşı araması diye bir durum
 * yok"tu. İstek bu gerekçenin ilan tarafını geçersiz kıldı — merkez de panodan
 * destek ve mentör talebi açıyor.
 *
 * BAĞLANTI İSTEĞİ TARAFI DEĞİŞMEDİ: merkez hâlâ ilanlara bağlantı isteği
 * göndermiyor (bkz. panodaEslesmeArayabilirMi). İstek yalnızca ilan açmaktan
 * söz ediyor ve ikisi aynı şey değil: ilan herkesin okuduğu açık bir metin,
 * bağlantı isteği ise kişiye yönelen ve onaydan geçen bir temas.
 *
 * Rolü olan herkes açabilir; rolsüz kullanıcı panoyu yalnızca okur.
 */
export function panodaIlanAcabilirMi(kullanici: OturumKullanicisi): boolean {
  return kullanici.roller.length > 0;
}

/**
 * Pano ilanını DÜZENLEYEBİLİR mi? (14 Ağustos 2026 · istek: "açılan ilanlar
 * düzenlenebilsin, açan kişi ve proje yöneticisi düzenleyebilsin")
 *
 * İKİ TARAF: ilanı açan kendi metnini düzeltir, proje yöneticisi ise onay
 * yetkisinin doğal uzantısı olarak düzeltir — reddetmek yerine bir cümleyi
 * düzeltip onaylamak, öğrenciyi ilanı baştan yazmaya göndermekten iyidir.
 *
 * İl koordinatörü ve danışman DIŞARIDA: pano kapsam filtresizdir (ilanlar ülke
 * genelinde görünür), yani "hangi ilin koordinatörü hangi ilanı düzeltir"in
 * cevabı yok. Şikâyet gerektiren içerik için yol moderasyon değil merkezdir.
 */
export function panoIlaniDuzenleyebilirMi(
  kullanici: OturumKullanicisi,
  acanKullaniciId: number,
): boolean {
  return kullanici.id === acanKullaniciId || projeYoneticisiMi(kullanici);
}

/**
 * Pano ilanını SİLEBİLİR mi? (14 Ağustos 2026 · istek: "proje yöneticisi
 * ilanları silebilsin")
 *
 * YALNIZCA PROJE YÖNETİCİSİ. İlan sahibi silemez, KAPATIR (bkz.
 * talepKapatEylemi): kimin ne aradığı geçmiş kaydıdır ve kapanan ilan
 * üzerinden kurulmuş bağlantılar anlamsızlaşmamalı.
 *
 * Merkezin silmesi ise bilinçli bir istisnadır: panoya yazılmış, durması
 * gerekmeyen bir metni (kişisel veri, hakaret, yanlışlıkla açılmış ilan)
 * kaldıracak bir kapı yoksa tek çare veritabanına elle girmektir.
 */
export function panoIlaniSilebilirMi(kullanici: OturumKullanicisi): boolean {
  return projeYoneticisiMi(kullanici);
}

/**
 * Açtığı pano ilanı ONAYA mı düşer? (14 Ağustos 2026 · istek: "panodaki
 * öğrenci ilanları şimdilik proje yöneticilerine düşsün oradan onay versin")
 *
 * YALNIZCA ÖĞRENCİ. Öğretmenin, mezunun ve paydaş temsilcisinin ilanı doğrudan
 * yayımlanmaya devam ediyor; istek açıkça "öğrenci ilanları" diyor ve kapıyı
 * herkese kurmak, bugün sorunsuz işleyen bir akışa gereksiz bir bekleme
 * eklerdi.
 *
 * KURALIN GEREKÇESİ, ilan açma yetkisininkiyle aynı yerden geliyor:
 * kullanıcıların çoğu 18 yaş altı ve panoya yazılan metin ekosistemdeki
 * herkesin okuduğu açık bir metindir. Onay, o metnin yayımlanmadan önce bir
 * yetişkin tarafından okunmasıdır.
 *
 * "ŞİMDİLİK": istek geçici olduğunu söylüyor. Kapı bu yüzden tek bir işlevde
 * duruyor — vazgeçildiğinde `false` dönmesi yeter, ilanların onay sütunu ve
 * geçmişi yerinde kalır.
 */
export function panoIlaniOnayGerekiyorMu(
  kullanici: OturumKullanicisi,
): boolean {
  return ogrenciMi(kullanici);
}

/**
 * Pano ilanını onaylayıp reddedebilir mi?
 *
 * YALNIZCA PROJE YÖNETİCİSİ — istekte yazdığı gibi ("proje yöneticilerine
 * düşsün"). İl koordinatörü dışarıda: pano KAPSAM FİLTRESİZDİR, ilanlar ülke
 * genelinde görünür (bkz. talepler/page.tsx) ve koordinatöre yetki verilseydi
 * "hangi ilin koordinatörü hangi ilanı onaylar" sorusunun cevabı olmazdı;
 * il sınırı konsaydı da pano kendi amacını baltalardı.
 *
 * Emsali `mentorlukOnaylayabilirMi`: merkezde toplanan ikinci onay kuyruğu bu.
 */
export function panoIlaniOnaylayabilirMi(
  kullanici: OturumKullanicisi,
): boolean {
  return projeYoneticisiMi(kullanici);
}

/**
 * Başkası ADINA başvuru yetkisi (analiz dokümanı 4.2: "Danışman öğretmen
 * öğrenci adına başvurabilir").
 *
 * Yetki danışmanla sınırlı tutulmadı: il koordinatörü de kendi ilindeki
 * öğrencilerin faaliyet katılımını yürütüyor ve danışmanı olmayan öğrencinin
 * başvurusunu başka kimse yapamazdı.
 *
 * DİKKAT: Bu fonksiyon yalnızca ROLÜ sorar. "Bu öğrenci onun kapsamında mı"
 * sorusu ayrıca `ogrenciKapsamFiltresi` ile sorulmak zorundadır; tek başına
 * kullanılırsa bir danışman, ilinin öbür ucundaki öğrenci adına başvuru
 * yapabilirdi.
 */
export function baskasiAdinaBasvurabilirMi(
  kullanici: OturumKullanicisi,
): boolean {
  return (
    projeYoneticisiMi(kullanici) ||
    ilKoordinatoruMu(kullanici) ||
    danismanMi(kullanici)
  );
}

/**
 * Başvuruyu yalnızca faaliyeti açan kullanıcı değerlendirir; o görevden
 * ayrılmışsa yetki ilin koordinatörüne düşer, böylece başvurular
 * değerlendirilmeden kalmaz.
 */
export function basvuruDegerlendirebilirMi(
  kullanici: OturumKullanicisi,
  faaliyet: FaaliyetKapsami,
): boolean {
  if (projeYoneticisiMi(kullanici)) return true;
  if (faaliyet.duzenleyenKullaniciId === kullanici.id) return true;
  return yetkiDevrolduMu(kullanici, faaliyet);
}

// ---------------------------------------------------------------------------
// Rol ve görev atama
// ---------------------------------------------------------------------------

export function ilKoordinatorAtayabilirMi(
  kullanici: OturumKullanicisi,
): boolean {
  return projeYoneticisiMi(kullanici);
}

/**
 * Okul Temsilcisi görevini verebilir/kaldırabilir mi?
 *
 * DANIŞMAN YALNIZCA KENDİ ÖĞRENCİSİNE (10 Ağustos 2026 · istek: "danışmanı
 * olmadığı öğrenciyi okul temsilcisi yapabiliyor, bu bir tezat").
 *
 * Sınır önceden ÖRTÜKTÜ: öğretmenin listesinde zaten yalnızca kendi
 * öğrencileri vardı, dolayısıyla okul kodu eşitliği yetiyordu. Okulundaki
 * danışmansız öğrenciler de listeye girince (bkz. ogrenciKapsamFiltresi) örtük
 * sınır düştü ve öğretmen, danışmanı olmadığı bir öğrenciye görev verebilir
 * hâle geldi. Kural artık açıkça yazılı: göreceği her öğrenciye görev veremez,
 * yalnızca sorumluluğunu üstlendiklerine.
 *
 * MERKEZ HARİÇ: proje yöneticisinin danışmanlığı yoktur ve okulda danışman
 * kalmadığında düzeltmeyi yapabilecek tek kişidir; ona bu koşul sorulmaz.
 */
/*
 * İL KOORDİNATÖRÜ 26 AĞUSTOS 2026'DA İÇERİ ALINDI (istek: "il temsilcisi yap
 * kaldır, ilçe temsilcisi yap kaldır, okul temsilcisi yap kaldır butonları
 * olsun; il koordinatörleri bunların atamasını yapabilsin").
 *
 * KOORDİNATÖRÜN DIŞARIDA KALMASI BİR KARAR DEĞİL, ARTIKTI: yukarıdaki gerekçe
 * baştan sona DANIŞMANI sınırlıyor ("göreceği her öğrenciye görev veremez") ve
 * merkezi ayrı tutuyor; koordinatörden hiç söz etmiyor. Oysa okul zaten onun
 * ilinin içinde ve İl/İlçe Temsilcisi görevlerini o veriyor
 * (bkz. ilTemsilcisiAtayabilirMi) — okulda danışman yokken ya da danışman
 * atamayı ihmal ettiğinde ilin sorumlusu düzeltemiyordu.
 *
 * `okulIlKodu` İSTEĞE BAĞLI: verilmediğinde koordinatör kapısı hiç açılmaz,
 * yani bu bilgiyi taşımayan eski çağıranlar eskisi gibi davranır. Kapıyı
 * sessizce açan bir varsayılan olsaydı, ilini bilmediğimiz bir okulda koşul
 * "koordinatör mü" sorusuna inerdi.
 */
export function okulTemsilcisiAtayabilirMi(
  kullanici: OturumKullanicisi,
  kurumKodu: number,
  /** Öğrenci bu kullanıcının danışmanlığında mı? */
  kendiOgrencisiMi: boolean,
  /** Okulun bağlı olduğu il; koordinatör kapısı yalnızca bununla açılır. */
  okulIlKodu?: string | null,
): boolean {
  if (projeYoneticisiMi(kullanici)) return true;
  if (
    okulIlKodu &&
    ilKoordinatoruMu(kullanici) &&
    koordinatorIlKodu(kullanici) === okulIlKodu
  ) {
    return true;
  }
  if (!kendiOgrencisiMi) return false;
  return danismanMi(kullanici) && danismanKurumKodu(kullanici) === kurumKodu;
}

/** Öğrenciler listesindeki temsilcilik sütunlarının kapsadığı görevler. */
export type TemsilcilikRolu =
  | "IL_TEMSILCISI"
  | "ILCE_TEMSILCISI"
  | "OKUL_TEMSILCISI";

/**
 * ÜÇ TEMSİLCİLİK İÇİN TEK KAPI (26 Ağustos 2026).
 *
 * Öğrenciler listesi artık üç görevi de satır içinde veriyor ve her sütun
 * kendi yetkisini soruyor. Kapılar ayrı ayrı duruyordu; ekran onları
 * `rolKodu`ya bakan bir `if` zinciriyle çağırsaydı aynı zincir hem burada hem
 * eylemde yazılır ve biri güncellenip öteki unutulurdu.
 *
 * KAPSAM VERİSİ EKSİKSE HAYIR DENİR: ili olmayan öğrenciye İl Temsilcisi,
 * okulu olmayan öğrenciye Okul Temsilcisi verilemez — atama kaydı o kapsam
 * sütunlarıyla açılıyor (bkz. gorev-rolleri/eylemler.ts).
 */
export function ogrenciTemsilciligiAtayabilirMi(
  kullanici: OturumKullanicisi,
  rolKodu: TemsilcilikRolu,
  ogrenci: {
    ilKodu: string | null;
    ilceKodu: string | null;
    kurumKodu: number | null;
  },
  kendiOgrencisiMi: boolean,
): boolean {
  if (rolKodu === "IL_TEMSILCISI") {
    return (
      ogrenci.ilKodu !== null &&
      ilTemsilcisiAtayabilirMi(kullanici, ogrenci.ilKodu)
    );
  }

  if (rolKodu === "ILCE_TEMSILCISI") {
    return (
      ogrenci.ilKodu !== null &&
      ogrenci.ilceKodu !== null &&
      ilceTemsilcisiAtayabilirMi(kullanici, ogrenci.ilKodu)
    );
  }

  return (
    ogrenci.kurumKodu !== null &&
    okulTemsilcisiAtayabilirMi(
      kullanici,
      ogrenci.kurumKodu,
      kendiOgrencisiMi,
      ogrenci.ilKodu,
    )
  );
}

export function ilTemsilcisiAtayabilirMi(
  kullanici: OturumKullanicisi,
  ilKodu: string,
): boolean {
  if (projeYoneticisiMi(kullanici)) return true;
  return (
    ilKoordinatoruMu(kullanici) && koordinatorIlKodu(kullanici) === ilKodu
  );
}

/**
 * Çalışma Grubu Yöneticisi atama yetkisi — YALNIZCA MERKEZ (11 Ağustos 2026 ·
 * istek: "koordinatör öğrenciyi çalışma grubu yöneticisi yapamasın, çalışma
 * grubu üyesi yapabilsin sadece").
 *
 * NİYE AYRI BİR KAPI: bu rol `ilTemsilcisiAtayabilirMi` ile aynı kapıdan
 * geçiyordu, yani il koordinatörü kendi ilindeki bir öğrenciyi yönetici
 * yapabiliyordu. Kapıyı paylaşmaları bir varsayıma dayanıyordu — "atama kararı
 * ilindir" — ve o varsayım çalışma grubunda tutmuyor: ÇALIŞMA GRUBU İL DEĞİL
 * ÜLKE GENELİ bir yapıdır. Bir grubun yöneticisi tek kişidir ve o kişi tüm
 * ülkedeki gruba karşı sorumludur; her ilin koordinatörü kendi ilinden birini
 * atayabilseydi, aynı grup için 81 il birbiriyle yarışır ve "önce atayan
 * kazanır" gibi bir kural doğardı.
 *
 * ÜYELİK BUNUN DIŞINDA ve koordinatörde KALIYOR: öğrenciyi gruba yazmak ayrı
 * bir yetkidir (bkz. ogrenciCalismaGrubuYonetebilirMi) ve o kapı
 * değiştirilmedi. İstek de tam olarak bu ayrımı söylüyor — üye evet, yönetici
 * hayır.
 */
/*
 * İL KOORDİNATÖRÜ 26 AĞUSTOS 2026'DA GERİ ALINDI (istek: "Çalışma grupları bu
 * sütuna 14 çalışma grubundan temsilcisi yap/kaldır şeklinde açılan listeden
 * seçsin" · kapı sorulduğunda verilen cevap: "il koordinatörü de atayabilsin").
 *
 * 11 AĞUSTOS'TA KAPATILMIŞTI ve gerekçesi yukarıda duruyor: çalışma grubu ülke
 * geneli bir yapı, grubun temsilcisi tek kişi, her il kendi adayını atayabilse
 * "önce atayan kazanır" olurdu.
 *
 * O RİSK ORTADAN KALKMADI, GÖRÜNÜR OLDU: atama eylemi dönem+grup başına tek
 * kayıt olduğunu zaten kontrol ediyor ve dolu bir grup için "Bu dönem için
 * Çalışma Grubu Yöneticisi görevi zaten X üzerinde. Önce mevcut görevi
 * kaldırın." diyerek reddediyor (bkz. gorev-rolleri/eylemler.ts). Yani ikinci
 * il sessizce ezmiyor, açık bir hata alıyor — yarış "önce atayan kazanır" ama
 * kaybeden bunu biliyor.
 *
 * KOORDİNATÖR KENDİ İLİYLE SINIRLI: `ogrenciIlKodu` verilmezse kapı yalnızca
 * merkeze açık kalır. Liste zaten kapsam filtresinden geçiyor ama form gövdesi
 * kurcalanabilir; sınır burada da duruyor.
 */
export function calismaGrubuYoneticisiAtayabilirMi(
  kullanici: OturumKullanicisi,
  /** Görev verilecek öğrencinin ili; koordinatör kapısı bununla açılır. */
  ogrenciIlKodu?: string | null,
): boolean {
  if (projeYoneticisiMi(kullanici)) return true;
  return Boolean(
    ogrenciIlKodu &&
      ilKoordinatoruMu(kullanici) &&
      koordinatorIlKodu(kullanici) === ogrenciIlKodu,
  );
}

/**
 * İlçe Temsilcisi atama yetkisi — ilçenin BAĞLI OLDUĞU İL üzerinden sorulur.
 *
 * Sistemde ilçe düzeyinde bir görevli yoktur (RolKodu'nda ILCE_KOORDINATOR
 * diye bir değer yok); ilçe, ilin içindeki bir basamaktır ve temsilcisini o ilin
 * koordinatörü belirler. Bu yüzden fonksiyon ilçe kodunu değil il kodunu alır:
 * ilçe kodundan ili çözmek veritabanına gitmek olurdu ve bu dosya saf kalmalı.
 * Çağıran, öğrencinin ilçesiyle ilinin tutarlılığını sorgudan alır.
 */
export function ilceTemsilcisiAtayabilirMi(
  kullanici: OturumKullanicisi,
  ilKodu: string,
): boolean {
  return ilTemsilcisiAtayabilirMi(kullanici, ilKodu);
}

export function calismaGrubuTanimlayabilirMi(
  kullanici: OturumKullanicisi,
): boolean {
  return projeYoneticisiMi(kullanici);
}

/**
 * Bir öğrenciyi çalışma grubuna ekleyip çıkarma yetkisi.
 *
 * Grubun kendisini TANIMLAMAK'tan (yalnızca proje yöneticisi) ayrı bir
 * yetkidir: burada listeye yeni bir grup eklenmiyor, mevcut bir gruba öğrenci
 * yazılıyor. Danışman öğretmen, il koordinatörü ve proje yöneticisi yapabilir;
 * öğrenci de kendi seçimini yapar ama o akış `/panel/calisma-gruplari`
 * ekranındadır ve burada aranmaz.
 *
 * DİKKAT: Bu fonksiyon yalnızca ROLÜ sorar. "Bu öğrenci onun kapsamında mı"
 * sorusu ayrıca `ogrenciKapsamFiltresi` ile sorulmak zorundadır — tek başına
 * kullanılırsa danışman, ilinin öbür ucundaki bir öğrenciyi gruba yazabilirdi.
 */
export function ogrenciCalismaGrubuYonetebilirMi(
  kullanici: OturumKullanicisi,
): boolean {
  return (
    projeYoneticisiMi(kullanici) ||
    ilKoordinatoruMu(kullanici) ||
    danismanMi(kullanici)
  );
}

/**
 * Rol/atama envanteri — hangi ilde koordinatör atanmış, hangi okul danışmansız
 * kalmış sorularının TOPLU cevabı.
 *
 * "Öğrenci/öğretmen verisi görüntüleme" satırından AYRI bir yetkidir: o tekil
 * profil erişimi, bu yönetimsel bir görünüm. İl koordinatörü kendi ilindeki
 * danışmansız okulları zaten görür; bu ekran aynı sorguyu il filtresi olmadan
 * çalıştırdığı için yalnızca proje yöneticisine açıktır.
 */
export function rolEnvanteriGorebilirMi(
  kullanici: OturumKullanicisi,
): boolean {
  return projeYoneticisiMi(kullanici);
}

/**
 * Erişim kayıtları — "kim hangi öğrenci kaydını ne zaman gördü" defteri.
 *
 * Defterin kendisi de kişisel veri içerdiğinden yalnızca merkeze açıktır; il
 * koordinatörü kendi ilinin kayıtlarını bile göremez, çünkü kayıtlar il
 * sınırından bağımsız olarak birbirine referans verir.
 */
export function erisimLoglariniGorebilirMi(
  kullanici: OturumKullanicisi,
): boolean {
  return projeYoneticisiMi(kullanici);
}

/**
 * Hata kayıtları — "kullanıcının ekranda gördüğü hata kimliğinin karşılığı ne"
 * (18 Ağustos 2026).
 *
 * ERİŞİM KAYITLARINDAN AYRI BİR FONKSİYON, ikisi de bugün aynı cevabı verse
 * bile: erişim kayıtları KİŞİSEL VERİ taşıdığı için merkeze kapalı, hata
 * günlüğü ise kişisel veri taşımıyor (bkz. lib/hata-kaydi.ts · "NE YAZILIR, NE
 * YAZILMAZ") ama SUNUCUNUN İÇİNİ gösteriyor — yığın izinde dosya yolları,
 * sorgu parçaları ve sürüm bilgisi var. İki ekranın kapalı olma gerekçesi
 * farklı olduğu için biri gevşetildiğinde öbürü sessizce açılmamalı.
 *
 * İl koordinatörüne kapalı: günlük ile sınırı yoktur, ülke genelindeki her
 * isteğin hatası aynı dosyada.
 */
export function hataKayitlariniGorebilirMi(
  kullanici: OturumKullanicisi,
): boolean {
  return projeYoneticisiMi(kullanici);
}

/**
 * İLGİLİ KİŞİ (KVKK) BAŞVURULARINI YANITLAYABİLİR Mİ? (2 Eylül 2026 ·
 * Genelge 4/ç)
 *
 * YALNIZCA MERKEZ ve bu, ürün tercihi değil kanunun gereği: başvuru VERİ
 * SORUMLUSUNA yapılır (KVKK m.13) ve veri sorumlusu YEĞİTEK'tir. İl
 * koordinatörü kendi ilindeki kişinin başvurusunu bile göremez — göreydi,
 * kanunun tek muhatap saydığı yerde ikinci bir merci doğar ve ilgili kişi
 * ilden ile değişen cevaplar alırdı.
 *
 * BAŞVURU YAPMAK BU KAPIDAN GEÇMEZ: hakkı olan herkes başvurur (kendi
 * ekranından, oturum açmış olmak yeterli). Buradaki kapı yalnızca "kim
 * cevaplar" sorusunu kapatıyor.
 *
 * `erisimLoglariniGorebilirMi`DEN AYRI FONKSİYON, bugün aynı cevabı verse
 * bile: o defter denetim izidir ve merkeze kapalı olma gerekçesi "kayıtlar il
 * sınırından bağımsız birbirine referans veriyor"dur; buradaki kapının
 * gerekçesi ise kanunun muhatap tanımı. Biri gevşetildiğinde öbürü sessizce
 * açılmamalı.
 */
export function kvkkBasvurulariniYanitlayabilirMi(
  kullanici: OturumKullanicisi,
): boolean {
  return projeYoneticisiMi(kullanici);
}

/**
 * TOPLU MESAJ GÖNDEREBİLİR Mİ? (31 Ağustos 2026 · istek: "il koordinatörü
 * yönetim panelinde toplu mesaj kartı ekle, ilindeki tüm öğrenciler, tüm
 * öğretmenler, ilçe temsilcisi, il temsilcisi, eklediği ekiplere ayrı ayrı
 * her ekip için ayrı toplu mesaj").
 *
 * `sistemAyarlariniYonetebilirMi`DEN AYRILDI ve ayrılması şarttı: toplu duyuru
 * o güne kadar sistem ayarlarıyla aynı kapıdan geçiyordu ("herkese giden metin,
 * merkezin işi"). Artık kitle GÖNDERENİN KAPSAMI kadar — koordinatörün mesajı
 * kendi ilini aşmıyor. Aynı izin fonksiyonu kullanılsaydı koordinatöre toplu
 * mesaj açmak, ona bildirim şablonlarını ve çalışma gruplarını da açmak
 * olurdu.
 *
 * KAPSAMIN KENDİSİ BURADA SORULMUYOR: kimin hangi kitleye yazabileceğine
 * lib/bildirim/toplu-alicilar.ts karar veriyor ve gönderim eylemi o listeyi
 * yeniden üretip anahtarı orada arıyor — ekranda görünmek yetki değildir.
 */
export function topluMesajGonderebilirMi(
  kullanici: OturumKullanicisi,
): boolean {
  return projeYoneticisiMi(kullanici) || ilKoordinatoruMu(kullanici);
}

/** Sistem ayarları, çalışma grupları ve etkinlik programları merkezden yönetilir. */
export function sistemAyarlariniYonetebilirMi(
  kullanici: OturumKullanicisi,
): boolean {
  return projeYoneticisiMi(kullanici);
}

// ---------------------------------------------------------------------------
// Yönetim panosu
// ---------------------------------------------------------------------------

/**
 * Yönetim panosunu görebilir mi? (11 Ağustos 2026)
 *
 * Pano, yönetim ekranlarının ortak girişidir: il/ilçe/okul kırılımı ile
 * birlikte öğrenci, öğretmen, paydaş ve görev rolleri ekranlarının kartları da
 * buradadır. Kapı bu yüzden "en dar yönetim yetkisi" ile açılıyor: il
 * koordinatörü ve merkez. Danışman öğretmen DIŞARIDA — ona ait tek yönetim
 * ekranı kendi öğrenci listesidir ve menüsünde "Öğrencilerim" olarak duruyor;
 * pano ona ilinin tamamını gösterirdi.
 *
 * Panonun İÇİNDEKİ her ekran kendi yetkisini AYRICA sorar (paydaş, görev
 * rolleri, envanterler). Buradaki kapı yalnızca "pano açılır mı" sorusunu
 * cevaplar; kartların hangisinin basılacağına ekran karar verir.
 */
export function yonetimPanosuGorebilirMi(
  kullanici: OturumKullanicisi,
): boolean {
  return projeYoneticisiMi(kullanici) || ilKoordinatoruMu(kullanici);
}

/**
 * Panoda BU İLİN kırılımını açabilir mi?
 *
 * Kırılım adresten geliyor (`/panel/yonetim/il/34`), dolayısıyla kapsam
 * ekranda değil burada kararlaştırılıyor: koordinatör yalnızca kendi ilini,
 * merkez hepsini açar. Kontrol olmasaydı bir koordinatör adres çubuğuna başka
 * il kodu yazarak o ilin okul ve öğrenci sayımlarını görebilirdi — sayım da
 * veridir.
 *
 * İli olmayan (merkez dışı) kullanıcı hiçbir ili açamaz: fail closed.
 */
export function yonetimPanosuIlErisimi(
  kullanici: OturumKullanicisi,
  ilKodu: string,
): boolean {
  if (projeYoneticisiMi(kullanici)) return true;
  return koordinatorIlKodu(kullanici) === ilKodu;
}

// ---------------------------------------------------------------------------
// Öğrenci ve öğretmen envanteri
// ---------------------------------------------------------------------------

/**
 * Öğrenci envanterini (liste ekranı ve CSV çıktısı) görebilir mi?
 *
 * KAPI EKRAN SEVİYESİNDE DE KAPALI OLMALI (11 Ağustos 2026). Ekran önceden
 * yalnızca ÖĞRENCİYİ eliyordu; kalan herkes listeyi açabiliyor ve kapsam
 * filtresi sayesinde "0 kayıt" görüyordu. Mezun, paydaş temsilcisi, mentör ve
 * görev almamış öğretmen için bu ekran hiç açılmamalı:
 *
 *   · Boş liste, veri sızdırmasa da YANLIŞ BİLGİ verir — "sistemde öğrenci
 *     yok" diye okunur.
 *   · Asıl mesele kırılganlık: erişimi tek başına `ogrenciKapsamFiltresi`nin
 *     varsayılan dalı (HICBIRI) tutuyordu. O dalda bir gün yapılacak bir
 *     genişletme, bu ekranı kimse fark etmeden veri gösterir hâle getirirdi.
 *     Yetki iki katmanda birden sorulur (permissions.md · Bölüm 4).
 *
 * Liste `ogretmenEnvanteriGorebilirMi` ile AYNI: kapsam filtresinde kayıt
 * görebilen roller tam olarak bunlar (danışman kendi okulu, koordinatör kendi
 * ili, merkez ülke geneli).
 */
export function ogrenciEnvanteriGorebilirMi(
  kullanici: OturumKullanicisi,
): boolean {
  return (
    projeYoneticisiMi(kullanici) ||
    ilKoordinatoruMu(kullanici) ||
    danismanMi(kullanici)
  );
}

/**
 * Danışman öğretmen envanterini görebilir mi?
 *
 * Öğrenci envanterinden AYRI bir kapıdır ama kapsam mantığı aynıdır: danışman
 * kendi okulundaki, il koordinatörü kendi ilindeki, YEĞİTEK tüm ülkedeki
 * öğretmenleri görür (bkz. ogretmenKapsamFiltresi). Öğrenci hiçbir koşulda
 * göremez: öğretmenin branşı ve iletişim bilgisi öğrencinin işine yaramaz,
 * kendi danışmanını zaten "Danışmanım" ekranında görüyor.
 *
 * Görev almamış öğretmen de göremez — öğrenci envanterinde olduğu gibi fail
 * closed davranılır.
 */
export function ogretmenEnvanteriGorebilirMi(
  kullanici: OturumKullanicisi,
): boolean {
  return (
    projeYoneticisiMi(kullanici) ||
    ilKoordinatoruMu(kullanici) ||
    danismanMi(kullanici)
  );
}

// ---------------------------------------------------------------------------
// Paydaş envanteri
// ---------------------------------------------------------------------------

/**
 * Paydaş listesini görebilir mi? (analiz dokümanı Bölüm 3)
 *
 * Liste "faaliyet planlarken hızlıca ulaşılacak kurumlar" defteridir; faaliyet
 * düzenleyen herkes görür. Öğrenci göremez: kayıtlar kurum yetkililerinin adı
 * ve doğrudan iletişim bilgisidir, öğrencinin bu bilgiyle yapacağı bir iş yok.
 */
export function paydasGorebilirMi(kullanici: OturumKullanicisi): boolean {
  return (
    projeYoneticisiMi(kullanici) ||
    ilKoordinatoruMu(kullanici) ||
    danismanMi(kullanici)
  );
}

/**
 * Paydaş kaydı EKLEYEBİLİR Mİ?
 *
 * Görmekten dar bir yetkidir: kayıt ilin koordinatörüne ve merkeze bırakıldı.
 * Her danışman öğretmen de ekleyebilseydi aynı üniversite onlarca kez farklı
 * yazımla girilir ve "il bazlı iş birliği haritası" kullanılamaz hâle gelirdi.
 * Danışman öğretmen paydaşı görür ve faaliyetine bağlar; listeye yeni kurum
 * eklenmesini koordinatöründen ister.
 *
 * EKLEMEDE İL SORULMAZ. Koordinatörün iş birliği kurduğu üniversite ya da
 * şirket başka ilde olabilir (İzmir koordinatörünün Ankara'daki bir
 * üniversiteyle çalışması olağandır); kaydı kendi iline yazmaya zorlamak
 * envanteri yanlışlardı. Kaydın hangi ile ait olduğu formda seçilir.
 */
export function paydasEkleyebilirMi(kullanici: OturumKullanicisi): boolean {
  return projeYoneticisiMi(kullanici) || ilKoordinatoruMu(kullanici);
}

/**
 * MEVCUT bir paydaş kaydını düzenleyebilir mi?
 *
 * Eklemeden DAR bir yetkidir ve iki kapısı vardır:
 *   1. Kayıt kendi ilindeyse — envanter ile bağlıdır, koordinatör değişse de
 *      yeni koordinatör devralır.
 *   2. Kaydı kendisi eklediyse — başka ile yazdığı kaydı düzeltebilmeli,
 *      yoksa yanlış yazdığı bir kurumu düzeltemez hâle gelirdi.
 *
 * Başka bir ilin koordinatörünün eklediği kayda dokunulamaz: aynı kurumu iki
 * il farklı biçimde yönetiyorsa bu bir veri çatışmasıdır, yetki sorunu değil.
 */
export function paydasYonetebilirMi(
  kullanici: OturumKullanicisi,
  ilKodu: string,
  ekleyenKullaniciId?: number,
): boolean {
  if (projeYoneticisiMi(kullanici)) return true;
  if (!ilKoordinatoruMu(kullanici)) return false;
  if (koordinatorIlKodu(kullanici) === ilKodu) return true;
  return ekleyenKullaniciId !== undefined && ekleyenKullaniciId === kullanici.id;
}

/**
 * Paydaş kaydını onaylar / reddeder mi? — YALNIZCA MERKEZ (27 Ağustos 2026 ·
 * istek: "proje yöneticisi bu listeden en son sütunda onay veya red versin").
 *
 * KAYDI AÇAN KARAR VEREMEZ: paydaş envanterini il koordinatörü dolduruyor
 * (`paydasEkleyebilirMi`), kararı ise onun üstündeki merci veriyor. Aynı
 * kişide toplansaydı onay bir adım değil, bir tıklama fazlası olurdu — market
 * onayında ve GençTek görevlerinde de aynı ayrım var.
 *
 * MERKEZİN KENDİ AÇTIĞI KAYIT DA KUYRUĞA DÜŞER ve onu yine merkez onaylar.
 * "Kimse kendi işini onaylamaz" kuralı burada aranmıyor: mentörlükte o kural
 * koordinatörün ÜSTÜNDE bir merci olduğu için işliyordu; merkezin üstünde
 * yok, dolayısıyla kural uygulanabilir değil.
 */
export function paydasOnaylayabilirMi(kullanici: OturumKullanicisi): boolean {
  return projeYoneticisiMi(kullanici);
}

/**
 * Faaliyete paydaş bağlayabilir mi?
 *
 * Bağlantı, paydaş kaydını YÖNETMEKTEN farklıdır: faaliyeti açan danışman
 * öğretmen kendi etkinliğinin hangi kurumla yapıldığını yazabilmelidir, ama
 * bu ona paydaş listesini düzenleme yetkisi vermez. Kapı, faaliyetin ek ve
 * içerik kapısıyla aynıdır — ikisi de "bu faaliyet senin mi" sorusudur.
 */
export function faaliyetPaydasiYonetebilirMi(
  kullanici: OturumKullanicisi,
  faaliyet: FaaliyetKapsami,
): boolean {
  return ekYukleyebilirMi(kullanici, faaliyet);
}

/**
 * KULLANICI YÖNETİMİ (28 Ekim 2026 · istek: "proje yöneticisi için yönetim
 * panelinde kullanıcı yönetimi diye bölüm ekle, kullanıcı kaydı silme şifre
 * yenileme gibi kısımlar olsun").
 *
 * Yalnızca merkez: hesap silme ve başkasına şifre verme, il kapsamıyla
 * sınırlanabilecek bir iş değil — yanlış ellerde hesabı ele geçirme aracıdır.
 */
export function kullaniciYonetebilirMi(kullanici: OturumKullanicisi): boolean {
  return projeYoneticisiMi(kullanici);
}
