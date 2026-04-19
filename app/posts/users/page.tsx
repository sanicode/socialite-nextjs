import { getSessionUser } from '@/app/lib/session'
import { redirect } from 'next/navigation'
import { prisma } from '@/app/lib/prisma'
import SearchInput from '@/app/components/posts/users/SearchInput'
import Link from 'next/link'
import PostsByUsersTable from '@/app/components/posts/users/PostsByUsersTable'

type SearchParams = Promise<{ search?: string; sortBy?: string; sortDir?: string }>

const ALLOWED_SORT_COLS: Record<string, string> = {
  provinsi:       'p.name',
  kabupaten_kota: 'c.name',
  operator:       'u.name',
  email:          'u.email',
  pending_posts:  'pending_posts',
  valid_posts:    'valid_posts',
  invalid_posts:  'invalid_posts',
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

  const { search, sortBy: rawSortBy, sortDir: rawSortDir } = await searchParams
  const isAdmin = user.roles.includes('admin')

  const sortBy  = ALLOWED_SORT_COLS[rawSortBy ?? ''] ? (rawSortBy ?? 'operator') : 'operator'
  const sortDir = rawSortDir === 'desc' ? 'DESC' : 'ASC'
  const orderCol = ALLOWED_SORT_COLS[sortBy]

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

  if (!isAdmin) {
    const tId = tenantUser?.tenant_id
    if (tId) {
      conditions.push(`tu.tenant_id = $${idx}`)
      params.push(tId)
      idx++
    }
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

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
  `, ...params)

  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-5 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Pelaporan Per Operator</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            {rows.length} operator ditemukan
          </p>
        </div>

        {/* Filter */}
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <SearchInput defaultValue={search ?? ''} />
            {search && (
              <Link
                href="/posts/users"
                className="px-4 py-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 text-sm text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition"
              >
                Reset
              </Link>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
          <PostsByUsersTable rows={rows} sortBy={sortBy} sortDir={sortDir.toLowerCase()} />
        </div>

      </div>
    </div>
  )
}
