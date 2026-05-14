export type LinkPreviewDescriptionItem =
  | { type: 'thumbnail'; url: string }
  | { type: 'text'; value: string }

export type ParsedLinkPreviewDescription = {
  text: string | null
  thumbnailUrl: string | null
  isStructured: boolean
}

const MAX_TEXT_LENGTH = 1500

function cleanText(value: string | null | undefined) {
  const cleaned = value
    ?.replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
  return cleaned ? cleaned.slice(0, MAX_TEXT_LENGTH) : null
}

function isSafeHttpUrl(value: string | null | undefined): value is string {
  if (!value) return false

  try {
    const url = new URL(value.trim())
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function stringifyLinkPreviewDescription(input: {
  text?: string | null
  thumbnailUrl?: string | null
}) {
  const items: LinkPreviewDescriptionItem[] = []
  const thumbnailUrl = input.thumbnailUrl?.trim()
  const text = cleanText(input.text)

  if (isSafeHttpUrl(thumbnailUrl)) {
    items.push({ type: 'thumbnail', url: thumbnailUrl })
  }

  if (text) {
    items.push({ type: 'text', value: text })
  }

  return items.length > 0 ? JSON.stringify(items) : null
}

export function parseLinkPreviewDescription(value: string | null | undefined): ParsedLinkPreviewDescription {
  const raw = value?.trim()
  if (!raw) return { text: null, thumbnailUrl: null, isStructured: false }

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) {
      return { text: cleanText(raw), thumbnailUrl: null, isStructured: false }
    }

    const textParts: string[] = []
    let thumbnailUrl: string | null = null

    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue
      const record = item as Record<string, unknown>

      if (record.type === 'thumbnail' && typeof record.url === 'string' && isSafeHttpUrl(record.url)) {
        thumbnailUrl ??= record.url.trim()
        continue
      }

      if (record.type === 'text' && typeof record.value === 'string') {
        const text = cleanText(record.value)
        if (text) textParts.push(text)
      }
    }

    const text = cleanText(textParts.join('\n\n'))
    return { text, thumbnailUrl, isStructured: true }
  } catch {
    return { text: cleanText(raw), thumbnailUrl: null, isStructured: false }
  }
}
