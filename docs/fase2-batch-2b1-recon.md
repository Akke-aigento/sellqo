# Fase 2 — Batch 2B1 Recon: Integrations (RLS + Edge Functions)

Datum: 2026-06-08
Scope: marketplace + ad-platform + review + shipping + Stripe Connect + custom-domain + fulfillment API + OAuth-credentials.
Geen code-wijzigingen — alleen inventarisatie, classificatie en voorstel.

Legend: ✅ rol-aware & tenant-scoped · ⚠️ tenant-scoped maar rol-blind · ❌ unbounded / inconsistent

---

## 1. Huidige RLS per tabel

### 1.1 `marketplace_connections` (1 rij — actief) ⚠️
| Policy | Cmd | Rule |
|---|---|---|
| Users can view their tenant's marketplace connections | SELECT | tenant_id ∈ get_user_tenant_ids(auth.uid()) — **alle rollen** |
| Users can insert marketplace connections for their tenant | INSERT | tenant_id-scope **AND** (tenant_admin OR staff) |
| Users can update their tenant's marketplace connections | UPDATE | tenant_id-scope **AND** (tenant_admin OR staff) |
| Tenant admins can delete … | DELETE | tenant_id-scope **AND** tenant_admin |

Mismatch met matrix: **staff mag nu insert/update doen**; matrix wil tenant_admin only.

### 1.2 `shopify_connection_requests` (1 rij — actief) ⚠️
| Policy | Cmd | Rule |
|---|---|---|
| Tenants can view their own requests | SELECT | tenant_id via user_roles — **alle rollen** |
| Tenants can insert their own requests | INSERT | tenant_id via user_roles — **alle rollen** |
| Platform admins can manage all requests | ALL | is_platform_admin |

Mismatch: viewer/warehouse/accountant kunnen ook insert doen. Geen UPDATE/DELETE-policy → impliciet alleen platform_admin via ALL.

### 1.3 `ad_platform_connections` (2 rijen — actief) ✅⚠️
| Policy | Cmd | Rule |
|---|---|---|
| Tenant users can view their ad connections | SELECT | tenant_id-scope of platform_admin — **alle rollen** |
| Tenant admins can manage ad connections | ALL | platform_admin OR (user_roles role='tenant_admin') |

ALL-policy is rol-aware (✅). SELECT is bewust open (oké volgens matrix — staff/accountant mag status zien).

### 1.4 `tenant_oauth_credentials` (1 rij — actief) ⚠️
| Policy | Cmd | Rule |
|---|---|---|
| Tenant members can view own credentials | SELECT | tenant_id-scope — **alle rollen** |
| Tenant admins can manage credentials | ALL | tenant_admin OR platform_admin |

SELECT is **te ruim** voor secrets-tabel: client_secret is wel encrypted maar viewer/warehouse hebben geen reden. Voorstel: SELECT beperken tot tenant_admin (UI is enkel een admin-wizard).

### 1.5 `tenant_domains` (3 rijen — actief) ✅
| Policy | Cmd | Rule |
|---|---|---|
| Public can read active domains | SELECT (anon) | is_active=true AND dns_verified=true |
| Users can view own tenant domains | SELECT | tenant_id-scope — alle rollen |
| Tenant admins can insert domains | INSERT | tenant_admin / platform_admin |
| Tenant admins can update domains | UPDATE | tenant_admin / platform_admin |
| Tenant admins can delete domains | DELETE | tenant_admin / platform_admin |

Goed rol-aware. **Anon-SELECT moet blijven** — storefront multi-domain routing (`storefront-resolve`, `storefront-api`, `usePublicStorefront`, `ShopLayout`) leest hier op. Beperking tot `is_active=true AND dns_verified=true` is veilig.

### 1.6 `review_platform_connections` (0 rijen — dormant) ❌
| Policy | Cmd | Rule |
|---|---|---|
| Public can view enabled platform connections | SELECT | is_enabled=true — **anon!** Lekt OAuth-tokens publiek als is_enabled wordt geactiveerd |
| Users can view their tenant's review connections | SELECT | tenant-scope — alle rollen |
| Users can insert/update/delete | INSERT/UPDATE/DELETE | **alleen tenant-scope, géén rol-check** |

Dit is een **security-bug**: viewer/warehouse mogen reviews-connecties verwijderen, en de anon-SELECT lekt access_token zodra is_enabled=true. Hard te fixen.

### 1.7 `shipping_integrations` (0 rijen — dormant) ❌
| Policy | Cmd | Rule |
|---|---|---|
| Tenant admins can manage shipping integrations | ALL | **alleen tenant-scope, géén rol-check** (naam misleidend) |
| Users can view their tenant shipping integrations | SELECT | tenant-scope — alle rollen |

Mismatch: ALL-policy gunt alle rollen write. Te fixen.

### 1.8 `fulfillment_api_keys` (0 rijen — dormant) ✅
| Policy | Cmd | Rule |
|---|---|---|
| Tenant admins can manage their API keys | ALL | tenant-scope AND (platform_admin OR tenant_admin) |

Geen aparte SELECT — alleen admins zien API-keys (correct, secrets-tabel).

---

## 2. Edge-function audit (auth/role/verify_jwt)

### 2.1 OAuth flows
| Function | authenticateRequest | requireRole | verify_jwt | service-role | Opmerking |
|---|---|---|---|---|---|
| `shopify-oauth-init` | nee | nee | false | ja (oauth_states + cred-write) | Init wordt vanuit admin-UI getriggerd → **moet** requireRole(tenant_admin) krijgen |
| `shopify-oauth-callback` | n.v.t. (redirect, geen JWT) | n.v.t. | false | ja | State-validatie via oauth_states ✅ (oauth_states is service-role only sinds 1D) — schrijft `marketplace_connections.upsert` |
| `social-oauth-init` | **ja** (tenantId arg) | nee | false | ja | Heeft auth, mist requireRole(tenant_admin) |
| `social-oauth-callback` | n.v.t. | n.v.t. | false | ja | State-validatie via oauth_states ✅ |

OAuth-callbacks zijn correct anonymous + state-token: external provider redirect bevat géén JWT. State-validatie tegen `oauth_states` (service-role-only sinds 1D) is voldoende. **Niet aanraken.**

### 2.2 Stripe Connect
| Function | auth | role | verify_jwt | service-role | Opmerking |
|---|---|---|---|---|---|
| `create-connect-account` | handmatige `getUser` | géén app_role-check | false | ja | Voorstel: migreer naar `authenticateRequest` + `requireRole(['tenant_admin'])` |
| `check-connect-status` | handmatige `getUser` | géén check | false | ja | Voorstel: `requireRole(['tenant_admin','staff'])` |
| `disconnect-stripe-account` | handmatige `getUser` + ad-hoc ownership-check (`tenant_users.role='owner'`) | géén app_role-check | false | ja | Voorstel: vervang ownership-check door `requireRole(['tenant_admin'])` (`owner` ≠ `app_role`) |
| `get-stripe-login-link` | handmatige `getUser` | géén check | false | ja | Voorstel: `requireRole(['tenant_admin'])` |
| `cleanup-connected-accounts` | handmatige `getUser` | bedoeld voor platform_admin | false | ja | Verifieer: platform-admin check moet behouden blijven, anders blokkeren |
| `stripe-connect-webhook` | n.v.t. (webhook) | n.v.t. | false | ja | Stripe signature → niet aanraken |
| `platform-stripe-webhook` | n.v.t. | n.v.t. | false | ja | Idem |

### 2.3 Custom domains
| Function | auth | role | verify_jwt | Opmerking |
|---|---|---|---|---|
| `verify-domain` | géén | géén | false | **Geen auth!** Schrijft naar `tenant_domains`. Voorstel: `authenticateRequest` + `requireRole(['tenant_admin'])` |
| `check-domain-ssl` | géén | géén | false | Read-only via service-role; voorstel: auth + tenant_admin |
| `detect-domain-provider` | géén | géén | false | Read-only public DNS; voorstel: auth + tenant_admin (niet kritiek maar consistent) |
| `cloudflare-api-connect` | `getClaims` | géén | false | Schrijft tenant-settings; voorstel: `requireRole(['tenant_admin'])` |

### 2.4 Marketplace test-calls
| Function | auth | role | verify_jwt | Opmerking |
|---|---|---|---|---|
| `test-marketplace-connection` | `authenticateRequest(req)` | géén | false | Voorstel: `requireRole(['tenant_admin'])` — rate-limits / credentials |
| `test-shopify-connection` | `authenticateRequest(req)` | géén | false | Idem |
| `test-ebay-connection` | `authenticateRequest(req)` | géén | false | Idem |
| `test-odoo-connection` | `authenticateRequest(req)` | géén | false | Idem |
| `test-shipping-connection` | `authenticateRequest(req)` | géén | false | Idem |
| `newsletter-test-connection` | onbekend | — | false | Out-of-scope (newsletter, niet 2B1) |

`authenticateRequest(req)` zonder tenant-arg → controleert alleen JWT-geldigheid, géén tenant-membership. Bij toevoegen `requireRole(auth, tenant_id, [...])` moet de body ook een `tenant_id` meesturen. Frontend stuurt die al mee in `test-marketplace-connection` (zie `useMarketplaceConnections`).

### 2.5 Sync-cron functies (service-role)
Alle `sync-*`, `import-*`, `lookup-*`, `confirm-*`, `accept-*`, `create-bol-vvb-label`, `marketplace-sync-scheduler`, `tracking-webhook`, `sync-platform-reviews` → service-role, geen wijziging. ✅

### 2.6 `fulfillment-api`
Externe 3PL API met eigen API-key auth (`fulfillment_api_keys`-hash check) — niet via Supabase JWT. Niet raken.

---

## 3. OAuth-callback security-bevestiging

Callbacks (`shopify-oauth-callback`, `social-oauth-callback`) ontvangen `GET ?state=…&code=…` van externe provider zonder Authorization-header. Auth-pad:

1. Provider POSTs naar callback URL → geen JWT (correct: `verify_jwt=false`).
2. Functie zoekt rij in `public.oauth_states` op `state` → tabel is sinds Fase 1D **service-role only**, dus alleen onze edge-function ziet/wist `state`.
3. State is 10 minuten geldig, eenmalig (DELETE na consume), gekoppeld aan `tenant_id` + platform → tenant-identiteit vastgesteld via signed state, niet via JWT.

**Conclusie:** state-validatie is voldoende, géén `requireRole` toevoegen op callbacks.

---

## 4. Voorgesteld nieuw RLS-patroon (samenvattend)

```sql
-- Pattern A: tenant_admin-only writes (connections + credentials + API-keys)
-- Tables: marketplace_connections, ad_platform_connections, review_platform_connections,
--         shopify_connection_requests, shipping_integrations, tenant_oauth_credentials,
--         fulfillment_api_keys
--
-- SELECT (auth):  tenant_id ∈ get_user_tenant_ids() — alle rollen, behalve tenant_oauth_credentials
-- SELECT tenant_oauth_credentials: has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[])
-- INSERT/UPDATE/DELETE (auth): has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[])
-- ALL service_role: behoud (webhooks, syncs)
--
-- Drop review_platform_connections.anon SELECT (lekt tokens).

-- Pattern B: tenant_domains
-- SELECT (anon): is_active=true AND dns_verified=true  -- behouden voor storefront
-- SELECT (auth): tenant-scope, alle rollen
-- INSERT/UPDATE/DELETE (auth): has_tenant_role(['tenant_admin'])
-- ALL service_role: behoud
```

Helper: `public.has_tenant_role(uuid, app_role[])` bestaat al (Fase 1D / 2A1).

---

## 5. Edge-function role-checks (sub-batch 2B1b)

| Function | Voorgestelde requireRole |
|---|---|
| `create-connect-account` | `['tenant_admin']` |
| `check-connect-status` | `['tenant_admin','staff']` |
| `disconnect-stripe-account` | `['tenant_admin']` (vervangt huidige owner-check) |
| `get-stripe-login-link` | `['tenant_admin']` |
| `verify-domain` | `['tenant_admin']` (+ `authenticateRequest`) |
| `check-domain-ssl` | `['tenant_admin']` (+ `authenticateRequest`) |
| `detect-domain-provider` | `['tenant_admin']` (+ `authenticateRequest`) |
| `cloudflare-api-connect` | `['tenant_admin']` (migreer van getClaims → authenticateRequest) |
| `shopify-oauth-init` | `['tenant_admin']` (+ `authenticateRequest(req, tenantId)`) |
| `social-oauth-init` | `['tenant_admin']` (auth bestaat al) |
| `test-marketplace-connection` | `['tenant_admin']` |
| `test-shopify-connection` | `['tenant_admin']` |
| `test-ebay-connection` | `['tenant_admin']` |
| `test-odoo-connection` | `['tenant_admin']` |
| `test-shipping-connection` | `['tenant_admin']` |
| `shopify-oauth-callback` | **GEEN** — state-validatie |
| `social-oauth-callback` | **GEEN** — state-validatie |
| Alle `sync-*` / webhooks | **GEEN** — service-role |

---

## 6. `config.toml` audit

Alle bovenstaande functies staan al op `verify_jwt = false` in `supabase/config.toml`:
`create-connect-account`, `check-connect-status`, `disconnect-stripe-account` (impliciet — niet expliciet in toml, default voor signing-keys), `get-stripe-login-link`, `verify-domain`, `check-domain-ssl`, `detect-domain-provider`, `cloudflare-api-connect`, `shopify-oauth-init`, `shopify-oauth-callback`, `social-oauth-init`, `social-oauth-callback`, `test-marketplace-connection`, `test-shopify-connection`, `test-ebay-connection`.

Ontbrekend in toml (toe te voegen indien expliciete entry nodig): `disconnect-stripe-account`, `test-odoo-connection`, `test-shipping-connection`. Geen blocker — in-code auth via `authenticateRequest` werkt onafhankelijk van `verify_jwt`-setting, maar wel best practice om expliciet `verify_jwt=false` te zetten voor consistentie met het Lovable-pattern.

---

## 7. Risico-analyse

### 7.1 UI-flow impact (frontend gating komt in H4)
- **Marketplace pagina** (`useMarketplaceConnections`): staff kan vandaag connect/disconnect klikken → na 2B1 zal staff 403 krijgen bij insert/update/delete. Knoppen moeten weg/disabled voor staff. Read blijft werken.
- **Stripe Connect onboarding** (`useStripeConnect`): staff/accountant zien `create-connect-account` nooit (zit in tenant-setup). Geen breaking impact verwacht, maar gating in `Subscriptions.tsx` aanbevolen.
- **Custom domain wizard** (`useTenantDomains`): staff kan vandaag domains toevoegen (alleen door RLS al geblokkeerd, dus geen regressie). `verify-domain`-button moet wel verborgen voor staff.
- **Reviews Hub** (`useReviewsHub`): vandaag mag iedereen insert/update/delete → na fix tenant_admin only. Lijkt nu nergens actief gebruikt (0 rijen), klein risico.
- **Shipping integrations** (`useShippingIntegrations`): idem, 0 rijen, geen prod-impact.
- **OAuth-credentials wizards** (`MetaConnectWizard`, `WhatsAppConnectWizard`, `SocialCredentialsForm`): lezen `tenant_oauth_credentials` direct vanuit frontend. Bij SELECT-restrictie tot tenant_admin verliezen staff/viewer leesrechten. Acceptabel — alleen tenant_admin doet de OAuth-setup; wel checken of die wizards alleen vanaf admin-routes opengaan.

### 7.2 Custom frontends (VanXcel, Mancini)
`rg`-check uitgevoerd: er zijn géén directe PostgREST writes vanuit storefront / publieke routes op de integration-tabellen. Storefront leest enkel `tenant_domains` (anon-SELECT blijft). `storefront-api` en `storefront-resolve` draaien op service-role → niet geraakt door RLS. ✅

### 7.3 Storefront multi-domain routing
- `storefront-resolve/index.ts:38,76` — service-role read, geen impact.
- `storefront-api/index.ts:92,101,156,833,864` — service-role read, geen impact.
- `usePublicStorefront.ts:412,448` — anonymous read; `Public can read active domains` policy dekt dit, blijft werken.
- `ShopLayout.tsx:188` — idem anonymous, blijft werken.

**Geen storefront-regressie verwacht.**

### 7.4 Edge-function impact
- `shopify-oauth-callback`: schrijft via service-role naar `marketplace_connections.upsert`. Service-role bypasst RLS → blijft werken.
- Alle `sync-*` jobs: service-role reads/writes op `marketplace_connections` / `review_platform_connections` → blijven werken.
- `verify-domain`: schrijft via service-role naar `tenant_domains` → blijft werken. Toevoegen van requireRole alleen blokkeert end-user toegang, niet de service-role internals.

---

## 8. Voorgestelde sub-volgorde 2B1

1. **2B1a — Tabellen-RLS** (één migration):
   - Drop legacy policies op alle 8 tabellen.
   - Hercreëer per Pattern A / B hierboven.
   - **Speciale aandacht**: review_platform_connections anon-SELECT droppen, tenant_oauth_credentials SELECT verstrengen.
2. **2B1b — Edge-function role-checks**: alle functies uit §5, plus toml-completion.
3. **2B1c — Frontend gating** (Hoofdstuk 4): Hide/disable connect/disconnect/test buttons voor non-tenant_admin via `useCan` of `PermissionGate`.

---

## 9. Open beslispunten

| # | Vraag | Voorstel |
|---|---|---|
| 1 | Mag staff `test-*-connection` draaien? | **Nee, tenant_admin only.** Test-calls kunnen rate-limits triggeren of (bij faal) credentials in errors lekken. |
| 2 | Mag accountant `check-connect-status` zien? | Voorstel: nee — alleen `tenant_admin` en `staff`. Accountant heeft geen reden om payouts-status te kennen; financial reporting gaat via invoices/credit_notes. |
| 3 | `tenant_oauth_credentials.SELECT` — alle rollen of alleen admin? | **Alleen tenant_admin.** UI-wizards (Meta/WhatsApp/Social) zijn admin-only routes; geen runtime-reader buiten admin. |
| 4 | `disconnect-stripe-account` huidige `tenant_users.role='owner'` check vervangen? | Ja — `owner` is een `tenant_users.role` (lid-rol), niet een `app_role`. Eenduidig naar `requireRole(['tenant_admin'])` migreren, dat is consistent met de matrix. |
| 5 | `shopify_connection_requests` insert door staff/viewer? | Beperken tot tenant_admin — request triggert een platform-admin handmatige actie, alleen admin moet kunnen aanvragen. |

---

## 10. Volgende stap

Bevestig §9 beslispunten, dan kan 2B1a (RLS-migration) geïmplementeerd worden.