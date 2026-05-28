'use client'

import type { CSSProperties } from 'react'
import { BarChart, Bar, LabelList, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { ChartItem } from '@/app/actions/dashboard'
import { renderVerticalBarValueLabel } from '@/app/components/dashboard/ChartValueLabels'

type TrendChartItem = ChartItem & {
  date?: string
  dailyValue?: number
}

type Props = {
  data: TrendChartItem[]
  variant?: 'default' | 'statistik'
  theme?: 'light' | 'dark'
}

type TrendBarItem = TrendChartItem & {
  projected?: boolean
}

const statistikTrendSectionStyle: CSSProperties = {
  padding: '22px 24px',
}

const statistikTrendChartStyle: CSSProperties = {
  height: 260,
  marginTop: 22,
  overflowX: 'auto',
  overflowY: 'hidden',
  paddingBottom: 26,
  paddingLeft: 44,
  position: 'relative',
}

const statistikTrendGridStyle: CSSProperties = {
  bottom: 26,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  left: 0,
  pointerEvents: 'none',
  position: 'absolute',
  right: 0,
  top: 0,
}

const statistikTrendGridLineStyle: CSSProperties = {
  borderTop: '1px dashed var(--stat-line)',
  position: 'relative',
}

const statistikTrendGridLabelStyle: CSSProperties = {
  color: 'var(--stat-faint)',
  fontFamily: 'var(--stat-mono)',
  fontSize: 10.5,
  left: -42,
  position: 'absolute',
  textAlign: 'right',
  top: -8,
  width: 34,
}

const statistikTrendBarsStyle: CSSProperties = {
  alignItems: 'flex-end',
  bottom: 26,
  display: 'flex',
  gap: 14,
  left: 0,
  padding: '0 6px',
  position: 'absolute',
  right: 0,
  top: 0,
}

const statistikTrendColumnStyle: CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  flex: '1 0 28px',
  flexDirection: 'column',
  gap: 7,
  height: '100%',
  justifyContent: 'flex-end',
  minWidth: 28,
}

const statistikTrendBarStyle: CSSProperties = {
  background: 'linear-gradient(180deg, #19a596, var(--stat-good))',
  borderRadius: '8px 8px 3px 3px',
  boxShadow: '0 -2px 10px -4px rgba(14, 138, 125, 0.5)',
  maxWidth: 54,
  minHeight: 1,
  position: 'relative',
  transformOrigin: 'bottom',
  width: '100%',
}

const statistikTrendProjectionBarStyle: CSSProperties = {
  backgroundColor: '#cfeae5',
  backgroundImage: 'repeating-linear-gradient(180deg, #bfe6e1 0, #bfe6e1 6px, #d8f0ec 6px, #d8f0ec 12px)',
  boxShadow: 'none',
}

const statistikTrendValueStyle: CSSProperties = {
  color: 'var(--stat-good)',
  fontFamily: 'var(--stat-mono)',
  fontSize: 11,
  fontWeight: 700,
  left: '50%',
  position: 'absolute',
  top: -22,
  transform: 'translateX(-50%)',
  whiteSpace: 'nowrap',
}

const statistikTrendXLabelStyle: CSSProperties = {
  color: 'var(--stat-muted)',
  fontFamily: 'var(--stat-mono)',
  fontSize: 10.5,
  whiteSpace: 'nowrap',
}

const statistikTrendXAxisStyle: CSSProperties = {
  background: 'var(--stat-line)',
  bottom: 0,
  height: 1,
  left: 44,
  position: 'absolute',
  right: 0,
}

const statistikTrendNoteStyle: CSSProperties = {
  alignItems: 'center',
  color: 'var(--stat-muted)',
  display: 'flex',
  flexWrap: 'wrap',
  fontSize: 11.5,
  gap: 16,
  marginTop: 6,
}

function getChartColors(variant: Props['variant'], theme: Props['theme']) {
  if (variant !== 'statistik') {
    return {
      primary: '#4E79A7',
      grid: 'var(--color-neutral-200, #e5e5e5)',
      tooltipBg: 'var(--color-neutral-900, #171717)',
      tooltipText: '#ffffff',
      panelStyle: {},
      titleStyle: {},
      mutedStyle: {},
      axis: 'var(--color-neutral-400)',
    }
  }

  const isDark = theme === 'dark'
  return {
    primary: `var(--stat-good, ${isDark ? '#37d39a' : '#0e8a7d'})`,
    grid: 'var(--dashboard-chart-grid, var(--stat-line))',
    tooltipBg: 'var(--dashboard-chart-tooltip-bg, #16202e)',
    tooltipText: 'var(--dashboard-chart-tooltip-text, #ffffff)',
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

function parseIsoDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function formatIsoDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + days)
  return nextDate
}

function isSameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
}

function getMonthLabel(value?: string) {
  if (!value) return 'Bulan aktif'
  return parseIsoDate(value).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
}

function getNiceMax(value: number) {
  if (value <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const normalized = value / magnitude
  const rounded = normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10
  return rounded * magnitude
}

function getTrendBars(data: TrendChartItem[]) {
  const bars: TrendBarItem[] = [...data]
  const last = data[data.length - 1]
  if (!last?.date) return bars

  const lastDate = parseIsoDate(last.date)
  const projectedDate = addDays(lastDate, 1)
  if (!isSameMonth(lastDate, projectedDate)) return bars

  const totalActual = data.reduce((sum, row) => sum + row.value, 0)
  const averageDaily = Math.max(1, Math.round(totalActual / Math.max(data.length, 1)))
  bars.push({
    date: formatIsoDate(projectedDate),
    name: projectedDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
    value: averageDaily,
    dailyValue: averageDaily,
    projected: true,
  })

  return bars
}

function StatistikTrendChart({ data, theme }: { data: TrendChartItem[]; theme: Props['theme'] }) {
  const colors = getChartColors('statistik', theme)
  const bars = getTrendBars(data)
  const maxValue = Math.max(...bars.map((row) => row.value), 1)
  const yMax = getNiceMax(maxValue)
  const ticks = [yMax, Math.round(yMax * 0.75), Math.round(yMax * 0.5), Math.round(yMax * 0.25), 0]
  const actualData = data.filter((row) => !('projected' in row))
  const lastActual = actualData[actualData.length - 1]
  const monthLabel = getMonthLabel(lastActual?.date)
  const totalActual = actualData.reduce((sum, row) => sum + row.value, 0)
  const averageDaily = Math.round(totalActual / Math.max(actualData.length, 1))
  const minChartWidth = Math.max(680, bars.length * 42)

  return (
    <section
      className="statistik-card statistik-trend statistik-anim"
      style={{ ...colors.panelStyle, ...statistikTrendSectionStyle, animationDelay: '.46s' }}
    >
      <div className="statistik-card-header">
        <div>
          <h2>Tren Pelapor Per Bulan</h2>
          <div className="statistik-card-sub">
            {monthLabel} · {formatNumber(actualData.length)} tanggal berisi data · jumlah pelapor per tanggal
          </div>
        </div>
        <div className="statistik-legend-top">
          <span className="statistik-legend-item">
            <span className="statistik-swatch" style={{ background: 'var(--stat-good)' }} />
            Aktual
          </span>
          <span className="statistik-legend-item">
            <span className="statistik-swatch" style={{ background: '#cfeae5' }} />
            Proyeksi
          </span>
        </div>
      </div>

      <div className="statistik-trend-chart" style={statistikTrendChartStyle}>
        <div style={{ height: '100%', minWidth: minChartWidth, position: 'relative' }}>
          <div className="statistik-trend-gridlines" style={statistikTrendGridStyle}>
            {ticks.map((tick) => (
              <div key={tick} className="statistik-trend-gridline" style={statistikTrendGridLineStyle}>
                <span style={statistikTrendGridLabelStyle}>{formatNumber(tick)}</span>
              </div>
            ))}
          </div>
          <div className="statistik-trend-bars" style={statistikTrendBarsStyle}>
            {bars.map((row, index) => {
              const height = row.value > 0 ? Math.max(4, (row.value / yMax) * 100) : 0
              return (
                <div key={`${row.date ?? row.name}-${row.projected ? 'projected' : 'actual'}`} className="statistik-trend-col" style={statistikTrendColumnStyle}>
                  <div
                    className={`statistik-trend-bar ${row.projected ? 'projected' : ''}`}
                    style={{
                      ...statistikTrendBarStyle,
                      ...(row.projected ? statistikTrendProjectionBarStyle : {}),
                      animation: 'statistik-grow-y 1s cubic-bezier(0.2, 0.7, 0.2, 1) backwards',
                      animationDelay: `${0.5 + index * 0.04}s`,
                      height: `${height}%`,
                    }}
                    title={`${row.name}: ${row.projected ? 'proyeksi ' : ''}${formatNumber(row.value)} pelapor`}
                  >
                    {row.value > 0 && (
                      <span style={{ ...statistikTrendValueStyle, color: row.projected ? 'var(--stat-muted)' : 'var(--stat-good)' }}>
                        {row.projected ? `~${formatNumber(row.value)}` : formatNumber(row.value)}
                      </span>
                    )}
                  </div>
                  <span className="statistik-trend-x" style={statistikTrendXLabelStyle}>{row.name}</span>
                </div>
              )
            })}
          </div>
          <div className="statistik-trend-xaxis" style={statistikTrendXAxisStyle} />
        </div>
      </div>

      <div className="statistik-trend-note" style={statistikTrendNoteStyle}>
        <span className="statistik-legend-item">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--stat-good)" strokeWidth="2.4" aria-hidden="true">
            <path d="m23 6-9.5 9.5-5-5L1 18" />
            <path d="M17 6h6v6" />
          </svg>
          Rata-rata <b className="statistik-mono" style={{ color: 'var(--stat-good)' }}>+{formatNumber(Math.max(averageDaily, 0))}/tanggal data</b> pada bulan aktif
        </span>
        <span>Catatan: angka mengikuti filter status, provinsi, dan kota yang sedang aktif.</span>
      </div>
    </section>
  )
}

export default function DailyPostsChart({ data, variant = 'default', theme = 'light' }: Props) {
  const colors = getChartColors(variant, theme)

  if (variant === 'statistik') {
    return <StatistikTrendChart data={data} theme={theme} />
  }

  if (data.length === 0) {
    return (
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-5" style={colors.panelStyle}>
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-4" style={colors.titleStyle}>Pelapor per Tanggal</h3>
        <div className="h-64 flex items-center justify-center text-neutral-400 text-sm" style={colors.mutedStyle}>Belum ada data</div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-5" style={colors.panelStyle}>
      <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-4" style={colors.titleStyle}>Pelapor per Tanggal</h3>
      <div className="h-72 text-neutral-600 dark:text-neutral-300" style={{ color: colors.axis, minHeight: 288 }}>
        <ResponsiveContainer width="100%" height={288}>
          <BarChart data={data} margin={{ top: 18, left: 0, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={colors.grid} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: colors.axis }}
              stroke={colors.axis}
            />
            <YAxis
              tick={{ fontSize: 11, fill: colors.axis }}
              stroke={colors.axis}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: colors.tooltipBg,
                border: 'none',
                borderRadius: '8px',
                color: colors.tooltipText,
                fontSize: '12px',
              }}
            />
            <Bar dataKey="value" fill={colors.primary} radius={[4, 4, 0, 0]} name="Jumlah Pelapor">
              <LabelList dataKey="value" content={renderVerticalBarValueLabel} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
