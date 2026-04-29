import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/app/lib/session'
import { getOperators } from '@/app/actions/operators'
import OperatorsTable from '@/app/components/operators/OperatorsTable'
import TableSearchForm from '@/app/components/TableSearchForm'

type SearchParams = Promise<{
  page?: string
  search?: string
  email?: string
  phone?: string
}>

const PAGE_SIZE = 20

function buildHref(params: Record<string, string | undefined>) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value)
  }
  const qs = query.toString()
  return qs ? `/operators?${qs}` : '/operators'
}

export default async function OperatorsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  if (!user.roles.includes('manager') && !user.roles.includes('admin')) redirect('/posts')

  const params = await searchParams
  const page   = Math.max(1, parseInt(params.page ?? '1', 10) || 1)

  const { operators, total } = await getOperators({
    page,
    pageSize: PAGE_SIZE,
    search: params.search,
    email:  params.email,
    phone:  params.phone,
  })

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-5 sm:p-6">
      <div className="mx-auto max-w-4xl space-y-6">

        <div>
          <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Manajemen</p>
          <h1 className="mt-1 text-2xl font-bold text-neutral-900 dark:text-white">Operator</h1>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            Kelola operator yang bertugas di kota Anda.
          </p>
        </div>

        {/* Filter */}
        <form className="grid grid-cols-1 gap-3 rounded-2xl border border-neutral-200 bg-white p-4 sm:grid-cols-2 dark:border-neutral-800 dark:bg-neutral-900">
          {params.search && <input type="hidden" name="search" value={params.search} />}
          <input
            type="search"
            name="email"
            defaultValue={params.email ?? ''}
            placeholder="Email..."
            className="rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:focus:ring-white"
          />
          <input
            type="search"
            name="phone"
            defaultValue={params.phone ?? ''}
            placeholder="Nomor telp..."
            className="rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:focus:ring-white"
          />
          <div className="flex items-center gap-3 sm:col-span-2">
            <button
              type="submit"
              className="inline-flex items-center rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
            >
              Filter
            </button>
            <Link
              href="/operators"
              className="inline-flex items-center rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              Reset
            </Link>
          </div>
        </form>

        <TableSearchForm
          action="/operators"
          defaultValue={params.search}
          placeholder="Cari nama..."
          hiddenParams={{
            email: params.email,
            phone: params.phone,
          }}
        />

        <OperatorsTable operators={operators} />

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
                href={buildHref({ ...params, page: '1' })}
                className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs transition ${page === 1 ? 'pointer-events-none border-neutral-200 text-neutral-400 dark:border-neutral-700' : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800'}`}
              >
                First
              </Link>
              <Link
                href={buildHref({ ...params, page: String(Math.max(1, page - 1)) })}
                className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs transition ${page === 1 ? 'pointer-events-none border-neutral-200 text-neutral-400 dark:border-neutral-700' : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800'}`}
              >
                Prev
              </Link>
              <span className="min-w-[4.5rem] text-center text-xs text-neutral-500 dark:text-neutral-400">
                Hal. {page} / {totalPages}
              </span>
              <Link
                href={buildHref({ ...params, page: String(Math.min(totalPages, page + 1)) })}
                className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs transition ${page === totalPages ? 'pointer-events-none border-neutral-200 text-neutral-400 dark:border-neutral-700' : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800'}`}
              >
                Next
              </Link>
              <Link
                href={buildHref({ ...params, page: String(totalPages) })}
                className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs transition ${page === totalPages ? 'pointer-events-none border-neutral-200 text-neutral-400 dark:border-neutral-700' : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800'}`}
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
