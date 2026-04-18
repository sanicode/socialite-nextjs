"use client"

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function SearchInput({ defaultValue }: { defaultValue: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [value, setValue] = useState(defaultValue)

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set('search', value)
      } else {
        params.delete('search')
      }
      router.push(`${pathname}?${params.toString()}`)
    }, 400) // Debounce 400ms

    return () => clearTimeout(timeoutId)
  }, [value, pathname, router, searchParams])

  return (
    <input
      type="search"
      placeholder="Cari nama atau email..."
      value={value}
      onChange={(e) => setValue(e.target.value)}
      className="flex-1 min-w-[280px] px-3.5 py-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 transition"
    />
  )
}