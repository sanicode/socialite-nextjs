'use client'

import { useMemo, useState, type CSSProperties } from 'react'
import {
  BarChart,
  Bar,
  Cell,
  LabelList,
  Pie,
  PieChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { CityChartGroup, ProvinceChartItem } from '@/app/actions/dashboard'
import { renderHorizontalBarValueLabel } from '@/app/components/dashboard/ChartValueLabels'
import { getPageSlice } from '@/app/lib/table-pagination'

type Props = {
  data: ProvinceChartItem[]
  cityGroups?: CityChartGroup[]
  summary?: ReportStatusSummary
  variant?: 'default' | 'statistik'
  theme?: 'light' | 'dark'
}

type ReportStatusSummary = {
  totalOperators: number
  reportedOperators: number
  missingOperators: number
  reportedRows?: { province: string | null }[]
  missingRows?: { province: string | null }[]
}

const ACTIONABLE_PAGE_SIZE = 7

const statistikLeadPanelStyle: CSSProperties = {
  background: 'var(--stat-surface-2)',
  border: '1px solid var(--stat-line)',
  borderRadius: 'var(--stat-radius-sm)',
  padding: 18,
}

const statistikLeadRowStyle: CSSProperties = {
  alignItems: 'center',
  columnGap: 12,
  display: 'grid',
  gridTemplateColumns: '20px minmax(0, 1fr) 90px 48px',
  padding: '8px 0',
}

const statistikLeadHeadingStyle: CSSProperties = {
  alignItems: 'center',
  columnGap: 8,
  display: 'flex',
  fontSize: 12.5,
  fontWeight: 800,
  letterSpacing: '0.05em',
  marginBottom: 14,
  textTransform: 'uppercase',
}

const statistikLeadRankStyle: CSSProperties = {
  color: 'var(--stat-faint)',
  fontFamily: 'var(--stat-mono)',
  fontSize: 12,
  fontWeight: 700,
  textAlign: 'right',
}

const statistikLeadNameStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  minWidth: 0,
}

const statistikLeadSmallStyle: CSSProperties = {
  color: 'var(--stat-muted)',
  display: 'block',
  fontSize: 11,
  fontWeight: 500,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const statistikLeadBarStyle: CSSProperties = {
  background: 'var(--stat-line-2)',
  borderRadius: 99,
  display: 'block',
  height: 7,
  overflow: 'hidden',
  width: 90,
}

const statistikLeadFillStyle: CSSProperties = {
  borderRadius: 99,
  display: 'block',
  height: '100%',
  transformOrigin: 'left',
}

const statistikLeadPercentStyle: CSSProperties = {
  fontFamily: 'var(--stat-mono)',
  fontSize: 13,
  fontWeight: 700,
  textAlign: 'right',
}

const statistikActionTableWrapStyle: CSSProperties = {
  border: '1px solid var(--stat-line)',
  borderRadius: 'var(--stat-radius-sm)',
  marginTop: 16,
  overflowX: 'auto',
  overflowY: 'hidden',
}

const statistikActionTableStyle: CSSProperties = {
  borderCollapse: 'collapse',
  fontSize: 13,
  minWidth: 680,
  width: '100%',
}

const statistikActionThStyle: CSSProperties = {
  background: 'var(--stat-surface-2)',
  borderBottom: '1px solid var(--stat-line)',
  color: 'var(--stat-muted)',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.06em',
  padding: '11px 16px',
  textAlign: 'left',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
}

const statistikActionTdStyle: CSSProperties = {
  borderBottom: '1px solid var(--stat-line-2)',
  padding: '11px 16px',
  verticalAlign: 'middle',
}

const statistikActionRightStyle: CSSProperties = {
  fontFamily: 'var(--stat-mono)',
  fontWeight: 600,
  textAlign: 'right',
  whiteSpace: 'nowrap',
}

const statistikActionPlaceStyle: CSSProperties = {
  fontWeight: 600,
  whiteSpace: 'nowrap',
}

const statistikActionPlaceSmallStyle: CSSProperties = {
  color: 'var(--stat-muted)',
  fontWeight: 500,
}

const statistikGapPillStyle: CSSProperties = {
  background: 'var(--stat-warn-tint)',
  borderRadius: 7,
  color: 'var(--stat-warn)',
  display: 'inline-block',
  fontFamily: 'var(--stat-mono)',
  fontSize: 12.5,
  fontWeight: 700,
  minWidth: 42,
  padding: '3px 10px',
  textAlign: 'center',
}

const statistikActionFooterStyle: CSSProperties = {
  color: 'var(--stat-muted)',
  display: 'flex',
  flexWrap: 'wrap',
  fontSize: 12,
  justifyContent: 'space-between',
  marginTop: 14,
  rowGap: 10,
}

const statistikActionFooterItemStyle: CSSProperties = {
  marginRight: 18,
}

const statistikActionAlertStyle: CSSProperties = {
  color: 'var(--stat-danger)',
}

function getChartColors(variant: Props['variant'], theme: Props['theme']) {
  if (variant !== 'statistik') {
    return {
      primary: '#4E79A7',
      secondary: '#EDC948',
      reported: '#4E79A7',
      missing: '#EDC948',
      grid: 'var(--color-neutral-200, #e5e5e5)',
      cursor: 'rgba(148,163,184,0.06)',
      tooltipBg: '#0f172a',
      tooltipBorder: '#1e293b',
      tooltipText: '#e2e8f0',
      tooltipLabel: '#94a3b8',
      panelStyle: {},
      titleStyle: {},
      mutedStyle: {},
      axis: 'currentColor',
    }
  }

  const isDark = theme === 'dark'
  return {
    primary: `var(--stat-good, ${isDark ? '#37d39a' : '#0e8a7d'})`,
    secondary: `var(--stat-warn, ${isDark ? '#f08a3d' : '#e8742c'})`,
    reported: `var(--stat-good, ${isDark ? '#37d39a' : '#0e8a7d'})`,
    missing: `var(--stat-warn, ${isDark ? '#f08a3d' : '#e8742c'})`,
    grid: 'var(--dashboard-chart-grid, var(--stat-line))',
    cursor: 'var(--dashboard-chart-cursor, rgba(14, 138, 125, 0.08))',
    tooltipBg: 'var(--dashboard-chart-tooltip-bg, #16202e)',
    tooltipBorder: 'var(--dashboard-chart-tooltip-border, #3a4759)',
    tooltipText: 'var(--dashboard-chart-tooltip-text, #ffffff)',
    tooltipLabel: 'var(--dashboard-chart-tooltip-label, #c4cdd8)',
    panelStyle: {
      background: 'var(--dashboard-panel-bg, var(--stat-surface))',
      borderColor: 'var(--dashboard-panel-border, var(--stat-line))',
      borderRadius: 'var(--stat-radius, 18px)',
      boxShadow: 'var(--dashboard-panel-shadow, var(--stat-shadow))',
    },
    titleStyle: { color: 'var(--stat-ink)' },
    mutedStyle: { color: 'var(--stat-muted)' },
    axis: 'var(--dashboard-axis, var(--stat-ink-2))',
  }
}

function formatNumber(value: number) {
  return value.toLocaleString('id-ID')
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, value))
}

function getPercentage(value: number, total: number) {
  return total > 0 ? (value / total) * 100 : 0
}

function formatPercent(value: number, fractionDigits = 0) {
  return `${clampPercent(value).toLocaleString('id-ID', {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  })}%`
}

function formatProvinceShortName(value: string) {
  const normalized = getProvinceKey(value)
  const shortNames: Record<string, string> = {
    'jawa timur': 'Jatim',
    'jawa tengah': 'Jateng',
    'jawa barat': 'Jabar',
    'dki jakarta': 'DKI Jakarta',
    'di yogyakarta': 'DIY',
  }
  return shortNames[normalized] ?? value
}

function getProvinceKey(value: string | null | undefined) {
  return value?.trim().toLowerCase() || 'tanpa-provinsi'
}

function getProvinceDisplayName(value: string | null | undefined) {
  return (value?.trim() || 'Tanpa Provinsi').toUpperCase()
}

function countRowsByProvince(rows: { province: string | null }[] | undefined) {
  const counts = new Map<string, { name: string; count: number }>()
  for (const row of rows ?? []) {
    const key = getProvinceKey(row.province)
    const current = counts.get(key) ?? { name: row.province?.trim() || 'Tanpa Provinsi', count: 0 }
    counts.set(key, { ...current, count: current.count + 1 })
  }
  return counts
}

function getCityLeaderboardGroups(cityGroups: CityChartGroup[]) {
  const groupsWithReports = cityGroups.filter((group) => group.cities.some((city) => city.posts > 0))
  return groupsWithReports.length > 0 ? groupsWithReports : cityGroups
}

function getCityLeaderboardItems(cityGroups: CityChartGroup[]) {
  const rankableGroups = getCityLeaderboardGroups(cityGroups)
  const items = rankableGroups.flatMap((group) => group.cities
    .filter((city) => city.operators > 0)
    .map((city) => ({
      city: city.name,
      province: group.province,
      posts: Math.max(city.posts, 0),
      operators: Math.max(city.operators, 0),
      percentage: getPercentage(city.posts, city.operators),
    })))
  const highest = [...items]
    .sort((a, b) => b.percentage - a.percentage || b.posts - a.posts || a.city.localeCompare(b.city))
    .slice(0, 5)
  const lowest = items
    .filter((item) => item.percentage < 100)
    .sort((a, b) => a.percentage - b.percentage || b.operators - a.operators || a.city.localeCompare(b.city))
    .slice(0, 5)
  const uniqueProvinceNames = Array.from(new Set(rankableGroups.map((group) => group.province).filter(Boolean)))

  return {
    highest,
    lowest,
    provinceLabel: uniqueProvinceNames.length === 1 ? uniqueProvinceNames[0] : '',
  }
}

function getActionableMissingData(cityGroups: CityChartGroup[]) {
  const rankableGroups = getCityLeaderboardGroups(cityGroups)
  const rankableProvinceKeys = new Set(rankableGroups.map((group) => getProvinceKey(group.province)))
  const rows = rankableGroups.flatMap((group) => group.cities
    .filter((city) => city.operators > 0)
    .map((city) => {
      const operators = Math.max(city.operators, 0)
      const posts = Math.min(Math.max(city.posts, 0), operators)
      return {
        city: city.name,
        province: group.province,
        posts,
        operators,
        missing: Math.max(operators - posts, 0),
        percentage: getPercentage(posts, operators),
      }
    })
    .filter((city) => city.missing > 0))
    .sort((a, b) => (
      b.missing - a.missing
      || a.percentage - b.percentage
      || b.operators - a.operators
      || a.city.localeCompare(b.city)
    ))

  const anomalySummaries = cityGroups
    .map((group) => {
      const totals = group.cities.reduce((total, city) => {
        const operators = Math.max(city.operators, 0)
        const posts = Math.min(Math.max(city.posts, 0), operators)
        return {
          operators: total.operators + operators,
          posts: total.posts + posts,
          missing: total.missing + Math.max(operators - posts, 0),
        }
      }, { operators: 0, posts: 0, missing: 0 })
      return { province: group.province, ...totals }
    })
    .filter((group) => (
      group.operators > 0
      && group.posts === 0
      && group.missing > 0
      && !rankableProvinceKeys.has(getProvinceKey(group.province))
    ))
    .sort((a, b) => b.missing - a.missing || a.province.localeCompare(b.province))

  return {
    rows,
    activeMissingTotal: rows.reduce((total, row) => total + row.missing, 0),
    activeProvinceNames: Array.from(new Set(rankableGroups.map((group) => group.province).filter(Boolean))),
    anomalySummaries,
  }
}

function getReportStatus(data: ProvinceChartItem[], summary?: ReportStatusSummary) {
  const computedTotal = data.reduce((total, row) => total + row.operators, 0)
  const computedReported = Math.min(data.reduce((total, row) => total + row.posts, 0), computedTotal)
  const computedMissing = Math.max(computedTotal - computedReported, 0)
  const reportedOperators = Math.max(summary?.reportedOperators ?? computedReported, 0)
  const missingOperators = Math.max(summary?.missingOperators ?? computedMissing, 0)
  const totalOperators = Math.max(summary?.totalOperators ?? computedTotal, reportedOperators + missingOperators)

  return {
    totalOperators,
    reportedOperators,
    missingOperators,
  }
}

function ReportStatusDonut({
  reportStatus,
  colors,
  compactCluster,
}: {
  reportStatus: ReportStatusSummary
  colors: ReturnType<typeof getChartColors>
  compactCluster: boolean
}) {
  const total = Math.max(reportStatus.totalOperators, 0)
  const donutData = [
    { name: 'Sudah Lapor', value: reportStatus.reportedOperators, color: colors.reported },
    { name: 'Belum Lapor', value: reportStatus.missingOperators, color: colors.missing },
  ]
  const reportedPercentage = total > 0
    ? Math.round((reportStatus.reportedOperators / total) * 100)
    : 0
  const donutHeight = compactCluster ? 184 : 204

  return (
    <div className="border-b border-neutral-200 pb-5 dark:border-neutral-800 xl:border-b-0 xl:border-r xl:pb-0 xl:pr-5">
      <div className="mb-3">
        <h4 className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400" style={colors.mutedStyle}>
          Progres Pelaporan
        </h4>
        <p className="mt-1 text-sm font-semibold text-neutral-900 dark:text-white" style={colors.titleStyle}>
          {formatNumber(total)} operator
        </p>
      </div>

      <div className="relative h-52 min-h-52" style={{ height: donutHeight, minHeight: donutHeight }}>
        <ResponsiveContainer width="100%" height={donutHeight}>
          <PieChart>
            <Pie
              data={donutData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={compactCluster ? 54 : 60}
              outerRadius={compactCluster ? 78 : 86}
              startAngle={90}
              endAngle={-270}
              paddingAngle={reportStatus.reportedOperators > 0 && reportStatus.missingOperators > 0 ? 2 : 0}
              stroke="transparent"
            >
              {donutData.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: colors.tooltipBg,
                border: `1px solid ${colors.tooltipBorder}`,
                borderRadius: '10px',
                color: colors.tooltipText,
                fontSize: '12px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.4)',
              }}
              labelStyle={{ color: colors.tooltipLabel, marginBottom: '4px', fontWeight: 600 }}
              formatter={(value, name) => [
                Number(value).toLocaleString('id-ID'),
                String(name),
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-2xl font-bold text-neutral-900 dark:text-white" style={colors.titleStyle}>
            {reportedPercentage}%
          </span>
          <span className="mt-0.5 text-[11px] font-medium text-neutral-500 dark:text-neutral-400" style={colors.mutedStyle}>
            sudah lapor
          </span>
        </div>
      </div>

      <div className="space-y-2 text-sm">
        {donutData.map((entry) => {
          const percentage = total > 0 ? Math.round((entry.value / total) * 100) : 0
          return (
            <div key={entry.name} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <span className="flex min-w-0 items-center gap-2 text-neutral-600 dark:text-neutral-300" style={colors.mutedStyle}>
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="truncate">{entry.name}</span>
              </span>
              <span className="text-right text-xs font-semibold text-neutral-900 dark:text-white" style={colors.titleStyle}>
                {formatNumber(entry.value)} ({percentage}%)
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function StatistikCityLeaderboard({ cityGroups }: { cityGroups: CityChartGroup[] }) {
  const { highest, lowest, provinceLabel } = getCityLeaderboardItems(cityGroups)
  const hasItems = highest.length > 0 || lowest.length > 0
  const isSingle = highest.length === 0 || lowest.length === 0
  const gridStyle: CSSProperties = {
    display: 'grid',
    gap: 16,
    gridTemplateColumns: isSingle ? '1fr' : 'repeat(auto-fit, minmax(300px, 1fr))',
    marginTop: 18,
  }

  return (
    <section className="statistik-card statistik-card-pad statistik-anim" style={{ animationDelay: '.34s' }}>
      <div className="statistik-card-header">
        <div>
          <h2>Peringkat Performa Kota{provinceLabel ? ` — ${provinceLabel}` : ''}</h2>
          <div className="statistik-card-sub">Rasio pelapor terhadap kuota operator. Lebih actionable daripada angka absolut.</div>
        </div>
      </div>

      {hasItems ? (
        <div className={`statistik-lead-grid ${isSingle ? 'single' : ''}`} style={gridStyle}>
          {highest.length > 0 && (
            <div className="statistik-lead top" style={statistikLeadPanelStyle}>
              <div className="statistik-lead-heading" style={{ ...statistikLeadHeadingStyle, color: 'var(--stat-good)' }}>▲ Performa Tertinggi</div>
              {highest.map((item, index) => (
                <div key={`${item.province}-${item.city}-top`} className="statistik-lead-row" style={statistikLeadRowStyle}>
                  <span className="statistik-lead-rank" style={statistikLeadRankStyle}>{index + 1}</span>
                  <span className="statistik-lead-name" style={statistikLeadNameStyle}>
                    {item.city}
                    <small style={statistikLeadSmallStyle}>{formatNumber(item.posts)} / {formatNumber(item.operators)} operator</small>
                  </span>
                  <span className="statistik-lead-bar" style={statistikLeadBarStyle}>
                    <i style={{ ...statistikLeadFillStyle, background: 'var(--stat-good)', width: `${clampPercent(item.percentage)}%` }} />
                  </span>
                  <span className="statistik-lead-percent" style={{ ...statistikLeadPercentStyle, color: 'var(--stat-good)' }}>{formatPercent(item.percentage, 0)}</span>
                </div>
              ))}
            </div>
          )}
          {lowest.length > 0 && (
            <div className="statistik-lead bottom" style={statistikLeadPanelStyle}>
              <div className="statistik-lead-heading" style={{ ...statistikLeadHeadingStyle, color: 'var(--stat-warn)' }}>▼ Performa Terendah</div>
              {lowest.map((item, index) => (
                <div key={`${item.province}-${item.city}-bottom`} className="statistik-lead-row" style={statistikLeadRowStyle}>
                  <span className="statistik-lead-rank" style={statistikLeadRankStyle}>{index + 1}</span>
                  <span className="statistik-lead-name" style={statistikLeadNameStyle}>
                    {item.city}
                    <small style={statistikLeadSmallStyle}>{formatNumber(item.posts)} / {formatNumber(item.operators)} operator</small>
                  </span>
                  <span className="statistik-lead-bar" style={statistikLeadBarStyle}>
                    <i style={{ ...statistikLeadFillStyle, background: 'var(--stat-warn)', width: `${clampPercent(item.percentage)}%` }} />
                  </span>
                  <span className="statistik-lead-percent" style={{ ...statistikLeadPercentStyle, color: 'var(--stat-warn)' }}>{formatPercent(item.percentage, 0)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="statistik-province-empty">Belum ada data kota/kabupaten</div>
      )}
    </section>
  )
}

function StatistikActionableMissingTable({ cityGroups }: { cityGroups: CityChartGroup[] }) {
  const [page, setPage] = useState(1)
  const {
    rows,
    activeMissingTotal,
    activeProvinceNames,
    anomalySummaries,
  } = useMemo(() => getActionableMissingData(cityGroups), [cityGroups])
  const pageSlice = getPageSlice(page, ACTIONABLE_PAGE_SIZE, rows.length)
  const currentPage = Math.min(Math.max(1, page), pageSlice.totalPages)
  const visibleRows = rows.slice(
    pageSlice.offset,
    pageSlice.take ? pageSlice.offset + pageSlice.take : rows.length
  )
  const provinceScope = activeProvinceNames.length === 1
    ? formatProvinceShortName(activeProvinceNames[0])
    : activeProvinceNames.length > 1
      ? `${activeProvinceNames.length} provinsi aktif`
      : 'data aktif'
  const locationPrefix = activeProvinceNames.length === 1 ? 'di' : 'pada'
  const anomalyText = anomalySummaries
    .map((item) => `${formatProvinceShortName(item.province)} ${formatNumber(item.missing)} belum lapor`)
    .join(' · ')

  return (
    <section className="statistik-card statistik-card-pad statistik-action statistik-anim" style={{ animationDelay: '.38s' }}>
      <div className="statistik-card-header">
        <div>
          <h2>Sisa Operator Belum Lapor — Prioritas Tindak Lanjut</h2>
          <div className="statistik-card-sub">Jumlah operator yang masih harus dikejar tim lapangan (kuota - pelapor)</div>
        </div>
      </div>

      {rows.length > 0 ? (
        <>
          <div className="statistik-table-wrap" style={statistikActionTableWrapStyle}>
            <table className="statistik-action-table" style={statistikActionTableStyle}>
              <thead>
                <tr>
                  <th style={statistikActionThStyle}>Kota / Kabupaten</th>
                  <th className="statistik-table-right" style={{ ...statistikActionThStyle, ...statistikActionRightStyle }}>Kuota</th>
                  <th className="statistik-table-right" style={{ ...statistikActionThStyle, ...statistikActionRightStyle }}>Sudah Lapor</th>
                  <th className="statistik-table-right" style={{ ...statistikActionThStyle, ...statistikActionRightStyle }}>Belum Lapor</th>
                  <th className="statistik-table-right" style={{ ...statistikActionThStyle, ...statistikActionRightStyle }}>Performa</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={`${row.province}-${row.city}`}>
                    <td className="statistik-action-place" style={{ ...statistikActionTdStyle, ...statistikActionPlaceStyle }}>
                      {row.city} <small style={statistikActionPlaceSmallStyle}>· {formatProvinceShortName(row.province)}</small>
                    </td>
                    <td className="statistik-table-right" style={{ ...statistikActionTdStyle, ...statistikActionRightStyle }}>{formatNumber(row.operators)}</td>
                    <td className="statistik-table-right" style={{ ...statistikActionTdStyle, ...statistikActionRightStyle }}>{formatNumber(row.posts)}</td>
                    <td className="statistik-table-right" style={{ ...statistikActionTdStyle, ...statistikActionRightStyle }}>
                      <span
                        className={`statistik-gap-pill ${row.missing >= 60 ? 'hi' : ''}`}
                        style={{
                          ...statistikGapPillStyle,
                          background: row.missing >= 60 ? 'var(--stat-danger-tint)' : 'var(--stat-warn-tint)',
                          color: row.missing >= 60 ? 'var(--stat-danger)' : 'var(--stat-warn)',
                        }}
                      >
                        {formatNumber(row.missing)}
                      </span>
                    </td>
                    <td className="statistik-table-right" style={{ ...statistikActionTdStyle, ...statistikActionRightStyle }}>{formatPercent(row.percentage, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="statistik-action-footer" style={statistikActionFooterStyle}>
            <span style={statistikActionFooterItemStyle}>
              Menampilkan {formatNumber(pageSlice.start)}-{formatNumber(pageSlice.end)} dari {formatNumber(rows.length)} prioritas {provinceScope} ·{' '}
              <b>{formatNumber(activeMissingTotal)}</b> total belum lapor {locationPrefix} {provinceScope}
            </span>
            {anomalyText && (
              <span className="statistik-action-alert" style={{ ...statistikActionFooterItemStyle, ...statistikActionAlertStyle }}>
                {anomalyText} — tertahan oleh anomali data
              </span>
            )}
          </div>

          {pageSlice.totalPages > 1 && (
            <div className="statistik-action-pagination" aria-label="Pagination prioritas tindak lanjut">
              <button type="button" className="statistik-page-button" disabled={currentPage <= 1} onClick={() => setPage(1)}>
                Pertama
              </button>
              <button type="button" className="statistik-page-button" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                Prev
              </button>
              <span className="statistik-page-status">Hal. {formatNumber(currentPage)} / {formatNumber(pageSlice.totalPages)}</span>
              <button type="button" className="statistik-page-button" disabled={currentPage >= pageSlice.totalPages} onClick={() => setPage((value) => Math.min(pageSlice.totalPages, value + 1))}>
                Next
              </button>
              <button type="button" className="statistik-page-button" disabled={currentPage >= pageSlice.totalPages} onClick={() => setPage(pageSlice.totalPages)}>
                Last
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="statistik-province-empty">Tidak ada sisa operator belum lapor</div>
      )}
    </section>
  )
}

function StatistikProvinceOverview({
  data,
  cityGroups,
  reportStatus,
  summary,
}: {
  data: ProvinceChartItem[]
  cityGroups: CityChartGroup[]
  reportStatus: ReportStatusSummary
  summary?: ReportStatusSummary
}) {
  const total = Math.max(reportStatus.totalOperators, 0)
  const reported = Math.max(reportStatus.reportedOperators, 0)
  const missing = Math.max(reportStatus.missingOperators, 0)
  const reportedPercentage = getPercentage(reported, total)
  const missingPercentage = getPercentage(missing, total)
  const circumference = 2 * Math.PI * 68
  const dashOffset = circumference * (1 - clampPercent(reportedPercentage) / 100)
  const reportedByProvince = countRowsByProvince(summary?.reportedRows)
  const missingByProvince = countRowsByProvince(summary?.missingRows)
  const hasSummaryRows = reportedByProvince.size > 0 || missingByProvince.size > 0
  const cityCountByProvince = new Map(
    cityGroups.map((group) => [getProvinceKey(group.province), group.cities.length])
  )
  const provinceMap = new Map<string, {
    name: string
    reported: number
    missing: number
    operators: number
    cityCount: number
  }>()

  for (const row of data) {
    const key = getProvinceKey(row.name)
    const reportedFallback = Math.min(Math.max(row.posts, 0), Math.max(row.operators, 0))
    provinceMap.set(key, {
      name: row.name,
      reported: reportedFallback,
      missing: Math.max(row.operators - reportedFallback, 0),
      operators: Math.max(row.operators, 0),
      cityCount: cityCountByProvince.get(key) ?? 0,
    })
  }

  if (hasSummaryRows) {
    for (const [key, row] of reportedByProvince) {
      const current = provinceMap.get(key) ?? {
        name: row.name,
        reported: 0,
        missing: 0,
        operators: 0,
        cityCount: cityCountByProvince.get(key) ?? 0,
      }
      current.reported = row.count
      current.operators = Math.max(current.operators, current.reported + current.missing)
      provinceMap.set(key, current)
    }
    for (const [key, row] of missingByProvince) {
      const current = provinceMap.get(key) ?? {
        name: row.name,
        reported: 0,
        missing: 0,
        operators: 0,
        cityCount: cityCountByProvince.get(key) ?? 0,
      }
      current.missing = row.count
      current.operators = Math.max(current.operators, current.reported + current.missing)
      provinceMap.set(key, current)
    }
  }

  const provinces = Array.from(provinceMap.values())
    .filter((province) => province.operators > 0)
    .sort((a, b) => {
      const ratioB = getPercentage(b.reported, b.operators)
      const ratioA = getPercentage(a.reported, a.operators)
      return ratioB - ratioA || a.name.localeCompare(b.name)
    })

  return (
    <section className="statistik-card statistik-card-pad statistik-anim" style={{ animationDelay: '.3s' }}>
      <div className="statistik-card-header">
        <div>
          <h2>Performa per Provinsi</h2>
          <div className="statistik-card-sub">Persentase operator yang sudah lapor — dibandingkan kuota operator</div>
        </div>
        <div className="statistik-legend-top">
          <span className="statistik-legend-item">
            <span className="statistik-swatch" style={{ background: 'var(--stat-good)' }} />
            Sudah Lapor
          </span>
          <span className="statistik-legend-item">
            <span className="statistik-swatch" style={{ background: 'var(--stat-warn)' }} />
            Belum Lapor
          </span>
        </div>
      </div>

      <div className="statistik-province-split">
        <div className="statistik-donut-wrap">
          <div className="statistik-donut">
            <svg width="170" height="170" viewBox="0 0 170 170" aria-hidden="true">
              <circle className="statistik-donut-track" cx="85" cy="85" r="68" fill="none" strokeWidth="20" />
              <circle
                className="statistik-donut-ring"
                cx="85"
                cy="85"
                r="68"
                fill="none"
                strokeWidth="20"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                style={{ '--stat-circ': circumference } as CSSProperties}
              />
            </svg>
            <div className="statistik-donut-center">
              <div className="statistik-donut-number">{formatPercent(reportedPercentage, 0)}</div>
              <div className="statistik-donut-label">total sudah lapor</div>
            </div>
          </div>
          <div className="statistik-donut-legend">
            <div className="statistik-donut-legend-row">
              <span className="statistik-donut-legend-name">
                <span className="statistik-swatch" style={{ background: 'var(--stat-good)' }} />
                Sudah Lapor
              </span>
              <span className="statistik-donut-legend-value" style={{ color: 'var(--stat-good)' }}>
                {formatNumber(reported)} · {formatPercent(reportedPercentage, 0)}
              </span>
            </div>
            <div className="statistik-donut-legend-row">
              <span className="statistik-donut-legend-name">
                <span className="statistik-swatch" style={{ background: 'var(--stat-warn)' }} />
                Belum Lapor
              </span>
              <span className="statistik-donut-legend-value" style={{ color: 'var(--stat-warn)' }}>
                {formatNumber(missing)} · {formatPercent(missingPercentage, 0)}
              </span>
            </div>
          </div>
        </div>

        <div className="statistik-province-grid">
          {provinces.length > 0 ? provinces.map((province) => {
            const percentage = getPercentage(province.reported, province.operators)
            const isFlagged = province.reported === 0 && province.operators > 0
            const trackWidth = isFlagged ? Math.max(clampPercent(percentage), 1.5) : clampPercent(percentage)
            return (
              <div key={province.name} className={`statistik-province-card ${isFlagged ? 'flag' : 'ok'}`}>
                <div className="statistik-province-corner">{isFlagged ? 'Anomali data' : 'Aktif melapor'}</div>
                <div className="statistik-province-name">{getProvinceDisplayName(province.name)}</div>
                <div className="statistik-province-sub">
                  {province.cityCount > 0 ? `${province.cityCount.toLocaleString('id-ID')} kota/kab · ` : ''}
                  kuota {formatNumber(province.operators)} operator
                </div>
                <div className="statistik-province-big">{formatPercent(percentage, 1)}</div>
                <div className="statistik-province-detail">
                  <b className="statistik-mono">{formatNumber(province.reported)}</b> sudah lapor ·{' '}
                  <b className="statistik-mono">{formatNumber(province.missing)}</b> belum lapor
                  {isFlagged && (
                    <>
                      {' '}— <b className="statistik-danger-text">tidak ada satu pun pelapor</b>
                    </>
                  )}
                </div>
                <div className="statistik-province-track">
                  <i
                    style={{
                      background: isFlagged
                        ? 'var(--stat-danger)'
                        : 'linear-gradient(90deg, var(--stat-good), #15a596)',
                      width: `${trackWidth}%`,
                    }}
                  />
                </div>
              </div>
            )
          }) : (
            <div className="statistik-province-empty">Belum ada data provinsi</div>
          )}
        </div>
      </div>
    </section>
  )
}

export default function ProvinceDonutChart({ data, cityGroups = [], summary, variant = 'default', theme = 'light' }: Props) {
  const colors = getChartColors(variant, theme)
  const compactCluster = variant === 'statistik'
  const reportStatus = getReportStatus(data, summary)
  const hasChartData = data.length > 0
  const hasDonutData = reportStatus.totalOperators > 0

  if (!hasChartData && !hasDonutData) {
    return (
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-5" style={colors.panelStyle}>
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-4" style={colors.titleStyle}>Pelapor per Provinsi</h3>
        <div className="h-64 flex items-center justify-center text-neutral-400 text-sm" style={colors.mutedStyle}>Belum ada data</div>
      </div>
    )
  }

  if (variant === 'statistik') {
    return (
      <>
        <StatistikProvinceOverview
          data={data}
          cityGroups={cityGroups}
          reportStatus={reportStatus}
          summary={summary}
        />
        <StatistikCityLeaderboard cityGroups={cityGroups} />
        <StatistikActionableMissingTable cityGroups={cityGroups} />
      </>
    )
  }

  // Reverse so highest performer renders at top (recharts fills bottom-up)
  const chartData = [...data].reverse()
  const maxVal = hasChartData ? Math.max(...data.map((d) => Math.max(d.posts, d.operators)), 1) : 1
  const chartHeight = hasChartData
    ? compactCluster
      ? Math.max(180, chartData.length * 64 + 96)
      : Math.max(300, chartData.length * 44 + 40)
    : compactCluster ? 180 : 300

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-5" style={colors.panelStyle}>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-white" style={colors.titleStyle}>Pelapor per Provinsi</h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5" style={colors.mutedStyle}>
            Diurutkan berdasarkan rasio pelapor per operator — tertinggi ke terendah
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-4 text-xs text-neutral-500 dark:text-neutral-400" style={colors.mutedStyle}>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: colors.primary }} />
            Pelapor
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: colors.secondary }} />
            Kuota Operator
          </span>
        </div>
      </div>

      <div className={hasDonutData ? 'grid gap-6 xl:grid-cols-[18rem_minmax(0,1fr)] xl:items-start' : ''}>
        {hasDonutData && (
          <ReportStatusDonut
            reportStatus={reportStatus}
            colors={colors}
            compactCluster={compactCluster}
          />
        )}

        <div
          className="text-neutral-600 dark:text-neutral-300"
          style={{ color: colors.axis, height: chartHeight, minHeight: compactCluster ? 180 : 300 }}
        >
          {hasChartData ? (
            <ResponsiveContainer width="100%" height={chartHeight}>
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 0, right: 72, left: 8, bottom: 0 }}
                barCategoryGap={compactCluster ? '8%' : '25%'}
                barGap={compactCluster ? 2 : 3}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={false}
                  stroke={colors.grid}
                  strokeOpacity={0.6}
                />
                <XAxis
                  type="number"
                  domain={[0, maxVal]}
                  tick={{ fontSize: 10, fill: 'currentColor' }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 10, fill: 'currentColor' }}
                  width={155}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: colors.tooltipBg,
                    border: `1px solid ${colors.tooltipBorder}`,
                    borderRadius: '10px',
                    color: colors.tooltipText,
                    fontSize: '12px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.4)',
                  }}
                  labelStyle={{ color: colors.tooltipLabel, marginBottom: '4px', fontWeight: 600 }}
                  formatter={(value, name) => [
                    Number(value).toLocaleString('id-ID'),
                    name === 'operators' ? 'Kuota Operator' : 'Pelapor',
                  ]}
                  cursor={{ fill: colors.cursor }}
                />
                <Bar dataKey="posts" fill={colors.primary} radius={[0, 3, 3, 0]} name="posts" barSize={compactCluster ? 20 : undefined} maxBarSize={compactCluster ? 20 : 16}>
                  <LabelList dataKey="posts" content={renderHorizontalBarValueLabel} />
                </Bar>
                <Bar dataKey="operators" fill={colors.secondary} radius={[0, 3, 3, 0]} name="operators" barSize={compactCluster ? 20 : undefined} maxBarSize={compactCluster ? 20 : 16}>
                  <LabelList dataKey="operators" content={renderHorizontalBarValueLabel} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full min-h-64 items-center justify-center text-sm text-neutral-400" style={colors.mutedStyle}>
              Belum ada data provinsi
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
