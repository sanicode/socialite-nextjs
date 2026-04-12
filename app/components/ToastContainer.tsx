'use client'

import { useToast, type Toast, type ToastType } from './ToastContext'

const ICONS: Record<ToastType, React.ReactNode> = {
  error: (
    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
  ),
  success: (
    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  info: (
    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zM12 8.25h.008v.008H12V8.25z" />
    </svg>
  ),
}

const STYLES: Record<ToastType, string> = {
  error:   'bg-red-600 text-white',
  warning: 'bg-amber-500 text-white',
  success: 'bg-emerald-600 text-white',
  info:    'bg-neutral-800 dark:bg-neutral-100 text-white dark:text-neutral-900',
}

const CLOSE_STYLES: Record<ToastType, string> = {
  error:   'text-red-200 hover:text-white',
  warning: 'text-amber-200 hover:text-white',
  success: 'text-emerald-200 hover:text-white',
  info:    'text-neutral-400 dark:text-neutral-500 hover:text-white dark:hover:text-neutral-900',
}

const SUB_STYLES: Record<ToastType, string> = {
  error:   'text-red-100',
  warning: 'text-amber-100',
  success: 'text-emerald-100',
  info:    'text-neutral-300 dark:text-neutral-600',
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  return (
    <div className={`flex items-start gap-3 px-4 py-3.5 rounded-xl shadow-2xl max-w-sm w-full pointer-events-auto ${STYLES[toast.type]}`}>
      <span className="mt-0.5">{ICONS[toast.type]}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-tight">{toast.title}</p>
        {toast.message && (
          <p className={`text-xs mt-0.5 leading-snug ${SUB_STYLES[toast.type]}`}>{toast.message}</p>
        )}
      </div>
      <button onClick={onDismiss} className={`shrink-0 mt-0.5 transition ${CLOSE_STYLES[toast.type]}`}>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

export default function ToastContainer() {
  const { toasts, dismiss } = useToast()

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
      ))}
    </div>
  )
}
