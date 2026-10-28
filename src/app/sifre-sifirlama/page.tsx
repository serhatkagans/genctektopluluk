import { KeyRound, MailCheck } from "lucide-react";
import Link from "next/link";
import { KamuSayfaDuzeni } from "@/components/KamuSayfaDuzeni";
import { BilgiKutusu, SINIF_BIRINCIL_BUTON, SINIF_GIRDI } from "@/components/ui";
import {
  SIFIRLAMA_GECERLILIK_DAKIKA,
  SIFRE_ALT_SINIRI,
} from "@/lib/dis-kimlik/kurallar";
import {
  kayitSifirlamaIsteEylemi,
  kayitSifirlamaTamamlaEylemi,
  sifirlamaIsteEylemi,
  sifirlamaTamamlaEylemi,
} from "./eylemler";

/**
 * Parola sıfırlama.
 *
 * İKİ KAPI: `?tur=kayit` (ve bağlantıdaki `k`) öğrenci ve öğretmen hesapları
 * içindir — T.C. numarası + e-posta (28 Ekim 2026). Parametresiz ekran mezun
 * ve paydaş temsilcilerinin e-postalı akışıdır.
 *
 * Aşağıdaki eski not dış kullanıcı kapısı için geçerlidir:
 *
 * EBA/mock kimlikli kullanıcıların şifresi yoktur; bu ekran onlara hiçbir şey
 * söylemez ve söylememeli. Ekranın kendisi de "bu adres kayıtlı mı" sorusunu
 * cevaplamaz: jeton istenen her durumda aynı sonuç gösterilir.
 */

export const dynamic = "force-dynamic";

export default async function SifreSifirlamaSayfasi({
  searchParams,
}: {
  searchParams: Promise<{
    e?: string;
    k?: string;
    tur?: string;
    jeton?: string;
    hata?: string;
    durum?: string;
  }>;
}) {
  const { e, k, tur, jeton, hata, durum } = await searchParams;

  // ==== ÖĞRENCİ / ÖĞRETMEN (kayıtlı hesap) ================================
  if (tur === "kayit" && durum === "gonderildi") {
    return (
      <KamuSayfaDuzeni
        baslik="Sıfırlama bağlantısı gönderildi"
        geriYol="/giris"
        geriEtiket="Giriş ekranı"
        genislik="max-w-xl"
      >
        <BilgiKutusu cesit="olumlu" className="mt-6">
          <p className="flex items-start gap-2">
            <MailCheck size={18} className="mt-0.5 shrink-0" aria-hidden />
            <span>
              Bilgileriniz kayıtla eşleşiyorsa, kayıtlı e-posta adresinize şifre
              sıfırlama bağlantısı gönderildi. Bağlantı{" "}
              {SIFIRLAMA_GECERLILIK_DAKIKA} dakika geçerlidir ve bir kez
              kullanılabilir. Gelen kutunuzda yoksa gereksiz (spam) klasörüne
              bakın.
            </span>
          </p>
        </BilgiKutusu>
        <p className="mt-6 text-sm text-metin-yumusak">
          E-posta gelmediyse proje yöneticisine başvurun; size geçici bir şifre
          verebilir.
        </p>
        <p className="mt-4 text-sm">
          <Link href="/giris" className="font-medium text-vurgu-metin">
            Giriş ekranına dön
          </Link>
        </p>
      </KamuSayfaDuzeni>
    );
  }

  if (k && jeton) {
    return (
      <KamuSayfaDuzeni
        baslik="Yeni şifrenizi belirleyin"
        geriYol="/giris"
        geriEtiket="Giriş ekranı"
        genislik="max-w-xl"
      >
        {hata && (
          <BilgiKutusu cesit="hata" className="mt-6">
            {hata}
          </BilgiKutusu>
        )}

        <form action={kayitSifirlamaTamamlaEylemi} className="mt-6 space-y-4">
          <input type="hidden" name="k" value={k} />
          <input type="hidden" name="jeton" value={jeton} />
          <YeniSifreAlanlari aciklama="Adınızı, soyadınızı, e-postanızı ya da T.C. kimlik numaranızı içeremez." />
          <button type="submit" className={SINIF_BIRINCIL_BUTON}>
            <KeyRound size={16} aria-hidden />
            Şifreyi güncelle
          </button>
        </form>
      </KamuSayfaDuzeni>
    );
  }

  if (tur === "kayit") {
    return (
      <KamuSayfaDuzeni
        baslik="Şifremi unuttum"
        aciklama="Öğrenci ve öğretmen hesapları"
        geriYol="/giris"
        geriEtiket="Giriş ekranı"
        genislik="max-w-xl"
      >
        <p className="mt-6 text-sm text-metin-yumusak">
          T.C. kimlik numaranızı ve kayıt olurken yazdığınız e-posta adresini
          girin. Bilgiler eşleşirse şifrenizi yenilemeniz için o adrese bir
          bağlantı göndereceğiz.
        </p>

        <form action={kayitSifirlamaIsteEylemi} className="mt-6 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-metin-yumusak">
              T.C. kimlik numarası
            </span>
            <input
              name="tcKimlikNo"
              required
              inputMode="numeric"
              pattern="[0-9 ]{11,14}"
              maxLength={14}
              autoComplete="username"
              className={SINIF_GIRDI}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-metin-yumusak">
              E-posta adresiniz
            </span>
            <input
              type="email"
              name="eposta"
              required
              autoComplete="email"
              className={SINIF_GIRDI}
            />
          </label>
          <button type="submit" className={SINIF_BIRINCIL_BUTON}>
            Sıfırlama bağlantısı gönder
          </button>
        </form>

        <p className="mt-6 text-sm text-metin-yumusak">
          E-postanıza ulaşamıyorsanız proje yöneticisine başvurun; size geçici
          bir şifre verebilir.
        </p>
      </KamuSayfaDuzeni>
    );
  }

  // ==== MEZUN / PAYDAŞ (dış kullanıcı) ====================================

  if (durum === "gonderildi") {
    return (
      <KamuSayfaDuzeni
        baslik="Sıfırlama bağlantısı gönderildi"
        geriYol="/dis-giris"
        geriEtiket="Giriş ekranı"
        genislik="max-w-xl"
      >
        <BilgiKutusu cesit="olumlu" className="mt-6">
          <p className="flex items-start gap-2">
            <MailCheck size={18} className="mt-0.5 shrink-0" aria-hidden />
            <span>
              Adres sistemde kayıtlıysa şifre sıfırlama bağlantısı gönderildi.
              Bağlantı {SIFIRLAMA_GECERLILIK_DAKIKA} dakika geçerlidir ve bir kez
              kullanılabilir.
            </span>
          </p>
        </BilgiKutusu>
        <p className="mt-6 text-sm">
          <Link href="/dis-giris" className="font-medium text-vurgu-metin">
            Giriş ekranına dön
          </Link>
        </p>
      </KamuSayfaDuzeni>
    );
  }

  // ---- Jetonlu adım: yeni şifre ------------------------------------------
  if (jeton && e) {
    return (
      <KamuSayfaDuzeni
        baslik="Yeni şifrenizi belirleyin"
        aciklama={e}
        geriYol="/dis-giris"
        geriEtiket="Giriş ekranı"
        genislik="max-w-xl"
      >
        {hata && (
          <BilgiKutusu cesit="hata" className="mt-6">
            {hata}
          </BilgiKutusu>
        )}

        <form action={sifirlamaTamamlaEylemi} className="mt-6 space-y-4">
          <input type="hidden" name="eposta" value={e} />
          <input type="hidden" name="jeton" value={jeton} />

          <label className="block">
            <span className="text-sm font-medium text-metin-yumusak">
              Yeni şifre
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
              Yeni şifre (tekrar)
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

          <button type="submit" className={SINIF_BIRINCIL_BUTON}>
            <KeyRound size={16} aria-hidden />
            Şifreyi güncelle
          </button>
        </form>
      </KamuSayfaDuzeni>
    );
  }

  // ---- İlk adım: e-posta -------------------------------------------------
  return (
    <KamuSayfaDuzeni
      baslik="Şifre sıfırlama"
      aciklama="Mezun ve paydaş temsilcisi hesapları içindir."
      geriYol="/dis-giris"
      geriEtiket="Giriş ekranı"
      genislik="max-w-xl"
    >
      {hata && (
        <BilgiKutusu cesit="hata" className="mt-6">
          {hata}
        </BilgiKutusu>
      )}

      <BilgiKutusu cesit="uyari" className="mt-6">
        Öğrenci ya da öğretmen misiniz?{" "}
        <Link href="/sifre-sifirlama?tur=kayit" className="font-medium underline">
          T.C. kimlik numarasıyla şifre sıfırlama
        </Link>
      </BilgiKutusu>

      <form action={sifirlamaIsteEylemi} className="mt-6 space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-metin-yumusak">
            E-posta adresiniz
          </span>
          <input
            type="email"
            name="eposta"
            required
            autoComplete="email"
            className={SINIF_GIRDI}
          />
        </label>

        <button type="submit" className={SINIF_BIRINCIL_BUTON}>
          Sıfırlama bağlantısı gönder
        </button>
      </form>
    </KamuSayfaDuzeni>
  );
}

function YeniSifreAlanlari({ aciklama }: { aciklama: string }) {
  return (
    <>
      <label className="block">
        <span className="text-sm font-medium text-metin-yumusak">Yeni şifre</span>
        <input
          type="password"
          name="sifre"
          required
          minLength={SIFRE_ALT_SINIRI}
          autoComplete="new-password"
          className={SINIF_GIRDI}
        />
        <span className="mt-1 block text-xs text-metin-yumusak">
          En az {SIFRE_ALT_SINIRI} karakter. {aciklama}
        </span>
      </label>
      <label className="block">
        <span className="text-sm font-medium text-metin-yumusak">
          Yeni şifre (tekrar)
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
    </>
  );
}
