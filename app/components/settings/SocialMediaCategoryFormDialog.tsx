'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  createSocialMediaCategory,
  updateSocialMediaCategory,
  type SocialMediaCategoryRow,
} from '@/app/actions/social-media-categories'
import { useToast } from '@/app/components/ToastContext'
import { resolveSocialLinkRulesForCategory, type SocialUrlRules } from '@/app/lib/social-platform'

type Props = {
  mode: 'create' | 'edit'
  category?: SocialMediaCategoryRow
  onClose: () => void
}

const inputCls =
  'w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:focus:ring-white'

const labelCls = 'mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300'

function slugify(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function splitHosts(value: string) {
  return value
    .split(/[\n,]+/)
    .map((host) => host.trim())
    .filter(Boolean)
}

function getInitialRules(category?: SocialMediaCategoryRow): SocialUrlRules | null {
  if (!category) return null
  return category.url_rules ?? resolveSocialLinkRulesForCategory(category).rules
}

export default function SocialMediaCategoryFormDialog({ mode, category, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const { showToast } = useToast()
  const [name, setName] = useState(category?.name ?? '')
  const [slug, setSlug] = useState(category?.slug ?? '')
  const [isActive, setIsActive] = useState(category?.is_active ?? true)
  const [isRequired, setIsRequired] = useState(category?.is_required ?? false)
  const initialRules = getInitialRules(category)
  const [rulesEnabled, setRulesEnabled] = useState(Boolean(initialRules))
  const [hostsText, setHostsText] = useState(initialRules?.hosts.join(', ') ?? '')
  const [urlPlaceholder, setUrlPlaceholder] = useState(initialRules?.placeholder ?? '')
  const [slugEdited, setSlugEdited] = useState(mode === 'edit')
  const [rulesEdited, setRulesEdited] = useState(mode === 'edit')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  function handleNameChange(value: string) {
    setName(value)
    if (!slugEdited) setSlug(slugify(value))
    if (!rulesEdited) {
      const rules = resolveSocialLinkRulesForCategory(value).rules
      setRulesEnabled(Boolean(rules))
      setHostsText(rules?.hosts.join(', ') ?? '')
      setUrlPlaceholder(rules?.placeholder ?? '')
    }
  }

  function handleSlugChange(value: string) {
    setSlugEdited(true)
    setSlug(slugify(value))
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    const hosts = splitHosts(hostsText)
    if (rulesEnabled && hosts.length === 0) {
      setError('Minimal satu domain URL valid wajib diisi.')
      return
    }

    const url_rules = rulesEnabled
      ? {
          hosts,
          ...(urlPlaceholder.trim() ? { placeholder: urlPlaceholder.trim() } : {}),
          required: true,
        }
      : null

    startTransition(async () => {
      try {
        if (mode === 'create') {
          await createSocialMediaCategory({ name, slug, is_active: isActive, is_required: isRequired, url_rules })
          showToast('success', 'Jenis Medsos Ditambahkan', `${name} berhasil dibuat.`)
        } else if (category) {
          await updateSocialMediaCategory(category.id, { name, slug, is_active: isActive, is_required: isRequired, url_rules })
          showToast('success', 'Jenis Medsos Diperbarui', `${name} berhasil disimpan.`)
        }
        onClose()
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Terjadi kesalahan.')
      }
    })
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="fixed top-1/2 left-1/2 m-0 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-neutral-200 bg-white p-0 shadow-xl backdrop:bg-black/40 dark:border-neutral-700 dark:bg-neutral-900"
    >
      <form onSubmit={handleSubmit}>
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4 dark:border-neutral-700">
          <h2 className="text-base font-semibold text-neutral-900 dark:text-white">
            {mode === 'create' ? 'Tambah Jenis Medsos' : 'Edit Jenis Medsos'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex ui-button-sm gap-1.5 rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
            aria-label="Tutup"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto">
          <div className="space-y-4 p-5">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                {error}
              </div>
            )}

            <div>
              <label className={labelCls}>
                Nama <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(event) => handleNameChange(event.target.value)}
                required
                maxLength={255}
                placeholder="Instagram"
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>
                Slug <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={slug}
                onChange={(event) => handleSlugChange(event.target.value)}
                required
                maxLength={255}
                placeholder="instagram"
                className={inputCls}
              />
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-neutral-200 p-3.5 dark:border-neutral-700">
              <input
                id="social-media-category-active"
                type="checkbox"
                checked={isActive}
                onChange={(event) => setIsActive(event.target.checked)}
                className="mt-0.5 h-4 w-4 cursor-pointer rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900 dark:border-neutral-600 dark:bg-neutral-800 dark:focus:ring-white"
              />
              <label htmlFor="social-media-category-active" className="cursor-pointer">
                <span className="text-sm font-medium text-neutral-900 dark:text-white">Aktif</span>
              </label>
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-neutral-200 p-3.5 dark:border-neutral-700">
              <input
                id="social-media-category-required"
                type="checkbox"
                checked={isRequired}
                onChange={(event) => setIsRequired(event.target.checked)}
                className="mt-0.5 h-4 w-4 cursor-pointer rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900 dark:border-neutral-600 dark:bg-neutral-800 dark:focus:ring-white"
              />
              <label htmlFor="social-media-category-required" className="cursor-pointer">
                <span className="text-sm font-medium text-neutral-900 dark:text-white">Wajib</span>
              </label>
            </div>

            <div className="space-y-3 rounded-lg border border-neutral-200 p-3.5 dark:border-neutral-700">
              <div className="flex items-start gap-3">
                <input
                  id="social-media-category-url-rules"
                  type="checkbox"
                  checked={rulesEnabled}
                  onChange={(event) => {
                    setRulesEdited(true)
                    setRulesEnabled(event.target.checked)
                  }}
                  className="mt-0.5 h-4 w-4 cursor-pointer rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900 dark:border-neutral-600 dark:bg-neutral-800 dark:focus:ring-white"
                />
                <label htmlFor="social-media-category-url-rules" className="cursor-pointer">
                  <span className="text-sm font-medium text-neutral-900 dark:text-white">Validasi URL</span>
                </label>
              </div>

              {rulesEnabled && (
                <div className="space-y-3">
                  <div>
                    <label className={labelCls}>
                      Domain URL <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={hostsText}
                      onChange={(event) => {
                        setRulesEdited(true)
                        setHostsText(event.target.value)
                      }}
                      placeholder="threads.com, instagram.com"
                      className={inputCls}
                    />
                  </div>

                  <div>
                    <label className={labelCls}>Placeholder URL</label>
                    <input
                      type="text"
                      value={urlPlaceholder}
                      onChange={(event) => {
                        setRulesEdited(true)
                        setUrlPlaceholder(event.target.value)
                      }}
                      placeholder="https://threads.com/@username/post/..."
                      className={inputCls}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-neutral-200 px-5 py-4 dark:border-neutral-700">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
          >
            {pending ? 'Menyimpan...' : mode === 'create' ? 'Tambah' : 'Simpan'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
