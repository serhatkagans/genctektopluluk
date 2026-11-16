import "dotenv/config";
import { randomBytes } from "node:crypto";
import type { AuthKimlik } from "@/lib/auth/tipler";
import { atamaDegistir } from "@/lib/danisman/atama";
import { prisma } from "@/lib/db";
import { sifreOzetle } from "@/lib/dis-kimlik/sifre";
import { tcKimlikNoGecerliMi } from "@/lib/kayit/kurallar";
import { kullaniciSagla } from "@/lib/kullanici/sagla";
import { egitimOgretimYili } from "@/lib/ogretmen/gorev-yillari";

/**
 * GEÇİCİ DANIŞMAN + ÖĞRENCİ HESABI (16 Kasım 2026 · istek: "Siirt
 * koordinatörü için geçici danışman ve öğrenci hesabı aç").
 *
 * Bir ilin koordinatörü ekranları öğretmen ve öğrenci gözüyle görebilsin
 * diye: bir okulda bir danışman öğretmen ve ona bağlı bir öğrenci açar.
 * Öğrenci danışmana YONETICI_ATADI ile bağlanır.
 *
 * Kullanım:
 *   npx tsx scripts/gecici-hesap.ts --il=56 --okul=900000603
 *   npx tsx scripts/gecici-hesap.ts --il=56 --temizle
 *
 * T.C. numaraları uydurma ama sağlaması geçerli: "99999" + il kodu + sıra.
 * (Pilot betiğiyle aynı aralık mantığı; bkz. ornek-pilot-veri.ts.)
 * ŞİFRELER DEPODA DURMAZ, yalnızca ekrana yazılır. Hesap zaten varsa betik
 * durur — yeniden üretmek için önce --temizle.
 */

function argDeger(ad: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${ad}=`))?.split("=")[1];
}

function tcUret(ilkDokuz: string): string {
  const h = [...ilkDokuz].map(Number);
  const tekler = h[0] + h[2] + h[4] + h[6] + h[8];
  const ciftler = h[1] + h[3] + h[5] + h[7];
  const onuncu = (((tekler * 7 - ciftler) % 10) + 10) % 10;
  const onbirinci = (h.reduce((a, b) => a + b, 0) + onuncu) % 10;
  const tc = `${ilkDokuz}${onuncu}${onbirinci}`;
  if (!tcKimlikNoGecerliMi(tc)) throw new Error(`Geçersiz T.C. üretildi: ${tc}`);
  return tc;
}

function sifreUret(): string {
  const alfabe = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const k = [...randomBytes(10)].map((b) => alfabe[b % alfabe.length]).join("");
  return `Gt-${k.slice(0, 4)}-${k.slice(4, 8)}-${k.slice(8)}`;
}

async function main() {
  const ilKodu = (argDeger("il") ?? "").padStart(2, "0");
  if (!/^\d{2}$/.test(ilKodu) || ilKodu === "00") throw new Error("--il=56 gibi verin.");
  const tcler = {
    ogretmen: tcUret(`99999${ilKodu}91`),
    ogrenci: tcUret(`99999${ilKodu}92`),
  };

  if (process.argv.includes("--temizle")) {
    const kisiler = await prisma.kullanici.findMany({
      where: { authProviderId: { in: Object.values(tcler) } },
      select: { id: true },
    });
    const kimde = { in: kisiler.map((k) => k.id) };
    await prisma.danismanAtama.deleteMany({
      where: { OR: [{ ogrenciId: kimde }, { danismanKullaniciId: kimde }] },
    });
    await prisma.kullaniciOnayi.deleteMany({ where: { kullaniciId: kimde } });
    await prisma.bildirim.deleteMany({ where: { kullaniciId: kimde } });
    await prisma.erisimlogu.deleteMany({ where: { kullaniciId: kimde } });
    await prisma.kayitKimlik.deleteMany({ where: { kullaniciId: kimde } });
    await prisma.kullaniciRol.deleteMany({ where: { kullaniciId: kimde } });
    await prisma.ogrenciProfil.deleteMany({ where: { kullaniciId: kimde } });
    await prisma.ogretmenProfil.deleteMany({ where: { kullaniciId: kimde } });
    await prisma.kullanici.deleteMany({ where: { id: kimde } });
    console.log(`${kisiler.length} geçici hesap silindi.`);
    return;
  }

  const mevcut = await prisma.kullanici.count({
    where: { authProviderId: { in: Object.values(tcler) } },
  });
  if (mevcut > 0) throw new Error("Geçici hesaplar zaten var; önce --temizle.");

  const okul = await prisma.kurum.findFirst({
    where: { kurumKodu: Number(argDeger("okul")), ilKodu, aktif: true },
    select: { kurumKodu: true, ad: true, ilceKodu: true },
  });
  if (!okul) throw new Error("--okul= ile ildeki aktif bir okulun kodunu verin.");
  const yonetici = await prisma.kullaniciRol.findFirst({
    where: { rolKodu: "PROJE_YONETICISI", bitisTarihi: null },
    select: { kullaniciId: true },
  });
  const yil = egitimOgretimYili(new Date());

  const ortak = {
    kurumKodu: okul.kurumKodu,
    ilKodu,
    ilceKodu: okul.ilceKodu,
    egitimOgretimYili: yil,
  };
  const tanimlar: (AuthKimlik & { etiket: string })[] = [
    {
      ...ortak,
      etiket: "Danışman öğretmen",
      authProviderId: tcler.ogretmen,
      tip: "OGRETMEN",
      ad: "Deneme",
      soyad: "Öğretmen",
      cinsiyet: "K",
      sinif: null,
      brans: "Bilişim Teknolojileri",
    },
    {
      ...ortak,
      etiket: "Öğrenci",
      authProviderId: tcler.ogrenci,
      tip: "OGRENCI",
      ad: "Deneme",
      soyad: "Öğrenci",
      cinsiyet: "E",
      sinif: "10-A",
      brans: null,
    },
  ];

  const sonuc: { etiket: string; tc: string; sifre: string; id: number }[] = [];
  for (const { etiket, ...kimlik } of tanimlar) {
    const { kullaniciId } = await kullaniciSagla(kimlik);
    const sifre = sifreUret();
    await prisma.kayitKimlik.create({
      data: { kullaniciId, sifreOzeti: await sifreOzetle(sifre) },
    });
    await prisma.kullanici.update({
      where: { id: kullaniciId },
      data: { hakkinda: "Geçici deneme hesabı — koordinatörün ekranları görmesi için." },
    });
    sonuc.push({ etiket, tc: kimlik.authProviderId, sifre, id: kullaniciId });
  }

  const danisman = await prisma.kullaniciRol.findFirst({
    where: { kullaniciId: sonuc[0].id, rolKodu: "DANISMAN", bitisTarihi: null },
    select: { id: true },
  });
  if (!danisman) {
    await prisma.kullaniciRol.create({
      data: {
        kullaniciId: sonuc[0].id,
        rolKodu: "DANISMAN",
        kurumKodu: okul.kurumKodu,
        atayanKullaniciId: yonetici?.kullaniciId ?? null,
        aciklama: "Geçici deneme hesabı.",
      },
    });
  }
  await atamaDegistir({
    ogrenciId: sonuc[1].id,
    danismanKullaniciId: sonuc[0].id,
    atamaTipi: "YONETICI_ATADI",
  });

  console.log(`Okul: ${okul.ad}`);
  for (const s of sonuc) {
    console.log(`${s.etiket}\tT.C.: ${s.tc}\tŞifre: ${s.sifre}`);
  }
}

main()
  .catch((hata) => {
    console.error(hata);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
