#!/usr/bin/env bash
#
# GençTek Topluluk — aiotechs.cloud/genctektopluluk KURULUM ve GÜNCELLEME.
# Sunucuda root ile çalışır; yerelden şöyle çağrılır (betik stdin'den gider,
# sunucuda ayrıca indirilmez):
#
#   ssh genctek 'bash -s' < dagitim/topluluk-kur.sh
#
# İLK ÇALIŞMADA: sistem kullanıcısı, depo kopyası, PostgreSQL rolü ve
# veritabanı, .env (rastgele veritabanı parolası ve oturum anahtarı) ve
# systemd servisi oluşturulur.
# SONRAKİ ÇALIŞMALARDA: önce veritabanı yedeği alınır, sonra yalnızca kod
# güncellenir, derlenir, migration'lar uygulanır; .env'e dokunulmaz.
#
# PLATFORMA (genctek) DOKUNMAZ: ayrı kullanıcı, ayrı dizin, ayrı veritabanı,
# ayrı servis ve ayrı port. Apache bu betikte YOK — komşu uygulamaları
# etkileyen bir kerelik değişiklik, DAGITIM.md'deki adımlarla elle yapılır.

set -euo pipefail

UYGULAMA=genctektopluluk
DIZIN=/opt/$UYGULAMA
PORT=3040
TEMEL_YOL=/genctektopluluk
DEPO=https://github.com/serhatkagans/genctektopluluk.git
DAL="${DAL:-main}"
YEDEK_DIZINI=/var/backups/$UYGULAMA
export PATH=/opt/node24/bin:$PATH

[ "$(id -u)" -eq 0 ] || { echo "!!! root ile çalıştırın." >&2; exit 1; }
# postgres kullanıcısı /root'a giremez; psql her komutta uyarı basmasın.
cd /tmp

echo "==> Node: $(node --version)"

echo "==> Kullanıcı"
id "$UYGULAMA" >/dev/null 2>&1 || useradd --system --home-dir "$DIZIN" --shell /sbin/nologin "$UYGULAMA"

ILK_KURULUM=hayir
if [ ! -d "$DIZIN/.git" ]; then
  ILK_KURULUM=evet
  if ss -ltn | grep -q ":$PORT "; then
    echo "!!! $PORT portu dolu; servis dosyasında ve bu betikte başka bir port seçin." >&2
    exit 1
  fi
  echo "==> Depo kopyalanıyor ($DEPO, $DAL)"
  mkdir -p "$DIZIN"
  chown "$UYGULAMA:$UYGULAMA" "$DIZIN"
  sudo -u "$UYGULAMA" git clone --branch "$DAL" "$DEPO" "$DIZIN"
else
  echo "==> Yedek (migration geri alınamaz)"
  mkdir -p "$YEDEK_DIZINI"
  chmod 700 "$YEDEK_DIZINI"
  sudo -u postgres pg_dump -Fc "$UYGULAMA" > "$YEDEK_DIZINI/veritabani-$(date +%Y%m%d-%H%M%S).dump"
  find "$YEDEK_DIZINI" -name 'veritabani-*.dump' -mtime +30 -delete

  echo "==> Kod güncelleniyor ($DAL)"
  ONCEKI="$(sudo -u "$UYGULAMA" git -C "$DIZIN" rev-parse HEAD)"
  echo "    Sorun çıkarsa geri dönüş: git -C $DIZIN reset --hard $ONCEKI"
  sudo -u "$UYGULAMA" git -C "$DIZIN" fetch --prune origin
  sudo -u "$UYGULAMA" git -C "$DIZIN" checkout "$DAL"
  sudo -u "$UYGULAMA" git -C "$DIZIN" pull --ff-only origin "$DAL"
fi

if [ ! -f "$DIZIN/.env" ]; then
  echo "==> İlk kurulum: PostgreSQL rolü ve veritabanı"
  if sudo -u postgres psql -Atc "SELECT 1 FROM pg_roles WHERE rolname='$UYGULAMA'" | grep -q 1; then
    echo "!!! '$UYGULAMA' rolü var ama $DIZIN/.env yok. Parola bilinmediği için durduruldu." >&2
    exit 1
  fi
  PAROLA="$(openssl rand -hex 24)"
  # Parola komut satırına yazılmaz (ps çıktısında görünürdü); stdin'den gider.
  sudo -u postgres psql -v ON_ERROR_STOP=1 -q <<SQL
CREATE ROLE $UYGULAMA LOGIN PASSWORD '$PAROLA';
CREATE DATABASE $UYGULAMA OWNER $UYGULAMA ENCODING 'UTF8' TEMPLATE template0;
REVOKE ALL ON DATABASE $UYGULAMA FROM PUBLIC;
SQL
  umask 077
  cat > "$DIZIN/.env" <<ENV
DATABASE_URL="postgresql://$UYGULAMA:$PAROLA@127.0.0.1:5432/$UYGULAMA?schema=public"
AUTH_PROVIDER="kayit"
URETIMDE_MOCK_GIRISE_IZIN_VER="hayir"
GUVENILEN_VEKIL_SAYISI="1"
OTURUM_GIZLI_ANAHTARI="$(openssl rand -hex 32)"
TEMEL_YOL="$TEMEL_YOL"
IZINLI_HOSTLAR="aiotechs.cloud"
DEPOLAMA_SAGLAYICI="yerel"
DEPOLAMA_YEREL_DIZIN="$DIZIN/depolama"
EPOSTA_SAGLAYICI="gunluk"
SMS_SAGLAYICI="kapali"
ENV
  umask 022
  unset PAROLA
fi

mkdir -p "$DIZIN/depolama"
chown -R "$UYGULAMA:$UYGULAMA" "$DIZIN"
chmod 600 "$DIZIN/.env"
chmod 700 "$DIZIN/depolama"

calistir() { sudo -u "$UYGULAMA" -H env PATH="$PATH" "$@"; }

echo "==> Bağımlılıklar"
( cd "$DIZIN" && calistir npm ci --no-audit --no-fund )
echo "==> Prisma istemcisi"
( cd "$DIZIN" && calistir npx prisma generate )
echo "==> Migration'lar"
( cd "$DIZIN" && calistir npx prisma migrate deploy )
echo "==> Referans veriler (idempotent)"
( cd "$DIZIN" && calistir npm run db:seed )
echo "==> Derleme (TEMEL_YOL=$TEMEL_YOL)"
( cd "$DIZIN" && calistir npm run build )
echo "==> Statik dosyalar standalone çıktısına"
( cd "$DIZIN" && calistir bash -c 'rm -rf .next/standalone/.next/static && cp -r .next/static .next/standalone/.next/static && if [ -d public ]; then rm -rf .next/standalone/public && cp -r public .next/standalone/public; fi' )

echo "==> Servis"
install -m 644 "$DIZIN/dagitim/genctektopluluk.service" /etc/systemd/system/genctektopluluk.service
systemctl daemon-reload
systemctl enable "$UYGULAMA" >/dev/null 2>&1
systemctl restart "$UYGULAMA"

echo "==> Sağlık kontrolü"
for deneme in $(seq 1 30); do
  if curl -fs -o /dev/null "http://127.0.0.1:$PORT$TEMEL_YOL/giris"; then
    echo "    Uygulama yanıt veriyor: http://127.0.0.1:$PORT$TEMEL_YOL"
    echo "==> Tamam: $(sudo -u "$UYGULAMA" git -C "$DIZIN" rev-parse --short HEAD) (ilk kurulum: $ILK_KURULUM)"
    exit 0
  fi
  sleep 1
done
echo "!!! Uygulama 30 saniyede yanıt vermedi. Günlük:" >&2
journalctl -u "$UYGULAMA" -n 40 --no-pager >&2
exit 1
