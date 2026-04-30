# Changelog

## 2026-04-30

### Security

- Menutup seluruh temuan pada `SECURITY-ISSUE.md`.
- Semua server action read-only penting sekarang melakukan authorization guard sebelum membaca data.
- Session web dan JWT mobile sekarang memeriksa ulang status user (`is_blocked`) dan role terbaru dari database pada request berikutnya.
- JWT mobile tidak lagi memakai fallback secret statis; token ditandatangani dengan `SESSION_SECRET`.
- Mobile login sekarang memakai proteksi brute force 3-tier yang sama dengan web login dan menulis access log untuk sukses, gagal, diblokir, dan rate limited.
- OpenAPI JSON dan endpoint contoh Sentry sekarang dibatasi untuk admin.
- Upload web dan mobile sekarang memvalidasi isi file melalui magic bytes (`jpg`, `png`, `gif`, `webp`), bukan mengandalkan `Content-Type` atau ekstensi dari klien.
- Media upload pending sekarang diberi `uploaded_by`; create/update mobile post hanya boleh memakai `media_id` milik uploader tersebut.
- Penggantian media tidak lagi mempercayai `old_media_id` bebas dari klien; media lama diambil dari post yang sedang diedit.
- Authorization tenant diperketat untuk list/detail/update status post, detach operator, dashboard/report mobile, dan halaman `/posts/users/[userId]/[status]`.
- Manager multi-tenant harus memilih `tenantId` pada endpoint operator mobile yang membutuhkan konteks tenant eksplisit.
- Query role count tenant tidak lagi menyusun nama role dari interpolasi string dinamis.
- Upload baru ke S3 memakai object key berbasis tanggal dan lokasi untuk memudahkan backup: `reports/YYYY/MM/DD/{nama-provinsi}/{nama-kota}/{jenis}/random.ext`.

### Reporting Hours

- Settings Security memiliki dua jadwal pembatasan: operator dan manager.
- Operator tidak dapat membuat atau mengubah laporan di luar jam operator.
- Manager tidak dapat validasi laporan atau edit gambar di luar jam manager.
- Admin dikecualikan dari pembatasan jam tersebut.
- Alert manager memakai konteks validasi: `Validasi Pelaporan Ditutup`.

### Posts And Reporting Tables

- `/dashboard`, `/posts`, dan `/posts/users` default memfilter data tanggal hari ini.
- Dashboard admin dan manager menampilkan 3 card operator: Total Operator, Sudah Lapor, dan Belum Lapor. Card Sudah/Belum Lapor dapat diklik untuk membuka dialog tabel operator sesuai filter aktif.
- `/posts/upload` dan `/posts/amplifikasi` default memfilter `dateFrom` dan `dateTo` ke tanggal hari ini berdasarkan timezone `Asia/Jakarta`.
- `/posts`, `/posts/upload`, dan `/posts/amplifikasi` memiliki filter status `pending`, `valid`, dan `invalid`.
- Filter provinsi/kota pada laporan memakai provinsi dari relasi `city_id` pada `addresses`.
- Search table dipindahkan ke atas tabel dengan pola DataTables.
- Semua tabel memakai pilihan jumlah record per page: `5`, `10`, `20`, `50`, dan `all`.
- Filter table dirapikan agar sejajar pada halaman posts, per-operator, Settings Users, dan Settings Tenants.
- Kolom `Link Upload` untuk jenis post `upload` menampilkan tombol `Buka`, bukan URL mentah.
- Dropdown status diberi warna sesuai konteks status.
- Screenshot laporan yang diunggah langsung dari form server action masuk ke folder jenis laporan: `default`, `upload`, atau `amplifikasi`.
- Upload pending melalui `/api/upload` dan `/api/mobile/upload` masuk ke folder `pending` kecuali client mengirim `post_type`/`postType`.

### Summary

- Admin memiliki sidebar menu `Summary` di luar `/dashboard`.
- Halaman Summary memakai struktur layout aplikasi lengkap: sidebar, header, dan content area normal.
- Summary memiliki dua tab: `Summary` dan `Analytics`.
- Tab Summary berisi rekap seperti format dokumen rujukan, dengan chart di bagian bawah.
- Export Summary tersedia dalam PDF dan Excel.
- Export PDF dan Excel tidak menyertakan card UI, hanya data laporan.

### UI

- Sidebar aplikasi dapat dibuat collapsible.
- Table page mengikuti standar filter, search, pagination, dan page size yang konsisten.
- Alert pembatasan jam memakai komponen alert standar aplikasi dengan tipe danger/error.

### Verification

- `npm run build` sukses setelah perubahan.
