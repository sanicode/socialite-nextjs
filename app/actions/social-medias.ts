'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/app/lib/authorization'
import { prisma } from '@/app/lib/prisma'
import { logEvent } from '@/app/lib/logger'
import { getSecuritySettings } from '@/app/lib/request-security'
import {
  getSocialProviderConfigs,
  type SocialPlatform,
  type SocialProviderPublicConfig,
} from '@/app/lib/social-oauth'

export type ConnectedSocialMediaRow = {
  id: string
  platform: SocialPlatform
  providerAccountId: string
  username: string | null
  displayName: string | null
  profileUrl: string | null
  avatarUrl: string | null
  connectedAt: string | null
  lastSyncedAt: string | null
  disconnectedAt: string | null
}

export async function getConnectedSocialMedias(): Promise<{
  providers: SocialProviderPublicConfig[]
  accounts: ConnectedSocialMediaRow[]
}> {
  const user = await requireUser()
  const securitySettings = await getSecuritySettings()
  if (!securitySettings.socialMediaConnectionsEnabled) {
    return { providers: [], accounts: [] }
  }

  const accounts = await prisma.user_social_medias.findMany({
    where: {
      user_id: BigInt(user.id),
      disconnected_at: null,
    },
    orderBy: { platform: 'asc' },
  })

  return {
    providers: getSocialProviderConfigs().map(({ platform, label, configured }) => ({ platform, label, configured })),
    accounts: accounts.map((account) => ({
      id: account.id.toString(),
      platform: account.platform as SocialPlatform,
      providerAccountId: account.provider_account_id,
      username: account.username,
      displayName: account.display_name,
      profileUrl: account.profile_url,
      avatarUrl: account.avatar_url,
      connectedAt: account.connected_at?.toISOString() ?? null,
      lastSyncedAt: account.last_synced_at?.toISOString() ?? null,
      disconnectedAt: account.disconnected_at?.toISOString() ?? null,
    })),
  }
}

export async function unlinkSocialMedia(accountId: string): Promise<void> {
  const user = await requireUser()
  const securitySettings = await getSecuritySettings()
  if (!securitySettings.socialMediaConnectionsEnabled) throw new Error('Fitur akun medsos operator sedang dinonaktifkan.')

  const account = await prisma.user_social_medias.findFirst({
    where: {
      id: BigInt(accountId),
      user_id: BigInt(user.id),
    },
  })
  if (!account) throw new Error('Akun medsos tidak ditemukan.')

  await prisma.user_social_medias.update({
    where: { id: account.id },
    data: {
      disconnected_at: new Date(),
      access_token: null,
      refresh_token: null,
      updated_at: new Date(),
    },
  })

  logEvent('info', 'social_media.unlinked', {
    userId: user.id,
    platform: account.platform,
    providerAccountId: account.provider_account_id,
  })
  revalidatePath('/social-medias')
}
