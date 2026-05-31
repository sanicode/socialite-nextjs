import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/app/lib/session'
import { getCitiesForSelect, getTenants, getProvincesForSelect } from '@/app/actions/tenants'
import TenantsClientSection from '@/app/components/settings/TenantsClientSection'
import { getPageSlice, parseTablePageSize } from '@/app/lib/table-pagination'

type SearchParams = Promise<{
  page?: string
  pageSize?: string
  search?: string
  provinceId?: string
  cityId?: string
  sortBy?: string
  sortDir?: string
}>

const DEFAULT_PAGE_SIZE = 20

function normalizeNumericParam(value: string | undefined) {
  return value && /^\d+$/.test(value) ? value : undefined
}

function buildTenantsHref(params: Record<string, string | undefined>) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value)
  }
  const qs = query.toString()
  return qs ? `/settings/tenants?${qs}` : '/settings/tenants'
}

export default async function TenantsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  if (!user.roles.includes('admin')) redirect('/posts')

  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1)
  const pageSize = parseTablePageSize(params.pageSize, DEFAULT_PAGE_SIZE)
  const provinceId = normalizeNumericParam(params.provinceId)
  const cityId = normalizeNumericParam(params.cityId)

  const sortBy  = params.sortBy  ?? 'name'
  const sortDir = params.sortDir === 'desc' ? 'desc' : 'asc'

  const [{ tenants, total }, provinces, initialCities] = await Promise.all([
    getTenants({
      page,
      pageSize,
      search: params.search,
      provinceId,
      cityId,
      sortBy,
      sortDir,
    }),
    getProvincesForSelect(),
    provinceId ? getCitiesForSelect(parseInt(provinceId, 10)) : Promise.resolve([]),
  ])

  const { totalPages, start, end } = getPageSlice(page, pageSize, total)
  const clientParams = { ...params, provinceId, cityId }

  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-5 sm:p-6">
      <div className="mx-auto max-w-5xl space-y-6">

        <div>
          <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Settings</p>
          <h1 className="mt-1 text-2xl font-bold text-neutral-900 dark:text-white">Tenants</h1>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            Kelola data tenant, alamat, serta user (manager dan operator) yang terdaftar.
          </p>
        </div>

        <TenantsClientSection
          key={`${params.search ?? ''}-${provinceId ?? ''}-${cityId ?? ''}-${params.pageSize ?? ''}-${sortBy}-${sortDir}`}
          tenants={tenants}
          provinces={provinces}
          initialCities={initialCities}
          params={clientParams}
          pageSize={pageSize}
          sortBy={sortBy}
          sortDir={sortDir}
        />

        {/* Pagination */}
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {total > 0
              ? `${start}–${end} dari ${total.toLocaleString('id-ID')} tenant`
              : '0 tenant'}
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Link
                href={buildTenantsHref({ ...clientParams, page: '1' })}
                className={`ui-button-sm inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs transition ${
                  page === 1
                    ? 'pointer-events-none border-neutral-200 text-neutral-400 dark:border-neutral-700'
                    : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800'
                }`}
              >First</Link>
              <Link
                href={buildTenantsHref({ ...clientParams, page: String(Math.max(1, page - 1)) })}
                className={`ui-button-sm inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs transition ${
                  page === 1
                    ? 'pointer-events-none border-neutral-200 text-neutral-400 dark:border-neutral-700'
                    : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800'
                }`}
              >Prev</Link>
              <span className="min-w-[4.5rem] text-center text-xs text-neutral-500 dark:text-neutral-400">
                Hal. {page} / {totalPages}
              </span>
              <Link
                href={buildTenantsHref({ ...clientParams, page: String(Math.min(totalPages, page + 1)) })}
                className={`ui-button-sm inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs transition ${
                  page === totalPages
                    ? 'pointer-events-none border-neutral-200 text-neutral-400 dark:border-neutral-700'
                    : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800'
                }`}
              >Next</Link>
              <Link
                href={buildTenantsHref({ ...clientParams, page: String(totalPages) })}
                className={`ui-button-sm inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs transition ${
                  page === totalPages
                    ? 'pointer-events-none border-neutral-200 text-neutral-400 dark:border-neutral-700'
                    : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800'
                }`}
              >Last</Link>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
