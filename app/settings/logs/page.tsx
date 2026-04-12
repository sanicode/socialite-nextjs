import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/app/lib/session'
import { getAccessLogs } from '@/app/lib/access-logs'
import { isAccessLoggingEnabled } from '@/app/actions/logs'
import AccessLogsTable from '@/app/components/settings/AccessLogsTable'
import LogsToggle from '@/app/components/settings/LogsToggle'
import LogsTruncateButton from '@/app/components/settings/LogsTruncateButton'

type SearchParams = Promise<{
  page?: string
  search?: string
  eventType?: string
  country?: string
  path?: string
  dateFrom?: string
  dateTo?: string
}>

const PAGE_SIZE = 50

function buildLogsHref(params: Record<string, string | undefined>) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value)
  }
  const queryString = query.toString()
  return queryString ? `/settings/logs?${queryString}` : '/settings/logs'
}

export default async function LogsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  if (!user.roles.includes('admin')) redirect('/posts')

  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1)

  const [logsEnabled, { rows, total }] = await Promise.all([
    isAccessLoggingEnabled(),
    getAccessLogs({
      page,
      pageSize: PAGE_SIZE,
      search: params.search,
      eventType: params.eventType,
      country: params.country,
      path: params.path,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
    }),
  ])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-5 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Settings</p>
            <h1 className="mt-1 text-2xl font-bold text-neutral-900 dark:text-white">Logs</h1>
            <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
              Riwayat akses aplikasi, login, dan request yang diblokir.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3 pt-1">
            <LogsTruncateButton />
            <div className="h-5 w-px bg-neutral-200 dark:bg-neutral-700" />
            <span className={`text-sm font-medium ${logsEnabled ? 'text-neutral-900 dark:text-white' : 'text-neutral-400 dark:text-neutral-500'}`}>
              {logsEnabled ? 'Aktif' : 'Nonaktif'}
            </span>
            <LogsToggle enabled={logsEnabled} />
          </div>
        </div>

        <form className="grid grid-cols-1 gap-3 rounded-2xl border border-neutral-200 bg-white p-4 sm:grid-cols-2 xl:grid-cols-6 dark:border-neutral-800 dark:bg-neutral-900">
          <input
            type="search"
            name="search"
            defaultValue={params.search ?? ''}
            placeholder="Cari IP, email, agent..."
            className="rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:focus:ring-white xl:col-span-2"
          />
          <input
            type="text"
            name="eventType"
            defaultValue={params.eventType ?? ''}
            placeholder="Event type"
            className="rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:focus:ring-white"
          />
          <input
            type="text"
            name="country"
            defaultValue={params.country ?? ''}
            placeholder="Country"
            className="rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm uppercase text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:focus:ring-white"
          />
          <input
            type="text"
            name="path"
            defaultValue={params.path ?? ''}
            placeholder="Path"
            className="rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:focus:ring-white"
          />
          <div className="flex gap-3 xl:col-span-2">
            <input
              type="date"
              name="dateFrom"
              defaultValue={params.dateFrom ?? ''}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:focus:ring-white"
            />
            <input
              type="date"
              name="dateTo"
              defaultValue={params.dateTo ?? ''}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:focus:ring-white"
            />
          </div>
          <div className="flex items-center gap-3 xl:col-span-6">
            <button
              type="submit"
              className="inline-flex items-center rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
            >
              Filter
            </button>
            <Link
              href="/settings/logs"
              className="inline-flex items-center rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              Reset
            </Link>
          </div>
        </form>

        <AccessLogsTable logs={rows} />

        <div className="flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {total > 0
              ? `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} dari ${total.toLocaleString('id-ID')} log`
              : '0 log'}
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Link
                href={buildLogsHref({ ...params, page: '1' })}
                className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs transition ${
                  page === 1
                    ? 'pointer-events-none border-neutral-200 text-neutral-400 dark:border-neutral-700'
                    : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800'
                }`}
              >
                First
              </Link>
              <Link
                href={buildLogsHref({ ...params, page: String(Math.max(1, page - 1)) })}
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
                href={buildLogsHref({ ...params, page: String(Math.min(totalPages, page + 1)) })}
                className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs transition ${
                  page === totalPages
                    ? 'pointer-events-none border-neutral-200 text-neutral-400 dark:border-neutral-700'
                    : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800'
                }`}
              >
                Next
              </Link>
              <Link
                href={buildLogsHref({ ...params, page: String(totalPages) })}
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

