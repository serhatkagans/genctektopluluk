import { Building2, Check, GraduationCap, Mail, Phone, X } from "lucide-react";
import Link from "next/link";
import {
  BilgiKutusu,
  Kart,
  KartBasligi,
  SayfaBasligi,
  SINIF_BIRINCIL_BUTON,
  SINIF_GIRDI,
} from "@/components/ui";
import { DisaAktarmaBagi } from "@/components/DisaAktarmaBagi";
import { oturumKullanicisiZorunlu } from "@/lib/auth/oturum";
import {
  type BasvuruSatiri,
  basvurulariListele,
} from "@/lib/dis-kimlik/basvuru";
import {
  basvuruKonumu,
  GUNCEL_DURUM_ETIKETLERI,
  TUR_ETIKETLERI,
} from "@/lib/dis-kimlik/kurallar";
import { tarihSaatYaz } from "@/lib/tarih";
import { disBasvuruYonetebilirMi } from "@/lib/yetki/izinler";
import { basvuruOnaylaEylemi, basvuruReddetEylemi } from "./eylemler";

/**
 * EBA dışı giriş başvuruları — proje yöneticisinin onay kuyruğu.
 *
 * EKRAN İKİ LİSTEDİR: bekleyenler (karar verilecekler) ve karara bağlananlar
 * (geçmiş). Geçmiş SİLİNMEZ ve gizlenmez: "bu kişi neden alınmadı" sorusunun
 * cevabı, aynı kişi tekrar başvurduğunda gerekiyor.
 */

export const dynamic = "force-dynamic";

function TurRozeti({ tur }: { tur: BasvuruSatiri["tur"] }) {
  const Ikon = tur === "MEZUN" ? GraduationCap : Building2;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-vurgu-zemin px-2.5 py-0.5 text-xs font-medium text-vurgu-metin">
      <Ikon size={13} aria-hidden />
      {TUR_ETIKETLERI[tur]}
    </span>
  );
}

function BasvuruGovdesi({ basvuru }: { basvuru: BasvuruSatiri }) {
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex flex-wrap items-center gap-2 font-semibold text-baslik">
            {basvuru.ad} {basvuru.soyad}
            <TurRozeti tur={basvuru.tur} />
          </p>
          <p className="mt-1 text-sm text-metin-yumusak">
            {basvuruKonumu(basvuru)} · {tarihSaatYaz(basvuru.olusturmaTarihi)} tarihinde
            başvurdu
          </p>
        </div>
        <div className="text-sm text-metin-yumusak">
          <p className="flex items-center gap-1.5">
            <Mail size={14} aria-hidden />
            {basvuru.eposta}
          </p>
          {basvuru.telefon && (
            <p className="mt-1 flex items-center gap-1.5">
              <Phone size={14} aria-hidden />
              {basvuru.telefon}
            </p>
          )}
        </div>
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        {basvuru.tur === "MEZUN" && (
          <>
            <div>
              <dt className="text-metin-yumusak">Mezun olduğu okul</dt>
              <dd className="text-metin">
                {basvuru.mezunKurum?.ad ??
                  basvuru.mezunOkulAdi ??
                  "Belirtilmedi"}
              </dd>
            </div>
            <div>
              <dt className="text-metin-yumusak">Mezuniyet yılı</dt>
              <dd className="text-metin">{basvuru.mezuniyetYili ?? "—"}</dd>
            </div>
          </>
        )}
        {/* Bugünkü durum (12 Kasım 2026): mezun ve mentörde. */}
        {basvuru.tur !== "PAYDAS" ? (
          <>
            <div>
              <dt className="text-metin-yumusak">Şu anki durumu</dt>
              <dd className="text-metin">
                {basvuru.guncelDurum
                  ? GUNCEL_DURUM_ETIKETLERI[basvuru.guncelDurum]
                  : "Belirtilmedi"}
              </dd>
            </div>
            <div>
              <dt className="text-metin-yumusak">
                {basvuru.guncelDurum === "UNIVERSITE"
                  ? "Üniversite / bölüm"
                  : "Kurum / pozisyon"}
              </dt>
              <dd className="text-metin">
                {(basvuru.guncelDurum === "UNIVERSITE"
                  ? [basvuru.universite, basvuru.bolum]
                  : [basvuru.calistigiKurum, basvuru.pozisyon]
                )
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </dd>
            </div>
            {basvuru.mentorlukIstiyor && (
              <div className="sm:col-span-2">
                <dt className="text-metin-yumusak">Mentörlük konuları</dt>
                <dd className="text-metin">
                  {basvuru.mentorlukKonulari ?? "Yalnızca çalışma grupları seçildi"}
                </dd>
              </div>
            )}
          </>
        ) : (
          <>
            <div>
              <dt className="text-metin-yumusak">Temsil ettiği kurum</dt>
              <dd className="text-metin">{basvuru.paydas?.ad ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-metin-yumusak">Görev / unvan</dt>
              <dd className="text-metin">{basvuru.gorevUnvani ?? "—"}</dd>
            </div>
          </>
        )}
      </dl>

      <div className="mt-4">
        <p className="text-sm text-metin-yumusak">Başvuru gerekçesi</p>
        <p className="mt-1 text-sm whitespace-pre-wrap text-metin">
          {basvuru.beyan}
        </p>
      </div>

      <p className="mt-4 text-xs text-metin-yumusak">
        Aydınlatma metni onayı: {tarihSaatYaz(basvuru.aydinlatmaOnayTarihi)}
      </p>
    </>
  );
}

export default async function DisBasvurularSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ hata?: string; bilgi?: string }>;
}) {
  const kullanici = await oturumKullanicisiZorunlu();

  /*
   * YETKİSİZLİK KART OLARAK BASILIYOR, HATA FIRLATILMIYOR.
   *
   * Önceden `throw new YetkiHatasi(...)` vardı ve sayfa hata sınırına düşüp
   * "Beklenmeyen bir hata oluştu" (500) gösteriyordu: kullanıcıya yanlış bilgi
   * veriyordu — ortada beklenmeyen bir şey yok, ekran ona kapalı. Panelde bu
   * ekran, deseni bozan TEK sayfaydı; diğer korumalı ekranların hepsi
   * (paydaşlar, erişim kayıtları, rol envanteri, duyurular, raporlar…) nazik
   * bir kart basıyor.
   *
   * Sızıntı riski yok: ekranın VARLIĞI zaten menüde herkese görünmüyor ve
   * burada hiçbir başvuru verisi okunmadan dönülüyor. Kaydın varlığını
   * gizlemek gereken yerlerde kullanılan araç ayrıdır (BulunamadiHatasi →
   * 404, bkz. permissions.md · Bölüm 4).
   *
   * `YetkiHatasi` sunucu EYLEMLERİNDE kullanılmaya devam ediyor; orada hata
   * fırlatmak doğru davranış (bkz. dis-basvurular/eylemler.ts).
   */
  if (!disBasvuruYonetebilirMi(kullanici)) {
    return (
      <Kart>
        <KartBasligi
          baslik="Dış giriş başvuruları"
          aciklama="Bu ekran yalnızca proje yöneticisine açıktır."
        />
      </Kart>
    );
  }

  const { hata, bilgi } = await searchParams;
  const [bekleyenler, tumu] = await Promise.all([
    basvurulariListele("BEKLIYOR"),
    basvurulariListele("TUMU"),
  ]);
  const kararaBaglananlar = tumu.filter(
    (basvuru) => basvuru.durum !== "BEKLIYOR",
  );

  return (
    <div className="space-y-8">
      <SayfaBasligi
        baslik="Dış Giriş Başvuruları"
        aciklama="EBA hesabı olmayan mezun ve paydaş temsilcilerinin sisteme giriş başvuruları. Onaylanana kadar kullanıcı hesabı açılmaz."
      />

      {hata && <BilgiKutusu cesit="hata">{hata}</BilgiKutusu>}
      {bilgi && <BilgiKutusu cesit="olumlu">{bilgi}</BilgiKutusu>}

      {tumu.length > 0 && (
        /*
         * Dosya BEKLEYENLER VE KARARA BAĞLANANLARIN TAMAMINI taşır: ekran ikisini
         * ayrı bölümlerde gösteriyor ama "kimler başvurdu, kaçı kabul edildi"
         * sorusu tek tabloda cevaplanır.
         */
        <p>
          <DisaAktarmaBagi
            yol="/panel/dis-basvurular/disa-aktar"
            kayitSayisi={tumu.length}
          />
        </p>
      )}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-baslik">
          Onay bekleyenler{" "}
          <span className="rounded-full bg-vurgu-zemin px-2 py-0.5 text-xs font-medium text-vurgu-metin">
            {bekleyenler.length}
          </span>
        </h2>

        {bekleyenler.length === 0 ? (
          <BilgiKutusu>Onay bekleyen başvuru yok.</BilgiKutusu>
        ) : (
          bekleyenler.map((basvuru) => (
            <Kart key={basvuru.id}>
              <BasvuruGovdesi basvuru={basvuru} />

              <div className="mt-6 flex flex-wrap items-end gap-3 border-t border-cizgi pt-5">
                <form action={basvuruOnaylaEylemi}>
                  <input type="hidden" name="basvuruId" value={basvuru.id} />
                  <button type="submit" className={SINIF_BIRINCIL_BUTON}>
                    <Check size={16} aria-hidden />
                    Onayla
                  </button>
                </form>

                {/*
                  Ret gerekçesi ZORUNLU ve forma gömülü: ayrı bir ekrana
                  taşınsaydı gerekçe yazmak fazladan bir adım olur, pratikte
                  "gerekçe: -" yazılırdı.
                */}
                <form
                  action={basvuruReddetEylemi}
                  className="flex flex-1 flex-wrap items-end gap-3"
                >
                  <input type="hidden" name="basvuruId" value={basvuru.id} />
                  <label className="block min-w-60 flex-1">
                    <span className="text-sm font-medium text-metin-yumusak">
                      Ret gerekçesi
                    </span>
                    <input
                      name="gerekce"
                      required
                      minLength={10}
                      placeholder="Kişi tekrar başvurabilir; neyi düzelteceğini yazın."
                      className={SINIF_GIRDI}
                    />
                  </label>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 rounded-md border border-hata-cizgi px-4 py-2 text-sm font-medium text-hata-metin transition hover:bg-hata-zemin"
                  >
                    <X size={16} aria-hidden />
                    Reddet
                  </button>
                </form>
              </div>
            </Kart>
          ))
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-baslik">
          Karara bağlananlar
        </h2>

        {kararaBaglananlar.length === 0 ? (
          <BilgiKutusu>Henüz karara bağlanmış başvuru yok.</BilgiKutusu>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-160 text-sm">
              <thead>
                <tr className="border-b border-cizgi text-left text-metin-yumusak">
                  <th className="py-2 pr-4 font-medium">Kişi</th>
                  <th className="py-2 pr-4 font-medium">Tür</th>
                  <th className="py-2 pr-4 font-medium">Sonuç</th>
                  <th className="py-2 pr-4 font-medium">Karar</th>
                  <th className="py-2 font-medium">Gerekçe</th>
                </tr>
              </thead>
              <tbody>
                {kararaBaglananlar.map((basvuru) => (
                  <tr key={basvuru.id} className="border-b border-cizgi">
                    <td className="py-2 pr-4">
                      {/*
                        AD TIKLANABİLİR (11 Ağustos 2026 · istek: "dış girişten
                        gelen mentör paydaş vs tıklanabilir olsun, onların
                        profiline gitsin").

                        Yalnızca ONAYLANANLARDA: kullanıcı kaydı onayla birlikte
                        doğuyor (bkz. lib/dis-kimlik/basvuru.ts), reddedilen
                        başvurunun arkasında gidilecek bir profil yok. Koşul
                        `olusanKullanici` üzerinden kuruluyor, duruma bakarak
                        değil — kaydın kendisi tek doğruluk kaynağı.
                      */}
                      {basvuru.olusanKullanici ? (
                        <Link
                          href={`/panel/dis-kullanicilar/${basvuru.olusanKullanici.id}`}
                          className="font-medium text-vurgu-metin underline underline-offset-2"
                        >
                          {basvuru.ad} {basvuru.soyad}
                        </Link>
                      ) : (
                        <span className="font-medium text-metin">
                          {basvuru.ad} {basvuru.soyad}
                        </span>
                      )}
                      <span className="block text-xs text-metin-yumusak">
                        {basvuru.eposta} · {basvuruKonumu(basvuru)}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-metin-yumusak">
                      {TUR_ETIKETLERI[basvuru.tur]}
                    </td>
                    <td className="py-2 pr-4">
                      {basvuru.durum === "ONAYLANDI" ? (
                        <span className="font-medium text-olumlu-metin">
                          Onaylandı
                        </span>
                      ) : (
                        <span className="font-medium text-hata-metin">
                          Reddedildi
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-metin-yumusak">
                      {basvuru.kararVeren
                        ? `${basvuru.kararVeren.ad} ${basvuru.kararVeren.soyad}`
                        : "—"}
                      <span className="block text-xs">
                        {basvuru.kararTarihi
                          ? tarihSaatYaz(basvuru.kararTarihi)
                          : "—"}
                      </span>
                    </td>
                    <td className="py-2 text-metin-yumusak">
                      {basvuru.retGerekcesi ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <BilgiKutusu>
        Onaylanan kişi, başvurusunda belirlediği e-posta ve şifreyle{" "}
        <Link href="/dis-giris" className="font-medium text-vurgu-metin">
          mezun ve paydaş girişinden
        </Link>{" "}
        sisteme girer. İlk girişinde KVKK belgelerini onaylamadan panele
        geçemez.
      </BilgiKutusu>
    </div>
  );
}
