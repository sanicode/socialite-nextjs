type TurnstileVerifyResponse = {
  success: boolean
  'error-codes'?: string[]
}

export function getCaptchaSiteKey() {
  return process.env.CAPTCHA_SITE_KEY?.trim() || null
}

export function isCaptchaEnabled() {
  return Boolean(getCaptchaSiteKey() && process.env.CAPTCHA_SECRET_KEY?.trim())
}

export async function verifyCaptchaToken(token: string | null, ip: string | null) {
  const secret = process.env.CAPTCHA_SECRET_KEY?.trim()
  if (!secret) return true
  if (!token) return false

  try {
    const body = new URLSearchParams()
    body.set('secret', secret)
    body.set('response', token)
    if (ip) body.set('remoteip', ip)

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
    })

    if (!response.ok) return false
    const data = await response.json() as TurnstileVerifyResponse
    return data.success === true
  } catch {
    return false
  }
}
