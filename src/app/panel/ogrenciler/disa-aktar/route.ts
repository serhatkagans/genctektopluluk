import { oturumKullanicisi } from "@/lib/auth/oturum";
import {
  AYAR_ANAHTARLARI,
  ayarSayi,
  VARSAYILAN_DISA_AKTARMA_UST_SINIRI,
} from "@/lib/ayar";
import { prisma } from "@/lib/db";
import { BILISIM_YOLCULUGU_TIPLERI } from "@/lib/kazanim/kurallar";
import {
  altBaslikYaz,
  bicimCoz,
  disaAktarmaYaniti,
} from "@/lib/rapor/disa-aktarma";
import type { XlsxSutun } from "@/lib/rapor/xlsx";
import { gorevRolAdi } from "@/lib/yetki/etiketler";
import {
  ogrenciEnvanteriGorebilirMi,
  projeYoneticisiMi,
} from "@/lib/yetki/izinler";
import { ogrenciListeFiltresi } from "@/lib/yetki/kapsam";
import { erisimLoglaCoklu } from "@/lib/yetki/log";
import { ogrenciFiltreleriniCoz, type SorguParametreleri } from "../filtreler";

export const dynamic = "force-dynamic";

/**
 * Öğrenci envanterinin dosya çıktısı (varsayılan XLSX, `?bicim=csv` ile CSV).
 *
 * Dosya, ekranda görünen listenin AYNISIDIR: aynı kapsam filtresinden ve aynı
 * ekran filtrelerinden geçer, aynı sütunları taşır.
 *
 * Tek fark sayfalamanın olmaması; onun yerine bir satır sınırı var.
 *
 * E-POSTA VE TELEFON YALNIZCA PROJE YÖNETİCİSİNDE (9 Kasım 2026 · istek:
 * "proje yönetici için … excel ve csv için eposta ve telefon bilgileri de
 * gelsin"). Bilgi öğrenci detay ekranında zaten aynı kapsamda görünüyor; yeni
 * olan, bütün listenin TEK DOSYADA toplanması. Öğrencilerin çoğu 18 yaş altı
 * olduğu için toplu iletişim dökümü merkezle sınırlı tutuldu — koordinatöre
 * açılacaksa ayrı bir karar olarak açılmalı.
 *
 * OKUL ELLE YAZILMIŞSA O AD BASILIR (aynı gün · istek: "çocukların girdiği
 * ilçe ve okul isimleri boş geliyor"). Kayıtlı okul listesi boş olduğu için
 * herkes okulunu elle yazdı ve "Okul" sütunu yalnızca kayıtlı okuldan
 * dolduğundan bütün dosyada boştu. Kurum kodu sütunu boş kalır: elle yazılan
 * adın kodu yoktur.
 */

const SUTUNLAR: readonly (XlsxSutun & { yalnizcaMerkez?: boolean })[] = [
  { baslik: "Ad", genislik: 18 },
  { baslik: "Soyad", genislik: 18 },
  { baslik: "Sınıf", genislik: 10 },
  { baslik: "Eğitim-öğretim yılı", genislik: 16 },
  { baslik: "Okul", genislik: 38 },
  { baslik: "Okul türü", genislik: 26 },
  { baslik: "Kurum kodu", genislik: 12 },
  { baslik: "İl", genislik: 14 },
  { baslik: "İlçe", genislik: 16 },
  { baslik: "Danışman", genislik: 22 },
  { baslik: "E-posta", genislik: 30, yalnizcaMerkez: true },
  { baslik: "Telefon", genislik: 16, yalnizcaMerkez: true },
  /*
    TEMSİLCİLİK SÜTUNLARI (27 Ağustos 2026 · istek: "excele şu sütundaki
    verileri de ekleyelim · İl temsilcisi · İlçe temsilcisi · Okul
    temsilcisi").

    ÜÇ AYRI SÜTUN, TEK "GÖREVLER" SÜTUNU DEĞİL: ekranda da üç ayrı sütun ve
    dosyayı açan kişi genellikle tek bir göreve göre süzüyor ("il
    temsilcilerini ayıkla"). Tek hücrede virgülle birleştirilseydi süzme
    yapılamazdı.

    HÜCRE "Evet" DEĞİL, GÖREVİN YERİNİ YAZIYOR (ekrandaki `gorevRolAdi` ile
    aynı kaynak): "Manisa" bilgisi öğrencinin güncel ilinden değil GÖREV
    KAYDININ kapsamından geliyor — öğrenci dönem içinde taşınsa da görev
    verildiği yerde kalır.
  */
  { baslik: "İl temsilcisi", genislik: 20 },
  { baslik: "İlçe temsilcisi", genislik: 20 },
  { baslik: "Okul temsilcisi", genislik: 28 },
  { baslik: "Çalışma grupları", genislik: 34 },
  { baslik: "Deneyimler", genislik: 50 },
];

export async function GET(istek: Request) {
  const kullanici = await oturumKullanicisi();
  if (!kullanici) {
    return new Response("Bulunamadı", { status: 404 });
  }

  // Ekranın kapısı burada da aynen uygulanır: indirme yolu, ekranda kapalı
  // olan bir listeye arka kapı olamaz (11 Ağustos 2026 · ekran öğrenciden
  // fazlasını eliyor, bkz. ogrenciEnvanteriGorebilirMi).
  if (!ogrenciEnvanteriGorebilirMi(kullanici)) {
    return new Response("Bulunamadı", { status: 404 });
  }
  const iletisimDahil = projeYoneticisiMi(kullanici);

  const adres = new URL(istek.url);
  const parametreler: SorguParametreleri = Object.fromEntries(
    adres.searchParams.entries(),
  );
  const nerede = ogrenciListeFiltresi(
    kullanici,
    ogrenciFiltreleriniCoz(parametreler),
  );

  const [toplam, ustSinir] = await Promise.all([
    prisma.kullanici.count({ where: nerede }),
    ayarSayi(
      AYAR_ANAHTARLARI.DISA_AKTARMA_UST_SINIRI,
      VARSAYILAN_DISA_AKTARMA_UST_SINIRI,
    ),
  ]);

  /*
   * Sınır aşıldığında liste kırpılmaz, indirme reddedilir. Sessizce kırpmak,
   * eksik olduğu belli olmayan bir rapor üretirdi — sayıları toplayan kişi
   * eksiği fark edemez.
   */
  if (toplam > ustSinir) {
    return new Response(
      `Bu filtrelerle ${toplam} kayıt var; tek dosyada en fazla ${ustSinir} kayıt indirilebilir. ` +
        "Lütfen il, okul veya sınıf filtresiyle daraltın.",
      { status: 413, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  }

  const ogrenciler = await prisma.kullanici.findMany({
    where: nerede,
    select: {
      id: true,
      ad: true,
      soyad: true,
      sinif: true,
      egitimOgretimYili: true,
      kurumKodu: true,
      kurum: { select: { ad: true, okulTuru: true } },
      beyanOkulAdi: true,
      beyanOkulTuru: true,
      ogrenciProfil: { select: { eposta: true, telefon: true } },
      il: { select: { ad: true } },
      ilce: { select: { ad: true } },
      calismaGruplari: {
        select: { calismaGrubu: { select: { ad: true } } },
      },
      /*
        GÖREV KAYITLARI: ekrandaki temsilcilik sütunlarıyla AYNI kaynak ve aynı
        dönem kıyası (öğrencinin kendi `egitimOgretimYili` alanıyla, bakan
        kişinin yılıyla değil — bkz. ogrenciler/page.tsx). Kapsam adları da
        seçiliyor çünkü hücre "Evet" değil yerin adını yazıyor.
      */
      gorevRolleri: {
        select: {
          rolKodu: true,
          egitimOgretimYili: true,
          il: { select: { ad: true } },
          ilce: { select: { ad: true } },
          kurum: { select: { ad: true } },
          calismaGrubuId: true,
          calismaGrubu: { select: { ad: true } },
        },
      },
      /*
       * DENEYİMLER (Aşama 8): GençTek DIŞINDA kazanılanlar. GençTek etkinlik
       * katılımı buraya girmiyor — o zaten sistemin kendi kaydından geliyor ve
       * dosyada tekrar edilmesi "aynı veriyi iki kez saklama" olurdu.
       */
      kazanimlar: {
        where: { tip: { in: [...BILISIM_YOLCULUGU_TIPLERI] } },
        orderBy: { tarih: "desc" },
        select: { baslik: true },
      },
      ogrenciAtamalari: {
        where: { bitisTarihi: null },
        select: { danisman: { select: { ad: true, soyad: true } } },
      },
    },
    orderBy: [{ ad: "asc" }, { soyad: "asc" }],
  });

  /*
   * Dışa aktarma da kayıt bazında loglanır ve detayında biçim geçer: veri bu
   * yolla kurum dışına çıkabildiği için, denetimde ekranda bakılan kayıtla
   * indirilen kaydı ayırt edebilmek gerekir.
   */
  const bicim = bicimCoz(adres);

  await erisimLoglaCoklu(
    ogrenciler.map((ogrenci) => ({
      kullaniciId: kullanici.id,
      islem: "GORUNTULEME" as const,
      hedefTip: "OGRENCI" as const,
      hedefId: ogrenci.id,
      detay:
        `Öğrenci listesi ${bicim.toUpperCase()} olarak dışa aktarıldı` +
        (iletisimDahil ? " (e-posta ve telefon dahil)" : ""),
    })),
  );

  const satirlar = ogrenciler.map((ogrenci) => {
    const danisman = ogrenci.ogrenciAtamalari[0]?.danisman;
    /* Yalnızca öğrencinin İÇİNDE BULUNDUĞU dönemin görevleri; geçmiş dönem
       görevleri dosyada "bu yıl temsilci" gibi okunurdu. */
    const gorevler = ogrenci.gorevRolleri.filter(
      (gorev) => gorev.egitimOgretimYili === ogrenci.egitimOgretimYili,
    );
    const temsilcilik = (rolKodu: string) => {
      const gorev = gorevler.find((kayit) => kayit.rolKodu === rolKodu);
      return gorev ? gorevRolAdi(gorev) : "";
    };
    const satir = [
      ogrenci.ad,
      ogrenci.soyad,
      ogrenci.sinif ?? "",
      ogrenci.egitimOgretimYili,
      ogrenci.kurum?.ad ?? ogrenci.beyanOkulAdi ?? "",
      ogrenci.kurum?.okulTuru ?? ogrenci.beyanOkulTuru ?? "",
      // Kurum kodu KİMLİKTİR, sayı değil: metin kalsın ki Excel onu
      // hesaplanabilir bir değere çevirmesin (bkz. lib/rapor/xlsx.ts).
      ogrenci.kurumKodu === null ? "" : String(ogrenci.kurumKodu),
      ogrenci.il?.ad ?? "",
      ogrenci.ilce?.ad ?? "",
      danisman ? `${danisman.ad} ${danisman.soyad}` : "Atanmadı",
      ogrenci.ogrenciProfil?.eposta ?? "",
      ogrenci.ogrenciProfil?.telefon ?? "",
      temsilcilik("IL_TEMSILCISI"),
      temsilcilik("ILCE_TEMSILCISI"),
      temsilcilik("OKUL_TEMSILCISI"),
      ogrenci.calismaGruplari
        .map((secim) => secim.calismaGrubu.ad)
        .join(", "),
      ogrenci.kazanimlar.map((kazanim) => kazanim.baslik).join(", "),
    ];
    // Merkez dışındakilerde iletişim sütunları satırdan da düşer.
    return satir.filter((_, sira) => iletisimDahil || !SUTUNLAR[sira].yalnizcaMerkez);
  });

  return disaAktarmaYaniti({
    bicim,
    dosyaAdi: "genctek-ogrenciler",
    baslik: "GençTek Ekosistemi",
    altBaslik: altBaslikYaz("Öğrenci envanteri", satirlar.length),
    sutunlar: SUTUNLAR.filter((sutun) => iletisimDahil || !sutun.yalnizcaMerkez).map(
      ({ baslik, genislik }) => ({ baslik, genislik }),
    ),
    satirlar,
  });
}
