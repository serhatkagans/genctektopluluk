-- Öğrenci ve öğretmenin kendi şifresini sıfırlaması (28 Ekim 2026 · istek:
-- "kullanıcılar şifrelerini unutunca sıfırlama için bir şey yok"). Dış
-- kimlikteki alanların aynısı: jetonun kendisi değil özeti tutulur.
ALTER TABLE "kayit_kimlik" ADD COLUMN "sifirlama_jetonu_ozeti" VARCHAR(200);
ALTER TABLE "kayit_kimlik" ADD COLUMN "sifirlama_son_gecerlilik" TIMESTAMPTZ(6);
