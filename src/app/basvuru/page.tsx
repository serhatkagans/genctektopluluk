import {
  Building2,
  CheckCircle2,
  GraduationCap,
  Send,
  Users,
} from "lucide-react";
import Link from "next/link";
import { ILLER } from "../../../prisma/veri/iller";
import { GuncelDurumAlanlari } from "@/components/GuncelDurumAlanlari";
import { KamuSayfaDuzeni } from "@/components/KamuSayfaDuzeni";
import {
  BilgiKutusu,
  Kart,
  SINIF_BIRINCIL_BUTON,
  SINIF_GIRDI,
} from "@/components/ui";
import { prisma } from "@/lib/db";
import {
  disTuruMu,
  SIFRE_ALT_SINIRI,
  YURT_DISI,
  yurtDisiSecilebilirMi,
} from "@/lib/dis-kimlik/kurallar";
import { ortam } from "@/lib/ortam";
import { PAYDAS_TURU_ETIKETLERI } from "@/lib/paydas/kurallar";
import { basvuruEylemi } from "./eylemler";

/**
 * EBA dışı giriş başvurusu (mezun, paydaş temsilcisi).
 *
 * FORM İKİ ADIMLIDIR ve bu bir tasarım tercihi değil zorunluluk: okul ve
 * paydaş listeleri İLE bağlıdır. Türkiye'nin tüm okullarını tek bir açılır
 * listeye basmak hem kullanılamaz hem de her başvuru sayfasında gereksiz bir
 * yük olurdu. Birinci adımda tür ve il seçilir (GET), ikinci adımda o ilin
 * listeleriyle asıl form gelir.
 *
 * AYDINLATMA METNİ BURADA OKUTULUR. Kişinin verisi başvuru anında işlenmeye
 * başlıyor, oysa kullanıcı kaydı henüz açılmıyor — onayın kullanici_onayi'na
 * yazılamamasının sebebi bu (bkz. dis_kullanici_basvurusu tablosu). İlk
 * girişte ayrıca /onay kapısından geçilir; o, sisteme girdikten SONRA işlenen
 * verinin karşılığıdır.
 */

export const dynamic = "force-dynamic";

/*
 * TEK FORM, ÜÇ SIFAT (7 Ağustos 2026 · istek: "Paydaş/Mentör başvurusu tek bir
 * formdan yapılacak", "mezunlar da paydaştan girsin").
 *
 * Üçü de aynı formdan, aynı doğrulamadan ve aynı KVKK metninden geçiyor; ayrı
 * formlar aynı işi üç kez yazdırırdı. Değişen tek şey ikinci adımda açılan
 * alanlar.
 */
const TUR_KARTLARI = [
  {
    kod: "MEZUN" as const,
    baslik: "Mezun",
    aciklama:
      "GençTek ekosisteminden geçmiş, mezun olmuş öğrenci. Mezun olduğunuz okulu ve yılı belirtirsiniz.",
    Ikon: GraduationCap,
  },
  {
    kod: "PAYDAS" as const,
    baslik: "Paydaş temsilcisi",
    aciklama:
      "İş birliği yapılan üniversite, kurum ya da şirketin temsilcisi. Kurumunuzun sistemde kayıtlı olması gerekir.",
    Ikon: Building2,
  },
  {
    kod: "MENTOR" as const,
    baslik: "Mentör",
    aciklama:
      "Bildiğiniz konularda öğrencilere yol göstermek istiyorsunuz. Çalışma gruplarını ve konularınızı seçersiniz.",
    Ikon: Users,
  },
];

export default async function BasvuruSayfasi({
  searchParams,
}: {
  searchParams: Promise<{
    tur?: string;
    il?: string;
    hata?: string;
    durum?: string;
  }>;
}) {
  const { tur, il, hata, durum } = await searchParams;

  if (durum === "alindi") {
    return (
      <KamuSayfaDuzeni
        baslik="Başvurunuz alındı"
        aciklama="Başvurunuz proje yöneticisinin onayına düştü."
        genislik="max-w-xl"
      >
        <BilgiKutusu cesit="olumlu" className="mt-6">
          <p className="flex items-start gap-2">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0" aria-hidden />
            <span>
              Başvurunuz kaydedildi. Sonuç, verdiğiniz e-posta adresine
              bildirilecek. <strong>Onaylanana kadar giriş yapamazsınız.</strong>
            </span>
          </p>
        </BilgiKutusu>
        <p className="mt-6 text-sm">
          <Link href="/" className="font-medium text-vurgu-metin">
            Açılış ekranına dön
          </Link>
        </p>
      </KamuSayfaDuzeni>
    );
  }

  const secilenTur = tur && disTuruMu(tur) ? tur : null;
  /*
   * YURT DIŞI (12 Kasım 2026 · istek: "ülke dışında da olabilir"). İl
   * listesinin sonunda; mezun ve mentör seçebilir, paydaş seçemez.
   */
  const yurtDisiMi = il === YURT_DISI;
  const secilenIl = il && (/^\d{2}$/.test(il) || yurtDisiMi) ? il : null;
  const ilAdi = yurtDisiMi
    ? "Yurt dışı"
    : (ILLER.find((kayit) => kayit.ilKodu === secilenIl)?.ad ?? null);
  const yurtDisiHatasi =
    secilenTur !== null && yurtDisiMi && !yurtDisiSecilebilirMi(secilenTur)
      ? "Paydaş başvurusunda kurumunuzun bulunduğu ili seçin; yurt dışı seçilemez."
      : null;

  // ---- 1. adım: tür ve il ------------------------------------------------
  if (!secilenTur || !secilenIl || !ilAdi || yurtDisiHatasi) {
    return (
      <KamuSayfaDuzeni
        baslik="Sisteme giriş başvurusu"
        aciklama="Mezun, mentör ve paydaş temsilcileri için. Başvurunuz proje yöneticisi tarafından değerlendirilir; onaylanınca e-posta adresiniz ve şifrenizle giriş yaparsınız."
      >
        {(hata || yurtDisiHatasi) && (
          <BilgiKutusu cesit="hata" className="mt-6">
            {yurtDisiHatasi ?? hata}
          </BilgiKutusu>
        )}

        <BilgiKutusu cesit="uyari" className="mt-6">
          {ortam.AUTH_PROVIDER === "kayit" ? (
            <>
              Öğrenci ve öğretmenler başvuru yapmaz,{" "}
              <Link href="/kayit" className="font-medium underline">
                kayıt ekranından
              </Link>{" "}
              kayıt olur.
            </>
          ) : (
            <>
              Öğrenci ve öğretmenler başvuru yapmaz — kimlikleri EBA&apos;dan
              gelir ve{" "}
              <Link href="/giris" className="font-medium underline">
                EBA girişini
              </Link>{" "}
              kullanırlar.
            </>
          )}
        </BilgiKutusu>

        <form method="get" className="mt-8 space-y-6">
          <fieldset>
            <legend className="text-sm font-medium text-metin-yumusak">
              Hangi sıfatla başvuruyorsunuz?
            </legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {TUR_KARTLARI.map((kart) => (
                <label
                  key={kart.kod}
                  className="flex cursor-pointer gap-3 rounded-kart border border-cizgi bg-kart p-4 transition hover:border-vurgu has-checked:border-vurgu"
                >
                  <input
                    type="radio"
                    name="tur"
                    value={kart.kod}
                    defaultChecked={secilenTur === kart.kod}
                    required
                    className="mt-1"
                  />
                  <span>
                    <span className="flex items-center gap-1.5 font-medium text-metin">
                      <kart.Ikon size={16} className="text-vurgu-metin" />
                      {kart.baslik}
                    </span>
                    <span className="mt-1 block text-sm text-metin-yumusak">
                      {kart.aciklama}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="block max-w-sm">
            <span className="text-sm font-medium text-metin-yumusak">
              Bulunduğunuz il
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
              <option value={YURT_DISI}>Yurt dışı</option>
            </select>
            <span className="mt-1 block text-xs text-metin-yumusak">
              Yurt dışında yaşayan mezun ve mentörler &quot;Yurt dışı&quot;nı
              seçer; ülke ve şehir sonraki adımda sorulur.
            </span>
          </label>

          <button type="submit" className={SINIF_BIRINCIL_BUTON}>
            Devam et
          </button>
        </form>
      </KamuSayfaDuzeni>
    );
  }

  // ---- 2. adım: asıl form ------------------------------------------------
  const mezunMu = secilenTur === "MEZUN";
  const mentorMu = secilenTur === "MENTOR";

  const [okullar, paydaslar, calismaGruplari] = await Promise.all([
    mezunMu && !yurtDisiMi
      ? prisma.kurum.findMany({
          where: { ilKodu: secilenIl },
          select: { kurumKodu: true, ad: true },
          orderBy: { ad: "asc" },
        })
      : Promise.resolve([]),
    secilenTur === "PAYDAS"
      ? prisma.paydas.findMany({
          where: { ilKodu: secilenIl, aktif: true },
          select: { id: true, ad: true, tur: true },
          orderBy: { ad: "asc" },
        })
      : Promise.resolve([]),
    /*
     * Çalışma grupları HER TÜRDE çekiliyor: mentörlük yalnızca MENTOR türüne
     * özel değil — mezun ve paydaş da "ayrıca mentörlük yapmak istiyorum"
     * diyebiliyor (istek: tek form).
     */
    prisma.calismaGrubu.findMany({
      where: { aktif: true },
      orderBy: { siraNo: "asc" },
      select: { id: true, ad: true },
    }),
  ]);

  const buYil = new Date().getFullYear();

  return (
    <KamuSayfaDuzeni
      baslik={
        mezunMu
          ? "Mezun başvurusu"
          : mentorMu
            ? "Mentör başvurusu"
            : "Paydaş temsilcisi başvurusu"
      }
      aciklama={`${ilAdi} · Başvurunuz proje yöneticisinin onayından sonra etkinleşir.`}
      geriYol="/basvuru"
      geriEtiket="Tür ve il seçimine dön"
    >
      {hata && (
        <BilgiKutusu cesit="hata" className="mt-6">
          {hata}
        </BilgiKutusu>
      )}

      {secilenTur === "PAYDAS" && paydaslar.length === 0 && (
        <BilgiKutusu cesit="uyari" className="mt-6">
          {ilAdi} ilinde kayıtlı aktif paydaş kurumu yok. Paydaş envanterini il
          koordinatörü yönetiyor: kurumunuzun eklenmesi için ilinizin GençTek
          koordinatörüne başvurun.
        </BilgiKutusu>
      )}

      <form action={basvuruEylemi} className="mt-6 space-y-8">
        <input type="hidden" name="tur" value={secilenTur} />
        <input type="hidden" name="ilKodu" value={secilenIl} />

        {yurtDisiMi && (
          <Kart>
            <h2 className="mb-4 text-lg font-semibold text-baslik">
              Yaşadığınız yer
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-metin-yumusak">
                  Ülke
                </span>
                <input
                  name="ulke"
                  required
                  maxLength={100}
                  autoComplete="country-name"
                  className={SINIF_GIRDI}
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-metin-yumusak">
                  Şehir
                </span>
                <input
                  name="yurtDisiSehir"
                  required
                  maxLength={100}
                  autoComplete="address-level2"
                  className={SINIF_GIRDI}
                />
              </label>
            </div>
          </Kart>
        )}

        <Kart>
          <h2 className="mb-4 text-lg font-semibold text-baslik">
            Kimlik ve iletişim
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-metin-yumusak">Ad</span>
              <input name="ad" required maxLength={100} className={SINIF_GIRDI} />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-metin-yumusak">
                Soyad
              </span>
              <input
                name="soyad"
                required
                maxLength={100}
                className={SINIF_GIRDI}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-metin-yumusak">
                E-posta adresi
              </span>
              <input
                type="email"
                name="eposta"
                required
                maxLength={150}
                autoComplete="email"
                className={SINIF_GIRDI}
              />
              <span className="mt-1 block text-xs text-metin-yumusak">
                Giriş adınız bu olacak; sonuç da buraya bildirilecek.
              </span>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-metin-yumusak">
                Telefon (isteğe bağlı)
              </span>
              <input
                name="telefon"
                maxLength={20}
                autoComplete="tel"
                className={SINIF_GIRDI}
              />
            </label>
          </div>
        </Kart>

        {/*
          MENTÖR TÜRÜNDE BU KART HİÇ BASILMAZ: mentörün ne mezun olduğu okulu
          ne temsil ettiği kurum sorulur — bağını KONULAR üzerinden kuruyor.
          Boş bir kart basmak, doldurulacak bir şey varmış izlenimi verirdi.
        */}
        {!mentorMu && (
        <Kart>
          <h2 className="mb-4 text-lg font-semibold text-baslik">
            {mezunMu ? "Mezuniyet bilgisi" : "Temsil ettiğiniz kurum"}
          </h2>

          {mezunMu ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {!yurtDisiMi && (
                <label className="block sm:col-span-2">
                  <span className="text-sm font-medium text-metin-yumusak">
                    Mezun olduğunuz okul (isteğe bağlı)
                  </span>
                  <select name="mezunKurumKodu" className={SINIF_GIRDI}>
                    <option value="">Listede yok / belirtmek istemiyorum</option>
                    {okullar.map((okul) => (
                      <option key={okul.kurumKodu} value={okul.kurumKodu}>
                        {okul.ad}
                      </option>
                    ))}
                  </select>
                  <span className="mt-1 block text-xs text-metin-yumusak">
                    Yalnızca {ilAdi} ilindeki okullar listeleniyor.
                  </span>
                </label>
              )}
              {/*
                ELLE YAZILAN OKUL (12 Kasım 2026): listede olmayan ya da
                yurt dışındaki kişi okulunu buraya yazar. Listeden seçim
                yapıldıysa sunucu bu kutuyu dikkate almaz.
              */}
              <label className="block">
                <span className="text-sm font-medium text-metin-yumusak">
                  {yurtDisiMi
                    ? "Mezun olduğunuz okul (isteğe bağlı)"
                    : "Okulunuz listede yoksa adı"}
                </span>
                <input
                  name="mezunOkulAdi"
                  maxLength={250}
                  className={SINIF_GIRDI}
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-metin-yumusak">
                  Mezuniyet yılı
                </span>
                <input
                  name="mezuniyetYili"
                  required
                  inputMode="numeric"
                  pattern="\d{4}"
                  placeholder={String(buYil)}
                  className={SINIF_GIRDI}
                />
              </label>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-metin-yumusak">
                  Paydaş kurum
                </span>
                <select name="paydasId" required className={SINIF_GIRDI}>
                  <option value="">Seçiniz</option>
                  {paydaslar.map((paydas) => (
                    <option key={paydas.id} value={paydas.id}>
                      {paydas.ad} · {PAYDAS_TURU_ETIKETLERI[paydas.tur]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-medium text-metin-yumusak">
                  Kurumdaki göreviniz / unvanınız
                </span>
                <input
                  name="gorevUnvani"
                  required
                  maxLength={150}
                  className={SINIF_GIRDI}
                />
              </label>
            </div>
          )}
        </Kart>
        )}

        {/*
          ŞU ANKİ DURUM (12 Kasım 2026 · istekler: "Mezun, üniversite,
          çalışıyor", "bir şirket çalışanı, şirketi olan da olabilir").
          Mezun ve mentörde sorulur; paydaşın kurumu yukarıda zaten var.
        */}
        {secilenTur !== "PAYDAS" && (
          <Kart>
            <h2 className="mb-4 text-lg font-semibold text-baslik">
              Şu an ne yapıyorsunuz?
            </h2>
            <GuncelDurumAlanlari />
          </Kart>
        )}

        {/*
          MENTÖRLÜK (7 Ağustos 2026 · "Paydaş/Mentör başvurusu tek bir formdan
          yapılacak").

          MENTOR türünde işaret ZORUNLU ve gizli alandan geliyor — o türü seçen
          kişi zaten mentörlük istiyor, ayrıca sormak gereksiz bir adım olurdu.
          Mezun ve paydaş için AÇILIR KUTU: ikisi de ayrıca mentörlük
          yapabilir.
        */}
        <Kart>
          <h2 className="mb-4 text-lg font-semibold text-baslik">
            Mentörlük
          </h2>

          {mentorMu ? (
            <input type="hidden" name="mentorlukIstiyor" value="evet" />
          ) : (
            <label className="mb-4 flex items-start gap-2">
              <input
                type="checkbox"
                name="mentorlukIstiyor"
                value="evet"
                className="mt-1 h-4 w-4 rounded border-cizgi accent-[var(--renk-birincil)]"
              />
              <span className="text-sm text-metin">
                <span className="font-medium">
                  Ayrıca mentörlük yapmak istiyorum
                </span>
                <span className="mt-0.5 block text-metin-yumusak">
                  İşaretlerseniz aşağıdaki alanlar da değerlendirilir ve
                  onaylanırsanız panodaki &quot;Mentöre sor&quot; ilanlarında
                  mentör olarak görünürsünüz.
                </span>
              </span>
            </label>
          )}

          <fieldset>
            <legend className="text-sm font-medium text-metin-yumusak">
              Hangi çalışma gruplarında mentörlük yapabilirsiniz?
            </legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {calismaGruplari.map((grup) => (
                <label
                  key={grup.id}
                  className="flex items-center gap-2 rounded-md border border-cizgi px-3 py-2 text-sm text-metin"
                >
                  <input
                    type="checkbox"
                    name="mentorlukGrupId"
                    value={grup.id}
                    className="h-4 w-4 rounded border-cizgi accent-[var(--renk-birincil)]"
                  />
                  {grup.ad}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="mt-4 block">
            <span className="text-sm font-medium text-metin-yumusak">
              Diğer mentörlük konularınız
            </span>
            <textarea
              name="mentorlukKonulari"
              rows={2}
              maxLength={500}
              placeholder="3B tasarım, Arduino, girişimcilik…"
              className={SINIF_GIRDI}
            />
            <span className="mt-1 block text-xs text-metin-yumusak">
              Listede olmayan konuları buraya yazabilirsiniz.
            </span>
          </label>
        </Kart>

        <Kart>
          <h2 className="mb-4 text-lg font-semibold text-baslik">
            Başvuru gerekçeniz
          </h2>
          <label className="block">
            <span className="text-sm font-medium text-metin-yumusak">
              Ekosisteme nasıl katkı vermek istiyorsunuz?
            </span>
            <textarea
              name="beyan"
              required
              rows={5}
              maxLength={2000}
              className={SINIF_GIRDI}
            />
            <span className="mt-1 block text-xs text-metin-yumusak">
              Başvurunuz bu açıklamaya bakılarak değerlendirilecek; birkaç cümle
              yazın.
            </span>
          </label>
        </Kart>

        <Kart>
          <h2 className="mb-4 text-lg font-semibold text-baslik">Şifreniz</h2>
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
                autoComplete="new-password"
                className={SINIF_GIRDI}
              />
              <span className="mt-1 block text-xs text-metin-yumusak">
                En az {SIFRE_ALT_SINIRI} karakter. Adınızı, soyadınızı ya da
                e-posta adresinizi içeremez.
              </span>
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
                autoComplete="new-password"
                className={SINIF_GIRDI}
              />
            </label>
          </div>
          <p className="mt-3 text-xs text-metin-yumusak">
            Şifreniz yalnızca onaylandıktan sonra işe yarar; onay öncesi giriş
            yapılamaz.
          </p>
        </Kart>

        {/*
          KVKK AYDINLATMA KARTI VE ONAY KUTUSU KALKTI (21 Ağustos 2026 ·
          istekler: "kvkk olmasın" · "kvkk olmayacak yani sadece çerez
          politikası"). Başvuru artık belge okutmuyor; uygulamanın açılışında
          bir kez çıkan çerez bildirimi dışında hiçbir metin onaya
          bağlanmıyor.
        */}

        <button type="submit" className={SINIF_BIRINCIL_BUTON}>
          <Send size={16} aria-hidden />
          Başvuruyu gönder
        </button>
      </form>
    </KamuSayfaDuzeni>
  );
}
