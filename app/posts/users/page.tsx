import { getSessionUser } from '@/app/lib/session'
import { redirect } from 'next/navigation'
import { prisma } from '@/app/lib/prisma'
import SearchInput from '@/app/components/posts/users/SearchInput'
import Link from 'next/link'
import PostsByUsersTable from '@/app/components/posts/users/PostsByUsersTable'
import { getProvinces } from '@/app/actions/dashboard'

type SearchParams = Promise<{ search?: string; sortBy?: string; sortDir?: string; page?: string; provinceId?: string; cityId?: string; dateFrom?: string; dateTo?: string }>

const PAGE_SIZE = 10

const ALLOWED_SORT_COLS: Record<string, string> = {
  provinsi:       'p.name',
  kabupaten_kota: 'c.name',
  operator:       'u.name',
  email:          'u.email',
  pending_posts:  'pending_posts',
  valid_posts:    'valid_posts',
  invalid_posts:  'invalid_posts',
}

function buildPostsUsersHref(params: Record<string, string | undefined>) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value)
  }
  const qs = query.toString()
  return qs ? `/posts/users?${qs}` : '/posts/users'
}

function getJakartaDateString(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export default async function PostsByUsersPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  if (!user.roles.some(role => ['admin', 'manager'].includes(role))) {
    redirect('/posts/upload')
  }

  const { search, sortBy: rawSortBy, sortDir: rawSortDir, page: pageParam, provinceId, cityId, dateFrom: rawDateFrom, dateTo: rawDateTo } = await searchParams
  const isAdmin = user.roles.includes('admin')

  const page    = Math.max(1, parseInt(pageParam ?? '1', 10) || 1)
  const sortBy  = ALLOWED_SORT_COLS[rawSortBy ?? ''] ? (rawSortBy ?? 'operator') : 'operator'
  const sortDir = rawSortDir === 'desc' ? 'DESC' : 'ASC'
  const orderCol = ALLOWED_SORT_COLS[sortBy]
  const today = getJakartaDateString()
  const dateFrom = rawDateFrom ?? today
  const dateTo = rawDateTo ?? today

  const provinces = isAdmin ? await getProvinces() : []

  const tenantUser = await prisma.tenant_user.findFirst({
    where: { user_id: BigInt(user.id) },
    select: { tenant_id: true },
  })

  const conditions: string[] = []
  const params: unknown[] = []
  let idx = 1

  if (search) {
    conditions.push(`(u.name ILIKE $${idx} OR u.email ILIKE $${idx})`)
    params.push(`%${search}%`)
    idx++
  }

  if (dateFrom) {
    conditions.push(`date((post.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Jakarta') >= $${idx}::date`)
    params.push(dateFrom)
    idx++
  }

  if (dateTo) {
    conditions.push(`date((post.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Jakarta') <= $${idx}::date`)
    params.push(dateTo)
    idx++
  }

  if (!isAdmin) {
    const tId = tenantUser?.tenant_id
    if (tId) {
      conditions.push(`tu.tenant_id = $${idx}`)
      params.push(tId)
      idx++
    }
  }

  const provinceIdNum = provinceId && isAdmin ? parseInt(provinceId, 10) : null
  const cityIdNum = cityId && isAdmin && /^\d+$/.test(cityId) ? BigInt(cityId) : null

  if (provinceIdNum) {
    conditions.push(`c.province_id = $${idx}`)
    params.push(provinceIdNum)
    idx++
  }

  if (cityIdNum) {
    conditions.push(`adr.city_id = $${idx}`)
    params.push(cityIdNum)
    idx++
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const offset = (page - 1) * PAGE_SIZE

  const [{ count }] = await prisma.$queryRawUnsafe<[{ count: bigint }]>(`
    SELECT COUNT(*) AS count FROM (
      SELECT u.id
      FROM blog_posts post
      INNER JOIN users u ON u.id = post.user_id
      LEFT JOIN tenant_user tu ON tu.user_id = u.id
      LEFT JOIN tenants t ON t.id = tu.tenant_id
      LEFT JOIN addresses adr ON adr.tenant_id = t.id
      LEFT JOIN reg_cities c ON c.id = adr.city_id
      LEFT JOIN reg_provinces p ON p.id = c.province_id
      ${whereClause}
      GROUP BY p.name, c.name, u.email, u.name, u.id
    ) sub
  `, ...params)

  const total = Number(count)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const rows = await prisma.$queryRawUnsafe<{
    provinsi: string
    kabupaten_kota: string
    email: string
    operator: string
    user_id: number
    pending_posts: number
    valid_posts: number
    invalid_posts: number
  }[]>(`
    SELECT
      p.name AS provinsi,
      c.name AS kabupaten_kota,
      u.email,
      u.name AS operator,
      u.id AS user_id,
      SUM(CASE WHEN post.status = 'pending' THEN 1 ELSE 0 END)::int AS pending_posts,
      SUM(CASE WHEN post.status = 'valid' THEN 1 ELSE 0 END)::int AS valid_posts,
      SUM(CASE WHEN post.status = 'invalid' THEN 1 ELSE 0 END)::int AS invalid_posts
    FROM blog_posts post
    INNER JOIN users u ON u.id = post.user_id
    LEFT JOIN tenant_user tu ON tu.user_id = u.id
    LEFT JOIN tenants t ON t.id = tu.tenant_id
    LEFT JOIN addresses adr ON adr.tenant_id = t.id
    LEFT JOIN reg_cities c ON c.id = adr.city_id
    LEFT JOIN reg_provinces p ON p.id = c.province_id
    ${whereClause}
    GROUP BY p.name, c.name, u.email, u.name, u.id
    ORDER BY ${orderCol} ${sortDir} NULLS LAST
    LIMIT ${PAGE_SIZE} OFFSET ${offset}
  `, ...params)

  const flatParams: Record<string, string | undefined> = {
    search,
    sortBy:     rawSortBy,
    sortDir:    rawSortDir,
    provinceId: isAdmin ? provinceId : undefined,
    cityId:     isAdmin ? cityId : undefined,
    dateFrom,
    dateTo,
  }

  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-5 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Pelaporan Per Operator</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            {total > 0
              ? `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} dari ${total.toLocaleString('id-ID')} operator`
              : '0 operator'}
          </p>
        </div>

        {/* Filter */}
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <SearchInput
              defaultValue={search ?? ''}
              provinces={provinces}
              isAdmin={isAdmin}
              defaultDateFrom={dateFrom}
              defaultDateTo={dateTo}
              showSearch={false}
            />
            {(search || dateFrom !== today || dateTo !== today || (isAdmin && (provinceId || cityId))) && (
              <Link
                href="/posts/users"
                className="px-4 py-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 text-sm text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition"
              >
                Reset
              </Link>
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <SearchInput
            defaultValue={search ?? ''}
            provinces={provinces}
            isAdmin={isAdmin}
            defaultDateFrom={dateFrom}
            defaultDateTo={dateTo}
            showFilters={false}
          />
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
          <PostsByUsersTable rows={rows} sortBy={sortBy} sortDir={sortDir.toLowerCase()} />
        </div>

        {/* Pagination */}
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {total > 0
              ? `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} dari ${total.toLocaleString('id-ID')} operator`
              : '0 operator'}
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Link
                href={buildPostsUsersHref({ ...flatParams, page: '1' })}
                className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs transition ${
                  page === 1
                    ? 'pointer-events-none border-neutral-200 text-neutral-400 dark:border-neutral-700'
                    : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800'
                }`}
              >
                First
              </Link>
              <Link
                href={buildPostsUsersHref({ ...flatParams, page: String(Math.max(1, page - 1)) })}
                className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs transition ${
                  page === 1
                    ? 'pointer-events-none border-neutral-200 text-neutral-400 dark:border-neutral-700'
                    : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800'
                }`}
              >
                Prev
              </Link>
              <span className="min-w-[4.5rem] text-center text-xs text-neutral-500 dark:text-neutral-400">
                Hal. {page} / {totalPages}
              </span>
              <Link
                href={buildPostsUsersHref({ ...flatParams, page: String(Math.min(totalPages, page + 1)) })}
                className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs transition ${
                  page === totalPages
                    ? 'pointer-events-none border-neutral-200 text-neutral-400 dark:border-neutral-700'
                    : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800'
                }`}
              >
                Next
              </Link>
              <Link
                href={buildPostsUsersHref({ ...flatParams, page: String(totalPages) })}
                className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs transition ${
                  page === totalPages
                    ? 'pointer-events-none border-neutral-200 text-neutral-400 dark:border-neutral-700'
                    : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800'
                }`}
              >
                Last
              </Link>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
