# Laporan Pekerjaan — Mei 2026
**Project:** Socialite  
**Developer:** Sani Iman Pribadi  
**Periode:** 1 – 11 Mei 2026  

---

## Ringkasan Eksekutif

Selama periode ini terdapat **24 commit** yang mencakup fitur baru, perbaikan keamanan, refactoring komponen UI, dan pengerjaan integrasi media sosial yang sedang berjalan. Pekerjaan utama meliputi: pembangunan halaman Summary & Analitik, penambahan proteksi CAPTCHA pada login, pembangunan halaman Statistik dari awal, refactoring besar arsitektur komponen tabel, dan fondasi integrasi OAuth untuk platform media sosial (Facebook, Instagram, TikTok, YouTube).

---

## Detail Pekerjaan per Tanggal

### 1 Mei 2026

#### 1.1 Halaman Summary untuk Admin (Fitur Baru)
- **Pembangunan halaman Summary dari awal** (`app/summary/`):
  - `app/summary/page.tsx` — halaman ringkasan data seluruh operator (+380 baris)
  - `app/summary/layout.tsx` — layout halaman summary
  - `app/summary/loading.tsx` — skeleton loading state
- Membuat komponen pendukung Summary:
  - `app/components/summary/SummaryExcelButton.tsx` — ekspor data summary ke file Excel
  - `app/components/summary/SummaryLineChart.tsx` — grafik tren data summary
  - `app/components/summary/SummaryPdfButton.tsx` — ekspor data summary ke PDF
- Menambah link Summary di sidebar (`app/components/Sidebar.tsx`).
- Membuat komponen `app/components/TablePageSizeSelect.tsx` untuk pilihan jumlah baris per halaman.
- Membuat helper pagination `app/lib/table-pagination.ts`.
- Pembaruan tabel dan filter di seluruh halaman utama untuk konsistensi UI.
- **File terdampak:** 28 file, +1120 / -159 baris

#### 1.2 Halaman Analitik Summary (Fitur Baru)
- Perluasan besar `app/summary/page.tsx` dengan fitur **analitik lengkap**: grafik tren harian, ringkasan per operator, filter tanggal, dan visualisasi data (+278 baris).
- **File terdampak:** `app/summary/page.tsx`, +278 / -10 baris

#### 1.3 Security Patch — Pengamanan Seluruh API & Actions
- Audit menyeluruh dan penambahan **autentikasi + otorisasi** ke semua endpoint mobile API (40+ route files).
- Membuat `app/lib/posts-query.ts` (+308 baris) untuk sentralisasi query posts yang aman.
- Membuat `app/lib/tenant-access.ts` (+93 baris) untuk validasi akses tenant.
- Membuat `app/lib/file-validation.ts` untuk validasi file upload di sisi server.
- Perbaikan `app/lib/api-auth.ts` dan `app/lib/authorization.ts`.
- Perbaikan besar `app/api/mobile/auth/login/route.ts`: hardening login endpoint.
- Dokumentasi lengkap: `SECURITY-ISSUE.md` (+273 baris), update `CHANGELOG.md`, `LOGIN_FLOW.md`, `README.md`.
- **File terdampak:** 60 file, +1458 / -336 baris

#### 1.4 Pembaruan Dashboard & Folder S3
- Refactoring besar `app/actions/dashboard.ts` dengan query baru (+354 baris).
- Pembaruan `app/components/dashboard/StatCards.tsx` dengan tampilan yang lebih kaya (+292 baris).
- Membuat `app/lib/report-location.ts` untuk manajemen lokasi laporan.
- Perbaikan `app/lib/s3.ts` dengan struktur folder S3 yang baru.
- **File terdampak:** 14 file, +736 / -113 baris

#### 1.5 Tambah Cloudflare Turnstile CAPTCHA pada Login
- Integrasi **Cloudflare Turnstile** sebagai lapisan proteksi tambahan di halaman login.
- Menambah library captcha (`app/lib/captcha.ts`) untuk verifikasi token di sisi server.
- Memperbarui `app/actions/auth.ts` agar memvalidasi token CAPTCHA sebelum memproses login.
- Memperbarui `app/components/LoginPageClient.tsx` untuk merender widget Turnstile dan mengirimkan token.
- Memperluas `app/lib/login-rate-limit.ts` dengan logika pendukung CAPTCHA.
- **File terdampak:** `app/lib/captcha.ts` (baru), `app/actions/auth.ts`, `app/components/LoginPageClient.tsx`, `app/lib/login-rate-limit.ts`, `app/login/page.tsx`

#### 1.6 Pembaruan Dashboard & Kompresi Gambar
- Refactoring besar `app/actions/dashboard.ts`: menyederhanakan query dan memperbaiki struktur data.
- Menambah fitur **kompresi gambar** sebelum upload di `app/components/posts/ImageUpload.tsx` untuk mengurangi ukuran file yang dikirim ke S3.
- Memperbarui `app/components/dashboard/DashboardFilters.tsx` dan `ReportTable.tsx`.
- Penambahan opsi **toggle visibilitas kolom** di tabel laporan.
- Perbaikan `app/components/settings/SecuritySettingsForm.tsx` dengan field baru.
- Penambahan route API baru: `app/api/mobile/settings/security/route.ts`.
- Update dokumentasi `CHANGELOG.md`, `LOGIN_FLOW.md`, `README.md`.
- **File terdampak:** 29 file, +604 / -230 baris

---

### 2 Mei 2026

#### 2.1 Ijinkan Semua Ukuran File dengan Batas Maksimum Konfigurasi
- Menghapus validasi ukuran file hardcoded dari `app/components/posts/ImageUpload.tsx`.
- Ukuran maksimum kini dibaca dari konfigurasi (`app/lib/upload-size.ts`), bukan hardcode.
- **File terdampak:** `app/components/posts/ImageUpload.tsx`, `README.md`

#### 2.2 Fitur Statistik & Validasi Pelaporan (Fondasi)
- **Pembangunan halaman Statistik dari awal** (`app/statistik/`):
  - `app/statistik/page.tsx` — halaman utama dengan auth guard
  - `app/statistik/layout.tsx` — layout halaman statistik
  - `app/statistik/StatistikDashboardClient.tsx` — komponen client-side dashboard statistik
- Membangun **API endpoint statistik** (`app/api/statistik/route.ts`) untuk menyajikan data agregat ke client.
- Membuat library data statistik (`app/lib/statistik-data.ts`) dengan query Prisma untuk agregasi data per operator, per kota, per provinsi, per hari.
- Pembuatan halaman **Pelaporan per Operator** (`app/posts/users/[userId]/page.tsx`).
- Menambah validasi di `app/actions/posts.ts` untuk pembuatan laporan.
- Perbaikan tabel `app/components/posts/users/PostsByUsersTable.tsx`.
- **File terdampak:** 12 file, +1350 / -10 baris

---

### 3 Mei 2026

#### 3.1 Pengamanan & Sensor Data Sensitif pada API Statistik
- Menambah **autentikasi wajib** di `app/api/statistik/route.ts` agar endpoint tidak bisa diakses tanpa login.
- Memperbarui `app/lib/statistik-data.ts` agar tidak menyertakan `tenantUserId` dalam response API.
- Menambah **masking data sensitif** di `app/components/dashboard/StatCards.tsx` untuk menyembunyikan identitas operator dari tampilan statistik publik.

#### 3.2 Pembaruan Tampilan & Warna Statistik
- Desain ulang skema warna komponen statistik: `CityBarChart`, `DailyPostsChart`, `ProvinceDonutChart`, `StatCards`.
- Penambahan variabel CSS global di `app/globals.css` untuk tema statistik (+444 baris).
- Perbaikan besar `app/statistik/StatistikDashboardClient.tsx` dengan tampilan yang lebih kaya.
- **File terdampak:** 7 file, +1157 / -155 baris

#### 3.3 Switch Tema pada Halaman Statistik
- Menambah tombol toggle **dark/light mode** khusus di halaman statistik (terpisah dari tema global).
- **File terdampak:** `app/statistik/StatistikDashboardClient.tsx`

#### 3.4 Perbaikan Filter & Chart Statistik
- Memperbaiki validasi `dateFrom`/`dateTo` agar tidak divalidasi ulang dari sisi client (cukup dari server).
- Dua putaran perbaikan chart (bar dan donut): proporsi, warna, dan responsivitas.
- Menambah tombol **collapse filter** pada layar kecil untuk menghemat ruang.

---

### 4 Mei 2026

#### 4.1 Refactoring Arsitektur Komponen Tabel (Major)
- Ekstraksi logika filter + state dari halaman page ke komponen client tersendiri untuk semua tabel utama:
  - `app/components/settings/UsersClientSection.tsx` (baru)
  - `app/components/settings/TenantsClientSection.tsx` (baru)
  - `app/components/settings/LogsClientSection.tsx` (baru)
  - `app/components/operators/OperatorsClientSection.tsx` (baru)
- Membuat komponen `app/components/FilterSubmitButton.tsx` yang digunakan bersama oleh semua tabel (menampilkan state "Memproses..." saat filter dikirim).
- Menyederhanakan halaman: `app/settings/users/page.tsx`, `app/settings/logs/page.tsx`, `app/settings/tenants/page.tsx`, `app/operators/page.tsx`.
- Penambahan AGENTS.md ke repositori sebagai panduan aturan pengkodean.
- **File terdampak:** 18 file, +918 / -314 baris

#### 4.2 Perbaikan UI Pelaporan per Operator
- Memperbarui `app/components/posts/users/SearchInput.tsx` dengan desain yang lebih baik.
- Menyederhanakan `app/posts/users/page.tsx` dan `app/posts/users/[userId]/page.tsx`.
- Perbaikan tabel `PostsByUsersTable.tsx`.
- **File terdampak:** 4 file

#### 4.3 Perbaikan UI untuk Role Manager
- Memperbaiki tampilan `app/components/posts/PostsTable.tsx` untuk role manager.
- Perbaikan `app/posts/users/[userId]/[status]/UserPostsTableClient.tsx`.
- Menghapus duplikasi komponen `ImageUpload.tsx`.

#### 4.4 Pembaruan Statistik, Dashboard & Summary
- Penambahan field baru di `app/actions/dashboard.ts` untuk StatCards.
- Perbaikan `app/components/dashboard/StatCards.tsx`.
- Pembaruan ekspor di `app/components/summary/SummaryExcelButton.tsx` dan `SummaryPdfButton.tsx`.
- Pembaruan besar halaman summary (`app/summary/page.tsx`): +80 baris dengan kolom baru.

---

### 5–6 Mei 2026

#### 5.1 Tampilkan Informasi Tenant pada Halaman Users
- Memperbarui `app/components/settings/UsersTable.tsx` untuk menampilkan informasi tenant pengguna.
- Memperbarui `app/actions/users.ts` agar query menyertakan data tenant.

#### 5.2 Fitur Integrasi Social Media OAuth (Fondasi)
- Membangun fondasi lengkap untuk **koneksi akun media sosial** (Facebook, Instagram, TikTok, YouTube):
  - **Database:** Migrasi SQL `2026-05-05-create-user-social-medias.sql` dan model Prisma `UserSocialMedia`.
  - **OAuth flow:** `app/api/social-oauth/[platform]/start/route.ts` (inisiasi OAuth) dan `app/api/social-oauth/[platform]/callback/route.ts` (callback handler).
  - **Library:** `app/lib/social-oauth.ts` — enkripsi/dekripsi token, exchange code, refresh token (~350 baris).
  - **Actions:** `app/actions/social-medias.ts` — server actions untuk connect/disconnect akun.
  - **UI:** `app/social-medias/page.tsx`, `app/social-medias/layout.tsx`, `app/social-medias/SocialMediaAccountsClient.tsx`.
  - **Sidebar:** Menambah link "Social Media" di `app/components/Sidebar.tsx`.
- Menambah komponen error screen: `app/components/AppErrorScreen.tsx`, `app/components/DatabaseUnavailableScreen.tsx`.
- Menambah `app/error.tsx` sebagai global error boundary Next.js.
- Memperbarui `app/lib/database-errors.ts` untuk deteksi error koneksi database.
- **File terdampak:** 29 file, +1345 / -64 baris

---

## Ringkasan Statistik

| Kategori | Jumlah |
|----------|--------|
| Total commit | 24 |
| Hari aktif pengerjaan | 7 hari (30 Apr – 6 Mei) |
| File dimodifikasi (committed) | ~130+ file |
| Baris ditambahkan (committed) | ~7.500+ baris |
| Baris dihapus (committed) | ~1.200+ baris |

## Kategori Pekerjaan

| Kategori | Keterangan |
|----------|------------|
| **Fitur Baru** | Summary & Analitik, Statistik dashboard, CAPTCHA login, Social media OAuth |
| **Keamanan** | Securing API statistik, sensor data sensitif, file validation |
| **Refactoring** | Ekstraksi ClientSection components, FilterSubmitButton, penyederhanaan pages |
| **UI/UX** | Tema statistik, dark mode, chart improvements, responsive filter |
| **Database** | Migrasi tabel `user_social_medias`, field profil medsos |
