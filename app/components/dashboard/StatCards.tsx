import type { DashboardStats } from '@/app/actions/dashboard'

type Props = {
  stats: DashboardStats
}

export default function StatCards({ stats }: Props) {
  const cards = [
    {
      label: 'Total Operator',
      value: stats.userCount,
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
      ),
    },
    {
      label: 'Jumlah Pelapor',
      value: stats.postCount,
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      ),
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-5 flex items-center gap-4"
        >
          <div className="p-3 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
            {card.icon}
          </div>
          <div>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">{card.label}</p>
            <p className="text-2xl font-bold text-neutral-900 dark:text-white mt-0.5">
              {card.value.toLocaleString('id-ID')}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
