-- Çalışma grubuna kısa açıklama (26 Ekim 2026): öğrenci grup seçerken adın
-- altında okur. Ayarlar ekranından düzenlenir. Metinler merkezin verdiği
-- haliyle; grup adı eşleşmezse (o ortamda grup yoksa) satır güncellenmez.
ALTER TABLE "calisma_grubu" ADD COLUMN "aciklama" VARCHAR(300);

UPDATE "calisma_grubu" SET "aciklama" = 'Fikirden oynanabilir oyuna uzanan üretim sürecini ekipçe deneyimle.' WHERE "ad" = 'Oyun Tasarımı' AND "aciklama" IS NULL;
UPDATE "calisma_grubu" SET "aciklama" = 'Algoritmik düşünmeyi olimpiyat kültürü içinde ileri düzeye taşı.' WHERE "ad" = 'Bilgisayar Olimpiyatları' AND "aciklama" IS NULL;
UPDATE "calisma_grubu" SET "aciklama" = 'Web teknolojileriyle gerçek ürünler geliştir, ekipçe yayına al.' WHERE "ad" = 'Web Programlama' AND "aciklama" IS NULL;
UPDATE "calisma_grubu" SET "aciklama" = 'Robotik sistemleri tasarla, programla ve gerçek ortamda test et.' WHERE "ad" = 'Robotik' AND "aciklama" IS NULL;
UPDATE "calisma_grubu" SET "aciklama" = 'Dijital bir ürünü pazara ve dünyaya açmanın yollarını öğren.' WHERE "ad" = 'E-Ticaret ve E-İhracat' AND "aciklama" IS NULL;
UPDATE "calisma_grubu" SET "aciklama" = 'Dijital araçlarla üret; portfolyonu ve anlatını birlikte geliştir.' WHERE "ad" = 'Dijital Sanatlar ve İçerik Geliştirme' AND "aciklama" IS NULL;
UPDATE "calisma_grubu" SET "aciklama" = 'Esporu oyunculuk, takım yönetimi, yayıncılık ve organizasyonla ele al.' WHERE "ad" = 'Espor' AND "aciklama" IS NULL;
UPDATE "calisma_grubu" SET "aciklama" = 'CTF ve uygulamalı senaryolarla güvenliği teknik yönleriyle keşfet.' WHERE "ad" = 'Siber Güvenlik' AND "aciklama" IS NULL;
UPDATE "calisma_grubu" SET "aciklama" = 'Kendi fikrini fikirden prototipe, prototipten ürüne dönüştür.' WHERE "ad" = 'Mobil Programlama' AND "aciklama" IS NULL;
UPDATE "calisma_grubu" SET "aciklama" = 'İHA ve uçuş sistemlerini uzmanlarla buluşarak yakından tanı.' WHERE "ad" = 'Havacılık Sistemleri' AND "aciklama" IS NULL;
UPDATE "calisma_grubu" SET "aciklama" = 'Yapay zekâyı kullanmakla kalma; nasıl çalıştığını anla ve uygula.' WHERE "ad" = 'Yapay Zekâ' AND "aciklama" IS NULL;
UPDATE "calisma_grubu" SET "aciklama" = 'Eğitimde bir ihtiyacı belirle, teknolojiyle çözüm prototipi geliştir.' WHERE "ad" = 'Eğitim Teknolojileri' AND "aciklama" IS NULL;
UPDATE "calisma_grubu" SET "aciklama" = 'İncele, geliştir, belgele ve ürettiğini toplulukla paylaş.' WHERE "ad" = 'Açık Kaynak' AND "aciklama" IS NULL;
UPDATE "calisma_grubu" SET "aciklama" = 'Dijital dünyada haklarını, sorumluluklarını ve güvenliği öğren.' WHERE "ad" = 'Bilişim Hukuku ve Güvenli İnternet' AND "aciklama" IS NULL;
UPDATE "calisma_grubu" SET "aciklama" = 'Dijital dünyada haklarını, sorumluluklarını ve güvenliği öğren.' WHERE "ad" = 'Bilişim Hukuku' AND "aciklama" IS NULL;
UPDATE "calisma_grubu" SET "aciklama" = 'Dijital dünyada haklarını, sorumluluklarını ve güvenliği öğren.' WHERE "ad" = 'Güvenli İnternet' AND "aciklama" IS NULL;
UPDATE "calisma_grubu" SET "aciklama" = 'Kız öğrencilerin teknolojide üretimini, liderliğini ve görünürlüğünü destekler.' WHERE "ad" = 'GençX' AND "aciklama" IS NULL;
UPDATE "calisma_grubu" SET "aciklama" = 'K12 Oyun Geliştirme Maratonu: 48 saatte fikirden oynanabilir oyuna.' WHERE "ad" = 'EğitiJAM' AND "aciklama" IS NULL;
