-- Mezun ve mentör başvurusunda bugünkü durum ve yurt dışı (12 Kasım 2026).
-- İstek: "Mezun, üniversite, çalışıyor", "ülke dışında da olabilir",
-- "bir şirket çalışanı, şirketi olan da olabilir".
CREATE TYPE "GuncelDurum" AS ENUM ('UNIVERSITE', 'SIRKET_CALISANI', 'SIRKET_SAHIBI', 'DIGER');

-- Yurt dışından başvuranın ili yok.
ALTER TABLE "dis_kullanici_basvurusu" ALTER COLUMN "il_kodu" DROP NOT NULL;

ALTER TABLE "dis_kullanici_basvurusu"
  ADD COLUMN "ulke" VARCHAR(100),
  ADD COLUMN "yurt_disi_sehir" VARCHAR(100),
  ADD COLUMN "guncel_durum" "GuncelDurum",
  ADD COLUMN "universite" VARCHAR(250),
  ADD COLUMN "bolum" VARCHAR(150),
  ADD COLUMN "calistigi_kurum" VARCHAR(250),
  ADD COLUMN "pozisyon" VARCHAR(150),
  ADD COLUMN "mezun_okul_adi" VARCHAR(250);
