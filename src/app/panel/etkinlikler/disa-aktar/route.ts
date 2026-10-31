import { oturumKullanicisi } from "@/lib/auth/oturum";
import {
  AYAR_ANAHTARLARI,
  ayarSayi,
  VARSAYILAN_DISA_AKTARMA_UST_SINIRI,
} from "@/lib/ayar";
import { prisma } from "@/lib/db";
import {
  ETKINLIK_KATEGORISI_ETIKETLERI,
  FAALIYET_DURUMU_ETIKETLERI,
  KAPSAM_ETIKETLERI,
  kontenjanDurumu,
  ONAY_DURUMU_ETIKETLERI,
} from "@/lib/faaliyet/kurallar";
import {
  altBaslikYaz,
  bicimCoz,
  disaAktarmaYaniti,
} from "@/lib/rapor/disa-aktarma";
import type { XlsxSutun } from "@/lib/rapor/xlsx";
import { faaliyetDisaAktarabilirMi } from "@/lib/yetki/izinler";
import { erisimLoglaCoklu } from "@/lib/yetki/log";
import type { SorguParametreleri } from "../../ogrenciler/filtreler";
import {
  faaliyetFiltreleriniCoz,
  faaliyetListeFiltresi,
  faaliyetSiralamasi,
  ilAdlariniGetir,
} from "../filtreler";

export const dynamic = "force-dynamic";

/**
 * Faaliyet listesinin dosya çıktısı (varsayılan XLSX, `?bicim=csv` ile CSV).
 *
 * Ekranla aynı kapsam ve aynı filtrelerden geçer. Başvuru sayıları özet olarak
 * yazılır; başvuran ÖĞRENCİ adları burada yoktur — onlar faaliyetin
 * değerlendirme ekranına aittir ve o ekranın yetkisi ayrıdır
 * (references/permissions.md Bölüm 3).
 */

const SUTUNLAR: readonly XlsxSutun[] = [
  { baslik: "Etkinlik", genislik: 42 },
  { baslik: "Tarih", genislik: 12 },
  { baslik: "Kapsam", genislik: 14 },
  { baslik: "Etkinlik kategorisi", genislik: 24 },
  { baslik: "Program", genislik: 28 },
  { baslik: "Düzenleyen birim", genislik: 28 },
  { baslik: "Yer (okul/il)", genislik: 34 },
  { baslik: "Başvuru başlangıç", genislik: 15 },
  { baslik: "Başvuru bitiş", genislik: 15 },
  { baslik: "Kontenjan", genislik: 11 },
  { baslik: "Aktif başvuru", genislik: 12 },
  { baslik: "Seçilen", genislik: 10 },
  { baslik: "Yedek", genislik: 9 },
  { baslik: "Onay durumu", genislik: 16 },
  { baslik: "Etkinlik durumu", genislik: 15 },
  { baslik: "Çalışma grupları", genislik: 34 },
];

export async function GET(istek: Request) {
  const kullanici = await oturumKullanicisi();
  if (!kullanici) {
    return new Response("Bulunamadı", { status: 404 });
  }
  // CSV öğrencide yok; ekrandaki bağlantıyı gizlemek yetmez, adres çubuğundan
  // gelen istek de dosyayı almamalı (bkz. faaliyetDisaAktarabilirMi).
  if (!faaliyetDisaAktarabilirMi(kullanici)) {
    return new Response("Bulunamadı", { status: 404 });
  }

  const adres = new URL(istek.url);
  const parametreler: SorguParametreleri = Object.fromEntries(
    adres.searchParams.entries(),
  );
  const simdi = new Date();
  const nerede = faaliyetListeFiltresi(
    kullanici,
    faaliyetFiltreleriniCoz(parametreler),
    simdi,
    await ilAdlariniGetir(),
  );

  const [toplam, ustSinir] = await Promise.all([
    prisma.faaliyet.count({ where: nerede }),
    ayarSayi(
      AYAR_ANAHTARLARI.DISA_AKTARMA_UST_SINIRI,
      VARSAYILAN_DISA_AKTARMA_UST_SINIRI,
    ),
  ]);

  if (toplam > ustSinir) {
    return new Response(
      `Bu filtrelerle ${toplam} kayıt var; tek dosyada en fazla ${ustSinir} kayıt indirilebilir. ` +
        "Lütfen kapsam veya kategori filtresiyle daraltın.",
      { status: 413, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  }

  const faaliyetler = await prisma.faaliyet.findMany({
    where: nerede,
    orderBy: faaliyetSiralamasi(faaliyetFiltreleriniCoz(parametreler).sira),
    select: {
      id: true,
      ad: true,
      tarih: true,
      kapsam: true,
      etkinlikKategorisi: true,
      temelEtkinlikProgrami: { select: { ad: true } },
      kontenjan: true,
      onayDurumu: true,
      durum: true,
      duzenleyenBirim: true,
      basvuruBaslangic: true,
      basvuruBitis: true,
      kurum: { select: { ad: true } },
      il: { select: { ad: true } },
      calismaGruplari: {
        select: { calismaGrubu: { select: { ad: true } } },
      },
      basvurular: { select: { durum: true } },
    },
  });

  const bicim = bicimCoz(adres);

  await erisimLoglaCoklu(
    faaliyetler.map((faaliyet) => ({
      kullaniciId: kullanici.id,
      islem: "GORUNTULEME" as const,
      hedefTip: "FAALIYET" as const,
      hedefId: faaliyet.id,
      detay: `Etkinlik listesi ${bicim.toUpperCase()} olarak dışa aktarıldı`,
    })),
  );

  const satirlar = faaliyetler.map((faaliyet) => {
    const kontenjan = kontenjanDurumu(faaliyet.basvurular, faaliyet.kontenjan);
    const secilen = faaliyet.basvurular.filter(
      (basvuru) => basvuru.durum === "SECILDI",
    ).length;
    const yedek = faaliyet.basvurular.filter(
      (basvuru) => basvuru.durum === "YEDEK",
    ).length;

    return [
      faaliyet.ad,
      faaliyet.tarih,
      KAPSAM_ETIKETLERI[faaliyet.kapsam],
      ETKINLIK_KATEGORISI_ETIKETLERI[faaliyet.etkinlikKategorisi],
      faaliyet.temelEtkinlikProgrami?.ad ?? "",
      faaliyet.duzenleyenBirim,
      faaliyet.kurum?.ad ?? faaliyet.il?.ad ?? "",
      faaliyet.basvuruBaslangic,
      faaliyet.basvuruBitis,
      faaliyet.kontenjan,
      kontenjan.aktifBasvuru,
      secilen,
      yedek,
      ONAY_DURUMU_ETIKETLERI[faaliyet.onayDurumu],
      FAALIYET_DURUMU_ETIKETLERI[faaliyet.durum],
      faaliyet.calismaGruplari
        .map((etiket) => etiket.calismaGrubu.ad)
        .join(", "),
    ];
  });

  return disaAktarmaYaniti({
    bicim,
    dosyaAdi: "genctek-etkinlikler",
    baslik: "GençTek Ekosistemi",
    altBaslik: altBaslikYaz("Etkinlik listesi", satirlar.length),
    sutunlar: SUTUNLAR,
    satirlar,
  });
}
