# Secrets Management — SellQo

_Last updated: 2026-06-09_

## TL;DR

- **Public secrets** (safe in repo / client bundle): `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (anon key), `VITE_SUPABASE_PROJECT_ID`.
- **Private secrets** (NEVER in repo, NEVER in client bundle): service-role key, Stripe secret, Resend, webhook signing secrets, OAuth client secrets.
- All private secrets live in the **Supabase Edge Functions Secrets manager** and are read at runtime via `Deno.env.get('NAME')`.
- The local `.env` file is git-ignored — use `.env.example` as the onboarding template.

## Secret inventory

### Public (in `.env` + Vite bundle)
| Name | Purpose |
|---|---|
| `SUPABASE_URL` / `VITE_SUPABASE_URL` | Backend URL |
| `SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_PUBLISHABLE_KEY` | Anon key (RLS-protected) |
| `VITE_SUPABASE_PROJECT_ID` | Project ref |

### Private (Supabase Edge Function Secrets only)
| Name | Used by |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | All edge functions needing admin DB access |
| `STRIPE_SECRET_KEY` | Live Stripe operations (platform + tenant Connect) |
| `STRIPE_TEST_SECRET_KEY` | Demo / sandbox tenants |
| `STRIPE_WEBHOOK_SECRET` | Platform Stripe webhook verification |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | Connect Stripe webhook verification |
| `RESEND_API_KEY` | Transactional email (orders, invoices, returns, team invites) |
| `MIGADU_API_KEY` | Tenant mailbox provisioning (if used) |
| `CLOUDFLARE_API_TOKEN` | Domain auto-connect |
| `BOL_CLIENT_SECRET` | Bol.com OAuth |
| `SHOPIFY_API_SECRET` | Shopify OAuth |
| `META_APP_SECRET` | Meta (Facebook/Instagram) OAuth |
| `LOVABLE_API_KEY` | Lovable AI Gateway calls |
| `CRON_SECRET` | Internal cron-job auth (if used) |

Run `supabase--fetch_secrets` (Lovable tool) or check Supabase Dashboard → Project Settings → Edge Functions → Secrets for the authoritative live list.

## Adding a new secret

1. Add the value via Supabase Dashboard → **Project Settings → Edge Functions → Secrets** (or via Lovable `add_secret` tool, which prompts the user securely).
2. Reference in edge function code:
   ```ts
   const key = Deno.env.get('MY_NEW_SECRET');
   if (!key) throw new Error('MY_NEW_SECRET is not set');
   ```
3. **Never** echo, log, or return the secret value in responses.
4. Document the new secret in this file under the inventory.

## Rotating a secret (zero-downtime)

1. Generate a new value in the provider dashboard (Stripe / Resend / etc.) — keep the old one active.
2. Update the secret in Supabase Edge Functions Secrets (`update_secret`).
3. Trigger a redeploy of the affected edge functions (any deploy will pick up the new env).
4. Verify the new value works (smoke test the function).
5. Revoke the old value in the provider dashboard.

For `LOVABLE_API_KEY` specifically: use the dedicated `lovable_api_key--rotate_lovable_api_key` tool.

## Onboarding flow (new developer)

```bash
git clone <repo>
cd sellqo
cp .env.example .env
# fill in the 5 public Supabase values from Lovable Cloud / Supabase dashboard
bun install
bun run dev
```

No private secrets are needed locally — all server-side logic runs in deployed edge functions that read secrets from the Supabase secrets manager.

## Audit history

- **2026-06-09** — Hygiene pass: `.env` removed from git tracking, `.env.example` added, repo swept for hardcoded private secrets (zero findings). See `docs/role-audit.md` → "Hygiene — secrets-management pass".