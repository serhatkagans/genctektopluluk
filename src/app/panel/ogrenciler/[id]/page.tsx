import {
  ArrowLeft,
  BadgeCheck,
  ExternalLink,
  FileText,
  IdCard,
  Layers,
  Mail,
  Plus,
  Sparkles,
  UserCheck,
  X,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  KatilimKarti,
  KazanimBolumleri,
  RozetOzeti,
  SaltOkunurAlan,
  UrunlerKarti,
} from "@/components/OgrenciProfilBolumleri";
import {
  BilgiKutusu,
  Kart,
  KartBasligi,
  SayfaBasligi,
  SINIF_BIRINCIL_BUTON,
  SINIF_GIRDI,
  SINIF_IKINCIL_BUTON,
} from "@/components/ui";
import { oturumKullanicisiZorunlu } from "@/lib/auth/oturum";
import { cvSinirlariniGetir } from "@/lib/ogrenci/cv";
import { cvTipAdlari } from "@/lib/ogrenci/cv-kurallar";
import { BAGLANTI_TANIMLARI } from "@/lib/ogrenci/iletisim-kurallar";
import {
  gorunurOgrenciGetir,
  ogrenciProfilVerisiGetir,
} from "@/lib/ogrenci/profil";
import { SALT_OKUNUR_ACIKLAMASI } from "@/lib/kullanici/salt-okunur";
import { uygulamaYolu } from "@/lib/ortam";
import { tarihSaatYaz, tarihYaz } from "@/lib/tarih";
import { gorevRolAdi } from "@/lib/yetki/etiketler";
import {
  danismanligiSonlandirabilirMi,
  ogrenciCalismaGrubuYonetebilirMi,
  projeYoneticisiMi,
} from "@/lib/yetki/izinler";
import { erisimLogla } from "@/lib/yetki/log";
import { ildekiDanismanlar } from "@/lib/danisman/atama";
import { okulAdiBenzerMi } from "@/lib/okul/benzerlik";
import { ATAMAYI_YALNIZCA_YONETICI_YAPAR } from "@/lib/danisman/politika";
import {
  yoneticiDanismanAtaEylemi,
  danismanligiBirakEylemi,
  ogrenciyeGrupEkleEylemi,
  ogrenciyiGruptanCikarEylemi,
} from "./eylemler";

export const dynamic = "force-dynamic";

/**
 * Tekil öğrenci profili — danışman öğretmen, il koordinatörü ve proje
 * yöneticisinin gördüğü ekran (references/permissions.md Bölüm 7,
 * `GET /ogrenciler/:id`).
 *
 * Erişim MERKEZİ kapsam filtresinden geçer (`gorunurOgrenciGetir`); kapsam dışı
 * öğrencide "yetkiniz yok" değil 404 döner, kaydın varlığı bile sızmaz. Öğrenci
 * kendi id'siyle buraya girebilir çünkü kapsam filtresi ona "yalnızca kendisi"
 * diyor — ama düzenleme yolları kendi profilindedir, burada yalnızca okur.
 *
 * Görüntüleme erişim logu YAZILIR: bu ekran listeden daha fazla kişisel veri
 * gösterir (iletişim bilgisi, CV, kazanım beyanları).
 */

const DURUM_MESAJLARI: Record<string, string> = {
  "grup-eklendi": "Öğrenci çalışma grubuna eklendi.",
  "grup-cikarildi": "Öğrenci çalışma grubundan çıkarıldı.",
  "danisman-atandi": "Danışman öğretmen atandı; öğrenciye bildirim gönderildi.",
  "danisman-ayni": "Seçilen öğretmen zaten bu öğrencinin danışmanı.",
};

function tekil(deger: string | string[] | undefined): string | null {
  if (Array.isArray(deger)) return deger[0] ?? null;
  return deger ?? null;
}

export default async function OgrenciProfilSayfasi({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const kullanici = await oturumKullanicisiZorunlu();
  const { id } = await params;
  const parametreler = await searchParams;

  const ogrenci = await gorunurOgrenciGetir(
    kullanici,
    Number.parseInt(id, 10),
  );
  if (!ogrenci) notFound();

  const { kazanim, eklenebilirGruplar } =
    await ogrenciProfilVerisiGetir(ogrenci);

  await erisimLogla({
    kullaniciId: kullanici.id,
    islem: "GORUNTULEME",
    hedefTip: "OGRENCI",
    hedefId: ogrenci.id,
    detay: "Öğrenci profili görüntülendi",
  });

  const kendiProfili = ogrenci.id === kullanici.id;
  const grupYonetimi =
    ogrenciCalismaGrubuYonetebilirMi(kullanici) && !kendiProfili;

  const atama = ogrenci.ogrenciAtamalari[0];
  const danismanIletisimi = [
    atama?.danisman.ogretmenProfil?.eposta,
    atama?.danisman.ogretmenProfil?.telefon,
  ].filter((deger): deger is string => Boolean(deger?.trim()));

  const gorevRolleri = ogrenci.gorevRolleri.filter(
    (gorev) => gorev.egitimOgretimYili === ogrenci.egitimOgretimYili,
  );

  const kendiDanismanligi = atama?.danismanKullaniciId === kullanici.id;
  /*
   * Koordinatör/merkez, kapsamındaki öğrencinin danışmanlığını sonlandırabilir.
   * Öğrenci ZATEN kapsam filtresinden geçerek geldi (gorunurOgrenciGetir), o
   * yüzden burada rol sormak yeterli; eylem tarafında kapsam yeniden sorulur.
   */
  const baskasininDanismanligimiSonlandirir =
    !kendiDanismanligi && danismanligiSonlandirabilirMi(kullanici);

  /*
   * DANIŞMAN ATAMASINI PROJE YÖNETİCİSİ YAPAR (23 Ekim 2026). Seçenekler
   * öğrencinin İLİNDEKİ danışman öğretmenler; aynı ya da benzer adlı okuldaki
   * öğretmenler üstte ve işaretli (okul adları elle yazıldığı için birebir
   * eşleşme aranmıyor — bkz. lib/okul/benzerlik.ts).
   */
  const yoneticiAtamasi = projeYoneticisiMi(kullanici) && !kendiProfili;
  const ogrenciOkulAdi = ogrenci.kurum?.ad ?? ogrenci.beyanOkulAdi;
  const ayniOkulMu = (aday: { kurumKodu: number | null; okulAdi: string | null }) =>
    (ogrenci.kurumKodu !== null && aday.kurumKodu === ogrenci.kurumKodu) ||
    okulAdiBenzerMi(aday.okulAdi, ogrenciOkulAdi);
  const atanabilirler =
    yoneticiAtamasi && ogrenci.ilKodu
      ? (await ildekiDanismanlar(ogrenci.ilKodu))
          .map((aday) => ({ ...aday, ayniOkul: ayniOkulMu(aday) }))
          .sort((a, b) => Number(b.ayniOkul) - Number(a.ayniOkul))
      : [];
  const beyan = ogrenci.ogrenciProfil;
  const danismanBeyani = beyan?.beyanDanismanAd
    ? [
        `${beyan.beyanDanismanAd} ${beyan.beyanDanismanSoyad ?? ""}`.trim(),
        beyan.beyanDanismanBrans,
        beyan.beyanDanismanTelefon,
        beyan.beyanDanismanEposta,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  const cv = ogrenci.ogrenciProfil;
  const cvVar = Boolean(cv?.cvDepolamaYolu);
  /*
   * Kabul edilen biçimler AYARDAN okunuyor (11 Ağustos 2026). Burada üç MIME
   * tipi elle yazılıydı: öğrencinin kendi ekranı ayarı okurken bu ekran sabit
   * bir liste basıyordu ve ikisi ayrışınca öğretmen, öğrenciye yükleyemeyeceği
   * bir biçimi söyler hâle geliyordu. Kural PDF-only'e çekilince fark
   * gerçekleşecekti.
   */
  const cvSinirlari = cvVar ? null : await cvSinirlariniGetir();

  const hata = tekil(parametreler.hata);
  const durum = tekil(parametreler.durum);

  return (
    <div className="space-y-6">
      <Link
        href="/panel/ogrenciler"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-vurgu-metin"
      >
        <ArrowLeft size={15} aria-hidden />
        Öğrenci listesine dön
      </Link>

      <SayfaBasligi
        baslik={`${ogrenci.ad} ${ogrenci.soyad}`}
        aciklama={[
          ogrenci.sinif ? `${ogrenci.sinif}. sınıf` : null,
          ogrenci.kurum?.ad ?? ogrenci.beyanOkulAdi,
          ogrenci.il?.ad,
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

      {hata && <BilgiKutusu cesit="hata">{hata}</BilgiKutusu>}
      {durum && DURUM_MESAJLARI[durum] && (
        <BilgiKutusu cesit="olumlu">{DURUM_MESAJLARI[durum]}</BilgiKutusu>
      )}

      <Kart>
        <KartBasligi
          baslik="Kimlik bilgileri"
          aciklama={SALT_OKUNUR_ACIKLAMASI}
          Ikon={IdCard}
        />
        <dl className="grid gap-5 sm:grid-cols-2">
          <SaltOkunurAlan etiket="Ad" deger={ogrenci.ad} />
          <SaltOkunurAlan etiket="Soyad" deger={ogrenci.soyad} />
          <SaltOkunurAlan
            etiket="Cinsiyet"
            deger={ogrenci.cinsiyet === "K" ? "Kadın" : "Erkek"}
          />
          <SaltOkunurAlan
            etiket="Eğitim-öğretim yılı"
            deger={ogrenci.egitimOgretimYili}
          />
          <SaltOkunurAlan etiket="Sınıf" deger={ogrenci.sinif} />
          <SaltOkunurAlan
            etiket={ogrenci.kurum ? "Okul" : "Okul (listede yok)"}
            deger={ogrenci.kurum?.ad ?? ogrenci.beyanOkulAdi ?? null}
          />
          <SaltOkunurAlan
            etiket="Okul türü"
            deger={ogrenci.kurum?.okulTuru ?? ogrenci.beyanOkulTuru ?? null}
          />
          <SaltOkunurAlan
            etiket="İl / İlçe"
            deger={
              ogrenci.il
                ? `${ogrenci.il.ad}${ogrenci.ilce ? ` / ${ogrenci.ilce.ad}` : ""}`
                : null
            }
          />
        </dl>
      </Kart>

      <Kart>
        <KartBasligi
          baslik="İletişim bilgileri"
          aciklama="Öğrencinin kendi girdiği bilgilerdir; e-Okul'dan gelmez."
          Ikon={Mail}
        />
        <dl className="grid gap-5 sm:grid-cols-2">
          <SaltOkunurAlan
            etiket="E-posta"
            deger={ogrenci.ogrenciProfil?.eposta ?? null}
          />
          <SaltOkunurAlan
            etiket="Telefon"
            deger={ogrenci.ogrenciProfil?.telefon ?? null}
          />
          {/*
            Bağlantılar tıklanabilir verilir ama dış siteye çıkar:
            `noopener noreferrer` olmadan açılan sayfa `window.opener`
            üzerinden bu sekmeyi yönlendirebilirdi. Protokol kontrolü kayıt
            sırasında yapılıyor (bkz. lib/ogrenci/iletisim-kurallar.ts).
          */}
          {BAGLANTI_TANIMLARI.map((tanim) => {
            const adres = ogrenci.ogrenciProfil?.[tanim.alan] ?? null;
            return (
              <div key={tanim.alan}>
                <dt className="text-sm font-medium text-metin-yumusak">
                  {tanim.etiket}
                </dt>
                <dd className="mt-0.5 text-metin">
                  {adres ? (
                    <a
                      href={adres}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 font-medium text-vurgu-metin underline underline-offset-2"
                    >
                      <ExternalLink size={14} aria-hidden />
                      {adres}
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
            );
          })}
        </dl>
      </Kart>

      <Kart>
        <KartBasligi baslik="Danışman öğretmeni" Ikon={UserCheck} />
        <p className="text-metin">
          {atama
            ? `${atama.danisman.ad} ${atama.danisman.soyad}${
                atama.danisman.brans ? ` · ${atama.danisman.brans}` : ""
              }`
            : "Henüz danışman atanmadı."}
        </p>
        {atama && danismanIletisimi.length > 0 && (
          <p className="mt-1 text-sm text-metin-yumusak">
            {danismanIletisimi.join(" · ")}
          </p>
        )}
        {atama && (
          <p className="mt-1 text-sm text-metin-yumusak">
            {tarihYaz(atama.baslangicTarihi)} tarihinden beri
          </p>
        )}

        {/*
          ÖĞRENCİNİN BEYANI (23 Ekim 2026). Öğrencinin panelden yazdığı danışman
          öğretmen bilgisi; atamayı yapan proje yöneticisi buna bakarak karar
          verir. Bir atama değildir.
        */}
        {danismanBeyani && (
          <div className="mt-4 rounded-kart border border-cizgi bg-zemin p-4">
            <p className="text-sm font-medium text-metin">
              Öğrencinin yazdığı danışman öğretmen
            </p>
            <p className="mt-1 text-sm text-metin-yumusak">{danismanBeyani}</p>
          </div>
        )}

        {/*
          YÖNETİCİ ATAMASI (23 Ekim 2026 · istek: "atamayı yönetici yapsın").
          Yalnızca proje yöneticisine basılır; seçenekler öğrencinin OKULUNDAKİ
          danışman öğretmenlerdir.
        */}
        {yoneticiAtamasi && (
          <div className="mt-5 border-t border-cizgi pt-4">
            {atanabilirler.length === 0 ? (
              <BilgiKutusu cesit="uyari">
                Öğrencinin ilinde sisteme kayıtlı danışman öğretmen yok.
                Öğretmen kaydolduğunda burada seçilebilir.
              </BilgiKutusu>
            ) : (
              <form action={yoneticiDanismanAtaEylemi} className="space-y-3">
                <input type="hidden" name="ogrenciId" value={ogrenci.id} />
                <label className="block">
                  <span className="text-sm font-medium text-metin">
                    {atama ? "Danışmanı değiştir" : "Danışman ata"}
                  </span>
                  <select
                    name="danismanId"
                    required
                    defaultValue={atama ? String(atama.danismanKullaniciId) : ""}
                    className={SINIF_GIRDI}
                  >
                    <option value="">Seçiniz</option>
                    {atanabilirler.map((aday) => (
                      <option key={aday.kullaniciId} value={aday.kullaniciId}>
                        {aday.ayniOkul ? "★ " : ""}
                        {aday.ad} {aday.soyad}
                        {aday.brans ? ` · ${aday.brans}` : ""}
                        {aday.okulAdi ? ` · ${aday.okulAdi}` : ""}
                        {` · ${aday.ogrenciSayisi} öğrenci`}
                      </option>
                    ))}
                  </select>
                  <span className="mt-1 block text-xs text-metin-yumusak">
                    ★ öğrencinin okuluyla aynı ya da benzer adlı okuldaki öğretmen.
                  </span>
                </label>
                <button type="submit" className={SINIF_BIRINCIL_BUTON}>
                  <UserCheck size={16} aria-hidden />
                  {atama ? "Danışmanı değiştir" : "Danışman ata"}
                </button>
              </form>
            )}
          </div>
        )}

        {/*
          TEKİL DANIŞMANLIK BIRAKMA (J1 · 6 Ağustos 2026).

          10 AĞUSTOS 2026 · istek: "Görevi bırak kalkacak · öğretmen öğrenciyi
          bırakabilsin, gerekirse koordinatör de bırakabilsin". Bölüm artık iki
          kişiye açık: öğrencinin KENDİ danışmanına ve — öğrenci kapsamındaysa
          — il koordinatörü ile proje yöneticisine. Öğretmenin tek tıkla tüm
          görevini bırakması ise kalktı (bkz. ogrenciler/page.tsx); yerini
          öğrenci başına, gerekçeli bu karar aldı.

          Koordinatörün metni AYRI: kendi görevini bırakan öğretmenle,
          başkasının danışmanlığını sonlandıran koordinatör aynı cümleyi
          okumamalı — ikincisi bir başkasının işine müdahaledir ve öyle
          yazılmalıdır.

          Katlı duruyor: bu, ekranın asıl işi değil ve düğmeyi açıkta tutmak
          yanlışlıkla tıklanmasını kolaylaştırırdı.
        */}
        {atama && (kendiDanismanligi || baskasininDanismanligimiSonlandirir) && (
          <details className="mt-5 border-t border-cizgi pt-4">
            <summary className="cursor-pointer text-sm font-medium text-metin-yumusak">
              {kendiDanismanligi
                ? "Bu öğrencinin danışmanlığını bırak"
                : "Bu öğrencinin danışmanlığını sonlandır"}
            </summary>
            <form action={danismanligiBirakEylemi} className="mt-3 space-y-3">
              <input type="hidden" name="ogrenciId" value={ogrenci.id} />
              <BilgiKutusu cesit="uyari">
                Gerekçe <strong>zorunludur</strong>:{" "}
                {kendiDanismanligi
                  ? "il koordinatörünüze bildirim olarak iletilir ve erişim kaydına yazılır"
                  : `${atama.danisman.ad} ${atama.danisman.soyad} öğretmenin danışmanlığı sonlanır; karar erişim kaydına yazılır`}
                . Öğrenci başka bir öğretmene DEVREDİLMEZ, danışmansız kalır:
                {ATAMAYI_YALNIZCA_YONETICI_YAPAR
                  ? " yeni danışmanını proje yöneticisi atar."
                  : " okulundaki danışman öğretmenlerden birini kendisi seçebilir ya da bir öğretmen onu danışmanlığına alabilir. Öğrenciye \"yeni danışmanını seç\" bildirimi gider."}
              </BilgiKutusu>
              <label className="block">
                <span className="text-sm font-medium text-metin">Gerekçe</span>
                <textarea
                  name="gerekce"
                  required
                  minLength={10}
                  maxLength={500}
                  rows={3}
                  placeholder="Öğrencinin ilgi alanı başka bir öğretmenin branşına daha yakın."
                  className={SINIF_GIRDI}
                />
              </label>
              <button type="submit" className={SINIF_IKINCIL_BUTON}>
                {kendiDanismanligi
                  ? "Danışmanlığı bırak"
                  : "Danışmanlığı sonlandır"}
              </button>
            </form>
          </details>
        )}

        {gorevRolleri.length > 0 && (
          <>
            <h3 className="mt-5 flex items-center gap-2 text-sm font-medium text-metin-yumusak">
              <BadgeCheck size={15} aria-hidden />
              Görevleri
            </h3>
            <ul className="mt-2 flex flex-wrap gap-2">
              {gorevRolleri.map((gorev) => (
                <li
                  key={gorev.rolKodu}
                  className="rounded-full bg-rol-ogrenci-zemin px-3 py-1 text-sm text-rol-ogrenci-metin"
                >
                  {gorevRolAdi(gorev)}
                </li>
              ))}
            </ul>
          </>
        )}
      </Kart>

      <Kart>
        <KartBasligi
          baslik="Çalışma grupları"
          aciklama={
            grupYonetimi
              ? "Öğrenciyi gruba ekleyebilir ya da gruptan çıkarabilirsiniz. Üst sınır yoktur."
              : "Öğrencinin seçtiği çalışma grupları."
          }
          Ikon={Layers}
        />

        {ogrenci.calismaGruplari.length === 0 ? (
          <p className="text-metin-yumusak">Henüz çalışma grubu seçilmemiş.</p>
        ) : (
          <ul className="divide-y divide-cizgi">
            {ogrenci.calismaGruplari.map((secim) => (
              <li
                key={secim.calismaGrubuId}
                className="flex flex-wrap items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
              >
                <div>
                  <p className="font-medium text-metin">
                    {secim.calismaGrubu.ad}
                    {!secim.calismaGrubu.aktif && (
                      <span className="ml-2 rounded-full bg-uyari-zemin px-2 py-0.5 text-xs text-uyari-metin">
                        Kapatılmış grup
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-sm text-metin-yumusak">
                    {tarihYaz(secim.secimTarihi)} ·{" "}
                    {secim.ekleyen
                      ? `${secim.ekleyen.ad} ${secim.ekleyen.soyad} ekledi`
                      : "öğrencinin kendi seçimi"}
                  </p>
                </div>
                {grupYonetimi && (
                  <form action={ogrenciyiGruptanCikarEylemi}>
                    <input type="hidden" name="ogrenciId" value={ogrenci.id} />
                    <input
                      type="hidden"
                      name="grupId"
                      value={secim.calismaGrubuId}
                    />
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 rounded-md border border-cizgi px-2.5 py-1.5 text-sm font-medium text-metin-yumusak transition hover:bg-zemin hover:text-hata-metin"
                    >
                      <X size={14} aria-hidden />
                      Çıkar
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}

        {grupYonetimi && eklenebilirGruplar.length > 0 && (
          <form
            action={ogrenciyeGrupEkleEylemi}
            className="mt-5 flex flex-wrap items-end gap-3 border-t border-cizgi pt-5"
          >
            <input type="hidden" name="ogrenciId" value={ogrenci.id} />
            <label className="block min-w-56 flex-1">
              <span className="text-sm font-medium text-metin">
                Çalışma grubuna ekle
              </span>
              <select
                name="grupId"
                required
                defaultValue=""
                className="mt-1 w-full rounded-md border border-cizgi bg-kart px-3 py-2 text-sm text-metin outline-none focus:border-vurgu"
              >
                <option value="" disabled>
                  Grup seçin
                </option>
                {eklenebilirGruplar.map((grup) => (
                  <option key={grup.id} value={grup.id}>
                    {grup.ad}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className={SINIF_BIRINCIL_BUTON}>
              <Plus size={15} aria-hidden />
              Ekle
            </button>
          </form>
        )}
      </Kart>

      <Kart>
        <KartBasligi
          baslik="Özgeçmiş (CV)"
          aciklama="Öğrencinin kendi yüklediği belge."
          Ikon={FileText}
        />
        {cvVar && cv ? (
          <div className="flex flex-wrap items-center gap-3">
            {/*
              Yeni sekmede açılır: rota pdf'i `inline` gönderiyor ve yetkili,
              öğrencinin kaydından düşmeden CV'ye bakabilmeli. `<Link>` değil
              `<a>` — hedef bir rota; ham `<a href>` basePath almadığı için
              `uygulamaYolu()` şart.
            */}
            <a
              href={uygulamaYolu(`/panel/ogrenciler/${ogrenci.id}/cv`)}
              target="_blank"
              rel="noopener noreferrer"
              className={SINIF_BIRINCIL_BUTON}
            >
              <FileText size={15} aria-hidden />
              CV&apos;yi aç
            </a>
            <p className="text-sm text-metin-yumusak">
              {cv.cvDosyaAdi}
              {cv.cvYuklenmeTarihi
                ? ` · ${tarihSaatYaz(cv.cvYuklenmeTarihi)}`
                : ""}
            </p>
          </div>
        ) : (
          <p className="text-metin-yumusak">
            Öğrenci henüz CV yüklemedi. Kabul edilen biçimler:{" "}
            {cvTipAdlari(cvSinirlari?.izinliTipler ?? [])}.
          </p>
        )}
      </Kart>

      <KatilimKarti kazanim={kazanim} />

      <UrunlerKarti
        kendiMi={kendiProfili}
        urunler={ogrenci.kazanimlar.filter(
          (kazanim) => kazanim.tip === "URUN",
        )}
      />

      <Kart>
        <KartBasligi
          baslik="Kazanımlar ve üretimler"
          aciklama="Öğrencinin kendi beyan ettiği kayıtlardır; sistem doğrulamaz."
          Ikon={Sparkles}
        />
        <KazanimBolumleri
          kazanimlar={ogrenci.kazanimlar}
          bosMesaji="Kayıt girilmemiş."
        />
      </Kart>

      <RozetOzeti kazanim={kazanim} />
    </div>
  );
}
