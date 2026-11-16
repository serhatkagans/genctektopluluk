/**
 * AYNI AD SOYAD (16 Kasım 2026 · Siirt koordinatörü: "aynı isim olunca işler
 * çok karıştı. 3 tane aynı isim soyisimli öğrenci var … çözene kadar epey
 * zaman geçti"). Kayıtta T.C. kimlik yok (SSO belirsiz), yani aynı adı taşıyan
 * farklı kişileri sistem ayıramaz; yapılabilen, koordinatöre bunu SÖYLEMEK ve
 * ayırt edecek bilgiyi kartın üstüne koymak: sınıf, kayıt zamanı, e-postanın
 * maskeli hâli.
 *
 * Anahtar Türkçe küçük harf ve tek boşluk: "AHMET  Yılmaz" ile "Ahmet yılmaz"
 * aynı kişi adıdır.
 */
export function adSoyadAnahtari(ad: string, soyad: string): string {
  return `${ad} ${soyad}`.toLocaleLowerCase("tr-TR").replace(/\s+/g, " ").trim();
}

/**
 * E-postanın ayırt etmeye yetecek kadarı: "ah***@gmail.com". Adresin tamamı
 * eşleştirme ekranına taşınmıyor — işi kişiyi ayırmak, ona yazmak değil.
 */
export function epostaIpucu(eposta: string | null | undefined): string | null {
  if (!eposta) return null;
  const [yerel, alan] = eposta.split("@");
  if (!yerel || !alan) return null;
  return `${yerel.slice(0, 2)}***@${alan}`;
}

/**
 * İldeki kişilerde her ad soyadın kaç kez geçtiği; ayrıca aynı ad soyadın
 * AYNI E-POSTAYLA kaç kez geçtiği. İkincisi "aynı adlı iki kişi" değil "iki
 * kez kayıt olmuş tek kişi" demek (Eskişehir'de bir öğrenci bir dakika arayla
 * iki hesap açmıştı) — koordinatöre ayrı söylenmeli.
 */
export type AdSayilari = { ad: Map<string, number>; adEposta: Map<string, number> };

export function adSayilariniTopla(
  kisiler: readonly { ad: string; soyad: string; eposta?: string | null }[],
): AdSayilari {
  const ad = new Map<string, number>();
  const adEposta = new Map<string, number>();
  for (const kisi of kisiler) {
    const anahtar = adSoyadAnahtari(kisi.ad, kisi.soyad);
    ad.set(anahtar, (ad.get(anahtar) ?? 0) + 1);
    const eposta = kisi.eposta?.trim().toLocaleLowerCase("tr-TR");
    if (eposta) {
      const ikili = `${anahtar}|${eposta}`;
      adEposta.set(ikili, (adEposta.get(ikili) ?? 0) + 1);
    }
  }
  return { ad, adEposta };
}

/** Kişinin ad sayısı ve aynı ad + e-postayla kaç kayıt olduğu (kendisi dahil). */
export function adOzeti(
  sayilar: AdSayilari,
  ad: string,
  soyad: string,
  eposta: string | null | undefined,
): { ayniAdSayisi: number; ciftKayitSayisi: number } {
  const anahtar = adSoyadAnahtari(ad, soyad);
  const temizEposta = eposta?.trim().toLocaleLowerCase("tr-TR");
  return {
    ayniAdSayisi: sayilar.ad.get(anahtar) ?? 1,
    ciftKayitSayisi: temizEposta
      ? (sayilar.adEposta.get(`${anahtar}|${temizEposta}`) ?? 1)
      : 1,
  };
}
