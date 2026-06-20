import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { randomBytes } from 'crypto'
import {
  getPublicMediaBaseUrl,
  getS3ClientRegion,
  getS3Endpoint,
  shouldForceS3PathStyle,
} from '@/app/lib/env'

export type ReportObjectKeyKind = 'default' | 'upload' | 'amplifikasi' | 'social-media' | 'pending'
export type ReportObjectKeyLocation = {
  province?: string | null
  city?: string | null
}
export type ReportObjectKeyUploader = {
  name?: string | null
  userId?: string | bigint | null
}

export type StoredMediaReference = {
  file_name: string
  custom_properties: unknown
}

let s3Client: S3Client | null = null

function getS3Client(): S3Client {
  if (s3Client) return s3Client

  const endpoint = getS3Endpoint()
  s3Client = new S3Client({
    ...(endpoint ? { endpoint } : {}),
    region: getS3ClientRegion(),
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
    forcePathStyle: shouldForceS3PathStyle(),
  })
  return s3Client
}

function getCustomProperties(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  if (typeof value !== 'string') return null

  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null
  } catch {
    return null
  }
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export async function uploadToS3(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<void> {
  await getS3Client().send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    })
  )
}

export async function deleteFromS3(fileName: string): Promise<void> {
  await getS3Client().send(
    new DeleteObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: fileName,
    })
  )
}

export function getMediaUrl(objectKey: string): string {
  return `${getPublicMediaBaseUrl()}/${objectKey.replace(/^\/+/, '')}`
}

export function getStoredMediaObjectKey(media: StoredMediaReference): string {
  const properties = getCustomProperties(media.custom_properties)
  return properties && typeof properties.object_key === 'string' && properties.object_key.trim()
    ? properties.object_key
    : media.file_name
}

export function getStoredMediaUrl(media: StoredMediaReference): string {
  const properties = getCustomProperties(media.custom_properties)
  const sourceUrl = properties?.source_url
  if (typeof sourceUrl === 'string' && isHttpUrl(sourceUrl)) {
    return sourceUrl
  }
  return getMediaUrl(getStoredMediaObjectKey(media))
}

function getJakartaDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  return {
    year: parts.find((part) => part.type === 'year')?.value ?? '0000',
    month: parts.find((part) => part.type === 'month')?.value ?? '00',
    day: parts.find((part) => part.type === 'day')?.value ?? '00',
  }
}

function slugifyPathSegment(value: string | null | undefined, fallback: string): string {
  const slug = (value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  return slug || fallback
}

function getNameInitials(value: string | null | undefined): string {
  const initials = (value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 16)

  return initials || 'op'
}

export function buildReportObjectKey(
  ext: string,
  kind: ReportObjectKeyKind = 'pending',
  location: ReportObjectKeyLocation = {},
  uploader: ReportObjectKeyUploader = {},
): { fileName: string; objectKey: string } {
  const uploadedAt = new Date()
  const { year, month, day } = getJakartaDateParts(uploadedAt)
  const safeExt = ext.replace(/^\.+/, '').toLowerCase()
  const operatorInitials = getNameInitials(uploader.name)
  const userId = slugifyPathSegment(uploader.userId?.toString(), 'unknown-user')
  const fileName = kind === 'amplifikasi'
    ? `${operatorInitials}-${userId}-${uploadedAt.getTime()}.${safeExt}`
    : `${randomBytes(16).toString('hex')}.${safeExt}`
  const province = slugifyPathSegment(location.province, 'unknown-province')
  const city = slugifyPathSegment(location.city, 'unknown-city')
  return {
    fileName,
    objectKey: `reports/${year}/${month}/${day}/${province}/${city}/${kind}/${fileName}`,
  }
}
