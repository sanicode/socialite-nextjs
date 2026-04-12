'use client'

import { useActionState, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { PostFormState, SerializedCategory, SerializedPost } from '@/app/actions/posts'
import ImageUpload from './ImageUpload'
import { useToast } from '@/app/components/ToastContext'

type Props = {
  action: (state: PostFormState, formData: FormData) => Promise<PostFormState>
  post?: SerializedPost
  categories: SerializedCategory[]
}

const PLATFORM_HINTS: Record<string, { pattern: RegExp; placeholder: string; label: string }> = {
  tiktok: {
    pattern: /tiktok\.com/i,
    placeholder: 'https://www.tiktok.com/@username/video/...',
    label: 'TikTok',
  },
  instagram: {
    pattern: /instagram\.com/i,
    placeholder: 'https://www.instagram.com/p/...',
    label: 'Instagram',
  },
  facebook: {
    pattern: /(facebook\.com|fb\.com|fb\.watch)/i,
    placeholder: 'https://www.facebook.com/...',
    label: 'Facebook',
  },
  youtube: {
    pattern: /(youtube\.com|youtu\.be)/i,
    placeholder: 'https://www.youtube.com/watch?v=...',
    label: 'YouTube',
  },
}

export default function PostForm({ action, post, categories }: Props) {
  const router = useRouter()
  const { showToast } = useToast()
  const [state, formAction, pending] = useActionState(action, undefined)

  const [title, setTitle] = useState(post?.title ?? '')
  const [categoryId, setCategoryId] = useState(post?.blog_post_category_id ?? '')
  const [hasScreenshot, setHasScreenshot] = useState<boolean>(!!post?.thumbnail)

  useEffect(() => {
    if (!state) return

    if (state.duplicate) {
      showToast('error', 'Double Entry Terdeteksi', state.message)
      return
    }

    if (state.message) {
      showToast('error', 'Gagal Menyimpan', state.message)
      return
    }

    const errs = state.errors
    if (errs) {
      const messages = [
        ...(errs.category_id ?? []),
        ...(errs.title ?? []),
        ...(errs.screenshot ?? []),
        ...(errs.body ?? []),
      ]

      if (messages.length > 0) {
        showToast('warning', 'Periksa Kembali Form', messages.join(' · '))
      }
    }
  }, [state]) // eslint-disable-line react-hooks/exhaustive-deps

  const selectedCategory = categories.find((c) => c.id === categoryId)

  const platformHint = selectedCategory
    ? Object.entries(PLATFORM_HINTS).find(([key]) =>
        selectedCategory.name.toLowerCase().includes(key)
      )?.[1]
    : null

  const urlClientError =
    title && platformHint && !platformHint.pattern.test(title)
      ? `Link harus berupa URL ${platformHint.label} yang valid.`
      : null

  return (
    <form action={formAction} className="space-y-6" encType="multipart/form-data">

      {post && <input type="hidden" name="id" value={post.id} />}

      {post?.thumbnail?.id && (
        <input type="hidden" name="old_media_id" value={post.thumbnail.id} />
      )}

      <input type="hidden" name="is_published" value="0" />
      <input type="hidden" name="body" value="-" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Main */}
        <div className="lg:col-span-2 space-y-5">

          {/* Kategori */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
              Kategori {!categoryId && <span className="text-red-500">*</span>}
            </label>

            <select
              name="category_id"
              value={categoryId}
              required
              onChange={(e) => setCategoryId(e.target.value)}
              className={`w-full px-3.5 py-2.5 rounded-lg border bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white transition ${
                state?.errors?.category_id
                  ? 'border-red-400 dark:border-red-500'
                  : 'border-neutral-300 dark:border-neutral-700'
              }`}
            >
              <option value="">— Pilih kategori —</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>

            {state?.errors?.category_id && (
              <p className="mt-1.5 text-xs text-red-500">
                {state.errors.category_id[0]}
              </p>
            )}
          </div>

          {/* Link Upload */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
              Link Upload {!title && <span className="text-red-500">*</span>}
            </label>

            <input
              name="title"
              type="url"
              value={title}
              required
              onChange={(e) => setTitle(e.target.value)}
              placeholder={platformHint?.placeholder ?? 'https://...'}
              className={`w-full px-3.5 py-2.5 rounded-lg border bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white transition ${
                state?.errors?.title || urlClientError
                  ? 'border-red-400 dark:border-red-500'
                  : 'border-neutral-300 dark:border-neutral-700'
              }`}
            />

            {(state?.errors?.title || urlClientError) && (
              <p className="mt-1.5 text-xs text-red-500">
                {state?.errors?.title?.[0] ?? urlClientError}
              </p>
            )}
          </div>

          {/* Screenshot */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
              Bukti Screenshot {!hasScreenshot && <span className="text-red-500">*</span>}

              {post?.thumbnail && (
                <span className="ml-2 text-xs text-neutral-400">
                  (kosongkan untuk tetap menggunakan screenshot lama)
                </span>
              )}
            </label>

            <ImageUpload
              currentUrl={post?.thumbnail?.url ?? null}
              error={state?.errors?.screenshot?.[0]}
              onFileChange={setHasScreenshot}
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">

          <div className="flex flex-col gap-2 pt-2">

            <button
              type="submit"
              disabled={
                pending ||
                !title ||
                !categoryId ||
                !hasScreenshot ||
                !!urlClientError
              }
              className="w-full py-2.5 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-sm font-semibold hover:bg-neutral-700 dark:hover:bg-neutral-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pending
                ? 'Memproses...'
                : post
                ? 'Simpan Perubahan'
                : 'Submit'}
            </button>

            <button
              type="button"
              onClick={() => router.push('/posts')}
              className="w-full py-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800 transition"
            >
              Batal
            </button>

          </div>

        </div>
      </div>
    </form>
  )
}