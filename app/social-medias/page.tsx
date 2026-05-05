import { redirect } from 'next/navigation'
import { getSessionUser } from '@/app/lib/session'
import { getConnectedSocialMedias } from '@/app/actions/social-medias'
import { getSecuritySettings } from '@/app/lib/request-security'
import SocialMediaAccountsClient from './SocialMediaAccountsClient'

type SearchParams = Promise<{ error?: string; connected?: string }>

function getSocialMediaMessage(error?: string) {
  switch (error) {
    case 'provider_not_configured':
      return 'Provider OAuth belum dikonfigurasi di server.'
    case 'account_used':
      return 'Akun medsos tersebut sudah terhubung ke operator lain.'
    case 'oauth_invalid_state':
    case 'oauth_invalid_request':
    case 'oauth_failed':
      return 'Gagal menghubungkan akun medsos. Coba ulangi prosesnya.'
    default:
      return null
  }
}

export default async function SocialMediasPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  if (!user.roles.includes('operator')) redirect('/posts')

  const params = await searchParams
  const securitySettings = await getSecuritySettings()
  if (!securitySettings.socialMediaConnectionsEnabled) redirect('/posts')

  const message = getSocialMediaMessage(params.error)
  const { providers, accounts } = await getConnectedSocialMedias()

  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-5 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Akun Medsos</h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Hubungkan akun medsos operator untuk membantu validasi kepemilikan laporan.
          </p>
        </div>

        {message && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
            {message}
          </div>
        )}

        <SocialMediaAccountsClient providers={providers} accounts={accounts} />
      </div>
    </div>
  )
}
