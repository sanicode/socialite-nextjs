"use client"

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState, useTransition } from 'react'
import type { FormEvent } from 'react'
import { getCities } from '@/app/actions/dashboard'

type Props = {
  defaultValue: string
  provinces: { id: number; name: string }[]
  isAdmin: boolean
  defaultDateFrom: string
  defaultDateTo: string
  showSearch?: boolean
  showFilters?: boolean
}

function buildHref(pathname: string, params: URLSearchParams) {
  const qs = params.toString()
  return qs ? `${pathname}?${qs}` : pathname
}

export default function SearchInput({
  defaultValue,
  provinces,
  isAdmin,
  defaultDateFrom,
  defaultDateTo,
  showSearch = true,
  showFilters = true,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [value, setValue] = useState(defaultValue)
  const [isPending, startTransition] = useTransition()
  const [cities, setCities] = useState<{ id: string; name: string }[]>([])

  const currentProvinceId = searchParams.get('provinceId') ?? ''
  const currentCityId = searchParams.get('cityId') ?? ''
  const [filterProvinceId, setFilterProvinceId] = useState(currentProvinceId)
  const [filterCityId, setFilterCityId] = useState(currentCityId)
  const [filterDateFrom, setFilterDateFrom] = useState(searchParams.get('dateFrom') ?? defaultDateFrom)
  const [filterDateTo, setFilterDateTo] = useState(searchParams.get('dateTo') ?? defaultDateTo)

  useEffect(() => {
    setValue(defaultValue)
  }, [defaultValue])

  useEffect(() => {
    setFilterProvinceId(currentProvinceId)
    setFilterCityId(currentCityId)
    setFilterDateFrom(searchParams.get('dateFrom') ?? defaultDateFrom)
    setFilterDateTo(searchParams.get('dateTo') ?? defaultDateTo)
  }, [currentCityId, currentProvinceId, defaultDateFrom, defaultDateTo, searchParams])

  useEffect(() => {
    if (!isAdmin || !showFilters) return

    let cancelled = false

    async function loadCities() {
      if (!filterProvinceId) {
        if (!cancelled) setCities([])
        return
      }

      const nextCities = await getCities(filterProvinceId)
      if (!cancelled) setCities(nextCities)
    }

    void loadCities()

    return () => {
      cancelled = true
    }
  }, [filterProvinceId, isAdmin, showFilters])

  const updateParam = useCallback((key: string, nextValue: string) => {
    const params = new URLSearchParams(searchParams.toString())

    if (nextValue) params.set(key, nextValue)
    else params.delete(key)

    params.delete('page')

    startTransition(() => {
      router.push(buildHref(pathname, params))
    })
  }, [pathname, router, searchParams, startTransition])

  const applyFilters = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const params = new URLSearchParams(searchParams.toString())

    if (filterDateFrom) params.set('dateFrom', filterDateFrom)
    else params.delete('dateFrom')

    if (filterDateTo) params.set('dateTo', filterDateTo)
    else params.delete('dateTo')

    if (isAdmin && filterProvinceId) params.set('provinceId', filterProvinceId)
    else params.delete('provinceId')

    if (isAdmin && filterProvinceId && filterCityId) params.set('cityId', filterCityId)
    else params.delete('cityId')

    params.delete('page')

    startTransition(() => {
      router.push(buildHref(pathname, params))
    })
  }, [filterCityId, filterDateFrom, filterDateTo, filterProvinceId, isAdmin, pathname, router, searchParams, startTransition])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const currentSearch = searchParams.get('search') ?? ''
      if (value === currentSearch) return

      updateParam('search', value)
    }, 400) // Debounce 400ms

    return () => clearTimeout(timeoutId)
  }, [searchParams, updateParam, value])

  return (
    <>
      {showSearch && (
        <input
          type="search"
          placeholder="Cari nama atau email..."
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition focus:outline-none focus:ring-2 focus:ring-neutral-900 sm:max-w-xs dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:focus:ring-white"
        />
      )}
      {showFilters && (
        <form onSubmit={applyFilters} className="contents">
          {isAdmin && (
            <>
          <label className="flex w-full flex-col gap-1 sm:w-48">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">Provinsi</span>
            <select
              value={filterProvinceId}
              onChange={(e) => {
                setFilterProvinceId(e.target.value)
                setFilterCityId('')
              }}
              className="px-3.5 py-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white transition"
            >
              <option value="">Semua Provinsi</option>
              {provinces.map((province) => (
                <option key={province.id} value={province.id}>
                  {province.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex w-full flex-col gap-1 sm:w-48">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">Kota</span>
            <select
              value={filterCityId}
              disabled={!filterProvinceId}
              onChange={(e) => setFilterCityId(e.target.value)}
              className="px-3.5 py-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white transition disabled:opacity-50"
            >
              <option value="">Semua Kota</option>
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </select>
          </label>
            </>
          )}
          <label className="flex w-full flex-col gap-1 sm:w-40">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">Tanggal Awal</span>
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="px-3.5 py-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white transition"
            />
          </label>
          <label className="flex w-full flex-col gap-1 sm:w-40">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">Tanggal Akhir</span>
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="px-3.5 py-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white transition"
            />
          </label>
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
          >
            {isPending ? (
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-30" cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-90" fill="currentColor" d="M21 12a9 9 0 00-9-9v3a6 6 0 016 6h3z" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4.5h18M6.75 12h10.5M10.5 19.5h3" />
              </svg>
            )}
            {isPending ? 'Memuat...' : 'Filter'}
          </button>
        </form>
      )}
    </>
  )
}
