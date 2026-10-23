import type { Prisma } from "@/generated/prisma/client";
import type { AtamaTipi, KapanmaNedeni } from "@/generated/prisma/enums";
import { BILDIRIM_KODLARI, bildirimGonder, projeYoneticilerineBildir } from "../bildirim/gonder";
import { prisma } from "../db";
import { danismanAdayiFiltresi } from "../yetki/kapsam";
import { ATAMAYI_YALNIZCA_YONETICI_YAPAR } from "./politika";
import {
  type DanismanAdayi,
  devirKarariVer,
  ilkAtamaKarariVer,
  type IlkAtamaKarari,
} from "./karar";
import {
  bekleyenTalebimiGetir,
  type DanismanSecimSonucu,
  danismanSecimTalebiniYurut,
  sonKararliTalebimiGetir,
} from "./talep";

/**
 * Danışman atama işlemleri. Kararlar karar.ts'te üretilir; burada yalnızca
 * veritabanına uygulanır.
 *
 * ÖNEMLİ: danisman_atama bir GEÇMİŞ tablosudur. Devirde güncelleme yapılmaz;
 * eski kaydın bitişi yazılır, yeni kayıt açılır. Öğrencinin geçmiş danışmanı
 * raporlamada gerekecek.
 */

export async function danismanAdaylariGetir(
  kurumKodu: number,
  haricTutulanKullaniciId?: number,
): Promise<DanismanAdayi[]> {
  const adaylar = await prisma.kullanici.findMany({
    where: {
      AND: [
        danismanAdayiFiltresi(kurumKodu),
        haricTutulanKullaniciId !== undefined
          ? { id: { not: haricTutulanKullaniciId } }
          : {},
      ],
    },
    select: { id: true, ad: true, soyad: true, brans: true },
    orderBy: [{ ad: "asc" }, { soyad: "asc" }],
  });

  return adaylar.map((aday) => ({
    kullaniciId: aday.id,
    ad: aday.ad,
    soyad: aday.soyad,
    brans: aday.brans,
  }));
}

export async function ilKoordinatoruGetir(
  ilKodu: string | null,
): Promise<number | null> {
  if (!ilKodu) return null;

  const rol = await prisma.kullaniciRol.findFirst({
    where: { rolKodu: "IL_KOORDINATOR", ilKodu, bitisTarihi: null },
    select: { kullaniciId: true },
  });

  return rol?.kullaniciId ?? null;
}

export interface KoordinatorBilgisi {
  kullaniciId: number;
  ad: string;
  soyad: string;
  brans: string | null;
  eposta: string | null;
  telefon: string | null;
}

/**
 * İl koordinatörünün öğrenciye gösterilecek bilgileri.
 *
 * Okulunda danışman öğretmen olmayan öğrenci koordinatöre bağlanır ve bugüne
 * kadar bu kişiyi ekranda hiç görmüyordu. İletişim bilgisi öğretmenin kendi
 * girdiği alandır ve yalnızca ona BAĞLI öğrenciye gösterilir — koordinatörün
 * telefonu ilin tamamına açık bir bilgi değildir.
 */
export async function ilKoordinatoruBilgisiGetir(
  ilKodu: string | null,
): Promise<KoordinatorBilgisi | null> {
  const koordinatorId = await ilKoordinatoruGetir(ilKodu);
  if (koordinatorId === null) return null;

  const kayit = await prisma.kullanici.findUnique({
    where: { id: koordinatorId },
    select: {
      id: true,
      ad: true,
      soyad: true,
      brans: true,
      ogretmenProfil: { select: { eposta: true, telefon: true } },
    },
  });
  if (!kayit) return null;

  return {
    kullaniciId: kayit.id,
    ad: kayit.ad,
    soyad: kayit.soyad,
    brans: kayit.brans,
    eposta: kayit.ogretmenProfil?.eposta ?? null,
    telefon: kayit.ogretmenProfil?.telefon ?? null,
  };
}

export async function aktifAtamaGetir(ogrenciId: number) {
  return prisma.danismanAtama.findFirst({
    where: { ogrenciId, bitisTarihi: null },
    include: {
      danisman: {
        select: {
          id: true,
          ad: true,
          soyad: true,
          brans: true,
          kurumKodu: true,
          // Danışmanın kendi girdiği iletişim bilgisi; öğrenci danışmanına
          // ulaşabilmeli, kurum dışı kimse bu alanı görmüyor.
          ogretmenProfil: { select: { eposta: true, telefon: true } },
        },
      },
    },
  });
}

/**
 * Danışman seçim ekranının tüm verisi tek çağrıda.
 *
 * Panelim'deki bölüm ile `/panel/danisman-secim` kapısı AYNI kaynağı kullanır;
 * iki yerde ayrı sorgu yazılsaydı biri koordinatör bilgisini ya da aday
 * filtresini eksik kurabilirdi — ve o hata ekranda hata olarak değil, "okulumda
 * danışman yokmuş" gibi görünürdü.
 */
export async function danismanSecimVerisiGetir(kullanici: {
  id: number;
  kurumKodu: number | null;
  ilKodu: string | null;
}) {
  /*
   * BEKLEYEN TALEP VE SON RET DE BURADAN GELİYOR (20 Ağustos 2026). Ekran iki
   * yerde basılıyor ve ikisi de aynı veriyi göstermek zorunda; sorgu tek
   * yerde tutulmazsa biri "onay bekliyor" derken öbürü sessiz kalırdı.
   */
  const [atama, adaylar, koordinator, bekleyenTalep, sonKarar] =
    await Promise.all([
      aktifAtamaGetir(kullanici.id),
      kullanici.kurumKodu !== null
        ? danismanAdaylariGetir(kullanici.kurumKodu)
        : Promise.resolve([]),
      ilKoordinatoruBilgisiGetir(kullanici.ilKodu),
      bekleyenTalebimiGetir(kullanici.id),
      sonKararliTalebimiGetir(kullanici.id),
    ]);

  return {
    atama,
    adaylar,
    koordinator,
    bekleyenTalep,
    // Ekran yalnızca REDDİ basıyor: onayın karşılığı zaten "mevcut durum"
    // satırındaki yeni danışmanın kendisi.
    sonRet: sonKarar?.durum === "REDDEDILDI" ? sonKarar : null,
  };
}

interface AtamaGirdisi {
  ogrenciId: number;
  danismanKullaniciId: number;
  atamaTipi: AtamaTipi;
  /** Kapatılacak eski atamanın nedeni. */
  kapanmaNedeni?: KapanmaNedeni;
}

export interface AtamaSonucu {
  atamaId: number;
  /**
   * Danışman GERÇEKTEN değişti mi? Aynı kişi yeniden atandığında false döner
   * (ör. danışman öğretmen il koordinatörü olunca kendi öğrencilerini
   * koordinatör sıfatıyla devralır). Çağıran buna bakarak gereksiz "danışmanınız
   * değişti" bildirimi göndermez.
   */
  degistiMi: boolean;
  /**
   * Kapatılan atamanın danışmanı; ilk atamada null (11 Ağustos 2026).
   *
   * Bildirim için gerekiyor: öğrenci danışmanını değiştirdiğinde ESKİ
   * öğretmenin de haberi olmalı. Çağıran bunu işlemden sonra ayrıca
   * sorgulayamaz — o an kayıt çoktan kapanmıştır ve öğrencinin kapanmış
   * atamaları arasından "hangisi az önceydi" diye aramak yarış durumuna açık
   * bir tahmindir.
   */
  oncekiDanismanKullaniciId: number | null;
}

/**
 * Aktif atamayı kapatıp yenisini açar. Tek transaction içinde yürür; aksi
 * halde "bir öğrencinin tek aktif danışmanı olur" kısıtı eşzamanlı isteklerde
 * ihlal edilir (veritabanındaki kısmi unique index bunu zaten reddeder).
 */
export async function atamaDegistir(girdi: AtamaGirdisi): Promise<AtamaSonucu> {
  return prisma.$transaction(async (islem) => {
    const mevcut = await islem.danismanAtama.findFirst({
      where: { ogrenciId: girdi.ogrenciId, bitisTarihi: null },
      select: { id: true, danismanKullaniciId: true },
    });

    if (mevcut?.danismanKullaniciId === girdi.danismanKullaniciId) {
      return {
        atamaId: mevcut.id,
        degistiMi: false,
        oncekiDanismanKullaniciId: mevcut.danismanKullaniciId,
      };
    }

    if (mevcut) {
      await islem.danismanAtama.update({
        where: { id: mevcut.id },
        data: {
          bitisTarihi: new Date(),
          kapanmaNedeni: girdi.kapanmaNedeni ?? "DEVIR",
        },
      });
    }

    const yeni = await islem.danismanAtama.create({
      data: {
        ogrenciId: girdi.ogrenciId,
        danismanKullaniciId: girdi.danismanKullaniciId,
        atamaTipi: girdi.atamaTipi,
      },
      select: { id: true },
    });

    return {
      atamaId: yeni.id,
      degistiMi: true,
      oncekiDanismanKullaniciId: mevcut?.danismanKullaniciId ?? null,
    };
  });
}

/**
 * Öğrencinin son danışmanlığı ELLE mi sonlandırıldı?
 *
 * "Elle" = kararı bir insanın verdiği iki hâl: öğretmen gerekçeyle bıraktı
 * (DANISMANLIK_BIRAKILDI) ya da öğrenci kendisi bıraktı (OGRENCI_BIRAKTI).
 * Okul değişikliği, öğretmenin ayrılması, devir gibi OTOMATİK kapanmalar
 * bunun dışındadır — onlarda devir zinciri zaten yeni bir danışman buluyor.
 *
 * YALNIZCA EN SON KAPANAN KAYDA bakılır. Öğrencinin geçmişinde bir kez
 * bırakılmış olması, aradan geçen yeni bir atamadan sonra da otomatik atamayı
 * kapatsaydı, o öğrenci ömür boyu elle atanmak zorunda kalırdı.
 */
async function sonDanismanlikElleMiBirakildi(
  ogrenciId: number,
): Promise<boolean> {
  const sonKapanan = await prisma.danismanAtama.findFirst({
    where: { ogrenciId, bitisTarihi: { not: null } },
    orderBy: { bitisTarihi: "desc" },
    select: { kapanmaNedeni: true },
  });

  return (
    sonKapanan?.kapanmaNedeni === "DANISMANLIK_BIRAKILDI" ||
    sonKapanan?.kapanmaNedeni === "OGRENCI_BIRAKTI"
  );
}

/**
 * Öğrencinin ilk danışman atamasını yürütür. Karar "seçim gerekli" ise
 * veritabanına yazılmaz; öğrenciye seçim ekranı gösterilir.
 */
export async function ilkAtamayiYurut(
  ogrenciId: number,
): Promise<IlkAtamaKarari> {
  const ogrenci = await prisma.kullanici.findUniqueOrThrow({
    where: { id: ogrenciId },
    select: { id: true, ad: true, soyad: true, kurumKodu: true, ilKodu: true },
  });

  const mevcutAtama = await aktifAtamaGetir(ogrenciId);
  if (mevcutAtama) {
    return {
      tur: "OTOMATIK",
      danismanKullaniciId: mevcutAtama.danismanKullaniciId,
    };
  }

  const adaylar =
    ogrenci.kurumKodu !== null
      ? await danismanAdaylariGetir(ogrenci.kurumKodu)
      : [];
  const koordinatorId = await ilKoordinatoruGetir(ogrenci.ilKodu);
  /*
   * ELLE BIRAKILMIŞ ÖĞRENCİ OTOMATİK BAĞLANMAZ (11 Ağustos 2026). Bu fonksiyon
   * öğrencinin HER girişinde çalışıyor; kontrol olmadan, dün gerekçeyle
   * bırakılan öğrenci bugün aynı öğretmene geri bağlanıyordu.
   */
  const karar = ilkAtamaKarariVer(
    adaylar,
    koordinatorId,
    await sonDanismanlikElleMiBirakildi(ogrenciId),
  );

  switch (karar.tur) {
    case "OTOMATIK":
      await atamaDegistir({
        ogrenciId,
        danismanKullaniciId: karar.danismanKullaniciId,
        atamaTipi: "OTOMATIK",
      });
      break;

    case "IL_KOORDINATORUNE":
      await atamaDegistir({
        ogrenciId,
        danismanKullaniciId: karar.danismanKullaniciId,
        atamaTipi: "IL_KOORDINATOR_FALLBACK",
      });
      break;

    case "ATANAMADI":
      // Kenar durum: ilin koordinatörü yok ve okulda danışman yok.
      await projeYoneticilerineBildir(BILDIRIM_KODLARI.OGRENCI_ATANAMADI, {
        ogrenciAdSoyad: `${ogrenci.ad} ${ogrenci.soyad}`,
        ilKodu: ogrenci.ilKodu ?? "-",
      });
      break;

    case "SECIM_GEREKLI":
      // Öğrenci seçim yapana kadar atama oluşturulmaz.
      break;
  }

  return karar;
}

/**
 * Öğrencinin kendi danışmanını seçmesi — ilk seçim ve sonraki değişiklikler.
 *
 * ONAY GELDİ (20 Ağustos 2026 · istek: "danışman öğretmen seçiminde öğretmene
 * veya il koordinatörüne onay düşsün sürekli değişmek isteyebilirler").
 * Fonksiyon artık iki ayrı sonuç döndürebiliyor:
 *
 *   · İLK SEÇİM (öğrencinin danışmanı yok)  → atama HEMEN yapılır.
 *   · DEĞİŞİKLİK (aktif danışmanı var)      → TALEP açılır, atama beklemede.
 *
 * Ayrımın gerekçesi lib/danisman/talep.ts başlığında: onay beklerken
 * danışmansız kalan öğrenci Değişmez 2'yi çiğnerdi ve istek zaten
 * "değişmek"ten söz ediyor.
 *
 * Tek kısıt değişmedi: seçilen öğretmen AYNI KURUM KODUNDA ve danışmanlık için
 * işaretlenmiş olmalı — istemciden gelen kimliğe güvenilmez.
 *
 * Onaylanan değişiklik geçmiş tablosuna işlenir: eski kayıt OGRENCI_ISTEGI
 * nedeniyle kapanır, yeni kayıt OGRENCI_SECTI tipiyle açılır (bkz.
 * talep.ts · talebiOnayla).
 */
export async function ogrenciDanismanSecti(
  ogrenciId: number,
  secilenDanismanId: number,
): Promise<DanismanSecimSonucu> {
  const ogrenci = await prisma.kullanici.findUniqueOrThrow({
    where: { id: ogrenciId },
    select: { ad: true, soyad: true, sinif: true, kurumKodu: true },
  });

  if (ogrenci.kurumKodu === null) {
    throw new Error("Öğrencinin kurum kodu yok; danışman seçilemez.");
  }

  const uygunMu = await prisma.kullanici.findFirst({
    where: {
      AND: [danismanAdayiFiltresi(ogrenci.kurumKodu), { id: secilenDanismanId }],
    },
    select: { id: true },
  });

  if (!uygunMu) {
    throw new Error(
      "Seçilen öğretmen bu okulun danışman adayları arasında değil.",
    );
  }

  /*
   * ATAMA MI, TALEP Mİ? Karar öğrencinin O ANKİ durumuna bakıyor ve karar
   * kural dosyasında (talep.ts) veriliyor — iki ekran (panel bölümü ve seçim
   * kapısı) aynı eylemi çağırdığı için ayrımın tek yerde durması şart.
   */
  const mevcut = await aktifAtamaGetir(ogrenciId);
  const karar = await danismanSecimTalebiniYurut(
    ogrenciId,
    secilenDanismanId,
    mevcut?.danismanKullaniciId ?? null,
  );

  // Onaya giden, aynı kişiyi yeniden seçen ya da zaten bekleyen talebi olan
  // öğrencide atama tablosuna dokunulmaz.
  if (karar.tur !== "ATANDI") return karar;

  const sonuc = await atamaDegistir({
    ogrenciId,
    danismanKullaniciId: secilenDanismanId,
    atamaTipi: "OGRENCI_SECTI",
    kapanmaNedeni: "OGRENCI_ISTEGI",
  });

  // Aynı öğretmen yeniden seçildiyse (ekranda "Danışmanınız" yazan satıra
  // basılmışsa) kimseye haber gitmez: değişen bir şey yok.
  if (!sonuc.degistiMi) return karar;

  const ogrenciAdSoyad = `${ogrenci.ad} ${ogrenci.soyad}`;

  /*
   * SEÇİLEN ÖĞRETMENE HABER GİDER (11 Ağustos 2026 · soru: "öğrenci bir
   * öğretmeni danışman seçtiği zaman öğretmene bildirim gidiyor mu").
   *
   * Gitmiyordu: öğretmen kendi danışmanlığını ancak "Öğrencilerim" listesine
   * girip listenin uzadığını fark ederek öğreniyordu. Danışmanlık rızaya
   * dayanan bir bağ olduğu için (öğrenci seçer, onay aranmaz) haberin
   * öğretmene ulaşması bağın kurulduğu anın kendisidir.
   *
   * Sınıf bilgisi metne giriyor: aynı adı taşıyan iki öğrenci, kalabalık bir
   * okulda öğretmenin kimden bahsedildiğini anlayamayacağı tek durumdur.
   */
  await bildirimGonder({
    kullaniciId: secilenDanismanId,
    kod: BILDIRIM_KODLARI.OGRENCI_DANISMAN_SECTI,
    degiskenler: { ogrenciAdSoyad, sinif: ogrenci.sinif ?? "—" },
  });

  /*
   * ESKİ ÖĞRETMENE DE HABER GİDER. Sessiz kalınsaydı, öğretmen listesinden
   * düşen öğrenciyi kendi hatası sanabilirdi; üstelik bırakılan bağın haberi
   * yalnızca bırakan tarafa verilmez.
   */
  if (sonuc.oncekiDanismanKullaniciId !== null) {
    await danismanlikBittiBildirimi(
      sonuc.oncekiDanismanKullaniciId,
      ogrenciAdSoyad,
      "başka bir danışman öğretmen seçti",
    );
  }

  return karar;
}

/**
 * Danışmanlığı biten öğretmene giden haber.
 *
 * TEK YERDE: iki çağıranı var (öğrenci başkasını seçti / öğrenci bıraktı) ve
 * ikisi de aynı cümleyi kurar, yalnızca son eki değişir. Ayrı yazılsaydı biri
 * güncellenip öbürü unutulurdu.
 */
async function danismanlikBittiBildirimi(
  danismanKullaniciId: number,
  ogrenciAdSoyad: string,
  neOldu: string,
): Promise<void> {
  await bildirimGonder({
    kullaniciId: danismanKullaniciId,
    kod: BILDIRIM_KODLARI.OGRENCI_DANISMANLIKTAN_AYRILDI,
    degiskenler: { ogrenciAdSoyad, neOldu },
  });
}

/**
 * Öğrenci danışmanlığı KENDİSİ sonlandırır (11 Ağustos 2026 · istek: "öğrenci
 * danışman öğretmeni bırakacak butonu yok bırakabilsin").
 *
 * ÖĞRETMENİN BIRAKMASININ AYNASIDIR (bkz. tekOgrenciyiBirak): atama kapanır,
 * öğrenci DANIŞMANSIZ kalır, kimseye devredilmez. Yeni danışmanını istediği
 * zaman kendisi seçer; okulunda danışman öğretmen kalmadıysa öğretmenlerin
 * "Okulumdaki danışmansız öğrenciler" kartından da alınabilir.
 *
 * GEREKÇE İSTENMEZ — öğretmen tarafında istenirken. Fark, kararın kime ait
 * olduğu: öğretmenin bırakması başkası hakkında verilmiş bir karardır ve
 * "zor" bulunan öğrencinin sessizce bırakılması riskini taşır, o yüzden
 * gerekçe zorunlu ve koordinatöre bildirim gidiyor. Öğrencinin kararı ise
 * kendi hakkındadır; zaten danışmanını dilediği zaman gerekçesiz
 * değiştirebiliyor (bkz. ogrenciDanismanSecti) ve bırakmayı gerekçeye
 * bağlamak, aynı özgürlüğü yalnızca "hiçbirini istemiyorum" diyene kapatırdı.
 *
 * KOORDİNATÖRE BİLDİRİM GİTMEZ, aynı gerekçeyle. Danışmansız öğrenci zaten
 * koordinatörün ekranlarında görünür: listede "Atanmadı" rozeti ve "Yalnızca
 * danışmanı olmayanlar" süzgeci var.
 */
export async function ogrenciDanismaniniBirakti(
  ogrenciId: number,
): Promise<
  | { olurMu: false; neden: string }
  | { olurMu: true; eskiDanismanAdSoyad: string }
> {
  const atama = await prisma.danismanAtama.findFirst({
    where: { ogrenciId, bitisTarihi: null },
    select: {
      id: true,
      danismanKullaniciId: true,
      danisman: { select: { ad: true, soyad: true } },
      ogrenci: { select: { ad: true, soyad: true } },
    },
  });

  if (!atama) {
    return { olurMu: false, neden: "Açık bir danışmanlık kaydınız yok." };
  }

  /*
   * `updateMany` + `bitisTarihi: null` koşulu: aynı anda öğretmen de bırakmış
   * olabilir. `update`(id) o durumda kapanmış kaydın nedenini ikinci kez
   * yazar ve geçmiş, olmamış bir olayı anlatırdı.
   */
  await prisma.danismanAtama.updateMany({
    where: { id: atama.id, bitisTarihi: null },
    data: { bitisTarihi: new Date(), kapanmaNedeni: "OGRENCI_BIRAKTI" },
  });

  await danismanlikBittiBildirimi(
    atama.danismanKullaniciId,
    `${atama.ogrenci.ad} ${atama.ogrenci.soyad}`,
    "danışmanlığınızı sonlandırdı",
  );

  return {
    olurMu: true,
    eskiDanismanAdSoyad: `${atama.danisman.ad} ${atama.danisman.soyad}`,
  };
}

/**
 * Danışman öğretmen okuldan ayrıldığında (kurum kodu değişimi) veya
 * danışmanlığı bıraktığında öğrencilerinin devri.
 *
 * references/domain-rules.md Bölüm 3'teki tabloyu uygular.
 */
export async function danismanliktanAyrildi(
  danismanKullaniciId: number,
  eskiKurumKodu: number | null,
  kapanmaNedeni: KapanmaNedeni,
): Promise<{ devredilenOgrenciSayisi: number; yenidenSecimBekleyen: number }> {
  const atamalar = await prisma.danismanAtama.findMany({
    where: { danismanKullaniciId, bitisTarihi: null },
    select: {
      ogrenciId: true,
      ogrenci: { select: { ad: true, soyad: true, ilKodu: true, kurumKodu: true } },
    },
  });

  if (atamalar.length === 0) {
    return { devredilenOgrenciSayisi: 0, yenidenSecimBekleyen: 0 };
  }

  /*
   * ATAMAYI YÖNETİCİ YAPAR (23 Ekim 2026 · bkz. politika.ts): öğrenciler
   * kimseye devredilmez, il koordinatörüne de bağlanmaz. Atamalar kapanır,
   * öğrenciler danışmansız kalır ve proje yöneticisinin listesinde "Atanmadı"
   * olarak görünür; yeni danışmanı yönetici atar.
   */
  if (ATAMAYI_YALNIZCA_YONETICI_YAPAR) {
    await prisma.danismanAtama.updateMany({
      where: { danismanKullaniciId, bitisTarihi: null },
      data: { bitisTarihi: new Date(), kapanmaNedeni },
    });
    return { devredilenOgrenciSayisi: 0, yenidenSecimBekleyen: 0 };
  }

  let devredilen = 0;
  let yenidenSecimBekleyen = 0;

  for (const atama of atamalar) {
    const kurumKodu = atama.ogrenci.kurumKodu ?? eskiKurumKodu;
    const kalanAdaylar =
      kurumKodu !== null
        ? await danismanAdaylariGetir(kurumKodu, danismanKullaniciId)
        : [];
    const koordinatorId = await ilKoordinatoruGetir(atama.ogrenci.ilKodu);
    const karar = devirKarariVer(kalanAdaylar, koordinatorId);

    switch (karar.tur) {
      case "OTOMATIK_DEVIR": {
        const sonuc = await atamaDegistir({
          ogrenciId: atama.ogrenciId,
          danismanKullaniciId: karar.yeniDanismanKullaniciId,
          atamaTipi: "DEVIR",
          kapanmaNedeni,
        });
        if (sonuc.degistiMi) {
          await bildirimGonder({
            kullaniciId: atama.ogrenciId,
            kod: BILDIRIM_KODLARI.DANISMAN_DEGISTI,
          });
          devredilen += 1;
        }
        break;
      }

      case "YENIDEN_SECIM":
        // Seçim yapılana kadar geçici olarak il koordinatörüne bağlanır;
        // boşta öğrenci kalamaz.
        if (karar.geciciDanismanKullaniciId !== null) {
          await atamaDegistir({
            ogrenciId: atama.ogrenciId,
            danismanKullaniciId: karar.geciciDanismanKullaniciId,
            atamaTipi: "IL_KOORDINATOR_FALLBACK",
            kapanmaNedeni,
          });
        }
        await bildirimGonder({
          kullaniciId: atama.ogrenciId,
          kod: BILDIRIM_KODLARI.DANISMAN_YENIDEN_SECIM,
        });
        yenidenSecimBekleyen += 1;
        break;

      case "IL_KOORDINATORUNE": {
        const sonuc = await atamaDegistir({
          ogrenciId: atama.ogrenciId,
          danismanKullaniciId: karar.yeniDanismanKullaniciId,
          atamaTipi: "IL_KOORDINATOR_FALLBACK",
          kapanmaNedeni,
        });
        if (sonuc.degistiMi) {
          await bildirimGonder({
            kullaniciId: atama.ogrenciId,
            kod: BILDIRIM_KODLARI.DANISMAN_DEGISTI,
          });
          devredilen += 1;
        }
        break;
      }

      case "ATANAMADI":
        await projeYoneticilerineBildir(BILDIRIM_KODLARI.OGRENCI_ATANAMADI, {
          ogrenciAdSoyad: `${atama.ogrenci.ad} ${atama.ogrenci.soyad}`,
          ilKodu: atama.ogrenci.ilKodu ?? "-",
        });
        break;
    }
  }

  return { devredilenOgrenciSayisi: devredilen, yenidenSecimBekleyen };
}

/**
 * TEK bir öğrencinin danışmanlığı bırakılır.
 *
 * `danismanliktan Ayrildi` görevin TAMAMINI bırakmayı yürütür; bu ise tek
 * öğrenciyi bırakır ve öğretmenin danışmanlığı sürer.
 *
 * KİM ÇAĞIRIR: danışmanın kendisi ya da — 10 Ağustos 2026'dan beri — öğrencinin
 * kapsamındaki il koordinatörü/proje yöneticisi (istek: "öğretmen öğrenciyi
 * bırakabilsin, gerekirse koordinatör de bırakabilsin"). `danismanKullaniciId`
 * her iki durumda da BIRAKILAN ATAMANIN DANIŞMANIDIR, isteği yapan kişi değil;
 * kimin isteyebileceği kararı çağıran katmanda verilir (bkz.
 * ogrenciler/[id]/eylemler.ts) çünkü burası veriyi değiştiren yer, yetki
 * soran yer değil.
 *
 * ÖĞRENCİ NEREYE GİDER: HİÇBİR YERE — danışmansız kalır ve yeni danışmanını
 * kendisi seçer. Gerekçesi aşağıda, gövdedeki uzun notta.
 *
 * GEREKÇE ZORUNLU ve il koordinatörüne BİLDİRİM gider: burada açık bir kötüye
 * kullanım kapısı var — "zor" bulunan öğrencinin sessizce bırakılması. Gerekçe
 * hem bildirime hem erişim kaydına yazılır.
 */
export async function tekOgrenciyiBirak(girdi: {
  danismanKullaniciId: number;
  ogrenciId: number;
  gerekce: string;
}): Promise<
  | { olurMu: false; neden: string }
  | { olurMu: true; yeniDurum: string; ogrenciAdSoyad: string }
> {
  /*
   * Atama, VERİLEN DANIŞMANA bağlı olarak çekilir: sorguda
   * `danismanKullaniciId` koşulu olmasaydı, forma başkasının öğrenci kimliğini
   * yazan öğretmen o öğrencinin danışmanlığını bırakabilirdi. Öğretmen kendi
   * kimliğini geçirir; koordinatör, öğrencinin o an bağlı olduğu danışmanı.
   */
  const atama = await prisma.danismanAtama.findFirst({
    where: {
      ogrenciId: girdi.ogrenciId,
      danismanKullaniciId: girdi.danismanKullaniciId,
      bitisTarihi: null,
    },
    select: {
      ogrenci: {
        select: { id: true, ad: true, soyad: true, ilKodu: true, kurumKodu: true },
      },
    },
  });
  if (!atama) {
    return {
      olurMu: false,
      neden: "Bu öğrencinin açık bir danışmanlık kaydı bulunamadı.",
    };
  }

  const ogrenci = atama.ogrenci;
  const ogrenciAdSoyad = `${ogrenci.ad} ${ogrenci.soyad}`;

  const kalanAdaylar =
    ogrenci.kurumKodu !== null
      ? await danismanAdaylariGetir(ogrenci.kurumKodu, girdi.danismanKullaniciId)
      : [];
  const koordinatorId = await ilKoordinatoruGetir(ogrenci.ilKodu);
  const karar = devirKarariVer(kalanAdaylar, koordinatorId);

  /*
   * ÖĞRENCİ KİMSEYE DEVREDİLMEZ (10 Ağustos 2026 · istek: "Öğrenci boşta
   * kalmaz — okulunda başka danışman öğretmen varsa ona devredilir… öğrenciyi
   * bırakırken böyle yazıyor, gerekirse herkes bıraksın demiştik").
   *
   * ESKİDEN: bırakılan öğrenci `devirKarariVer` ile anında başka bir
   * öğretmene ya da il koordinatörüne bağlanıyordu; devredilecek kimse yoksa
   * bırakma HİÇ YAPILMIYORDU. İkisi de yanlıştı:
   *   · Zorla devir, öğrenciyi istemeyen bir öğretmenin kucağına bırakıyordu.
   *     Danışmanlık rızaya dayanır — "danışmanı öğrenci seçer" kuralının
   *     tamamı bunun üzerine kurulu.
   *   · Bırakmanın engellenmesi, öğretmeni yürümeyen bir bağda tutuyordu.
   *
   * ŞİMDİ: atama kapanır ve öğrenci DANIŞMANSIZ kalır. Boşlukta kalmaz,
   * görünür olur — öğrenci listelerinde "Atanmadı" rozeti, "Yalnızca danışmanı
   * olmayanlar" süzgeci ve öğretmenlerin "Okulumdaki danışmansız öğrenciler"
   * kartı zaten var; öğrenci kendi ekranından yeni danışmanını seçebiliyor
   * (bkz. ogrenciDanismanSecti) ve ilin koordinatörüne gerekçeli bildirim
   * gidiyor.
   *
   * Bu, SKILL.md · Değişmezler 2'ye ("boşta öğrenci kalamaz") bilinçli bir
   * istisnadır: değişmez OTOMATİK akışlar için geçerli (ilk atama, öğretmenin
   * okuldan ayrılması, rolün kaldırılması) — oralarda devir zinciri olduğu
   * gibi duruyor. Elle ve gerekçeli bırakma artık bunun dışında.
   */
  await prisma.danismanAtama.updateMany({
    where: {
      ogrenciId: ogrenci.id,
      danismanKullaniciId: girdi.danismanKullaniciId,
      bitisTarihi: null,
    },
    data: { bitisTarihi: new Date(), kapanmaNedeni: "DANISMANLIK_BIRAKILDI" },
  });

  /*
   * Öğrenciye "yeniden seç" bildirimi gider, "danışmanın değişti" değil:
   * yeni bir danışmanı YOK ve yapması gereken bir şey var.
   */
  // Atamayı yönetici yaparken öğrencinin seçeceği bir şey yok; "yeniden seç"
  // bildirimi yanıltırdı (bkz. politika.ts).
  if (!ATAMAYI_YALNIZCA_YONETICI_YAPAR) {
    await bildirimGonder({
      kullaniciId: ogrenci.id,
      kod: BILDIRIM_KODLARI.DANISMAN_YENIDEN_SECIM,
    });
  }

  const yeniDurum = ATAMAYI_YALNIZCA_YONETICI_YAPAR
    ? "Öğrenci danışmansız kaldı; yeni danışmanını proje yöneticisi atar."
    : "Öğrenci danışmansız kaldı; okulundaki danışman öğretmenlerden birini kendisi seçebilir ya da bir öğretmen danışmanlığına alabilir.";

  return { olurMu: true, yeniDurum, ogrenciAdSoyad };
}

/**
 * İl koordinatörü boşaldığında ona bağlı öğrencilerin atamalarını kapatır.
 *
 * Öğrenciler yeni bir danışmana devredilmez, bilinçli olarak "atanmamış"
 * kalırlar: okulları zaten danışmansız olduğu için (koordinatöre o yüzden
 * bağlanmışlardı) bağlanacak kimse yoktur. Bu durum proje yöneticisine
 * Rol/Atama Envanteri ekranında kırmızı uyarı olarak düşer ve yeni koordinatör
 * atandığı anda `sahipsizOgrencileriKoordinatoreBagla` ile kendiliğinden
 * çözülür.
 */
export async function koordinatorunOgrencileriniBosaAl(
  koordinatorKullaniciId: number,
): Promise<number> {
  const sonuc = await prisma.danismanAtama.updateMany({
    where: { danismanKullaniciId: koordinatorKullaniciId, bitisTarihi: null },
    data: { bitisTarihi: new Date(), kapanmaNedeni: "OGRETMEN_AYRILDI" },
  });
  return sonuc.count;
}

/**
 * İl koordinatörü atandığında o ildeki atanmamış öğrencileri ona bağlar.
 *
 * Ayrı bir onay adımı YOKTUR: koordinatör boşluğu yüzünden atamasız kalmış
 * öğrenciler, koordinatör gelir gelmez otomatik bağlanır. (Okula sonradan
 * danışman gelmesi durumu bundan farklıdır ve onay ister — bkz.
 * `yeniDanismanBildirimiYap`.)
 */
export async function sahipsizOgrencileriKoordinatoreBagla(
  ilKodu: string,
  koordinatorKullaniciId: number,
): Promise<number> {
  // Atamayı yalnızca proje yöneticisi yapar (bkz. politika.ts).
  if (ATAMAYI_YALNIZCA_YONETICI_YAPAR) return 0;

  const sahipsizler = await prisma.kullanici.findMany({
    where: {
      ilKodu,
      aktif: true,
      roller: { some: { rolKodu: "OGRENCI", bitisTarihi: null } },
      ogrenciAtamalari: { none: { bitisTarihi: null } },
      // Koordinatörün kendisi öğrenci olamaz ama kısıt (ck_danisman_atama_
      // farkli_kisi) ihlal edilmesin diye yine de dışarıda bırakılır.
      id: { not: koordinatorKullaniciId },
    },
    select: { id: true },
  });

  for (const ogrenci of sahipsizler) {
    await atamaDegistir({
      ogrenciId: ogrenci.id,
      danismanKullaniciId: koordinatorKullaniciId,
      atamaTipi: "IL_KOORDINATOR_FALLBACK",
    });
    await bildirimGonder({
      kullaniciId: ogrenci.id,
      kod: BILDIRIM_KODLARI.DANISMAN_DEGISTI,
    });
  }

  return sahipsizler.length;
}

/**
 * Okula yeni danışman geldiğinde il koordinatörüne haber verilir. Öğrenciler
 * OTOMATİK DEVREDİLMEZ; devri koordinatör onaylar.
 */
export async function yeniDanismanBildirimiYap(
  kurumKodu: number,
): Promise<void> {
  // Koordinatöre "devredebilirsin" haberi gitmez: devri artık o yapmıyor.
  if (ATAMAYI_YALNIZCA_YONETICI_YAPAR) return;

  const kurum = await prisma.kurum.findUnique({
    where: { kurumKodu },
    select: { ad: true, ilKodu: true },
  });
  if (!kurum) return;

  const koordinatorId = await ilKoordinatoruGetir(kurum.ilKodu);
  if (koordinatorId === null) return;

  // Koordinatöre bağlı, o okuldaki öğrenciler devredilebilir.
  const devredilebilirSayisi = await prisma.danismanAtama.count({
    where: {
      danismanKullaniciId: koordinatorId,
      bitisTarihi: null,
      ogrenci: { kurumKodu },
    },
  });

  if (devredilebilirSayisi === 0) return;

  await bildirimGonder({
    kullaniciId: koordinatorId,
    kod: BILDIRIM_KODLARI.KOORDINATOR_DEVREDILEBILIR_OGRENCI,
    degiskenler: {
      okulAdi: kurum.ad,
      ogrenciSayisi: String(devredilebilirSayisi),
    },
  });
}

/**
 * Proje yöneticisinin danışman ataması (23 Ekim 2026 · istek: "atamayı
 * yönetici yapsın"; bkz. politika.ts).
 *
 * İL GENELİNDE (23 Ekim 2026 · istek: "öğrenci ve öğretmen aynı okulun ismini
 * aynı girmemiş olabilir … o kısım soru işareti"). Danışman, öğrencinin
 * İLİNDEKİ danışman öğretmenlerden biri olabilir. Okul uyumu bir öneri olarak
 * ekranda gösterilir (bkz. lib/okul/benzerlik.ts) ama atamayı engellemez:
 * elle yazılmış okul adları aynı okulu farklı kayıtlarda tutabiliyor.
 * Öğrencinin danışmana görünmesi okuldan bağımsızdır (bkz. yetki/kapsam.ts).
 *
 * Yetki burada SORULMAZ; çağıran eylem proje yöneticisini denetler (bkz.
 * ogrenciler/[id]/eylemler.ts).
 */
export async function yoneticiDanismanAta(
  ogrenciId: number,
  danismanKullaniciId: number,
): Promise<{ olurMu: false; neden: string } | { olurMu: true; degistiMi: boolean }> {
  const ogrenci = await prisma.kullanici.findFirst({
    where: {
      id: ogrenciId,
      aktif: true,
      roller: { some: { rolKodu: "OGRENCI", bitisTarihi: null } },
    },
    select: { ad: true, soyad: true, ilKodu: true, kurum: { select: { ilKodu: true } } },
  });
  if (!ogrenci) return { olurMu: false, neden: "Öğrenci bulunamadı." };
  const ogrenciIli = ogrenci.kurum?.ilKodu ?? ogrenci.ilKodu;
  if (!ogrenciIli) {
    return { olurMu: false, neden: "Öğrencinin ili kayıtlı değil." };
  }

  const uygun = await prisma.kullanici.findFirst({
    where: { AND: [ilDanismaniFiltresi(ogrenciIli), { id: danismanKullaniciId }] },
    select: { id: true },
  });
  if (!uygun) {
    return {
      olurMu: false,
      neden: "Seçilen öğretmen öğrencinin ilindeki danışman öğretmenlerden değil.",
    };
  }

  const sonuc = await atamaDegistir({
    ogrenciId,
    danismanKullaniciId,
    atamaTipi: "YONETICI_ATADI",
    kapanmaNedeni: "DEVIR",
  });
  if (!sonuc.degistiMi) return { olurMu: true, degistiMi: false };

  await bildirimGonder({
    kullaniciId: ogrenciId,
    kod: BILDIRIM_KODLARI.DANISMAN_DEGISTI,
  });
  if (sonuc.oncekiDanismanKullaniciId !== null) {
    await danismanlikBittiBildirimi(
      sonuc.oncekiDanismanKullaniciId,
      `${ogrenci.ad} ${ogrenci.soyad}`,
      "proje yöneticisi tarafından başka bir danışman öğretmene atandı",
    );
  }
  return { olurMu: true, degistiMi: true };
}

/**
 * Bir ilin danışman öğretmenleri: etkin, danışman rolü açık, il koordinatörü
 * olmayan öğretmenler. Okulu ilde olan ya da kendi ili bu il olanlar.
 */
function ilDanismaniFiltresi(ilKodu: string): Prisma.KullaniciWhereInput {
  return {
    aktif: true,
    roller: { some: { rolKodu: "DANISMAN", bitisTarihi: null } },
    NOT: { roller: { some: { rolKodu: "IL_KOORDINATOR", bitisTarihi: null } } },
    OR: [{ kurum: { ilKodu } }, { ilKodu }],
  };
}

export interface IlDanismani {
  kullaniciId: number;
  ad: string;
  soyad: string;
  brans: string | null;
  kurumKodu: number | null;
  /** Listedeki okulun adı ya da öğretmenin elle yazdığı ad. */
  okulAdi: string | null;
  /** Şu an danışmanlığındaki öğrenci sayısı. */
  ogrenciSayisi: number;
}

/**
 * Toplu atama ekranının öğretmen listesi (23 Ekim 2026 · istek: "yönetim
 * panelinde toplu atama olsun"). Az öğrencisi olan önce: "boştaki
 * öğretmen" sorusunun cevabı listenin tepesinde.
 */
export async function ildekiDanismanlar(ilKodu: string): Promise<IlDanismani[]> {
  const satirlar = await prisma.kullanici.findMany({
    where: ilDanismaniFiltresi(ilKodu),
    select: {
      id: true,
      ad: true,
      soyad: true,
      brans: true,
      kurumKodu: true,
      beyanOkulAdi: true,
      kurum: { select: { ad: true } },
      _count: { select: { danismanAtamalari: { where: { bitisTarihi: null } } } },
    },
  });
  return satirlar
    .map((s) => ({
      kullaniciId: s.id,
      ad: s.ad,
      soyad: s.soyad,
      brans: s.brans,
      kurumKodu: s.kurumKodu,
      okulAdi: s.kurum?.ad ?? s.beyanOkulAdi,
      ogrenciSayisi: s._count.danismanAtamalari,
    }))
    .sort(
      (a, b) =>
        a.ogrenciSayisi - b.ogrenciSayisi ||
        `${a.ad} ${a.soyad}`.localeCompare(`${b.ad} ${b.soyad}`, "tr"),
    );
}
