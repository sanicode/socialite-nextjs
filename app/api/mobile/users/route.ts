import bcrypt from 'bcryptjs'
import { requireJwtRole, apiError, ApiError, requireApiEnabled } from '@/app/lib/api-auth'
import { prisma } from '@/app/lib/prisma'
import { logEvent } from '@/app/lib/logger'
import type { Prisma } from '@/app/generated/prisma/client'

const MODEL_TYPE_USER = 'App\\Models\\User'

// ── GET /api/mobile/users ─────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    await requireApiEnabled()
    requireJwtRole(request, 'admin')
    const { searchParams } = new URL(request.url)

    const page     = Math.max(1, Number(searchParams.get('page') ?? '1') || 1)
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') ?? '20') || 20))
    const offset   = (page - 1) * pageSize
    const search        = searchParams.get('search') ?? undefined
    const status        = searchParams.get('status') ?? undefined
    const loginSecurity = searchParams.get('loginSecurity') ?? undefined
    const dateFrom      = searchParams.get('dateFrom') ?? undefined
    const dateTo        = searchParams.get('dateTo') ?? undefined
    const sortBy        = searchParams.get('sortBy') ?? undefined
    const sortDir       = searchParams.get('sortDir') ?? undefined

    const where: Prisma.usersWhereInput = {}
    if (search) {
      where.OR = [
        { name:  { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ]
    }
    if (status === 'blocked') where.is_blocked = true
    if (status === 'active')  where.is_blocked = false
    if (dateFrom || dateTo) {
      where.last_seen_at = {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo   ? { lte: new Date(dateTo + 'T23:59:59.999Z') } : {}),
      }
    }

    const dir: Prisma.SortOrder = sortDir === 'desc' ? 'desc' : 'asc'
    let orderBy: Prisma.usersOrderByWithRelationInput[]
    switch (sortBy) {
      case 'email':      orderBy = [{ email: dir }]; break
      case 'is_blocked': orderBy = [{ is_blocked: dir }, { name: 'asc' }]; break
      case 'last_seen_at': orderBy = [{ last_seen_at: dir }, { name: 'asc' }]; break
      default:           orderBy = [{ name: dir }]
    }

    const counts = await prisma.$queryRaw<{ email: string; count: bigint }[]>`
      SELECT LOWER(email) AS email, COUNT(DISTINCT attempted_at)::bigint AS count
      FROM login_attempts
      WHERE attempted_at > NOW() - INTERVAL '1 hour'
        AND email IS NOT NULL
      GROUP BY LOWER(email)
    `

    const rateLimitedRows = await prisma.$queryRaw<{ email: string }[]>`
      WITH tier1 AS (
        SELECT LOWER(email) AS email
        FROM login_attempts
        WHERE attempted_at > NOW() - INTERVAL '10 minutes'
          AND email IS NOT NULL
          AND key LIKE LOWER(email) || '|%'
        GROUP BY LOWER(email), key
        HAVING COUNT(DISTINCT attempted_at) >= 5
      ),
      tier2_blocked_ips AS (
        SELECT key AS ip
        FROM login_attempts
        WHERE attempted_at > NOW() - INTERVAL '10 minutes'
          AND email IS NOT NULL
          AND key <> LOWER(email)
          AND key NOT LIKE LOWER(email) || '|%'
        GROUP BY key
        HAVING COUNT(DISTINCT attempted_at) >= 20
      ),
      tier2 AS (
        SELECT DISTINCT LOWER(la.email) AS email
        FROM login_attempts la
        INNER JOIN tier2_blocked_ips ip ON ip.ip = la.key
        WHERE la.attempted_at > NOW() - INTERVAL '10 minutes'
          AND la.email IS NOT NULL
      ),
      tier3 AS (
        SELECT LOWER(email) AS email
        FROM login_attempts
        WHERE attempted_at > NOW() - INTERVAL '60 minutes'
          AND email IS NOT NULL
        GROUP BY LOWER(email)
        HAVING COUNT(DISTINCT attempted_at) >= 50
      )
      SELECT DISTINCT email
      FROM (
        SELECT email FROM tier1
        UNION SELECT email FROM tier2
        UNION SELECT email FROM tier3
      ) rate_limited
    `

    const countMap = new Map(counts.map((r) => [r.email.toLowerCase(), Number(r.count)]))
    const totalUnderAttack = counts.filter((r) => Number(r.count) > 10).length
    const rateLimitedEmails = new Set(rateLimitedRows.map((r) => r.email.toLowerCase()))
    const totalRateLimited = rateLimitedEmails.size

    if (loginSecurity) {
      const matchingEmails =
        loginSecurity === 'has_attempts'
          ? counts.filter((r) => Number(r.count) > 0).map((r) => r.email.toLowerCase())
          : loginSecurity === 'under_attack'
            ? counts.filter((r) => Number(r.count) > 10).map((r) => r.email.toLowerCase())
            : loginSecurity === 'rate_limited'
              ? Array.from(rateLimitedEmails)
              : []

      if (matchingEmails.length === 0) {
        return Response.json({
          users: [],
          total: 0,
          totalBlocked: await prisma.users.count({ where: { is_blocked: true } }),
          totalUnderAttack,
          totalRateLimited,
        })
      }
      where.email = { in: matchingEmails }
    }

    const [users, total, totalBlocked] = await Promise.all([
      prisma.users.findMany({
        where,
        select: { id: true, name: true, email: true, phone_number: true, is_blocked: true, is_admin: true, last_seen_at: true },
        orderBy,
        take: pageSize,
        skip: offset,
      }),
      prisma.users.count({ where }),
      prisma.users.count({ where: { is_blocked: true } }),
    ])

    const roleAssignments = await prisma.model_has_roles.findMany({
      where: { model_type: MODEL_TYPE_USER, model_id: { in: users.map((u) => u.id) } },
      include: { roles: { select: { id: true, name: true } } },
    })
    const roleMap = new Map(
      roleAssignments.map((r) => [r.model_id.toString(), { id: r.role_id.toString(), name: r.roles.name }])
    )

    return Response.json({
      users: users.map((u) => ({
        id: u.id.toString(),
        name: u.name,
        email: u.email,
        phone_number: u.phone_number ?? null,
        is_blocked: u.is_blocked,
        is_admin: u.is_admin,
        direct_role_id: roleMap.get(u.id.toString())?.id ?? null,
        direct_role_name: roleMap.get(u.id.toString())?.name ?? null,
        last_seen_at: u.last_seen_at?.toISOString() ?? null,
        active_failed_attempts: countMap.get(u.email.toLowerCase()) ?? 0,
        is_under_attack: (countMap.get(u.email.toLowerCase()) ?? 0) > 10,
        is_rate_limited: rateLimitedEmails.has(u.email.toLowerCase()),
      })),
      total,
      totalBlocked,
      totalUnderAttack,
      totalRateLimited,
    })
  } catch (error) {
    return apiError(error)
  }
}

// ── POST /api/mobile/users ────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    await requireApiEnabled()
    const admin = requireJwtRole(request, 'admin')
    const body = await request.json()

    const name  = (body.name ?? '').trim()
    const email = (body.email ?? '').trim().toLowerCase()
    const phone = (body.phone_number ?? '').trim()

    if (!name)  throw new ApiError(422, 'Nama tidak boleh kosong.')
    if (!email) throw new ApiError(422, 'Email tidak boleh kosong.')
    if (!phone) throw new ApiError(422, 'Nomor telp tidak boleh kosong.')

    const existing = await prisma.users.findUnique({ where: { email } })
    if (existing) throw new ApiError(409, 'Email sudah terdaftar.')

    const rawPassword = (body.password ?? '').trim() || phone
    const hashed = await bcrypt.hash(rawPassword, 12)

    const newUser = await prisma.users.create({
      data: {
        name,
        email,
        password: hashed,
        phone_number: phone,
        is_admin: body.is_admin ?? false,
        is_blocked: false,
      },
    })

    if (body.role_id) {
      await prisma.model_has_roles.create({
        data: { role_id: BigInt(body.role_id), model_type: MODEL_TYPE_USER, model_id: newUser.id },
      })
    }

    logEvent('info', 'user.created', { adminId: admin.sub, email })
    return Response.json({ id: newUser.id.toString() }, { status: 201 })
  } catch (error) {
    return apiError(error)
  }
}
