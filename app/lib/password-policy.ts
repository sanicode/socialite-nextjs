export const PASSWORD_MIN_LENGTH = 9

export type PasswordStrength = 'weak' | 'medium' | 'strong'

export function getPasswordPolicyChecks(password: string) {
  return {
    hasMinimumLength: password.length >= PASSWORD_MIN_LENGTH,
    hasLowercase: /[a-z]/.test(password),
    hasUppercase: /[A-Z]/.test(password),
  }
}

export function getPasswordStrength(password: string): PasswordStrength {
  const checks = getPasswordPolicyChecks(password)
  const meetsPolicy = Object.values(checks).every(Boolean)
  const hasNumber = /\d/.test(password)
  const hasSymbol = /[^A-Za-z0-9]/.test(password)
  const hasExtraLength = password.length >= 12

  if (meetsPolicy && [hasNumber, hasSymbol, hasExtraLength].filter(Boolean).length >= 2) {
    return 'strong'
  }

  if (meetsPolicy || [checks.hasLowercase, checks.hasUppercase, hasNumber, hasSymbol].filter(Boolean).length >= 3) {
    return 'medium'
  }

  return 'weak'
}
