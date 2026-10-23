import "dotenv/config";
import { readFileSync } from "node:fs";
import type {
  EtkinlikKategorisi,
  Kapsam,
  KatilimBicimi,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { ILLER } from "../prisma/veri/iller";

/**
 * GençTek Takvim'den etkinlik aktarımı (23 Ekim 2026 · istek: "Gençtek
 * takvimden önümüzdeki 1 ayı etkinlik olarak ekle aman başvuruları pasif
 * olsun onların … tanışma etkinliklerini alma önemli olanları al").
 *
 * GİRDİ: takvim sunucusundan alınmış JSON (events satırları). Sorgu
 * yalnızca okur; bkz. talimattaki takvim-sorgu.sql.
 *
 * Kullanım:
 *   npx tsx scripts/takvimden-etkinlik-aktar.ts <dosya.json>          listeyi gösterir, YAZMAZ
 *   npx tsx scripts/takvimden-etkinlik-aktar.ts <dosya.json> --yaz    aktarır
 *
 * KURALLAR:
 *   · "tanışma" geçen etkinlikler (ad, tür ya da açıklama) alınmaz.
 *   · Adında "toplantı" geçenler (öğretmen/koordinatör toplantıları) alınmaz.
 *   · İptal edilen ve ertelenen etkinlikler alınmaz.
 *   · BAŞVURU KAPALI: başvuru başlangıcı ve bitişi aktarım anından önceye
 *     yazılır; sistem etkinliği "başvuru kapandı" olarak gösterir.
 *   · Aynı ad ve başlangıç tarihli etkinlik zaten varsa tekrar eklenmez;
 *     betik ikinci kez çalıştırılabilir.
 *   · Uluslararası etkinlik ULUSAL kapsamla eklenir: veritabanındaki kapsam
 *     kısıtı (ck_faaliyet_kapsam) uluslararası kapsamı henüz kabul etmiyor.
 *   · Takvimdeki türlerden biri GençTek temel etkinlik programıyla eşleşirse
 *     TEMEL_ETKINLIK, eşleşmezse IL_ETKINLIGI olarak eklenir.
 */

interface TakvimEtkinligi {
  id: number;
  title: string;
  start: string;
  end: string;
  all_day: number;
  location: string;
  url: string;
  description: string;
  status: string;
  scope: string;
  cities: string;
  subtypes: string;
  online: number;
  students: number;
  purpose: string;
  work_groups: string;
}

const dosya = process.argv[2];
const yaz = process.argv.includes("--yaz");
if (!dosya) {
  console.error("Kullanım: npx tsx scripts/takvimden-etkinlik-aktar.ts <dosya.json> [--yaz]");
  process.exit(1);
}

/** "|Ankara|İzmir|" → ["Ankara", "İzmir"] */
const liste = (deger: string) =>
  (deger ?? "").split("|").map((s) => s.trim()).filter(Boolean);

/** Takvim yerel saati (Türkiye, UTC+3) yazıyor: "2026-11-02T10:00". */
function tarihCoz(deger: string): Date {
  const temiz = deger.length === 10 ? `${deger}T00:00` : deger;
  return new Date(`${temiz}:00+03:00`);
}

/** Eşleştirme için ad sadeleştirme: boşluk, eğik çizgi ve çoğul eki farkı. */
const sade = (ad: string) =>
  ad.toLocaleLowerCase("tr-TR").replace(/\s*\/\s*/g, "/").replace(/\s+/g, " ").trim();

function tanismaMi(e: TakvimEtkinligi): boolean {
  return /tanış/i.test(`${e.title} ${e.subtypes} ${e.description}`);
}

async function main() {
  const etkinlikler = JSON.parse(
    readFileSync(dosya, "utf8").replace(/^﻿/, ""),
  ) as TakvimEtkinligi[];

  const [programlar, gruplar, yonetici] = await Promise.all([
    prisma.temelEtkinlikProgrami.findMany({
      where: { aktif: true },
      select: { id: true, ad: true, grup: true },
    }),
    prisma.calismaGrubu.findMany({ select: { id: true, ad: true } }),
    prisma.kullanici.findFirst({
      where: {
        aktif: true,
        roller: { some: { rolKodu: "PROJE_YONETICISI", bitisTarihi: null } },
      },
      orderBy: { id: "asc" },
      select: { id: true, ad: true, soyad: true },
    }),
  ]);
  if (!yonetici) throw new Error("Etkin bir proje yöneticisi bulunamadı.");

  const programBul = (tur: string) => {
    const aranan = sade(tur);
    return programlar.find((p) => {
      const ad = sade(p.ad);
      return ad === aranan || aranan.startsWith(ad) || ad.startsWith(aranan);
    });
  };
  const ilKoduBul = (ad: string) =>
    ILLER.find((il) => il.ad.toLocaleLowerCase("tr-TR") === ad.toLocaleLowerCase("tr-TR"))
      ?.ilKodu ?? null;

  const simdi = new Date();
  const basvuruKapandi = new Date(simdi.getTime() - 60_000);

  const alinanlar: string[] = [];
  const atlananlar: string[] = [];
  let eklenen = 0;

  for (const e of etkinlikler) {
    const etiket = `#${e.id} ${e.start.slice(0, 10)} · ${e.title}`;

    if (tanismaMi(e)) {
      atlananlar.push(`${etiket}  (tanışma etkinliği)`);
      continue;
    }
    // Öğretmen/koordinatör toplantıları öğrenci etkinliği değil (23 Ekim 2026 ·
    // seçim: "toplantıları alma").
    if (/toplant[ıi]/i.test(e.title)) {
      atlananlar.push(`${etiket}  (toplantı)`);
      continue;
    }
    if (e.status === "İptal edildi" || e.status === "Ertelendi") {
      atlananlar.push(`${etiket}  (${e.status})`);
      continue;
    }

    const tarih = tarihCoz(e.start);
    const bitis = e.end ? tarihCoz(e.end) : null;

    // Kapsam ve il.
    const duzenleyenIller = liste(e.cities).filter((c) => c !== "YEĞİTEK");
    let kapsam: Kapsam = "ULUSAL";
    let ilKodu: string | null = null;
    if (e.scope === "Bölgesel / Yerel" && duzenleyenIller.length > 0) {
      ilKodu = ilKoduBul(duzenleyenIller[0]);
      if (ilKodu) kapsam = "IL";
    }

    // Kategori ve program.
    const program = liste(e.subtypes).map(programBul).find(Boolean) ?? null;
    const etkinlikKategorisi: EtkinlikKategorisi = program
      ? (program.grup as EtkinlikKategorisi)
      : "IL_ETKINLIGI";

    const katilimBicimi: KatilimBicimi = e.online ? "ONLINE" : "YUZ_YUZE";
    const calismaGrubuIdleri = liste(e.work_groups)
      .map((ad) => gruplar.find((g) => sade(g.ad) === sade(ad))?.id)
      .filter((id): id is number => id !== undefined);

    const aciklama = [
      e.description?.trim(),
      e.purpose?.trim() ? `Amaç: ${e.purpose.trim()}` : null,
      e.location?.trim() ? `Yer: ${e.location.trim()}` : null,
      e.url?.trim() ? `Bağlantı: ${e.url.trim()}` : null,
      "GençTek Takvim'den aktarıldı; bu etkinliğe sistem üzerinden başvuru alınmıyor.",
    ]
      .filter(Boolean)
      .join("\n\n");

    const ozet = `${etiket}  → ${kapsam}${ilKodu ? ` (${ilKodu})` : ""} · ${program ? program.ad : "İl etkinliği"}`;

    const mevcut = await prisma.faaliyet.findFirst({
      where: { ad: e.title.slice(0, 250), tarih },
      select: { id: true },
    });
    if (mevcut) {
      atlananlar.push(`${etiket}  (zaten var: faaliyet #${mevcut.id})`);
      continue;
    }

    alinanlar.push(ozet);
    if (!yaz) continue;

    await prisma.faaliyet.create({
      data: {
        ad: e.title.slice(0, 250),
        aciklama,
        tarih,
        bitisTarihi: bitis && bitis >= tarih ? bitis : null,
        katilimBicimi,
        kapsam,
        etkinlikKategorisi,
        temelEtkinlikProgramiId: program?.id ?? null,
        kurumKodu: null,
        ilKodu,
        kontenjan: e.students > 0 ? e.students : 100,
        duzenleyenKullaniciId: yonetici.id,
        duzenleyenBirim:
          kapsam === "IL" && duzenleyenIller[0]
            ? `${duzenleyenIller[0]} İl Koordinatörlüğü`
            : "YEĞİTEK",
        onayDurumu: "ONAY_GEREKMEZ",
        basvuruBaslangic: basvuruKapandi,
        basvuruBitis: basvuruKapandi,
        calismaGruplari: {
          create: calismaGrubuIdleri.map((calismaGrubuId) => ({ calismaGrubuId })),
        },
      },
    });
    eklenen += 1;
  }

  console.log(`\nTakvimden gelen: ${etkinlikler.length}`);
  console.log(`\nALINACAK (${alinanlar.length}):`);
  for (const satir of alinanlar) console.log(`  ${satir}`);
  console.log(`\nALINMAYAN (${atlananlar.length}):`);
  for (const satir of atlananlar) console.log(`  ${satir}`);
  console.log(
    yaz
      ? `\n${eklenen} etkinlik eklendi (düzenleyen: ${yonetici.ad} ${yonetici.soyad}).`
      : "\nYazılmadı. Aktarmak için komutu --yaz ile çalıştırın.",
  );
}

main()
  .catch((hata) => {
    console.error(hata);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
