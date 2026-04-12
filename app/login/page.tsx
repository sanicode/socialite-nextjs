import { redirectIfRequestBlocked } from '@/app/lib/request-security'
import LoginPageClient from '@/app/components/LoginPageClient'
import { writeAccessLog } from '@/app/lib/access-logs'

export default async function LoginPage() {
  await redirectIfRequestBlocked()
  await writeAccessLog({
    eventType: 'login_page_view',
    status: 'allowed',
    requestPath: '/login',
    method: 'GET',
  })
  return <LoginPageClient />
}
