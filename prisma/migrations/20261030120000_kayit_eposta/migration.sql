-- Profili olmayan hesapların (proje yöneticisi gibi) e-postası (30 Ekim 2026).
-- "Şifremi unuttum" bağlantısı ve bildirim kopyaları profildeki adres yoksa
-- buraya gider.
ALTER TABLE "kayit_kimlik" ADD COLUMN "eposta" VARCHAR(150);
