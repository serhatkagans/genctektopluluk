"use client";

import { useEffect, useState } from "react";
import {
  hataKimligiUret,
  istemciHatasiBildir,
} from "@/lib/istemci-hata-bildir";
import { surumHatasiMi, surumIcinYenile } from "@/lib/surum-yenileme";
import "./globals.css";

/**
 * KÖK DÜZEN ÇÖKTÜĞÜNDE görünen ekran (21 Ağustos 2026 · istemci hata
 * bildirimi).
 *
 * `app/error.tsx` yalnızca KENDİ ALTINDAKİ sayfaları koruyor; kök düzenin
 * (layout.tsx) kendisi ya da düzenin çağırdığı bir şey patlarsa o sınır hiç
 * devreye girmiyor ve Next kendi çıplak "Application error" sayfasını basıyor.
 * O sayfa Türkçe değil, hiçbir yere bildirim yapmıyor ve kullanıcıya
 * verilebilecek bir numara üretmiyor — yani hata kayıtlarında da izi olmuyor.
 *
 * Bu dosya o boşluğu kapatıyor. `<html>` ve `<body>` BURADA yazılıyor, çünkü
 * bileşen kök düzenin YERİNE geçer; düzenin fontları ve tema değişkenleri bu
 * noktada yüklenmemiş olabilir, o yüzden ekran yalın tutuldu ve renkler
 * globals.css değişkenlerine bağlanmadı — değişkenler gelmezse metin
 * okunamazdı.
 *
 * Kullanıcıya "Yeniden dene" düğmesi verilmiyor: kök düzen çökmüşse aynı ağacı
 * yeniden kurmak çoğu durumda aynı hatayı verir. Sayfayı yenilemek, tarayıcının
 * kendi düğmesiyle zaten mümkün.
 */
export default function KokHataEkrani({
  error,
}: {
  error: Error & { digest?: string };
}) {
  // Kimlik ilk render'da bir kez; gerekçesi error.tsx'te.
  const [kimlik] = useState(() => hataKimligiUret(error));

  useEffect(() => {
    // Güncelleme sonrası eski sürüm hatası: sayfa bir kez kendiliğinden
    // yenilenir, bildirim yapılmaz (bkz. lib/surum-yenileme.ts).
    if (surumHatasiMi(error) && surumIcinYenile()) return;
    console.error("Kök düzende işlenmeyen hata:", error);
    istemciHatasiBildir(error, kimlik);
  }, [error, kimlik]);

  return (
    <html lang="tr">
      <body
        style={{
          margin: 0,
          padding: "3rem 1.5rem",
          fontFamily: "system-ui, sans-serif",
          color: "#1f2937",
          background: "#ffffff",
        }}
      >
        <main style={{ maxWidth: "36rem", marginInline: "auto" }}>
          <p style={{ fontSize: "0.875rem", color: "#6b7280" }}>
            GençTek Bilgi Sistemi
          </p>
          <h1 style={{ fontSize: "1.25rem", marginTop: "1rem" }}>
            Beklenmeyen bir hata oluştu
          </h1>
          <p style={{ marginTop: "0.75rem", lineHeight: 1.6 }}>
            Sayfa açılamadı. Tarayıcınızdan sayfayı yenilemeyi deneyebilir,
            sorun sürerse okul idareniz aracılığıyla destek isteyebilirsiniz.
          </p>
          {kimlik && (
            <p style={{ marginTop: "0.75rem" }}>
              Hata kimliği: <code>{kimlik}</code>
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
