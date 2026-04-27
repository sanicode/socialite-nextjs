import { getSessionUser } from '@/app/lib/session'
import { redirect } from 'next/navigation'

export const metadata = { title: 'API Docs — BmiApps' }

export default async function DocsPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  if (!user.is_admin && !user.roles.includes('admin')) redirect('/posts')

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: sans-serif; }
        #swagger-ui .topbar { display: none; }
      `}</style>

      <link
        rel="stylesheet"
        href="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css"
      />

      <div id="swagger-ui" />

      <script
        dangerouslySetInnerHTML={{
          __html: `
            window.addEventListener('load', function() {
              const script = document.createElement('script');
              script.src = 'https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-bundle.js';
              script.onload = function() {
                SwaggerUIBundle({
                  url: '/api/docs/openapi.json',
                  dom_id: '#swagger-ui',
                  presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
                  layout: 'BaseLayout',
                  deepLinking: true,
                  persistAuthorization: true,
                });
              };
              document.head.appendChild(script);
            });
          `,
        }}
      />
    </>
  )
}
