"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { sifirlamayiTamamla, sifirlamaIste } from "@/lib/dis-kimlik/sifirlama";
import { sifirlamaHostuSec } from "@/lib/dis-kimlik/sifirlama-adresi";
import {
  kayitSifirlamaIste,
  kayitSifirlamayiTamamla,
} from "@/lib/kayit/sifirlama";
import { IZINLI_HOST_LISTESI, uygulamaYolu } from "@/lib/ortam";

/**
 * Parola sıfırlama eylemleri (yalnızca dış kullanıcılar).
 *
 * SIFIRLAMA BAĞLANTISININ YOLU İSTEKTEN ÜRETİLİR, ortam değişkeninden değil.
 * Ayrı bir "uygulama adresi" ayarı, alt dizin kurulumunda (TEMEL_YOL) ikinci
 * bir yanlış yapılandırma kaynağı olurdu: biri güncellenip diğeri unutulunca
 * e-postadaki bağlantı sessizce 404'e giderdi. Uygulama ters vekil arkasında
 * çalıştığı için şema `x-forwarded-proto`dan okunur.
 *
 * HOST İSE DOĞRULANIR. `Host` ve `X-Forwarded-Host` başlıklarını isteği yapan
 * belirler; ters vekil bu başlığı ezmiyorsa, saldırgan kurbanın e-postasına
 * KENDİ alan adına giden bir sıfırlama bağlantısı göndertebilir ve kurban
 * tıkladığında jeton saldırgana ulaşır. Bu yüzden türetilen host
 * IZINLI_HOSTLAR listesine karşı sınanır (bkz. lib/ortam.ts).
 */
async function istekKoku(): Promise<string> {
  const basliklar = await headers();
  const host = basliklar.get("x-forwarded-host") ?? basliklar.get("host") ?? "";
  const sema = basliklar.get("x-forwarded-proto") ?? "https";
  return `${sema}://${sifirlamaHostuSec(host, IZINLI_HOST_LISTESI)}`;
}

export async function sifirlamaIsteEylemi(veri: FormData): Promise<void> {
  const eposta = String(veri.get("eposta") ?? "");
  const kok = await istekKoku();

  await sifirlamaIste(eposta, (adres, jeton) => {
    const sorgu = `?e=${encodeURIComponent(adres)}&jeton=${encodeURIComponent(jeton)}`;
    return `${kok}${uygulamaYolu("/sifre-sifirlama")}${sorgu}`;
  });

  /*
   * SONUÇ HER DURUMDA AYNI. E-posta kayıtlı değilse de "gönderildi" denir;
   * aksi hâlde bu ekran "hangi adres bu sistemde kayıtlı" sorusunu cevaplayan
   * bir araca dönerdi.
   */
  redirect("/sifre-sifirlama?durum=gonderildi");
}

export async function sifirlamaTamamlaEylemi(veri: FormData): Promise<void> {
  const eposta = String(veri.get("eposta") ?? "");
  const jeton = String(veri.get("jeton") ?? "");
  const sifre = String(veri.get("sifre") ?? "");
  const sifreTekrar = String(veri.get("sifreTekrar") ?? "");

  const sonuc = await sifirlamayiTamamla(eposta, jeton, sifre, sifreTekrar);

  if (!sonuc.olduMu) {
    // Jeton geri taşınır ki kişi bağlantıyı e-postadan yeniden açmak zorunda
    // kalmasın; şifre alanları taşınmaz.
    redirect(
      `/sifre-sifirlama?e=${encodeURIComponent(eposta)}&jeton=${encodeURIComponent(jeton)}&hata=${encodeURIComponent(sonuc.neden)}`,
    );
  }

  redirect(
    `/dis-giris?bilgi=${encodeURIComponent("Şifreniz güncellendi. Yeni şifrenizle giriş yapabilirsiniz.")}`,
  );
}

/*
 * ÖĞRENCİ VE ÖĞRETMEN (kayıt formuyla açılmış hesaplar · 28 Ekim 2026).
 * Kişi T.C. numarasını ve e-postasını yazar; bağlantı profildeki e-postaya
 * gider (bkz. lib/kayit/sifirlama.ts). Bağlantıda T.C. numarası taşınmaz.
 */
export async function kayitSifirlamaIsteEylemi(veri: FormData): Promise<void> {
  const tcKimlikNo = String(veri.get("tcKimlikNo") ?? "");
  const eposta = String(veri.get("eposta") ?? "");
  const kok = await istekKoku();

  await kayitSifirlamaIste(tcKimlikNo, eposta, (kullaniciId, jeton) => {
    const sorgu = `?k=${kullaniciId}&jeton=${encodeURIComponent(jeton)}`;
    return `${kok}${uygulamaYolu("/sifre-sifirlama")}${sorgu}`;
  });

  // Sonuç her durumda aynı (bkz. sifirlamaIsteEylemi).
  redirect("/sifre-sifirlama?tur=kayit&durum=gonderildi");
}

export async function kayitSifirlamaTamamlaEylemi(veri: FormData): Promise<void> {
  const kimlik = String(veri.get("k") ?? "");
  const jeton = String(veri.get("jeton") ?? "");
  const sifre = String(veri.get("sifre") ?? "");
  const sifreTekrar = String(veri.get("sifreTekrar") ?? "");

  const sonuc = await kayitSifirlamayiTamamla(
    Number.parseInt(kimlik, 10),
    jeton,
    sifre,
    sifreTekrar,
  );

  if (!sonuc.olduMu) {
    redirect(
      `/sifre-sifirlama?k=${encodeURIComponent(kimlik)}&jeton=${encodeURIComponent(jeton)}&hata=${encodeURIComponent(sonuc.neden)}`,
    );
  }

  redirect("/giris?kayit=sifre");
}
