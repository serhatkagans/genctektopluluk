import { GraduationCap } from "lucide-react";
import { notFound } from "next/navigation";
import { MentorlukDuzenleme } from "@/components/ProfilDuzenleme";
import {
  BilgiKutusu,
  Kart,
  KartBasligi,
  KirintiYolu,
  SayfaBasligi,
} from "@/components/ui";
import { oturumKullanicisiZorunlu } from "@/lib/auth/oturum";
import { prisma } from "@/lib/db";
import { mentorluguGetir } from "@/lib/mentor/veri";
import { mentorlukBasvurabilirMi, ogrenciMi } from "@/lib/yetki/izinler";
import {
  mentorlukBasvurEylemi,
  mentorluguBirakEylemi,
} from "../../mentorluk/eylemler";

export const dynamic = "force-dynamic";

/**
 * MENTÖR OLMAK İÇİN BAŞVURU EKRANI (14 Ağustos 2026).
 *
 * Bölüm 13 Ağustos'ta Panel'den panoya taşınmıştı; 14 Ağustos'ta pano kart
 * düzenine geçince kendi sayfasına ayrıldı (istek: "panoda kart olsun,
 * kartlarda … bide mentör olmak için başvur"). Yeri hâlâ panonun yanı, çünkü
 * mentörlüğün karşılığı orada: mentör talebi ve havuz aynı iki komşu ekranda.
 *
 * ÇAPA `mentorlugum` KALDI: eylemlerin dönüş adresi, panelden gelen kart ve
 * e-postalardaki bağlantılar bu çapayı taşıyor (bkz. mentorluk/eylemler.ts).
 *
 * ROLÜ OLAN HERKES BAŞVURABİLİR — 14 Ağustos 2026'dan beri ÖĞRENCİ DE
 * (istekler: "öğrenci de mentör olarak başvurabilsin", "ama onay olsun onun
 * için"). Kapı onaydır: başvuru bekleyen olarak açılır, kararı yalnızca proje
 * yöneticisi verir. Gerekçesi `mentorlukBasvurabilirMi` başlığında.
 */

const DURUM_MESAJLARI: Record<string, string> = {
  "mentorluk-basvuruldu": "Mentörlük başvurunuz alındı ve onaya gönderildi.",
  "mentorluk-birakildi": "Mentörlüğü bıraktınız.",
};

export default async function MentorBasvuruSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ durum?: string; hata?: string }>;
}) {
  const kullanici = await oturumKullanicisiZorunlu();
  if (!mentorlukBasvurabilirMi(kullanici)) notFound();

  const { durum, hata } = await searchParams;

  const [gruplar, mentorlugum, mentorlukGruplarim] = await Promise.all([
    prisma.calismaGrubu.findMany({
      where: { aktif: true },
      orderBy: { siraNo: "asc" },
      select: { id: true, ad: true },
    }),
    mentorluguGetir(kullanici.id),
    prisma.mentorlukCalismaGrubu.findMany({
      where: { mentorlukKullaniciId: kullanici.id },
      select: { calismaGrubuId: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      {/*
        KIRINTI YOLU (29 Ağustos 2026 · istek: "pano da da aynı sorun var").

        Panodan açılan ekranlarda üstte ya "← Profil" (SayfaBasligi'nın
        varsayılanı) ya da elle yazılmış "Panoya dön" bağlantısı duruyordu:
        ikisi de nereye dönüleceğini söylüyor, nerede olunduğunu söylemiyordu.
        Şerit ikisini birden basıyor ve panelin her yerinde aynı biçimde
        (bkz. components/ui.tsx · KirintiYolu). SayfaBasligi'nın geri
        bağlantısı bu yüzden `null`.
      */}
      <KirintiYolu
        basamaklar={[
          { etiket: "Pano", yol: "/panel/talepler" },
          { etiket: "Mentör olmak için başvur" },
        ]}
      />

      <SayfaBasligi
        baslik="Mentör olmak için başvur"
        /*
          AÇIKLAMA SATIRI KALKTI (22 Ağustos 2026 · istek). Başlık ne
          yapıldığını zaten söylüyordu.
        */
        geri={null}
      />

      {durum && DURUM_MESAJLARI[durum] && (
        <BilgiKutusu cesit="olumlu">{DURUM_MESAJLARI[durum]}</BilgiKutusu>
      )}
      {hata && <BilgiKutusu cesit="hata">{hata}</BilgiKutusu>}

      <Kart>
        <span id="mentorlugum" className="block scroll-mt-24" />
        <KartBasligi
          baslik="Mentörlük başvurusu"
          aciklama={
            /* Öğrencinin başvurusuna ilinin koordinatörü ve danışmanı da
               karar verebiliyor (bkz. ogrenciMentorluguneKararVerebilirMi). */
            ogrenciMi(kullanici)
              ? "Başvurunuz il koordinatörünüzün, danışman öğretmeninizin ya da proje yöneticisinin onayından geçer; onaylanınca panodaki mentör havuzunda görünürsünüz."
              : "Başvurunuz proje yöneticisinin onayından geçer; onaylanınca panodaki mentör havuzunda görünürsünüz."
          }
          Ikon={GraduationCap}
        />
        <MentorlukDuzenleme
          mevcut={
            mentorlugum
              ? {
                  durum: mentorlugum.durum,
                  konular: mentorlugum.konular,
                  retGerekcesi: mentorlugum.retGerekcesi,
                  seciliGrupIdleri: mentorlukGruplarim.map(
                    (satir) => satir.calismaGrubuId,
                  ),
                }
              : null
          }
          gruplar={gruplar}
          basvurEylemi={mentorlukBasvurEylemi}
          birakEylemi={mentorluguBirakEylemi}
        />
      </Kart>
    </div>
  );
}
