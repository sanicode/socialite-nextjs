import { parseLinkPreviewDescription } from '@/app/lib/link-preview-description'

type Props = {
  value: string | null
  variant?: 'table' | 'form'
  emptyLabel?: string
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
    ? 'flex min-w-0 max-w-full items-start gap-3 overflow-hidden'
    : 'flex w-full min-w-0 max-w-full items-start gap-3 overflow-hidden'

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
        <div className="w-0 min-w-0 flex-1 space-y-1">
          {display.author && (
            <p
              title={display.author}
              className={`${isForm ? 'text-sm' : 'text-xs'} min-w-0 max-w-full whitespace-normal break-all font-semibold leading-relaxed text-neutral-900 [overflow-wrap:anywhere] dark:text-white`}
            >
              {display.author}
            </p>
          )}
          {display.caption && (
            <p
              title={display.caption}
              className={`${isForm ? 'text-sm line-clamp-3' : 'text-xs line-clamp-2'} min-w-0 max-w-full whitespace-normal break-all leading-relaxed text-neutral-500 [overflow-wrap:anywhere] dark:text-neutral-400`}
            >
              {display.caption}
            </p>
          )}
        </div>
      ) : null}
    </div>
  )
}
