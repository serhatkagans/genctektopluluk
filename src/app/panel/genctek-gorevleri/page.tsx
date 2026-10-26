import { BadgeCheck, Check, Pencil, Plus, X } from "lucide-react";
import { DisaAktarmaBagi } from "@/components/DisaAktarmaBagi";
import { GorevBasvuruKuyrugu } from "@/components/GorevBasvuruKuyrugu";
import {
  BilgiKutusu,
  Kart,
  KartBasligi,
  KirintiYolu,
  Rozet,
  SayfaBasligi,
  SINIF_BIRINCIL_BUTON,
  SINIF_GIRDI,
  SINIF_IKINCIL_BUTON,
} from "@/components/ui";
import { oturumKullanicisiZorunlu } from "@/lib/auth/oturum";
import { prisma } from "@/lib/db";
import { GOREV_DURUM_ETIKETLERI } from "@/lib/gorev/kurallar";
import { tarihSaatYaz } from "@/lib/tarih";
import { gencTekGoreviYonetebilirMi } from "@/lib/yetki/izinler";
import { YetkiHatasi } from "@/lib/yetki/tipler";
import {
  gorevDurumEylemi,
  gorevDuzenleEylemi,
  gorevEkleEylemi,
  gorevKararEylemi,
} from "./eylemler";

export const dynamic = "force-dynamic";

const DURUM_MESAJLARI: Record<string, string> = {
  "karar-verildi": "Başvuru karara bağlandı; başvurana bildirim gönderildi.",
  "gorev-eklendi": "Görev açıldı ve panoda görünmeye başladı.",
  "gorev-kapatildi":
    "Görev kapatıldı; listede görünmeye devam ediyor ama yeni başvuru kabul etmiyor.",
  "gorev-acildi": "Görev yeniden başvuruya açıldı.",
  "gorev-duzenlendi": "Görev ilanı güncellendi.",
};

/**
 * GENÇTEK GÖREVLERİ — yönetim ekranı (21 Ağustos 2026).
 *
 * İstek: "yönetim panelinde yeni kart gençtek görevlerini görebilsin."
 *
 * ÜÇ İŞ TEK EKRANDA: bekleyen başvuruların kararı, görev ilanlarının durumu ve
 * yeni ilan açma. Ayrı ekranlara bölünselerdi merkez, açtığı ilanın kaç
 * başvuru aldığını görmek için ekran değiştirmek zorunda kalırdı.
 *
 * KARAR BEKLEYENLER EN ÜSTTE: karara bağlanmamış başvuru, bu ekrandaki tek
 * "yapılacak iş"tir; ilan listesi ise durum bilgisidir.
 */
export default async function GencTekGorevYonetimiSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ durum?: string; hata?: string }>;
}) {
  const kullanici = await oturumKullanicisiZorunlu();
  if (!gencTekGoreviYonetebilirMi(kullanici)) {
    throw new YetkiHatasi("GençTek görevlerini yönetme yetkiniz yok.");
  }

  const { durum, hata } = await searchParams;

  const [basvurular, gorevler] = await Promise.all([
    prisma.gencTekGorevBasvurusu.findMany({
      /*
       * Karara bağlananlar da listede: "bu kişiye ne cevap verdik" sorusunun
       * karşılığı burada olmalı. Bekleyenler önce geliyor (BEKLIYOR < ONAYLANDI
       * < REDDEDILDI değil — sıralama açık yazıldı).
       */
      orderBy: [{ onayDurumu: "asc" }, { olusturmaTarihi: "desc" }],
      take: 200,
      select: {
        id: true,
        mesaj: true,
        onayDurumu: true,
        retGerekcesi: true,
        olusturmaTarihi: true,
        kararTarihi: true,
        kullaniciId: true,
        gorev: { select: { ad: true } },
        kullanici: {
          select: {
            ad: true,
            soyad: true,
            sinif: true,
            brans: true,
            kurum: { select: { ad: true } },
            il: { select: { ad: true } },
          },
        },
      },
    }),
    prisma.gencTekGorevi.findMany({
      orderBy: [{ aktif: "desc" }, { siraNo: "asc" }],
      select: {
        id: true,
        ad: true,
        aciklama: true,
        kontenjan: true,
        aktif: true,
        /*
         * İKİ SAYIM: "kaç kişi görevde" (onaylı) ile "kaç kişi başvurdu"
         * (hepsi) farklı sorular. Excel bağlantısının yanındaki sayı dosyanın
         * satır sayısıdır — onaylı sayısı yazılsaydı bağlantı, indirilen
         * dosyadan az satır vadederdi.
         */
        _count: {
          select: {
            basvurular: { where: { onayDurumu: "ONAYLANDI" } },
          },
        },
        basvurular: { select: { id: true } },
      },
    }),
  ]);

  const bekleyenler = basvurular.filter(
    (basvuru) => basvuru.onayDurumu === "BEKLIYOR",
  );
  const kararaBaglananlar = basvurular.filter(
    (basvuru) => basvuru.onayDurumu !== "BEKLIYOR",
  );

  return (
    <div className="space-y-6">
      {/*
        KIRINTI YOLU · ÜST BASAMAK PANO (29 Ağustos 2026 · istek: "bu iki
        kartın navigasyonu bunların yönetim panelinde olduğunu söylüyor, ama
        onları taşıdık, panoyu göstermesi gerek").

        Ekranın kapısı 27 Ağustos'ta Yönetim Paneli'nden PANOYA taşındı
        (bkz. app/panel/talepler/page.tsx · "onay kuyrukları üç ayrı kart");
        panoda artık kendi kartı var, Yönetim Paneli'nde yok. Şerit bu yüzden
        Pano diyor — kişiyi geldiği kartın durduğu ekrana döndürmeyen bir
        basamak, boş bir kapı gösterirdi.

        SON BASAMAK BAĞLANTI DEĞİL (bkz. components/ui.tsx · KirintiYolu);
        SayfaBasligi'nın geri bağlantısı bu yüzden `null`.
      */}
      <KirintiYolu
        basamaklar={[
          { etiket: "Pano", yol: "/panel/talepler" },
          { etiket: "GençTek görevi onayları" },
        ]}
      />

      <SayfaBasligi
        baslik="GençTek Görevleri"
        aciklama={`${gorevler.filter((gorev) => gorev.aktif).length} açık görev · ${bekleyenler.length} başvuru karar bekliyor`}
        geri={null}
      />

      {durum && DURUM_MESAJLARI[durum] && (
        <BilgiKutusu cesit="olumlu">{DURUM_MESAJLARI[durum]}</BilgiKutusu>
      )}
      {hata && <BilgiKutusu cesit="hata">{hata}</BilgiKutusu>}

      {/*
        KUYRUK ORTAK BİLEŞEN (26 Ağustos 2026): aynı liste ve karar formu
        Onay kuyruğu ekranında da basılıyor. İki kopya, biri değişip öbürü
        geride kalacak iki karar formu demekti.
      */}
      <GorevBasvuruKuyrugu basvurular={bekleyenler} donus="yonetim" />
      <Kart>
        <KartBasligi
          baslik="Görev ilanları"
          aciklama="Kapatılan ilan listede görünmeye devam eder ama yeni başvuru kabul etmez; başvuruları kayıtta kalır."
        />
        <ul className="divide-y divide-cizgi">
          {gorevler.map((gorev) => (
            <li key={gorev.id} className="py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-metin">
                    {gorev.ad}
                    <span className="ml-2 inline-block align-middle">
                      <Rozet cesit={gorev.aktif ? "olumlu" : "notr"}>
                        {gorev.aktif ? "Açık" : "Kapalı"}
                      </Rozet>
                    </span>
                  </p>
                  <p className="mt-0.5 text-sm text-metin-yumusak">
                    {gorev.kontenjan === null
                      ? `${gorev._count.basvurular} kişi görevde · kontenjan sınırsız`
                      : `${gorev._count.basvurular}/${gorev.kontenjan} kişi görevde`}
                    {gorev.basvurular.length > gorev._count.basvurular &&
                      ` · ${gorev.basvurular.length} başvuru`}
                  </p>
                  {/*
                    LİSTE ÇIKTISI İLANIN YANINDA (22 Ağustos 2026 · istek: "her
                    görev için excel listesi alınabilsin — kaç kişi, kimler
                    doldurdu vs"). Ekran onayları görev görev değil kişi kişi
                    gösteriyor; "bu ekipte kimler var" sorusunun cevabı ancak
                    dosyada tek listede duruyor.

                    BAŞVURUSU OLMAYAN İLANDA DA BASILIYOR: önce sıfır
                    başvuruda gizleniyordu ("boş dosya kimsenin işine yaramaz")
                    ama bağlantının gelip gitmesi, onu arayan kişiye özelliğin
                    hiç olmadığını düşündürdü. Yanındaki sayı zaten dosyanın
                    boş olduğunu söylüyor.
                  */}
                  <p className="mt-2">
                    <DisaAktarmaBagi
                      yol={`/panel/genctek-gorevleri/${gorev.id}/disa-aktar`}
                      kayitSayisi={gorev.basvurular.length}
                      etiket="Başvuru listesi"
                    />
                  </p>
                </div>
                <form action={gorevDurumEylemi}>
                  <input type="hidden" name="gorevId" value={gorev.id} />
                  <button type="submit" className={SINIF_IKINCIL_BUTON}>
                    {gorev.aktif ? "Kapat" : "Yeniden aç"}
                  </button>
                </form>
              </div>

              {/*
                DÜZENLEME KATLI GELİYOR (22 Ağustos 2026 · istek: "görev
                ilanları düzenlenebilsin"). Beş ilanın beş formu birden açık
                dursaydı liste, okunacak bir durum özeti olmaktan çıkıp beş
                formluk bir sayfaya dönerdi — bu ekrandaki asıl iş kararlar,
                düzenleme ara sıra yapılan bir düzeltme.

                Alanlar MEVCUT DEĞERLERLE dolu: boş form, düzenlemeyi baştan
                yazmaya çevirirdi.
              */}
              <details className="group mt-2">
                <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-vurgu-metin">
                  <Pencil size={14} aria-hidden />
                  Düzenle
                </summary>
                <form
                  action={gorevDuzenleEylemi}
                  className="mt-3 space-y-3 rounded-kutu border border-cizgi p-4"
                >
                  <input type="hidden" name="gorevId" value={gorev.id} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="text-sm font-medium text-metin">
                        Görev adı
                      </span>
                      <input
                        type="text"
                        name="ad"
                        required
                        maxLength={200}
                        defaultValue={gorev.ad}
                        className={SINIF_GIRDI}
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm font-medium text-metin">
                        Kontenjan{" "}
                        <span className="text-metin-yumusak">
                          (boş bırakılırsa sınırsız)
                        </span>
                      </span>
                      <input
                        type="number"
                        name="kontenjan"
                        min={1}
                        defaultValue={gorev.kontenjan ?? ""}
                        className={SINIF_GIRDI}
                      />
                    </label>
                  </div>
                  <label className="block">
                    <span className="text-sm font-medium text-metin">
                      Açıklama
                    </span>
                    <textarea
                      name="aciklama"
                      required
                      rows={3}
                      defaultValue={gorev.aciklama}
                      className={SINIF_GIRDI}
                    />
                  </label>
                  <button type="submit" className={SINIF_BIRINCIL_BUTON}>
                    <Check size={15} aria-hidden />
                    Kaydet
                  </button>
                </form>
              </details>
            </li>
          ))}
        </ul>
      </Kart>

      <Kart>
        <KartBasligi baslik="Yeni görev aç" Ikon={Plus} />
        <form action={gorevEkleEylemi} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-metin">Görev adı</span>
              <input
                type="text"
                name="ad"
                required
                maxLength={200}
                placeholder="Örn. EBA Asistan Test Ekibi"
                className={SINIF_GIRDI}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-metin">
                Kontenjan{" "}
                <span className="text-metin-yumusak">
                  (boş bırakılırsa sınırsız)
                </span>
              </span>
              <input
                type="number"
                name="kontenjan"
                min={1}
                className={SINIF_GIRDI}
              />
            </label>
          </div>
          <label className="block">
            <span className="text-sm font-medium text-metin">Açıklama</span>
            <textarea
              name="aciklama"
              required
              rows={3}
              placeholder="Görevin ne olduğu, kimleri aradığınız ve görevin kişiden ne beklediği."
              className={SINIF_GIRDI}
            />
          </label>
          <button type="submit" className={SINIF_BIRINCIL_BUTON}>
            <Plus size={15} aria-hidden />
            Görevi aç
          </button>
        </form>
      </Kart>

      {kararaBaglananlar.length > 0 && (
        <Kart>
          <KartBasligi
            baslik={`Karara bağlananlar (${kararaBaglananlar.length})`}
          />
          <ul className="divide-y divide-cizgi">
            {kararaBaglananlar.map((basvuru) => (
              <li key={basvuru.id} className="py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-metin">
                    {basvuru.kullanici.ad} {basvuru.kullanici.soyad}
                    <span className="ml-2 text-sm text-metin-yumusak">
                      {basvuru.gorev.ad}
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    <Rozet
                      cesit={
                        basvuru.onayDurumu === "ONAYLANDI" ? "olumlu" : "hata"
                      }
                    >
                      {GOREV_DURUM_ETIKETLERI[basvuru.onayDurumu]}
                    </Rozet>
                    {basvuru.kararTarihi && (
                      <span className="text-sm text-metin-yumusak">
                        {tarihSaatYaz(basvuru.kararTarihi)}
                      </span>
                    )}
                  </span>
                </div>
                {basvuru.retGerekcesi && (
                  <p className="mt-1 text-sm text-metin-yumusak">
                    Gerekçe: {basvuru.retGerekcesi}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Kart>
      )}
    </div>
  );
}
