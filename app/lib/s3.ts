import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { randomBytes } from 'crypto'

export type ReportObjectKeyKind = 'default' | 'upload' | 'amplifikasi' | 'pending'
export type ReportObjectKeyLocation = {
  province?: string | null
  city?: string | null
}

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION ?? 'auto',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
})

export async function uploadToS3(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  )
}

export async function deleteFromS3(fileName: string): Promise<void> {
  await s3.send(
    new DeleteObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: fileName,
    })
  )
}

export function getMediaUrl(fileName: string): string {
  return `${process.env.NEXT_PUBLIC_S3_PUBLIC_URL}/${fileName}`
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

export function buildReportObjectKey(
  ext: string,
  kind: ReportObjectKeyKind = 'pending',
  location: ReportObjectKeyLocation = {},
): { fileName: string; objectKey: string } {
  const { year, month, day } = getJakartaDateParts()
  const safeExt = ext.replace(/^\.+/, '').toLowerCase()
  const fileName = `${randomBytes(16).toString('hex')}.${safeExt}`
  const province = slugifyPathSegment(location.province, 'unknown-province')
  const city = slugifyPathSegment(location.city, 'unknown-city')
  return {
    fileName,
    objectKey: `reports/${year}/${month}/${day}/${province}/${city}/${kind}/${fileName}`,
  }
}
