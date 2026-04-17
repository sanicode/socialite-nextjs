'use client'

import { useState } from 'react'
import Sidebar from './Sidebar'
import UserMenu from './UserMenu'
import ThemeToggle from './ThemeToggle'
import { ToastProvider } from './ToastContext'
import ToastContainer from './ToastContainer'

type Props = {
  user: { name: string; email: string; role: string; tenantName: string | null }
  appName: string
  showDashboard: boolean
  showSettings: boolean
  showOperators: boolean
  children: React.ReactNode
}

export default function ShellClient({ user, appName, showDashboard, showSettings, showOperators, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <ToastProvider>
    <ToastContainer />
    <div className="flex h-screen bg-[var(--background)] overflow-hidden">
      {/* Sidebar */}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} appName={appName} showDashboard={showDashboard} showSettings={showSettings} showOperators={showOperators} />

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="relative z-20 h-16 flex items-center gap-3 px-4 md:px-6 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex-shrink-0">
          {/* Hamburger menu — mobile only */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-1 rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition md:hidden"
            aria-label="Buka menu"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>

          {/* Brand — mobile only (desktop shows in sidebar) */}
          <span className="font-bold text-neutral-900 dark:text-white text-sm md:hidden">
            {appName}
          </span>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Theme toggle */}
          <ThemeToggle />

          {/* User menu */}
          <UserMenu name={user.name} email={user.email} role={user.role} tenantName={user.tenantName} />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
    </ToastProvider>
  )
}
