# Login Flow

Dokumen ini menjelaskan alur login aplikasi secara teknis dan operasional, termasuk tabel-tabel database yang terlibat langsung maupun tidak langsung. Tujuannya adalah agar engineer atau Agent AI lain bisa memahami titik-titik keamanan utama tanpa harus membaca seluruh kode terlebih dahulu.

## Ringkasan

Login aplikasi ini berbasis:

- identitas user dari tabel `users`
- session cookie bertanda tangan HMAC, bukan tabel session database
- brute-force protection 3-tier dari tabel `login_attempts`
- request security policy berbasis IP dan country dari config database
- audit trail keamanan di tabel `access_logs`
- authorization pasca-login melalui role yang di-resolve dari `model_has_roles`, `roles`, dan `tenant_user`
- JWT mobile yang selalu memeriksa ulang user aktif dan role terbaru dari database

Implementasi utama berada di:

- `app/actions/auth.ts`
- `app/lib/session.ts`
- `app/lib/login-rate-limit.ts`
- `app/lib/request-security.ts`
- `app/lib/access-logs.ts`
- `app/lib/permissions.ts`
- `app/lib/authorization.ts`
- `app/lib/api-auth.ts`
- `app/lib/jwt.ts`

## Daftar Tabel yang Berhubungan dengan Login Flow

Tabel yang berhubungan dengan login flow di aplikasi ini adalah:

1. `users`
2. `login_attempts`
3. `access_logs`
4. `configs`
5. `model_has_roles`
6. `roles`
7. `tenant_user`

Jika dibagi berdasarkan tahap penggunaannya:

- Dipakai langsung saat proses login: `users`, `login_attempts`, `access_logs`, `configs`
- Dipakai setelah login sukses untuk authorization: `model_has_roles`, `roles`, `tenant_user`

Catatan:

- aplikasi ini tidak memakai tabel `sessions`
- session disimpan di cookie `sid`, bukan di database

## Urutan Login Flow

### 1. User membuka halaman login

Halaman `app/login/page.tsx` memanggil request security check sebelum form ditampilkan.

Yang dilakukan:

- baca IP dan country dari request headers
- evaluasi policy keamanan aktif
- jika request diblokir, redirect ke `/blocked`
- jika diizinkan, tulis access log `login_page_view`

Ini berarti login page sendiri tidak selalu bisa diakses. Jika IP atau country diblokir, user ditahan sebelum sempat submit kredensial.

### 2. Form login dikirim ke server action

Submit form masuk ke server action `login()` di `app/actions/auth.ts`.

Server action ini adalah pusat autentikasi utama.

### 3. Request security dicek lagi

Sebelum memproses email dan password, sistem kembali mengevaluasi request security policy.

Jika request tidak diizinkan:

- proses login dihentikan
- event dicatat sebagai `login_blocked`
- user menerima pesan bahwa akses login ditolak oleh kebijakan keamanan

Alasan pengecekan ulang:

- page guard tidak boleh dianggap cukup
- server action adalah endpoint HTTP yang bisa dipanggil langsung

### 4. Validasi input dasar

Sistem memvalidasi:

- email harus berformat valid
- password tidak boleh kosong

Jika gagal, proses berhenti tanpa query user dan tanpa verifikasi password.

### 5. Ambil IP login

IP diambil dari header request:

- `x-forwarded-for`
- `x-real-ip`
- `cf-connecting-ip`

IP ini dipakai untuk rate limiting dan logging.

### 6. Rate limit login diperiksa

Function `checkRateLimit(email, ip)` memeriksa tabel `login_attempts` menggunakan tiga lapisan:

- Tier 1: key `email|ip`
- Tier 2: key `ip`
- Tier 3: key `email`

Konfigurasi saat ini:

- Tier 1: 5 kegagalan dalam 10 menit, blok 10 menit
- Tier 2: 20 kegagalan dalam 10 menit, blok 30 menit
- Tier 3: 50 kegagalan dalam 60 menit, blok 120 menit

Jika salah satu tier aktif:

- login ditolak
- event `login_rate_limited` ditulis ke `access_logs`
- response mengembalikan `retryAfterSeconds`

Sebelum pengecekan, sistem juga membersihkan row `login_attempts` yang lebih lama dari 4 jam agar tabel tidak terus membesar.

### 7. User dicari berdasarkan email

Jika lolos rate limit, sistem query tabel `users` berdasarkan `email`.

Field yang diambil:

- `id`
- `email`
- `name`
- `password`
- `is_blocked`

### 8. Status blokir akun diperiksa

Jika user ditemukan tetapi `is_blocked = true`:

- login dianggap gagal
- kegagalan tetap dicatat ke tabel `login_attempts`
- access log ditulis sebagai `login_failed` dengan detail `user_blocked`
- user menerima pesan bahwa akunnya diblokir

Ini penting karena akun yang diblokir harus tertahan sebelum password dipakai lebih jauh.

### 9. Password diverifikasi

Jika user ada dan tidak diblokir, password diverifikasi menggunakan `bcrypt.compare()` terhadap hash di `users.password`.

Jika password salah atau user tidak ditemukan:

- sistem memanggil `recordLoginFailure(email, ip)`
- tiga key sekaligus ditulis ke tabel `login_attempts`
- access log `login_failed` ditulis dengan detail `invalid_credentials`
- user menerima pesan generik `Email atau password salah`

Pesan generik dipakai agar sistem tidak membocorkan apakah email terdaftar atau tidak.

### 10. Session dibuat saat login sukses

Jika password benar:

- hanya Tier 1 (`email|ip`) yang dihapus lewat `clearLoginFailures(email, ip)`
- session cookie dibuat lewat `createSession(user.id.toString())`
- access log `login_success` ditulis
- user di-redirect ke `/dashboard`

Catatan penting:

- Tier 2 dan Tier 3 tidak di-reset saat login sukses
- ini sengaja dilakukan agar attacker tidak bisa menghapus histori serangan hanya dengan login sukses ke akun lain atau akun miliknya sendiri

## Session Flow Setelah Login Berhasil

Session tidak disimpan di database. Sistem memakai signed cookie.

Isi umum flow:

1. `createSession(userId)` menaruh cookie `sid`
2. nilai cookie ditandatangani dengan HMAC SHA-256 menggunakan `SESSION_SECRET`
3. request berikutnya membaca cookie tersebut
4. signature diverifikasi
5. `userId` diambil dari cookie
6. tabel `users` di-query ulang untuk membentuk session user
7. role di-resolve sebelum authorization dilakukan

Konfigurasi cookie saat ini:

- `httpOnly: true`
- `sameSite: 'lax'`
- `path: '/'`
- `secure: true` hanya di production
- `maxAge: 1 jam`

Jika cookie tidak valid atau signature rusak, session dianggap tidak ada.

## Authorization Setelah Login

Setelah user dianggap authenticated, sistem masih harus memutuskan role dan hak akses.

Function `getSessionUser()` melakukan:

1. baca cookie `sid`
2. verifikasi signature
3. ambil user dari tabel `users`
4. tolak session jika user sudah diblokir
5. panggil `getUserRoles(userId)` agar role selalu terbaru

`getUserRoles(userId)` mengumpulkan role dari dua sumber:

- role yang melekat langsung ke model `User`
- role yang melekat ke model `TenantUser`

Lalu helper authorization dipakai:

- `requireUser()`
- `requireAdmin()`
- `requireManagerOrAdmin()`

Artinya, login sukses belum otomatis berarti semua endpoint bisa diakses. User tetap harus lolos authorization sesuai fitur.

## Mobile Login dan JWT

Mobile login berada di `POST /api/mobile/auth/login`.

Flow mobile sengaja dibuat konsisten dengan web login:

1. API mobile harus aktif lewat security settings.
2. Request security policy IP/country dicek.
3. Input `email` dan `password` divalidasi.
4. IP login dibaca dari header request.
5. `checkRateLimit(email, ip)` memeriksa tiga tier rate limit.
6. User dicari di tabel `users`.
7. User blocked dan password salah sama-sama dicatat sebagai kegagalan login.
8. Login sukses menghapus hanya Tier 1 (`email|ip`).
9. Role terbaru diambil dengan `getUserRoles(userId)`.
10. JWT dibuat memakai `SESSION_SECRET`.
11. Access log ditulis untuk `login_success`, `login_failed`, `login_blocked`, dan `login_rate_limited`.

Setiap endpoint mobile yang memakai `requireJwt()` melakukan:

- validasi Bearer token
- verifikasi signature dan expiry JWT
- query ulang user dari database
- menolak token jika user tidak ditemukan atau `is_blocked = true`
- resolve ulang role dari database

Dengan cara ini, token lama tidak tetap membawa role lama setelah role user berubah, dan akun yang diblokir tidak bisa terus memakai token aktif.

## Tabel-Tabel yang Berhubungan dengan Login

### 1. `users`

Ini adalah tabel autentikasi utama.

Kolom penting yang berhubungan dengan login:

- `id`
- `name`
- `email`
- `password`
- `is_admin`
- `is_blocked`
- `last_seen_at`

Peran:

- menyimpan identitas user
- menyimpan password hash
- menentukan apakah akun diblokir
- menjadi sumber data user setelah session dibaca

### 2. `login_attempts`

Ini adalah tabel brute-force protection.

Kolom yang terlihat dipakai oleh aplikasi:

- `key`
- `ip`
- `email`
- `attempted_at`

Peran:

- menyimpan semua percobaan login gagal
- mendukung rate limit per `email+ip`, per `ip`, dan per `email`
- memungkinkan admin mereset rate limit akun tertentu

Setiap login gagal menulis tiga row sekaligus:

- satu untuk Tier 1
- satu untuk Tier 2
- satu untuk Tier 3

### 3. `access_logs`

Ini adalah tabel audit keamanan.

Event login yang ditulis ke tabel ini:

- `login_page_view`
- `login_blocked`
- `login_rate_limited`
- `login_failed`
- `login_success`
- `logout`
- `request_blocked`

Kolom penting:

- `event_type`
- `request_path`
- `method`
- `status`
- `ip`
- `country`
- `user_id`
- `user_email`
- `user_agent`
- `browser`
- `os`
- `device_type`
- `referer`
- `request_id`
- `details`
- `created_at`

Peran:

- audit trail
- investigasi insiden
- filter dan pencarian log oleh admin

### 4. `configs`

Tabel ini tidak menyimpan user login, tetapi menyimpan konfigurasi keamanan yang memengaruhi login.

Key yang relevan:

- `app_security_policy`
- `access_logs_enabled`

Peran:

- menyimpan IP blocklist
- menyimpan country allowlist
- menyimpan opsi `allowUnknownCountries`
- mengatur apakah access logging aktif

### 5. `model_has_roles`

Tabel ini dipakai setelah login berhasil, saat sistem menentukan role user.

Peran:

- menghubungkan model tertentu dengan role
- mendukung role langsung di `User`
- mendukung role berbasis `TenantUser`

### 6. `roles`

Tabel master role.

Kolom penting:

- `id`
- `name`
- `guard_name`
- `is_tenant_role`
- `tenant_id`

Peran:

- menyimpan definisi role seperti `admin` atau `manager`
- menjadi referensi dari `model_has_roles`

### 7. `tenant_user`

Tabel ini terlibat saat role user ditentukan, terutama untuk role yang terkait tenant.

Peran:

- menghubungkan user ke tenant
- menyediakan entitas `TenantUser` yang bisa memiliki role sendiri
- memungkinkan user mendapat role operasional tenant seperti `manager`

## Peta Hubungan Sederhana

Secara konseptual, alurnya seperti ini:

1. request login masuk
2. policy keamanan dibaca dari `configs`
3. histori kegagalan dibaca dari `login_attempts`
4. user diverifikasi dari `users`
5. event ditulis ke `access_logs`
6. session cookie dibuat
7. request berikutnya membaca `users` lagi
8. role di-resolve dari `model_has_roles`, `roles`, dan `tenant_user`

## Hal Penting yang Perlu Diingat

- aplikasi ini tidak memakai tabel `sessions`
- session berbasis cookie bertanda tangan HMAC
- login flow dan authorization flow adalah dua tahap yang berbeda
- user bisa login sukses tetapi tetap tidak boleh mengakses fitur tertentu
- proteksi page tidak cukup untuk melindungi server action
- login rate limit bersifat persisten karena memakai tabel database

## Referensi Kode

- `app/actions/auth.ts`
- `app/lib/session.ts`
- `app/lib/login-rate-limit.ts`
- `app/lib/request-security.ts`
- `app/lib/access-logs.ts`
- `app/lib/permissions.ts`
- `app/lib/authorization.ts`
- `app/actions/users.ts`
- `prisma/schema.prisma`
