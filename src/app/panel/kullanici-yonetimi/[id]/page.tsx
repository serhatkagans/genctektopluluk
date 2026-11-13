import { Save } from "lucide-react";
import { notFound } from "next/navigation";
import { ILLER } from "../../../../../prisma/veri/iller";
import {
  AramaliDanismanSecimi,
  type DanismanSecenegi,
} from "@/components/AramaliDanismanSecimi";
import { KullaniciIslemleri } from "@/components/KullaniciIslemleri";
import { RolEtiketi } from "@/components/RolEtiketi";
import { OtomatikSecimKutusu } from "@/components/SuzgecOtomatikSecim";
import {
  BilgiKutusu,
  Kart,
  KartBasligi,
  SayfaBasligi,
  SINIF_BIRINCIL_BUTON,
  SINIF_GIRDI,
} from "@/components/ui";
import { oturumKullanicisiZorunlu } from "@/lib/auth/oturum";
import { prisma } from "@/lib/db";
import { OKUL_LISTEDE_YOK, SINIF_SEVIYELERI, sinifEtiketi } from "@/lib/kayit/kurallar";
import { yonetilebilirKullaniciFiltresi } from "@/lib/kullanici-yonetimi/kapsam";
import { kullaniciSifresiYonetebilirMi, kullaniciYoneticisiCoz } from "@/lib/yetki/izinler";
import { erisimLogla } from "@/lib/yetki/log";
import { kullaniciDuzenleEylemi } from "./eylemler";

export const dynamic = "force-dynamic";

/**
 * KULLANICI BİLGİLERİNİ DÜZENLEME (13 Kasım 2026 · istek: "koordinatörler
 * için yönetim panelinde kullanıcı yönetimi aç, sadece kendi ilindeki öğrenci
 * ve öğretmen kayıtlarını oradan düzenleyebilsin, tüm alanları düzenleme
 * sayfası olsun").
 *
 * Kural ve gerekçeler: lib/kullanici-yonetimi/duzenleme.ts. Kapsam dışındaki
 * kişi 404 — varlığı bile sızmasın.
 *
 * Okul listesi seçili ilin okulları. Proje yöneticisi ili üstteki kutudan
 * değiştirir (sayfa o ilin okullarıyla yeniden açılır); koordinatörde il
 * kendi ili ve kutu basılmaz.
 */
export default async function KullaniciDuzenleSayfasi({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ il?: string; durum?: string; hata?: string }>;
}) {
  const oturum = await oturumKullanicisiZorunlu();
  const yapan = kullaniciYoneticisiCoz(oturum);
  if (!yapan) notFound();
  const merkezMi = yapan.rol === "PROJE_YONETICISI";

  const { id } = await params;
  const kisiId = Number.parseInt(id, 10);
  if (!Number.isSafeInteger(kisiId)) notFound();
  const { il: hamIl, durum, hata } = await searchParams;

  const kisi = await prisma.kullanici.findFirst({
    where: {
      AND: [{ id: kisiId, anonimlestirmeTarihi: null }, yonetilebilirKullaniciFiltresi(yapan)],
    },
    select: {
      id: true,
      ad: true,
      soyad: true,
      cinsiyet: true,
      aktif: true,
      ilKodu: true,
      ilceKodu: true,
      kurumKodu: true,
      beyanOkulAdi: true,
      beyanOkulTuru: true,
      sinif: true,
      brans: true,
      kurum: { select: { ad: true, ilKodu: true } },
      roller: { where: { bitisTarihi: null }, select: { rolKodu: true } },
      ogrenciProfil: { select: { eposta: true, telefon: true } },
      ogretmenProfil: { select: { eposta: true, telefon: true } },
      kayitKimlik: { select: { kilitBitisTarihi: true } },
      disKimlik: { select: { kilitBitisTarihi: true } },
    },
  });
  if (!kisi) notFound();

  await erisimLogla({
    kullaniciId: oturum.id,
    islem: "GORUNTULEME",
    hedefTip: "PROFIL",
    hedefId: kisi.id,
    detay: "Kullanıcı yönetimi: düzenleme sayfası açıldı",
  });

  const ogrenciMi = kisi.roller.some((rol) => rol.rolKodu === "OGRENCI");
  const dokunulmazMi =
    kisi.id === oturum.id || kisi.roller.some((rol) => rol.rolKodu === "PROJE_YONETICISI");
  const profil = ogrenciMi ? kisi.ogrenciProfil : kisi.ogretmenProfil;
  const mevcutIl = kisi.kurum?.ilKodu ?? kisi.ilKodu;
  const secilenIl = merkezMi
    ? hamIl && /^\d{2}$/.test(hamIl)
      ? hamIl
      : mevcutIl
    : yapan.ilKodu;
  const ilAdi = (kod: string | null) => ILLER.find((k) => k.ilKodu === kod)?.ad ?? "—";

  const [okullar, ilceler] = secilenIl
    ? await Promise.all([
        prisma.kurum.findMany({
          where: { ilKodu: secilenIl, aktif: true },
          orderBy: { ad: "asc" },
          select: { kurumKodu: true, ad: true, okulTuru: true, ilce: { select: { ad: true } } },
        }),
        prisma.ilce.findMany({
          where: { ilKodu: secilenIl },
          orderBy: { ad: "asc" },
          select: { ilceKodu: true, ad: true },
        }),
      ])
    : [[], []];

  const okulSecenekleri: DanismanSecenegi[] = [
    {
      deger: OKUL_LISTEDE_YOK,
      grup: "Listede olmayan okul",
      etiket: "Okul listede yok — adı aşağıdaki kutuya yazılı",
    },
    ...okullar
      .map((okul) => ({
        deger: String(okul.kurumKodu),
        grup: okul.ilce.ad,
        etiket: `${okul.ad} · ${okul.okulTuru}`,
      }))
      .sort((a, b) => a.grup.localeCompare(b.grup, "tr")),
  ];
  const varsayilanOkul =
    kisi.kurumKodu !== null && kisi.kurum?.ilKodu === secilenIl
      ? String(kisi.kurumKodu)
      : kisi.beyanOkulAdi
        ? OKUL_LISTEDE_YOK
        : "";
  const [sinifSeviye = "", sube = ""] = (kisi.sinif ?? "").split("-");
  const simdi = new Date();
  const kilit = kisi.kayitKimlik?.kilitBitisTarihi ?? kisi.disKimlik?.kilitBitisTarihi ?? null;

  return (
    <div className="space-y-6">
      <SayfaBasligi
        baslik={`${kisi.ad} ${kisi.soyad}`}
        aciklama={`${ogrenciMi ? "Öğrenci" : "Öğretmen"} kaydını düzenleme · ${kisi.kurum?.ad ?? kisi.beyanOkulAdi ?? "okul bilgisi yok"} · ${ilAdi(mevcutIl)}`}
        geri={{ yol: "/panel/kullanici-yonetimi", etiket: "Kullanıcı Yönetimi" }}
      />

      {durum && <BilgiKutusu cesit="olumlu">{durum}</BilgiKutusu>}
      {hata && <BilgiKutusu cesit="hata">{hata}</BilgiKutusu>}

      <div className="flex flex-wrap gap-1.5">
        {kisi.roller.map((rol) => (
          <RolEtiketi key={rol.rolKodu} rolKodu={rol.rolKodu} />
        ))}
        {kisi.roller.length === 0 && (
          <span className="text-sm text-metin-yumusak">
            Açık rolü yok (okulsuz kaydolan öğretmene danışman rolü verilmez; okulu
            listeden seçilince açılır).
          </span>
        )}
      </div>

      {dokunulmazMi ? (
        <BilgiKutusu cesit="uyari">
          {kisi.id === oturum.id
            ? "Kendi hesabınızı Profil sayfasından düzenleyin."
            : "Proje yöneticisi hesapları bu ekrandan değiştirilmez."}
        </BilgiKutusu>
      ) : (
        <>
          {merkezMi && (
            <form method="get" className="flex flex-wrap items-end gap-3">
              <label className="block min-w-60">
                <span className="text-sm font-medium text-metin-yumusak">
                  İl (okul listesi bu ilden gelir)
                </span>
                <OtomatikSecimKutusu
                  ad="il"
                  deger={secilenIl}
                  bosEtiket="İl seçin"
                  etiket="İl"
                  sinif={SINIF_GIRDI}
                  secenekler={ILLER.map((k) => ({ deger: k.ilKodu, etiket: k.ad }))}
                />
              </label>
              <noscript>
                <button type="submit" className={SINIF_BIRINCIL_BUTON}>
                  Okulları getir
                </button>
              </noscript>
            </form>
          )}

          <form action={kullaniciDuzenleEylemi} className="space-y-6">
            <input type="hidden" name="kullaniciId" value={kisi.id} />
            <input type="hidden" name="ilKodu" value={secilenIl ?? ""} />

            <Kart>
              <KartBasligi baslik="Kimlik bilgileri" />
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="block">
                  <span className="text-sm font-medium text-metin">Ad</span>
                  <input name="ad" required maxLength={100} defaultValue={kisi.ad} className={SINIF_GIRDI} />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-metin">Soyad</span>
                  <input name="soyad" required maxLength={100} defaultValue={kisi.soyad} className={SINIF_GIRDI} />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-metin">Cinsiyet</span>
                  <select name="cinsiyet" required defaultValue={kisi.cinsiyet} className={SINIF_GIRDI}>
                    <option value="K">Kadın</option>
                    <option value="E">Erkek</option>
                  </select>
                </label>
              </div>
            </Kart>

            <Kart>
              <KartBasligi
                baslik={`Okul · ${ilAdi(secilenIl)}`}
                aciklama={
                  merkezMi
                    ? "Okulu listeden seçin; listede yoksa adını yazın. Başka ilin okulu için yukarıdan ili değiştirin."
                    : "Okulu ilinizin listesinden seçin; listede yoksa adını yazın. Kişi başka ildeyse proje yöneticisine bildirin."
                }
              />
              <div className="space-y-4">
                <div>
                  <span className="mb-1 block text-sm font-medium text-metin">Okul</span>
                  <AramaliDanismanSecimi
                    ad="kurumKodu"
                    secenekler={okulSecenekleri}
                    varsayilan={varsayilanOkul}
                    aramaIpucu="Okulun adını yazın…"
                    aramaEtiketi="Okul ara"
                    birim="okul"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-medium text-metin">
                      Okul adı (yalnızca &quot;listede yok&quot; seçiliyse)
                    </span>
                    <input
                      name="beyanOkulAdi"
                      maxLength={250}
                      defaultValue={kisi.beyanOkulAdi ?? ""}
                      className={SINIF_GIRDI}
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-metin">
                      İlçe (listeden okul seçilince okulun ilçesi olur)
                    </span>
                    <select name="ilceKodu" defaultValue={kisi.ilceKodu ?? ""} className={SINIF_GIRDI}>
                      <option value="">Seçilmedi</option>
                      {ilceler.map((ilce) => (
                        <option key={ilce.ilceKodu} value={ilce.ilceKodu}>
                          {ilce.ad}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            </Kart>

            <Kart>
              <KartBasligi baslik={ogrenciMi ? "Sınıf" : "Branş"} />
              {ogrenciMi ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-medium text-metin">Sınıf</span>
                    <select name="sinifSeviye" required defaultValue={sinifSeviye} className={SINIF_GIRDI}>
                      <option value="">Seçiniz</option>
                      {SINIF_SEVIYELERI.map((seviye) => (
                        <option key={seviye} value={seviye}>
                          {sinifEtiketi(seviye)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-metin">Şube (isteğe bağlı)</span>
                    <input name="sube" maxLength={10} defaultValue={sube} className={SINIF_GIRDI} />
                  </label>
                </div>
              ) : (
                <label className="block">
                  <span className="text-sm font-medium text-metin">Branş</span>
                  <input name="brans" maxLength={100} defaultValue={kisi.brans ?? ""} className={SINIF_GIRDI} />
                </label>
              )}
            </Kart>

            <Kart>
              <KartBasligi
                baslik="İletişim"
                aciklama={
                  merkezMi
                    ? "E-posta şifre sıfırlama bağlantısının gittiği adrestir."
                    : "E-posta şifre sıfırlama bağlantısının gittiği adres olduğu için yalnızca proje yöneticisi değiştirir."
                }
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-metin">E-posta</span>
                  <input
                    name="eposta"
                    type="email"
                    required={merkezMi}
                    disabled={!kullaniciSifresiYonetebilirMi(yapan)}
                    maxLength={150}
                    defaultValue={profil?.eposta ?? ""}
                    className={SINIF_GIRDI}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-metin">Telefon</span>
                  <input name="telefon" maxLength={20} defaultValue={profil?.telefon ?? ""} className={SINIF_GIRDI} />
                </label>
              </div>
            </Kart>

            <button type="submit" className={SINIF_BIRINCIL_BUTON}>
              <Save size={16} aria-hidden />
              Kaydet
            </button>
          </form>

          <Kart>
            <KartBasligi
              baslik="Hesap işlemleri"
              aciklama="Yanlış rolle açılmış kayıt (ör. öğretmen olarak kaydolmuş öğrenci) silinir; kişi doğru rolle yeniden kaydolabilir."
            />
            <KullaniciIslemleri
              kullaniciId={kisi.id}
              aktif={kisi.aktif}
              sifreliMi={false}
              kilitliMi={kilit !== null && kilit > simdi}
            />
          </Kart>
        </>
      )}
    </div>
  );
}
