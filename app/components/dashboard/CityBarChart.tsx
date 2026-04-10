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
import type { CityChartGroup, ProvinceChartItem } from '@/app/actions/dashboard'

type Props = {
  data: CityChartGroup[]
}

function ProvinceChart({ province, cities }: { province: string; cities: ProvinceChartItem[] }) {
  // Reverse so highest performer renders at top
  const chartData = [...cities].reverse()
  const maxVal = Math.max(...cities.map((d) => Math.max(d.posts, d.operators)), 1)
  const chartHeight = Math.max(160, chartData.length * 44 + 40)

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-4 flex flex-col gap-3">
      <div>
        <h4 className="text-xs font-semibold text-neutral-900 dark:text-white uppercase tracking-wide leading-tight">
          {province}
        </h4>
        <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-0.5">
          {cities.length} kota/kab
        </p>
      </div>
      <div style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 8, left: 4, bottom: 0 }}
            barCategoryGap="25%"
            barGap={2}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              horizontal={false}
              stroke="var(--color-neutral-200, #e5e5e5)"
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
                backgroundColor: '#0f172a',
                border: '1px solid #1e293b',
                borderRadius: '8px',
                color: '#e2e8f0',
                fontSize: '11px',
                boxShadow: '0 8px 20px rgba(0,0,0,0.4)',
              }}
              labelStyle={{ color: '#94a3b8', marginBottom: '3px', fontWeight: 600 }}
              formatter={(value, name) => [
                Number(value).toLocaleString('id-ID'),
                name === 'operators' ? 'Kuota Operator' : 'Data Masuk',
              ]}
              cursor={{ fill: 'rgba(148,163,184,0.06)' }}
            />
            <Bar dataKey="posts" fill="#4E79A7" radius={[0, 4, 4, 0]} name="posts" maxBarSize={14} />
            <Bar dataKey="operators" fill="#EDC948" radius={[0, 4, 4, 0]} name="operators" maxBarSize={14} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default function CityBarChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-5">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-4">Laporan per Kota</h3>
        <div className="h-32 flex items-center justify-center text-neutral-400 text-sm">Belum ada data</div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Laporan per Kota</h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            {data.length} provinsi · diurutkan berdasarkan rasio posting per operator
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-neutral-500 dark:text-neutral-400">
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.map((group) => (
          <ProvinceChart key={group.province} province={group.province} cities={group.cities} />
        ))}
      </div>
    </div>
  )
}
