# Laporan Pekerjaan — Mei 2026
**Project:** Socialite  
**Developer:** Sani Iman Pribadi  
**Periode:** 1 – 14 Mei 2026  

---

## Ringkasan Eksekutif

Selama periode ini terdapat **24 commit awal** dan beberapa perubahan berjalan yang mencakup fitur baru, perbaikan keamanan, refactoring komponen UI, dan pengerjaan integrasi media sosial yang sedang berjalan. Pekerjaan utama meliputi: pembangunan halaman Summary & Analitik, penambahan proteksi CAPTCHA pada login, pembangunan halaman Statistik dari awal, refactoring besar arsitektur komponen tabel, fondasi integrasi OAuth untuk platform media sosial (Facebook, Instagram, TikTok, YouTube), serta hardening validasi link laporan upload dan proteksi API statistik publik.

---

## Aturan Pemeliharaan Laporan

Setiap perubahan aplikasi harus dicatat di file ini, terutama perubahan yang menyentuh fitur, keamanan, validasi data, API, UI utama, database, deployment, atau konfigurasi runtime. Catatan minimal berisi tanggal, ringkasan perubahan, file utama yang terdampak, dan hasil verifikasi bila ada.

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

### 13–14 Mei 2026

#### 13.1 Hardening Validasi Link Upload Media Sosial
- Memindahkan validasi URL media sosial ke helper bersama `app/lib/social-platform.ts`.
- Validasi link upload sekarang menggunakan parser URL, hanya menerima protokol `http`/`https`, dan memastikan hostname benar-benar sesuai platform kategori laporan.
- Menambahkan guard render link di tabel laporan agar data lama yang tidak valid tidak dirender sebagai link aktif.
- **File terdampak:** `app/lib/social-platform.ts`, `app/actions/posts.ts`, `app/api/mobile/posts/route.ts`, `app/api/mobile/posts/[id]/route.ts`, `app/components/posts/PostsTable.tsx`, `app/posts/users/[userId]/[status]/UserPostsTableClient.tsx`.

#### 13.2 Proteksi API Statistik Publik dengan Token Singkat
- Halaman `/statistik?id=bmi` tetap public sesuai kebutuhan aplikasi.
- Request data ke `/api/statistik` kini wajib membawa Bearer token khusus statistik yang dibuat saat render halaman.
- Token berlaku singkat, memiliki scope khusus `statistik`, dan diikat ke `id=bmi` serta fingerprint request.
- **File terdampak:** `app/lib/statistik-token.ts`, `app/statistik/page.tsx`, `app/statistik/StatistikDashboardClient.tsx`, `app/api/statistik/route.ts`.

#### 13.3 Pencegahan Duplikasi Link pada Laporan Upload
- Menambahkan validasi agar satu link laporan upload hanya dapat digunakan satu kali lintas operator.
- Duplicate check diterapkan di form web dan API mobile, baik saat create maupun update.
- Menambahkan normalisasi URL upload sebelum disimpan untuk mengurangi bypass dari variasi huruf besar host, hash, trailing slash, dan tracking query umum.
- Duplicate check dibuat kompatibel dengan data lama yang sudah terlanjur menyimpan share text panjang.
- **File terdampak:** `app/lib/upload-link-duplicates.ts`, `app/lib/social-platform.ts`, `app/actions/posts.ts`, `app/api/mobile/posts/route.ts`, `app/api/mobile/posts/[id]/route.ts`.

#### 13.4 Pembersihan Input Share Text TikTok/TikTok Lite
- Input seperti `https://vm.tiktok.com/... Postingan ini dibagikan via TikTok Lite...` kini diproses dengan mengambil URL `http/https` pertama saja.
- Deskripsi otomatis dari aplikasi share TikTok/TikTok Lite tidak lagi ikut tersimpan ke database untuk laporan baru.
- Validasi dan duplicate check menggunakan URL pertama yang sudah dinormalisasi.
- **File terdampak:** `app/lib/social-platform.ts`.

#### 14.1 Dokumentasi Laporan Pekerjaan
- Memindahkan `laporan-pekerjaan.md` dari root repository ke folder `docs/`.
- Menambahkan aturan pemeliharaan agar setiap perubahan aplikasi berikutnya dicatat pada laporan pekerjaan ini.
- **File terdampak:** `docs/laporan-pekerjaan.md`.

#### 14.2 Pengambilan Metadata Link Upload
- Menambahkan pengambilan metadata HTML dari link upload yang diinput operator.
- Metadata diambil hanya setelah URL lolos validasi platform sosial, dengan batas redirect, timeout, dan ukuran response untuk mengurangi risiko SSRF dan request berat.
- Metadata judul/deskripsi dari Open Graph, Twitter Card, meta description, atau title HTML disimpan ke kolom `description`.
- Form web kini menerima paste share text dari aplikasi sosial, lalu server tetap mengambil URL pertama yang valid.
- **File terdampak:** `app/lib/link-metadata.ts`, `app/lib/social-platform.ts`, `app/actions/posts.ts`, `app/api/mobile/posts/route.ts`, `app/api/mobile/posts/[id]/route.ts`, `app/components/posts/PostForm.tsx`.

#### 14.3 Tampilkan Deskripsi pada Laporan Upload Operator
- Menambahkan kolom `Deskripsi` pada tabel `/posts/upload` khusus tampilan operator.
- Kolom ini menampilkan metadata link yang tersimpan di `description`, dibatasi dua baris agar tabel tetap mudah dipindai.
- **File terdampak:** `app/components/posts/PostsTable.tsx`, `docs/laporan-pekerjaan.md`.

#### 14.4 Preview Metadata pada Form Upload
- Menambahkan field `Description` read-only pada form `/posts/upload/new`.
- Preview metadata diambil otomatis dari link upload yang valid melalui server action terautentikasi.
- Nilai preview dikirim sebagai fallback `description` saat submit, sementara server tetap mengambil metadata ulang sebelum menyimpan laporan.
- **File terdampak:** `app/actions/posts.ts`, `app/components/posts/PostForm.tsx`, `docs/laporan-pekerjaan.md`.

#### 14.5 Metadata Spesifik Platform Sosial
- Menambahkan prioritas pengambilan metadata melalui oEmbed resmi untuk TikTok dan YouTube agar judul/video caption lebih akurat dibanding HTML biasa.
- Menambahkan dukungan Meta oEmbed untuk Instagram dan Facebook bila environment token tersedia (`META_OEMBED_ACCESS_TOKEN`, fallback `FACEBOOK_OEMBED_ACCESS_TOKEN`/`FACEBOOK_ACCESS_TOKEN`).
- Fallback HTML metadata tetap dipakai ketika oEmbed tidak tersedia, gagal, atau token Meta belum dikonfigurasi.
- Menghapus ketergantungan `Buffer` pada helper metadata agar lebih portabel untuk runtime non-Node seperti Cloudflare Workers.
- **File terdampak:** `app/lib/env.ts`, `app/lib/link-metadata.ts`, `docs/laporan-pekerjaan.md`.

#### 14.6 Preview Link Upload seperti Share Card
- Menyimpan metadata link upload pada kolom `description` sebagai JSON array terstruktur, tanpa menambah kolom database baru.
- Format baru berisi item `thumbnail` dan `text`, sementara data lama berupa teks biasa tetap didukung saat ditampilkan.
- Thumbnail metadata diambil dari `thumbnail_url` oEmbed atau `og:image`/`twitter:image`, lalu ditampilkan bersama deskripsi pada form upload dan tabel `/posts/upload` role operator.
- Fallback dari input client hanya mengambil teks agar thumbnail tidak bisa dipalsukan dari request langsung.
- **File terdampak:** `app/lib/link-preview-description.ts`, `app/lib/link-metadata.ts`, `app/actions/posts.ts`, `app/api/mobile/posts/route.ts`, `app/api/mobile/posts/[id]/route.ts`, `app/components/posts/PostForm.tsx`, `app/components/posts/PostsTable.tsx`, `docs/laporan-pekerjaan.md`.

#### 14.7 Kolom Metadata untuk Manager dan Admin
- Kolom `Metadata` pada halaman `/posts/upload` kini ditampilkan untuk semua role, termasuk operator, manager, dan admin.
- Perhitungan jumlah kolom tabel disesuaikan agar header, skeleton loading, dan isi tabel tetap sejajar.
- **File terdampak:** `app/components/posts/PostsTable.tsx`, `docs/laporan-pekerjaan.md`.

#### 14.8 Kolom Metadata pada Halaman Pelaporan Admin
- Menambahkan opsi eksplisit untuk menampilkan kolom `Metadata` pada tabel gabungan `/posts`.
- Halaman `/posts` role admin kini menampilkan metadata untuk baris laporan upload tanpa mengubah perilaku screenshot untuk laporan default/amplifikasi.
- Baris non-upload pada tabel gabungan menampilkan tanda kosong pada kolom metadata.
- **File terdampak:** `app/posts/page.tsx`, `app/components/posts/PostsTable.tsx`, `docs/laporan-pekerjaan.md`.

#### 14.9 Kolom Metadata pada Halaman Pelaporan Manager
- Mengaktifkan kolom `Metadata` pada halaman `/posts` untuk role manager.
- Metadata tetap hanya diisi untuk baris laporan upload; baris non-upload menampilkan tanda kosong.
- **File terdampak:** `app/posts/page.tsx`, `docs/laporan-pekerjaan.md`.

#### 14.10 Wrapping Kolom Metadata
- Membuat komponen reusable untuk render metadata link upload agar tampilan konsisten di tabel dan form.
- Kolom metadata diberi batas lebar tetap serta `overflow-wrap:anywhere` supaya teks, caption, atau URL panjang tidak membuat tabel melebar berlebihan.
- Preview metadata pada form upload juga dibatasi agar konten tetap wrap di dalam panel.
- **File terdampak:** `app/components/posts/LinkPreviewDescription.tsx`, `app/components/posts/PostsTable.tsx`, `app/components/posts/PostForm.tsx`, `docs/laporan-pekerjaan.md`.

#### 14.11 Metadata Akun Lebih Lengkap
- Memperluas parser metadata agar menyimpan nama akun, handle akun, platform, dan tipe konten pada teks metadata.
- Data oEmbed TikTok/YouTube kini memakai `author_name`, `author_unique_id`, `author_url`, `provider_name`, dan `type`.
- Fallback HTML juga membaca `author`, `article:author`, `twitter:creator`, `twitter:site`, `og:site_name`, dan `og:type`.
- Format teks metadata dibuat eksplisit dengan baris `Akun`, `Platform`, `Tipe`, dan `Judul/Caption` agar nama akun terlihat di awal.
- **File terdampak:** `app/lib/link-metadata.ts`, `app/lib/link-preview-description.ts`, `docs/laporan-pekerjaan.md`.

#### 14.12 Tampilan Metadata Ringkas
- Mengubah tampilan metadata agar hanya menampilkan thumbnail, author tebal, dan caption abu-abu.
- Baris teknis seperti platform dan tipe konten tetap disimpan di data metadata, tetapi tidak ditampilkan di tabel/form.
- Caption tetap dibungkus dan dibatasi jumlah baris agar kolom tidak melebar.
- **File terdampak:** `app/components/posts/LinkPreviewDescription.tsx`, `docs/laporan-pekerjaan.md`.

#### 14.13 Ekstraksi Author Instagram Reel
- Menambahkan ekstraksi nama akun Instagram dari `og:title`, `og:description`, dan `og:url`.
- URL reel yang tidak menyertakan username di path input tetap bisa mengambil handle dari canonical `og:url` bila tersedia.
- Caption Instagram dipisahkan dari pola `akun on Instagram: "caption"` agar UI menampilkan author dan caption secara terpisah.
- **File terdampak:** `app/lib/link-metadata.ts`, `docs/laporan-pekerjaan.md`.

#### 14.14 Break Words Metadata Manager
- Memperketat lebar kolom metadata menjadi tetap pada tabel dan menambahkan `min-width`/`max-width` eksplisit.
- Author dan caption metadata kini memakai `overflow-wrap:anywhere` serta `word-break:break-word`, termasuk pada role manager.
- Menghapus truncate pada author agar nama akun panjang tetap wrap di dalam kolom.
- **File terdampak:** `app/components/posts/LinkPreviewDescription.tsx`, `app/components/posts/PostsTable.tsx`, `docs/laporan-pekerjaan.md`.

#### 14.15 Kolom Metadata pada Halaman Validasi Operator
- Menambahkan field `description` ke data laporan yang dikirim ke tabel validasi operator.
- Halaman `/posts/users/[userId]` dan `/posts/users/[userId]/[status]` kini menampilkan kolom `Metadata` untuk laporan upload.
- Kolom metadata validasi memakai renderer yang sama dengan tabel pelaporan agar thumbnail, author, caption, dan wrapping konsisten.
- **File terdampak:** `app/posts/users/[userId]/page.tsx`, `app/posts/users/[userId]/[status]/page.tsx`, `app/posts/users/[userId]/[status]/UserPostsTableClient.tsx`, `docs/laporan-pekerjaan.md`.

#### 14.16 Wrapping Metadata Semua Role
- Memperkuat wrapping teks metadata dengan `w-0 flex-1`, `whitespace-normal`, `break-all`, dan `overflow-wrap:anywhere`.
- Tabel validasi operator kini memakai `min-w-max` agar kolom metadata tetap konsisten dan halaman menggunakan scroll horizontal bila diperlukan.
- Penyesuaian berlaku untuk seluruh role karena semua halaman metadata memakai renderer yang sama.
- **File terdampak:** `app/components/posts/LinkPreviewDescription.tsx`, `app/posts/users/[userId]/[status]/UserPostsTableClient.tsx`, `docs/laporan-pekerjaan.md`.

#### 14.17 Pembatalan Fallback Metadata Facebook Share Link
- Membatalkan fallback ekstraksi author Facebook dari URL redirect karena dapat menyesatkan ketika Facebook mengharuskan sesi login.
- Metadata Facebook kini kembali hanya mengandalkan oEmbed dengan token valid atau metadata HTML yang benar-benar tersedia secara publik.
- **File terdampak:** `app/lib/link-metadata.ts`, `docs/laporan-pekerjaan.md`.

#### 14.18 Perbaikan Mapping Caption Facebook
- Menyesuaikan parser HTML Facebook agar `og:title` dipakai sebagai author dan `og:description` dipakai sebagai caption.
- Perubahan ini tidak menebak akun dari URL redirect; data tetap hanya berasal dari metadata OpenGraph publik yang dikembalikan Facebook.
- Mengabaikan `twitter:site` generik Facebook (`@facebookapp`) agar nama akun tidak tercampur dengan handle aplikasi Facebook.
- Link share Facebook yang mengembalikan metadata publik kembali menampilkan struktur thumbnail, author, dan caption sesuai UI.
- **File terdampak:** `app/lib/link-metadata.ts`, `docs/laporan-pekerjaan.md`.

#### 14.19 Soft Break Metadata untuk Safari
- Menambahkan word break berbasis JavaScript dengan elemen `<wbr />` pada author dan caption metadata agar token panjang tetap bisa patah baris di Safari.
- Menghapus ketergantungan utama pada `break-all`, `overflow-wrap:anywhere`, dan `line-clamp` untuk teks metadata; data asli tetap tidak berubah karena pemotongan dan break hanya dipasang saat render.
- Memasang wrapper fixed-width pada kolom metadata tabel `/posts` dan validasi `/posts/users/[userId]` supaya Safari tidak memperlebar kolom berdasarkan isi.
- Perubahan berlaku untuk seluruh role karena halaman metadata memakai renderer dan wrapper tabel yang sama.
- **File terdampak:** `app/components/posts/LinkPreviewDescription.tsx`, `app/components/posts/PostsTable.tsx`, `app/posts/users/[userId]/[status]/UserPostsTableClient.tsx`, `docs/laporan-pekerjaan.md`.

#### 14.20 Tinggi Metadata Setara Thumbnail
- Membatalkan penguncian tinggi renderer metadata karena caption dapat terlihat terpotong tidak jelas.
- Membatasi panjang teks dengan `maxLength` saat render dan menampilkan akhiran `...` eksplisit agar pemotongan mudah dipahami pengguna.
- Tetap memakai `<wbr />` untuk token panjang, tetapi tinggi metadata kembali mengikuti isi teks yang sudah dipendekkan.
- **File terdampak:** `app/components/posts/LinkPreviewDescription.tsx`, `docs/laporan-pekerjaan.md`.

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
