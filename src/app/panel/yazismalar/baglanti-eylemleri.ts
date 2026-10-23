"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { oturumKullanicisiZorunlu } from "@/lib/auth/oturum";
import { BILDIRIM_KODLARI, bildirimGonder } from "@/lib/bildirim/gonder";
import { prisma } from "@/lib/db";
import { dogrudanYazisilabilirMi } from "@/lib/iletisim/kurallar";
import {
  koordinatorIlKodu,
  projeYoneticisiMi,
} from "@/lib/yetki/izinler";
import { erisimLogla } from "@/lib/yetki/log";
import { BulunamadiHatasi, YetkiHatasi } from "@/lib/yetki/tipler";
import {
  BAGLANTILARIM_KAPALI_ACIKLAMASI,
  baglantilarimKapaliMi,
} from "@/lib/yazisma/politika";

/**
 * Yazışmanın açılması.
 *
 * 21 Ağustos 2026'ya kadar tek yol bağlantı isteğiydi: kişi istek gönderir,
 * danışmanı ya da ilinin koordinatörü onaylar, yazışma o onayla açılırdı. O
 * akış tümüyle kalktı (istek: "bağlantılarımdan normal mesaj göndermeyi
 * tamamen kaldır"); dosyada kalan tek eylem, okul içi ve okul temsilcileriyle
 * onay beklemeden açılan yazışma.
 */

const YOL = "/panel/yazismalar";

function hataylaDon(yol: string, mesaj: string): never {
  redirect(`${yol}?hata=${encodeURIComponent(mesaj)}`);
}

/*
 * BAĞLANTI İSTEĞİ AKIŞI TAMAMEN KALKTI (21 Ağustos 2026 · istek:
 * "bağlantılarımdan normal mesaj göndermeyi tamamen kaldır").
 *
 * Silinen eylemler: `istegiKur` (ortak gövde), `baglantiIstegiGonderEylemi`
 * (panodaki ilandan), `kisiyeBaglantiIstegiEylemi` (akıştaki gönderiden) ve
 * `baglantiKarariEylemi` (danışman/koordinatör kararı). Üçünün de ekranı
 * kalktı; kodda tutulsalardı ulaşılamayan ama çağrılabilir sunucu eylemleri
 * olarak kalırlardı — bir sunucu eylemi, ekranı olmasa da adresi bilinirse
 * tetiklenebilir.
 *
 * GERİYE KALAN TEK YOL: okul içi ve okul temsilcileriyle doğrudan yazışma.
 *
 * VERİ VE MODEL DURUYOR: `baglanti_istegi` tablosu, geçmiş istekler ve onlara
 * bağlı yazışmalar yerinde; `Yazisma` hâlâ bir istek satırına bağlı ve aşağıdaki
 * eylem onu "onay gerekmedi" kaydıyla açıyor.
 */

/**
 * OKUL İÇİ VE OKUL TEMSİLCİSİYLE DOĞRUDAN YAZIŞMA (21 Ağustos 2026).
 *
 * İstek: "Bağlantılarım kısmı değişecek, kendi okulundaki herkesi görecek mesaj
 * atacak, okul temsilcilerinin hepsini görecek mesaj atabilecek."
 *
 * ONAY KAPISI YALNIZCA BU İKİ KÜME İÇİN AÇILIYOR; kimin kapsama girdiğine
 * kural katmanı karar veriyor (bkz. lib/iletisim/kurallar.ts ·
 * dogrudanYazisilabilirMi) ve karar HER İKİ tarafın veritabanındaki kaydına
 * bakarak veriliyor — form girdisinden yalnızca hedefin kimliği okunuyor.
 *
 * KAYIT MODELİ DEĞİŞMEDİ: yazışma yine bir `BaglantiIstegi` satırına bağlı
 * (`Yazisma`nın birincil anahtarı odur). Kayıt `ONAY_GEREKMEZ` olarak açılıyor:
 * "onaydan geçti" değil "onay gerekmedi" demek için; kararı kimin verdiği
 * sorulduğunda ortada bir karar yok.
 *
 * DURUM ÖNCE `ONAYLANDI` YAZILIYORDU ve mesaj gönderme ilk günden beri hata
 * veriyordu (26 Ağustos 2026 · hata kimliği 2929174704): veritabanındaki
 * `ck_baglanti_istegi_karari`, bekleyen olmayan her satırda karar verenin ve
 * karar tarihinin yazılı olmasını şart koşuyor, doğrudan yazışmada ise karar
 * veren yok. Kısıt haklıydı — yanlış olan, kararsız bir satıra "onaylandı"
 * demekti. Enumda bu durumun karşılığı zaten vardı.
 *
 * GÖZETİM AYNEN DURUYOR: bu yazışmayı da danışman, il koordinatörü ve proje
 * yöneticisi okuyabiliyor (yazismaKapsamFiltresi bağlantı isteğinin taraflarına
 * bakıyor ve burada da iki taraf yazılı).
 */
export async function dogrudanYazismaAcEylemi(veri: FormData): Promise<void> {
  const kullanici = await oturumKullanicisiZorunlu();
  if (baglantilarimKapaliMi(kullanici)) {
    throw new YetkiHatasi(BAGLANTILARIM_KAPALI_ACIKLAMASI);
  }

  const hedefId = Number.parseInt(String(veri.get("hedefId") ?? ""), 10);
  if (!Number.isFinite(hedefId)) throw new BulunamadiHatasi();

  /*
   * Hedefin kurum kodu ve okul temsilciliği VERİTABANINDAN okunuyor: ikisi de
   * kararın dayanağı ve ekrandan gelen bir değere güvenilseydi, listede hiç
   * görünmeyen bir kişiye yazışma açılabilirdi. Temsilcilik yürürlükteki
   * döneme bakıyor — geçen yılın temsilcisi bugün o görevde değil.
   */
  const hedef = await prisma.kullanici.findFirst({
    where: { id: hedefId, aktif: true },
    select: {
      id: true,
      ad: true,
      soyad: true,
      kurumKodu: true,
      gorevRolleri: {
        where: {
          rolKodu: "OKUL_TEMSILCISI",
          egitimOgretimYili: kullanici.egitimOgretimYili,
        },
        select: { id: true },
      },
    },
  });
  if (!hedef) {
    hataylaDon(YOL, "Bu kullanıcıya şu anda mesaj gönderilemiyor.");
  }

  /*
   * AYNI EKİPTEN Mİ? (31 Ağustos 2026 · istek: "Ekibindeki herkesi görsün
   * tıklanınca ve bireysel ve toplu mesaj atabilsin ekiptekilere").
   *
   * İKİ HÂL DE SAYILIYOR ve ikisi tek sorguda:
   *   · ÜYE–ÜYE — iki taraf da AÇIK bir ekibin üyesi. Ekip sohbetinde zaten
   *     birbirlerine yazıyorlar.
   *   · YÖNETİCİ–ÜYE — ekibi kuran il koordinatörü (ya da merkez) ekibin
   *     üyesi olmayabilir; `ekipSohbetiOkuyabilirMi` onu ekibin bir parçası
   *     sayıyor ve buradaki kapı da aynı kitleyi tanımalı. Saymasaydı,
   *     ekibini kuran koordinatör üyelerine birebir yazamazdı — isteğin tam
   *     olarak istediği şey bu.
   *
   * KAPALI EKİP SAYILMIYOR: arşive dönmüş bir ekip yeni bir kanal açmaz
   * (ekipSohbetineYazabilirMi ile aynı ayrım).
   *
   * KAPSAM VERİTABANINDAN: hedefin ekip üyeliği de, oturumdaki kişinin ekiple
   * ilişkisi de burada sorulur — ekrandan gelen bir "ekipId" değerine
   * güvenilseydi, hiç üyesi olmadığı bir ekibin kimliğini yazan kişi ilin
   * herhangi bir öğrencisine yazışma açabilirdi.
   */
  const yonetilenEkipKosulu = projeYoneticisiMi(kullanici)
    ? // Merkez her ekibi yönetir; ek bir daraltma yok.
      [{}]
    : (() => {
        const ilKodu = koordinatorIlKodu(kullanici);
        // Koordinatör değilse yönetilen ekip YOKTUR — koşul hiç eklenmiyor.
        return ilKodu ? [{ ilKodu }] : [];
      })();

  const ortakEkip = await prisma.ekip.findFirst({
    where: {
      aktif: true,
      uyeler: { some: { kullaniciId: hedef.id } },
      OR: [
        { uyeler: { some: { kullaniciId: kullanici.id } } },
        ...yonetilenEkipKosulu,
      ],
    },
    select: { id: true },
  });

  const karar = dogrudanYazisilabilirMi({
    isteyenId: kullanici.id,
    hedefId: hedef.id,
    isteyenKurumKodu: kullanici.kurumKodu,
    hedefKurumKodu: hedef.kurumKodu,
    hedefOkulTemsilcisiMi: hedef.gorevRolleri.length > 0,
    ayniEkiptenMi: ortakEkip !== null,
  });
  if (!karar.olurMu) {
    hataylaDon(YOL, karar.neden ?? "Bu kişiyle doğrudan yazışamazsınız.");
  }

  /*
   * ZATEN AÇIK BİR YAZIŞMA VARSA yenisi açılmaz, olana gidilir: aynı iki kişi
   * arasında iki konuşma, mesajların hangisinde olduğunu sorduran bir durum.
   * Bekleyen bir istek varsa da yeni kayıt açılmıyor — o isteğin kararını
   * beklemek gerekiyor, yoksa onay kuyruğunda anlamsız bir satır kalırdı.
   */
  const mevcut = await prisma.baglantiIstegi.findFirst({
    where: {
      onayDurumu: { in: ["ONAY_GEREKMEZ", "ONAYLANDI", "BEKLIYOR"] },
      OR: [
        { isteyenKullaniciId: kullanici.id, hedefKullaniciId: hedef.id },
        { isteyenKullaniciId: hedef.id, hedefKullaniciId: kullanici.id },
      ],
    },
    select: { id: true, onayDurumu: true, yazisma: { select: { baglantiIstegiId: true } } },
  });

  if (mevcut?.onayDurumu === "BEKLIYOR") {
    hataylaDon(
      YOL,
      "Bu kişiyle aranızda karar bekleyen bir bağlantı isteği var.",
    );
  }

  if (mevcut?.yazisma) {
    redirect(`${YOL}/${mevcut.yazisma.baglantiIstegiId}`);
  }

  const istekId = await prisma.$transaction(async (islem) => {
    const istek = mevcut
      ? // Onaylı bağlantı var ama yazışması açılmamış (ör. eski kayıt): kayıt
        // yeniden kurulmuyor, eksik olan yazışma tamamlanıyor.
        mevcut
      : await islem.baglantiIstegi.create({
          data: {
            isteyenKullaniciId: kullanici.id,
            hedefKullaniciId: hedef.id,
            /*
             * Bu metin EKRANDA GÖSTERİLMEZ, kaydın iç notudur (bkz. yazışma
             * sayfası). "Okul içi" diyordu; oysa aynı yol okul temsilcisiyle
             * yazışmayı da açıyor ve temsilcinin okulu farklı olabiliyor.
             */
            mesaj: "Doğrudan yazışma — onay gerekmedi.",
            // Karar veren ve karar tarihi BOŞ KALIR: ortada bir karar yok.
            onayDurumu: "ONAY_GEREKMEZ",
          },
          select: { id: true },
        });

    await islem.yazisma.create({ data: { baglantiIstegiId: istek.id } });
    return istek.id;
  });

  await bildirimGonder({
    kullaniciId: hedef.id,
    kod: BILDIRIM_KODLARI.YENI_YAZISMA,
    degiskenler: {
      isteyenAdSoyad: `${kullanici.ad} ${kullanici.soyad}`,
    },
  });

  await erisimLogla({
    kullaniciId: kullanici.id,
    islem: "DEGISIKLIK",
    hedefTip: "PROFIL",
    hedefId: hedef.id,
    detay: `Doğrudan yazışma açıldı: ${hedef.ad} ${hedef.soyad}`,
  });

  revalidatePath(YOL);
  redirect(`${YOL}/${istekId}`);
}
