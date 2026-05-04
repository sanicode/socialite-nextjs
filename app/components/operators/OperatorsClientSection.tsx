'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import type { FormEvent } from 'react'
import OperatorsTable from '@/app/components/operators/OperatorsTable'
import TableSearchForm from '@/app/components/TableSearchForm'
import TablePageSizeSelect from '@/app/components/TablePageSizeSelect'
import type { OperatorRow } from '@/app/actions/operators'
import type { TablePageSize } from '@/app/lib/table-pagination'

type Props = {
  operators: OperatorRow[]
  params: {
    search?: string
    email?: string
    phone?: string
    pageSize?: string
  }
  pageSize: TablePageSize
}

function buildHref(params: Record<string, string | undefined>) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value)
  }
  const qs = query.toString()
  return qs ? `/operators?${qs}` : '/operators'
}

export default function OperatorsClientSection({ operators, params, pageSize }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [isFiltering, setIsFiltering] = useState(false)
  const [email, setEmail] = useState(params.email ?? '')
  const [phone, setPhone] = useState(params.phone ?? '')

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextHref = buildHref({
      search: params.search,
      pageSize: params.pageSize,
      email,
      phone,
    })
    const currentHref = buildHref({
      search: searchParams.get('search') ?? undefined,
      pageSize: searchParams.get('pageSize') ?? undefined,
      email: searchParams.get('email') ?? undefined,
      phone: searchParams.get('phone') ?? undefined,
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
      <form onSubmit={applyFilters} className="grid grid-cols-1 gap-3 rounded-2xl border border-neutral-200 bg-white p-4 sm:grid-cols-2 dark:border-neutral-800 dark:bg-neutral-900">
        <input
          type="search"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={processing}
          placeholder="Email..."
          className="rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:focus:ring-white"
        />
        <input
          type="search"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          disabled={processing}
          placeholder="Nomor telp..."
          className="rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:focus:ring-white"
        />
        <div className="flex items-center gap-3 sm:col-span-2">
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
          <Link
            href="/operators"
            className="inline-flex items-center rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            Reset
          </Link>
        </div>
      </form>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <TablePageSizeSelect value={pageSize} />
        <TableSearchForm
          action="/operators"
          defaultValue={params.search}
          placeholder="Cari nama..."
          hiddenParams={{
            pageSize: params.pageSize,
            email,
            phone,
          }}
        />
      </div>

      <OperatorsTable operators={operators} isLoading={processing} />
    </>
  )
}
