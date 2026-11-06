"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { sifirlamayiTamamla, sifirlamaIste } from "@/lib/dis-kimlik/sifirlama";
import {
  sifirlamaHostuSec,
  sifirlamaSemasiSec,
} from "@/lib/dis-kimlik/sifirlama-adresi";
import {
  kayitSifirlamaIste,
  kayitSifirlamayiTamamla,
} from "@/lib/kayit/sifirlama";
import { basliklardanAnahtar, paylasilanHizSiniri } from "@/lib/hiz-siniri";
import { IZINLI_HOST_LISTESI, ortam, uygulamaYolu } from "@/lib/ortam";

/**
 * Parola sıfırlama eylemleri (yalnızca dış kullanıcılar).
 *
 * SIFIRLAMA BAĞLANTISININ YOLU İSTEKTEN ÜRETİLİR, ortam değişkeninden değil.
 * Ayrı bir "uygulama adresi" ayarı, alt dizin kurulumunda (TEMEL_YOL) ikinci
 * bir yanlış yapılandırma kaynağı olurdu: biri güncellenip diğeri unutulunca
 * e-postadaki bağlantı sessizce 404'e giderdi. Şema ise istekten OKUNMAZ:
 * yerel geliştirme dışında her zaman https'tir (bkz. sifirlamaSemasiSec).
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
  const secilen = sifirlamaHostuSec(host, IZINLI_HOST_LISTESI);
  return `${sifirlamaSemasiSec(secilen)}://${secilen}`;
}

/*
 * HIZ SINIRI VE SABİT YANIT SÜRESİ (6 Kasım 2026 · güvenlik incelemesi).
 *
 * Bu uçlarda IP sınırı yoktu; tek fren hesap başına 2 dakikalık bekleme
 * süresiydi. Elinde T.C. ya da e-posta listesi olan biri (T.C. 11 hane,
 * sıralanabilir) her kayıtlı hesaba 2 dakikada bir posta göndertip SMTP
 * kotasını ve CPU'yu (her jeton scrypt) tüketebiliyordu.
 *
 * Ayrıca hesap yokken eylem anında dönüyor, varken scrypt + SMTP bekliyordu:
 * yanıt süresi "bu numara/adres kayıtlı mı" sorusunu cevaplıyordu. İş artık
 * `after` ile YANITTAN SONRA yapılıyor; ekran her durumda aynı hızda
 * "gönderildi" der.
 *
 * İstek sınırı aşılınca da ekran "gönderildi" der ve iş yapılmaz: bu ekranın
 * söylediği tek şey her zaman aynı olmalı. Tamamlama tarafında sınır açıkça
 * söylenir — orada kişi zaten geçerli bir bağlantıyla geliyor.
 */
const SIFIRLAMA_PENCERE_DAKIKA = 10;
const sifirlamaIstekSiniri = paylasilanHizSiniri({
  kova: "sifirlama-iste",
  pencereMs: SIFIRLAMA_PENCERE_DAKIKA * 60_000,
  sinir: 5,
});
const sifirlamaTamamlamaSiniri = paylasilanHizSiniri({
  kova: "sifirlama-tamamla",
  pencereMs: SIFIRLAMA_PENCERE_DAKIKA * 60_000,
  sinir: 10,
});
const SINIR_ASILDI_MESAJI = `Kısa sürede çok fazla deneme yapıldı. ${SIFIRLAMA_PENCERE_DAKIKA} dakika sonra tekrar deneyin.`;

async function istemciAnahtari(): Promise<string> {
  return basliklardanAnahtar(await headers(), ortam.GUVENILEN_VEKIL_SAYISI);
}

/** İşi yanıttan sonra çalıştırır; hata kullanıcıya değil sunucu günlüğüne gider. */
function yanittanSonra(ad: string, is: () => Promise<void>): void {
  after(async () => {
    try {
      await is();
    } catch (hata) {
      console.error(`[${ad}] sıfırlama isteği işlenemedi:`, hata);
    }
  });
}

export async function sifirlamaIsteEylemi(veri: FormData): Promise<void> {
  const eposta = String(veri.get("eposta") ?? "");
  const kok = await istekKoku();

  if (!(await sifirlamaIstekSiniri.takildiMi(await istemciAnahtari()))) {
    yanittanSonra("dis-kimlik", () =>
      sifirlamaIste(eposta, (adres, jeton) => {
        const sorgu = `?e=${encodeURIComponent(adres)}&jeton=${encodeURIComponent(jeton)}`;
        return `${kok}${uygulamaYolu("/sifre-sifirlama")}${sorgu}`;
      }),
    );
  }

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

  if (await sifirlamaTamamlamaSiniri.takildiMi(await istemciAnahtari())) {
    redirect(
      `/sifre-sifirlama?e=${encodeURIComponent(eposta)}&jeton=${encodeURIComponent(jeton)}&hata=${encodeURIComponent(SINIR_ASILDI_MESAJI)}`,
    );
  }

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
 * Kişi yalnızca T.C. numarasını yazar; bağlantı profildeki e-postaya
 * gider (bkz. lib/kayit/sifirlama.ts). Bağlantıda T.C. numarası taşınmaz.
 */
export async function kayitSifirlamaIsteEylemi(veri: FormData): Promise<void> {
  const tcKimlikNo = String(veri.get("tcKimlikNo") ?? "");
  const kok = await istekKoku();

  if (!(await sifirlamaIstekSiniri.takildiMi(await istemciAnahtari()))) {
    yanittanSonra("kayit", () =>
      kayitSifirlamaIste(tcKimlikNo, (kullaniciId, jeton) => {
        const sorgu = `?k=${kullaniciId}&jeton=${encodeURIComponent(jeton)}`;
        return `${kok}${uygulamaYolu("/sifre-sifirlama")}${sorgu}`;
      }),
    );
  }

  // Sonuç her durumda aynı (bkz. sifirlamaIsteEylemi).
  redirect("/sifre-sifirlama?tur=kayit&durum=gonderildi");
}

export async function kayitSifirlamaTamamlaEylemi(veri: FormData): Promise<void> {
  const kimlik = String(veri.get("k") ?? "");
  const jeton = String(veri.get("jeton") ?? "");
  const sifre = String(veri.get("sifre") ?? "");
  const sifreTekrar = String(veri.get("sifreTekrar") ?? "");

  if (await sifirlamaTamamlamaSiniri.takildiMi(await istemciAnahtari())) {
    redirect(
      `/sifre-sifirlama?k=${encodeURIComponent(kimlik)}&jeton=${encodeURIComponent(jeton)}&hata=${encodeURIComponent(SINIR_ASILDI_MESAJI)}`,
    );
  }

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
