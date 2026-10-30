-- AI-AGENT-2 (30-10-2026) — kostprijs per orderregel bewaren op het moment van verkoop.
-- Zonder dit is elke winstberekening een schatting met de HUIDIGE kostprijs. Vanaf nu legt een
-- trigger de kostprijs (variant, anders product) vast bij elke nieuwe orderregel, ongeacht het
-- kanaal (webshop, kassa, bol, import), zonder één codepad te moeten aanpassen.
-- Additief: nieuwe kolom, geen backfill (historiek blijft "onbekend" en de assistent zegt dat).
-- Klant-API's selecteren vaste kolommen uit order_items (storefront-customer-api:325), dus de
-- kostprijs lekt niet naar klanten.
-- Handmatig terugdraaien:
--   drop trigger if exists trg_order_items_cost_snapshot on public.order_items;
--   drop function if exists public.order_items_cost_snapshot();
--   alter table public.order_items drop column if exists cost_price;
alter table public.order_items add column if not exists cost_price numeric;
comment on column public.order_items.cost_price is
  'AI-AGENT-2: kostprijs (excl. btw) per stuk op het moment van verkoop; gezet door trg_order_items_cost_snapshot.';

create or replace function public.order_items_cost_snapshot()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_tenant uuid;
begin
  if new.cost_price is null then
    -- Enkel producten/varianten van de winkel van de bestelling: RLS op order_items controleert
    -- de order, niet product_id/variant_id. Zonder deze check kon een security-definer-trigger de
    -- kostprijs van een andere winkel in een eigen orderregel kopiëren (review AI-AGENT-2).
    select o.tenant_id into v_tenant from public.orders o where o.id = new.order_id;
    if v_tenant is null then return new; end if;
    if new.variant_id is not null then
      select v.cost_price into new.cost_price from public.product_variants v
       where v.id = new.variant_id and v.tenant_id = v_tenant;
    end if;
    if new.cost_price is null and new.product_id is not null then
      select p.cost_price into new.cost_price from public.products p
       where p.id = new.product_id and p.tenant_id = v_tenant;
    end if;
  end if;
  return new;
end
$fn$;
revoke all on function public.order_items_cost_snapshot() from public, anon, authenticated;

drop trigger if exists trg_order_items_cost_snapshot on public.order_items;
create trigger trg_order_items_cost_snapshot
  before insert on public.order_items
  for each row execute function public.order_items_cost_snapshot();
