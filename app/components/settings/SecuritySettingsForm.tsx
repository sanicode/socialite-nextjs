'use client'

import { useActionState, useEffect, useState } from 'react'
import {
  saveSecuritySettings,
  type SecuritySettingsState,
} from '@/app/actions/security'
import { useToast } from '@/app/components/ToastContext'

type Props = {
  initialState: NonNullable<SecuritySettingsState>
  currentIp: string | null
  currentCountry: string | null
}

function AlertIcon({ type }: { type: 'success' | 'error' }) {
  if (type === 'success') {
    return (
      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  }

  return (
    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
  )
}

export default function SecuritySettingsForm({ initialState, currentIp, currentCountry }: Props) {
  const { showToast } = useToast()
  const [state, formAction, pending] = useActionState(saveSecuritySettings, initialState)
  const [blockedIpsText, setBlockedIpsText] = useState(initialState.settings.blockedIpsText)
  const [allowedCountriesText, setAllowedCountriesText] = useState(initialState.settings.allowedCountriesText)
  const [allowUnknownCountries, setAllowUnknownCountries] = useState(initialState.settings.allowUnknownCountries)

  useEffect(() => {
    if (!state) return

    if (state.message) {
      showToast(
        state.status === 'success' ? 'success' : 'error',
        state.status === 'success' ? 'Pengaturan Tersimpan' : 'Gagal Menyimpan',
        state.message
      )
    }
  }, [state, showToast])

  const alertType = state?.status === 'success' ? 'success' : 'error'

  return (
    <form action={formAction} className="space-y-6">
      {state?.message && (
        <div
          className={`rounded-xl border px-4 py-3 ${
            alertType === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200'
              : 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200'
          }`}
        >
          <div className="flex items-start gap-3">
            <AlertIcon type={alertType} />
            <div>
              <p className="text-sm font-semibold">
                {alertType === 'success' ? 'Berhasil Disimpan' : 'Perlu Perhatian'}
              </p>
              <p className="mt-1 text-sm leading-relaxed">{state.message}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-950/40">
          <p className="text-sm font-semibold text-neutral-900 dark:text-white">Koneksi saat ini</p>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            IP: <span className="font-mono text-neutral-900 dark:text-white">{currentIp ?? 'Tidak terdeteksi'}</span>
          </p>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            Negara: <span className="font-mono text-neutral-900 dark:text-white">{currentCountry ?? 'Tidak terdeteksi'}</span>
          </p>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-950/40">
          <p className="text-sm font-semibold text-neutral-900 dark:text-white">Petunjuk</p>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            Masukkan satu IP per baris untuk daftar blokir. Untuk negara, gunakan kode ISO 2 huruf seperti `ID`, `SG`, atau `US`.
          </p>
        </div>
      </div>

      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
            Blokir IP
          </label>
          <textarea
            name="blockedIps"
            value={blockedIpsText}
            onChange={(event) => setBlockedIpsText(event.target.value)}
            rows={8}
            disabled={pending}
            placeholder={'Contoh:\n192.168.1.10\n203.0.113.5'}
            className="w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-3 font-mono text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:focus:ring-white"
          />
          <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">
            Request dari IP di daftar ini akan langsung ditolak.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
            Negara yang Diizinkan
          </label>
          <textarea
            name="allowedCountries"
            value={allowedCountriesText}
            onChange={(event) => setAllowedCountriesText(event.target.value)}
            rows={4}
            disabled={pending}
            placeholder="ID, SG, MY"
            className="w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-3 font-mono text-sm uppercase text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:focus:ring-white"
          />
          <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">
            Jika kosong, aplikasi dapat diakses dari negara mana pun.
          </p>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={allowUnknownCountries}
              onChange={(event) => setAllowUnknownCountries(event.target.checked)}
              disabled={pending}
              className="mt-1 h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:focus:ring-white"
            />
            <span>
              <span className="block text-sm font-medium text-neutral-900 dark:text-white">
                Izinkan negara yang tidak terdeteksi
              </span>
              <span className="mt-1 block text-xs text-neutral-500 dark:text-neutral-400">
                Aktifkan opsi ini jika provider Anda tidak selalu mengirim header negara.
              </span>
            </span>
          </label>
          <input type="hidden" name="allowUnknownCountries" value={allowUnknownCountries ? '1' : '0'} />
        </div>
      </div>

      <div className="flex items-center justify-end">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
        >
          {pending ? 'Menyimpan...' : 'Simpan Pengaturan'}
        </button>
      </div>
    </form>
  )
}
