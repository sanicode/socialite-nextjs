'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition, useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { SerializedPost, SerializedCategory } from '@/app/actions/posts'
import { deletePost, updateStatus, bulkDeletePosts } from '@/app/actions/posts'
import { useToast } from '@/app/components/ToastContext'
import RequestLoadingOverlay from '@/app/components/RequestLoadingOverlay'

type Props = {
  posts: SerializedPost[]
  total: number
  categories: SerializedCategory[]
  page: number
  isAdmin: boolean
  canVerify: boolean
  basePath?: string
  variant?: 'default' | 'upload' | 'amplifikasi'
}

const PAGE_SIZE = 10

function getStatusLabel(status: string) {
  switch (status) {
    case 'valid':
      return 'Valid'
    case 'invalid':
      return 'Invalid'
    default:
      return 'Pending'
  }
}

function getStatusClass(status: string) {
  if (status === 'valid') return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
  if (status === 'invalid') return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
  return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
}

export default function PostsTable({ posts, total, categories, page, isAdmin, canVerify, basePath = '/posts', variant = 'default' }: Props) {
  const showUrl = variant !== 'amplifikasi'
  const showScreenshot = variant !== 'upload'
  const showReadOnlyStatus = !canVerify
  const columnCount =
    (isAdmin ? 1 : 0) +
    1 +
    (showScreenshot ? 1 : 0) +
    1 +
    1 +
    (showUrl ? 1 : 0) +
    (canVerify ? 1 : 0) +
    (isAdmin ? 2 : 0) +
    (canVerify || showReadOnlyStatus ? 1 : 0) +
    (isAdmin ? 1 : 0)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { showToast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const handledSuccess = useRef<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [modal, setModal] = useState<{ type: 'image' | 'link'; url: string; title: string } | null>(null)
  const [searchValue, setSearchValue] = useState(searchParams.get('search') ?? '')

  const closeModal = useCallback(() => setModal(null), [])

  useEffect(() => {
    if (!modal) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [modal, closeModal])

  useEffect(() => {
    const success = searchParams.get('success')
    if (!success || handledSuccess.current === success) return
    handledSuccess.current = success

    if (success === 'created') {
      showToast('success', 'Laporan Terkirim', 'Laporan berhasil dikirim.')
    } else if (success === 'updated') {
      showToast('success', 'Perubahan Tersimpan', 'Laporan berhasil diperbarui.')
    }

    const params = new URLSearchParams(searchParams.toString())
    params.delete('success')
    const nextQuery = params.toString()
    router.replace(nextQuery ? `${basePath}?${nextQuery}` : basePath)
  }, [basePath, router, searchParams, showToast])

  const currentSort = searchParams.get('sort') ?? 'desc'

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const allSelected = posts.length > 0 && selectedIds.size === posts.length

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(posts.map((p) => p.id)))
    }
  }

  function handleBulkDelete() {
    if (selectedIds.size === 0) return
    if (!confirm(`Hapus ${selectedIds.size} post? Tindakan tidak bisa dibatalkan.`)) return
    const count = selectedIds.size
    startTransition(async () => {
      try {
        await bulkDeletePosts(Array.from(selectedIds))
        setSelectedIds(new Set())
        showToast('success', 'Berhasil Dihapus', `${count} post telah dihapus.`)
      } catch {
        showToast('error', 'Gagal Menghapus', 'Terjadi kesalahan saat menghapus post.')
      }
    })
  }

  const updateParam = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    if (key !== 'page') params.delete('page')
    startTransition(() => {
      router.push(`${basePath}?${params.toString()}`)
    })
  }, [basePath, router, searchParams, startTransition])

  useEffect(() => {
    setSearchValue(searchParams.get('search') ?? '')
  }, [searchParams])

  useEffect(() => {
    const currentSearch = searchParams.get('search') ?? ''
    if (searchValue === currentSearch) return

    const timeoutId = window.setTimeout(() => {
      updateParam('search', searchValue)
    }, 300)

    return () => window.clearTimeout(timeoutId)
  }, [searchValue, searchParams, updateParam])

  function handleDelete(id: string) {
    if (!confirm('Hapus post ini? Tindakan tidak bisa dibatalkan.')) return
    setDeletingId(id)
    startTransition(async () => {
      try {
        await deletePost(id)
        showToast('success', 'Post Dihapus', 'Post berhasil dihapus.')
      } catch {
        showToast('error', 'Gagal Menghapus', 'Terjadi kesalahan saat menghapus post.')
      } finally {
        setDeletingId(null)
      }
    })
  }

  return (
    <div className="space-y-4">
      {isPending && (
        <RequestLoadingOverlay
          title="Memuat data laporan..."
          description="Perubahan filter atau halaman sedang diproses."
        />
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-3 flex-wrap">
        
        <input
          type="search"
          placeholder="Cari..."
          value={searchValue}
          disabled={isPending}
          onChange={(e) => setSearchValue(e.target.value)}
          className="flex-1 min-w-[180px] px-3.5 py-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white transition"
        />

        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-500 dark:text-neutral-400">Tanggal Awal</span>
          <input
            type="date"
            defaultValue={searchParams.get('dateFrom') ?? ''}
            disabled={isPending}
            onChange={(e) => updateParam('dateFrom', e.target.value)}
            className="sm:w-40 px-3.5 py-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white transition"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-500 dark:text-neutral-400">Tanggal Akhir</span>
          <input
            type="date"
            defaultValue={searchParams.get('dateTo') ?? ''}
            disabled={isPending}
            onChange={(e) => updateParam('dateTo', e.target.value)}
            className="sm:w-40 px-3.5 py-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white transition"
          />
        </label>        
        {variant === 'default' && (
          <select
            defaultValue={searchParams.get('jenis') ?? ''}
            disabled={isPending}
            onChange={(e) => updateParam('jenis', e.target.value)}
            className="sm:w-40 px-3.5 py-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white transition"
          >
            <option value="">Semua jenis</option>
            <option value="upload">Upload</option>
            <option value="amplifikasi">Amplifikasi</option>
          </select>
        )}
        <select
          defaultValue={searchParams.get('category') ?? ''}
          disabled={isPending}
          onChange={(e) => updateParam('category', e.target.value)}
          className="sm:w-48 px-3.5 py-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white transition"
        >
          <option value="">Semua Media Sosial</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      {/* Bulk Action Bar */}
      {isAdmin && selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
          <span className="text-sm text-neutral-700 dark:text-neutral-300">
            {selectedIds.size} dipilih
          </span>
          <button
            onClick={handleBulkDelete}
            disabled={isPending}
            className="text-xs px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 transition disabled:opacity-50"
          >
            {isPending ? 'Menghapus...' : 'Hapus'}
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-xs px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-600 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition"
          >
            Batal
          </button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-800">
                {isAdmin && (
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      className="rounded border-neutral-300 dark:border-neutral-600"
                    />
                  </th>
                )}
                <th className="text-left px-4 py-3 font-medium text-neutral-600 dark:text-neutral-400 w-32">
                  <button
                    onClick={() => updateParam('sort', currentSort === 'asc' ? 'desc' : 'asc')}
                    className="flex items-center gap-1 hover:text-neutral-900 dark:hover:text-white transition"
                  >
                    Tanggal
                    {currentSort === 'asc' ? (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    )}
                  </button>
                </th>
                
                {showScreenshot && (
                  <th className="text-left px-4 py-3 font-medium text-neutral-600 dark:text-neutral-400 w-16">
                    Screenshot
                  </th>
                )}

                <th className="text-left px-4 py-3 font-medium text-neutral-600 dark:text-neutral-400 w-32">
                  Jenis
                </th>                

                <th className="text-left px-4 py-3 font-medium text-neutral-600 dark:text-neutral-400 w-32">
                  Media Sosial
                </th>
                {showUrl && (
                  <th className="text-left px-4 py-3 font-medium text-neutral-600 dark:text-neutral-400">
                    Link Upload
                  </th>
                )}
                {canVerify && (
                  <th className="text-left px-4 py-3 font-medium text-neutral-600 dark:text-neutral-400 w-36 hidden md:table-cell">
                    Author
                  </th>
                )}
                {isAdmin && (
                  <th className="text-left px-4 py-3 font-medium text-neutral-600 dark:text-neutral-400 w-36 hidden md:table-cell">
                    Propinsi
                  </th>
                )}
                {isAdmin && (
                  <th className="text-left px-4 py-3 font-medium text-neutral-600 dark:text-neutral-400 w-36 hidden md:table-cell">
                    Kota
                  </th>
                )}
                {canVerify && (
                  <th className="text-left px-4 py-3 font-medium text-neutral-600 dark:text-neutral-400 w-28">
                    Verifikasi
                  </th>
                )}
                {showReadOnlyStatus && (
                  <th className="text-left px-4 py-3 font-medium text-neutral-600 dark:text-neutral-400 w-28">
                    Status
                  </th>
                )}
                {isAdmin && (
                <th className="text-right px-4 py-3 font-medium text-neutral-600 dark:text-neutral-400 w-28">
                  Aksi
                </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {posts.length === 0 && (
                <tr>
                  <td
                    colSpan={columnCount}
                    className="px-4 py-12 text-center text-neutral-500 dark:text-neutral-400"
                  >
                    Belum ada laporan.{' '}
                    <Link href={`${basePath}/new`} className="underline">
                      Buat laporan pertama Anda
                    </Link>
                  </td>
                </tr>
              )}
              {posts.map((post) => (
                <tr
                  key={post.id}
                  className="bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition"
                >
                  {/* Checkbox */}
                  {isAdmin && (
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(post.id)}
                        onChange={() => toggleSelect(post.id)}
                        className="rounded border-neutral-300 dark:border-neutral-600"
                      />
                    </td>
                  )}

                  {/* Date */}
                  <td className="px-4 py-3 text-xs text-neutral-500 dark:text-neutral-400">
                    {post.created_at
                      ? new Date(post.created_at).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : '—'}
                  </td>

                  {/* Thumbnail */}
                  {showScreenshot && (
                    <td className="px-4 py-3">
                      {post.thumbnail ? (
                        <button
                          type="button"
                          onClick={() => setModal({ type: 'image', url: post.thumbnail!.url, title: post.title ?? '' })}
                          className="w-12 h-12 rounded-md overflow-hidden bg-neutral-100 dark:bg-neutral-800 relative flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-neutral-900 dark:hover:ring-white transition"
                        >
                          <Image
                            src={post.thumbnail.url}
                            alt={post.title ?? ''}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        </button>
                      ) : (
                        <div className="w-12 h-12 rounded-md bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center flex-shrink-0">
                          <svg
                            className="w-5 h-5 text-neutral-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.5}
                              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                          </svg>
                        </div>
                      )}
                    </td>
                  )}

                  {/* Source Type */}
                  <td className="px-4 py-3 text-left align-middle">
                    {post.source_url === 'upload' ? (
                      <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs font-medium">Upload</span>
                    ) : post.source_url === 'amplifikasi' ? (
                      <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 text-xs font-medium">Amplifikasi</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400 text-xs font-medium">Umum</span>
                    )}
                  </td>

                  {/* Category */}
                  <td className="px-4 py-3">
                    {post.category ? (
                      <span className="text-xs px-2 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                        {post.category.name}
                      </span>
                    ) : (
                      <span className="text-neutral-400 text-xs">—</span>
                    )}
                  </td>

                  {/* Link Upload */}
                  {showUrl && (
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setModal({ type: 'link', url: post.title ?? '', title: post.title ?? '' })}
                        className="font-medium text-neutral-900 dark:text-white line-clamp-1 font-mono text-left hover:underline cursor-pointer"
                      >
                        {post.title}
                      </button>
                    </td>
                  )}

                  {/* Author */}
                  {canVerify && (
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs text-neutral-600 dark:text-neutral-400">
                        {post.user?.name ?? '—'}
                      </span>
                    </td>
                  )}

                  {/* Propinsi */}
                  {isAdmin && (
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs text-neutral-600 dark:text-neutral-400">
                        {post.province ?? '—'}
                      </span>
                    </td>
                  )}

                  {/* Kota */}
                  {isAdmin && (
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs text-neutral-600 dark:text-neutral-400">
                        {post.city ?? '—'}
                      </span>
                    </td>
                  )}

                  {/* Verifikasi */}
                  {canVerify && (
                    <td className="px-4 py-3">
                      <select
                        value={post.status}
                        onChange={(e) => {
                          const newStatus = e.target.value as 'pending' | 'valid' | 'invalid'
                          startTransition(async () => {
                            try {
                              await updateStatus(post.id, newStatus)
                              showToast('success', 'Status Diperbarui', `Post ditandai sebagai ${newStatus}.`)
                            } catch {
                              showToast('error', 'Gagal Memperbarui', 'Terjadi kesalahan saat mengubah status.')
                            }
                          })
                        }}
                        disabled={isPending}
                        className={`text-xs px-2 py-1 rounded-full font-medium border-0 cursor-pointer transition disabled:opacity-50 ${getStatusClass(post.status)}`}
                      >
                        <option value="pending">Pending</option>
                        <option value="valid">Valid</option>
                        <option value="invalid">Invalid</option>
                      </select>
                    </td>
                  )}

                  {/* Status */}
                  {showReadOnlyStatus && (
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getStatusClass(post.status)}`}>
                        {getStatusLabel(post.status)}
                      </span>
                    </td>
                  )}

                  {/* Actions */}
                  {(isAdmin) && (
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {canVerify && !isAdmin ? (
                        <span className="text-xs px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 text-neutral-400 dark:text-neutral-600 cursor-not-allowed">
                          Edit
                        </span>
                      ) : (
                        (isAdmin || canVerify) && (
                        <Link
                          href={`${basePath}/${post.id}/edit`}
                          className="text-xs px-2.5 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition"
                        >
                          Edit
                        </Link>
                        )
                      )}
                      {isAdmin && (
                        <button
                          onClick={() => handleDelete(post.id)}
                          disabled={deletingId === post.id || isPending}
                          className="text-xs px-2.5 py-1.5 rounded-lg border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition disabled:opacity-50"
                        >
                          {deletingId === post.id ? '...' : 'Hapus'}
                        </button>
                      )}
                    </div>
                  </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          {total > 0
            ? `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} dari ${total.toLocaleString('id-ID')} post`
            : '0 post'}
        </p>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => updateParam('page', '1')}
              disabled={page === 1}
              className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              First
            </button>
            <button
              onClick={() => updateParam('page', String(Math.max(1, page - 1)))}
              disabled={page === 1}
              className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Prev
            </button>
            <span className="text-xs text-neutral-500 dark:text-neutral-400 min-w-[4.5rem] text-center">
              Hal. {page} / {totalPages}
            </span>
            <button
              onClick={() => updateParam('page', String(Math.min(totalPages, page + 1)))}
              disabled={page === totalPages}
              className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Next
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button
              onClick={() => updateParam('page', String(totalPages))}
              disabled={page === totalPages}
              className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Last
            </button>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={closeModal}
        >
          <div
            className="relative bg-white dark:bg-neutral-900 rounded-xl shadow-2xl max-w-2xl w-full mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-neutral-800">
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-white truncate pr-4">
                {modal.type === 'image' ? 'Preview Gambar' : 'Link Upload'}
              </h3>
              <button
                onClick={closeModal}
                className="text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition flex-shrink-0"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="p-5">
              {modal.type === 'image' ? (
                <div className="relative w-full aspect-video bg-neutral-100 dark:bg-neutral-800 rounded-lg overflow-hidden">
                  <Image
                    src={modal.url}
                    alt={modal.title}
                    fill
                    className="object-contain"
                    unoptimized
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 break-all font-mono bg-neutral-50 dark:bg-neutral-800 px-4 py-3 rounded-lg">
                    {modal.url}
                  </p>
                  <a
                    href={modal.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-medium hover:bg-neutral-700 dark:hover:bg-neutral-100 transition"
                  >
                    Buka Link
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
