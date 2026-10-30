"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { oturumKullanicisiZorunlu } from "@/lib/auth/oturum";
import { prisma } from "@/lib/db";
import {
  profilFotoKaydet,
  profilFotoSil,
  profilFotoSinirlariniGetir,
} from "@/lib/kullanici/profil-foto";
import {
  destekGruplariniAyikla,
  disProfiliDogrula,
} from "@/lib/dis-kimlik/profil-kurallar";
import { saltOkunurAlanlariAyikla } from "@/lib/kullanici/salt-okunur";
import { baglantilariDogrula } from "@/lib/ogrenci/iletisim-kurallar";
import {
  genelBilgileriKaydet,
  genelBilgilerDuzenlenebilirMi,
  genelBilgilerTipi,
} from "@/lib/ogrenci/genel-bilgiler";
import {
  danismanBilgisiCoz,
  genelBilgileriCoz,
} from "@/lib/ogrenci/genel-bilgiler-kurallar";
import { danismanlikDurumunuDegistir } from "@/lib/ogretmen/danismanlik";
import { erisimLogla } from "@/lib/yetki/log";
import { disKullaniciMi, ogrenciMi } from "@/lib/yetki/izinler";
import { YetkiHatasi } from "@/lib/yetki/tipler";

/**
 * Kişinin kendi düzenleyebileceği alanlar. Diğer her şey salt okunurdur.
 *
 * Liste role göre değişmez: iletişim bilgisi kimlik bilgisi değildir, e-Okul'dan
 * gelmez ve kim olursa olsun sahibi tarafından girilir. Rol farkı yalnızca
 * bilginin hangi profil tablosuna yazıldığındadır — kurum/görev/açıklama
 * alanları yalnızca dış kullanıcıya sorulduğu için öğretmende sessizce düşer.
 */
const IZINLI_ALANLAR = [
  "eposta",
  "telefon",
  "githubUrl",
  "kisiselSiteUrl",
  "linkedinUrl",
  // Instagram 26 Ağustos 2026'da eklendi ve aynı gün bağlantı kutuları
  // öğretmene/koordinatöre de açıldı (bkz. ProfilDuzenleme · baglantiSorulsun).
  "instagramUrl",
  // Dış kullanıcının kendi yazdığı kurum, görev ve katkı açıklaması
  // (7 Ağustos 2026). İl, ad ve soyad BU LİSTEDE DEĞİL: onlar başvurudan gelen
  // kimlik bilgileridir ve kişi değiştiremez.
  "kurumAdi",
  "gorevUnvani",
  "aciklama",
] as const;

/**
 * Formların yaşadığı ekran — dönüş adresi.
 *
 * TEK EKRAN (20 Ağustos 2026 · panel-profil birleşmesi): yazılan bilgi de
 * onu yazan form da burada. Ayrı bir "gösterim yüzeyi" tazelemesi kalktı;
 * `/panel/profil` artık yalnızca buraya yönlendiren bir adres.
 */
const YOL = "/panel";

function yollariTazele(): void {
  revalidatePath(YOL);
}

/**
 * Panelim'e, ilgili bölüm AÇIK olarak döner.
 *
 * `bolum` parametresi ÇIPADAN AYRI ve ikisi de gerekli: bölümler katlanabilir
 * `<details>` öğeleri ve kapalı bir öğenin çapasına inmek kullanıcıyı boş bir
 * başlığa götürürdü — az önce doldurduğu form gözden kaybolurdu. Sayfa
 * `bolum` değerine bakıp o bölümü açık basıyor, çapa da oraya kaydırıyor.
 */
function panele(capa: string, sorgu: string): never {
  yollariTazele();
  redirect(`${YOL}?bolum=${capa}&${sorgu}#${capa}`);
}

export async function profilGuncelleEylemi(veri: FormData): Promise<void> {
  const kullanici = await oturumKullanicisiZorunlu();

  const gelenVeri = Object.fromEntries(veri.entries());
  delete gelenVeri.$ACTION_ID;

  const { temizVeri, yoksayilanAlanlar } = saltOkunurAlanlariAyikla<{
    eposta: string;
    telefon: string;
    githubUrl: string;
    kisiselSiteUrl: string;
    linkedinUrl: string;
    instagramUrl: string;
    kurumAdi: string;
    gorevUnvani: string;
    aciklama: string;
  }>(gelenVeri, IZINLI_ALANLAR);

  // Salt okunur alanlar istekte gelirse sessizce yok sayılır, hata
  // döndürülmez — ama loglanır (references/permissions.md Bölüm 7).
  if (yoksayilanAlanlar.length > 0) {
    await erisimLogla({
      kullaniciId: kullanici.id,
      islem: "DEGISIKLIK",
      hedefTip: "PROFIL",
      hedefId: kullanici.id,
      detay: `Salt okunur alanlar yok sayıldı: ${yoksayilanAlanlar.join(", ")}`,
    });
  }

  const iletisim = {
    eposta: temizVeri.eposta?.trim() || null,
    telefon: temizVeri.telefon?.trim() || null,
  };

  /*
   * İki ayrı profil tablosu var çünkü öğrenci ve personel profilleri farklı
   * alanlar taşıyor (biri aydınlatma onayı, diğeri danışmanlık işareti).
   * Yazılan bilgi aynı olduğu için ayrım yalnızca burada yapılır.
   */
  if (ogrenciMi(kullanici)) {
    const karar = baglantilariDogrula({
      githubUrl: temizVeri.githubUrl,
      kisiselSiteUrl: temizVeri.kisiselSiteUrl,
      linkedinUrl: temizVeri.linkedinUrl,
      instagramUrl: temizVeri.instagramUrl,
    });
    if (!karar.olurMu) {
      panele(
        "iletisim-bilgilerim",
        `hata=${encodeURIComponent(karar.neden)}`,
      );
    }

    const ogrenciVerisi = { ...iletisim, ...karar.baglantilar };
    await prisma.ogrenciProfil.upsert({
      where: { kullaniciId: kullanici.id },
      update: ogrenciVerisi,
      create: { kullaniciId: kullanici.id, ...ogrenciVerisi },
    });
  } else if (disKullaniciMi(kullanici)) {
    /*
     * DIŞ KULLANICI: iletişimin yanında bağlantılar, kurum, görev ve katkı
     * açıklaması da yazılır (7 Ağustos 2026).
     *
     * Öğretmenden ayrı dal, alan listesi farklı olduğu için: öğretmene bu
     * alanlar sorulmuyor ve formu gelmeyen alanları boş string olarak
     * göndermediği için tek dalda birleştirmek, öğretmenin (hiç görmediği)
     * kurum alanını her kayıtta null'lardı.
     */
    const karar = baglantilariDogrula({
      githubUrl: temizVeri.githubUrl,
      kisiselSiteUrl: temizVeri.kisiselSiteUrl,
      linkedinUrl: temizVeri.linkedinUrl,
      instagramUrl: temizVeri.instagramUrl,
    });
    if (!karar.olurMu) {
      panele("iletisim-bilgilerim", `hata=${encodeURIComponent(karar.neden)}`);
    }

    const profilKarari = disProfiliDogrula({
      kurumAdi: temizVeri.kurumAdi ?? "",
      gorevUnvani: temizVeri.gorevUnvani ?? "",
      aciklama: temizVeri.aciklama ?? "",
    });
    if (!profilKarari.olurMu) {
      panele(
        "iletisim-bilgilerim",
        `hata=${encodeURIComponent(profilKarari.neden)}`,
      );
    }

    const disVeri = {
      ...iletisim,
      ...karar.baglantilar,
      ...profilKarari.degerler,
    };
    await prisma.ogretmenProfil.upsert({
      where: { kullaniciId: kullanici.id },
      update: disVeri,
      create: { kullaniciId: kullanici.id, ...disVeri },
    });
  } else {
    /*
     * ÖĞRETMEN VE KOORDİNATÖR ARTIK BAĞLANTI DA YAZIYOR (26 Ağustos 2026 ·
     * istek: "öğrenci ve öğretmenlerin iletişim bilgileri alanına da ekleyelim
     * instagram linkedin"). Sütunlar `ogretmen_profil`de zaten vardı, yalnızca
     * bu dal onları yok sayıyordu.
     *
     * DIŞ KULLANICI DALIYLA BİRLEŞTİRİLMEDİ: oradaki fark bağlantılar değil,
     * kurum/görev/açıklama alanları — o form bu role hiç basılmıyor ve tek
     * dalda toplansaydı öğretmenin her kaydında o üç sütun null'lanırdı
     * (dalın kendi notuna bakın).
     */
    const karar = baglantilariDogrula({
      githubUrl: temizVeri.githubUrl,
      kisiselSiteUrl: temizVeri.kisiselSiteUrl,
      linkedinUrl: temizVeri.linkedinUrl,
      instagramUrl: temizVeri.instagramUrl,
    });
    if (!karar.olurMu) {
      panele("iletisim-bilgilerim", `hata=${encodeURIComponent(karar.neden)}`);
    }

    const personelVerisi = { ...iletisim, ...karar.baglantilar };
    await prisma.ogretmenProfil.upsert({
      where: { kullaniciId: kullanici.id },
      update: personelVerisi,
      create: { kullaniciId: kullanici.id, ...personelVerisi },
    });
  }

  /*
   * VARSAYILAN ADRES PROFİLDEKİDİR (30 Ekim 2026 · istek: "sonradan eklediyse
   * de varsayılan eposta adresi bu olsun"). Yönetimden kayıt kimliğine
   * yazılmış adres de aynı değere çekilir: kişi adresini değiştirir ya da
   * silerse eski adres geri planda kalıp şifre sıfırlama bağlantısını
   * almaya devam etmesin. Kayıt kimliği yoksa (EBA, dış kullanıcı) bu satır
   * hiçbir şey yapmaz.
   */
  await prisma.kayitKimlik.updateMany({
    where: { kullaniciId: kullanici.id },
    data: { eposta: iletisim.eposta },
  });

  await erisimLogla({
    kullaniciId: kullanici.id,
    islem: "DEGISIKLIK",
    hedefTip: ogrenciMi(kullanici) ? "PROFIL" : "OGRETMEN",
    hedefId: kullanici.id,
    detay: "İletişim bilgileri güncellendi",
  });

  panele("iletisim-bilgilerim", "durum=iletisim-kaydedildi");
}

/**
 * "Çalışma Grupları" — katkı verebileceği alanların seçimi (7 Ağustos 2026).
 *
 * Yalnızca dış kullanıcıya açık: öğrencinin çalışma grubu seçimi ayrı bir
 * tabloda ve ayrı bir anlamda (hangi grupta çalışıyor), öğretmenin karşılığı
 * ise mentörlük kaydıdır. Kapı burada kapalı tutuluyor ki form elle
 * gönderildiğinde başka bir rol bu tabloya satır açamasın.
 *
 * SEÇİM TOPLUCA YAZILIR: gelmeyen her grup silinir. Fark hesaplamak yerine
 * "önce sil, sonra yaz" seçildi çünkü kayıt kişi başına en fazla grup sayısı
 * kadar satır ve işlem tek transaction içinde.
 */
export async function destekGruplariEylemi(veri: FormData): Promise<void> {
  const kullanici = await oturumKullanicisiZorunlu();
  if (!disKullaniciMi(kullanici)) {
    throw new YetkiHatasi("Çalışma grubu katkı seçimi bu hesap için açık değil.");
  }

  const gecerliGruplar = await prisma.calismaGrubu.findMany({
    where: { aktif: true },
    select: { id: true },
  });

  const secilenler = destekGruplariniAyikla(
    veri.getAll("calismaGrubuId").map((deger) => String(deger)),
    gecerliGruplar.map((grup) => grup.id),
  );

  await prisma.$transaction([
    prisma.kullaniciDestekGrubu.deleteMany({
      where: { kullaniciId: kullanici.id },
    }),
    prisma.kullaniciDestekGrubu.createMany({
      data: secilenler.map((calismaGrubuId) => ({
        kullaniciId: kullanici.id,
        calismaGrubuId,
      })),
    }),
  ]);

  await erisimLogla({
    kullaniciId: kullanici.id,
    islem: "DEGISIKLIK",
    hedefTip: "PROFIL",
    hedefId: kullanici.id,
    detay: `Katkı verilebilecek çalışma grupları güncellendi (${secilenler.length} grup)`,
  });

  panele("katki-alanlarim", "durum=destek-gruplari-kaydedildi");
}

export async function danismanlikEylemi(veri: FormData): Promise<void> {
  const kullanici = await oturumKullanicisiZorunlu();
  const gorevAlmakIstiyor = veri.get("gorevAlmakIstiyor") === "evet";

  await danismanlikDurumunuDegistir(kullanici.id, gorevAlmakIstiyor);

  /*
   * YÖNLENDİRME YOK — bilerek. Kullanıcı zaten Panelim'de ve `revalidatePath`
   * sonrası Next sayfayı eylem yanıtında yeniden üretiyor; gezinme olmadığı
   * için kaydırma konumu da bozulmuyor. Rol değiştiği için düzen de
   * tazeleniyor: menü ve şerit rol bilgisine bakıyor.
   */
  revalidatePath("/panel", "layout");
  yollariTazele();
}

// ---------------------------------------------------------------------------
// Profil fotoğrafı
// ---------------------------------------------------------------------------

/*
 * Rol kontrolü YOKTUR ve olmamalıdır: fotoğraf herkesin — öğrenci, öğretmen,
 * il koordinatörü, YEĞİTEK personeli. Kazanım ve CV eylemlerindeki
 * `ogrenciZorunlu()` kapısının buradaki karşılığı, işlemin her zaman
 * `kullanici.id` üzerinde çalışmasıdır: hedef kimlik hiçbir yerde form
 * girdisinden okunmaz, dolayısıyla kimse başkasının fotoğrafını değiştiremez.
 */

export async function profilFotoYukleEylemi(veri: FormData): Promise<void> {
  const kullanici = await oturumKullanicisiZorunlu();

  const dosya = veri.get("foto");
  if (!(dosya instanceof File) || dosya.size === 0) {
    panele("fotografim", `hata=${encodeURIComponent("Fotoğraf seçilmedi.")}`);
  }

  const sonuc = await profilFotoKaydet({
    kullaniciId: kullanici.id,
    dosya,
    sinirlar: await profilFotoSinirlariniGetir(),
  });
  if (!sonuc.olurMu) {
    redirect(
      `${YOL}?hata=${encodeURIComponent(sonuc.neden ?? "Fotoğraf yüklenemedi.")}`,
    );
  }

  await erisimLogla({
    kullaniciId: kullanici.id,
    islem: "DEGISIKLIK",
    hedefTip: "PROFIL",
    hedefId: kullanici.id,
    detay: "Profil fotoğrafı yüklendi",
  });

  panele("fotografim", "durum=foto-yuklendi");
}

export async function profilFotoSilEylemi(): Promise<void> {
  const kullanici = await oturumKullanicisiZorunlu();

  const silindi = await profilFotoSil(kullanici.id);
  if (!silindi) {
    redirect(
      `${YOL}?hata=${encodeURIComponent("Kaldırılacak bir fotoğraf bulunamadı.")}`,
    );
  }

  await erisimLogla({
    kullaniciId: kullanici.id,
    islem: "SILME",
    hedefTip: "PROFIL",
    hedefId: kullanici.id,
    detay: "Profil fotoğrafı kaldırıldı",
  });

  panele("fotografim", "durum=foto-silindi");
}

// ---------------------------------------------------------------------------
// Öğrencinin genel bilgileri ve danışman öğretmen beyanı (23 Ekim 2026)
// ---------------------------------------------------------------------------

export async function genelBilgilerEylemi(veri: FormData): Promise<void> {
  const kullanici = await oturumKullanicisiZorunlu();
  const tip = genelBilgilerTipi(kullanici);
  if (tip === null || !genelBilgilerDuzenlenebilirMi()) {
    throw new YetkiHatasi("Genel bilgiler bu hesap için düzenlenemez.");
  }

  const metin = (alan: string) => String(veri.get(alan) ?? "");
  const karar = genelBilgileriCoz(
    {
    ad: metin("ad"),
    soyad: metin("soyad"),
    cinsiyet: metin("cinsiyet"),
    ilKodu: metin("ilKodu"),
    ilceKodu: metin("ilceKodu"),
    okulTuru: metin("okulTuru"),
    kurumKodu: metin("kurumKodu"),
    beyanOkulAdi: metin("beyanOkulAdi"),
    sinifSeviyesi: metin("sinifSeviyesi"),
    sube: metin("sube"),
    brans: metin("brans"),
    },
    tip,
  );
  if (!karar.olurMu) {
    panele("genel-bilgiler", `hata=${encodeURIComponent(karar.neden)}`);
  }

  const sonuc = await genelBilgileriKaydet(kullanici.id, karar.bilgiler, tip);
  if (sonuc.durum === "BASARISIZ") {
    panele("genel-bilgiler", `hata=${encodeURIComponent(sonuc.mesaj)}`);
  }

  panele("genel-bilgiler", "durum=genel-bilgiler-kaydedildi");
}

/**
 * İl seçilince formun ilçe ve okul listelerini getirir. Okul listesi kayıt
 * ekranında da herkese açık; yine de oturum istenir, çünkü bu eylem yalnızca
 * panelden çağrılıyor.
 */
export async function ilOkulVerisiGetir(ilKodu: string): Promise<{
  ilceler: { ilceKodu: string; ad: string }[];
  okullar: { kurumKodu: number; ad: string; okulTuru: string; ilceKodu: string }[];
}> {
  await oturumKullanicisiZorunlu();
  if (!/^\d{2}$/.test(ilKodu)) return { ilceler: [], okullar: [] };

  const [ilceler, okullar] = await Promise.all([
    prisma.ilce.findMany({
      where: { ilKodu },
      select: { ilceKodu: true, ad: true },
      orderBy: { ad: "asc" },
    }),
    prisma.kurum.findMany({
      where: { ilKodu, aktif: true },
      select: { kurumKodu: true, ad: true, okulTuru: true, ilceKodu: true },
      orderBy: { ad: "asc" },
    }),
  ]);
  return { ilceler, okullar };
}

export async function danismanBilgisiEylemi(veri: FormData): Promise<void> {
  const kullanici = await oturumKullanicisiZorunlu();
  if (!ogrenciMi(kullanici)) {
    throw new YetkiHatasi("Danışman öğretmen bilgisi yalnızca öğrenciye açık.");
  }

  const metin = (alan: string) => String(veri.get(alan) ?? "");
  const karar = danismanBilgisiCoz({
    ad: metin("danismanAd"),
    soyad: metin("danismanSoyad"),
    brans: metin("danismanBrans"),
    telefon: metin("danismanTelefon"),
    eposta: metin("danismanEposta"),
  });
  if (!karar.olurMu) {
    panele(
      "danisman-ogretmen-bilgileri",
      `hata=${encodeURIComponent(karar.neden)}`,
    );
  }

  await prisma.ogrenciProfil.upsert({
    where: { kullaniciId: kullanici.id },
    update: karar.bilgi,
    create: { kullaniciId: kullanici.id, ...karar.bilgi },
  });

  await erisimLogla({
    kullaniciId: kullanici.id,
    islem: "DEGISIKLIK",
    hedefTip: "PROFIL",
    hedefId: kullanici.id,
    detay: "Danışman öğretmen bilgisi güncellendi",
  });

  panele("danisman-ogretmen-bilgileri", "durum=danisman-bilgisi-kaydedildi");
}
