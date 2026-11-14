import {
  ArrowLeft,
  CalendarDays,
  IdCard,
  Mail,
  Phone,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OgretmenKatkiKarti } from "@/components/OgretmenKatkiKarti";
import {
  KazanimBolumleri,
  UrunlerKarti,
} from "@/components/OgrenciProfilBolumleri";
import { RolEtiketi, RolsuzEtiketi } from "@/components/RolEtiketi";
import {
  BilgiKutusu,
  Kart,
  KartBasligi,
  SayfaBasligi,
  SINIF_BIRINCIL_BUTON,
} from "@/components/ui";
import { oturumKullanicisiZorunlu } from "@/lib/auth/oturum";
import { danismanAtayaniCoz } from "@/lib/danisman/atama";
import { prisma } from "@/lib/db";
import { KAPSAM_ETIKETLERI } from "@/lib/faaliyet/kurallar";
import { SALT_OKUNUR_ACIKLAMASI } from "@/lib/kullanici/salt-okunur";
import { gorevYillari, gorevYillariYaz } from "@/lib/ogretmen/gorev-yillari";
import { ogretmenKatkiVerisiGetir } from "@/lib/ogretmen/katki";
import { tarihYaz } from "@/lib/tarih";
import { ogretmenEnvanteriGorebilirMi } from "@/lib/yetki/izinler";
import {
  faaliyetKapsamFiltresi,
  ogrenciKapsamFiltresi,
  ogretmenKapsamFiltresi,
} from "@/lib/yetki/kapsam";
import { erisimLogla } from "@/lib/yetki/log";
import { ogretmeneOgrenciAtaEylemi } from "./eylemler";

export const dynamic = "force-dynamic";

/**
 * Tekil öğretmen kaydı — analiz dokümanı Bölüm 2.
 *
 * Erişim merkezi kapsam filtresinden geçer; kapsam dışı kayıtta 404 döner.
 *
 * DİKKAT: Bu ekranda gösterilen ÖĞRENCİ ve FAALİYET listeleri, bakan kişinin
 * KENDİ kapsam filtresinden ayrıca geçirilir. Aksi halde bir danışman öğretmen,
 * meslektaşının profilini açarak onun öğrencilerinin adlarını görebilirdi —
 * öğrenci kapsamı "kendi danışmanlığındakiler" ile sınırlıyken.
 */

const SINIF_ETIKET = "text-sm font-medium text-metin-yumusak";

function Alan({ etiket, deger }: { etiket: string; deger: string | null }) {
  return (
    <div>
      <dt className={SINIF_ETIKET}>{etiket}</dt>
      <dd className="mt-0.5 text-metin">{deger?.trim() ? deger : "—"}</dd>
    </div>
  );
}

const DURUM_MESAJLARI: Record<string, string> = {
  "ogrenci-atandi": "Öğrenci bu öğretmene atandı; öğrenciye bildirim gönderildi.",
  "ogrenci-zaten": "Öğrenci zaten bu öğretmenin danışmanlığında.",
};

/** Atama listesinin üst sınırı: bir ilin öğrencileri tek açılır listede. */
const ADAY_UST_SINIRI = 1000;

export default async function OgretmenDetaySayfasi({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ durum?: string; hata?: string }>;
}) {
  const kullanici = await oturumKullanicisiZorunlu();
  const { id } = await params;
  const { durum, hata } = await searchParams;

  if (!ogretmenEnvanteriGorebilirMi(kullanici)) notFound();

  const ogretmenId = Number.parseInt(id, 10);
  if (!Number.isInteger(ogretmenId)) notFound();

  const ogretmen = await prisma.kullanici.findFirst({
    where: { AND: [{ id: ogretmenId }, ogretmenKapsamFiltresi(kullanici)] },
    select: {
      id: true,
      ad: true,
      soyad: true,
      brans: true,
      egitimOgretimYili: true,
      aktif: true,
      kurumKodu: true,
      ilKodu: true,
      kurum: { select: { ad: true, okulTuru: true, ilKodu: true } },
      beyanOkulAdi: true,
      il: { select: { ad: true } },
      ilce: { select: { ad: true } },
      ogretmenProfil: {
        select: {
          danismanOlmakIstiyor: true,
          eposta: true,
          telefon: true,
        },
      },
      roller: {
        orderBy: { baslangicTarihi: "desc" },
        select: {
          id: true,
          rolKodu: true,
          ilKodu: true,
          baslangicTarihi: true,
          bitisTarihi: true,
        },
      },
      /*
       * Kazanım beyanları kapsam filtresi GEREKTİRMEZ: kaydın kendisi zaten bu
       * öğretmene ait ve öğretmen kaydını görebilen kişi beyanını da görür.
       * Kayıtları yalnızca sahibi girip silebilir — bu ekranda silme formu
       * basılmaz (KazanimBolumleri'ne eylem verilmiyor).
       */
      kazanimlar: {
        orderBy: [{ tarih: "desc" }, { olusturmaTarihi: "desc" }],
      },
      _count: {
        select: { danismanAtamalari: { where: { bitisTarihi: null } } },
      },
    },
  });
  if (!ogretmen) notFound();

  /*
   * Öğretmenin faaliyetleri ve öğrencileri, BAKAN kişinin kapsamıyla kesiştirilir.
   * Sayılar (toplam öğrenci sayısı) kesişimden bağımsız gösterilir: kişisel veri
   * değildir ve envanterin işi zaten yükün nerede olduğunu göstermek.
   */
  const [ogrenciler, katildigi, katki] = await Promise.all([
    prisma.kullanici.findMany({
      where: {
        AND: [
          ogrenciKapsamFiltresi(kullanici),
          {
            ogrenciAtamalari: {
              some: { danismanKullaniciId: ogretmen.id, bitisTarihi: null },
            },
          },
        ],
      },
      select: { id: true, ad: true, soyad: true, sinif: true },
      orderBy: [{ ad: "asc" }, { soyad: "asc" }],
    }),
    // Katıldığı etkinlikler: seçilmiş başvurular. Öğretmen de katılımcı
    // olabildiği için bu liste artık boş kalmıyor (analiz dokümanı 4.2).
    prisma.basvuru.findMany({
      where: {
        katilimciId: ogretmen.id,
        durum: "SECILDI",
        faaliyet: { AND: [faaliyetKapsamFiltresi(kullanici), { durum: "AKTIF" }] },
      },
      orderBy: { faaliyet: { tarih: "desc" } },
      select: {
        id: true,
        faaliyet: {
          select: { id: true, ad: true, tarih: true, kapsam: true },
        },
      },
    }),
    ogretmenKatkiVerisiGetir(ogretmen.id),
  ]);

  await erisimLogla({
    kullaniciId: kullanici.id,
    islem: "GORUNTULEME",
    hedefTip: "OGRETMEN",
    hedefId: ogretmen.id,
    detay: "Öğretmen kaydı görüntülendi",
  });

  const aktifRoller = ogretmen.roller.filter((rol) => rol.bitisTarihi === null);

  /*
   * ÖĞRENCİ ATAMA (14 Kasım 2026 · istek: "öğrenci adına tıklayıp danışman
   * ata seçiliyor ama öğretmen adına tıklayınca danışman ata yok"). Öğrenci
   * sayfasındaki atamanın ters yönü, aynı kural: öğretmen etkin bir danışman
   * olmalı, öğrenci öğretmenin ilinde ve bakanın kapsamında olmalı;
   * koordinatör yalnızca kendi ilinde atar (sunucuda yoneticiDanismanAta
   * yeniden denetler).
   */
  const atayan = danismanAtayaniCoz(kullanici);
  const ogretmenIli = ogretmen.kurum?.ilKodu ?? ogretmen.ilKodu;
  const danismanMi =
    aktifRoller.some((rol) => rol.rolKodu === "DANISMAN") &&
    !aktifRoller.some((rol) => rol.rolKodu === "IL_KOORDINATOR");
  const atamaAcik =
    atayan !== null &&
    ogretmen.aktif &&
    danismanMi &&
    ogretmenIli !== null &&
    (atayan.rol === "PROJE_YONETICISI" || atayan.ilKodu === ogretmenIli);
  const adaylar =
    atamaAcik && ogretmenIli
      ? await prisma.kullanici.findMany({
          where: {
            AND: [
              ogrenciKapsamFiltresi(kullanici),
              {
                aktif: true,
                roller: { some: { rolKodu: "OGRENCI", bitisTarihi: null } },
                OR: [{ kurum: { ilKodu: ogretmenIli } }, { ilKodu: ogretmenIli }],
                ogrenciAtamalari: {
                  none: { danismanKullaniciId: ogretmen.id, bitisTarihi: null },
                },
              },
            ],
          },
          select: {
            id: true,
            ad: true,
            soyad: true,
            sinif: true,
            kurumKodu: true,
            beyanOkulAdi: true,
            kurum: { select: { ad: true } },
            ogrenciAtamalari: {
              where: { bitisTarihi: null },
              select: { danisman: { select: { ad: true, soyad: true } } },
              take: 1,
            },
          },
          orderBy: [{ ad: "asc" }, { soyad: "asc" }],
          take: ADAY_UST_SINIRI,
        })
      : [];
  const adayEtiketi = (aday: (typeof adaylar)[number]) => {
    const danisman = aday.ogrenciAtamalari[0]?.danisman;
    return [
      `${aday.ad} ${aday.soyad}`,
      aday.sinif ? `${aday.sinif}. sınıf` : null,
      aday.kurum?.ad ??
        (aday.beyanOkulAdi ? `${aday.beyanOkulAdi} (listede yok)` : null),
      danisman ? `şu an: ${danisman.ad} ${danisman.soyad}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
  };
  const ayniOkul = adaylar.filter(
    (aday) =>
      ogretmen.kurumKodu !== null && aday.kurumKodu === ogretmen.kurumKodu,
  );
  const digerleri = adaylar.filter((aday) => !ayniOkul.includes(aday));
  const adayGruplari = [
    { etiket: "Aynı okuldaki öğrenciler", liste: ayniOkul },
    {
      etiket: "İldeki danışmanı olmayan öğrenciler",
      liste: digerleri.filter((aday) => aday.ogrenciAtamalari.length === 0),
    },
    {
      etiket: "İldeki danışmanı olan öğrenciler (danışmanı değişir)",
      liste: digerleri.filter((aday) => aday.ogrenciAtamalari.length > 0),
    },
  ].filter((grup) => grup.liste.length > 0);
  const yillar = gorevYillari(ogretmen.roller);
  const iletisim = ogretmen.ogretmenProfil;

  // Ulusal ve uluslararası programlar GençTek'in ULUSAL kapsamlı
  // faaliyetleridir (Zirve, Sınır Ötesi, G2S, EğitiJAM); ayrı bir liste
  // tutulmaz, kapsam alanından türetilir.
  const ulusalKatilim = katildigi.filter(
    (kayit) =>
      kayit.faaliyet.kapsam === "ULUSAL" ||
      kayit.faaliyet.kapsam === "ULUSLARARASI",
  );

  return (
    <div className="space-y-6">
      <Link
        href="/panel/ogretmenler"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-vurgu-metin"
      >
        <ArrowLeft size={15} aria-hidden />
        Öğretmen listesi
      </Link>

      <SayfaBasligi
        baslik={`${ogretmen.ad} ${ogretmen.soyad}`}
        aciklama={[
          ogretmen.brans,
          ogretmen.kurum?.ad ?? ogretmen.beyanOkulAdi,
          ogretmen.aktif ? null : "kayıt pasif",
        ]
          .filter(Boolean)
          .join(" · ")}
        /*
          Kendi geri bağlantısı yukarıda: bu ekranın üstü Panel değil,
          geldiği liste. `SayfaBasligi`nin varsayılan "Panel" bağlantısı
          basılsaydı üst üste iki geri bağlantısı olurdu.
        */
        geri={null}
      />

      {durum && DURUM_MESAJLARI[durum] && (
        <BilgiKutusu cesit="olumlu">{DURUM_MESAJLARI[durum]}</BilgiKutusu>
      )}
      {hata && <BilgiKutusu cesit="hata">{hata}</BilgiKutusu>}

      <Kart>
        <KartBasligi
          baslik="Kimlik ve görev bilgileri"
          aciklama={SALT_OKUNUR_ACIKLAMASI}
          Ikon={IdCard}
        />
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Alan etiket="Ad" deger={ogretmen.ad} />
          <Alan etiket="Soyad" deger={ogretmen.soyad} />
          <Alan etiket="Branş" deger={ogretmen.brans} />
          <Alan
            etiket={ogretmen.kurum ? "Okul" : "Okul (listede yok)"}
            deger={ogretmen.kurum?.ad ?? ogretmen.beyanOkulAdi ?? null}
          />
          <Alan etiket="Okul türü" deger={ogretmen.kurum?.okulTuru ?? null} />
          <Alan etiket="İl" deger={ogretmen.il?.ad ?? null} />
          <Alan etiket="İlçe" deger={ogretmen.ilce?.ad ?? null} />
          <Alan
            etiket="Güncel eğitim-öğretim yılı"
            deger={ogretmen.egitimOgretimYili}
          />
          <Alan
            etiket="Görev aldığı yıllar"
            deger={gorevYillariYaz(yillar)}
          />
        </dl>

        <div className="mt-5 border-t border-cizgi pt-5">
          <p className={SINIF_ETIKET}>Güncel görev</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {aktifRoller.length === 0 ? (
              <RolsuzEtiketi />
            ) : (
              aktifRoller.map((rol) => (
                <RolEtiketi
                  key={rol.id}
                  rolKodu={rol.rolKodu}
                  ekBilgi={rol.ilKodu}
                />
              ))
            )}
            {iletisim?.danismanOlmakIstiyor && (
              <span className="rounded-full bg-olumlu-zemin px-2.5 py-0.5 text-xs text-olumlu-metin">
                danışman listesinde görünüyor
              </span>
            )}
          </div>
        </div>

        {ogretmen.roller.length > 0 && (
          <div className="mt-5 border-t border-cizgi pt-5">
            <p className={`${SINIF_ETIKET} mb-2`}>Görev geçmişi</p>
            <ul className="space-y-1 text-sm text-metin-yumusak">
              {ogretmen.roller.map((rol) => (
                <li key={rol.id}>
                  {rol.rolKodu} · {tarihYaz(rol.baslangicTarihi)} —{" "}
                  {rol.bitisTarihi ? tarihYaz(rol.bitisTarihi) : "sürüyor"}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Kart>

      <Kart>
        <KartBasligi
          baslik="İletişim bilgileri"
          aciklama="Kişinin kendi girdiği bilgilerdir; e-Okul'dan gelmez ve senkronda üzerine yazılmaz."
          Ikon={Mail}
        />
        <dl className="grid gap-4 sm:grid-cols-2">
          <Alan etiket="E-posta" deger={iletisim?.eposta ?? null} />
          <Alan etiket="Telefon" deger={iletisim?.telefon ?? null} />
        </dl>
        {!iletisim?.eposta && !iletisim?.telefon && (
          <BilgiKutusu className="mt-4">
            <span className="inline-flex items-center gap-2">
              <Phone size={15} aria-hidden />
              İletişim bilgisi girilmemiş. Bildirimlerin e-posta kopyası bu alan
              boşken gönderilmez.
            </span>
          </BilgiKutusu>
        )}
      </Kart>

      <Kart>
        <KartBasligi
          baslik="Danışmanlığındaki öğrenciler"
          aciklama={`Toplam ${ogretmen._count.danismanAtamalari} aktif danışmanlık.`}
          Ikon={Users}
        />
        {ogrenciler.length === 0 ? (
          <p className="text-sm text-metin-yumusak">
            {ogretmen._count.danismanAtamalari > 0
              ? "Bu öğretmenin öğrencileri sizin görüntüleme kapsamınızda değil."
              : "Bu öğretmenin aktif danışmanlığı yok."}
          </p>
        ) : (
          <ul className="divide-y divide-cizgi">
            {ogrenciler.map((ogrenci) => (
              <li key={ogrenci.id} className="py-2">
                <Link
                  href={`/panel/ogrenciler/${ogrenci.id}`}
                  className="font-medium text-metin transition hover:text-vurgu-metin hover:underline"
                >
                  {ogrenci.ad} {ogrenci.soyad}
                </Link>
                <span className="ml-2 text-sm text-metin-yumusak">
                  {ogrenci.sinif ?? "—"}
                </span>
              </li>
            ))}
          </ul>
        )}

        {atamaAcik && (
          <form
            action={ogretmeneOgrenciAtaEylemi}
            className="mt-4 space-y-3 border-t border-cizgi pt-4"
          >
            <input type="hidden" name="ogretmenId" value={ogretmen.id} />
            <label className="block">
              <span className="flex items-center gap-2 text-sm font-medium text-metin">
                <UserPlus size={15} aria-hidden />
                Öğrenci ata
              </span>
              <select
                name="ogrenciId"
                required
                defaultValue=""
                className="mt-1 w-full rounded-md border border-cizgi bg-kart px-3 py-2 text-sm text-metin outline-none focus:border-vurgu"
              >
                <option value="" disabled>
                  {adaylar.length === 0
                    ? "Atanabilecek öğrenci yok"
                    : "Öğrenci seçin"}
                </option>
                {adayGruplari.map((grup) => (
                  <optgroup key={grup.etiket} label={grup.etiket}>
                    {grup.liste.map((aday) => (
                      <option key={aday.id} value={aday.id}>
                        {adayEtiketi(aday)}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <p className="text-xs text-metin-yumusak">
              Öğrencinin başka bir danışmanı varsa o danışmanlık kapanır ve
              öğrenci bu öğretmene geçer; öğrenciye ve önceki danışmana
              bildirim gider.
            </p>
            <button
              type="submit"
              disabled={adaylar.length === 0}
              className={SINIF_BIRINCIL_BUTON}
            >
              Öğrenciyi ata
            </button>
          </form>
        )}
        {atayan !== null && !atamaAcik && (
          <p className="mt-4 border-t border-cizgi pt-4 text-sm text-metin-yumusak">
            {!ogretmen.aktif
              ? "Kayıt pasif olduğu için bu öğretmene öğrenci atanamaz."
              : !danismanMi
                ? "Bu öğretmenin açık bir danışman görevi yok; öğrenci atanamaz."
                : ogretmenIli === null
                  ? "Öğretmenin ili kayıtlı değil; önce okulunu ya da ilini düzeltin."
                  : "Yalnızca kendi ilinizdeki öğretmenlere öğrenci atayabilirsiniz."}
          </p>
        )}
      </Kart>

      <OgretmenKatkiKarti
        kendiMi={false}
        gorevler={katki.gorevler}
        aktifDanismanlik={katki.aktifDanismanlik}
        faaliyetler={katki.faaliyetler}
      />

      <Kart>
        <KartBasligi
          baslik="Katıldığı etkinlikler"
          aciklama={
            ulusalKatilim.length > 0
              ? `${katildigi.length} etkinlik · ${ulusalKatilim.length} tanesi ulusal program.`
              : "Başvurusu kabul edilmiş (seçildi) etkinlikler."
          }
          Ikon={CalendarDays}
        />
        {katildigi.length === 0 ? (
          <p className="text-sm text-metin-yumusak">
            Kapsamınızda bu öğretmenin katıldığı etkinlik kaydı yok.
          </p>
        ) : (
          <ul className="divide-y divide-cizgi">
            {katildigi.map((kayit) => (
              <li key={kayit.id} className="py-2.5">
                <Link
                  href={`/panel/etkinlikler/${kayit.faaliyet.id}`}
                  className="font-medium text-metin transition hover:text-vurgu-metin hover:underline"
                >
                  {kayit.faaliyet.ad}
                </Link>
                <p className="text-sm text-metin-yumusak">
                  {tarihYaz(kayit.faaliyet.tarih)} ·{" "}
                  {KAPSAM_ETIKETLERI[kayit.faaliyet.kapsam]}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Kart>

      <UrunlerKarti
        kendiMi={false}
        sahip="OGRETMEN"
        urunler={ogretmen.kazanimlar.filter(
          (kazanim) => kazanim.tip === "URUN",
        )}
      />

      <Kart>
        <KartBasligi
          baslik="Kazanımlar ve üretimler"
          aciklama="Öğretmenin kendi beyan ettiği kayıtlardır; sistem doğrulamaz."
          Ikon={Sparkles}
        />
        <KazanimBolumleri
          kazanimlar={ogretmen.kazanimlar}
          bosMesaji="Kayıt girilmemiş."
          sahip="OGRETMEN"
        />
      </Kart>
    </div>
  );
}
