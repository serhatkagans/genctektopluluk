import { prisma } from "../db";
import { depolama } from "../depolama";
import {
  IMHA_EDILMIS_ICERIK,
  imhaEdilmisKimlik,
  imhaEdilmisProfil,
} from "./imha-kurallari";

/**
 * İMHA — KVKK m.7 · Genelge 3/e ve 3/g.
 *
 * İki ayrı iş yapar ve ikisi de bu dosyada, çünkü aynı fiili uygularlar:
 *
 *   1. `gizliIcerikleriImhaEt` — moderasyon penceresi dolan GİZLENMİŞ içeriği
 *      gerçekten imha eder. Gizleme bir imha değildi: metin satırda aynen
 *      duruyordu ve "sildik" denilen kayıt ilgili kişinin silme talebi
 *      karşısında savunulamazdı.
 *   2. `kullaniciyiImhaEt` — bir kişinin kişisel verisini anonim hâle getirir.
 *      Hem süresi dolan (uzun süredir temas etmemiş) kayıtlar için aylık
 *      bakımdan, hem de KABUL EDİLEN bir KVKK silme başvurusundan çağrılır.
 *      İkinci yol önemli: başvuruya "sildik" yanıtı yazmak, silmenin kendisi
 *      değildir.
 *
 * DOSYALAR DA GİDER. Fotoğraf, özgeçmiş ve faaliyet eki veritabanında değil
 * depolamada durur; yalnızca satırı boşaltmak diskte okunabilir bir kopya
 * bırakırdı. Dosya silme HATA VERİRSE iş durmaz: yetim bir dosya, yarım kalmış
 * bir imhadan iyidir — kayıt tarafı tamamlanır, dosya sonraki koşuda yeniden
 * denenmez, bu yüzden hata ayrıca sayılır ve günlüğe yazılır.
 *
 * ERİŞİM KAYITLARINA DOKUNULMAZ. Onlar kanunî yükümlülüğün kanıtı (kim, hangi
 * kaydı, ne zaman gördü) ve kendi 24 aylık süreleriyle zaten siliniyor
 * (bkz. ./saklama.ts). İmhayla birlikte silinselerdi, denetimde imhanın
 * kendisi de kanıtlanamazdı.
 */

export interface GizliIcerikImhaSonucu {
  mesaj: number;
  gonderi: number;
  gonderiYorumu: number;
  ekipMesaji: number;
  talepCevabi: number;
  yorum: number;
  faaliyetEki: number;
  silinemeyenDosya: number;
}

/**
 * Pencere hangi andan işler: gizlenme tarihinden, yoksa oluşturma tarihinden.
 *
 * `gizlenmeTarihi` boş olabilir (mesajda sütun sonradan eklendi, eski satırlar
 * dolmadı). Boşu "hiç imha etme" saymak o satırları süresiz saklamak olurdu —
 * düzeltilmek istenen şey tam olarak bu.
 */
function pencereSuzgeci(sinir: Date, yedekAlan: string) {
  return {
    OR: [
      { gizlenmeTarihi: { lt: sinir } },
      { gizlenmeTarihi: null, [yedekAlan]: { lt: sinir } },
    ],
  };
}

export async function gizliIcerikleriImhaEt(
  sinir: Date,
): Promise<GizliIcerikImhaSonucu> {
  // İçeriği zaten boşaltılmış satır tekrar sayılmasın: aylık koşu her ay aynı
  // sayıyı raporlarsa "bu ay ne imha edildi" sorusu cevapsız kalır.
  const bosDegil = { icerik: { not: IMHA_EDILMIS_ICERIK } };
  const gizli = { gizlendiMi: true, ...bosDegil };

  /*
   * SIRAYLA, Promise.all ile DEĞİL.
   *
   * Beş tabloyu paralel güncellemek hiçbir şey kazandırmıyor (aylık koşan bir
   * bakım işi, kimse beklemiyor) ama havuzdan aynı anda beş bağlantı istiyor.
   * Yereldeki `prisma dev` sunucusu dokuzuncu bağlantıda çöküyor ve iş
   * `Connection terminated unexpectedly` ile yarıda kalıyordu; üretimde de
   * havuz kopya başına 4. Yarım kalan bir imha, hiç başlamamış olandan
   * kötüdür: bazı tablolar temizlenmiş, bazıları dolu kalır.
   */
  const mesaj = await prisma.mesaj.updateMany({
    where: { ...gizli, ...pencereSuzgeci(sinir, "olusturmaTarihi") },
    data: { icerik: IMHA_EDILMIS_ICERIK },
  });
  const gonderi = await prisma.gonderi.updateMany({
    where: { ...gizli, ...pencereSuzgeci(sinir, "olusturmaTarihi") },
    data: { icerik: IMHA_EDILMIS_ICERIK },
  });
  const gonderiYorumu = await prisma.gonderiYorumu.updateMany({
    where: { ...gizli, ...pencereSuzgeci(sinir, "olusturmaTarihi") },
    data: { icerik: IMHA_EDILMIS_ICERIK },
  });
  const ekipMesaji = await prisma.ekipMesaji.updateMany({
    where: { ...gizli, ...pencereSuzgeci(sinir, "olusturmaTarihi") },
    data: { icerik: IMHA_EDILMIS_ICERIK },
  });
  const talepCevabi = await prisma.talepCevabi.updateMany({
    where: { ...gizli, ...pencereSuzgeci(sinir, "olusturmaTarihi") },
    data: { icerik: IMHA_EDILMIS_ICERIK },
  });

  /*
   * Yorum ve faaliyet ekinde bayrağın adı `silindiMi`, tarihi `silinmeTarihi`.
   * Aynı kavram, farklı isim: ekranda "sil" denen işlem de aslında gizliyor.
   */
  const yorum = await prisma.yorum.updateMany({
    where: {
      silindiMi: true,
      ...bosDegil,
      OR: [
        { silinmeTarihi: { lt: sinir } },
        { silinmeTarihi: null, olusturmaTarihi: { lt: sinir } },
      ],
    },
    data: { icerik: IMHA_EDILMIS_ICERIK },
  });

  /*
   * Faaliyet eki bir DOSYADIR: satırı boşaltmak yetmez, depolamadaki kopya da
   * gitmeli. Bu yüzden tek updateMany değil, önce okuma sonra silme.
   */
  const ekler = await prisma.faaliyetEk.findMany({
    where: {
      silindiMi: true,
      depolamaYolu: { not: "" },
      OR: [
        { silinmeTarihi: { lt: sinir } },
        { silinmeTarihi: null, yuklenmeTarihi: { lt: sinir } },
      ],
    },
    select: { id: true, depolamaYolu: true },
  });

  let silinemeyenDosya = 0;
  for (const ek of ekler) {
    silinemeyenDosya += await dosyaSil(ek.depolamaYolu);
    await prisma.faaliyetEk.update({
      where: { id: ek.id },
      data: { depolamaYolu: "", dosyaAdi: "" },
    });
  }

  return {
    mesaj: mesaj.count,
    gonderi: gonderi.count,
    gonderiYorumu: gonderiYorumu.count,
    ekipMesaji: ekipMesaji.count,
    talepCevabi: talepCevabi.count,
    yorum: yorum.count,
    faaliyetEki: ekler.length,
    silinemeyenDosya,
  };
}

export interface KullaniciImhaSonucu {
  kullaniciId: number;
  /** Zaten imha edilmiş bir kayıt ikinci kez işlenmez. */
  yapildiMi: boolean;
  imhaEdilenIcerik: number;
  imhaEdilenBasvuruGerekcesi: number;
  silinemeyenDosya: number;
}

/**
 * Bir kişinin kişisel verisini anonim hâle getirir.
 *
 * İÇERİK DE GİDER, yalnızca kimlik alanları değil: kişinin yazdığı mesaj ve
 * gönderiler onun hakkında veri taşır ("hangi okuldayım, hangi hastalığım
 * var" cümleleri kimlik alanı değildir ama kişiseldir). İçerik boşaltılırken
 * satır aynı zamanda GİZLİ işaretlenir — boş bir konuşma balonu bırakmak
 * ekranda "mesaj kayboldu" gibi okunurdu.
 */
export async function kullaniciyiImhaEt(
  kullaniciId: number,
  simdi: Date = new Date(),
): Promise<KullaniciImhaSonucu> {
  const kullanici = await prisma.kullanici.findUnique({
    where: { id: kullaniciId },
    select: {
      id: true,
      anonimlestirmeTarihi: true,
      fotoDepolamaYolu: true,
      ogrenciProfil: { select: { cvDepolamaYolu: true } },
      ogretmenProfil: { select: { cvDepolamaYolu: true } },
      /*
       * KAZANIM EKLERİ (6 Kasım 2026 · güvenlik incelemesi). Sertifika, ürün
       * belgesi ve görselleri kişiseldir; imha önceden yalnızca fotoğraf ve
       * CV'yi kaldırıyordu. Markette paylaşılmış ürünün dosyaları anonim
       * hesaptan sonra da oturumu olan herkese iniyordu.
       */
      kazanimlar: {
        select: { ekler: { select: { id: true, depolamaYolu: true } } },
      },
    },
  });

  if (!kullanici || kullanici.anonimlestirmeTarihi !== null) {
    return {
      kullaniciId,
      yapildiMi: false,
      imhaEdilenIcerik: 0,
      imhaEdilenBasvuruGerekcesi: 0,
      silinemeyenDosya: 0,
    };
  }

  /*
   * DOSYALAR ÖNCE. Kayıt önce temizlenseydi depolama yolunu kaybeder, dosyayı
   * bir daha bulamazdık — imha yarım kalır ve diskte okunabilir kopya kalırdı.
   */
  let silinemeyenDosya = 0;
  for (const anahtar of [
    kullanici.fotoDepolamaYolu,
    kullanici.ogrenciProfil?.cvDepolamaYolu,
    kullanici.ogretmenProfil?.cvDepolamaYolu,
  ]) {
    if (anahtar) silinemeyenDosya += await dosyaSil(anahtar);
  }

  const kazanimEkleri = kullanici.kazanimlar.flatMap((kazanim) => kazanim.ekler);
  for (const ek of kazanimEkleri) {
    silinemeyenDosya += await dosyaSil(ek.depolamaYolu);
  }
  if (kazanimEkleri.length > 0) {
    // Dosyası gitmiş ek satırı kalmasın: indirme rotası onu yine sunmaya
    // çalışır, listeler kırık bağlantı gösterirdi.
    await prisma.kazanimEk.deleteMany({
      where: { id: { in: kazanimEkleri.map((ek) => ek.id) } },
    });
  }

  const gizle = {
    icerik: IMHA_EDILMIS_ICERIK,
    gizlendiMi: true,
    gizlenmeTarihi: simdi,
  };
  const yazdiklari = { yazanKullaniciId: kullaniciId };

  const sonuc = await prisma.$transaction(async (islem) => {
    await islem.kullanici.update({
      where: { id: kullaniciId },
      data: { ...imhaEdilmisKimlik(kullaniciId), anonimlestirmeTarihi: simdi },
    });

    await islem.ogrenciProfil.updateMany({
      where: { kullaniciId },
      data: imhaEdilmisProfil(),
    });
    await islem.ogretmenProfil.updateMany({
      where: { kullaniciId },
      data: { ...imhaEdilmisProfil(), aciklama: null },
    });

    /*
     * SIRAYLA: tek bir işlem (transaction) içindeyiz ve işlemin bağlantısı
     * TEKTİR. Promise.all ile gönderilen sorgular aynı bağlantıda sıraya
     * girer, kazanç yoktur; ama havuz baskısı altında Prisma işlemi
     * `P2028 · Transaction not found` ile düşürebiliyor.
     */
    const sayimlar = [
      await islem.mesaj.updateMany({ where: yazdiklari, data: gizle }),
      await islem.gonderi.updateMany({ where: yazdiklari, data: gizle }),
      await islem.gonderiYorumu.updateMany({ where: yazdiklari, data: gizle }),
      await islem.ekipMesaji.updateMany({ where: yazdiklari, data: gizle }),
      await islem.talepCevabi.updateMany({ where: yazdiklari, data: gizle }),
      // Yorumda bayrağın adı farklı; kavram aynı.
      await islem.yorum.updateMany({
        where: yazdiklari,
        data: {
          icerik: IMHA_EDILMIS_ICERIK,
          silindiMi: true,
          silinmeTarihi: simdi,
        },
      }),
      // Panodaki ilan: başlık da metin taşır, ikisi birlikte boşaltılır.
      await islem.talep.updateMany({
        where: { acanKullaniciId: kullaniciId },
        data: { baslik: IMHA_EDILMIS_ICERIK, icerik: IMHA_EDILMIS_ICERIK },
      }),
    ];

    /*
     * BAŞVURU SATIRI KALIR, GEREKÇESİ GİDER. Satır ekosistemin raporunun
     * dayanağı ("bu faaliyete kaç kişi katıldı"); gerekçe ise kişinin kendi
     * yazdığı, çoğu zaman ailevî ya da sağlıkla ilgili serbest metindir.
     */
    const basvuru = await islem.basvuru.updateMany({
      where: { katilimciId: kullaniciId, gerekce: { not: IMHA_EDILMIS_ICERIK } },
      data: { gerekce: IMHA_EDILMIS_ICERIK },
    });

    return {
      icerik: sayimlar.reduce((toplam, adim) => toplam + adim.count, 0),
      basvuru: basvuru.count,
    };
  });

  return {
    kullaniciId,
    yapildiMi: true,
    imhaEdilenIcerik: sonuc.icerik,
    imhaEdilenBasvuruGerekcesi: sonuc.basvuru,
    silinemeyenDosya,
  };
}

export interface HareketsizImhaSonucu {
  imhaEdilenKullanici: number;
  imhaEdilenIcerik: number;
  silinemeyenDosya: number;
}

/**
 * Süresi dolan (uzun süredir temas etmemiş) kayıtları imha eder.
 *
 * TEK TEK, toplu updateMany ile değil: her kişinin dosyaları ayrı ayrı
 * siliniyor ve içeriği ayrı bir işlemde boşaltılıyor. Yavaş ama aylık koşan
 * bir bakım işi için doğru takas — toplu güncelleme, dosyaları geride
 * bırakırdı.
 */
export async function hareketsizKullanicilariImhaEt(
  sinir: Date,
  simdi: Date = new Date(),
): Promise<HareketsizImhaSonucu> {
  const adaylar = await prisma.kullanici.findMany({
    where: { anonimlestirmeTarihi: null, sonSenkronTarihi: { lt: sinir } },
    select: { id: true },
  });

  let imhaEdilenIcerik = 0;
  let silinemeyenDosya = 0;
  let imhaEdilenKullanici = 0;

  for (const aday of adaylar) {
    const sonuc = await kullaniciyiImhaEt(aday.id, simdi);
    if (!sonuc.yapildiMi) continue;
    imhaEdilenKullanici += 1;
    imhaEdilenIcerik += sonuc.imhaEdilenIcerik;
    silinemeyenDosya += sonuc.silinemeyenDosya;
  }

  return { imhaEdilenKullanici, imhaEdilenIcerik, silinemeyenDosya };
}

/** Dosyayı siler; silinemezse 1 döner (imhayı durdurmaz). */
async function dosyaSil(anahtar: string): Promise<number> {
  try {
    await depolama().sil(anahtar);
    return 0;
  } catch (hata) {
    console.error(`İmha: dosya silinemedi (${anahtar})`, hata);
    return 1;
  }
}
