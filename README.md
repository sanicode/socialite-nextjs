# Socialite Next.js

Aplikasi pelaporan media sosial berbasis Next.js App Router untuk operator, manager, dan admin. Terhubung ke PostgreSQL melalui Prisma, menyimpan screenshot ke S3-compatible storage, dilengkapi brute-force protection, access logging, IP/country security policy, dan REST API untuk mobile.

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
| `/posts` | Manager, Admin | Semua laporan (semua operator) |
| `/posts/upload` | Semua | Laporan jenis Upload |
| `/posts/amplifikasi` | Semua | Laporan jenis Amplifikasi |
| `/posts/users` | Manager, Admin | Rekap per-operator (sortable, filterable) |
| `/posts/users/[userId]/[status]` | Manager, Admin | Detail laporan per operator |
| `/operators` | Manager, Admin | Manajemen akun operator |
| `/settings/users` | Admin | Manajemen user (block/unblock, reset rate limit) |
| `/settings/security` | Admin | Konfigurasi IP blocklist & country allowlist |
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
2. Validasi sama seperti web (password bcrypt), tapi tanpa rate limit mobile saat ini
3. Response: `{ token, user: { id, name, email, is_admin, roles } }`
4. Token JWT HS256, expiry 7 hari, signed dengan `SESSION_SECRET`
5. Request selanjutnya: `Authorization: Bearer <token>`

### Submit Laporan

1. User pilih kategori, isi link, upload screenshot
2. Validasi di client dan server (format URL per platform, duplicate harian)
3. Post disimpan ke `blog_posts`, screenshot diunggah ke S3, metadata ke `media`

### Verifikasi Laporan

1. Admin/manager mengubah status (pending → valid/invalid)
2. Setiap mutasi wajib lolos `requireManagerOrAdmin()` di server action

### Dashboard

Membaca dari SQL views:
- `v_pelaporan_media_sosial`
- `v_kuota_per_kota`
- `v_rekapitulasi_pelaporan`

Export ke Excel dengan hyperlink aktif via SheetJS.

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

Query params: `page`, `search`, `categoryId`, `dateFrom`, `dateTo`, `sortOrder`, `postType` (upload|amplifikasi), `userId`, `tenantId`

Operator otomatis hanya melihat laporan miliknya sendiri (filter by JWT sub).

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
| `s3.ts` | Upload, delete, URL media di S3 |
| `prisma.ts` | Singleton Prisma client |

## Konvensi

- Setiap `'use server'` action wajib memanggil `requireUser()` / `requireAdmin()` / `requireManagerOrAdmin()` sebagai baris pertama
- Setiap `page.tsx` wajib cek `getSessionUser()` + redirect jika tidak auth
- Filter tabel: gunakan `force-dynamic` + `key` prop pada client component + `router.push` di `startTransition`
- Sort tabel: gunakan `useRouter` + `startTransition`, bukan `<Link>`
- Pagination: URL-based, page size 20 (tabel management) atau 50 (log), selalu preserve filter params

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
- Cek access logs tercatat dengan benar di `/settings/logs`
