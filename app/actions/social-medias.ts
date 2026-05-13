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
  accountKind: string | null
  canPost: boolean
  username: string | null
  email: string | null
  phone: string | null
  gender: string | null
  birthday: string | null
  firstName: string | null
  lastName: string | null
  displayName: string | null
  profileUrl: string | null
  avatarUrl: string | null
  connectedAt: string | null
  lastSyncedAt: string | null
  disconnectedAt: string | null
}

function readMetadataValue(metadata: unknown, key: string) {
  return metadata && typeof metadata === 'object' && key in metadata
    ? String((metadata as Record<string, unknown>)[key] ?? '')
    : ''
}

function getAccountKind(platform: string, metadata: unknown) {
  if (platform === 'facebook') {
    const accountType = readMetadataValue(metadata, 'account_type')
    if (accountType === 'facebook_page') return 'Facebook Page'
    if (accountType === 'facebook_profile') return 'Profil Facebook'
  }

  return null
}

function canPostFromAccount(platform: string, metadata: unknown) {
  return platform === 'facebook' && readMetadataValue(metadata, 'account_type') === 'facebook_page'
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
      accountKind: getAccountKind(account.platform, account.metadata),
      canPost: canPostFromAccount(account.platform, account.metadata),
      username: account.username,
      email: account.email,
      phone: account.phone,
      gender: account.gender,
      birthday: account.birthday?.toISOString().slice(0, 10) ?? null,
      firstName: account.first_name,
      lastName: account.last_name,
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
