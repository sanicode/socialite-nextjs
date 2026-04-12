function readRequiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export function getSessionSecret(): string {
  return readRequiredEnv('SESSION_SECRET')
}

export function getPublicMediaBaseUrl(): string {
  return readRequiredEnv('NEXT_PUBLIC_S3_PUBLIC_URL').replace(/\/+$/, '')
}

