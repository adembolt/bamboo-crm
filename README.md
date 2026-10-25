# Bamboo CRM — Bamboo Beauty Lifes

Güzellik salonu (beauty & wellness) için randevu, müşteri ve kasa yönetimi.
DIKIDI'nin yerine geçecek, Salon Kasası'nın üstüne kurulan kendi sistemimiz.

**Yığın:** Next.js 16 (App Router, TypeScript, Tailwind 4) · Supabase (Postgres, Auth, Storage) · Vercel

## Modüller (v0.1)

| Modül | Durum |
| --- | --- |
| Takvim — personel sütunlu gün görünümü, randevu oluşturma | ✅ |
| **Günlük müşteri özeti kartı** — bir müşterinin o günkü tüm hizmetleri + toplam, hangi kaleme tıklanırsa tıklansın | ✅ |
| Müşteri listesi, arama, müşteri kartı, ziyaret geçmişi, seans paketleri | ✅ |
| Hizmet listesi (461 hizmet, 21 kategori) + **online göster** anahtarı (tek tek / toplu / kategori) | ✅ |
| Personel kartları, ücret modeli | ✅ |
| Online talep kuyruğu (onayla → takvime işlenir) | ✅ |
| Ayarlar (çalışma saatleri, online randevu kuralları) | ✅ |
| Herkese açık online randevu sayfası | ⏳ faz 2 |
| Kasa / ödeme / hak ediş (Salon Kasası birleşmesi) | ⏳ faz 2 |
| WhatsApp hatırlatma, PWA push | ⏳ faz 3 |

## Kurulum

### 1. Supabase

1. supabase.com → New project (Frankfurt). Project Settings → API'den **Project URL** ve **anon** anahtarını al.
2. SQL Editor'de sırasıyla çalıştır:
   - `supabase/migrations/0001_init.sql` (şema + RLS)
   - `supabase/seed/0002_services.sql` (461 hizmet, kategoriler)
   - `supabase/seed/0003_staff_resources.sql` (personel, kabinler)
3. Authentication → Users → **Add user** ile kendi e-postanı ve bir şifre oluştur (ilk kullanıcı otomatik **owner** olur).
4. Authentication → Providers → Email: "Confirm email" kapalı olabilir (kendi ekibimiz).

### 2. Vercel

1. vercel.com → Add New → Project → `adembolt/bamboo-crm` → Import.
2. Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API → service_role; gizli)
   - `NEXT_PUBLIC_SITE_URL` = Vercel'in verdiği adres (sonra `https://panel.bamboobeautylifes.com`)
3. Deploy. Adres: `https://<proje>.vercel.app/panel`
4. Telefonda Safari/Chrome ile aç → "Ana ekrana ekle" → uygulama gibi çalışır.

### 3. Yerel geliştirme

```bash
cp .env.example .env.local   # değerleri doldur
npm install
npm run dev                  # http://localhost:3000
```

## Veri modeli (özet)

- `service_categories`, `services` — çok dilli ad (TR/EN/RU), süre, fiyat, seans sayısı, **online_visible**
- `staff`, `staff_services`, `staff_schedules`, `staff_time_off`, `resources`
- `customers`, `customer_photos`, `customer_packages`, `treatment_logs`
- `visits` (müşteri + gün) → `visit_items` (hizmet, personel, saat, fiyat). Aynı müşteri aynı gün = tek ziyaret; takvimde her kalem kendi personel sütununda, kart tüm kalemleri gösterir.
- `sales`, `sale_payments` — ziyaret kapanışı
- `booking_requests` — online talepler
- RLS: owner/manager tam yetki; reception müşteri/randevu/satış; staff okuma; anonim sadece online görünür hizmet/personel/ayar okur ve talep bırakır.

## DIKIDI'den veri aktarımı

`scripts/import_dikidi_services.py` → `supabase/seed/dikidi_services.csv` dosyasını okuyup `0002_services.sql` üretir. Müşteri ve randevu geçmişi aktarımı faz 2'de.
