import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import { prisma } from "@/lib/db";
import { geciciKurumKoduMu } from "@/lib/okul/eslestirme";
import {
  ayirtEdici,
  ayniOkulMu,
  baslikHarfi,
  katiAdAnahtari,
  mebbisTurunuCevir,
  yerAdlariKumesi,
} from "@/lib/okul/mebbis";
import { erisimLogla } from "@/lib/yetki/log";

/**
 * ÇİFT OKULLARI GÜVENLE BİRLEŞTİRME — GERİ ALINABİLİR (16 Kasım 2026).
 *
 * İstekler: "doğruları ile birleştir ama aynı tür ve isimse; yanlış
 * birleştirmenden endişe ediyorum"; "yedek olsun, bu okul birleştirmeyi geri
 * alabilelim sonra".
 *
 * Kullanım:
 *   npx tsx scripts/okul-cift-birlestir.ts mebbis.csv                 rapor
 *   npx tsx scripts/okul-cift-birlestir.ts mebbis.csv --yaz GUNLUK    uygular,
 *        yaptığı her şeyi GUNLUK (JSON) dosyasına yazar
 *   npx tsx scripts/okul-cift-birlestir.ts --geri-al GUNLUK           geri alır
 *
 * İKİ ADIM, ilçe ilçe, yalnızca `ayniOkulMu` (aynı tür + aynı katı ad +
 * ayırt edici kelime) DOĞRU ise:
 *
 *   A. AD DÜZELTME: MEBBİS'teki bir lise ilçede kendi adıyla yoksa ve onunla
 *      aynı okul olan TEK bir kayıt varsa, o kaydın adı resmî ad yapılır
 *      (yükleyicinin "≈ gözden geçir" dediği satırlar).
 *   B. BİRLEŞTİRME: ilçede aynı okul olan birden çok kayıt varsa, hepsi TEK
 *      kayda toplanır. Hedef: resmî adı taşıyan kayıt (birden çok resmî varsa
 *      DOKUNULMAZ); resmî yoksa en çok kişisi olan. Kaynak kayıt pasife alınır,
 *      SİLİNMEZ. Yalnızca geçici kodlu okul kaynak olabilir.
 *
 * GERİ ALMA GÜNLÜĞÜ: her birleştirmede taşınan kişi/rol/görev/etkinlik/ekip
 * kimlikleri, kişilerin eski ilçesi; her ad düzeltmesinde eski ad ve tür.
 * --geri-al bunları tersine uygular (kaynak okul yeniden aktif olur).
 */

type Gunluk = {
  tarih: string;
  adDuzeltmeleri: { kurumKodu: number; eskiAd: string; eskiTur: string; yeniAd: string }[];
  birlestirmeler: {
    kaynak: number;
    hedef: number;
    kaynakAd: string;
    hedefAd: string;
    kisiler: { id: number; ilceKodu: string | null }[];
    roller: number[];
    gorevRolleri: number[];
    faaliyetler: number[];
    ekipler: number[];
    disBasvurular: number[];
  }[];
};

function resmiAdlar(csvYolu: string): Map<string, { ad: string; tur: string; ilce: string }[]> {
  const harita = new Map<string, { ad: string; tur: string; ilce: string }[]>();
  const satirlar = readFileSync(csvYolu, "utf-8").replace(/^﻿/, "").split(/\r?\n/);
  for (const satir of satirlar.slice(1)) {
    if (!satir.trim()) continue;
    const [ilKodu, ilce, hamAd, mebbisTuru] = satir.split(";").map((s) => s.trim());
    const tur = mebbisTurunuCevir(mebbisTuru, hamAd);
    if (!tur) continue;
    const il = ilKodu.padStart(2, "0");
    const liste = harita.get(il) ?? [];
    liste.push({ ad: baslikHarfi(hamAd), tur, ilce });
    harita.set(il, liste);
  }
  return harita;
}

async function geriAl(gunlukYolu: string) {
  const gunluk = JSON.parse(readFileSync(gunlukYolu, "utf-8")) as Gunluk;
  // Ters sırada: önce birleştirmeler, sonra ad düzeltmeleri.
  for (const b of [...gunluk.birlestirmeler].reverse()) {
    const kaynak = { kurumKodu: b.kaynak };
    await prisma.$transaction([
      prisma.kurum.update({ where: kaynak, data: { aktif: true } }),
      ...b.kisiler.map((k) =>
        prisma.kullanici.update({
          where: { id: k.id },
          data: { kurumKodu: b.kaynak, ilceKodu: k.ilceKodu },
        }),
      ),
      prisma.kullaniciRol.updateMany({ where: { id: { in: b.roller } }, data: kaynak }),
      prisma.ogrenciGorevRolu.updateMany({ where: { id: { in: b.gorevRolleri } }, data: kaynak }),
      prisma.faaliyet.updateMany({ where: { id: { in: b.faaliyetler } }, data: kaynak }),
      prisma.ekip.updateMany({ where: { id: { in: b.ekipler } }, data: kaynak }),
      prisma.disKullaniciBasvurusu.updateMany({
        where: { id: { in: b.disBasvurular } },
        data: { mezunKurumKodu: b.kaynak },
      }),
    ]);
    console.log(`↩ ${b.hedefAd} ← ${b.kaynakAd}: ${b.kisiler.length} kişi geri taşındı`);
  }
  for (const d of [...gunluk.adDuzeltmeleri].reverse()) {
    await prisma.kurum.update({
      where: { kurumKodu: d.kurumKodu },
      data: { ad: d.eskiAd, okulTuru: d.eskiTur },
    });
    console.log(`↩ ad: ${d.yeniAd} → ${d.eskiAd}`);
  }
  console.log("Geri alındı.");
}

/**
 * Bir okulu ötekine taşır: günlüğe ÖNCE yazar, sonra tek işlemde taşır,
 * kaynağı pasife alır (silmez). --geri-al bu günlükle tersine çevirir.
 */
async function gunlukluBirlestir(
  kaynak: { kurumKodu: number; ad: string },
  hedef: { kurumKodu: number; ad: string; ilceKodu: string | null },
  gunluk: Gunluk,
  gunlukYolu: string,
  yapanId: number,
  neden: string,
) {
  const k = { kurumKodu: kaynak.kurumKodu };
  const [kisiler, roller, gorevler, faaliyetler, ekipler, dis] = await Promise.all([
    prisma.kullanici.findMany({ where: k, select: { id: true, ilceKodu: true } }),
    prisma.kullaniciRol.findMany({ where: k, select: { id: true } }),
    prisma.ogrenciGorevRolu.findMany({ where: k, select: { id: true } }),
    prisma.faaliyet.findMany({ where: k, select: { id: true } }),
    prisma.ekip.findMany({ where: k, select: { id: true } }),
    prisma.disKullaniciBasvurusu.findMany({
      where: { mezunKurumKodu: kaynak.kurumKodu },
      select: { id: true },
    }),
  ]);
  gunluk.birlestirmeler.push({
    kaynak: kaynak.kurumKodu,
    hedef: hedef.kurumKodu,
    kaynakAd: kaynak.ad,
    hedefAd: hedef.ad,
    kisiler,
    roller: roller.map((x) => x.id),
    gorevRolleri: gorevler.map((x) => x.id),
    faaliyetler: faaliyetler.map((x) => x.id),
    ekipler: ekipler.map((x) => x.id),
    disBasvurular: dis.map((x) => x.id),
  });
  // Günlük HER işlemden önce diske yazılır: yarıda kesilse de geri alınabilsin.
  writeFileSync(gunlukYolu, JSON.stringify(gunluk, null, 1));
  const yeni = { kurumKodu: hedef.kurumKodu };
  await prisma.$transaction([
    prisma.kullanici.updateMany({ where: k, data: { ...yeni, ilceKodu: hedef.ilceKodu } }),
    prisma.kullaniciRol.updateMany({ where: k, data: yeni }),
    prisma.ogrenciGorevRolu.updateMany({ where: k, data: yeni }),
    prisma.faaliyet.updateMany({ where: k, data: yeni }),
    prisma.ekip.updateMany({ where: k, data: yeni }),
    prisma.disKullaniciBasvurusu.updateMany({
      where: { mezunKurumKodu: kaynak.kurumKodu },
      data: { mezunKurumKodu: hedef.kurumKodu },
    }),
    prisma.kurum.update({ where: k, data: { aktif: false } }),
  ]);
  await erisimLogla({
    kullaniciId: yapanId,
    islem: "DEGISIKLIK",
    hedefTip: "SISTEM_AYARI",
    hedefId: kaynak.kurumKodu,
    detay: `Okul birleştirildi (${neden}): ${kaynak.ad} (${kaynak.kurumKodu}) → ${hedef.ad} (${hedef.kurumKodu}); ${kisiler.length} kişi`,
  });
  return kisiler.length;
}

/**
 * ELLE BİRLEŞTİRME (16 Kasım 2026 · "Rıdvan Binnaz Egeler aynı okul"): kural
 * yakalamadı ama bir insan "aynı okul" dedi. Kapı yine sıkı: aynı il, ikisi
 * de aktif, kaynak geçici kodlu. Aynı günlük, aynı --geri-al.
 *   --elle KAYNAK[,KAYNAK…] HEDEF --yaz GUNLUK.json
 */
async function elleBirlestir(kaynaklar: number[], hedefKodu: number, gunlukYolu: string | null) {
  const yonetici = await prisma.kullaniciRol.findFirst({
    where: { rolKodu: "PROJE_YONETICISI", bitisTarihi: null },
    select: { kullaniciId: true },
  });
  if (!yonetici) throw new Error("Aktif proje yöneticisi yok.");
  const secim = { kurumKodu: true, ad: true, ilKodu: true, ilceKodu: true, aktif: true } as const;
  const hedef = await prisma.kurum.findUnique({ where: { kurumKodu: hedefKodu }, select: secim });
  if (!hedef?.aktif) throw new Error(`Hedef okul ${hedefKodu} yok ya da pasif.`);
  const gunluk: Gunluk = { tarih: new Date().toISOString(), adDuzeltmeleri: [], birlestirmeler: [] };
  if (gunlukYolu) writeFileSync(gunlukYolu, "{}");
  for (const kod of kaynaklar) {
    const kaynak = await prisma.kurum.findUnique({ where: { kurumKodu: kod }, select: secim });
    if (!kaynak?.aktif) throw new Error(`Kaynak okul ${kod} yok ya da pasif.`);
    if (kaynak.ilKodu !== hedef.ilKodu) throw new Error(`${kaynak.ad} başka ilde.`);
    if (!geciciKurumKoduMu(kod)) throw new Error(`${kaynak.ad} MEB kodlu; kaynak olamaz.`);
    if (kod === hedefKodu) throw new Error("Okul kendisiyle birleştirilemez.");
    console.log(`  ⇒ ${kaynak.ad} (${kod}) → ${hedef.ad} (${hedefKodu})`);
    if (gunlukYolu) {
      const n = await gunlukluBirlestir(kaynak, hedef, gunluk, gunlukYolu, yonetici.kullaniciId, "elle onaylandı");
      console.log(`    ${n} kişi taşındı`);
    }
  }
  console.log(gunlukYolu ? `Uygulandı. Geri alma günlüğü: ${gunlukYolu}` : "Yalnızca rapor; uygulamak için --yaz GUNLUK.json");
}

async function main() {
  const geriAlIdx = process.argv.indexOf("--geri-al");
  if (geriAlIdx > 0) return geriAl(process.argv[geriAlIdx + 1]);
  const elleIdx = process.argv.indexOf("--elle");
  if (elleIdx > 0) {
    const yazI = process.argv.indexOf("--yaz");
    return elleBirlestir(
      process.argv[elleIdx + 1].split(",").map(Number),
      Number(process.argv[elleIdx + 2]),
      yazI > 0 ? process.argv[yazI + 1] : null,
    );
  }

  const csvYolu = process.argv[2];
  const yazIdx = process.argv.indexOf("--yaz");
  const yaz = yazIdx > 0;
  const gunlukYolu = yaz ? process.argv[yazIdx + 1] : null;
  if (!csvYolu) throw new Error("MEBBİS CSV yolunu verin.");
  if (yaz && !gunlukYolu) throw new Error("--yaz GUNLUK.json biçiminde günlük yolu verin.");
  // Günlük yazılamıyorsa HİÇBİR değişiklik yapılmadan durulur (16 Kasım 2026:
  // ilk çalıştırmada günlük klasörü yazılamadığı için ad düzeltmeleri
  // günlüksüz uygulanmıştı).
  if (yaz) writeFileSync(gunlukYolu!, "{}");

  const yonetici = await prisma.kullaniciRol.findFirst({
    where: { rolKodu: "PROJE_YONETICISI", bitisTarihi: null },
    select: { kullaniciId: true },
  });
  if (!yonetici) throw new Error("Aktif proje yöneticisi yok.");

  const resmi = resmiAdlar(csvYolu);
  const gunluk: Gunluk = { tarih: new Date().toISOString(), adDuzeltmeleri: [], birlestirmeler: [] };
  const sayac = { ad: 0, birlesme: 0, atlanan: 0 };

  for (const [ilKodu, resmiler] of resmi) {
    const il = await prisma.il.findUnique({ where: { ilKodu }, select: { ad: true } });
    const ilceler = await prisma.ilce.findMany({ where: { ilKodu }, select: { ilceKodu: true, ad: true } });
    const yer = yerAdlariKumesi([il?.ad ?? "", ...ilceler.map((i) => i.ad)]);
    const okullar = await prisma.kurum.findMany({
      where: { ilKodu, aktif: true },
      select: {
        kurumKodu: true,
        ad: true,
        ilceKodu: true,
        okulTuru: true,
        _count: { select: { kullanicilar: true } },
      },
    });
    const ilceKodu = (ad: string) =>
      ilceler.find((i) => i.ad.toLocaleLowerCase("tr-TR") === ad.toLocaleLowerCase("tr-TR"))?.ilceKodu;
    const resmiAdSet = new Set(resmiler.map((r) => `${ilceKodu(r.ilce)}|${r.ad}`));
    const resmiMi = (o: { ad: string; ilceKodu: string | null }) => resmiAdSet.has(`${o.ilceKodu}|${o.ad}`);

    // A. Ad düzeltme
    for (const r of resmiler) {
      const ik = ilceKodu(r.ilce);
      if (!ik) continue;
      if (okullar.some((o) => o.ilceKodu === ik && o.ad === r.ad)) continue;
      const adaylar = okullar.filter(
        (o) => o.ilceKodu === ik && !resmiMi(o) && ayniOkulMu(o, { ad: r.ad, okulTuru: r.tur }, yer),
      );
      if (adaylar.length !== 1) continue;
      const o = adaylar[0];
      sayac.ad++;
      console.log(`  ~ [${il?.ad}] ${o.ad} → ${r.ad} [${r.tur}]`);
      gunluk.adDuzeltmeleri.push({ kurumKodu: o.kurumKodu, eskiAd: o.ad, eskiTur: o.okulTuru, yeniAd: r.ad });
      if (yaz) {
        // Günlük DEĞİŞİKLİKTEN ÖNCE diske: yarıda kesilse de geri alınabilsin.
        writeFileSync(gunlukYolu!, JSON.stringify(gunluk, null, 1));
        await prisma.kurum.update({ where: { kurumKodu: o.kurumKodu }, data: { ad: r.ad, okulTuru: r.tur } });
        await erisimLogla({
          kullaniciId: yonetici.kullaniciId,
          islem: "DEGISIKLIK",
          hedefTip: "SISTEM_AYARI",
          hedefId: o.kurumKodu,
          detay: `Okul adı MEBBİS resmî adıyla düzeltildi: ${o.ad} → ${r.ad}`,
        });
      }
      o.ad = r.ad;
    }

    // B. Birleştirme: aynı ilçe + aynı tür + aynı katı anahtar
    const gruplar = new Map<string, typeof okullar>();
    for (const o of okullar) {
      if (!o.okulTuru || ayirtEdici(o.ad, yer).size === 0) continue;
      const anahtar = `${o.ilceKodu}|${o.okulTuru}|${katiAdAnahtari(o.ad, yer)}`;
      gruplar.set(anahtar, [...(gruplar.get(anahtar) ?? []), o]);
    }
    for (const grup of gruplar.values()) {
      if (grup.length < 2) continue;
      // Grubun her çifti gerçekten "aynı okul" mu — kapıyı bir kez daha sor.
      if (!grup.every((o) => ayniOkulMu(o, grup[0], yer))) continue;
      const resmiler2 = grup.filter(resmiMi);
      if (resmiler2.length > 1) {
        sayac.atlanan++;
        console.log(`  ? [${il?.ad}] iki resmî kayıt aynı anahtarda, dokunulmadı: ${grup.map((o) => o.ad).join(" · ")}`);
        continue;
      }
      const hedef =
        resmiler2[0] ?? [...grup].sort((a, b) => b._count.kullanicilar - a._count.kullanicilar)[0];
      for (const kaynak of grup) {
        if (kaynak.kurumKodu === hedef.kurumKodu) continue;
        if (!geciciKurumKoduMu(kaynak.kurumKodu)) {
          sayac.atlanan++;
          console.log(`  ? [${il?.ad}] MEB kodlu okul kaynak olamaz: ${kaynak.ad} (${kaynak.kurumKodu})`);
          continue;
        }
        sayac.birlesme++;
        console.log(
          `  ⇒ [${il?.ad}] ${kaynak.ad} (${kaynak._count.kullanicilar} kişi) → ${hedef.ad} (${hedef._count.kullanicilar} kişi)`,
        );
        if (!yaz) continue;
        await gunlukluBirlestir(kaynak, hedef, gunluk, gunlukYolu!, yonetici.kullaniciId, "aynı tür ve ad");
      }
    }
  }

  if (yaz) writeFileSync(gunlukYolu!, JSON.stringify(gunluk, null, 1));
  console.log(
    `\nÖzet: ad düzeltme ${sayac.ad}, birleştirme ${sayac.birlesme}, atlanan ${sayac.atlanan}.`,
  );
  console.log(yaz ? `Uygulandı. Geri alma günlüğü: ${gunlukYolu}` : "Yalnızca rapor; uygulamak için --yaz GUNLUK.json");
}

main()
  .catch((hata) => {
    console.error(hata);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
