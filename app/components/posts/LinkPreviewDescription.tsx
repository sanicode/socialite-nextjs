import { parseLinkPreviewDescription } from '@/app/lib/link-preview-description'

type Props = {
  value: string | null
  variant?: 'table' | 'form'
  emptyLabel?: string
}

const SOFT_BREAK = '\u200B'
const SOFT_BREAK_INTERVAL = 18

function getDisplayText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength).trimEnd()}...`
}

function renderWithWordBreaks(value: string, maxLength: number) {
  const text = getDisplayText(value, maxLength)
  const parts = text
    .split(/(\s+)/)
    .flatMap((part, partIndex) => {
      if (/^\s+$/.test(part) || part.length <= SOFT_BREAK_INTERVAL) return [part]
      return part
        .replace(new RegExp(`(.{${SOFT_BREAK_INTERVAL}})(?=.)`, 'g'), `$1${SOFT_BREAK}`)
        .split(SOFT_BREAK)
        .flatMap((chunk, index, chunks) => index < chunks.length - 1 ? [chunk, <wbr key={`${partIndex}-${index}`} />] : [chunk])
    })

  return parts
}

function removeLabel(line: string, label: string) {
  return line.startsWith(`${label}:`) ? line.slice(label.length + 1).trim() : null
}

function getDisplayMetadata(text: string | null) {
  if (!text) return { author: null, caption: null }

  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const author = lines.map((line) => removeLabel(line, 'Akun')).find(Boolean) ?? null
  const caption =
    lines.map((line) => removeLabel(line, 'Judul/Caption')).find(Boolean) ??
    lines.map((line) => removeLabel(line, 'Deskripsi')).find(Boolean) ??
    lines.filter((line) => !/^(Akun|Platform|Tipe):/.test(line)).join('\n')

  return {
    author,
    caption: caption || null,
  }
}

export default function LinkPreviewDescription({
  value,
  variant = 'table',
  emptyLabel = '—',
}: Props) {
  const preview = parseLinkPreviewDescription(value)
  const isForm = variant === 'form'
  const display = getDisplayMetadata(preview.text)

  if (!preview.text && !preview.thumbnailUrl) {
    return (
      <span className={isForm ? 'text-sm text-neutral-500 dark:text-neutral-400' : 'text-xs text-neutral-400'}>
        {emptyLabel}
      </span>
    )
  }

  const wrapperClass = isForm
    ? 'flex min-w-0 max-w-full items-start gap-3'
    : 'flex w-full min-w-0 max-w-full items-start gap-3'
  const authorMaxLength = isForm ? 96 : 52
  const captionMaxLength = isForm ? 180 : 96

  return (
    <div className={wrapperClass}>
      {preview.thumbnailUrl && (
        <div className={`${isForm ? 'h-20 w-20' : 'h-14 w-14'} shrink-0 overflow-hidden rounded-md border border-neutral-200 bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview.thumbnailUrl}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
          />
        </div>
      )}
      {display.author || display.caption ? (
        <div className={`${isForm ? 'space-y-1' : 'space-y-0.5'} w-0 min-w-0 flex-1`}>
          {display.author && (
            <p
              title={display.author}
              className={`${isForm ? 'text-sm' : 'text-xs'} min-w-0 max-w-full whitespace-normal font-semibold leading-tight text-neutral-900 dark:text-white`}
            >
              {renderWithWordBreaks(display.author, authorMaxLength)}
            </p>
          )}
          {display.caption && (
            <p
              title={display.caption}
              className={`${isForm ? 'text-sm' : 'text-xs'} min-w-0 max-w-full whitespace-normal leading-tight text-neutral-500 dark:text-neutral-400`}
            >
              {renderWithWordBreaks(display.caption, captionMaxLength)}
            </p>
          )}
        </div>
      ) : null}
    </div>
  )
}
