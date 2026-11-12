import { Award, GraduationCap, School, Users } from "lucide-react";
import { redirect } from "next/navigation";
import { ILLER } from "../../../prisma/veri/iller";
import { KamuSayfaDuzeni } from "@/components/KamuSayfaDuzeni";
import { KayitFormu } from "@/components/KayitFormu";
import { KayitOkulSecimi } from "@/components/KayitOkulSecimi";
import {
  BilgiKutusu,
  Kart,
  SINIF_BIRINCIL_BUTON,
  SINIF_GIRDI,
} from "@/components/ui";
import { prisma } from "@/lib/db";
import { SIFRE_ALT_SINIRI, YURT_DISI } from "@/lib/dis-kimlik/kurallar";
import {
  KAYIT_TIPLERI,
  kayitTipiMi,
  SINIF_SEVIYELERI,
  sinifEtiketi,
} from "@/lib/kayit/kurallar";
import { KAPSAM_DISI_OKUL_KOSULU } from "@/lib/okul/turler";
import { ortam } from "@/lib/ortam";
import { kayitEylemi } from "./eylemler";

/**
 * Öğrenci ve öğretmen kaydı — EBA SSO gelene kadar (17 Eylül 2026).
 *
 * İKİ ADIM, başvuru formuyla aynı sebeple (bkz. app/basvuru/page.tsx): okul
 * listesi ile bağlı. Birinci adımda tip ve il seçilir (GET), ikinci adımda
 * o ilin okullarıyla asıl form gelir.
 *
 * Kayıt bittiğinde oturum AÇILMAZ, kişi giriş ekranına gönderilir
 * (istek: "kayıt olacak ve sonra giriş yapacak").
 */

export const dynamic = "force-dynamic";

const IKONLAR = { OGRENCI: GraduationCap, OGRETMEN: School } as const;

/*
 * MEZUN VE MENTÖR (12 Kasım 2026 · istek: "mezun ve mentör girişi de
 * ekleyeceğiz kayıt olurken"). Bu ikisi burada hesap AÇMAZ: seçilince onaylı
 * başvuru formuna (/basvuru) gidilir, hesap proje yöneticisinin onayıyla
 * açılır ve giriş e-postayla yapılır. Okul ve sınıf sorulmaz; yerine bugünkü
 * durum (üniversite, şirket çalışanı, şirket sahibi) ve yurt dışı seçeneği
 * var.
 */
const BASVURU_TIPLERI = [
  {
    kod: "MEZUN",
    etiket: "Mezun",
    aciklama: "Onaydan sonra e-postanızla girersiniz",
    Ikon: Award,
  },
  {
    kod: "MENTOR",
    etiket: "Mentör",
    aciklama: "Onaydan sonra e-postanızla girersiniz",
    Ikon: Users,
  },
] as const;

export default async function KayitSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ tip?: string; il?: string; hata?: string }>;
}) {
  if (ortam.AUTH_PROVIDER !== "kayit") redirect("/giris");

  const { tip, il, hata } = await searchParams;

  // Mezun ve mentör başvuru formuna gider; il (ya da yurt dışı) taşınır.
  if (tip === "MEZUN" || tip === "MENTOR") {
    const ilParam =
      il && (/^\d{2}$/.test(il) || il === YURT_DISI)
        ? `&il=${encodeURIComponent(il)}`
        : "";
    redirect(`/basvuru?tur=${tip}${ilParam}`);
  }

  const secilenTip = tip && kayitTipiMi(tip) ? tip : null;
  const secilenIl = il && /^\d{2}$/.test(il) ? il : null;
  const ilAdi = ILLER.find((kayit) => kayit.ilKodu === secilenIl)?.ad ?? null;

  // ---- 1. adım: tip ve il -------------------------------------------------
  if (!secilenTip || !secilenIl || !ilAdi) {
    return (
      <KamuSayfaDuzeni
        baslik="Kayıt ol"
        aciklama="Öğrenci ve öğretmenler kaydından sonra T.C. kimlik numarası ve şifreyle girer. Mezun ve mentörler başvuru yapar, onaydan sonra e-posta adresiyle girer."
        geriYol="/giris"
        geriEtiket="Giriş ekranı"
      >
        {(hata || (secilenTip && il === YURT_DISI)) && (
          <BilgiKutusu cesit="hata" className="mt-6">
            {hata ??
              "Yurt dışı yalnızca mezun ve mentörler için. Öğrenci ve öğretmenler okulunun ilini seçer."}
          </BilgiKutusu>
        )}

        <form method="get" className="mt-8 space-y-6">
          <fieldset>
            <legend className="text-sm font-medium text-metin-yumusak">
              Kim olarak kayıt oluyorsunuz?
            </legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {KAYIT_TIPLERI.map((secenek) => {
                const Ikon = IKONLAR[secenek.kod];
                return (
                  <label
                    key={secenek.kod}
                    className="flex cursor-pointer items-center gap-3 rounded-kart border border-cizgi bg-kart p-4 transition hover:border-vurgu has-checked:border-vurgu"
                  >
                    <input
                      type="radio"
                      name="tip"
                      value={secenek.kod}
                      defaultChecked={secilenTip === secenek.kod}
                      required
                    />
                    <span className="flex items-center gap-1.5 font-medium text-metin">
                      <Ikon size={16} className="text-vurgu-metin" />
                      {secenek.etiket}
                    </span>
                  </label>
                );
              })}
              {BASVURU_TIPLERI.map((secenek) => (
                <label
                  key={secenek.kod}
                  className="flex cursor-pointer items-center gap-3 rounded-kart border border-cizgi bg-kart p-4 transition hover:border-vurgu has-checked:border-vurgu"
                >
                  <input
                    type="radio"
                    name="tip"
                    value={secenek.kod}
                    required
                  />
                  <span>
                    <span className="flex items-center gap-1.5 font-medium text-metin">
                      <secenek.Ikon size={16} className="text-vurgu-metin" />
                      {secenek.etiket}
                    </span>
                    <span className="mt-0.5 block text-xs text-metin-yumusak">
                      {secenek.aciklama}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="block max-w-sm">
            <span className="text-sm font-medium text-metin-yumusak">
              İl
            </span>
            <select
              name="il"
              required
              defaultValue={secilenIl ?? ""}
              className={SINIF_GIRDI}
            >
              <option value="">Seçiniz</option>
              {ILLER.map((kayit) => (
                <option key={kayit.ilKodu} value={kayit.ilKodu}>
                  {kayit.ad}
                </option>
              ))}
              <option value={YURT_DISI}>Yurt dışı (mezun ve mentör)</option>
            </select>
            <span className="mt-1 block text-xs text-metin-yumusak">
              Öğrenci ve öğretmenler okulunun ilini, mezun ve mentörler
              yaşadığı ili seçer.
            </span>
          </label>

          <button type="submit" className={SINIF_BIRINCIL_BUTON}>
            Devam et
          </button>
        </form>
      </KamuSayfaDuzeni>
    );
  }

  // ---- 2. adım: asıl form -------------------------------------------------
  const ogrenciMi = secilenTip === "OGRENCI";
  const [okullar, ilceler] = await Promise.all([
    prisma.kurum.findMany({
      // Açık öğretim liseleri listede çıkmaz (bkz. lib/okul/turler.ts).
      where: { ilKodu: secilenIl, aktif: true, ...KAPSAM_DISI_OKUL_KOSULU },
      select: { kurumKodu: true, ad: true, okulTuru: true, ilceKodu: true },
      orderBy: { ad: "asc" },
    }),
    // İlçe seçimi (31 Ekim 2026): 973 ilçe yüklü, seçilen ilinkiler gelir.
    prisma.ilce.findMany({
      where: { ilKodu: secilenIl },
      select: { ilceKodu: true, ad: true },
      orderBy: { ad: "asc" },
    }),
  ]);

  return (
    <KamuSayfaDuzeni
      baslik={ogrenciMi ? "Öğrenci kaydı" : "Öğretmen kaydı"}
      aciklama={`${ilAdi} · Bilgileriniz e-Okul/MEBBİS kayıtlarınızla aynı olmalı.`}
      geriYol="/kayit"
      geriEtiket="Tip ve il seçimine dön"
    >
      {hata && (
        <BilgiKutusu cesit="hata" className="mt-6">
          {hata}
        </BilgiKutusu>
      )}

      {okullar.length === 0 && (
        <BilgiKutusu cesit="uyari" className="mt-6">
          {ilAdi} için okul listesi henüz boş — bu bir hata değil. Okul
          kutusunda &quot;Okulum listede yok&quot; seçeneğini seçip okulunuzun
          adını yazmanız yeterli.
        </BilgiKutusu>
      )}

      <KayitFormu eylem={kayitEylemi} sifreAltSiniri={SIFRE_ALT_SINIRI}>
        <input type="hidden" name="tip" value={secilenTip} />
        <input type="hidden" name="ilKodu" value={secilenIl} />

        <Kart>
          <h2 className="mb-4 text-lg font-semibold text-baslik">
            Kimlik bilgileri
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="text-sm font-medium text-metin-yumusak">
                T.C. kimlik numarası
              </span>
              <input
                name="tcKimlikNo"
                required
                inputMode="numeric"
                pattern="[0-9]{11}"
                maxLength={11}
                autoComplete="off"
                className={SINIF_GIRDI}
              />
              <span className="mt-1 block text-xs text-metin-yumusak">
                Giriş adınız bu olacak.
              </span>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-metin-yumusak">Ad</span>
              <input
                name="ad"
                required
                maxLength={100}
                autoComplete="given-name"
                className={SINIF_GIRDI}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-metin-yumusak">
                Soyad
              </span>
              <input
                name="soyad"
                required
                maxLength={100}
                autoComplete="family-name"
                className={SINIF_GIRDI}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-metin-yumusak">
                Cinsiyet
              </span>
              <select
                name="cinsiyet"
                required
                defaultValue=""
                className={SINIF_GIRDI}
              >
                <option value="">Seçiniz</option>
                <option value="K">Kadın</option>
                <option value="E">Erkek</option>
              </select>
            </label>
          </div>
        </Kart>

        <Kart>
          <h2 className="mb-4 text-lg font-semibold text-baslik">
            İletişim bilgileri
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-metin-yumusak">
                E-posta
              </span>
              <input
                type="email"
                name="eposta"
                required
                maxLength={150}
                autoComplete="email"
                className={SINIF_GIRDI}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-metin-yumusak">
                Telefon
              </span>
              <input
                type="tel"
                name="telefon"
                required
                maxLength={20}
                autoComplete="tel"
                placeholder="05xx xxx xx xx"
                className={SINIF_GIRDI}
              />
            </label>
          </div>
          <p className="mt-2 text-xs text-metin-yumusak">
            Profilinizden sonradan değiştirebilirsiniz.
          </p>
        </Kart>

        <Kart>
          <h2 className="mb-4 text-lg font-semibold text-baslik">
            Okul bilgileri
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <KayitOkulSecimi
              okullar={okullar}
              ilceler={ilceler}
              ilAdi={ilAdi}
              turSecilsin={ogrenciMi}
            />

            {ogrenciMi ? (
              <>
                <label className="block">
                  <span className="text-sm font-medium text-metin-yumusak">
                    Sınıf
                  </span>
                  <select
                    name="sinifSeviyesi"
                    required
                    defaultValue=""
                    className={SINIF_GIRDI}
                  >
                    <option value="">Seçiniz</option>
                    {SINIF_SEVIYELERI.map((seviye) => (
                      <option key={seviye} value={seviye}>
                        {sinifEtiketi(seviye)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-metin-yumusak">
                    Şube (isteğe bağlı)
                  </span>
                  <input
                    name="sube"
                    maxLength={10}
                    placeholder="A"
                    autoCapitalize="characters"
                    className={SINIF_GIRDI}
                  />
                  <span className="mt-1 block text-xs text-metin-yumusak">
                    Yalnızca harf: A, B, C…
                  </span>
                </label>
              </>
            ) : (
              <label className="block sm:col-span-2">
                <span className="text-sm font-medium text-metin-yumusak">
                  Branş
                </span>
                <input
                  name="brans"
                  required
                  maxLength={100}
                  placeholder="Bilişim Teknolojileri"
                  className={SINIF_GIRDI}
                />
              </label>
            )}
          </div>
        </Kart>

        <Kart>
          <h2 className="mb-4 text-lg font-semibold text-baslik">Şifre</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-metin-yumusak">
                Şifre
              </span>
              <input
                type="password"
                name="sifre"
                required
                minLength={SIFRE_ALT_SINIRI}
                maxLength={200}
                autoComplete="new-password"
                className={SINIF_GIRDI}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-metin-yumusak">
                Şifre (tekrar)
              </span>
              <input
                type="password"
                name="sifreTekrar"
                required
                minLength={SIFRE_ALT_SINIRI}
                maxLength={200}
                autoComplete="new-password"
                className={SINIF_GIRDI}
              />
            </label>
          </div>
          <p className="mt-2 text-sm font-medium text-metin">
            En az {SIFRE_ALT_SINIRI} karakter; adınızı, soyadınızı ya da T.C.
            kimlik numaranızı içeremez.
          </p>
        </Kart>

      </KayitFormu>
    </KamuSayfaDuzeni>
  );
}
