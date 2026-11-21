# BATUASLI kurulumu

Bu paket yayıncı ve izleyici ekranını, oda sunucusunu ve medya aktarımını içerir. Node.js 24 ile çalışır. SQLite veritabanı otomatik oluşur. Bulut hesabı veya API anahtarı gerekmez.

## Önce Windows bilgisayarında dene

Node.js 24 yüklüyken ZIP dosyasını çıkar. server.mjs dosyasının bulunduğu klasörde terminal açıp `node server.mjs` çalıştır. Chrome veya Edge'de http://localhost:3000 adresine gir. Bağlantıyı gizli pencerede açıp izleyici olarak katılabilirsin. localhost bağlantısı başka bilgisayardan kullanılamaz.

## Linux VPS ve alan adı

1. Docker Engine ve Compose eklentisi kurulu bir Linux VPS kullan. SSH terminalinde `docker compose version` ile kontrol et. Ubuntu için kurulum: https://docs.docker.com/engine/install/ubuntu/
2. Mevcut siten için bir alt alan adı seç. Örneğin izle.senin-alanadin.com. DNS panelinde **A** kaydının adı olarak **izle**, değeri olarak **VPS'in genel IPv4 adresini** gir. Bu ad için AAAA kaydı varsa aynı sunucunun erişilebilir IPv6 adresini göstermeli.
3. ZIP'i SFTP ile sunucuya yükle ve `unzip BATUASLI.zip` ile aç. Yeni sunucuda TCP 80 ve 443 bağlantılarına izin ver. 80/443 zaten Nginx veya Apache tarafından kullanılıyorsa aşağıdaki mevcut sunucu yolunu izle.
4. BATUASLI klasöründe şu komutları çalıştır. DOMAIN değerine kendi adresini yaz.

```bash
cp .env.example .env
nano .env
docker compose up -d --build
docker compose logs --tail=50 caddy app
```

5. Tarayıcıda kendi HTTPS adresini aç. Caddy sertifikayı otomatik alır. Oluşan oda bağlantısını arkadaşına gönder. Chrome veya Edge’de sekme seçerken ses paylaşımını aç. Oda bağlantısını bilen kişiler izleyici olarak katılabilir.

## Sunucuda zaten Nginx, Apache veya bir hosting paneli varsa

Mevcut web sunucusu HTTPS ve alan adı yönetimini sürdürebilir. BATUASLI klasöründe aşağıdaki komutlar yalnızca uygulama konteynerini başlatır.

```bash
docker build -t batuasli .
docker run -d --name batuasli --restart unless-stopped -p 127.0.0.1:3000:3000 -v batuasli-rooms:/data batuasli
```

Panelde alt alan adını ters proxy olarak http://127.0.0.1:3000 hedefine yönlendir, Host başlığını koru ve alan adı için SSL sertifikası etkinleştir. Nginx kullanıyorsan ilgili HTTPS server bloğunun içine aşağıdaki bölümü koy. Mevcut yapılandırmanı kontrol etmek için `nginx -t` kullan.

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    client_max_body_size 8m;
}
```

Yalnızca FTP ve statik dosya sunan bir hosting paketi oda servislerini çalıştıramaz. Node.js 24 ve kalıcı disk destekleyen hostingde başlangıç dosyası server.mjs olmalı. PORT ve DATA_DIR ortam değişkenleri desteklenir. BIND_HOST varsayılanı 127.0.0.1, konteynerde 0.0.0.0 değeridir.

## Çalışmayı kontrol et

Oda bağlantısını başka bir cihazda aç. Yayıncıda bir sekme seç, kısa bir videoyu sesli oynat. İzleyicide gerekirse oynat düğmesine bas. Doğrudan WebRTC bağlantısı kurulamazsa tarayıcı desteklediğinde kısa WebM parçaları sunucu üzerinden iletilir. Bu yol gecikme ve sunucuda trafik oluşturur. Yayını durdurunca izleyici bekleme ekranına dönmelidir.

Uygulama servisleri için `docker compose logs -f app` kullan. Veriler rooms biriminde, TLS sertifikaları certificates biriminde tutulur. DNS ve TLS gereksinimleri için https://caddyserver.com/docs/automatic-https adresine bak.
