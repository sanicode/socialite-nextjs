import { Fragment } from 'react'
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/app/lib/session'
import { prisma } from '@/app/lib/prisma'
import SummaryLineChart from '@/app/components/summary/SummaryLineChart'
import SummaryPdfButton from '@/app/components/summary/SummaryPdfButton'
import SummaryExcelButton from '@/app/components/summary/SummaryExcelButton'

type Props = {
  searchParams: Promise<{ month?: string }>
}

type QuotaRow = {
  propinsi: string | null
  kota: string | null
  kuota: bigint | number | null
}

type DailyRow = {
  propinsi: string | null
  kota: string | null
  date: string
  total: bigint | number
}

type CitySummary = {
  province: string
  city: string
  quota: number
  counts: Record<string, number>
}

const PROVINCE_LABELS: Record<string, string> = {
  'JAWA BARAT': 'JABAR',
  'JAWA TENGAH': 'JATENG',
  'JAWA TIMUR': 'JATIM',
}

const PROVINCE_COLORS = ['#3b82f6', '#ef4444', '#f5b400', '#10b981', '#8b5cf6', '#06b6d4']

function getJakartaMonthString(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
  }).format(date)
}

function normalizeMonth(value: string | undefined) {
  return value && /^\d{4}-\d{2}$/.test(value) ? value : getJakartaMonthString()
}

function getMonthDates(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  const daysInMonth = new Date(year, monthNumber, 0).getDate()

  return Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1
    return `${month}-${String(day).padStart(2, '0')}`
  })
}

function formatMonthLabel(month: string) {
  return new Intl.DateTimeFormat('id-ID', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(`${month}-01T00:00:00+07:00`))
}

function normalizeName(value: string | null | undefined) {
  return value?.trim() || '-'
}

function cityKey(province: string, city: string) {
  return `${province}|||${city}`
}

function getDailyCellClass(count: number, quota: number) {
  if (count <= 0) return 'bg-white text-neutral-400 dark:bg-neutral-950 dark:text-neutral-600'
  if (quota <= 0) return 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'

  const ratio = count / quota
  if (ratio >= 1) return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
  if (ratio >= 0.8) return 'bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-200'
  if (ratio >= 0.5) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
  return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
}

export default async function SummaryPage({ searchParams }: Props) {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  if (!user.roles.includes('admin')) redirect('/posts')

  const params = await searchParams
  const month = normalizeMonth(params.month)
  const dates = getMonthDates(month)
  const startDate = dates[0]
  const endDate = dates[dates.length - 1]
  const monthLabel = formatMonthLabel(month)

  const [quotaRows, dailyRows] = await Promise.all([
    prisma.$queryRaw<QuotaRow[]>`
      SELECT
        propinsi,
        kota,
        COALESCE(SUM(jumlah), 0)::bigint AS kuota
      FROM v_kuota_per_kota
      GROUP BY propinsi, kota
      ORDER BY propinsi ASC, kota ASC
    `,
    prisma.$queryRaw<DailyRow[]>`
      SELECT
        propinsi,
        kabupaten_kota AS kota,
        to_char(tanggal_pelaporan, 'YYYY-MM-DD') AS date,
        COUNT(*)::bigint AS total
      FROM v_rekapitulasi_pelaporan
      WHERE tanggal_pelaporan >= CAST(${startDate} AS date)
        AND tanggal_pelaporan <= CAST(${endDate} AS date)
      GROUP BY propinsi, kabupaten_kota, tanggal_pelaporan
      ORDER BY propinsi ASC, kabupaten_kota ASC, tanggal_pelaporan ASC
    `,
  ])

  const summariesByCity = new Map<string, CitySummary>()

  for (const row of quotaRows) {
    const province = normalizeName(row.propinsi)
    const city = normalizeName(row.kota)
    summariesByCity.set(cityKey(province, city), {
      province,
      city,
      quota: Number(row.kuota ?? 0),
      counts: {},
    })
  }

  for (const row of dailyRows) {
    const province = normalizeName(row.propinsi)
    const city = normalizeName(row.kota)
    const key = cityKey(province, city)
    const summary = summariesByCity.get(key) ?? {
      province,
      city,
      quota: 0,
      counts: {},
    }
    summary.counts[row.date] = Number(row.total ?? 0)
    summariesByCity.set(key, summary)
  }

  const cityRows = Array.from(summariesByCity.values()).sort((a, b) => (
    a.province.localeCompare(b.province, 'id') || a.city.localeCompare(b.city, 'id')
  ))

  const provinceNames = Array.from(new Set(cityRows.map((row) => row.province))).sort((a, b) => a.localeCompare(b, 'id'))
  const rowsByProvince = new Map(
    provinceNames.map((province) => [province, cityRows.filter((row) => row.province === province)])
  )

  const totalQuota = cityRows.reduce((sum, row) => sum + row.quota, 0)
  const dailyTotals = Object.fromEntries(
    dates.map((date) => [date, cityRows.reduce((sum, row) => sum + (row.counts[date] ?? 0), 0)])
  )
  const monthTotal = Object.values(dailyTotals).reduce((sum, value) => sum + value, 0)
  const activeDays = Object.values(dailyTotals).filter((value) => value > 0).length
  const averageDaily = activeDays > 0 ? Math.round(monthTotal / activeDays) : 0

  const provinceTotals = provinceNames.map((province) => {
    const rows = rowsByProvince.get(province) ?? []
    return {
      province,
      label: PROVINCE_LABELS[province.toUpperCase()] ?? province,
      quota: rows.reduce((sum, row) => sum + row.quota, 0),
      counts: Object.fromEntries(
        dates.map((date) => [date, rows.reduce((sum, row) => sum + (row.counts[date] ?? 0), 0)])
      ) as Record<string, number>,
    }
  })
  const chartSeries = provinceTotals.map((row, index) => ({
    key: row.label,
    label: row.label,
    color: PROVINCE_COLORS[index % PROVINCE_COLORS.length],
  }))
  const chartData = [
    Object.fromEntries([
      ['label', 'KUOTA'],
      ...provinceTotals.map((row) => [row.label, row.quota]),
    ]),
    ...dates.map((date) => Object.fromEntries([
      ['label', `${Number(date.slice(-2))}-${new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(`${date}T00:00:00+07:00`))}`],
      ...provinceTotals.map((row) => [row.label, row.counts[date] ?? 0]),
    ])),
  ]

  return (
    <div className="summary-page min-h-screen bg-[var(--background)] px-4 py-5 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Summary</p>
            <h1 className="mt-1 text-2xl font-bold text-neutral-900 dark:text-white">
              Rekap Data {monthLabel}
            </h1>
            <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
              Rekap harian data masuk per wilayah, mengikuti format REKAP HARIAN.
            </p>
          </div>

          <form className="summary-no-print flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-neutral-500 dark:text-neutral-400">Bulan</span>
              <input
                type="month"
                name="month"
                defaultValue={month}
                className="rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:focus:ring-white"
              />
            </label>
            <button
              type="submit"
              className="rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
            >
              Tampilkan
            </button>
            <SummaryPdfButton filename={`summary-${month}`} />
            <SummaryExcelButton
              month={month}
              monthLabel={monthLabel}
              dates={dates}
              cityRows={cityRows}
              provinceTotals={provinceTotals}
              dailyTotals={dailyTotals}
              totalQuota={totalQuota}
            />
          </form>
        </div>

        <div className="summary-no-export grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-400">Total Kuota</p>
            <p className="mt-3 text-3xl font-bold text-neutral-900 dark:text-white">{totalQuota.toLocaleString('id-ID')}</p>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-400">Total Data Masuk</p>
            <p className="mt-3 text-3xl font-bold text-neutral-900 dark:text-white">{monthTotal.toLocaleString('id-ID')}</p>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-400">Rata-rata Harian</p>
            <p className="mt-3 text-3xl font-bold text-neutral-900 dark:text-white">{averageDaily.toLocaleString('id-ID')}</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
          <div className="border-b border-neutral-200 px-5 py-4 text-center dark:border-neutral-800">
            <h2 className="text-base font-bold uppercase tracking-wide text-neutral-900 dark:text-white">
              Rekap Data {monthLabel}
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1280px] border-collapse text-xs">
              <thead>
                <tr>
                  <th colSpan={2} className="border border-neutral-300 bg-neutral-100 px-3 py-2 text-center font-bold text-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white">
                    WILAYAH
                  </th>
                  <th rowSpan={2} className="border border-neutral-300 bg-neutral-100 px-3 py-2 text-center font-bold text-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white">
                    JUMLAH KUOTA
                  </th>
                  <th colSpan={dates.length} className="border border-neutral-300 bg-neutral-100 px-3 py-2 text-center font-bold text-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white">
                    DATA MASUK
                  </th>
                </tr>
                <tr>
                  <th className="w-12 border border-neutral-300 bg-neutral-50 px-2 py-2 text-center font-semibold text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800/70 dark:text-neutral-200">NO</th>
                  <th className="w-56 border border-neutral-300 bg-neutral-50 px-3 py-2 text-left font-semibold text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800/70 dark:text-neutral-200">KABUPATEN / KOTA</th>
                  {dates.map((date) => (
                    <th key={date} className="border border-neutral-300 bg-neutral-50 px-2 py-2 text-center font-semibold text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800/70 dark:text-neutral-200">
                      {Number(date.slice(-2))}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {provinceNames.map((province) => {
                  const rows = rowsByProvince.get(province) ?? []
                  return (
                    <Fragment key={province}>
                      <tr>
                        <td colSpan={dates.length + 3} className="border border-neutral-300 bg-neutral-200 px-3 py-2 font-bold uppercase text-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white">
                          {province}
                        </td>
                      </tr>
                      {rows.map((row, index) => (
                        <tr key={`${row.province}-${row.city}`}>
                          <td className="border border-neutral-300 px-2 py-2 text-center text-neutral-700 dark:border-neutral-700 dark:text-neutral-300">{index + 1}</td>
                          <td className="border border-neutral-300 px-3 py-2 font-medium text-neutral-900 dark:border-neutral-700 dark:text-white">{row.city}</td>
                          <td className="border border-neutral-300 bg-neutral-50 px-3 py-2 text-center font-semibold text-neutral-900 dark:border-neutral-700 dark:bg-neutral-800/60 dark:text-white">{row.quota.toLocaleString('id-ID')}</td>
                          {dates.map((date) => {
                            const count = row.counts[date] ?? 0
                            return (
                              <td key={date} className={`border border-neutral-300 px-2 py-2 text-center font-semibold dark:border-neutral-700 ${getDailyCellClass(count, row.quota)}`}>
                                {count > 0 ? count.toLocaleString('id-ID') : ''}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </Fragment>
                  )
                })}
                <tr>
                  <td colSpan={2} className="border border-neutral-300 bg-neutral-900 px-3 py-2 font-bold uppercase text-white dark:border-neutral-700">
                    Jumlah
                  </td>
                  <td className="border border-neutral-300 bg-neutral-900 px-3 py-2 text-center font-bold text-white dark:border-neutral-700">
                    {totalQuota.toLocaleString('id-ID')}
                  </td>
                  {dates.map((date) => (
                    <td key={date} className="border border-neutral-300 bg-neutral-900 px-2 py-2 text-center font-bold text-white dark:border-neutral-700">
                      {dailyTotals[date] > 0 ? dailyTotals[date].toLocaleString('id-ID') : ''}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1280px] border-collapse text-xs">
              <tbody>
                <tr>
                  <th colSpan={2} className="border border-neutral-300 bg-neutral-100 px-3 py-2 text-left font-bold text-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white">
                    TANGGAL
                  </th>
                  <th className="border border-neutral-300 bg-neutral-100 px-3 py-2 text-center font-bold text-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white">
                    KUOTA
                  </th>
                  {dates.map((date) => (
                    <th key={date} className="border border-neutral-300 bg-neutral-100 px-2 py-2 text-center font-bold text-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white">
                      {Number(date.slice(-2))}
                    </th>
                  ))}
                </tr>
                {provinceTotals.map((row) => (
                  <tr key={row.province}>
                    <td colSpan={2} className="border border-neutral-300 px-3 py-2 font-bold uppercase text-neutral-900 dark:border-neutral-700 dark:text-white">
                      {row.label}
                    </td>
                    <td className="border border-neutral-300 bg-neutral-50 px-3 py-2 text-center font-semibold text-neutral-900 dark:border-neutral-700 dark:bg-neutral-800/60 dark:text-white">
                      {row.quota.toLocaleString('id-ID')}
                    </td>
                    {dates.map((date) => (
                      <td key={date} className={`border border-neutral-300 px-2 py-2 text-center font-semibold dark:border-neutral-700 ${getDailyCellClass(row.counts[date] ?? 0, row.quota)}`}>
                        {(row.counts[date] ?? 0) > 0 ? row.counts[date].toLocaleString('id-ID') : ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-sm font-semibold text-neutral-900 dark:text-white">Catatan</p>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            Warna sel menunjukkan capaian terhadap kuota wilayah: merah rendah, kuning sedang, hijau mendekati atau mencapai kuota.
          </p>
        </div>

        <SummaryLineChart data={chartData} series={chartSeries} />
      </div>
    </div>
  )
}
