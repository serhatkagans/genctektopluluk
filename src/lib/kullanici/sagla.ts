import { yeniDanismanBildirimiYap } from "../danisman/atama";
import type { AuthKimlik } from "../auth/tipler";
import { prisma } from "../db";

/**
 * Kullanıcı sağlama (provisioning) — references/domain-rules.md Bölüm 1.
 *
 * İlk girişte kullanıcı oluşturulur. Rol tayini:
 *   - Öğrenci  → OGRENCI rolü
 *   - Öğretmen → okulu kayıtlıysa DANISMAN (27 Ağustos 2026'dan beri ilk
 *                girişte kendiliğinden; ayrıntı aşağıdaki blokta), okulu
 *                yoksa ROLSÜZ
 *   - Personel → ROLSÜZ; IL_KOORDINATOR ve PROJE_YONETICISI asla otomatik
 *                verilmez, elle atanır
 *
 * Sonraki girişlerde AuthProvider'dan gelen alanlar güncellenir. Bu alanlar
 * salt okunurdur: yalnızca burada, kimlik kaynağından güncellenir.
 */

export interface SaglamaSonucu {
  kullaniciId: number;
  yeniKullaniciMi: boolean;
  /** Kurum kodu değiştiyse devir akışı tetiklenmelidir (Bölüm 3). */
  eskiKurumKodu: number | null;
  kurumKoduDegistiMi: boolean;
}

export async function kullaniciSagla(
  kimlik: AuthKimlik,
): Promise<SaglamaSonucu> {
  if (kimlik.kurumKodu !== null) {
    const kurum = await prisma.kurum.findUnique({
      where: { kurumKodu: kimlik.kurumKodu },
      select: { kurumKodu: true },
    });
    if (!kurum) {
      throw new Error(
        `Kimlikte gelen kurum kodu (${kimlik.kurumKodu}) referans tablosunda yok. ` +
          "İl/ilçe/kurum verisi yüklenmeden kullanıcı oluşturulamaz.",
      );
    }
  }

  const mevcut = await prisma.kullanici.findUnique({
    where: { authProviderId: kimlik.authProviderId },
    select: { id: true, kurumKodu: true },
  });

  /*
   * Öğretmen ilk girişte danışman OLUYOR mu? Karar işlemin dışında veriliyor
   * çünkü sonrasında bildirim gönderimi de buna bakıyor (aşağıdaki bloğa bkz.).
   */
  /*
   * OKULSUZ ÖĞRETMEN DE DANIŞMAN OLUR (23 Ekim 2026 · migration
   * 20261023150000). Okul listesi henüz gerçek MEB verisi değil ve öğretmenlerin
   * çoğu okulunu elle yazıyor; atamayı da proje yöneticisi il bazında yapıyor.
   * Rol kaydındaki kurum kodu varsa yazılır, yoksa boş kalır.
   */
  const danismanOlabilir = kimlik.tip === "OGRETMEN";

  if (!mevcut) {
    const olusan = await prisma.$transaction(async (islem) => {
      const kullanici = await islem.kullanici.create({
        data: {
          authProviderId: kimlik.authProviderId,
          ad: kimlik.ad,
          soyad: kimlik.soyad,
          cinsiyet: kimlik.cinsiyet,
          kurumKodu: kimlik.kurumKodu,
          ilKodu: kimlik.ilKodu,
          ilceKodu: kimlik.ilceKodu,
          sinif: kimlik.sinif,
          brans: kimlik.brans,
          egitimOgretimYili: kimlik.egitimOgretimYili,
        },
        select: { id: true },
      });

      if (kimlik.tip === "OGRENCI") {
        await islem.kullaniciRol.create({
          data: { kullaniciId: kullanici.id, rolKodu: "OGRENCI" },
        });
        await islem.ogrenciProfil.create({
          data: { kullaniciId: kullanici.id },
        });
      } else if (kimlik.tip === "OGRETMEN") {
        /*
         * ÖĞRETMEN İLK GİRİŞTE DOĞRUDAN DANIŞMAN OLUR (27 Ağustos 2026 · istek:
         * "bu onay var buna gerek yok, sisteme giriş yapınca direk danışman
         * olsun").
         *
         * Önce rol VERİLMİYORDU: öğretmen Panelim'deki "Görevi işaretle"
         * düğmesine basana kadar rolsüz kalıyor, öğrencilerin danışman seçim
         * listesinde görünmüyor ve Öğrencilerim ekranını açamıyordu. O adım bir
         * onay değil, yalnızca bir kutuydu — kimse reddetmiyordu, dolayısıyla
         * herkesin tek tek geçtiği boş bir kapıydı.
         *
         * OKULSUZ ÖĞRETMENE DE ROL VERİLİR (23 Ekim 2026): rol kaydındaki kurum
         * kodu boş kalır; danışman atanmış öğrencisini okuldan bağımsız görür
         * (bkz. yetki/kapsam.ts). Eski kural: "okulu olmayana rol verilmez".
         *
         * BIRAKMA AKIŞI DEĞİŞMEDİ ve bu yüzden rol YALNIZCA OLUŞTURMADA
         * veriliyor, her girişte değil: görevi bırakan öğretmen bir sonraki
         * girişinde yeniden danışman yapılsaydı, kendi kararı sessizce geri
         * alınırdı (bkz. danismanlikDurumunuDegistir).
         */
        await islem.ogretmenProfil.create({
          data: {
            kullaniciId: kullanici.id,
            danismanOlmakIstiyor: danismanOlabilir,
            isaretlemeTarihi: danismanOlabilir ? new Date() : null,
          },
        });
        if (danismanOlabilir) {
          await islem.kullaniciRol.create({
            data: {
              kullaniciId: kullanici.id,
              rolKodu: "DANISMAN",
              kurumKodu: kimlik.kurumKodu,
            },
          });
        }
      }

      return kullanici;
    });

    /*
     * OKULA DANIŞMAN GELDİ HABERİ — ROLÜ VEREN YERE BAĞLI (3 Eylül 2026).
     *
     * Bu çağrı 27 Ağustos'ta (98321a9) DÜŞMÜŞTÜ ve kimse fark etmedi. O gün rol
     * verme işi "Görevi işaretle" düğmesinden (ogretmen/danismanlik.ts) buraya,
     * ilk girişe taşındı; bildirim ise düğmede kaldı. Sonuç: öğrencileri il
     * koordinatörüne bağlı bir okula öğretmen ilk kez giriş yaptığında
     * koordinatöre "bu okulda artık danışman var, N öğrenci devredilebilir"
     * haberi HİÇ gitmiyordu ve öğrenciler koordinatörde süresiz kalıyordu.
     * Düğme yolu da kurtarmıyor: orada gönderim `!danismanRolu` koşuluna bağlı
     * ve öğretmen bu noktada zaten danışman.
     *
     * Bildirim İŞLEMİN DIŞINDA: kendi yazmalarını yapıyor ve başarısız olması
     * kullanıcının oluşmasını geri almamalı. Rolü veren satırla bu satır BİRLİKTE
     * okunmalı — ayrı düşmeleri bu arızayı doğurdu.
     */
    if (danismanOlabilir && kimlik.kurumKodu !== null) {
      await yeniDanismanBildirimiYap(kimlik.kurumKodu);
    }

    return {
      kullaniciId: olusan.id,
      yeniKullaniciMi: true,
      eskiKurumKodu: null,
      kurumKoduDegistiMi: false,
    };
  }

  const kurumKoduDegistiMi = mevcut.kurumKodu !== kimlik.kurumKodu;

  await prisma.kullanici.update({
    where: { id: mevcut.id },
    data: {
      ad: kimlik.ad,
      soyad: kimlik.soyad,
      cinsiyet: kimlik.cinsiyet,
      kurumKodu: kimlik.kurumKodu,
      ilKodu: kimlik.ilKodu,
      ilceKodu: kimlik.ilceKodu,
      sinif: kimlik.sinif,
      brans: kimlik.brans,
      egitimOgretimYili: kimlik.egitimOgretimYili,
      sonSenkronTarihi: new Date(),
    },
  });

  return {
    kullaniciId: mevcut.id,
    yeniKullaniciMi: false,
    eskiKurumKodu: mevcut.kurumKodu,
    kurumKoduDegistiMi,
  };
}

// Salt okunur alan koruması ve ilgili sabitler için: ./salt-okunur.ts
