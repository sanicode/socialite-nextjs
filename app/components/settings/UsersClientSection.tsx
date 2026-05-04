'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import type { FormEvent } from 'react'
import UsersTable from '@/app/components/settings/UsersTable'
import TablePageSizeSelect from '@/app/components/TablePageSizeSelect'
import type { UserRow } from '@/app/actions/users'
import type { TablePageSize } from '@/app/lib/table-pagination'

type UsersParams = {
  pageSize?: string
  search?: string
  status?: string
  loginSecurity?: string
  dateFrom?: string
  dateTo?: string
  sortBy?: string
  sortDir?: string
}

type Props = {
  users: UserRow[]
  totalBlocked: number
  totalUnderAttack: number
  totalRateLimited: number
  params: UsersParams
  pageSize: TablePageSize
}

function buildHref(params: Record<string, string | undefined>) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value)
  }
  const qs = query.toString()
  return qs ? `/settings/users?${qs}` : '/settings/users'
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

export default function UsersClientSection({
  users,
  totalBlocked,
  totalUnderAttack,
  totalRateLimited,
  params,
  pageSize,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [isFiltering, setIsFiltering] = useState(false)
  const [search, setSearch] = useState(params.search ?? '')
  const [status, setStatus] = useState(params.status ?? '')
  const [loginSecurity, setLoginSecurity] = useState(params.loginSecurity ?? '')
  const [dateFrom, setDateFrom] = useState(params.dateFrom ?? '')
  const [dateTo, setDateTo] = useState(params.dateTo ?? '')

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextHref = buildHref({
      pageSize: params.pageSize,
      search,
      status,
      loginSecurity,
      dateFrom,
      dateTo,
      sortBy: params.sortBy,
      sortDir: params.sortDir,
    })
    const currentHref = buildHref({
      page: searchParams.get('page') ?? undefined,
      pageSize: searchParams.get('pageSize') ?? undefined,
      search: searchParams.get('search') ?? undefined,
      status: searchParams.get('status') ?? undefined,
      loginSecurity: searchParams.get('loginSecurity') ?? undefined,
      dateFrom: searchParams.get('dateFrom') ?? undefined,
      dateTo: searchParams.get('dateTo') ?? undefined,
      sortBy: searchParams.get('sortBy') ?? undefined,
      sortDir: searchParams.get('sortDir') ?? undefined,
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
      <form onSubmit={applyFilters} className="grid grid-cols-1 items-end gap-3 rounded-2xl border border-neutral-200 bg-white p-4 sm:grid-cols-2 xl:grid-cols-6 dark:border-neutral-800 dark:bg-neutral-900">
        <label className="flex flex-col gap-1 xl:col-span-2">
          <span className="text-xs text-neutral-500 dark:text-neutral-400">Cari</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            disabled={processing}
            placeholder="Nama atau email..."
            className="w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:focus:ring-white"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-500 dark:text-neutral-400">Status</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            disabled={processing}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:focus:ring-white"
          >
            <option value="">Semua status</option>
            <option value="active">Aktif</option>
            <option value="blocked">Diblokir</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-500 dark:text-neutral-400">Kondisi Login</span>
          <select
            value={loginSecurity}
            onChange={(event) => setLoginSecurity(event.target.value)}
            disabled={processing}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:focus:ring-white"
          >
            <option value="">Semua kondisi login</option>
            <option value="has_attempts">Ada login attempts</option>
            <option value="under_attack">Sedang diserang (&gt;10/jam)</option>
            <option value="rate_limited">Sedang kena rate limit</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-500 dark:text-neutral-400">Tanggal Awal</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            disabled={processing}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:focus:ring-white"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-500 dark:text-neutral-400">Tanggal Akhir</span>
          <input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            disabled={processing}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:focus:ring-white"
          />
        </label>
        <div className="flex items-center gap-3 sm:col-span-2 xl:col-span-6">
          <FilterButton processing={processing} />
          <Link
            href="/settings/users"
            className="inline-flex items-center rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            Reset
          </Link>
        </div>
      </form>

      <TablePageSizeSelect value={pageSize} />

      <UsersTable
        users={users}
        totalBlocked={totalBlocked}
        totalUnderAttack={totalUnderAttack}
        totalRateLimited={totalRateLimited}
        sortBy={params.sortBy ?? 'name'}
        sortDir={params.sortDir === 'desc' ? 'desc' : 'asc'}
        searchParams={params}
        isLoading={processing}
      />
    </>
  )
}
