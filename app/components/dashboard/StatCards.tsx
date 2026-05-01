'use client'

import { useEffect, useMemo, useState } from 'react'
import type { OperatorReportRow, OperatorReportSummary } from '@/app/actions/dashboard'
import { getPageSlice, TABLE_PAGE_SIZE_OPTIONS, type TablePageSize } from '@/app/lib/table-pagination'

type Props = {
  summary: OperatorReportSummary
}

type DialogState =
  | { title: string; rows: OperatorReportRow[] }
  | null

function PeopleIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  )
}

function ReportedIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M9 12.75 11.25 15 15 9.75" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  )
}

function MissingIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m0 3.75h.008v.008H12v-.008zM10.29 3.86 1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
  )
}

function StatusBadge({ missing, label, count }: { missing: boolean; label: string; count: number }) {
  if (missing) {
    return (
      <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900/60">
        Belum {label}
      </span>
    )
  }

  return (
    <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-green-200 dark:bg-green-950/40 dark:text-green-300 dark:ring-green-900/60">
      {count.toLocaleString('id-ID')} laporan
    </span>
  )
}

function OperatorDialog({ dialog, onClose }: { dialog: DialogState; onClose: () => void }) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<TablePageSize>(10)

  const filteredRows = useMemo(() => {
    if (!dialog) return []
    const q = search.trim().toLowerCase()
    if (!q) return dialog.rows

    return dialog.rows.filter((row) => {
      const value = [
        row.name,
        row.email,
        row.phoneNumber,
        row.province,
        row.city,
        row.missingUpload ? 'belum upload' : 'sudah upload',
        row.missingAmplifikasi ? 'belum amplifikasi' : 'sudah amplifikasi',
      ].filter(Boolean).join(' ').toLowerCase()
      return value.includes(q)
    })
  }, [dialog, search])

  const { totalPages, start, end } = getPageSlice(page, pageSize, filteredRows.length)
  const currentPage = Math.min(page, totalPages)
  const pageRows = pageSize === 'all'
    ? filteredRows
    : filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch('')
      setPage(1)
      setPageSize(10)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [dialog])

  useEffect(() => {
    const timer = window.setTimeout(() => setPage(1), 0)
    return () => window.clearTimeout(timer)
  }, [search, pageSize])

  if (!dialog) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4 dark:border-neutral-800">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">{dialog.title}</h3>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              {dialog.rows.length.toLocaleString('id-ID')} operator pada filter aktif.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-600 transition hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            Tutup
          </button>
        </div>

        <div className="flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
            <select
              value={String(pageSize)}
              onChange={(event) => setPageSize(event.target.value === 'all' ? 'all' : Number(event.target.value))}
              className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 transition focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:focus:ring-white"
            >
              {TABLE_PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>{option === 'all' ? 'All' : option}</option>
              ))}
            </select>
            <span>entri per halaman</span>
          </label>
          <input
            type="search"
            placeholder="Cari..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition focus:outline-none focus:ring-2 focus:ring-neutral-900 sm:max-w-xs dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:focus:ring-white"
          />
        </div>

        <div className="max-h-[56vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-800">
                <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-400">Operator</th>
                <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-400">Kontak</th>
                <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-400">Provinsi</th>
                <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-400">Kota</th>
                <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-400">Upload</th>
                <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-400">Amplifikasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-neutral-500 dark:text-neutral-400">
                    Tidak ada data yang cocok.
                  </td>
                </tr>
              )}
              {pageRows.map((row) => (
                <tr key={row.tenantUserId} className="bg-white transition hover:bg-neutral-50 dark:bg-neutral-900 dark:hover:bg-neutral-800/50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-neutral-900 dark:text-white">{row.name}</div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400">{row.email}</div>
                  </td>
                  <td className="px-4 py-3 text-neutral-700 dark:text-neutral-300">{row.phoneNumber || '-'}</td>
                  <td className="px-4 py-3 text-neutral-700 dark:text-neutral-300">{row.province || '-'}</td>
                  <td className="px-4 py-3 text-neutral-700 dark:text-neutral-300">{row.city || '-'}</td>
                  <td className="px-4 py-3"><StatusBadge missing={row.missingUpload} label="upload" count={row.uploadCount} /></td>
                  <td className="px-4 py-3"><StatusBadge missing={row.missingAmplifikasi} label="amplifikasi" count={row.amplifikasiCount} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col items-start gap-3 border-t border-neutral-200 px-5 py-3 dark:border-neutral-800 sm:flex-row sm:flex-wrap sm:items-center">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {filteredRows.length > 0
              ? `${start}-${end} dari ${filteredRows.length.toLocaleString('id-ID')} entri`
              : '0 entri'}
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(1)} disabled={currentPage === 1} className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs text-neutral-600 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800">First</button>
              <button onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage === 1} className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs text-neutral-600 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800">Prev</button>
              <span className="min-w-[4.5rem] text-center text-xs text-neutral-500 dark:text-neutral-400">Hal. {currentPage} / {totalPages}</span>
              <button onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={currentPage === totalPages} className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs text-neutral-600 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800">Next</button>
              <button onClick={() => setPage(totalPages)} disabled={currentPage === totalPages} className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs text-neutral-600 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800">Last</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function StatCards({ summary }: Props) {
  const [dialog, setDialog] = useState<DialogState>(null)
  const cards = [
    {
      label: 'Total Operator',
      value: summary.totalOperators,
      icon: <PeopleIcon />,
      iconClassName: 'rounded-xl bg-sky-50 text-sky-700 ring-1 ring-sky-100 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-900/60',
      valueClassName: 'text-sky-700 dark:text-sky-300',
      className: 'border-sky-100 dark:border-sky-900/50',
    },
    {
      label: 'Sudah Lapor',
      value: summary.reportedOperators,
      icon: <ReportedIcon />,
      iconClassName: 'rounded-full bg-green-50 text-green-700 ring-1 ring-green-100 dark:bg-green-950/40 dark:text-green-300 dark:ring-green-900/60',
      valueClassName: 'text-green-700 dark:text-green-300',
      className: 'cursor-pointer border-green-100 hover:border-green-300 hover:bg-green-50/60 dark:border-green-900/50 dark:hover:border-green-800 dark:hover:bg-green-950/20',
      onClick: () => setDialog({ title: 'Operator Sudah Lapor', rows: summary.reportedRows }),
    },
    {
      label: 'Belum Lapor',
      value: summary.missingOperators,
      icon: <MissingIcon />,
      iconClassName: 'rounded-lg bg-red-50 text-red-700 ring-1 ring-red-100 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900/60',
      valueClassName: 'text-red-700 dark:text-red-300',
      className: 'cursor-pointer border-red-100 hover:border-red-300 hover:bg-red-50/60 dark:border-red-900/50 dark:hover:border-red-800 dark:hover:bg-red-950/20',
      onClick: () => setDialog({ title: 'Operator Belum Lapor', rows: summary.missingRows }),
    },
  ]

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map((card) => {
          const content = (
            <>
              <div className={`p-3 ${card.iconClassName}`}>
                {card.icon}
              </div>
              <div>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">{card.label}</p>
                <p className={`mt-0.5 text-2xl font-bold ${card.valueClassName}`}>
                  {card.value.toLocaleString('id-ID')}
                </p>
              </div>
            </>
          )

          if (card.onClick) {
            return (
              <button
                key={card.label}
                type="button"
                onClick={card.onClick}
                className={`flex items-center gap-4 rounded-xl border bg-white p-5 text-left transition dark:bg-neutral-900 ${card.className}`}
              >
                {content}
              </button>
            )
          }

          return (
            <div
              key={card.label}
              className={`flex items-center gap-4 rounded-xl border bg-white p-5 dark:bg-neutral-900 ${card.className}`}
            >
              {content}
            </div>
          )
        })}
      </div>

      <OperatorDialog dialog={dialog} onClose={() => setDialog(null)} />
    </>
  )
}
