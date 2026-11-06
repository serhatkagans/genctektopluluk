import "dotenv/config";
import { uretimdeDur } from "./uretim-kilidi";
import { prisma } from "@/lib/db";
import { basvuruyuOnayla, disBasvuruOlustur } from "@/lib/dis-kimlik/basvuru";
import {
  type DisBasvuruGirdisi,
  disBasvuruGirdisiniCoz,
} from "@/lib/dis-kimlik/kurallar";

uretimdeDur("npm run veri:dis-kullanici");

/**
 * Örnek dış kullanıcı üreteci: birer mezun, paydaş temsilcisi ve mentör.
 *
 * ---------------------------------------------------------------------------
 * NİYE AYRI BİR SCRIPT
 * ---------------------------------------------------------------------------
 * `scripts/ornek-veri.ts` EBA tarafını dolduruyor ve kullanıcıları
 * `kullaniciSagla` ile açıyor. Dış kullanıcı o yoldan AÇILAMAZ: kimliği
 * AuthProvider'dan gelmiyor, şifresi var ve kaydı bir BAŞVURUDAN doğuyor.
 * İki akışı tek scriptte birleştirmek, ikisinin de kendi kurallarını atlamak
 * anlamına gelirdi.
 *
 * KAYITLAR ELLE YAZILMAZ: gerçek akış çağrılıyor —
 * `disBasvuruGirdisiniCoz` (form doğrulaması) → `disBasvuruOlustur` →
 * `basvuruyuOnayla`. Böylece üretilen kullanıcı, gerçek bir başvurudan doğmuş
 * kullanıcıyla birebir aynı olur: rolü, `dis_kimlik` satırı, iletişim profili
 * ve mentörlük kaydı aynı kodla açılır.
 *
 * Kullanım:
 *   npm run veri:dis-kullanici              üç kişiyi oluşturur/tazeler
 *   npm run veri:dis-kullanici -- --temizle yalnızca bu üçünü siler
 *
 * GİRİŞ: /dis-giris ekranından e-posta + şifre ile. Şifre üçünde de aynı ve
 * aşağıda sabit — bu bir GELİŞTİRME aracıdır, üretim veritabanında
 * çalıştırılmamalıdır.
 */

const SIFRE = "GencTek2026!ornek";
const IL_KODU = "34";

/** Silme ve yeniden üretme bu önekten bulur. */
const EPOSTA_ONEKI = "ornek-";

interface OrnekKisi {
  girdi: DisBasvuruGirdisi;
  /** Onaydan sonra profile yazılacak alanlar — istekteki "Bilgileri" kutusu. */
  profil: {
    kurumAdi: string | null;
    gorevUnvani: string | null;
    aciklama: string;
    linkedinUrl: string;
    githubUrl: string;
    kisiselSiteUrl: string | null;
  };
  /** Katkı verebileceği çalışma gruplarından kaç tanesi işaretlensin. */
  destekGrupSayisi: number;
}

/** Ortak alanlar; her kişi kendi türüne özgü olanları eziyor. */
function temelGirdi(): DisBasvuruGirdisi {
  return {
    tur: "MEZUN",
    ad: "",
    soyad: "",
    eposta: "",
    telefon: "0212 000 00 00",
    ilKodu: IL_KODU,
    sifre: SIFRE,
    sifreTekrar: SIFRE,
    mezunKurumKodu: "",
    mezuniyetYili: "",
    paydasId: "",
    gorevUnvani: "",
    beyan: "",
    mentorlukIstiyor: false,
    mentorlukKonulari: "",
    mentorlukGrupIdleri: [],
  };
}

function kisiler(paydasId: number, grupIdleri: number[]): OrnekKisi[] {
  return [
    {
      // MEZUN — mentörlük istemiyor: "yalnızca mezun" hâlinin nasıl göründüğü
      // de görülebilmeli.
      girdi: {
        ...temelGirdi(),
        tur: "MEZUN",
        ad: "Elif",
        soyad: "Mezun",
        eposta: `${EPOSTA_ONEKI}mezun@genctek.test`,
        mezuniyetYili: "2021",
        beyan:
          "GençTek'te robotik takımındaydım, şimdi yazılım mühendisiyim. Mezun olarak öğrencilere deneyim aktarmak istiyorum.",
      },
      profil: {
        kurumAdi: "Örnek Teknoloji A.Ş.",
        gorevUnvani: "Yazılım mühendisi",
        aciklama:
          "Web ve mobil geliştirme konusunda ders anlatabilirim. Şirketimizde lise öğrencilerine yaz stajı açabiliriz; ayrıca takım projelerine kod incelemesi desteği verebilirim.",
        linkedinUrl: "https://www.linkedin.com/in/ornek-mezun",
        githubUrl: "https://github.com/ornek-mezun",
        kisiselSiteUrl: "https://ornekmezun.dev",
      },
      destekGrupSayisi: 2,
    },
    {
      // PAYDAŞ — kurum envanterinden seçiliyor; başvuruda görev unvanı zorunlu.
      girdi: {
        ...temelGirdi(),
        tur: "PAYDAS",
        ad: "Kerem",
        soyad: "Paydaş",
        eposta: `${EPOSTA_ONEKI}paydas@genctek.test`,
        paydasId: String(paydasId),
        gorevUnvani: "Kurumsal iletişim sorumlusu",
        beyan:
          "Kurumumuz adına GençTek etkinliklerine mekân ve eğitmen desteği vermek, öğrenci projelerine sponsor olmak istiyoruz.",
      },
      profil: {
        // Kurum ve görev BOŞ bırakılıyor: profil, alanlar boşken başvurudaki
        // kurumu ve unvanı gösteriyor — düşüşün çalıştığı bu kişide görülür.
        kurumAdi: null,
        gorevUnvani: null,
        aciklama:
          "Etkinlikleriniz için toplantı salonumuzu ve laboratuvarımızı açabiliriz. Ödül ve malzeme desteği sağlayabilir, çalışanlarımızdan eğitmen görevlendirebiliriz.",
        linkedinUrl: "https://www.linkedin.com/company/ornek-paydas",
        githubUrl: "https://github.com/ornek-paydas",
        kisiselSiteUrl: null,
      },
      destekGrupSayisi: 3,
    },
    {
      // MENTÖR — türü seçtiği için mentörlük isteği ZORUNLU olarak açık ve
      // onayla birlikte `mentorluk` kaydı ONAYLANDI doğar.
      girdi: {
        ...temelGirdi(),
        tur: "MENTOR",
        ad: "Selin",
        soyad: "Mentör",
        eposta: `${EPOSTA_ONEKI}mentor@genctek.test`,
        beyan:
          "Yapay zekâ ve veri bilimi alanında çalışıyorum. Öğrencilere proje seçimi ve kariyer planlaması konusunda yol göstermek istiyorum.",
        mentorlukIstiyor: true,
        mentorlukKonulari: "Yapay zekâ, veri bilimi, girişimcilik",
        mentorlukGrupIdleri: grupIdleri.slice(0, 2),
      },
      profil: {
        kurumAdi: "Örnek Üniversitesi",
        gorevUnvani: "Öğretim görevlisi",
        aciklama:
          "Yapay zekâ, veri analizi ve Python konularında mentörlük yapabilirim. Proje danışmanlığı ve yarışma hazırlığı desteği verebilirim.",
        linkedinUrl: "https://www.linkedin.com/in/ornek-mentor",
        githubUrl: "https://github.com/ornek-mentor",
        kisiselSiteUrl: null,
      },
      destekGrupSayisi: 2,
    },
  ];
}

// ---------------------------------------------------------------------------
// Temizlik
// ---------------------------------------------------------------------------

/**
 * Yalnızca bu scriptin ürettiklerini siler; e-posta önekinden bulunur.
 *
 * Silme sırası yabancı anahtarları izliyor. Başvuru satırı da siliniyor:
 * bırakılsaydı aynı e-postayla yeniden üretim, "onaylanmış başvuru zaten var"
 * kontrolüne değil `dis_kimlik` tekilliğine takılırdı ve script yeniden
 * çalıştırılamaz olurdu.
 */
async function ornekleriSil(): Promise<number> {
  const kimlikler = await prisma.disKimlik.findMany({
    where: { eposta: { startsWith: EPOSTA_ONEKI } },
    select: { kullaniciId: true },
  });
  const idler = kimlikler.map((k) => k.kullaniciId);

  if (idler.length > 0) {
    await prisma.kullaniciDestekGrubu.deleteMany({
      where: { kullaniciId: { in: idler } },
    });
    await prisma.mentorlukCalismaGrubu.deleteMany({
      where: { mentorlukKullaniciId: { in: idler } },
    });
    await prisma.mentorluk.deleteMany({ where: { kullaniciId: { in: idler } } });
    await prisma.bildirim.deleteMany({ where: { kullaniciId: { in: idler } } });
    await prisma.erisimlogu.deleteMany({ where: { kullaniciId: { in: idler } } });
    await prisma.kullaniciOnayi.deleteMany({
      where: { kullaniciId: { in: idler } },
    });
    // Bildirdikleri etkinlikler: kapak bağı önce koparılır (ornek-veri.ts'teki
    // aynı sıra), sonra ekler ve faaliyetin kendisi.
    await prisma.faaliyet.updateMany({
      where: { duzenleyenKullaniciId: { in: idler } },
      data: { kapakEkId: null },
    });
    await prisma.faaliyetEk.deleteMany({
      where: { yukleyenKullaniciId: { in: idler } },
    });
    await prisma.faaliyet.deleteMany({
      where: { duzenleyenKullaniciId: { in: idler } },
    });
    await prisma.kullaniciKazanim.deleteMany({
      where: { kullaniciId: { in: idler } },
    });
    await prisma.kullaniciHedefi.deleteMany({
      where: { kullaniciId: { in: idler } },
    });
    await prisma.kullaniciRol.deleteMany({
      where: { kullaniciId: { in: idler } },
    });
    await prisma.ogretmenProfil.deleteMany({
      where: { kullaniciId: { in: idler } },
    });
    await prisma.disKimlik.deleteMany({ where: { kullaniciId: { in: idler } } });
  }

  /*
   * BAŞVURU, KULLANICIDAN ÖNCE SİLİNİR.
   *
   * Bağı `olusan_kullanici_id = NULL` yaparak koparmak İŞE YARAMAZ:
   * `dis_basvuru_onay_kullanici` kısıtı "onaylanan başvuru bir kullanıcı
   * doğurmuş olmak zorundadır" diyor ve haklı — "onaylandı ama hesabı yok"
   * satırı sessizce oluşmamalı. Kullanıcıya giden yabancı anahtar da RESTRICT
   * olduğu için tek doğru sıra bu.
   */
  const { count } = await prisma.disKullaniciBasvurusu.deleteMany({
    where: { eposta: { startsWith: EPOSTA_ONEKI } },
  });

  if (idler.length > 0) {
    await prisma.kullanici.deleteMany({ where: { id: { in: idler } } });
  }

  return Math.max(idler.length, count);
}

// ---------------------------------------------------------------------------
// Bağımlılıklar
// ---------------------------------------------------------------------------

/**
 * Kararı verecek proje yöneticisi.
 *
 * Onay yetkisi yalnızca proje yöneticisindedir (bkz. disBasvuruYonetebilirMi);
 * script kendi başına bir yönetici AÇMAZ — rol dağıtımı seed'in işi ve burada
 * açılan bir yönetici, seed'in kapatma mantığının dışında kalırdı.
 */
async function projeYoneticisiBul(): Promise<number> {
  const yonetici = await prisma.kullanici.findFirst({
    where: {
      roller: { some: { rolKodu: "PROJE_YONETICISI", bitisTarihi: null } },
    },
    orderBy: { id: "asc" },
    select: { id: true },
  });
  if (!yonetici) {
    throw new Error(
      "Aktif proje yöneticisi bulunamadı. Önce `npm run db:seed` çalıştırın.",
    );
  }
  return yonetici.id;
}

/**
 * Paydaş başvurusu için envanterde bir kurum lazım: başvuran serbest metin
 * kurum adı YAZAMAZ, mevcut kayıttan seçer (S18).
 */
async function paydasSagla(ekleyenKullaniciId: number): Promise<number> {
  const mevcut = await prisma.paydas.findFirst({
    where: { aktif: true, ilKodu: IL_KODU },
    orderBy: { id: "asc" },
    select: { id: true },
  });
  if (mevcut) return mevcut.id;

  const yeni = await prisma.paydas.create({
    data: {
      ilKodu: IL_KODU,
      ad: "Örnek Teknoloji A.Ş.",
      tur: "OZEL_SEKTOR",
      yetkiliKisi: "Kerem Paydaş",
      eposta: `${EPOSTA_ONEKI}paydas@genctek.test`,
      isBirligiAlani:
        "Mekân ve laboratuvar desteği, eğitmen görevlendirme, ödül ve malzeme sponsorluğu.",
      ekleyenKullaniciId,
    },
    select: { id: true },
  });
  console.log(`   Paydaş envanterine örnek kurum eklendi (id ${yeni.id}).`);
  return yeni.id;
}

// ---------------------------------------------------------------------------
// Ana akış
// ---------------------------------------------------------------------------

async function main() {
  if (process.argv.includes("--temizle")) {
    const silinen = await ornekleriSil();
    console.log(
      silinen > 0
        ? `${silinen} örnek dış kullanıcı/başvuru silindi.`
        : "Silinecek örnek dış kullanıcı yok.",
    );
    return;
  }

  console.log("Örnek dış kullanıcılar (mezun · paydaş · mentör)\n");

  const yoneticiId = await projeYoneticisiBul();

  /*
   * ÖNCE TEMİZLİK: script yeniden çalıştırılabilir olmalı. Aynı e-postayla
   * ikinci kez başvuru zaten reddedilirdi (dis_kimlik tekilliği) ve kişi
   * güncellenmeden çıkılırdı — sessizce eski veriyle devam etmektense kaydı
   * yenidan kuruyoruz.
   */
  await ornekleriSil();

  const paydasId = await paydasSagla(yoneticiId);

  const gruplar = await prisma.calismaGrubu.findMany({
    where: { aktif: true },
    orderBy: { siraNo: "asc" },
    select: { id: true, ad: true },
  });
  if (gruplar.length === 0) {
    throw new Error(
      "Aktif çalışma grubu yok. Önce `npm run db:seed` çalıştırın.",
    );
  }

  const simdi = new Date();
  const ozet: { kim: string; eposta: string; not: string }[] = [];

  for (const kisi of kisiler(
    paydasId,
    gruplar.map((grup) => grup.id),
  )) {
    const karar = disBasvuruGirdisiniCoz(kisi.girdi, simdi);
    if (!karar.olurMu) {
      throw new Error(`${kisi.girdi.eposta}: ${karar.neden}`);
    }

    const sonuc = await disBasvuruOlustur(karar.kayit, simdi);
    if (sonuc.durum !== "ALINDI") {
      /*
       * "SESSIZ" burada da bir arızadır: örnek verinin adresleri temiz bir
       * veritabanına yazılıyor, çakışma çıkıyorsa betik iki kez çalıştırılmış
       * demektir. Ekranda susan durum betikte KONUŞMALI.
       */
      const neden =
        sonuc.durum === "SESSIZ"
          ? "adres zaten kayıtlı ya da bekleyen başvurusu var"
          : sonuc.mesaj;
      throw new Error(`${kisi.girdi.eposta}: ${neden}`);
    }

    const onay = await basvuruyuOnayla(sonuc.basvuruId, yoneticiId, simdi);
    if (!onay.olduMu) {
      throw new Error(`${kisi.girdi.eposta}: ${onay.neden}`);
    }

    const kimlik = await prisma.disKimlik.findUniqueOrThrow({
      where: { eposta: karar.kayit.eposta },
      select: { kullaniciId: true },
    });

    /*
     * Profil alanları başvuruda SORULMUYOR (7 Ağustos 2026 · yeni sekmeler);
     * kişi bunları girdikten sonraki hâli görülebilsin diye burada dolduruluyor.
     * Onay akışının kendisi bu alanlara dokunmaz.
     */
    await prisma.ogretmenProfil.update({
      where: { kullaniciId: kimlik.kullaniciId },
      data: {
        kurumAdi: kisi.profil.kurumAdi,
        gorevUnvani: kisi.profil.gorevUnvani,
        aciklama: kisi.profil.aciklama,
        linkedinUrl: kisi.profil.linkedinUrl,
        githubUrl: kisi.profil.githubUrl,
        kisiselSiteUrl: kisi.profil.kisiselSiteUrl,
      },
    });

    await prisma.kullaniciDestekGrubu.createMany({
      data: gruplar
        .slice(0, kisi.destekGrupSayisi)
        .map((grup) => ({
          kullaniciId: kimlik.kullaniciId,
          calismaGrubuId: grup.id,
        })),
    });

    const mentorluk = await prisma.mentorluk.findUnique({
      where: { kullaniciId: kimlik.kullaniciId },
      select: { durum: true },
    });

    ozet.push({
      kim: `${karar.kayit.ad} ${karar.kayit.soyad}`,
      eposta: karar.kayit.eposta,
      not: mentorluk
        ? `${karar.kayit.tur} · mentörlük ${mentorluk.durum}`
        : `${karar.kayit.tur} · mentörlük yok`,
    });
  }

  console.log("\nOluşturulan hesaplar:\n");
  for (const satir of ozet) {
    console.log(`  ${satir.kim.padEnd(16)} ${satir.eposta.padEnd(34)} ${satir.not}`);
  }
  console.log(`\n  Şifre (üçünde de aynı): ${SIFRE}`);
  console.log("  Giriş: /dis-giris  (ana ekranda 'E-Devlet ile Giriş')\n");
  console.log(
    "  İlk girişte KVKK onay ekranı çıkar (ilk giriş kilidi); onayladıktan\n" +
      "  sonra Profil · Panel · Etkinlikler sekmeleri görünür.\n",
  );
}

main()
  .catch((hata) => {
    console.error(hata);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
