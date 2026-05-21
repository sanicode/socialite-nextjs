import { Prisma, PrismaClient } from '@/app/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'

const DEFAULT_DATABASE_SSL_CA_FILE = decodeURIComponent(
  new URL('../../prisma/ca-certificate.crt', import.meta.url).pathname
)

function getDatabaseConnectionString() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL is not configured')

  return connectionString
}

function getDatabaseSslConfig(connectionString: string) {
  let sslMode: string | null = null

  try {
    sslMode = new URL(connectionString).searchParams.get('sslmode')
  } catch {
    return undefined
  }

  if (sslMode === 'disable') return undefined

  const ca = process.env.DATABASE_SSL_CA || (
    existsSync(DEFAULT_DATABASE_SSL_CA_FILE)
      ? readFileSync(DEFAULT_DATABASE_SSL_CA_FILE, 'utf8')
      : undefined
  )

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
    .digest('hex')
}

function createPrismaClient() {
  const connectionString = getDatabaseConnectionString()
  const ssl = getDatabaseSslConfig(connectionString)
  const adapter = new PrismaPg({
    connectionString: ssl ? removeSslModeFromConnectionString(connectionString) : connectionString,
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
