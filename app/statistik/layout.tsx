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
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){try{var r=document.documentElement;if(!r.dataset.statistikPreviousTheme){r.dataset.statistikPreviousTheme=r.classList.contains('dark')?'dark':'light'}var t=localStorage.getItem('statistik-theme');if(t!=='light'&&t!=='dark'){t='dark';localStorage.setItem('statistik-theme',t)}r.dataset.statistikTheme=t;r.classList.toggle('dark',t==='dark')}catch(e){document.documentElement.classList.add('dark')}})();`,
        }}
      />
      {children}
    </div>
  )
}
