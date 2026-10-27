#!/usr/bin/env bash
#
# GençTek Topluluk — takvimden SEÇİLEN etkinlikleri ekler (root ile).
#
#   ssh genctek 'bash -s -- 306 577 573'        < dagitim/takvimden-secili.sh   ön izleme, YAZMAZ
#   ssh genctek 'bash -s -- 306 577 573 --yaz'  < dagitim/takvimden-secili.sh   ekler
#
# Numaralar takvimdeki etkinlik numaralarıdır (events.id). Tarih sınırı
# yoktur; geçmiş etkinlik de eklenebilir. Kurallar
# scripts/takvimden-etkinlik-aktar.ts ile aynıdır: başvuru KAPALI, kapsam
# ULUSAL, tanışma/iptal/ertelenen atlanır, zaten var olan tekrar eklenmez.

set -euo pipefail

UYGULAMA=genctektopluluk
DIZIN=/opt/$UYGULAMA
export PATH=/opt/node24/bin:$PATH

[ "$(id -u)" -eq 0 ] || { echo "!!! root ile çalıştırın." >&2; exit 1; }

YAZ=""
IDLER=()
for a in "$@"; do
  case "$a" in
    --yaz) YAZ="--yaz" ;;
    *[!0-9]*|"") echo "!!! Geçersiz numara: $a" >&2; exit 1 ;;
    *) IDLER+=("$a") ;;
  esac
done
[ ${#IDLER[@]} -gt 0 ] || { echo "!!! En az bir etkinlik numarası verin." >&2; exit 1; }
LISTE=$(IFS=,; echo "${IDLER[*]}")
cd /tmp

JSON="$(mktemp /tmp/topluluk-takvim-XXXXXX.json)"
sudo -u postgres psql -d genctektakvim -At <<SQL > "$JSON"
SELECT coalesce(json_agg(e ORDER BY e.start), '[]'::json)
FROM (
  SELECT id, title, city, category, theme, start, "end", all_day, location,
         url, description, status, scope, cities, subtypes, online,
         students, teachers, others, purpose, work_groups, participants
    FROM events
   WHERE deleted_at IS NULL
     AND id IN ($LISTE)
) e;
SQL
chown "$UYGULAMA" "$JSON"
( cd "$DIZIN" && sudo -u "$UYGULAMA" -H env PATH="$PATH" npx tsx scripts/takvimden-etkinlik-aktar.ts "$JSON" $YAZ )
rm -f "$JSON"
