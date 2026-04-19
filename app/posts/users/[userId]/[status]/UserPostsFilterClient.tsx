'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useRef, useTransition } from 'react'

type Category = { id: string; name: string }

type Props = {
  categories: Category[]
  jenis: string
  category: string
  dateFrom: string
  dateTo: string
}

export default function UserPostsFilterClient({ categories, jenis, category, dateFrom, dateTo }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault()

    const formData = new FormData(formRef.current!)
    const params = new URLSearchParams()

    formData.forEach((value, key) => {
      if (value) params.set(key, value as string)
    })

    const url = params.toString() ? `${pathname}?${params.toString()}` : pathname
    startTransition(() => {
      router.push(url, { scroll: false })
    })
  }

  const hasFilter = !!(jenis || category || dateFrom || dateTo)

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4"
    >
      <div className="flex flex-wrap items-end gap-3">

        <div className="flex flex-col gap-1">
          <span className="text-xs text-neutral-500 dark:text-neutral-400">Tanggal Awal</span>
          <input
            type="date"
            name="dateFrom"
            defaultValue={dateFrom}
            className="px-3.5 py-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white transition"
          />
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs text-neutral-500 dark:text-neutral-400">Tanggal Akhir</span>
          <input
            type="date"
            name="dateTo"
            defaultValue={dateTo}
            className="px-3.5 py-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white transition"
          />
        </div>
        
        <div className="flex flex-col gap-1">
          <span className="text-xs text-neutral-500 dark:text-neutral-400">Jenis</span>
          <select
            name="jenis"
            defaultValue={jenis}
            className="px-3.5 py-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white transition"
          >
            <option value="">Semua jenis</option>
            <option value="upload">Upload</option>
            <option value="amplifikasi">Amplifikasi</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs text-neutral-500 dark:text-neutral-400">Media Sosial</span>
          <select
            name="category"
            defaultValue={category}
            className="px-3.5 py-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white transition"
          >
            <option value="">Semua</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2.5 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-sm font-semibold hover:bg-neutral-700 dark:hover:bg-neutral-100 transition disabled:opacity-50"
        >
          {isPending ? 'Memuat...' : 'Filter'}
        </button>

        {hasFilter && (
          <button
            type="button"
            onClick={() => {
              formRef.current?.reset()
              router.push(pathname, { scroll: false })
            }}
            className="px-4 py-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 text-sm text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition"
          >
            Reset
          </button>
        )}
      </div>
    </form>
  )
}
