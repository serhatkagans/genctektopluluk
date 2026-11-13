import { prisma } from "../db";
import { epostaGecerliMi, epostaNormalle, TELEFON_BICIMI } from "../dis-kimlik/kurallar";
import {
  AD_UST_SINIRI,
  adNormalle,
  BRANS_UST_SINIRI,
  okulSecimiCoz,
  sinifCoz,
} from "../kayit/kurallar";
import { type KullaniciYoneticisi, kullaniciSifresiYonetebilirMi } from "../yetki/izinler";
import { erisimLogla } from "../yetki/log";
import { hedefiGetir, type IslemSonucu } from "./islemler";

/**
 * KULLANICI BİLGİLERİNİ DÜZENLEME (13 Kasım 2026 · istek: "tüm alanları
 * düzenleme sayfası olsun"; örnek: "görevlendirme olduğu okulda danışman
 * ancak kendi kadrosu ortaokulda, o okulun adıyla kayıt olmuş").
 *
 * Düzenlenen: ad, soyad, cinsiyet, il, okul (listeden ya da elle yazılmış
 * ad), ilçe, öğrencide sınıf, öğretmende branş, telefon; e-posta yalnızca
 * proje yöneticisinde (şifre sıfırlama bağlantısı oraya gider).
 *
 * İL KOORDİNATÖRÜNDE İL SABİT: okul yalnızca onun ilinden seçilir, kişi
 * başka ile taşınamaz. Kişi gerçekten başka ildeyse taşıma proje
 * yöneticisinin işi — aksi hâlde koordinatör kaydı kapsamından çıkarıp
 * geri alamazdı.
 *
 * OKUL DEĞİŞİNCE (okul eşleştirmesiyle aynı kural · okul/eslestirme-islem.ts):
 * ilçe okulun ilçesi olur, elle yazılmış ad temizlenir, açık danışmanlık
 * rolünün okulu da değişir. Okula bağlanan ve hiç rolü olmayan öğretmene
 * danışman rolü açılır — kayıtta okulsuz öğretmene rol verilmiyordu
 * (kullanici/sagla.ts), okulu düzelince bekleyecek bir şey kalmıyor.
 *
 * Mevcut danışmanlık bağları (öğrencinin danışmanı, öğretmenin öğrencileri)
 * olduğu gibi kalır; onları değiştirmek danışman atama ekranının işi.
 */
export interface DuzenlemeGirdisi {
  ad: string;
  soyad: string;
  cinsiyet: string;
  ilKodu: string;
  kurumKodu: string;
  beyanOkulAdi: string;
  ilceKodu: string;
  sinifSeviye: string;
  sube: string;
  brans: string;
  telefon: string;
  eposta: string;
}

export async function kullaniciBilgileriniGuncelle(
  yonetici: KullaniciYoneticisi,
  hedefId: number,
  girdi: DuzenlemeGirdisi,
): Promise<IslemSonucu> {
  const sonuc = await hedefiGetir(yonetici, hedefId);
  if (!sonuc) return { olduMu: false, mesaj: "Kullanıcı bulunamadı." };
  if ("hata" in sonuc) return { olduMu: false, mesaj: sonuc.hata };

  const mevcut = await prisma.kullanici.findUniqueOrThrow({
    where: { id: hedefId },
    select: {
      ad: true,
      soyad: true,
      cinsiyet: true,
      ilKodu: true,
      ilceKodu: true,
      kurumKodu: true,
      beyanOkulAdi: true,
      sinif: true,
      brans: true,
      kurum: { select: { ad: true } },
      roller: { where: { bitisTarihi: null }, select: { rolKodu: true } },
      ogrenciProfil: { select: { eposta: true, telefon: true } },
      ogretmenProfil: { select: { eposta: true, telefon: true } },
    },
  });
  const ogrenciMi = mevcut.roller.some((rol) => rol.rolKodu === "OGRENCI");

  const ad = adNormalle(girdi.ad);
  const soyad = adNormalle(girdi.soyad);
  if (!ad || !soyad) return { olduMu: false, mesaj: "Ad ve soyad zorunludur." };
  if (ad.length > AD_UST_SINIRI || soyad.length > AD_UST_SINIRI) {
    return { olduMu: false, mesaj: `Ad ve soyad en fazla ${AD_UST_SINIRI} karakter olabilir.` };
  }
  if (girdi.cinsiyet !== "E" && girdi.cinsiyet !== "K") {
    return { olduMu: false, mesaj: "Cinsiyeti seçin." };
  }

  // İl: koordinatörde kendi ili, formdaki değere bakılmaz.
  const ilKodu = yonetici.rol === "IL_KOORDINATOR" ? yonetici.ilKodu : girdi.ilKodu.trim();
  if (!/^\d{2}$/.test(ilKodu) || !(await prisma.il.findUnique({ where: { ilKodu } }))) {
    return { olduMu: false, mesaj: "İli seçin." };
  }

  const okul = okulSecimiCoz(girdi.kurumKodu, girdi.beyanOkulAdi);
  if (!okul.olurMu) return { olduMu: false, mesaj: okul.neden };
  let ilceKodu: string | null;
  if (okul.kurumKodu !== null) {
    const kurum = await prisma.kurum.findUnique({
      where: { kurumKodu: okul.kurumKodu },
      select: { ilKodu: true, ilceKodu: true, aktif: true },
    });
    if (!kurum || !kurum.aktif) return { olduMu: false, mesaj: "Seçilen okul bulunamadı." };
    if (kurum.ilKodu !== ilKodu) {
      return { olduMu: false, mesaj: "Seçilen okul seçilen ilde değil." };
    }
    ilceKodu = kurum.ilceKodu;
  } else {
    ilceKodu = girdi.ilceKodu.trim() || null;
    if (ilceKodu) {
      const ilce = await prisma.ilce.findUnique({ where: { ilceKodu }, select: { ilKodu: true } });
      if (!ilce || ilce.ilKodu !== ilKodu) {
        return { olduMu: false, mesaj: "İlçeyi ilin listesinden seçin." };
      }
    }
  }

  let sinif = mevcut.sinif;
  let brans = mevcut.brans;
  if (ogrenciMi) {
    const karar = sinifCoz(girdi.sinifSeviye, girdi.sube);
    if (!karar.olurMu) return { olduMu: false, mesaj: karar.neden };
    sinif = karar.sinif;
  } else {
    brans = adNormalle(girdi.brans) || null;
    if (brans && brans.length > BRANS_UST_SINIRI) {
      return { olduMu: false, mesaj: `Branş en fazla ${BRANS_UST_SINIRI} karakter olabilir.` };
    }
  }

  const profil = ogrenciMi ? mevcut.ogrenciProfil : mevcut.ogretmenProfil;
  const telefon = girdi.telefon.trim().replace(/\s+/g, " ") || null;
  if (telefon && (!TELEFON_BICIMI.test(telefon) || telefon.replace(/\D/g, "").length < 10)) {
    return { olduMu: false, mesaj: "Telefon numarası geçerli değil." };
  }
  let eposta = profil?.eposta ?? null;
  if (kullaniciSifresiYonetebilirMi(yonetici)) {
    eposta = epostaNormalle(girdi.eposta);
    if (!epostaGecerliMi(eposta)) {
      return { olduMu: false, mesaj: "Geçerli bir e-posta adresi yazın." };
    }
  }

  // Denetim kaydı için neyin değiştiği. İletişim bilgisinin değeri yazılmaz.
  const degisenler: string[] = [];
  if (ad !== mevcut.ad || soyad !== mevcut.soyad) {
    degisenler.push(`ad soyad: ${mevcut.ad} ${mevcut.soyad} → ${ad} ${soyad}`);
  }
  if (girdi.cinsiyet !== mevcut.cinsiyet) degisenler.push("cinsiyet");
  if (ilKodu !== mevcut.ilKodu) degisenler.push(`il: ${mevcut.ilKodu ?? "—"} → ${ilKodu}`);
  if (okul.kurumKodu !== mevcut.kurumKodu || okul.beyanOkulAdi !== mevcut.beyanOkulAdi) {
    degisenler.push(
      `okul: ${mevcut.kurum?.ad ?? mevcut.beyanOkulAdi ?? "—"} → ${okul.kurumKodu ?? okul.beyanOkulAdi}`,
    );
  }
  if (ilceKodu !== mevcut.ilceKodu) degisenler.push("ilçe");
  if (sinif !== mevcut.sinif) degisenler.push(`sınıf: ${mevcut.sinif ?? "—"} → ${sinif}`);
  if (brans !== mevcut.brans) degisenler.push(`branş: ${mevcut.brans ?? "—"} → ${brans ?? "—"}`);
  if (telefon !== (profil?.telefon ?? null)) degisenler.push("telefon");
  if (eposta !== (profil?.eposta ?? null)) degisenler.push("e-posta");
  if (degisenler.length === 0) return { olduMu: false, mesaj: "Değişiklik yok." };

  const danismanRoluAcilacak =
    !ogrenciMi && mevcut.roller.length === 0 && okul.kurumKodu !== null;
  const iletisim = { telefon, eposta };

  await prisma.$transaction([
    prisma.kullanici.update({
      where: { id: hedefId },
      data: {
        ad,
        soyad,
        cinsiyet: girdi.cinsiyet,
        ilKodu,
        ilceKodu,
        kurumKodu: okul.kurumKodu,
        beyanOkulAdi: okul.beyanOkulAdi,
        // Listeden okul seçildiyse elle yazılmış tür de iş bitti, temizlenir.
        ...(okul.kurumKodu !== null ? { beyanOkulTuru: null } : {}),
        sinif,
        brans,
      },
    }),
    prisma.kullaniciRol.updateMany({
      where: { kullaniciId: hedefId, rolKodu: "DANISMAN", bitisTarihi: null },
      data: { kurumKodu: okul.kurumKodu },
    }),
    ...(danismanRoluAcilacak
      ? [
          prisma.kullaniciRol.create({
            data: {
              kullaniciId: hedefId,
              rolKodu: "DANISMAN",
              kurumKodu: okul.kurumKodu,
              atayanKullaniciId: yonetici.id,
              aciklama: "Kullanıcı yönetiminde okulu düzeltilince açıldı",
            },
          }),
        ]
      : []),
    ogrenciMi
      ? prisma.ogrenciProfil.upsert({
          where: { kullaniciId: hedefId },
          update: iletisim,
          create: { kullaniciId: hedefId, ...iletisim },
        })
      : prisma.ogretmenProfil.upsert({
          where: { kullaniciId: hedefId },
          update: iletisim,
          create: { kullaniciId: hedefId, ...iletisim },
        }),
  ]);

  if (danismanRoluAcilacak) degisenler.push("danışman rolü açıldı");
  await erisimLogla({
    kullaniciId: yonetici.id,
    islem: "DEGISIKLIK",
    hedefTip: "PROFIL",
    hedefId,
    detay: `Kullanıcı yönetimi (${yonetici.rol === "IL_KOORDINATOR" ? `il koordinatörü, ${yonetici.ilKodu}` : "proje yöneticisi"}): bilgiler düzenlendi (${ad} ${soyad}) · ${degisenler.join(" · ")}`.slice(0, 2000),
  });

  return { olduMu: true, mesaj: `${ad} ${soyad} kaydı güncellendi.` };
}
