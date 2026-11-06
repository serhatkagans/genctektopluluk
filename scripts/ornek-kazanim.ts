import "dotenv/config";
import { uretimdeDur } from "./uretim-kilidi";
import { prisma } from "../src/lib/db";

uretimdeDur("npm run veri:kazanim");

/**
 * Kazanımlar ekranı için demo verisi.
 *
 * SEED DEĞİLDİR ve üretimde çalıştırılmaz: tohum verisi gerçek referans
 * kayıtlarını (iller, kurumlar, şablonlar) kurar, burada üretilen ise
 * ekranın dolu hâlini görebilmek için uydurulmuş geçmiş katılımlardır.
 * Kayıtlar "ornek-kazanim" ön ekiyle işaretlenir ve her çalıştırmada
 * yenilenir.
 */

const ON_EK = "[Demo] ";

/**
 * Demo katılımların yazılacağı öğrenci.
 *
 * Sahte kimlik listesinden seçilir ki giriş ekranından bu kişiyle oturum
 * açılabilsin. Van'daki öğrenci bilinçli tercih: üretilen faaliyetler onun
 * iline ve okuluna bağlandığı için senaryo betiğinin İstanbul üzerinden
 * yürüyen faaliyet görünürlük kontrollerini kirletmez.
 */
const HEDEF_KIMLIK = "ogrenci-005";

/**
 * Öğrencinin kendi beyan ettiği kazanım kayıtları (dört türün hepsinden birer
 * örnek). Katılım geçmişinden AYRIDIR: bunlar türetilmez, öğrenci girer —
 * profilin dolu hâlini görebilmek için üretiliyor.
 */
const ORNEK_KAZANIMLAR = [
  {
    tip: "DIS_ETKINLIK" as const,
    baslik: "TEKNOFEST Bilgi Teknolojileri Zirvesi",
    duzenleyen: "T3 Vakfı",
    aciklama: "İki günlük zirvede yapay zekâ oturumlarına katıldım.",
    gunOnce: 200,
  },
  {
    tip: "URUN" as const,
    baslik: "Okul kütüphanesi mobil uygulaması",
    aciklama:
      "Kitap arama ve rezervasyon yapılabilen React Native uygulaması. Okulumuzda kullanılıyor.",
    baglantiUrl: "https://ornek.gov.tr/kutuphane-uygulamasi",
    gunOnce: 150,
  },
  {
    tip: "AKRAN_EGITIMI" as const,
    baslik: "9. sınıflara Python'a giriş atölyesi",
    duzenleyen: "Okul Bilişim Kulübü",
    aciklama: "Dört hafta boyunca haftada bir saat, 18 öğrenciye verildi.",
    gunOnce: 90,
  },
  {
    tip: "YARISMA_DERECESI" as const,
    baslik: "Ulusal Bilgisayar Olimpiyatları",
    derece: "Bölge 3.sü",
    duzenleyen: "TÜBİTAK",
    gunOnce: 60,
  },
];

const ORNEK_FAALIYETLER = [
  {
    ad: "Hack The Idea Okul Turu",
    kapsam: "OKUL" as const,
    kategori: "TEMEL_ETKINLIK" as const,
    gunOnce: 120,
  },
  {
    ad: "Siber Güvenlik Atölyesi",
    kapsam: "OKUL" as const,
    kategori: "CALISMA_GRUBU_ETKINLIGI" as const,
    gunOnce: 80,
  },
  {
    ad: "İl Robotik Buluşması",
    kapsam: "IL" as const,
    kategori: "IL_ETKINLIGI" as const,
    gunOnce: 40,
  },
];

async function calistir() {
  const ogrenci = await prisma.kullanici.findUniqueOrThrow({
    where: { authProviderId: HEDEF_KIMLIK },
    select: { id: true, ad: true, soyad: true, kurumKodu: true, ilKodu: true },
  });

  const duzenleyen = await prisma.kullanici.findFirstOrThrow({
    where: { roller: { some: { rolKodu: "PROJE_YONETICISI", bitisTarihi: null } } },
    select: { id: true },
  });

  // Önceki demo kayıtları temizlenir; aksi halde her çalıştırmada rozetler
  // gerçek olmayan bir hızla artar.
  const eskiler = await prisma.faaliyet.findMany({
    where: { ad: { startsWith: ON_EK } },
    select: { id: true },
  });
  const eskiIdler = eskiler.map((faaliyet) => faaliyet.id);
  await prisma.basvuru.deleteMany({ where: { faaliyetId: { in: eskiIdler } } });
  await prisma.faaliyet.deleteMany({ where: { id: { in: eskiIdler } } });

  for (const ornek of ORNEK_FAALIYETLER) {
    /*
     * Temel Etkinlik ve Çalışma Grubu Etkinliği adlarını sabit listeden alır;
     * veritabanı kısıtı programsız kaydı reddeder. İl Etkinliği'nin listesi
     * yoktur, adı serbesttir.
     */
    const program =
      ornek.kategori === "IL_ETKINLIGI"
        ? null
        : await prisma.temelEtkinlikProgrami.findFirstOrThrow({
            where: { grup: ornek.kategori, aktif: true },
            select: { id: true },
          });

    const tarih = new Date();
    tarih.setDate(tarih.getDate() - ornek.gunOnce);
    const basvuruBaslangic = new Date(tarih);
    basvuruBaslangic.setDate(basvuruBaslangic.getDate() - 20);
    const basvuruBitis = new Date(tarih);
    basvuruBitis.setDate(basvuruBitis.getDate() - 5);

    const faaliyet = await prisma.faaliyet.create({
      data: {
        ad: `${ON_EK}${ornek.ad}`,
        aciklama: "Kazanımlar ekranını göstermek için üretilmiş demo kaydı.",
        tarih,
        kapsam: ornek.kapsam,
        etkinlikKategorisi: ornek.kategori,
        temelEtkinlikProgramiId: program?.id ?? null,
        kontenjan: 30,
        duzenleyenBirim: "GençTek",
        duzenleyenKullaniciId: duzenleyen.id,
        basvuruBaslangic,
        basvuruBitis,
        onayDurumu: "ONAY_GEREKMEZ",
        kurumKodu: ornek.kapsam === "OKUL" ? ogrenci.kurumKodu : null,
        ilKodu: ornek.kapsam === "IL" ? ogrenci.ilKodu : null,
      },
      select: { id: true },
    });

    await prisma.basvuru.create({
      data: {
        faaliyetId: faaliyet.id,
        katilimciId: ogrenci.id,
        gerekce: "Demo katılım kaydı.",
        durum: "SECILDI",
        basvuruTarihi: basvuruBaslangic,
        degerlendirenKullaniciId: duzenleyen.id,
        degerlendirmeTarihi: basvuruBitis,
        /*
         * YOKLAMA DA İŞARETLENİYOR (12 Ağustos 2026): seçilmiş olmak artık tek
         * başına katılım saymıyor (bkz. lib/kazanim/katilim-kurallar.ts).
         * İşaretlenmeseydi bu betiğin ürettiği kayıtlar Yolculuk ekranında hiç
         * görünmez ve betik tam olarak göstermek için var olduğu şeyi
         * gösteremezdi.
         */
        katildiMi: true,
        yoklamaAlanKullaniciId: duzenleyen.id,
        yoklamaTarihi: tarih,
      },
    });
  }

  /*
   * Kazanım beyanları. Ön ek `baslik` alanında taşınır ki temizlik aynı desenle
   * yapılabilsin — bu tabloda faaliyet gibi ayrı bir kimlik alanı yok.
   */
  await prisma.kullaniciKazanim.deleteMany({
    where: { kullaniciId: ogrenci.id, baslik: { startsWith: ON_EK } },
  });

  for (const ornek of ORNEK_KAZANIMLAR) {
    const tarih = new Date();
    tarih.setDate(tarih.getDate() - ornek.gunOnce);

    await prisma.kullaniciKazanim.create({
      data: {
        kullaniciId: ogrenci.id,
        tip: ornek.tip,
        baslik: `${ON_EK}${ornek.baslik}`,
        aciklama: ornek.aciklama ?? null,
        tarih,
        baglantiUrl: ornek.baglantiUrl ?? null,
        derece: ornek.derece ?? null,
        duzenleyen: ornek.duzenleyen ?? null,
      },
    });
  }

  console.log(
    `${ogrenci.ad} ${ogrenci.soyad} için ${ORNEK_FAALIYETLER.length} demo katılım ve ${ORNEK_KAZANIMLAR.length} kazanım kaydı üretildi.`,
  );

  await prisma.$disconnect();
}

void calistir();
