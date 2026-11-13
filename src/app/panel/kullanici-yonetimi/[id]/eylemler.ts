"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { oturumKullanicisiZorunlu } from "@/lib/auth/oturum";
import { kullaniciBilgileriniGuncelle } from "@/lib/kullanici-yonetimi/duzenleme";
import { kullaniciYoneticisiCoz } from "@/lib/yetki/izinler";
import { YetkiHatasi } from "@/lib/yetki/tipler";

/**
 * Kullanıcı bilgilerini düzenleme formu (13 Kasım 2026). Yetki ve il kısıtı
 * lib/kullanici-yonetimi/duzenleme.ts içinde yeniden sorulur: kişi id'si
 * formdan geliyor.
 */
export async function kullaniciDuzenleEylemi(veri: FormData): Promise<void> {
  const oturum = await oturumKullanicisiZorunlu();
  const yapan = kullaniciYoneticisiCoz(oturum);
  if (!yapan) {
    throw new YetkiHatasi("Kullanıcı yönetimi il koordinatörüne ve proje yöneticisine açık.");
  }

  const kullaniciId = Number.parseInt(String(veri.get("kullaniciId") ?? ""), 10);
  const metin = (alan: string) => String(veri.get(alan) ?? "");

  const sonuc = await kullaniciBilgileriniGuncelle(yapan, kullaniciId, {
    ad: metin("ad"),
    soyad: metin("soyad"),
    cinsiyet: metin("cinsiyet"),
    ilKodu: metin("ilKodu"),
    kurumKodu: metin("kurumKodu"),
    beyanOkulAdi: metin("beyanOkulAdi"),
    ilceKodu: metin("ilceKodu"),
    sinifSeviye: metin("sinifSeviye"),
    sube: metin("sube"),
    brans: metin("brans"),
    telefon: metin("telefon"),
    eposta: metin("eposta"),
  });

  revalidatePath("/panel/kullanici-yonetimi");
  const il = yapan.rol === "PROJE_YONETICISI" ? metin("ilKodu") : "";
  const sorgu = new URLSearchParams();
  if (il) sorgu.set("il", il);
  sorgu.set(sonuc.olduMu ? "durum" : "hata", sonuc.mesaj);
  redirect(`/panel/kullanici-yonetimi/${Number.isFinite(kullaniciId) ? kullaniciId : ""}?${sorgu}`);
}
