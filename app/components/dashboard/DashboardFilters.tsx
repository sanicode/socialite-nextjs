'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect, useTransition } from 'react'
import { getCities } from '@/app/actions/dashboard'
import RequestLoadingOverlay from '@/app/components/RequestLoadingOverlay'

type Props = {
  provinces: { id: number; name: string }[]
  isAdmin: boolean
  defaultDateFrom: string
  defaultDateTo: string
}

function addOneMonth(dateStr: string): string {
  const d = new Date(dateStr)
  d.setMonth(d.getMonth() + 1)
  return d.toISOString().slice(0, 10)
}

export default function DashboardFilters({ provinces, isAdmin, defaultDateFrom, defaultDateTo }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const [cities, setCities] = useState<{ id: string; name: string }[]>([])
  const [dateFrom, setDateFrom] = useState(defaultDateFrom)
  const [dateTo, setDateTo] = useState(defaultDateTo)
  const [rangeError, setRangeError] = useState('')

  const currentProvinceId = searchParams.get('provinceId') ?? ''
  const currentCityId = searchParams.get('cityId') ?? ''

  useEffect(() => {
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
  }, [currentProvinceId])

  function applyDates(from: string, to: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('dateFrom', from)
    params.set('dateTo', to)
    startTransition(() => {
      router.push(`/dashboard?${params.toString()}`)
    })
  }

  function handleDateFrom(val: string) {
    if (!val) return
    setRangeError('')
    const maxTo = addOneMonth(val)
    // If current dateTo exceeds new max, clamp it
    const newTo = dateTo > maxTo ? maxTo : dateTo < val ? val : dateTo
    setDateFrom(val)
    setDateTo(newTo)
    applyDates(val, newTo)
  }

  function handleDateTo(val: string) {
    if (!val) return
    const maxTo = addOneMonth(dateFrom)
    if (val > maxTo) {
      setRangeError('Rentang maksimal 1 bulan. Tanggal akhir disesuaikan otomatis.')
      setDateTo(maxTo)
      applyDates(dateFrom, maxTo)
      return
    }
    if (val < dateFrom) {
      setRangeError('')
      setDateTo(dateFrom)
      applyDates(dateFrom, dateFrom)
      return
    }
    setRangeError('')
    setDateTo(val)
    applyDates(dateFrom, val)
  }

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    if (key === 'provinceId') params.delete('cityId')
    startTransition(() => {
      router.push(`/dashboard?${params.toString()}`)
    })
  }

  const maxDateTo = addOneMonth(dateFrom)
  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="space-y-1.5">
      {isPending && (
        <RequestLoadingOverlay
          title="Memuat dashboard..."
          description="Filter sedang diterapkan. Data akan diperbarui sebentar lagi."
        />
      )}

      <div className="flex flex-col sm:flex-row sm:items-end gap-3 flex-wrap">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-500 dark:text-neutral-400">Tanggal Awal</span>
          <input
            type="date"
            value={dateFrom}
            max={today}
            disabled={isPending}
            onChange={(e) => handleDateFrom(e.target.value)}
            className="sm:w-44 px-3.5 py-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white transition"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            Tanggal Akhir
            <span className="ml-1 text-neutral-400 dark:text-neutral-500">(maks. 1 bulan)</span>
          </span>
          <input
            type="date"
            value={dateTo}
            min={dateFrom}
            max={maxDateTo}
            disabled={isPending}
            onChange={(e) => handleDateTo(e.target.value)}
            className={`sm:w-44 px-3.5 py-2.5 rounded-lg border bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm focus:outline-none focus:ring-2 transition ${
              rangeError
                ? 'border-amber-400 dark:border-amber-500 focus:ring-amber-400'
                : 'border-neutral-300 dark:border-neutral-700 focus:ring-neutral-900 dark:focus:ring-white'
            }`}
          />
        </label>
        {isAdmin && (
          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">Propinsi</span>
            <select
              value={currentProvinceId}
              disabled={isPending}
              onChange={(e) => updateParam('provinceId', e.target.value)}
              className="sm:w-52 px-3.5 py-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white transition"
            >
              <option value="">Semua Propinsi</option>
              {provinces.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {isAdmin && (
          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">Kota</span>
            <select
              value={currentCityId}
              onChange={(e) => updateParam('cityId', e.target.value)}
              disabled={!currentProvinceId || isPending}
              className="sm:w-52 px-3.5 py-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white transition disabled:opacity-50"
            >
              <option value="">Semua Kota</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {rangeError && (
        <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          {rangeError}
        </p>
      )}
    </div>
  )
}
