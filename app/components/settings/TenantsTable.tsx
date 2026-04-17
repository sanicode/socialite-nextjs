'use client'

import { useState, useTransition, useRef, useEffect, useCallback } from 'react'
import { useToast } from '@/app/components/ToastContext'
import {
  getTenantDetail,
  getTenantUsers,
  searchUsersForTenant,
  updateTenant,
  deleteTenant,
  attachTenantUser,
  detachTenantUser,
  updateTenantUserRole,
  getCitiesForSelect,
  type TenantRow,
  type TenantDetail,
  type TenantUserRow,
  type UserSearchResult,
} from '@/app/actions/tenants'

type Props = {
  tenants: TenantRow[]
  provinces: { id: number; name: string }[]
  searchParams: Record<string, string | undefined>
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function inputCls(extra = '') {
  return `w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:focus:ring-white ${extra}`
}

function selectCls(extra = '') {
  return `w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:focus:ring-white ${extra}`
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">{children}</label>
}

// ── Edit Info Form (inside dialog) ────────────────────────────────────────────

type EditFormState = {
  name: string
  domain: string
  address_id: string
  address_line_1: string
  city: string
  state: string
  zip: string
  province_id: string
  city_id: string
}

function EditInfoPanel({
  detail,
  provinces,
  onSave,
  onCancel,
  saving,
}: {
  detail: TenantDetail
  provinces: { id: number; name: string }[]
  onSave: (form: EditFormState) => void
  onCancel: () => void
  saving: boolean
}) {
  const [form, setForm] = useState<EditFormState>({
    name: detail.name,
    domain: detail.domain ?? '',
    address_id: detail.address.id ?? '',
    address_line_1: detail.address.address_line_1 ?? '',
    city: detail.address.city ?? '',
    state: detail.address.state ?? '',
    zip: detail.address.zip ?? '',
    province_id: detail.address.province_id?.toString() ?? '',
    city_id: detail.address.city_id?.toString() ?? '',
  })

  const [cities, setCities] = useState<{ id: string; name: string }[]>([])
  const [loadingCities, setLoadingCities] = useState(false)

  // Load cities when province changes
  useEffect(() => {
    if (!form.province_id) { setCities([]); return }
    setLoadingCities(true)
    getCitiesForSelect(parseInt(form.province_id, 10))
      .then(setCities)
      .finally(() => setLoadingCities(false))
  }, [form.province_id])

  function set(field: keyof EditFormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleProvinceChange(provinceId: string) {
    setForm((prev) => ({ ...prev, province_id: provinceId, city_id: '', city: '' }))
  }

  function handleCityChange(cityId: string) {
    const city = cities.find((c) => c.id === cityId)
    setForm((prev) => ({ ...prev, city_id: cityId, city: city?.name ?? '' }))
  }

  return (
    <div className="space-y-4">
      {/* Tenant info */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label>Nama Tenant *</Label>
          <input
            className={inputCls()}
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Nama tenant"
            required
          />
        </div>
        <div className="sm:col-span-2">
          <Label>Domain</Label>
          <input
            className={inputCls()}
            value={form.domain}
            onChange={(e) => set('domain', e.target.value)}
            placeholder="contoh.com (opsional)"
          />
        </div>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 border-t border-neutral-200 dark:border-neutral-700" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Alamat</span>
        <div className="flex-1 border-t border-neutral-200 dark:border-neutral-700" />
      </div>

      {/* Address */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label>Alamat</Label>
          <input
            className={inputCls()}
            value={form.address_line_1}
            onChange={(e) => set('address_line_1', e.target.value)}
            placeholder="Jl. Contoh No. 1"
          />
        </div>

        <div>
          <Label>Provinsi</Label>
          <select
            className={selectCls()}
            value={form.province_id}
            onChange={(e) => handleProvinceChange(e.target.value)}
          >
            <option value="">— Pilih Provinsi —</option>
            {provinces.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div>
          <Label>Kota / Kabupaten</Label>
          {form.province_id ? (
            <select
              className={selectCls(loadingCities ? 'opacity-50' : '')}
              value={form.city_id}
              onChange={(e) => handleCityChange(e.target.value)}
              disabled={loadingCities}
            >
              <option value="">{loadingCities ? 'Memuat...' : '— Pilih Kota —'}</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          ) : (
            <input
              className={inputCls()}
              value={form.city}
              onChange={(e) => set('city', e.target.value)}
              placeholder="Nama kota"
            />
          )}
        </div>

        <div>
          <Label>Kode Pos</Label>
          <input
            className={inputCls()}
            value={form.zip}
            onChange={(e) => set('zip', e.target.value)}
            placeholder="12345"
          />
        </div>

        <div>
          <Label>Negara</Label>
          <input
            className={inputCls()}
            value={form.state}
            onChange={(e) => set('state', e.target.value)}
            placeholder="Indonesia"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          Batal
        </button>
        <button
          type="button"
          onClick={() => onSave(form)}
          disabled={saving || !form.name.trim()}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
        >
          {saving ? 'Menyimpan...' : 'Simpan'}
        </button>
      </div>
    </div>
  )
}

// ── User search combobox ──────────────────────────────────────────────────────

function UserCombobox({
  tenantId,
  onSelect,
}: {
  tenantId: string
  onSelect: (user: UserSearchResult) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<UserSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const search = useCallback(
    async (q: string) => {
      if (q.trim().length < 2) { setResults([]); setOpen(false); return }
      setLoading(true)
      try {
        const res = await searchUsersForTenant(q, tenantId)
        setResults(res)
        setOpen(true)
      } finally {
        setLoading(false)
      }
    },
    [tenantId]
  )

  useEffect(() => {
    const t = setTimeout(() => search(query), 300)
    return () => clearTimeout(t)
  }, [query, search])

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function pick(user: UserSearchResult) {
    onSelect(user)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          className={inputCls('pr-8')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ketik nama atau email user..."
          autoComplete="off"
        />
        {loading && (
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600 dark:border-neutral-600 dark:border-t-neutral-300" />
          </div>
        )}
      </div>
      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full rounded-xl border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
          {results.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                onMouseDown={() => pick(u)}
                className="w-full px-3 py-2 text-left transition hover:bg-neutral-50 dark:hover:bg-neutral-800"
              >
                <span className="block text-sm font-medium text-neutral-900 dark:text-white">{u.name}</span>
                <span className="block text-xs text-neutral-500 dark:text-neutral-400">{u.email}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && !loading && results.length === 0 && query.trim().length >= 2 && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-3 text-sm text-neutral-500 shadow-lg dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400">
          Tidak ada user ditemukan.
        </div>
      )}
    </div>
  )
}

// ── Manage Users Panel (inside dialog) ───────────────────────────────────────

function ManageUsersPanel({
  tenant,
  users,
  onUsersChange,
}: {
  tenant: TenantRow
  users: TenantUserRow[]
  onUsersChange: () => void
}) {
  const { showToast } = useToast()
  const [pending, startTransition] = useTransition()
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null)
  const [newRole, setNewRole] = useState<'manager' | 'operator'>('operator')
  const [detachTarget, setDetachTarget] = useState<TenantUserRow | null>(null)
  const detachDialogRef = useRef<HTMLDialogElement>(null)

  function openDetach(u: TenantUserRow) {
    setDetachTarget(u)
    detachDialogRef.current?.showModal()
  }

  function confirmDetach() {
    if (!detachTarget) return
    detachDialogRef.current?.close()
    startTransition(async () => {
      try {
        await detachTenantUser(detachTarget.tenant_user_id)
        showToast('success', 'User Dilepas', `${detachTarget.name} telah dilepas dari tenant ini.`)
        onUsersChange()
      } catch (e) {
        showToast('error', 'Gagal', (e as Error).message)
      }
    })
  }

  function handleAttach() {
    if (!selectedUser) return
    startTransition(async () => {
      try {
        await attachTenantUser(tenant.id, selectedUser.id, newRole)
        showToast('success', 'User Ditambahkan', `${selectedUser.name} berhasil ditambahkan sebagai ${newRole}.`)
        setSelectedUser(null)
        onUsersChange()
      } catch (e) {
        showToast('error', 'Gagal', (e as Error).message)
      }
    })
  }

  function handleRoleChange(tu: TenantUserRow, role: 'manager' | 'operator') {
    startTransition(async () => {
      try {
        await updateTenantUserRole(tu.tenant_user_id, role)
        showToast('success', 'Role Diubah', `Role ${tu.name} diubah menjadi ${role}.`)
        onUsersChange()
      } catch (e) {
        showToast('error', 'Gagal', (e as Error).message)
      }
    })
  }

  return (
    <div className="space-y-5">
      {/* User list */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-3">
          User Terdaftar ({users.length})
        </p>
        {users.length === 0 ? (
          <p className="text-sm text-neutral-400 dark:text-neutral-500 py-4 text-center">
            Belum ada user di tenant ini.
          </p>
        ) : (
          <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
            {users.map((u) => (
              <div key={u.tenant_user_id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-neutral-900 truncate dark:text-white">{u.name}</p>
                  <p className="text-xs text-neutral-500 truncate dark:text-neutral-400">{u.email}</p>
                </div>
                {/* Role select */}
                <select
                  value={u.role ?? ''}
                  disabled={pending}
                  onChange={(e) => handleRoleChange(u, e.target.value as 'manager' | 'operator')}
                  className="rounded-lg border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:focus:ring-white"
                >
                  <option value="">— role —</option>
                  <option value="manager">Manager</option>
                  <option value="operator">Operator</option>
                </select>
                {/* Detach */}
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => openDetach(u)}
                  className="rounded-lg border border-red-300 px-2.5 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
                >
                  Lepas
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 border-t border-neutral-200 dark:border-neutral-700" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Tambah User</span>
        <div className="flex-1 border-t border-neutral-200 dark:border-neutral-700" />
      </div>

      {/* Add user */}
      <div className="space-y-3">
        {selectedUser ? (
          <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 dark:border-neutral-700 dark:bg-neutral-800">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-neutral-900 dark:text-white">{selectedUser.name}</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">{selectedUser.email}</p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedUser(null)}
              className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : (
          <UserCombobox tenantId={tenant.id} onSelect={setSelectedUser} />
        )}

        <div className="flex items-center gap-3">
          <div className="flex-1">
            <Label>Role</Label>
            <select
              className={selectCls()}
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as 'manager' | 'operator')}
            >
              <option value="operator">Operator</option>
              <option value="manager">Manager</option>
            </select>
          </div>
          <div className="pt-5">
            <button
              type="button"
              disabled={!selectedUser || pending}
              onClick={handleAttach}
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
            >
              {pending ? 'Memproses...' : 'Tambah'}
            </button>
          </div>
        </div>
      </div>

      {/* Detach confirmation dialog (nested) */}
      <dialog
        ref={detachDialogRef}
        className="fixed top-1/2 left-1/2 m-0 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl backdrop:bg-black/60 dark:border-neutral-700 dark:bg-neutral-900"
      >
        {detachTarget && (
          <>
            <h3 className="text-base font-semibold text-neutral-900 dark:text-white">Lepas User?</h3>
            <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
              <span className="font-medium text-neutral-900 dark:text-white">{detachTarget.name}</span>{' '}
              akan dilepas dari tenant ini dan kehilangan role-nya.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => detachDialogRef.current?.close()}
                className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDetach}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                Ya, Lepas
              </button>
            </div>
          </>
        )}
      </dialog>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TenantsTable({ tenants, provinces }: Props) {
  const { showToast } = useToast()
  const [pending, startTransition] = useTransition()

  // ── Edit info dialog ──
  const editDialogRef = useRef<HTMLDialogElement>(null)
  const [editTarget, setEditTarget] = useState<TenantRow | null>(null)
  const [editDetail, setEditDetail] = useState<TenantDetail | null>(null)
  const [loadingEdit, setLoadingEdit] = useState(false)

  function openEdit(tenant: TenantRow) {
    setEditTarget(tenant)
    setEditDetail(null)
    setLoadingEdit(true)
    editDialogRef.current?.showModal()
    getTenantDetail(tenant.id)
      .then(setEditDetail)
      .finally(() => setLoadingEdit(false))
  }

  function handleSaveEdit(form: EditFormState) {
    if (!editTarget) return
    startTransition(async () => {
      try {
        await updateTenant(editTarget.id, {
          name: form.name,
          domain: form.domain,
          address: {
            id: form.address_id || undefined,
            address_line_1: form.address_line_1,
            city: form.city,
            state: form.state,
            zip: form.zip,
            province_id: form.province_id ? parseInt(form.province_id, 10) : null,
            city_id: form.city_id ? parseInt(form.city_id, 10) : null,
          },
        })
        showToast('success', 'Tenant Diperbarui', `Data ${editTarget.name} berhasil disimpan.`)
        editDialogRef.current?.close()
        setEditTarget(null)
      } catch (e) {
        showToast('error', 'Gagal Menyimpan', (e as Error).message)
      }
    })
  }

  // ── Manage users dialog ──
  const usersDialogRef = useRef<HTMLDialogElement>(null)
  const [usersTenant, setUsersTenant] = useState<TenantRow | null>(null)
  const [tenantUsers, setTenantUsers] = useState<TenantUserRow[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)

  function openUsers(tenant: TenantRow) {
    setUsersTenant(tenant)
    loadUsers(tenant.id)
    usersDialogRef.current?.showModal()
  }

  function loadUsers(tenantId: string) {
    setLoadingUsers(true)
    getTenantUsers(tenantId)
      .then(setTenantUsers)
      .finally(() => setLoadingUsers(false))
  }

  // ── Delete dialog ──
  const deleteDialogRef = useRef<HTMLDialogElement>(null)
  const [deleteTarget, setDeleteTarget] = useState<TenantRow | null>(null)

  function openDelete(tenant: TenantRow) {
    setDeleteTarget(tenant)
    deleteDialogRef.current?.showModal()
  }

  function handleDelete() {
    if (!deleteTarget) return
    deleteDialogRef.current?.close()
    startTransition(async () => {
      try {
        await deleteTenant(deleteTarget.id)
        showToast('success', 'Tenant Dihapus', `${deleteTarget.name} berhasil dihapus.`)
        setDeleteTarget(null)
      } catch (e) {
        showToast('error', 'Gagal Menghapus', (e as Error).message)
      }
    })
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 dark:border-neutral-800">
              {['Nama', 'Domain', 'Kota', 'Manager', 'Operator', 'Aksi'].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tenants.map((t) => {
              const hasUsers = t.manager_count + t.operator_count > 0
              return (
                <tr
                  key={t.id}
                  className="border-b border-neutral-100 last:border-0 dark:border-neutral-800/60"
                >
                  <td className="px-4 py-3 font-medium text-neutral-900 dark:text-white">{t.name}</td>
                  <td className="px-4 py-3 text-neutral-500 dark:text-neutral-400 text-xs">
                    {t.domain ?? <span className="text-neutral-300 dark:text-neutral-600">—</span>}
                  </td>
                  <td className="px-4 py-3 text-neutral-600 dark:text-neutral-300 text-xs">
                    {t.city ?? <span className="text-neutral-300 dark:text-neutral-600">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      t.manager_count > 0
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400'
                        : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-500'
                    }`}>
                      {t.manager_count}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      t.operator_count > 0
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                        : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-500'
                    }`}>
                      {t.operator_count}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => openEdit(t)}
                        className="rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => openUsers(t)}
                        className="rounded-lg border border-blue-300 px-2.5 py-1 text-xs font-medium text-blue-700 transition hover:bg-blue-50 disabled:opacity-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950/30"
                      >
                        Users
                      </button>
                      {!hasUsers && (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => openDelete(t)}
                          className="rounded-lg border border-red-300 px-2.5 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
                        >
                          Hapus
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}

            {tenants.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-neutral-400 dark:text-neutral-500">
                  Tidak ada tenant.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Edit Info Dialog ── */}
      <dialog
        ref={editDialogRef}
        className="fixed top-1/2 left-1/2 m-0 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl backdrop:bg-black/40 dark:border-neutral-700 dark:bg-neutral-900"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-neutral-900 dark:text-white">Edit Tenant</h2>
            {editTarget && (
              <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">{editTarget.name}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => editDialogRef.current?.close()}
            className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loadingEdit && (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-700 dark:border-neutral-600 dark:border-t-neutral-200" />
          </div>
        )}

        {!loadingEdit && editDetail && (
          <EditInfoPanel
            detail={editDetail}
            provinces={provinces}
            onSave={handleSaveEdit}
            onCancel={() => editDialogRef.current?.close()}
            saving={pending}
          />
        )}
      </dialog>

      {/* ── Manage Users Dialog ── */}
      <dialog
        ref={usersDialogRef}
        className="fixed top-1/2 left-1/2 m-0 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl backdrop:bg-black/40 dark:border-neutral-700 dark:bg-neutral-900"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-neutral-900 dark:text-white">Kelola User</h2>
            {usersTenant && (
              <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">{usersTenant.name}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => usersDialogRef.current?.close()}
            className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loadingUsers && (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-700 dark:border-neutral-600 dark:border-t-neutral-200" />
          </div>
        )}

        {!loadingUsers && usersTenant && (
          <ManageUsersPanel
            tenant={usersTenant}
            users={tenantUsers}
            onUsersChange={() => loadUsers(usersTenant.id)}
          />
        )}
      </dialog>

      {/* ── Delete Confirm Dialog ── */}
      <dialog
        ref={deleteDialogRef}
        className="fixed top-1/2 left-1/2 m-0 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl backdrop:bg-black/40 dark:border-neutral-700 dark:bg-neutral-900"
      >
        {deleteTarget && (
          <>
            <div className="flex items-start gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </span>
              <div>
                <h2 className="text-base font-semibold text-neutral-900 dark:text-white">Hapus Tenant?</h2>
                <p className="mt-1.5 text-sm text-neutral-500 dark:text-neutral-400">
                  Tenant <span className="font-medium text-neutral-900 dark:text-white">{deleteTarget.name}</span> akan dihapus secara permanen. Tindakan ini tidak dapat dibatalkan.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => deleteDialogRef.current?.close()}
                className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                Ya, Hapus
              </button>
            </div>
          </>
        )}
      </dialog>
    </>
  )
}

