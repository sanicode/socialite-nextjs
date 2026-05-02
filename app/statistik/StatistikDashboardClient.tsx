'use client'

import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import StatCards from '@/app/components/dashboard/StatCards'
import ProvinceDonutChart from '@/app/components/dashboard/ProvinceDonutChart'
import CityBarChart from '@/app/components/dashboard/CityBarChart'
import DailyPostsChart from '@/app/components/dashboard/DailyPostsChart'
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
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')
  const [themeMounted, setThemeMounted] = useState(false)
  const [isFilterLoading, setIsFilterLoading] = useState(false)

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
      const storedTheme = localStorage.getItem('statistik-theme')
      if (storedTheme !== 'light' && storedTheme !== 'dark') {
        document.documentElement.classList.add('dark')
        document.documentElement.dataset.statistikTheme = 'dark'
      }
      setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light')
      setThemeMounted(true)
    }, 0)
    return () => {
      window.clearTimeout(timer)
      try {
        const root = document.documentElement
        const previousTheme = root.dataset.statistikPreviousTheme
        if (previousTheme === 'dark') {
          root.classList.add('dark')
        } else if (previousTheme === 'light') {
          root.classList.remove('dark')
        }
        delete root.dataset.statistikTheme
        delete root.dataset.statistikPreviousTheme
      } catch {}
    }
  }, [])

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadData(filters, false).catch(() => {})
    }, 30000)
    return () => window.clearInterval(interval)
  }, [filters, loadData])

  function applyTheme(nextTheme: 'light' | 'dark') {
    setTheme(nextTheme)
    localStorage.setItem('statistik-theme', nextTheme)
    document.documentElement.dataset.statistikTheme = nextTheme
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
    if (value === dateFrom) {
      setRangeError('')
      setDateTo(value)
      return
    }
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
    const safeDateTo = dateTo < dateFrom ? dateFrom : dateTo
    if (safeDateTo !== dateTo) {
      setRangeError('')
      setDateTo(safeDateTo)
    }
    const nextFilters: StatistikFilters = {
      dateFrom,
      dateTo: safeDateTo,
      status: status === 'pending' || status === 'valid' || status === 'invalid' ? status : undefined,
      provinceId: provinceId || undefined,
      cityId: provinceId && cityId ? cityId : undefined,
    }
    setFilters(nextFilters)
    window.history.replaceState(null, '', buildPageUrl(accessId, nextFilters))
    setIsFilterLoading(true)
    void loadData(nextFilters)
      .catch(() => {})
      .finally(() => setIsFilterLoading(false))
  }

  const isDarkTheme = theme === 'dark'

  return (
    <main
      className={`statistik-main min-h-screen px-4 py-6 sm:px-6 sm:py-8 ${isDarkTheme ? 'statistik-dark' : 'statistik-light'}`}
      style={{
        background: isDarkTheme
          ? 'linear-gradient(180deg, #13262d 0%, #0f1d23 100%)'
          : 'linear-gradient(180deg, #f4f7f8 0%, #e8f0f1 100%)',
        color: isDarkTheme ? '#f8fafc' : '#263b43',
        padding: '32px 24px',
        paddingTop: '40px',
      }}
    >
      <div className="mx-auto max-w-7xl space-y-5">

        {/* Header */}
        <div
          className="statistik-header overflow-hidden rounded-2xl shadow-lg"
          style={{
            background: isDarkTheme
              ? 'linear-gradient(135deg, #18323a 0%, #102129 100%)'
              : 'linear-gradient(135deg, #ffffff 0%, #e7f0f2 100%)',
            borderColor: isDarkTheme ? '#28434b' : '#c7d8dc',
            borderTop: `3px solid ${isDarkTheme ? '#f08a3d' : '#e8782d'}`,
            color: isDarkTheme ? '#f8fafc' : '#263b43',
            marginTop: '4px',
            position: 'relative',
          }}
        >
          <span
            aria-hidden="true"
            style={{
              backgroundColor: isDarkTheme ? '#f08a3d' : '#e8782d',
              display: 'block',
              height: '3px',
              left: 0,
              position: 'absolute',
              right: 0,
              top: 0,
              zIndex: 2,
            }}
          />
          <div
            className="statistik-header-inner"
            style={{
              padding: '24px 32px',
              position: 'relative',
              zIndex: 1,
            }}
          >
            <div
              className="statistik-header-row"
              style={{
                alignItems: 'center',
                display: 'grid',
                gap: '24px',
                gridTemplateColumns: 'minmax(0, 1fr) max-content',
                justifyContent: 'stretch',
              }}
            >
              <div
                className="statistik-header-copy"
                style={{ minWidth: 0 }}
              >
                <p
                  className="statistik-header-label text-xs font-bold uppercase tracking-widest"
                  style={{
                    color: isDarkTheme ? '#f08a3d' : '#e8782d',
                    lineHeight: 1,
                    margin: 0,
                  }}
                >
                  Dashboard Publik
                </p>
                <h1
                  className="statistik-header-title mt-1.5 text-2xl font-bold tracking-tight"
                  style={{
                    color: isDarkTheme ? '#f8fafc' : '#263b43',
                    lineHeight: 1.15,
                  }}
                >
                  Statistik Pelaporan
                </h1>
                <p
                  className="statistik-header-text mt-1 text-sm"
                  style={{
                    color: isDarkTheme ? '#b7c8cd' : '#6d858c',
                    lineHeight: 1.5,
                  }}
                >
                  Ringkasan data pelaporan operator aktif
                </p>
              </div>
              <div
                className="statistik-header-actions"
                style={{
                  alignItems: 'center',
                  alignSelf: 'center',
                  display: 'inline-grid',
                  gap: '10px',
                  gridAutoColumns: 'max-content',
                  gridAutoFlow: 'column',
                  justifyContent: 'end',
                  justifySelf: 'end',
                  textAlign: 'right',
                  whiteSpace: 'nowrap',
                  width: 'max-content',
                }}
              >
                {themeMounted && (
                  <button
                    type="button"
                    onClick={() => applyTheme(theme === 'dark' ? 'light' : 'dark')}
                    aria-label={theme === 'dark' ? 'Aktifkan tema terang' : 'Aktifkan tema gelap'}
                    title={theme === 'dark' ? 'Tema terang' : 'Tema gelap'}
                    className="statistik-theme-button transition"
                    style={{
                      alignItems: 'center',
                      backgroundColor: 'transparent',
                      border: 0,
                      color: isDarkTheme ? '#b7c8cd' : '#6d858c',
                      display: 'inline-flex',
                      height: '24px',
                      justifyContent: 'center',
                      padding: 0,
                      width: '24px',
                    }}
                  >
                    {theme === 'dark' ? (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ display: 'block', height: '20px', width: '20px' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 3v1m0 16v1m8.66-9H21M3 12H2m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ display: 'block', height: '20px', width: '20px' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                      </svg>
                    )}
                  </button>
                )}
                <p
                  className="statistik-header-text statistik-header-refresh text-xs"
                  style={{
                    color: isDarkTheme ? '#b7c8cd' : '#6d858c',
                    lineHeight: 1.2,
                    margin: 0,
                    whiteSpace: 'nowrap',
                  }}
                >
                  Auto-refresh 30 detik{lastUpdated ? ` · ${lastUpdated.toLocaleTimeString('id-ID')}` : ''}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filter */}
        <div
          className="statistik-filter-panel rounded-2xl border px-5 py-4 shadow-sm"
          style={{
            background: isDarkTheme
              ? 'linear-gradient(135deg, #18323a 0%, #102129 100%)'
              : 'linear-gradient(135deg, #ffffff 0%, #edf4f5 100%)',
            borderColor: isDarkTheme ? '#28434b' : '#c7d8dc',
          }}
        >
          <p className="mb-3.5 text-xs font-semibold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
            Filter
          </p>
          <form noValidate onSubmit={applyFilters} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-neutral-500 dark:text-neutral-400">Tanggal Awal</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(event) => handleDateFrom(event.target.value)}
                className="rounded-lg border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-sm text-neutral-900 transition focus:border-[#e8782d] focus:outline-none focus:ring-2 focus:ring-[#f7d6bf] dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:focus:border-[#f08a3d] dark:focus:ring-[#5c2f1d] sm:w-44"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                Tanggal Akhir <span className="text-neutral-400 dark:text-neutral-500">(maks. 1 bulan)</span>
              </span>
              <input
                type="date"
                value={dateTo}
                onChange={(event) => handleDateTo(event.target.value)}
                className={`rounded-lg border bg-neutral-50 px-3.5 py-2.5 text-sm text-neutral-900 transition focus:outline-none focus:ring-2 dark:bg-neutral-800 dark:text-white sm:w-44 ${
                  rangeError
                    ? 'border-amber-400 focus:ring-amber-200 dark:border-amber-500 dark:focus:ring-amber-900'
                    : 'border-neutral-200 focus:border-[#e8782d] focus:ring-[#f7d6bf] dark:border-neutral-700 dark:focus:border-[#f08a3d] dark:focus:ring-[#5c2f1d]'
                }`}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-neutral-500 dark:text-neutral-400">Status</span>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="rounded-lg border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-sm text-neutral-900 transition focus:border-[#e8782d] focus:outline-none focus:ring-2 focus:ring-[#f7d6bf] dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:focus:border-[#f08a3d] dark:focus:ring-[#5c2f1d] sm:w-40"
              >
                <option value="">Semua Status</option>
                <option value="pending">Pending</option>
                <option value="valid">Valid</option>
                <option value="invalid">Invalid</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-neutral-500 dark:text-neutral-400">Provinsi</span>
              <select
                value={provinceId}
                onChange={(event) => handleProvinceChange(event.target.value)}
                className="rounded-lg border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-sm text-neutral-900 transition focus:border-[#e8782d] focus:outline-none focus:ring-2 focus:ring-[#f7d6bf] dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:focus:border-[#f08a3d] dark:focus:ring-[#5c2f1d] sm:w-52"
              >
                <option value="">Semua Provinsi</option>
                {provinces.map((province) => (
                  <option key={province.id} value={province.id}>{province.name}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-neutral-500 dark:text-neutral-400">Kota / Kabupaten</span>
              <select
                value={cityId}
                onChange={(event) => setCityId(event.target.value)}
                disabled={!provinceId}
                className="rounded-lg border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-sm text-neutral-900 transition focus:border-[#e8782d] focus:outline-none focus:ring-2 focus:ring-[#f7d6bf] disabled:opacity-40 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:focus:border-[#f08a3d] dark:focus:ring-[#5c2f1d] sm:w-52"
              >
                <option value="">Semua Kota</option>
                {cities.map((city) => (
                  <option key={city.id} value={city.id}>{city.name}</option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              disabled={Boolean(rangeError) || isFilterLoading}
              className="statistik-filter-button inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                backgroundColor: isDarkTheme ? '#f08a3d' : '#e8782d',
                border: 0,
                color: '#ffffff',
              }}
            >
              {isFilterLoading ? (
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-30" cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-90" fill="currentColor" d="M21 12a9 9 0 00-9-9v3a6 6 0 016 6h3z" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4.5h18M6.75 12h10.5M10.5 19.5h3" />
                </svg>
              )}
              {isFilterLoading ? 'Memuat' : 'Filter'}
            </button>
          </form>
          {rangeError && (
            <p className="mt-2.5 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
              <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              {rangeError}
            </p>
          )}
        </div>

        {/* Data / Skeleton */}
        {data ? (
          <>
            <StatCards summary={data.summary} hideOperatorEmail hideOperatorContact palette="statistik" theme={theme} />
            <ProvinceDonutChart data={data.provinceData} variant="statistik" theme={theme} />
            <CityBarChart data={data.cityData} variant="statistik" theme={theme} />
            <DailyPostsChart data={data.dailyData} variant="statistik" theme={theme} />
          </>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="statistik-skeleton h-28 animate-pulse rounded-2xl bg-neutral-200 dark:bg-neutral-800" />
              ))}
            </div>
            <div className="statistik-skeleton h-72 animate-pulse rounded-2xl bg-neutral-200 dark:bg-neutral-800" />
            <div className="statistik-skeleton h-80 animate-pulse rounded-2xl bg-neutral-200 dark:bg-neutral-800" />
            <div className="statistik-skeleton h-60 animate-pulse rounded-2xl bg-neutral-200 dark:bg-neutral-800" />
          </div>
        )}

      </div>
    </main>
  )
}
