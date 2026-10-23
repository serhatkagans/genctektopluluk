import { ArrowLeft, MessageSquare, Send, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { RolEtiketi } from "@/components/RolEtiketi";
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
import { prisma } from "@/lib/db";
import {
  buEkibiYonetebilirMi,
  EKIP_SOHBET_UYARISI,
  EKIPLER_KAPALI_ACIKLAMASI,
  ekiplerKapaliMi,
  ekipSohbetiOkuyabilirMi,
  ekipSohbetineYazabilirMi,
} from "@/lib/ekip/kurallar";
import { DisaAktarmaBagi } from "@/components/DisaAktarmaBagi";
import {
  ADAY_KISI_TURU_ETIKETLERI,
  ADAY_ROL_ETIKETLERI,
  ADAY_ROLLERI,
  type AdayKisiTuru,
  adayKosulu,
  adaySuzgeciDoluMu,
  adaySuzgeciniCoz,
} from "@/lib/ekip/aday-suzgeci";
import { okulTuruSecenekleri } from "@/lib/okul/turler";
import { tarihSaatYaz } from "@/lib/tarih";
import { dogrudanYazismaAcEylemi } from "../../yazismalar/baglanti-eylemleri";
import {
  ekibeUyeEkleEylemi,
  ekibiKapatEylemi,
  ekipMesajiGonderEylemi,
  ekiptenUyeCikarEylemi,
} from "../eylemler";

export const dynamic = "force-dynamic";

/**
 * EKİP SAYFASI — üyeler ve sohbet (13 Ağustos 2026).
 *
 * TEK EKRAN: üye listesi ve sohbet aynı sayfada. Ayrılsalardı koordinatör
 * "kim var" sorusunu cevaplamak için sohbetten çıkmak zorunda kalırdı; ekip
 * küçük bir topluluk ve iki liste yan yana sığıyor.
 *
 * GÖRME KAPISI: üyeler + ekibin ilinin koordinatörü + proje yöneticisi
 * (bkz. lib/ekip/kurallar.ts). Yetkisi olmayan 404 görür, 403 değil — ekibin
 * varlığı sızmasın (references/permissions.md · Bölüm 4).
 */

const DURUM_MESAJLARI: Record<string, string> = {
  "ekip-kuruldu":
    "Ekip kuruldu. Şimdi üyelerini ekleyin; eklediğiniz herkese bildirim gider.",
  "uye-eklendi": "Üye eklendi ve kendisine bildirim gitti.",
  "uye-cikarildi":
    "Üye ekipten çıkarıldı. Yazdığı mesajlar sohbette kalmaya devam eder.",
};

export default async function EkipSayfasi({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  /*
   * SÜZGEÇ PARAMETRELERİ (26 Ağustos 2026): üye ekleme artık ad aramasından
   * ibaret değil; kişi türü, okul türü, çalışma grubu ve rol de adres
   * çubuğunda taşınıyor (bkz. lib/ekip/aday-suzgeci.ts).
   */
  searchParams: Promise<{
    durum?: string;
    hata?: string;
    ara?: string;
    kisiTuru?: string;
    okulTuru?: string;
    grup?: string;
    rol?: string;
  }>;
}) {
  const kullanici = await oturumKullanicisiZorunlu();
  // Ekipler il koordinatörüne kapalı (23 Ekim 2026 · bkz. ekiplerKapaliMi).
  if (ekiplerKapaliMi(kullanici)) {
    redirect(`/panel?hata=${encodeURIComponent(EKIPLER_KAPALI_ACIKLAMASI)}`);
  }
  const { id } = await params;
  const parametreler = await searchParams;
  const { durum, hata } = parametreler;

  const ekipId = Number.parseInt(id, 10);
  if (!Number.isFinite(ekipId)) notFound();

  const ekip = await prisma.ekip.findUnique({
    where: { id: ekipId },
    select: {
      id: true,
      ad: true,
      aciklama: true,
      ilKodu: true,
      aktif: true,
      olusturmaTarihi: true,
      il: { select: { ad: true } },
      kuran: { select: { ad: true, soyad: true } },
      uyeler: {
        orderBy: { eklenmeTarihi: "asc" },
        select: {
          kullaniciId: true,
          eklenmeTarihi: true,
          kullanici: {
            select: {
              id: true,
              ad: true,
              soyad: true,
              sinif: true,
              brans: true,
              kurum: { select: { ad: true } },
              roller: {
                where: { bitisTarihi: null },
                select: { rolKodu: true },
              },
            },
          },
        },
      },
      /*
        Mesajlar ESKİDEN YENİYE: sohbet yukarıdan aşağı okunur ve yazma kutusu
        en altta. Ters sıralansaydı yeni gelen mesaj kutunun uzağına düşerdi.

        Gizlenmiş mesaj basılmaz; kaydı duruyor (bkz. migration notu).
      */
      mesajlar: {
        where: { gizlendiMi: false },
        orderBy: { olusturmaTarihi: "asc" },
        take: 200,
        select: {
          id: true,
          icerik: true,
          olusturmaTarihi: true,
          yazan: { select: { id: true, ad: true, soyad: true } },
        },
      },
    },
  });
  if (!ekip) notFound();

  const uyeIdleri = ekip.uyeler.map((uye) => uye.kullaniciId);
  const kapsam = { ilKodu: ekip.ilKodu, uyeKullaniciIdleri: uyeIdleri };

  if (!ekipSohbetiOkuyabilirMi(kullanici, kapsam)) notFound();

  const yonetebilir = buEkibiYonetebilirMi(kullanici, ekip.ilKodu);
  const yazabilir = ekipSohbetineYazabilirMi(kullanici, {
    ...kapsam,
    aktif: ekip.aktif,
  });

  /*
   * ÜYE ADAYLARI: ekibin ilindeki aktif kullanıcılar, hâlihazırda üye olanlar
   * hariç. Liste ARAMAYLA daraltılıyor — bir ilde binlerce kişi olabilir ve
   * hepsini seçim listesine basmak ekranı da sorguyu da boğardı.
   *
   * Arama yapılmadan aday BASILMAZ: rastgele elli kişilik bir liste,
   * koordinatörün aradığı kişiyi bulmasına yardım etmez.
   */
  const suzgec = adaySuzgeciniCoz(parametreler);
  const suzgecDolu = adaySuzgeciDoluMu(suzgec);

  /*
   * SÜZGEÇ SEÇENEKLERİ: okul türleri standart listeyle birleştiriliyor (bkz.
   * lib/okul/turler.ts) ve çalışma grupları veritabanından geliyor. İkisi de
   * yalnızca formu basacaksak sorgulanıyor — üye olmayan bir kullanıcı bu
   * ekranı açtığında iki gereksiz sorgu ödenmesin.
   */
  const formBasilacak = yonetebilir && ekip.aktif;
  const [ilinOkulTurleri, calismaGruplari] = formBasilacak
    ? await Promise.all([
        prisma.kurum.findMany({
          where: { aktif: true, ilKodu: ekip.ilKodu },
          distinct: ["okulTuru"],
          orderBy: { okulTuru: "asc" },
          select: { okulTuru: true },
        }),
        prisma.calismaGrubu.findMany({
          where: { aktif: true },
          orderBy: { siraNo: "asc" },
          select: { id: true, ad: true },
        }),
      ])
    : [[], []];

  /*
   * SÜZGEÇSİZ ADAY BASILMAZ: ilin tamamı yüzlerce kişi ve rastgele bir liste,
   * koordinatörün aradığı kişiyi bulmasına yardım etmiyor. Eskiden koşul "en az
   * iki harf" idi; artık süzgeçlerden HERHANGİ BİRİ yeterli — "meslek
   * liselerindeki okul temsilcileri" sorusunda yazılacak bir ad yok.
   *
   * SINIR 50: eski hâlinde 20'ydi ve ad aramasında yetiyordu. Süzgeçler
   * "ilimdeki tüm mentörler" gibi doğal olarak daha uzun listeler üretiyor;
   * yine de sınırsız değil — sayfalama yerine sınır seçildi çünkü ekran bir
   * envanter değil, bir seçim kutusu.
   */
  const adaylar = formBasilacak && suzgecDolu
    ? await prisma.kullanici.findMany({
        where: adayKosulu(suzgec, {
          ilKodu: ekip.ilKodu,
          haricIdler: uyeIdleri,
        }),
        orderBy: [{ ad: "asc" }, { soyad: "asc" }],
        take: 50,
        select: {
          id: true,
          ad: true,
          soyad: true,
          sinif: true,
          brans: true,
          kurum: { select: { ad: true } },
          roller: { where: { bitisTarihi: null }, select: { rolKodu: true } },
        },
      })
    : [];

  return (
    <div className="space-y-6">
      <Link
        href="/panel/ekipler"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-vurgu-metin hover:underline"
      >
        <ArrowLeft size={15} aria-hidden />
        Ekiplerim
      </Link>

      <SayfaBasligi
        baslik={ekip.ad}
        aciklama={`${ekip.il.ad} · ${ekip.uyeler.length} üye · ${ekip.kuran.ad} ${ekip.kuran.soyad} kurdu`}
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
      {!ekip.aktif && (
        <BilgiKutusu cesit="uyari">
          Bu ekip kapatıldı. Sohbet okunabilir ama yeni mesaj yazılamaz.
        </BilgiKutusu>
      )}
      {ekip.aciklama && <p className="text-metin">{ekip.aciklama}</p>}

      {/*
        SOHBET UYARI ŞERİDİ KALKTI (26 Ağustos 2026 · istek: "bunu sil: Ekip
        sohbeti gizli değildir…").

        KURAL DEĞİŞMEDİ: sohbet hâlâ ekibi kuran koordinatöre ve merkeze açık
        (bkz. lib/ekip/kurallar.ts · ekipSohbetiOkuyabilirMi) ve bu, ekip
        kanalının danışman onayından geçmeden açılabilmesinin koşulu. Kalkan
        yalnızca her sayfa açılışında okunan şerit; metin sabiti
        (`EKIP_SOHBET_UYARISI`) yerinde duruyor ve yeniden basılabilir.
      */}

      <Kart>
        <KartBasligi
          baslik="Ekip sohbeti"
          aciklama={`${ekip.mesajlar.length} mesaj`}
          Ikon={MessageSquare}
        />
        {ekip.mesajlar.length === 0 ? (
          <p className="text-metin-yumusak">
            Henüz mesaj yok. İlk mesajı siz yazabilirsiniz.
          </p>
        ) : (
          <ul className="space-y-3">
            {ekip.mesajlar.map((mesaj) => (
              <li
                key={mesaj.id}
                id={`mesaj-${mesaj.id}`}
                className={`scroll-mt-24 rounded-kart px-3 py-2 ${
                  mesaj.yazan.id === kullanici.id
                    ? "bg-vurgu-zemin"
                    : "bg-zemin"
                }`}
              >
                <p className="text-sm font-medium text-metin">
                  {mesaj.yazan.ad} {mesaj.yazan.soyad}
                  <span className="ml-2 font-normal text-metin-yumusak">
                    {tarihSaatYaz(mesaj.olusturmaTarihi)}
                  </span>
                </p>
                <p className="mt-1 whitespace-pre-line text-metin">
                  {mesaj.icerik}
                </p>
              </li>
            ))}
          </ul>
        )}

        {yazabilir && (
          <form
            action={ekipMesajiGonderEylemi}
            className="mt-4 space-y-2 border-t border-cizgi pt-4"
          >
            <input type="hidden" name="ekipId" value={ekip.id} />
            <label className="block">
              <span className="sr-only">Mesajınız</span>
              <textarea
                name="icerik"
                required
                rows={3}
                maxLength={2000}
                placeholder="Ekibe yazın…"
                className={SINIF_GIRDI}
              />
            </label>
            <button type="submit" className={SINIF_BIRINCIL_BUTON}>
              <MessageSquare size={16} aria-hidden />
              Gönder
            </button>
          </form>
        )}
      </Kart>

      <Kart>
        <KartBasligi
          baslik="Üyeler"
          aciklama={`${ekip.uyeler.length} kişi`}
          Ikon={Users}
        />
        {/*
          ÜYE LİSTESİ HEM TOPLU HEM BİREYSEL KANALIN KAPISI (31 Ağustos 2026 ·
          istek: "Ekibindeki herkesi görsün tıklanınca ve bireysel ve toplu
          mesaj atabilsin ekiptekilere").

          TOPLU KANAL YUKARIDAKİ SOHBET: ekibe yazılan bir mesaj bütün üyelerin
          okuduğu mesajdır ve ayrıca bir "toplu mesaj" düğmesi eklemek aynı işi
          iki kapıya bölerdi. Kitlesel BİLDİRİM göndermek isteyen koordinatörün
          yolu ise Yönetim Paneli · Toplu Mesaj — orada bu ekip tek başına bir
          alıcı grubudur (bkz. lib/bildirim/toplu-alicilar.ts).

          BİREYSEL KANAL SATIRIN KENDİSİNDE: aşağıdaki "Mesaj" düğmesi kişiyle
          birebir yazışmayı açıyor. Onay kapısı bu ikisi için zaten kapalı
          değil — aynı ekipte olmak, kanalı açan karardır (bkz.
          lib/iletisim/kurallar.ts · dogrudanYazisilabilirMi).
        */}
        {/*
          ÜYE LİSTESİ ÇIKTISI BURAYA TAŞINDI (26 Ağustos 2026 · istek: "İşlemler
          altında görüntüleme ve excel simgeleri var küçük … simge olanı
          kaldır").

          Bağlantı ekip envanterindeki satır ikonuydu ve o sütun kalktı. Rota
          silinmedi çünkü cevapladığı soru duruyor — "şu ekipte kimler var" —
          ve yeri artık o sorunun sorulduğu liste: üyelerin kendi kartı.
          Kaldırılsaydı rotanın hiçbir kapısı kalmayacaktı.

          YETKİ SORULMUYOR: kartı gören zaten sohbeti okuyabilen kişidir
          (üye, ekibi kuran koordinatör ya da merkez) ve rotanın kendi kapısı
          da aynı. Üyesi olduğu ekibin üye listesini indirmek yeni bir erişim
          açmıyor.
        */}
        {ekip.uyeler.length > 0 && (
          <p className="mb-4">
            <DisaAktarmaBagi
              yol={`/panel/ekipler/${ekip.id}/uyeler/disa-aktar`}
              kayitSayisi={ekip.uyeler.length}
            />
          </p>
        )}
        {ekip.uyeler.length === 0 ? (
          <p className="text-metin-yumusak">
            Ekipte henüz üye yok.{" "}
            {yonetebilir && "Aşağıdan arayarak ekleyebilirsiniz."}
          </p>
        ) : (
          <ul className="divide-y divide-cizgi">
            {ekip.uyeler.map(({ kullanici: uye, eklenmeTarihi }) => (
              <li
                key={uye.id}
                className="flex flex-wrap items-center justify-between gap-3 py-2.5"
              >
                <span className="flex flex-wrap items-center gap-2">
                  {[...new Set(uye.roller.map((rol) => rol.rolKodu))].map(
                    (rolKodu) => (
                      <RolEtiketi key={rolKodu} rolKodu={rolKodu} />
                    ),
                  )}
                  <span className="text-metin">
                    {uye.ad} {uye.soyad}
                  </span>
                  <span className="text-sm text-metin-yumusak">
                    {uye.sinif ?? uye.brans ?? "—"}
                    {" · "}
                    {uye.kurum?.ad ?? "—"}
                    {" · "}
                    {tarihSaatYaz(eklenmeTarihi)} tarihinde eklendi
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  {/*
                    KENDİNE MESAJ DÜĞMESİ BASILMIYOR: kural da izin vermiyor
                    ("Kendinize mesaj gönderemezsiniz") ve tıklanınca hata
                    veren bir düğme, olmayan düğmeden kötüdür.
                  */}
                  {uye.id !== kullanici.id && (
                    <form action={dogrudanYazismaAcEylemi}>
                      <input type="hidden" name="hedefId" value={uye.id} />
                      <button type="submit" className={SINIF_IKINCIL_BUTON}>
                        <Send size={15} aria-hidden />
                        Mesaj
                      </button>
                    </form>
                  )}
                  {yonetebilir && ekip.aktif && (
                    <form action={ekiptenUyeCikarEylemi}>
                      <input type="hidden" name="ekipId" value={ekip.id} />
                      <input type="hidden" name="kullaniciId" value={uye.id} />
                      <button type="submit" className={SINIF_IKINCIL_BUTON}>
                        Çıkar
                      </button>
                    </form>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Kart>

      {yonetebilir && ekip.aktif && (
        <Kart>
          <KartBasligi
            baslik="Üye ekle"
            aciklama={`${ekip.il.ad} ilindeki kişiler arasında süzün. Eklenen kişiye bildirim gider.`}
            Ikon={UserPlus}
          />
          {/*
            GELİŞMİŞ SÜZGEÇ (26 Ağustos 2026 · istek: "bunun yerine gelişmiş
            filtre ekleyelim: öğretmen öğrenci, okul türü, çalışma grubu,
            rolleri"). Süzgeçler BİRLİKTE daraltıyor; gerekçesi ve koşulları
            lib/ekip/aday-suzgeci.ts başlığında.

            Ad kutusu duruyor ve ilk sırada: adını bilen kişi için hâlâ en kısa
            yol. Tek farkı, artık tek kapı olmaması.
          */}
          <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block">
              <span className="text-sm font-medium text-metin">
                Ad ya da soyad
              </span>
              <input
                type="search"
                name="ara"
                defaultValue={suzgec.ara ?? ""}
                minLength={2}
                placeholder="En az iki harf"
                className={SINIF_GIRDI}
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-metin">Kişi</span>
              <select
                name="kisiTuru"
                defaultValue={suzgec.kisiTuru ?? ""}
                className={SINIF_GIRDI}
              >
                <option value="">Öğretmen ve öğrenci</option>
                {(
                  Object.keys(ADAY_KISI_TURU_ETIKETLERI) as AdayKisiTuru[]
                ).map((tur) => (
                  <option key={tur} value={tur}>
                    {ADAY_KISI_TURU_ETIKETLERI[tur]}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-metin">Okul türü</span>
              <select
                name="okulTuru"
                defaultValue={suzgec.okulTuru ?? ""}
                className={SINIF_GIRDI}
              >
                <option value="">Tüm okul türleri</option>
                {okulTuruSecenekleri(
                  ilinOkulTurleri.map((okul) => okul.okulTuru),
                ).map((tur) => (
                  <option key={tur} value={tur}>
                    {tur}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-metin">
                Çalışma grubu
              </span>
              <select
                name="grup"
                defaultValue={
                  suzgec.calismaGrubuId === null
                    ? ""
                    : String(suzgec.calismaGrubuId)
                }
                className={SINIF_GIRDI}
              >
                <option value="">Tüm gruplar</option>
                {calismaGruplari.map((grup) => (
                  <option key={grup.id} value={grup.id}>
                    {grup.ad}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-metin">Görevi</span>
              <select
                name="rol"
                defaultValue={suzgec.rol ?? ""}
                className={SINIF_GIRDI}
              >
                <option value="">Tüm görevler</option>
                {ADAY_ROLLERI.map((rol) => (
                  <option key={rol} value={rol}>
                    {ADAY_ROL_ETIKETLERI[rol]}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-end gap-2">
              <button type="submit" className={SINIF_IKINCIL_BUTON}>
                Ara
              </button>
              {suzgecDolu && (
                <Link
                  href={`/panel/ekipler/${ekip.id}`}
                  className="text-sm font-medium text-vurgu-metin underline underline-offset-2"
                >
                  Temizle
                </Link>
              )}
            </div>
          </form>

          {suzgecDolu && (
            <div className="mt-4">
              {/*
                SINIRA DAYANAN LİSTE SÖYLENİYOR: 50 satır dolduğunda kullanıcı
                listenin bittiğini değil kesildiğini bilmeli, yoksa aradığı kişi
                "yok" sanılır.
              */}
              {adaylar.length >= 50 && (
                <p className="mb-2 text-sm text-metin-yumusak">
                  İlk 50 kişi gösteriliyor; süzgeçleri daraltarak arayabilirsiniz.
                </p>
              )}
              {adaylar.length === 0 ? (
                <p className="text-metin-yumusak">
                  Bu süzgeçlere uyan, ekipte olmayan kişi bulunamadı.
                </p>
              ) : (
                <ul className="divide-y divide-cizgi">
                  {adaylar.map((aday) => (
                    <li
                      key={aday.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-2.5"
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        {[...new Set(aday.roller.map((rol) => rol.rolKodu))].map(
                          (rolKodu) => (
                            <RolEtiketi key={rolKodu} rolKodu={rolKodu} />
                          ),
                        )}
                        <span className="text-metin">
                          {aday.ad} {aday.soyad}
                        </span>
                        <span className="text-sm text-metin-yumusak">
                          {aday.sinif ?? aday.brans ?? "—"}
                          {" · "}
                          {aday.kurum?.ad ?? "—"}
                        </span>
                      </span>
                      <form action={ekibeUyeEkleEylemi}>
                        <input type="hidden" name="ekipId" value={ekip.id} />
                        <input
                          type="hidden"
                          name="kullaniciId"
                          value={aday.id}
                        />
                        <button type="submit" className={SINIF_IKINCIL_BUTON}>
                          <UserPlus size={15} aria-hidden />
                          Ekle
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Kart>
      )}

      {/*
        EKİBİ KAPATMA EN ALTTA ve ikincil düğmeyle: geri alınması olmayan bir
        işlem değil (kayıt duruyor) ama günlük iş de değil.
      */}
      {yonetebilir && ekip.aktif && (
        <Kart>
          <KartBasligi
            baslik="Ekibi kapat"
            aciklama="Sohbet ve üye listesi kayıtta kalır; yeni mesaj yazılamaz ve ekip listelerde arşive düşer."
          />
          <form action={ekibiKapatEylemi}>
            <input type="hidden" name="ekipId" value={ekip.id} />
            <button type="submit" className={SINIF_IKINCIL_BUTON}>
              Ekibi kapat
            </button>
          </form>
        </Kart>
      )}
    </div>
  );
}
