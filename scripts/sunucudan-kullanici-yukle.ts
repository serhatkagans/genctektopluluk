import "dotenv/config";
import { readFileSync } from "node:fs";
import pg from "pg";

/**
 * Sunucudaki kullanıcıları bu dalın veritabanına yükler (23 Ekim 2026 · istek:
 * "sunucudaki veri tabanında bulunan kullanıcıları da çekelim, onları yeni
 * daldaki veri tabanına yükleyeceğiz").
 *
 * GİRDİ: sunucuda `pg_dump --data-only --column-inserts --on-conflict-do-nothing`
 * ile alınmış düz SQL (il, ilçe, kurum, kullanıcı, rol, profil, giriş ve onay
 * tabloları). Komut için bkz. aktarım talimatı.
 *
 * NİYE --column-inserts: bu dalın şeması sunucununkinden YENİ — ek sütunlar
 * (beyan okul adı, danışman beyanı…) boş bırakılabilir. Sütun adlı INSERT,
 * sunucuda olmayan sütunları varsayılanında bırakır; COPY ise sütun sırasına
 * bağlı kalırdı.
 *
 * NİYE --on-conflict-do-nothing: tohum verisi il, ilçe ve birkaç okul açtı;
 * aynı satırlar tekrar gelince hata vermek yerine atlanır.
 *
 * Tek işlemde çalışır: bir satır bile hata verirse hiçbir şey yazılmaz.
 *
 * Kullanım:
 *   npx tsx scripts/sunucudan-kullanici-yukle.ts <dosya.sql>
 */

const dosya = process.argv[2];
if (!dosya) {
  console.error("Kullanım: npx tsx scripts/sunucudan-kullanici-yukle.ts <dosya.sql>");
  process.exit(1);
}

async function main() {
  const adres = process.env.DATABASE_URL;
  if (!adres) throw new Error("DATABASE_URL tanımlı değil.");

  /*
   * psql'e özel satırlar (\connect, \restrict …) ve yorumlar atılır; geri
   * kalanı sunucuya olduğu gibi gider. pg_dump search_path'i boşalttığı için
   * tablolar şemayla (public.) yazılı geliyor.
   */
  const sql = readFileSync(dosya, "utf8")
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .filter((satir) => !satir.startsWith("\\"))
    .join("\n");

  const ekleme = (sql.match(/^INSERT INTO /gm) ?? []).length;
  console.log(`Dosyada ${ekleme} satır ekleme var.`);

  // Prisma dev bağlantı adresindeki pgbouncer parametreleri pg'ye yabancı.
  const temizAdres = adres.replace(/[?&](pgbouncer|connection_limit|connect_timeout|max_idle_connection_lifetime|pool_timeout|socket_timeout|statement_cache_size)=[^&]*/g, "").replace(/\?&/, "?");
  const istemci = new pg.Client({ connectionString: temizAdres });
  await istemci.connect();

  try {
    await istemci.query("BEGIN");
    await istemci.query(sql);
    await istemci.query("SET search_path TO public");
    const sayim = await istemci.query<{ tablo: string; adet: string }>(`
      SELECT 'kullanici' AS tablo, count(*)::text AS adet FROM kullanici
      UNION ALL SELECT 'kullanici_rol', count(*)::text FROM kullanici_rol
      UNION ALL SELECT 'kayit_kimlik', count(*)::text FROM kayit_kimlik
      UNION ALL SELECT 'kurum', count(*)::text FROM kurum`);
    await istemci.query("COMMIT");
    console.log("Yüklendi. Veritabanındaki satır sayıları:");
    for (const satir of sayim.rows) console.log(`  ${satir.tablo}: ${satir.adet}`);
  } catch (hata) {
    await istemci.query("ROLLBACK");
    throw hata;
  } finally {
    await istemci.end();
  }
}

main().catch((hata) => {
  console.error("Yükleme geri alındı, hiçbir şey yazılmadı:", hata);
  process.exitCode = 1;
});
