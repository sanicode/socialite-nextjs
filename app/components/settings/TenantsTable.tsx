'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition, useRef, useEffect, useCallback } from 'react'
import { useToast } from '@/app/components/ToastContext'
import {
  createTenant,
  getTenantDetail,
  getTenantUsers,
  importTenantOperatorsFromText,
  previewTenantOperatorImportFromText,
  searchUsersForTenant,
  updateTenant,
  deleteTenant,
  attachTenantUser,
  detachTenantUser,
  updateTenantUserRole,
  getCitiesForSelect,
  type TenantRow,
  type TenantDetail,
  type TenantFormData,
  type TenantOperatorImportPreview,
  type TenantOperatorImportResult,
  type TenantOperatorImportRow,
  type TenantOperatorImportStatus,
  type TenantUserRow,
  type UserSearchResult,
} from '@/app/actions/tenants'

type Props = {
  tenants: TenantRow[]
  provinces: { id: number; name: string }[]
  sortBy: string
  sortDir: 'asc' | 'desc'
  searchParams: Record<string, string | undefined>
  isLoading?: boolean
}

// ── Sort helpers ──────────────────────────────────────────────────────────────

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
  return `/settings/tenants?${query.toString()}`
}

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  return (
    <span className="ml-1 inline-flex flex-col">
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

function getOperatorImportStatusLabel(status: TenantOperatorImportStatus) {
  switch (status) {
    case 'valid':
      return 'Valid'
    case 'duplicate_input':
      return 'Duplikat'
    case 'not_found':
      return 'Tidak ada'
    case 'blocked':
      return 'Diblokir'
    case 'already_in_tenant':
      return 'Sudah di tenant'
    case 'already_has_tenant_role':
      return 'Sudah punya role'
    case 'invalid':
      return 'Invalid'
  }
}

function getOperatorImportStatusClass(status: TenantOperatorImportStatus) {
  switch (status) {
    case 'valid':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
    case 'duplicate_input':
      return 'bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400'
    case 'not_found':
      return 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'
    case 'blocked':
      return 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400'
    case 'already_in_tenant':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400'
    case 'already_has_tenant_role':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400'
    case 'invalid':
      return 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400'
  }
}

function OperatorImportSummary({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900">
      <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className="mt-0.5 text-base font-semibold text-neutral-900 dark:text-white">{value.toLocaleString('id-ID')}</p>
    </div>
  )
}

function OperatorImportPreviewTable({ rows }: { rows: TenantOperatorImportRow[] }) {
  return (
    <div className="max-h-64 overflow-auto rounded-xl border border-neutral-200 dark:border-neutral-700">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="sticky top-0 bg-neutral-50 dark:bg-neutral-800">
          <tr className="border-b border-neutral-200 dark:border-neutral-700">
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Baris</th>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">No HP</th>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">User</th>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Email</th>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Status</th>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Catatan</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.line}-${row.phone_number}`} className="border-b border-neutral-100 last:border-0 dark:border-neutral-800">
              <td className="px-3 py-2 text-xs text-neutral-500 dark:text-neutral-400">{row.line}</td>
              <td className="px-3 py-2 text-neutral-600 dark:text-neutral-300">{row.phone_number || '-'}</td>
              <td className="px-3 py-2 font-medium text-neutral-900 dark:text-white">{row.name ?? '-'}</td>
              <td className="px-3 py-2 text-neutral-600 dark:text-neutral-300">{row.email || '-'}</td>
              <td className="px-3 py-2">
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getOperatorImportStatusClass(row.status)}`}>
                  {getOperatorImportStatusLabel(row.status)}
                </span>
              </td>
              <td className="px-3 py-2 text-xs text-neutral-500 dark:text-neutral-400">{row.message}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
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

function buildEmptyTenantDetail(): TenantDetail {
  return {
    id: '',
    name: '',
    domain: null,
    address: {
      id: null,
      address_line_1: null,
      city: null,
      state: null,
      zip: null,
      province_id: null,
      city_id: null,
    },
  }
}

function buildTenantFormData(form: EditFormState): TenantFormData {
  return {
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
  }
}

function TenantInfoPanel({
  detail,
  provinces,
  onSave,
  onCancel,
  saving,
  submitLabel = 'Simpan',
}: {
  detail: TenantDetail
  provinces: { id: number; name: string }[]
  onSave: (form: EditFormState) => void
  onCancel: () => void
  saving: boolean
  submitLabel?: string
}) {
  const initialProvinceId = detail.address.province_id?.toString() ?? ''
  const [form, setForm] = useState<EditFormState>({
    name: detail.name,
    domain: detail.domain ?? '',
    address_id: detail.address.id ?? '',
    address_line_1: detail.address.address_line_1 ?? '',
    city: detail.address.city ?? '',
    state: detail.address.state ?? '',
    zip: detail.address.zip ?? '',
    province_id: initialProvinceId,
    city_id: detail.address.city_id?.toString() ?? '',
  })

  const [cities, setCities] = useState<{ id: string; name: string }[]>([])
  const [loadingCities, setLoadingCities] = useState(Boolean(initialProvinceId))

  useEffect(() => {
    if (!initialProvinceId) return

    let cancelled = false
    getCitiesForSelect(parseInt(initialProvinceId, 10))
      .then((nextCities) => {
        if (!cancelled) setCities(nextCities)
      })
      .finally(() => {
        if (!cancelled) setLoadingCities(false)
      })

    return () => {
      cancelled = true
    }
  }, [initialProvinceId])

  function set(field: keyof EditFormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleProvinceChange(provinceId: string) {
    setForm((prev) => ({ ...prev, province_id: provinceId, city_id: '', city: '' }))
    setCities([])
    if (!provinceId) {
      setLoadingCities(false)
      return
    }

    setLoadingCities(true)
    getCitiesForSelect(parseInt(provinceId, 10))
      .then(setCities)
      .finally(() => setLoadingCities(false))
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
          {saving ? 'Menyimpan...' : submitLabel}
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
  onOperatorCountChange,
  roleFilter,
}: {
  tenant: TenantRow
  users: TenantUserRow[]
  onUsersChange: () => void
  onOperatorCountChange?: (count: number) => void
  roleFilter?: 'manager' | 'operator'
}) {
  const { showToast } = useToast()
  const [pending, startTransition] = useTransition()
  const [importPending, startImportTransition] = useTransition()
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null)
  const [newRole, setNewRole] = useState<'manager' | 'operator'>(roleFilter ?? 'operator')
  const [detachTarget, setDetachTarget] = useState<TenantUserRow | null>(null)
  const detachDialogRef = useRef<HTMLDialogElement>(null)
  const importDialogRef = useRef<HTMLDialogElement>(null)
  const [importText, setImportText] = useState('')
  const [importPreview, setImportPreview] = useState<TenantOperatorImportPreview | TenantOperatorImportResult | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importAction, setImportAction] = useState<'preview' | 'import' | null>(null)

  // Local copy — updated optimistically on role change, synced from prop on attach/detach
  const [localUsers, setLocalUsers] = useState<TenantUserRow[]>(users)
  useEffect(() => { setLocalUsers(users) }, [users])

  const [search, setSearch] = useState('')

  const baseUsers = roleFilter ? localUsers.filter((u) => u.role === roleFilter) : localUsers
  const displayedUsers = search.trim()
    ? baseUsers.filter(
        (u) =>
          u.name.toLowerCase().includes(search.toLowerCase()) ||
          u.email.toLowerCase().includes(search.toLowerCase()) ||
          (u.role ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : baseUsers
  const roleLabel = roleFilter === 'manager' ? 'Manager' : roleFilter === 'operator' ? 'Operator' : 'User'

  function openDetach(u: TenantUserRow) {
    setDetachTarget(u)
    detachDialogRef.current?.showModal()
  }

  function openImportOperators() {
    setImportText('')
    setImportPreview(null)
    setImportError(null)
    setImportAction(null)
    importDialogRef.current?.showModal()
  }

  function handleImportTextChange(value: string) {
    setImportText(value)
    setImportPreview(null)
    setImportError(null)
  }

  function handleImportPreview() {
    setImportError(null)
    setImportAction('preview')
    startImportTransition(async () => {
      try {
        const preview = await previewTenantOperatorImportFromText(tenant.id, importText)
        setImportPreview(preview)
        onOperatorCountChange?.(preview.operatorTotalRows)
        if (preview.totalRows === 0) setImportError('Tidak ada nomor HP yang bisa diproses.')
      } catch (e) {
        setImportError((e as Error).message)
      } finally {
        setImportAction(null)
      }
    })
  }

  function handleImportOperators() {
    setImportError(null)
    setImportAction('import')
    startImportTransition(async () => {
      try {
        const result = await importTenantOperatorsFromText(tenant.id, importText)
        setImportPreview(result)
        onOperatorCountChange?.(result.operatorTotalRows)
        showToast(
          result.createdRows > 0 ? 'success' : 'warning',
          'Import Operator Selesai',
          `${result.createdRows.toLocaleString('id-ID')} operator ditambahkan, ${result.skippedRows.toLocaleString('id-ID')} dilewati. Total operator sekarang ${result.operatorTotalRows.toLocaleString('id-ID')}.`
        )
        if (result.createdRows > 0) {
          importDialogRef.current?.close()
          onUsersChange()
        }
      } catch (e) {
        setImportError((e as Error).message)
      } finally {
        setImportAction(null)
      }
    })
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
    const role = roleFilter ?? newRole
    startTransition(async () => {
      try {
        await attachTenantUser(tenant.id, selectedUser.id, role)
        showToast('success', 'User Ditambahkan', `${selectedUser.name} berhasil ditambahkan sebagai ${role}.`)
        setSelectedUser(null)
        onUsersChange()
      } catch (e) {
        showToast('error', 'Gagal', (e as Error).message)
      }
    })
  }

  function handleRoleChange(tu: TenantUserRow, role: 'manager' | 'operator') {
    // Optimistic update — update local state immediately, revert on error
    const prev = localUsers
    setLocalUsers((cur) => cur.map((u) => u.tenant_user_id === tu.tenant_user_id ? { ...u, role } : u))
    startTransition(async () => {
      try {
        await updateTenantUserRole(tu.tenant_user_id, role)
        showToast('success', 'Role Diubah', `Role ${tu.name} diubah menjadi ${role}.`)
      } catch (e) {
        setLocalUsers(prev) // revert on failure
        showToast('error', 'Gagal', (e as Error).message)
      }
    })
  }

  return (
    <div className="space-y-5">
      {/* ── Add user (top) ── */}
      <div className="space-y-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-800/50">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
            Tambah {roleLabel}
          </p>
          {roleFilter === 'operator' && (
            <button
              type="button"
              onClick={openImportOperators}
              disabled={pending || importPending}
              className="inline-flex items-center gap-1 rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v12m0-12l4 4m-4-4L8 7M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3" />
              </svg>
              Import
            </button>
          )}
        </div>
        {selectedUser ? (
          <div className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-3 py-2.5 dark:border-neutral-700 dark:bg-neutral-900">
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
          {!roleFilter && (
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
          )}
          <div className={roleFilter ? 'w-full' : 'pt-5'}>
            <button
              type="button"
              disabled={!selectedUser || pending}
              onClick={handleAttach}
              className="w-full rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
            >
              {pending ? 'Memproses...' : `Tambah sebagai ${roleLabel}`}
            </button>
          </div>
        </div>
      </div>

      {/* ── User list ── */}
      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
            {roleLabel} Terdaftar ({baseUsers.length})
          </p>
          {baseUsers.length > 0 && (
            <div className="relative">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama, email, role..."
                className="rounded-lg border border-neutral-300 bg-white py-1.5 pl-3 pr-8 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:focus:ring-white"
              />
              <svg className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z" />
              </svg>
            </div>
          )}
        </div>

        {baseUsers.length === 0 ? (
          <p className="py-4 text-center text-sm text-neutral-400 dark:text-neutral-500">
            Belum ada {roleLabel.toLowerCase()} di tenant ini.
          </p>
        ) : displayedUsers.length === 0 ? (
          <p className="py-4 text-center text-sm text-neutral-400 dark:text-neutral-500">
            Tidak ada hasil untuk &quot;{search}&quot;.
          </p>
        ) : (
          <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
            {displayedUsers.map((u) => (
              <div key={u.tenant_user_id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-neutral-900 dark:text-white">{u.name}</p>
                  <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">{u.email}</p>
                </div>
                {/* Role select */}
                {!roleFilter && (
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
                )}
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

      {/* Operator import dialog (nested) */}
      <dialog
        ref={importDialogRef}
        className="fixed top-1/2 left-1/2 m-0 w-[calc(100vw-2rem)] max-w-4xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-neutral-200 bg-white p-0 shadow-xl backdrop:bg-black/60 dark:border-neutral-700 dark:bg-neutral-900"
      >
        <div className="flex items-start justify-between gap-4 border-b border-neutral-200 px-5 py-4 dark:border-neutral-700">
          <div>
            <h3 className="text-base font-semibold text-neutral-900 dark:text-white">Import Operator</h3>
            <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">{tenant.name}</p>
          </div>
          <button
            type="button"
            onClick={() => importDialogRef.current?.close()}
            className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="max-h-[76vh] space-y-4 overflow-y-auto p-5">
          {importError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
              {importError}
            </div>
          )}

          <div>
            <Label>Nomor HP operator</Label>
            <textarea
              value={importText}
              onChange={(e) => handleImportTextChange(e.target.value)}
              rows={9}
              placeholder={`085645215121\n087711060007\n082233159002`}
              className={`${inputCls()} font-mono text-xs leading-5`}
            />
          </div>

          {importPreview && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <OperatorImportSummary label="Baris" value={importPreview.totalRows} />
                <OperatorImportSummary label="Siap Import" value={importPreview.validRows} />
                <OperatorImportSummary label="Tidak Ada" value={importPreview.notFoundRows} />
                <OperatorImportSummary label="Dilewati" value={importPreview.totalRows - importPreview.validRows} />
                <OperatorImportSummary label="Operator Saat Ini" value={importPreview.operatorTotalRows} />
              </div>
              <OperatorImportPreviewTable rows={importPreview.rows} />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-neutral-200 px-5 py-4 sm:flex-row sm:justify-end dark:border-neutral-700">
          <button
            type="button"
            onClick={() => importDialogRef.current?.close()}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleImportPreview}
            disabled={importPending || !importText.trim()}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            {importAction === 'preview' ? 'Memeriksa...' : 'Preview'}
          </button>
          <button
            type="button"
            onClick={handleImportOperators}
            disabled={importPending || !importPreview || importPreview.validRows === 0}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
          >
            {importAction === 'import' ? 'Mengimport...' : 'Import Valid Operators'}
          </button>
        </div>
      </dialog>

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

export default function TenantsTable({ tenants, provinces, sortBy, sortDir, searchParams, isLoading = false }: Props) {
  const { showToast } = useToast()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [sorting, startSortTransition] = useTransition()
  const [localTenants, setLocalTenants] = useState<TenantRow[]>(tenants)
  useEffect(() => { setLocalTenants(tenants) }, [tenants])

  function handleSort(col: string) {
    const href = buildHref(searchParams, col, sortBy, sortDir)
    startSortTransition(() => { router.push(href, { scroll: false }) })
  }

  // ── Create dialog ──
  const createDialogRef = useRef<HTMLDialogElement>(null)
  const [createFormKey, setCreateFormKey] = useState(0)

  function openCreate() {
    setCreateFormKey((key) => key + 1)
    createDialogRef.current?.showModal()
  }

  function handleCreate(form: EditFormState) {
    startTransition(async () => {
      try {
        await createTenant(buildTenantFormData(form))
        showToast('success', 'Tenant Dibuat', `${form.name} berhasil ditambahkan.`)
        createDialogRef.current?.close()
        router.refresh()
      } catch (e) {
        showToast('error', 'Gagal Membuat', (e as Error).message)
      }
    })
  }

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
        await updateTenant(editTarget.id, buildTenantFormData(form))
        showToast('success', 'Tenant Diperbarui', `Data ${editTarget.name} berhasil disimpan.`)
        editDialogRef.current?.close()
        setEditTarget(null)
        router.refresh()
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
  const [filterRole, setFilterRole] = useState<'manager' | 'operator' | null>(null)

  function openUsers(tenant: TenantRow, role: 'manager' | 'operator' | null = null) {
    setUsersTenant(tenant)
    setFilterRole(role)
    loadUsers(tenant.id)
    usersDialogRef.current?.showModal()
  }

  function loadUsers(tenantId: string) {
    setLoadingUsers(true)
    getTenantUsers(tenantId)
      .then((users) => {
        setTenantUsers(users)
        const managerCount  = users.filter((u) => u.role === 'manager').length
        const operatorCount = users.filter((u) => u.role === 'operator').length
        setLocalTenants((prev) =>
          prev.map((t) =>
            t.id === tenantId
              ? { ...t, manager_count: managerCount, operator_count: operatorCount }
              : t
          )
        )
      })
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
      <div className="flex justify-end">
        <button
          type="button"
          disabled={pending}
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Tenant
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 dark:border-neutral-800">
              {/* Sortable columns */}
              {[
                { label: 'Nama',     col: 'name'           },
                { label: 'Domain',   col: 'domain'         },
                { label: 'Kota',     col: 'city'           },
                { label: 'Manager',  col: 'manager_count'  },
                { label: 'Operator', col: 'operator_count' },
              ].map(({ label, col }) => (
                <th key={col} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                  <button
                    type="button"
                    onClick={() => handleSort(col)}
                    disabled={sorting}
                    className="inline-flex items-center gap-0.5 hover:text-neutral-900 dark:hover:text-white transition-colors disabled:opacity-60"
                  >
                    {label}
                    <SortIcon active={sortBy === col} dir={sortDir} />
                  </button>
                </th>
              ))}
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                Aksi
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading && Array.from({ length: 6 }).map((_, index) => (
              <tr key={`tenants-skeleton-${index}`} className="border-b border-neutral-100 last:border-0 dark:border-neutral-800/60">
                <td className="px-4 py-3">
                  <div className="h-4 w-36 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
                </td>
                <td className="px-4 py-3">
                  <div className="h-4 w-28 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
                </td>
                <td className="px-4 py-3">
                  <div className="h-4 w-40 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
                </td>
                <td className="px-4 py-3">
                  <div className="h-5 w-10 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-700" />
                </td>
                <td className="px-4 py-3">
                  <div className="h-5 w-10 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-700" />
                </td>
                <td className="px-4 py-3">
                  <div className="h-7 w-24 animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-700" />
                </td>
              </tr>
            ))}

            {!isLoading && localTenants.map((t) => {
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
                    <button
                      type="button"
                      onClick={() => openUsers(t, 'manager')}
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer ${
                        t.manager_count > 0
                          ? 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:hover:bg-blue-900/70'
                          : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-500 dark:hover:bg-neutral-700'
                      }`}
                    >
                      {t.manager_count}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => openUsers(t, 'operator')}
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-emerald-400 cursor-pointer ${
                        t.operator_count > 0
                          ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:hover:bg-emerald-900/70'
                          : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-500 dark:hover:bg-neutral-700'
                      }`}
                    >
                      {t.operator_count}
                    </button>
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

            {!isLoading && localTenants.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-neutral-400 dark:text-neutral-500">
                  Tidak ada tenant.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Create Dialog ── */}
      <dialog
        ref={createDialogRef}
        className="fixed top-1/2 left-1/2 m-0 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl backdrop:bg-black/40 dark:border-neutral-700 dark:bg-neutral-900"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-neutral-900 dark:text-white">Create Tenant</h2>
            <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
              Buat tenant baru beserta alamat untuk mapping kota.
            </p>
          </div>
          <button
            type="button"
            onClick={() => createDialogRef.current?.close()}
            className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <TenantInfoPanel
          key={createFormKey}
          detail={buildEmptyTenantDetail()}
          provinces={provinces}
          onSave={handleCreate}
          onCancel={() => createDialogRef.current?.close()}
          saving={pending}
          submitLabel="Create Tenant"
        />
      </dialog>

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
          <TenantInfoPanel
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
            <h2 className="text-base font-semibold text-neutral-900 dark:text-white">
              {filterRole === 'manager' ? 'Kelola Manager' : filterRole === 'operator' ? 'Kelola Operator' : 'Kelola User'}
            </h2>
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
            onOperatorCountChange={(operatorCount) => {
              setLocalTenants((prev) =>
                prev.map((t) =>
                  t.id === usersTenant.id ? { ...t, operator_count: operatorCount } : t
                )
              )
            }}
            roleFilter={filterRole ?? undefined}
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
