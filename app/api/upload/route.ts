import { NextRequest, NextResponse } from 'next/server'
import { randomBytes, randomUUID } from 'crypto'
import { uploadToS3 } from '@/app/lib/s3'
import { prisma } from '@/app/lib/prisma'
import { requireUser } from '@/app/lib/authorization'
import { logEvent } from '@/app/lib/logger'
import { writeAccessLog } from '@/app/lib/access-logs'
import { getSecuritySettings } from '@/app/lib/request-security'
import { formatUploadFileSize } from '@/app/lib/upload-size'
import { ApiError, requireApiEnabled } from '@/app/lib/api-auth'
import { getNonAdminReportingWindowDecision } from '@/app/lib/operator-reporting-window'
import { detectAllowedImage } from '@/app/lib/file-validation'

const COLLECTION_NAME = 'blog-images'

export async function POST(request: NextRequest) {
  try {
    await requireApiEnabled()
    const user = await requireUser()
    const reportingWindowDecision = await getNonAdminReportingWindowDecision(user.roles)
    if (!reportingWindowDecision.allowed) {
      throw new ApiError(403, reportingWindowDecision.message ?? 'Pelaporan operator sedang ditutup.')
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const { maxUploadedFileSizeBytes } = await getSecuritySettings()

    if (!file) {
      return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 })
    }

    if (file.size > maxUploadedFileSizeBytes) {
      return NextResponse.json(
        { error: `Ukuran file terlalu besar (maks ${formatUploadFileSize(maxUploadedFileSizeBytes)}).` },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const detectedFile = detectAllowedImage(buffer)
    if (!detectedFile) {
      return NextResponse.json(
        { error: 'Tipe file tidak didukung. Gunakan JPG, PNG, GIF, atau WebP.' },
        { status: 400 }
      )
    }
    const uuid = randomUUID()

    // 1. Create media record first to get the ID
    const media = await prisma.media.create({
      data: {
        model_type: 'App\\Models\\BlogPost',
        model_id: BigInt(0),
        uuid,
        collection_name: COLLECTION_NAME,
        name: file.name,
        file_name: 'pending',
        mime_type: detectedFile.mime,
        disk: 's3',
        conversions_disk: 's3',
        size: BigInt(file.size),
        manipulations: {},
        custom_properties: { uploaded_by: user.id },
        generated_conversions: {},
        responsive_images: {},
      },
    })

    // 2. Generate filename matching Laravel Spatie pattern: {collection}-{hash}.{ext}
    const hash = randomBytes(16).toString('hex')
    const ext = detectedFile.ext
    const fileName = `${COLLECTION_NAME}-${hash}.${ext}`
    const objectKey = `${media.id}/${fileName}`
    const publicUrl = `${process.env.NEXT_PUBLIC_S3_PUBLIC_URL}/${objectKey}`

    // 3. Upload to S3
    try {
      await uploadToS3(buffer, objectKey, detectedFile.mime)
    } catch (err) {
      // Clean up the media record on S3 failure
      await prisma.media.delete({ where: { id: media.id } })
      throw err
    }

    // 4. Update media record with final file_name and custom_properties
    await prisma.media.update({
      where: { id: media.id },
      data: {
        file_name: fileName,
        custom_properties: { source_url: publicUrl, object_key: objectKey, uploaded_by: user.id },
      },
    })

    logEvent('info', 'upload.media.created', {
      mediaId: media.id.toString(),
      userId: user.id,
      collection: COLLECTION_NAME,
    })
    await writeAccessLog({
      eventType: 'upload_success',
      status: 'success',
      method: request.method,
      requestPath: request.nextUrl.pathname,
      userId: user.id,
      userEmail: user.email,
      details: {
        mediaId: media.id.toString(),
        collection: COLLECTION_NAME,
      },
    })

    return NextResponse.json({
      id: media.id.toString(),
      uuid: media.uuid,
      fileName,
      url: publicUrl,
    })
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    logEvent('error', 'upload.media.failed', { error })
    await writeAccessLog({
      eventType: 'upload_failed',
      status: 'failed',
      method: request.method,
      requestPath: request.nextUrl.pathname,
      details: {
        error: error instanceof Error ? error.message : 'unknown_error',
      },
    })
    return NextResponse.json({ error: 'Upload gagal' }, { status: 500 })
  }
}
