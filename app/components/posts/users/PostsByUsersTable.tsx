'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useTransition } from 'react'

type Row = {
  provinsi: string
  kabupaten_kota: string
  email: string
  operator: string
  user_id: number
  pending_posts: number
  valid_posts: number
  invalid_posts: number
}

type Props = {
  rows: Row[]
  sortBy: string
  sortDir: string
}

const COLUMNS: { key: string; label: string; align: 'left' | 'right' }[] = [
  { key: 'provinsi',       label: 'Provinsi', align: 'left' },
  { key: 'kabupaten_kota', label: 'Kota',     align: 'left' },
  { key: 'operator',       label: 'Nama',     align: 'left' },
  { key: 'email',          label: 'Email',    align: 'left' },
  { key: 'pending_posts',  label: 'Pending',  align: 'right' },
  { key: 'valid_posts',    label: 'Valid',    align: 'right' },
  { key: 'invalid_posts',  label: 'Invalid',  align: 'right' },
]

export default function PostsByUsersTable({ rows, sortBy, sortDir }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  function handleSort(col: string) {
    const newDir = sortBy === col && sortDir === 'asc' ? 'desc' : 'asc'
    const params = new URLSearchParams(searchParams.toString())
    params.set('sortBy', col)
    params.set('sortDir', newDir)
    params.delete('page')
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false })
    })
  }

  function SortIcon({ col }: { col: string }) {
    if (sortBy !== col) return (
      <svg className="w-3.5 h-3.5 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    )
    return sortDir === 'asc' ? (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    )
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50">
              {COLUMNS.map(({ key, label, align }) => (
                <th
                  key={key}
                  className={`px-4 py-3 text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide text-${align}`}
                >
                  <button
                    onClick={() => handleSort(key)}
                    className={`inline-flex items-center gap-1 hover:text-neutral-900 dark:hover:text-white transition ${align === 'right' ? 'flex-row-reverse w-full justify-start' : ''}`}
                  >
                    {label}
                    <SortIcon col={key} />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-neutral-400 dark:text-neutral-500">
                  Tidak ada data
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={i} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition">
                  <td className="px-4 py-3 text-neutral-700 dark:text-neutral-300">{row.provinsi ?? '-'}</td>
                  <td className="px-4 py-3 text-neutral-700 dark:text-neutral-300">{row.kabupaten_kota ?? '-'}</td>
                  <td className="px-4 py-3 font-medium text-neutral-900 dark:text-white">{row.operator}</td>
                  <td className="px-4 py-3 text-neutral-500 dark:text-neutral-400">{row.email}</td>
                  <td className="px-4 py-3 text-right">
                    <a
                      href={`/posts/users/${row.user_id}/pending`}
                      className="inline-flex items-center justify-center min-w-[2.5rem] px-3 py-1.5 rounded-lg font-semibold text-sm bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition"
                    >
                      {row.pending_posts}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <a
                      href={`/posts/users/${row.user_id}/valid`}
                      className="inline-flex items-center justify-center min-w-[2.5rem] px-3 py-1.5 rounded-lg font-semibold text-sm bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition"
                    >
                      {row.valid_posts}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <a
                      href={`/posts/users/${row.user_id}/invalid`}
                      className="inline-flex items-center justify-center min-w-[2.5rem] px-3 py-1.5 rounded-lg font-semibold text-sm bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition"
                    >
                      {row.invalid_posts}
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
