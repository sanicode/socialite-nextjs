import { NextRequest, NextResponse } from 'next/server'
import { randomBytes, randomUUID } from 'crypto'
import { uploadToS3 } from '@/app/lib/s3'
import { prisma } from '@/app/lib/prisma'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_SIZE = 1 * 1024 * 1024 // 1MB
const COLLECTION_NAME = 'blog-images'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Tipe file tidak didukung. Gunakan JPG, PNG, GIF, atau WebP.' },
        { status: 400 }
      )
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'Ukuran file terlalu besar (maks 1MB)' },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
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

    // 2. Generate filename matching Laravel Spatie pattern: {collection}-{hash}.{ext}
    const hash = randomBytes(16).toString('hex')
    const ext = file.name.split('.').pop() ?? 'jpg'
    const fileName = `${COLLECTION_NAME}-${hash}.${ext}`
    const objectKey = `${media.id}/${fileName}`
    const publicUrl = `${process.env.NEXT_PUBLIC_S3_PUBLIC_URL}/${objectKey}`

    // 3. Upload to S3
    try {
      await uploadToS3(buffer, objectKey, file.type)
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
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'Upload gagal' }, { status: 500 })
  }
}
