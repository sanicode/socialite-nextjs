'use client'

import { useTransition } from 'react'
import type { ConnectedSocialMediaRow } from '@/app/actions/social-medias'
import { unlinkSocialMedia } from '@/app/actions/social-medias'
import type { SocialProviderPublicConfig } from '@/app/lib/social-oauth'

type Props = {
  accounts: ConnectedSocialMediaRow[]
  providers: SocialProviderPublicConfig[]
}

function platformLabel(platform: string) {
  switch (platform) {
    case 'youtube':
      return 'YouTube'
    case 'facebook':
      return 'Facebook'
    case 'instagram':
      return 'Instagram'
    case 'tiktok':
      return 'TikTok'
    default:
      return platform
  }
}

function formatDate(value: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function SocialMediaAccountsClient({ accounts, providers }: Props) {
  const [pending, startTransition] = useTransition()

  function handleUnlink(accountId: string) {
    startTransition(async () => {
      await unlinkSocialMedia(accountId)
    })
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {providers.map((provider) => (
          <div key={provider.platform} className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <p className="text-sm font-semibold text-neutral-900 dark:text-white">{provider.label}</p>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              {provider.configured ? 'Siap dihubungkan melalui OAuth.' : 'Belum dikonfigurasi di server.'}
            </p>
            {provider.configured ? (
              <a
                href={`/api/social-oauth/${provider.platform}/start`}
                className="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
              >
                Hubungkan
              </a>
            ) : (
              <span className="mt-4 inline-flex w-full cursor-not-allowed items-center justify-center rounded-lg bg-neutral-100 px-4 py-2.5 text-sm font-semibold text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500">
                Hubungkan
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="border-b border-neutral-200 px-5 py-4 dark:border-neutral-800">
          <h2 className="text-base font-semibold text-neutral-900 dark:text-white">Akun Terhubung</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-800/50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Platform</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Akun</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Terhubung</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Sinkron</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {accounts.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-neutral-400 dark:text-neutral-500">
                    Belum ada akun medsos terhubung.
                  </td>
                </tr>
              )}
              {accounts.map((account) => (
                <tr key={account.id} className="border-b border-neutral-100 last:border-0 dark:border-neutral-800/60">
                  <td className="px-4 py-3 font-medium text-neutral-900 dark:text-white">{platformLabel(account.platform)}</td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <p className="font-medium text-neutral-900 dark:text-white">
                        {account.displayName ?? account.username ?? '-'}
                      </p>
                      {account.username && (
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">{account.username}</p>
                      )}
                      <p className="font-mono text-xs text-neutral-500 dark:text-neutral-400">
                        ID: {account.providerAccountId}
                      </p>
                      {account.profileUrl && (
                        <a
                          href={account.profileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                        >
                          Buka profil
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-neutral-500 dark:text-neutral-400">{formatDate(account.connectedAt)}</td>
                  <td className="px-4 py-3 text-xs text-neutral-500 dark:text-neutral-400">{formatDate(account.lastSyncedAt)}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => handleUnlink(account.id)}
                      className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
                    >
                      Putuskan
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
