import "dotenv/config";
import { readFileSync } from "node:fs";
import { prisma } from "@/lib/db";
import { okulAdiAnahtari } from "@/lib/okul/eslestirme";
import { okulEkle } from "@/lib/okul/eslestirme-islem";
import { erisimLogla } from "@/lib/yetki/log";

/**
 * MEBBİS KURUM LİSTESİNDEN OKUL YÜKLEME (16 Kasım 2026 · Siirt koordinatörü:
 * "Okullar listesi yüklenebilir mi? Öğrenci seçer okulunu kayıt sırasında";
 * istek: "sonra tüm liseleri sisteme çekelim, tüm iller için").
 *
 * Girdi: noktalı virgülle ayrılmış CSV, başlık satırı
 *   il_kodu;ilce;okul_adi;mebbis_turu
 * (mebbis.meb.gov.tr/kurumlistesi.aspx · Resmi Kurumlar, lise düzeyi).
 *
 * Kullanım:
 *   npx tsx scripts/okul-listesi-yukle.ts liste.csv          yalnızca rapor
 *   npx tsx scripts/okul-listesi-yukle.ts liste.csv --yaz    uygular
 *
 * NE YAPAR, ilçe ilçe:
 *   1. Aynı ilçede adı aynı (kısaltmalar açılmış) okul varsa → VAR. Resmî ad
 *      ve tür ona yazılır (koordinatörlerin elle yazdığı adlar düzelir).
 *   2. Yoksa ayırt edici kelimelerle eşleşen TEK okul varsa → aynı okul sayılır
 *      ve resmî adla güncellenir. Ör. "Abdulhakim Ayten AİHL" ↔ "Şehit
 *      Abdulhakim Ayten Anadolu İmam Hatip Lisesi". Aday birden çoksa tür
 *      eşitliğiyle seçilir; yine de birden çoksa DOKUNULMAZ, rapora yazılır.
 *   3. Hiçbiri değilse yeni okul eklenir (geçici kurum koduyla, `okulEkle`).
 *
 * Mevcut hiçbir okul SİLİNMEZ ve kimse okulundan AYRILMAZ; listede olmayan
 * okullar (özel okullar, YEĞİTEK gibi) olduğu gibi kalır.
 */

const TUR_ESLEME: Record<string, string> = {
  "Anadolu Meslek Programı": "Mesleki ve Teknik Anadolu Lisesi",
  "Mesleki ve Teknik Anadolu Lisesi": "Mesleki ve Teknik Anadolu Lisesi",
  "BİLSEM (Üstün veya Özel Yetenekliler)": "Bilim ve Sanat Merkezi",
  BİLSEM: "Bilim ve Sanat Merkezi",
  "Mesleki Eğitim Merkezi": "Mesleki ve Teknik Eğitim Merkezi",
  "Özel Eğitim Meslek Okulu (Zihinsel Engelliler)": "Özel Eğitim Meslek Lisesi",
  "Özel Eğitim Meslek Okulu": "Özel Eğitim Meslek Lisesi",
};
const BIZIM_TURLER = new Set([
  "Anadolu Lisesi",
  "Fen Lisesi",
  "Sosyal Bilimler Lisesi",
  "Anadolu İmam Hatip Lisesi",
  "İmam Hatip Lisesi",
  "Mesleki ve Teknik Anadolu Lisesi",
  "Çok Programlı Anadolu Lisesi",
  "Mesleki ve Teknik Eğitim Merkezi",
  "Özel Eğitim Meslek Lisesi",
  "Güzel Sanatlar Lisesi",
  "Spor Lisesi",
  "Bilim ve Sanat Merkezi",
]);

/** Eşleştirmede ayırt edici sayılmayan kelimeler (anahtar biçiminde). */
const GENEL_KELIMELER = new Set(
  [
    "anadolu", "lisesi", "mesleki", "meslek", "ve", "teknik", "imam", "hatip",
    "fen", "kiz", "erkek", "cok", "programli", "sosyal", "bilimler", "guzel",
    "sanatlar", "spor", "bilim", "sanat", "merkezi", "egitim", "ozel", "sehit",
    "merkez", "okulu", "lise", "il", "ilce", "turizm", "ticaret", "saglik",
  ],
);

function baslikHarfi(ad: string): string {
  return ad
    .toLocaleLowerCase("tr-TR")
    .split(/\s+/)
    .filter(Boolean)
    .map((k, i) =>
      i > 0 && k === "ve"
        ? k
        : k.charAt(0).toLocaleUpperCase("tr-TR") + k.slice(1),
    )
    .join(" ")
    .replace(/Meslekî/g, "Mesleki");
}

function trKucuk(s: string): string {
  return s.toLocaleLowerCase("tr-TR").trim();
}

function ayirtEdici(ad: string, yerAdlari: Set<string>): Set<string> {
  return new Set(
    okulAdiAnahtari(ad)
      .split(" ")
      .filter((k) => k && !GENEL_KELIMELER.has(k) && !yerAdlari.has(k)),
  );
}

function altKume(a: Set<string>, b: Set<string>): boolean {
  if (a.size === 0) return false;
  for (const k of a) if (!b.has(k)) return false;
  return true;
}

interface Satir {
  ilKodu: string;
  ilce: string;
  ad: string;
  tur: string;
}

function csvOku(yol: string): Satir[] {
  const satirlar = readFileSync(yol, "utf-8").replace(/^﻿/, "").split(/\r?\n/);
  const sonuc: Satir[] = [];
  for (const satir of satirlar.slice(1)) {
    if (!satir.trim()) continue;
    const [ilKodu, ilce, ad, mebbisTuru] = satir.split(";").map((s) => s.trim());
    const tur = TUR_ESLEME[mebbisTuru] ?? mebbisTuru;
    if (!BIZIM_TURLER.has(tur)) continue;
    sonuc.push({ ilKodu: ilKodu.padStart(2, "0"), ilce, ad: baslikHarfi(ad), tur });
  }
  return sonuc;
}

async function main() {
  const yol = process.argv[2];
  const yaz = process.argv.includes("--yaz");
  if (!yol) throw new Error("CSV yolu verin.");

  const yonetici = await prisma.kullaniciRol.findFirst({
    where: { rolKodu: "PROJE_YONETICISI", bitisTarihi: null },
    select: { kullaniciId: true },
  });
  if (!yonetici) throw new Error("Aktif proje yöneticisi yok (erişim kaydı için).");

  const satirlar = csvOku(yol);
  const iller = [...new Set(satirlar.map((s) => s.ilKodu))];
  const sayac = { var: 0, guncellendi: 0, benzer: 0, yeni: 0, belirsiz: 0, ilcesiz: 0 };

  for (const ilKodu of iller) {
    const il = await prisma.il.findUnique({ where: { ilKodu }, select: { ad: true } });
    const ilceler = await prisma.ilce.findMany({
      where: { ilKodu },
      select: { ilceKodu: true, ad: true },
    });
    const yerAdlari = new Set(
      [il?.ad ?? "", ...ilceler.map((i) => i.ad)].flatMap((a) =>
        okulAdiAnahtari(a).split(" "),
      ),
    );
    const okullar = await prisma.kurum.findMany({
      where: { ilKodu, aktif: true },
      select: { kurumKodu: true, ad: true, ilceKodu: true, okulTuru: true },
    });
    const sahiplenilen = new Set<number>();
    const ilinSatirlari = satirlar.filter((s) => s.ilKodu === ilKodu);
    console.log(`\n=== ${il?.ad ?? ilKodu} (${ilinSatirlari.length} lise) ===`);

    type Eslesme = { satir: Satir; ilceKodu: string; kurumKodu: number | null; yol: string };
    const eslesmeler: Eslesme[] = [];

    // Geçiş 1: ilçe ve birebir ad.
    for (const satir of ilinSatirlari) {
      const ilce =
        ilceler.find((i) => trKucuk(i.ad) === trKucuk(satir.ilce)) ??
        (trKucuk(satir.ilce) === "merkez"
          ? ilceler.find((i) => trKucuk(i.ad) === trKucuk(`${il?.ad} merkez`))
          : undefined);
      if (!ilce) {
        sayac.ilcesiz++;
        console.log(`  ! İLÇE BULUNAMADI: ${satir.ilce} · ${satir.ad}`);
        continue;
      }
      const anahtar = okulAdiAnahtari(satir.ad);
      const ayni = okullar.find(
        (o) =>
          o.ilceKodu === ilce.ilceKodu &&
          !sahiplenilen.has(o.kurumKodu) &&
          okulAdiAnahtari(o.ad) === anahtar,
      );
      if (ayni) sahiplenilen.add(ayni.kurumKodu);
      eslesmeler.push({
        satir,
        ilceKodu: ilce.ilceKodu,
        kurumKodu: ayni?.kurumKodu ?? null,
        yol: ayni ? "birebir" : "",
      });
    }

    // Geçiş 2: ayırt edici kelimeler.
    for (const e of eslesmeler) {
      if (e.kurumKodu !== null) continue;
      const resmi = ayirtEdici(e.satir.ad, yerAdlari);
      let adaylar = okullar.filter(
        (o) =>
          o.ilceKodu === e.ilceKodu &&
          !sahiplenilen.has(o.kurumKodu) &&
          altKume(ayirtEdici(o.ad, yerAdlari), resmi),
      );
      if (adaylar.length > 1) {
        const ayniTur = adaylar.filter((o) => o.okulTuru === e.satir.tur);
        if (ayniTur.length >= 1) adaylar = ayniTur;
      }
      if (adaylar.length === 1) {
        e.kurumKodu = adaylar[0].kurumKodu;
        e.yol = `benzer: "${adaylar[0].ad}"`;
        sahiplenilen.add(adaylar[0].kurumKodu);
      } else if (adaylar.length > 1) {
        e.yol = `BELİRSİZ: ${adaylar.map((a) => `"${a.ad}"`).join(", ")}`;
      }
    }

    for (const e of eslesmeler) {
      if (e.yol.startsWith("BELİRSİZ")) {
        sayac.belirsiz++;
        console.log(`  ? ${e.satir.ad} → ${e.yol} (dokunulmadı)`);
        continue;
      }
      if (e.kurumKodu !== null) {
        const mevcut = okullar.find((o) => o.kurumKodu === e.kurumKodu)!;
        const degisecek = mevcut.ad !== e.satir.ad || mevcut.okulTuru !== e.satir.tur;
        if (e.yol === "birebir") sayac.var++;
        else sayac.benzer++;
        if (degisecek) {
          sayac.guncellendi++;
          console.log(
            `  ~ ${mevcut.ad} [${mevcut.okulTuru}] → ${e.satir.ad} [${e.satir.tur}] (${e.yol})`,
          );
          if (yaz) {
            await prisma.kurum.update({
              where: { kurumKodu: mevcut.kurumKodu },
              data: { ad: e.satir.ad, okulTuru: e.satir.tur },
            });
            await erisimLogla({
              kullaniciId: yonetici.kullaniciId,
              islem: "DEGISIKLIK",
              hedefTip: "SISTEM_AYARI",
              hedefId: mevcut.kurumKodu,
              detay: `Okul MEBBİS listesine göre düzeltildi: ${mevcut.ad} → ${e.satir.ad} (${e.satir.tur})`,
            });
          }
        }
        continue;
      }
      sayac.yeni++;
      console.log(`  + ${e.satir.ad} [${e.satir.tur}]`);
      if (yaz) {
        const sonuc = await okulEkle({
          ad: e.satir.ad,
          ilKodu,
          ilceKodu: e.ilceKodu,
          okulTuru: e.satir.tur,
          ekleyenId: yonetici.kullaniciId,
        });
        if (!sonuc.olurMu) console.log(`    !! eklenemedi: ${sonuc.neden}`);
      }
    }

    const dokunulmayan = okullar.filter((o) => !sahiplenilen.has(o.kurumKodu));
    if (dokunulmayan.length > 0) {
      console.log(
        `  (listede karşılığı olmayan, olduğu gibi kalan: ${dokunulmayan.map((o) => o.ad).join(" · ")})`,
      );
    }
  }

  console.log(
    `\nÖzet: birebir ${sayac.var}, benzer ${sayac.benzer} (güncellenecek ${sayac.guncellendi}), yeni ${sayac.yeni}, belirsiz ${sayac.belirsiz}, ilçesi bulunamayan ${sayac.ilcesiz}.`,
  );
  console.log(yaz ? "Uygulandı." : "Yalnızca rapor; uygulamak için --yaz.");
}

main()
  .catch((hata) => {
    console.error(hata);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
