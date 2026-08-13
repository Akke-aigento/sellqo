---
name: Nieuwe public-tabellen krijgen stil anon-grants
description: Default privileges in dit project geven anon+authenticated volledige rechten op elke nieuwe public-tabel; expliciet REVOKE nodig
type: constraint
---
In dit project bestaan default privileges op schema `public` die **elke nieuwe tabel** automatisch volledige rechten geven aan `anon` én `authenticated` (SELECT/INSERT/UPDATE/DELETE/TRIGGER/TRUNCATE/REFERENCES/MAINTAIN) — ook zonder expliciete GRANT in de migratie.

**Why:** vastgesteld bij TICKET-1 (13 aug 2026): `event_details`, `ticket_instances` en `ticket_change_tokens` hadden na `CREATE TABLE` volledige anon-rechten. RLS blokkeerde de rijen, maar grant-laag en policy-laag spraken elkaar tegen.

**How to apply:** na elke `CREATE TABLE` in `public` expliciet `REVOKE ALL ON public.<tabel> FROM anon;` (en van `authenticated` waar niet bedoeld), daarna gericht de wél bedoelde GRANTs zetten. Verifieer altijd via `aclexplode(pg_class.relacl)` — niet via `information_schema.role_table_grants`, die geeft hier `NULL`.

Tweede valkuil: `public.get_user_tenant_ids` heeft twee overloads (zonder args en `_user_id uuid`); `SELECT public.get_user_tenant_ids()` faalt met `42725 not unique`. Gebruik altijd `public.get_user_tenant_ids(auth.uid())`.
