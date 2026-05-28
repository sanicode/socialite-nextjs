'use client'

import type { CSSProperties } from 'react'
import {
  BarChart,
  Bar,
  LabelList,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { CityChartGroup, ProvinceChartItem } from '@/app/actions/dashboard'
import { renderHorizontalBarValueLabel } from '@/app/components/dashboard/ChartValueLabels'

type Props = {
  data: CityChartGroup[]
  variant?: 'default' | 'statistik'
  theme?: 'light' | 'dark'
}

const statistikCitySectionStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
}

const statistikCityColumnsStyle: CSSProperties = {
  display: 'grid',
  gap: 16,
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  marginTop: 10,
}

const statistikCityCardStyle: CSSProperties = {
  padding: 20,
}

const statistikCityHeaderStyle: CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  justifyContent: 'space-between',
  marginBottom: 4,
}

const statistikProvinceRateStyle: CSSProperties = {
  borderRadius: 7,
  fontFamily: 'var(--stat-mono)',
  fontSize: 11.5,
  fontWeight: 700,
  padding: '3px 9px',
  whiteSpace: 'nowrap',
}

const statistikCityRowsStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  marginTop: 14,
}

const statistikCityRowStyle: CSSProperties = {
  alignItems: 'center',
  columnGap: 12,
  display: 'grid',
  gridTemplateColumns: '120px minmax(0, 1fr)',
}

const statistikCityLabelStyle: CSSProperties = {
  color: 'var(--stat-ink-2)',
  fontSize: 11.5,
  fontWeight: 600,
  lineHeight: 1.25,
  overflowWrap: 'anywhere',
  textAlign: 'right',
}

const statistikCityStackStyle: CSSProperties = {
  background: 'var(--stat-chart-rest)',
  border: '1px solid var(--stat-chart-rest-border)',
  borderRadius: 7,
  display: 'flex',
  height: 22,
  maxWidth: '100%',
  minWidth: 92,
  overflow: 'hidden',
  position: 'relative',
}

const statistikCityFillBaseStyle: CSSProperties = {
  alignItems: 'center',
  background: 'linear-gradient(90deg, var(--stat-good), #13a294)',
  display: 'flex',
  height: '100%',
  transformOrigin: 'left',
}

const statistikCityRestStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
}

const statistikCityNumStyle: CSSProperties = {
  color: 'var(--stat-ink-2)',
  fontFamily: 'var(--stat-mono)',
  fontSize: 11,
  fontWeight: 700,
  position: 'absolute',
  right: 9,
  top: '50%',
  transform: 'translateY(-50%)',
  whiteSpace: 'nowrap',
}

const statistikCityInfillStyle: CSSProperties = {
  color: '#ffffff',
  fontFamily: 'var(--stat-mono)',
  fontSize: 10.5,
  fontWeight: 700,
  overflow: 'hidden',
  paddingLeft: 8,
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const statistikCityFooterStyle: CSSProperties = {
  borderTop: '1px solid var(--stat-line-2)',
  color: 'var(--stat-muted)',
  display: 'flex',
  fontSize: 12,
  justifyContent: 'space-between',
  marginTop: 16,
  paddingTop: 14,
}

const statistikCityEmptyStyle: CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  padding: '36px 24px',
  textAlign: 'center',
}

const statistikCityEmptyIconStyle: CSSProperties = {
  background: 'var(--stat-danger-tint)',
  borderRadius: 14,
  color: 'var(--stat-danger)',
  display: 'grid',
  height: 54,
  marginBottom: 12,
  placeItems: 'center',
  width: 54,
}

const statistikCityEmptyTitleStyle: CSSProperties = {
  color: 'var(--stat-danger)',
  fontSize: 15,
  fontWeight: 800,
  margin: 0,
}

const statistikCityEmptyCountStyle: CSSProperties = {
  color: 'var(--stat-danger)',
  fontFamily: 'var(--stat-mono)',
  fontSize: 22,
  fontWeight: 700,
  marginTop: 12,
}

const statistikCityEmptyTextStyle: CSSProperties = {
  color: 'var(--stat-muted)',
  fontSize: 12.5,
  margin: '12px auto 0',
  maxWidth: 300,
}

const statistikGhostRowsStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  marginLeft: 'auto',
  marginRight: 'auto',
  marginTop: 18,
  maxWidth: 560,
  opacity: 0.55,
  width: '100%',
}

const statistikGhostRowStyle: CSSProperties = {
  alignItems: 'center',
  columnGap: 10,
  display: 'flex',
  width: '100%',
}

const statistikGhostLabelStyle: CSSProperties = {
  color: 'var(--stat-faint)',
  flex: '0 0 120px',
  fontSize: 10.5,
  lineHeight: 1.2,
  overflowWrap: 'anywhere',
  textAlign: 'right',
}

const statistikGhostBarStyle: CSSProperties = {
  backgroundColor: 'var(--stat-chart-rest, #354455)',
  borderRadius: 6,
  flex: '1 1 0',
  height: 16,
  minWidth: 160,
  overflow: 'hidden',
  position: 'relative',
  width: '100%',
}

const statistikGhostFillStyle: CSSProperties = {
  backgroundColor: 'var(--stat-chart-ghost-1, #536579)',
  backgroundImage: 'repeating-linear-gradient(45deg, rgba(83, 101, 121, 0.95) 0, rgba(83, 101, 121, 0.95) 6px, rgba(63, 79, 96, 0.95) 6px, rgba(63, 79, 96, 0.95) 12px)',
  backgroundSize: '18px 18px',
  display: 'block',
  height: '100%',
  minWidth: 8,
}

const statistikCityChipStyle: CSSProperties = {
  background: 'var(--stat-surface-2)',
  border: '1px solid var(--stat-line)',
  borderRadius: 999,
  color: 'var(--stat-muted)',
  display: 'inline-flex',
  fontSize: 12,
  fontWeight: 700,
  marginTop: 20,
  padding: '7px 11px',
}

function getChartColors(variant: Props['variant'], theme: Props['theme']) {
  if (variant !== 'statistik') {
    return {
      primary: '#4E79A7',
      secondary: '#EDC948',
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
  const normalized = value.trim().toLowerCase()
  const shortNames: Record<string, string> = {
    'jawa timur': 'Jatim',
    'jawa tengah': 'Jateng',
    'jawa barat': 'Jabar',
    'dki jakarta': 'DKI Jakarta',
    'di yogyakarta': 'DIY',
  }
  return shortNames[normalized] ?? value
}

function getProvinceTotals(cities: ProvinceChartItem[]) {
  return cities.reduce((total, city) => {
    const operators = Math.max(city.operators, 0)
    const posts = Math.min(Math.max(city.posts, 0), operators)
    return {
      operators: total.operators + operators,
      posts: total.posts + posts,
    }
  }, { operators: 0, posts: 0 })
}

function StatistikProvinceCityCard({ group }: { group: CityChartGroup }) {
  const cities = [...group.cities]
    .filter((city) => city.operators > 0)
    .sort((a, b) => {
      const ratioB = getPercentage(b.posts, b.operators)
      const ratioA = getPercentage(a.posts, a.operators)
      return ratioB - ratioA || b.posts - a.posts || a.name.localeCompare(b.name)
    })
  const totals = getProvinceTotals(cities)
  const provinceRate = getPercentage(totals.posts, totals.operators)
  const maxQuota = Math.max(...cities.map((city) => Math.max(city.operators, 0)), 1)
  const isFlagged = totals.operators > 0 && totals.posts === 0
  const ghostRows = [...cities]
    .sort((a, b) => b.operators - a.operators || a.name.localeCompare(b.name))
    .slice(0, 4)

  return (
    <div className="statistik-card statistik-city-card" style={statistikCityCardStyle}>
      <div className="statistik-city-header" style={statistikCityHeaderStyle}>
        <div>
          <span className="statistik-city-province" style={{ fontSize: 13.5, fontWeight: 800, letterSpacing: '0.03em' }}>{group.province.toUpperCase()}</span>{' '}
          <span className="statistik-city-count" style={{ color: 'var(--stat-muted)', fontSize: 11.5, fontWeight: 600 }}>{formatNumber(cities.length)} kota/kab</span>
        </div>
        <span
          className={`statistik-province-rate ${isFlagged ? 'bad' : 'good'}`}
          style={{
            ...statistikProvinceRateStyle,
            background: isFlagged ? 'var(--stat-danger-tint)' : 'var(--stat-good-tint)',
            color: isFlagged ? 'var(--stat-danger)' : 'var(--stat-good)',
          }}
        >
          {formatPercent(provinceRate, 1)} lapor
        </span>
      </div>

      {isFlagged ? (
        <div className="statistik-city-empty" style={statistikCityEmptyStyle}>
          <div className="statistik-city-empty-icon" style={statistikCityEmptyIconStyle}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 9v4M12 17h.01" />
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            </svg>
          </div>
          <h4 style={statistikCityEmptyTitleStyle}>Tidak ada data pelapor</h4>
          <div className="statistik-city-empty-count" style={statistikCityEmptyCountStyle}>0 / {formatNumber(totals.operators)}</div>
          <p style={statistikCityEmptyTextStyle}>
            Ke-{formatNumber(cities.length)} kota/kabupaten memiliki kuota operator namun nol pelapor.
            Kemungkinan besar data belum tersinkronisasi - bukan grafik kosong biasa.
          </p>
          {ghostRows.length > 0 && (
            <div className="statistik-ghost-rows" style={statistikGhostRowsStyle}>
              {ghostRows.map((city, index) => (
                <div
                  key={`${group.province}-${city.name}-ghost`}
                  className="statistik-ghost-row"
                  style={{ ...statistikGhostRowStyle, marginTop: index === 0 ? 0 : 9 }}
                >
                  <span className="statistik-ghost-label" style={statistikGhostLabelStyle}>{city.name.toUpperCase()}</span>
                  <div className="statistik-ghost-bar" style={statistikGhostBarStyle}>
                    <i style={{ ...statistikGhostFillStyle, width: `${Math.max((city.operators / maxQuota) * 100, 8)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
          <span className="statistik-city-chip" style={statistikCityChipStyle}>Verifikasi sumber data {formatProvinceShortName(group.province)}</span>
        </div>
      ) : (
        <>
          <div className="statistik-city-rows" style={statistikCityRowsStyle}>
            {cities.map((city, index) => {
              const operators = Math.max(city.operators, 0)
              const posts = Math.min(Math.max(city.posts, 0), operators)
              const totalWidth = Math.max((operators / maxQuota) * 100, 8)
              const fillWidth = getPercentage(posts, operators)
              const showInside = fillWidth > 26
              return (
                <div
                  key={`${group.province}-${city.name}`}
                  className="statistik-city-row"
                  style={{ ...statistikCityRowStyle, marginTop: index === 0 ? 0 : 11 }}
                >
                  <div className="statistik-city-label" style={statistikCityLabelStyle}>{city.name}</div>
                  <div
                    className="statistik-city-stack"
                    style={{ ...statistikCityStackStyle, width: `${totalWidth}%` }}
                    title={`${city.name}: ${formatNumber(posts)}/${formatNumber(operators)} (${formatPercent(fillWidth, 0)})`}
                  >
                    <div
                      className="statistik-city-fill"
                      style={{
                        ...statistikCityFillBaseStyle,
                        animationDelay: `${0.45 + index * 0.04}s`,
                        width: `${clampPercent(fillWidth)}%`,
                      }}
                    >
                      {showInside && <span className="statistik-city-infill" style={statistikCityInfillStyle}>{formatNumber(posts)}</span>}
                    </div>
                    <div className="statistik-city-rest" style={statistikCityRestStyle} />
                    <span className="statistik-city-num" style={statistikCityNumStyle}>
                      {showInside ? formatNumber(operators) : `${formatNumber(posts)} / ${formatNumber(operators)}`}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="statistik-city-footer" style={statistikCityFooterStyle}>
            <span>Total kuota <b>{formatNumber(totals.operators)}</b></span>
            <span>Sudah lapor <b className="statistik-good-text">{formatNumber(totals.posts)}</b></span>
          </div>
        </>
      )}
    </div>
  )
}

function StatistikCityChart({ data }: { data: CityChartGroup[] }) {
  const sortedGroups = [...data].sort((a, b) => {
    const totalsA = getProvinceTotals(a.cities)
    const totalsB = getProvinceTotals(b.cities)
    return totalsB.posts - totalsA.posts || totalsB.operators - totalsA.operators || a.province.localeCompare(b.province)
  })
  const provinceCount = sortedGroups.length

  if (sortedGroups.length === 0) {
    return (
      <section className="statistik-city-section statistik-anim" style={{ ...statistikCitySectionStyle, animationDelay: '.42s' }}>
        <div className="statistik-card statistik-card-pad">
          <h2 className="statistik-city-title">Pelapor per Kota</h2>
          <div className="statistik-province-empty">Belum ada data kota/kabupaten</div>
        </div>
      </section>
    )
  }

  return (
    <section className="statistik-city-section statistik-anim" style={{ ...statistikCitySectionStyle, animationDelay: '.42s' }}>
      <div className="statistik-card-header statistik-city-section-header" style={{ padding: '0 2px' }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>Pelapor per Kota</h2>
          <div className="statistik-card-sub">
            {formatNumber(provinceCount)} provinsi · panjang bar = kuota operator, isian = sudah lapor
          </div>
        </div>
        <div className="statistik-legend-top">
          <span className="statistik-legend-item">
            <span className="statistik-swatch" style={{ background: 'var(--stat-good)' }} />
            Sudah Lapor
          </span>
          <span className="statistik-legend-item">
            <span
              className="statistik-swatch statistik-swatch-missing"
              style={{ background: 'var(--stat-chart-rest)', border: '1px solid var(--stat-chart-rest-border)' }}
            />
            Belum Lapor
          </span>
        </div>
      </div>

      <div className="statistik-city-columns" style={statistikCityColumnsStyle}>
        {sortedGroups.map((group) => (
          <StatistikProvinceCityCard key={group.province} group={group} />
        ))}
      </div>
    </section>
  )
}

function ProvinceChart({
  province,
  cities,
  colors,
  compactCluster,
}: {
  province: string
  cities: ProvinceChartItem[]
  colors: ReturnType<typeof getChartColors>
  compactCluster: boolean
}) {
  // Reverse so highest performer renders at top
  const chartData = [...cities].reverse()
  const maxVal = Math.max(...cities.map((d) => Math.max(d.posts, d.operators)), 1)
  const chartHeight = Math.max(160, chartData.length * 44 + 40)

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-4 flex flex-col gap-3" style={colors.panelStyle}>
      <div>
        <h4 className="text-xs font-semibold text-neutral-900 dark:text-white uppercase tracking-wide leading-tight" style={colors.titleStyle}>
          {province}
        </h4>
        <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-0.5" style={colors.mutedStyle}>
          {cities.length} kota/kab
        </p>
      </div>
      <div className="text-neutral-600 dark:text-neutral-300" style={{ color: colors.axis, height: chartHeight, minHeight: 160 }}>
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 54, left: 4, bottom: 0 }}
            barCategoryGap={compactCluster ? '12%' : '25%'}
            barGap={2}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              horizontal={false}
              stroke={colors.grid}
              strokeOpacity={0.5}
            />
            <XAxis
              type="number"
              domain={[0, maxVal]}
              tick={{ fontSize: 9, fill: 'currentColor' }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 9, fill: 'currentColor' }}
              width={112}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: string) => v.length > 16 ? v.slice(0, 15) + '…' : v}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: colors.tooltipBg,
                border: `1px solid ${colors.tooltipBorder}`,
                borderRadius: '8px',
                color: colors.tooltipText,
                fontSize: '11px',
                boxShadow: '0 8px 20px rgba(0,0,0,0.4)',
              }}
              labelStyle={{ color: colors.tooltipLabel, marginBottom: '3px', fontWeight: 600 }}
              formatter={(value, name) => [
                Number(value).toLocaleString('id-ID'),
                name === 'operators' ? 'Kuota Operator' : 'Pelapor',
              ]}
              cursor={{ fill: colors.cursor }}
            />
            <Bar dataKey="posts" fill={colors.primary} radius={[0, 3, 3, 0]} name="posts" maxBarSize={compactCluster ? 20 : 14}>
              <LabelList dataKey="posts" content={renderHorizontalBarValueLabel} />
            </Bar>
            <Bar dataKey="operators" fill={colors.secondary} radius={[0, 3, 3, 0]} name="operators" maxBarSize={compactCluster ? 20 : 14}>
              <LabelList dataKey="operators" content={renderHorizontalBarValueLabel} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default function CityBarChart({ data, variant = 'default', theme = 'light' }: Props) {
  const colors = getChartColors(variant, theme)
  const compactCluster = variant === 'statistik'

  if (variant === 'statistik') {
    return <StatistikCityChart data={data} />
  }

  if (data.length === 0) {
    return (
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-5" style={colors.panelStyle}>
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-4" style={colors.titleStyle}>Pelapor per Kota</h3>
        <div className="h-32 flex items-center justify-center text-neutral-400 text-sm" style={colors.mutedStyle}>Belum ada data</div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-white" style={colors.titleStyle}>Pelapor per Kota</h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5" style={colors.mutedStyle}>
            {data.length} provinsi · diurutkan berdasarkan rasio pelapor per operator
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-neutral-500 dark:text-neutral-400" style={colors.mutedStyle}>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.map((group) => (
          <ProvinceChart
            key={group.province}
            province={group.province}
            cities={group.cities}
            colors={colors}
            compactCluster={compactCluster}
          />
        ))}
      </div>
    </div>
  )
}
