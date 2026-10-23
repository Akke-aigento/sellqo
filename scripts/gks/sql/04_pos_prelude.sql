-- TAFEL-2 — pos_terminals/pos_sessions/pos_transactions zoals live (kolommen, defaults, de
-- triggers voor bonnummer en voorraad), plus decrement_stock/record_transaction als logboek.
create table if not exists public.pos_terminals (id uuid primary key default gen_random_uuid(), tenant_id uuid not null, name text not null default 'Kassa', settings jsonb default '{}'::jsonb, last_seen_at timestamptz);
create table if not exists public.pos_sessions (id uuid primary key default gen_random_uuid(), tenant_id uuid not null, terminal_id uuid not null, opened_by uuid not null, opened_at timestamptz not null default now(), opening_cash numeric not null default 0, notes text, status text not null default 'open');
create table if not exists public.pos_cash_movements (id uuid primary key, tenant_id uuid not null, session_id uuid not null, terminal_id uuid not null, user_id uuid not null, movement_type text not null check (movement_type in ('in','out','adjustment')), amount numeric not null, reason text not null, notes text, created_at timestamptz not null default now());
create table if not exists public.pos_transactions (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, order_id uuid, session_id uuid, terminal_id uuid not null, cashier_id uuid not null,
  customer_id uuid, payments jsonb not null default '[]'::jsonb, cash_received numeric, cash_change numeric, stripe_payment_intent_id text, stripe_reader_id text,
  card_brand text, card_last4 text, subtotal numeric not null default 0, discount_total numeric not null default 0, tax_total numeric not null default 0,
  total numeric not null default 0, items jsonb not null default '[]'::jsonb, status text not null default 'completed', receipt_number text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), pos_cashier_id uuid);
create table if not exists public.test_stock_log (product_id uuid, qty int);
create table if not exists public.test_usage_log (tenant_id uuid, kind text);
create or replace function public.decrement_stock(p_product_id uuid, p_quantity integer) returns void language plpgsql security definer as $$
begin
  if p_product_id is null then raise exception 'decrement_stock zonder product'; end if;
  insert into public.test_stock_log values (p_product_id, p_quantity);
end $$;
create or replace function public.record_transaction(p_tenant_id uuid, p_transaction_type text, p_order_id uuid) returns void language plpgsql security definer as $$
begin insert into public.test_usage_log values (p_tenant_id, p_transaction_type); end $$;
create or replace function public.generate_pos_receipt_number() returns trigger language plpgsql as $$
begin new.receipt_number := to_char(now(), 'YYYYMMDD') || '-' || lpad(((select count(*) from public.pos_transactions where tenant_id = new.tenant_id) + 1)::text, 4, '0'); return new; end $$;
create trigger generate_receipt_number before insert on public.pos_transactions for each row when (new.receipt_number is null) execute function public.generate_pos_receipt_number();
create or replace function public.handle_pos_transaction_stock() returns trigger language plpgsql as $$
declare item record;
begin
  if new.status = 'completed' and (tg_op = 'INSERT' or old.status is distinct from 'completed') then
    for item in select * from jsonb_array_elements(new.items) as i loop
      perform public.decrement_stock((item.value->>'product_id')::uuid, (item.value->>'quantity')::integer);
    end loop;
  end if;
  return new;
end $$;
create trigger pos_transaction_stock_trigger after insert or update on public.pos_transactions for each row execute function public.handle_pos_transaction_stock();
