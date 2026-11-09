# Security Policy

## Reporting a vulnerability

Please report suspected vulnerabilities privately through GitHub's
["Report a vulnerability"](../../security/advisories/new) form on this repository
rather than opening a public issue. Include steps to reproduce and the affected
endpoint or component. We aim to acknowledge reports within a few days.

## Scope notes

- Authentication is delegated to Supabase; the API verifies JWTs against the
  project's JWKS and never accepts unsigned tokens.
- `/api/admin/*` is limited to the Supabase user ids in `ADMIN_SUPABASE_UIDS`.
- The JWT algorithm is pinned to `ES256`/`RS256` (the token header never chooses it).
- API responses carry `X-Content-Type-Options: nosniff`, `Content-Security-Policy:
  default-src 'none'` and `Cross-Origin-Resource-Policy: same-site`; `/docs`, `/redoc`
  and `/openapi.json` are off when `ENVIRONMENT=production`; CORS lists the methods and
  headers the app uses. The website sends a `Content-Security-Policy-Report-Only`
  (see `docs/owner/22-security-headers.md`).
- Sockets check membership at connect and are closed when the member is removed or the
  league deleted; abusive sockets and requests are throttled and size-capped.
- A deleted league answers strangers the same 403 as a live one.
- Never commit `.env` files; use the `.env.example` templates.
