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
          className="inline-flex ui-button-sm gap-2 rounded-xl bg-neutral-900 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Tambah User
      </button>
    </>
  )
}
