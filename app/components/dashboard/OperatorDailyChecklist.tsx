import { Fragment } from 'react'
import Link from 'next/link'

export type OperatorChecklistStatus = 'missing' | 'pending' | 'valid' | 'invalid'

export type OperatorChecklistCell = {
  status: OperatorChecklistStatus
  label: string
  totalCount: number
  validCount: number
  pendingCount: number
  invalidCount: number
  postId?: string
}

export type OperatorChecklistRow = {
  key: 'upload' | 'amplifikasi'
  label: string
  href: string
  cells: Record<string, OperatorChecklistCell>
}

type Props = {
  dateLabel: string
  platforms: string[]
  rows: OperatorChecklistRow[]
}

function getStatusHeaderClass(status: Exclude<OperatorChecklistStatus, 'missing'>) {
  const base = 'border border-neutral-200 px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wide dark:border-neutral-800'

  switch (status) {
    case 'pending':
      return `${base} bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-300`
    case 'valid':
      return `${base} bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300`
    case 'invalid':
      return `${base} bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-300`
  }
}

function getCountCellClass(status: Exclude<OperatorChecklistStatus, 'missing'>, count: number) {
  const base = 'border border-neutral-200 px-2.5 py-2 text-center text-sm font-semibold tabular-nums dark:border-neutral-800'

  if (count === 0) {
    return `${base} bg-white text-neutral-400 dark:bg-neutral-900 dark:text-neutral-600`
  }

  switch (status) {
    case 'pending':
      return `${base} bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-300`
    case 'valid':
      return `${base} bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300`
    case 'invalid':
      return `${base} bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-300`
  }
}

export default function OperatorDailyChecklist({ dateLabel, platforms, rows }: Props) {
  const totalTasks = rows.reduce((total, row) => {
    return total + platforms.reduce((rowTotal, platform) => rowTotal + (row.cells[platform]?.totalCount ?? 0), 0)
  }, 0)
  const completedTasks = rows.reduce((total, row) => {
    return total + platforms.reduce((rowTotal, platform) => rowTotal + (row.cells[platform]?.validCount ?? 0), 0)
  }, 0)
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Dashboard Operator</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Checklist tugas hari ini untuk laporan upload, amplifikasi, dan YouTube.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Tanggal</p>
          <p className="mt-1 text-lg font-semibold text-neutral-900 dark:text-white">{dateLabel}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Tugas Valid</p>
          <p className="mt-1 text-lg font-semibold text-neutral-900 dark:text-white">
            {completedTasks} / {totalTasks}
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Progress</p>
          <div className="mt-3 h-2 rounded-full bg-neutral-100 dark:bg-neutral-800">
            <div className="h-2 rounded-full bg-neutral-900 dark:bg-white" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">{progress}% selesai</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-col gap-3 border-b border-neutral-200 px-5 py-4 dark:border-neutral-800 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">Checklist Tugas Hari Ini</h2>
          </div>
          <div className="flex gap-2">
            <Link
              href="/posts/upload/new"
              className="rounded-lg bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
            >
              Tambah Upload
            </Link>
            <Link
              href="/posts/amplifikasi/new"
              className="rounded-lg border border-neutral-200 px-3 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
            >
              Tambah Amplifikasi
            </Link>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse text-sm">
            <thead>
              <tr className="bg-neutral-50 dark:bg-neutral-800/50">
                <th
                  rowSpan={2}
                  className="border border-neutral-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:border-neutral-800 dark:text-neutral-400"
                >
                  Jenis Tugas
                </th>
                {platforms.map((platform) => (
                  <th
                    key={platform}
                    colSpan={3}
                    className="border border-neutral-200 px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:border-neutral-800 dark:text-neutral-400"
                  >
                    {platform.toUpperCase()}
                  </th>
                ))}
              </tr>
              <tr className="bg-neutral-50 dark:bg-neutral-800/50">
                {platforms.map((platform) => (
                  <Fragment key={platform}>
                    <th scope="col" className={getStatusHeaderClass('pending')}>
                      PENDING
                    </th>
                    <th scope="col" className={getStatusHeaderClass('valid')}>
                      VALID
                    </th>
                    <th scope="col" className={getStatusHeaderClass('invalid')}>
                      INVALID
                    </th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <td className="border border-neutral-200 px-4 py-4 font-medium uppercase tracking-wide text-neutral-900 dark:border-neutral-800 dark:text-white">
                    {row.label}
                  </td>
                  {platforms.map((platform) => {
                    const cell =
                      row.cells[platform] ??
                      {
                        status: 'missing' as const,
                        label: 'Belum dikirim',
                        totalCount: 0,
                        validCount: 0,
                        pendingCount: 0,
                        invalidCount: 0,
                      }
                    const statusCells: Array<{
                      key: Exclude<OperatorChecklistStatus, 'missing'>
                      count: number
                    }> = [
                      { key: 'pending', count: cell.pendingCount },
                      { key: 'valid', count: cell.validCount },
                      { key: 'invalid', count: cell.invalidCount },
                    ]
                    return (
                      <Fragment key={platform}>
                        {statusCells.map(({ key, count }) => (
                          <td key={`${platform}-${key}`} className={getCountCellClass(key, count)}>
                            {count}
                          </td>
                        ))}
                      </Fragment>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
