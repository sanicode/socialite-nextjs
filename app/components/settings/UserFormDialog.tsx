'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { createUser, updateUser, getRolesForUserForm, type UserRow, type RoleOption } from '@/app/actions/users'
import { useToast } from '@/app/components/ToastContext'

type Props = {
  mode: 'create' | 'edit'
  user?: UserRow
  onClose: () => void
}

const inputCls =
  'w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:focus:ring-white'

const labelCls = 'mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300'

export default function UserFormDialog({ mode, user, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [pending, startTransition] = useTransition()
  const { showToast } = useToast()

  const [name, setName]         = useState(user?.name ?? '')
  const [email, setEmail]       = useState(user?.email ?? '')
  const [phone, setPhone]       = useState(user?.phone_number ?? '')
  const [password, setPassword] = useState('')
  const [roleId, setRoleId]     = useState(user?.direct_role_id ?? '')
  const [isAdmin, setIsAdmin]   = useState(user?.is_admin ?? false)
  const [error, setError]       = useState<string | null>(null)
  const [roles, setRoles]       = useState<RoleOption[]>([])

  useEffect(() => {
    dialogRef.current?.showModal()
    getRolesForUserForm().then(setRoles).catch(() => {})
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      try {
        if (mode === 'create') {
          await createUser({
            name,
            email,
            phone_number: phone,
            password: password || undefined,
            role_id: roleId || undefined,
            is_admin: isAdmin,
          })
          showToast('success', 'User berhasil dibuat.')
        } else {
          await updateUser(user!.id, {
            name,
            email,
            phone_number: phone,
            password: password || undefined,
            role_id: roleId || null,
            is_admin: isAdmin,
          })
          showToast('success', 'User berhasil diperbarui.')
        }
        onClose()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Terjadi kesalahan.')
      }
    })
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="fixed top-1/2 left-1/2 m-0 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-neutral-200 bg-white p-0 shadow-xl backdrop:bg-black/40 dark:border-neutral-700 dark:bg-neutral-900"
    >
      <form onSubmit={handleSubmit}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4 dark:border-neutral-700">
          <h2 className="text-base font-semibold text-neutral-900 dark:text-white">
            {mode === 'create' ? 'Tambah User' : 'Edit User'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[70vh] overflow-y-auto">
          <div className="space-y-4 p-5">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                {error}
              </div>
            )}

            <div>
              <label className={labelCls}>Nama <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Nama lengkap"
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Email <span className="text-red-500">*</span></label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="email@contoh.com"
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Nomor Telp <span className="text-red-500">*</span></label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                placeholder="08xxxxxxxxxx"
                className={inputCls}
              />
              {mode === 'create' && (
                <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                  Jika password dikosongkan, nomor telp digunakan sebagai password.
                </p>
              )}
            </div>

            <div>
              <label className={labelCls}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'create' ? 'Kosongkan untuk pakai nomor telp' : 'Kosongkan untuk tidak mengubah'}
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Role</label>
              <select
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
                className={inputCls}
              >
                <option value="">— Tidak ada role —</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                Role via Spatie Permission (App\Models\User).
              </p>
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-neutral-200 p-3.5 dark:border-neutral-700">
              <input
                id="is_admin"
                type="checkbox"
                checked={isAdmin}
                onChange={(e) => setIsAdmin(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900 dark:border-neutral-600 dark:bg-neutral-800 dark:focus:ring-white cursor-pointer"
              />
              <label htmlFor="is_admin" className="cursor-pointer">
                <span className="text-sm font-medium text-neutral-900 dark:text-white">Is Admin</span>
                <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                  Aktifkan flag <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">is_admin</code> pada tabel users. Memberikan akses penuh ke semua fitur.
                </p>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-neutral-200 px-5 py-4 dark:border-neutral-700">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
          >
            {pending ? 'Menyimpan...' : mode === 'create' ? 'Buat User' : 'Simpan'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
