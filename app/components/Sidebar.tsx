'use client'

import Link from 'next/link'
import { useLinkStatus } from 'next/link'
import { usePathname } from 'next/navigation'

// ... (navItems, settingsItems, dan LinkPendingHint tetap sama)
// 1. Pastikan navItems didefinisikan di sini (di luar fungsi Sidebar)
const navItems = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: (
      <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
  },
]

// 2. Definisikan settingsItems (Menu Pengaturan)
const settingsItems = [
  {
    label: 'Tenants',
    href: '/settings/tenants',
    icon: (
      <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    label: 'Users',
    href: '/settings/users',
    icon: (
      <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    label: 'Security',
    href: '/settings/security',
    icon: (
      <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 3l7 4v5c0 5-3.5 8.5-7 9-3.5-.5-7-4-7-9V7l7-4z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9.5 12.5l1.5 1.5 3.5-4" />
      </svg>
    ),
  },
  {
    label: 'Logs',
    href: '/settings/logs',
    icon: (
      <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12h6m-6 4h6m-6-8h6m2 11H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
]

type Props = {
  open: boolean
  onClose: () => void
  appName: string
  showDashboard: boolean
  showSettings: boolean
  showOperators: boolean
  showLaporanPerOperator: boolean
  showLaporanSemua: boolean
  showLaporanUpload: boolean
  showLaporanAmplifikasi: boolean
  user: {
    name: string;
    email: string;
    role: string | {
        name: string;
    }; // Penting untuk pengecekan di Sidebar
    tenants: { pivot: { roles: (string | { name: string })[] } }[] | null;
  } | null; // Tambahkan prop user
}

function LinkPendingHint() {
  const { pending } = useLinkStatus()
  return (
    <span aria-hidden="true" className={`ml-auto h-2 w-2 rounded-full bg-current transition-opacity duration-150 ${pending ? 'opacity-80 animate-pulse' : 'opacity-0'}`} />
  )
}

export default function Sidebar({ open, onClose, appName, showDashboard, showSettings, showOperators, showLaporanPerOperator, showLaporanSemua, showLaporanUpload, showLaporanAmplifikasi, user }: Props) {
  const pathname = usePathname()

  // Filter dashboard item
  const dashboardItem = navItems.find(item => item.href === '/dashboard')
  const showDashboardLink = showDashboard && dashboardItem

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={onClose} aria-hidden="true" />
      )}

      <aside className={[
        'fixed inset-y-0 left-0 z-40 flex flex-col w-64 bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 transition-transform duration-200 ease-in-out',
        open ? 'translate-x-0' : '-translate-x-full',
        'md:static md:translate-x-0 md:w-60 md:flex md:flex-shrink-0',
      ].join(' ')}>
        
        {/* Brand */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-neutral-200 dark:border-neutral-800 flex-shrink-0">
          <span className="text-base font-bold text-neutral-900 dark:text-white tracking-tight">{appName}</span>
          <button onClick={onClose} className="p-1.5 rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition md:hidden">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          
          {/* Dashboard Section */}
          {showDashboardLink && (
            <Link
              href={dashboardItem.href}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                pathname === '/dashboard'
                  ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900'
                  : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              {dashboardItem.icon}
              {dashboardItem.label}
              <LinkPendingHint />
            </Link>
          )}


          {/* Laporan Group */}
          {/* {(isAdmin || isManager) && ( */}
          <div className="space-y-1">
            <div className="px-3 pt-4 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400 dark:text-neutral-500">
              Laporan
            </div>
            
            {showLaporanSemua && (
              <Link
                href="/posts"
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  pathname === '/posts' ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900' : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
              >
                <div className="w-5 flex justify-center"><div className={`w-1.5 h-1.5 rounded-full ${pathname === '/posts' ? 'bg-current' : 'bg-neutral-400'}`} /></div>
                Semua <LinkPendingHint />
              </Link>
            )}

            {/* Hanya tampil jika showLaporanPerOperator bernilai true */}
            {showLaporanPerOperator && (
              <Link
                href="/posts/users"
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  pathname.startsWith('/posts/users') ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900' : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
              >
                <div className="w-5 flex justify-center"><div className={`w-1.5 h-1.5 rounded-full ${pathname.startsWith('/posts/users') ? 'bg-current' : 'bg-neutral-400'}`} /></div>
                Per Operator <LinkPendingHint />
              </Link>
            )}

            {showLaporanUpload && (
              <Link
                href="/posts/upload"
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  pathname.startsWith('/posts/upload') ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900' : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
              >
                <div className="w-5 flex justify-center"><div className={`w-1.5 h-1.5 rounded-full ${pathname.startsWith('/posts/upload') ? 'bg-current' : 'bg-neutral-400'}`} /></div>
                Upload <LinkPendingHint />
              </Link>
            )}

            {showLaporanAmplifikasi && (
              <Link
                href="/posts/amplifikasi"
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  pathname.startsWith('/posts/amplifikasi') ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900' : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
            >
              <div className="w-5 flex justify-center"><div className={`w-1.5 h-1.5 rounded-full ${pathname.startsWith('/posts/amplifikasi') ? 'bg-current' : 'bg-neutral-400'}`} /></div>
              Amplifikasi <LinkPendingHint />
            </Link>
            )}
          </div>
          {/* )} */}

          {/* Settings Section */}
          {showSettings && (
            <>
              <div className="px-3 pt-6 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-400 dark:text-neutral-500">
                Settings
              </div>
              {settingsItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                    pathname.startsWith(item.href)
                      ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900'
                      : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  {item.icon}
                  {item.label}
                  <LinkPendingHint />
                </Link>
              ))}
            </>
          )}
          
          {/* Operator Section */}
          {showOperators && (
            <Link
              href="/operators"
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition mt-4 ${
                pathname.startsWith('/operators')
                  ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900'
                  : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Operator
              <LinkPendingHint />
            </Link>
          )}          
        </nav>
      </aside>
    </>
  )
}