'use client'

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type ChartRow = {
  label: string
  [key: string]: string | number
}

type Series = {
  key: string
  label: string
  color: string
}

type Props = {
  data: ChartRow[]
  series: Series[]
}

export default function SummaryLineChart({ data, series }: Props) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-4 text-center">
        <h2 className="text-lg font-bold uppercase tracking-wide text-neutral-700 dark:text-neutral-200">
          Dashboard
        </h2>
      </div>

      <div className="h-[420px] text-neutral-700 dark:text-neutral-300">
        <ResponsiveContainer width="100%" height={420}>
          <LineChart data={data} margin={{ top: 10, right: 36, left: 0, bottom: 22 }}>
            <CartesianGrid stroke="var(--color-neutral-200, #e5e5e5)" vertical={false} />
            <XAxis
              dataKey="label"
              interval={0}
              angle={0}
              tick={{ fontSize: 12, fill: 'currentColor' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--color-neutral-300, #d4d4d4)' }}
              label={{
                value: 'TANGGAL',
                position: 'insideBottom',
                offset: -14,
                fill: 'currentColor',
                fontSize: 12,
                fontWeight: 700,
              }}
            />
            <YAxis
              tick={{ fontSize: 12, fill: 'currentColor' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--color-neutral-300, #d4d4d4)' }}
              allowDecimals={false}
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
              labelStyle={{ color: '#94a3b8', marginBottom: '4px', fontWeight: 700 }}
              formatter={(value, name) => [
                Number(value).toLocaleString('id-ID'),
                series.find((item) => item.key === name)?.label ?? name,
              ]}
            />
            <Legend
              align="right"
              verticalAlign="middle"
              layout="vertical"
              wrapperStyle={{ right: 0, fontSize: 13 }}
            />
            {series.map((item) => (
              <Line
                key={item.key}
                type="monotone"
                dataKey={item.key}
                name={item.label}
                stroke={item.color}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

