# Zona Dorata definitief loskoppelen van Sander

## Situatie

- **user_roles**: Sander (`72e2de50-…` / `sander.mancini@hotmail.be`) staat nergens meer als teamlid → verwijdering uit Zona Dorata is correct doorgevoerd.
- **Nieuwe admin actief**: `aaron-mercken@hotmail.com` (jij) is `tenant_admin` op Zona Dorata sinds 6 jul 2026.
- **Openstaand risico**: `tenants.owner_email` van Zona Dorata (`05b419c3-d9a4-4ad8-bbf0-2d1c672e266f`) staat nog op `sander.mancini@hotmail.be`. De `repair-tenant-access` edge function wordt door `useTenant.tsx` aangeroepen op elke login waar de user 0 tenants ziet, en inserted dan een `tenant_admin` op basis van deze `owner_email`. Bij Sanders volgende login op sellqo.app krijgt hij automatisch terug admin-rechten.

## Wijzigingen

### 1. `owner_email` van Zona Dorata wijzigen

`UPDATE public.tenants SET owner_email = 'aaron-mercken@hotmail.com' WHERE id = '05b419c3-d9a4-4ad8-bbf0-2d1c672e266f'`

Dit sluit de spoof-vector: `repair-tenant-access` kan Sander niet meer matchen op deze tenant. Jij bent zowel Admin (via `user_roles`) als officiële owner (via `owner_email`).

### 2. `repair-tenant-access` hardenen (aanbevolen)

Om te voorkomen dat dit patroon opnieuw ontstaat bij toekomstige verwijderingen, twee guards toevoegen aan `supabase/functions/repair-tenant-access/index.ts`:

- **Guard A** — weiger als `auth.users.email_confirmed_at IS NULL` of user < 24u oud is (voorkomt fresh-signup spoof).
- **Guard B** — expliciete revoke-check op nieuwe tabel `tenant_access_revocations(tenant_id, email)`. `remove-team-member` schrijft daar automatisch een rij bij verwijdering; `repair-tenant-access` weigert als er een match is.

**Migratie**:
```sql
CREATE TABLE public.tenant_access_revocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email text NOT NULL,
  revoked_at timestamptz NOT NULL DEFAULT now(),
  revoked_by uuid,
  reason text
);
CREATE UNIQUE INDEX ON public.tenant_access_revocations (tenant_id, lower(email));
GRANT SELECT ON public.tenant_access_revocations TO authenticated;
GRANT ALL ON public.tenant_access_revocations TO service_role;
ALTER TABLE public.tenant_access_revocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant admins view revocations"
  ON public.tenant_access_revocations FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'platform_admin')
      OR tenant_id = ANY(public.get_user_tenant_ids()));
```

**Backfill**: één rij invoegen voor Sander @ Zona Dorata als extra vangnet.

**Edge-function edits**:
- `repair-tenant-access/index.ts`: extra `SELECT` op `tenant_access_revocations` en `auth.users.created_at` check vóór de bestaande insert.
- `remove-team-member/index.ts`: na succesvolle role-verwijdering → `INSERT ... ON CONFLICT DO NOTHING` in revocations.

## Optioneel

Als je liever géén nieuwe tabel wilt en de fix minimaal wilt houden: alleen stap 1 (`owner_email` updaten) is genoeg om Sander concreet buiten Zona Dorata te houden. Stap 2 is preventief voor toekomstige verwijderingen op andere tenants.

## Niet aangeraakt

- Jouw huidige admin-role op Zona Dorata.
- `accept-team-invitation` (invites blijven werken zoals nu).
- `useTenant.tsx` frontend-flow.
- Andere tenants of teamleden.
