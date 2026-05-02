'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import type { FormEvent } from 'react'
import StatCards from '@/app/components/dashboard/StatCards'
import ProvinceDonutChart from '@/app/components/dashboard/ProvinceDonutChart'
import CityBarChart from '@/app/components/dashboard/CityBarChart'
import DailyPostsChart from '@/app/components/dashboard/DailyPostsChart'
import RequestLoadingOverlay from '@/app/components/RequestLoadingOverlay'
import type {
  PublicStatistikDashboardPayload,
  StatistikFilters,
} from '@/app/lib/statistik-data'

type Props = {
  initialCities: { id: string; name: string }[]
  initialFilters: StatistikFilters
  provinces: { id: number; name: string }[]
  accessId: string
}

type ApiPayload = PublicStatistikDashboardPayload & {
  cities: { id: string; name: string }[]
}

function addOneMonth(dateStr: string): string {
  const date = new Date(dateStr)
  date.setMonth(date.getMonth() + 1)
  return date.toISOString().slice(0, 10)
}

function buildApiUrl(accessId: string, filters: StatistikFilters) {
  const params = new URLSearchParams()
  params.set('id', accessId)
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
  if (filters.dateTo) params.set('dateTo', filters.dateTo)
  if (filters.status) params.set('status', filters.status)
  if (filters.provinceId) params.set('provinceId', filters.provinceId)
  if (filters.provinceId && filters.cityId) params.set('cityId', filters.cityId)
  return `/api/statistik?${params.toString()}`
}

function buildPageUrl(accessId: string, filters: StatistikFilters) {
  const params = new URLSearchParams()
  params.set('id', accessId)
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
  if (filters.dateTo) params.set('dateTo', filters.dateTo)
  if (filters.status) params.set('status', filters.status)
  if (filters.provinceId) params.set('provinceId', filters.provinceId)
  if (filters.provinceId && filters.cityId) params.set('cityId', filters.cityId)
  return `/statistik?${params.toString()}`
}

export default function StatistikDashboardClient({
  initialCities,
  initialFilters,
  provinces,
  accessId,
}: Props) {
  const [data, setData] = useState<PublicStatistikDashboardPayload | null>(null)
  const [cities, setCities] = useState(initialCities)
  const [filters, setFilters] = useState(initialFilters)
  const [dateFrom, setDateFrom] = useState(initialFilters.dateFrom ?? '')
  const [dateTo, setDateTo] = useState(initialFilters.dateTo ?? '')
  const [status, setStatus] = useState(initialFilters.status ?? '')
  const [provinceId, setProvinceId] = useState(initialFilters.provinceId ?? '')
  const [cityId, setCityId] = useState(initialFilters.cityId ?? '')
  const [rangeError, setRangeError] = useState('')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [themeMounted, setThemeMounted] = useState(false)
  const [isPending, startTransition] = useTransition()

  const loadData = useCallback(async (nextFilters: StatistikFilters, updateCities = true) => {
    const response = await fetch(buildApiUrl(accessId, nextFilters), { cache: 'no-store' })
    if (!response.ok) throw new Error('Gagal memuat statistik')
    const payload = await response.json() as ApiPayload
    setData({
      summary: payload.summary,
      provinceData: payload.provinceData,
      cityData: payload.cityData,
      dailyData: payload.dailyData,
    })
    if (updateCities) setCities(payload.cities)
    setLastUpdated(new Date())
  }, [accessId])

  useEffect(() => {
    void loadData(filters).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light')
      setThemeMounted(true)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadData(filters, false).catch(() => {})
    }, 30000)
    return () => window.clearInterval(interval)
  }, [filters, loadData])

  function applyTheme(nextTheme: 'light' | 'dark') {
    setTheme(nextTheme)
    localStorage.setItem('theme', nextTheme)
    document.documentElement.classList.toggle('dark', nextTheme === 'dark')
  }

  function handleDateFrom(value: string) {
    if (!value) return
    setRangeError('')
    const maxTo = addOneMonth(value)
    setDateFrom(value)
    setDateTo(dateTo > maxTo ? maxTo : dateTo < value ? value : dateTo)
  }

  function handleDateTo(value: string) {
    if (!value) return
    const maxTo = addOneMonth(dateFrom)
    if (value > maxTo) {
      setRangeError('Rentang maksimal 1 bulan. Tanggal akhir disesuaikan otomatis.')
      setDateTo(maxTo)
      return
    }
    if (value < dateFrom) {
      setRangeError('')
      setDateTo(dateFrom)
      return
    }
    setRangeError('')
    setDateTo(value)
  }

  function handleProvinceChange(value: string) {
    setProvinceId(value)
    setCityId('')
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextFilters: StatistikFilters = {
      dateFrom,
      dateTo,
      status: status === 'pending' || status === 'valid' || status === 'invalid' ? status : undefined,
      provinceId: provinceId || undefined,
      cityId: provinceId && cityId ? cityId : undefined,
    }
    setFilters(nextFilters)
    window.history.replaceState(null, '', buildPageUrl(accessId, nextFilters))
    startTransition(() => {
      void loadData(nextFilters).catch(() => {})
    })
  }

  const maxDateTo = useMemo(() => addOneMonth(dateFrom), [dateFrom])
  const today = new Date().toISOString().slice(0, 10)

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-5 sm:p-6">
      {isPending && (
        <RequestLoadingOverlay
          title="Memuat statistik..."
          description="Chart diperbarui tanpa me-reload halaman."
        />
      )}
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Statistik</h1>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Ringkasan data pelaporan
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            {themeMounted && (
              <button
                type="button"
                onClick={() => applyTheme(theme === 'dark' ? 'light' : 'dark')}
                aria-label={theme === 'dark' ? 'Aktifkan tema light' : 'Aktifkan tema dark'}
                title={theme === 'dark' ? 'Tema light' : 'Tema dark'}
                className="text-neutral-500 transition hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
              >
                {theme === 'dark' ? (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 3v1m0 16v1m8.66-9H21M3 12H2m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>
            )}
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Auto reload tiap 30 detik{lastUpdated ? ` • terakhir ${lastUpdated.toLocaleTimeString('id-ID')}` : ''}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <form onSubmit={applyFilters} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-neutral-500 dark:text-neutral-400">Tanggal Awal</span>
              <input
                type="date"
                value={dateFrom}
                max={today}
                onChange={(event) => handleDateFrom(event.target.value)}
                className="rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:focus:ring-white sm:w-44"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                Tanggal Akhir <span className="text-neutral-400 dark:text-neutral-500">(maks. 1 bulan)</span>
              </span>
              <input
                type="date"
                value={dateTo}
                min={dateFrom}
                max={maxDateTo}
                onChange={(event) => handleDateTo(event.target.value)}
                className={`rounded-lg border bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition focus:outline-none focus:ring-2 dark:bg-neutral-800 dark:text-white sm:w-44 ${
                  rangeError
                    ? 'border-amber-400 focus:ring-amber-400 dark:border-amber-500'
                    : 'border-neutral-300 focus:ring-neutral-900 dark:border-neutral-700 dark:focus:ring-white'
                }`}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-neutral-500 dark:text-neutral-400">Status</span>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:focus:ring-white sm:w-40"
              >
                <option value="">Semua Status</option>
                <option value="pending">Pending</option>
                <option value="valid">Valid</option>
                <option value="invalid">Invalid</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-neutral-500 dark:text-neutral-400">Propinsi</span>
              <select
                value={provinceId}
                onChange={(event) => handleProvinceChange(event.target.value)}
                className="rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:focus:ring-white sm:w-52"
              >
                <option value="">Semua Propinsi</option>
                {provinces.map((province) => (
                  <option key={province.id} value={province.id}>{province.name}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-neutral-500 dark:text-neutral-400">Kota</span>
              <select
                value={cityId}
                onChange={(event) => setCityId(event.target.value)}
                disabled={!provinceId}
                className="rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition focus:outline-none focus:ring-2 focus:ring-neutral-900 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:focus:ring-white sm:w-52"
              >
                <option value="">Semua Kota</option>
                {cities.map((city) => (
                  <option key={city.id} value={city.id}>{city.name}</option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              disabled={Boolean(rangeError) || isPending}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4.5h18M6.75 12h10.5M10.5 19.5h3" />
              </svg>
              Filter
            </button>
          </form>
          {rangeError && <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">{rangeError}</p>}
        </div>

        {data ? (
          <>
            <StatCards summary={data.summary} hideOperatorEmail hideOperatorContact />
            <ProvinceDonutChart data={data.provinceData} />
            <CityBarChart data={data.cityData} />
            <DailyPostsChart data={data.dailyData} />
          </>
        ) : (
          <div className="flex items-center justify-center py-20 text-sm text-neutral-500 dark:text-neutral-400">
            Memuat statistik...
          </div>
        )}
      </div>
    </main>
  )
}
