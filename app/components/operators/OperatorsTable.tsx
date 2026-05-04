'use client'

import { useTransition, useRef, useState, useEffect } from 'react'
import {
  detachOperator,
  attachOperator,
  searchUsersForOperator,
  type OperatorRow,
  type OperatorSearchResult,
} from '@/app/actions/operators'
import { useToast } from '@/app/components/ToastContext'

type Props = {
  operators: OperatorRow[]
  isLoading?: boolean
}

function AttachDialog({ onClose }: { onClose: () => void }) {
  const [pending, startTransition] = useTransition()
  const { showToast } = useToast()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<OperatorSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<OperatorSearchResult | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (query.trim().length < 2) {
      timerRef.current = setTimeout(() => setResults([]), 0)
      return
    }
    timerRef.current = setTimeout(async () => {
      setSearching(true)
      const res = await searchUsersForOperator(query)
      setResults(res)
      setSearching(false)
    }, 300)
  }, [query])

  function handleSelect(u: OperatorSearchResult) {
    setSelected(u)
    setQuery(u.name)
    setResults([])
  }

  function handleAttach() {
    if (!selected) return
    startTransition(async () => {
      try {
        await attachOperator(selected.id)
        showToast('success', `${selected.name} berhasil ditambahkan sebagai operator.`)
        onClose()
      } catch (e) {
        showToast('error', e instanceof Error ? e.message : 'Gagal menambahkan operator.')
      }
    })
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="fixed top-1/2 left-1/2 m-0 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-neutral-200 bg-white p-0 shadow-xl backdrop:bg-black/40 dark:border-neutral-700 dark:bg-neutral-900"
    >
      <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4 dark:border-neutral-700">
        <h2 className="text-base font-semibold text-neutral-900 dark:text-white">Tambah Operator</h2>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-4 p-5">
        <div className="relative">
          <label className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Cari User
          </label>
          <input
            type="search"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(null) }}
            placeholder="Ketik nama atau email..."
            className="w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:focus:ring-white"
            autoFocus
          />
          {(results.length > 0 || searching) && (
            <div className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
              {searching ? (
                <div className="px-4 py-3 text-sm text-neutral-500 dark:text-neutral-400">Mencari...</div>
              ) : (
                results.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleSelect(u)}
                    className="flex w-full flex-col px-4 py-2.5 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800"
                  >
                    <span className="text-sm font-medium text-neutral-900 dark:text-white">{u.name}</span>
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">{u.email}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {selected && (
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 dark:border-neutral-700 dark:bg-neutral-800">
            <p className="text-sm font-medium text-neutral-900 dark:text-white">{selected.name}</p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">{selected.email}</p>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3 border-t border-neutral-200 px-5 py-4 dark:border-neutral-700">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          Batal
        </button>
        <button
          type="button"
          disabled={!selected || pending}
          onClick={handleAttach}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
        >
          {pending ? 'Menyimpan...' : 'Tambah'}
        </button>
      </div>
    </dialog>
  )
}

export default function OperatorsTable({ operators, isLoading = false }: Props) {
  const [pending, startTransition] = useTransition()
  const { showToast } = useToast()
  const confirmRef = useRef<HTMLDialogElement>(null)
  const [detachTarget, setDetachTarget] = useState<OperatorRow | null>(null)
  const [showAttach, setShowAttach] = useState(false)

  function openDetach(op: OperatorRow) {
    setDetachTarget(op)
    confirmRef.current?.showModal()
  }

  function closeConfirm() {
    setDetachTarget(null)
    confirmRef.current?.close()
  }

  function handleDetach() {
    if (!detachTarget) return
    startTransition(async () => {
      try {
        await detachOperator(detachTarget.tenant_user_id)
        showToast('success', `${detachTarget.name} berhasil dilepas dari tenant.`)
        closeConfirm()
      } catch (e) {
        showToast('error', e instanceof Error ? e.message : 'Gagal melepas operator.')
        closeConfirm()
      }
    })
  }

  return (
    <>
      {/* Attach dialog */}
      {showAttach && <AttachDialog onClose={() => setShowAttach(false)} />}

      {/* Detach confirm dialog */}
      <dialog
        ref={confirmRef}
        onClose={closeConfirm}
        className="fixed top-1/2 left-1/2 m-0 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-neutral-200 bg-white p-0 shadow-xl backdrop:bg-black/40 dark:border-neutral-700 dark:bg-neutral-900"
      >
        <div className="p-5">
          <h3 className="text-base font-semibold text-neutral-900 dark:text-white">Lepas Operator?</h3>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            <strong className="text-neutral-900 dark:text-white">{detachTarget?.name}</strong> akan dilepas
            dari tenant. Tindakan ini tidak dapat dibatalkan.
          </p>
        </div>
        <div className="flex justify-end gap-3 border-t border-neutral-200 px-5 py-4 dark:border-neutral-700">
          <button
            type="button"
            onClick={closeConfirm}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={handleDetach}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
          >
            {pending ? 'Melepas...' : 'Ya, Lepas'}
          </button>
        </div>
      </dialog>

      {/* Table card */}
      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        {/* Table header row with Add button */}
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
            Daftar Operator
          </span>
          <button
            type="button"
            onClick={() => setShowAttach(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Tambah Operator
          </button>
        </div>

        {isLoading ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-800/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Nama</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">No. Telp</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 6 }).map((_, rowIndex) => (
                  <tr key={`operator-skeleton-${rowIndex}`} className="border-b border-neutral-100 last:border-0 dark:border-neutral-800/60">
                    {[0, 1, 2, 3].map((colIndex) => (
                      <td key={`operator-skeleton-${rowIndex}-${colIndex}`} className="px-4 py-3">
                        <div className={`animate-pulse rounded bg-neutral-200 dark:bg-neutral-700 ${colIndex === 3 ? 'ml-auto h-7 w-16' : 'h-4 w-28'}`} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : operators.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-neutral-500 dark:text-neutral-400">
            Belum ada operator.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-800/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                    Nama
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                    No. Telp
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody>
                {operators.map((op) => (
                  <tr
                    key={op.tenant_user_id}
                    className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50 dark:border-neutral-800/60 dark:hover:bg-neutral-800/30"
                  >
                    <td className="px-4 py-3 font-medium text-neutral-900 dark:text-white">{op.name}</td>
                    <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">{op.email}</td>
                    <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                      {op.phone_number ?? <span className="text-neutral-400 dark:text-neutral-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => openDetach(op)}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                      >
                        Lepas
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
