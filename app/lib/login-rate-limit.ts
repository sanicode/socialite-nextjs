import { headers } from 'next/headers'
import { prisma } from '@/app/lib/prisma'

// Tier 1: email + IP — cegah serangan terhadap satu akun
const TIER1_MAX        = 5   // maks gagal
const TIER1_WINDOW_MIN = 10  // dalam N menit
const TIER1_BLOCK_MIN  = 10  // block selama N menit

// Tier 2: IP saja — cegah credential stuffing (satu IP, banyak akun)
const TIER2_MAX        = 20
const TIER2_WINDOW_MIN = 10
const TIER2_BLOCK_MIN  = 30

// Tier 3: email saja — cegah distributed brute force (banyak IP, satu akun)
const TIER3_MAX        = 50
const TIER3_WINDOW_MIN = 60  // 1 jam
const TIER3_BLOCK_MIN  = 120 // 2 jam

export type RateLimitResult =
  | { blocked: false }
  | { blocked: true; retryAfterSeconds: number }

export async function getLoginIp(): Promise<string | null> {
  const h = await headers()
  const forwardedFor = h.get('x-forwarded-for')?.split(',')[0]?.trim()
  const realIp       = h.get('x-real-ip')?.trim()
  const cfIp         = h.get('cf-connecting-ip')?.trim()
  return forwardedFor ?? realIp ?? cfIp ?? null
}

export async function checkRateLimit(
  email: string,
  ip: string | null,
): Promise<RateLimitResult> {
  // Bersihkan catatan lama agar tabel tidak membengkak
  // Threshold 4 jam — cukup untuk window terpanjang (Tier 3: 1 jam window + 2 jam block)
  await prisma.$executeRawUnsafe(
    `DELETE FROM login_attempts WHERE attempted_at < NOW() - INTERVAL '4 hours'`,
  )

  const emailIpKey = `${email.toLowerCase()}|${ip ?? 'unknown'}`
  const ipKey      = ip ?? 'unknown'
  const emailKey   = email.toLowerCase()

  // --- Tier 1: email + IP ---
  const tier1 = await prisma.$queryRawUnsafe<{ count: bigint; latest: string | null }[]>(
    `SELECT COUNT(*)::bigint AS count, MAX(attempted_at)::text AS latest
     FROM login_attempts
     WHERE key = $1
       AND attempted_at > NOW() - INTERVAL '${TIER1_WINDOW_MIN} minutes'`,
    emailIpKey,
  )
  const tier1Count = Number(tier1[0]?.count ?? 0)
  if (tier1Count >= TIER1_MAX) {
    const latest    = tier1[0]?.latest ? new Date(tier1[0].latest) : new Date()
    const unlocksAt = new Date(latest.getTime() + TIER1_BLOCK_MIN * 60 * 1000)
    return { blocked: true, retryAfterSeconds: Math.max(1, Math.ceil((unlocksAt.getTime() - Date.now()) / 1000)) }
  }

  // --- Tier 2: IP saja ---
  const tier2 = await prisma.$queryRawUnsafe<{ count: bigint; latest: string | null }[]>(
    `SELECT COUNT(*)::bigint AS count, MAX(attempted_at)::text AS latest
     FROM login_attempts
     WHERE key = $1
       AND attempted_at > NOW() - INTERVAL '${TIER2_WINDOW_MIN} minutes'`,
    ipKey,
  )
  const tier2Count = Number(tier2[0]?.count ?? 0)
  if (tier2Count >= TIER2_MAX) {
    const latest    = tier2[0]?.latest ? new Date(tier2[0].latest) : new Date()
    const unlocksAt = new Date(latest.getTime() + TIER2_BLOCK_MIN * 60 * 1000)
    return { blocked: true, retryAfterSeconds: Math.max(1, Math.ceil((unlocksAt.getTime() - Date.now()) / 1000)) }
  }

  // --- Tier 3: email saja — distributed brute force ---
  const tier3 = await prisma.$queryRawUnsafe<{ count: bigint; latest: string | null }[]>(
    `SELECT COUNT(*)::bigint AS count, MAX(attempted_at)::text AS latest
     FROM login_attempts
     WHERE key = $1
       AND attempted_at > NOW() - INTERVAL '${TIER3_WINDOW_MIN} minutes'`,
    emailKey,
  )
  const tier3Count = Number(tier3[0]?.count ?? 0)
  if (tier3Count >= TIER3_MAX) {
    const latest    = tier3[0]?.latest ? new Date(tier3[0].latest) : new Date()
    const unlocksAt = new Date(latest.getTime() + TIER3_BLOCK_MIN * 60 * 1000)
    return { blocked: true, retryAfterSeconds: Math.max(1, Math.ceil((unlocksAt.getTime() - Date.now()) / 1000)) }
  }

  return { blocked: false }
}

export async function recordLoginFailure(email: string, ip: string | null): Promise<void> {
  const emailIpKey = `${email.toLowerCase()}|${ip ?? 'unknown'}`
  const ipKey      = ip ?? 'unknown'
  const emailKey   = email.toLowerCase()

  // Satu INSERT untuk ketiga tier sekaligus
  await prisma.$executeRawUnsafe(
    `INSERT INTO login_attempts (key, ip, email) VALUES ($1, $2, $3), ($4, $2, $3), ($5, $2, $3)`,
    emailIpKey, ip, email, ipKey, emailKey,
  )
}

export async function clearLoginFailures(email: string, ip: string | null): Promise<void> {
  // Hanya hapus Tier 1 (email+IP).
  // Tier 2 (IP) dan Tier 3 (email) dibiarkan agar tidak bisa di-reset
  // dengan cara login sukses ke akun sendiri setelah menyerang akun lain.
  const emailIpKey = `${email.toLowerCase()}|${ip ?? 'unknown'}`
  await prisma.$executeRawUnsafe(
    `DELETE FROM login_attempts WHERE key = $1`,
    emailIpKey,
  )
}
