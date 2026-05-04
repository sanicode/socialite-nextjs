"use client"
import { useState, useTransition } from "react"
import Link from "next/link"
import { usePathname, useSearchParams, useRouter } from "next/navigation"
import { bulkUpdateOperatorPostStatus, updateOperatorPostStatus, updatePostStatus } from '@/app/actions/posts'
import Image from "next/image"
import { useToast } from '@/app/components/ToastContext'

type PostStatus = 'pending' | 'valid' | 'invalid'

type SerializedMedia = {
  model_id: string
  file_name: string
  custom_properties: unknown
  order_column?: number | null
}

type SerializedPost = {
  id: string
  title: string | null
  created_at: string | null
  source_url: string | null
  status: PostStatus
  blog_post_categories?: { name: string } | null
}

type SerializedUser = {
  name: string | null
}

function getStatusClass(status: PostStatus) {
  if (status === 'valid') return 'border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
  if (status === 'invalid') return 'border-red-200 bg-red-100 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300'
  return 'border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
}

export default function UserPostsTableClient({
  posts,
  mediaByPostId,
  validationEnabled = true,
  validationDisabledMessage,
  validationDateFrom,
  validationDateTo,
  removeOnStatusChange = true,
  actionsDisabled = false,
  actionsDisabledMessage,
}: {
  posts: SerializedPost[]
  mediaByPostId: Record<string, SerializedMedia>
  userData: SerializedUser
  status: string
  validationEnabled?: boolean
  validationDisabledMessage?: string | null
  validationDateFrom?: string
  validationDateTo?: string
  removeOnStatusChange?: boolean
  actionsDisabled?: boolean
  actionsDisabledMessage?: string | null
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { showToast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [modalUrl, setModalUrl] = useState<string | null>(null)
  const [optimisticPosts, setOptimisticPosts] = useState(posts)
  const bulkEnabled = Boolean(validationDateFrom && validationDateTo)
  const actionsLocked = actionsDisabled || !validationEnabled || isPending
  const returnTo = searchParams.toString() ? `${pathname}?${searchParams.toString()}` : pathname

  function buildEditHref(post: SerializedPost) {
    const params = new URLSearchParams()
    params.set('returnTo', returnTo)
    const basePath = post.source_url === 'amplifikasi'
      ? '/posts/amplifikasi'
      : post.source_url === 'upload'
        ? '/posts/upload'
        : '/posts'
    return `${basePath}/${post.id}/edit?${params.toString()}`
  }

  const handleStatusChange = (postId: string, newStatus: PostStatus) => {
    if (actionsLocked) return
    setOptimisticPosts(prev => removeOnStatusChange
      ? prev.filter((p) => p.id.toString() !== postId)
      : prev.map((p) => p.id.toString() === postId ? { ...p, status: newStatus } : p)
    )
    startTransition(async () => {
      try {
        const result = validationDateFrom && validationDateTo
          ? await updateOperatorPostStatus(postId, newStatus, validationDateFrom, validationDateTo)
          : await updatePostStatus(postId, newStatus)
        if (result?.success) {
          showToast('success', 'Status Diperbarui', `Post dipindahkan ke ${newStatus}.`)
          router.refresh()
        } else {
          throw new Error("Gagal")
        }
      } catch {
        showToast('error', 'Gagal Memperbarui', 'Terjadi kesalahan saat mengubah status.')
        router.refresh()
      }
    })
  }

  const handleBulkStatusChange = (newStatus: 'valid' | 'invalid') => {
    if (actionsLocked || !validationDateFrom || !validationDateTo || optimisticPosts.length === 0) return
    const ids = optimisticPosts.map((post) => post.id.toString())
    setOptimisticPosts(prev => prev.map((post) => ids.includes(post.id.toString()) ? { ...post, status: newStatus } : post))
    startTransition(async () => {
      try {
        const result = await bulkUpdateOperatorPostStatus(ids, newStatus, validationDateFrom, validationDateTo)
        if (result?.success) {
          showToast('success', 'Status Diperbarui', `${ids.length} post ditandai sebagai ${newStatus}.`)
          router.refresh()
        } else {
          throw new Error("Gagal")
        }
      } catch {
        showToast('error', 'Gagal Memperbarui', 'Terjadi kesalahan saat mengubah status.')
        router.refresh()
      }
    })
  }

  return (
    <>
      {bulkEnabled && (
        <div className="flex flex-col gap-3 border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Terapkan status ke semua laporan pada halaman ini
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleBulkStatusChange('valid')}
              disabled={actionsLocked || optimisticPosts.length === 0}
              className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Valid Semua
            </button>
            <button
              type="button"
              onClick={() => handleBulkStatusChange('invalid')}
              disabled={actionsLocked || optimisticPosts.length === 0}
              className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Invalid Semua
            </button>
          </div>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-800">
              <th className="px-4 py-3 text-center text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Tanggal</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Screenshot</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Jenis</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Media Sosial</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Link Upload</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Status</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {optimisticPosts.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-10 text-neutral-400 dark:text-neutral-500">
                  Tidak ada data
                </td>
              </tr>
            ) : (
              optimisticPosts.map((post) => {
                const media = mediaByPostId[post.id]
                let imageUrl = ""
                if (media) {
                  try {
                    const rawCustomProps = media.custom_properties
                    const customProps = rawCustomProps && typeof rawCustomProps === 'object'
                      ? rawCustomProps as { source_url?: string }
                      : JSON.parse(String(rawCustomProps ?? '{}')) as { source_url?: string }
                    imageUrl = customProps.source_url || `https://softlink.sgp1.digitaloceanspaces.com/${media.model_id}/${media.file_name}`
                  } catch {
                    imageUrl = `https://softlink.sgp1.digitaloceanspaces.com/${media.model_id}/${media.file_name}`
                  }
                }

                return (
                  <tr key={post.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition">
                    <td className="px-4 py-3 text-center text-neutral-500 dark:text-neutral-400">
                      {post.created_at ? new Date(post.created_at).toLocaleDateString('id-ID') : '-'}
                    </td>
                    <td className="px-4 py-3 text-center align-middle">
                      <div className="flex justify-center">
                        {media ? (
                          <button
                            type="button"
                            onClick={() => setModalUrl(imageUrl)}
                            className="focus:outline-none hover:opacity-80 transition"
                          >
                            <Image
                              src={imageUrl}
                              alt={post.title ?? ''}
                              width={56}
                              height={56}
                              className="rounded object-cover w-14 h-14 border border-neutral-200 dark:border-neutral-700"
                            />
                          </button>
                        ) : (
                          <div className="w-14 h-14 rounded bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                            <svg className="w-6 h-6 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center align-middle">
                      {post.source_url === 'upload' ? (
                        <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs font-medium">Upload</span>
                      ) : post.source_url === 'amplifikasi' ? (
                        <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 text-xs font-medium">Amplifikasi</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400 text-xs font-medium">Umum</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center align-middle">
                      <span className="px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-xs text-neutral-600 dark:text-neutral-400">
                        {post.blog_post_categories?.name ?? '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-neutral-900 dark:text-white max-w-xs">
                      {post.source_url === 'upload' && post.title ? (
                        <a
                          href={post.title}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                        >
                          Buka
                        </a>
                      ) : (
                        <span className="block truncate">{post.title ?? '-'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center align-middle">
                      <div className="flex justify-center">
                        <select
                          className={`rounded-lg border px-2 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white transition disabled:cursor-not-allowed disabled:opacity-50 ${getStatusClass(post.status)}`}
                          value={post.status}
                          onChange={(e) => handleStatusChange(post.id.toString(), e.target.value as PostStatus)}
                          disabled={actionsLocked}
                          title={
                            actionsDisabled
                              ? (actionsDisabledMessage ?? 'Aksi sedang dinonaktifkan.')
                              : !validationEnabled
                                ? (validationDisabledMessage ?? 'Validasi belum memenuhi syarat.')
                                : undefined
                          }
                        >
                          <option className="bg-white text-neutral-900 dark:bg-neutral-900 dark:text-white" value="pending">Pending</option>
                          <option className="bg-white text-neutral-900 dark:bg-neutral-900 dark:text-white" value="valid">Valid</option>
                          <option className="bg-white text-neutral-900 dark:bg-neutral-900 dark:text-white" value="invalid">Invalid</option>
                        </select>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right align-middle">
                      {actionsDisabled ? (
                        <span
                          aria-disabled="true"
                          title={actionsDisabledMessage ?? 'Aksi sedang dinonaktifkan.'}
                          className="inline-flex cursor-not-allowed rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs text-neutral-400 dark:border-neutral-800 dark:text-neutral-600"
                        >
                          Edit
                        </span>
                      ) : (
                        <Link
                          href={buildEditHref(post)}
                          className="inline-flex rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                        >
                          Edit
                        </Link>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Preview */}
      {modalUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setModalUrl(null)}
        >
          <div className="relative p-4" onClick={e => e.stopPropagation()}>
            <button
              className="absolute -top-10 right-0 text-white hover:text-neutral-300 transition"
              onClick={() => setModalUrl(null)}
            >
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img
              src={modalUrl}
              alt="Preview"
              className="max-w-[90vw] max-h-[85vh] rounded-lg shadow-2xl border border-white/10"
            />
          </div>
        </div>
      )}
    </>
  )
}
