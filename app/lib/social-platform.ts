import type { SocialPlatform } from '@/app/lib/social-oauth'

const SOCIAL_PLATFORM_KEYWORDS: Array<{ platform: SocialPlatform; pattern: RegExp }> = [
  { platform: 'facebook', pattern: /facebook|fb\.com|fb\b/i },
  { platform: 'instagram', pattern: /instagram|ig\b/i },
  { platform: 'tiktok', pattern: /tiktok/i },
  { platform: 'youtube', pattern: /youtube|youtu\.be/i },
]

export function detectSocialPlatformFromCategory(categoryName: string): SocialPlatform | null {
  return SOCIAL_PLATFORM_KEYWORDS.find(({ pattern }) => pattern.test(categoryName))?.platform ?? null
}

export function getSocialPlatformLabel(platform: SocialPlatform | null) {
  switch (platform) {
    case 'facebook':
      return 'Facebook'
    case 'instagram':
      return 'Instagram'
    case 'tiktok':
      return 'TikTok'
    case 'youtube':
      return 'YouTube'
    default:
      return 'Media Sosial'
  }
}
