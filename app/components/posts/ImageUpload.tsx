'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'

type Props = {
  currentUrl?: string | null
  error?: string
  maxFileSizeBytes: number
  maxFileSizeLabel: string
  onFileChange?: (hasFile: boolean) => void
  onValidationChange?: (message: string | null) => void
}

export default function ImageUpload({
  currentUrl,
  error,
  maxFileSizeBytes,
  maxFileSizeLabel,
  onFileChange,
  onValidationChange,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null)
  const [isExisting, setIsExisting] = useState<boolean>(!!currentUrl)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const hasUsableScreenshot = Boolean(preview)

    if (file.size > maxFileSizeBytes) {
      if (inputRef.current) inputRef.current.value = ''
      onValidationChange?.(
        hasUsableScreenshot
          ? `Ukuran file terlalu besar (maks ${maxFileSizeLabel}). Screenshot lama tetap digunakan.`
          : `Ukuran file terlalu besar (maks ${maxFileSizeLabel}). Pilih file yang lebih kecil.`
      )
      onFileChange?.(hasUsableScreenshot)
      return
    }

    // Revoke previous object URL to avoid memory leaks
    if (preview && !isExisting) URL.revokeObjectURL(preview)
    setPreview(URL.createObjectURL(file))
    setIsExisting(false)
    onValidationChange?.(null)
    onFileChange?.(true)
  }

  function handleClear() {
    if (preview && !isExisting) URL.revokeObjectURL(preview)
    setPreview(null)
    setIsExisting(false)
    if (inputRef.current) inputRef.current.value = ''
    onValidationChange?.(null)
    onFileChange?.(false)
  }

  return (
    <div className="space-y-2">
      {preview ? (
        <div className="relative w-full h-48 rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800">
          <Image src={preview} alt="Preview" fill className="object-cover" unoptimized />
          <div className="absolute top-2 right-2 flex gap-1.5">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="bg-white/90 dark:bg-neutral-800/90 hover:bg-white dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 text-xs px-2.5 py-1 rounded-md shadow transition"
            >
              Ganti
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="bg-red-500 hover:bg-red-600 text-white text-xs px-2.5 py-1 rounded-md shadow transition"
            >
              Hapus
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={`w-full h-48 rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-2 transition cursor-pointer ${
            error
              ? 'border-red-400 dark:border-red-500 bg-red-50 dark:bg-red-950/20 text-red-500 dark:text-red-400'
              : 'border-neutral-300 dark:border-neutral-600 text-neutral-500 dark:text-neutral-400 hover:border-neutral-500 dark:hover:border-neutral-400'
          }`}
        >
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-sm font-medium">Klik untuk pilih gambar</span>
          <span className="text-xs">JPG, PNG, GIF, WebP — maks {maxFileSizeLabel}</span>
        </button>
      )}

      {/* Actual file input — part of the form, submitted with the form */}
      <input
        ref={inputRef}
        type="file"
        name="screenshot"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
    </div>
  )
}
