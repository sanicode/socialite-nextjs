import { requireJwt, apiError, ApiError, requireApiEnabled } from '@/app/lib/api-auth'
import { prisma } from '@/app/lib/prisma'
import { logEvent } from '@/app/lib/logger'
import { getNonAdminReportingWindowDecision } from '@/app/lib/operator-reporting-window'
import { canActorValidatePost } from '@/app/lib/tenant-access'
import {
  getOperatorReportValidationDisabledMessage,
  getRequiredSocialMediaCategoryCount,
  isOperatorReportValidationReady,
} from '@/app/lib/operator-report-validation'

type Ctx = { params: Promise<{ id: string }> }

function getJakartaDateString(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function normalizeValidationDate(value: unknown, fallback: string) {
  if (value === undefined || value === null || value === '') return fallback
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ApiError(400, 'Rentang tanggal validasi tidak valid')
  }
  const parsed = new Date(`${value}T00:00:00+07:00`)
  if (Number.isNaN(parsed.getTime()) || getJakartaDateString(parsed) !== value) {
    throw new ApiError(400, 'Rentang tanggal validasi tidak valid')
  }
  return value
}

function getJakartaDateBounds(dateString: string, endOfDay: boolean) {
  return new Date(`${dateString}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}+07:00`)
}

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    await requireApiEnabled()
    const payload = await requireJwt(request)
    const { id } = await params

    if (!payload.roles.includes('admin') && !payload.roles.includes('manager')) {
      throw new ApiError(403, 'Hanya admin atau manager yang dapat mengubah status laporan')
    }

    const reportingWindowDecision = await getNonAdminReportingWindowDecision(payload.roles)
    if (!reportingWindowDecision.allowed) {
      throw new ApiError(403, reportingWindowDecision.message ?? 'Pelaporan sedang ditutup.')
    }

    const body = await request.json()
    const { status, date_from: rawDateFrom, date_to: rawDateTo } = body

    if (!['pending', 'valid', 'invalid'].includes(status)) {
      return Response.json({ error: 'Status harus pending, valid, atau invalid' }, { status: 400 })
    }

    const post = await prisma.blog_posts.findUnique({
      where: { id: BigInt(id) },
      select: { id: true, user_id: true, tenant_id: true },
    })
    if (!post) return Response.json({ error: 'Laporan tidak ditemukan' }, { status: 404 })
    const canValidate = await canActorValidatePost(payload, {
      userId: post.user_id.toString(),
      tenantId: post.tenant_id?.toString() ?? null,
    })
    if (!canValidate) throw new ApiError(403, 'Anda tidak memiliki akses untuk mengubah status laporan ini')

    if (!payload.roles.includes('admin') && status !== 'pending') {
      const today = getJakartaDateString()
      const dateFrom = normalizeValidationDate(rawDateFrom, today)
      const dateTo = normalizeValidationDate(rawDateTo, today)
      const [uploadCount, amplifikasiCount, requiredCategoryCount] = await Promise.all([
        prisma.blog_posts.count({
          where: {
            user_id: post.user_id,
            source_url: 'upload',
            created_at: {
              gte: getJakartaDateBounds(dateFrom, false),
              lte: getJakartaDateBounds(dateTo, true),
            },
          },
        }),
        prisma.blog_posts.count({
          where: {
            user_id: post.user_id,
            source_url: 'amplifikasi',
            created_at: {
              gte: getJakartaDateBounds(dateFrom, false),
              lte: getJakartaDateBounds(dateTo, true),
            },
          },
        }),
        getRequiredSocialMediaCategoryCount(),
      ])

      if (!isOperatorReportValidationReady(uploadCount, amplifikasiCount, requiredCategoryCount)) {
        throw new ApiError(400, getOperatorReportValidationDisabledMessage(requiredCategoryCount))
      }
    }

    await prisma.blog_posts.update({
      where: { id: BigInt(id) },
      data: { status, updated_at: new Date() },
    })

    logEvent('info', 'mobile.posts.update_status', { postId: id, userId: payload.sub, status })
    return Response.json({ success: true })
  } catch (error) {
    return apiError(error)
  }
}
