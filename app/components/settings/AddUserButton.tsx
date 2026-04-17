'use client'

import { useState } from 'react'
import UserFormDialog from './UserFormDialog'

export default function AddUserButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {open && <UserFormDialog mode="create" onClose={() => setOpen(false)} />}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Tambah User
      </button>
    </>
  )
}
