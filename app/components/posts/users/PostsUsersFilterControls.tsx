'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import type { FormEvent } from 'react'
import TablePageSizeSelect from '@/app/components/TablePageSizeSelect'
import { getCities } from '@/app/actions/dashboard'
import type { TablePageSize } from '@/app/lib/table-pagination'

type Props = {
  pageSize: TablePageSize
  dateFrom: string
  dateTo: string
  search: string
  provinceId: string
  cityId: string
  provinces: { id: number; name: string }[]
  initialCities: { id: string; name: string }[]
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

export default function PostsUsersFilterControls({
  pageSize,
  dateFrom,
  dateTo,
  search,
  provinceId,
  cityId,
  provinces,
  initialCities,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [searchValue, setSearchValue] = useState(search)
  const [filterDateFrom, setFilterDateFrom] = useState(dateFrom)
  const [filterDateTo, setFilterDateTo] = useState(dateTo)
  const [filterProvinceId, setFilterProvinceId] = useState(provinceId)
  const [filterCityId, setFilterCityId] = useState(cityId)
  const [cities, setCities] = useState(initialCities)
  const [isLoadingCities, setIsLoadingCities] = useState(false)
  const searchParamsString = searchParams.toString()
  const hasActiveFilter =
    searchParams.has('dateFrom') ||
    searchParams.has('dateTo') ||
    searchParams.has('provinceId') ||
    searchParams.has('cityId')
  const processing = isPending

  function handleProvinceChange(nextProvinceId: string) {
    setFilterProvinceId(nextProvinceId)
    setFilterCityId('')
    setCities([])

    if (!nextProvinceId) return

    setIsLoadingCities(true)
    void getCities(nextProvinceId)
      .then((nextCities) => {
        setCities(nextCities)
      })
      .catch(() => {
        setCities([])
      })
      .finally(() => {
        setIsLoadingCities(false)
      })
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const params = new URLSearchParams(searchParams.toString())
    if (filterDateFrom) params.set('dateFrom', filterDateFrom)
    else params.delete('dateFrom')
    if (filterDateTo) params.set('dateTo', filterDateTo)
    else params.delete('dateTo')
    if (filterProvinceId) params.set('provinceId', filterProvinceId)
    else params.delete('provinceId')
    if (filterProvinceId && filterCityId) params.set('cityId', filterCityId)
    else params.delete('cityId')
    params.delete('page')

    const qs = params.toString()
    const nextHref = qs ? `/posts/users?${qs}` : '/posts/users'
    const currentHref = searchParamsString ? `/posts/users?${searchParamsString}` : '/posts/users'
    if (nextHref === currentHref) {
      setIsFilterOpen(false)
      return
    }

    setIsFilterOpen(false)
    startTransition(() => {
      router.push(nextHref, { scroll: false })
    })
  }

  function applySearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const params = new URLSearchParams(searchParams.toString())
    const nextSearch = searchValue.trim()
    if (nextSearch) params.set('search', nextSearch)
    else params.delete('search')
    params.delete('page')

    const qs = params.toString()
    const nextHref = qs ? `/posts/users?${qs}` : '/posts/users'
    const currentHref = searchParamsString ? `/posts/users?${searchParamsString}` : '/posts/users'
    if (nextHref === currentHref) return

    startTransition(() => {
      router.push(nextHref, { scroll: false })
    })
  }

  return (
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
            aria-controls="posts-users-date-filter"
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
          id="posts-users-date-filter"
          onSubmit={applyFilters}
          className="grid grid-cols-1 items-end gap-3 rounded-2xl border border-neutral-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4 dark:border-neutral-800 dark:bg-neutral-900"
        >
          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">Tanggal Awal</span>
            <input
              type="date"
              value={filterDateFrom}
              onChange={(event) => setFilterDateFrom(event.target.value)}
              disabled={processing}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2 text-sm text-neutral-900 transition focus:outline-none focus:ring-2 focus:ring-neutral-900 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:focus:ring-white"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">Tanggal Akhir</span>
            <input
              type="date"
              value={filterDateTo}
              onChange={(event) => setFilterDateTo(event.target.value)}
              disabled={processing}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2 text-sm text-neutral-900 transition focus:outline-none focus:ring-2 focus:ring-neutral-900 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:focus:ring-white"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">Provinsi</span>
            <select
              value={filterProvinceId}
              onChange={(event) => handleProvinceChange(event.target.value)}
              disabled={processing}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2 text-sm text-neutral-900 transition focus:outline-none focus:ring-2 focus:ring-neutral-900 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:focus:ring-white"
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
              className="w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2 text-sm text-neutral-900 transition focus:outline-none focus:ring-2 focus:ring-neutral-900 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:focus:ring-white"
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
              href="/posts/users"
              className="inline-flex ui-button rounded-xl border border-neutral-300 gap-2 px-3.5 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              Reset
            </Link>
          </div>
        </form>
      )}
    </div>
  )
}
