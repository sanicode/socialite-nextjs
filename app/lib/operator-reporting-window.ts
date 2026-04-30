import {
  evaluateReportingWindow,
  getSecuritySettings,
  type ReportingWindowDecision,
} from '@/app/lib/request-security'

export function isOperatorReportingRole(roles: string[]): boolean {
  return !roles.includes('admin') && !roles.includes('manager')
}

export function isNonAdminReportingRole(roles: string[]): boolean {
  return !roles.includes('admin')
}

export async function getOperatorReportingWindowDecision(
  roles: string[]
): Promise<ReportingWindowDecision> {
  const settings = await getSecuritySettings()
  const decision = evaluateReportingWindow(settings, 'operator')

  if (!isOperatorReportingRole(roles)) {
    return { ...decision, allowed: true, message: null }
  }

  return decision
}

export async function getNonAdminReportingWindowDecision(
  roles: string[]
): Promise<ReportingWindowDecision> {
  const settings = await getSecuritySettings()

  if (roles.includes('admin')) {
    const decision = evaluateReportingWindow(settings, 'manager')
    return { ...decision, allowed: true, message: null }
  }

  if (roles.includes('manager')) {
    return evaluateReportingWindow(settings, 'manager')
  }

  return evaluateReportingWindow(settings, 'operator')
}
