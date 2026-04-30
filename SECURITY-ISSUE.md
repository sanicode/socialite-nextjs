# Security Issues

Tanggal audit: 2026-04-30  
Tanggal konfirmasi ulang: 2026-04-30

## Status Ringkasan

| # | Severity | Isu | Status |
|---|----------|-----|--------|
| 1 | Critical | Server actions read-only belum enforce auth | ✅ FIXED |
| 2 | Critical | IDOR pada mobile posts API | ✅ FIXED |
| 3 | High | Mobile login tidak memakai brute-force protection | ✅ FIXED |
| 4 | High | JWT secret memiliki fallback statis | ✅ FIXED |
| 5 | Medium | OpenAPI spec publik dengan CORS wildcard | ✅ FIXED |
| 6 | Medium | Endpoint contoh Sentry publik | ✅ FIXED |
| 7 | Critical | Validasi MIME type upload bergantung header dari klien | ✅ FIXED |
| 8 | High | IDOR pada operator DELETE | ✅ FIXED |
| 9 | High | IDOR pada perubahan status post | ✅ FIXED |
| 10 | High | Media ID dapat dirujuk sembarang pada create/edit post | ✅ FIXED |
| 11 | Medium | Pola SQL interpolasi berbahaya di roleCountSql | ✅ FIXED |
| 12 | Medium | getCallerTenantId hanya mengambil tenant pertama | ✅ FIXED |

Catatan:

- Ringkasan perubahan lintas fitur dan UI dicatat di [CHANGELOG.md](CHANGELOG.md).
- Verifikasi terakhir: `npm run build` sukses setelah perbaikan.

---

## 1. Critical - Server actions read-only belum enforce auth

**Status: ✅ FIXED**

Bukti perbaikan (`app/actions/posts.ts`, `app/actions/dashboard.ts`):

- `getPosts` → `requireUser()` baris 196
- `getCategories` → `requireUser()` baris 404
- `getPostById` → `requireUser()` baris 410, lalu `canActorReadPost` untuk ownership
- `getProvinces` → `requireUser()` baris 132
- `getCities` → `requireUser()` baris 138
- `getDashboardStats` → `requireManagerOrAdmin()` baris 144, dengan `scopeDashboardFilters`
- `getPostsByProvince` → `requireManagerOrAdmin()` baris 231
- `getProvinceChartData` → `requireManagerOrAdmin()` baris 288
- `getTopCitiesByPosts` → `requireManagerOrAdmin()` baris 388
- `getReportData` → `requireManagerOrAdmin()` baris 505
- `getPostsByDate` → `requireManagerOrAdmin()` baris 543

Data scoping juga diperbaiki: manager di-scope ke tenant sendiri melalui `getUserTenantIds` + `scopeDashboardFilters`.

---

## 2. Critical - IDOR pada mobile posts API

**Status: ✅ FIXED**

Bukti perbaikan (`app/api/mobile/posts/route.ts` dan `app/api/mobile/posts/[id]/route.ts`):

**List (`GET /mobile/posts`):**
- Operator: `userId` dipaksa ke `payload.sub`, tidak bisa dioverride
- Manager: scoping via `getUserTenantIds(payload.sub)`, `tenantId` dari query param divalidasi harus termasuk dalam tenant manager; jika tidak sesuai → `403 Akses tenant ditolak`
- Admin: bebas pakai filter `userId`/`tenantId`

**Detail (`GET /mobile/posts/[id]`):**
- `getPostById` memanggil `requireUser()` lalu `canActorReadPost(sessionUser, { userId, tenantId })`
- Jika user tidak berhak membaca post → return `null` → 404

---

## 3. High - Mobile login tidak memakai brute-force protection

**Status: ✅ FIXED**

Bukti perbaikan (`app/api/mobile/auth/login/route.ts`):

- `getRequestSecurityDecision()` → cek IP/country block sebelum proses apapun; log `login_blocked`
- `getLoginIp()` → ambil IP dari request
- `checkRateLimit(normalizedEmail, ip)` → jika blocked → log `login_rate_limited`, return 429
- `recordLoginFailure(normalizedEmail, ip)` → dicatat pada: user tidak ditemukan, user diblokir, password salah
- `clearLoginFailures(normalizedEmail, ip)` → dipanggil hanya saat login sukses (Tier 2 & 3 tidak di-clear)
- `writeAccessLog` untuk semua event: `login_blocked`, `login_rate_limited`, `login_failed`, `login_success`

---

## 4. High - JWT secret memiliki fallback statis

**Status: ✅ FIXED**

Bukti perbaikan (`app/lib/jwt.ts` dan `app/lib/env.ts`):

- `jwt.ts` tidak lagi menggunakan `process.env.SESSION_SECRET ?? 'fallback-secret-change-me'`
- Menggunakan `getSessionSecret()` dari `app/lib/env.ts`
- `getSessionSecret()` memanggil `readRequiredEnv('SESSION_SECRET')` yang fail-fast: jika env kosong/tidak ada, aplikasi tidak bisa start

---

## 5. Medium - OpenAPI spec publik dengan CORS wildcard

**Status: ✅ FIXED**

Bukti perbaikan (`app/api/docs/openapi.json/route.ts` baris 1732–1737):

```typescript
export async function GET() {
  const user = await getSessionUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (!user.roles.includes('admin')) return Response.json({ error: 'Forbidden' }, { status: 403 })
  return Response.json(spec)
}
```

Endpoint sekarang hanya bisa diakses admin yang sudah login via web session.

---

## 6. Medium - Endpoint contoh Sentry publik

**Status: ✅ FIXED**

Bukti perbaikan (`app/api/sentry-example-api/route.ts`):

```typescript
const user = await getSessionUser()
if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
if (!user.roles.includes('admin')) return Response.json({ error: 'Forbidden' }, { status: 403 })
return Response.json({ ok: true, sentry: false })
```

---

## 7. Critical - Validasi MIME type upload bergantung header dari klien

**Status: ✅ FIXED**

Bukti perbaikan (`app/api/mobile/upload/route.ts`):

- `file.type` tidak lagi dipakai untuk validasi
- Buffer dibaca terlebih dahulu: `const buffer = Buffer.from(await file.arrayBuffer())`
- Lalu divalidasi via `detectAllowedImage(buffer)` dari `@/app/lib/file-validation` yang membaca magic bytes
- Ekstensi diambil dari `detectedFile.ext` (hasil deteksi), bukan dari `file.name`
- MIME type yang disimpan ke database dan dikirim ke S3 adalah `detectedFile.mime` (terdeteksi), bukan dari header klien
- `uploaded_by: payload.sub` disimpan di `custom_properties` untuk ownership tracking

---

## 8. High - IDOR pada operator DELETE (tidak ada cek kepemilikan tenant)

**Status: ✅ FIXED**

Bukti perbaikan (`app/api/mobile/operators/[tenantUserId]/route.ts`):

```typescript
const target = await prisma.tenant_user.findUnique({
  where: { id: BigInt(tenantUserId) },
  select: { tenant_id: true },
})
if (!target) throw new ApiError(404, 'Operator tidak ditemukan')
const canAccessTenant = await canActorAccessTenant(payload, target.tenant_id.toString())
if (!canAccessTenant) throw new ApiError(403, 'Akses ditolak')
```

Manager hanya bisa menghapus operator di tenant yang menjadi yurisdiksinya.

---

## 9. High - IDOR pada perubahan status post (tidak ada cek kepemilikan tenant)

**Status: ✅ FIXED**

Bukti perbaikan (`app/api/mobile/posts/[id]/status/route.ts`):

```typescript
const post = await prisma.blog_posts.findUnique({
  where: { id: BigInt(id) },
  select: { id: true, user_id: true, tenant_id: true },
})
if (!post) return Response.json({ error: 'Laporan tidak ditemukan' }, { status: 404 })
const canValidate = await canActorValidatePost(payload, {
  userId: post.user_id.toString(),
  tenantId: post.tenant_id?.toString() ?? null,
})
if (!canValidate) throw new ApiError(403, 'Anda tidak memiliki akses untuk mengubah status laporan ini')
```

---

## 10. High - Media ID dapat dirujuk sembarang pada pembuatan/pengeditan post

**Status: ✅ FIXED**

Bukti perbaikan — validasi ownership sebelum assign:

**POST `/mobile/posts`** (`app/api/mobile/posts/route.ts` baris 202–213):
```typescript
const media = await prisma.media.findUnique({ where: { id: BigInt(media_id) }, ... })
const props = media?.custom_properties as Record<string, unknown> | null
if (
  !media ||
  media.collection_name !== 'blog-images' ||
  media.model_id !== BigInt(0) ||          // belum ditautkan ke post manapun
  props?.uploaded_by !== payload.sub        // harus diunggah oleh user yang sama
) {
  throw new ApiError(403, 'Media upload tidak valid')
}
```

**PUT `/mobile/posts/[id]`** (`app/api/mobile/posts/[id]/route.ts` baris 159–171): validasi identik.

Untuk penghapusan media lama: `existingMedia` diambil dari database berdasarkan `model_id = BigInt(id)` (post yang sedang diedit), bukan dari `old_media_id` request body. Tidak ada IDOR pada penghapusan.

---

## 11. Medium - Pola SQL interpolasi berbahaya di roleCountSql

**Status: ✅ FIXED**

Bukti perbaikan (`app/api/mobile/tenants/route.ts` baris 50–73):

Fungsi `roleCountSql(roleName: string)` dengan string interpolasi diganti menjadi object literal dengan dua properti hardcoded:

```typescript
const roleCountSql = {
  manager: `(SELECT COUNT(DISTINCT tu.id) ... WHERE r.name = 'manager' ...)`,
  operator: `(SELECT COUNT(DISTINCT tu.id) ... WHERE r.name = 'operator' ...)`,
}
// Dipakai: roleCountSql.manager, roleCountSql.operator
```

Tidak ada lagi parameter string terbuka yang bisa disalahgunakan.

---

## 12. Medium - getCallerTenantId hanya mengambil tenant pertama (multi-tenant manager)

**Status: ✅ FIXED**

Bukti perbaikan (`app/api/mobile/operators/route.ts` baris 9–20):

```typescript
async function getCallerTenantId(payload: JwtPayload, requestedTenantId?: string | null): Promise<bigint> {
  if (payload.roles.includes('admin')) {
    if (!requestedTenantId) throw new ApiError(422, 'tenantId wajib diisi untuk admin.')
    return BigInt(requestedTenantId)
  }

  const tenantIds = await getUserTenantIds(payload.sub)  // ambil SEMUA tenant
  if (tenantIds.length === 0) throw new ApiError(403, 'User tidak terdaftar di tenant manapun.')
  if (requestedTenantId) {
    if (!tenantIds.includes(requestedTenantId)) throw new ApiError(403, 'Akses tenant ditolak.')
    return BigInt(requestedTenantId)
  }
  // fallback ke tenant pertama hanya jika tidak ada requestedTenantId
}
```

- Admin wajib menyuplai `tenantId` eksplisit
- Manager multi-tenant: bisa pilih tenant via `requestedTenantId`, divalidasi terhadap semua tenant miliknya
- Tidak lagi `findFirst` yang hanya ambil satu tenant secara acak

---

## Kesimpulan Audit

**Semua 12 celah keamanan yang ditemukan telah diperbaiki.** Tidak ada isu yang tersisa.

Perbaikan mencakup:
- Auth enforcement konsisten di semua server action dan API endpoint
- Data scoping per role (operator/manager/admin) yang ketat
- Brute-force protection penuh pada mobile login, sejajar dengan web login
- JWT secret tanpa fallback, fail-fast saat env kosong
- Validasi file upload berbasis magic bytes (bukan header klien)
- Ownership check pada semua operasi CRUD berbasis ID
- SQL template yang aman (hardcoded literal, bukan string interpolation)
- Multi-tenant manager scoping yang benar
