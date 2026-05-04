import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/app/lib/session'
import { getUsers } from '@/app/actions/users'
import UsersClientSection from '@/app/components/settings/UsersClientSection'
import AddUserButton from '@/app/components/settings/AddUserButton'
import ImportUsersButton from '@/app/components/settings/ImportUsersButton'
import { getPageSlice, parseTablePageSize } from '@/app/lib/table-pagination'

type SearchParams = Promise<{
  page?: string
  pageSize?: string
  search?: string
  status?: string
  loginSecurity?: string
  dateFrom?: string
  dateTo?: string
  sortBy?: string
  sortDir?: string
}>

const DEFAULT_PAGE_SIZE = 20

function buildUsersHref(params: Record<string, string | undefined>) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value)
  }
  const qs = query.toString()
  return qs ? `/settings/users?${qs}` : '/settings/users'
}

export default async function UsersPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  if (!user.roles.includes('admin')) redirect('/posts')

  const params = await searchParams
  const page   = Math.max(1, parseInt(params.page ?? '1', 10) || 1)
  const pageSize = parseTablePageSize(params.pageSize, DEFAULT_PAGE_SIZE)

  const { users, total, totalBlocked, totalUnderAttack, totalRateLimited } = await getUsers({
    page,
    pageSize,
    search:   params.search,
    status:   params.status,
    loginSecurity: params.loginSecurity,
    dateFrom: params.dateFrom,
    dateTo:   params.dateTo,
    sortBy:   params.sortBy,
    sortDir:  params.sortDir,
  })

  const { totalPages, start, end } = getPageSlice(page, pageSize, total)

  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-5 sm:p-6">
      <div className="mx-auto max-w-5xl space-y-6">

        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Settings</p>
            <h1 className="mt-1 text-2xl font-bold text-neutral-900 dark:text-white">Users</h1>
            <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
              Kelola akun pengguna, status blokir, dan reset rate limit login.
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <ImportUsersButton />
            <AddUserButton />
          </div>
        </div>

        <UsersClientSection
          key={`${params.search ?? ''}-${params.status ?? ''}-${params.loginSecurity ?? ''}-${params.dateFrom ?? ''}-${params.dateTo ?? ''}-${params.pageSize ?? ''}-${params.sortBy ?? ''}-${params.sortDir ?? ''}`}
          users={users}
          totalBlocked={totalBlocked}
          totalUnderAttack={totalUnderAttack}
          totalRateLimited={totalRateLimited}
          params={params}
          pageSize={pageSize}
        />

        {/* Pagination */}
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {total > 0
              ? `${start}–${end} dari ${total.toLocaleString('id-ID')} user`
              : '0 user'}
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Link
                href={buildUsersHref({ ...params, page: '1' })}
                className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs transition ${
                  page === 1
                    ? 'pointer-events-none border-neutral-200 text-neutral-400 dark:border-neutral-700'
                    : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800'
                }`}
              >
                First
              </Link>
              <Link
                href={buildUsersHref({ ...params, page: String(Math.max(1, page - 1)) })}
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
                href={buildUsersHref({ ...params, page: String(Math.min(totalPages, page + 1)) })}
                className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs transition ${
                  page === totalPages
                    ? 'pointer-events-none border-neutral-200 text-neutral-400 dark:border-neutral-700'
                    : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800'
                }`}
              >
                Next
              </Link>
              <Link
                href={buildUsersHref({ ...params, page: String(totalPages) })}
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
