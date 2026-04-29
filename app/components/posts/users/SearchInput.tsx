"use client"

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState, useTransition } from 'react'
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
  const [, startTransition] = useTransition()
  const [cities, setCities] = useState<{ id: string; name: string }[]>([])

  const currentProvinceId = searchParams.get('provinceId') ?? ''
  const currentCityId = searchParams.get('cityId') ?? ''

  useEffect(() => {
    setValue(defaultValue)
  }, [defaultValue])

  useEffect(() => {
    if (!isAdmin || !showFilters) return

    let cancelled = false

    async function loadCities() {
      if (!currentProvinceId) {
        if (!cancelled) setCities([])
        return
      }

      const nextCities = await getCities(currentProvinceId)
      if (!cancelled) setCities(nextCities)
    }

    void loadCities()

    return () => {
      cancelled = true
    }
  }, [currentProvinceId, isAdmin, showFilters])

  const updateParam = useCallback((key: string, nextValue: string) => {
    const params = new URLSearchParams(searchParams.toString())

    if (nextValue) params.set(key, nextValue)
    else params.delete(key)

    params.delete('page')

    startTransition(() => {
      router.push(buildHref(pathname, params))
    })
  }, [pathname, router, searchParams, startTransition])

  const handleProvinceChange = useCallback((provinceId: string) => {
    const params = new URLSearchParams(searchParams.toString())

    if (provinceId) params.set('provinceId', provinceId)
    else params.delete('provinceId')

    params.delete('cityId')
    params.delete('page')

    startTransition(() => {
      router.push(buildHref(pathname, params))
    })
  }, [pathname, router, searchParams, startTransition])

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
      {showFilters && isAdmin && (
        <>
          <label className="flex w-full flex-col gap-1 sm:w-48">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">Provinsi</span>
            <select
              value={currentProvinceId}
              onChange={(e) => handleProvinceChange(e.target.value)}
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
              value={currentCityId}
              disabled={!currentProvinceId}
              onChange={(e) => updateParam('cityId', e.target.value)}
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
      {showFilters && (
        <>
          <label className="flex w-full flex-col gap-1 sm:w-40">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">Tanggal Awal</span>
            <input
              type="date"
              defaultValue={searchParams.get('dateFrom') ?? defaultDateFrom}
              onChange={(e) => updateParam('dateFrom', e.target.value)}
              className="px-3.5 py-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white transition"
            />
          </label>
          <label className="flex w-full flex-col gap-1 sm:w-40">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">Tanggal Akhir</span>
            <input
              type="date"
              defaultValue={searchParams.get('dateTo') ?? defaultDateTo}
              onChange={(e) => updateParam('dateTo', e.target.value)}
              className="px-3.5 py-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white transition"
            />
          </label>
        </>
      )}
    </>
  )
}
