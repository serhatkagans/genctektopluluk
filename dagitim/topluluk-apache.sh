#!/usr/bin/env bash
#
# GençTek Topluluk — Apache ters vekil bloğu (root ile, BİR KEZ).
#
#   ssh genctek 'bash -s' < dagitim/topluluk-apache.sh
#
# DirectAdmin'in kalıcı dosyasına (cust_httpd) /genctektopluluk bloğunu
# EN ÜSTE ekler. Sıra önemli: ProxyPass düz önek eşleşmesi yapar; "/genctek"
# satırı önce gelseydi "/genctektopluluk" adresleri platforma giderdi.
#
# Uygulama alt dizinini BİLİR (TEMEL_YOL=/genctektopluluk): Apache adresi
# kırpmadan iletir — platformun /genctek bloğuyla aynı desen. Yönlendirme
# YOK, iki biçim de doğrudan proxy edilir (uzun olan önce): Next.js eğik
# çizgili adresi 308 ile çıplağa atıyor, Apache tersini yapsaydı döngü olurdu
# (bkz. DAGITIM.md · "Sonsuz yönlendirme döngüsü").
#
# GÜVENLİK: önce yedek alınır; `httpd -t` geçmezse yedek geri konur ve
# Apache'ye dokunulmaz. Yeniden başlatma DEĞİL graceful: komşu siteler kesilmez.

set -euo pipefail

DOSYA=/usr/local/directadmin/data/users/admin/domains/aiotechs.cloud.cust_httpd
# Port kurulumda seçilip .env'e yazıldı (bkz. topluluk-kur.sh).
PORT="$(grep -E '^PORT=' /opt/genctektopluluk/.env | head -1 | cut -d= -f2 | tr -d '"')"
ISARET="# >>> genctektopluluk"

[ "$(id -u)" -eq 0 ] || { echo "!!! root ile çalıştırın." >&2; exit 1; }
[ -f "$DOSYA" ] || { echo "!!! $DOSYA yok." >&2; exit 1; }
[ -n "$PORT" ] || { echo "!!! /opt/genctektopluluk/.env içinde PORT yok; önce topluluk-kur.sh." >&2; exit 1; }

if grep -qF "$ISARET" "$DOSYA"; then
  echo "==> Blok zaten var; değişiklik yapılmadı."
  exit 0
fi

YEDEK="/root/aiotechs.cust_httpd.yedek-$(date +%Y%m%d-%H%M%S)"
cp -a "$DOSYA" "$YEDEK"
echo "==> Yedek: $YEDEK"

YENI="$(mktemp)"
cat > "$YENI" <<APACHE
# >>> genctektopluluk — GençTek Topluluk -> 127.0.0.1:$PORT (genctektopluluk.service)
# /genctek ve /genctekportal bloklarının ÜSTÜNDE durmalı (önek eşleşmesi).
ProxyPass /genctektopluluk/ http://127.0.0.1:$PORT/genctektopluluk/
ProxyPassReverse /genctektopluluk/ http://127.0.0.1:$PORT/genctektopluluk/
ProxyPass /genctektopluluk http://127.0.0.1:$PORT/genctektopluluk
ProxyPassReverse /genctektopluluk http://127.0.0.1:$PORT/genctektopluluk
# <<< genctektopluluk

APACHE
cat "$DOSYA" >> "$YENI"
cat "$YENI" > "$DOSYA"
rm -f "$YENI"

yeniden_uret() {
  echo "action=rewrite&value=httpd" >> /usr/local/directadmin/data/task.queue
  /usr/local/directadmin/dataskq d
}

echo "==> Vhost'lar yeniden üretiliyor"
yeniden_uret
if ! httpd -t; then
  echo "!!! httpd -t başarısız; yedek geri konuyor, Apache'ye dokunulmadı." >&2
  cp -a "$YEDEK" "$DOSYA"
  yeniden_uret
  httpd -t
  exit 1
fi

echo "==> Apache graceful"
apachectl graceful

echo "==> Kontrol"
for deneme in $(seq 1 10); do
  KOD="$(curl -s -o /dev/null -w '%{http_code}' https://aiotechs.cloud/genctektopluluk/giris || true)"
  if [ "$KOD" = "200" ]; then
    echo "    https://aiotechs.cloud/genctektopluluk/giris → 200"
    exit 0
  fi
  sleep 1
done
echo "!!! Dış adres 200 vermedi (son kod: $KOD). Geri almak için:" >&2
echo "    cp -a $YEDEK $DOSYA && echo 'action=rewrite&value=httpd' >> /usr/local/directadmin/data/task.queue && /usr/local/directadmin/dataskq d && httpd -t && apachectl graceful" >&2
exit 1
