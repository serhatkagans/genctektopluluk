import {
  adOzeti,
  adSayilariniTopla,
  adSoyadAnahtari,
  epostaIpucu,
} from "@/lib/kisi/ad-ozeti";

/**
 * Okul eşleştirme ekranındaki AYNI AD uyarısı (16 Kasım 2026 · Siirt
 * koordinatörü: "aynı isim olunca işler çok karıştı").
 */

describe("ad soyad anahtarı", () => {
  it("Türkçe küçük harf ve tek boşluk: yazım farkı aynı ad sayılır", () => {
    expect(adSoyadAnahtari("AHMET  ", "Yılmaz")).toBe(adSoyadAnahtari("Ahmet", "yılmaz"));
    expect(adSoyadAnahtari("İREM", "IŞIK")).toBe("irem ışık");
  });
});

describe("e-posta ipucu", () => {
  it("adresin yalnızca ilk iki harfi ve alanı görünür", () => {
    expect(epostaIpucu("betul.aslan@gmail.com")).toBe("be***@gmail.com");
  });

  it("boş ya da bozuk adreste ipucu yok", () => {
    expect(epostaIpucu(null)).toBeNull();
    expect(epostaIpucu("")).toBeNull();
    expect(epostaIpucu("adres-yok")).toBeNull();
  });
});

describe("aynı ad ve çift kayıt sayımı", () => {
  const kisiler = [
    // Eskişehir: aynı öğrenci iki kez kayıt olmuş (aynı e-posta).
    { ad: "Betül", soyad: "Aslan", eposta: "Betul@example.com" },
    { ad: "betül", soyad: "ASLAN", eposta: " betul@example.com " },
    // Siirt: aynı adlı üç akraba, farklı e-postalar.
    { ad: "Mehmet", soyad: "Kaya", eposta: "m1@example.com" },
    { ad: "Mehmet", soyad: "Kaya", eposta: "m2@example.com" },
    { ad: "Mehmet", soyad: "Kaya", eposta: null },
    // Kardeşler bir veli adresini paylaşıyor: adları farklı.
    { ad: "Elif", soyad: "Demir", eposta: "veli@example.com" },
    { ad: "Zeynep", soyad: "Demir", eposta: "veli@example.com" },
  ];
  const sayilar = adSayilariniTopla(kisiler);

  it("aynı ad + aynı e-posta = büyük olasılıkla iki kez kayıt olmuş tek kişi", () => {
    expect(adOzeti(sayilar, "Betül", "Aslan", "betul@example.com")).toEqual({
      ayniAdSayisi: 2,
      ciftKayitSayisi: 2,
    });
  });

  it("aynı ad, farklı e-posta = aynı adlı farklı kişiler (çift kayıt değil)", () => {
    expect(adOzeti(sayilar, "Mehmet", "Kaya", "m1@example.com")).toEqual({
      ayniAdSayisi: 3,
      ciftKayitSayisi: 1,
    });
    expect(adOzeti(sayilar, "Mehmet", "Kaya", null)).toEqual({
      ayniAdSayisi: 3,
      ciftKayitSayisi: 1,
    });
  });

  it("aynı e-posta, farklı ad (kardeşler) uyarı üretmez", () => {
    expect(adOzeti(sayilar, "Elif", "Demir", "veli@example.com")).toEqual({
      ayniAdSayisi: 1,
      ciftKayitSayisi: 1,
    });
  });

  it("listede olmayan kişi için sayılar 1'dir (yalnızca kendisi)", () => {
    expect(adOzeti(sayilar, "Ali", "Veli", "a@example.com")).toEqual({
      ayniAdSayisi: 1,
      ciftKayitSayisi: 1,
    });
  });
});
