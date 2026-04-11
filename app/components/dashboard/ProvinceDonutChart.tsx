'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { ProvinceChartItem } from '@/app/actions/dashboard'

type Props = {
  data: ProvinceChartItem[]
}

export default function ProvinceDonutChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-5">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-4">Laporan per Propinsi</h3>
        <div className="h-64 flex items-center justify-center text-neutral-400 text-sm">Belum ada data</div>
      </div>
    )
  }

  // Reverse so highest performer renders at top (recharts fills bottom-up)
  const chartData = [...data].reverse()
  const maxVal = Math.max(...data.map((d) => Math.max(d.posts, d.operators)), 1)

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-5">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Laporan per Propinsi</h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Diurutkan berdasarkan rasio posting per operator — tertinggi ke terendah
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-neutral-500 dark:text-neutral-400 shrink-0">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: '#4E79A7' }} />
            Data Masuk
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: '#EDC948' }} />
            Kuota Operator
          </span>
        </div>
      </div>

      <div style={{ height: Math.max(300, chartData.length * 44 + 40), minHeight: 300 }}>
        <ResponsiveContainer width="100%" height={Math.max(300, chartData.length * 44 + 40)}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 48, left: 8, bottom: 0 }}
            barCategoryGap="25%"
            barGap={3}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              horizontal={false}
              stroke="var(--color-neutral-200, #e5e5e5)"
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
                backgroundColor: '#0f172a',
                border: '1px solid #1e293b',
                borderRadius: '10px',
                color: '#e2e8f0',
                fontSize: '12px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.4)',
              }}
              labelStyle={{ color: '#94a3b8', marginBottom: '4px', fontWeight: 600 }}
              formatter={(value, name) => [
                Number(value).toLocaleString('id-ID'),
                name === 'operators' ? 'Kuota Operator' : 'Data Masuk',
              ]}
              cursor={{ fill: 'rgba(148,163,184,0.06)' }}
            />
            <Bar dataKey="posts" fill="#4E79A7" radius={[0, 4, 4, 0]} name="posts" maxBarSize={16} />
            <Bar dataKey="operators" fill="#EDC948" radius={[0, 4, 4, 0]} name="operators" maxBarSize={16} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
