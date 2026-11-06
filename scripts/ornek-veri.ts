import "dotenv/config";
import { uretimdeDur } from "./uretim-kilidi";
import { ILLER } from "../prisma/veri/iller";
import type { AuthKimlik } from "@/lib/auth/tipler";
import {
  ilkAtamayiYurut,
  danismanAdaylariGetir,
  ogrenciDanismanSecti,
} from "@/lib/danisman/atama";
import { prisma } from "@/lib/db";
import { kullaniciSagla } from "@/lib/kullanici/sagla";
import { danismanlikDurumunuDegistir } from "@/lib/ogretmen/danismanlik";

uretimdeDur("npm run veri:ornek");

/**
 * Örnek envanter üreteci — sistemi gerçekçi hacimde doldurur.
 *
 * Kullanıcılar veritabanına ELLE YAZILMAZ: gerçek sağlama (kullaniciSagla),
 * danışmanlık işaretleme ve ilk atama akışları çağrılır. Böylece üretilen veri,
 * uygulamanın kendi kurallarıyla tutarlı olur — danışmanı olmayan öğrenci il
 * koordinatörüne düşer, koordinatörü de olmayan il için proje yöneticisine
 * uyarı gider.
 *
 * Kullanım:
 *   npm run veri:ornek                  varsayılan (50/50/300)
 *   npm run veri:ornek -- --ogrenci=100
 *   npm run veri:ornek -- --temizle     yalnızca üretilenleri siler
 *
 * Üretilen kayıtlar `uretilen-` önekli authProviderId taşır; mock katalogdaki
 * senaryo kullanıcılarına dokunulmaz. Script yeniden çalıştırılabilir: aynı
 * tohumla aynı kişiler üretilir, kullaniciSagla var olanı günceller.
 */

const ONEK = "uretilen-";
const EGITIM_OGRETIM_YILI = "2025-2026";

// ---------------------------------------------------------------------------
// Tohumlanmış rastgelelik — aynı tohum aynı veriyi üretir (yeniden
// çalıştırılabilirlik için şart).
// ---------------------------------------------------------------------------

function rastgeleUretici(tohum: number) {
  let durum = tohum >>> 0;
  return () => {
    durum = (durum + 0x6d2b79f5) >>> 0;
    let t = durum;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rast = rastgeleUretici(20260729);
const sec = <T,>(dizi: readonly T[]): T =>
  dizi[Math.floor(rast() * dizi.length)];
const arasinda = (en: number, boy: number) =>
  en + Math.floor(rast() * (boy - en + 1));

// ---------------------------------------------------------------------------
// Ad havuzları
// ---------------------------------------------------------------------------

const ERKEK_ADLARI = [
  "Ahmet", "Mehmet", "Mustafa", "Ali", "Hüseyin", "Emre", "Burak", "Kerem",
  "Yusuf", "Berk", "Tolga", "Serkan", "Murat", "Onur", "Cem", "Baran",
  "Eren", "Kaan", "Umut", "Deniz", "Arda", "Efe", "Doruk", "Sinan",
];

const KADIN_ADLARI = [
  "Ayşe", "Fatma", "Zeynep", "Elif", "Merve", "Selin", "Aylin", "Sevil",
  "Ceren", "Duygu", "Ebru", "Gamze", "Hande", "İpek", "Melis", "Nazlı",
  "Pınar", "Seda", "Tuğçe", "Yasemin", "Buse", "Dilara", "Esra", "Nehir",
];

const SOYADLAR = [
  "Yılmaz", "Kaya", "Demir", "Şahin", "Çelik", "Yıldız", "Yıldırım", "Öztürk",
  "Aydın", "Özdemir", "Arslan", "Doğan", "Kılıç", "Aslan", "Çetin", "Kara",
  "Koç", "Kurt", "Özkan", "Şimşek", "Polat", "Korkmaz", "Erdoğan", "Tekin",
  "Aksoy", "Bulut", "Güneş", "Ergin", "Sarı", "Turan",
];

const BRANSLAR = [
  "Bilişim Teknolojileri", "Matematik", "Fizik", "Kimya", "Biyoloji",
  "Fen Bilimleri", "Türk Dili ve Edebiyatı", "İngilizce", "Teknoloji ve Tasarım",
  "Görsel Sanatlar", "Coğrafya", "Rehberlik",
];

const OKUL_TURLERI = [
  "Anadolu Lisesi",
  "Fen Lisesi",
  "Mesleki ve Teknik Anadolu Lisesi",
  "Sosyal Bilimler Lisesi",
  "Bilim ve Sanat Merkezi",
  "Anadolu İmam Hatip Lisesi",
];

const ILCE_ADLARI = [
  "Merkez", "Cumhuriyet", "Yenişehir", "Bahçelievler", "Fatih", "Atatürk",
  "Gazi", "Yıldırım", "Karşıyaka", "Şehitkamil",
];

const SUBELER = ["A", "B", "C", "D"];

function kisiUret(cinsiyet: "E" | "K") {
  const ad = cinsiyet === "E" ? sec(ERKEK_ADLARI) : sec(KADIN_ADLARI);
  return { ad, soyad: sec(SOYADLAR), cinsiyet };
}

function numarala(sira: number, genislik = 3): string {
  return String(sira).padStart(genislik, "0");
}

// ---------------------------------------------------------------------------
// Argümanlar
// ---------------------------------------------------------------------------

function argSayi(ad: string, varsayilan: number): number {
  const arg = process.argv.find((a) => a.startsWith(`--${ad}=`));
  if (!arg) return varsayilan;
  const deger = Number.parseInt(arg.split("=")[1], 10);
  return Number.isFinite(deger) && deger >= 0 ? deger : varsayilan;
}

const AYAR = {
  koordinatorSayisi: argSayi("koordinator", 50),
  ogretmenSayisi: argSayi("ogretmen", 50),
  ogrenciSayisi: argSayi("ogrenci", 300),
  temizle: process.argv.includes("--temizle"),
};

// ---------------------------------------------------------------------------
// Temizlik
// ---------------------------------------------------------------------------

/**
 * Üretilen kullanıcıları ve onlara bağlı kayıtları siler. Silme sırası yabancı
 * anahtarları izler; mock katalogdaki senaryo kullanıcılarına dokunulmaz.
 */
async function uretilenleriSil() {
  const kullanicilar = await prisma.kullanici.findMany({
    where: { authProviderId: { startsWith: ONEK } },
    select: { id: true },
  });
  const idler = kullanicilar.map((k) => k.id);
  if (idler.length === 0) {
    console.log("Silinecek üretilmiş kullanıcı yok.");
    return;
  }

  await prisma.basvuru.deleteMany({
    where: {
      OR: [
        { katilimciId: { in: idler } },
        { degerlendirenKullaniciId: { in: idler } },
      ],
    },
  });
  await prisma.yorum.deleteMany({
    where: {
      OR: [
        { yazanKullaniciId: { in: idler } },
        { silenKullaniciId: { in: idler } },
      ],
    },
  });
  // Kapak görseli faaliyetten eke işaret ettiği için önce bağ koparılır.
  await prisma.faaliyet.updateMany({
    where: { duzenleyenKullaniciId: { in: idler } },
    data: { kapakEkId: null },
  });
  await prisma.faaliyetEk.deleteMany({
    where: {
      OR: [
        { yukleyenKullaniciId: { in: idler } },
        { silenKullaniciId: { in: idler } },
      ],
    },
  });
  await prisma.faaliyet.deleteMany({
    where: {
      OR: [
        { duzenleyenKullaniciId: { in: idler } },
        { onaylayanKullaniciId: { in: idler } },
      ],
    },
  });
  await prisma.ogrenciGorevRolu.deleteMany({
    where: {
      OR: [{ ogrenciId: { in: idler } }, { atayanKullaniciId: { in: idler } }],
    },
  });
  await prisma.kullaniciKazanim.deleteMany({
    where: { kullaniciId: { in: idler } },
  });
  await prisma.danismanAtama.deleteMany({
    where: {
      OR: [
        { ogrenciId: { in: idler } },
        { danismanKullaniciId: { in: idler } },
      ],
    },
  });
  await prisma.bildirim.deleteMany({ where: { kullaniciId: { in: idler } } });
  await prisma.erisimlogu.deleteMany({ where: { kullaniciId: { in: idler } } });
  await prisma.ogrenciCalismaGrubu.deleteMany({
    where: { ogrenciId: { in: idler } },
  });
  await prisma.kullaniciRol.deleteMany({
    where: {
      OR: [{ kullaniciId: { in: idler } }, { atayanKullaniciId: { in: idler } }],
    },
  });
  await prisma.ogrenciProfil.deleteMany({ where: { kullaniciId: { in: idler } } });
  await prisma.ogretmenProfil.deleteMany({ where: { kullaniciId: { in: idler } } });
  await prisma.kullanici.deleteMany({ where: { id: { in: idler } } });

  /*
   * Üretilen referans veri: okullar 800000'den başlayan kurum kodlarıyla,
   * ilçeler "90" ile biten kodlarla ayrışır (örnek ilçeler 3401/0601 gibi
   * kodlar taşır, çakışmaz). Okullar önce silinir; ilçeye bağlı kurum
   * kalmamalı.
   */
  await prisma.kurum.deleteMany({ where: { kurumKodu: { gte: 800000 } } });
  await prisma.ilce.deleteMany({ where: { ilceKodu: { endsWith: "90" } } });

  console.log(`${idler.length} üretilmiş kullanıcı ve bağlı kayıtları silindi.`);
}

// ---------------------------------------------------------------------------
// Referans veri: ilçe ve okul
// ---------------------------------------------------------------------------

interface Okul {
  kurumKodu: number;
  ad: string;
  ilKodu: string;
  ilceKodu: string;
}

/**
 * Seçilen iller için ilçe ve okul üretir.
 *
 * Gerçek MEB verisi geldiğinde bu adım kullanılmaz; referans tabloları o
 * kaynaktan yüklenir. Buradaki kayıtlar yalnızca örnek envanterin bağlanacağı
 * asgari kümedir ve 800000'den başlayan kurum kodlarıyla ayrışır.
 */
async function referansVeriUret(iller: { ilKodu: string; ad: string }[]) {
  const okullar: Okul[] = [];
  let kurumKodu = 800000;

  for (const il of iller) {
    // İlçe kodu il koduyla başlar; 90+ aralığı örnek veriyi mevcut
    // ilçelerden (3401, 0601 …) ayırır.
    const ilceKodu = `${il.ilKodu}90`;
    await prisma.ilce.upsert({
      where: { ilceKodu },
      update: { ad: `${sec(ILCE_ADLARI)}`, ilKodu: il.ilKodu },
      create: { ilceKodu, ilKodu: il.ilKodu, ad: sec(ILCE_ADLARI) },
    });

    /*
     * OKUL ADINDA " (2)" SONEKİ YOK (27 Ağustos 2026 · istek: "kafa
     * karıştırıcı o kısmı kaldırsak").
     *
     * Sonek AD ÇAKIŞMASINI DEĞİL, DÖNGÜ SIRASINI yazıyordu: ikinci okul,
     * türü birinciden farklı olsa bile "(2)" alıyordu. Sonuç, 55 okulun
     * 42'sinde hiçbir şey anlatmayan bir sayı ("Ağrı Bilim ve Sanat Merkezi"
     * ile "Ağrı Anadolu İmam Hatip Lisesi (2)") ve ekranda "bu 2 ne" sorusuydu.
     *
     * ÇAKIŞMA ARTIK OLUŞMUYOR, sonekle örtülmüyor: ikinci okulun türü
     * birinciyle aynı çıkarsa listedeki bir SONRAKİ tür alınıyor. Düzeltme
     * fazladan rastgele sayı ÇEKMİYOR — tohumlanmış dizi kaymasın diye
     * (dosya başlığı: "aynı tohum aynı veriyi üretir"), yoksa okul adlarını
     * düzeltmek bütün öğrenci ve öğretmen kayıtlarını da yeniden dağıtırdı.
     */
    const ilinTurleri: string[] = [];
    for (let i = 0; i < 2; i += 1) {
      kurumKodu += 1;
      const cekilen = sec(OKUL_TURLERI);
      const okulTuru = ilinTurleri.includes(cekilen)
        ? OKUL_TURLERI[
            (OKUL_TURLERI.indexOf(cekilen) + 1) % OKUL_TURLERI.length
          ]
        : cekilen;
      ilinTurleri.push(okulTuru);
      const ad = `${il.ad} ${okulTuru}`;
      await prisma.kurum.upsert({
        where: { kurumKodu },
        update: { ad, ilKodu: il.ilKodu, ilceKodu, okulTuru, aktif: true },
        create: { kurumKodu, ad, ilKodu: il.ilKodu, ilceKodu, okulTuru },
      });
      okullar.push({ kurumKodu, ad, ilKodu: il.ilKodu, ilceKodu });
    }
  }

  return okullar;
}

// ---------------------------------------------------------------------------
// Üretim
// ---------------------------------------------------------------------------

async function main() {
  if (AYAR.temizle) {
    await uretilenleriSil();
    return;
  }

  console.log("Örnek envanter üretiliyor...\n");

  /*
   * İl seçimi: koordinatör atanacak iller ile atanmayacak iller ayrı tutulur.
   * Koordinatörsüz il bilinçli bırakılır — "okulunda danışman yok, ilinde
   * koordinatör de yok" kenar durumu canlı sistemde görünür kalsın.
   *
   * Bir ilde AKTİF koordinatör varsa o il atlanır: mock katalogda İstanbul ve
   * Ankara koordinatörleri hazır geliyor ve bir ilde iki koordinatör olması,
   * atama akışının "ilin koordinatörü kim" sorusunu belirsiz bırakırdı. Kendi
   * ürettiğimiz koordinatör istisnadır, yoksa script yeniden çalıştırıldığında
   * her seferinde başka illere kayardı.
   */
  const mevcutKoordinatorler = await prisma.kullaniciRol.findMany({
    where: { rolKodu: "IL_KOORDINATOR", bitisTarihi: null },
    select: { ilKodu: true, kullanici: { select: { authProviderId: true } } },
  });
  const baskasininIlleri = new Set(
    mevcutKoordinatorler
      .filter(
        (rol) =>
          rol.ilKodu !== null &&
          rol.kullanici.authProviderId !== `${ONEK}koordinator-${rol.ilKodu}`,
      )
      .map((rol) => rol.ilKodu as string),
  );

  const uygunIller = ILLER.filter((il) => !baskasininIlleri.has(il.ilKodu));
  if (uygunIller.length < AYAR.koordinatorSayisi) {
    console.warn(
      `Uyarı: koordinatörsüz il sayısı ${uygunIller.length}; istenen ${AYAR.koordinatorSayisi} yerine bu kadar atanacak.`,
    );
  }

  const koordinatorIlleri = uygunIller.slice(0, AYAR.koordinatorSayisi);
  const koordinatorsuzIller = uygunIller.slice(
    AYAR.koordinatorSayisi,
    AYAR.koordinatorSayisi + 5,
  );
  const tumIller = [...koordinatorIlleri, ...koordinatorsuzIller];

  console.log("1. Referans veri (ilçe ve okul)");
  const okullar = await referansVeriUret(tumIller);
  console.log(`   ${tumIller.length} il · ${okullar.length} okul\n`);

  // --- İl koordinatörleri --------------------------------------------------
  // Koordinatörün okulu yoktur (kurum kodu null); kapsamı ildir. Rol asla
  // otomatik verilmez, burada proje yöneticisi adına elle atanır.
  console.log("2. İl koordinatörleri");
  const projeYoneticisi = await prisma.kullaniciRol.findFirst({
    where: { rolKodu: "PROJE_YONETICISI", bitisTarihi: null },
    select: { kullaniciId: true },
  });

  let koordinatorSayaci = 0;
  for (const il of koordinatorIlleri) {
    const kisi = kisiUret(rast() < 0.5 ? "E" : "K");
    const kimlik: AuthKimlik = {
      authProviderId: `${ONEK}koordinator-${il.ilKodu}`,
      tip: "OGRETMEN",
      ...kisi,
      kurumKodu: null,
      ilKodu: il.ilKodu,
      ilceKodu: null,
      sinif: null,
      brans: sec(BRANSLAR),
      egitimOgretimYili: EGITIM_OGRETIM_YILI,
    };
    const { kullaniciId } = await kullaniciSagla(kimlik);

    const mevcutRol = await prisma.kullaniciRol.findFirst({
      where: { kullaniciId, rolKodu: "IL_KOORDINATOR", bitisTarihi: null },
      select: { id: true },
    });
    if (!mevcutRol) {
      await prisma.kullaniciRol.create({
        data: {
          kullaniciId,
          rolKodu: "IL_KOORDINATOR",
          ilKodu: il.ilKodu,
          atayanKullaniciId: projeYoneticisi?.kullaniciId ?? null,
        },
      });
    }
    koordinatorSayaci += 1;
  }
  console.log(`   ${koordinatorSayaci} il koordinatörü\n`);

  // --- Öğretmenler ---------------------------------------------------------
  /*
   * Öğretmenler tüm okullara eşit dağıtılmaz, ilk okullarda YOĞUNLAŞTIRILIR.
   * Amaç veriyi güzel göstermek değil, üç ilk-atama dalını da canlı tutmak:
   * iki adaylı okulda öğrenci seçer, tek adaylıda otomatik atanır, adaysız
   * okulda il koordinatörüne düşer.
   */
  console.log("3. Öğretmenler");
  const yogunOkulSayisi = Math.max(1, Math.ceil(AYAR.ogretmenSayisi / 2.5));
  const ogretmenler: { kullaniciId: number; kurumKodu: number }[] = [];

  for (let i = 1; i <= AYAR.ogretmenSayisi; i += 1) {
    const okul = okullar[(i - 1) % yogunOkulSayisi];
    const kisi = kisiUret(rast() < 0.5 ? "E" : "K");
    const kimlik: AuthKimlik = {
      authProviderId: `${ONEK}ogretmen-${numarala(i)}`,
      tip: "OGRETMEN",
      ...kisi,
      kurumKodu: okul.kurumKodu,
      ilKodu: okul.ilKodu,
      ilceKodu: okul.ilceKodu,
      sinif: null,
      brans: sec(BRANSLAR),
      egitimOgretimYili: EGITIM_OGRETIM_YILI,
    };
    const { kullaniciId } = await kullaniciSagla(kimlik);
    ogretmenler.push({ kullaniciId, kurumKodu: okul.kurumKodu });
  }

  // Danışmanlık isteğe bağlıdır ve onay süreci yoktur; herkes işaretlemez.
  let danismanSayaci = 0;
  for (const ogretmen of ogretmenler) {
    if (rast() < 0.7) {
      await danismanlikDurumunuDegistir(ogretmen.kullaniciId, true);
      danismanSayaci += 1;
    }
  }
  console.log(
    `   ${ogretmenler.length} öğretmen · ${danismanSayaci} tanesi danışmanlık görevini aldı\n`,
  );

  // --- Öğrenciler ----------------------------------------------------------
  console.log("4. Öğrenciler ve danışman ataması");
  const atamaOzeti = {
    OTOMATIK: 0,
    IL_KOORDINATORUNE: 0,
    SECIM_GEREKLI: 0,
    ATANAMADI: 0,
  };
  let ogrenciSecti = 0;

  for (let i = 1; i <= AYAR.ogrenciSayisi; i += 1) {
    /*
     * Öğrencilerin çoğu öğretmen bulunan okullara, küçük bir bölümü
     * koordinatörsüz illere yerleştirilir. Böylece hem yoğun okullar gerçekçi
     * dolulukta olur hem "atanamadı" kenar durumu birkaç kayıtla temsil edilir
     * (yüzlerce olsa proje yöneticisinin bildirim listesi işe yaramaz hale
     * gelirdi).
     */
    const koordinatorsuzMu = i % 40 === 0;
    const havuz = koordinatorsuzMu
      ? okullar.filter((o) =>
          koordinatorsuzIller.some((il) => il.ilKodu === o.ilKodu),
        )
      : okullar.slice(0, Math.max(yogunOkulSayisi * 2, 10));
    const okul = sec(havuz.length > 0 ? havuz : okullar);

    const cinsiyet = rast() < 0.5 ? "E" : "K";
    const kimlik: AuthKimlik = {
      authProviderId: `${ONEK}ogrenci-${numarala(i)}`,
      tip: "OGRENCI",
      ...kisiUret(cinsiyet),
      kurumKodu: okul.kurumKodu,
      ilKodu: okul.ilKodu,
      ilceKodu: okul.ilceKodu,
      sinif: `${arasinda(9, 12)}-${sec(SUBELER)}`,
      brans: null,
      egitimOgretimYili: EGITIM_OGRETIM_YILI,
    };

    const { kullaniciId } = await kullaniciSagla(kimlik);
    const karar = await ilkAtamayiYurut(kullaniciId);
    atamaOzeti[karar.tur] += 1;

    /*
     * "Seçim gerekli" durumunda sistem atama YAPMAZ; öğrencinin kendisi seçer.
     * Verinin tamamı beklemede kalmasın diye öğrencilerin bir bölümü seçimini
     * yapmış sayılır — kalanlar seçim ekranını test etmek için bekler.
     */
    if (karar.tur === "SECIM_GEREKLI" && rast() < 0.75) {
      const adaylar = await danismanAdaylariGetir(okul.kurumKodu);
      if (adaylar.length > 0) {
        await ogrenciDanismanSecti(kullaniciId, sec(adaylar).kullaniciId);
        ogrenciSecti += 1;
      }
    }

    // Çalışma grubu seçimi: öğrencilerin çoğu 1-3 grup seçer.
    if (rast() < 0.8) {
      const gruplar = await prisma.calismaGrubu.findMany({
        where: { aktif: true },
        select: { id: true },
      });
      const secilen = new Set<number>();
      const adet = arasinda(1, 3);
      while (secilen.size < adet && secilen.size < gruplar.length) {
        secilen.add(sec(gruplar).id);
      }
      await prisma.ogrenciCalismaGrubu.deleteMany({
        where: { ogrenciId: kullaniciId },
      });
      await prisma.ogrenciCalismaGrubu.createMany({
        data: [...secilen].map((grupId) => ({
          ogrenciId: kullaniciId,
          calismaGrubuId: grupId,
        })),
      });
    }

    if (i % 50 === 0) console.log(`   ${i}/${AYAR.ogrenciSayisi}`);
  }

  console.log(`   ${AYAR.ogrenciSayisi} öğrenci oluşturuldu`);
  console.log("\nDanışman atama sonuçları:");
  console.log(`   otomatik atandı (okulda tek aday) : ${atamaOzeti.OTOMATIK}`);
  console.log(`   il koordinatörüne bağlandı        : ${atamaOzeti.IL_KOORDINATORUNE}`);
  console.log(`   öğrenci seçimi gerekiyor          : ${atamaOzeti.SECIM_GEREKLI}`);
  console.log(`     bunlardan seçimini yapan        : ${ogrenciSecti}`);
  console.log(`   atanamadı (koordinatörsüz il)     : ${atamaOzeti.ATANAMADI}`);

  const toplam = await prisma.kullanici.count();
  console.log(`\nSistemdeki toplam kullanıcı: ${toplam}`);
}

main()
  .catch((hata) => {
    console.error(hata);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
