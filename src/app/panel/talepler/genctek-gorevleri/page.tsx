import { BadgeCheck, Users } from "lucide-react";
import Link from "next/link";
import {
  BilgiKutusu,
  Kart,
  KartBasligi,
  Rozet,
  SayfaBasligi,
  SINIF_BIRINCIL_BUTON,
  SINIF_GIRDI,
  SINIF_IKINCIL_BUTON,
} from "@/components/ui";
import { oturumKullanicisiZorunlu } from "@/lib/auth/oturum";
import { prisma } from "@/lib/db";
import {
  GOREV_DURUM_ETIKETLERI,
  GOREV_MESAJI_AZAMI,
} from "@/lib/gorev/kurallar";
import { gorevBasvurEylemi } from "../../genctek-gorevleri/eylemler";

export const dynamic = "force-dynamic";

const DURUM_MESAJLARI: Record<string, string> = {
  basvuruldu:
    "Başvurunuz alındı ve proje yöneticisinin onayına gönderildi. Sonucu bildirim olarak alacaksınız.",
};

/**
 * GENÇTEK GÖREVLERİ — panodaki başvuru ekranı (21 Ağustos 2026).
 *
 * İstek: "Panoda yeni kart GençTek Görevlerim isminde kart olsun, içinde
 * başvur butonları olacak, mesela eba asistan test ekibi, senaryoyu yapacak
 * oyun ekibi, tekno girişim değerlendirme ekibi."
 *
 * PANONUN KENDİSİNDE DEĞİL, KARTIN AÇTIĞI SAYFADA: pano ilan listesi ekranıdır
 * ve 14 Ağustos'ta formların tamamı oradan çıkarıldı (bkz. talepler/page.tsx).
 * Aynı karar burada da geçerli — panoda kart var, form burada.
 *
 * HER GÖREV KENDİ FORMUNU TAŞIR: "hangi göreve başvuruyorum" sorusunun cevabı
 * formun durduğu yerdir. Tek form + görev seçme listesi, kişiyi az önce
 * okuduğu açıklamadan koparırdı.
 */
export default async function GencTekGorevleriSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ durum?: string; hata?: string }>;
}) {
  const kullanici = await oturumKullanicisiZorunlu();
  const { durum, hata } = await searchParams;

  const [gorevler, basvurularim] = await Promise.all([
    /*
     * KAPALI GÖREVLER DE LİSTEDE (26 Ekim 2026 · istek: "kapattığımda
     * gözükmeye devam etsin, sadece başvuruya kapansın"). Açıklar önce gelir;
     * kapalı görevin kartı durur, formun yerinde "başvuruya kapandı" yazar.
     * Onaylanmış başvuru sayısı kontenjanın yanında yazıyor — "üç kişilik
     * ekibin ikisi doldu" bilgisi, başvurup başvurmama kararını değiştiriyor.
     */
    prisma.gencTekGorevi.findMany({
      orderBy: [{ aktif: "desc" }, { siraNo: "asc" }, { id: "asc" }],
      select: {
        id: true,
        aktif: true,
        ad: true,
        aciklama: true,
        kontenjan: true,
        _count: {
          select: { basvurular: { where: { onayDurumu: "ONAYLANDI" } } },
        },
      },
    }),
    prisma.gencTekGorevBasvurusu.findMany({
      where: { kullaniciId: kullanici.id },
      select: {
        gorevId: true,
        onayDurumu: true,
        retGerekcesi: true,
      },
    }),
  ]);

  const durumum = new Map(
    basvurularim.map((basvuru) => [basvuru.gorevId, basvuru]),
  );

  return (
    <div className="space-y-6">
      {/*
        KIRINTI YOLU (29 Ağustos 2026 · istek: "pano da da aynı sorun var").

        Panodan açılan ekranlarda üstte ya "← Profil" (SayfaBasligi'nın
        varsayılanı) ya da elle yazılmış "Panoya dön" bağlantısı duruyordu:
        ikisi de nereye dönüleceğini söylüyor, nerede olunduğunu söylemiyordu.
        Şerit ikisini birden basıyor ve panelin her yerinde aynı biçimde
        (bkz. components/ui.tsx · KirintiYolu). SayfaBasligi'nın geri
        bağlantısı bu yüzden `null`.
      */}
      {/*
        Kırıntı yolu kalktı (24 Ekim 2026): ekran artık Pano'dan değil, sol
        menüdeki "GençTek görevlerim" satırından açılıyor.
      */}
      <SayfaBasligi
        baslik="GençTek Görevleri"
        aciklama="Merkezin açtığı görevlere başvurun; başvurunuz proje yöneticisinin onayından geçer."
        geri={null}
        eylem={
          /*
            ALDIĞIM GÖREVLER: menü satırı bu ekrana geldiği için kişinin kabul
            edildiği görevlerin ve temsilciliklerinin listesine yol buradan.
          */
          <Link href="/panel/gorevlerim" className={SINIF_IKINCIL_BUTON}>
            Aldığım görevler
          </Link>
        }
      />

      {durum && DURUM_MESAJLARI[durum] && (
        <BilgiKutusu cesit="olumlu">{DURUM_MESAJLARI[durum]}</BilgiKutusu>
      )}
      {hata && <BilgiKutusu cesit="hata">{hata}</BilgiKutusu>}

      {gorevler.length === 0 ? (
        <Kart className="text-metin-yumusak">
          Henüz açılmış bir görev yok.
        </Kart>
      ) : (
        gorevler.map((gorev) => {
          const basvurum = durumum.get(gorev.id);
          const kontenjanDoldu =
            gorev.kontenjan !== null &&
            gorev._count.basvurular >= gorev.kontenjan;
          /*
           * Form ÜÇ DURUMDA basılmaz: kişi görevde, başvurusu karar bekliyor ya
           * da kontenjan dolmuş. Üçünde de yerine ne olduğunu söyleyen bir satır
           * var — kaybolan bir düğme, "başvuru kapandı mı" sorusunu doğurur.
           */
          const formGorunur =
            gorev.aktif &&
            !kontenjanDoldu &&
            basvurum?.onayDurumu !== "BEKLIYOR" &&
            basvurum?.onayDurumu !== "ONAYLANDI";

          return (
            <Kart key={gorev.id}>
              {/*
                Durum rozeti BAŞLIĞIN YANINDA: kişi kartı açtığında ilk sorduğu
                şey "ben buna başvurdum mu"dur; cevabı formun altında aramak
                zorunda kalmamalı.
              */}
              <div className="mb-5 flex flex-wrap items-center gap-3">
                <div className="grow">
                  <KartBasligi baslik={gorev.ad} Ikon={BadgeCheck} />
                </div>
                {!gorev.aktif && <Rozet cesit="notr">Başvuruya kapalı</Rozet>}
                {basvurum && (
                  <Rozet
                    cesit={
                      basvurum.onayDurumu === "ONAYLANDI"
                        ? "olumlu"
                        : basvurum.onayDurumu === "REDDEDILDI"
                          ? "hata"
                          : "uyari"
                    }
                  >
                    {GOREV_DURUM_ETIKETLERI[basvurum.onayDurumu]}
                  </Rozet>
                )}
              </div>

              <p className="whitespace-pre-line text-metin">{gorev.aciklama}</p>

              <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-metin-yumusak">
                <Users size={14} aria-hidden />
                {gorev.kontenjan === null
                  ? `${gorev._count.basvurular} kişi görevde · kontenjan sınırsız`
                  : `${gorev._count.basvurular}/${gorev.kontenjan} kişi görevde`}
              </p>

              {basvurum?.onayDurumu === "REDDEDILDI" && basvurum.retGerekcesi && (
                <p className="mt-2 text-sm text-hata-metin">
                  Gerekçe: {basvurum.retGerekcesi}
                </p>
              )}

              {formGorunur ? (
                <form action={gorevBasvurEylemi} className="mt-4 space-y-3">
                  <input type="hidden" name="gorevId" value={gorev.id} />
                  <label className="block">
                    <span className="text-sm font-medium text-metin">
                      Neden bu görevde yer almak istiyorsunuz?
                    </span>
                    <textarea
                      name="mesaj"
                      required
                      rows={3}
                      maxLength={GOREV_MESAJI_AZAMI}
                      placeholder="Bu konudaki deneyiminizi, kullandığınız araçları ve neler yapabileceğinizi kısaca yazın."
                      className={SINIF_GIRDI}
                    />
                  </label>
                  <button type="submit" className={SINIF_BIRINCIL_BUTON}>
                    <BadgeCheck size={15} aria-hidden />
                    Başvur
                  </button>
                </form>
              ) : (
                <p className="mt-4 text-sm text-metin-yumusak">
                  {basvurum?.onayDurumu === "ONAYLANDI"
                    ? "Bu görevde yer alıyorsunuz."
                    : basvurum?.onayDurumu === "BEKLIYOR"
                      ? "Başvurunuz proje yöneticisinin kararını bekliyor."
                      : !gorev.aktif
                        ? "Bu görev başvuruya kapandı."
                        : "Bu görevin kontenjanı doldu."}
                </p>
              )}
            </Kart>
          );
        })
      )}
    </div>
  );
}
