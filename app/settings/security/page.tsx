import { redirect } from 'next/navigation'
import { getSessionUser } from '@/app/lib/session'
import {
  getRequestSecurityContext,
} from '@/app/lib/request-security'
import {
  getSecuritySettingsFormState,
} from '@/app/actions/security'
import SecuritySettingsForm from '@/app/components/settings/SecuritySettingsForm'

export default async function SecuritySettingsPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  if (!user.roles.includes('admin')) redirect('/posts')

  const [initialState, requestContext] = await Promise.all([
    getSecuritySettingsFormState(),
    getRequestSecurityContext(),
  ])

  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-5 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Settings</p>
          <h1 className="mt-1 text-2xl font-bold text-neutral-900 dark:text-white">Security</h1>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            Kelola blokir IP, negara yang boleh mengakses aplikasi, status REST API, akun medsos operator, batas upload, kompresi image, serta jam pelaporan operator dan manager.
          </p>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-6 dark:border-neutral-800 dark:bg-neutral-900">
          <SecuritySettingsForm
            initialState={initialState}
            currentIp={requestContext.ip}
            currentCountry={requestContext.country}
          />
        </div>
      </div>
    </div>
  )
}
