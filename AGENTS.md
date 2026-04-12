<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

# Authentication & Authorization — mandatory rules

Every server action (`'use server'`) and every page (`page.tsx`) MUST enforce auth. No exceptions, including read-only actions.

## Required pattern for every server action

```ts
// Minimum for any authenticated user:
const user = await requireUser()

// For admin-only features (settings, logs, security, user management, etc.):
const admin = await requireAdmin()

// For manager or admin:
const user = await requireManagerOrAdmin()
```

All three helpers live in `@/app/lib/authorization`. They throw on failure — do not manually redirect inside actions.

## Required pattern for every page

```ts
const user = await getSessionUser()        // from @/app/lib/session
if (!user) redirect('/login')
if (!user.roles.includes('admin')) redirect('/posts')  // adjust role as needed
```

## Rules

1. **Every exported function in a `'use server'` file must call one of the `require*` helpers as its first statement** — even read-only functions that only query data. Page-level guards do NOT protect actions; actions are callable as HTTP endpoints independent of the page.
2. **Never assume the caller is trusted.** Server actions are POST endpoints exposed to the internet. Treat them like API routes.
3. **Match the strictest role the feature needs.** Settings, logs, security, and user management require `requireAdmin()`. General authenticated features use `requireUser()`.
4. **Do not add a custom session check** — always use the helpers from `@/app/lib/authorization`. They already handle security policy, session validation, and role checks in one call.
<!-- END:nextjs-agent-rules -->
