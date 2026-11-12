import { oturumKullanicisi } from "@/lib/auth/oturum";
import { basvurulariListele } from "@/lib/dis-kimlik/basvuru";
import {
  basvuruKonumu,
  GUNCEL_DURUM_ETIKETLERI,
  TUR_ETIKETLERI,
} from "@/lib/dis-kimlik/kurallar";
import { ONAY_DURUMU_ETIKETLERI } from "@/lib/faaliyet/kurallar";
import {
  altBaslikYaz,
  bicimCoz,
  disaAktarmaYaniti,
} from "@/lib/rapor/disa-aktarma";
import type { XlsxSutun } from "@/lib/rapor/xlsx";
import { disBasvuruYonetebilirMi } from "@/lib/yetki/izinler";
import { erisimLogla } from "@/lib/yetki/log";

export const dynamic = "force-dynamic";

/**
 * Dış giriş başvurularının dosya çıktısı (15 Ağustos 2026 · Aşama 2c).
 *
 * Mezun ve paydaş temsilcisi başvuruları; ekranda kart kart okunuyor ve karara
 * bağlananlar biriktikçe ekran uzuyor. Dosya, "kimler başvurdu, kaçı kabul
 * edildi, reddedilenlerin gerekçesi neydi" sorusunun tablosu.
 *
 * ŞİFRE ÖZETİ YOK — ekranda da yok (bkz. BASVURU_ALANLARI). Dosya ekranın
 * kopyasıdır; dışa aktarmaya ekranda olmayan bir alan eklemek, indirmeyi kapsam
 * genişletmenin arka kapısı hâline getirirdi.
 *
 * ÜST SINIR YOK: başvuru sayısı ekranda da sınırsız listeleniyor ve büyüklüğü
 * kullanıcı sayısıyla değil başvuru sayısıyla orantılı. Sınır konsaydı, ekranda
 * görünen bir listenin indirilememesi gibi açıklanamaz bir durum çıkardı.
 */

const SUTUNLAR: readonly XlsxSutun[] = [
  { baslik: "Ad", genislik: 18 },
  { baslik: "Soyad", genislik: 18 },
  { baslik: "Tür", genislik: 20 },
  { baslik: "E-posta", genislik: 28 },
  { baslik: "Telefon", genislik: 16 },
  { baslik: "İl / ülke", genislik: 18 },
  { baslik: "Mezun olduğu okul", genislik: 34 },
  { baslik: "Mezuniyet yılı", genislik: 13 },
  { baslik: "Şu anki durumu", genislik: 20 },
  { baslik: "Üniversite", genislik: 28 },
  { baslik: "Bölüm", genislik: 24 },
  { baslik: "Şirket / kurum", genislik: 28 },
  { baslik: "Pozisyon", genislik: 20 },
  { baslik: "Paydaş kurum", genislik: 30 },
  { baslik: "Görev unvanı", genislik: 24 },
  { baslik: "Beyan", genislik: 50 },
  { baslik: "Başvuru tarihi", genislik: 14 },
  { baslik: "Durum", genislik: 14 },
  { baslik: "Karar tarihi", genislik: 14 },
  { baslik: "Kararı veren", genislik: 22 },
  { baslik: "Ret gerekçesi", genislik: 40 },
  { baslik: "Hesap açıldı mı", genislik: 14 },
  { baslik: "Aydınlatma onayı", genislik: 16 },
];

export async function GET(istek: Request) {
  const kullanici = await oturumKullanicisi();
  if (!kullanici || !disBasvuruYonetebilirMi(kullanici)) {
    return new Response("Bulunamadı", { status: 404 });
  }

  const basvurular = await basvurulariListele("TUMU");
  const bicim = bicimCoz(new URL(istek.url));

  /*
   * Tek satır log: başvurular henüz KULLANICI DEĞİL (onaylanana kadar
   * `kullanici` satırı açılmıyor), dolayısıyla kayıt bazında loglanacak bir
   * kullanıcı kimliği de yok. Hedef, listenin kendisi.
   */
  await erisimLogla({
    kullaniciId: kullanici.id,
    islem: "GORUNTULEME",
    hedefTip: "DIS_BASVURU",
    hedefId: "liste",
    detay: `Dış giriş başvuruları ${bicim.toUpperCase()} olarak dışa aktarıldı (${basvurular.length} kayıt)`,
  });

  const satirlar = basvurular.map((basvuru) => [
    basvuru.ad,
    basvuru.soyad,
    TUR_ETIKETLERI[basvuru.tur],
    basvuru.eposta,
    basvuru.telefon ?? "",
    basvuruKonumu(basvuru),
    basvuru.mezunKurum?.ad ?? basvuru.mezunOkulAdi ?? "",
    // Mezuniyet yılı KİMLİK DEĞİL SAYI değil de metin: "2019" bir yıl etiketi,
    // toplanacak bir değer değil.
    basvuru.mezuniyetYili === null ? "" : String(basvuru.mezuniyetYili),
    basvuru.guncelDurum ? GUNCEL_DURUM_ETIKETLERI[basvuru.guncelDurum] : "",
    basvuru.universite ?? "",
    basvuru.bolum ?? "",
    basvuru.calistigiKurum ?? "",
    basvuru.pozisyon ?? "",
    basvuru.paydas?.ad ?? "",
    basvuru.gorevUnvani ?? "",
    basvuru.beyan,
    basvuru.olusturmaTarihi,
    ONAY_DURUMU_ETIKETLERI[basvuru.durum] ?? basvuru.durum,
    basvuru.kararTarihi,
    basvuru.kararVeren
      ? `${basvuru.kararVeren.ad} ${basvuru.kararVeren.soyad}`
      : "",
    basvuru.retGerekcesi ?? "",
    /*
     * "Hesap açıldı mı" onaylı ama hesabı olmayan kaydı görünür kılıyor.
     * Onay ile hesap açılışı tek transaction'da olduğu için normalde ikisi
     * birlikte olur; ayrıştıkları an elle düzeltme gerektiren bir durumdur ve
     * dosyada görünmezse fark edilmez.
     */
    basvuru.olusanKullanici ? "Evet" : "Hayır",
    basvuru.aydinlatmaOnayTarihi,
  ]);

  return disaAktarmaYaniti({
    bicim,
    dosyaAdi: "genctek-dis-basvurular",
    baslik: "GençTek Ekosistemi",
    altBaslik: altBaslikYaz("Dış giriş başvuruları", satirlar.length),
    sutunlar: SUTUNLAR,
    satirlar,
  });
}
