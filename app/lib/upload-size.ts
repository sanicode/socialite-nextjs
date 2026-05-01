export const BYTES_IN_KB = 1024
export const BYTES_IN_MB = BYTES_IN_KB * 1024
export const BYTES_IN_GB = BYTES_IN_MB * 1024

export const DEFAULT_MAX_UPLOADED_FILE_SIZE_BYTES = 1 * BYTES_IN_MB

export const UPLOAD_FILE_SIZE_OPTIONS = [
  { bytes: 1 * BYTES_IN_MB, label: '1 MB' },
  { bytes: 2 * BYTES_IN_MB, label: '2 MB' },
  { bytes: 5 * BYTES_IN_MB, label: '5 MB' },
  { bytes: 10 * BYTES_IN_MB, label: '10 MB' },
  { bytes: 20 * BYTES_IN_MB, label: '20 MB' },
] as const

const OPTION_BYTES = new Set(UPLOAD_FILE_SIZE_OPTIONS.map((option) => option.bytes))

export function formatUploadFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '1 MB'
  if (bytes >= BYTES_IN_MB) {
    const mb = bytes / BYTES_IN_MB
    return Number.isInteger(mb) ? `${mb} MB` : `${mb.toFixed(1)} MB`
  }
  const kb = bytes / BYTES_IN_KB
  return Number.isInteger(kb) ? `${kb} KB` : `${kb.toFixed(1)} KB`
}

export function normalizeUploadFileSizeBytes(value: unknown): number {
  const numeric = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : NaN
  if (Number.isFinite(numeric) && OPTION_BYTES.has(numeric)) {
    return numeric
  }

  return DEFAULT_MAX_UPLOADED_FILE_SIZE_BYTES
}

export function isUploadFileSizeAllowed(bytes: number): boolean {
  return OPTION_BYTES.has(bytes)
}
