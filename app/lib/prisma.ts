import { Prisma, PrismaClient } from '@/app/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'

function getDatabaseConnectionString() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL is not configured')

  return connectionString
}

function getPositiveIntegerEnv(name: string, fallback: number) {
  const value = process.env[name]?.trim()
  if (!value) return fallback

  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function normalizeCertificate(certificate: string) {
  return certificate
    .trim()
    .replace(/^"|"$/g, '')
    .replace(/^'|'$/g, '')
    .replace(/\\n/g, '\n')
}

function getDatabaseSslCa() {
  const encodedCa = process.env.DATABASE_SSL_CA_BASE64?.trim()
  if (encodedCa) return Buffer.from(encodedCa, 'base64').toString('utf8')

  const inlineCa = process.env.DATABASE_SSL_CA?.trim()
  if (inlineCa) return normalizeCertificate(inlineCa)

  const caFiles = [process.env.DATABASE_SSL_CA_FILE?.trim()].filter((file): file is string => Boolean(file))

  for (const caFile of caFiles) {
    if (existsSync(caFile)) return readFileSync(caFile, 'utf8')
  }

  return undefined
}

function shouldSkipDatabaseSslVerification(sslMode: string | null) {
  return (
    sslMode === 'no-verify' ||
    process.env.DATABASE_SSL_REJECT_UNAUTHORIZED?.trim().toLowerCase() === 'false'
  )
}

function getDatabaseSslConfig(connectionString: string) {
  let sslMode: string | null = null

  try {
    sslMode = new URL(connectionString).searchParams.get('sslmode')
  } catch {
    return undefined
  }

  if (sslMode === 'disable') return undefined

  if (shouldSkipDatabaseSslVerification(sslMode)) {
    return { rejectUnauthorized: false }
  }

  const ca = getDatabaseSslCa()
  if (!ca) return undefined

  return {
    ca,
    rejectUnauthorized: true,
  }
}

function removeSslModeFromConnectionString(connectionString: string) {
  try {
    const url = new URL(connectionString)
    url.searchParams.delete('sslmode')
    return url.toString()
  } catch {
    return connectionString
  }
}

function getPrismaConnectionSignature(connectionString: string) {
  return createHash('sha256')
    .update(connectionString)
    .update(process.env.DATABASE_SSL_CA || '')
    .update(process.env.DATABASE_SSL_CA_BASE64 || '')
    .update(process.env.DATABASE_SSL_CA_FILE || '')
    .update(process.env.DATABASE_POOL_MAX || '')
    .update(process.env.DATABASE_POOL_IDLE_TIMEOUT_MS || '')
    .update(process.env.DATABASE_POOL_CONNECTION_TIMEOUT_MS || '')
    .digest('hex')
}

function createPrismaClient() {
  const connectionString = getDatabaseConnectionString()
  const ssl = getDatabaseSslConfig(connectionString)
  const adapter = new PrismaPg({
    connectionString: ssl ? removeSslModeFromConnectionString(connectionString) : connectionString,
    max: getPositiveIntegerEnv('DATABASE_POOL_MAX', process.env.NODE_ENV === 'production' ? 2 : 5),
    idleTimeoutMillis: getPositiveIntegerEnv('DATABASE_POOL_IDLE_TIMEOUT_MS', 10_000),
    connectionTimeoutMillis: getPositiveIntegerEnv('DATABASE_POOL_CONNECTION_TIMEOUT_MS', 10_000),
    ...(ssl ? { ssl } : {}),
  })

  return new PrismaClient({ adapter })
}

const prismaSchemaSignature = Object.entries(Prisma)
  .filter(([key, value]) => key.endsWith('ScalarFieldEnum') && value && typeof value === 'object')
  .map(([key, value]) => `${key}:${Object.values(value as Record<string, string>).join(',')}`)
  .sort()
  .join('|')

type CachedPrismaClient = ReturnType<typeof createPrismaClient> & {
  __schemaSignature?: string
  __connectionSignature?: string
}

const globalForPrisma = globalThis as unknown as {
  prisma: CachedPrismaClient | undefined
}

function getPrismaClient() {
  const connectionString = getDatabaseConnectionString()
  const connectionSignature = getPrismaConnectionSignature(connectionString)

  const cached = globalForPrisma.prisma
  if (
    cached?.__schemaSignature === prismaSchemaSignature &&
    cached.__connectionSignature === connectionSignature
  ) {
    return cached
  }

  if (cached) void cached.$disconnect().catch(() => {})

  const client = createPrismaClient() as CachedPrismaClient
  client.__schemaSignature = prismaSchemaSignature
  client.__connectionSignature = connectionSignature
  globalForPrisma.prisma = client
  return client
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrismaClient()
    const value = Reflect.get(client, prop, client)

    return typeof value === 'function' ? value.bind(client) : value
  },
  set(_target, prop, value) {
    return Reflect.set(getPrismaClient(), prop, value)
  },
  has(_target, prop) {
    return prop in getPrismaClient()
  },
  ownKeys() {
    return Reflect.ownKeys(getPrismaClient())
  },
  getOwnPropertyDescriptor(_target, prop) {
    return Reflect.getOwnPropertyDescriptor(getPrismaClient(), prop)
  },
})
