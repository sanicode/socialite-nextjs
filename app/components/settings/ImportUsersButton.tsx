'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  importUsersBulkFromText,
  previewUsersBulkImportFromText,
  type BulkUserImportPreview,
  type BulkUserImportRow,
  type BulkUserImportStatus,
} from '@/app/actions/users'
import { useToast } from '@/app/components/ToastContext'

type Tab = 'text' | 'excel'
type PendingAction = 'preview' | 'import' | null

const sampleText = `Moch Arifin\t085645215121
Dewi Kurniasari\t087711060007
Sasikirana P.A\t082233159002`

const tabCls =
  'inline-flex flex-1 items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white'

const inputCls =
  'w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:focus:ring-white'

function getStatusLabel(status: BulkUserImportStatus) {
  switch (status) {
    case 'valid':
      return 'Valid'
    case 'duplicate_existing':
      return 'Sudah ada'
    case 'duplicate_input':
      return 'Duplikat'
    case 'invalid':
      return 'Invalid'
  }
}

function getStatusClass(status: BulkUserImportStatus) {
  switch (status) {
    case 'valid':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
    case 'duplicate_existing':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400'
    case 'duplicate_input':
      return 'bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400'
    case 'invalid':
      return 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400'
  }
}

function SummaryItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900">
      <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className="mt-0.5 text-lg font-semibold text-neutral-900 dark:text-white">{value.toLocaleString('id-ID')}</p>
    </div>
  )
}

function PreviewTable({ rows }: { rows: BulkUserImportRow[] }) {
  return (
    <div className="max-h-72 overflow-auto rounded-xl border border-neutral-200 dark:border-neutral-700">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="sticky top-0 bg-neutral-50 dark:bg-neutral-800">
          <tr className="border-b border-neutral-200 dark:border-neutral-700">
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Baris</th>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Nama</th>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">No HP</th>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Email</th>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Status</th>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Catatan</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.line}-${row.email || row.name}`} className="border-b border-neutral-100 last:border-0 dark:border-neutral-800">
              <td className="px-3 py-2 text-xs text-neutral-500 dark:text-neutral-400">{row.line}</td>
              <td className="px-3 py-2 font-medium text-neutral-900 dark:text-white">{row.name || '-'}</td>
              <td className="px-3 py-2 text-neutral-600 dark:text-neutral-300">{row.phone_number || '-'}</td>
              <td className="px-3 py-2 text-neutral-600 dark:text-neutral-300">{row.email || '-'}</td>
              <td className="px-3 py-2">
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getStatusClass(row.status)}`}>
                  {getStatusLabel(row.status)}
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

function ImportUsersDialog({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const router = useRouter()
  const { showToast } = useToast()
  const [pending, startTransition] = useTransition()
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [tab, setTab] = useState<Tab>('text')
  const [rawText, setRawText] = useState('')
  const [preview, setPreview] = useState<BulkUserImportPreview | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  const canImport = tab === 'text' && preview !== null && preview.validRows > 0 && !pending

  function handleTextChange(value: string) {
    setRawText(value)
    setPreview(null)
    setError(null)
  }

  function handlePreview() {
    setError(null)
    setPendingAction('preview')
    startTransition(async () => {
      try {
        const nextPreview = await previewUsersBulkImportFromText(rawText)
        setPreview(nextPreview)
        if (nextPreview.totalRows === 0) {
          setError('Tidak ada baris yang bisa diproses.')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Preview gagal.')
      } finally {
        setPendingAction(null)
      }
    })
  }

  function handleImport() {
    setError(null)
    setPendingAction('import')
    startTransition(async () => {
      try {
        const result = await importUsersBulkFromText(rawText)
        setPreview(result)
        router.refresh()
        showToast(
          result.createdRows > 0 ? 'success' : 'warning',
          'Import selesai',
          `${result.createdRows.toLocaleString('id-ID')} user dibuat, ${result.skippedRows.toLocaleString('id-ID')} dilewati.`
        )
        if (result.createdRows > 0) onClose()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Import gagal.')
      } finally {
        setPendingAction(null)
      }
    })
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="fixed top-1/2 left-1/2 m-0 w-[calc(100vw-2rem)] max-w-4xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-neutral-200 bg-white p-0 shadow-xl backdrop:bg-black/40 dark:border-neutral-700 dark:bg-neutral-900"
    >
      <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4 dark:border-neutral-700">
        <div>
          <h2 className="text-base font-semibold text-neutral-900 dark:text-white">Import Users</h2>
          <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">Tambah banyak user sekaligus.</p>
        </div>
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

      <div className="max-h-[76vh] overflow-y-auto p-5">
        <div className="mb-5 flex rounded-xl bg-neutral-100 p-1 dark:bg-neutral-800">
          <button
            type="button"
            onClick={() => setTab('text')}
            className={`${tabCls} ${
              tab === 'text'
                ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-950 dark:text-white'
                : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
            }`}
          >
            Text
          </button>
          <button
            type="button"
            onClick={() => setTab('excel')}
            className={`${tabCls} ${
              tab === 'excel'
                ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-950 dark:text-white'
                : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
            }`}
          >
            Upload Excel
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        {tab === 'text' && (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">Data user</label>
              <textarea
                value={rawText}
                onChange={(e) => handleTextChange(e.target.value)}
                placeholder={sampleText}
                rows={9}
                className={`${inputCls} font-mono text-xs leading-5`}
              />
            </div>

            {preview && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  <SummaryItem label="Total" value={preview.totalRows} />
                  <SummaryItem label="Valid" value={preview.validRows} />
                  <SummaryItem label="Sudah Ada" value={preview.duplicateExistingRows} />
                  <SummaryItem label="Duplikat" value={preview.duplicateInputRows} />
                  <SummaryItem label="Invalid" value={preview.invalidRows} />
                </div>
                <PreviewTable rows={preview.rows} />
              </div>
            )}
          </div>
        )}

        {tab === 'excel' && (
          <div className="space-y-4 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-6 dark:border-neutral-700 dark:bg-neutral-800/40">
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-white text-neutral-400 dark:bg-neutral-900 dark:text-neutral-500">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 16V4m0 0l-4 4m4-4l4 4M4 16.5V18a2 2 0 002 2h12a2 2 0 002-2v-1.5" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Upload Excel belum aktif</h3>
              <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Gunakan tab Text untuk import saat ini.</p>
            </div>
            <input type="file" accept=".xlsx,.xls,.csv" disabled className={inputCls} />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-neutral-200 px-5 py-4 sm:flex-row sm:justify-end dark:border-neutral-700">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          Batal
        </button>
        {tab === 'text' && (
          <>
            <button
              type="button"
              onClick={handlePreview}
              disabled={pending || !rawText.trim()}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              {pendingAction === 'preview' ? 'Memeriksa...' : 'Preview'}
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={!canImport}
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
            >
              {pendingAction === 'import' ? 'Mengimport...' : 'Import Valid Users'}
            </button>
          </>
        )}
      </div>
    </dialog>
  )
}

export default function ImportUsersButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {open && <ImportUsersDialog onClose={() => setOpen(false)} />}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v12m0-12l4 4m-4-4L8 7M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3" />
        </svg>
        Import
      </button>
    </>
  )
}
