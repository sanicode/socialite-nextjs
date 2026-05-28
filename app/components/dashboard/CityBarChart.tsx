'use client'

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
