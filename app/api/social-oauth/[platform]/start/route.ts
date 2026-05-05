import { NextResponse } from 'next/server'
import { requireUser } from '@/app/lib/authorization'
import { getSecuritySettings } from '@/app/lib/request-security'
import {
  buildAuthorizationUrl,
  buildRedirectUri,
  createSocialOAuthState,
  getSocialProvider,
} from '@/app/lib/social-oauth'

type Ctx = { params: Promise<{ platform: string }> }

export async function GET(request: Request, { params }: Ctx) {
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
    if (!provider || !provider.configured) {
      return NextResponse.redirect(new URL('/social-medias?error=provider_not_configured', request.url))
    }

    const url = new URL(request.url)
    const origin = url.origin
    const state = createSocialOAuthState(provider.platform, user.id)
    const redirectUri = buildRedirectUri(origin, provider.platform)
    return NextResponse.redirect(buildAuthorizationUrl(provider, redirectUri, state))
  } catch {
    return NextResponse.redirect(new URL('/login', request.url))
  }
}
