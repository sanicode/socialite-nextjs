'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/app/lib/authorization'
import type { AllowedMediaFile } from '@/app/lib/file-validation'
import { detectAllowedMedia } from '@/app/lib/file-validation'
import { prisma } from '@/app/lib/prisma'
import { logEvent } from '@/app/lib/logger'
import { decryptSocialToken } from '@/app/lib/social-oauth'
import { detectSocialPlatformFromCategory, getSocialPlatformLabel } from '@/app/lib/social-platform'
import { getSecuritySettings } from '@/app/lib/request-security'
import { getOperatorReportingWindowDecision } from '@/app/lib/operator-reporting-window'
import { formatUploadFileSize } from '@/app/lib/upload-size'
import { buildReportObjectKey, deleteFromS3, uploadToS3 } from '@/app/lib/s3'
import { getReportLocationByUserId } from '@/app/lib/report-location'
import { randomUUID } from 'crypto'

export type SocialMediaPostState =
  | {
      status?: 'success' | 'error'
      message?: string
      postUrl?: string
      errors?: {
        category_id?: string[]
        account_id?: string[]
        message?: string[]
        media?: string[]
      }
    }
  | undefined

type PreparedMediaFile = AllowedMediaFile & {
  buffer: Buffer
  originalName: string
  size: number
}

type UploadedSocialMediaAttachment = {
  mediaId: bigint
  fileName: string
  objectKey: string
  publicUrl: string
}

function readMetadataValue(metadata: unknown, key: string) {
  return metadata && typeof metadata === 'object' && key in metadata
    ? String((metadata as Record<string, unknown>)[key] ?? '')
    : ''
}

function generateSocialPostSlug(message: string) {
  const base = message
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72) || 'social-media-post'
  return `${base}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function parseFacebookPostResponse(payload: unknown): { id?: string; postId?: string; error?: { message?: string; code?: number } } {
  if (!payload || typeof payload !== 'object') return {}
  const data = payload as { id?: unknown; error?: unknown }
  const postId = 'post_id' in data ? (data as { post_id?: unknown }).post_id : undefined
  const error = data.error && typeof data.error === 'object'
    ? data.error as { message?: string; code?: number }
    : undefined
  return {
    id: typeof data.id === 'string' ? data.id : undefined,
    postId: typeof postId === 'string' ? postId : undefined,
    error,
  }
}

function bufferToBlob(buffer: Buffer, mime: string) {
  const arrayBuffer = new ArrayBuffer(buffer.byteLength)
  new Uint8Array(arrayBuffer).set(buffer)
  return new Blob([arrayBuffer], { type: mime })
}

async function publishFacebookMediaPost(
  pageId: string,
  accessToken: string,
  message: string,
  media: PreparedMediaFile
) {
  const graphVersion = process.env.FACEBOOK_GRAPH_VERSION ?? 'v19.0'
  const body = new FormData()
  body.set('access_token', accessToken)
  body.set(media.kind === 'photo' ? 'caption' : 'description', message)
  body.set('source', bufferToBlob(media.buffer, media.mime), media.originalName)

  const response = await fetch(`https://graph.facebook.com/${graphVersion}/${pageId}/${media.kind === 'photo' ? 'photos' : 'videos'}`, {
    method: 'POST',
    body,
    cache: 'no-store',
  })
  const payload = await response.json().catch(() => null)
  const parsed = parseFacebookPostResponse(payload)

  if (!response.ok || parsed.error) {
    throw new Error(parsed.error?.message ?? 'Facebook menolak request posting.')
  }

  if (!parsed.id) throw new Error('Facebook tidak mengembalikan ID posting.')

  return {
    id: parsed.id,
    url: parsed.postId
      ? `https://www.facebook.com/${parsed.postId}`
      : media.kind === 'video'
        ? `https://www.facebook.com/${pageId}/videos/${parsed.id}`
        : `https://www.facebook.com/${parsed.id}`,
    raw: payload,
  }
}

async function uploadSocialMediaAttachment(
  media: PreparedMediaFile,
  uploadedBy: string
): Promise<UploadedSocialMediaAttachment> {
  const location = await getReportLocationByUserId(uploadedBy)
  const { fileName, objectKey } = buildReportObjectKey(media.ext, 'social-media', location)
  const publicUrl = `${process.env.NEXT_PUBLIC_S3_PUBLIC_URL}/${objectKey}`
  const mediaRecord = await prisma.media.create({
    data: {
      model_type: 'App\\Models\\BlogPost',
      model_id: BigInt(0),
      uuid: randomUUID(),
      collection_name: 'blog-images',
      name: media.originalName,
      file_name: 'pending',
      mime_type: media.mime,
      disk: 's3',
      conversions_disk: 's3',
      size: BigInt(media.size),
      manipulations: {},
      custom_properties: { uploaded_by: uploadedBy, media_kind: media.kind },
      generated_conversions: {},
      responsive_images: {},
    },
  })

  try {
    await uploadToS3(media.buffer, objectKey, media.mime)
  } catch (error) {
    await prisma.media.delete({ where: { id: mediaRecord.id } })
    throw error
  }

  await prisma.media.update({
    where: { id: mediaRecord.id },
    data: {
      file_name: fileName,
      custom_properties: { source_url: publicUrl, object_key: objectKey, uploaded_by: uploadedBy, media_kind: media.kind },
    },
  })

  return {
    mediaId: mediaRecord.id,
    fileName,
    objectKey,
    publicUrl,
  }
}

async function deleteUploadedSocialMediaAttachment(attachment: UploadedSocialMediaAttachment) {
  const results = await Promise.allSettled([
    deleteFromS3(attachment.objectKey),
    prisma.media.delete({ where: { id: attachment.mediaId } }),
  ])

  for (const result of results) {
    if (result.status === 'rejected') {
      logEvent('error', 'social_media.attachment_cleanup_failed', {
        mediaId: attachment.mediaId.toString(),
        error: result.reason instanceof Error ? result.reason.message : 'unknown_error',
      })
    }
  }
}

export async function createSocialMediaPost(
  _state: SocialMediaPostState,
  formData: FormData
): Promise<SocialMediaPostState> {
  const user = await requireUser()

  const securitySettings = await getSecuritySettings()
  if (!securitySettings.socialMediaConnectionsEnabled) {
    return { status: 'error', message: 'Fitur akun medsos operator sedang dinonaktifkan.' }
  }

  const reportingWindowDecision = await getOperatorReportingWindowDecision(user.roles)
  if (!reportingWindowDecision.allowed) {
    return { status: 'error', message: reportingWindowDecision.message ?? 'Pelaporan operator sedang ditutup.' }
  }

  const isAdmin = user.roles.includes('admin')
  const isManager = user.roles.includes('manager')
  if (isAdmin || isManager || !user.roles.includes('operator')) {
    return { status: 'error', message: 'Halaman posting medsos hanya untuk operator.' }
  }

  const categoryId = String(formData.get('category_id') ?? '').trim()
  const accountId = String(formData.get('account_id') ?? '').trim()
  const message = String(formData.get('message') ?? '').trim()
  const mediaInput = formData.get('media')
  const mediaFile = mediaInput instanceof File ? mediaInput : null
  const errors: NonNullable<SocialMediaPostState>['errors'] = {}
  let preparedMedia: PreparedMediaFile | null = null
  const { maxUploadedFileSizeBytes } = securitySettings

  if (!categoryId || !/^\d+$/.test(categoryId)) errors.category_id = ['Kategori media sosial wajib dipilih.']
  if (!accountId || !/^\d+$/.test(accountId)) errors.account_id = ['Akun medsos wajib dipilih.']
  if (!message) errors.message = ['Isi postingan tidak boleh kosong.']
  if (!mediaFile || mediaFile.size === 0) {
    errors.media = ['Foto atau video wajib diupload.']
  } else if (mediaFile.size > maxUploadedFileSizeBytes) {
    errors.media = [`Ukuran file terlalu besar (maks ${formatUploadFileSize(maxUploadedFileSizeBytes)}).`]
  } else {
    const buffer = Buffer.from(await mediaFile.arrayBuffer())
    const detectedMedia = detectAllowedMedia(buffer)
    if (!detectedMedia) {
      errors.media = ['Tipe file tidak didukung. Gunakan JPG, PNG, GIF, WebP, MP4, MOV, atau WebM.']
    } else {
      preparedMedia = {
        ...detectedMedia,
        buffer,
        originalName: mediaFile.name || `social-media.${detectedMedia.ext}`,
        size: mediaFile.size,
      }
    }
  }
  if (Object.keys(errors).length > 0) return { status: 'error', errors }
  if (!preparedMedia) return { status: 'error', errors: { media: ['Foto atau video wajib diupload.'] } }

  const category = await prisma.blog_post_categories.findUnique({
    where: { id: BigInt(categoryId) },
    select: { id: true, name: true },
  })
  if (!category) return { status: 'error', errors: { category_id: ['Kategori tidak ditemukan.'] } }

  const platform = detectSocialPlatformFromCategory(category.name)
  if (!platform) {
    return { status: 'error', message: 'Kategori ini belum dikenali sebagai kategori media sosial yang bisa diposting.' }
  }
  if (platform !== 'facebook') {
    return {
      status: 'error',
      message: `Posting otomatis untuk ${getSocialPlatformLabel(platform)} belum tersedia.`,
    }
  }

  const account = await prisma.user_social_medias.findFirst({
    where: {
      id: BigInt(accountId),
      user_id: BigInt(user.id),
      platform,
      disconnected_at: null,
    },
  })
  if (!account) return { status: 'error', errors: { account_id: ['Akun Facebook terhubung tidak ditemukan.'] } }

  if (readMetadataValue(account.metadata, 'account_type') !== 'facebook_page') {
    return {
      status: 'error',
      message: 'Akun yang dipilih adalah profil Facebook personal. Posting otomatis wajib memakai Facebook Page karena publish_actions untuk profil personal sudah tidak didukung Meta.',
    }
  }

  let accessToken: string | null = null
  try {
    accessToken = decryptSocialToken(account.access_token)
  } catch {
    accessToken = null
  }
  if (!accessToken) {
    return {
      status: 'error',
      message: 'Token akun Facebook tidak valid. Putuskan akun lalu hubungkan ulang.',
    }
  }

  let published: Awaited<ReturnType<typeof publishFacebookMediaPost>>
  let uploadedAttachment: UploadedSocialMediaAttachment
  try {
    uploadedAttachment = await uploadSocialMediaAttachment(preparedMedia, user.id)
  } catch {
    return {
      status: 'error',
      message: 'Upload media gagal. Periksa koneksi storage lalu coba lagi.',
    }
  }

  try {
    published = await publishFacebookMediaPost(account.provider_account_id, accessToken, message, preparedMedia)
  } catch (error) {
    await deleteUploadedSocialMediaAttachment(uploadedAttachment)
    return {
      status: 'error',
      message: error instanceof Error
        ? `Gagal posting ke Facebook: ${error.message}`
        : 'Gagal posting ke Facebook.',
    }
  }

  const tenantUser = await prisma.tenant_user.findFirst({
    where: { user_id: BigInt(user.id) },
    select: { tenant_id: true },
  })
  const post = await prisma.blog_posts.create({
    data: {
      title: published.url,
      slug: generateSocialPostSlug(message),
      body: message,
      description: preparedMedia.originalName,
      status: 'valid',
      is_published: true,
      published_at: new Date(),
      user_id: BigInt(user.id),
      tenant_id: tenantUser?.tenant_id ?? null,
      blog_post_category_id: category.id,
      source_url: 'social_media',
      created_at: new Date(),
      updated_at: new Date(),
    },
  })

  await prisma.media.update({
    where: { id: uploadedAttachment.mediaId },
    data: {
      model_id: post.id,
      custom_properties: {
        source_url: uploadedAttachment.publicUrl,
        object_key: uploadedAttachment.objectKey,
        uploaded_by: user.id,
        media_kind: preparedMedia.kind,
        social_post_id: published.id,
        social_post_url: published.url,
      },
    },
  })

  logEvent('info', 'social_media.post_created', {
    userId: user.id,
    platform,
    accountId: account.id.toString(),
    providerAccountId: account.provider_account_id,
    postId: published.id,
    mediaId: uploadedAttachment.mediaId.toString(),
    mediaKind: preparedMedia.kind,
  })
  revalidatePath('/posts/social-media')

  return {
    status: 'success',
    message: 'Postingan berhasil dikirim ke Facebook.',
    postUrl: published.url,
  }
}
