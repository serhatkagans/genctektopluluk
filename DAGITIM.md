# GençTek — VPS Dağıtım Rehberi

AlmaLinux / Rocky Linux 9 için. Ubuntu kullanıyorsanız paket komutları (`dnf` →
`apt`) ve SELinux adımları değişir; gerisi aynıdır.

Hedef mimari:

```
İnternet → ters vekil (443, TLS) → 127.0.0.1:PORT (Node, systemd) → PostgreSQL
                                                                  → depolama/
```

Uygulama **dışarıyı dinlemez**; yalnızca vekil üzerinden erişilir. Güvenlik
duvarında uygulama portu ve 5432 açılmaz.

> ## Bu projenin canlı kurulumu
>
> `aiotechs.cloud` sunucusundaki kurulum bu rehberin **varsayılanlarından
> ayrılır**, çünkü sunucu boş değildi. Fiilî değerler:
>
> | | Rehber varsayılanı | aiotechs.cloud |
> |---|---|---|
> | Adres | Kendi alan adı | `https://aiotechs.cloud/genctek` (alt dizin) |
> | Ters vekil | nginx | **Apache** (DirectAdmin yönetiminde) |
> | Vekil yapılandırması | `/etc/nginx/conf.d/` | `…/data/users/admin/domains/aiotechs.cloud.cust_httpd` |
> | Uygulama portu | 3000 | **3010** (3000'i docker tutuyor) |
> | Node | Sistem paketi | **`/opt/node24`** (sistem Node'u 16, dokunulmadı) |
> | PostgreSQL | Yeni kurulum | Sunucuda zaten vardı (13.23) |
> | TLS | certbot | DirectAdmin'in mevcut apex sertifikası |
> | SELinux | `setsebool` gerekli | Kapalı, gerek yok |
>
> Ayrıntılar için Bölüm 13'e bakın.

İçindekiler:
1. Ön hazırlık ve kullanıcı
2. Node.js
3. PostgreSQL
4. Kodun sunucuya alınması
5. Ortam değişkenleri
6. İlk derleme ve veritabanı kurulumu
7. systemd servisi
8. nginx ve HTTPS
9. Gecelik senkron ve yedekleme
10. Doğrulama kontrol listesi
11. Sürüm güncelleme
12. Sorun giderme
13. Canlı kurulum: aiotechs.cloud/genctek
14. Günlük kullanım: gönder ve yayınla

---

## 1. Ön hazırlık ve kullanıcı

```bash
sudo dnf update -y
sudo dnf install -y git curl tar policycoreutils-python-utils
```

Uygulama **kendi kullanıcısıyla** çalışır; root ile çalıştırmayın. Bir açık,
tüm sunucuyu değil yalnızca bu hesabı verir.

```bash
sudo useradd --system --home-dir /opt/genctek --shell /sbin/nologin genctek
sudo mkdir -p /opt/genctek
sudo chown genctek:genctek /opt/genctek
```

Güvenlik duvarı — yalnızca HTTP/HTTPS:

```bash
sudo firewall-cmd --permanent --add-service=http --add-service=https
sudo firewall-cmd --reload
sudo firewall-cmd --list-services      # ssh dhcpv6-client http https görünmeli
```

---

## 2. Node.js

Proje Node.js 24 ister. AlmaLinux depolarındaki `nodejs` modülü daha eskidir,
NodeSource kullanın:

```bash
curl -fsSL https://rpm.nodesource.com/setup_24.x | sudo bash -
sudo dnf install -y nodejs
node --version      # v24.x olmalı
```

---

## 3. PostgreSQL

AlmaLinux 9'un varsayılan modülü PostgreSQL 13'tür ve proje için yeterlidir.
Daha yeni bir sürüm isterseniz PGDG deposunu ekleyin.

```bash
sudo dnf install -y postgresql-server postgresql-contrib
sudo postgresql-setup --initdb
sudo systemctl enable --now postgresql
```

Uygulamaya **özel** kullanıcı ve veritabanı açın — `postgres` veya `template1`
gibi sistem veritabanlarını kullanmayın:

```bash
sudo -u postgres createuser genctek --pwprompt      # şifreyi not alın
sudo -u postgres createdb genctek --owner=genctek
```

### TCP erişimi ve şifre doğrulaması

`DATABASE_URL` `localhost:5432` üzerinden bağlanır. RHEL ailesinde yerel TCP
bağlantıları varsayılan olarak `ident` ile doğrulanır ve uygulama şifreyle
bağlanamaz. `/var/lib/pgsql/data/pg_hba.conf` içindeki **IPv4/IPv6 local**
satırlarını `scram-sha-256` yapın:

```
host    all             all             127.0.0.1/32            scram-sha-256
host    all             all             ::1/128                 scram-sha-256
```

```bash
sudo systemctl restart postgresql
```

Doğrulayın (şifre sorması ve bağlanması gerekir):

```bash
psql "postgresql://genctek:SIFRE@localhost:5432/genctek" -c '\conninfo'
```

---

## 4. Kodun sunucuya alınması

Proje yerelde henüz git deposu değildi; `git init` ile hazırlandı. Yerel
makinenizde özel bir depo oluşturup gönderin:

```powershell
# Yerel makinede (Windows)
git remote add origin git@github.com:KURUM/genctek.git
git push -u origin main
```

> Depo **özel (private)** olmalı. İçinde gerçek kişisel veri yok ama yetki
> mantığı, veritabanı şeması ve iş kuralları var; kamuya açmanın bir faydası
> yok. `.env` zaten `.gitignore` içinde — sunucudaki gerçek şifreler asla
> depoya girmez.

Sunucuda:

```bash
sudo -u genctek git clone git@github.com:KURUM/genctek.git /opt/genctek
```

`genctek` kullanıcısının kabuğu `nologin` olduğu için `sudo -u genctek <komut>`
biçimini kullanın. Dağıtım anahtarı (deploy key) gerekiyorsa GitHub deposunda
**Deploy keys** bölümünden salt okunur bir anahtar tanımlayın.

---

## 5. Ortam değişkenleri

```bash
sudo -u genctek cp /opt/genctek/.env.example /opt/genctek/.env
sudo chmod 600 /opt/genctek/.env
sudo chown genctek:genctek /opt/genctek/.env
sudo -u genctek vi /opt/genctek/.env
```

Doldurulması **zorunlu** olanlar:

| Değişken | Değer |
|---|---|
| `DATABASE_URL` | `postgresql://genctek:SIFRE@localhost:5432/genctek?schema=public` |
| `OTURUM_GIZLI_ANAHTARI` | Aşağıdaki komutun ürettiği 64 karakter |
| `DEPOLAMA_YEREL_DIZIN` | `/opt/genctek/depolama` |
| `IZINLI_HOSTLAR` | Uygulamanın alan adı, ör. `genctek.meb.gov.tr` |

İsteğe bağlı ama gözden geçirilmesi gereken: `GUVENILEN_VEKIL_SAYISI`
(varsayılan `1`, aşağıda).

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> Örnek anahtar bırakılırsa uygulama `NODE_ENV=production` altında **açılmayı
> reddeder**. Bu bir arıza değil, kasıtlı bir korumadır: imza anahtarı tahmin
> edilebilir olursa herkes kendine oturum çerezi üretebilir.

`IZINLI_HOSTLAR`, uygulamanın hizmet verdiği alan adlarının virgülle ayrılmış
listesidir (birden çok ad varsa: `genctek.meb.gov.tr,www.genctek.meb.gov.tr`).
Parola sıfırlama bağlantısının adresi istek başlıklarından türetilir; bu
başlıkları isteği yapan belirlediği için türetilen alan adı bu listeye karşı
sınanır. Liste olmadan, kötü niyetli bir istek kurbanın e-postasına saldırganın
alan adına giden bir sıfırlama bağlantısı göndertebilir. Tanımlanmazsa uygulama
üretimde **açılmaz**.

### `GUVENILEN_VEKIL_SAYISI` — istemci adresinin doğruluğu

Varsayılan `1` ve bu bölümdeki iki kurulum (nginx ve aiotechs.cloud'daki
Apache) için doğru değer odur; uygulamanın önünde **kaç vekil** durduğunu
söyler.

`x-forwarded-for` bir **ekleme** zinciridir: her vekil gördüğü adresi listenin
sonuna yazar, baştakileri silmez. Yani başlığın başındaki değerleri isteği
yapan kendisi yazmış olabilir. Uygulama gerçek adresi bu yüzden **sondan
sayarak** bulur ve kaçıncı sıradan sayacağını bu değişkenden öğrenir.

Yanlış ayarlamanın iki yönü eşit değildir:

- **Fazla verilirse** adres bulunamaz, istekler ortak `bilinmeyen` kovasına
  düşer — hız sınırı sıkılaşır, erişim kaydında IP boş kalır. Rahatsız edici
  ama güvenli.
- **Eksik verilirse** istemcinin uydurduğu adres gerçek sanılır: hız sınırı
  atlatılabilir ve **KVKK erişim kaydına sahte IP yazdırılabilir**. Şüphede
  kalırsanız değeri büyük tutun.

Vekilin önüne bir CDN ya da yük dengeleyici eklerseniz bu sayıyı da artırın.
Uygulama doğrudan internete açıksa `0` yazın; o zaman iletilen başlıkların
hiçbirine güvenilmez.

**Ek sıkılaştırma (isteğe bağlı, önerilir):** vekil gelen `X-Forwarded-For`
başlığını uygulamaya iletmeden temizlerse zincirde uydurma değer hiç
bulunmaz. Apache'de, Bölüm 13'teki proxy bloğunun yanına:

```apache
<Location /genctek>
    RequestHeader unset X-Forwarded-For
</Location>
```

nginx'te `dagitim/nginx-genctek.conf` içindeki satırı değiştirerek:

```nginx
proxy_set_header X-Forwarded-For $remote_addr;   # $proxy_add_x_forwarded_for yerine
```

Bu, uygulamadaki korumanın **yerine geçmez**; ikisi birlikte çalışır. Vekil
yapılandırması sunucu taşındığında geride kalır, uygulamadaki kontrol taşınır.

### `AUTH_PROVIDER` — dikkat

EBA SSO erişimi gelene kadar `AUTH_PROVIDER="mock"` kullanılır. **Mock giriş
şifresizdir**: giriş ekranındaki listeden bir kimlik seçen herkes o kişi olarak
(il koordinatörü dahil) sisteme girer. Bu yüzden `NODE_ENV=production` altında
`mock` ile açılış **reddedilir**.

- EBA erişimi geldiyse: `AUTH_PROVIDER="eba"` yapın ve `EBA_*` değişkenlerini
  doldurun.
- Dışarıya kapalı bir ağda (kurum içi tanıtım/pilot) bilerek mock ile
  çalışıyorsanız, riski üstlendiğinizi açıkça yazın:
  `URETIMDE_MOCK_GIRISE_IZIN_VER="evet"`. **İnternete açık bir sunucuda bunu
  yapmayın.**

`EPOSTA_SAGLAYICI="gunluk"` bırakılır — kurum posta sunucusu bağlanana kadar
gerçek öğrencilere e-posta gitmez, bildirimler yalnızca panelde görünür.

Dosya deposu dizini:

```bash
sudo -u genctek mkdir -p /opt/genctek/depolama
sudo chmod 700 /opt/genctek/depolama
```

---

## 6. İlk derleme ve veritabanı kurulumu

```bash
cd /opt/genctek
sudo -u genctek npm ci
sudo -u genctek npx prisma generate
sudo -u genctek npm run build

# Statik dosyalar standalone çıktısına kopyalanır (bu adım atlanırsa sayfalar
# stilsiz gelir).
sudo -u genctek cp -r .next/static .next/standalone/.next/static

sudo -u genctek npx prisma migrate deploy
sudo -u genctek npm run db:seed
```

`db:seed` şunları yükler: 81 il, örnek ilçe/kurum, 12 çalışma grubu, 18 etkinlik
programı, sistem ayarları, bildirim şablonları ve üç proje yöneticisi.

> `npm run veri:ornek` **çalıştırmayın**. O komut 300 sahte öğrenci üretir ve
> üretim veritabanında işi yoktur.

Doğrulama:

```bash
sudo -u genctek npm run test:duman     # 36 kontrolün hepsi geçmeli
```

---

## 7. systemd servisi

```bash
sudo cp /opt/genctek/dagitim/genctek.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now genctek
sudo systemctl status genctek
```

Yanıt verdiğini doğrulayın:

```bash
curl -I http://127.0.0.1:3000/        # HTTP/1.1 200 OK
```

Günlükler: `sudo journalctl -u genctek -f`

---

## 8. nginx ve HTTPS

```bash
sudo dnf install -y nginx
sudo systemctl enable --now nginx

sudo cp /opt/genctek/dagitim/nginx-genctek.conf /etc/nginx/conf.d/genctek.conf
sudo sed -i 's/ALAN_ADI/genctek.example.gov.tr/' /etc/nginx/conf.d/genctek.conf
sudo nginx -t && sudo systemctl reload nginx
```

### SELinux — atlanırsa 502 alırsınız

SELinux varsayılan olarak nginx'in ağa bağlanmasını engeller. Bu, RHEL
ailesinde en sık karşılaşılan dağıtım hatasıdır:

```bash
sudo setsebool -P httpd_can_network_connect 1
```

### Sertifika

Alan adının VPS IP adresine yönlendirilmiş olması gerekir (`dig +short ALAN_ADI`).

```bash
sudo dnf install -y epel-release
sudo dnf install -y certbot python3-certbot-nginx
sudo certbot --nginx -d genctek.example.gov.tr
```

Certbot 443 bloğunu ve HTTP→HTTPS yönlendirmesini kendisi yazar. Yenileme
zamanlayıcısını doğrulayın:

```bash
sudo systemctl enable --now certbot-renew.timer
sudo certbot renew --dry-run
```

---

## 9. Gecelik senkron, erişim anomalisi izlemesi ve yedekleme

```bash
sudo cp /opt/genctek/dagitim/genctek-senkron.{service,timer} /etc/systemd/system/
sudo cp /opt/genctek/dagitim/genctek-saklama.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now genctek-senkron.timer genctek-saklama.timer
systemctl list-timers genctek-senkron.timer genctek-saklama.timer
```

**İKİ ZAMANLAYICI VARDIR ve ikisi de zorunludur.** `genctek-senkron` her gece
03:00'te (danışman senkronu + erişim anomalisi taraması), `genctek-saklama`
ayın ilk günü 04:00'te (saklama süresi bakımı ve KVKK imhası) çalışır.
Saklama zamanlayıcısı 2 Eylül 2026'da eklendi; o güne kadar sunucuda ne cron
ne timer vardı, yani erişim kaydının 24 aylık silme kuralı dahil hiçbir
saklama süresi uygulanmıyordu. Kodda tanımlı ama hiç çalışmayan bir süre,
denetimde tanımlı sayılmaz.

**KURULDUKTAN SONRA "enabled" DEĞİL, BAŞARILI OLDUĞUNU DOĞRULAYIN.** Bir
`oneshot` timer'ın etkin olması işin çalıştığı anlamına gelmez; hata verse de
sessizce her gece yeniden dener:

```bash
systemctl show genctek-senkron.service -p Result -p ExecMainStatus
journalctl -u genctek-senkron -n 30 --no-pager
```

`Result=exit-code` görüyorsanız ilk bakılacak yer **PATH**'tir. npm'in
shebang'i `/usr/bin/env node`; birim npm'i tam yolla çağırsa bile node'u
PATH'ten bulur ve systemd'nin varsayılan PATH'i `/usr/bin` ile başlar. Bu
sunucuda oradaki Node 16, Prisma 7 ise Node 20+ istiyor — iş
`CompileError: WebAssembly.Module(): invalid value type 'externref'` ile
ölüyordu (2 Eylül 2026'da böyle bulundu; aylardır her gece başarısızdı).
Çözüm birim dosyalarındaki `Environment=PATH=/opt/node24/bin:...` satırıdır.

Bu zamanlayıcı danışman senkronunun ardından tamamlanmış önceki İstanbul gününü
erişim anomalileri için tarar. Günlük 100 farklı öğrenci kaydı eşiğini aşan
erişimler ile 08:00–18:00 dışındaki toplu dışa aktarımlar kalıcı bulguya çevrilir
ve proje yöneticilerine bildirilir. Elle doğrulama için:

```bash
sudo -u genctek /usr/bin/npm --prefix /opt/genctek run izleme:erisim
```

Yedekleme betiğini kurun ve **geri yüklemeyi bir kez deneyin** — denenmemiş
yedek, yedek değildir. (31 Temmuz 2026'daki ilk provada rehberdeki geri yükleme
komutunun çalışmadığı ortaya çıktı; ayrıntı `dagitim/yedek.sh` dipnotunda.)

```bash
sudo install -m 700 -o root -g root /opt/genctek/dagitim/yedek.sh /usr/local/bin/genctek-yedek
sudo touch /var/log/genctek-yedek.log && sudo chmod 640 /var/log/genctek-yedek.log
sudo crontab -e
# 0 2 * * * /usr/local/bin/genctek-yedek >> /var/log/genctek-yedek.log 2>&1
```

> **Geri yüklerken `pg_restore`'a dosya yolu vermeyin**, içeriği boruyla
> geçirin: yedekler `600 root:root` olduğu için `sudo -u postgres pg_restore
> <dosya>` "Permission denied" alır. Doğrusu:
>
> ```bash
> sudo cat /var/backups/genctek/veritabani-DAMGA.dump | sudo -u postgres pg_restore -d genctek
> ```

> Cron satırında **`sudo -u postgres` YAZMAYIN**. Betik root ile çalışmak
> zorundadır: `postgres` kullanıcısı veritabanını dökebilir ama
> `/opt/genctek/depolama` dizinini (700 genctek:genctek) okuyamaz. Sonuç,
> teşhisi en zor yedekleme arızasıdır — iş her gece "başarılı" biter, `.dump`
> dosyası oluşur, ama öğrencilerin yüklediği CV'ler ve faaliyet ekleri hiç
> yedeklenmez ve bu ancak geri yüklemeye çalıştığınız gün fark edilir.
> Gerekçenin tamamı `dagitim/yedek.sh` başlığındadır.

---

## 10. Doğrulama kontrol listesi

Yayına açmadan önce hepsi işaretlenmeli:

- [ ] `https://ALAN_ADI` açılıyor, sertifika geçerli
- [ ] `http://ALAN_ADI` HTTPS'e yönlendiriyor
- [ ] `curl -I https://ALAN_ADI` çıktısında `x-frame-options: DENY` ve
      `x-content-type-options: nosniff` var
- [ ] Sunucu dışından `nc -zv SUNUCU_IP 3000` ve `5432` **başarısız** oluyor
- [ ] Giriş ekranı açılıyor, proje yöneticisiyle panele girilebiliyor
- [ ] Rol/Atama Envanteri 81 ili listeliyor
- [ ] Bir faaliyet açılıp dosya yüklenebiliyor (depolama izinleri doğru)
- [ ] `sudo systemctl restart genctek` sonrası uygulama kendiliğinden geliyor
- [ ] Sunucu yeniden başlatıldığında (`sudo reboot`) her şey açılıyor
- [ ] `sudo -u postgres /usr/local/bin/genctek-yedek` çalışıyor ve dosya üretiyor
- [ ] `.env` izinleri 600 ve sahibi `genctek`
- [ ] `kurulum/veri-ihlali-mudahale-ve-bildirim-plani.md` iletişim kartındaki
      asıl/yedek kişiler kontrollü işletim kopyasında dolduruldu ve olay kaydı
      konumu oluşturuldu
- [ ] İlk yetki/servis hesabı incelemesi
      `kurulum/kayitlar/yetki-servis-hesabi-gozden-gecirme-sablonu.csv` ile
      yapıldı; inceleyen ve onaylayan kişi/tarihleri kaydedildi
- [ ] Yapay zekâ kullanım kuralı ekibe duyuruldu; kurumsal veya kişisel veri için
      onaylı araç bulunmadığı ve üretim verisinin geliştirme/testte
      kullanılamayacağı teyit edildi

---

## 11. Sürüm güncelleme

Sunucuda elle komut dizmeyin; sıra hatası (migration'ı derlemeden önce
çalıştırmak gibi) çalışan sistemi bozar. Betik doğru sırayı uygular:

```bash
sudo -u genctek /opt/genctek/dagitim/guncelle.sh
```

Betik `systemctl restart` için sudo ister. `genctek` kullanıcısına yalnızca bu
komut için izin verin:

```bash
sudo visudo -f /etc/sudoers.d/genctek
```
```
genctek ALL=(root) NOPASSWD: /usr/bin/systemctl restart genctek, /usr/bin/journalctl -u genctek *
```

Betik açılışı 30 saniye bekler; uygulama gelmezse günlüğü basar ve geri dönüş
komutunu yazar.

---

## 12. Sorun giderme

| Belirti | Sebep |
|---|---|
| nginx **502 Bad Gateway** | SELinux (`setsebool -P httpd_can_network_connect 1`) ya da servis çalışmıyor (`systemctl status genctek`) |
| Açılışta `OTURUM_GIZLI_ANAHTARI hâlâ örnek değerde` | `.env` içindeki anahtar değiştirilmemiş (Bölüm 5) |
| Açılışta `AUTH_PROVIDER="mock" ile üretime çıkılıyor` | Şifresiz giriş açık kalmış; EBA'ya geçin ya da riski üstlendiğinizi yazın (Bölüm 5) |
| Açılışta `IZINLI_HOSTLAR tanımlı değil` | Uygulamanın alan adı `.env`'e yazılmamış (Bölüm 5) |
| Güncellemeden sonra herkes giriş ekranına düştü | Beklenen: oturum çerezine son kullanma alanı eklendi, eski çerezler geçersiz. Kullanıcılar bir kez yeniden girer |
| `P1001: Can't reach database server` | PostgreSQL kapalı ya da `pg_hba.conf` `scram-sha-256` yapılmamış (Bölüm 3) |
| Sayfalar stilsiz geliyor | `.next/static` standalone çıktısına kopyalanmamış (Bölüm 6) |
| Dosya yükleme başarısız | `depolama` dizini yok ya da `genctek` kullanıcısına ait değil |
| Erişim logunda herkes 127.0.0.1 | nginx `X-Forwarded-For` başlığı gönderilmiyor |
| `413 Request Entity Too Large` | nginx `client_max_body_size` uygulama sınırının altında |

Günlükler:

```bash
sudo journalctl -u genctek -n 100 --no-pager     # uygulama
sudo tail -f /var/log/nginx/genctek-error.log    # vekil
sudo tail -f /var/lib/pgsql/data/log/*.log       # veritabanı
```

---

## 13. Canlı kurulum: aiotechs.cloud/genctek

Sunucuda başka üretim uygulamaları çalışıyor (IoT platformu, MQTT paneli,
Node-RED, apartman aidat uygulaması). Aşağıdaki tercihlerin hepsi **onları
bozmamak** için yapıldı.

### Node sürümü — sistem Node'una dokunulmadı

Sistemde `nodejs-16` RPM'i kurulu ve başka bileşenler ona bağlı olabilir.
Next.js 16 ise Node 20+ ister. RPM'i yükseltmek yerine Node 24 ayrı bir dizine
kuruldu:

```bash
/opt/node24/bin/node --version   # v24.11.1
```

Sunucuda zaten aynı desen vardı (`/opt/node22`). **Her npm/node komutunda mutlak
yolu kullanın**; `npm`'in shebang'i `/usr/bin/env node` olduğu için PATH'siz
çağrılırsa Node 16 ile çalışır ve hata verir:

```bash
sudo -u genctek env PATH=/opt/node24/bin:$PATH npm ci
```

### Port

3000 portunu bir docker konteyneri tutuyor; uygulama **3010**'da çalışır ve
yalnızca `127.0.0.1`'i dinler.

### Ters vekil — Apache, nginx değil

`dagitim/nginx-genctek.conf` bu sunucuda **kullanılmaz**. Apex alan adı
DirectAdmin tarafından yönetildiği için vhost dosyası doğrudan düzenlenemez
(yeniden üretilince kaybolur). Kalıcı yer:

```
/usr/local/directadmin/data/users/admin/domains/aiotechs.cloud.cust_httpd
```

Eklenen blok:

```apache
ProxyPass /genctek/ http://127.0.0.1:3010/genctek/
ProxyPassReverse /genctek/ http://127.0.0.1:3010/genctek/
ProxyPass /genctek http://127.0.0.1:3010/genctek
ProxyPassReverse /genctek http://127.0.0.1:3010/genctek
```

Değişiklikten sonra DirectAdmin'e vhost'ları yeniden ürettirin, sonra
**graceful** reload edin (restart etmeyin, diğer siteler kesilir):

```bash
echo "action=rewrite&value=httpd" >> /usr/local/directadmin/data/task.queue
/usr/local/directadmin/dataskq d
httpd -t && apachectl graceful
```

### Kurulum sırasında çıkan iki tuzak

**1. Sonsuz yönlendirme döngüsü.** Önce `RedirectMatch 301 ^/genctek$ /genctek/`
eklenmişti (sunucudaki diğer uygulamanın deseni). Next.js `trailingSlash: false`
ile çalıştığı için `/genctek/` adresini 308 ile `/genctek`'e atıyor; Apache de
tersini yapınca döngü oluştu. Çözüm: yönlendirme yok, **iki biçim de doğrudan
proxy edilir** (uzun olan önce).

**2. Oturum çerezinin yolu eziliyordu.** Vhost genelinde şu satır vardı:

```apache
ProxyPassReverseCookiePath / /merveapartmani/
```

Bu yönerge vhost kapsamlıdır ve **aynı alan adındaki her proxy yanıtının**
`Set-Cookie` yolunu değiştirir. GençTek oturum çerezi `Path=/merveapartmani/`
olarak yazıldığı için giriş yapılıyor ama sonraki istekte oturum kayboluyordu.
Yönerge kendi konumuna sınırlandırıldı:

```apache
<Location /merveapartmani/>
    ProxyPassReverseCookiePath / /merveapartmani/
</Location>
```

Diğer uygulamanın davranışı değişmedi; yalnızca kapsamı daraldı.

### Alt dizin kurulumu (`TEMEL_YOL`)

`.env` içinde `TEMEL_YOL="/genctek"`. Bu değer:

- `next.config.ts` içinde `basePath` olur — **derleme zamanında sabitlenir**,
  değiştirince yeniden derlemek şart;
- oturum ve tema çerezlerinin `path`'ini belirler. Alan adı başka uygulamalarla
  paylaşıldığı için bu güvenlik gereğidir: `path="/"` ile yazılan bir oturum
  çerezi `/mqtt`, `/merveapartmani` gibi ilgisiz uygulamalara da gönderilirdi.

### Sürüm güncelleme — bu sunucudaki komut

Bölüm 11'deki çıplak `guncelle.sh` çağrısı bu sunucuda **çalışmaz**: sistem
Node'u 16 olduğu için `npm ci` düşer, sağlık kontrolü de rehber varsayılanı olan
`127.0.0.1:3000/` adresine gider ve uygulama 3010'da `/genctek` altında
çalıştığı için 404 alır — başarılı bir güncelleme "başarısız" raporlanır. Betik
bu iki değeri ortam değişkeninden okur:

```bash
sudo -u genctek env \
  NODE_BIN_DIZINI=/opt/node24/bin \
  SAGLIK_URL=http://127.0.0.1:3010/genctek \
  /opt/genctek/dagitim/guncelle.sh
```

Farklı bir daldan kurmak için `DAL=dal-adi` ekleyin; varsayılan `main`'dir.
Betik `git pull --ff-only` kullandığı için dalın uzakta güncel olması gerekir.

> **Şema değiştiren bir sürümden önce yedek alın.** Bu sunucuda yedekleme betiği
> henüz cron'a bağlanmadı (aşağıya bakın); `migrate deploy` geri alınamaz bir
> adımdır ve altında 18 yaş altı öğrenci verisi vardır. Elle bir kez almak
> yeterli:
>
> ```bash
> sudo /opt/genctek/dagitim/yedek.sh
> ```

### Duman testi üretimde çalıştırılmaz

`npm run test:duman` veritabanına test kaydı yazar. Üretim veritabanında
**çalıştırmayın**; doğrulamayı Bölüm 10'daki kontrol listesiyle yapın.

### Yedekleme

Kuruldu ve çalışıyor (6 Ağustos 2026 doğrulaması). `dagitim/yedek.sh`,
`/usr/local/bin/genctek-yedek` olarak kurulu ve root cron'unda:

```
0 2 * * * /usr/local/bin/genctek-yedek >> /var/log/genctek-yedek.log 2>&1
```

Her gece 02:00'de **iki** dosya üretir — ikisi de gerekli, biri tek başına
geri yükleme için yetmez:

| Dosya | İçerik |
|---|---|
| `veritabani-TARIH-SAAT.dump` | PostgreSQL (`pg_dump -Fc`) |
| `depolama-TARIH-SAAT.tar.gz` | `/opt/genctek/depolama` — öğrencilerin yüklediği CV ve ekler |

`/var/backups/genctek/` altında, `600 root:root`, 30 günden eskiler silinir
(`SAKLAMA_GUN` ile değiştirilebilir).

### Üç kopya ve Apache dengelemesi (2 Eylül 2026)

Uygulama tek süreç değil, **üç kopya** halinde çalışır: `genctek` (3010),
`genctek@3020`, `genctek@3021`. Kopyalar `genctek@.service` şablonundan
üretilir; şablonun asıl birimden tek farkı `Environment=PORT=%i` satırıdır.

**Niye:** Node'un JS'i tek iş parçacıklıdır, yani tek süreç 4 vCPU'nun yalnızca
BİRİNİ kullanabiliyordu. Yük testinde verim 10 eşzamanlıdan 100'e kadar sabit
kalıyor, gecikme doğrusal artıyor, node %110 CPU'da duruyor ve PostgreSQL boşta
bekliyordu — darboğazın veritabanı değil tek çekirdek olduğunun kanıtı.

**Niye üç, dört değil:** süreç boşta 403 MB, yük altında ~980 MB tutuyor. Dört
kopya tepe anında kullanılabilir belleği aşardı ve sunucuda `genctekportal` de
var. Üç kopya üç çekirdek kullanır, dördüncüsü Apache/PostgreSQL/komşulara kalır.

**Ölçülen kazanç** (50 eşzamanlı, HTTPS): `panel/ogrenciler` 12 → 22 istek/sn,
`panel/ogretmenler` 18 → 43, `panel/okullar` 33 → 67.

**Portlar 3020/3021, 3011 DEĞİL:** 3011'i `genctekportal.service` tutuyor.

**KOPYA LİSTESİ ÜÇ YERDE DURUR** ve üçü birlikte güncellenmelidir; biri
unutulursa hata sessizdir:

| Yer | Ne için |
|---|---|
| vhost'taki `BalancerMember` satırları | trafiğin dağıtılması |
| `dagitim/guncelle.sh` · `KOPYALAR` | yayında hepsinin yeniden başlaması |
| `/etc/sudoers.d/genctek` | betiğin onları yeniden başlatabilmesi |

Yayın betiği kopyaları **sırayla** yeniden başlatır ve her birini kendi
portundan yoklar (dengeleyiciden değil — ayakta duran öteki kopya cevap verir ve
açılmayan kopya fark edilmezdi). Sıralı olduğu için yayın kesintisizdir.

**`ttl=2` şart, süs değil.** Apache arka uca kalıcı (keepalive) bağlantı tutar,
Node ise boşta kalanı beş saniyede kendisi kapatır. Apache tam o anda aynı
bağlantıyı yeniden kullanınca `AH01102 Connection reset by peer` düşüyor ve
istek 502 dönüyordu — 350 istekte bir. `ttl=2` havuzdaki bağlantıyı Node
kapatmadan önce bırakır. Node'un süresi değişirse bu değer de değişmeli.

**Hız sınırları artık kopya sayısıyla ÇARPILMIYOR** (3 Eylül 2026). Sayaçlar
süreç içi bellekteydi; balancer `lbmethod=bybusyness` kullandığı ve
`stickysession` OLMADIĞI için aynı IP'nin istekleri üç kopyaya serpiliyor, her
kopya kendi sayacını tutuyor ve etkin sınır üç katına çıkıyordu:

| Uç | Yazılan | Eskiden etkin | Şimdi etkin |
|---|---|---|---|
| İstemci hata bildirimi (IP) | 10/dk | ~30/dk | 10/dk |
| Dış kullanıcı başvurusu | 10 dakikada 5 | ~15 | 5 |
| Dış kullanıcı girişi | 10 dakikada 20 | — | 20 |

Sayaç `hiz_siniri_penceresi` tablosuna taşındı ve üç kopya aynı satırı sayıyor;
sayım tek deyimde ve atomik (`ON CONFLICT DO UPDATE ... RETURNING`), yani
eşzamanlı artışlar kaybolmuyor. **Yazılan değer artık doğrudan etkin
değerdir**; kopya sayısı değiştiğinde bu sayılara dokunmak gerekmez.

Ara çözüm olarak sınırları elle üçe bölmek denenmişti (giriş sınırı bir tur
boyunca 7 yazıldı); kopya sayısını koda gömdüğü ve sayı değiştiği gün sessizce
yanlışa düşeceği için terk edildi.

**Veritabanına ulaşılamazsa** süreç içi yedek sayaca düşülür — sınır kaldırılmaz,
yalnızca o süre boyunca kopya başına uygulanır. Penceresi geçmiş satırları
gecelik bakım siler (`scripts/gecelik-senkron.ts`); silinmeseler de sayaç doğru
çalışır, mesele tablonun sınırsız büyümemesi.

**İstisna:** hata bildirimindeki *süreç tavanı* (60/dk) bilerek süreç başına
kaldı — sorduğu soru "bu kopya dosyayı ne kadar büyütsün", ortaklaştırılsaydı
tavan üçe bölünmüş olurdu.

**Geri alma:** vhost'taki blok yerine dört düz `ProxyPass` satırı konur
(yedek: `/root/aiotechs.cust_httpd.yedek-*`), vhost'lar yeniden üretilir,
`httpd -t && apachectl graceful`; sonra `systemctl disable --now genctek@3020
genctek@3021`.

---

## 14. Günlük kullanım: gönder ve yayınla

6 Ağustos 2026'da kurulan akış. Amaç, sunucuya her yayında şifre girmemek ve
şifreleri hiçbir yerde paylaşmamak.

```
Yerel makine ──git push (HTTPS)──▶ github.com/serhatkagans/genctek7
                                            │
                                            │ git pull
                                            ▼
   ssh genctek genctek-yayinla ─────▶ /opt/genctek → derle → migrate → restart
```

> **Depo 18 Ağustos 2026'da genctek6'dan genctek7'ye taşındı.** Bu bölüm
> taşımaların gerisinde kalmayı alışkanlık hâline getirmişti: bir tur boyunca
> `genctek4`, sonra iki tur boyunca `genctek5` yazdı; sunucu ise sırayla
> genctek5 ve genctek6'dan çekiyordu. Yazılanla çalışan ayrışınca `yayinla.ps1`
> eski depoya gönderir, sunucu yenisinden çeker ve **hiçbir şeyi değiştirmeyen
> "başarılı" bir yayın** olur.
>
> Taşımada DEĞİŞECEK İKİ YER VARDIR ve ikisi birden değişmelidir: yerel
> `origin` ve sunucudaki `/opt/genctek` deposunun `origin`'i. Depo açık
> olduğu sürece üçüncü bir adım (anahtar) yoktur.
>
> Depodaki eski uzak sunucular (`eski`, `genctek1`, `genctek2`, `genctek4`,
> `genctek5`, `genctek6`) silinmedi ama **geride kaldılar**; yayın akışında
> kullanılmıyorlar.

### Tek komut

```powershell
.\dagitim\yayinla.ps1
```

`git push` + sunucuda yayın. Başka bir dal için `-Dal deneme`, yalnızca
göndermek için `-SadeceGonder`.

Elle yapmak isterseniz aynı şey iki komuttur:

```powershell
git push origin main
ssh genctek genctek-yayinla
```

### Kimlik doğrulama — hiçbir yerde şifre yok

| Bağlantı | Yöntem |
|---|---|
| Yerel → GitHub | HTTPS + Git Credential Manager (Windows'ta kayıtlı) |
| Yerel → sunucu | `~/.ssh/genctek` anahtarı, `~/.ssh/config` içinde `Host genctek` |
| Sunucu → GitHub | **HTTPS ve anonim** (genctek7 açık depo). Sunucuda dağıtım anahtarı duruyor ama DEVREDE DEĞİL — aşağıya bakın |

> **DEPOYU ÖZELE ÇEVİRİRSENİZ YAYIN DURUR.** Sunucudaki `origin`
> `https://github.com/serhatkagans/genctek7.git` ve kimlik doğrulamadan
> çekiyor; depo kapandığı anda `git pull` "Authentication failed" ile düşer.
>
> 18 Ağustos 2026'da bu bölüm bir tur da TERS yönde yanlış yazıldı: sunucunun
> SSH dağıtım anahtarıyla çektiği sanıldı ve depo taşınırken anahtarın da
> taşınması gerektiği söylendi. Sunucuda anahtar GERÇEKTEN VAR
> (`/opt/genctek/.ssh/id_ed25519`, 31 Temmuz'dan beri) ve `~/.ssh/config`
> içinde github.com kaydı da var — ama `origin` HTTPS olduğu için o kayıt hiç
> okunmuyor. Anahtar hiçbir depoda tanımlı değil; `git ls-remote git@github...`
> hem genctek6 hem genctek7 için `Permission denied (publickey)` veriyor.
> **Yazılana değil, `git remote get-url origin`e bakın.**
>
> Depo kapatılacaksa iki adım gerekir:
>
> 1. GitHub → `serhatkagans/genctek7` → Settings → Deploy keys → Add deploy key.
>    Anahtar (yazma yetkisi VERMEYİN, salt okunur yeter):
>    ```
>    ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIP10DkXWh+JLUo5JZBAcRd91Zyt37Izge4PFVI17g+BP genctek-deploy@aiotechs
>    ```
> 2. Sunucuda uzak adresi SSH'a çevirin ve doğrulayın:
>    ```bash
>    ssh genctek "cd /opt/genctek && sudo -u genctek git remote set-url origin git@github.com:serhatkagans/genctek7.git && sudo -u genctek git ls-remote origin HEAD"
>    ```
>
> Sıra önemli: anahtar tanımlanmadan adres değiştirilirse yayın
> `Permission denied (publickey)` ile ve **hiçbir şeye dokunmadan** düşer.

Root **yalnızca anahtarla** girer; şifreyle SSH kapalıdır
(`/etc/ssh/sshd_config.d/50-genctek-anahtar.conf`). Global
`PasswordAuthentication`'a bilinçli olarak dokunulmadı: sunucuda DirectAdmin'in
yönettiği başka hesaplar var ve hepsini birden kapatmak onları kilitlerdi.

> Dağıtım anahtarı GitHub'da **Deploy keys** altında tanımlıdır ve yazma yetkisi
> yoktur. Sunucu koda yazamaz; en kötü durumda okur. Anahtarı yenilerseniz
> GitHub'daki kaydı da değiştirin, yoksa yayın `Permission denied (publickey)`
> ile ve **hiçbir şeye dokunmadan** düşer.

### `genctek-yayinla` ne yapar

`/usr/local/bin/genctek-yayinla`, sırası bilinçli iki adım:

1. **Yedek** (`genctek-yedek`) — veritabanı + yüklenen dosyalar. Migration geri
   alınamaz, bu yüzden her yayından önce çalışır.
2. **Güncelleme** (`guncelle.sh`) — bu sunucuya özel değerlerle:
   `NODE_BIN_DIZINI=/opt/node24/bin`, `SAGLIK_URL=http://127.0.0.1:3010/genctek`.
   Bunlar Bölüm 13'teki sapmalardır; betiğe gömülüdür ki her seferinde
   hatırlamak gerekmesin.

Yayın düşerse betik günlüğü basar ve geri dönüş komutunu yazar:

```bash
ssh genctek 'journalctl -u genctek -n 50 --no-pager'
```

### Yedek yol: GitHub erişilemezse

Sunucudaki `paket` uzak deposu, GitHub'dan önce kullanılan git paketini
gösterir (`/opt/genctek-kaynak/genctek.bundle`) ve **duruyor**. GitHub çökerse
paketi yerelde üretip elle taşıyabilirsiniz:

```powershell
git bundle create genctek.bundle main
scp genctek.bundle genctek:/tmp/
ssh genctek 'install -o genctek -g genctek -m 644 /tmp/genctek.bundle /opt/genctek-kaynak/genctek.bundle && rm /tmp/genctek.bundle'
ssh genctek 'cd /opt/genctek && sudo -u genctek git fetch paket && sudo -u genctek git merge --ff-only paket/main'
ssh genctek genctek-yayinla
```

---

## 15. GençTek Topluluk: aiotechs.cloud/genctektopluluk (23 Ekim 2026)

Platformdan (`/genctek`) **ayrı** bir kurulum: ayrı sistem kullanıcısı
(`genctektopluluk`), dizin (`/opt/genctektopluluk`), PostgreSQL veritabanı
(`genctektopluluk`), servis (`genctektopluluk.service`) ve port (ilk kurulumda 3040–3099 arasındaki ilk boş port seçilip `.env`'e yazılır; 3040 doluydu).
Kod `github.com/serhatkagans/genctektopluluk` (açık depo, anonim HTTPS) `main`
dalından çekilir. `TEMEL_YOL="/genctektopluluk"`, `AUTH_PROVIDER="kayit"`.

Üç betik, hepsi yerelden root ile çalıştırılır ve sunucuda ayrıca indirilmez:

```bash
ssh genctek 'bash -s' < dagitim/topluluk-kur.sh      # kurulum VE her güncelleme
ssh genctek 'bash -s' < dagitim/topluluk-veri.sh     # bir kez: kullanıcılar + takvim etkinlikleri
ssh genctek 'bash -s' < dagitim/topluluk-apache.sh   # bir kez: Apache bloğu
```

- `topluluk-kur.sh` ilk çalışmada rolü, veritabanını ve `.env`'i (rastgele
  parola ve oturum anahtarı) üretir; sonraki çalışmalarda önce
  `/var/backups/genctektopluluk/` altına veritabanı yedeği alır, sonra kodu
  günceller, derler ve migration'ları uygular. `.env`'e dokunmaz.
- `topluluk-veri.sh` platform veritabanından kullanıcıları (`genctek`) ve takvim
  veritabanından önümüzdeki bir ayın etkinliklerini (`genctektakvim`) yalnızca
  OKUR; tekrar çalıştırılması zararsızdır.
- `topluluk-apache.sh` `cust_httpd`'nin EN ÜSTÜNE blok ekler (önek eşleşmesi
  yüzünden `/genctek` bloğunun üstünde olmalı), yedek alır ve `httpd -t`
  geçmezse yedeği geri koyar.

Günlük: `ssh genctek 'journalctl -u genctektopluluk -n 50 --no-pager'`
