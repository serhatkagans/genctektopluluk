"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { oturumKullanicisiZorunlu } from "@/lib/auth/oturum";
import {
  ogrenciDanismaniniBirakti,
  ogrenciDanismanSecti,
} from "@/lib/danisman/atama";
import {
  ATAMAYI_YALNIZCA_YONETICI_YAPAR,
  YONETICI_ATAR_ACIKLAMASI,
} from "@/lib/danisman/politika";
import { talebimiGeriCek } from "@/lib/danisman/talep";
import { ogrenciMi } from "@/lib/yetki/izinler";
import { erisimLogla } from "@/lib/yetki/log";
import { YetkiHatasi } from "@/lib/yetki/tipler";

/**
 * Seçimden sonra dönülecek adres.
 *
 * Form iki yerden gönderiliyor (Panelim'deki bölüm ve `/panel/danisman-secim`
 * kapısı); dönüş adresi sabitlenirse Panelim'den seçim yapan öğrenci başka bir
 * ekrana atılır. Değer FORMDAN geliyor, o yüzden serbest bırakılamaz: açık
 * yönlendirme (open redirect) açığı doğar. Yalnızca bilinen iki yol kabul
 * edilir, tanınmayan değer kapıya döner.
 */
const IZINLI_DONUS_YOLLARI = ["/panel", "/panel/danisman-secim"] as const;

function donusYolunuCoz(veri: FormData): string {
  const istenen = String(veri.get("donusYolu") ?? "");
  return (IZINLI_DONUS_YOLLARI as readonly string[]).includes(istenen)
    ? istenen
    : "/panel/danisman-secim";
}

export async function danismanSecEylemi(veri: FormData): Promise<void> {
  const kullanici = await oturumKullanicisiZorunlu();

  // Danışman seçimini yalnızca öğrencinin kendisi yapar.
  if (!ogrenciMi(kullanici)) {
    throw new YetkiHatasi("Danışman seçimi yalnızca öğrenciler içindir.");
  }

  const donusYolu = donusYolunuCoz(veri);
  const capa = donusYolu === "/panel" ? "#danismanim" : "";

  // Atamayı yalnızca proje yöneticisi yapar (23 Ekim 2026 · bkz. politika.ts).
  if (ATAMAYI_YALNIZCA_YONETICI_YAPAR) {
    redirect(
      `${donusYolu}?hata=${encodeURIComponent(YONETICI_ATAR_ACIKLAMASI)}${capa}`,
    );
  }

  const secilenId = Number.parseInt(String(veri.get("danismanId") ?? ""), 10);
  if (!Number.isFinite(secilenId)) {
    redirect(`${donusYolu}?hata=Ge%C3%A7ersiz+se%C3%A7im${capa}`);
  }

  /*
   * SEÇİM İKİ SONUÇ DOĞURABİLİR (20 Ağustos 2026 · istek: "danışman öğretmen
   * seçiminde öğretmene veya il koordinatörüne onay düşsün").
   *
   * İlk seçim atanır, DEĞİŞİKLİK onaya gider. Ekran hangisinin olduğunu
   * söylemek zorunda: aynı "kaydedildi" mesajı basılsaydı, danışmanını
   * değiştirmek isteyen öğrenci işlemin bittiğini sanır ve listede eski
   * öğretmenini görünce hata sanırdı.
   */
  const sonuc = await ogrenciDanismanSecti(kullanici.id, secilenId);

  if (sonuc.tur === "BEKLEYEN_TALEP_VAR") {
    redirect(
      `${donusYolu}?hata=${encodeURIComponent(
        `${sonuc.istenenAdSoyad} için gönderdiğiniz talep hâlâ cevap bekliyor. Yeni bir talep açmadan önce onu geri çekmeniz gerekiyor.`,
      )}${capa}`,
    );
  }

  await erisimLogla({
    kullaniciId: kullanici.id,
    islem: "DEGISIKLIK",
    hedefTip: "DANISMAN_ATAMA",
    hedefId: kullanici.id,
    detay:
      sonuc.tur === "ONAYA_GONDERILDI"
        ? `Danışman değişikliği talebi açıldı: ${secilenId}`
        : `Danışman seçildi: ${secilenId}`,
  });

  revalidatePath("/panel/danisman-secim");
  revalidatePath("/panel");
  redirect(
    `${donusYolu}?durum=${
      sonuc.tur === "ONAYA_GONDERILDI" ? "talep-gonderildi" : "secildi"
    }${capa}`,
  );
}

/**
 * Öğrenci bekleyen talebinden vazgeçer.
 *
 * Talep kimliği FORMDAN gelir ama kural katmanı onu öğrencinin KENDİ kimliğiyle
 * birlikte arıyor (bkz. talep.ts · talebimiGeriCek): başka bir öğrencinin talep
 * numarasını yazan kişi hiçbir satır bulamaz.
 */
export async function danismanTalebimiGeriCekEylemi(
  veri: FormData,
): Promise<void> {
  const kullanici = await oturumKullanicisiZorunlu();

  if (!ogrenciMi(kullanici)) {
    throw new YetkiHatasi("Danışman talebi yalnızca öğrencilere aittir.");
  }

  const donusYolu = donusYolunuCoz(veri);
  const capa = donusYolu === "/panel" ? "#danismanim" : "";
  const talepId = Number.parseInt(String(veri.get("talepId") ?? ""), 10);

  if (!Number.isFinite(talepId) || !(await talebimiGeriCek(talepId, kullanici.id))) {
    redirect(
      `${donusYolu}?hata=${encodeURIComponent(
        "Geri çekilecek bekleyen bir talebiniz bulunamadı.",
      )}${capa}`,
    );
  }

  await erisimLogla({
    kullaniciId: kullanici.id,
    islem: "DEGISIKLIK",
    hedefTip: "DANISMAN_ATAMA",
    hedefId: kullanici.id,
    detay: "Danışman değişikliği talebi geri çekildi",
  });

  revalidatePath("/panel/danisman-secim");
  revalidatePath("/panel");
  redirect(`${donusYolu}?durum=talep-geri-cekildi${capa}`);
}

/**
 * Öğrenci danışmanlığı kendisi sonlandırır (11 Ağustos 2026).
 *
 * Yetki `ogrenciMi` ile sorulur ve kimin bırakıldığı FORMDAN ALINMAZ: eylem
 * her zaman oturumdaki öğrencinin kendi atamasını kapatır. Öğrenci kimliği
 * parametre olsaydı, form gövdesine başka bir kimlik yazan öğrenci
 * başkasının danışmanlığını sonlandırabilirdi.
 */
export async function danismaniBirakEylemi(veri: FormData): Promise<void> {
  const kullanici = await oturumKullanicisiZorunlu();

  if (!ogrenciMi(kullanici)) {
    throw new YetkiHatasi(
      "Danışmanlığı yalnızca öğrencinin kendisi sonlandırabilir.",
    );
  }

  const donusYolu = donusYolunuCoz(veri);
  const capa = donusYolu === "/panel" ? "#danismanim" : "";

  const sonuc = await ogrenciDanismaniniBirakti(kullanici.id);

  if (!sonuc.olurMu) {
    redirect(`${donusYolu}?hata=${encodeURIComponent(sonuc.neden)}${capa}`);
  }

  await erisimLogla({
    kullaniciId: kullanici.id,
    islem: "DEGISIKLIK",
    hedefTip: "DANISMAN_ATAMA",
    hedefId: kullanici.id,
    detay: `Öğrenci danışmanlığı sonlandırdı: ${sonuc.eskiDanismanAdSoyad}`,
  });

  revalidatePath("/panel/danisman-secim");
  revalidatePath("/panel");
  redirect(`${donusYolu}?durum=birakildi${capa}`);
}
