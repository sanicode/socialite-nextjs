import { redirectIfRequestBlocked } from '@/app/lib/request-security'
import LoginPageClient from '@/app/components/LoginPageClient'
import { writeAccessLog } from '@/app/lib/access-logs'
import { getCaptchaSiteKey, isCaptchaEnabled } from '@/app/lib/captcha'
import { getLoginIp, shouldRequireLoginCaptcha } from '@/app/lib/login-rate-limit'
import { isDatabaseConnectionError, isDatabaseSchemaError } from '@/app/lib/database-errors'
import DatabaseUnavailableScreen from '@/app/components/DatabaseUnavailableScreen'

export default async function LoginPage() {
  let captchaSiteKey: string | null = null
  let captchaRequired = false

  try {
    await redirectIfRequestBlocked()
    await writeAccessLog({
      eventType: 'login_page_view',
      status: 'allowed',
      requestPath: '/login',
      method: 'GET',
    })
    const ip = await getLoginIp()
    const captchaEnabled = isCaptchaEnabled()
    captchaSiteKey = captchaEnabled ? getCaptchaSiteKey() : null
    captchaRequired = captchaEnabled && await shouldRequireLoginCaptcha(ip)
  } catch (error) {
    if (isDatabaseConnectionError(error) || isDatabaseSchemaError(error)) return <DatabaseUnavailableScreen error={error} />
    throw error
  }

  return (
    <LoginPageClient
      captchaSiteKey={captchaSiteKey}
      initialCaptchaRequired={captchaRequired}
    />
  )
}
