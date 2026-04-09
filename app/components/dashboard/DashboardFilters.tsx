'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { getCities } from '@/app/actions/dashboard'

type Props = {
  provinces: { id: number; name: string }[]
  isAdmin: boolean
}

export default function DashboardFilters({ provinces, isAdmin }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [cities, setCities] = useState<{ id: string; name: string }[]>([])

  const currentProvinceId = searchParams.get('provinceId') ?? ''
  const currentCityId = searchParams.get('cityId') ?? ''

  useEffect(() => {
    if (currentProvinceId) {
      getCities(currentProvinceId).then(setCities)
    } else {
      setCities([])
    }
  }, [currentProvinceId])

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    // Reset city when province changes
    if (key === 'provinceId') {
      params.delete('cityId')
    }
    router.push(`/dashboard?${params.toString()}`)
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-end gap-3 flex-wrap">
      <label className="flex flex-col gap-1">
        <span className="text-xs text-neutral-500 dark:text-neutral-400">Tanggal Awal</span>
        <input
          type="date"
          defaultValue={searchParams.get('dateFrom') ?? ''}
          onChange={(e) => updateParam('dateFrom', e.target.value)}
          className="sm:w-44 px-3.5 py-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white transition"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-neutral-500 dark:text-neutral-400">Tanggal Akhir</span>
        <input
          type="date"
          defaultValue={searchParams.get('dateTo') ?? ''}
          onChange={(e) => updateParam('dateTo', e.target.value)}
          className="sm:w-44 px-3.5 py-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white transition"
        />
      </label>
      {isAdmin && (
        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-500 dark:text-neutral-400">Propinsi</span>
          <select
            value={currentProvinceId}
            onChange={(e) => updateParam('provinceId', e.target.value)}
            className="sm:w-52 px-3.5 py-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white transition"
          >
            <option value="">Semua Propinsi</option>
            {provinces.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {isAdmin && (
        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-500 dark:text-neutral-400">Kota</span>
          <select
            value={currentCityId}
            onChange={(e) => updateParam('cityId', e.target.value)}
            disabled={!currentProvinceId}
            className="sm:w-52 px-3.5 py-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white transition disabled:opacity-50"
          >
            <option value="">Semua Kota</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  )
}
