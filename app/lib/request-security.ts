import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getJsonConfig } from '@/app/lib/configs'
import { writeAccessLog } from '@/app/lib/access-logs'
import {
  DEFAULT_MAX_UPLOADED_FILE_SIZE_BYTES,
  normalizeUploadFileSizeBytes,
} from '@/app/lib/upload-size'

const SECURITY_CONFIG_KEY = 'app_security_policy'

export type SecuritySettings = {
  blockedIps: string[]
  allowedCountries: string[]
  allowUnknownCountries: boolean
  apiEnabled: boolean
  maxUploadedFileSizeBytes: number
}

export type SecuritySettingsInput = Partial<Omit<SecuritySettings, 'maxUploadedFileSizeBytes'>> & {
  maxUploadedFileSizeBytes?: unknown
}

export type RequestSecurityContext = {
  ip: string | null
  country: string | null
}

export type RequestSecurityDecision = RequestSecurityContext & {
  allowed: boolean
  reason: 'ok' | 'ip_blocked' | 'country_blocked' | 'country_unknown'
  message: string | null
}

const DEFAULT_SECURITY_SETTINGS: SecuritySettings = {
  blockedIps: [],
  allowedCountries: [],
  allowUnknownCountries: true,
  apiEnabled: true,
  maxUploadedFileSizeBytes: DEFAULT_MAX_UPLOADED_FILE_SIZE_BYTES,
}

function normalizeIp(ip: string): string {
  return ip.trim()
}

function normalizeCountry(country: string): string {
  return country.trim().toUpperCase()
}

export function normalizeSecuritySettings(input: SecuritySettingsInput): SecuritySettings {
  return {
    blockedIps: Array.from(new Set((input.blockedIps ?? []).map(normalizeIp).filter(Boolean))),
    allowedCountries: Array.from(new Set((input.allowedCountries ?? []).map(normalizeCountry).filter(Boolean))),
    allowUnknownCountries: input.allowUnknownCountries ?? true,
    apiEnabled: input.apiEnabled ?? true,
    maxUploadedFileSizeBytes: normalizeUploadFileSizeBytes(input.maxUploadedFileSizeBytes),
  }
}

export async function getSecuritySettings(): Promise<SecuritySettings> {
  const settings = await getJsonConfig<SecuritySettings>(SECURITY_CONFIG_KEY, DEFAULT_SECURITY_SETTINGS)
  return normalizeSecuritySettings(settings)
}

export async function getRequestSecurityContext(): Promise<RequestSecurityContext> {
  const headerStore = await headers()

  const forwardedFor = headerStore.get('x-forwarded-for')?.split(',')[0]?.trim()
  const realIp = headerStore.get('x-real-ip')?.trim()
  const cloudflareIp = headerStore.get('cf-connecting-ip')?.trim()
  const ip = forwardedFor || realIp || cloudflareIp || null

  const countryHeader =
    headerStore.get('cf-ipcountry')?.trim() ||
    headerStore.get('x-vercel-ip-country')?.trim() ||
    headerStore.get('x-country-code')?.trim() ||
    headerStore.get('x-geo-country')?.trim() ||
    null

  return {
    ip: ip ? normalizeIp(ip) : null,
    country: countryHeader ? normalizeCountry(countryHeader) : null,
  }
}

export function evaluateRequestSecurity(
  settings: SecuritySettings,
  context: RequestSecurityContext
): RequestSecurityDecision {
  if (context.ip && settings.blockedIps.includes(context.ip)) {
    return {
      ...context,
      allowed: false,
      reason: 'ip_blocked',
      message: 'Akses dari alamat IP ini diblokir oleh administrator.',
    }
  }

  if (settings.allowedCountries.length > 0) {
    if (!context.country) {
      return {
        ...context,
        allowed: settings.allowUnknownCountries,
        reason: settings.allowUnknownCountries ? 'ok' : 'country_unknown',
        message: settings.allowUnknownCountries
          ? null
          : 'Akses ditolak karena negara asal koneksi tidak dapat diverifikasi.',
      }
    }

    if (!settings.allowedCountries.includes(context.country)) {
      return {
        ...context,
        allowed: false,
        reason: 'country_blocked',
        message: `Akses dari negara ${context.country} tidak diizinkan.`,
      }
    }
  }

  return {
    ...context,
    allowed: true,
    reason: 'ok',
    message: null,
  }
}

export async function getRequestSecurityDecision(): Promise<RequestSecurityDecision> {
  const [settings, context] = await Promise.all([
    getSecuritySettings(),
    getRequestSecurityContext(),
  ])

  return evaluateRequestSecurity(settings, context)
}

export async function redirectIfRequestBlocked(): Promise<void> {
  const decision = await getRequestSecurityDecision()
  if (decision.allowed) return

  await writeAccessLog({
    eventType: 'request_blocked',
    status: 'blocked',
    ip: decision.ip,
    country: decision.country,
    details: {
      reason: decision.reason,
      message: decision.message,
    },
  })

  const params = new URLSearchParams()
  params.set('reason', decision.reason)
  if (decision.message) params.set('message', decision.message)
  if (decision.ip) params.set('ip', decision.ip)
  if (decision.country) params.set('country', decision.country)

  redirect(`/blocked?${params.toString()}`)
}
