'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { TABLE_PAGE_SIZE_OPTIONS, type TablePageSize } from '@/app/lib/table-pagination'

type Props = {
  value: TablePageSize
  label?: string
}

export default function TablePageSizeSelect({ value, label = 'entri per halaman' }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  function handleChange(nextValue: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('pageSize', nextValue)
    params.delete('page')

    const qs = params.toString()
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname)
    })
  }

  return (
    <label className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
      <select
        value={String(value)}
        disabled={isPending}
        onChange={(e) => handleChange(e.target.value)}
        className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 transition focus:outline-none focus:ring-2 focus:ring-neutral-900 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:focus:ring-white"
      >
        {TABLE_PAGE_SIZE_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option === 'all' ? 'All' : option}
          </option>
        ))}
      </select>
      <span>{label}</span>
    </label>
  )
}

