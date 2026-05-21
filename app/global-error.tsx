'use client'

import { useEffect } from 'react'
import AppErrorScreen from '@/app/components/AppErrorScreen'

function formatErrorForConsole(error: Error & { digest?: string }) {
  return [
    error.name,
    error.message,
    error.digest ? `digest=${error.digest}` : '',
  ].filter(Boolean).join(' | ')
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset?: () => void
}) {
  useEffect(() => {
    console.error(formatErrorForConsole(error))
  }, [error])

  return (
    <html lang="id">
      <body>
        <AppErrorScreen error={error} reset={reset} />
      </body>
    </html>
  )
}
