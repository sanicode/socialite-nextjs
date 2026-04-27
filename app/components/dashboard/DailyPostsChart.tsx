'use client'

import { BarChart, Bar, LabelList, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { ChartItem } from '@/app/actions/dashboard'
import { renderVerticalBarValueLabel } from '@/app/components/dashboard/ChartValueLabels'

type Props = {
  data: ChartItem[]
}

export default function DailyPostsChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-5">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-4">Pelapor per Tanggal</h3>
        <div className="h-64 flex items-center justify-center text-neutral-400 text-sm">Belum ada data</div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-5">
      <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-4">Pelapor per Tanggal</h3>
      <div className="h-72 text-neutral-600 dark:text-neutral-300" style={{ minHeight: 288 }}>
        <ResponsiveContainer width="100%" height={288}>
          <BarChart data={data} margin={{ top: 18, left: 0, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-neutral-200)" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11 }}
              stroke="var(--color-neutral-400)"
            />
            <YAxis
              tick={{ fontSize: 11 }}
              stroke="var(--color-neutral-400)"
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--color-neutral-900)',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '12px',
              }}
            />
            <Bar dataKey="value" fill="#4E79A7" radius={[4, 4, 0, 0]} name="Jumlah Pelapor">
              <LabelList dataKey="value" content={renderVerticalBarValueLabel} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
