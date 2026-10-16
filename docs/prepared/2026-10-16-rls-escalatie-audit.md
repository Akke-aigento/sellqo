# RLS-escalatie-audit SellQo — 16 oktober 2026

Read-only audit op het live project `9932a7fe-…` via `query_database`. Alle schrijftests liepen in `begin; … rollback;` met rol-impersonatie (`set local role authenticated|anon|service_role` + `request.jwt.claims`). Er is niets gecommit, er zijn geen edge functions aangeroepen en er is geen code gewijzigd. De eindcontrole staat onderaan.

Testgebruikers:
- Mancini, tenant_admin: `a183cd15-…` (tenant `2606c5b9-…`)
- VanXcel, tenant_admin: `c3f57cdc-…` (tenant `54f6b480-…`)
- VanXcel, marketing: `48ab6f43-400c-469f-afa4-370fab1dc5f6`. Dit is de enige niet-admin-teamgebruiker. Er bestaat geen staff- of accountant-gebruiker.
- Akke, platform_admin: `be6f2a43-…`
- anon

## Samenvatting, geprioriteerd

| # | Ernst | Vondst | Bewijs |
|---|---|---|---|
| 1 | **KRITIEK** | Een tenant_admin kan zichzelf `platform_admin` maken via `UPDATE user_roles` | 1 rij gewijzigd; daarna `is_platform_admin = true`, 24 tenants zichtbaar, 148 VanXcel-orders leesbaar |
| 2 | **KRITIEK** | Een tenant_admin kan een uitnodiging met rol `platform_admin` maken. `accept-team-invitation` kent die rol daarna met service_role toe | Direct insert lukt (status pending). `send-team-invitation` valideert `role` niet (code) |
| 3 | **HOOG** | Elke ingelogde gebruiker kan een nieuwe winkel aanmaken met `billing_exempt`, `is_internal_tenant` en `subscription_status='active'` | INSERT ok, rij heeft exempt=true en internal=true. SEC-BILL-1 dekt alleen UPDATE |
| 4 | **HOOG (regressie in de voorbereide fix)** | SEC-BILL-1, zoals voorbereid, breekt het aanmaken van een winkel buiten de edge function (direct-insert-fallback in `useOnboarding`) | Gewone onboarding-insert geeft `42501 Deze instelling kan alleen SellQo wijzigen` |
| 5 | MIDDEL | Een tenant_admin kan `user_id` van rollen in zijn winkel omhangen naar een willekeurig account. Zo kan de VanXcel-admin ook Akke's tenant_admin-rij op VanXcel kapen of verwijderen | 1 rij gewijzigd |
| 6 | MIDDEL/LAAG | `tenant_domains`: een tenant_admin kan een vreemd, nog niet gekoppeld domein claimen met `dns_verified=true` en `ssl_active=true`. De resolve-functies controleren `dns_verified` niet | INSERT `loveke.be` ok |
| 7 | LAAG | `tenants`: platformachtige kolommen buiten SEC-BILL-1 blijven schrijfbaar: `custom_domain`, `ssl_status`, `domain_verification_token`, `lifetime_*`, `inbound_email_prefix`, `slug` | 1 rij gewijzigd. Prefix van een andere winkel overnemen faalt op de unique-index |
| 8 | LAAG | `billing_cycles`: de policy "Tenant members can delete billing cycles" staat niet in SEC-BILL-1 | Vandaag 0 rijen, want platformcycli staan onder tenant `sellqo` |
| 9 | INFO | Self-insert van analytics/gamification (`feature_usage_events`, `ai_usage_log`, `tenant_milestones`, `tenant_badges`). `record_transaction` mag door leden voor de eigen winkel aangeroepen worden | Treft alleen de eigen winkel |

Ketting voor 1 en 2: `can_create_tenant` laat **elke geregistreerde gebruiker** een eigen winkel aanmaken. De trigger `assign_tenant_admin_role_on_tenant_insert` maakt hem daar dan tenant_admin. Vondst 1 is dus bereikbaar voor iedereen die een account kan aanmaken: signup → winkel aanmaken → eigen rol op `platform_admin` zetten → volledige toegang tot alle tenants, facturatie, credits en instellingen.

Er zijn geen sporen van misbruik:
- Er bestaat 1 `platform_admin`-rij (Akke, `tenant_id` null).
- 0 van de 13 uitnodigingen ooit hadden rol `platform_admin`.
- De 16 vrijgestelde of interne winkels zijn allemaal van Akke of demo's: sellqo, studio-akke, loveke, vanxcel, fonske-crawl, demo-*.

## Wat goed zit (bewezen, verwachte 0)

**Platformtabellen als Mancini-admin:**

| Tabel | Actie | Uitkomst |
|---|---|---|
| `tenant_subscriptions` | UPDATE | 0 |
| `pricing_plans` | UPDATE | 0 |
| `platform_settings` | UPDATE | 0 |
| `tenant_feature_overrides` | INSERT | 42501 |
| `tenant_transaction_usage` | UPDATE / DELETE | 0 / 0 |
| `platform_coupons` | UPDATE | 0 |
| `tenant_ai_credits` | UPDATE | 42501 (SEC-NIGHT-3 werkt) |
| `user_roles` | INSERT `platform_admin` | 42501 |

**Cross-tenant:** Mancini-admin las en wijzigde VanXcel-rijen in 18 tabellen. Het resultaat was overal SELECT 0 en UPDATE 0, terwijl VanXcel zelf wel rijen heeft:

| Tabel | Rijen bij VanXcel |
|---|---|
| orders | 148 |
| customers | 158 |
| products | 48 |
| invoices | 167 |
| discount_codes | 1 |
| tenant_oauth_credentials | 1 |
| marketplace_connections | 1 |
| tenant_domains | 3 |
| user_roles | 4 |

Ook getest, maar zonder rijen bij VanXcel: gift_cards, storefront_api_keys, subscriptions, ticket_instances, token_wallets, customer_payment_mandates, tenant_printful_settings en fulfillment_api_keys.

Uitzondering: `legal_pages` gaf 7/7 leesbaar en 0 schrijfbaar. Dat zijn publieke juridische pagina's en is zo bedoeld.

**De marketinggebruiker (VanXcel) kan niets escaleren:**

| Poging | Uitkomst |
|---|---|
| eigen rol naar `platform_admin` | 0 |
| eigen rol naar `tenant_admin` | 0 |
| uitnodiging maken | 42501 |
| `tenants` wijzigen | 0 |
| zichzelf een permission grant geven | 42501 |
| facturen wijzigen | 0 |

**anon:**
- UPDATE `tenants` en `user_roles` gaf 0. INSERT `tenant_domains` gaf 42501.
- SELECT op user_roles, tenants, storefront_api_keys, team_invitations, customers en orders gaf overal 0.
- Uitzondering: `tenant_domains` is leesbaar (3 rijen). Dat staat al als vervolg in SEC-NIGHT-2.
- De enige anon-schrijfpolicy is `ai_chatbot_conversations` INSERT, en die is zo bedoeld.
- Er zijn geen tabellen zonder RLS die anon kan schrijven. De warehouse- en ads-views draaien met `security_invoker=on`.

**Facturen:** de SellQo-platformfacturatie (facturen, `billing_cycles`, abonnementen aan winkels) hangt aan tenant `sellqo` (`d03c63fe-…`). Daar is alleen Akke lid van. De tenant-policies op `invoices` en `billing_cycles` geven een andere winkel dus geen toegang tot platformfacturen. Na vondst 1 natuurlijk wel.

---

## Vondst 1 — KRITIEK — tenant_admin → platform_admin via user_roles UPDATE

**Policy:** `"Tenant admins can update roles in their tenant"` (UPDATE, authenticated)
- USING / WITH CHECK: `is_platform_admin(auth.uid()) OR has_tenant_role(tenant_id, ARRAY['tenant_admin'])`.
- De `role`-kolom wordt niet beperkt.
- `is_platform_admin()` kijkt alleen naar `role='platform_admin'`, ongeacht `tenant_id`. `has_tenant_role` en `get_user_tenant_ids` doen hetzelfde.

**Bewijs** (rollback, als Mancini):
```
update user_roles set role='platform_admin' where id='3d354b0f-…'   → 1 rij
is_platform_admin(auth.uid())                                       → true
count(*) from get_user_tenant_ids(auth.uid())                       → 24
count(*) from orders where tenant_id = VanXcel                      → 148
```
`tenant_id` op null zetten of de rij naar VanXcel verhuizen faalt wel (42501). Dat hoeft ook niet: platform_admin met `tenant_id` = Mancini volstaat.

**Legitiem gebruik:** `src/hooks/useTeamMembers.ts:101-110`, `updateMemberRole`. Het UI biedt alleen tenant-rollen aan (`TeamSettings.tsx:79`). Geen enkele code kent ooit `platform_admin` toe: rg vond 0 hits op `role: 'platform_admin'` in src en supabase/functions. `create-tenant` en `repair-tenant-access` zetten alleen `tenant_admin`.

**Fix:** zie het gecombineerde SQL-blok onderaan: de trigger `user_roles_guard`.

## Vondst 2 — KRITIEK — platform_admin via een uitnodiging

**Policy:** `"Admins can manage invitations"` (ALL, authenticated). Een tenant_admin van de winkel mag elke rij maken, en `role` is de volledige `app_role`-enum.

**Bewijs** (rollback, als Mancini): een INSERT in `team_invitations` met `role='platform_admin'` lukt (rij `platform_admin status=pending`).

**Code:**
- `supabase/functions/send-team-invitation/index.ts:46,121`: `role` komt ongevalideerd uit de request body en gaat zo in de insert (service_role). Het TS-type `'tenant_admin'|'staff'|…` is geen runtimecheck.
- `supabase/functions/accept-team-invitation/index.ts:~88-95`: doet `insert user_roles { role: invitation.role }` met service_role. RLS speelt hier dus geen rol.
- De ketting: nodig je eigen tweede e-mailadres uit met `platform_admin`, accepteer, en je bent platform_admin. Ik heb de edge functions bewust **niet** aangeroepen: dit deel is via de code bewezen.

**Fix:**
- DB: `CHECK (role <> 'platform_admin')` op `team_invitations`, en de trigger `user_roles_guard` die ook service_role blokkeert voor `platform_admin`.
- Edge: een allowlist `['tenant_admin','staff','accountant','warehouse','viewer','marketing']` in `send-team-invitation` en `accept-team-invitation`. Daarvoor is een deploy nodig.

## Vondst 3 — HOOG — winkel aanmaken met platformvlaggen (INSERT-gat)

**Policy:** `"Authenticated users can insert their own tenant"` (INSERT, with_check `can_create_tenant(auth.uid(), owner_email) OR is_platform_admin`). Er zijn geen kolombeperkingen.

**Bewijs** (rollback, als Mancini, zonder RETURNING):
```
insert into tenants(name,slug,owner_email,billing_exempt,is_internal_tenant,subscription_status)
values('SEC TEST','sec-test-escalation-x1','info@mancinimilano.com',true,true,'active')  → ok
-- gevolg: billing_exempt=true internal=true status=active plan=pro; tenant_subscriptions 'pro trialing'; user_roles tenant_admin
```
SEC-BILL-1 is een trigger op `BEFORE UPDATE`. Dit pad blijft dus ook na SEC-BILL-1 open.

**Legitiem gebruik:**
- `create-tenant` (service_role) gebruikt een whitelisted `insertPayload`, r.158-171.
- De fallback in `src/hooks/useOnboarding.ts:589-592` stuurt geen vlaggen mee.
- `useTenants.ts:80` is alleen voor platform-admins en zet `subscription_plan`/`status`.

## Vondst 4 — HOOG — SEC-BILL-1 zoals voorbereid breekt het aanmaken van winkels

De trigger `create_tenant_trial_subscription` (AFTER INSERT, SECURITY DEFINER) doet `UPDATE tenants SET subscription_plan='pro'`. Een definer verandert `auth.uid()` niet: de JWT-claim blijft die van de gebruiker. De voorbereide trigger `tenants_protect_platform_columns` ziet dan `subscription_plan` wijzigen door een niet-platform-admin en weigert.

**Bewijs:** de prepared functie en trigger in een rollback geïnstalleerd, daarna als Mancini `insert into tenants(name,slug,owner_email)` → `42501 Deze instelling kan alleen SellQo wijzigen`. Met `subscription_plan='pro'` al in de insert lukte het wel, en dan ook met `billing_exempt=true` (vondst 3).

**Gevolg:** de direct-insert-fallback in `useOnboarding` (en de REST-fallback daarachter) faalt. Het primaire pad via de edge function werkt nog, want daar is `auth.uid()` null.

**Fix:** de SEC-BILL-1-trigger ook op INSERT laten lopen en de vlaggen bij INSERT forceren in plaats van weigeren. Bij UPDATE `pg_trigger_depth() > 1` doorlaten, zodat updates die uit een andere trigger komen (definer-code) werken. Zie het blok onderaan, getest.

## Vondst 5 — MIDDEL — rollen omhangen naar een ander account

Dezelfde policy als vondst 1 laat `user_id` wijzigen. Bewijs: `update user_roles set user_id='c3f57cdc-…' where id=<Mancini-rij>` → 1 rij.

Gevolg:
- Een tenant_admin kan een willekeurig account (op basis van uuid) aan zijn winkel hangen.
- Hij kan ook de rij van een ander lid wegnemen. Concreet: de VanXcel-admin kan Akke's tenant_admin-rij op VanXcel (`c87b3f41-…`) omhangen of verwijderen.
- De DELETE-policy laat sowieso toe dat een tenant_admin andere admins verwijdert. Dat is functioneel zo bedoeld (`remove-team-member`).

**Fix:** in `user_roles_guard` het wijzigen van `user_id` en `tenant_id` verbieden voor ingelogde niet-platform-admins. `updateMemberRole` wijzigt alleen `role` en blijft dus werken (getest).

## Vondst 6 — MIDDEL/LAAG — tenant_domains: zelf "geverifieerd"

**Policy:** INSERT en UPDATE voor tenant_admin, zonder kolombeperking.

**Bewijs:** `insert into tenant_domains(tenant_id,domain,dns_verified,is_active,ssl_active) values(Mancini,'loveke.be',true,true,true)` → ok.

**Gevolg:**
- Er is een unique index op `domain`, dus een bestaand domein kapen kan niet.
- Een domein dat nog niet gekoppeld is, kan wel gereserveerd worden. `loveke.be` en andere custom-frontend-domeinen staan niet in `tenant_domains`. Daarmee blokkeert een winkel de echte eigenaar.
- `storefront-resolve` (r.38-41) en `storefront-api` `resolveDomain` (r.235-238) zoeken alleen op `domain` + `is_active`, niet op `dns_verified`. Een verzoek met dat hostnaam resolvet naar de kraker.
- `dns_verified` opent ook de url_base-allowlist in `storefront-customer-api` (r.96-99). Dat raakt alleen links in mails naar de eigen klanten van de winkel.

**Legitiem gebruik:** `useTenantDomains.ts:45-50` voegt domeinen toe zonder vlaggen, en r.74 werkt locale/canonical/active bij. `verify-domain` en `check-domain-ssl` zetten de vlaggen met service_role.

**Fix:** een trigger die `dns_verified`/`ssl_active` voor een ingelogde niet-platform-admin op INSERT op false zet en een wijziging bij UPDATE weigert. De resolve-functies daarna laten filteren op `dns_verified` raakt de gedeelde contracten (eerste wet): dat vraagt een apart akkoord. De 3 VanXcel-domeinen staan alle drie op `dns_verified=true`, dus zo'n filter zou vandaag niemand raken.

## Vondst 7 — LAAG — andere tenants-kolommen

Mancini kon in één update `custom_domain='vanxcel.com'`, `ssl_status`, `domain_verification_token` en `lifetime_order_count=99999` zetten (1 rij).

- `inbound_email_prefix` naar `vanxcel` geeft `23505` (unique), dus de inbound mail van een andere winkel overnemen kan niet. Een generieke prefix claimen kan wel. `handle-inbound-email` r.461 routeert op prefix.
- `custom_domain` wordt alleen voor de eigen winkel gebruikt: mail-links en `{{website}}`.
- `lifetime_*` voedt milestones en badges, dus alleen cosmetisch.

**Aanbeveling:** `domain_verification_token`, `ssl_status`, `ssl_checked_at`, `ssl_expires_at` en `lifetime_*` toevoegen aan de beschermde lijst van SEC-BILL-1. Voor `custom_domain` eerst nagaan of het UI dat veld rechtstreeks zet. `cloudflare-api-connect` zet het, r.193.

## Vondst 8 — LAAG — billing_cycles DELETE

`"Tenant members can delete billing cycles"` (DELETE, elk lid) blijft staan na SEC-BILL-1. Vandaag zijn er 5 cycli, allemaal onder tenant `sellqo`, dus een gewone winkel raakt 0 rijen (bewezen). Neem hem mee in SEC-BILL-1 voor de consistentie: geen code doet een DELETE.

## Vondst 9 — INFO

- `feature_usage_events` / `ai_usage_log` / `tenant_milestones` / `tenant_badges` / `app_feedback`: leden kunnen rijen voor hun eigen winkel invoegen. Dat vervuilt alleen de analytics.
- `record_transaction` mag een lid voor de eigen winkel aanroepen. Dat verhoogt alleen het eigen verbruik.
- De SECURITY DEFINER-RPC's die rollen, credits of tenants raken, hebben allemaal een check. Nagelopen: `add_ai_credits`, `admin_adjust_ai_credits`, `update_tenant_fiscal_info`, `repair_orphaned_user_roles` en `record_transaction`.

---

## Gecombineerd fixvoorstel (SQL) — getest in één rollback-transactie

Dit is het voorstel voor `docs/prepared/2026101607xxxx_sec_role_1.sql` + een herziene SEC-BILL-1. Niet gedraaid.

```sql
-- SEC-ROLE-1 — platform_admin alleen via SellQo; rollen niet omhangen
create or replace function public.user_roles_guard()
 returns trigger language plpgsql security invoker   -- INVOKER: current_user moet de echte rol zijn
 set search_path to 'public', 'pg_temp'
as $f$
begin
  -- migraties / SQL-console (postgres, supabase_admin) ongemoeid
  if current_user not in ('authenticated', 'anon', 'service_role') then return new; end if;
  if auth.uid() is not null and public.is_platform_admin(auth.uid()) then return new; end if;
  -- ook service_role (accept-team-invitation, create-tenant) mag geen platform_admin toekennen
  if new.role = 'platform_admin'::app_role then
    raise exception 'De rol platform_admin kan alleen SellQo toekennen' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and auth.uid() is not null
     and (new.user_id is distinct from old.user_id or new.tenant_id is distinct from old.tenant_id) then
    raise exception 'Gebruiker of winkel van een rol wijzigen mag niet' using errcode = '42501';
  end if;
  return new;
end $f$;
drop trigger if exists user_roles_guard on public.user_roles;
create trigger user_roles_guard before insert or update on public.user_roles
  for each row execute function public.user_roles_guard();

alter table public.team_invitations drop constraint if exists team_invitations_no_platform_admin;
alter table public.team_invitations add constraint team_invitations_no_platform_admin
  check (role <> 'platform_admin'::app_role);   -- 0 bestaande rijen met platform_admin (nagemeten)

-- SEC-BILL-1 herzien: ook INSERT, en geneste trigger-updates doorlaten
create or replace function public.tenants_protect_platform_columns()
 returns trigger language plpgsql security definer set search_path to 'public', 'pg_temp'
as $function$
begin
  if auth.uid() is null or public.is_platform_admin(auth.uid()) then return new; end if;
  if tg_op = 'INSERT' then
    new.billing_exempt := false; new.billing_on_hold := false; new.is_internal_tenant := false;
    new.is_demo := false; new.subscription_status := 'trial'; new.stripe_account_id := null;
    new.stripe_onboarding_complete := false; new.stripe_charges_enabled := false;
    new.stripe_payouts_enabled := false; new.domain_verified := false;
    return new;
  end if;
  if pg_trigger_depth() > 1 then return new; end if;  -- bv. create_tenant_trial_subscription
  if new.billing_exempt is distinct from old.billing_exempt
     or new.billing_on_hold is distinct from old.billing_on_hold
     or new.is_internal_tenant is distinct from old.is_internal_tenant
     or new.is_demo is distinct from old.is_demo
     or new.subscription_plan is distinct from old.subscription_plan
     or new.subscription_status is distinct from old.subscription_status
     or new.stripe_account_id is distinct from old.stripe_account_id
     or new.stripe_onboarding_complete is distinct from old.stripe_onboarding_complete
     or new.stripe_charges_enabled is distinct from old.stripe_charges_enabled
     or new.stripe_payouts_enabled is distinct from old.stripe_payouts_enabled
     or new.domain_verified is distinct from old.domain_verified
  then raise exception 'Deze instelling kan alleen SellQo wijzigen' using errcode = '42501'; end if;
  return new;
end; $function$;
drop trigger if exists tenants_protect_platform_columns on public.tenants;
create trigger tenants_protect_platform_columns before insert or update on public.tenants
  for each row execute function public.tenants_protect_platform_columns();
drop policy if exists "Tenant members can delete billing cycles" on public.billing_cycles;  -- naast de twee uit SEC-BILL-1

-- SEC-DOMAIN-1 (niet getest, zelfde patroon) — verificatievlaggen alleen via service_role/platform
create or replace function public.tenant_domains_protect_flags()
 returns trigger language plpgsql security definer set search_path to 'public','pg_temp'
as $f$
begin
  if auth.uid() is null or public.is_platform_admin(auth.uid()) then return new; end if;
  if tg_op = 'INSERT' then new.dns_verified := false; new.ssl_active := false; return new; end if;
  if new.dns_verified is distinct from old.dns_verified or new.ssl_active is distinct from old.ssl_active
     or new.tenant_id is distinct from old.tenant_id or new.domain is distinct from old.domain then
    raise exception 'Domeinverificatie kan alleen SellQo wijzigen' using errcode = '42501';
  end if;
  return new;
end $f$;
create trigger tenant_domains_protect_flags before insert or update on public.tenant_domains
  for each row execute function public.tenant_domains_protect_flags();
```

Let op het `domain`-verbod in de domeintrigger. Controleer eerst of het UI het domein van een bestaande rij wijzigt. `useTenantDomains` r.74 stuurt `params.updates`, en die zijn niet nagelopen. Bij twijfel `domain` uit de check halen.

**Uitkomst van de rollbacktest** (user_roles_guard + team_invitations-CHECK + herziene SEC-BILL-1):

| Test | Uitkomst |
|---|---|
| Mancini: eigen rol naar `platform_admin` | `42501`; `is_platform_admin` blijft false |
| Mancini: uitnodiging `platform_admin` | `23514` (CHECK) |
| Mancini: uitnodiging `staff` | ok |
| Mancini: `billing_exempt` wijzigen | `42501` |
| Mancini: normale save (`name`, `business_modules`) | 1 rij |
| Mancini: winkel aanmaken met exempt/internal/active | ok, maar geforceerd naar `exempt=false internal=false status=trial plan=pro` |
| Mancini: gewone onboarding-insert | ok, `plan=pro status=trial` (regressie uit vondst 4 opgelost) |
| Mancini: rol omhangen naar een ander `user_id` | `42501` |
| VanXcel-admin: marketing → staff (legitiem `updateMemberRole`) | 1 rij |
| Akke: rol wijzigen / `billing_exempt` zetten | 1 / 1 |
| service_role: `platform_admin` invoegen (accept-pad) | `42501` |
| service_role: `staff` invoegen (accept-pad) | ok |

**Breekt het iets?**
- Teambeheer, uitnodigen en accepteren voor gewone rollen werken.
- Onboarding werkt, beide paden.
- Akke's platformacties werken.
- Migraties en de SQL-console blijven werken, want `current_user` = postgres.
- Een nieuwe platform-admin aanmaken kan alleen nog via SQL of door een bestaande platform-admin. Dat is gewenst.
- Bij een aanroep van `accept-team-invitation` voor een oude `platform_admin`-uitnodiging faalt de insert netjes. Er zijn er 0.

**Edge-wijzigingen** (aparte batch + deploy + vingerafdruk):
- `send-team-invitation`: `if (!ALLOWED_ROLES.includes(role)) return 400`.
- `accept-team-invitation`: dezelfde check vóór de insert, als defense in depth.
- Optioneel: `storefront-resolve` en `storefront-api` `resolveDomain` filteren op `dns_verified=true`. Dat raakt de gedeelde contracten, dus apart akkoord nodig.

## Eindcontrole — alles teruggedraaid

Query na alle tests:
```
test_tenants=0  test_invites=0  test_domains=0  domains_total=4
mancini_role_row = tenant_admin/a183cd15-…/2606c5b9-…
mkt_role = marketing   n_platform_admins = 1   mancini_is_pa = false
secbill_trigger = 0   secbill_fn = 0   (prepared SEC-BILL-1 niet achtergebleven)
mancini_tenant = custom_domain null / ssl pending / lifetime_order_count 8 / prefix mancini-milano / billing_exempt false
billing_cycles = 5   bc_policies = 4   mkt_grants = 0
```
Tweede eindcontrole, na de fixtests: triggers `user_roles_guard`/`tenants_protect_platform_columns`/`tenant_domains_protect_flags` = 0, functies = 0, constraint `team_invitations_no_platform_admin` = 0, testwinkels 0, platform_admins 1, de marketingrol nog `marketing`.
