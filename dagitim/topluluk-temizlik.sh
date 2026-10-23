#!/usr/bin/env bash
#
# GençTek Topluluk — örnek veri temizliği (root ile, BİR KEZ).
#
#   ssh genctek 'bash -s' < dagitim/topluluk-temizlik.sh               # KURU: yalnızca rapor
#   ssh genctek 'UYGULA=evet bash -s' < dagitim/topluluk-temizlik.sh   # uygular
#
# SQL depodaki dagitim/topluluk-temizlik.sql'dir (sunucudaki kopya). Önce
# veritabanı yedeği alınır. Tek işlemdedir: bir adım bile hata verirse hiçbir
# şey yazılmaz. Platform (genctek) veritabanına DOKUNMAZ.

set -euo pipefail

UYGULAMA=genctektopluluk
DIZIN=/opt/$UYGULAMA
YEDEK_DIZINI=/var/backups/$UYGULAMA
SQL="$DIZIN/dagitim/topluluk-temizlik.sql"

[ "$(id -u)" -eq 0 ] || { echo "!!! root ile çalıştırın." >&2; exit 1; }
[ -f "$SQL" ] || { echo "!!! $SQL yok; önce topluluk-kur.sh ile kodu güncelleyin." >&2; exit 1; }
cd /tmp

if [ "${UYGULA:-}" = "evet" ]; then
  SON=COMMIT
  echo "==> Yedek"
  mkdir -p "$YEDEK_DIZINI"; chmod 700 "$YEDEK_DIZINI"
  YEDEK="$YEDEK_DIZINI/veritabani-temizlik-oncesi-$(date +%Y%m%d-%H%M%S).dump"
  sudo -u postgres pg_dump -Fc "$UYGULAMA" > "$YEDEK"
  echo "    $YEDEK"
  echo "==> Temizlik UYGULANIYOR"
else
  SON=ROLLBACK
  echo "==> KURU ÇALIŞTIRMA: hiçbir şey kaydedilmeyecek (uygulamak için UYGULA=evet)"
fi

{ echo "BEGIN;"; cat "$SQL"; echo "$SON;"; } \
  | sudo -u postgres psql -q -v ON_ERROR_STOP=1 -d "$UYGULAMA" 2>&1 \
  | sed -e 's/^psql:[^:]*:[0-9]*: //' -e 's/^NOTICE:  /    /'

if [ "$SON" = COMMIT ]; then
  # topluluk-veri.sh bu işareti görünce kullanıcı kopyalamayı atlar.
  date -Iseconds > "$DIZIN/.temizlik-yapildi"
fi
echo "==> Bitti ($SON)"
