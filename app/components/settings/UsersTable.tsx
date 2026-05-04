'use client'

import Link from 'next/link'
import { useTransition, useRef, useState } from 'react'
import { toggleUserBlock, resetUserRateLimit, bulkToggleBlock, bulkResetRateLimit, type UserRow } from '@/app/actions/users'
import { useToast } from '@/app/components/ToastContext'
import UserFormDialog from './UserFormDialog'

type Props = {
  users: UserRow[]
  totalBlocked: number
  totalUnderAttack: number
  totalRateLimited: number
  sortBy: string
  sortDir: 'asc' | 'desc'
  searchParams: Record<string, string | undefined>
  isLoading?: boolean
}

function buildHref(
  searchParams: Record<string, string | undefined>,
  col: string,
  currentSortBy: string,
  currentSortDir: 'asc' | 'desc',
): string {
  const nextDir = currentSortBy === col && currentSortDir === 'asc' ? 'desc' : 'asc'
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(searchParams)) {
    if (value && key !== 'sortBy' && key !== 'sortDir' && key !== 'page') query.set(key, value)
  }
  query.set('sortBy', col)
  query.set('sortDir', nextDir)
  return `/settings/users?${query.toString()}`
}

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  return (
    <span className="inline-flex flex-col ml-1">
      <svg
        className={`-mb-0.5 h-2.5 w-2.5 ${active && dir === 'asc' ? 'text-neutral-900 dark:text-white' : 'text-neutral-300 dark:text-neutral-600'}`}
        viewBox="0 0 10 6" fill="currentColor"
      >
        <path d="M5 0L10 6H0z" />
      </svg>
      <svg
        className={`h-2.5 w-2.5 ${active && dir === 'desc' ? 'text-neutral-900 dark:text-white' : 'text-neutral-300 dark:text-neutral-600'}`}
        viewBox="0 0 10 6" fill="currentColor"
      >
        <path d="M5 6L0 0h10z" />
      </svg>
    </span>
  )
}

function formatLastSeen(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

type ConfirmState =
  | { type: 'block'; user: UserRow }
  | { type: 'reset'; user: UserRow }
  | { type: 'bulk'; ids: string[]; block: boolean }
  | { type: 'bulkReset'; emails: string[] }
  | null

export default function UsersTable({ users, totalBlocked, totalUnderAttack, totalRateLimited, sortBy, sortDir, searchParams, isLoading = false }: Props) {
  const [pending, startTransition] = useTransition()
  const { showToast } = useToast()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [confirm, setConfirm] = useState<ConfirmState>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [editUser, setEditUser] = useState<UserRow | null>(null)

  const allPageSelected = users.length > 0 && users.every((u) => selectedIds.has(u.id))
  const somePageSelected = users.some((u) => selectedIds.has(u.id))
  const selectedUsers = users.filter((u) => selectedIds.has(u.id))

  function toggleAll() {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allPageSelected) {
        users.forEach((u) => next.delete(u.id))
      } else {
        users.forEach((u) => next.add(u.id))
      }
      return next
    })
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function sortLink(col: string) {
    return buildHref(searchParams, col, sortBy, sortDir)
  }

  function openConfirm(state: ConfirmState) {
    setConfirm(state)
    dialogRef.current?.showModal()
  }

  function handleConfirm() {
    if (!confirm) return
    dialogRef.current?.close()

    startTransition(async () => {
      if (confirm.type === 'reset') {
        await resetUserRateLimit(confirm.user.email)
        showToast('success', 'Rate Limit Direset', `Login attempts untuk ${confirm.user.email} telah dihapus.`)
      } else if (confirm.type === 'block') {
        await toggleUserBlock(confirm.user.id, !confirm.user.is_blocked)
        showToast(
          'success',
          confirm.user.is_blocked ? 'Akun Dibuka' : 'Akun Diblokir',
          `${confirm.user.email} berhasil ${confirm.user.is_blocked ? 'dibuka blokirnya' : 'diblokir'}.`,
        )
      } else if (confirm.type === 'bulk') {
        const { count } = await bulkToggleBlock(confirm.ids, confirm.block)
        showToast(
          'success',
          confirm.block ? 'Akun Diblokir' : 'Blokir Dibuka',
          `${count} akun berhasil ${confirm.block ? 'diblokir' : 'dibuka blokirnya'}.`,
        )
        setSelectedIds(new Set())
      } else if (confirm.type === 'bulkReset') {
        const { count } = await bulkResetRateLimit(confirm.emails)
        showToast('success', 'Rate Limit Direset', `Login attempts untuk ${count} akun telah dihapus.`)
        setSelectedIds(new Set())
      }
    })
  }

  const selectedCount = selectedIds.size

  return (
    <>
      {/* Edit user dialog */}
      {editUser && (
        <UserFormDialog mode="edit" user={editUser} onClose={() => setEditUser(null)} />
      )}

      {/* Alert: accounts under attack */}
      {totalUnderAttack > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800/60 dark:bg-red-950/30">
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/60">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
          </span>
          <p className="text-sm text-red-800 dark:text-red-300">
            <span className="font-semibold">{totalUnderAttack.toLocaleString('id-ID')} akun</span> sedang diserang — terdeteksi lebih dari 10 percobaan login gagal dalam 1 jam terakhir.
          </p>
        </div>
      )}

      {/* Alert: rate-limited accounts */}
      {totalRateLimited > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800/60 dark:bg-amber-950/30">
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
            <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </span>
          <p className="text-sm text-amber-800 dark:text-amber-300">
            <span className="font-semibold">{totalRateLimited.toLocaleString('id-ID')} akun</span> saat ini terdeteksi sedang terkena rate limit login.
          </p>
        </div>
      )}

      {/* Alert: blocked users warning */}
      {totalBlocked > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800/60 dark:bg-amber-950/30">
          <svg className="h-5 w-5 flex-shrink-0 text-amber-500 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <p className="text-sm text-amber-800 dark:text-amber-300">
            <span className="font-semibold">{totalBlocked.toLocaleString('id-ID')} pengguna</span> saat ini diblokir dan tidak dapat login.
          </p>
        </div>
      )}

      {/* Bulk action bar */}
      {selectedCount > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3 dark:border-neutral-700 dark:bg-neutral-900">
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {selectedCount} user dipilih
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              disabled={pending}
              onClick={() => openConfirm({ type: 'bulkReset', emails: selectedUsers.map((u) => u.email) })}
              className="inline-flex items-center rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-700 transition hover:bg-amber-50 disabled:opacity-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/30"
            >
              Reset Limit
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => openConfirm({ type: 'bulk', ids: Array.from(selectedIds), block: false })}
              className="inline-flex items-center rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
            >
              Buka Blokir Semua
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => openConfirm({ type: 'bulk', ids: Array.from(selectedIds), block: true })}
              className="inline-flex items-center rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
            >
              Blokir Semua
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="inline-flex items-center rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-600 transition hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 dark:border-neutral-800">
              {/* Checkbox select-all */}
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={allPageSelected}
                  ref={(el) => { if (el) el.indeterminate = somePageSelected && !allPageSelected }}
                  onChange={toggleAll}
                  className="h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900 dark:border-neutral-600 dark:bg-neutral-800 dark:focus:ring-white cursor-pointer"
                />
              </th>
              {[
                { label: 'Nama',           col: 'name' },
                { label: 'Email',          col: 'email' },
                { label: 'Status',         col: 'is_blocked' },
                { label: 'Terakhir Aktif', col: 'last_seen_at' },
              ].map(({ label, col }) => (
                <th key={col} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                  <Link
                    href={sortLink(col)}
                    className="inline-flex items-center gap-0.5 hover:text-neutral-900 dark:hover:text-white transition-colors"
                  >
                    {label}
                    <SortIcon active={sortBy === col} dir={sortDir} />
                  </Link>
                </th>
              ))}
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && Array.from({ length: 6 }).map((_, index) => (
              <tr key={`users-skeleton-${index}`} className="border-b border-neutral-100 last:border-0 dark:border-neutral-800/60">
                <td className="px-4 py-3">
                  <div className="h-4 w-4 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
                </td>
                <td className="px-4 py-3">
                  <div className="h-4 w-32 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
                </td>
                <td className="px-4 py-3">
                  <div className="h-4 w-48 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
                </td>
                <td className="px-4 py-3">
                  <div className="h-5 w-16 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-700" />
                </td>
                <td className="px-4 py-3">
                  <div className="h-4 w-28 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
                </td>
                <td className="px-4 py-3">
                  <div className="h-7 w-36 animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-700" />
                </td>
              </tr>
            ))}

            {!isLoading && users.map((u) => {
              const underAttack = u.active_failed_attempts > 10
              const isSelected = selectedIds.has(u.id)

              return (
                <tr
                  key={u.id}
                  className={`border-b border-neutral-100 last:border-0 dark:border-neutral-800/60 transition-colors ${
                    isSelected ? 'bg-neutral-50 dark:bg-neutral-800/40' : ''
                  }`}
                >
                  {/* Checkbox */}
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleOne(u.id)}
                      className="h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900 dark:border-neutral-600 dark:bg-neutral-800 dark:focus:ring-white cursor-pointer"
                    />
                  </td>

                  {/* Nama */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-neutral-900 dark:text-white">{u.name}</span>
                      {u.is_admin && (
                        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                          Admin
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Email + badge serangan */}
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-neutral-600 dark:text-neutral-400">{u.email}</span>
                      {u.is_rate_limited && (
                        <span
                          title="Akun ini memenuhi ambang rate limit email Tier 3 dalam 1 jam terakhir"
                          className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/50 dark:text-amber-400"
                        >
                          Rate Limited
                        </span>
                      )}
                      {underAttack && (
                        <span
                          title={`${u.active_failed_attempts} percobaan gagal dalam 1 jam terakhir`}
                          className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-950/50 dark:text-red-400"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                          Diserang ({u.active_failed_attempts}×)
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        u.is_blocked
                          ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400'
                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                      }`}
                    >
                      {u.is_blocked ? 'Diblokir' : 'Aktif'}
                    </span>
                  </td>

                  {/* Last seen */}
                  <td className="px-4 py-3 text-xs text-neutral-500 dark:text-neutral-400">
                    {formatLastSeen(u.last_seen_at)}
                  </td>

                  {/* Aksi */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditUser(u)}
                        className="rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                      >
                        Edit
                      </button>
                      {u.active_failed_attempts > 0 && (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => openConfirm({ type: 'reset', user: u })}
                          className="rounded-lg border border-amber-300 px-2.5 py-1 text-xs font-medium text-amber-700 transition hover:bg-amber-50 disabled:opacity-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/30"
                        >
                          Reset Limit
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => openConfirm({ type: 'block', user: u })}
                        className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition disabled:opacity-50 ${
                          u.is_blocked
                            ? 'border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950/30'
                            : 'border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30'
                        }`}
                      >
                        {u.is_blocked ? 'Buka Blokir' : 'Blokir'}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}

            {!isLoading && users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-neutral-400 dark:text-neutral-500">
                  Tidak ada user.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Dialog konfirmasi */}
      <dialog
        ref={dialogRef}
        className="fixed top-1/2 left-1/2 m-0 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl backdrop:bg-black/40 dark:border-neutral-700 dark:bg-neutral-900"
      >
        {confirm && (
          <>
            <div className="flex items-start gap-4">
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                  confirm.type === 'reset' || confirm.type === 'bulkReset'
                    ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400'
                    : confirm.type === 'bulk'
                    ? confirm.block
                      ? 'bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400'
                      : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400'
                    : confirm.user.is_blocked
                    ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400'
                    : 'bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400'
                }`}
              >
                {confirm.type === 'reset' || confirm.type === 'bulkReset' ? (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                )}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold text-neutral-900 dark:text-white">
                  {confirm.type === 'reset'
                    ? 'Reset Rate Limit?'
                    : confirm.type === 'bulkReset'
                    ? `Reset Rate Limit ${confirm.emails.length} Akun?`
                    : confirm.type === 'bulk'
                    ? confirm.block
                      ? `Blokir ${confirm.ids.length} Akun?`
                      : `Buka Blokir ${confirm.ids.length} Akun?`
                    : confirm.user.is_blocked
                    ? 'Buka Blokir Akun?'
                    : 'Blokir Akun?'}
                </h2>
                <p className="mt-1.5 text-sm text-neutral-500 dark:text-neutral-400">
                  {confirm.type === 'reset'
                    ? `Semua catatan login attempts untuk ${confirm.user.email} akan dihapus. User dapat langsung mencoba login kembali.`
                    : confirm.type === 'bulkReset'
                    ? `Login attempts untuk ${confirm.emails.length} akun yang dipilih akan dihapus. Mereka dapat langsung mencoba login kembali.`
                    : confirm.type === 'bulk'
                    ? confirm.block
                      ? `${confirm.ids.length} akun yang dipilih akan diblokir dan tidak dapat login.`
                      : `${confirm.ids.length} akun yang dipilih akan dibuka dan dapat login kembali.`
                    : confirm.user.is_blocked
                    ? `Akun ${confirm.user.email} akan dibuka dan dapat login kembali.`
                    : `Akun ${confirm.user.email} akan diblokir dan tidak dapat login.`}
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
                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition ${
                  confirm.type === 'reset' || confirm.type === 'bulkReset'
                    ? 'bg-amber-600 hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600'
                    : confirm.type === 'bulk'
                    ? confirm.block
                      ? 'bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600'
                      : 'bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600'
                    : confirm.user.is_blocked
                    ? 'bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600'
                    : 'bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600'
                }`}
              >
                {confirm.type === 'reset' || confirm.type === 'bulkReset'
                  ? 'Ya, Reset'
                  : confirm.type === 'bulk'
                  ? confirm.block
                    ? 'Ya, Blokir Semua'
                    : 'Ya, Buka Semua'
                  : confirm.user.is_blocked
                  ? 'Ya, Buka Blokir'
                  : 'Ya, Blokir'}
              </button>
            </div>
          </>
        )}
      </dialog>
    </>
  )
}
