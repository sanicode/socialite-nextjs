'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/app/lib/authorization'
import {
  evaluateRequestSecurity,
  getRequestSecurityContext,
  getSecuritySettings,
  normalizeSecuritySettings,
} from '@/app/lib/request-security'
import { setConfigValue } from '@/app/lib/configs'
import { logEvent } from '@/app/lib/logger'

const SECURITY_CONFIG_KEY = 'app_security_policy'

export type SecuritySettingsState =
  | {
      status: 'idle' | 'success' | 'error'
      message?: string
      settings: {
        blockedIpsText: string
        allowedCountriesText: string
        allowUnknownCountries: boolean
        apiEnabled: boolean
        maxUploadedFileSizeBytes: number
        operatorReportingWindowEnabled: boolean
        operatorReportingWindowStart: string
        operatorReportingWindowEnd: string
        managerReportingWindowEnabled: boolean
        managerReportingWindowStart: string
        managerReportingWindowEnd: string
      }
    }
  | undefined

function parseList(value: FormDataEntryValue | null): string[] {
  if (typeof value !== 'string') return []
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export async function getSecuritySettingsFormState(): Promise<NonNullable<SecuritySettingsState>> {
  await requireAdmin()
  const settings = await getSecuritySettings()

  return {
    status: 'idle',
    settings: {
      blockedIpsText: settings.blockedIps.join('\n'),
      allowedCountriesText: settings.allowedCountries.join(', '),
      allowUnknownCountries: settings.allowUnknownCountries,
      apiEnabled: settings.apiEnabled,
      maxUploadedFileSizeBytes: settings.maxUploadedFileSizeBytes,
      operatorReportingWindowEnabled: settings.operatorReportingWindowEnabled,
      operatorReportingWindowStart: settings.operatorReportingWindowStart,
      operatorReportingWindowEnd: settings.operatorReportingWindowEnd,
      managerReportingWindowEnabled: settings.managerReportingWindowEnabled,
      managerReportingWindowStart: settings.managerReportingWindowStart,
      managerReportingWindowEnd: settings.managerReportingWindowEnd,
    },
  }
}

export async function saveSecuritySettings(
  _state: SecuritySettingsState,
  formData: FormData
): Promise<NonNullable<SecuritySettingsState>> {
  const admin = await requireAdmin()

  const nextSettings = normalizeSecuritySettings({
    blockedIps: parseList(formData.get('blockedIps')),
    allowedCountries: parseList(formData.get('allowedCountries')),
    allowUnknownCountries: formData.get('allowUnknownCountries') === '1',
    apiEnabled: formData.get('apiEnabled') === '1',
    maxUploadedFileSizeBytes: formData.get('maxUploadedFileSizeBytes'),
    operatorReportingWindowEnabled: formData.get('operatorReportingWindowEnabled') === '1',
    operatorReportingWindowStart: formData.get('operatorReportingWindowStart'),
    operatorReportingWindowEnd: formData.get('operatorReportingWindowEnd'),
    managerReportingWindowEnabled: formData.get('managerReportingWindowEnabled') === '1',
    managerReportingWindowStart: formData.get('managerReportingWindowStart'),
    managerReportingWindowEnd: formData.get('managerReportingWindowEnd'),
  })

  const currentContext = await getRequestSecurityContext()
  const currentDecision = evaluateRequestSecurity(nextSettings, currentContext)

  if (!currentDecision.allowed) {
    return {
      status: 'error',
      message: 'Pengaturan ini akan memblokir koneksi Anda saat ini. Simpan dibatalkan untuk mencegah lockout admin.',
      settings: {
        blockedIpsText: nextSettings.blockedIps.join('\n'),
        allowedCountriesText: nextSettings.allowedCountries.join(', '),
        allowUnknownCountries: nextSettings.allowUnknownCountries,
        apiEnabled: nextSettings.apiEnabled,
        maxUploadedFileSizeBytes: nextSettings.maxUploadedFileSizeBytes,
        operatorReportingWindowEnabled: nextSettings.operatorReportingWindowEnabled,
        operatorReportingWindowStart: nextSettings.operatorReportingWindowStart,
        operatorReportingWindowEnd: nextSettings.operatorReportingWindowEnd,
        managerReportingWindowEnabled: nextSettings.managerReportingWindowEnabled,
        managerReportingWindowStart: nextSettings.managerReportingWindowStart,
        managerReportingWindowEnd: nextSettings.managerReportingWindowEnd,
      },
    }
  }

  await setConfigValue(SECURITY_CONFIG_KEY, JSON.stringify(nextSettings))
  logEvent('warn', 'security.settings.updated', {
    userId: admin.id,
    blockedIpsCount: nextSettings.blockedIps.length,
    allowedCountriesCount: nextSettings.allowedCountries.length,
    allowUnknownCountries: nextSettings.allowUnknownCountries,
    apiEnabled: nextSettings.apiEnabled,
    maxUploadedFileSizeBytes: nextSettings.maxUploadedFileSizeBytes,
    operatorReportingWindowEnabled: nextSettings.operatorReportingWindowEnabled,
    operatorReportingWindowStart: nextSettings.operatorReportingWindowStart,
    operatorReportingWindowEnd: nextSettings.operatorReportingWindowEnd,
    managerReportingWindowEnabled: nextSettings.managerReportingWindowEnabled,
    managerReportingWindowStart: nextSettings.managerReportingWindowStart,
    managerReportingWindowEnd: nextSettings.managerReportingWindowEnd,
  })

  revalidatePath('/settings/security')

  return {
    status: 'success',
    message: 'Pengaturan keamanan berhasil disimpan.',
    settings: {
      blockedIpsText: nextSettings.blockedIps.join('\n'),
      allowedCountriesText: nextSettings.allowedCountries.join(', '),
      allowUnknownCountries: nextSettings.allowUnknownCountries,
      apiEnabled: nextSettings.apiEnabled,
      maxUploadedFileSizeBytes: nextSettings.maxUploadedFileSizeBytes,
      operatorReportingWindowEnabled: nextSettings.operatorReportingWindowEnabled,
      operatorReportingWindowStart: nextSettings.operatorReportingWindowStart,
      operatorReportingWindowEnd: nextSettings.operatorReportingWindowEnd,
      managerReportingWindowEnabled: nextSettings.managerReportingWindowEnabled,
      managerReportingWindowStart: nextSettings.managerReportingWindowStart,
      managerReportingWindowEnd: nextSettings.managerReportingWindowEnd,
    },
  }
}
