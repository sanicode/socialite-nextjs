import { getSessionUser } from '@/app/lib/session'
import { redirect } from 'next/navigation'
import { prisma } from '@/app/lib/prisma'
import SearchInput from '@/app/components/posts/users/SearchInput'
import Link from 'next/link'

type SearchParams = Promise<{ search?: string }>

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

  const { search } = await searchParams
  const isAdmin = user.roles.includes('admin')

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
    ORDER BY u.name ASC
  `, ...params)

  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-5 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Per Operator</h1>
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Provinsi</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Kota</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Nama</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Email</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Pending</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Valid</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Invalid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-neutral-400 dark:text-neutral-500">
                      Tidak ada data
                    </td>
                  </tr>
                ) : (
                  rows.map((row, i) => (
                    <tr key={i} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition">
                      <td className="px-4 py-3 text-neutral-700 dark:text-neutral-300">{row.provinsi ?? '-'}</td>
                      <td className="px-4 py-3 text-neutral-700 dark:text-neutral-300">{row.kabupaten_kota ?? '-'}</td>
                      <td className="px-4 py-3 font-medium text-neutral-900 dark:text-white">{row.operator}</td>
                      <td className="px-4 py-3 text-neutral-500 dark:text-neutral-400">{row.email}</td>
                      <td className="px-4 py-3 text-right">
                        <a
                          href={`/posts/users/${row.user_id}/pending`}
                          className="inline-flex items-center justify-center min-w-[2.5rem] px-3 py-1.5 rounded-lg font-semibold text-sm bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition"
                        >
                          {row.pending_posts}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <a
                          href={`/posts/users/${row.user_id}/valid`}
                          className="inline-flex items-center justify-center min-w-[2.5rem] px-3 py-1.5 rounded-lg font-semibold text-sm bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition"
                        >
                          {row.valid_posts}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <a
                          href={`/posts/users/${row.user_id}/invalid`}
                          className="inline-flex items-center justify-center min-w-[2.5rem] px-3 py-1.5 rounded-lg font-semibold text-sm bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition"
                        >
                          {row.invalid_posts}
                        </a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  )
}
