'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition, useRef } from 'react'
import TenantsTable, { type TenantsTableHandle } from '@/app/components/settings/TenantsTable'
import TablePageSizeSelect from '@/app/components/TablePageSizeSelect'
import { getCitiesForSelect } from '@/app/actions/tenants'
import type { TenantRow } from '@/app/actions/tenants'
import type { TablePageSize } from '@/app/lib/table-pagination'

type TenantsParams = {
  pageSize?: string
  search?: string
  provinceId?: string
  cityId?: string
  sortBy?: string
  sortDir?: string
}

type Props = {
  tenants: TenantRow[]
  provinces: { id: number; name: string }[]
  initialCities: { id: string; name: string }[]
  params: TenantsParams
  pageSize: TablePageSize
  sortBy: string
  sortDir: 'asc' | 'desc'
}

function buildHref(params: Record<string, string | undefined>) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value)
  }
  const qs = query.toString()
  return qs ? `/settings/tenants?${qs}` : '/settings/tenants'
}

function SearchIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m1.6-5.4a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  )
}

function SlidersIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h7m4 0h5M4 17h5m4 0h7M11 7a2 2 0 104 0 2 2 0 00-4 0zM9 17a2 2 0 104 0 2 2 0 00-4 0z" />
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-30" cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-90" fill="currentColor" d="M21 12a9 9 0 00-9-9v3a6 6 0 016 6h3z" />
    </svg>
  )
}

export default function TenantsClientSection({
  tenants,
  provinces,
  initialCities,
  params,
  pageSize,
  sortBy,
  sortDir,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [searchValue, setSearchValue] = useState(params.search ?? '')
  const [filterProvinceId, setFilterProvinceId] = useState(params.provinceId ?? '')
  const [filterCityId, setFilterCityId] = useState(params.cityId ?? '')
  const [cities, setCities] = useState(initialCities)
  const [isLoadingCities, setIsLoadingCities] = useState(false)
  const tableRef = useRef<TenantsTableHandle>(null)
  const searchParamsString = searchParams.toString()
  const processing = isPending
  const hasActiveFilter = searchParams.has('provinceId') || searchParams.has('cityId')

  function handleProvinceChange(nextProvinceId: string) {
    setFilterProvinceId(nextProvinceId)
    setFilterCityId('')
    setCities([])

    if (!nextProvinceId) return

    setIsLoadingCities(true)
    void getCitiesForSelect(parseInt(nextProvinceId, 10))
      .then((nextCities) => setCities(nextCities))
      .catch(() => setCities([]))
      .finally(() => setIsLoadingCities(false))
  }

  function applySearch(event: { preventDefault(): void }) {
    event.preventDefault()

    const nextSearch = searchValue.trim()
    const nextHref = buildHref({
      pageSize: params.pageSize,
      search: nextSearch,
      provinceId: params.provinceId,
      cityId: params.cityId,
      sortBy: params.sortBy,
      sortDir: params.sortDir,
    })
    const currentHref = searchParamsString ? `/settings/tenants?${searchParamsString}` : '/settings/tenants'
    if (nextHref === currentHref) return

    startTransition(() => {
      router.push(nextHref, { scroll: false })
    })
  }

  function applyFilters(event: { preventDefault(): void }) {
    event.preventDefault()

    const nextHref = buildHref({
      pageSize: params.pageSize,
      search: params.search,
      provinceId: filterProvinceId,
      cityId: filterProvinceId ? filterCityId : undefined,
      sortBy: params.sortBy,
      sortDir: params.sortDir,
    })
    const currentHref = searchParamsString ? `/settings/tenants?${searchParamsString}` : '/settings/tenants'
    if (nextHref === currentHref) {
      setIsFilterOpen(false)
      return
    }

    setIsFilterOpen(false)
    startTransition(() => {
      router.push(nextHref, { scroll: false })
    })
  }

  return (
    <>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => tableRef.current?.openCreate()}
          className="inline-flex ui-button-sm gap-2 rounded-xl bg-neutral-900 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Tambah Tenant
        </button>
      </div>

      <div className="space-y-3">
        <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between dark:border-neutral-800 dark:bg-neutral-900">
          <TablePageSizeSelect value={pageSize} />
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
            <form onSubmit={applySearch} className="flex w-full items-center gap-2 sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-500 dark:text-neutral-400" />
                <input
                  type="search"
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  disabled={processing}
                  placeholder="Search..."
                  className="ui-search-with-icon h-10 w-full rounded-xl border border-neutral-300 bg-white py-2 pl-11 pr-4 text-sm text-neutral-900 transition placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:placeholder:text-neutral-500 dark:focus:ring-white"
                />
              </div>
              <button
                type="submit"
                disabled={processing}
                className="inline-flex flex-none items-center justify-center gap-2 rounded-xl border border-neutral-300 px-3.5 py-2 text-sm font-medium text-neutral-700 transition border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:bg-neutral-800"
              >
                {processing ? <SpinnerIcon /> : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m1.6-5.4a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                )}
                {processing ? 'Memproses...' : 'Cari'}
              </button>
            </form>
            <button
              type="button"
              aria-expanded={isFilterOpen}
              aria-controls="users-filter"
              onClick={() => setIsFilterOpen((open) => !open)}
              className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold transition ${
                isFilterOpen || hasActiveFilter
                  ? 'border-neutral-900 bg-neutral-900 text-white hover:bg-neutral-700 dark:border-white dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100'
                  : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:bg-neutral-800'
              }`}
            >
              <SlidersIcon />
              Filter
            </button>
          </div>
        </div>

        {isFilterOpen && (
          <form
            id="tenants-location-filter"
            onSubmit={applyFilters}
            className="grid grid-cols-1 items-end gap-3 rounded-2xl border border-neutral-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4 dark:border-neutral-800 dark:bg-neutral-900"
          >
            <label className="flex flex-col gap-1">
              <span className="text-xs text-neutral-500 dark:text-neutral-400">Provinsi</span>
              <select
                value={filterProvinceId}
                onChange={(event) => handleProvinceChange(event.target.value)}
                disabled={processing}
                className="w-full rounded-xl border border-neutral-300 h-10 bg-white px-3.5 py-2 text-sm text-neutral-900 transition focus:outline-none focus:ring-2 focus:ring-neutral-900 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:focus:ring-white"
              >
                <option value="">Semua Provinsi</option>
                {provinces.map((province) => (
                  <option key={province.id} value={province.id}>
                    {province.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs text-neutral-500 dark:text-neutral-400">Kota</span>
              <select
                value={filterCityId}
                onChange={(event) => setFilterCityId(event.target.value)}
                disabled={processing || !filterProvinceId || isLoadingCities}
                className="w-full rounded-xl border border-neutral-300 bg-white h-10 px-3.5 py-2 text-sm text-neutral-900 transition focus:outline-none focus:ring-2 focus:ring-neutral-900 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:focus:ring-white"
              >
                <option value="">{isLoadingCities ? 'Memuat kota...' : 'Semua Kota'}</option>
                {cities.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
              <button
                type="submit"
                disabled={processing}
                className="inline-flex ui-button-sm gap-2 rounded-xl bg-neutral-900 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
              >
                {processing ? <SpinnerIcon /> : (
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {processing ? 'Memproses...' : 'Apply'}
              </button>
              <Link
                href="/settings/tenants"
                className="inline-flex ui-button rounded-xl border border-neutral-300 px-3.5 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                Reset
              </Link>
            </div>
          </form>
        )}
      </div>

      <TenantsTable
        ref={tableRef}
        tenants={tenants}
        provinces={provinces}
        sortBy={sortBy}
        sortDir={sortDir}
        searchParams={params}
        isLoading={processing}
      />
    </>
  )
}
