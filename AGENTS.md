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

---

<!-- BEGIN:security-standards -->
# Security Standards — platform-agnostic

These rules apply to **all code in this project** regardless of language or framework (Next.js, Python, PHP, etc.). Any AI agent working on this codebase — on any stack — must follow these standards.

---

## 1. Authentication & Authorization

**Every endpoint, action, or handler that reads or writes data must verify the caller's identity and role before doing anything else.**

This is true even for:
- Read-only endpoints (GET, query functions)
- Internal helper functions called from other authenticated code
- Background tasks triggered by authenticated users

### Role hierarchy (most to least privileged)

| Role | Access |
|------|--------|
| `admin` | Full access: settings, logs, user management, security, all features |
| `manager` | Business features: posts/reports, dashboard |
| Authenticated user | Own data only |
| Unauthenticated | Login page only — redirect everything else |

### Implementation checklist per platform

**Next.js (this project)**
```ts
// In every 'use server' action — first line:
const admin = await requireAdmin()   // or requireUser() / requireManagerOrAdmin()

// In every page.tsx:
const user = await getSessionUser()
if (!user) redirect('/login')
if (!user.roles.includes('admin')) redirect('/posts')
```

**Python (Django / FastAPI / Flask)**
```python
# Django — use decorators:
@login_required
@permission_required('app.is_admin')
def my_view(request): ...

# FastAPI — use Depends:
async def get_current_admin(user = Depends(get_current_user)):
    if 'admin' not in user.roles:
        raise HTTPException(status_code=403)
    return user

@router.get("/admin/resource")
async def resource(admin = Depends(get_current_admin)): ...
```

**PHP (Laravel)**
```php
// In controller or route middleware:
Route::middleware(['auth', 'role:admin'])->group(function () {
    Route::get('/settings/users', [UserController::class, 'index']);
});

// In controller method:
$this->authorize('admin');  // or Gate::authorize('admin')
```

---

## 2. Brute Force Protection on Login

**All login forms must implement multi-tier rate limiting stored in a persistent backend (database or Redis), not in application memory.**

In-memory rate limiting (e.g., a `Map`, `dict`, or static variable) is forbidden in production — it resets on restart and does not work across multiple server instances.

### Three-tier model (implemented in this project)

| Tier | Key | Threshold | Window | Block duration | Threat it stops |
|------|-----|-----------|--------|----------------|-----------------|
| 1 | `email + IP` | 5 failures | 10 min | 10 min | Single attacker, single account |
| 2 | `IP only` | 20 failures | 10 min | 30 min | Credential stuffing: 1 IP, many accounts |
| 3 | `email only` | 50 failures | 60 min | 2 hours | Distributed attack: many IPs, 1 account |

**All three tiers must be checked before processing the login.** Record a failure entry for all three tiers on every failed attempt. On success, clear only Tier 1 — Tier 2 and Tier 3 must NOT be reset by a successful login, to prevent an attacker from resetting their counter by logging into their own account.

### Implementation checklist per platform

**Next.js / Node.js (this project)**
- Table: `login_attempts(id, key, ip, email, attempted_at)`
- Index: `(key, attempted_at DESC)`
- Periodic cleanup: delete rows older than 4 hours (run before every check)
- See `app/lib/login-rate-limit.ts` for the full implementation

**Python**
```python
# Using PostgreSQL — same table structure
def check_rate_limit(email: str, ip: str | None) -> tuple[bool, int]:
    email_ip_key = f"{email.lower()}|{ip or 'unknown'}"
    ip_key       = ip or 'unknown'
    email_key    = email.lower()

    # Tier 1
    count = db.execute(
        "SELECT COUNT(*) FROM login_attempts WHERE key = %s AND attempted_at > NOW() - INTERVAL '10 minutes'",
        [email_ip_key]
    ).scalar()
    if count >= 5:
        return True, remaining_seconds(email_ip_key, minutes=10)

    # Tier 2, Tier 3 — same pattern with their keys and thresholds
    ...
    return False, 0

def record_failure(email: str, ip: str | None):
    db.execute(
        "INSERT INTO login_attempts (key, ip, email) VALUES (%s,%s,%s),(%s,%s,%s),(%s,%s,%s)",
        [email_ip_key, ip, email, ip_key, ip, email, email_key, ip, email]
    )
```

**PHP (Laravel)**
```php
// Using DB instead of Laravel's built-in RateLimiter (which is memory/cache-based)
function checkRateLimit(string $email, ?string $ip): array {
    $emailIpKey = strtolower($email) . '|' . ($ip ?? 'unknown');

    $count = DB::table('login_attempts')
        ->where('key', $emailIpKey)
        ->where('attempted_at', '>', now()->subMinutes(10))
        ->count();

    if ($count >= 5) {
        return ['blocked' => true, 'retry_after' => $this->retryAfter($emailIpKey, 10)];
    }
    // Tier 2, Tier 3 — same pattern...
    return ['blocked' => false];
}
```

### What NOT to do (any platform)

```ts
// ❌ FORBIDDEN — in-memory, resets on restart, breaks on multi-instance
const LOGIN_ATTEMPTS = new Map()

// ❌ FORBIDDEN — Laravel/Symfony cache-based (still memory-like, not durable)
RateLimiter::attempt('login:'.$ip, 5, fn() => true)

// ❌ FORBIDDEN — Python dict (same problem)
login_attempts = {}
```

---

## 3. Admin User Management

**Every application must provide admins the ability to:**

1. **View all users** with their status (active / blocked) and role
2. **Block / unblock individual accounts** — affects login immediately
3. **Reset rate limit for a specific email** — allows a legitimate user to login again after their account was targeted by an attacker
4. **See accounts under attack** — a visual indicator when an account has unusually high failed login attempts in the last hour (threshold: > 10)

In this project: `app/settings/users/page.tsx` + `app/actions/users.ts`.

On other platforms, ensure equivalent admin UI/API endpoints exist with the same four capabilities.

**Resetting rate limit must delete ALL login_attempts rows for that email** (all three tier keys), so the user can attempt login from any IP without being blocked.

**Blocking a user must take effect immediately** — the `is_blocked` (or equivalent) flag is checked on every login attempt before password verification.

---

## 4. Access Logging

**Every security-relevant event must be logged with enough context to reconstruct what happened.**

### Mandatory events to log

| Event | Log when |
|-------|----------|
| `login_success` | Successful authentication |
| `login_failed` | Wrong credentials (do not reveal which field was wrong to the user, but log internally) |
| `login_blocked` | IP or country blocked by security policy |
| `login_rate_limited` | Rate limit triggered (include tier if possible) |
| `logout` | Session terminated |
| `request_blocked` | Request rejected before reaching business logic |

### Mandatory fields per log entry

`timestamp`, `event_type`, `status`, `ip`, `country`, `user_email` (if known), `user_agent`, `details` (JSON for extra context)

### Implementation note

- Logs must be stored in a **database table**, not only in log files, so admins can search and filter them from the UI
- In this project: table `access_logs`, UI at `/settings/logs`
- On other platforms: equivalent searchable storage (PostgreSQL table, Elasticsearch, etc.)
- **Logging failure must never crash the request** — wrap log writes in try/catch and fail silently

---

## 5. IP & Country-Based Access Control (optional but recommended)

Admins should be able to configure:
- A **blocklist of IP addresses** — requests from these IPs are rejected before reaching any handler
- An **allowlist of countries** (ISO 3166-1 alpha-2 codes) — requests from outside these countries are rejected
- A flag **"allow unknown country"** — controls behavior when country cannot be detected from headers

**Critical safety rule:** Before saving a new security policy, verify that the admin's own current IP and country would still be allowed. Reject the save if the new policy would lock the admin out.

In this project: `app/lib/request-security.ts`, settings at `/settings/security`.

---

## 6. Session Security

Sessions must be:
- **HTTP-only cookies** — not accessible from JavaScript
- **Signed or encrypted** — prevent forgery (HMAC or AES)
- **Scoped to path `/`** with `SameSite=Lax` and `Secure=true` in production
- **Short-lived or renewable** — 7 days maximum; invalidated on logout

In this project: `app/lib/session.ts` (HMAC-SHA256 signed cookie).

On other platforms:
- Django: built-in signed session cookie (use `SESSION_COOKIE_HTTPONLY=True`, `SESSION_COOKIE_SECURE=True`)
- Laravel: encrypted session cookie (default — do not disable encryption)
- FastAPI: use `itsdangerous` or JWT with short expiry
<!-- END:security-standards -->

---

<!-- BEGIN:ui-standards -->
# UI Standards — tables, filters, and pagination

These conventions apply to **every page in this application that renders a data table**, regardless of which feature or entity is being displayed. Do not build a table page without implementing all three: filter form, server-side filtering, and pagination.

---

## 1. Every table must be filterable on all its columns

Every column that contains meaningful data (text, status, date) must have a corresponding filter input. Users must be able to narrow the table to exactly what they need without scrolling through all rows.

### Filterable input types per column kind

| Column kind | Input type | Notes |
|-------------|------------|-------|
| Free text (name, email, description) | `<input type="search">` | Use `ILIKE %value%` server-side (case-insensitive) |
| Enum / status | `<select>` | One `<option value="">` for "all", then one per possible value |
| Date or timestamp | `<input type="date">` | Use `dateFrom` + `dateTo` pair for range filtering |
| Numeric | `<input type="number">` | Use `min`/`max` pair if range is needed |

### Filter form rules

1. **Use a plain HTML `<form>` with no `method` attribute** — defaults to GET, submits filters as URL query params. No JavaScript required.
2. **Always include a Filter (submit) button and a Reset button.** Reset is a `<Link href="/page-base-url">` — not a JS reset — so it clears all params cleanly.
3. **Persist active filter values** using `defaultValue={params.xxx ?? ''}` on every input.
4. **Wrap the form in the same card style** as the rest of the page: `rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900`.

### Reference implementation

`app/settings/logs/page.tsx` — filter bar with search, event type, country, path, and date range.
`app/settings/users/page.tsx` — filter bar with search (name/email) and status select.

### Server-side filtering pattern (Next.js)

```ts
// In page.tsx — read params
type SearchParams = Promise<{
  page?: string
  search?: string
  status?: string   // add one field per filterable column
}>

// Pass to data function
const { rows, total } = await getData({
  page,
  search: params.search,
  status: params.status,
})
```

```ts
// In the data function (action or lib) — apply filters
const where = {
  ...(params.search ? {
    OR: [
      { name:  { contains: params.search, mode: 'insensitive' } },
      { email: { contains: params.search, mode: 'insensitive' } },
    ],
  } : {}),
  ...(params.status === 'active'  ? { is_active: true }  : {}),
  ...(params.status === 'blocked' ? { is_active: false }  : {}),
}
const [rows, total] = await Promise.all([
  prisma.entity.findMany({ where, take: pageSize, skip: offset, orderBy: ... }),
  prisma.entity.count({ where }),
])
```

---

## 2. Every table must have server-side pagination

Pagination is URL-based (query param `page`). The page never loads all rows — it always queries only the current page from the database.

### Pagination rules

1. **Default page size: 20 rows** for management tables (users, etc.), **50 rows** for log/audit tables.
2. **`buildXxxHref` helper** — always preserve active filter params when building pagination links, so filtering + paginating work together:
   ```ts
   function buildUsersHref(params: Record<string, string | undefined>) {
     const query = new URLSearchParams()
     for (const [key, value] of Object.entries(params)) {
       if (value) query.set(key, value)
     }
     const qs = query.toString()
     return qs ? `/settings/users?${qs}` : '/settings/users'
   }
   // Usage in pagination links:
   href={buildUsersHref({ ...params, page: String(page + 1) })}
   ```
3. **Show row count summary**: `X–Y dari Z entri` using `toLocaleString('id-ID')`.
4. **Show pagination controls only if `totalPages > 1`**: First / Prev / `Hal. X / Y` / Next / Last.
5. **Disable and style inactive links** with `pointer-events-none` (not a disabled button) to keep them as `<Link>` elements.

### Reference implementation

`app/settings/logs/page.tsx` and `app/settings/users/page.tsx` — both implement the full pattern.

---

## 3. Loading skeletons must mirror the real layout

Every page with a table must have a `loading.tsx` sibling that renders a skeleton matching the real page structure:

```
loading.tsx must contain skeletons for:
  ✓ Page header (breadcrumb, title, description)
  ✓ Filter form (same grid layout as real form)
  ✓ Table (header row + N skeleton data rows)
  ✓ Pagination row
```

Skeleton element: `<div className="animate-pulse rounded bg-neutral-200 dark:bg-neutral-700 {size}" />`

Reference: `app/settings/logs/loading.tsx`, `app/settings/users/loading.tsx`.
<!-- END:ui-standards -->
