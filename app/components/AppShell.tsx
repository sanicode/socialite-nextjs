import { redirect } from 'next/navigation'
import { getSessionUserId } from '@/app/lib/session'
import { getUserRoles } from '@/app/lib/permissions'
import { prisma } from '@/app/lib/prisma'
import ShellClient from './ShellClient'
import { getSecuritySettings, redirectIfRequestBlocked } from '@/app/lib/request-security'
import { getRequestMetadata, writeAccessLog } from '@/app/lib/access-logs'
import { isDatabaseConnectionError, isDatabaseSchemaError } from '@/app/lib/database-errors'
import DatabaseUnavailableScreen from '@/app/components/DatabaseUnavailableScreen'

async function getSessionUser() {
  const userId = await getSessionUserId()
  if (!userId) return null
  const user = await prisma.users.findUnique({
    where: { id: BigInt(userId) },
    select: { id: true, name: true, email: true },
  })
  if (!user) return null
  const roles = await getUserRoles(userId)
  const isAdmin = roles.includes('admin')
  const isManager = roles.includes('manager')
  const isOperator = roles.includes('operator')
  const role = roles[0] ?? 'operator'

  // Fetch tenant name
  let tenantName: string | null = null
  const tu = await prisma.tenant_user.findFirst({
    where: { user_id: BigInt(userId) },
    select: { tenant_id: true },
  })
  if (tu) {
    const tenant = await prisma.tenants.findUnique({
      where: { id: tu.tenant_id },
      select: { name: true },
    })
    tenantName = tenant?.name ?? null
  }

  return { ...user, isAdmin, isManager, isOperator, role, tenantName }
}

export default async function AppShell({ children }: { children: React.ReactNode }) {
  let shellProps!: Parameters<typeof ShellClient>[0]

  try {
    await redirectIfRequestBlocked()
    const user = await getSessionUser()

    if (!user) {
      redirect('/login')
    }

    const securitySettings = await getSecuritySettings()
    const appName = process.env.APP_NAME ?? 'Admin Panel'
    const showSummary = user.isAdmin
    const showDashboard = user.isAdmin || user.isManager || user.isOperator
    const showOperators = user.isManager
    const showLaporanPerOperator = user.isAdmin || user.isManager
    const showLaporanSemua = user.isAdmin || user.isManager
    const requestMetadata = await getRequestMetadata()
    const showLaporanUpload = user.isOperator
    const showLaporanAmplifikasi = user.isOperator
    const showSocialMedias = user.isOperator && securitySettings.socialMediaConnectionsEnabled
    await writeAccessLog({
      eventType: 'page_view',
      status: 'allowed',
      requestPath: requestMetadata.requestPath,
      method: requestMetadata.method ?? 'GET',
      userId: user.id.toString(),
      userEmail: user.email,
    })

    shellProps = {
      user,
      appName,
      showSummary,
      showDashboard,
      showSettings: user.isAdmin,
      showOperators,
      showLaporanPerOperator,
      showLaporanSemua,
      showLaporanUpload,
      showLaporanAmplifikasi,
      showSocialMedias,
      children,
    }
  } catch (error) {
    if (isDatabaseConnectionError(error) || isDatabaseSchemaError(error)) return <DatabaseUnavailableScreen error={error} />
    throw error
  }

  return <ShellClient {...shellProps} />
}
