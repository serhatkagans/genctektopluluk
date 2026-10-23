import {
  BadgeCheck,
  Hourglass,
  MapPin,
  UserCheck,
  UserMinus,
  UserPlus,
  X,
} from "lucide-react";
import {
  BilgiKutusu,
  Kart,
  KartBasligi,
  SINIF_BIRINCIL_BUTON,
  SINIF_IKINCIL_BUTON,
} from "@/components/ui";
import type { KoordinatorBilgisi } from "@/lib/danisman/atama";
import type { DanismanAdayi } from "@/lib/danisman/karar";
import {
  ATAMAYI_YALNIZCA_YONETICI_YAPAR,
  YONETICI_ATAR_ACIKLAMASI,
} from "@/lib/danisman/politika";
import { tarihSaatYaz } from "@/lib/tarih";

/**
 * Danışman öğretmen durumu ve seçim listesi.
 *
 * İKİ YERDE BASILIR: Panelim sayfasının içindeki bölüm ve `/panel/danisman-
 * secim` ekranı. Sekme menüden kalktı ama SAYFA SİLİNEMEZ — orası aynı zamanda
 * giriş KAPISIDIR: danışmansız öğrenci girişte oraya düşer ve seçimini yapana
 * kadar "boşta" kalamaz (SKILL.md · Değişmezler 2). İkisi ayrı yazılsaydı
 * kapıdaki ekran ile paneldeki bölüm zamanla ayrışırdı.
 *
 * `kartlaSar=false` verildiğinde dış çerçeve basılmaz; Panelim'de bölüm zaten
 * kendi kartının içinde duruyor ve kart içinde kart iç içe çerçeve üretirdi.
 */
export interface DanismanSecimVerisi {
  atama: {
    danismanKullaniciId: number;
    danisman: {
      ad: string;
      soyad: string;
      brans: string | null;
      ogretmenProfil: { eposta: string | null; telefon: string | null } | null;
    };
  } | null;
  adaylar: DanismanAdayi[];
  koordinator: KoordinatorBilgisi | null;
  /**
   * Cevap bekleyen danışman DEĞİŞİKLİĞİ talebi (20 Ağustos 2026).
   *
   * `null` iken ekran eskisi gibi çalışır: seçim düğmeleri açıktır. Talep
   * varken düğmeler basılmaz — bkz. aşağıdaki not.
   */
  bekleyenTalep: {
    id: number;
    olusturmaTarihi: Date;
    istenenDanisman: { id: number; ad: string; soyad: string; brans: string | null };
  } | null;
  /** Reddedilmiş son talep; gerekçesi öğrenciye gösterilir. */
  sonRet: {
    retGerekcesi: string | null;
    kararTarihi: Date | null;
    istenenDanisman: { ad: string; soyad: string };
  } | null;
}

function iletisimSatiri(
  eposta: string | null | undefined,
  telefon: string | null | undefined,
): string[] {
  // Boş bırakılmış alan hiç basılmaz; "—" yazmak yanlış izlenim verirdi.
  return [eposta, telefon].filter((deger): deger is string =>
    Boolean(deger?.trim()),
  );
}

export function DanismanSecimi({
  veri,
  secEylemi,
  birakEylemi,
  talepGeriCekEylemi,
  donusYolu,
  kartlaSar = true,
}: {
  veri: DanismanSecimVerisi;
  secEylemi: (girdi: FormData) => Promise<void>;
  /** Danışmanlığı sonlandırma; seçim eylemiyle aynı iki yerden çağrılır. */
  birakEylemi: (girdi: FormData) => Promise<void>;
  /** Bekleyen talepten vazgeçme (20 Ağustos 2026). */
  talepGeriCekEylemi: (girdi: FormData) => Promise<void>;
  /** Seçimden sonra dönülecek adres; eylem tek, çağıran iki. */
  donusYolu: string;
  kartlaSar?: boolean;
}) {
  const { atama, adaylar, koordinator, bekleyenTalep, sonRet } = veri;
  const koordinatoreBagliMi =
    atama !== null && atama.danismanKullaniciId === koordinator?.kullaniciId;

  const danismanIletisimi = iletisimSatiri(
    atama?.danisman.ogretmenProfil?.eposta,
    atama?.danisman.ogretmenProfil?.telefon,
  );
  const koordinatorIletisimi = iletisimSatiri(
    koordinator?.eposta,
    koordinator?.telefon,
  );

  const Sarmalayici = kartlaSar ? Kart : Bos;

  /*
   * TEK KART, AÇIKLAMASIZ (20 Ağustos 2026 · istekler: "danışman öğretmenim
   * sayfasındaki açıklamaları silelim, mevcut durum da silinsin" · "iki kart
   * birleşsin oradaki").
   *
   * Ekran iki karttı: üstte "Mevcut durum", altında seçim listesi. İkisi tek
   * bir soruyu cevaplıyor — "danışmanım kim ve kimi seçebilirim" — ve arayı
   * bölen çerçeve, öğrenciyi aynı işin iki kutusu arasında gezdiriyordu.
   * Şimdi tek kart: üstte kim olduğu, ince bir ayraçtan sonra kimler
   * seçilebileceği.
   *
   * "Mevcut durum" BAŞLIĞI DA KALKTI: altındaki satır zaten danışmanın adını
   * ya da "Danışman atanmadı"yı yazıyor, başlık ona bir şey eklemiyordu.
   *
   * AÇIKLAMA CÜMLELERİ SİLİNDİ ("değiştirebilirsiniz, onay gerekmez",
   * "platforma giriş yapmış öğretmenler arasından seçebilirsiniz" ve
   * sonlandırma düğmesinin altındaki not). Hepsi ekranın kendi davranışını
   * anlatıyordu; ekran o davranışı zaten yapıyor.
   *
   * KALAN TEK KUTU BİR YÖNERGEDİR, açıklama değil: okulunda danışman öğretmen
   * bulunmayan öğrenciye "il koordinatörünüzle iletişime geçin" diyor
   * (F · 6 Ağustos 2026 · istek). Onu da silmek, o öğrenciyi ne yapacağını
   * bilmeden bırakırdı.
   */
  return (
    <Sarmalayici>
      <p className="flex flex-wrap items-center gap-2 text-lg text-metin">
        {atama ? (
          <>
            <UserCheck size={18} className="text-vurgu-metin" aria-hidden />
            {atama.danisman.ad} {atama.danisman.soyad}
            {atama.danisman.brans ? ` · ${atama.danisman.brans}` : ""}
            {koordinatoreBagliMi && (
              <span className="inline-flex items-center gap-1 rounded-full bg-rol-koordinator-zemin px-2.5 py-0.5 text-sm text-rol-koordinator-metin">
                <MapPin size={13} aria-hidden />
                İl koordinatörü
              </span>
            )}
          </>
        ) : (
          "Danışman atanmadı."
        )}
      </p>
      {atama && danismanIletisimi.length > 0 && (
        <p className="mt-1 text-sm text-metin-yumusak">
          {danismanIletisimi.join(" · ")}
        </p>
      )}

      {/*
        BEKLEYEN TALEP (20 Ağustos 2026 · istek: "danışman öğretmen seçiminde
        öğretmene veya il koordinatörüne onay düşsün sürekli değişmek
        isteyebilirler").

        Kutu "mevcut durum" satırının HEMEN ALTINDA: iki satır birlikte
        okunmalı — "danışmanın şu, ama şunun için istek gönderdin". Ayrı bir
        kartta dursaydı öğrenci üstteki adı görüp isteğinin geçtiğini sanardı.

        Cümle atamanın DEĞİŞMEDİĞİNİ açıkça söylüyor: onay bekleyen bir istek,
        öğrenciyi danışmansız bırakmaz.
      */}
      {bekleyenTalep && (
        <div className="mt-4 rounded-kart border border-uyari-cizgi bg-uyari-zemin p-4">
          <p className="flex flex-wrap items-center gap-2 font-medium text-uyari-metin">
            <Hourglass size={16} aria-hidden />
            {bekleyenTalep.istenenDanisman.ad}{" "}
            {bekleyenTalep.istenenDanisman.soyad} için talebiniz onay bekliyor
          </p>
          <p className="mt-1.5 text-sm text-uyari-metin">
            {tarihSaatYaz(bekleyenTalep.olusturmaTarihi)} tarihinde gönderildi.
            Talebi seçtiğiniz öğretmen ya da il koordinatörünüz karara bağlar;
            o zamana kadar danışmanınız değişmez.
          </p>
          <form action={talepGeriCekEylemi} className="mt-3">
            <input type="hidden" name="donusYolu" value={donusYolu} />
            <input type="hidden" name="talepId" value={bekleyenTalep.id} />
            <button type="submit" className={SINIF_IKINCIL_BUTON}>
              <X size={15} aria-hidden />
              Talebimi geri çek
            </button>
          </form>
        </div>
      )}

      {/*
        SON RET GEREKÇESİ. Bildirim listesi zaten okundu işaretlenip düşüyor;
        gerekçenin kalıcı olarak durduğu tek yer burası. Öğrenci reddedilen
        isteğini neden tekrarlamaması gerektiğini burada okuyor.

        Bekleyen talep VARKEN basılmaz: o an geçerli olan yeni istektir, eski
        ret ikinci bir uyarı gibi görünürdü.
      */}
      {!bekleyenTalep && sonRet && (
        <div className="mt-4 rounded-kart border border-cizgi bg-zemin p-4">
          <p className="text-sm font-medium text-metin">
            {sonRet.istenenDanisman.ad} {sonRet.istenenDanisman.soyad} için son
            talebiniz reddedildi
            {sonRet.kararTarihi
              ? ` · ${tarihSaatYaz(sonRet.kararTarihi)}`
              : ""}
          </p>
          {sonRet.retGerekcesi && (
            <p className="mt-1 text-sm text-metin-yumusak">
              Gerekçe: {sonRet.retGerekcesi}
            </p>
          )}
        </div>
      )}

      {/*
        DANIŞMANLIĞI SONLANDIRMA (11 Ağustos 2026 · istek: "öğrenci danışman
        öğretmeni bırakacak butonu yok bırakabilsin").

        Öğretmen tarafındaki bırakmanın aynası: bağ kapanır, öğrenci
        danışmansız kalır ve yeni danışmanını istediği zaman seçer. Gerekçe
        sorulmaz (bkz. lib/danisman/atama.ts · ogrenciDanismaniniBirakti).

        İL KOORDİNATÖRÜNE BAĞLIYKEN BASILMAZ. O bağ seçilmiş bir danışmanlık
        değil, okulunda danışman öğretmen bulunmayan öğrenciyi boşta
        bırakmamak için kurulan bir yedektir; sonlandırmak öğrenciye bir şey
        kazandırmaz, seçebileceği kimse de yoktur.

        Düğme İKİNCİL ve listenin ÜSTÜNDE: asıl iş danışman seçmek, bu onun
        yanındaki çıkış yolu. Aday listesinin altına konsaydı "Danışmanım
        olsun" düğmelerinin devamı gibi okunurdu.
      */}
      {atama && !koordinatoreBagliMi && (
        <form action={birakEylemi} className="mt-4">
          <input type="hidden" name="donusYolu" value={donusYolu} />
          <button type="submit" className={SINIF_IKINCIL_BUTON}>
            <UserMinus size={15} aria-hidden />
            Danışmanlığı sonlandır
          </button>
        </form>
      )}

      {/*
        AYRAÇ, YENİ KART DEĞİL: iki bölüm hâlâ ayrı okunuyor ama tek çerçevenin
        içinde.
      */}
      {/*
        ATAMAYI YÖNETİCİ YAPAR (23 Ekim 2026 · istek: "atamayı yönetici
        yapsın"). Seçim listesi basılmaz; öğrenci yalnızca durumunu görür ve
        danışman öğretmeninin bilgisini Panelim'deki beyan bölümüne yazar.
      */}
      {ATAMAYI_YALNIZCA_YONETICI_YAPAR ? (
        <div className="mt-6 border-t border-cizgi pt-6">
          <BilgiKutusu>
            {YONETICI_ATAR_ACIKLAMASI} Danışman öğretmeninizin bilgilerini
            Panelim&apos;deki &quot;Danışman öğretmen bilgileri&quot; bölümüne
            yazabilirsiniz.
          </BilgiKutusu>
        </div>
      ) : (
      <div className="mt-6 border-t border-cizgi pt-6">
        {adaylar.length === 0 ? (
          /*
            Okulda danışman yok. Koordinatör listede — seçilebilir değil, çünkü
            seçilecek bir alternatif yok; atama zaten otomatik yapılmış durumda.
          */
          <>
            <KartBasligi baslik="İl koordinatörünüz" Ikon={MapPin} />

            <BilgiKutusu className="mb-4">
              Danışman öğretmeni olmayan öğrencilerin il koordinatörü ile
              iletişime geçmesi gerekmektedir.
            </BilgiKutusu>
            {koordinator ? (
              <div className="rounded-kart border border-cizgi px-4 py-3">
                <span className="block font-medium text-metin">
                  {koordinator.ad} {koordinator.soyad}
                </span>
                <span className="block text-sm text-metin-yumusak">
                  {koordinator.brans ?? "İl koordinatörü"}
                </span>
                {koordinatorIletisimi.length > 0 && (
                  <span className="mt-1 block text-sm text-metin-yumusak">
                    {koordinatorIletisimi.join(" · ")}
                  </span>
                )}
              </div>
            ) : (
              <p className="text-metin-yumusak">
                İlinize henüz il koordinatörü atanmadı. Atama yapıldığında
                danışmanınız olarak buraya yazılacak.
              </p>
            )}
          </>
        ) : (
          <>
            {/*
              LİSTENİN NEDEN KISA OLABİLECEĞİNİ SÖYLEYEN TEK CÜMLE
              (20 Ağustos 2026 · istek: "bu yazı yerine danışman öğretmeninizi
              göremiyorsanız sistemden giriş yapması gerekir yazısı gelsin").

              Önceki metin aynı şeyi iki cümlede ve sistemin diliyle
              anlatıyordu ("platforma giriş yapmış öğretmenler",
              "danışman öğretmenliği görevini işaretlemiş"). Yenisi öğrencinin
              sorduğu soruyla başlıyor: öğretmenim listede yok, ne yapmalıyım.
            */}
            <KartBasligi
              baslik="Danışman öğretmen seçimi"
              aciklama={
                /*
                  METİN DURUMA GÖRE DEĞİŞİR (20 Ağustos 2026): danışmanı olan
                  öğrencinin seçimi bir TALEPTİR, ilk seçim ise doğrudan atama.
                  Tek cümle basılsaydı biri için yanlış olurdu.
                */
                atama
                  ? "Danışman değişikliği onaya tabidir: seçtiğiniz öğretmen ya da il koordinatörünüz onaylayana kadar mevcut danışmanınız devam eder. Danışman öğretmeninizi göremiyorsanız sisteme giriş yapması gerekir."
                  : "Danışman öğretmeninizi göremiyorsanız sisteme giriş yapması gerekir."
              }
              Ikon={UserPlus}
            />
            <ul className="space-y-2">
              {adaylar.map((aday) => {
                const seciliMi = atama?.danismanKullaniciId === aday.kullaniciId;
                return (
                  <li key={aday.kullaniciId}>
                    <form action={secEylemi}>
                      <input
                        type="hidden"
                        name="danismanId"
                        value={aday.kullaniciId}
                      />
                      <input type="hidden" name="donusYolu" value={donusYolu} />
                      <div
                        className={`flex flex-wrap items-center justify-between gap-3 rounded-kart border px-4 py-3 ${
                          seciliMi
                            ? "border-olumlu-cizgi bg-olumlu-zemin"
                            : "border-cizgi"
                        }`}
                      >
                        <span>
                          <span className="block font-medium text-metin">
                            {aday.ad} {aday.soyad}
                          </span>
                          <span className="block text-sm text-metin-yumusak">
                            {aday.brans ?? "—"}
                          </span>
                        </span>
                        {seciliMi ? (
                          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-olumlu-metin">
                            <BadgeCheck size={16} aria-hidden />
                            Danışmanınız
                          </span>
                        ) : bekleyenTalep ? (
                          /*
                            BEKLEYEN TALEP VARKEN SEÇİM KAPALI. Kural katmanı da
                            reddediyor (öğrenci başına tek bekleyen talep) ama
                            düğmeyi açık bırakmak, öğrenciyi her tıklamada
                            hata mesajına götürürdü. Bekleyen istek geri
                            çekilebiliyor; çıkış yolu yukarıdaki kutuda.
                          */
                          <span className="text-sm text-metin-yumusak">
                            Talebiniz sonuçlanana kadar seçim yapılamaz
                          </span>
                        ) : atama ? (
                          <button type="submit" className={SINIF_BIRINCIL_BUTON}>
                            Talep gönder
                          </button>
                        ) : (
                          <button type="submit" className={SINIF_BIRINCIL_BUTON}>
                            Danışmanım olsun
                          </button>
                        )}
                      </div>
                    </form>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
      )}
    </Sarmalayici>
  );
}

/** Çerçevesiz sarmalayıcı — Panelim'de bölüm zaten bir kartın içinde. */
function Bos({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}
