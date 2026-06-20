function readRequiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export function getOptionalEnv(name: string): string | null {
  return process.env[name]?.trim() || null
}

export function getSessionSecret(): string {
  return readRequiredEnv('SESSION_SECRET')
}

function parseHttpUrl(value: string, name: string): URL {
  const url = new URL(value)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`${name} must use http or https`)
  }
  return url
}

export function getS3Endpoint(): string | null {
  const endpoint = getOptionalEnv('S3_ENDPOINT')
  return endpoint ? parseHttpUrl(endpoint, 'S3_ENDPOINT').toString().replace(/\/+$/, '') : null
}

export function isDigitalOceanSpacesEndpoint(endpoint = getS3Endpoint()): boolean {
  if (!endpoint) return false
  const hostname = new URL(endpoint).hostname.toLowerCase()
  return hostname === 'digitaloceanspaces.com' || hostname.endsWith('.digitaloceanspaces.com')
}

export function getS3ClientRegion(): string {
  return isDigitalOceanSpacesEndpoint() ? 'us-east-1' : readRequiredEnv('S3_REGION')
}

export function shouldForceS3PathStyle(): boolean {
  const configured = getOptionalEnv('S3_FORCE_PATH_STYLE')
  if (configured) {
    if (configured === 'true') return true
    if (configured === 'false') return false
    throw new Error('S3_FORCE_PATH_STYLE must be true or false')
  }

  const endpoint = getS3Endpoint()
  if (isDigitalOceanSpacesEndpoint(endpoint)) return false
  if (endpoint) return true

  return readRequiredEnv('S3_BUCKET').includes('.')
}

export function getPublicMediaBaseUrl(): string {
  const configuredUrl = getOptionalEnv('NEXT_PUBLIC_S3_PUBLIC_URL')
  if (configuredUrl) {
    const url = parseHttpUrl(configuredUrl, 'NEXT_PUBLIC_S3_PUBLIC_URL')
    return url.toString().replace(/\/+$/, '')
  }

  const bucket = readRequiredEnv('S3_BUCKET')
  const endpoint = getS3Endpoint()
  if (endpoint) {
    const url = new URL(endpoint)
    if (isDigitalOceanSpacesEndpoint(endpoint)) {
      return `${url.protocol}//${bucket}.${url.host}`
    }
    return `${endpoint}/${bucket}`
  }

  const region = readRequiredEnv('S3_REGION')
  return `https://s3.${region}.amazonaws.com/${bucket}`
}
