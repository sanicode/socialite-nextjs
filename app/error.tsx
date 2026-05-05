'use client'

import { useEffect } from 'react'
import AppErrorScreen from '@/app/components/AppErrorScreen'

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return <AppErrorScreen error={error} reset={reset} />
}
