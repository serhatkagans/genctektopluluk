import { oturumKullanicisi } from "@/lib/auth/oturum";
import { prisma } from "@/lib/db";
import { GOREV_DURUM_ETIKETLERI } from "@/lib/gorev/kurallar";
import {
  altBaslikYaz,
  bicimCoz,
  disaAktarmaYaniti,
} from "@/lib/rapor/disa-aktarma";
import type { XlsxSutun } from "@/lib/rapor/xlsx";
import { ROL_ETIKETLERI } from "@/lib/yetki/etiketler";
import { gencTekGoreviYonetebilirMi } from "@/lib/yetki/izinler";
import { erisimLoglaCoklu } from "@/lib/yetki/log";

export const dynamic = "force-dynamic";

/**
 * BİR GENÇTEK GÖREVİNİN BAŞVURU LİSTESİ (22 Ağustos 2026 · istek: "her görev
 * için excel listesi alınabilsin — kaç kişi, kimler doldurdu vs").
 *
 * GÖREV BAŞINA AYRI DOSYA, tek büyük liste değil: merkezin sorusu "EBA Asistan
 * ekibinde kimler var" biçiminde soruluyor ve tek dosyada bütün görevler
 * karışsaydı okuyan kişi her seferinde süzmek zorunda kalırdı.
 *
 * KARARA BAĞLANMAMIŞLAR DA LİSTEDE: dosya "kimler görevde" sorusunun yanında
 * "kimler istedi" sorusunu da cevaplıyor ve durum sütunu ikisini ayırıyor.
 * Sıra ekranınkiyle aynı — önce bekleyenler, sonra karar tarihine göre.
 *
 * BAŞVURU MESAJI SON SÜTUN: kararın dayanağı o metin ve uzun; ortada duran bir
 * sütun tabloyu okunmaz hâle getirirdi.
 *
 * Kapı ekranınkiyle AYNI (`gencTekGoreviYonetebilirMi`): indirme yolu, ekranın
 * yetki kapısını dolaşmanın arka kapısı olmamalı.
 */

const SUTUNLAR: readonly XlsxSutun[] = [
  { baslik: "Ad", genislik: 18 },
  { baslik: "Soyad", genislik: 18 },
  { baslik: "Sistem görevi", genislik: 20 },
  { baslik: "Sınıf / branş", genislik: 18 },
  { baslik: "Okul", genislik: 38 },
  { baslik: "İl", genislik: 14 },
  { baslik: "İlçe", genislik: 16 },
  { baslik: "Durum", genislik: 14 },
  { baslik: "Başvuru tarihi", genislik: 14 },
  { baslik: "Karar tarihi", genislik: 14 },
  { baslik: "Karar veren", genislik: 22 },
  { baslik: "Ret gerekçesi", genislik: 36 },
  { baslik: "Başvuru mesajı", genislik: 60 },
];

export async function GET(
  istek: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const kullanici = await oturumKullanicisi();
  if (!kullanici || !gencTekGoreviYonetebilirMi(kullanici)) {
    return new Response("Bulunamadı", { status: 404 });
  }

  const { id } = await params;
  const gorevId = Number.parseInt(id, 10);
  if (!Number.isFinite(gorevId)) {
    return new Response("Bulunamadı", { status: 404 });
  }

  const gorev = await prisma.gencTekGorevi.findUnique({
    where: { id: gorevId },
    select: { id: true, ad: true, kontenjan: true },
  });
  if (!gorev) {
    return new Response("Bulunamadı", { status: 404 });
  }

  /* Ekrandaki il süzgeci dosyaya da geçiyor (25 Kasım 2026). */
  const il = new URL(istek.url).searchParams.get("il");
  const seciliIl = il && /^\d{2}$/.test(il) ? il : null;

  const basvurular = await prisma.gencTekGorevBasvurusu.findMany({
    where: {
      gorevId: gorev.id,
      ...(seciliIl ? { kullanici: { ilKodu: seciliIl } } : {}),
    },
    // Bekleyenler önce: dosyayı açan kişinin ilk aradığı şey yapılacak iştir.
    orderBy: [{ onayDurumu: "asc" }, { olusturmaTarihi: "asc" }],
    select: {
      kullaniciId: true,
      mesaj: true,
      onayDurumu: true,
      retGerekcesi: true,
      olusturmaTarihi: true,
      kararTarihi: true,
      kararVeren: { select: { ad: true, soyad: true } },
      kullanici: {
        select: {
          ad: true,
          soyad: true,
          sinif: true,
          brans: true,
          roller: { where: { bitisTarihi: null }, select: { rolKodu: true } },
          kurum: { select: { ad: true } },
          il: { select: { ad: true } },
          ilce: { select: { ad: true } },
        },
      },
    },
  });

  const bicim = bicimCoz(new URL(istek.url));

  /*
   * Her satır ayrı loglanıyor: denetimde sorulan şey "bu kişinin kaydını kim
   * gördü" ve tek bir "liste indirildi" satırı o soruyu cevaplamaz.
   */
  await erisimLoglaCoklu(
    basvurular.map((basvuru) => ({
      kullaniciId: kullanici.id,
      islem: "GORUNTULEME" as const,
      hedefTip: "PROFIL" as const,
      hedefId: basvuru.kullaniciId,
      detay: `GençTek görev listesi ${bicim.toUpperCase()} olarak dışa aktarıldı: ${gorev.ad}`,
    })),
  );

  const satirlar = basvurular.map((basvuru) => [
    basvuru.kullanici.ad,
    basvuru.kullanici.soyad,
    /*
     * `kullaniciRolEtiketi` KULLANILMIYOR: o yardımcı tam bir oturum kaydı
     * istiyor, buradaysa yalnızca rol kodları çekiliyor. Rolsüz kullanıcı da
     * başvurabilir; boş hücre "rolü yok" demenin en dürüst yolu.
     */
    basvuru.kullanici.roller
      .map((rol) => ROL_ETIKETLERI[rol.rolKodu])
      .join(" · "),
    basvuru.kullanici.sinif ?? basvuru.kullanici.brans ?? "",
    basvuru.kullanici.kurum?.ad ?? "",
    basvuru.kullanici.il?.ad ?? "",
    basvuru.kullanici.ilce?.ad ?? "",
    GOREV_DURUM_ETIKETLERI[basvuru.onayDurumu] ?? basvuru.onayDurumu,
    basvuru.olusturmaTarihi,
    basvuru.kararTarihi,
    basvuru.kararVeren
      ? `${basvuru.kararVeren.ad} ${basvuru.kararVeren.soyad}`
      : "",
    basvuru.retGerekcesi ?? "",
    basvuru.mesaj,
  ]);

  const gorevdeki = basvurular.filter(
    (basvuru) => basvuru.onayDurumu === "ONAYLANDI",
  ).length;

  return disaAktarmaYaniti({
    bicim,
    /*
     * Dosya adında görev kimliği var, adı değil: görev adı boşluk ve Türkçe
     * harf taşıyor, dosya adı ise indiren makinede ne olacağı bilinmeyen bir
     * yere düşüyor. Görevin adı dosyanın İÇİNDE, alt başlıkta yazıyor.
     */
    dosyaAdi: `genctek-gorevi-${gorev.id}`,
    baslik: "GençTek Ekosistemi",
    altBaslik: altBaslikYaz(
      `${gorev.ad} · ${gorevdeki} kişi görevde${
        gorev.kontenjan === null ? "" : ` / ${gorev.kontenjan} kontenjan`
      }`,
      satirlar.length,
    ),
    sutunlar: SUTUNLAR,
    satirlar,
  });
}
