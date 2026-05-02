'use client'

import { BarChart, Bar, LabelList, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { ChartItem } from '@/app/actions/dashboard'
import { renderVerticalBarValueLabel } from '@/app/components/dashboard/ChartValueLabels'

type Props = {
  data: ChartItem[]
  variant?: 'default' | 'statistik'
  theme?: 'light' | 'dark'
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

  if (theme === 'light') {
    return {
      primary: '#7aa3ad',
      grid: '#d9e4e6',
      tooltipBg: '#263b43',
      tooltipText: '#f8fafc',
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
    grid: '#263b43',
    tooltipBg: '#101f25',
    tooltipText: '#f8fafc',
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

export default function DailyPostsChart({ data, variant = 'default', theme = 'light' }: Props) {
  const colors = getChartColors(variant, theme)

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
