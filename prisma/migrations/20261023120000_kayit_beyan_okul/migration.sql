-- KAYITTA LİSTEDE OLMAYAN OKUL (23 Ekim 2026)
--
-- Kayıt formunda okulunu listede bulamayan öğrenci/öğretmen okul adını elle
-- yazar; öğrenci ayrıca okul türünü seçer. Bu kişide kurum_kodu boş kalır ve
-- yazılan bilgi burada durur. Kurum satırı açılmaz: kurum kodu MEB'in
-- numarasıdır, doğrulanmamış bir ad referans tabloya girmemeli.

ALTER TABLE "kullanici"
  ADD COLUMN "beyan_okul_adi"  VARCHAR(250),
  ADD COLUMN "beyan_okul_turu" VARCHAR(120);
