import { BadgeCheck, Check, Pencil, Plus, X } from "lucide-react";
import { DisaAktarmaBagi } from "@/components/DisaAktarmaBagi";
import { GorevBasvuruKuyrugu } from "@/components/GorevBasvuruKuyrugu";
import { SiralanabilirGorevListesi } from "@/components/SiralanabilirGorevListesi";
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
import { uygulamaYolu } from "@/lib/ortam";
import { tarihSaatYaz } from "@/lib/tarih";
import { gencTekGoreviYonetebilirMi } from "@/lib/yetki/izinler";
import { YetkiHatasi } from "@/lib/yetki/tipler";
import {
  gorevDurumEylemi,
  gorevDuzenleEylemi,
  gorevEkleEylemi,
  gorevKararEylemi,
  gorevSiralaEylemi,
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
  searchParams: Promise<{ durum?: string; hata?: string; il?: string }>;
}) {
  const kullanici = await oturumKullanicisiZorunlu();
  if (!gencTekGoreviYonetebilirMi(kullanici)) {
    throw new YetkiHatasi("GençTek görevlerini yönetme yetkiniz yok.");
  }

  const { durum, hata, il } = await searchParams;
  /*
   * İL SÜZGECİ (25 Kasım 2026 · istek: "burada hangi ilden görebiliyor muyuz ·
   * mesela ankara istedi benim ilimden seminer vermek için başvuran çocuk var
   * mı diye"). Süzgeç başvuranın kayıtlı iline bakıyor; il kodu iki hane,
   * başka bir değer süzgeçsiz sayılır.
   */
  const seciliIl = il && /^\d{2}$/.test(il) ? il : null;
  const ilSarti = seciliIl ? { kullanici: { ilKodu: seciliIl } } : {};

  const [basvurular, gorevler, ilDagilimi] = await Promise.all([
    prisma.gencTekGorevBasvurusu.findMany({
      where: ilSarti,
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
    /*
     * Süzgeçteki iller yalnızca başvurusu olanlar: 81 ilin çoğu boş
     * dönecekti. Görev başına sayım da buradan çıkıyor.
     */
    prisma.gencTekGorevBasvurusu.findMany({
      select: {
        gorevId: true,
        onayDurumu: true,
        kullanici: { select: { il: { select: { ilKodu: true, ad: true } } } },
      },
    }),
  ]);

  const ilSecenekleri = [
    ...ilDagilimi
      .reduce((harita, satir) => {
        const ilBilgisi = satir.kullanici.il;
        if (!ilBilgisi) return harita;
        const kayit = harita.get(ilBilgisi.ilKodu) ?? {
          ilKodu: ilBilgisi.ilKodu,
          ad: ilBilgisi.ad,
          sayi: 0,
        };
        kayit.sayi += 1;
        return harita.set(ilBilgisi.ilKodu, kayit);
      }, new Map<string, { ilKodu: string; ad: string; sayi: number }>())
      .values(),
  ].sort((a, b) => a.ad.localeCompare(b.ad, "tr"));
  const seciliIlAdi =
    ilSecenekleri.find((secenek) => secenek.ilKodu === seciliIl)?.ad ?? null;
  /* Seçili ilde görev başına başvuru ve onaylı sayısı. */
  const ildekiSayim = new Map<number, { basvuru: number; onayli: number }>();
  if (seciliIl) {
    for (const satir of ilDagilimi) {
      if (satir.kullanici.il?.ilKodu !== seciliIl) continue;
      const sayim = ildekiSayim.get(satir.gorevId) ?? { basvuru: 0, onayli: 0 };
      sayim.basvuru += 1;
      if (satir.onayDurumu === "ONAYLANDI") sayim.onayli += 1;
      ildekiSayim.set(satir.gorevId, sayim);
    }
  }
  const ilSorgusu = seciliIl ? `?il=${seciliIl}` : "";

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
        aciklama={`${gorevler.filter((gorev) => gorev.aktif).length} açık görev · ${bekleyenler.length} başvuru karar bekliyor${seciliIlAdi ? ` (${seciliIlAdi})` : ""}`}
        geri={null}
      />

      {durum && DURUM_MESAJLARI[durum] && (
        <BilgiKutusu cesit="olumlu">{DURUM_MESAJLARI[durum]}</BilgiKutusu>
      )}
      {hata && <BilgiKutusu cesit="hata">{hata}</BilgiKutusu>}

      {/*
        İL SÜZGECİ (25 Kasım 2026). GET formu, eylem adresi yok: form bulunduğu
        adrese gönderiliyor, yani TEMEL_YOL altında da doğru yere düşüyor.
        Seçim karar kuyruğunu, görev sayımlarını, karara bağlananları ve
        Excel'i birlikte daraltıyor.
      */}
      <Kart>
        <form method="get" className="flex flex-wrap items-end gap-2">
          <label className="block grow sm:max-w-xs">
            <span className="text-sm font-medium text-metin">
              Başvuranın ili
            </span>
            <select
              name="il"
              defaultValue={seciliIl ?? ""}
              className={SINIF_GIRDI}
            >
              <option value="">Bütün iller</option>
              {ilSecenekleri.map((secenek) => (
                <option key={secenek.ilKodu} value={secenek.ilKodu}>
                  {secenek.ad} ({secenek.sayi} başvuru)
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className={SINIF_IKINCIL_BUTON}>
            Göster
          </button>
          {seciliIl && (
            <a
              href={uygulamaYolu("/panel/genctek-gorevleri")}
              className="inline-flex items-center gap-1 px-2 py-2.5 text-sm font-medium text-vurgu-metin"
            >
              <X size={14} aria-hidden />
              Süzgeci kaldır
            </a>
          )}
        </form>
        {seciliIl && (
          <p className="mt-3 text-sm text-metin-yumusak">
            {seciliIlAdi ?? "Bu il"} için{" "}
            {ildekiSayim.size === 0
              ? "başvuru yok."
              : [...ildekiSayim.values()].reduce((t, s) => t + s.basvuru, 0) +
                " başvuru gösteriliyor."}
          </p>
        )}
      </Kart>

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
        {/*
          SÜRÜKLE-BIRAK SIRALAMA (27 Ekim 2026 · istek: "alt alta … fare ile
          sürüklenebilir yapabilsin proje yöneticisi"). Satırlar burada
          basılıyor; liste bileşeni yalnızca sırayı tutup kaydediyor. Anahtar
          sıra ve durum değişince bileşeni sıfırlıyor: başka bir eylemden
          (kapatma, yeni görev) dönüldüğünde eski sıra ekranda kalmasın.
        */}
        <SiralanabilirGorevListesi
          key={gorevler.map((gorev) => `${gorev.id}:${gorev.aktif}`).join(",")}
          siralaEylemi={gorevSiralaEylemi}
          ogeler={gorevler.map((gorev) => ({
            id: gorev.id,
            aktif: gorev.aktif,
            icerik: (
              <>
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
                    {seciliIl && (
                      <p className="mt-0.5 text-sm font-medium text-metin">
                        {seciliIlAdi ?? "Seçili il"}:{" "}
                        {ildekiSayim.get(gorev.id)
                          ? `${ildekiSayim.get(gorev.id)!.basvuru} başvuru · ${ildekiSayim.get(gorev.id)!.onayli} görevde`
                          : "başvuru yok"}
                      </p>
                    )}
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
                        yol={`/panel/genctek-gorevleri/${gorev.id}/disa-aktar${ilSorgusu}`}
                        kayitSayisi={
                          seciliIl
                            ? (ildekiSayim.get(gorev.id)?.basvuru ?? 0)
                            : gorev.basvurular.length
                        }
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
              </>
            ),
          }))}
        />
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
                      {[basvuru.gorev.ad, basvuru.kullanici.il?.ad]
                        .filter(Boolean)
                        .join(" · ")}
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
