"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { disBasvuruOlustur } from "@/lib/dis-kimlik/basvuru";
import { disBasvuruGirdisiniCoz } from "@/lib/dis-kimlik/kurallar";
import { basliklardanAnahtar, paylasilanHizSiniri } from "@/lib/hiz-siniri";
import { ortam } from "@/lib/ortam";

/**
 * BAŞVURU HIZ SINIRI (27 Ağustos 2026 · güvenlik incelemesi).
 *
 * Bu kapı kimlik istemez ve iki şeyi birden açıyordu: sınırsız başvuru (proje
 * yöneticisinin onay kuyruğunu boğan spam) ve E-POSTA KEŞFİ — `disBasvuruOlustur`
 * "bu adres sistemde kayıtlı" ile "onay bekleyen başvuru var" arasında ayrım
 * yapıyor, yani elinde adres listesi olan biri kimin üye olduğunu tek tek
 * sorabiliyordu. Keşfin işe yaraması HACME bağlı; sınır tam da onu kesiyor.
 *
 * SINIR ÇAĞRIDAN ÖNCE UYGULANIR: `disBasvuruOlustur` içine konsaydı, kontrol
 * ancak veritabanına sorulduktan sonra çalışır ve mesaj zaten üretilmiş olurdu.
 *
 * SAYAÇ IP BAŞINA: e-posta başına saymak keşfi durdurmazdı (saldırgan her
 * denemede farklı adres yazıyor). Kurumsal bir NAT arkasındaki birden çok
 * gerçek başvurucu aynı kovayı paylaşır; pencere bu yüzden dar (10 dakika) ve
 * hak sayısı bir formu birkaç kez yanlış dolduran kişiyi kapıda bırakmayacak
 * kadar bol tutuldu.
 */
const PENCERE_DAKIKA = 10;
const PENCERE_BASINA_BASVURU = 5;

/*
 * SAYAÇ ORTAK (veritabanında): üç kopya aynı satırı sayıyor, yani buradaki
 * sayı doğrudan etkin değerdir. Süreç içi sayaçla bu sınır fiilen 15'ti.
 */
const basvuruSiniri = paylasilanHizSiniri({
  kova: "basvuru",
  pencereMs: PENCERE_DAKIKA * 60_000,
  sinir: PENCERE_BASINA_BASVURU,
});

/**
 * EBA dışı giriş başvurusu.
 *
 * ŞİFRE ADRES ÇUBUĞUNA TAŞINMAZ. Hata durumunda formun geri kalanı yeniden
 * doldurulsun diye alanlar sorgu dizesine yazılıyor ama şifre alanları bunun
 * dışında: tarayıcı geçmişinde, ters vekil günlüğünde ve paylaşılan bir
 * bağlantıda kalıcı olurdu. Kişi hata sonrası şifresini yeniden yazar.
 */
export async function basvuruEylemi(veri: FormData): Promise<void> {
  const metin = (alan: string) => String(veri.get(alan) ?? "");

  const girdi = {
    tur: metin("tur"),
    ad: metin("ad"),
    soyad: metin("soyad"),
    eposta: metin("eposta"),
    telefon: metin("telefon"),
    ilKodu: metin("ilKodu"),
    sifre: metin("sifre"),
    sifreTekrar: metin("sifreTekrar"),
    mezunKurumKodu: metin("mezunKurumKodu"),
    mezuniyetYili: metin("mezuniyetYili"),
    paydasId: metin("paydasId"),
    gorevUnvani: metin("gorevUnvani"),
    beyan: metin("beyan"),
    // Yurt dışı, elle yazılan okul ve bugünkü durum (12 Kasım 2026).
    ulke: metin("ulke"),
    yurtDisiSehir: metin("yurtDisiSehir"),
    mezunOkulAdi: metin("mezunOkulAdi"),
    guncelDurum: metin("guncelDurum"),
    universite: metin("universite"),
    bolum: metin("bolum"),
    calistigiKurum: metin("calistigiKurum"),
    pozisyon: metin("pozisyon"),
    /*
     * MENTÖRLÜK (7 Ağustos 2026 · tek form). tur=MENTOR ise işaret gizli
     * alandan "evet" gelir; mezun ve paydaşta onay kutusundan.
     */
    mentorlukIstiyor: veri.get("mentorlukIstiyor") === "evet",
    mentorlukKonulari: metin("mentorlukKonulari"),
    mentorlukGrupIdleri: veri.getAll("mentorlukGrupId"),
  };

  // Hataya düşüldüğünde geri dönülecek adres: tür ve il korunur ki kişi
  // formun başına değil bıraktığı yere dönsün.
  const temelYol = `/basvuru?tur=${encodeURIComponent(girdi.tur)}&il=${encodeURIComponent(girdi.ilKodu)}`;

  const karar = disBasvuruGirdisiniCoz(girdi, new Date());
  if (!karar.olurMu) {
    redirect(`${temelYol}&hata=${encodeURIComponent(karar.neden)}`);
  }

  /*
   * Sınır BİÇİM DOĞRULAMASINDAN SONRA, veritabanına sorulmadan önce: boş
   * gönderilen bir form hakkı yakmamalı, ama hiçbir sorgu da çalışmamalı.
   */
  if (
    await basvuruSiniri.takildiMi(
      basliklardanAnahtar(await headers(), ortam.GUVENILEN_VEKIL_SAYISI),
    )
  ) {
    redirect(
      `${temelYol}&hata=${encodeURIComponent(
        `Kısa sürede çok fazla başvuru gönderildi. ${PENCERE_DAKIKA} dakika sonra tekrar deneyin.`,
      )}`,
    );
  }

  const sonuc = await disBasvuruOlustur(karar.kayit);
  if (sonuc.durum === "REDDEDILDI") {
    redirect(`${temelYol}&hata=${encodeURIComponent(sonuc.mesaj)}`);
  }

  /*
   * "SESSIZ" DE BURAYA DÜŞER: başvurunun açılmadığı (adres kayıtlı ya da
   * bekleyen başvuru var) durumda ekran, açıldığı durumdan AYIRT EDİLEMEZ
   * olmalı — ayrım tam da kapatılmak istenen sızıntıydı. Gerçek durumu
   * adresin sahibi e-postasında görüyor (bkz. dis-kimlik/basvuru.ts).
   */
  redirect("/basvuru?durum=alindi");
}
