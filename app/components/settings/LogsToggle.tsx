'use client'

import { useTransition } from 'react'
import { toggleAccessLogging } from '@/app/actions/logs'
import { useToast } from '@/app/components/ToastContext'

type Props = {
  enabled: boolean
}

export default function LogsToggle({ enabled }: Props) {
  const [pending, startTransition] = useTransition()
  const { showToast } = useToast()

  function handleToggle() {
    startTransition(async () => {
      await toggleAccessLogging(!enabled)
      showToast(
        'success',
        !enabled ? 'Logging Diaktifkan' : 'Logging Dinonaktifkan',
        !enabled
          ? 'Access log akan kembali dicatat.'
          : 'Access log tidak akan dicatat hingga diaktifkan kembali.',
      )
    })
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={pending}
      aria-pressed={enabled}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus:ring-white dark:focus:ring-offset-neutral-900 ${
        enabled
          ? 'bg-neutral-900 dark:bg-white'
          : 'bg-neutral-300 dark:bg-neutral-600'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full shadow transition duration-200 ${
          enabled
            ? 'translate-x-5 bg-white dark:bg-neutral-900'
            : 'translate-x-0.5 bg-white dark:bg-neutral-400'
        }`}
      />
    </button>
  )
}
