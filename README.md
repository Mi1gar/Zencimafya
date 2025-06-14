# Mafia Forum

Modern ve güvenli bir forum platformu.

## Özellikler

- Kullanıcı kaydı ve girişi
- Profil yönetimi
- Arkadaşlık sistemi
- Forum kategorileri ve konular
- Özel mesajlaşma
- Bildirim sistemi

## Kurulum

1. PostgreSQL veritabanını kurun ve çalıştırın
2. Veritabanı şemasını oluşturun:
   ```bash
   psql -U postgres -d mafia_forum -f database/schema.sql
   ```
3. Bağımlılıkları yükleyin:
   ```bash
   npm install
   ```
4. `.env` dosyasını oluşturun:
   ```
   JWT_SECRET=your-secret-key
   DB_USER=postgres
   DB_PASSWORD=your-password
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=mafia_forum
   ```
5. Sunucuyu başlatın:
   ```bash
   npm run dev
   ```

## API Endpoint'leri

### Kimlik Doğrulama
- `POST /api/auth/register` - Yeni kullanıcı kaydı
- `POST /api/auth/login` - Kullanıcı girişi

### Kullanıcı İşlemleri
- `GET /api/users/:id` - Kullanıcı profili görüntüleme
- `PUT /api/users/profile` - Profil güncelleme

### Arkadaşlık İşlemleri
- `POST /api/friends/request` - Arkadaşlık isteği gönderme
- `PUT /api/friends/:id/accept` - Arkadaşlık isteğini kabul etme

### Forum İşlemleri
- `POST /api/topics` - Yeni konu oluşturma
- `POST /api/topics/:id/posts` - Konuya mesaj yazma

### Mesajlaşma
- `POST /api/messages` - Özel mesaj gönderme
- `GET /api/messages` - Mesajları görüntüleme

### Bildirimler
- `GET /api/notifications` - Bildirimleri görüntüleme
- `PUT /api/notifications/:id/read` - Bildirimi okundu olarak işaretleme

## Güvenlik

- JWT tabanlı kimlik doğrulama
- Şifreler bcrypt ile hashlenir
- CORS koruması
- SQL injection koruması (pg parametreleri)

## Lisans

MIT 