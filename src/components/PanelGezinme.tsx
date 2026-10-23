"use client";

import {
  BadgeCheck,
  CalendarDays,
  ClipboardList,
  Handshake,
  LayoutGrid,
  MessagesSquare,
  ShieldCheck,
  ShieldUser,
  Store,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Menüde kullanılabilecek ikonlar.
 *
 * BİLEŞEN DEĞİL AD TAŞINIR: menüyü kuran `app/panel/layout.tsx` bir sunucu
 * bileşeni, burası ise istemci bileşeni. React, sunucudan istemciye prop
 * olarak FONKSİYON geçirilmesine izin vermez ("Functions cannot be passed
 * directly to Client Components") — ikon bileşenini doğrudan geçirmek panelin
 * tamamını 500'e düşürüyordu. Sınır üzerinden dizgi geçip bileşene burada
 * çevirmek, ikon listesini de tek yerde toplu tutar.
 */
const IKONLAR = {
  BadgeCheck,
  CalendarDays,
  ClipboardList,
  Handshake,
  LayoutGrid,
  MessagesSquare,
  ShieldCheck,
  /*
   * Kişisel Verilerim satırı. Yönetim Paneli'nin `ShieldCheck`inden AYRI bir
   * ikon: ikisi de kalkan ama biri BAŞKALARININ verisini yöneten ekran,
   * öbürü kişinin KENDİ verisi. Aynı ikonla basılsalardı menüde iki satır
   * aynı işi yapıyormuş gibi görünürdü.
   */
  ShieldUser,
  Store,
  UserRound,
} as const;

export type IkonAdi = keyof typeof IKONLAR;

export type GezinmeBaglantisi = {
  yol: string;
  etiket: string;
  /**
   * Kenar çubuğundaki başlık. Verilmezse bağlantı "Genel" grubuna düşer;
   * böylece grup bilgisi olmayan eski çağrılar da çalışmaya devam eder.
   */
  grup?: string;
  /** `IKONLAR` anahtarı. Verilmezse satır ikonsuz basılır. */
  ikon?: IkonAdi;
  /**
   * PASİF SATIR (23 Ekim 2026 · istek: "Bağlantılarım komple pasif"). Satır
   * menüde görünür ama bağlantı değildir: tıklanmaz, soluk basılır, üzerine
   * gelince nedeni yazar. Verilen metin bu nedendir.
   */
  pasifNedeni?: string;
};

function aktifMi(yol: string, baglanti: GezinmeBaglantisi) {
  // "/panel" her yolun ön eki olduğu için tam eşleşme ister; diğerleri alt
  // sayfalarında da seçili kalmalı (etkinlik detayındayken Etkinlikler gibi).
  return baglanti.yol === "/panel"
    ? yol === "/panel"
    : yol.startsWith(baglanti.yol);
}

/**
 * Panelin gezinmesi.
 *
 * 18 AĞUSTOS 2026'DA YATAY SEKME ŞERİDİNDEN SOL KENAR ÇUBUĞUNA GEÇTİ (istek:
 * tasarımın yarışma portalı prototipine benzetilmesi).
 *
 * Sebep yalnızca görünüm değil: sekme sayısı role göre 6 ile 10 arasında
 * değişiyor ve koordinatör/merkez rollerinde yatay şerit ikinci satıra
 * taşıyordu — taşan satırda hangi sekmenin seçili olduğu kayboluyor, menü de
 * büyümeye yer bırakmıyordu. Dikey liste hem gruplanabiliyor hem sınırsız
 * uzayabiliyor.
 *
 * MOBİLDE KENAR ÇUBUĞU YOK: 1024 pikselin altında liste, yatay kaydırılan bir
 * rozet şeridine dönüyor. Dar ekranda sabit bir kenar çubuğu içerik alanının
 * yarısını yerdi; açılır çekmece ise JavaScript ve odak tuzağı gerektirirdi —
 * sayfanın geri kalanı sunucuda basılıyor, gezinme için istemci mantığı
 * eklemek bu ekranda karşılığı olmayan bir maliyet.
 */
export function PanelGezinme({
  baglantilar,
}: {
  baglantilar: GezinmeBaglantisi[];
}) {
  const yol = usePathname();

  // Gruplar ilk görüldükleri sırayı korur: menünün sırası layout.tsx'te
  // bilinçli olarak kurulmuş (Profil önce, Yönetim Paneli Panel'in ardında) ve
  // alfabetik sıralamak o kararı bozardı.
  const gruplar: { ad: string; ogeler: GezinmeBaglantisi[] }[] = [];
  for (const baglanti of baglantilar) {
    const ad = baglanti.grup ?? "Genel";
    const mevcut = gruplar.find((grup) => grup.ad === ad);
    if (mevcut) {
      mevcut.ogeler.push(baglanti);
    } else {
      gruplar.push({ ad, ogeler: [baglanti] });
    }
  }

  return (
    <nav aria-label="Panel gezinmesi">
      {/* --- Geniş ekran: gruplu dikey liste --- */}
      <ul className="hidden space-y-0.5 lg:block">
        {gruplar.map((grup) => (
          <li key={grup.ad}>
            {/*
              GRUP BAŞLIKLARI BASILMIYOR (21 Ağustos 2026 · istek: "sol
              menüdeki başlıklar kalksın Genel Çalışma Ekosistem bunlar
              yani").

              Gruplama DURUYOR: bağlantılar aynı sırada. Ekran okuyucu grubun
              adını yine duyuyor (`aria-label`).

              GRUPLAR ARASINDAKİ BOŞLUK DA KALKTI (26 Ağustos 2026 · istek:
              "sol menüde bazı satır boşlukları var, profil ile yönetim paneli
              arasında, etkinlikler ile bağlantılarım arasında ve pano ile
              market arasında, onları kaldır").

              Başlıklar kalkınca boşluk TEK BAŞINA KALMIŞTI ve adı olmayan bir
              ayrımı gösteriyordu: menüye bakan kişi iki satır arasında niye
              boşluk olduğunu bilmiyor, yalnızca listenin düzensiz olduğunu
              görüyordu. Satır aralığı artık her yerde aynı (`space-y-0.5`) —
              grup `li`si duruyor ama görsel bir iz bırakmıyor.

              GRUP YAPISI SİLİNMEDİ: `aria-label` ekran okuyucuya sırayı hâlâ
              anlatıyor ve gruplar ileride yeniden görünür kılınmak istenirse
              (başlık ya da ince çizgi) tek satırlık bir değişiklik yeter.
            */}
            <ul className="space-y-0.5" aria-label={grup.ad}>
              {grup.ogeler.map((baglanti) => {
                const secili = aktifMi(yol, baglanti);
                const Ikon = baglanti.ikon ? IKONLAR[baglanti.ikon] : null;
                if (baglanti.pasifNedeni) {
                  return (
                    <li key={baglanti.yol}>
                      <span
                        aria-disabled="true"
                        title={baglanti.pasifNedeni}
                        className="flex cursor-not-allowed items-center gap-2.5 rounded-kutu px-3 py-2 text-sm font-medium text-metin-yumusak opacity-50"
                      >
                        {Ikon && <Ikon size={16} className="shrink-0" />}
                        {baglanti.etiket}
                      </span>
                    </li>
                  );
                }
                return (
                  <li key={baglanti.yol}>
                    <Link
                      href={baglanti.yol}
                      aria-current={secili ? "page" : undefined}
                      className={`flex items-center gap-2.5 rounded-kutu px-3 py-2 text-sm font-medium transition ${
                        secili
                          ? "bg-ust-bar-secili-zemin text-ust-bar-secili-metin"
                          : "text-metin-yumusak hover:bg-zemin hover:text-metin"
                      }`}
                    >
                      {Ikon && <Ikon size={16} className="shrink-0" />}
                      {baglanti.etiket}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>

      {/*
        --- Dar ekran: yatay kaydırılan şerit ---
        Grup başlıkları burada basılmıyor: dar ekranda başlıklar şeridin
        yarısını yer ve zaten hepsi tek sırada görünüyor.
      */}
      <ul className="flex gap-1.5 overflow-x-auto pb-1 lg:hidden">
        {baglantilar.map((baglanti) => {
          const secili = aktifMi(yol, baglanti);
          const Ikon = baglanti.ikon ? IKONLAR[baglanti.ikon] : null;
          if (baglanti.pasifNedeni) {
            return (
              <li key={baglanti.yol} className="shrink-0">
                <span
                  aria-disabled="true"
                  title={baglanti.pasifNedeni}
                  className="flex cursor-not-allowed items-center gap-1.5 rounded-full bg-kart px-3.5 py-2 text-sm font-medium whitespace-nowrap text-metin-yumusak opacity-50"
                >
                  {Ikon && <Ikon size={15} />}
                  {baglanti.etiket}
                </span>
              </li>
            );
          }
          return (
            <li key={baglanti.yol} className="shrink-0">
              <Link
                href={baglanti.yol}
                aria-current={secili ? "page" : undefined}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium whitespace-nowrap transition ${
                  secili
                    ? "bg-ust-bar-secili-zemin text-ust-bar-secili-metin"
                    : "bg-kart text-metin-yumusak"
                }`}
              >
                {Ikon && <Ikon size={15} />}
                {baglanti.etiket}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
