-- KASSA-0.6 — product snel aanpassen op de kassa: "op voor vandaag" / terug, en de prijs.
--
-- Enkel met de goedkeuring van een eigenaar of verantwoordelijke (pos_cashiers.role
-- owner/manager): die geeft zijn PIN in, ook als een ober de wijziging start. De server
-- controleert PIN en rol (zelfde lockout als kassa_staff_login: 5 foute pogingen = 5 minuten
-- slot, elke foute PIN in het audit-spoor). Het scherm beslist niets.
-- Elke wijziging komt in het append-only fiscal_audit_log (goedkeurder, wie ze startte,
-- welk toestel, oude en nieuwe prijs).
-- Raakt geen fiscale events: een prijs staat per lijn in de rekening; open rekeningen
-- houden de prijs waaraan ze aangeslagen werden.
--
-- Strikt additief: één nieuwe functie. Handmatig terugdraaien:
--   drop function if exists public.kassa_product_quick_edit(uuid, text, jsonb);

create or replace function public.kassa_product_quick_edit(p_tenant_id uuid, p_device_id text, p jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare
  c public.pos_cashiers%rowtype;
  v_staff uuid;
  v_by uuid;
  v_product uuid;
  v_old numeric;
  v_new numeric;
  v_until timestamptz;
  v_old_until timestamptz;
  v_changed jsonb := '{}'::jsonb;
begin
  if not public.has_tenant_role(p_tenant_id, array['tenant_admin', 'staff']::public.app_role[]) then
    raise exception 'geen toegang' using errcode = '42501';
  end if;
  if jsonb_typeof(coalesce(p, 'null'::jsonb)) <> 'object' then
    raise exception 'geen wijziging' using errcode = '22023';
  end if;
  if coalesce(p ->> 'approver_id', '') !~ '^[0-9a-f-]{36}$' or coalesce(p ->> 'product_id', '') !~ '^[0-9a-f-]{36}$' then
    raise exception 'goedkeurder en product zijn verplicht' using errcode = '22023';
  end if;
  -- Wie de wijziging startte (de medewerker met de PIN op het toestel); enkel voor het spoor.
  if coalesce(p ->> 'staff_id', '') ~ '^[0-9a-f-]{36}$' then
    select x.id into v_by from public.pos_cashiers x where x.id = (p ->> 'staff_id')::uuid and x.tenant_id = p_tenant_id;
  end if;
  select * into c from public.pos_cashiers x where x.id = (p ->> 'approver_id')::uuid and x.tenant_id = p_tenant_id for update;
  -- Zoals kassa_staff_login: enkel een actieve medewerker die de kassa mag gebruiken.
  if c.id is null or not c.is_active or not coalesce(c.can_use_pos, true) then raise exception 'onbekende medewerker' using errcode = '22023'; end if;
  if c.role not in ('owner', 'manager') then
    raise exception 'enkel een eigenaar of verantwoordelijke' using errcode = '42501';
  end if;
  if c.locked_until is not null and c.locked_until > now() then
    raise exception 'pin geblokkeerd tot %', c.locked_until using errcode = '28000';
  end if;
  if coalesce(p ->> 'pin', '') = '' or c.pin_hash is null or c.pin_hash <> crypt(p ->> 'pin', c.pin_hash) then
    -- Zelfde lockout als kassa_staff_login. Geen exception: anders rolt de teller terug.
    update public.pos_cashiers set
      failed_pin_attempts = case when c.failed_pin_attempts + 1 >= 5 then 0 else c.failed_pin_attempts + 1 end,
      locked_until = case when c.failed_pin_attempts + 1 >= 5 then now() + interval '5 minutes' else null end
    where id = c.id;
    insert into public.fiscal_audit_log (tenant_id, actor_id, device_id, action, details)
      values (p_tenant_id, auth.uid(), left(coalesce(p_device_id, ''), 120), 'pin_failed', jsonb_build_object('staff_id', c.id, 'attempt', c.failed_pin_attempts + 1, 'context', 'product_edit'));
    return jsonb_build_object('ok', false, 'reason', case when c.failed_pin_attempts + 1 >= 5 then 'locked' else 'wrong_pin' end);
  end if;
  update public.pos_cashiers set failed_pin_attempts = 0, locked_until = null where id = c.id and (failed_pin_attempts <> 0 or locked_until is not null);
  v_staff := c.id;
  select pr.id, pr.price, pr.sold_out_until into v_product, v_old, v_old_until
    from public.products pr where pr.id = (p ->> 'product_id')::uuid and pr.tenant_id = p_tenant_id
    for update;
  if v_product is null then raise exception 'onbekend product' using errcode = '22023'; end if;
  v_new := v_old;
  v_until := v_old_until;

  if p ? 'price' then
    if coalesce(p ->> 'price', '') !~ '^[0-9]{1,5}(\.[0-9]{1,2})?$' then
      raise exception 'prijs tussen 0 en 99999,99' using errcode = '22023';
    end if;
    v_new := (p ->> 'price')::numeric;
  end if;
  if p ? 'sold_out' then
    if jsonb_typeof(p -> 'sold_out') <> 'boolean' then raise exception 'sold_out: waar of onwaar' using errcode = '22023'; end if;
    -- Zelfde reset als "op voor vandaag" in de admin (set_product_sold_out_today).
    v_until := case when (p ->> 'sold_out')::boolean then public.sold_out_reset_at() else null end;
  end if;
  if not (p ? 'price') and not (p ? 'sold_out') then
    raise exception 'geen wijziging' using errcode = '22023';
  end if;

  update public.products set price = v_new, sold_out_until = v_until
    where id = v_product and (price is distinct from v_new or sold_out_until is distinct from v_until);
  if found then
    if v_new is distinct from v_old then v_changed := v_changed || jsonb_build_object('old_price', v_old, 'new_price', v_new); end if;
    if v_until is distinct from v_old_until then v_changed := v_changed || jsonb_build_object('sold_out', v_until is not null); end if;
    insert into public.fiscal_audit_log (tenant_id, actor_id, device_id, action, details)
      values (p_tenant_id, auth.uid(), left(coalesce(p_device_id, ''), 120), 'kassa_product_edit',
        v_changed || jsonb_build_object('product_id', v_product, 'approver_id', v_staff, 'staff_id', coalesce(v_by, v_staff)));
  end if;
  return jsonb_build_object('ok', true, 'id', v_product, 'price', v_new, 'sold_out_until', v_until);
end;
$$;
revoke all on function public.kassa_product_quick_edit(uuid, text, jsonb) from public, anon;
grant execute on function public.kassa_product_quick_edit(uuid, text, jsonb) to authenticated;
