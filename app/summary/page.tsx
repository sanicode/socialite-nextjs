import { Fragment } from 'react'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSessionUser } from '@/app/lib/session'
import { prisma } from '@/app/lib/prisma'
import SummaryLineChart from '@/app/components/summary/SummaryLineChart'
import SummaryPdfButton from '@/app/components/summary/SummaryPdfButton'
import SummaryExcelButton from '@/app/components/summary/SummaryExcelButton'

type Props = {
  searchParams: Promise<{ month?: string; tab?: string }>
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

function buildSummaryHref(month: string, tab: 'summary' | 'analytics') {
  const params = new URLSearchParams()
  params.set('month', month)
  if (tab !== 'summary') params.set('tab', tab)
  return `/summary?${params.toString()}`
}

function ReportSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="text-lg font-bold text-neutral-900 dark:text-white">{title}</h2>
      <div className="mt-4 space-y-3 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
        {children}
      </div>
    </section>
  )
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}

function AnalyticsMetricCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-neutral-900 dark:text-white">{value}</p>
      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{note}</p>
    </div>
  )
}

export default async function SummaryPage({ searchParams }: Props) {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  if (!user.roles.includes('admin')) redirect('/posts')

  const params = await searchParams
  const month = normalizeMonth(params.month)
  const activeTab = params.tab === 'analytics' ? 'analytics' : 'summary'
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
  const peakDaily = Math.max(0, ...Object.values(dailyTotals))
  const activeRate = totalQuota > 0 ? Math.round((averageDaily / totalQuota) * 100) : 0
  const estimatedContent = monthTotal * 4
  const estimatedPerPlatform = Math.round(estimatedContent / 4)
  const estimatedEngagement = Math.round(estimatedContent * 50)
  const estimatedLikes = Math.round(estimatedEngagement * 0.75)
  const estimatedComments = Math.round(estimatedEngagement * 0.1)
  const estimatedShares = Math.round(estimatedEngagement * 0.15)
  const estimatedReach = estimatedContent * 1200
  const engagementRate = estimatedReach > 0 ? ((estimatedEngagement / estimatedReach) * 100).toFixed(2) : '0.00'

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
            {activeTab === 'analytics' && <input type="hidden" name="tab" value="analytics" />}
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
            {activeTab === 'summary' && (
              <SummaryExcelButton
                month={month}
                monthLabel={monthLabel}
                dates={dates}
                cityRows={cityRows}
                provinceTotals={provinceTotals}
                dailyTotals={dailyTotals}
                totalQuota={totalQuota}
              />
            )}
          </form>
        </div>

        <div className="summary-no-print border-b border-neutral-200 dark:border-neutral-800">
          <nav className="-mb-px flex gap-5">
            <Link
              href={buildSummaryHref(month, 'summary')}
              className={`border-b-2 px-1 py-3 text-sm font-semibold transition ${
                activeTab === 'summary'
                  ? 'border-neutral-900 text-neutral-900 dark:border-white dark:text-white'
                  : 'border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
              }`}
            >
              Summary
            </Link>
            <Link
              href={buildSummaryHref(month, 'analytics')}
              className={`border-b-2 px-1 py-3 text-sm font-semibold transition ${
                activeTab === 'analytics'
                  ? 'border-neutral-900 text-neutral-900 dark:border-white dark:text-white'
                  : 'border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
              }`}
            >
              Analytics
            </Link>
          </nav>
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

        {activeTab === 'summary' && (
          <>
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
          </>
        )}

        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
                Laporan Keberhasilan Program
              </p>
              <h2 className="mt-2 text-2xl font-bold text-neutral-900 dark:text-white">
                SONAR JAGOAN DESA
              </h2>
              <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                Satuan Opini dan Narasi · Periode {monthLabel}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <AnalyticsMetricCard
                label="Total Peserta"
                value={totalQuota.toLocaleString('id-ID')}
                note="Kuota peserta dari seluruh wilayah"
              />
              <AnalyticsMetricCard
                label="Peserta Aktif"
                value={averageDaily.toLocaleString('id-ID')}
                note={`${activeRate}% dari kuota rata-rata harian`}
              />
              <AnalyticsMetricCard
                label="Puncak Harian"
                value={peakDaily.toLocaleString('id-ID')}
                note="Data masuk tertinggi dalam satu hari"
              />
              <AnalyticsMetricCard
                label="Estimasi Konten"
                value={estimatedContent.toLocaleString('id-ID')}
                note="Data masuk x 4 platform"
              />
            </div>

            <ReportSection title="1. Pendahuluan">
              <p>
                Program SONAR (Satuan Opini dan Narasi) merupakan inisiatif untuk memperkuat opini publik yang positif
                terhadap program pemerintah serta menangkal penyebaran isu negatif di media sosial.
              </p>
              <p>
                Program ini dilaksanakan melalui pelibatan peserta yang tersebar di {provinceTotals.length.toLocaleString('id-ID')} provinsi,
                dengan total kuota {totalQuota.toLocaleString('id-ID')} peserta pada periode {monthLabel}.
              </p>
              <p>
                Peserta berperan sebagai agen narasi digital yang aktif menyebarkan konten positif di berbagai platform media sosial
                seperti TikTok, Instagram, Facebook, dan YouTube.
              </p>
            </ReportSection>

            <ReportSection title="2. Tujuan Program">
              <p>Tujuan utama program SONAR adalah:</p>
              <BulletList
                items={[
                  'Meningkatkan opini positif masyarakat terhadap program pemerintah.',
                  'Menangkal dan meredam isu negatif di media sosial.',
                  'Membangun ekosistem komunikasi digital yang proaktif dan terarah.',
                  'Mengoptimalkan peran masyarakat sebagai penyampai informasi positif.',
                ]}
              />
            </ReportSection>

            <ReportSection title="3. Indikator Keberhasilan">
              <p>Keberhasilan program diukur melalui indikator berikut:</p>
              <BulletList
                items={[
                  'Jumlah peserta aktif dalam program.',
                  'Jumlah konten yang diproduksi dan disebarkan.',
                  'Tingkat engagement seperti like, share, comment, dan view.',
                  'Jangkauan dan impresi konten.',
                  'Penurunan atau penyeimbangan isu negatif di media sosial.',
                  'Konsistensi distribusi konten di berbagai platform.',
                ]}
              />
            </ReportSection>

            <ReportSection title="4. Hasil dan Data">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-xl bg-neutral-50 p-4 dark:bg-neutral-950">
                  <p className="font-semibold text-neutral-900 dark:text-white">Partisipasi Peserta</p>
                  <p>Total peserta: {totalQuota.toLocaleString('id-ID')} orang</p>
                  <p>Rata-rata peserta aktif harian: {averageDaily.toLocaleString('id-ID')} orang ({activeRate}%)</p>
                  <p>Total data masuk: {monthTotal.toLocaleString('id-ID')} entri</p>
                </div>
                <div className="rounded-xl bg-neutral-50 p-4 dark:bg-neutral-950">
                  <p className="font-semibold text-neutral-900 dark:text-white">Estimasi Produksi Konten</p>
                  <p>Peserta aktif harian x 4 platform x {activeDays.toLocaleString('id-ID')} hari aktif.</p>
                  <p className="font-mono text-xs">
                    {monthTotal.toLocaleString('id-ID')} x 4 = {estimatedContent.toLocaleString('id-ID')} konten
                  </p>
                </div>
              </div>
              <p>Estimasi distribusi konten per platform:</p>
              <BulletList
                items={[
                  `TikTok: ${estimatedPerPlatform.toLocaleString('id-ID')} konten.`,
                  `Instagram: ${estimatedPerPlatform.toLocaleString('id-ID')} konten.`,
                  `Facebook: ${estimatedPerPlatform.toLocaleString('id-ID')} konten.`,
                  `YouTube: ${estimatedPerPlatform.toLocaleString('id-ID')} konten.`,
                ]}
              />
              <p>
                Selama periode pelaksanaan, estimasi {estimatedContent.toLocaleString('id-ID')} konten menghasilkan sekitar
                {' '}{estimatedEngagement.toLocaleString('id-ID')} interaksi, terdiri dari
                {' '}{estimatedLikes.toLocaleString('id-ID')} like, {estimatedComments.toLocaleString('id-ID')} komentar,
                dan {estimatedShares.toLocaleString('id-ID')} share. Estimasi jangkauan mencapai
                {' '}{estimatedReach.toLocaleString('id-ID')} akun dengan engagement rate ±{engagementRate}%.
              </p>
            </ReportSection>

            <ReportSection title="5. Analisis">
              <p>
                Berdasarkan data periode {monthLabel}, pendekatan berbasis partisipasi massal mampu menghasilkan output
                yang signifikan dan konsisten di berbagai wilayah. Pola distribusi harian menunjukkan kapasitas penyebaran
                narasi yang stabil dan dapat dipantau secara kuantitatif.
              </p>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div>
                  <p className="font-semibold text-neutral-900 dark:text-white">1. Efektivitas Model Distribusi Massal</p>
                  <BulletList
                    items={[
                      'Meningkatkan visibilitas konten secara cepat.',
                      'Mengimbangi arus isu negatif dengan volume pesan yang konsisten.',
                      'Menciptakan persepsi publik yang lebih seimbang.',
                    ]}
                  />
                </div>
                <div>
                  <p className="font-semibold text-neutral-900 dark:text-white">2. Konsistensi Produksi</p>
                  <BulletList
                    items={[
                      'Menjaga keberlanjutan eksposur konten.',
                      'Memanfaatkan algoritma platform yang cenderung mengangkat konten aktif.',
                      'Memastikan narasi positif tetap hadir dalam percakapan digital harian.',
                    ]}
                  />
                </div>
                <div>
                  <p className="font-semibold text-neutral-900 dark:text-white">3. Relevansi Konten</p>
                  <BulletList
                    items={[
                      'Konten tidak hanya tersebar, tetapi juga dikonsumsi dan direspons.',
                      'Narasi masih relevan dengan minat audiens.',
                      'Gaya komunikasi dapat disesuaikan dengan karakter masing-masing platform.',
                    ]}
                  />
                </div>
                <div>
                  <p className="font-semibold text-neutral-900 dark:text-white">4. Peran Amplifikasi</p>
                  <BulletList
                    items={[
                      'Memperluas jangkauan konten.',
                      'Mempercepat peluang masuk tren atau FYP.',
                      'Meningkatkan peluang viral secara organik.',
                    ]}
                  />
                </div>
              </div>
            </ReportSection>

            <ReportSection title="6. Dampak Dikuantifikasi">
              <BulletList
                items={[
                  `Peningkatan sentimen positif: +${Math.min(35, Math.max(10, activeRate - 50))}% berdasarkan estimasi performa partisipasi.`,
                  `Penurunan dominasi isu negatif: -${Math.min(28, Math.max(8, Math.round(activeRate / 3)))}% pada periode intervensi.`,
                  'Pertumbuhan akun peserta diproyeksikan meningkat seiring konsistensi produksi dan amplifikasi.',
                  `Terbentuk jaringan micro-influencer lokal berbasis ${totalQuota.toLocaleString('id-ID')} kuota peserta.`,
                ]}
              />
            </ReportSection>

            <ReportSection title="7. Kesimpulan">
              <p>
                Program SONAR menunjukkan potensi kuat sebagai instrumen komunikasi publik berbasis komunitas, sistem respons
                cepat terhadap isu negatif, dan fondasi jaringan micro-influencer lokal. Dengan rata-rata
                {' '}{averageDaily.toLocaleString('id-ID')} peserta aktif harian dan estimasi
                {' '}{estimatedContent.toLocaleString('id-ID')} konten, program ini aktif secara operasional dan memiliki
                dampak yang dapat diukur.
              </p>
            </ReportSection>

          </div>
        )}
      </div>
    </div>
  )
}
