'use client'

import { useCallback, useEffect, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import StatCards from '@/app/components/dashboard/StatCards'
import ProvinceDonutChart from '@/app/components/dashboard/ProvinceDonutChart'
import CityBarChart from '@/app/components/dashboard/CityBarChart'
import type {
  PublicStatistikDashboardPayload,
  StatistikFilters,
} from '@/app/lib/statistik-data'

type Props = {
  initialCities: { id: string; name: string }[]
  initialFilters: StatistikFilters
  provinces: { id: number; name: string }[]
  accessId: string
  statistikToken: string
}

type ApiPayload = PublicStatistikDashboardPayload & {
  cities: { id: string; name: string }[]
}

type StatistikStyle = CSSProperties & Record<`--${string}`, string | number>

const statistikWrapStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 18,
  margin: '0 auto',
  maxWidth: 1180,
  width: '100%',
}

const statistikTopbarLightStyle: StatistikStyle = {
  '--stat-topbar-glow': 'radial-gradient(650px 240px at 100% 0%, rgba(232, 116, 44, 0.13), transparent 62%), radial-gradient(520px 220px at 78% 100%, rgba(14, 138, 125, 0.1), transparent 68%)',
  '--stat-topbar-control-bg': 'rgba(22, 32, 46, 0.045)',
  '--stat-topbar-control-border': 'rgba(22, 32, 46, 0.1)',
  '--stat-topbar-control-color': '#4d5b6e',
  '--stat-topbar-control-hover': '#16202e',
  background: 'linear-gradient(135deg, #ffffff, #f4f8fb)',
  border: '1px solid #e0e7ef',
  color: '#16202e',
}

const statistikTopbarDarkStyle: StatistikStyle = {
  '--stat-topbar-glow': 'radial-gradient(600px 220px at 100% 0%, rgba(232, 116, 44, 0.28), transparent 60%)',
  '--stat-topbar-control-bg': 'rgba(255, 255, 255, 0.07)',
  '--stat-topbar-control-border': 'rgba(255, 255, 255, 0.1)',
  '--stat-topbar-control-color': '#c4cdd8',
  '--stat-topbar-control-hover': '#ffffff',
  background: 'linear-gradient(135deg, #16202e, #1f2c3e)',
  border: '1px solid rgba(255, 255, 255, 0.06)',
  color: '#ffffff',
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
  statistikToken,
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
  const [isFilterExpanded, setIsFilterExpanded] = useState(false)

  const loadData = useCallback(async (nextFilters: StatistikFilters, updateCities = true) => {
    const response = await fetch(buildApiUrl(accessId, nextFilters), {
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${statistikToken}`,
      },
    })
    if (response.status === 401) {
      window.location.reload()
      return
    }
    if (!response.ok) throw new Error('Gagal memuat statistik')
    const payload = await response.json() as ApiPayload
    setData({
      summary: payload.summary,
      provinceData: payload.provinceData,
      cityData: payload.cityData,
    })
    if (updateCities) setCities(payload.cities)
    setLastUpdated(new Date())
  }, [accessId, statistikToken])

  useEffect(() => {
    void loadData(filters).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const root = document.documentElement
      if (!root.dataset.statistikPreviousTheme) {
        root.dataset.statistikPreviousTheme = root.classList.contains('dark') ? 'dark' : 'light'
      }
      const storedTheme = localStorage.getItem('statistik-theme')
      const nextTheme = storedTheme === 'light' || storedTheme === 'dark' ? storedTheme : 'dark'
      if (storedTheme !== nextTheme) localStorage.setItem('statistik-theme', nextTheme)
      root.dataset.statistikTheme = nextTheme
      root.classList.toggle('dark', nextTheme === 'dark')
      setTheme(nextTheme)
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
  const topbarStyle = isDarkTheme ? statistikTopbarDarkStyle : statistikTopbarLightStyle
  const topbarMutedColor = isDarkTheme ? '#aeb9c6' : '#637184'
  const topbarControlStyle: CSSProperties = isDarkTheme
    ? {
        background: 'rgba(255, 255, 255, 0.07)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        color: '#c4cdd8',
      }
    : {
        background: 'rgba(22, 32, 46, 0.045)',
        borderColor: 'rgba(22, 32, 46, 0.1)',
        color: '#4d5b6e',
      }

  return (
    <main className={`statistik-main ${isDarkTheme ? 'statistik-dark' : 'statistik-light'}`}>
      <div className="statistik-wrap" style={statistikWrapStyle}>
        <header className="statistik-topbar statistik-anim" style={{ ...topbarStyle, animationDelay: '.02s' }}>
          <div className="statistik-topbar-inner">
            <div>
              <div className="statistik-eyebrow">Dashboard Publik</div>
              <h1>Statistik Pelaporan</h1>
              <p style={{ color: topbarMutedColor }}>Ringkasan performa pelaporan operator aktif</p>
            </div>
            <div className="statistik-header-actions">
              {themeMounted && (
                <button
                  type="button"
                  onClick={() => applyTheme(theme === 'dark' ? 'light' : 'dark')}
                  aria-label={theme === 'dark' ? 'Aktifkan tema terang' : 'Aktifkan tema gelap'}
                  title={theme === 'dark' ? 'Tema terang' : 'Tema gelap'}
                  className="statistik-theme-button"
                  style={topbarControlStyle}
                >
                  {theme === 'dark' ? (
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 3v1m0 16v1m8.66-9H21M3 12H2m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  ) : (
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                  )}
                </button>
              )}
              <div className="statistik-live" style={topbarControlStyle}>
                <span className="statistik-dot" />
                Auto-refresh 30 detik{lastUpdated ? ` · ${lastUpdated.toLocaleTimeString('id-ID')}` : ''}
              </div>
            </div>
          </div>
        </header>

        <section className="statistik-filter-panel statistik-anim" style={{ animationDelay: '.06s' }}>
          <div className="statistik-filter-heading">
            <span className="statistik-filter-heading-label">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M22 3H2l8 9.46V19l4 2v-8.54z" />
              </svg>
              Filter
            </span>
            <button
              type="button"
              onClick={() => setIsFilterExpanded((expanded) => !expanded)}
              className={`statistik-filter-toggle ${isFilterExpanded ? 'is-open' : ''}`}
              aria-expanded={isFilterExpanded}
              aria-controls="statistik-filter-form"
              aria-label={isFilterExpanded ? 'Sembunyikan filter' : 'Tampilkan filter'}
            >
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 9l6 6 6-6" />
              </svg>
            </button>
          </div>
          <div id="statistik-filter-form" className={`statistik-filter-body ${isFilterExpanded ? 'is-open' : ''}`}>
            <form noValidate onSubmit={applyFilters} className="statistik-filter-grid">
              <label className="statistik-field">
                <span>Tanggal Awal</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(event) => handleDateFrom(event.target.value)}
                />
              </label>
              <label className="statistik-field">
                <span>Tanggal Akhir (maks. 1 bulan)</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(event) => handleDateTo(event.target.value)}
                  className={rangeError ? 'is-error' : undefined}
                />
              </label>
              <label className="statistik-field">
                <span>Status</span>
                <select value={status} onChange={(event) => setStatus(event.target.value)}>
                  <option value="">Semua Status</option>
                  <option value="pending">Pending</option>
                  <option value="valid">Valid</option>
                  <option value="invalid">Invalid</option>
                </select>
              </label>
              <label className="statistik-field">
                <span>Provinsi</span>
                <select value={provinceId} onChange={(event) => handleProvinceChange(event.target.value)}>
                  <option value="">Semua Provinsi</option>
                  {provinces.map((province) => (
                    <option key={province.id} value={province.id}>{province.name}</option>
                  ))}
                </select>
              </label>
              <label className="statistik-field">
                <span>Kota / Kabupaten</span>
                <select
                  value={cityId}
                  onChange={(event) => setCityId(event.target.value)}
                  disabled={!provinceId}
                >
                  <option value="">Semua Kota</option>
                  {cities.map((city) => (
                    <option key={city.id} value={city.id}>{city.name}</option>
                  ))}
                </select>
              </label>
              <button type="submit" disabled={Boolean(rangeError) || isFilterLoading} className="statistik-filter-button">
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
                {isFilterLoading ? 'Memproses...' : 'Filter'}
              </button>
            </form>
            {rangeError && (
              <p className="statistik-range-error">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                {rangeError}
              </p>
            )}
          </div>
        </section>

        {data ? (
          <>
            <StatCards
              summary={data.summary}
              hideOperatorEmail
              hideOperatorContact
              palette="statistik"
              theme={theme}
              reportedStatus={filters.status ?? ''}
            />
            <ProvinceDonutChart
              cityGroups={data.cityData}
              data={data.provinceData}
              summary={data.summary}
              variant="statistik"
              theme={theme}
            />
            <CityBarChart data={data.cityData} variant="statistik" theme={theme} />
          </>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="statistik-skeleton h-28 animate-pulse rounded-2xl" />
              ))}
            </div>
            <div className="statistik-skeleton h-72 animate-pulse rounded-2xl" />
            <div className="statistik-skeleton h-80 animate-pulse rounded-2xl" />
          </div>
        )}
      </div>
    </main>
  )
}
