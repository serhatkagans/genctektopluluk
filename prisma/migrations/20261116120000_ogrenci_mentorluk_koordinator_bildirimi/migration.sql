-- Öğrencinin mentörlük başvurusu ilinin koordinatörüne de bildirilir
-- (16 Kasım 2026 · istek: "öğrencim mentör olarak başvurdu, onayı bize
-- düşecekti ama göremiyorum … koordinatörler mentör onayı verebilsin").
--
-- Koordinatör 27 Ağustos 2026'dan beri ilindeki öğrencinin mentörlüğüne karar
-- verebiliyordu (Öğrenciler ekranı · Mentörlük sütunu) ama başvurudan haberi
-- olmuyordu: uyarı yalnızca merkeze gidiyordu. Metin seed.ts ile aynı.

INSERT INTO "bildirim_sablonu" ("kod", "konu", "govde_sablonu")
VALUES (
  'ONAY_BEKLEYEN_OGRENCI_MENTORLUK',
  'Onayınızı bekleyen öğrenci mentörlük başvurusu: {{basvuranAdSoyad}}',
  'Merhaba,' || chr(10) || chr(10) ||
  'İlinizdeki öğrenci {{basvuranAdSoyad}} mentörlük başvurusu yaptı ve onayınızı bekliyor.' || chr(10) || chr(10) ||
  'Başvurduğu alanlar: {{kapsam}}' || chr(10) || chr(10) ||
  'Başvuruyu Öğrenciler ekranında "Görev / rol: Mentörlük onayı bekleyen" süzgeciyle bulup Mentörlük sütunundan onaylayabilir ya da gerekçesiyle reddedebilirsiniz.' || chr(10) || chr(10) ||
  'GençTek'
)
ON CONFLICT ("kod") DO NOTHING;
