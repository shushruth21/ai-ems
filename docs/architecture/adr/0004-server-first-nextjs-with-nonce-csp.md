# 0004. Server-first Next.js 16 with a nonce CSP

- **Status:** accepted
- **Date:** 2026-09-17

## Decision

- Data is read in Server Components and written through server actions.
- TanStack Query is used only for client-interactive caches.
- `proxy.ts` (formerly middleware) sets a per-request nonce CSP with `strict-dynamic`.
- The root layout reads `headers()`, so pages render dynamically. A nonce can't be applied to prerendered HTML.
- `next-themes` receives the nonce for its inline script.

## Consequences

- Strong XSS protection, no hydration of secrets, and linkable URL state.
- Static prerendering is traded away. Public marketing pages may later use a separate, hash-based CSP.
