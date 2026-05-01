'use client'

import { useActionState, useState, useEffect, useRef, startTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { PostFormState, SerializedCategory, SerializedPost } from '@/app/actions/posts'
import ImageUpload from './ImageUpload'
import { useToast } from '@/app/components/ToastContext'
import { formatUploadFileSize } from '@/app/lib/upload-size'

type Props = {
  action: (state: PostFormState, formData: FormData) => Promise<PostFormState>
  post?: SerializedPost
  categories: SerializedCategory[]
  maxUploadFileSizeBytes: number
  imageCompressionEnabled: boolean
  variant?: 'default' | 'upload' | 'amplifikasi'
  basePath?: string
  returnTo?: string
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

const ALERT_ICON = {
  error: (
    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
  ),
  success: (
    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
}

export default function PostForm({ action, post, categories, maxUploadFileSizeBytes, imageCompressionEnabled, variant = 'default', basePath = '/posts', returnTo }: Props) {
  const router = useRouter()
  const { showToast } = useToast()
  const [state, formAction, pending] = useActionState(action, undefined)
  const backHref = returnTo ?? basePath
  const screenshotFileRef = useRef<File | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const file = screenshotFileRef.current
    if (!file) return
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    formData.set('screenshot', file, file.name)
    startTransition(() => formAction(formData))
  }

  const showUrl        = variant !== 'amplifikasi'
  const showScreenshot = variant !== 'upload'

  const [title, setTitle] = useState(showUrl ? (post?.title ?? '') : '-')
  const [categoryId, setCategoryId] = useState(post?.blog_post_category_id ?? '')
  const [hasScreenshot, setHasScreenshot] = useState<boolean>(!!post?.thumbnail)
  const [screenshotClientError, setScreenshotClientError] = useState<string | null>(null)

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
        ...(showUrl ? (errs.title ?? []) : []),
        ...(showScreenshot ? (errs.screenshot ?? []) : []),
        ...(errs.body ?? []),
      ]
      if (messages.length > 0) {
        showToast('warning', 'Periksa Kembali Form', messages.join(' · '))
      }
    }
  }, [state]) // eslint-disable-line react-hooks/exhaustive-deps

  const selectedCategory = categories.find((c) => c.id === categoryId)

  const platformHint = showUrl && selectedCategory
    ? Object.entries(PLATFORM_HINTS).find(([key]) =>
        selectedCategory.name.toLowerCase().includes(key)
      )?.[1]
    : null

  const urlClientError =
    showUrl && title && platformHint && !platformHint.pattern.test(title)
      ? `Link harus berupa URL ${platformHint.label} yang valid.`
      : null

  const hasExistingScreenshot = Boolean(post?.thumbnail)
  const screenshotFieldError = showScreenshot ? (screenshotClientError ?? state?.errors?.screenshot?.[0] ?? null) : null
  const screenshotMessages = showScreenshot
    ? (screenshotClientError
        ? [screenshotClientError]
        : !hasScreenshot && !hasExistingScreenshot
          ? (state?.errors?.screenshot ?? [])
          : [])
    : []

  const formMessages = state?.errors
    ? [
        ...(state.errors.category_id ?? []),
        ...(showUrl ? (state.errors.title ?? []) : []),
        ...screenshotMessages,
        ...(state.errors.body ?? []),
      ]
    : []

  const alertType = state?.duplicate || state?.message ? 'error' : 'warning'

  const submitDisabled =
    pending ||
    !categoryId ||
    (showUrl && (!title || !!urlClientError)) ||
    (showScreenshot && !(hasScreenshot || hasExistingScreenshot)) ||
    (showScreenshot && !!screenshotClientError && !hasExistingScreenshot)

  return (
    <form action={formAction} onSubmit={handleSubmit} className="space-y-6">

      {post && <input type="hidden" name="id" value={post.id} />}
      {post?.thumbnail?.id && <input type="hidden" name="old_media_id" value={post.thumbnail.id} />}
      {returnTo && <input type="hidden" name="return_to" value={returnTo} />}
      <input type="hidden" name="is_published" value="0" />
      <input type="hidden" name="body" value="-" />
      {!showUrl && <input type="hidden" name="title" value="-" />}

      {(state?.message || formMessages.length > 0) && (
        <div
          className={`rounded-xl border px-4 py-3 ${
            alertType === 'error'
              ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200'
              : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200'
          }`}
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5">{ALERT_ICON[alertType]}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">
                {state?.duplicate ? 'Double Entry Terdeteksi' : state?.message ? 'Gagal Menyimpan' : 'Periksa Kembali Form'}
              </p>
              {state?.message && <p className="mt-1 text-sm leading-relaxed">{state.message}</p>}
              {!state?.message && formMessages.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm leading-relaxed">
                  {formMessages.map((message, index) => (
                    <li key={`${message}-${index}`}>- {message}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Main */}
        <div className="lg:col-span-2 space-y-5">

          {/* Kategori */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
              Media Sosial {!categoryId && <span className="text-red-500">*</span>}
            </label>
            <select
              name="category_id"
              value={categoryId}
              required
              onChange={(e) => setCategoryId(e.target.value)}
              className={`w-full px-3.5 py-2.5 rounded-lg border bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white transition ${
                state?.errors?.category_id ? 'border-red-400 dark:border-red-500' : 'border-neutral-300 dark:border-neutral-700'
              }`}
            >
              <option value="">— Pilih Media Sosial —</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
            {state?.errors?.category_id && (
              <p className="mt-1.5 text-xs text-red-500">{state.errors.category_id[0]}</p>
            )}
          </div>

          {/* Link Upload — hanya untuk default & upload */}
          {showUrl && (
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
                  state?.errors?.title || urlClientError ? 'border-red-400 dark:border-red-500' : 'border-neutral-300 dark:border-neutral-700'
                }`}
              />
              {(state?.errors?.title || urlClientError) && (
                <p className="mt-1.5 text-xs text-red-500">{state?.errors?.title?.[0] ?? urlClientError}</p>
              )}
            </div>
          )}

          {/* Screenshot — hanya untuk default & amplifikasi */}
          {showScreenshot && (
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                Bukti Screenshot {!hasScreenshot && !hasExistingScreenshot && <span className="text-red-500">*</span>}
                {post?.thumbnail && (
                  <span className="ml-2 text-xs text-neutral-400">
                    (kosongkan untuk tetap menggunakan screenshot lama)
                  </span>
                )}
              </label>
              <ImageUpload
                currentUrl={post?.thumbnail?.url ?? null}
                error={screenshotFieldError ?? undefined}
                maxFileSizeBytes={maxUploadFileSizeBytes}
                maxFileSizeLabel={formatUploadFileSize(maxUploadFileSizeBytes)}
                compressionEnabled={imageCompressionEnabled}
                onFileChange={setHasScreenshot}
                onValidationChange={setScreenshotClientError}
                onFileReady={(file) => { screenshotFileRef.current = file }}
              />
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          <div className="flex flex-col gap-2 pt-2">
            <button
              type="submit"
              disabled={submitDisabled}
              className="w-full py-2.5 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-sm font-semibold hover:bg-neutral-700 dark:hover:bg-neutral-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pending ? 'Memproses...' : post ? 'Simpan Perubahan' : 'Submit'}
            </button>
            <button
              type="button"
              onClick={() => router.push(backHref)}
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
