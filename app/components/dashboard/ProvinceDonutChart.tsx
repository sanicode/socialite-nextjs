'use client'

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
import type { ProvinceChartItem } from '@/app/actions/dashboard'
import { renderHorizontalBarValueLabel } from '@/app/components/dashboard/ChartValueLabels'

type Props = {
  data: ProvinceChartItem[]
  summary?: ReportStatusSummary
  variant?: 'default' | 'statistik'
  theme?: 'light' | 'dark'
}

type ReportStatusSummary = {
  totalOperators: number
  reportedOperators: number
  missingOperators: number
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

  if (theme === 'light') {
    return {
      primary: '#7aa3ad',
      secondary: '#e8782d',
      reported: '#7aa3ad',
      missing: '#e8782d',
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
    reported: '#8eb4bd',
    missing: '#f08a3d',
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

function formatNumber(value: number) {
  return value.toLocaleString('id-ID')
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
          Status Operator
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

export default function ProvinceDonutChart({ data, summary, variant = 'default', theme = 'light' }: Props) {
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
