'use client'

import Image from 'next/image'
import { useActionState, useEffect, useMemo, useRef, useState } from 'react'
import type { SerializedCategory } from '@/app/actions/posts'
import {
  createSocialMediaPost,
  type SocialMediaPostState,
} from '@/app/actions/social-media-posts'
import type { ConnectedSocialMediaRow } from '@/app/actions/social-medias'
import {
  detectSocialPlatformFromCategory,
  getSocialPlatformLabel,
} from '@/app/lib/social-platform'

type Props = {
  categories: SerializedCategory[]
  accounts: ConnectedSocialMediaRow[]
  disabledMessage?: string | null
}

type MediaPreview = {
  url: string
  kind: 'image' | 'video'
}

function getMediaPreviewKind(file: File): MediaPreview['kind'] {
  const name = file.name.toLowerCase()
  if (file.type.startsWith('video/') || /\.(mp4|mov|webm)$/.test(name)) return 'video'
  return 'image'
}

export default function SocialMediaPostForm({ categories, accounts, disabledMessage }: Props) {
  const [state, formAction, pending] = useActionState<SocialMediaPostState, FormData>(createSocialMediaPost, undefined)
  const [categoryId, setCategoryId] = useState('')
  const [mediaName, setMediaName] = useState('')
  const [mediaPreview, setMediaPreview] = useState<MediaPreview | null>(null)
  const mediaPreviewUrlRef = useRef<string | null>(null)

  const categoryOptions = useMemo(() => {
    return categories
      .map((category) => ({
        ...category,
        platform: detectSocialPlatformFromCategory(category.name),
      }))
      .filter((category) => category.platform)
  }, [categories])
  const selectedPlatform = categoryOptions.find((category) => category.id === categoryId)?.platform ?? null
  const accountOptions = selectedPlatform
    ? accounts.filter((account) => account.platform === selectedPlatform)
    : accounts
  const publishableAccountOptions = accountOptions.filter((account) => {
    if (account.platform === 'facebook') return account.canPost
    return true
  })

  const hasFacebookAccount = accounts.some((account) => account.platform === 'facebook' && account.canPost)
  const hasFacebookProfile = accounts.some((account) => account.platform === 'facebook')
  const formDisabled = pending || Boolean(disabledMessage)

  useEffect(() => {
    return () => {
      if (mediaPreviewUrlRef.current) URL.revokeObjectURL(mediaPreviewUrlRef.current)
    }
  }, [])

  function updateMediaPreview(file: File | null) {
    if (mediaPreviewUrlRef.current) {
      URL.revokeObjectURL(mediaPreviewUrlRef.current)
      mediaPreviewUrlRef.current = null
    }

    if (!file) {
      setMediaPreview(null)
      return
    }

    const url = URL.createObjectURL(file)
    mediaPreviewUrlRef.current = url
    setMediaPreview({ url, kind: getMediaPreviewKind(file) })
  }

  return (
    <form action={formAction} encType="multipart/form-data" className="space-y-6">
      {disabledMessage && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          {disabledMessage}
        </div>
      )}

      {state?.message && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            state.status === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200'
              : 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200'
          }`}
        >
          <p>{state.message}</p>
          {state.postUrl && (
            <a href={state.postUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block font-medium underline">
              Buka postingan
            </a>
          )}
        </div>
      )}

      {!hasFacebookAccount && !disabledMessage && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200">
          {hasFacebookProfile
            ? 'Profil Facebook sudah terhubung, tetapi Facebook Page belum tersedia. Posting otomatis membutuhkan permission Page dari Meta.'
            : 'Hubungkan Facebook Page terlebih dahulu pada menu Akun Medsos sebelum membuat postingan Facebook.'}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Media Sosial
          </label>
          <select
            name="category_id"
            value={categoryId}
            required
            disabled={formDisabled}
            onChange={(event) => setCategoryId(event.target.value)}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 outline-none transition focus:ring-2 focus:ring-neutral-900 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:focus:ring-white"
          >
            <option value="">Pilih kategori</option>
            {categoryOptions.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name} - {getSocialPlatformLabel(category.platform)}
              </option>
            ))}
          </select>
          {state?.errors?.category_id && (
            <p className="mt-1.5 text-xs text-red-500">{state.errors.category_id[0]}</p>
          )}
          <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">
            Platform ditentukan dari nama kategori, misalnya Facebook, Instagram, TikTok, atau YouTube.
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Akun Terhubung
          </label>
          <select
            name="account_id"
            required
            disabled={formDisabled}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 outline-none transition focus:ring-2 focus:ring-neutral-900 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:focus:ring-white"
          >
            <option value="">Pilih akun</option>
            {publishableAccountOptions.map((account) => (
              <option key={account.id} value={account.id}>
                {account.accountKind ?? getSocialPlatformLabel(account.platform)} - {account.displayName ?? account.username ?? account.providerAccountId}
              </option>
            ))}
          </select>
          {state?.errors?.account_id && (
            <p className="mt-1.5 text-xs text-red-500">{state.errors.account_id[0]}</p>
          )}
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Foto / Video
        </label>
        <input
          name="media"
          type="file"
          required
          disabled={formDisabled}
          accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime,video/webm"
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null
            setMediaName(file?.name ?? '')
            updateMediaPreview(file)
          }}
          className="block w-full rounded-lg border border-neutral-300 bg-white text-sm text-neutral-900 outline-none transition file:mr-4 file:border-0 file:bg-neutral-900 file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-white hover:file:bg-neutral-700 focus:ring-2 focus:ring-neutral-900 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:file:bg-white dark:file:text-neutral-900 dark:hover:file:bg-neutral-100 dark:focus:ring-white"
        />
        {mediaPreview && (
          <div className="mt-3 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800">
            {mediaPreview.kind === 'image' ? (
              <div className="relative h-64 w-full">
                <Image src={mediaPreview.url} alt="Preview media" fill className="object-contain" unoptimized />
              </div>
            ) : (
              <video src={mediaPreview.url} controls className="max-h-80 w-full bg-black" />
            )}
          </div>
        )}
        {mediaName && (
          <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">{mediaName}</p>
        )}
        {state?.errors?.media && (
          <p className="mt-1.5 text-xs text-red-500">{state.errors.media[0]}</p>
        )}
        <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">
          Format: JPG, PNG, GIF, WebP, MP4, MOV, atau WebM.
        </p>
      </div>
      
      <div>
        <label className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Isi Postingan
        </label>
        <textarea
          name="message"
          required
          rows={8}
          disabled={formDisabled}
          placeholder="Tulis caption atau isi postingan..."
          className="w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 outline-none transition focus:ring-2 focus:ring-neutral-900 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:focus:ring-white"
        />
        {state?.errors?.message && (
          <p className="mt-1.5 text-xs text-red-500">{state.errors.message[0]}</p>
        )}
      </div>


      <div className="flex justify-end">
        <button
          type="submit"
          disabled={formDisabled}
          className="rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:opacity-60 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
        >
          {pending ? 'Memproses...' : 'Posting ke Medsos'}
        </button>
      </div>
    </form>
  )
}
