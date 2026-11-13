import { Pencil, Search } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { KullaniciIslemleri } from "@/components/KullaniciIslemleri";
import { RolEtiketi } from "@/components/RolEtiketi";
import {
  Kart,
  Rozet,
  SayfaBasligi,
  SINIF_GIRDI,
  SINIF_IKINCIL_BUTON,
} from "@/components/ui";
import { yonetilebilirKullaniciFiltresi } from "@/lib/kullanici-yonetimi/kapsam";
import type { Prisma } from "@/generated/prisma/client";
import { oturumKullanicisiZorunlu } from "@/lib/auth/oturum";
import { prisma } from "@/lib/db";
import { tarihSaatYaz } from "@/lib/tarih";
import { kullaniciSifresiYonetebilirMi, kullaniciYoneticisiCoz } from "@/lib/yetki/izinler";
import { erisimLogla } from "@/lib/yetki/log";

export const dynamic = "force-dynamic";

const SAYFA_BOYU = 50;

/**
 * KULLANICI YÖNETİMİ (28 Ekim 2026 · istek: "proje yöneticisi için yönetim
 * panelinde kullanıcı yönetimi diye bölüm ekle, kullanıcı kaydı silme şifre
 * yenileme gibi kısımlar olsun").
 *
 * Ad, soyad, T.C. numarası ya da e-postayla arama; her satırda şifre yenileme
 * (geçici şifre), kilit açma, pasife alma ve kaydı silme. Aramasız açılışta
 * en son açılan hesaplar listelenir — yanlış/deneme kayıtlarını temizlemek
 * için en sık bakılan yer orası.
 *
 * Kapı dar: proje yöneticisi ve — 13 Kasım 2026'dan beri — il koordinatörü;
 * yetkisi olmayana 404 (ekranın varlığı bile sızmasın).
 *
 * İL KOORDİNATÖRÜ (istek: "koordinatörler için yönetim panelinde kullanıcı
 * yönetimi aç, sadece kendi ilindeki öğrenci ve öğretmen kayıtlarını oradan
 * düzenleyebilsin"): liste kendi ilinin öğrenci ve öğretmenleriyle sınırlı
 * (kullanici-yonetimi/kapsam.ts). T.C. numarası ona gösterilmez; T.C. ile
 * yalnızca 11 hanenin tamamı yazılınca bulunur — baş harflerle tarama yok.
 * Geçici şifre düğmesi ona çıkmaz.
 */
export default async function KullaniciYonetimiSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ ara?: string; durum?: string; rol?: string }>;
}) {
  const yonetici = await oturumKullanicisiZorunlu();
  const yapan = kullaniciYoneticisiCoz(yonetici);
  if (!yapan) notFound();
  const merkezMi = yapan.rol === "PROJE_YONETICISI";
  const sifreYetkisi = kullaniciSifresiYonetebilirMi(yapan);

  const { ara: hamAra, durum: hamDurum, rol: hamRol } = await searchParams;
  const ara = (hamAra ?? "").trim().slice(0, 100);
  const durum = hamDurum === "aktif" || hamDurum === "pasif" ? hamDurum : "tumu";
  const rol = hamRol === "ogrenci" || hamRol === "ogretmen" ? hamRol : "tumu";

  const kosullar: Prisma.KullaniciWhereInput[] = [
    { anonimlestirmeTarihi: null },
    yonetilebilirKullaniciFiltresi(yapan),
  ];
  if (durum !== "tumu") kosullar.push({ aktif: durum === "aktif" });
  if (rol === "ogrenci") {
    kosullar.push({ roller: { some: { rolKodu: "OGRENCI", bitisTarihi: null } } });
  }
  if (rol === "ogretmen") {
    kosullar.push({
      roller: {
        none: {
          bitisTarihi: null,
          rolKodu: { in: ["OGRENCI", "PROJE_YONETICISI", "MEZUN", "PAYDAS_TEMSILCISI"] },
        },
      },
      disKimlik: { is: null },
    });
  }

  if (ara) {
    const rakam = ara.replace(/\s+/g, "");
    if (!merkezMi && /^\d+$/.test(rakam)) {
      kosullar.push({ authProviderId: rakam });
    } else if (/^\d{3,11}$/.test(rakam)) {
      kosullar.push({ authProviderId: { startsWith: rakam } });
    } else if (ara.includes("@")) {
      const eposta = { contains: ara, mode: "insensitive" as const };
      kosullar.push({
        OR: [
          { ogrenciProfil: { eposta } },
          { ogretmenProfil: { eposta } },
          { kayitKimlik: { eposta } },
          { disKimlik: { eposta } },
        ],
      });
    } else {
      // Her kelime adda ya da soyadda geçmeli: "Ali Yılmaz" iki kelimeyle bulunur.
      for (const kelime of ara.split(/\s+/).slice(0, 4)) {
        const icerir = { contains: kelime, mode: "insensitive" as const };
        kosullar.push({ OR: [{ ad: icerir }, { soyad: icerir }] });
      }
    }
  }

  const where: Prisma.KullaniciWhereInput = { AND: kosullar };
  const [toplam, kisiler] = await Promise.all([
    prisma.kullanici.count({ where }),
    prisma.kullanici.findMany({
      where,
      orderBy: { olusturmaTarihi: "desc" },
      take: SAYFA_BOYU,
      select: {
        id: true,
        ad: true,
        soyad: true,
        authProviderId: true,
        aktif: true,
        olusturmaTarihi: true,
        beyanOkulAdi: true,
        il: { select: { ad: true } },
        kurum: { select: { ad: true } },
        roller: {
          where: { bitisTarihi: null },
          select: { rolKodu: true },
        },
        ogrenciProfil: { select: { eposta: true, telefon: true } },
        ogretmenProfil: { select: { eposta: true, telefon: true } },
        kayitKimlik: {
          select: { eposta: true, sonGirisTarihi: true, kilitBitisTarihi: true },
        },
        disKimlik: {
          select: { eposta: true, sonGirisTarihi: true, kilitBitisTarihi: true },
        },
      },
    }),
  ]);

  await erisimLogla({
    kullaniciId: yonetici.id,
    islem: "GORUNTULEME",
    hedefTip: "PROFIL",
    hedefId: "kullanici-yonetimi",
    detay: ara ? `Kullanıcı yönetimi araması: ${ara}` : "Kullanıcı yönetimi listesi",
  });

  const simdi = new Date();

  return (
    <div className="space-y-6">
      <SayfaBasligi
        baslik="Kullanıcı Yönetimi"
        aciklama={
          merkezMi
            ? "Hesap arama, bilgileri düzenleme, şifre yenileme, kilit açma, pasife alma ve kayıt silme"
            : "İlinizdeki öğrenci ve öğretmen kayıtları: bilgileri düzenleme, kilit açma, pasife alma ve kayıt silme"
        }
        geri={{ yol: "/panel/yonetim", etiket: "Yönetim Paneli" }}
      />

      <Kart>
        <form className="flex flex-wrap items-end gap-3">
          <label className="block min-w-60 flex-1">
            <span className="text-sm font-medium text-metin-yumusak">
              {merkezMi
                ? "Ad soyad, T.C. kimlik no ya da e-posta"
                : "Ad soyad, e-posta ya da T.C. kimlik no (11 hane)"}
            </span>
            <input name="ara" defaultValue={ara} className={SINIF_GIRDI} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-metin-yumusak">Kim</span>
            <select name="rol" defaultValue={rol} className={SINIF_GIRDI}>
              <option value="tumu">Tümü</option>
              <option value="ogrenci">Öğrenci</option>
              <option value="ogretmen">Öğretmen</option>
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-metin-yumusak">Durum</span>
            <select name="durum" defaultValue={durum} className={SINIF_GIRDI}>
              <option value="tumu">Tümü</option>
              <option value="aktif">Aktif</option>
              <option value="pasif">Pasif</option>
            </select>
          </label>
          <button type="submit" className={SINIF_IKINCIL_BUTON}>
            <Search size={16} aria-hidden />
            Ara
          </button>
        </form>
        <p className="mt-3 text-sm text-metin-yumusak">
          {toplam} hesap bulundu
          {toplam > SAYFA_BOYU
            ? ` · en yeni ${SAYFA_BOYU} tanesi gösteriliyor, aramayı daraltın`
            : ""}
          .
        </p>
      </Kart>

      <ul className="space-y-3">
        {kisiler.map((kisi) => {
          const hedefMerkezMi = kisi.roller.some((r) => r.rolKodu === "PROJE_YONETICISI");
          const kendisiMi = kisi.id === yonetici.id;
          const eposta =
            kisi.ogrenciProfil?.eposta ??
            kisi.ogretmenProfil?.eposta ??
            kisi.kayitKimlik?.eposta ??
            kisi.disKimlik?.eposta ??
            null;
          const telefon = kisi.ogrenciProfil?.telefon ?? kisi.ogretmenProfil?.telefon ?? null;
          const sonGiris =
            kisi.kayitKimlik?.sonGirisTarihi ?? kisi.disKimlik?.sonGirisTarihi ?? null;
          const kilit =
            kisi.kayitKimlik?.kilitBitisTarihi ?? kisi.disKimlik?.kilitBitisTarihi ?? null;
          const kilitliMi = kilit !== null && kilit > simdi;
          const girisTuru = kisi.kayitKimlik
            ? "T.C. + şifre"
            : kisi.disKimlik
              ? "E-posta + şifre"
              : "EBA";

          return (
            <li key={kisi.id}>
              <Kart>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-baslik">
                      {kisi.ad} {kisi.soyad}
                    </p>
                    <p className="mt-0.5 text-sm text-metin-yumusak">
                      {[
                        merkezMi && /^\d{11}$/.test(kisi.authProviderId)
                          ? `T.C. ${kisi.authProviderId}`
                          : null,
                        kisi.il?.ad,
                        kisi.kurum?.ad ?? kisi.beyanOkulAdi,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <p className="mt-0.5 break-all text-sm text-metin-yumusak">
                      {[eposta, telefon].filter(Boolean).join(" · ") || "İletişim bilgisi yok"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {kisi.roller.map((r) => (
                      <RolEtiketi key={r.rolKodu} rolKodu={r.rolKodu} />
                    ))}
                    {!kisi.aktif && <Rozet cesit="hata">Pasif</Rozet>}
                    {kilitliMi && <Rozet cesit="uyari">Kilitli</Rozet>}
                  </div>
                </div>

                <p className="mt-2 text-xs text-metin-yumusak">
                  Giriş: {girisTuru} · Kayıt: {tarihSaatYaz(kisi.olusturmaTarihi)} · Son
                  giriş: {sonGiris ? tarihSaatYaz(sonGiris) : "—"}
                </p>

                <div className="mt-3 border-t border-cizgi pt-3">
                  {kendisiMi ? (
                    <p className="text-sm text-metin-yumusak">Bu sizin hesabınız.</p>
                  ) : hedefMerkezMi ? (
                    <p className="text-sm text-metin-yumusak">
                      Proje yöneticisi hesapları bu ekrandan değiştirilmez.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      <Link
                        href={`/panel/kullanici-yonetimi/${kisi.id}`}
                        className={`${SINIF_IKINCIL_BUTON} !px-3 !py-1.5 !text-xs`}
                      >
                        <Pencil size={14} aria-hidden />
                        Bilgileri düzenle
                      </Link>
                      <KullaniciIslemleri
                        kullaniciId={kisi.id}
                        aktif={kisi.aktif}
                        sifreliMi={sifreYetkisi && !!(kisi.kayitKimlik || kisi.disKimlik)}
                        kilitliMi={kilitliMi}
                      />
                    </div>
                  )}
                </div>
              </Kart>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
