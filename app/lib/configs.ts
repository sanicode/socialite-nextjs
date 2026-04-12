import { prisma } from '@/app/lib/prisma'

export async function getConfigValue(key: string): Promise<string | null> {
  const record = await prisma.configs.findUnique({
    where: { key },
    select: { value: true },
  })

  return record?.value ?? null
}

export async function setConfigValue(key: string, value: string): Promise<void> {
  await prisma.configs.upsert({
    where: { key },
    create: { key, value, created_at: new Date(), updated_at: new Date() },
    update: { value, updated_at: new Date() },
  })
}

export async function getJsonConfig<T>(key: string, fallback: T): Promise<T> {
  const rawValue = await getConfigValue(key)
  if (!rawValue) return fallback

  try {
    return JSON.parse(rawValue) as T
  } catch {
    return fallback
  }
}

