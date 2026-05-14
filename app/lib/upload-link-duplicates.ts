import { prisma } from '@/app/lib/prisma'
import { getEquivalentSocialUrls, normalizeSocialUrl } from '@/app/lib/social-platform'

export const DUPLICATE_UPLOAD_LINK_MESSAGE = 'Link upload ini sudah pernah dikirim. Setiap link upload hanya boleh digunakan satu kali.'

export async function findDuplicateUploadLink(value: string, excludePostId?: bigint) {
  const equivalentUrls = getEquivalentSocialUrls(value)
  if (equivalentUrls.length === 0) return null

  const candidates = await prisma.blog_posts.findMany({
    where: {
      source_url: 'upload',
      ...(excludePostId ? { id: { not: excludePostId } } : {}),
      OR: equivalentUrls.flatMap((url) => [
        { title: { equals: url, mode: 'insensitive' as const } },
        { title: { contains: url, mode: 'insensitive' as const } },
      ]),
    },
    select: { id: true, user_id: true, title: true },
  })

  const normalizedValue = normalizeSocialUrl(value)
  return candidates.find((candidate) => candidate.title && normalizeSocialUrl(candidate.title) === normalizedValue) ?? null
}
