# Socialite Next.js

Aplikasi pelaporan media sosial berbasis Next.js App Router untuk operator, manager, dan admin. Terhubung ke PostgreSQL melalui Prisma, menyimpan screenshot ke S3-compatible storage, dilengkapi brute-force protection, access logging, IP/country security policy, dan REST API untuk mobile.

Perubahan terbaru dicatat di [CHANGELOG.md](CHANGELOG.md).

## Stack

- Next.js App Router (React 19)
- Prisma + PostgreSQL
- Tailwind CSS 4
- AWS S3-compatible storage
- Sentry (error monitoring)
- bcryptjs (password hashing)
- SheetJS xlsx (export Excel)

## Struktur Folder

```text
app/
  actions/          Server Actions (auth, posts, dashboard, users, tenants, operators, security, logs)
  api/
    upload/         Route handler upload file ke S3
    mobile/         REST API untuk aplikasi mobile (JWT-based)
      auth/login/   POST — login, return JWT
      auth/me/      GET  — user dari JWT
      posts/        GET  — list laporan
      categories/   GET  — list kategori
  components/       Komponen UI (client dan server)
  lib/              Helper: session, authorization, JWT, Prisma, S3, rate limit, logger
  generated/        Prisma client hasil generate (jangan edit manual)
  settings/         Halaman admin: users, security, logs, tenants
  posts/            Halaman laporan: semua, upload, amplifikasi, per-operator
  operators/        Halaman manajemen operator (admin/manager)
  dashboard/        Dashboard ringkasan
  summary/          Halaman rekap admin dengan tab Summary dan Analytics
prisma/
  schema.prisma     Sumber schema database
```

## Role

| Role | Akses |
|------|-------|
| `admin` | Akses penuh: settings, logs, security, user management, semua laporan |
| `manager` | Dashboard tenant, verifikasi laporan tenant, manajemen operator |
| `operator` | Submit laporan sendiri saja (upload & amplifikasi) |

Operator tidak bisa mengakses `/posts` (redirect ke `/posts/upload`), tidak muncul di navigasi admin/manager.

## Halaman

| Path | Akses | Keterangan |
|------|-------|------------|
| `/login` | Public | Form login dengan rate limiting |
| `/dashboard` | Manager, Admin | Ringkasan statistik dan rekapitulasi |
| `/summary` | Admin | Rekap harian dengan tab Summary/Analytics, chart, export PDF dan Excel |
| `/posts` | Manager, Admin | Semua laporan (semua operator) |
| `/posts/upload` | Semua | Laporan jenis Upload; default tanggal hari ini; filter status |
| `/posts/amplifikasi` | Semua | Laporan jenis Amplifikasi; default tanggal hari ini; filter status |
| `/posts/users` | Manager, Admin | Rekap per-operator (sortable, filterable) |
| `/posts/users/[userId]/[status]` | Manager, Admin | Detail laporan per operator |
| `/operators` | Manager, Admin | Manajemen akun operator |
| `/settings/users` | Admin | Manajemen user (block/unblock, reset rate limit) |
| `/settings/security` | Admin | Konfigurasi IP blocklist, country allowlist, REST API, ukuran upload, kompresi image, jam pelaporan operator, dan jam validasi manager |
| `/settings/logs` | Admin | Access log audit trail |
| `/settings/tenants` | Admin | Manajemen tenant |

## Alur Utama

### Login (web)

1. Form di `app/login/page.tsx` → Server Action `login()` di `app/actions/auth.ts`
2. Request security policy dicek (IP/country blocklist)
3. Rate limit 3-tier dicek dari tabel `login_attempts`
4. User dicari dari tabel `users`, status blokir diperiksa
5. Password diverifikasi dengan `bcrypt`
6. Session cookie `sid` dibuat (HMAC-SHA256 signed, httpOnly)
7. Event dicatat ke `access_logs`

Detail lengkap: [LOGIN_FLOW.md](LOGIN_FLOW.md)

### Login (mobile — JWT)

1. `POST /api/mobile/auth/login` dengan body `{ email, password }`
2. Request security policy dan rate limit 3-tier dicek seperti web login
3. Response: `{ token, user: { id, name, email, is_admin, roles } }`
4. Token JWT HS256, expiry 7 hari, signed dengan `SESSION_SECRET`
5. Request selanjutnya: `Authorization: Bearer <token>`
6. Setiap request JWT memeriksa ulang user aktif dan role terbaru dari database

### Submit Laporan

1. User pilih kategori, isi link, upload screenshot
2. Jika Image Compression aktif, screenshot di atas 1 MB atau batas upload admin yang lebih kecil dikompresi di browser sebelum dikirim
3. Validasi di client dan server (format URL per platform, duplicate harian, magic bytes file upload)
4. Post disimpan ke `blog_posts`, screenshot diunggah ke S3, metadata ke `media`
5. Operator hanya dapat submit/edit di rentang jam operator yang diatur admin

Kompresi upload web dapat diaktifkan atau dimatikan admin melalui Settings -> Security -> Image Compression. Saat aktif, screenshot yang melebihi target dikompresi memakai canvas browser. Target kompresi adalah batas upload admin atau 1 MB, mana yang lebih kecil. Aplikasi membandingkan kandidat JPEG, WebP, dan PNG lalu memilih hasil terbesar yang masih aman di bawah target. Sisi terpanjang gambar dibatasi mulai dari 1920px dan diturunkan bertahap sampai 1080px bila semua kandidat masih terlalu besar. Validasi server tetap berjalan setelah kompresi, sehingga file yang masih terlalu besar atau bukan gambar valid akan ditolak.

Format object key S3 untuk upload baru:

```text
reports/YYYY/MM/DD/{nama-provinsi}/{nama-kota}/{jenis}/random.ext
```

Contoh:

```text
reports/2026/04/30/jawa-timur/surabaya/upload/a8f3c9d1e2b4.jpg
reports/2026/04/30/jawa-tengah/semarang/amplifikasi/f91c7a0b3d2e.png
reports/2026/04/30/dki-jakarta/kota-adm-jakarta-selatan/default/7c1e9b0d42aa.webp
```

Nama provinsi/kota diubah menjadi slug aman untuk path S3. Jika data lokasi belum lengkap, aplikasi memakai fallback `unknown-province/unknown-city`. Upload pending melalui `/api/upload` dan `/api/mobile/upload` memakai folder `pending` jika request belum mengirim `post_type`/`postType`. Path final disimpan di `media.custom_properties.object_key`, sehingga file lama dengan format lama tetap bisa dibaca dan dihapus.

### Verifikasi Laporan

1. Admin/manager mengubah status (pending → valid/invalid)
2. Setiap mutasi wajib lolos `requireManagerOrAdmin()` di server action
3. Manager hanya dapat memvalidasi laporan tenant miliknya dan hanya pada rentang jam validasi manager
4. Admin tidak terkena pembatasan jam validasi

### Login CAPTCHA

Login web mendukung Cloudflare Turnstile adaptif. Jika `CAPTCHA_SITE_KEY` dan `CAPTCHA_SECRET_KEY` tersedia di `.env`, widget CAPTCHA baru tampil setelah IP yang sama mengalami minimal 5 kegagalan login dalam 10 menit. Token diverifikasi di server sebelum pengecekan rate limit dan password.

### Filter dan Pagination Tabel

- Semua table page memakai pagination server-side berbasis URL.
- Pilihan jumlah data per halaman: `5`, `10`, `20`, `50`, `all`.
- Search berada di atas tabel mengikuti pola DataTables.
- Filter tanggal memakai `dateFrom` dan `dateTo`.
- `/dashboard`, `/posts`, `/posts/upload`, `/posts/amplifikasi`, dan `/posts/users` default ke tanggal hari ini di timezone `Asia/Jakarta`.
- `/posts`, `/posts/upload`, dan `/posts/amplifikasi` memiliki filter status `pending`, `valid`, `invalid`.
- Filter provinsi/kota membaca provinsi dari relasi `city_id` pada `addresses`.
- Standar UX filter CRUD:
  - section filter tidak boleh tertutup overlay/skeleton saat tombol Filter diklik.
  - tombol Filter wajib berubah menjadi `Memproses...`, menampilkan spinner kecil, dan disabled selama proses.
  - skeleton hanya tampil pada area hasil/table body; header tabel dan filter tetap terlihat.
  - hindari full-page loading overlay untuk proses filter tabel.

### Dashboard

Membaca dari SQL views:
- `v_pelaporan_media_sosial`
- `v_kuota_per_kota`
- `v_rekapitulasi_pelaporan`

Export ke Excel dengan hyperlink aktif via SheetJS.

Dashboard admin dan manager menampilkan 3 card operator: Total Operator, Sudah Lapor, dan Belum Lapor. Card Sudah Lapor dan Belum Lapor dapat diklik untuk membuka dialog tabel operator sesuai filter tanggal, status, provinsi, kota, serta tenant. Definisi Sudah Lapor pada card menghitung operator unik dalam filter aktif. Grafik Pelapor per Provinsi, Pelapor per Kota, Pelapor per Tanggal, dan Rekapitulasi Pelaporan menghitung pelapor per tanggal dalam rentang filter: operator harus memiliki minimal satu laporan upload dan satu laporan amplifikasi pada tanggal tersebut.

### Summary

Halaman `/summary` adalah halaman admin terpisah dari `/dashboard`.

Fitur:

- Layout aplikasi lengkap: sidebar, header, dan content area normal.
- Sidebar menu `Summary` tampil untuk admin, sementara menu `Dashboard` tetap dipertahankan.
- Sidebar dapat dicollapse.
- Tab `Summary` berisi rekap harian dan chart di bagian bawah.
- Tab `Analytics` berisi tampilan analitik sesuai dokumen rujukan.
- Export tersedia dalam PDF dan Excel.
- File PDF/Excel hanya berisi data laporan, tanpa card UI.

## REST API Mobile

Base URL: `/api/mobile`

Semua endpoint kecuali login memerlukan header:
```
Authorization: Bearer <jwt_token>
```

### `POST /api/mobile/auth/login`

Request:
```json
{ "email": "user@example.com", "password": "secret" }
```

Response:
```json
{
  "token": "eyJ...",
  "user": { "id": "1", "name": "Budi", "email": "...", "is_admin": false, "roles": ["operator"] }
}
```

### `GET /api/mobile/auth/me`

Response: object user sama seperti di atas (tanpa token).

### `GET /api/mobile/posts`

Query params: `page`, `search`, `categoryId`, `status`, `dateFrom`, `dateTo`, `sortOrder`, `postType` (upload|amplifikasi), `userId`, `tenantId`

Scoping:

- Operator otomatis hanya melihat laporan miliknya sendiri (filter by JWT sub).
- Manager otomatis dibatasi ke tenant miliknya; `tenantId` arbitrary ditolak.
- Admin dapat memakai filter `userId` dan `tenantId`.

Response:
```json
{ "posts": [...], "total": 120 }
```

### `GET /api/mobile/categories`

Response: `[{ "id": "1", "name": "Instagram" }, ...]`

## Library Utama (`app/lib/`)

| File | Fungsi |
|------|--------|
| `session.ts` | HMAC-signed cookie session (web) |
| `jwt.ts` | Sign/verify JWT HS256 (mobile) |
| `api-auth.ts` | Middleware Bearer token untuk API routes |
| `authorization.ts` | `requireUser`, `requireAdmin`, `requireManagerOrAdmin` |
| `permissions.ts` | `getUserRoles` dari `model_has_roles` + `tenant_user` |
| `login-rate-limit.ts` | Rate limit 3-tier berbasis database |
| `request-security.ts` | IP blocklist & country allowlist |
| `access-logs.ts` | Tulis event keamanan ke tabel `access_logs` |
| `tenant-access.ts` | Helper authorization tenant/post untuk admin, manager, operator |
| `posts-query.ts` | Query data posts yang dipakai server action dan REST API mobile |
| `file-validation.ts` | Deteksi magic bytes upload gambar aman |
| `s3.ts` | Upload, delete, URL media di S3 |
| `prisma.ts` | Singleton Prisma client |

## Konvensi

- Setiap `'use server'` action wajib memanggil `requireUser()` / `requireAdmin()` / `requireManagerOrAdmin()` sebagai baris pertama
- Setiap `page.tsx` wajib cek `getSessionUser()` + redirect jika tidak auth
- Filter tabel: gunakan `force-dynamic` + `key` prop pada client component + `router.push` di `startTransition`; tombol Filter harus menampilkan `Memproses...` dan skeleton hanya muncul di table body/result area
- Sort tabel: gunakan `useRouter` + `startTransition`, bukan `<Link>`
- Pagination: URL-based, page size dapat dipilih `5`, `10`, `20`, `50`, atau `all`, selalu preserve filter params
- Upload file wajib divalidasi dari isi file, bukan dari header/nama file dari klien
- Media upload pending wajib divalidasi ownership sebelum dipakai sebagai `media_id`

## Environment Variables

```env
DATABASE_URL=
SESSION_SECRET=              # dipakai untuk cookie HMAC dan JWT mobile
S3_ENDPOINT=
S3_REGION=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_BUCKET=
NEXT_PUBLIC_S3_PUBLIC_URL=
SENTRY_DSN=                  # opsional
CAPTCHA_SITE_KEY=            # opsional, Cloudflare Turnstile login web
CAPTCHA_SECRET_KEY=          # opsional, Cloudflare Turnstile login web
```

## Menjalankan Aplikasi

```bash
npm install
npm run dev
```

Buka `http://localhost:3000`.

## Aplikasi Mobile (Expo)

Project Expo berada di `/Users/sani/Documents/Personal/Projects/Bmi/Apps/BmiApps`.

```bash
cd /path/to/BmiApps
npm install
npm run ios     # atau npm run android
```

Ubah `BASE_URL` di `src/api/client.ts` ke IP server Next.js (bukan `localhost`) saat testing di device fisik.

Fitur mobile saat ini:
- Login dengan email/password → JWT disimpan di SecureStore
- List laporan dengan infinite scroll
- Halaman profil + logout

## Quality Checklist Sebelum Rilis

- `npm run lint` lulus tanpa error
- `SESSION_SECRET` dan semua env S3 terisi
- Test login, submit laporan, verifikasi, bulk delete
- Test dashboard untuk admin dan manager
- Test upload screenshot (URL media harus benar)
- Test API mobile: login, get posts, get categories
- Test pembatasan jam operator dan manager
- Test export Summary PDF dan Excel
- Cek access logs tercatat dengan benar di `/settings/logs`
