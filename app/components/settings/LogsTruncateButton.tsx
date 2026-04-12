'use client'

import { useTransition, useRef } from 'react'
import { truncateAccessLogs } from '@/app/actions/logs'
import { useToast } from '@/app/components/ToastContext'

export default function LogsTruncateButton() {
  const [pending, startTransition] = useTransition()
  const { showToast } = useToast()
  const dialogRef = useRef<HTMLDialogElement>(null)

  function handleConfirm() {
    dialogRef.current?.close()
    startTransition(async () => {
      const { deleted } = await truncateAccessLogs()
      showToast('success', 'Logs Dihapus', `${deleted.toLocaleString('id-ID')} entri berhasil dihapus.`)
    })
  }

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => dialogRef.current?.showModal()}
        className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-3.5 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        {pending ? 'Menghapus...' : 'Truncate Logs'}
      </button>

      <dialog
        ref={dialogRef}
        className="fixed top-1/2 left-1/2 m-0 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl backdrop:bg-black/40 dark:border-neutral-700 dark:bg-neutral-900"
      >
        <div className="flex items-start gap-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-neutral-900 dark:text-white">Hapus Semua Logs?</h2>
            <p className="mt-1.5 text-sm text-neutral-500 dark:text-neutral-400">
              Seluruh data access log akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600"
          >
            Ya, Hapus Semua
          </button>
        </div>
      </dialog>
    </>
  )
}
