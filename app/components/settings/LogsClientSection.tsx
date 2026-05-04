'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import type { FormEvent } from 'react'
import AccessLogsTable from '@/app/components/settings/AccessLogsTable'
import TablePageSizeSelect from '@/app/components/TablePageSizeSelect'
import type { AccessLogRow } from '@/app/lib/access-logs'
import type { TablePageSize } from '@/app/lib/table-pagination'

type LogsParams = {
  pageSize?: string
  search?: string
  eventType?: string
  country?: string
  path?: string
  dateFrom?: string
  dateTo?: string
}

type Props = {
  logs: AccessLogRow[]
  params: LogsParams
  pageSize: TablePageSize
}

function buildHref(params: Record<string, string | undefined>) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value)
  }
  const qs = query.toString()
  return qs ? `/settings/logs?${qs}` : '/settings/logs'
}

function FilterButton({ processing }: { processing: boolean }) {
  return (
    <button
      type="submit"
      disabled={processing}
      className="inline-flex items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
    >
      {processing ? (
        <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
          <circle className="opacity-30" cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" />
          <path className="opacity-90" fill="currentColor" d="M21 12a9 9 0 00-9-9v3a6 6 0 016 6h3z" />
        </svg>
      ) : (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4.5h18M6.75 12h10.5M10.5 19.5h3" />
        </svg>
      )}
      {processing ? 'Memproses...' : 'Filter'}
    </button>
  )
}

export default function LogsClientSection({ logs, params, pageSize }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [isFiltering, setIsFiltering] = useState(false)
  const [search, setSearch] = useState(params.search ?? '')
  const [eventType, setEventType] = useState(params.eventType ?? '')
  const [country, setCountry] = useState(params.country ?? '')
  const [path, setPath] = useState(params.path ?? '')
  const [dateFrom, setDateFrom] = useState(params.dateFrom ?? '')
  const [dateTo, setDateTo] = useState(params.dateTo ?? '')

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextHref = buildHref({
      pageSize: params.pageSize,
      search,
      eventType,
      country,
      path,
      dateFrom,
      dateTo,
    })
    const currentHref = buildHref({
      page: searchParams.get('page') ?? undefined,
      pageSize: searchParams.get('pageSize') ?? undefined,
      search: searchParams.get('search') ?? undefined,
      eventType: searchParams.get('eventType') ?? undefined,
      country: searchParams.get('country') ?? undefined,
      path: searchParams.get('path') ?? undefined,
      dateFrom: searchParams.get('dateFrom') ?? undefined,
      dateTo: searchParams.get('dateTo') ?? undefined,
    })
    if (nextHref === currentHref) return

    setIsFiltering(true)
    startTransition(() => {
      router.push(nextHref)
    })
  }

  const processing = isFiltering || isPending

  return (
    <>
      <form onSubmit={applyFilters} className="grid grid-cols-1 gap-3 rounded-2xl border border-neutral-200 bg-white p-4 sm:grid-cols-2 xl:grid-cols-6 dark:border-neutral-800 dark:bg-neutral-900">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          disabled={processing}
          placeholder="Cari IP, email, agent..."
          className="rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 disabled:opacity-50 sm:col-span-2 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:focus:ring-white"
        />
        <input
          type="text"
          value={eventType}
          onChange={(event) => setEventType(event.target.value)}
          disabled={processing}
          placeholder="Event type"
          className="rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:focus:ring-white"
        />
        <input
          type="text"
          value={country}
          onChange={(event) => setCountry(event.target.value)}
          disabled={processing}
          placeholder="Country"
          className="rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm uppercase text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:focus:ring-white"
        />
        <input
          type="text"
          value={path}
          onChange={(event) => setPath(event.target.value)}
          disabled={processing}
          placeholder="Path"
          className="rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:focus:ring-white"
        />
        <div className="flex gap-3 sm:col-span-2 xl:col-span-2">
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            disabled={processing}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:focus:ring-white"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            disabled={processing}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:focus:ring-white"
          />
        </div>
        <div className="flex items-center gap-3 sm:col-span-2 xl:col-span-6">
          <FilterButton processing={processing} />
          <Link
            href="/settings/logs"
            className="inline-flex items-center rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            Reset
          </Link>
        </div>
      </form>

      <TablePageSizeSelect value={pageSize} />

      <AccessLogsTable logs={logs} isLoading={processing} />
    </>
  )
}
