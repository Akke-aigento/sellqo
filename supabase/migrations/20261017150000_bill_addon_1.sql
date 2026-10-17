-- BILL-ADDON-1 + BILL-TERM-1 — add-ons en kassa-ticketfees op de platformfactuur,
-- minimale looptijd voor Events Vast. Keuzes Akke 17-10: add-on halverwege = pro rata
-- (zoals upgrades), add-on stoppen = einde betaalde periode, kassa-fees bij Flex zonder
-- abonnement = maandelijkse verbruiksfactuur vanaf €5, Vast opzeggen binnen de termijn
-- = loopt door tot het contracteinde.
-- Live gedraaid via query_database op 17-10-2026. Additief en idempotent.

-- 1. Soort regel op het facturatieabonnement. Bestaande regels zijn allemaal planregels.
alter table public.subscription_lines add column if not exists kind text not null default 'plan';
alter table public.subscription_lines add column if not exists addon_id text references public.platform_addons(id);
alter table public.subscription_lines add column if not exists end_date date;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'subscription_lines_kind_valid') then
    alter table public.subscription_lines add constraint subscription_lines_kind_valid check (kind in ('plan', 'addon'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'subscription_lines_addon_needs_id') then
    alter table public.subscription_lines add constraint subscription_lines_addon_needs_id check (kind <> 'addon' or addon_id is not null);
  end if;
end $$;
create unique index if not exists subscription_lines_one_addon_per_sub
  on public.subscription_lines (subscription_id, addon_id) where kind = 'addon';

-- 2. De regels die een cyclus aanrekende (plan, add-ons, ticketkosten), voor een gespecificeerde factuur.
alter table public.billing_cycles add column if not exists lines jsonb;

-- 3. Welke cyclus een kassa-ticketfee aanrekent (nooit dubbel, nooit gemist).
alter table public.platform_ticket_fees add column if not exists billing_cycle_id uuid references public.billing_cycles(id);
create index if not exists platform_ticket_fees_unbilled_idx
  on public.platform_ticket_fees (tenant_id) where collected_via = 'invoice' and billing_cycle_id is null;

-- 4. Contracteinde (Events Vast: 12 maanden).
alter table public.tenant_subscriptions add column if not exists commitment_end_at timestamptz;
