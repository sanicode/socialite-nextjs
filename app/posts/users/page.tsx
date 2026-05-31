import { getSessionUser } from '@/app/lib/session'
import { redirect } from 'next/navigation'
import { prisma } from '@/app/lib/prisma'
import Link from 'next/link'
import PostsByUsersTable from '@/app/components/posts/users/PostsByUsersTable'
import PostsUsersFilterControls from '@/app/components/posts/users/PostsUsersFilterControls'
import TablePageSizeSelect from '@/app/components/TablePageSizeSelect'
import { getCities, getProvinces } from '@/app/actions/dashboard'
import { getPageSlice, parseTablePageSize } from '@/app/lib/table-pagination'

type SearchParams = Promise<{
  sortBy?: string
  sortDir?: string
  page?: string
  pageSize?: string
  dateFrom?: string
  dateTo?: string
  search?: string
  provinceId?: string
  cityId?: string
}>

const DEFAULT_PAGE_SIZE = 10

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

function normalizeDateParam(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const parsed = new Date(`${value}T00:00:00+07:00`)
  if (Number.isNaN(parsed.getTime())) return undefined
  return getJakartaDateString(parsed) === value ? value : undefined
}

function normalizeNumericParam(value: string | undefined) {
  return value && /^\d+$/.test(value) ? value : undefined
}

function formatDateLabel(value: string) {
  return new Date(`${value}T00:00:00+07:00`).toLocaleDateString('id-ID')
}

function getDateRangeLabel(dateFrom: string, dateTo: string) {
  if (dateFrom && dateTo && dateFrom === dateTo) {
    return `Tanggal ${formatDateLabel(dateFrom)}`
  }
  if (dateFrom && dateTo) {
    return `Tanggal ${formatDateLabel(dateFrom)} s.d. ${formatDateLabel(dateTo)}`
  }
  if (dateFrom) return `Mulai ${formatDateLabel(dateFrom)}`
  if (dateTo) return `Sampai ${formatDateLabel(dateTo)}`
  return 'Semua tanggal'
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

  const {
    sortBy: rawSortBy,
    sortDir: rawSortDir,
    page: pageParam,
    pageSize: pageSizeParam,
    dateFrom: rawDateFrom,
    dateTo: rawDateTo,
    search: rawSearch,
    provinceId: rawProvinceId,
    cityId: rawCityId,
  } = await searchParams
  const isAdmin = user.roles.includes('admin')
  const search = rawSearch?.trim()
  const provinceId = isAdmin ? normalizeNumericParam(rawProvinceId) : undefined
  const cityId = isAdmin && provinceId ? normalizeNumericParam(rawCityId) : undefined

  const page    = Math.max(1, parseInt(pageParam ?? '1', 10) || 1)
  const pageSize = parseTablePageSize(pageSizeParam, DEFAULT_PAGE_SIZE)
  const sortBy  = ALLOWED_SORT_COLS[rawSortBy ?? ''] ? (rawSortBy ?? 'operator') : 'operator'
  const sortDir = rawSortDir === 'desc' ? 'DESC' : 'ASC'
  const orderCol = ALLOWED_SORT_COLS[sortBy]
  const today = getJakartaDateString()
  const requestedDateFrom = normalizeDateParam(rawDateFrom)
  const requestedDateTo = normalizeDateParam(rawDateTo)
  const hasAdminDateFilter = isAdmin && !!(requestedDateFrom || requestedDateTo)
  const dateFrom = isAdmin
    ? (hasAdminDateFilter ? requestedDateFrom ?? '' : today)
    : today
  const dateTo = isAdmin
    ? (hasAdminDateFilter ? requestedDateTo ?? '' : today)
    : today
  const dateRangeLabel = getDateRangeLabel(dateFrom, dateTo)

  const tenantUser = await prisma.tenant_user.findFirst({
    where: { user_id: BigInt(user.id) },
    select: { tenant_id: true },
  })

  const conditions: string[] = []
  const params: unknown[] = []
  let idx = 1
  const jakartaCreatedDateSql = `date((post.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Jakarta')`

  if (dateFrom) {
    conditions.push(`${jakartaCreatedDateSql} >= $${idx}::date`)
    params.push(dateFrom)
    idx++
  }
  if (dateTo) {
    conditions.push(`${jakartaCreatedDateSql} <= $${idx}::date`)
    params.push(dateTo)
    idx++
  }

  if (search) {
    conditions.push(`(u.name ILIKE $${idx} OR u.email ILIKE $${idx} OR p.name ILIKE $${idx} OR c.name ILIKE $${idx})`)
    params.push(`%${search}%`)
    idx++
  }
  if (provinceId) {
    conditions.push(`p.id = $${idx}::int`)
    params.push(provinceId)
    idx++
  }
  if (cityId) {
    conditions.push(`c.id = $${idx}::bigint`)
    params.push(cityId)
    idx++
  }

  if (!isAdmin) {
    const tId = tenantUser?.tenant_id
    if (tId) {
      conditions.push(`tu.tenant_id = $${idx}`)
      params.push(tId)
      idx++
    } else {
      conditions.push('1 = 0')
    }
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const limitClause = pageSize === 'all' ? '' : `LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`

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
  const { totalPages, start, end } = getPageSlice(page, pageSize, total)

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
    ${limitClause}
  `, ...params)

  const flatParams: Record<string, string | undefined> = {
    sortBy:     rawSortBy,
    sortDir:    rawSortDir,
    pageSize:   pageSizeParam,
    dateFrom:   isAdmin ? requestedDateFrom : undefined,
    dateTo:     isAdmin ? requestedDateTo : undefined,
    search,
    provinceId,
    cityId,
  }
  const [provinces, cities] = isAdmin
    ? await Promise.all([
        getProvinces(),
        provinceId ? getCities(provinceId) : Promise.resolve([]),
      ])
    : [[], []]

  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-5 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Pelaporan Per Operator</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            {total > 0
              ? `${start}–${end} dari ${total.toLocaleString('id-ID')} operator`
              : '0 operator'}
            <span className="ml-2 text-neutral-400 dark:text-neutral-500">{dateRangeLabel}</span>
          </p>
        </div>

        {isAdmin ? (
          <PostsUsersFilterControls
            key={`${search ?? ''}-${provinceId ?? ''}-${cityId ?? ''}-${requestedDateFrom ?? 'default'}-${requestedDateTo ?? 'default'}-${pageSize}`}
            pageSize={pageSize}
            dateFrom={dateFrom}
            dateTo={dateTo}
            search={search ?? ''}
            provinceId={provinceId ?? ''}
            cityId={cityId ?? ''}
            provinces={provinces}
            initialCities={cities}
          />
        ) : (
          <TablePageSizeSelect value={pageSize} />
        )}

        {/* Table */}
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
          <PostsByUsersTable
            rows={rows}
            sortBy={sortBy}
            sortDir={sortDir.toLowerCase()}
            dateFrom={dateFrom}
            dateTo={dateTo}
            search={search}
            provinceId={provinceId}
            cityId={cityId}
          />
        </div>

        {/* Pagination */}
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {total > 0
              ? `${start}–${end} dari ${total.toLocaleString('id-ID')} operator`
              : '0 operator'}
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Link
                href={buildPostsUsersHref({ ...flatParams, page: '1' })}
                className={`ui-button-sm inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs transition ${
                  page === 1
                    ? 'pointer-events-none border-neutral-200 text-neutral-400 dark:border-neutral-700'
                    : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800'
                }`}
              >
                First
              </Link>
              <Link
                href={buildPostsUsersHref({ ...flatParams, page: String(Math.max(1, page - 1)) })}
                className={`ui-button-sm inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs transition ${
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
                className={`ui-button-sm inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs transition ${
                  page === totalPages
                    ? 'pointer-events-none border-neutral-200 text-neutral-400 dark:border-neutral-700'
                    : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800'
                }`}
              >
                Next
              </Link>
              <Link
                href={buildPostsUsersHref({ ...flatParams, page: String(totalPages) })}
                className={`ui-button-sm inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs transition ${
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
