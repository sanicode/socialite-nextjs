'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { searchRegCities } from '@/app/actions/tenants'

type City = { id: string; name: string }

type Props = {
  defaultCityId?: string
  defaultCityName?: string
  label?: string
}

export default function CitySelectFilter({ defaultCityId, defaultCityName, label = 'Kota' }: Props) {
  const [selected, setSelected] = useState<City | null>(
    defaultCityId && defaultCityName
      ? { id: defaultCityId, name: defaultCityName }
      : null
  )
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<City[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLLabelElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setOpen(false); return }
    setLoading(true)
    try {
      const res = await searchRegCities(q)
      setResults(res)
      setOpen(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => search(query), 300)
    return () => clearTimeout(t)
  }, [query, search])

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function pick(city: City) {
    setSelected(city)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  function clear() {
    setSelected(null)
    setQuery('')
    setResults([])
    setOpen(false)
    // Focus input after clearing
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const baseCls =
    'w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:focus:ring-white'

  return (
    <label ref={containerRef} className="relative flex flex-col gap-1">
      <span className="text-xs text-neutral-500 dark:text-neutral-400">{label}</span>

      {/* Hidden input submitted with form */}
      <input type="hidden" name="cityId" value={selected?.id ?? ''} />

      {selected ? (
        /* Show selected city with clear button */
        <div className="flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-950">
          <span className="flex-1 truncate text-neutral-900 dark:text-white">{selected.name}</span>
          <button
            type="button"
            onClick={clear}
            className="shrink-0 text-neutral-400 transition hover:text-neutral-700 dark:hover:text-neutral-200"
            aria-label="Hapus pilihan kota"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : (
        /* Search input */
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => { if (results.length > 0) setOpen(true) }}
            placeholder="Cari kota..."
            autoComplete="off"
            className={`${baseCls} pr-8`}
          />
          {loading ? (
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600 dark:border-neutral-600 dark:border-t-neutral-300" />
            </div>
          ) : (
            <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z" />
              </svg>
            </div>
          )}
        </div>
      )}

      {/* Dropdown */}
      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
          {results.map((city) => (
            <li key={city.id}>
              <button
                type="button"
                onMouseDown={() => pick(city)}
                className="w-full px-3 py-2 text-left text-sm text-neutral-900 transition hover:bg-neutral-50 dark:text-white dark:hover:bg-neutral-800"
              >
                {city.name}
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && !loading && results.length === 0 && query.trim() && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-3 text-sm text-neutral-500 shadow-lg dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400">
          Kota tidak ditemukan.
        </div>
      )}
    </label>
  )
}
