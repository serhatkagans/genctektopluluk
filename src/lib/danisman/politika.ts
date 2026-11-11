/**
 * DANIŞMAN ATAMASINI YALNIZCA PROJE YÖNETİCİSİ YAPAR (23 Ekim 2026 · istek:
 * "atamayı yönetici yapsın" · seçim: "tamamen yöneticiye geçsin, yalnızca
 * proje yöneticisi").
 *
 * Bu bayrak açıkken:
 *   · girişte ve okul değişince otomatik atama YAPILMAZ,
 *   · öğrenci danışmanını kendisi seçemez, değişiklik talebi açamaz,
 *   · öğretmen öğrenciyi danışmanlığına alamaz,
 *   · öğretmen ayrıldığında ya da koordinatör değiştiğinde öğrenciler kimseye
 *     DEVREDİLMEZ; atamaları kapanır ve proje yöneticisine haber gider,
 *   · il koordinatörüne geçici bağlama (fallback) yapılmaz.
 *
 * Atamayı kapatan yollar (öğretmenin bırakması, koordinatörün/yöneticinin
 * sonlandırması, öğrencinin bırakması) açık kalır: bunlar atama değil,
 * bir bağın bitişidir.
 *
 * Eski akış silinmedi, bu bayrağın arkasında duruyor; örnek veri betikleri de
 * onu kullanmaya devam ediyor.
 *
 * İL KOORDİNATÖRÜ DE ATAR (11 Kasım 2026 · istek: "koordinatörlere danışman
 * öğretmen ata kısmını aç"). "Yönetici" artık proje yöneticisi ile kendi
 * ilindeki il koordinatörü demek (bkz. yetki/izinler.ts ·
 * danismanAtayabilirMi). Öğretmen ve öğrenci için yukarıdaki kapalı yollar
 * değişmedi.
 */
export const ATAMAYI_YALNIZCA_YONETICI_YAPAR = true;

/** Kapalı yollardan biri çağrıldığında kullanıcıya gösterilen metin. */
export const YONETICI_ATAR_ACIKLAMASI =
  "Danışman öğretmen ataması il koordinatörü ya da proje yöneticisi tarafından yapılır.";
