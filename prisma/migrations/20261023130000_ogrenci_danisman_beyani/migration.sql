-- ÖĞRENCİNİN DANIŞMAN ÖĞRETMEN BEYANI (23 Ekim 2026)
--
-- Öğrenci panelinde danışman öğretmeninin adını, soyadını, branşını,
-- telefonunu ve e-postasını yazabilir. Sistemdeki danışman ataması
-- (danisman_atama) değildir ve hiçbir yetki doğurmaz; hepsi isteğe bağlı.

ALTER TABLE "ogrenci_profil"
  ADD COLUMN "beyan_danisman_ad"      VARCHAR(100),
  ADD COLUMN "beyan_danisman_soyad"   VARCHAR(100),
  ADD COLUMN "beyan_danisman_brans"   VARCHAR(100),
  ADD COLUMN "beyan_danisman_telefon" VARCHAR(20),
  ADD COLUMN "beyan_danisman_eposta"  VARCHAR(150);
