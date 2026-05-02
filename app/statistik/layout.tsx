export default function StatistikLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){try{var t=localStorage.getItem('statistik-theme');var r=document.documentElement;r.dataset.statistikPreviousTheme=r.classList.contains('dark')?'dark':'light';if(t==='light'){r.classList.remove('dark');r.dataset.statistikTheme='light'}else{r.classList.add('dark');r.dataset.statistikTheme='dark'}}catch(e){}})()`,
        }}
      />
      {children}
    </>
  )
}
