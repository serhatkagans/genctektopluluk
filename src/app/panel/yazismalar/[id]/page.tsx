import { EyeOff, Lock, Send } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import {
  BAGLANTILARIM_KAPALI_ACIKLAMASI,
  baglantilarimKapaliMi,
} from "@/lib/yazisma/politika";
import {
  BilgiKutusu,
  Kart,
  KartBasligi,
  KirintiYolu,
  SayfaBasligi,
  SINIF_BIRINCIL_BUTON,
  SINIF_GIRDI,
  SINIF_IKINCIL_BUTON,
} from "@/components/ui";
import { MetinBaglantili } from "@/components/MetinBaglantili";
import { oturumKullanicisiZorunlu } from "@/lib/auth/oturum";
import { prisma } from "@/lib/db";
import { GIZLILIK_UYARISI } from "@/lib/iletisim/kurallar";
import { tarihSaatYaz } from "@/lib/tarih";
import { danismanMi, ilKoordinatoruMu, projeYoneticisiMi } from "@/lib/yetki/izinler";
import { yazismaKapsamFiltresi } from "@/lib/yetki/kapsam";
import { erisimLogla } from "@/lib/yetki/log";
import {
  mesajGizleEylemi,
  mesajYazEylemi,
  yazismaKapatEylemi,
} from "../eylemler";

export const dynamic = "force-dynamic";

/**
 * Tek yazışma — analiz isteği Bölüm 6, Aşama 3.
 *
 * OKUMA ile YAZMA ayrı: danışman ve koordinatör yazışmayı okur ama taraf
 * değilse yazamaz. Gözetim, sohbete katılma hakkı vermez ve ekran bunu açıkça
 * söyler — aksi halde öğrenciler öğretmenin sessizce izlediğini fark etmez.
 *
 * Gizlenen mesaj SİLİNMEZ: taraflara "gizlendi" olarak, gözetim yetkisi
 * olanlara İÇERİĞİYLE görünür. Şikâyet incelemesinde en çok ihtiyaç duyulan
 * kayıt, gizlenmiş mesajdır.
 */
export default async function YazismaSayfasi({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ durum?: string; hata?: string }>;
}) {
  const [{ id }, { durum, hata }] = await Promise.all([params, searchParams]);
  const kullanici = await oturumKullanicisiZorunlu();
  // Bağlantılarım öğrenciye kapalı (23 Ekim 2026 · bkz. lib/yazisma/politika.ts).
  if (baglantilarimKapaliMi(kullanici)) {
    redirect(`/panel?hata=${encodeURIComponent(BAGLANTILARIM_KAPALI_ACIKLAMASI)}`);
  }

  const yazismaId = Number.parseInt(id, 10);
  if (!Number.isInteger(yazismaId)) notFound();

  const yazisma = await prisma.yazisma.findFirst({
    where: {
      AND: [{ baglantiIstegiId: yazismaId }, yazismaKapsamFiltresi(kullanici)],
    },
    select: {
      baglantiIstegiId: true,
      kapatildiMi: true,
      baglantiIstegi: {
        select: {
          mesaj: true,
          onayDurumu: true,
          isteyenKullaniciId: true,
          hedefKullaniciId: true,
          isteyen: {
            select: { ad: true, soyad: true, kurum: { select: { ad: true } } },
          },
          hedef: {
            select: { ad: true, soyad: true, kurum: { select: { ad: true } } },
          },
          kararVeren: { select: { ad: true, soyad: true } },
          kararTarihi: true,
        },
      },
      mesajlar: {
        orderBy: { olusturmaTarihi: "asc" },
        select: {
          id: true,
          icerik: true,
          gizlendiMi: true,
          olusturmaTarihi: true,
          yazanKullaniciId: true,
          yazan: { select: { ad: true, soyad: true } },
          gizleyen: { select: { ad: true, soyad: true } },
        },
      },
    },
  });
  if (!yazisma) notFound();

  const tarafMi =
    yazisma.baglantiIstegi.isteyenKullaniciId === kullanici.id ||
    yazisma.baglantiIstegi.hedefKullaniciId === kullanici.id;
  const gozetimYetkisi =
    danismanMi(kullanici) ||
    ilKoordinatoruMu(kullanici) ||
    projeYoneticisiMi(kullanici);

  /*
   * Başkasının yazışmasını okumak KİŞİSEL VERİYE ERİŞİMDİR ve kayda geçer.
   * Kendi yazışmasını okuyan için kayıt tutulmuyor: her açılışta satır
   * üretirdi ve kişinin kendi verisine bakması erişim olayı değildir.
   */
  /*
   * OKUNDU İŞARETİ (26 Ağustos 2026 · istek: "yeni mesaj ya da okunmamış mesaj
   * varsa kırmızı çerçeve olsun"). Yazışmayı açmak onu okumaktır; liste
   * ekranındaki kırmızı çerçeve bu satıra bakıyor.
   *
   * GÖZETİM İÇİN DE YAZILIR: danışman ve koordinatör de okunmamış işareti
   * görüyor, kaydı yalnızca taraflar için tutsaydık onların listesinde çerçeve
   * hiç sönmezdi.
   *
   * Yazma başarısız olursa sayfa yine açılır: okunma işareti bir kolaylık,
   * yazışmanın kendisi değil.
   */
  await prisma.yazismaOkuma
    .upsert({
      where: {
        yazismaId_kullaniciId: {
          yazismaId: yazisma.baglantiIstegiId,
          kullaniciId: kullanici.id,
        },
      },
      update: { sonOkumaTarihi: new Date() },
      create: {
        yazismaId: yazisma.baglantiIstegiId,
        kullaniciId: kullanici.id,
      },
    })
    .catch((sebep: unknown) => {
      console.error("Yazışma okuma işareti yazılamadı:", sebep);
    });

  if (!tarafMi) {
    await erisimLogla({
      kullaniciId: kullanici.id,
      islem: "GORUNTULEME",
      hedefTip: "PROFIL",
      hedefId: yazisma.baglantiIstegiId,
      detay: `Başkasının yazışması okundu: ${yazisma.baglantiIstegi.isteyen.ad} ${yazisma.baglantiIstegi.isteyen.soyad} ↔ ${yazisma.baglantiIstegi.hedef.ad} ${yazisma.baglantiIstegi.hedef.soyad}`,
    });
  }

  return (
    <div className="space-y-6">
      {/*
        KIRINTI YOLU (29 Ağustos 2026 · istek: "bağlantılarımda hâlâ profil
        navigasyonu var"). Yerinde tek başına "← Bağlantılarım" bağlantısı
        vardı; şerit hem dönülecek yeri hem bulunulan yeri basıyor ve panelin
        her yerinde aynı biçimde duruyor (bkz. components/ui.tsx · KirintiYolu).

        SON BASAMAK YAZIŞMANIN İKİ TARAFI: aynı kişiyle birden çok yazışma
        satırı olabildiği için başlık burada bir ad değil, bir çift.
      */}
      <KirintiYolu
        basamaklar={[
          { etiket: "Bağlantılarım", yol: "/panel/yazismalar" },
          {
            etiket: `${yazisma.baglantiIstegi.isteyen.ad} ${yazisma.baglantiIstegi.isteyen.soyad} ↔ ${yazisma.baglantiIstegi.hedef.ad} ${yazisma.baglantiIstegi.hedef.soyad}`,
          },
        ]}
      />

      <SayfaBasligi
        geri={null}
        baslik={`${yazisma.baglantiIstegi.isteyen.ad} ${yazisma.baglantiIstegi.isteyen.soyad} ↔ ${yazisma.baglantiIstegi.hedef.ad} ${yazisma.baglantiIstegi.hedef.soyad}`}
        aciklama={
          yazisma.baglantiIstegi.kararVeren
            ? `${yazisma.baglantiIstegi.kararVeren.ad} ${yazisma.baglantiIstegi.kararVeren.soyad} tarafından onaylandı`
            : undefined
        }
      />

      {durum === "gizlendi" && (
        <BilgiKutusu cesit="olumlu">
          Mesaj gizlendi. İçerik silinmedi; gözetim yetkisi olanlar görmeye
          devam eder.
        </BilgiKutusu>
      )}
      {durum === "kapatildi" && (
        <BilgiKutusu cesit="olumlu">
          Yazışma kapatıldı; yeni mesaj yazılamaz.
        </BilgiKutusu>
      )}
      {hata && <BilgiKutusu cesit="hata">{hata}</BilgiKutusu>}

      <BilgiKutusu cesit="uyari">{GIZLILIK_UYARISI}</BilgiKutusu>

      {!tarafMi && (
        <BilgiKutusu cesit="uyari">
          Bu yazışmanın tarafı değilsiniz; gözetim yetkisiyle okuyorsunuz.
          Okuma işleminiz erişim kaydına yazıldı.
        </BilgiKutusu>
      )}

      {/*
        BAĞLANTI İSTEĞİ KARTI YALNIZCA GERÇEK İSTEKTE (26 Ağustos 2026 · istek:
        "okul temsilcilerinden birine mesaj atarken kendi okulunda olmasa bile
        mesaj sayfasında 'Bağlantı isteği · Okul içi doğrudan yazışma — onay
        gerekmedi' çıkıyor").

        Doğrudan yazışmada ortada bir istek YOK: kayıt ONAY_GEREKMEZ olarak
        açılıyor ve `mesaj` alanı gerçek bir istek metni değil, kaydın niçin
        açıldığını anlatan iç not. Onu "Bağlantı isteği" başlığıyla basmak,
        kullanıcıya hiç yazmadığı bir isteği kendi cümlesi gibi gösteriyordu —
        üstelik okul temsilcisiyle yazışırken "okul içi" diyerek yanlış da
        söylüyordu.

        Onaydan geçmiş eski yazışmalarda kart yerinde: orada metin gerçekten
        isteği yapanın yazdığı cümle.
      */}
      {yazisma.baglantiIstegi.onayDurumu !== "ONAY_GEREKMEZ" && (
        <Kart>
          <KartBasligi
            baslik="Bağlantı isteği"
            aciklama={
              yazisma.baglantiIstegi.kararTarihi
                ? tarihSaatYaz(yazisma.baglantiIstegi.kararTarihi)
                : undefined
            }
          />
          <p className="whitespace-pre-line text-metin">
            {yazisma.baglantiIstegi.mesaj}
          </p>
        </Kart>
      )}

      <Kart>
        <KartBasligi
          baslik="Mesajlar"
          aciklama={`${yazisma.mesajlar.length} mesaj`}
          Ikon={Send}
        />

        {yazisma.mesajlar.length === 0 ? (
          <p className="text-metin-yumusak">Henüz mesaj yok.</p>
        ) : (
          <ul className="space-y-3">
            {yazisma.mesajlar.map((mesaj) => {
              // Gizlenmiş mesajın İÇERİĞİ yalnızca gözetim yetkisi olana açılır.
              const icerikGorunur = !mesaj.gizlendiMi || gozetimYetkisi;
              return (
                <li
                  key={mesaj.id}
                  className={`rounded-kart border px-4 py-3 ${
                    mesaj.gizlendiMi
                      ? "border-uyari-cizgi bg-uyari-zemin"
                      : "border-cizgi"
                  }`}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-metin">
                      {mesaj.yazan.ad} {mesaj.yazan.soyad}
                      <span className="ml-2 font-normal text-metin-yumusak">
                        {tarihSaatYaz(mesaj.olusturmaTarihi)}
                      </span>
                    </span>
                    {gozetimYetkisi && !mesaj.gizlendiMi && (
                      <form action={mesajGizleEylemi}>
                        <input type="hidden" name="mesajId" value={mesaj.id} />
                        <button
                          type="submit"
                          className="inline-flex items-center gap-1 text-xs font-medium text-metin-yumusak transition hover:text-hata-metin"
                        >
                          <EyeOff size={13} aria-hidden />
                          Gizle
                        </button>
                      </form>
                    )}
                  </div>

                  {mesaj.gizlendiMi && (
                    <p className="mt-1 text-xs font-medium text-uyari-metin">
                      Bu mesaj{" "}
                      {mesaj.gizleyen
                        ? `${mesaj.gizleyen.ad} ${mesaj.gizleyen.soyad}`
                        : "bir yetkili"}{" "}
                      tarafından gizlendi.
                    </p>
                  )}

                  {icerikGorunur ? (
                    <MetinBaglantili
                      metin={mesaj.icerik}
                      className="mt-2 whitespace-pre-line text-metin"
                    />
                  ) : (
                    <p className="mt-2 text-metin-yumusak italic">
                      İçerik gizlendi.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {yazisma.kapatildiMi ? (
          <BilgiKutusu cesit="uyari" className="mt-4">
            Bu yazışma kapatıldı; yeni mesaj yazılamaz. Geçmiş korunuyor.
          </BilgiKutusu>
        ) : tarafMi ? (
          <form action={mesajYazEylemi} className="mt-4 space-y-3">
            <input type="hidden" name="yazismaId" value={yazisma.baglantiIstegiId} />
            <label className="block">
              <span className="text-sm font-medium text-metin">Mesajınız</span>
              <textarea
                name="icerik"
                required
                rows={3}
                maxLength={2000}
                className={SINIF_GIRDI}
              />
            </label>
            <button type="submit" className={SINIF_BIRINCIL_BUTON}>
              <Send size={16} aria-hidden />
              Gönder
            </button>
          </form>
        ) : (
          <p className="mt-4 text-sm text-metin-yumusak">
            Taraf olmadığınız için bu yazışmaya mesaj yazamazsınız.
          </p>
        )}
      </Kart>

      {gozetimYetkisi && !yazisma.kapatildiMi && (
        <Kart>
          <KartBasligi
            baslik="Moderasyon"
            aciklama="Kapatılan yazışmada yeni mesaj yazılamaz; geçmiş silinmez."
            Ikon={Lock}
          />
          <form action={yazismaKapatEylemi}>
            <input type="hidden" name="yazismaId" value={yazisma.baglantiIstegiId} />
            <button type="submit" className={SINIF_IKINCIL_BUTON}>
              <Lock size={16} aria-hidden />
              Yazışmayı kapat
            </button>
          </form>
        </Kart>
      )}
    </div>
  );
}
