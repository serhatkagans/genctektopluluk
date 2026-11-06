import { stat } from "node:fs/promises";
import {
  hataGunlukDosyasi,
  hataKaydet,
  hataKaydiHazirla,
} from "@/lib/hata-kaydi";
import {
  hizSiniriOlustur,
  istekAnahtari,
  paylasilanHizSiniri,
} from "@/lib/hiz-siniri";
import { sorgusuzYol } from "@/lib/hata-kurallar";
import { ortam } from "@/lib/ortam";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * İSTEMCİ HATA UCU (21 Ağustos 2026 · istek: "arada hata veriyor ancak hata
 * kayıtlarına nedeni işlenmiyor").
 *
 * ---------------------------------------------------------------------------
 * NİYE VAR
 * ---------------------------------------------------------------------------
 * Sunucu hataları `instrumentation.ts` üzerinden günlüğe düşüyor. Tarayıcıda
 * patlayan bir bileşen ise hiçbir yere yazılmıyordu: kullanıcı "Beklenmeyen
 * bir hata oluştu" ekranını görüyor, o ekranda "Hata kimliği" satırı bile
 * çıkmıyor (digest YALNIZCA sunucu hatalarında üretilir) ve yönetici hata
 * kayıtlarına baktığında karşılığı olmayan bir şikâyetle kalıyordu.
 *
 * Bu uç, `app/error.tsx`'in (ve `global-error.tsx`'in) gördüğü hatayı aynı
 * JSONL günlüğüne `kaynak: "istemci"` işaretiyle yazar. Ayrı bir depo
 * kurulmadı: yöneticinin bakacağı yer tek olmalı.
 *
 * ---------------------------------------------------------------------------
 * OTURUM ARANMAZ
 * ---------------------------------------------------------------------------
 * Hata çoğu zaman giriş ekranında ya da oturumu düşmüş bir sayfada oluşuyor;
 * oturum şartı, tam da en çok ihtiyaç duyulan kayıtları eler. Bunun bedeli,
 * ucun herkese açık bir YAZMA noktası olması — üç sınırla karşılanıyor:
 *
 *   1. Gövde okunmadan önce boyutu bakılır ve her alan kırpılır: günlük
 *      dosyasına sınırsız metin yazdırılamaz.
 *   2. Süreç başına dakikada `DAKIKA_SINIRI` kayıt: döngüye giren bir sayfa
 *      (her render'da hata fırlatan bir bileşen) diski dolduramaz.
 *   3. Yazılan şey ne olursa olsun bir GÜNLÜK SATIRI; veritabanına
 *      dokunulmaz, hiçbir iş kuralı çalışmaz.
 *
 * Yanıt her durumda 204: istemciye ne kaydedildiğini söylemek, ucu deneme
 * yanılmayla yoklamayı kolaylaştırmaktan başka işe yaramaz. Zaten hata ekranı
 * yanıtı hiç okumuyor.
 *
 * ---------------------------------------------------------------------------
 * NE YAZILMAZ
 * ---------------------------------------------------------------------------
 * Sunucu tarafındaki sözün aynısı geçerli (bkz. lib/hata-kaydi.ts): adres
 * `sorgusuzYol`dan geçer — panelin on üç ekranı arama metnini `?ara=` ile
 * taşıyor ve oraya bir öğrenci adı yazılmış olabilir. Kullanıcı kimliği,
 * çerez, form içeriği hiç istenmiyor.
 */

/** Tek kaydın alanlarına konan üst sınırlar (karakter). */
const MESAJ_SINIRI = 2000;
const IZ_SINIRI = 8000;
const AD_SINIRI = 200;
const KIMLIK_SINIRI = 100;

/** Gövdenin okunmadan önce reddedildiği boyut. */
const GOVDE_SINIRI = 32 * 1024;

/**
 * İKİ KATMANLI SINIR (27 Ağustos 2026 · güvenlik incelemesi).
 *
 * Önce yalnızca süreç başına ortak bir sayaç vardı ve bu, korumayı saldırıya
 * çeviriyordu: dakikada 60 boş bildirim gönderen biri kotayı tüketip GERÇEK
 * istemci hatalarının yazılmasını engelleyebilirdi — hata günlüğü tam da
 * gerektiği anda susardı. Sınır artık ÖNCE IP başına uygulanıyor; bir
 * kaynağın gürültüsü başkasının kaydını düşürmüyor.
 *
 * Süreç başına tavan yine de duruyor: dağıtık bir kaynaktan (ya da başlığı
 * olmayan isteklerden) gelen yük dosyayı kontrolsüz büyütmesin diye. IP sınırı
 * adaleti, ortak tavan dosya boyutunu korur.
 *
 * İKİSİNİN KAPSAMI FARKLI (3 Eylül 2026). IP sınırı KOPYALAR ARASINDA ORTAK bir
 * sayaç kullanıyor: üç kopyaya serpilen istekler tek satırda toplanıyor, yani
 * 10 gerçekten 10 (önceden fiilen 30'du). Süreç tavanı ise BİLEREK süreç
 * başına kaldı — sorduğu soru "bu kopya ne kadar yazsın", ve kopya başına 60
 * yazma zaten kopya başına bir kaynak sınırıdır. Ortaklaştırılsaydı üç kopya
 * tek bir 60'lık kotayı paylaşır, tavan üçe bölünmüş olurdu.
 *
 * DİKKAT: bu uç KİMLİK İSTEMEZ, dolayısıyla kayıtlar doğrulanmamış veridir;
 * sınırın gevşetilmesi doğrudan günlüğün güvenilirliğini düşürür.
 */
const IP_DAKIKA_SINIRI = 10;
const SUREC_DAKIKA_SINIRI = 60;

const ipSiniri = paylasilanHizSiniri({
  kova: "hata-bildir",
  pencereMs: 60_000,
  sinir: IP_DAKIKA_SINIRI,
});
const surecSiniri = hizSiniriOlustur({
  pencereMs: 60_000,
  sinir: SUREC_DAKIKA_SINIRI,
  enFazlaAnahtar: 1,
});

/** Kaydın yazılmasına izin var mı? IP sınırı önce, süreç tavanı sonra. */
async function siniraTakildiMi(istek: Request): Promise<boolean> {
  const anahtar = istekAnahtari(istek, ortam.GUVENILEN_VEKIL_SAYISI);
  if (await ipSiniri.takildiMi(anahtar)) return true;
  return surecSiniri.takildiMi("hepsi");
}

/*
 * AYLIK DOSYA TAVANI (6 Kasım 2026 · güvenlik incelemesi). Hız sınırları
 * dakikalık; üç kopya sınırda tutulsa bile ayda gigabaytlarca kimliksiz kayıt
 * birikebilir ve disk başka uygulamalarla ortak. Ayın dosyası tavanı aşınca
 * İSTEMCİDEN gelen kayıt düşer; sunucu hataları (hataKaydet doğrudan) bundan
 * etkilenmez.
 */
const AYLIK_DOSYA_TAVANI = 200 * 1024 * 1024;

async function aylikTavanDoluMu(): Promise<boolean> {
  try {
    return (await stat(hataGunlukDosyasi())).size >= AYLIK_DOSYA_TAVANI;
  } catch {
    // Dosya henüz yok: ayın ilk kaydı.
    return false;
  }
}

function metin(deger: unknown, sinir: number): string | null {
  if (typeof deger !== "string") return null;
  const kirpilmis = deger.trim();
  if (!kirpilmis) return null;
  return kirpilmis.length > sinir ? kirpilmis.slice(0, sinir) : kirpilmis;
}

export async function POST(istek: Request) {
  const bildirilenBoyut = Number.parseInt(
    istek.headers.get("content-length") ?? "",
    10,
  );
  if (Number.isFinite(bildirilenBoyut) && bildirilenBoyut > GOVDE_SINIRI) {
    return new Response(null, { status: 413 });
  }

  let ham: unknown;
  try {
    const govde = await istek.text();
    if (govde.length > GOVDE_SINIRI) return new Response(null, { status: 413 });
    ham = JSON.parse(govde);
  } catch {
    // Bozuk gövde sessizce düşer: bu uca yazan tek şey hata ekranı ve orada
    // bir aksaklık varsa kullanıcıya ikinci bir hata göstermenin anlamı yok.
    return new Response(null, { status: 204 });
  }

  if (typeof ham !== "object" || ham === null) {
    return new Response(null, { status: 204 });
  }
  const nesne = ham as Record<string, unknown>;

  const mesaj = metin(nesne.mesaj, MESAJ_SINIRI);
  if (!mesaj) return new Response(null, { status: 204 });

  if (await siniraTakildiMi(istek)) return new Response(null, { status: 204 });
  if (await aylikTavanDoluMu()) return new Response(null, { status: 204 });

  /*
   * Kayıt, sunucu tarafıyla AYNI işlevden geçiriliyor: `hataKaydiHazirla`
   * kimliği, zamanı ve yolun kırpılmasını tek yerde çözüyor. Buraya ikinci bir
   * kayıt kurucu yazılsaydı, ilerideki bir alan eklemesi bir tarafta unutulurdu.
   */
  const hata = new Error(mesaj) as Error & { digest?: string };
  hata.name = metin(nesne.ad, AD_SINIRI) ?? "İstemciHatası";
  hata.stack = metin(nesne.yiginIzi, IZ_SINIRI) ?? undefined;
  const kimlik = metin(nesne.kimlik, KIMLIK_SINIRI);
  if (kimlik) hata.digest = kimlik;

  await hataKaydet(
    hataKaydiHazirla(hata, {
      // Yol, hatanın oluştuğu SAYFA; isteğin kendi adresi (`/api/hata-bildir`)
      // hiçbir şey anlatmazdı.
      path: sorgusuzYol(metin(nesne.yol, 500)) ?? undefined,
      // `yontem` boş bırakılıyor: alan HTTP yöntemini taşıyor ve tarayıcıda
      // patlayan bir render'ın yöntemi yok. Tarafı `kaynak` söylüyor.
      kaynak: "istemci",
    }),
  );

  return new Response(null, { status: 204 });
}
