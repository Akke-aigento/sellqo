-- EVENT-COIN-1 — 16 oktober 2026
-- Annuleren of volledig terugbetalen van een order blokkeert voortaan ook de
-- muntenkaart (token_wallets) van die order. Tot nu toe raakte de trigger
-- trg_orders_cancel_tickets (FONSKE-READY-1) alleen ticket_instances; de munten
-- bleven bruikbaar aan de bar tot de winkel ze handmatig blokkeerde.
--
-- Wat er gebeurt:
--   - Zelfde trigger, zelfde WHEN-voorwaarde (status -> cancelled, of
--     payment_status -> refunded). Deze migratie raakt de trigger zelf niet,
--     alleen de functie erachter.
--   - Een kaart met status 'active' gaat naar 'blocked': exact wat de knop
--     Blokkeren in Events -> Munten -> Kaarten doet (useSetWalletBlocked:
--     status active -> blocked + updated_at). spend_tokens weigert dan met
--     'wallet_blocked'; de barscanner en de klantenpagina herkennen die status al.
--   - Saldo en token_transactions blijven onaangeroerd: wat gebruikt is, blijft
--     gebruikt; het resterende saldo is niet meer bruikbaar.
--   - Kaarten met 'refund_requested', 'refunded' of al 'blocked' blijven zoals ze
--     zijn (de muntenterugbetaling loopt via returns + sync_wallet_from_return).
--   - partially_refunded: de WHEN-voorwaarde vuurt niet, er verandert niets.
--   - Tickets en munten zitten elk in een eigen exception-blok: een fout bij de
--     munten draait de tickets niet terug, en geen van beide blokkeert ooit de
--     annulering zelf.
--   - Terugzetten van een order heropent de kaart NIET (zoals bij tickets). De
--     winkel kan de kaart met Vrijgeven weer actief maken.
--
-- Idempotent: CREATE OR REPLACE + snapshot met ON CONFLICT DO NOTHING (de
-- snapshot bewaart dus altijd de definitie van vóór de eerste run).
--
-- Handmatig terugdraaien (vorige definitie = FONSKE-READY-1):
--   select definition from ops.event_coin_1_prev_functions
--    where proname = 'trg_orders_cancel_tickets';
--   -- en die definitie uitvoeren. De trigger zelf hoeft niet opnieuw.
--   Al geblokkeerde kaarten worden daarbij niet vrijgegeven; dat doe je per kaart
--   met Vrijgeven (of: update token_wallets set status = 'active' where id = ...).

-- ── 0. Snapshot van de huidige functiedefinitie ──────────────────────────────
create schema if not exists ops;
create table if not exists ops.event_coin_1_prev_functions (
  proname text primary key,
  definition text not null,
  saved_at timestamptz not null default now()
);
revoke all on ops.event_coin_1_prev_functions from anon, authenticated;
insert into ops.event_coin_1_prev_functions (proname, definition)
select p.proname, pg_get_functiondef(p.oid)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'trg_orders_cancel_tickets'
on conflict (proname) do nothing;

-- ── 1. Tickets én munten vervallen bij annuleren of volledige terugbetaling ──
create or replace function public.trg_orders_cancel_tickets()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_new_status text;
begin
  -- Tickets (FONSKE-READY-1, ongewijzigd).
  begin
    v_new_status := case when new.payment_status::text = 'refunded' then 'refunded' else 'cancelled' end;
    update public.ticket_instances
       set status = v_new_status
     where order_id = new.id
       and status = 'valid';
  exception when others then
    raise warning 'trg_orders_cancel_tickets failed for order %: %', new.id, sqlerrm;
  end;

  -- Munten (EVENT-COIN-1): zelfde statusovergang als de knop Blokkeren.
  -- Saldo en transacties blijven staan.
  begin
    update public.token_wallets
       set status = 'blocked',
           updated_at = now()
     where order_id = new.id
       and status = 'active';
  exception when others then
    raise warning 'trg_orders_cancel_tickets (munten) failed for order %: %', new.id, sqlerrm;
  end;

  return null;
end;
$function$;
