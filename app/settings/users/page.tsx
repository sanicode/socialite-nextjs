import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/app/lib/session'
import { getUsers } from '@/app/actions/users'
import UsersTable from '@/app/components/settings/UsersTable'

type SearchParams = Promise<{
  page?: string
  search?: string
  status?: string
  loginSecurity?: string
  dateFrom?: string
  dateTo?: string
  sortBy?: string
  sortDir?: string
}>

const PAGE_SIZE = 20

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

  const { users, total, totalBlocked, totalUnderAttack, totalRateLimited } = await getUsers({
    page,
    pageSize: PAGE_SIZE,
    search:   params.search,
    status:   params.status,
    loginSecurity: params.loginSecurity,
    dateFrom: params.dateFrom,
    dateTo:   params.dateTo,
    sortBy:   params.sortBy,
    sortDir:  params.sortDir,
  })

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-5 sm:p-6">
      <div className="mx-auto max-w-5xl space-y-6">

        <div>
          <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Settings</p>
          <h1 className="mt-1 text-2xl font-bold text-neutral-900 dark:text-white">Users</h1>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            Kelola akun pengguna, status blokir, dan reset rate limit login.
          </p>
        </div>

        {/* Filter */}
        <form className="grid grid-cols-1 gap-3 rounded-2xl border border-neutral-200 bg-white p-4 sm:grid-cols-2 xl:grid-cols-4 dark:border-neutral-800 dark:bg-neutral-900">
          <input
            type="search"
            name="search"
            defaultValue={params.search ?? ''}
            placeholder="Cari nama atau email..."
            className="rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:focus:ring-white sm:col-span-2 xl:col-span-2"
          />
          <select
            name="status"
            defaultValue={params.status ?? ''}
            className="rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:focus:ring-white"
          >
            <option value="">Semua status</option>
            <option value="active">Aktif</option>
            <option value="blocked">Diblokir</option>
          </select>
          <select
            name="loginSecurity"
            defaultValue={params.loginSecurity ?? ''}
            className="rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:focus:ring-white"
          >
            <option value="">Semua kondisi login</option>
            <option value="has_attempts">Ada login attempts</option>
            <option value="under_attack">Sedang diserang ({'>'}10/jam)</option>
            <option value="rate_limited">Sedang kena rate limit</option>
          </select>
          <div className="flex items-center gap-2 sm:col-span-2 xl:col-span-4">
            <span className="min-w-[7.5rem] text-xs font-medium text-neutral-500 dark:text-neutral-400">
              Terakhir Aktif
            </span>
            <input
              type="date"
              name="dateFrom"
              defaultValue={params.dateFrom ?? ''}
              className="flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:focus:ring-white"
            />
            <span className="text-neutral-400 dark:text-neutral-500">–</span>
            <input
              type="date"
              name="dateTo"
              defaultValue={params.dateTo ?? ''}
              className="flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:focus:ring-white"
            />
          </div>
          <div className="flex items-center gap-3 sm:col-span-2 xl:col-span-4">
            <button
              type="submit"
              className="inline-flex items-center rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
            >
              Filter
            </button>
            <Link
              href="/settings/users"
              className="inline-flex items-center rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              Reset
            </Link>
          </div>
        </form>

        <UsersTable
          users={users}
          totalBlocked={totalBlocked}
          totalUnderAttack={totalUnderAttack}
          totalRateLimited={totalRateLimited}
          sortBy={params.sortBy ?? 'name'}
          sortDir={(params.sortDir === 'desc' ? 'desc' : 'asc')}
          searchParams={params}
        />

        {/* Pagination */}
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {total > 0
              ? `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} dari ${total.toLocaleString('id-ID')} user`
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
