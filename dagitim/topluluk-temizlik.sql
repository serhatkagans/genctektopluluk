-- GençTek Topluluk — örnek veri temizliği (23 Ekim 2026 · istek: "temizleyelim,
-- sadece gerçek kullanıcıların verisi kalsın").
--
-- ÇAĞIRAN İŞLEMİ YÖNETİR: bu dosya BEGIN/COMMIT içermez. topluluk-temizlik.sh
-- varsayılan olarak sonunda ROLLBACK yapar (kuru çalıştırma, yalnızca rapor);
-- UYGULA=evet verilirse COMMIT. psql'e özel komut yok — yerelde node pg ile de
-- aynen çalışır.
--
-- NE YAPAR:
--   1. TEST/PİLOT KULLANICILARI SİLER: T.C. numarası "999" ile başlayanlar
--      (pilot veri betiğinin uydurduğu numaralar). Kullanıcıya bağlı satırlar
--      katalogdan bulunur: kolon boş bırakılabiliyorsa NULL'lanır, zorunluysa
--      satır silinir. Böylece gerçek bir kullanıcının kaydı, yalnızca bir test
--      kullanıcısına "atayan/onaylayan" olarak değiyorsa silinmez.
--   2. SAHTE OKULLAR: örnek veri (kurum kodu ≥ 800000) ve başlangıç verisinin
--      dört deneme okulu (750001–750004). Hepsi pasife alınır; kalan
--      kullanıcıların ve danışman rollerinin bu okullara bağı kaldırılır.
--      Örnek veri okulları başka kayda bağlı değilse silinir (deneme okullarını
--      başlangıç verisi her yayında yeniden açtığı için onlar pasif kalır).
--   3. SAHTE İLÇELER: örnek verinin her ile açtığı "il kodu + 90" ilçeleri.
--      Kullanıcı bağları kaldırılır; başka kayda bağlı değilse silinir.
--
-- Gerçek MEB okul/ilçe listesi yüklendiğinde bu dosya tekrar ÇALIŞTIRILMAZ.

DO $$
DECLARE
  silinecek int[];
  fk record;
  n bigint;
  r record;
  silinen int := 0;
  kalan int := 0;
BEGIN
  -- 1. Test/pilot kullanıcılar --------------------------------------------
  SELECT coalesce(array_agg(id), '{}') INTO silinecek
    FROM kullanici WHERE auth_provider_id LIKE '999%';
  RAISE NOTICE 'Silinecek test/pilot kullanıcısı: %', cardinality(silinecek);
  FOR r IN SELECT ad || ' ' || soyad AS kisi FROM kullanici
            WHERE id = ANY(silinecek) ORDER BY id LOOP
    RAISE NOTICE '  - %', r.kisi;
  END LOOP;

  FOR fk IN
    SELECT c.conrelid::regclass AS tablo, a.attname AS sutun,
           c.confdeltype AS silme, a.attnotnull AS zorunlu
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
     WHERE c.contype = 'f'
       AND c.confrelid = 'public.kullanici'::regclass
       AND array_length(c.conkey, 1) = 1
       AND c.conrelid <> 'public.kullanici'::regclass
  LOOP
    -- CASCADE ('c') ve SET NULL ('n') zaten veritabanınca yürür.
    CONTINUE WHEN fk.silme IN ('c', 'n');
    IF fk.zorunlu THEN
      EXECUTE format('DELETE FROM %s WHERE %I = ANY($1)', fk.tablo, fk.sutun) USING silinecek;
    ELSE
      EXECUTE format('UPDATE %s SET %I = NULL WHERE %I = ANY($1)', fk.tablo, fk.sutun, fk.sutun) USING silinecek;
    END IF;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n > 0 THEN
      RAISE NOTICE '  %.%: % satır %', fk.tablo, fk.sutun, n,
        CASE WHEN fk.zorunlu THEN 'silindi' ELSE 'boşaltıldı' END;
    END IF;
  END LOOP;
  DELETE FROM kullanici WHERE id = ANY(silinecek);
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'Silinen kullanıcı: %', n;

  -- 2. Sahte okullar --------------------------------------------------------
  UPDATE kullanici SET kurum_kodu = NULL
   WHERE kurum_kodu >= 800000 OR kurum_kodu BETWEEN 750001 AND 750004;
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'Okul bağı kaldırılan kullanıcı: %', n;

  UPDATE kullanici_rol SET kurum_kodu = NULL
   WHERE rol_kodu = 'DANISMAN'
     AND (kurum_kodu >= 800000 OR kurum_kodu BETWEEN 750001 AND 750004);
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'Okul bağı kaldırılan danışman rolü: %', n;

  UPDATE kurum SET aktif = false
   WHERE aktif AND (kurum_kodu >= 800000 OR kurum_kodu BETWEEN 750001 AND 750004);
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'Pasife alınan okul: %', n;

  FOR r IN SELECT kurum_kodu FROM kurum WHERE kurum_kodu >= 800000 LOOP
    BEGIN
      DELETE FROM kurum WHERE kurum_kodu = r.kurum_kodu;
      silinen := silinen + 1;
    EXCEPTION WHEN foreign_key_violation THEN
      kalan := kalan + 1;
    END;
  END LOOP;
  RAISE NOTICE 'Silinen örnek okul: % (başka kayda bağlı olduğu için pasif kalan: %)', silinen, kalan;

  -- 3. Sahte ilçeler ("il kodu + 90") ---------------------------------------
  UPDATE kullanici SET ilce_kodu = NULL
   WHERE ilce_kodu IN (SELECT ilce_kodu FROM ilce WHERE ilce_kodu = il_kodu || '90');
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'İlçe bağı kaldırılan kullanıcı: %', n;

  silinen := 0; kalan := 0;
  FOR r IN SELECT ilce_kodu FROM ilce WHERE ilce_kodu = il_kodu || '90' LOOP
    BEGIN
      DELETE FROM ilce WHERE ilce_kodu = r.ilce_kodu;
      silinen := silinen + 1;
    EXCEPTION WHEN foreign_key_violation THEN
      kalan := kalan + 1;
    END;
  END LOOP;
  RAISE NOTICE 'Silinen örnek ilçe: % (başka kayda bağlı olduğu için kalan: %)', silinen, kalan;

  -- Sonuç ---------------------------------------------------------------------
  RAISE NOTICE 'Kalan kullanıcı: %, aktif okul: %, ilçe: %',
    (SELECT count(*) FROM kullanici),
    (SELECT count(*) FROM kurum WHERE aktif),
    (SELECT count(*) FROM ilce);
END $$;
