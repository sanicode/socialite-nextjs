import { redirectIfRequestBlocked } from '@/app/lib/request-security'
import LoginPageClient from '@/app/components/LoginPageClient'
import { writeAccessLog } from '@/app/lib/access-logs'
import { getCaptchaSiteKey, isCaptchaEnabled } from '@/app/lib/captcha'
import { getLoginIp, shouldRequireLoginCaptcha } from '@/app/lib/login-rate-limit'

export default async function LoginPage() {
  await redirectIfRequestBlocked()
  await writeAccessLog({
    eventType: 'login_page_view',
    status: 'allowed',
    requestPath: '/login',
    method: 'GET',
  })
  const ip = await getLoginIp()
  const captchaEnabled = isCaptchaEnabled()
  const captchaRequired = captchaEnabled && await shouldRequireLoginCaptcha(ip)

  return (
    <LoginPageClient
      captchaSiteKey={captchaEnabled ? getCaptchaSiteKey() : null}
      initialCaptchaRequired={captchaRequired}
    />
  )
}
