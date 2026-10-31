"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { oturumKullanicisiZorunlu } from "@/lib/auth/oturum";
import {
  CIFT_KAYIT_ALANI,
  ciftKayitSiniri,
  kullaniciKilidiAl,
} from "@/lib/cift-kayit";
import { prisma } from "@/lib/db";
import {
  BILDIRIM_KODLARI,
  projeYoneticilerineBildir,
} from "@/lib/bildirim/gonder";
import {
  cvEkNotuKaydet,
  cvKaydet,
  cvSil,
  cvSinirlariniGetir,
} from "@/lib/ogrenci/cv";
import {
  kazanimEkiKaydet,
  kazanimEkiSil,
  kazanimEkleriniKaydet,
  kazanimEkSinirlariniGetir,
} from "@/lib/kazanim/ek";
import {
  kazanimKabulEdilirMi,
  kazanimTipiGecerliMi,
  kazanimTipiTanimi,
  kazanimTipininCapasi,
} from "@/lib/kazanim/kurallar";
import { urunPaylasimOnayAlanlari } from "@/lib/market/kurallar";
import { bugununBasi, gunBasi } from "@/lib/tarih";
import { ogrenciMi, urunMarketOnayiVerebilirMi } from "@/lib/yetki/izinler";
import { erisimLogla } from "@/lib/yetki/log";
import {
  BulunamadiHatasi,
  type OturumKullanicisi,
  YetkiHatasi,
} from "@/lib/yetki/tipler";

/**
 * Kişinin kendi kazanım kayıtları ve öğrencinin CV'si —
 * references/domain-rules.md Bölüm 14.
 *
 * Hepsi oturumdaki kişinin KENDİ verisi üzerinde çalışır: `kullaniciId` hiçbir
 * yerde form girdisinden okunmaz, her zaman `kullanici.id`'dir. Danışman ya da
 * koordinatör bir öğrencinin kazanımını giremez/silemez — bunlar beyandır ve
 * sahibi dışında kimse dokunmaz (çalışma grubu eklemeden farkı budur).
 *
 * Kazanım kaydı da CV de ÖĞRETMENE AÇIKTIR (7 Ağustos 2026). CV'nin hangi
 * profil tablosuna yazılacağı kişinin kendi rolünden okunur, form girdisinden
 * değil (bkz. cvSahibi).
 */

/**
 * Formların yaşadığı ekran — dönüş adresi.
 *
 * `/panel/profil` DEĞİL (C4 · 7 Ağustos 2026): kayıt ekleme ve CV formları
 * Panelim'e taşındı, profil salt okunur oldu.
 *
 * `bolum` parametresi çıpadan ayrı gönderilir: bölümler katlanabilir
 * `<details>` öğeleri ve kapalı bir öğenin çapasına inmek, kullanıcıyı az önce
 * doldurduğu formun kapanmış hâline götürürdü.
 */
const YOL = "/panel";

/**
 * Girilen kayıtların listelendiği bölümün çapası.
 *
 * Silme ve belge işlemleri BURAYA döner, kaydın kendi grubuna değil: üç grup
 * kutusu yalnızca ekleme formu taşıyor, kayıtların tamamı bu bölümde. Kapanmış
 * tiplerin (bkz. ARSIVLENMIS_TIPLER) kayıtlarına da yalnızca buradan
 * erişiliyor — kaydın grubuna dönmek onları ulaşılmaz kılardı.
 */
const KAYITLAR_CAPASI = "girdigim-kayitlar";

function panele(capa: string, sorgu: string): never {
  redirect(`${YOL}?bolum=${capa}&${sorgu}#${capa}`);
}

/**
 * Kayıt ekleme PANELE DÖNDÜ (22 Ağustos 2026 · istek: "diğerlerini direk
 * panele alt alta alıyoruz açılır şekilde"). Formlar 21 Ağustos'ta kendi
 * sayfasına çıkmıştı; artık panelin altındaki katlanır kutular.
 *
 * Dönüş adresi KAYDIN GRUBUDUR: kişi ürününü girdiyse Ürünlerim kutusu açık
 * dönmeli — sayfanın tepesine düşüp kutuyu yeniden açmak zorunda kalmasın.
 */
function kayitlaraDon(capa: string, sorgu: string): never {
  panele(capa, sorgu);
}

function hataylaDon(capa: string, mesaj: string): never {
  kayitlaraDon(capa, `hata=${encodeURIComponent(mesaj)}`);
}

/**
 * Kaydın KENDİ SAYFASI (24 Ağustos 2026 · istek: "tıklayınca sayfasına gidip
 * düzenleyebilsin").
 */
function kayitSayfasi(kazanimId: number, sorgu: string): string {
  return `/panel/kayitlarim/${kazanimId}?${sorgu}`;
}

/**
 * Aynı eylem iki yerden çağrılıyor: paneldeki grup kutusundan ve kaydın kendi
 * sayfasından. Formda `donus=kayit` varsa kişi kaydın sayfasındaydı ve oraya
 * dönmeli — panele atılsaydı az önce açtığı kayıttan çıkmış olurdu.
 *
 * Değer FORMDAN geliyor ama serbest bir adres DEĞİL: yalnızca "kayit" kelimesi
 * tanınıyor ve hedef, sahipliği doğrulanmış kaydın kimliğinden kuruluyor —
 * form girdisiyle keyfi bir adrese yönlendirme (open redirect) mümkün değil.
 */
function kayitOrtamindaDon(
  veri: FormData,
  kazanimId: number,
  capa: string,
  sorgu: string,
): never {
  if (String(veri.get("donus") ?? "") === "kayit") {
    redirect(kayitSayfasi(kazanimId, sorgu));
  }
  kayitlaraDon(capa, sorgu);
}

/** CV iki yerde görünüyor: panel ve kişinin envanterdeki detayı. */
function cvYollariniTazele(kullanici: OturumKullanicisi): void {
  revalidatePath(YOL);
  revalidatePath(
    ogrenciMi(kullanici)
      ? `/panel/ogrenciler/${kullanici.id}`
      : `/panel/ogretmenler/${kullanici.id}`,
  );
}

/** CV, kayıtlardan AYRI bir bölüm; uyarısı da orada görünmeli. */
function cvHatasi(mesaj: string): never {
  panele("cvm", `hata=${encodeURIComponent(mesaj)}`);
}

/**
 * CV artık ÖĞRETMENDE DE var (7 Ağustos 2026 · istek: öğretmen profilinde
 * "Özgeçmiş"). Kapı bu yüzden kalktı; yerine "hangi profil tablosuna" sorusu
 * geldi ve cevabı kişinin kendi rolünden okunuyor — form girdisinden değil.
 *
 * Dış kullanıcılar (mezun, paydaş, mentör) de `ogretmen_profil` satırını
 * kullanıyor; onların da CV'si buraya yazılır.
 */
function cvSahibi(kullanici: OturumKullanicisi): "OGRENCI" | "OGRETMEN" {
  return ogrenciMi(kullanici) ? "OGRENCI" : "OGRETMEN";
}

/**
 * Kayıt sonrası tazelenecek ekranlar.
 *
 * Kazanım aynı anda üç yerde görünüyor: panel, katkı ekranı ve kişinin
 * envanterdeki detay sayfası. Detay sayfasının yolu role göre değişir
 * (`ogrenciler` / `ogretmenler`); tazelenmezse yetkili, öğrencinin az önce
 * girdiği kaydı eski önbellekten göremezdi.
 */
function kazanimYollariniTazele(kullanici: OturumKullanicisi): void {
  revalidatePath(YOL);
  revalidatePath("/panel/gorevlerim");
  revalidatePath("/panel/kazanimlarim");
  revalidatePath(
    ogrenciMi(kullanici)
      ? `/panel/ogrenciler/${kullanici.id}`
      : `/panel/ogretmenler/${kullanici.id}`,
  );
}

/**
 * Ürün görselini (vitrin kapağı) forma geldiyse kaydeder.
 *
 * BOŞ ALAN "KAPAĞI KALDIR" DEMEK DEĞİLDİR: dosya girdileri her gönderimde boş
 * gelir ve kişi düzenleme formunu görsele dokunmadan kaydettiğinde kapağının
 * silinmesi beklenmedik olurdu. Kapak kaldırmak, ekin kendisini silmektir
 * (kayıt sayfasındaki belge listesi).
 *
 * Hata KAYDI GERİ ALMAZ; çağıran uyarıyı ekranda gösterir.
 */
async function urunKapaginiYaz(
  veri: FormData,
  kazanimId: number,
): Promise<string | undefined> {
  const gorsel = veri.get("urunGorseli");
  if (!(gorsel instanceof File) || gorsel.size === 0) return undefined;

  const sonuc = await kazanimEkiKaydet({
    kazanimId,
    dosya: gorsel,
    sinirlar: await kazanimEkSinirlariniGetir(),
    kapakMi: true,
  });

  return sonuc.olurMu ? undefined : `${gorsel.name}: ${sonuc.neden}`;
}

export async function kazanimEkleEylemi(veri: FormData): Promise<void> {
  const kullanici = await oturumKullanicisiZorunlu();

  /*
   * Dönüş bölümü FORMUN TÜRÜNDEN okunuyor, kararın sonucundan değil: hata
   * dalları karar üretilmeden önce dönüyor ve orada da kişinin doldurduğu
   * kutuya geri düşmesi gerekiyor. Tanınmayan tip "Girdiğim kayıtlar"a düşer —
   * o durumda zaten bir hata iletisi basılıyor.
   */
  const gonderilenTip = String(veri.get("tip") ?? "");
  const capa =
    (kazanimTipiGecerliMi(gonderilenTip)
      ? kazanimTipininCapasi(gonderilenTip)
      : null) ?? KAYITLAR_CAPASI;

  /*
   * Programın ADI form girdisinden okunmaz, id'siyle veritabanından çekilir:
   * ad da gönderilseydi listede olmayan bir metni "GençTek programı" diye
   * kaydettirmek mümkün olurdu. Pasife alınmış program yeni kayıtta seçilemez,
   * eski kayıtların bağlantısı korunur.
   */
  const programId = Number.parseInt(
    String(veri.get("temelEtkinlikProgramiId") ?? ""),
    10,
  );
  const program = Number.isFinite(programId)
    ? await prisma.temelEtkinlikProgrami.findFirst({
        where: { id: programId, aktif: true },
        select: { id: true, ad: true },
      })
    : null;
  if (Number.isFinite(programId) && !program) {
    hataylaDon(capa, "Seçilen GençTek etkinliği bulunamadı.");
  }

  /*
   * BELGE ZORUNLULUĞU KAYITTAN ÖNCE SINANIYOR (22 Ağustos 2026 · istek).
   * Belgeler normalde kayıt oluştuktan SONRA yazılıyor ve yükleme hatası kaydı
   * geri almıyor; zorunlu tipte aynı sıra izlenseydi belgesiz bir sertifika
   * kaydı oluşup ekranda "belge yüklenemedi" uyarısıyla kalırdı.
   *
   * Tarayıcıdaki `required` ile aynı kural, iki katman: form dışından
   * gönderilen bir istek o kontrolü hiç görmez.
   */
  const belgeZorunlu =
    kazanimTipiGecerliMi(gonderilenTip) &&
    kazanimTipiTanimi(gonderilenTip).belgeZorunluMu === true;
  if (
    belgeZorunlu &&
    veri
      .getAll("belgeler")
      .filter((deger): deger is File => deger instanceof File && deger.size > 0)
      .length === 0
  ) {
    hataylaDon(capa, "Bu kayıt için belge yüklemek zorunludur.");
  }

  const karar = kazanimKabulEdilirMi({
    tip: String(veri.get("tip") ?? ""),
    baslik: String(veri.get("baslik") ?? ""),
    aciklama: String(veri.get("aciklama") ?? ""),
    /*
     * Gün başına alınır: kazanımlarda saat bilgisi sorulmuyor.
     *
     * ALAN HİÇ GÖNDERİLMEDİYSE BUGÜN (22 Ağustos 2026 · istek: "Tarih alanını
     * kaldır, otomatik atsın"). Ürün formunda tarih sorulmuyor ve kaydın
     * tarihi girildiği gündür. Ayrım "alan var mı" üzerinden: boş bırakılmış
     * bir tarih kutusu (`""`) hâlâ "tarih yok" demek — kişi bilerek boş
     * bıraktıysa uydurulmuş bir gün yazmıyoruz.
     */
    tarih:
      veri.get("tarih") === null
        ? bugununBasi()
        : gunBasi(String(veri.get("tarih") ?? "") || null),
    baglantiUrl: String(veri.get("baglantiUrl") ?? ""),
    derece: String(veri.get("derece") ?? ""),
    duzenleyen: String(veri.get("duzenleyen") ?? ""),
    katilimBicimi: String(veri.get("katilimBicimi") ?? ""),
    hedefKitle: String(veri.get("hedefKitle") ?? ""),
    gelistirenEkip: String(veri.get("gelistirenEkip") ?? ""),
    markettePaylasilsin: veri.get("markettePaylasilsin") === "evet",
    /*
     * Bağlantı satırları paralel iki dizi olarak gelir (adres[i] ↔ etiket[i]).
     * Formda sabit sayıda satır basıldığı için boşlar da geliyor; kural
     * katmanı onları eliyor.
     */
    baglantilar: veri.getAll("baglantiAdres").map((adres, sira) => ({
      adres: String(adres),
      etiket: String(veri.getAll("baglantiEtiket")[sira] ?? ""),
    })),
    program,
  });
  if (!karar.olurMu) hataylaDon(capa, karar.neden);

  /*
   * PROFİLDEN PAYLAŞILAN ÜRÜN DE ONAYA GİRER (26 Ağustos 2026 · istek:
   * "markette bir ürün paylaştım ama markette paylaşılmadı yazıyor, bu onaya
   * gitmiyor mu").
   *
   * Onay akışı market ekranındaki paylaşım düğmesine bağlanmıştı; ürünü
   * eklerken "markette paylaş" kutusunu işaretleyen kişi ise kuyruğa hiç
   * uğramadan vitrine çıkıyordu — yani onay, hangi kapıdan girdiğinize göre
   * vardı ya da yoktu. Kapı artık tek: paylaşım tercihi işaretliyse kayıt
   * `BEKLIYOR` doğar (bkz. urunler/eylemler.ts · paylasimiDegistirEylemi).
   */
  const onayaGirsin = karar.kayit.markettePaylasilsin === true;

  /*
   * KARARI ZATEN VEREBİLEN KİŞİNİN ÜRÜNÜ KUYRUĞA GİRMEZ (28 Ağustos 2026).
   * Gerekçe kural katmanında: lib/market/kurallar.ts.
   */
  const onay = urunPaylasimOnayAlanlari({
    sahipKullaniciId: kullanici.id,
    kendiKararVerebilirMi: urunMarketOnayiVerebilirMi(kullanici),
    simdi: new Date(),
  });

  /*
   * ÇİFT KAYIT ENGELİ (31 Ekim 2026 · istek: "çocuklar sertifika girerken 20
   * kere eklemiş"). Aynı kişinin aynı türde aynı başlıklı kaydı son iki
   * dakikada açıldıysa yenisi yazılmaz; kişi listesine "eklendi" iletisiyle
   * döner. Kilit aynı anda gelen istekleri sıraya sokar (bkz. lib/cift-kayit.ts).
   */
  const sonuc = await prisma.$transaction(async (islem) => {
    await kullaniciKilidiAl(islem, CIFT_KAYIT_ALANI.KAZANIM, kullanici.id);
    const ayni = await islem.kullaniciKazanim.findFirst({
      where: {
        kullaniciId: kullanici.id,
        tip: karar.kayit.tip,
        baslik: karar.kayit.baslik,
        olusturmaTarihi: { gte: ciftKayitSiniri() },
      },
      select: { id: true },
    });
    if (ayni) return null;
    return islem.kullaniciKazanim.create({
      data: {
        kullaniciId: kullanici.id,
        ...karar.kayit,
        ...(onayaGirsin ? onay.alanlar : {}),
        baglantilar: { create: karar.baglantilar },
      },
      select: { id: true },
    });
  });
  if (!sonuc) {
    kayitlaraDon(capa, `tur=${karar.kayit.tip}&durum=kazanim-eklendi`);
  }
  const kazanim = sonuc;

  /* Kuyruk sessiz değil: kararı verecek merkez uyarılıyor. */
  if (onayaGirsin && onay.bildirimGerekliMi) {
    await projeYoneticilerineBildir(BILDIRIM_KODLARI.ONAY_BEKLEYEN_URUN, {
      sahipAdSoyad: `${kullanici.ad} ${kullanici.soyad}`,
      urunAdi: karar.kayit.baslik,
    });
  }

  /*
   * Destekleyici belgeler kayıttan SONRA yazılır: eke bağlanacak kazanım
   * kimliği önce doğmalı. Dosya reddedilirse kazanım kaydı geri alınmaz —
   * kullanıcı yazdığı metni kaybetmesin; uyarı ekranda gösterilir ve dosya
   * sonradan eklenebilir.
   */
  const belgeler = veri
    .getAll("belgeler")
    .filter((deger): deger is File => deger instanceof File && deger.size > 0);

  let ekUyarisi: string | undefined;
  if (belgeler.length > 0) {
    const sonuc = await kazanimEkleriniKaydet({
      kazanimId: kazanim.id,
      dosyalar: belgeler,
      sinirlar: await kazanimEkSinirlariniGetir(),
    });
    ekUyarisi = sonuc.uyari;
  }

  /*
   * ÜRÜN GÖRSELİ (vitrin kapağı) belgelerden SONRA yazılır ve kendi uyarısını
   * belgelerinkinin ÖNÜNE geçirmez: iki alan da reddedilirse kullanıcı ilk
   * hatayı okur, ikisini tek satıra yığmak mesajı okunmaz yapardı.
   *
   * Kapak reddedilse de kazanım kaydı geri ALINMAZ — belgelerdeki kuralın
   * aynısı: kişi yazdığı metni kaybetmesin, görseli sonradan ekleyebilsin.
   */
  const kapakUyarisi = await urunKapaginiYaz(veri, kazanim.id);
  ekUyarisi ??= kapakUyarisi;

  const sahip = ogrenciMi(kullanici) ? "OGRENCI" : "OGRETMEN";
  await erisimLogla({
    kullaniciId: kullanici.id,
    islem: "DEGISIKLIK",
    hedefTip: "PROFIL",
    hedefId: kullanici.id,
    detay: `Kazanım eklendi (${kazanimTipiTanimi(karar.kayit.tip, sahip).baslik}): ${karar.kayit.baslik}`,
  });

  kazanimYollariniTazele(kullanici);
  // Tür adreste taşınır: art arda üç ürün girecek kişi her seferinde sekmeyi
  // yeniden seçmek zorunda kalmasın.
  if (ekUyarisi) {
    kayitlaraDon(
      capa,
      `tur=${karar.kayit.tip}&hata=${encodeURIComponent(
        `Kayıt eklendi ancak belge yüklenemedi — ${ekUyarisi}`,
      )}`,
    );
  }
  kayitlaraDon(capa, `tur=${karar.kayit.tip}&durum=kazanim-eklendi`);
}

/** Var olan bir kazanım kaydına destekleyici belge ekler. */
export async function kazanimBelgeEkleEylemi(veri: FormData): Promise<void> {
  const kullanici = await oturumKullanicisiZorunlu();

  const kazanimId = Number.parseInt(String(veri.get("kazanimId") ?? ""), 10);
  if (!Number.isFinite(kazanimId)) throw new BulunamadiHatasi();

  // Sahiplik kontrolü: kullaniciId koşulu olmadan başkasının kaydına dosya
  // eklenebilirdi.
  const kazanim = await prisma.kullaniciKazanim.findFirst({
    where: { id: kazanimId, kullaniciId: kullanici.id },
    select: { id: true, baslik: true },
  });
  if (!kazanim) throw new BulunamadiHatasi();

  const belgeler = veri
    .getAll("belgeler")
    .filter((deger): deger is File => deger instanceof File && deger.size > 0);
  if (belgeler.length === 0) {
    kayitOrtamindaDon(
      veri,
      kazanim.id,
      KAYITLAR_CAPASI,
      `hata=${encodeURIComponent("Belge seçilmedi.")}`,
    );
  }

  const sonuc = await kazanimEkleriniKaydet({
    kazanimId: kazanim.id,
    dosyalar: belgeler,
    sinirlar: await kazanimEkSinirlariniGetir(),
  });
  if (sonuc.uyari) {
    kayitOrtamindaDon(
      veri,
      kazanim.id,
      KAYITLAR_CAPASI,
      `hata=${encodeURIComponent(sonuc.uyari)}`,
    );
  }

  await erisimLogla({
    kullaniciId: kullanici.id,
    islem: "DEGISIKLIK",
    hedefTip: "PROFIL",
    hedefId: kullanici.id,
    detay: `Kazanıma ${sonuc.eklenen} destekleyici belge eklendi: ${kazanim.baslik}`,
  });

  kazanimYollariniTazele(kullanici);
  kayitOrtamindaDon(veri, kazanim.id, KAYITLAR_CAPASI, "durum=belge-eklendi");
}

/** Destekleyici belgeyi kaldırır. */
export async function kazanimBelgeSilEylemi(veri: FormData): Promise<void> {
  const kullanici = await oturumKullanicisiZorunlu();

  const ekId = Number.parseInt(String(veri.get("ekId") ?? ""), 10);
  if (!Number.isFinite(ekId)) throw new BulunamadiHatasi();

  const sonuc = await kazanimEkiSil({ ekId, kullaniciId: kullanici.id });
  if (!sonuc.silindiMi) throw new BulunamadiHatasi();

  await erisimLogla({
    kullaniciId: kullanici.id,
    islem: "SILME",
    hedefTip: "PROFIL",
    hedefId: kullanici.id,
    detay: `Kazanım belgesi silindi: ${sonuc.dosyaAdi}`,
  });

  kazanimYollariniTazele(kullanici);
  /*
   * Kaydın kimliği FORMDAN okunuyor ve yalnızca DÖNÜŞ ADRESİ için kullanılıyor:
   * silme yetkisi ekin kendi kimliği üzerinden doğrulandı
   * (bkz. kazanimEkiSil · kullaniciId koşulu). Yanlış bir kimlik yazan kişi
   * başkasının ekini silemez, yalnızca kendini boş bir sayfaya yollar.
   */
  kayitOrtamindaDon(
    veri,
    Number.parseInt(String(veri.get("kazanimId") ?? ""), 10),
    KAYITLAR_CAPASI,
    "durum=belge-silindi",
  );
}

export async function kazanimSilEylemi(veri: FormData): Promise<void> {
  const kullanici = await oturumKullanicisiZorunlu();

  const kazanimId = Number.parseInt(String(veri.get("kazanimId") ?? ""), 10);
  if (!Number.isFinite(kazanimId)) throw new BulunamadiHatasi();

  /*
   * Silme `deleteMany` ile ve kullaniciId koşuluyla yapılır: `delete` ile id'ye
   * göre silinseydi forma başkasının kazanım id'sini yazan kullanıcı o kaydı
   * silebilirdi. Sahiplik kontrolü ve silme tek sorguda birleşiyor.
   */
  const kazanim = await prisma.kullaniciKazanim.findFirst({
    where: { id: kazanimId, kullaniciId: kullanici.id },
    select: { baslik: true, tip: true },
  });
  if (!kazanim) throw new BulunamadiHatasi();

  await prisma.kullaniciKazanim.deleteMany({
    where: { id: kazanimId, kullaniciId: kullanici.id },
  });

  await erisimLogla({
    kullaniciId: kullanici.id,
    islem: "SILME",
    hedefTip: "PROFIL",
    hedefId: kullanici.id,
    detay: `Kazanım silindi: ${kazanim.baslik}`,
  });

  kazanimYollariniTazele(kullanici);
  /*
   * SİLMEDE `donus` OKUNMUYOR: kayıt artık yok, kendi sayfasına dönmek
   * "bulunamadı" ekranı demekti. Kişi kaydın GRUBUNA düşüyor — sildiği şeyin
   * durduğu yere, ne sildiğini görebileceği listeye.
   */
  kayitlaraDon(
    kazanimTipininCapasi(kazanim.tip) ?? KAYITLAR_CAPASI,
    "durum=kazanim-silindi",
  );
}

/**
 * Var olan bir kaydın DÜZENLENMESİ (24 Ağustos 2026 · istek: "tıklayınca
 * sayfasına gidip düzenleyebilsin").
 *
 * Kayıt eklemenin aynası: aynı kural katmanından geçiyor
 * (`kazanimKabulEdilirMi`), yani biçim kontrolleri, alan düşürmeleri ve
 * bağlantı doğrulaması tek yerde. Ayrıldığı üç nokta:
 *
 *   1. TİP KAYDIN KENDİ SATIRINDAN okunur, formdan değil. Gizli bir alandan
 *      gelseydi isteği kurcalayan biri sertifikasını ürüne çevirip alan
 *      kurallarını atlatabilirdi.
 *   2. TARİH ALANI GÖNDERİLMEDİYSE (üründe sorulmuyor) kaydın MEVCUT tarihi
 *      korunur. Eklemedeki "bugün" davranışı burada uygulansaydı, yıllar önce
 *      girilmiş bir ürünün başlığını düzeltmek tarihini bugüne kaydırırdı.
 *   3. BAĞLANTILAR YENİDEN YAZILIR: form kaydın bütün satırlarını gönderiyor,
 *      dolayısıyla eskiler silinip yenileri sıralarıyla açılıyor. Tek tek
 *      eşleştirme, sıra değiştirmeyi ve satır silmeyi kapsamayan bir iş olurdu.
 */
export async function kazanimGuncelleEylemi(veri: FormData): Promise<void> {
  const kullanici = await oturumKullanicisiZorunlu();

  const kazanimId = Number.parseInt(String(veri.get("kazanimId") ?? ""), 10);
  if (!Number.isFinite(kazanimId)) throw new BulunamadiHatasi();

  // Sahiplik kontrolü: kullaniciId koşulu olmadan başkasının kaydı
  // düzenlenebilirdi.
  const mevcut = await prisma.kullaniciKazanim.findFirst({
    where: { id: kazanimId, kullaniciId: kullanici.id },
    select: {
      id: true,
      tip: true,
      tarih: true,
      markettePaylasilsin: true,
      marketOnayDurumu: true,
    },
  });
  if (!mevcut) throw new BulunamadiHatasi();

  const karar = kazanimKabulEdilirMi(
    {
      tip: mevcut.tip,
      baslik: String(veri.get("baslik") ?? ""),
      aciklama: String(veri.get("aciklama") ?? ""),
      tarih:
        veri.get("tarih") === null
          ? mevcut.tarih
          : gunBasi(String(veri.get("tarih") ?? "") || null),
      baglantiUrl: String(veri.get("baglantiUrl") ?? ""),
      derece: String(veri.get("derece") ?? ""),
      duzenleyen: String(veri.get("duzenleyen") ?? ""),
      katilimBicimi: String(veri.get("katilimBicimi") ?? ""),
      hedefKitle: String(veri.get("hedefKitle") ?? ""),
      gelistirenEkip: String(veri.get("gelistirenEkip") ?? ""),
      markettePaylasilsin: veri.get("markettePaylasilsin") === "evet",
      baglantilar: veri.getAll("baglantiAdres").map((adres, sira) => ({
        adres: String(adres),
        etiket: String(veri.getAll("baglantiEtiket")[sira] ?? ""),
      })),
    },
    { mevcutKayit: true },
  );
  if (!karar.olurMu) {
    redirect(
      kayitSayfasi(kazanimId, `hata=${encodeURIComponent(karar.neden)}`),
    );
  }

  /*
   * `temelEtkinlikProgramiId` YAZILMIYOR: form o alanı hiç sormuyor ve karar
   * katmanı seçim gelmediğinde null üretiyor. Alan güncellemeye girseydi,
   * katalogdaki programa bağlanmış eski bir kaydın bağlantısı ilk düzenlemede
   * sessizce kopardı.
   */
  const {
    temelEtkinlikProgramiId: _program,
    tip: _tip,
    ...alanlar
  } = karar.kayit;

  /*
   * DÜZENLENEN ÜRÜN ONAYI TAZELER (26 Ağustos 2026). Onay ürünün İÇERİĞİNE
   * verilir: başlığı, açıklaması ve bağlantıları değişen bir kayıt, merkezin
   * baktığı kayıt değildir. Tazelenmeseydi, onaydan geçen bir ürünün içeriği
   * sonradan sessizce değiştirilebilirdi.
   *
   * Yalnızca PAYLAŞIMDA olan üründe çalışır: paylaşmadığı ürününü düzenleyen
   * kişi kimseyi meşgul etmez, kuyruğa da girmez.
   */
  const onayTazelensin =
    mevcut.tip === "URUN" && alanlar.markettePaylasilsin === true;

  /*
   * Tazeleme de aynı kapıdan geçer: içeriği değişen ürün yeniden kuyruğa
   * girer, ama sahibi kararı zaten verebiliyorsa doğrudan yayımda kalır —
   * yoksa proje yöneticisi kendi ürününün bir yazım hatasını düzelttiğinde
   * ürünü vitrinden düşürüp kendi onayını beklemeye başlardı.
   */
  const onay = urunPaylasimOnayAlanlari({
    sahipKullaniciId: kullanici.id,
    kendiKararVerebilirMi: urunMarketOnayiVerebilirMi(kullanici),
    simdi: new Date(),
  });

  await prisma.$transaction([
    prisma.kazanimBaglanti.deleteMany({
      where: { kazanimId: mevcut.id },
    }),
    prisma.kullaniciKazanim.update({
      where: { id: mevcut.id },
      data: {
        ...alanlar,
        ...(onayTazelensin ? onay.alanlar : {}),
        baglantilar: { create: karar.baglantilar },
      },
    }),
  ]);

  /*
   * Yeni ürün görseli seçildiyse kapak onunla değişir; alan boş bırakıldıysa
   * mevcut kapak olduğu gibi kalır (bkz. urunKapaginiYaz).
   */
  const kapakUyarisi = await urunKapaginiYaz(veri, mevcut.id);

  /* Karar zaten bekliyorsa merkezi ikinci kez uyandırmaya gerek yok. */
  if (
    onayTazelensin &&
    onay.bildirimGerekliMi &&
    mevcut.marketOnayDurumu !== "BEKLIYOR"
  ) {
    await projeYoneticilerineBildir(BILDIRIM_KODLARI.ONAY_BEKLEYEN_URUN, {
      sahipAdSoyad: `${kullanici.ad} ${kullanici.soyad}`,
      urunAdi: karar.kayit.baslik,
    });
  }

  const sahip = ogrenciMi(kullanici) ? "OGRENCI" : "OGRETMEN";
  await erisimLogla({
    kullaniciId: kullanici.id,
    islem: "DEGISIKLIK",
    hedefTip: "PROFIL",
    hedefId: kullanici.id,
    detay: `Kazanım düzenlendi (${kazanimTipiTanimi(mevcut.tip, sahip).baslik}): ${karar.kayit.baslik}`,
  });

  kazanimYollariniTazele(kullanici);
  if (kapakUyarisi) {
    redirect(
      kayitSayfasi(
        mevcut.id,
        `hata=${encodeURIComponent(
          `Kayıt güncellendi ancak ürün görseli yüklenemedi — ${kapakUyarisi}`,
        )}`,
      ),
    );
  }
  redirect(kayitSayfasi(mevcut.id, "durum=kazanim-guncellendi"));
}

export async function cvYukleEylemi(veri: FormData): Promise<void> {
  const kullanici = await oturumKullanicisiZorunlu();

  const dosya = veri.get("cv");
  if (!(dosya instanceof File) || dosya.size === 0) {
    cvHatasi("CV dosyası seçilmedi.");
  }

  const sonuc = await cvKaydet({
    ogrenciId: kullanici.id,
    dosya,
    sinirlar: await cvSinirlariniGetir(),
    sahip: cvSahibi(kullanici),
  });
  if (!sonuc.olurMu) cvHatasi(sonuc.neden ?? "CV yüklenemedi.");

  await erisimLogla({
    kullaniciId: kullanici.id,
    islem: "DEGISIKLIK",
    hedefTip: "PROFIL",
    hedefId: kullanici.id,
    detay: `CV yüklendi: ${dosya.name}`,
  });

  cvYollariniTazele(kullanici);
  panele("cvm", "durum=cv-yuklendi");
}

/**
 * "Eklemek istedikleriniz" metnini kaydeder (31 Ağustos 2026 · istek: "CV
 * yükle bunu eklemek istedikleriniz yap … metin ekleme alanı olsun").
 *
 * DOSYA YÜKLEMEDEN AYRI EYLEM: tek formda olsalardı, dosya alanı zorunlu
 * olduğu için metnini düzeltmek isteyen kişi PDF'ini her seferinde yeniden
 * seçmek zorunda kalırdı. Gerekçenin tamamı lib/ogrenci/cv.ts'te.
 *
 * ERİŞİM KAYDINA METNİN KENDİSİ YAZILMIYOR, yalnızca güncellendiği: satır
 * kişinin kendi yazdığı serbest metin ve erişim kaydı ondan çok daha geniş bir
 * kitleye açık (aynı kural referans eklemede de var).
 */
export async function cvEkNotuKaydetEylemi(veri: FormData): Promise<void> {
  const kullanici = await oturumKullanicisiZorunlu();

  const sonuc = await cvEkNotuKaydet({
    kullaniciId: kullanici.id,
    metin: String(veri.get("ekNotu") ?? ""),
    sahip: cvSahibi(kullanici),
  });
  if (!sonuc.olurMu) cvHatasi(sonuc.neden ?? "Metin kaydedilemedi.");

  await erisimLogla({
    kullaniciId: kullanici.id,
    islem: "DEGISIKLIK",
    hedefTip: "PROFIL",
    hedefId: kullanici.id,
    detay: "Özgeçmişe eklenecek metin güncellendi",
  });

  cvYollariniTazele(kullanici);
  panele("cvm", "durum=cv-notu-kaydedildi");
}

export async function cvSilEylemi(): Promise<void> {
  const kullanici = await oturumKullanicisiZorunlu();

  const silindi = await cvSil(kullanici.id, cvSahibi(kullanici));
  if (!silindi) cvHatasi("Kaldırılacak bir CV bulunamadı.");

  await erisimLogla({
    kullaniciId: kullanici.id,
    islem: "SILME",
    hedefTip: "PROFIL",
    hedefId: kullanici.id,
    detay: "CV kaldırıldı",
  });

  cvYollariniTazele(kullanici);
  panele("cvm", "durum=cv-silindi");
}
