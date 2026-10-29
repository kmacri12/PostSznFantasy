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
- Never commit `.env` files; use the `.env.example` templates.
