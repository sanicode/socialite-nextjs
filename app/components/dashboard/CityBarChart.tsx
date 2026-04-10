'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { ProvinceChartItem } from '@/app/actions/dashboard'

type Props = {
  data: ProvinceChartItem[]
}

export default function CityBarChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-5">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-4">Top 10 Kota</h3>
        <div className="h-64 flex items-center justify-center text-neutral-400 text-sm">Belum ada data</div>
      </div>
    )
  }

  // Reverse so highest performer is at top (recharts renders bottom-up)
  const chartData = [...data].reverse()
  const maxVal = Math.max(...data.map((d) => d.posts + d.operators), 1)

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Top 10 Kota</h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">Diurutkan berdasarkan rasio posting per operator</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-neutral-500 dark:text-neutral-400">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: '#EDC948' }} />
            Kuota Operator
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: '#4E79A7' }} />
            Data Masuk
          </span>
        </div>
      </div>
      <div style={{ height: Math.max(280, chartData.length * 36 + 40) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 40, left: 8, bottom: 0 }}
            barCategoryGap="25%"
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-neutral-200, #e5e5e5)" />
            <XAxis
              type="number"
              domain={[0, maxVal]}
              tick={{ fontSize: 10, fill: 'currentColor' }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              tickFormatter={(v) => v.toLocaleString('id-ID')}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 11, fill: 'currentColor' }}
              width={130}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: 'none',
                borderRadius: '8px',
                color: '#f1f5f9',
                fontSize: '12px',
              }}
              formatter={(value, name) => [
                Number(value).toLocaleString('id-ID'),
                name === 'operators' ? 'Kuota Operator' : 'Data Masuk',
              ]}
              cursor={{ fill: 'rgba(148,163,184,0.08)' }}
            />
            <Bar dataKey="operators" stackId="a" fill="#EDC948" radius={[0, 0, 0, 0]} name="operators" />
            <Bar
              dataKey="posts"
              stackId="a"
              fill="#4E79A7"
              radius={[0, 4, 4, 0]}
              name="posts"
              label={{ position: 'right', fontSize: 10, fill: 'currentColor', formatter: (v: number) => v > 0 ? v.toLocaleString('id-ID') : '' }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
