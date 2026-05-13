import { Prisma, PrismaClient } from '@/app/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
  return new PrismaClient({ adapter })
}

const prismaSchemaSignature = Object.entries(Prisma)
  .filter(([key, value]) => key.endsWith('ScalarFieldEnum') && value && typeof value === 'object')
  .map(([key, value]) => `${key}:${Object.values(value as Record<string, string>).join(',')}`)
  .sort()
  .join('|')

type CachedPrismaClient = ReturnType<typeof createPrismaClient> & {
  __schemaSignature?: string
}

const globalForPrisma = globalThis as unknown as {
  prisma: CachedPrismaClient | undefined
}

function getPrismaClient() {
  if (process.env.NODE_ENV === 'production') return createPrismaClient()

  const cached = globalForPrisma.prisma
  if (cached?.__schemaSignature === prismaSchemaSignature) return cached

  if (cached) void cached.$disconnect().catch(() => {})

  const client = createPrismaClient() as CachedPrismaClient
  client.__schemaSignature = prismaSchemaSignature
  globalForPrisma.prisma = client
  return client
}

export const prisma = getPrismaClient()
