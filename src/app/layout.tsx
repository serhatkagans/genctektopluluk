import type { Metadata } from "next";
import { Suspense } from "react";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { CerezBildirimi } from "@/components/CerezBildirimi";
import { CiftGonderimKalkani } from "@/components/CiftGonderimKalkani";
import { GorselKucultucu } from "@/components/GorselKucultucu";
import { aktifTema } from "@/lib/tema";
import "./globals.css";

/*
 * YAZI TİPLERİ (18 Ağustos 2026 · tasarım yenilemesi).
 *
 * İki aile: başlıklarda Plus Jakarta Sans, gövdede Inter. Sistem fontuyla
 * yetinen ekran, içeriği ne kadar iyi olursa olsun bitmemiş bir taslak gibi
 * duruyordu — tasarımı "demode" yapan ilk şey buydu.
 *
 * `latin-ext` alt kümesi ZORUNLU: ş, ğ, İ, ı, ç, ö, ü yalnızca orada. Sadece
 * `latin` ile Türkçe metinlerde harfler başka bir yazı tipinden düşer ve
 * kelimeler alacalı görünür.
 *
 * next/font fontları DERLEME ANINDA indirir ve kendi sunucumuzdan servis eder;
 * çalışma anında Google'a hiçbir istek gitmez. Kamu sistemi bir dış CDN'e bağlı
 * olmamalı — hem erişilebilirlik hem KVKK açısından (CDN isteği kullanıcının
 * IP'sini üçüncü tarafa taşır).
 *
 * Değişken adları globals.css'in beklediği adlardır (--yazi-baslik /
 * --yazi-govde); oradaki `body` ve `h1..h4` kuralları bunları okur.
 */
const govdeYazisi = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--yazi-govde",
  display: "swap",
});

const baslikYazisi = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["600", "700", "800"],
  variable: "--yazi-baslik",
  display: "swap",
});

/*
 * SEKME SİMGESİ (20 Ağustos 2026 · istek: "portalın tarayıcı penceresinde
 * güzel logosu var onu platforma da ekle").
 *
 * Dosya `src/app/icon.png`: Next bu adı gördüğünde <link rel="icon"> etiketini
 * kendisi basar, boyutlandırır ve sürüm damgası ekler — metadata'ya elle
 * `icons` yazmaya gerek yok. Kaynak, tanıtım portalındaki `app/icon.png`'nin
 * aynısı; iki uygulama aynı sekme simgesini taşısın diye kopyalandı.
 *
 * Alt dizin kurulumunda (aiotechs.cloud/genctek) yolu Next kendisi önekler.
 */
export const metadata: Metadata = {
  title: "GençTek Bilgi Sistemi",
  description:
    "GençTek Ekosistemi öğrenci ve danışman öğretmen envanteri, çalışma grupları ve etkinlik başvuru sistemi",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Tema sunucuda okunur; böylece ilk boyamada renk atlaması olmaz.
  const tema = await aktifTema();

  return (
    <html
      lang="tr"
      data-tema={tema}
      className={`${govdeYazisi.variable} ${baslikYazisi.variable}`}
    >
      <body>
        {children}
        {/*
          ÇEREZ BİLDİRİMİ EN DIŞ DÜZENDE (21 Ağustos 2026 · istek: "açılışta
          çerez politikası ile ilgili popup gelecek bir kerelik").

          Panelin içinde değil kök düzende: bildirim uygulamanın AÇILIŞINDA
          çıkmalı ve giriş ekranı da uygulamanın bir parçası. Panele
          konsaydı, girişte çerez zaten yazılmış olurdu ve bildirim çerezi
          gördükten sonra çıkardı.

          `children`den SONRA basılıyor: sayfanın kendi içeriği DOM'da önce
          gelsin — bildirim ekranın altına sabitleniyor ve odak sırasında
          sayfanın önüne geçmemeli.
        */}
        <CerezBildirimi />
        {/* Çift tıklamada ikinci kayıt açılmasın (bkz. bileşen başlığı).
            useSearchParams okuduğu için Suspense içinde. */}
        <Suspense fallback={null}>
          <CiftGonderimKalkani />
        </Suspense>
        {/* Büyük görseller gönderilmeden önce tarayıcıda küçültülür. */}
        <GorselKucultucu />
      </body>
    </html>
  );
}
