'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import {
  deleteSocialMediaCategory,
  setSocialMediaCategoryActive,
  type SocialMediaCategoryRow,
} from '@/app/actions/social-media-categories'
import { useToast } from '@/app/components/ToastContext'
import SocialMediaCategoryFormDialog from './SocialMediaCategoryFormDialog'
import { resolveSocialLinkRulesForCategory } from '@/app/lib/social-platform'

type Props = {
  categories: SocialMediaCategoryRow[]
  sortBy: string
  sortDir: 'asc' | 'desc'
  searchParams: Record<string, string | undefined>
  isLoading?: boolean
}

type ConfirmState =
  | { type: 'delete'; category: SocialMediaCategoryRow }
  | { type: 'status'; category: SocialMediaCategoryRow; isActive: boolean }
  | null

function buildHref(
  searchParams: Record<string, string | undefined>,
  col: string,
  currentSortBy: string,
  currentSortDir: 'asc' | 'desc',
): string {
  const nextDir = currentSortBy === col && currentSortDir === 'asc' ? 'desc' : 'asc'
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(searchParams)) {
    if (value && key !== 'sortBy' && key !== 'sortDir' && key !== 'page') query.set(key, value)
  }
  query.set('sortBy', col)
  query.set('sortDir', nextDir)
  return `/settings/jenis-medsos?${query.toString()}`
}

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  return (
    <span className="ml-1 inline-flex flex-col">
      <svg
        className={`-mb-0.5 h-2.5 w-2.5 ${active && dir === 'asc' ? 'text-neutral-900 dark:text-white' : 'text-neutral-300 dark:text-neutral-600'}`}
        viewBox="0 0 10 6"
        fill="currentColor"
      >
        <path d="M5 0L10 6H0z" />
      </svg>
      <svg
        className={`h-2.5 w-2.5 ${active && dir === 'desc' ? 'text-neutral-900 dark:text-white' : 'text-neutral-300 dark:text-neutral-600'}`}
        viewBox="0 0 10 6"
        fill="currentColor"
      >
        <path d="M5 6L0 0h10z" />
      </svg>
    </span>
  )
}

function formatDateTime(iso: string | null) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function UrlRulesCell({ category }: { category: SocialMediaCategoryRow }) {
  const rules = category.url_rules ?? resolveSocialLinkRulesForCategory(category).rules
  if (!rules || rules.hosts.length === 0) {
    return <span className="text-xs text-neutral-400 dark:text-neutral-500">-</span>
  }

  return (
    <div className="max-w-xs space-y-1.5">
      <div className="flex flex-wrap gap-1">
        {rules.hosts.map((host) => (
          <span
            key={host}
            className="rounded-md bg-neutral-100 px-1.5 py-0.5 font-mono text-[11px] text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
          >
            {host}
          </span>
        ))}
      </div>
      {rules.placeholder && (
        <p className="truncate font-mono text-[11px] text-neutral-400 dark:text-neutral-500">
          {rules.placeholder}
        </p>
      )}
    </div>
  )
}

export default function SocialMediaCategoriesTable({
  categories,
  sortBy,
  sortDir,
  searchParams,
  isLoading = false,
}: Props) {
  const router = useRouter()
  const { showToast } = useToast()
  const [pending, startTransition] = useTransition()
  const [localCategories, setLocalCategories] = useState(categories)
  const [editCategory, setEditCategory] = useState<SocialMediaCategoryRow | null>(null)
  const [confirm, setConfirm] = useState<ConfirmState>(null)
  const confirmDialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    setLocalCategories(categories)
  }, [categories])

  function sortLink(col: string) {
    return buildHref(searchParams, col, sortBy, sortDir)
  }

  function openConfirm(state: ConfirmState) {
    setConfirm(state)
    confirmDialogRef.current?.showModal()
  }

  function handleConfirm() {
    if (!confirm) return
    confirmDialogRef.current?.close()

    startTransition(async () => {
      try {
        if (confirm.type === 'delete') {
          await deleteSocialMediaCategory(confirm.category.id)
          setLocalCategories((prev) => prev.filter((item) => item.id !== confirm.category.id))
          showToast('success', 'Jenis Medsos Dihapus', `${confirm.category.name} berhasil dihapus.`)
        } else {
          await setSocialMediaCategoryActive(confirm.category.id, confirm.isActive)
          setLocalCategories((prev) =>
            prev.map((item) =>
              item.id === confirm.category.id ? { ...item, is_active: confirm.isActive } : item
            )
          )
          showToast(
            'success',
            confirm.isActive ? 'Jenis Medsos Diaktifkan' : 'Jenis Medsos Dinonaktifkan',
            `${confirm.category.name} berhasil diperbarui.`,
          )
        }
        setConfirm(null)
        router.refresh()
      } catch (err) {
        showToast('error', 'Gagal Memproses', err instanceof Error ? err.message : 'Terjadi kesalahan.')
      }
    })
  }

  return (
    <>
      {editCategory && (
        <SocialMediaCategoryFormDialog
          mode="edit"
          category={editCategory}
          onClose={() => setEditCategory(null)}
        />
      )}

      <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <table className="w-full min-w-[1160px] text-sm">
          <thead>
            <tr className="border-b border-neutral-200 dark:border-neutral-800">
              {[
                { label: 'Nama', col: 'name' },
                { label: 'Slug', col: 'slug' },
              ].map(({ label, col }) => (
                <th key={col} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                  <Link
                    href={sortLink(col)}
                    className="inline-flex items-center gap-0.5 transition-colors hover:text-neutral-900 dark:hover:text-white"
                  >
                    {label}
                    <SortIcon active={sortBy === col} dir={sortDir} />
                  </Link>
                </th>
              ))}
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                Rules URL
              </th>
              {[
                { label: 'Wajib', col: 'is_required' },
                { label: 'Status', col: 'is_active' },
                { label: 'Dibuat', col: 'created_at' },
                { label: 'Diperbarui', col: 'updated_at' },
              ].map(({ label, col }) => (
                <th key={col} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                  <Link
                    href={sortLink(col)}
                    className="inline-flex items-center gap-0.5 transition-colors hover:text-neutral-900 dark:hover:text-white"
                  >
                    {label}
                    <SortIcon active={sortBy === col} dir={sortDir} />
                  </Link>
                </th>
              ))}
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                Aksi
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading && Array.from({ length: 6 }).map((_, index) => (
              <tr key={`jenis-medsos-skeleton-${index}`} className="border-b border-neutral-100 last:border-0 dark:border-neutral-800/60">
                <td className="px-4 py-3">
                  <div className="h-4 w-32 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
                </td>
                <td className="px-4 py-3">
                  <div className="h-4 w-28 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
                </td>
                <td className="px-4 py-3">
                  <div className="h-5 w-40 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
                </td>
                <td className="px-4 py-3">
                  <div className="h-5 w-16 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-700" />
                </td>
                <td className="px-4 py-3">
                  <div className="h-5 w-16 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-700" />
                </td>
                <td className="px-4 py-3">
                  <div className="h-4 w-36 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
                </td>
                <td className="px-4 py-3">
                  <div className="h-4 w-36 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
                </td>
                <td className="px-4 py-3">
                  <div className="h-8 w-40 animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-700" />
                </td>
              </tr>
            ))}

            {!isLoading && localCategories.map((category) => (
              <tr key={category.id} className="border-b border-neutral-100 last:border-0 dark:border-neutral-800/60">
                <td className="px-4 py-3 font-medium text-neutral-900 dark:text-white">
                  {category.name}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-neutral-500 dark:text-neutral-400">
                  {category.slug}
                </td>
                <td className="px-4 py-3">
                  <UrlRulesCell category={category} />
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      category.is_required
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400'
                        : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'
                    }`}
                  >
                    {category.is_required ? 'Ya' : 'Tidak'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      category.is_active
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                        : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'
                    }`}
                  >
                    {category.is_active ? 'Aktif' : 'Nonaktif'}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-neutral-500 dark:text-neutral-400">
                  {formatDateTime(category.created_at)}
                </td>
                <td className="px-4 py-3 text-xs text-neutral-500 dark:text-neutral-400">
                  {formatDateTime(category.updated_at)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => setEditCategory(category)}
                      className="rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => openConfirm({ type: 'status', category, isActive: !category.is_active })}
                      className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition disabled:opacity-50 ${
                        category.is_active
                          ? 'border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/30'
                          : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950/30'
                      }`}
                    >
                      {category.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => openConfirm({ type: 'delete', category })}
                      className="rounded-lg border border-red-300 px-2.5 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
                    >
                      Hapus
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {!isLoading && localCategories.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-neutral-400 dark:text-neutral-500">
                  Tidak ada jenis medsos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <dialog
        ref={confirmDialogRef}
        className="fixed top-1/2 left-1/2 m-0 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl backdrop:bg-black/40 dark:border-neutral-700 dark:bg-neutral-900"
      >
        {confirm && (
          <>
            <div className="flex items-start gap-4">
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                  confirm.type === 'delete'
                    ? 'bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400'
                    : confirm.isActive
                    ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400'
                    : 'bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400'
                }`}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold text-neutral-900 dark:text-white">
                  {confirm.type === 'delete'
                    ? 'Hapus Jenis Medsos?'
                    : confirm.isActive
                    ? 'Aktifkan Jenis Medsos?'
                    : 'Nonaktifkan Jenis Medsos?'}
                </h2>
                <p className="mt-1.5 text-sm text-neutral-500 dark:text-neutral-400">
                  {confirm.type === 'delete'
                    ? `${confirm.category.name} akan dihapus dari daftar jenis medsos.`
                    : `${confirm.category.name} akan diubah menjadi ${confirm.isActive ? 'aktif' : 'nonaktif'}.`}
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => confirmDialogRef.current?.close()}
                className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition ${
                  confirm.type === 'delete'
                    ? 'bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600'
                    : confirm.isActive
                    ? 'bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600'
                    : 'bg-amber-600 hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600'
                }`}
              >
                {confirm.type === 'delete' ? 'Ya, Hapus' : confirm.isActive ? 'Ya, Aktifkan' : 'Ya, Nonaktifkan'}
              </button>
            </div>
          </>
        )}
      </dialog>
    </>
  )
}
