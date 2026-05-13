export type AllowedImageFile = {
  mime: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
  ext: 'jpg' | 'png' | 'gif' | 'webp'
}

export type AllowedVideoFile = {
  mime: 'video/mp4' | 'video/quicktime' | 'video/webm'
  ext: 'mp4' | 'mov' | 'webm'
}

export type AllowedMediaFile =
  | (AllowedImageFile & { kind: 'photo' })
  | (AllowedVideoFile & { kind: 'video' })

export function detectAllowedImage(buffer: Buffer): AllowedImageFile | null {
  if (buffer.length < 12) return null

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: 'image/jpeg', ext: 'jpg' }
  }

  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { mime: 'image/png', ext: 'png' }
  }

  const signature = buffer.subarray(0, 6).toString('ascii')
  if (signature === 'GIF87a' || signature === 'GIF89a') {
    return { mime: 'image/gif', ext: 'gif' }
  }

  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { mime: 'image/webp', ext: 'webp' }
  }

  return null
}

export function detectAllowedVideo(buffer: Buffer): AllowedVideoFile | null {
  if (buffer.length < 12) return null

  if (buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) {
    return { mime: 'video/webm', ext: 'webm' }
  }

  if (buffer.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = buffer.subarray(8, 12).toString('ascii').toLowerCase()
    if (brand === 'qt  ') return { mime: 'video/quicktime', ext: 'mov' }
    return { mime: 'video/mp4', ext: 'mp4' }
  }

  return null
}

export function detectAllowedMedia(buffer: Buffer): AllowedMediaFile | null {
  const image = detectAllowedImage(buffer)
  if (image) return { ...image, kind: 'photo' }

  const video = detectAllowedVideo(buffer)
  if (video) return { ...video, kind: 'video' }

  return null
}
