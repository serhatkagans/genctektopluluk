"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { basliklardanAnahtar, paylasilanHizSiniri } from "@/lib/hiz-siniri";
import { kayitOl } from "@/lib/kayit/kayit";
import { kayitGirdisiniCoz } from "@/lib/kayit/kurallar";
import { ortam } from "@/lib/ortam";

/**
 * Kayıt hız sınırı. Kapı kimlik istemiyor ve "bu numarayla hesap var" cevabı
 * veriyor; hacimli deneme hem sahte hesap hem numara keşfi demek. Okul/sınıf
 * toplu kaydında aynı NAT arkasından çok kişi gelebileceği için sayı
 * başvuru formundakinden bol tutuldu.
 */
const PENCERE_DAKIKA = 10;
const kayitSiniri = paylasilanHizSiniri({
  kova: "kayit",
  pencereMs: PENCERE_DAKIKA * 60_000,
  sinir: 30,
});

/**
 * Kayıt formu eylemi.
 *
 * HATA ARTIK YÖNLENDİRMEYLE DEĞİL, DÖNÜŞ DEĞERİYLE (2 Kasım 2026 · istek:
 * "full doldurmama rağmen bu hatayı aldım"). Eskiden her hata sayfayı
 * yeniden açıyor ve kişi bütün formu baştan dolduruyordu. Şimdi form
 * (components/KayitFormu.tsx) mesajı yerinde gösteriyor, girilenler duruyor.
 * Şifre ve kimlik numarası yine adres çubuğuna düşmüyor.
 */
export async function kayitEylemi(
  veri: FormData,
): Promise<{ hata: string } | undefined> {
  const metin = (alan: string) => String(veri.get(alan) ?? "");

  const girdi = {
    tip: metin("tip"),
    tcKimlikNo: metin("tcKimlikNo"),
    ad: metin("ad"),
    soyad: metin("soyad"),
    cinsiyet: metin("cinsiyet"),
    ilKodu: metin("ilKodu"),
    ilceKodu: metin("ilceKodu"),
    kurumKodu: metin("kurumKodu"),
    beyanOkulAdi: metin("beyanOkulAdi"),
    okulTuru: metin("okulTuru"),
    eposta: metin("eposta"),
    telefon: metin("telefon"),
    sinifSeviyesi: metin("sinifSeviyesi"),
    sube: metin("sube"),
    brans: metin("brans"),
    sifre: metin("sifre"),
    sifreTekrar: metin("sifreTekrar"),
  };

  if (ortam.AUTH_PROVIDER !== "kayit") {
    redirect(`/giris?hata=${encodeURIComponent("Kayıt kapalı.")}`);
  }

  if (
    await kayitSiniri.takildiMi(
      basliklardanAnahtar(await headers(), ortam.GUVENILEN_VEKIL_SAYISI),
    )
  ) {
    return {
      hata: `Kısa sürede çok fazla kayıt denemesi yapıldı. ${PENCERE_DAKIKA} dakika sonra tekrar deneyin.`,
    };
  }

  const karar = kayitGirdisiniCoz(girdi, new Date());
  if (!karar.olurMu) {
    return { hata: karar.neden };
  }

  const sonuc = await kayitOl(karar.kayit);
  if (sonuc.durum === "BASARISIZ") {
    return { hata: sonuc.mesaj };
  }

  redirect("/giris?kayit=tamam");
}
