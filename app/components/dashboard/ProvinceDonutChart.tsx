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
import type { ProvinceChartItem } from '@/app/actions/dashboard'
import { renderHorizontalBarValueLabel } from '@/app/components/dashboard/ChartValueLabels'

type Props = {
  data: ProvinceChartItem[]
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

  if (theme === 'light') {
    return {
      primary: '#7aa3ad',
      secondary: '#e8782d',
      grid: '#d9e4e6',
      cursor: 'rgba(122, 163, 173, 0.1)',
      tooltipBg: '#263b43',
      tooltipBorder: '#405962',
      tooltipText: '#f8fafc',
      tooltipLabel: '#b7c8cd',
      panelStyle: {
        background: 'linear-gradient(135deg, #ffffff 0%, #f6fafb 100%)',
        borderColor: '#c7d8dc',
        boxShadow: '0 16px 36px rgba(64, 89, 98, 0.1)',
      },
      titleStyle: { color: '#263b43' },
      mutedStyle: { color: '#6d858c' },
      axis: '#405962',
    }
  }

  return {
    primary: '#8eb4bd',
    secondary: '#f08a3d',
    grid: '#263b43',
    cursor: 'rgba(142, 180, 189, 0.09)',
    tooltipBg: '#101f25',
    tooltipBorder: '#405962',
    tooltipText: '#f8fafc',
    tooltipLabel: '#b7c8cd',
    panelStyle: {
      background: 'linear-gradient(135deg, #152b32 0%, #102129 100%)',
      borderColor: '#28434b',
      boxShadow: '0 18px 38px rgba(0, 0, 0, 0.26)',
    },
    titleStyle: { color: '#f8fafc' },
    mutedStyle: { color: '#b7c8cd' },
    axis: '#b7c8cd',
  }
}

export default function ProvinceDonutChart({ data, variant = 'default', theme = 'light' }: Props) {
  const colors = getChartColors(variant, theme)

  if (data.length === 0) {
    return (
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-5" style={colors.panelStyle}>
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-4" style={colors.titleStyle}>Pelapor per Provinsi</h3>
        <div className="h-64 flex items-center justify-center text-neutral-400 text-sm" style={colors.mutedStyle}>Belum ada data</div>
      </div>
    )
  }

  // Reverse so highest performer renders at top (recharts fills bottom-up)
  const chartData = [...data].reverse()
  const maxVal = Math.max(...data.map((d) => Math.max(d.posts, d.operators)), 1)

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-5" style={colors.panelStyle}>
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-white" style={colors.titleStyle}>Pelapor per Provinsi</h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5" style={colors.mutedStyle}>
            Diurutkan berdasarkan rasio pelapor per operator — tertinggi ke terendah
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-neutral-500 dark:text-neutral-400 shrink-0" style={colors.mutedStyle}>
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

      <div
        className="text-neutral-600 dark:text-neutral-300"
        style={{ color: colors.axis, height: Math.max(300, chartData.length * 44 + 40), minHeight: 300 }}
      >
        <ResponsiveContainer width="100%" height={Math.max(300, chartData.length * 44 + 40)}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 72, left: 8, bottom: 0 }}
            barCategoryGap="25%"
            barGap={3}
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
            <Bar dataKey="posts" fill={colors.primary} radius={[0, 4, 4, 0]} name="posts" maxBarSize={16}>
              <LabelList dataKey="posts" content={renderHorizontalBarValueLabel} />
            </Bar>
            <Bar dataKey="operators" fill={colors.secondary} radius={[0, 4, 4, 0]} name="operators" maxBarSize={16}>
              <LabelList dataKey="operators" content={renderHorizontalBarValueLabel} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
