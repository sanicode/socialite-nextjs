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
    await requireJwtRole(request, 'admin')
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
    const admin = await requireJwtRole(request, 'admin')
    const body = await request.json()
    const currentSettings = await getSecuritySettings()

    const nextSettings = normalizeSecuritySettings({
      blockedIps: Array.isArray(body.blockedIps) ? body.blockedIps : [],
      allowedCountries: Array.isArray(body.allowedCountries) ? body.allowedCountries : [],
      allowUnknownCountries: body.allowUnknownCountries ?? true,
      apiEnabled: body.apiEnabled ?? true,
      socialMediaConnectionsEnabled: body.socialMediaConnectionsEnabled ?? currentSettings.socialMediaConnectionsEnabled,
      maxUploadedFileSizeBytes: body.maxUploadedFileSizeBytes,
      imageCompressionEnabled: body.imageCompressionEnabled ?? currentSettings.imageCompressionEnabled,
      operatorReportingWindowEnabled: body.operatorReportingWindowEnabled ?? body.reportingWindowEnabled ?? false,
      operatorReportingWindowStart: body.operatorReportingWindowStart ?? body.reportingWindowStart,
      operatorReportingWindowEnd: body.operatorReportingWindowEnd ?? body.reportingWindowEnd,
      managerReportingWindowEnabled: body.managerReportingWindowEnabled ?? false,
      managerReportingWindowStart: body.managerReportingWindowStart,
      managerReportingWindowEnd: body.managerReportingWindowEnd,
    })

    await setConfigValue('app_security_policy', JSON.stringify(nextSettings))

    logEvent('warn', 'security.settings.updated', {
      userId: admin.sub,
      blockedIpsCount: nextSettings.blockedIps.length,
      allowedCountriesCount: nextSettings.allowedCountries.length,
      allowUnknownCountries: nextSettings.allowUnknownCountries,
      apiEnabled: nextSettings.apiEnabled,
      socialMediaConnectionsEnabled: nextSettings.socialMediaConnectionsEnabled,
      maxUploadedFileSizeBytes: nextSettings.maxUploadedFileSizeBytes,
      imageCompressionEnabled: nextSettings.imageCompressionEnabled,
      operatorReportingWindowEnabled: nextSettings.operatorReportingWindowEnabled,
      operatorReportingWindowStart: nextSettings.operatorReportingWindowStart,
      operatorReportingWindowEnd: nextSettings.operatorReportingWindowEnd,
      managerReportingWindowEnabled: nextSettings.managerReportingWindowEnabled,
      managerReportingWindowStart: nextSettings.managerReportingWindowStart,
      managerReportingWindowEnd: nextSettings.managerReportingWindowEnd,
    })

    return Response.json(nextSettings)
  } catch (error) {
    return apiError(error)
  }
}
