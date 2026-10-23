-- DANIŞMAN ROLÜ OKULDAN BAĞIMSIZ (23 Ekim 2026)
--
-- Kayıt formunda okulu listede olmayan öğretmen okul adını elle yazıyor ve
-- kurum kodu boş kalıyor. Gerçek MEB okul listesi henüz yüklenmediği için
-- bu, öğretmenlerin ÇOĞU demek. Kısıt danışman rolünü bir okula bağlı
-- tuttuğu sürece hiçbir öğretmen danışman olamaz ve proje yöneticisi
-- atayacak öğretmen bulamazdı.
--
-- Danışman ataması artık il bazında ve yöneticinin elinde (bkz.
-- lib/danisman/politika.ts); öğretmen atanmış öğrencisini okuldan bağımsız
-- görüyor (bkz. lib/yetki/kapsam.ts). Okul kodu varsa yine yazılır.
--
-- Diğer rollerin koşulları DEĞİŞMEDİ.

ALTER TABLE "kullanici_rol" DROP CONSTRAINT IF EXISTS "ck_kullanici_rol_kapsam";

ALTER TABLE "kullanici_rol" ADD CONSTRAINT "ck_kullanici_rol_kapsam"
  CHECK (
    ("rol_kodu" = 'IL_KOORDINATOR' AND "il_kodu" IS NOT NULL)
    OR "rol_kodu" IN ('OGRENCI', 'PROJE_YONETICISI', 'DANISMAN')
    OR (
      "rol_kodu" IN ('MEZUN', 'PAYDAS_TEMSILCISI')
      AND "il_kodu" IS NULL
      AND "kurum_kodu" IS NULL
    )
  );
