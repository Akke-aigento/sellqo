-- DEMO-1 — nachtelijke reset van de publieke demowinkels (Pizzeria Fiamma, Atelier Nord).
--
-- Prospects bestellen op de demo's. Zonder reset raakt de voorraad op, blijft het
-- keukenscherm vol oude bonnen staan en stapelen klantgegevens van bezoekers zich op.
-- Alleen tenants in ops.demo_shops worden aangeraakt; echte tenants nooit.
-- Schema ops, niet public: zo is de functie niet via PostgREST aan te roepen.

create schema if not exists ops;

create table if not exists ops.demo_shops (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  note text,
  created_at timestamptz not null default now()
);

-- Voorraad zoals de demo hoort te staan (de reset zet hem terug).
create table if not exists ops.demo_stock (
  tenant_id uuid not null,
  product_id uuid not null,
  variant_id uuid,
  stock integer not null
);
create unique index if not exists demo_stock_uniq on ops.demo_stock (product_id, coalesce(variant_id, '00000000-0000-0000-0000-000000000000'::uuid));

revoke all on ops.demo_shops, ops.demo_stock from anon, authenticated;

create or replace function ops.reset_demo_shops(retention interval default interval '14 days')
returns jsonb
language plpgsql
security definer
set search_path = public, ops
as $$
declare
  r jsonb := '{}'::jsonb;
  n integer;
  demo uuid[];
begin
  select coalesce(array_agg(tenant_id), '{}') into demo from ops.demo_shops;
  if cardinality(demo) = 0 then return jsonb_build_object('skipped', 'no demo shops'); end if;

  -- 1. Voorraad terug naar de basisstand.
  update products p set stock = s.stock, updated_at = now()
    from ops.demo_stock s
   where s.variant_id is null and s.product_id = p.id and p.tenant_id = any(demo) and p.stock is distinct from s.stock;
  get diagnostics n = row_count; r := r || jsonb_build_object('products_restocked', n);

  update product_variants v set stock = s.stock, updated_at = now()
    from ops.demo_stock s
   where s.variant_id = v.id and v.tenant_id = any(demo) and v.stock is distinct from s.stock;
  get diagnostics n = row_count; r := r || jsonb_build_object('variants_restocked', n);

  -- 2. Keukenscherm leeg: open bonnen ouder dan 12 uur afgerond.
  update kitchen_tickets set status = 'done', status_at = now(), updated_at = now()
   where tenant_id = any(demo) and status in ('new', 'preparing', 'ready') and created_at < now() - interval '12 hours';
  get diagnostics n = row_count; r := r || jsonb_build_object('tickets_closed', n);

  -- Webshoporders zonder bon (nooit aangeraakt in de keuken) krijgen een afgeronde bon.
  insert into kitchen_tickets (tenant_id, source, order_id, service_type, requested_time, customer_label, status, status_at)
  select o.tenant_id, 'webshop', o.id, o.service_type, o.requested_time, o.customer_name, 'done', now()
    from orders o
   where o.tenant_id = any(demo) and o.service_type is not null and o.created_at < now() - interval '12 hours'
     and not exists (select 1 from kitchen_tickets k where k.order_id = o.id);
  get diagnostics n = row_count; r := r || jsonb_build_object('tickets_added_done', n);

  -- 3. Gegevens van bezoekers niet bewaren: orders, kassaverkopen en klanten ouder dan de bewaartermijn weg.
  delete from packing_slips where order_id in (select id from orders where tenant_id = any(demo) and created_at < now() - retention);
  delete from loyalty_transactions where order_id in (select id from orders where tenant_id = any(demo) and created_at < now() - retention);
  update quotes set converted_order_id = null where converted_order_id in (select id from orders where tenant_id = any(demo) and created_at < now() - retention);
  delete from kitchen_tickets where tenant_id = any(demo) and created_at < now() - retention;
  delete from pos_transactions pt where pt.tenant_id = any(demo) and pt.created_at < now() - retention
    and not exists (select 1 from gift_cards g where g.pos_transaction_id = pt.id);
  delete from orders where tenant_id = any(demo) and created_at < now() - retention
    and not exists (select 1 from ticket_instances t where t.order_id = orders.id);
  get diagnostics n = row_count; r := r || jsonb_build_object('orders_purged', n);

  delete from customers c where c.tenant_id = any(demo) and c.created_at < now() - retention
    and not exists (select 1 from orders o where o.customer_id = c.id)
    and not exists (select 1 from quotes q where q.customer_id = c.id)
    and not exists (select 1 from credit_notes x where x.customer_id = c.id)
    and not exists (select 1 from proforma_invoices x where x.customer_id = c.id);
  get diagnostics n = row_count; r := r || jsonb_build_object('customers_purged', n);

  delete from storefront_carts where tenant_id = any(demo) and created_at < now() - interval '2 days';
  get diagnostics n = row_count; r := r || jsonb_build_object('carts_purged', n);

  return r;
end;
$$;

revoke all on function ops.reset_demo_shops(interval) from public, anon, authenticated;

-- Elke nacht om 04:07 Brussel (02:07 UTC zomer, 03:07 UTC winter: één run per nacht volstaat).
select cron.unschedule('reset-demo-shops-daily') where exists (select 1 from cron.job where jobname = 'reset-demo-shops-daily');
select cron.schedule('reset-demo-shops-daily', '7 2 * * *', $cron$select ops.reset_demo_shops()$cron$);
