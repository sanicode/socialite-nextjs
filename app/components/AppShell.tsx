import { redirect } from 'next/navigation'
import { getSessionUserId } from '@/app/lib/session'
import { getUserRoles } from '@/app/lib/permissions'
import { prisma } from '@/app/lib/prisma'
import ShellClient from './ShellClient'
import { redirectIfRequestBlocked } from '@/app/lib/request-security'
import { getRequestMetadata, writeAccessLog } from '@/app/lib/access-logs'

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

  return { ...user, isAdmin, isManager, role, tenantName }
}

export default async function AppShell({ children }: { children: React.ReactNode }) {
  await redirectIfRequestBlocked()
  const user = await getSessionUser()

  if (!user) {
    redirect('/login')
  }

  const appName = process.env.APP_NAME ?? 'Admin Panel'
  const showDashboard = user.isAdmin || user.isManager
  const showOperators = user.isManager

  const requestMetadata = await getRequestMetadata()
  await writeAccessLog({
    eventType: 'page_view',
    status: 'allowed',
    requestPath: requestMetadata.requestPath,
    method: requestMetadata.method ?? 'GET',
    userId: user.id.toString(),
    userEmail: user.email,
  })

  return <ShellClient user={user} appName={appName} showDashboard={showDashboard} showSettings={user.isAdmin} showOperators={showOperators}>{children}</ShellClient>
}
