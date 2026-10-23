#!/usr/bin/env bash
#
# GençTek Topluluk — ilk veri yüklemesi (root ile, BİR KEZ; tekrarı zararsız).
#
#   ssh genctek 'bash -s' < dagitim/topluluk-veri.sh
#
# 1. KULLANICILAR: platform veritabanından (genctek) il, ilçe, okul,
#    kullanıcı, rol, profil, giriş ve KVKK onay satırları kopyalanır. Kaynak
#    yalnızca OKUNUR. `--on-conflict-do-nothing`: var olan satır atlanır,
#    betik ikinci kez çalışırsa bir şey bozulmaz. Tek işlemde yüklenir; bir
#    satır bile hata verirse hiçbir şey yazılmaz.
# 2. ETKİNLİKLER: takvim veritabanından (genctektakvim) bugünden itibaren
#    bir ayın etkinlikleri okunur ve scripts/takvimden-etkinlik-aktar.ts ile
#    eklenir: tanışma ve toplantılar alınmaz, başvurular KAPALI.
#
# Ön koşul: dagitim/topluluk-kur.sh en az bir kez çalışmış olmalı.

set -euo pipefail

UYGULAMA=genctektopluluk
DIZIN=/opt/$UYGULAMA
export PATH=/opt/node24/bin:$PATH

[ "$(id -u)" -eq 0 ] || { echo "!!! root ile çalıştırın." >&2; exit 1; }
[ -f "$DIZIN/.env" ] || { echo "!!! Önce dagitim/topluluk-kur.sh çalıştırın." >&2; exit 1; }
cd /tmp

ISARET="$DIZIN/.temizlik-yapildi"
if [ -f "$ISARET" ]; then
  # Temizlikten sonra kullanıcı kopyalaması test hesaplarını ve sahte okulları
  # geri getirirdi (bkz. topluluk-temizlik.sh); yalnızca takvim işlenir.
  echo "==> Kullanıcılar ATLANDI: temizlik yapılmış ($ISARET)"
else
echo "==> Kullanıcılar (genctek → $UYGULAMA)"
sudo -u postgres pg_dump -d genctek --data-only --column-inserts --on-conflict-do-nothing \
  -t public.il -t public.ilce -t public.kurum -t public.kullanici \
  -t public.kullanici_rol -t public.ogrenci_profil -t public.ogretmen_profil \
  -t public.kayit_kimlik -t public.dis_kimlik -t public.kullanici_onayi \
  | sudo -u postgres psql -q -v ON_ERROR_STOP=1 --single-transaction -d "$UYGULAMA" >/dev/null
sudo -u postgres psql -d "$UYGULAMA" -Atc \
  "SELECT 'kullanıcı: ' || count(*) FROM kullanici UNION ALL SELECT 'okul: ' || count(*) FROM kurum"
fi

echo "==> Takvim etkinlikleri (genctektakvim → $UYGULAMA)"
JSON="$(mktemp /tmp/topluluk-takvim-XXXXXX.json)"
sudo -u postgres psql -d genctektakvim -At <<'SQL' > "$JSON"
SELECT coalesce(json_agg(e ORDER BY e.start), '[]'::json)
FROM (
  SELECT id, title, city, category, theme, start, "end", all_day, location,
         url, description, status, scope, cities, subtypes, online,
         students, teachers, others, purpose, work_groups, participants
    FROM events
   WHERE deleted_at IS NULL
     AND start >= to_char(current_date, 'YYYY-MM-DD')
     AND start <  to_char(current_date + 32, 'YYYY-MM-DD')
) e;
SQL
chown "$UYGULAMA" "$JSON"
( cd "$DIZIN" && sudo -u "$UYGULAMA" -H env PATH="$PATH" npx tsx scripts/takvimden-etkinlik-aktar.ts "$JSON" --yaz )
rm -f "$JSON"

echo "==> Tamam"
