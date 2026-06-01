'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import type { FormEvent } from 'react'
import TablePageSizeSelect from '@/app/components/TablePageSizeSelect'
import SocialMediaCategoriesTable from '@/app/components/settings/SocialMediaCategoriesTable'
import SocialMediaCategoryFormDialog from '@/app/components/settings/SocialMediaCategoryFormDialog'
import type { SocialMediaCategoryRow } from '@/app/actions/social-media-categories'
import type { TablePageSize } from '@/app/lib/table-pagination'

type SocialMediaCategoriesParams = {
  pageSize?: string
  search?: string
  status?: string
  createdFrom?: string
  createdTo?: string
  updatedFrom?: string
  updatedTo?: string
  sortBy?: string
  sortDir?: string
}

type Props = {
  categories: SocialMediaCategoryRow[]
  totalActive: number
  totalInactive: number
  totalRequired: number
  params: SocialMediaCategoriesParams
  pageSize: TablePageSize
  sortBy: string
  sortDir: 'asc' | 'desc'
}

function buildHref(params: Record<string, string | undefined>) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value)
  }
  const qs = query.toString()
  return qs ? `/settings/jenis-medsos?${qs}` : '/settings/jenis-medsos'
}

function FilterButton({ processing }: { processing: boolean }) {
  return (
    <button
      type="submit"
      disabled={processing}
      className="inline-flex flex-none items-center justify-center gap-2 rounded-xl border border-neutral-300 px-3.5 py-2 text-sm font-medium text-neutral-700 transition border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:bg-neutral-800"
    >
      {processing ? (
        <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
          <circle className="opacity-30" cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" />
          <path className="opacity-90" fill="currentColor" d="M21 12a9 9 0 00-9-9v3a6 6 0 016 6h3z" />
        </svg>
      ) : (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m1.6-5.4a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      )}
      {processing ? 'Memproses...' : 'Cari'}
    </button>
  )
}

export default function SocialMediaCategoriesClientSection({
  categories,
  totalActive,
  totalInactive,
  totalRequired,
  params,
  pageSize,
  sortBy,
  sortDir,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [isFiltering, setIsFiltering] = useState(false)
  const [search, setSearch] = useState(params.search ?? '')
  const [showCreate, setShowCreate] = useState(false)

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextHref = buildHref({
      pageSize: params.pageSize,
      search,
      status: params.status,
      createdFrom: params.createdFrom,
      createdTo: params.createdTo,
      updatedFrom: params.updatedFrom,
      updatedTo: params.updatedTo,
      sortBy: params.sortBy,
      sortDir: params.sortDir,
    })
    const currentHref = buildHref({
      page: searchParams.get('page') ?? undefined,
      pageSize: searchParams.get('pageSize') ?? undefined,
      search: searchParams.get('search') ?? undefined,
      status: searchParams.get('status') ?? undefined,
      createdFrom: searchParams.get('createdFrom') ?? undefined,
      createdTo: searchParams.get('createdTo') ?? undefined,
      updatedFrom: searchParams.get('updatedFrom') ?? undefined,
      updatedTo: searchParams.get('updatedTo') ?? undefined,
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
      {showCreate && (
        <SocialMediaCategoryFormDialog mode="create" onClose={() => setShowCreate(false)} />
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex ui-button gap-2 rounded-xl bg-neutral-900 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Tambah Jenis Medsos
        </button>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <TablePageSizeSelect value={pageSize} />
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
              Aktif {totalActive.toLocaleString('id-ID')}
            </span>
            <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-1 font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
              Nonaktif {totalInactive.toLocaleString('id-ID')}
            </span>
            <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-1 font-medium text-blue-700 dark:bg-blue-950/50 dark:text-blue-400">
              Wajib {totalRequired.toLocaleString('id-ID')}
            </span>
          </div>
        </div>

        <form onSubmit={applyFilters} className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
          <div className="relative w-full sm:w-64">
            <svg className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500 dark:text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m1.6-5.4a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              disabled={processing}
              placeholder="Search..."
              className="ui-search-with-icon h-10 w-full rounded-xl border border-neutral-300 bg-white py-2 pl-11 pr-4 text-sm text-neutral-900 transition placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:placeholder:text-neutral-500 dark:focus:ring-white"
            />
          </div>
          <div className="flex items-center gap-2">
            <FilterButton processing={processing} />
            <Link
              href="/settings/jenis-medsos"
              className="inline-flex ui-button rounded-xl border border-neutral-300 px-3.5 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              Reset
            </Link>
          </div>
        </form>
      </div>

      <SocialMediaCategoriesTable
        categories={categories}
        sortBy={sortBy}
        sortDir={sortDir}
        searchParams={params}
        isLoading={processing}
      />
    </>
  )
}
