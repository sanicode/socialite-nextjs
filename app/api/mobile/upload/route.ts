import { NextRequest, NextResponse } from 'next/server'
import { randomBytes, randomUUID } from 'crypto'
import { uploadToS3 } from '@/app/lib/s3'
import { prisma } from '@/app/lib/prisma'
import { requireJwt, apiError, ApiError, requireApiEnabled } from '@/app/lib/api-auth'
import { getSecuritySettings } from '@/app/lib/request-security'
import { formatUploadFileSize } from '@/app/lib/upload-size'
import { getNonAdminReportingWindowDecision } from '@/app/lib/operator-reporting-window'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const COLLECTION_NAME = 'blog-images'

export async function POST(request: NextRequest) {
  try {
    await requireApiEnabled()
    const payload = requireJwt(request)
    const reportingWindowDecision = await getNonAdminReportingWindowDecision(payload.roles)
    if (!reportingWindowDecision.allowed) {
      throw new ApiError(403, reportingWindowDecision.message ?? 'Pelaporan operator sedang ditutup.')
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const { maxUploadedFileSizeBytes } = await getSecuritySettings()

    if (!file) {
      return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 })
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Tipe file tidak didukung. Gunakan JPG, PNG, GIF, atau WebP.' },
        { status: 400 }
      )
    }
    if (file.size > maxUploadedFileSizeBytes) {
      return NextResponse.json(
        { error: `Ukuran file terlalu besar (maks ${formatUploadFileSize(maxUploadedFileSizeBytes)}).` },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const uuid = randomUUID()

    const media = await prisma.media.create({
      data: {
        model_type: 'App\\Models\\BlogPost',
        model_id: BigInt(0),
        uuid,
        collection_name: COLLECTION_NAME,
        name: file.name,
        file_name: 'pending',
        mime_type: file.type,
        disk: 's3',
        conversions_disk: 's3',
        size: BigInt(file.size),
        manipulations: {},
        custom_properties: {},
        generated_conversions: {},
        responsive_images: {},
      },
    })

    const hash = randomBytes(16).toString('hex')
    const ext = file.name.split('.').pop() ?? 'jpg'
    const fileName = `${COLLECTION_NAME}-${hash}.${ext}`
    const objectKey = `${media.id}/${fileName}`
    const publicUrl = `${process.env.NEXT_PUBLIC_S3_PUBLIC_URL}/${objectKey}`

    try {
      await uploadToS3(buffer, objectKey, file.type)
    } catch (err) {
      await prisma.media.delete({ where: { id: media.id } })
      throw err
    }

    await prisma.media.update({
      where: { id: media.id },
      data: {
        file_name: fileName,
        custom_properties: { source_url: publicUrl, object_key: objectKey },
      },
    })

    return NextResponse.json({
      id: media.id.toString(),
      uuid: media.uuid,
      fileName,
      url: publicUrl,
    })
  } catch (error) {
    return apiError(error)
  }
}
