'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { BYTES_IN_MB, formatUploadFileSize } from '@/app/lib/upload-size'

type Props = {
  currentUrl?: string | null
  error?: string
  maxFileSizeBytes: number
  maxFileSizeLabel: string
  compressionEnabled?: boolean
  onFileChange?: (hasFile: boolean) => void
  onValidationChange?: (message: string | null) => void
  onFileReady?: (file: File | null) => void
}

const IMAGE_COMPRESSION_THRESHOLD_BYTES = 1 * BYTES_IN_MB
const IMAGE_COMPRESSION_MAX_DIMENSION = 1920
const IMAGE_COMPRESSION_MIN_DIMENSION = 1080
const IMAGE_COMPRESSION_MAX_QUALITY = 1
const IMAGE_COMPRESSION_MIN_QUALITY = 0.5
const IMAGE_COMPRESSION_QUALITY_SEARCH_STEPS = 10

type CompressionFormat = {
  mime: 'image/jpeg' | 'image/webp' | 'image/png'
  ext: 'jpg' | 'webp' | 'png'
  quality?: boolean
}

type CompressionCandidate = {
  blob: Blob
  ext: CompressionFormat['ext']
}

const IMAGE_COMPRESSION_FORMATS: CompressionFormat[] = [
  { mime: 'image/jpeg', ext: 'jpg', quality: true },
  { mime: 'image/webp', ext: 'webp', quality: true },
  { mime: 'image/png', ext: 'png' },
]

function getCompressedFileName(fileName: string, ext: CompressionFormat['ext']) {
  const baseName = fileName.replace(/\.[^.]+$/, '') || 'screenshot'
  return `${baseName}.${ext}`
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = document.createElement('img')
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Gambar tidak dapat dibaca.'))
    }
    image.src = url
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: CompressionFormat['mime'], quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('Kompresi gambar gagal.')),
      mime,
      quality
    )
  })
}

// Compress the file so its size is <= targetBytes.
// targetBytes is the admin-configured maximum (e.g. 1 MB).
async function compressImageFile(file: File, targetBytes: number): Promise<File> {
  const image = await loadImageFromFile(file)
  const longestSide = Math.max(image.naturalWidth, image.naturalHeight)
  let maxDimension = Math.min(IMAGE_COMPRESSION_MAX_DIMENSION, longestSide)
  let candidate = await compressImageToTarget(image, maxDimension, targetBytes)

  while (candidate.blob.size > targetBytes && maxDimension > IMAGE_COMPRESSION_MIN_DIMENSION) {
    maxDimension = Math.max(IMAGE_COMPRESSION_MIN_DIMENSION, Math.round(maxDimension * 0.9))
    candidate = await compressImageToTarget(image, maxDimension, targetBytes)
  }

  return new File([candidate.blob], getCompressedFileName(file.name, candidate.ext), {
    type: candidate.blob.type,
    lastModified: Date.now(),
  })
}

async function compressImageToTarget(
  image: HTMLImageElement,
  maxDimension: number,
  targetBytes: number,
): Promise<CompressionCandidate> {
  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight))
  const width = Math.max(1, Math.round(image.naturalWidth * scale))
  const height = Math.max(1, Math.round(image.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')
  if (!context) throw new Error('Browser tidak mendukung kompresi gambar.')
  context.drawImage(image, 0, 0, width, height)

  const candidates: CompressionCandidate[] = []
  let smallestOversized: CompressionCandidate | null = null

  function trackCandidate(candidate: CompressionCandidate) {
    if (candidate.blob.size <= targetBytes) {
      candidates.push(candidate)
      return
    }
    if (!smallestOversized || candidate.blob.size < smallestOversized.blob.size) {
      smallestOversized = candidate
    }
  }

  for (const format of IMAGE_COMPRESSION_FORMATS) {
    const maxQualityBlob = await canvasToBlob(canvas, format.mime, format.quality ? IMAGE_COMPRESSION_MAX_QUALITY : undefined)
    const maxQualityCandidate = { blob: maxQualityBlob, ext: format.ext }
    trackCandidate(maxQualityCandidate)

    if (!format.quality || maxQualityBlob.size <= targetBytes) {
      continue
    }

    const minQualityBlob = await canvasToBlob(canvas, format.mime, IMAGE_COMPRESSION_MIN_QUALITY)
    const minQualityCandidate = { blob: minQualityBlob, ext: format.ext }
    trackCandidate(minQualityCandidate)
    if (minQualityBlob.size > targetBytes) {
      continue
    }

    let lowerQuality = IMAGE_COMPRESSION_MIN_QUALITY
    let upperQuality = IMAGE_COMPRESSION_MAX_QUALITY
    let bestCandidate = minQualityCandidate

    for (let step = 0; step < IMAGE_COMPRESSION_QUALITY_SEARCH_STEPS; step += 1) {
      const quality = (lowerQuality + upperQuality) / 2
      const blob = await canvasToBlob(canvas, format.mime, quality)

      if (blob.size <= targetBytes) {
        bestCandidate = { blob, ext: format.ext }
        lowerQuality = quality
      } else {
        upperQuality = quality
      }
    }

    trackCandidate(bestCandidate)
  }

  // Pick the largest candidate that still fits under targetBytes (= best visual quality).
  const bestUnderTarget = candidates.sort((a, b) => b.blob.size - a.blob.size)[0]
  return bestUnderTarget ?? smallestOversized ?? { blob: await canvasToBlob(canvas, 'image/jpeg', IMAGE_COMPRESSION_MIN_QUALITY), ext: 'jpg' }
}

function setInputFile(input: HTMLInputElement, file: File) {
  const dataTransfer = new DataTransfer()
  dataTransfer.items.add(file)
  input.files = dataTransfer.files
}

export default function ImageUpload({
  currentUrl,
  error,
  maxFileSizeBytes,
  maxFileSizeLabel,
  compressionEnabled = true,
  onFileChange,
  onValidationChange,
  onFileReady,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null)
  const [isExisting, setIsExisting] = useState<boolean>(!!currentUrl)
  const [compressionMessage, setCompressionMessage] = useState<string | null>(null)
  const [fileSize, setFileSize] = useState<number | null>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return
    let file = selectedFile
    const hasUsableScreenshot = Boolean(preview)
    setCompressionMessage(null)

    // Compress when the file exceeds 1 MB (or the admin-configured maximum, whichever is lower).
    const compressionTarget = Math.min(maxFileSizeBytes, IMAGE_COMPRESSION_THRESHOLD_BYTES)
    if (compressionEnabled && selectedFile.size > compressionTarget) {
      e.target.value = ''
      onFileChange?.(hasUsableScreenshot)
      onValidationChange?.(null)
      setCompressionMessage(`Mengompresi gambar ${formatUploadFileSize(selectedFile.size)}...`)

      try {
        file = await compressImageFile(selectedFile, compressionTarget)

        if (file.size > maxFileSizeBytes) {
          throw new Error('Hasil kompresi masih terlalu besar.')
        }

        if (inputRef.current) setInputFile(inputRef.current, file)
        setCompressionMessage(
          `Dikompresi dari ${formatUploadFileSize(selectedFile.size)} menjadi ${formatUploadFileSize(file.size)}.`
        )
      } catch {
        setCompressionMessage(null)
        onValidationChange?.('Kompresi gambar gagal. Pilih gambar lain atau gunakan file yang lebih kecil.')
        onFileChange?.(hasUsableScreenshot)
        return
      }
    }

    if (file.size > maxFileSizeBytes) {
      if (inputRef.current) inputRef.current.value = ''
      setCompressionMessage(null)
      onValidationChange?.(
        hasUsableScreenshot
          ? `Ukuran file terlalu besar (maks ${maxFileSizeLabel}). Screenshot lama tetap digunakan.`
          : `Ukuran file terlalu besar (maks ${maxFileSizeLabel}). Pilih file yang lebih kecil.`
      )
      onFileChange?.(hasUsableScreenshot)
      return
    }

    if (preview && !isExisting) URL.revokeObjectURL(preview)
    setPreview(URL.createObjectURL(file))
    setIsExisting(false)
    setFileSize(file.size)
    onValidationChange?.(null)
    onFileChange?.(true)
    onFileReady?.(file)
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
          </div>
          {fileSize !== null && (
            <div className="absolute bottom-2 left-2">
              <span className="bg-black/50 text-white text-xs px-2 py-0.5 rounded-md">
                {formatUploadFileSize(fileSize)}
              </span>
            </div>
          )}
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
          <span className="text-xs">
            JPG, PNG, GIF, WebP — maks {maxFileSizeLabel}
            {compressionEnabled ? ', kompresi aktif' : ''}
          </span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        name="screenshot"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
      {compressionMessage && !error && (
        <p className="text-xs text-green-600 dark:text-green-400">{compressionMessage}</p>
      )}
    </div>
  )
}
