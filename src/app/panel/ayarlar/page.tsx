import {
  CalendarRange,
  Layers,
  Mail,
  MessageSquare,
  Plus,
  SlidersHorizontal,
} from "lucide-react";
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
import type { GonderimDurumu } from "@/generated/prisma/enums";
import { oturumKullanicisiZorunlu } from "@/lib/auth/oturum";
import { YONETILEBILIR_AYARLAR } from "@/lib/ayar";
import { BILDIRIM_SABLON_TANIMLARI } from "@/lib/bildirim/sablon";
import { prisma } from "@/lib/db";
import { ortam } from "@/lib/ortam";
import { tarihSaatYaz } from "@/lib/tarih";
import { sistemAyarlariniYonetebilirMi } from "@/lib/yetki/izinler";
import {
  ayarKaydetEylemi,
  bildirimSablonuKaydetEylemi,
  calismaGrubuAciklamaEylemi,
  calismaGrubuDurumEylemi,
  calismaGrubuEkleEylemi,
  programDurumEylemi,
  programEkleEylemi,
} from "./eylemler";

export const dynamic = "force-dynamic";

const EPOSTA_SAGLAYICI_ETIKETLERI: Record<string, string> = {
  kapali: "Kapalı — e-posta hiç denenmez",
  gunluk: "Günlük — ileti gönderilmez, sunucu günlüğüne yazılır",
  smtp: "SMTP — kurum posta sunucusu",
};

const SMS_SAGLAYICI_ETIKETLERI: Record<string, string> = {
  kapali: "Kapalı — SMS hiç denenmez (varsayılan)",
  gunluk: "Günlük — ileti gönderilmez, sunucu günlüğüne yazılır",
  http: "Operatör servisi — toplu SMS uç noktasına gönderilir",
};

const DURUM_MESAJLARI: Record<string, string> = {
  kaydedildi: "Ayar kaydedildi.",
  varsayilan: "Ayar varsayılan değerine döndürüldü.",
  "grup-eklendi": "Çalışma grubu eklendi.",
  "grup-pasif": "Çalışma grubu pasife alındı; geçmiş seçimler korunuyor.",
  "grup-aktif": "Çalışma grubu yeniden aktifleştirildi.",
  "grup-aciklama": "Çalışma grubunun açıklaması ve tanıtımı kaydedildi.",
  "program-eklendi": "Etkinlik programı eklendi.",
  "program-pasif": "Etkinlik programı pasife alındı; geçmiş etkinlikler korunuyor.",
  "program-aktif": "Etkinlik programı yeniden aktifleştirildi.",
  "sablon-kaydedildi": "Bildirim şablonu kaydedildi.",
};

/**
 * Yönetim ekranı — sistem ayarları, çalışma grupları ve etkinlik programları.
 *
 * Üçü de "koda gömülmeyecek" listelerdir ve yalnızca proje yöneticisi tarafından
 * yönetilir. Hiçbirinde SİLME yoktur: kapanan kayıt pasife alınır, böylece
 * geçmiş seçimler ve faaliyet bağlantıları bozulmaz.
 */
export default async function AyarlarSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ durum?: string; hata?: string; anahtar?: string }>;
}) {
  const { durum, hata } = await searchParams;
  const kullanici = await oturumKullanicisiZorunlu();

  if (!sistemAyarlariniYonetebilirMi(kullanici)) {
    return (
      <Kart>
        <KartBasligi
          baslik="Yönetim"
          aciklama="Bu ekran yalnızca proje yöneticisine açıktır."
        />
      </Kart>
    );
  }

  const [
    ayarlar,
    gruplar,
    programlar,
    epostaSayimlari,
    smsSayimlari,
    sonHata,
    sonSmsHatasi,
    sablonKayitlari,
  ] = await Promise.all([
    prisma.sistemAyari.findMany(),
    prisma.calismaGrubu.findMany({
      orderBy: [{ aktif: "desc" }, { siraNo: "asc" }],
    }),
    prisma.temelEtkinlikProgrami.findMany({
      orderBy: [{ grup: "asc" }, { aktif: "desc" }, { siraNo: "asc" }],
    }),
    prisma.bildirim.groupBy({
      by: ["epostaDurumu"],
      _count: { _all: true },
    }),
    prisma.bildirim.groupBy({
      by: ["smsDurumu"],
      _count: { _all: true },
    }),
    prisma.bildirim.findFirst({
      where: { epostaDurumu: "BASARISIZ" },
      orderBy: { olusturmaTarihi: "desc" },
      select: { olusturmaTarihi: true, epostaHatasi: true },
    }),
    prisma.bildirim.findFirst({
      where: { smsDurumu: "BASARISIZ" },
      orderBy: { olusturmaTarihi: "desc" },
      select: { olusturmaTarihi: true, smsHatasi: true },
    }),
    prisma.bildirimSablonu.findMany(),
  ]);

  const epostaSayisi = (durum: GonderimDurumu) =>
    epostaSayimlari.find((satir) => satir.epostaDurumu === durum)?._count
      ._all ?? 0;

  const smsSayisi = (durum: GonderimDurumu) =>
    smsSayimlari.find((satir) => satir.smsDurumu === durum)?._count._all ?? 0;

  /*
   * Şablon listesi KODDAN gelir, veritabanından değil: veritabanında karşılığı
   * olmayan bir kod da ekranda görünmeli ki yönetici metnini ilk kez yazabilsin
   * (kayıt ilk kaydetmede oluşur).
   */
  const sablonlar = BILDIRIM_SABLON_TANIMLARI.map((tanim) => ({
    tanim,
    kayit: sablonKayitlari.find((satir) => satir.kod === tanim.kod) ?? null,
  }));

  const ayarDegeri = (anahtar: string) =>
    ayarlar.find((ayar) => ayar.anahtar === anahtar)?.deger ?? "";

  const temelProgramlar = programlar.filter(
    (program) => program.grup === "TEMEL_ETKINLIK",
  );
  const grupProgramlari = programlar.filter(
    (program) => program.grup === "CALISMA_GRUBU_ETKINLIGI",
  );

  return (
    <div className="space-y-6">
      {/*
        KIRINTI YOLU (29 Ağustos 2026 · istekler: "navigasyon bunu göstersin
        yönetim paneli / rol envanteri şeklinde" · "yönetim panelindeki tüm
        kartlara uygula").

        Yerinde tek başına "← Yönetim Paneli" bağlantısı vardı: dönülecek
        yeri söylüyor, bulunulan yeri söylemiyordu. Şerit ikisini birden
        basıyor ve panodan açılan HER ekranda aynı biçimde duruyor.

        SON BASAMAK BAĞLANTI DEĞİL (bkz. components/ui.tsx · KirintiYolu);
        SayfaBasligi'nın geri bağlantısı bu yüzden `null` — ikisi bir arada
        aynı yolu üst üste iki kez basardı.
      */}
      <KirintiYolu
        basamaklar={[
          { etiket: "Yönetim Paneli", yol: "/panel/yonetim" },
          { etiket: "Sistem ayarları" },
        ]}
      />

      <SayfaBasligi
        geri={null}
        baslik="Yönetim"
        aciklama="Sistem ayarları, çalışma grupları ve etkinlik programları. Hiçbir kayıt silinmez; kapananlar pasife alınır."
      />

      {durum && DURUM_MESAJLARI[durum] && (
        <BilgiKutusu cesit="olumlu">{DURUM_MESAJLARI[durum]}</BilgiKutusu>
      )}
      {hata && <BilgiKutusu cesit="hata">{hata}</BilgiKutusu>}

      <Kart>
        <KartBasligi
          baslik="Sistem ayarları"
          aciklama="Her ayar kendi başına kaydedilir."
          Ikon={SlidersHorizontal}
        />
        <div className="space-y-5">
          {YONETILEBILIR_AYARLAR.map((tanim) => (
            <form
              key={tanim.anahtar}
              action={ayarKaydetEylemi}
              className="border-t border-cizgi pt-5 first:border-t-0 first:pt-0"
            >
              <input type="hidden" name="anahtar" value={tanim.anahtar} />
              <label className="block">
                <span className="text-sm font-medium text-metin">
                  {tanim.baslik}
                </span>
                {tanim.bicim === "uzun-metin" ? (
                  <textarea
                    name="deger"
                    rows={10}
                    defaultValue={ayarDegeri(tanim.anahtar)}
                    placeholder="Boş bırakılırsa varsayılan metin kullanılır."
                    className={`${SINIF_GIRDI} font-mono text-xs`}
                  />
                ) : (
                  <input
                    type={tanim.bicim === "sayi" ? "number" : "text"}
                    name="deger"
                    min={tanim.bicim === "sayi" ? 1 : undefined}
                    defaultValue={ayarDegeri(tanim.anahtar)}
                    className={SINIF_GIRDI}
                  />
                )}
                <span className="mt-1 block text-sm text-metin-yumusak">
                  {tanim.yardim}
                </span>
              </label>
              <button type="submit" className={`${SINIF_IKINCIL_BUTON} mt-3`}>
                Kaydet
              </button>
            </form>
          ))}
        </div>
      </Kart>

      <Kart>
        <KartBasligi
          baslik="E-posta bildirimi"
          aciklama="Panel bildirimi her koşulda yazılır; e-posta yalnızca bir kopyasıdır. Sağlayıcı ortam değişkeniyle seçilir, buradan değiştirilmez."
          Ikon={Mail}
        />
        <dl className="grid gap-4 sm:grid-cols-4">
          <div>
            <dt className="text-sm text-metin-yumusak">Sağlayıcı</dt>
            <dd className="mt-0.5 font-medium text-metin">
              {EPOSTA_SAGLAYICI_ETIKETLERI[ortam.EPOSTA_SAGLAYICI]}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-metin-yumusak">Gönderildi</dt>
            <dd className="mt-0.5 font-medium text-metin">
              {epostaSayisi("GONDERILDI")}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-metin-yumusak">Başarısız</dt>
            <dd className="mt-0.5 font-medium text-metin">
              {epostaSayisi("BASARISIZ")}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-metin-yumusak">
              Gönderilmedi (adres yok)
            </dt>
            <dd className="mt-0.5 font-medium text-metin">
              {epostaSayisi("GEREKMIYOR")}
            </dd>
          </div>
        </dl>
        {sonHata && (
          <BilgiKutusu cesit="hata" className="mt-4">
            Son başarısız gönderim {tarihSaatYaz(sonHata.olusturmaTarihi)}:{" "}
            {sonHata.epostaHatasi ?? "gerekçe kaydedilmemiş"}
          </BilgiKutusu>
        )}
      </Kart>

      <Kart>
        <KartBasligi
          baslik="SMS bildirimi"
          aciklama="E-postadan bağımsız bir kopyadır ve varsayılan olarak KAPALIDIR: SMS ücretli, geri alınamaz ve alıcıların çoğu 18 yaş altı. Sağlayıcı ortam değişkeniyle seçilir."
          Ikon={MessageSquare}
        />
        <dl className="grid gap-4 sm:grid-cols-4">
          <div>
            <dt className="text-sm text-metin-yumusak">Sağlayıcı</dt>
            <dd className="mt-0.5 font-medium text-metin">
              {SMS_SAGLAYICI_ETIKETLERI[ortam.SMS_SAGLAYICI]}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-metin-yumusak">Gönderildi</dt>
            <dd className="mt-0.5 font-medium text-metin">
              {smsSayisi("GONDERILDI")}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-metin-yumusak">Başarısız</dt>
            <dd className="mt-0.5 font-medium text-metin">
              {smsSayisi("BASARISIZ")}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-metin-yumusak">
              Gönderilmedi (numara yok / kapalı)
            </dt>
            <dd className="mt-0.5 font-medium text-metin">
              {smsSayisi("GEREKMIYOR")}
            </dd>
          </div>
        </dl>
        {sonSmsHatasi && (
          <BilgiKutusu cesit="hata" className="mt-4">
            Son başarısız gönderim{" "}
            {tarihSaatYaz(sonSmsHatasi.olusturmaTarihi)}:{" "}
            {sonSmsHatasi.smsHatasi ?? "gerekçe kaydedilmemiş"}
          </BilgiKutusu>
        )}
      </Kart>

      <Kart>
        <div id="bildirim-sablonlari" className="scroll-mt-6">
          <KartBasligi
            baslik="Bildirim şablonları"
            aciklama="Bildirim metinleri koda gömülü değildir, buradan yönetilir. Kod listesi sabittir: şablonu tetikleyen olay kodda yaşar, buraya yeni satır eklemek yeni bildirim üretmez."
            Ikon={MessageSquare}
          />
        </div>

        <div className="space-y-6">
          {sablonlar.map(({ tanim, kayit }) => (
            <form
              key={tanim.kod}
              action={bildirimSablonuKaydetEylemi}
              className="border-t border-cizgi pt-5 first:border-t-0 first:pt-0"
            >
              <input type="hidden" name="kod" value={tanim.kod} />

              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-semibold text-baslik">
                  {tanim.baslik}
                  {kayit === null && (
                    <span className="ml-2 rounded-full bg-uyari-zemin px-2 py-0.5 text-xs font-normal text-uyari-metin">
                      henüz tanımlanmadı
                    </span>
                  )}
                  {kayit && !kayit.aktif && (
                    <span className="ml-2 rounded-full bg-zemin px-2 py-0.5 text-xs font-normal text-metin-yumusak">
                      pasif
                    </span>
                  )}
                </h3>
                <code className="text-xs text-metin-yumusak">{tanim.kod}</code>
              </div>

              <p className="mb-3 text-sm text-metin-yumusak">
                {tanim.aciklama}
              </p>

              <div className="space-y-3">
                <label className="block">
                  <span className="text-sm font-medium text-metin">Konu</span>
                  <input
                    type="text"
                    name="konu"
                    required
                    maxLength={200}
                    defaultValue={kayit?.konu ?? ""}
                    className={SINIF_GIRDI}
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-metin">Gövde</span>
                  <textarea
                    name="govdeSablonu"
                    required
                    rows={5}
                    defaultValue={kayit?.govdeSablonu ?? ""}
                    className={`${SINIF_GIRDI} font-mono text-xs`}
                  />
                </label>
              </div>

              <p className="mt-2 text-sm text-metin-yumusak">
                {tanim.degiskenler.length === 0
                  ? "Bu şablonda değişken yoktur; metin olduğu gibi gönderilir."
                  : `Kullanılabilir değişkenler: ${tanim.degiskenler
                      .map((ad) => `{{${ad}}}`)
                      .join(", ")}`}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-metin">
                  <input
                    type="checkbox"
                    name="aktif"
                    value="evet"
                    defaultChecked={kayit?.aktif ?? true}
                    className="h-4 w-4 rounded border-cizgi accent-[var(--renk-birincil)]"
                  />
                  Bu bildirim gönderilsin
                </label>
                <button type="submit" className={SINIF_IKINCIL_BUTON}>
                  Kaydet
                </button>
              </div>
            </form>
          ))}
        </div>
      </Kart>

      <Kart>
        <KartBasligi
          baslik="Çalışma grupları"
          aciklama="Öğrencilerin seçebildiği ilgi alanları. Pasif gruplar yeni seçimlerde listelenmez, geçmiş seçimler korunur."
          Ikon={Layers}
        />

        <form
          action={calismaGrubuEkleEylemi}
          className="mb-5 flex flex-wrap items-end gap-3"
        >
          <label className="block grow">
            <span className="text-sm font-medium text-metin">Grup adı</span>
            <input type="text" name="ad" required className={SINIF_GIRDI} />
          </label>
          <label className="block w-28">
            <span className="text-sm font-medium text-metin">Sıra</span>
            <input type="number" name="siraNo" min={1} className={SINIF_GIRDI} />
          </label>
          <button type="submit" className={SINIF_BIRINCIL_BUTON}>
            <Plus size={16} aria-hidden />
            Ekle
          </button>
        </form>

        <ul className="divide-y divide-cizgi">
          {gruplar.map((grup) => (
            <li
              key={grup.id}
              className="flex flex-wrap items-center justify-between gap-3 py-2.5"
            >
              <span className={grup.aktif ? "text-metin" : "text-metin-yumusak"}>
                {grup.siraNo}. {grup.ad}
                {!grup.aktif && (
                  <span className="ml-2 rounded-full bg-zemin px-2 py-0.5 text-xs">
                    pasif
                  </span>
                )}
              </span>
              {/*
                Kısa açıklama ve tanıtım: öğrenci grubu seçince seçim
                listesinin altında okur (27 Ekim 2026). İkisi tek formda,
                tek Kaydet ile.
              */}
              <form
                action={calismaGrubuAciklamaEylemi}
                className="w-full space-y-2 sm:w-auto sm:grow"
              >
                <input type="hidden" name="id" value={grup.id} />
                <input
                  type="text"
                  name="aciklama"
                  defaultValue={grup.aciklama ?? ""}
                  maxLength={300}
                  placeholder="Kısa açıklama"
                  aria-label={`${grup.ad} kısa açıklaması`}
                  className={SINIF_GIRDI}
                />
                <textarea
                  name="tanitim"
                  defaultValue={grup.tanitim ?? ""}
                  maxLength={5000}
                  rows={3}
                  placeholder="Tanıtım yazısı"
                  aria-label={`${grup.ad} tanıtım yazısı`}
                  className={SINIF_GIRDI}
                />
                <button type="submit" className={SINIF_IKINCIL_BUTON}>
                  Kaydet
                </button>
              </form>
              <form action={calismaGrubuDurumEylemi}>
                <input type="hidden" name="id" value={grup.id} />
                <input
                  type="hidden"
                  name="aktif"
                  value={grup.aktif ? "hayir" : "evet"}
                />
                <button type="submit" className={SINIF_IKINCIL_BUTON}>
                  {grup.aktif ? "Pasife al" : "Aktifleştir"}
                </button>
              </form>
            </li>
          ))}
        </ul>
      </Kart>

      <Kart>
        <KartBasligi
          baslik="Etkinlik programları"
          aciklama="Temel Etkinlik ve Çalışma Grubu Etkinliği kategorilerinde etkinliğin adı bu listeden seçilir. İl Etkinliği'nin sabit listesi yoktur."
          Ikon={CalendarRange}
        />

        <form
          action={programEkleEylemi}
          className="mb-5 flex flex-wrap items-end gap-3"
        >
          <label className="block grow">
            <span className="text-sm font-medium text-metin">Program adı</span>
            <input type="text" name="ad" required className={SINIF_GIRDI} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-metin">Grup</span>
            <select name="grup" className={SINIF_GIRDI}>
              <option value="TEMEL_ETKINLIK">Temel Etkinlik</option>
              <option value="CALISMA_GRUBU_ETKINLIGI">
                Çalışma Grubu Etkinliği
              </option>
            </select>
          </label>
          <label className="block w-28">
            <span className="text-sm font-medium text-metin">Sıra</span>
            <input type="number" name="siraNo" min={1} className={SINIF_GIRDI} />
          </label>
          <button type="submit" className={SINIF_BIRINCIL_BUTON}>
            <Plus size={16} aria-hidden />
            Ekle
          </button>
        </form>

        <div className="grid gap-6 sm:grid-cols-2">
          {[
            { baslik: "Temel Etkinlik", liste: temelProgramlar },
            { baslik: "Çalışma Grubu Etkinliği", liste: grupProgramlari },
          ].map((bolum) => (
            <div key={bolum.baslik}>
              <h3 className="mb-2 text-sm font-semibold text-baslik">
                {bolum.baslik}
              </h3>
              <ul className="divide-y divide-cizgi">
                {bolum.liste.map((program) => (
                  <li
                    key={program.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2"
                  >
                    <span
                      className={`text-sm ${
                        program.aktif ? "text-metin" : "text-metin-yumusak"
                      }`}
                    >
                      {program.ad}
                      {!program.aktif && (
                        <span className="ml-2 rounded-full bg-zemin px-2 py-0.5 text-xs">
                          pasif
                        </span>
                      )}
                    </span>
                    <form action={programDurumEylemi}>
                      <input type="hidden" name="id" value={program.id} />
                      <input
                        type="hidden"
                        name="aktif"
                        value={program.aktif ? "hayir" : "evet"}
                      />
                      <button
                        type="submit"
                        className="text-sm text-metin-yumusak underline underline-offset-2 transition hover:text-metin"
                      >
                        {program.aktif ? "Pasife al" : "Aktifleştir"}
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Kart>
    </div>
  );
}
