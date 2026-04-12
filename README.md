# Socialite Next.js

Frontend pelaporan media sosial berbasis Next.js App Router untuk operator, manager, dan admin. Aplikasi ini terhubung ke PostgreSQL melalui Prisma, menyimpan screenshot ke S3-compatible storage, dan memakai Sentry untuk monitoring error.

## Stack

- Next.js 16 App Router
- React 19
- Prisma + PostgreSQL
- AWS S3 compatible storage
- Tailwind CSS 4
- Sentry

## Struktur Singkat

```text
app/
  actions/        Server Actions untuk auth, post, dan dashboard
  api/            Route Handlers
  components/     Komponen UI client/server
  lib/            Session, authz, Prisma, S3, logger, helper umum
  generated/      Prisma client hasil generate
prisma/
  schema.prisma   Sumber schema database
```

## Role

- `admin`: akses penuh, termasuk delete, edit, verifikasi, dan dashboard global
- `manager`: akses dashboard tenant dan verifikasi laporan tenant
- `operator/user`: membuat laporan miliknya sendiri

## Alur Utama

### Login

1. User mengirim email dan password lewat Server Action `app/actions/auth.ts`.
2. Password diverifikasi dengan `bcrypt`.
3. Session disimpan dalam cookie `sid` yang ditandatangani HMAC.
4. Rate limiting diterapkan untuk percobaan login gagal.

### Submit laporan

1. User memilih kategori, mengisi link upload, dan mengunggah screenshot.
2. Validasi dilakukan di client dan server.
3. Server mengecek duplicate entry per kategori per hari.
4. Post disimpan ke tabel `blog_posts`.
5. Screenshot diunggah ke bucket S3 dan metadata disimpan ke tabel `media`.

### Verifikasi laporan

1. Admin dan manager dapat mengubah status laporan.
2. Semua mutasi sensitif wajib lolos pemeriksaan auth/role di server action.

### Dashboard

Dashboard membaca ringkasan dan rekap dari tabel utama serta SQL views seperti:

- `v_pelaporan_media_sosial`
- `v_kuota_per_kota`
- `v_rekapitulasi_pelaporan`

## Konvensi Internal

- `actions/` sebaiknya tipis: validasi akses, panggil logic, lalu return hasil
- `lib/authorization.ts` dipakai untuk guard seperti `requireUser`, `requireAdmin`, dan `requireManagerOrAdmin`
- query raw yang menyentuh SQL view perlu diberi nama fungsi yang jelas dan komentar singkat
- generated Prisma berada di `app/generated/prisma`; hindari edit manual di folder itu

## Environment Penting

Beberapa environment variable yang wajib tersedia:

- `DATABASE_URL`
- `SESSION_SECRET`
- `S3_ENDPOINT`
- `S3_REGION`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_BUCKET`
- `NEXT_PUBLIC_S3_PUBLIC_URL`

## Menjalankan Aplikasi

```bash
npm install
npm run dev
```

Buka `http://localhost:3000`.

## Quality Checklist Sebelum Rilis

- jalankan `npm run lint`
- pastikan `SESSION_SECRET` dan env storage terisi
- cek login, submit laporan, edit laporan, verifikasi, dan bulk delete
- cek dashboard untuk admin dan manager
- pastikan upload screenshot berhasil dan URL media benar
