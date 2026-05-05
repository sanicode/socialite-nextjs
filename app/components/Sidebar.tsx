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
  collapsed: boolean
  onClose: () => void
  onToggleCollapsed: () => void
  appName: string
  showSummary: boolean
  showDashboard: boolean
  showSettings: boolean
  showOperators: boolean
  showLaporanPerOperator: boolean
  showLaporanSemua: boolean
  showLaporanUpload: boolean
  showLaporanAmplifikasi: boolean
  showSocialMedias: boolean
}

function LinkPendingHint() {
  const { pending } = useLinkStatus()
  return (
    <span aria-hidden="true" className={`ml-auto h-2 w-2 rounded-full bg-current transition-opacity duration-150 ${pending ? 'opacity-80 animate-pulse' : 'opacity-0'}`} />
  )
}

export default function Sidebar({ open, collapsed, onClose, onToggleCollapsed, appName, showSummary, showDashboard, showSettings, showOperators, showLaporanPerOperator, showLaporanSemua, showLaporanUpload, showLaporanAmplifikasi, showSocialMedias }: Props) {
  const pathname = usePathname()

  // Filter dashboard item
  const dashboardItem = navItems.find(item => item.href === '/dashboard')
  const showDashboardLink = showDashboard && dashboardItem
  const navLinkClass = (active: boolean, extra = '') => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
    collapsed ? 'md:justify-center md:gap-0 md:px-2' : 'md:justify-start'
  } ${
    active
      ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900'
      : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
  } ${extra}`
  const labelClass = collapsed ? 'md:hidden' : ''
  const pendingClass = collapsed ? 'md:hidden' : ''
  const sectionClass = `px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400 dark:text-neutral-500 ${collapsed ? 'md:hidden' : ''}`

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={onClose} aria-hidden="true" />
      )}

      <aside className={[
        'fixed inset-y-0 left-0 z-40 flex flex-col w-64 bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 transition-[transform,width] duration-200 ease-in-out',
        open ? 'translate-x-0' : '-translate-x-full',
        `md:static md:translate-x-0 ${collapsed ? 'md:w-16' : 'md:w-60'} md:flex md:flex-shrink-0`,
      ].join(' ')}>
        
        {/* Brand */}
        <div className={`h-16 flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 flex-shrink-0 ${collapsed ? 'px-3 md:justify-center' : 'px-5'}`}>
          <span className={`text-base font-bold text-neutral-900 dark:text-white tracking-tight ${collapsed ? 'md:hidden' : ''}`}>{appName}</span>
          <button
            onClick={onToggleCollapsed}
            className="hidden rounded-lg p-1.5 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900 md:inline-flex dark:hover:bg-neutral-800 dark:hover:text-white"
            aria-label={collapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}
            title={collapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}
          >
            <svg className={`h-5 w-5 transition-transform ${collapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 6l-6 6 6 6" />
            </svg>
          </button>
          <button onClick={onClose} className="p-1.5 rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition md:hidden">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className={`flex-1 py-4 space-y-1 overflow-y-auto px-3 ${collapsed ? 'md:px-2' : 'md:px-3'}`}>
          
          {/* Dashboard Section */}
          {showDashboardLink && (
            <Link
              href={dashboardItem.href}
              onClick={onClose}
              title={dashboardItem.label}
              className={navLinkClass(pathname === '/dashboard')}
            >
              {dashboardItem.icon}
              <span className={labelClass}>{dashboardItem.label}</span>
              <span className={pendingClass}><LinkPendingHint /></span>
            </Link>
          )}

          {showSummary && (
            <Link
              href="/summary"
              onClick={onClose}
              title="Summary"
              className={navLinkClass(pathname === '/summary')}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 13.5h4l2-7 4 14 2-7h6" />
              </svg>
              <span className={labelClass}>Summary</span>
              <span className={pendingClass}><LinkPendingHint /></span>
            </Link>
          )}


          {/* Laporan Group */}
          {/* {(isAdmin || isManager) && ( */}
          <div className="space-y-1">
            <div className={`${sectionClass} pt-4`}>
              Laporan
            </div>
            
            {showLaporanSemua && (
              <Link
                href="/posts"
                onClick={onClose}
                title="Semua"
                className={navLinkClass(pathname === '/posts')}
              >
                <div className="w-5 flex justify-center"><div className={`w-1.5 h-1.5 rounded-full ${pathname === '/posts' ? 'bg-current' : 'bg-neutral-400'}`} /></div>
                <span className={labelClass}>Semua</span> <span className={pendingClass}><LinkPendingHint /></span>
              </Link>
            )}

            {/* Hanya tampil jika showLaporanPerOperator bernilai true */}
            {showLaporanPerOperator && (
              <Link
                href="/posts/users"
                onClick={onClose}
                title="Per Operator"
                className={navLinkClass(pathname.startsWith('/posts/users'))}
              >
                <div className="w-5 flex justify-center"><div className={`w-1.5 h-1.5 rounded-full ${pathname.startsWith('/posts/users') ? 'bg-current' : 'bg-neutral-400'}`} /></div>
                <span className={labelClass}>Per Operator</span> <span className={pendingClass}><LinkPendingHint /></span>
              </Link>
            )}

            {showLaporanUpload && (
              <Link
                href="/posts/upload"
                onClick={onClose}
                title="Upload"
                className={navLinkClass(pathname.startsWith('/posts/upload'))}
              >
                <div className="w-5 flex justify-center"><div className={`w-1.5 h-1.5 rounded-full ${pathname.startsWith('/posts/upload') ? 'bg-current' : 'bg-neutral-400'}`} /></div>
                <span className={labelClass}>Upload</span> <span className={pendingClass}><LinkPendingHint /></span>
              </Link>
            )}

            {showLaporanAmplifikasi && (
              <Link
                href="/posts/amplifikasi"
                onClick={onClose}
                title="Amplifikasi"
                className={navLinkClass(pathname.startsWith('/posts/amplifikasi'))}
            >
              <div className="w-5 flex justify-center"><div className={`w-1.5 h-1.5 rounded-full ${pathname.startsWith('/posts/amplifikasi') ? 'bg-current' : 'bg-neutral-400'}`} /></div>
              <span className={labelClass}>Amplifikasi</span> <span className={pendingClass}><LinkPendingHint /></span>
            </Link>
            )}
          </div>
          {/* )} */}

          {showSocialMedias && (
            <Link
              href="/social-medias"
              onClick={onClose}
              title="Akun Medsos"
              className={navLinkClass(pathname.startsWith('/social-medias'), 'mt-4')}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13.19 8.688a4.5 4.5 0 010 6.364l-2.122 2.121a4.5 4.5 0 01-6.364-6.364l1.06-1.06m12.728 4.242 1.06-1.06a4.5 4.5 0 00-6.364-6.364l-2.122 2.121a4.5 4.5 0 000 6.364" />
              </svg>
              <span className={labelClass}>Akun Medsos</span>
              <span className={pendingClass}><LinkPendingHint /></span>
            </Link>
          )}

          {/* Settings Section */}
          {showSettings && (
            <>
              <div className={`${sectionClass} pt-6 text-[11px]`}>
                Settings
              </div>
              {settingsItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  title={item.label}
                  className={navLinkClass(pathname.startsWith(item.href))}
                >
                  {item.icon}
                  <span className={labelClass}>{item.label}</span>
                  <span className={pendingClass}><LinkPendingHint /></span>
                </Link>
              ))}
            </>
          )}
          
          {/* Operator Section */}
          {showOperators && (
            <Link
              href="/operators"
              onClick={onClose}
              title="Operator"
              className={navLinkClass(pathname.startsWith('/operators'), 'mt-4')}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span className={labelClass}>Operator</span>
              <span className={pendingClass}><LinkPendingHint /></span>
            </Link>
          )}          
        </nav>
      </aside>
    </>
  )
}
