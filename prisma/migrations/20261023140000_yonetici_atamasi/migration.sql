-- DANIŞMAN ATAMASINI PROJE YÖNETİCİSİ YAPAR (23 Ekim 2026)
--
-- Otomatik atama, öğrencinin kendi seçimi ve öğretmenin öğrenci alması
-- kapandı; yeni atamaları yalnızca proje yöneticisi yapar. Geçmiş kayıtlar
-- eski tipleriyle kalır.

ALTER TYPE "AtamaTipi" ADD VALUE 'YONETICI_ATADI';
