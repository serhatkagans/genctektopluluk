import "dotenv/config";
import { readFileSync } from "node:fs";
import { prisma } from "@/lib/db";
import { okulAdiAnahtari } from "@/lib/okul/eslestirme";
import {
  adBozukMu,
  altKume,
  ayirtEdici,
  baslikHarfi,
  mebbisTurunuCevir,
} from "@/lib/okul/mebbis";
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

function trKucuk(s: string): string {
  return s.toLocaleLowerCase("tr-TR").trim();
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
    const tur = mebbisTurunuCevir(mebbisTuru, ad);
    if (!tur) continue;
    sonuc.push({ ilKodu: ilKodu.padStart(2, "0"), ilce, ad: baslikHarfi(ad), tur });
  }
  return sonuc;
}

async function main() {
  const yol = process.argv[2];
  const yaz = process.argv.includes("--yaz");
  /*
   * BENZER EŞLEŞME VARSAYILAN OLARAK UYGULANMAZ (16 Kasım 2026 · istek:
   * "çakışan ismi sistemde hatalı olan okullar olabilir, veri kaybı
   * olmamalı"). Kelime benzerliğiyle bulunan okul YANLIŞ okul olabilir;
   * yeniden adlandırılırsa o okuldaki kişiler başka bir okulun adı altında
   * kalırdı. Varsayılan: benzer olan ne yeniden adlandırılır ne de yanına
   * yeni okul eklenir (çift kayıt doğmasın) — gözden geçirme listesine
   * yazılır. Siirt gibi tek tek bakılmış bir ilde --benzer-uygula verilir.
   */
  const benzerUygula = process.argv.includes("--benzer-uygula");
  if (!yol) throw new Error("CSV yolu verin.");

  const yonetici = await prisma.kullaniciRol.findFirst({
    where: { rolKodu: "PROJE_YONETICISI", bitisTarihi: null },
    select: { kullaniciId: true },
  });
  if (!yonetici) throw new Error("Aktif proje yöneticisi yok (erişim kaydı için).");

  const satirlar = csvOku(yol);
  const iller = [...new Set(satirlar.map((s) => s.ilKodu))];
  const sayac = {
    var: 0,
    guncellendi: 0,
    benzer: 0,
    benzerBekleyen: 0,
    yeni: 0,
    belirsiz: 0,
    ilcesiz: 0,
  };

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
      if (e.kurumKodu !== null && e.yol !== "birebir" && !benzerUygula) {
        const mevcut = okullar.find((o) => o.kurumKodu === e.kurumKodu)!;
        sayac.benzerBekleyen++;
        console.log(
          `  ≈ GÖZDEN GEÇİR: sistemde "${mevcut.ad}" [${mevcut.okulTuru}] ↔ MEBBİS "${e.satir.ad}" [${e.satir.tur}] (dokunulmadı)`,
        );
        continue;
      }
      if (e.kurumKodu !== null) {
        const mevcut = okullar.find((o) => o.kurumKodu === e.kurumKodu)!;
        // Birebir eşleşmede düzgün yazılmış ad korunur (bkz. adBozukMu).
        const yeniAd =
          e.yol === "birebir" && !adBozukMu(mevcut.ad) ? mevcut.ad : e.satir.ad;
        const degisecek = mevcut.ad !== yeniAd || mevcut.okulTuru !== e.satir.tur;
        if (e.yol === "birebir") sayac.var++;
        else sayac.benzer++;
        if (degisecek) {
          sayac.guncellendi++;
          console.log(
            `  ~ ${mevcut.ad} [${mevcut.okulTuru}] → ${yeniAd} [${e.satir.tur}] (${e.yol})`,
          );
          if (yaz) {
            await prisma.kurum.update({
              where: { kurumKodu: mevcut.kurumKodu },
              data: { ad: yeniAd, okulTuru: e.satir.tur },
            });
            await erisimLogla({
              kullaniciId: yonetici.kullaniciId,
              islem: "DEGISIKLIK",
              hedefTip: "SISTEM_AYARI",
              hedefId: mevcut.kurumKodu,
              detay: `Okul MEBBİS listesine göre düzeltildi: ${mevcut.ad} [${mevcut.okulTuru}] → ${yeniAd} [${e.satir.tur}]`,
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
    `\nÖzet: birebir ${sayac.var}, benzer uygulanan ${sayac.benzer}, benzer gözden geçirilecek ${sayac.benzerBekleyen}, ad/tür güncellenecek ${sayac.guncellendi}, yeni ${sayac.yeni}, belirsiz ${sayac.belirsiz}, ilçesi bulunamayan ${sayac.ilcesiz}.`,
  );
  console.log(yaz ? "Uygulandı." : "Yalnızca rapor; uygulamak için --yaz.");
}

main()
  .catch((hata) => {
    console.error(hata);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
