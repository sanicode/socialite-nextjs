import { NextResponse } from 'next/server'
import type { Prisma } from '@/app/generated/prisma/client'
import { prisma } from '@/app/lib/prisma'
import { requireUser } from '@/app/lib/authorization'
import { getSecuritySettings } from '@/app/lib/request-security'
import { logEvent } from '@/app/lib/logger'
import {
  buildRedirectUri,
  encryptSocialToken,
  exchangeSocialOAuthCode,
  fetchSocialProfiles,
  getSocialProvider,
  verifySocialOAuthState,
} from '@/app/lib/social-oauth'

type Ctx = { params: Promise<{ platform: string }> }

export async function GET(request: Request, { params }: Ctx) {
  const redirectTarget = new URL('/social-medias', request.url)

  try {
    const user = await requireUser()
    if (!user.roles.includes('operator')) {
      return NextResponse.redirect(new URL('/posts', request.url))
    }
    const securitySettings = await getSecuritySettings()
    if (!securitySettings.socialMediaConnectionsEnabled) {
      return NextResponse.redirect(new URL('/posts', request.url))
    }

    const { platform } = await params
    const provider = getSocialProvider(platform)
    const url = new URL(request.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')

    if (!provider || !provider.configured || !code || !state) {
      redirectTarget.searchParams.set('error', 'oauth_invalid_request')
      return NextResponse.redirect(redirectTarget)
    }

    const statePayload = verifySocialOAuthState(state)
    if (!statePayload || statePayload.platform !== provider.platform || statePayload.userId !== user.id) {
      redirectTarget.searchParams.set('error', 'oauth_invalid_state')
      return NextResponse.redirect(redirectTarget)
    }

    const origin = new URL(request.url).origin
    const token = await exchangeSocialOAuthCode(provider, code, buildRedirectUri(origin, provider.platform))
    if (!token.access_token) throw new Error('Token OAuth tidak valid.')

    const profiles = await fetchSocialProfiles(provider.platform, token.access_token)
    if (profiles.length === 0) throw new Error('Akun medsos tidak ditemukan dari provider.')

    const providerAccountIds = profiles.map((profile) => profile.providerAccountId)
    const existingAccounts = await prisma.user_social_medias.findMany({
      where: {
        platform: provider.platform,
        provider_account_id: { in: providerAccountIds },
      },
    })

    if (existingAccounts.some((account) => account.user_id.toString() !== user.id)) {
      redirectTarget.searchParams.set('error', 'account_used')
      return NextResponse.redirect(redirectTarget)
    }

    const expiresAt = token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null
    const existingByAccountId = new Map(existingAccounts.map((account) => [account.provider_account_id, account]))

    await prisma.user_social_medias.updateMany({
      where: {
        user_id: BigInt(user.id),
        platform: provider.platform,
        provider_account_id: { notIn: providerAccountIds },
        disconnected_at: null,
      },
      data: {
        disconnected_at: new Date(),
        access_token: null,
        refresh_token: null,
        updated_at: new Date(),
      },
    })

    for (const profile of profiles) {
      const data = {
        user_id: BigInt(user.id),
        platform: provider.platform,
        provider_account_id: profile.providerAccountId,
        username: profile.username,
        display_name: profile.displayName,
        profile_url: profile.profileUrl,
        avatar_url: profile.avatarUrl,
        access_token: encryptSocialToken(token.access_token),
        refresh_token: encryptSocialToken(token.refresh_token),
        token_expires_at: expiresAt,
        scopes: (token.scope ? token.scope.split(/\s+/) : provider.scopes) as Prisma.InputJsonValue,
        metadata: profile.metadata as Prisma.InputJsonValue,
        connected_at: new Date(),
        disconnected_at: null,
        last_synced_at: new Date(),
        updated_at: new Date(),
      }
      const existing = existingByAccountId.get(profile.providerAccountId)

      if (existing) {
        await prisma.user_social_medias.update({
          where: { id: existing.id },
          data,
        })
      } else {
        await prisma.user_social_medias.create({
          data: {
            ...data,
            created_at: new Date(),
          },
        })
      }
    }

    logEvent('info', 'social_media.linked', {
      userId: user.id,
      platform: provider.platform,
      providerAccountIds,
    })

    redirectTarget.searchParams.set('connected', provider.platform)
    return NextResponse.redirect(redirectTarget)
  } catch (error) {
    logEvent('error', 'social_media.oauth_failed', {
      error: error instanceof Error ? error.message : 'Unknown OAuth error',
    })
    redirectTarget.searchParams.set('error', 'oauth_failed')
    return NextResponse.redirect(redirectTarget)
  }
}
