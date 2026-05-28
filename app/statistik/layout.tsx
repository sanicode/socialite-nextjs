import { JetBrains_Mono, Plus_Jakarta_Sans } from 'next/font/google'

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: '--font-statistik-sans',
  subsets: ['latin'],
})

const jetBrainsMono = JetBrains_Mono({
  variable: '--font-statistik-mono',
  subsets: ['latin'],
})

export default function StatistikLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${plusJakartaSans.variable} ${jetBrainsMono.variable}`}>
      {children}
    </div>
  )
}
