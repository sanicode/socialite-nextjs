'use client'

import { useActionState, useState } from 'react'
import { changeMyPassword, type ChangePasswordState } from '@/app/actions/profile'
import {
  PASSWORD_MIN_LENGTH,
  getPasswordPolicyChecks,
  getPasswordStrength,
  type PasswordStrength,
} from '@/app/lib/password-policy'

const INITIAL_STATE: ChangePasswordState = { status: 'idle' }

const STRENGTH_LABELS: Record<PasswordStrength, string> = {
  weak: 'Weak',
  medium: 'Medium',
  strong: 'Strong',
}

const STRENGTH_BAR_COUNT: Record<PasswordStrength, number> = {
  weak: 1,
  medium: 2,
  strong: 3,
}

const STRENGTH_STYLES: Record<PasswordStrength, string> = {
  weak: 'bg-red-500',
  medium: 'bg-amber-500',
  strong: 'bg-emerald-500',
}

function FieldErrors({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null

  return (
    <ul className="mt-1.5 space-y-1 text-xs text-red-600 dark:text-red-400">
      {errors.map((error) => (
        <li key={error}>{error}</li>
      ))}
    </ul>
  )
}

function Requirement({ met, children }: { met: boolean; children: React.ReactNode }) {
  return (
    <li className={`flex items-center gap-1.5 ${met ? 'text-emerald-600 dark:text-emerald-400' : 'text-neutral-500 dark:text-neutral-400'}`}>
      <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={met ? 'M5 13l4 4L19 7' : 'M12 6v6m0 4h.01'} />
      </svg>
      {children}
    </li>
  )
}

export default function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changeMyPassword, INITIAL_STATE)
  const [newPassword, setNewPassword] = useState('')
  const strength = getPasswordStrength(newPassword)
  const checks = getPasswordPolicyChecks(newPassword)
  const activeBars = newPassword ? STRENGTH_BAR_COUNT[strength] : 0

  return (
    <form action={formAction} className="space-y-5">
      {state.message && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            state.status === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200'
              : 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200'
          }`}
        >
          {state.message}
        </div>
      )}

      <div>
        <label htmlFor="currentPassword" className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Password lama
        </label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          disabled={pending}
          className="w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-3 text-sm text-neutral-900 outline-none transition focus:ring-2 focus:ring-neutral-900 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:focus:ring-white"
        />
        <FieldErrors errors={state.errors?.currentPassword} />
      </div>

      <div>
        <label htmlFor="newPassword" className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Password baru
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={PASSWORD_MIN_LENGTH}
          required
          disabled={pending}
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          className="w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-3 text-sm text-neutral-900 outline-none transition focus:ring-2 focus:ring-neutral-900 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:focus:ring-white"
        />
        <FieldErrors errors={state.errors?.newPassword} />

        <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-950/40">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium text-neutral-600 dark:text-neutral-300">Kekuatan password</p>
            <p className={`text-xs font-semibold ${
              newPassword
                ? strength === 'strong'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : strength === 'medium'
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-red-600 dark:text-red-400'
                : 'text-neutral-400 dark:text-neutral-500'
            }`}>
              {newPassword ? STRENGTH_LABELS[strength] : '-'}
            </p>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1.5" aria-hidden="true">
            {[1, 2, 3].map((bar) => (
              <span
                key={bar}
                className={`h-1.5 rounded-full ${bar <= activeBars ? STRENGTH_STYLES[strength] : 'bg-neutral-200 dark:bg-neutral-700'}`}
              />
            ))}
          </div>
          <ul className="mt-3 grid gap-1.5 text-xs sm:grid-cols-3">
            <Requirement met={checks.hasMinimumLength}>Minimal {PASSWORD_MIN_LENGTH} karakter</Requirement>
            <Requirement met={checks.hasLowercase}>Huruf kecil</Requirement>
            <Requirement met={checks.hasUppercase}>Huruf besar</Requirement>
          </ul>
        </div>
      </div>

      <div>
        <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Konfirmasi password baru
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={PASSWORD_MIN_LENGTH}
          required
          disabled={pending}
          className="w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-3 text-sm text-neutral-900 outline-none transition focus:ring-2 focus:ring-neutral-900 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:focus:ring-white"
        />
        <FieldErrors errors={state.errors?.confirmPassword} />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="ui-button inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
      >
        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M16.5 10.5V6.75a4.5 4.5 0 00-9 0v3.75m-.75 0h10.5A2.25 2.25 0 0119.5 12.75v6A2.25 2.25 0 0117.25 21H6.75a2.25 2.25 0 01-2.25-2.25v-6A2.25 2.25 0 016.75 10.5z" />
        </svg>
        {pending ? 'Memproses...' : 'Ganti Password'}
      </button>
    </form>
  )
}
