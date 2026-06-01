# Architecture Patterns

## AI Tables — Read-Only UI Pattern

### Wanneer toepasbaar

Een tabel valt onder dit patroon wanneer **alle drie** criteria gelden:

1. Data wordt uitsluitend geproduceerd door een externe engine (AI, Stripe-webhook, cron, etc.), niet door gebruikersinteractie.
2. De UI heeft geen write-use-case nodig; mutaties via het admin- of storefront-dashboard zijn bewust uitgesloten.
3. Data-integriteit is afhankelijk van een single writer; directe DB-writes door users zouden audit-trail of model-training vervuilen.

### Het patroon

| Laag | Verantwoordelijkheid |
|------|----------------------|
| Edge function | Schrijft via `SUPABASE_SERVICE_ROLE_KEY` (bypass RLS). |
| RLS-policies | Alleen `SELECT` voor `authenticated`, tenant-gescoped via `tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))`. |
| UI (React hooks) | Alleen `useQuery` / `SELECT`; geen `useMutation` naar deze tabel. Mutaties gaan via `supabase.functions.invoke()` naar de edge function. |

**Nooit** toevoegen: `INSERT`, `UPDATE`, `DELETE` policies voor `authenticated` of `anon`. Redundant `service_role`-JWT policies (bijv. `"Service role can manage X"`) zijn code smell — `service_role` bypasst RLS automatisch.

### Waarom

- **Architecturaal correct**: single source of writes (de engine), consistente data-flow.
- **Security-positive**: een gecompromitteerd `tenant_admin` account kan AI-learning-data of engine-output niet vervuilen via PostgREST.
- **Audit-trail**: writes centraal gelogd in edge-function logs / DB triggers, niet verspreid over client-side hooks.

### Voorbeeldtabellen die dit patroon nu volgen

| Tabel | Writer | UI-toegang |
|-------|--------|------------|
| `ai_user_behavior_log` | Edge function `track_user_behavior` | `SELECT` tenant-scoped |
| `ai_user_learning_patterns` | Edge function `update_user_learning_pattern` | `SELECT` tenant-scoped |
| `ai_reply_suggestions` | Edge function (suggestion generator) | `SELECT` tenant-scoped |

### Policy-template snippet

```sql
-- Alleen SELECT voor authenticated users, tenant-gescoped
CREATE POLICY "Tenant users can view <table>"
ON public.<table>
FOR SELECT
TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
);

-- Geen INSERT/UPDATE/DELETE policies voor authenticated
-- Writes lopen uitsluitend via edge function + service_role
```

### Referentie

Audit-context en rationale: `docs/role-audit-phase1d-triage.md` (Fase 1D, cases #5–#7).
