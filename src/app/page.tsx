import { Info, LogIn } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TemaSecici } from "@/components/TemaSecici";
import { oturumKullanicisi } from "@/lib/auth/oturum";
import { ortam, uygulamaYolu } from "@/lib/ortam";
import { aktifTema } from "@/lib/tema";

/**
 * Açılış ekranı — sistemin kapısı.
 *
 * TEK GİRİŞ YOLU: öğrenci/öğretmen girişi (EBA ya da kayıt kipinde T.C.
 * kimlik no + şifre). "E-Devlet ile Giriş" düğmesi 24 Ekim 2026'da kalktı.
 *
 * EBA SSO erişimi henüz sağlanmadığı için birinci düğme şimdilik geliştirme
 * senaryolarının bulunduğu /giris ekranına götürür. Erişim geldiğinde burada
 * değişecek tek şey düğmenin hedefidir — ekranın kendisi aynı kalır.
 */

export const dynamic = "force-dynamic";

export default async function AcilisSayfasi() {
  const [kullanici, tema] = await Promise.all([
    oturumKullanicisi(),
    aktifTema(),
  ]);

  // Oturumu açık olan kapıda bekletilmez.
  if (kullanici) {
    /*
     * Oturumu açık kullanıcı kapıda bekletilmez. Hedef PROFİLDİR, panel değil
     * (7 Ağustos 2026 · istek: "tüm kullanıcı grupları için ilk açılınca
     * profil sekmesi ile başlasın"); giriş eylemiyle aynı yere düşmeli, yoksa
     * aynı kişi nereden geldiğine göre farklı ekran görürdü.
     */
    redirect("/panel");
  }

  const mockMu = ortam.AUTH_PROVIDER === "mock";
  // Kayıt kipi (17 Eylül 2026): EBA SSO yok, kişi kendi kaydını açıyor.
  const kayitMi = ortam.AUTH_PROVIDER === "kayit";

  return (
    <div className="vitrin flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <p className="text-[11px] font-semibold tracking-widest text-vitrin-metin-yumusak uppercase">
          T.C. Millî Eğitim Bakanlığı · YEĞİTEK
        </p>
        <TemaSecici aktif={tema} />
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm text-center">
          {/*
            Logo BEYAZ bir kutunun içinde: açılış ekranının zemini kurumsal
            kırmızı ve logonun kendisi de kırmızı — doğrudan konsaydı zeminde
            kaybolurdu.

            next/image KULLANILMIYOR: dosya public dizininde ve boyutu sabit;
            optimizasyon katmanı burada bir şey kazandırmıyor. Yol
            uygulamaYolu()'ndan geçiyor çünkü uygulama alt dizine kurulu
            (/genctek) ve ham src öneki kendiliğinden almaz.
          */}
          <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-kart bg-white p-3 shadow-yuksek">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={uygulamaYolu("/genc.png")}
              alt="GençTek"
              className="h-full w-full object-contain"
            />
          </div>

          <h1 className="mb-2 text-4xl font-extrabold text-vitrin-metin">
            GençTek
          </h1>
          <p className="mb-9 text-vitrin-metin-yumusak">
            Genç Bilişim Ekosistemi
          </p>

          <Link
            href="/giris"
            className="flex w-full items-center justify-center gap-2 rounded-kutu bg-vitrin-secili-zemin py-3.5 font-semibold text-vitrin-secili-metin shadow-yuksek transition hover:opacity-90"
          >
            <LogIn size={16} aria-hidden />
            {kayitMi ? "Öğrenci / Öğretmen Girişi" : "EBA ile Giriş Yap"}
          </Link>

          <p className="mt-4 text-xs text-vitrin-metin-yumusak">
            {kayitMi ? (
              <>
                T.C. kimlik numaranız ve şifrenizle girersiniz. Hesabınız
                yoksa{" "}
                <Link href="/kayit" className="font-semibold underline">
                  kayıt olun
                </Link>
                .
              </>
            ) : (
              "Öğrenci ve öğretmen kimlik bilgileri EBA üzerinden alınır."
            )}
          </p>

          {/*
            "E-DEVLET İLE GİRİŞ" DÜĞMESİ KALKTI (24 Ekim 2026 · istek:
            "edevlet ile girişi de kaldır"). Mezun/paydaş/mentör ekranı
            (/dis-giris) ve başvuru akışı silinmedi; yalnızca açılıştaki kapı
            kalktı. Geri gelirse 7 Ağustos 2026 sürümüne bakın.
          */}

          {mockMu && (
            <div className="mt-10 rounded-kutu border border-vitrin-cizgi bg-white/10 p-4 text-left">
              <p className="text-xs text-vitrin-metin-yumusak">
                <Info size={12} className="mr-1 mb-0.5 inline" aria-hidden />
                EBA SSO erişimi henüz sağlanmadı. Bu düğme sizi geliştirme
                senaryolarının bulunduğu giriş ekranına götürür; yetki ve kapsam
                kuralları orada da gerçek kurallarla çalışır.
              </p>
            </div>
          )}
        </div>
      </main>

      <footer className="mx-auto w-full max-w-5xl px-6 py-6 text-center text-xs text-vitrin-metin-yumusak">
        T.C. Millî Eğitim Bakanlığı · Yenilik ve Eğitim Teknolojileri Genel
        Müdürlüğü
      </footer>
    </div>
  );
}
