import { requireJwtRole, apiError, requireApiEnabled } from '@/app/lib/api-auth'
import {
  getSecuritySettings,
  normalizeSecuritySettings,
} from '@/app/lib/request-security'
import { setConfigValue } from '@/app/lib/configs'
import { logEvent } from '@/app/lib/logger'

// ── GET /api/mobile/settings/security ────────────────────────────────────────

export async function GET(request: Request) {
  try {
    await requireApiEnabled()
    requireJwtRole(request, 'admin')
    const settings = await getSecuritySettings()
    return Response.json(settings)
  } catch (error) {
    return apiError(error)
  }
}

// ── PUT /api/mobile/settings/security ────────────────────────────────────────

export async function PUT(request: Request) {
  try {
    await requireApiEnabled()
    const admin = requireJwtRole(request, 'admin')
    const body = await request.json()

    const nextSettings = normalizeSecuritySettings({
      blockedIps: Array.isArray(body.blockedIps) ? body.blockedIps : [],
      allowedCountries: Array.isArray(body.allowedCountries) ? body.allowedCountries : [],
      allowUnknownCountries: body.allowUnknownCountries ?? true,
      apiEnabled: body.apiEnabled ?? true,
      maxUploadedFileSizeBytes: body.maxUploadedFileSizeBytes,
    })

    await setConfigValue('app_security_policy', JSON.stringify(nextSettings))

    logEvent('warn', 'security.settings.updated', {
      userId: admin.sub,
      blockedIpsCount: nextSettings.blockedIps.length,
      allowedCountriesCount: nextSettings.allowedCountries.length,
      allowUnknownCountries: nextSettings.allowUnknownCountries,
      apiEnabled: nextSettings.apiEnabled,
      maxUploadedFileSizeBytes: nextSettings.maxUploadedFileSizeBytes,
    })

    return Response.json(nextSettings)
  } catch (error) {
    return apiError(error)
  }
}
