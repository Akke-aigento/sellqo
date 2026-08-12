# Recon: bestaande "Tenant verwijderen"-actie (platform-admin)

## 1. UI-component

`src/pages/admin/Tenants.tsx`
- regel 31: iconen incl. `MoreHorizontal`, `Trash2`
- regel 272: drie-puntjes-trigger in de tabelrij
- regel ~301: `DropdownMenuItem` "Verwijderen" -> `handleDelete(tenant)`
- regel 112-115: `handleDelete` zet enkel `tenantToDelete` + opent de AlertDialog
- regel 322-342: bevestigingsdialoog; `AlertDialogAction` -> `confirmDelete`
- regel 117-123: `confirmDelete()` -> `deleteTenant.mutate(tenantToDelete.id)`

Er is geen tweede verwijderpad in de platform-UI (`TenantBulkActions.tsx` heeft alleen credits / notificatie / CSV-export, geen delete; het `Trash2`-icoon daar is ongebruikt).

## 2. Keten knop -> DB

`src/hooks/useTenants.ts` regel 166-189:

```ts
const deleteTenant = useMutation({
  mutationFn: async (id: string) => {
    const { error } = await supabase.from('tenants').delete().eq('id', id);
    ...
```

Dus: **directe client-side DELETE via PostgREST**. Geen RPC, geen edge function. Er bestaat ook geen `delete-tenant` edge function (aanwezige tenant-functies: `create-tenant`, `repair-tenant-access`, `sync-tenant-plan`, `cleanup-connected-accounts`).

Autorisatie loopt via RLS-policy op `tenants`: `Platform admins can delete tenants` met `is_platform_admin(auth.uid())` (DELETE). Dus alleen platform-admins slagen, met **anon/authenticated JWT-privileges** — geen service-role.

## 3. Wat wordt WEL en NIET opgeruimd

WEL (automatisch via database-cascades, zie punt 4):
- vrijwel alle tenant-scoped tabellen: `products`, `orders`, `user_roles`, `tenant_subscriptions`, `customers`-gerelateerde data, invoices, POS, ads, AI, e-mail, storefront-config, enz. (194 cascade-FK's naar `tenants.id`).

NIET:
- **`auth.users`** — blijft volledig bestaan. Een DELETE via PostgREST kan de `auth`-schema niet raken; dat vereist de Admin API / service-role. E-mailadres blijft dus "bezet".
- **`profiles`** — hangt alleen aan `auth.users` (`profiles_id_fkey` -> `auth.users` ON DELETE CASCADE) en heeft géén `tenant_id`. Blijft dus staan zolang de auth-user bestaat.
- **Storage-objecten** — geen enkele bucket wordt door een DB-delete geraakt: `tenant-logos`, `tenant-assets`, `product-images`, `invoices`, `credit-notes`, `shipping-labels`, `digital-products`, `ai-images`, `marketing-assets`, `message-attachments`, `supplier-documents`, `peppol-archive`.
- **Externe systemen** — Stripe connected account, Cloudflare-domein, marketplace-tokens: niets wordt losgekoppeld.

Je vermoeden is dus deels juist: tenant-*data* cascadeert wel, maar **auth.users + profiles + storage blijven verweesd achter**.

## 4. Foreign keys / cascade-gedrag

Van de 199 FK's die naar `tenants.id` verwijzen:
- **194x ON DELETE CASCADE** (o.a. `products`, `orders`, `user_roles`, `tenant_subscriptions`, `invoices`, `pos_*`, `ads_*`)
- **3x ON DELETE SET NULL**: `admin_actions_log`, `support_tickets`, `customers`
- **2x NO ACTION (blokkeert!)**: `credit_notes.tenant_id`, `ai_credit_purchases.tenant_id`

Gevolg: zodra een tenant één creditnota of één AI-creditaankoop heeft, **faalt de huidige DELETE met een FK-violation** en verschijnt enkel de generieke toast "Fout bij verwijderen". Dat is een tweede, los bevestigd probleem in de bestaande flow.

`user_roles` heeft daarnaast `user_id -> auth.users ON DELETE CASCADE`, dus het verwijderen van de auth-user ruimt rollen ook op.

## 5. Kan de huidige flow `auth.users` verwijderen?

Nee. De call draait in de browser met de gebruikers-JWT (anon key + Authorization header). PostgREST exposeert alleen `public`; `auth.users` is niet bereikbaar en de rol heeft er geen DELETE-recht. Verwijderen van auth-users vereist `supabase.auth.admin.deleteUser()` met de service-role key — dat kan alleen server-side in een edge function (patroon bestaat al in `create-invite-account` en `fetch-invitation`).

## Conclusie

(a) **Waar de fix moet landen:** niet in de client-mutation. Er is een nieuwe **service-role edge function `delete-tenant`** nodig; `useTenants.deleteTenant` wordt omgezet naar `supabase.functions.invoke('delete-tenant', { body: { tenant_id } })`. De UI (dropdown + AlertDialog) blijft ongewijzigd, dus geen parallelle flow.

(b) **Minimale wijzigingen voor de gewenste cascade:**
1. Edge function `delete-tenant` (service-role, JWT-check dat de aanroeper `is_platform_admin` is):
   - blokkerende rijen eerst opruimen: `credit_notes` en `ai_credit_purchases` van die tenant (NO ACTION-FK's);
   - storage-objecten van de tenant verwijderen in de 12 buckets (prefix-based listing per tenant-id);
   - `DELETE FROM tenants` (194 cascades doen de rest);
   - per gebruiker met een rol op deze tenant: als hij daarna **geen enkele andere tenant-rol** meer heeft -> `auth.admin.deleteUser(user_id)` (profiles cascadeert mee);
   - resultaatrapport (verwijderd / overgeslagen / fouten) terug naar de UI.
2. `src/hooks/useTenants.ts`: `deleteTenant` naar `functions.invoke` + concrete foutmelding in de toast.
3. Optioneel in dezelfde migratie: de twee NO ACTION-FK's naar `ON DELETE CASCADE` brengen, zodat de tenant-delete niet meer op boekhoudrijen stukloopt.

Openstaande beslissingen voor de implementatie-turn:
- Moet een tenant met facturatie-historiek (creditnota's, platform-invoices) echt hard verwijderd worden, of is soft-delete/archivering gewenst? Hard delete betekent verlies van boekhoudkundige sporen.
- Moeten Stripe connected account en Cloudflare-domein in dezelfde actie losgekoppeld worden?
- Wordt de auth-user van de eigenaar altijd verwijderd, of alleen als hij geen andere tenants bezit (voorstel hierboven = het laatste)?
