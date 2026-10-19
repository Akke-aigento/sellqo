create or replace function public.marketing_contacts_all(p_tenant uuid)
returns table (
  email text,
  name text,
  status text,
  source text,
  status_at timestamptz,
  customer_id uuid
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  with unsub as (
    select distinct on (lower(trim(u.email)))
      lower(trim(u.email)) as e, u.email, u.reason, u.unsubscribed_at
    from public.email_unsubscribes u
    where u.tenant_id = p_tenant and u.email is not null
    order by lower(trim(u.email)), u.unsubscribed_at desc nulls last
  ),
  cust as (
    select distinct on (lower(trim(c.email)))
      lower(trim(c.email)) as e, c.id, c.email,
      nullif(trim(concat_ws(' ', c.first_name, c.last_name)), '') as name,
      c.company_name, c.email_subscribed, c.acquisition_source,
      coalesce(c.email_subscribed_at, c.created_at) as at
    from public.customers c
    where c.tenant_id = p_tenant and c.email is not null and trim(c.email) <> ''
    order by lower(trim(c.email)), c.email_subscribed desc nulls last, c.created_at desc nulls last
  ),
  pend as (
    select distinct on (lower(trim(n.email)))
      lower(trim(n.email)) as e, n.email, n.first_name, n.source,
      coalesce(n.subscribed_at, n.created_at) as at
    from public.newsletter_subscribers n
    where n.tenant_id = p_tenant and n.status = 'pending' and n.email is not null
    order by lower(trim(n.email)), n.created_at desc nulls last
  )
  select c.email, coalesce(c.name, c.company_name), 'subscribed', c.acquisition_source, c.at, c.id
  from cust c
  where c.email_subscribed is true
    and not exists (select 1 from unsub u where u.e = c.e)
  union all
  select p.email, p.first_name, 'pending', p.source, p.at, null::uuid
  from pend p
  where not exists (select 1 from unsub u where u.e = p.e)
    and not exists (select 1 from cust c where c.e = p.e and c.email_subscribed is true)
  union all
  select u.email,
         case when u.reason = 'gdpr_erasure' then null else coalesce(c.name, c.company_name) end,
         case u.reason when 'bounce' then 'bounced' when 'complaint' then 'complaint' else 'unsubscribed' end,
         coalesce(u.reason, 'unsubscribe'),
         u.unsubscribed_at,
         c.id
  from unsub u
  left join cust c on c.e = u.e
$$;

revoke all on function public.marketing_contacts_all(uuid) from public, anon, authenticated;
grant execute on function public.marketing_contacts_all(uuid) to service_role;

create or replace function public.marketing_contacts(
  p_tenant uuid,
  p_status text default 'all',
  p_search text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  email text,
  name text,
  status text,
  source text,
  status_at timestamptz,
  customer_id uuid,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_search text := nullif(trim(coalesce(p_search, '')), '');
  v_full boolean;
begin
  if p_tenant is null
     or not public.has_tenant_role(p_tenant, array['tenant_admin','staff','marketing','viewer','accountant']::public.app_role[]) then
    raise exception 'NO_ACCESS' using errcode = '42501';
  end if;
  v_full := public.has_tenant_role(p_tenant, array['tenant_admin','staff','marketing']::public.app_role[]);

  return query
  select a.email, a.name, a.status, a.source, a.status_at, a.customer_id,
         count(*) over () as total_count
  from public.marketing_contacts_all(p_tenant) a
  where (v_full or a.status in ('subscribed', 'pending'))
    and (coalesce(p_status, 'all') = 'all' or a.status = p_status)
    and (
      v_search is null
      or a.email ilike '%' || replace(replace(replace(v_search, '\', '\\'), '%', '\%'), '_', '\_') || '%'
      or coalesce(a.name, '') ilike '%' || replace(replace(replace(v_search, '\', '\\'), '%', '\%'), '_', '\_') || '%'
    )
  order by a.status_at desc nulls last, a.email
  limit greatest(1, least(coalesce(p_limit, 50), 1000))
  offset greatest(0, coalesce(p_offset, 0));
end;
$$;

revoke all on function public.marketing_contacts(uuid, text, text, integer, integer) from public, anon;
grant execute on function public.marketing_contacts(uuid, text, text, integer, integer) to authenticated, service_role;

create or replace function public.marketing_contact_counts(p_tenant uuid)
returns table (status text, total bigint)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_full boolean;
begin
  if p_tenant is null
     or not public.has_tenant_role(p_tenant, array['tenant_admin','staff','marketing','viewer','accountant']::public.app_role[]) then
    raise exception 'NO_ACCESS' using errcode = '42501';
  end if;
  v_full := public.has_tenant_role(p_tenant, array['tenant_admin','staff','marketing']::public.app_role[]);

  return query
  select a.status, count(*)::bigint
  from public.marketing_contacts_all(p_tenant) a
  where v_full or a.status in ('subscribed', 'pending')
  group by a.status;
end;
$$;

revoke all on function public.marketing_contact_counts(uuid) from public, anon;
grant execute on function public.marketing_contact_counts(uuid) to authenticated, service_role;

create or replace function public.marketing_unsubscribe_contact(p_tenant uuid, p_email text)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_customer uuid;
  v_customers integer := 0;
  v_subscribers integer := 0;
begin
  if p_tenant is null
     or not public.has_tenant_role(p_tenant, array['tenant_admin','staff','marketing']::public.app_role[]) then
    raise exception 'NO_ACCESS' using errcode = '42501';
  end if;
  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'INVALID_EMAIL' using errcode = '22023';
  end if;

  update public.customers
     set email_subscribed = false
   where tenant_id = p_tenant and lower(trim(email)) = v_email and email_subscribed is distinct from false;
  get diagnostics v_customers = row_count;

  select id into v_customer from public.customers
   where tenant_id = p_tenant and lower(trim(email)) = v_email
   order by created_at desc nulls last limit 1;

  update public.newsletter_subscribers
     set status = 'unsubscribed', unsubscribed_at = now(), unsubscribe_reason = 'manual'
   where tenant_id = p_tenant and lower(trim(email)) = v_email and status is distinct from 'unsubscribed';
  get diagnostics v_subscribers = row_count;

  if not exists (select 1 from public.email_unsubscribes where tenant_id = p_tenant and lower(trim(email)) = v_email) then
    insert into public.email_unsubscribes (tenant_id, email, reason, customer_id, unsubscribed_at)
    values (p_tenant, v_email, 'manual', v_customer, now())
    on conflict (tenant_id, email) do nothing;
  end if;

  return jsonb_build_object('customers', v_customers, 'subscribers', v_subscribers);
end;
$$;

revoke all on function public.marketing_unsubscribe_contact(uuid, text) from public, anon;
grant execute on function public.marketing_unsubscribe_contact(uuid, text) to authenticated, service_role;

create or replace function public.marketing_erase_contact(p_tenant uuid, p_email text)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_customers integer := 0;
  v_subscribers integer := 0;
begin
  if p_tenant is null
     or not public.has_tenant_role(p_tenant, array['tenant_admin']::public.app_role[]) then
    raise exception 'NO_ACCESS' using errcode = '42501';
  end if;
  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'INVALID_EMAIL' using errcode = '22023';
  end if;

  delete from public.newsletter_subscribers
   where tenant_id = p_tenant and lower(trim(email)) = v_email;
  get diagnostics v_subscribers = row_count;

  delete from public.email_preferences
   where tenant_id = p_tenant and lower(trim(email)) = v_email;

  update public.customers
     set email_subscribed = false, email_subscribed_at = null
   where tenant_id = p_tenant and lower(trim(email)) = v_email;
  get diagnostics v_customers = row_count;

  delete from public.email_unsubscribes
   where tenant_id = p_tenant and lower(trim(email)) = v_email and email <> v_email;
  insert into public.email_unsubscribes (tenant_id, email, reason, customer_id, campaign_id, unsubscribed_at)
  values (p_tenant, v_email, 'gdpr_erasure', null, null, now())
  on conflict (tenant_id, email) do update
    set reason = 'gdpr_erasure', customer_id = null, campaign_id = null, unsubscribed_at = now();

  return jsonb_build_object('customers', v_customers, 'subscribers', v_subscribers);
end;
$$;

revoke all on function public.marketing_erase_contact(uuid, text) from public, anon;
grant execute on function public.marketing_erase_contact(uuid, text) to authenticated, service_role;

create or replace function public.marketing_prepare_invites(
  p_tenant uuid,
  p_emails text[],
  p_attested_by uuid,
  p_language text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_is_service boolean := coalesce(auth.role(), '') = 'service_role';
  v_by uuid;
  v_lang text := case when lower(left(coalesce(p_language, ''), 2)) in ('nl','en','fr','de')
                      then lower(left(p_language, 2)) end;
  v_raw integer;
  v_valid integer;
  v_distinct integer;
  v_active integer;
  v_unsub integer;
  v_recent integer;
  v_n integer;
  v_today integer;
  v_limit integer;
  v_used integer;
  v_meta jsonb;
  v_rows jsonb;
begin
  if p_tenant is null
     or not (v_is_service
             or public.has_tenant_role(p_tenant, array['tenant_admin','staff','marketing']::public.app_role[])) then
    raise exception 'NO_ACCESS' using errcode = '42501';
  end if;
  v_by := case when v_is_service then p_attested_by else auth.uid() end;
  if v_by is null then
    raise exception 'NO_CONSENT' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('newsletter_invite:' || p_tenant::text));

  create temp table if not exists pg_temp._inv (
    e text primary key, cls text, ns_id uuid, token uuid, first_name text, language text
  ) on commit drop;
  truncate pg_temp._inv;

  select count(*) into v_raw
    from unnest(coalesce(p_emails, array[]::text[])) x
   where coalesce(trim(x), '') <> '';
  select count(*), count(distinct lower(trim(x))) into v_valid, v_distinct
    from unnest(coalesce(p_emails, array[]::text[])) x
   where lower(trim(x)) ~ '^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$' and length(trim(x)) <= 254;

  if v_distinct > 500 then
    raise exception 'MAIL_INVITE_TOO_MANY' using errcode = '22023';
  end if;

  insert into pg_temp._inv (e)
  select distinct lower(trim(x))
    from unnest(coalesce(p_emails, array[]::text[])) x
   where lower(trim(x)) ~ '^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$' and length(trim(x)) <= 254;

  update pg_temp._inv i set cls = 'unsubscribed'
   where exists (select 1 from public.email_unsubscribes u
                  where u.tenant_id = p_tenant and lower(trim(u.email)) = i.e)
      or exists (select 1 from public.newsletter_subscribers n
                  where n.tenant_id = p_tenant and lower(trim(n.email)) = i.e and n.status = 'unsubscribed');
  update pg_temp._inv i set cls = 'active'
   where i.cls is null
     and (exists (select 1 from public.customers c
                   where c.tenant_id = p_tenant and lower(trim(c.email)) = i.e and c.email_subscribed is true)
          or exists (select 1 from public.newsletter_subscribers n
                      where n.tenant_id = p_tenant and lower(trim(n.email)) = i.e and n.status = 'active'));
  update pg_temp._inv i
     set ns_id = p.id, token = p.confirmation_token, first_name = p.first_name,
         language = nullif(p.metadata->>'language', ''),
         cls = case when p.last_mailed > now() - interval '7 days' then 'recent' else 'resend' end
    from (
      select distinct on (lower(trim(n.email)))
             lower(trim(n.email)) as e, n.id, n.confirmation_token, n.first_name, n.metadata,
             greatest((n.metadata->>'last_invited_at')::timestamptz,
                      n.updated_at, n.subscribed_at, n.created_at) as last_mailed
        from public.newsletter_subscribers n
       where n.tenant_id = p_tenant and n.email is not null
         and lower(trim(n.email)) in (select e from pg_temp._inv)
       order by lower(trim(n.email)), n.created_at desc nulls last
    ) p
   where i.cls is null and p.e = i.e;
  update pg_temp._inv set cls = 'new' where cls is null;

  select count(*) filter (where cls = 'active'),
         count(*) filter (where cls = 'unsubscribed'),
         count(*) filter (where cls = 'recent'),
         count(*) filter (where cls in ('new', 'resend'))
    into v_active, v_unsub, v_recent, v_n
    from pg_temp._inv;

  if v_n > 0 then
    select count(*) into v_today
      from public.newsletter_subscribers n
     where n.tenant_id = p_tenant
       and (n.metadata->>'last_invited_at')::timestamptz > now() - interval '24 hours';
    if v_today + v_n > 2000 then
      raise exception 'MAIL_INVITE_DAILY_LIMIT:%', v_today;
    end if;

    v_limit := public.marketing_email_limit(p_tenant);
    if v_limit is not null then
      v_used := public.marketing_emails_used(p_tenant);
      if v_used + v_n > v_limit then
        raise exception 'MAIL_PLAN_LIMIT:%:%', v_limit, v_used;
      end if;
    end if;

    v_meta := jsonb_build_object(
      'last_invited_at', now(),
      'invited_by', v_by,
      'consent_attested_at', now(),
      'consent_attested_by', v_by);

    with upd as (
      update public.newsletter_subscribers n
         set metadata = coalesce(n.metadata, '{}'::jsonb) || v_meta,
             confirmation_token = coalesce(n.confirmation_token, gen_random_uuid())
        from pg_temp._inv i
       where i.cls = 'resend' and n.id = i.ns_id
      returning n.email, n.confirmation_token, n.first_name, n.metadata->>'language' as language
    ),
    ins as (
      insert into public.newsletter_subscribers
             (tenant_id, email, status, source, sync_status, subscribed_at, metadata)
      select p_tenant, i.e, 'pending', 'admin_invite', 'synced', now(),
             v_meta || case when v_lang is not null then jsonb_build_object('language', v_lang) else '{}'::jsonb end
        from pg_temp._inv i
       where i.cls = 'new'
      on conflict (tenant_id, email) do nothing
      returning email, confirmation_token, first_name, metadata->>'language' as language
    )
    select coalesce(jsonb_agg(jsonb_build_object(
             'email', r.email,
             'confirmation_token', r.confirmation_token,
             'first_name', r.first_name,
             'language', coalesce(r.language, v_lang),
             'is_new', r.is_new)), '[]'::jsonb)
      into v_rows
      from (select u.*, false as is_new from upd u
            union all
            select n.*, true from ins n) r
     where r.confirmation_token is not null;
  end if;

  return jsonb_build_object(
    'to_mail', coalesce(v_rows, '[]'::jsonb),
    'skipped', jsonb_build_object(
      'active', v_active,
      'unsubscribed', v_unsub,
      'recent', v_recent,
      'invalid', v_raw - v_valid,
      'duplicate', v_valid - v_distinct));
end;
$$;

revoke all on function public.marketing_prepare_invites(uuid, text[], uuid, text) from public, anon;
grant execute on function public.marketing_prepare_invites(uuid, text[], uuid, text) to authenticated, service_role;

insert into public.doc_articles (doc_level, category_id, context_path, title, slug, excerpt, content, sort_order)
values (
  'tenant',
  'a0000001-0000-0000-0000-00000000000b',
  '/admin/marketing',
  'Je e-mailabonnees beheren',
  'email-abonnees-beheren',
  'Zie wie je nieuwsbrief krijgt, nodig mensen uit met bevestiging, schrijf iemand uit, verwijder gegevens op verzoek en exporteer je lijst.',
  $html$
<h2>Waar vind je je abonnees?</h2>
<p>Ga naar <strong>Marketing → E-mail</strong> en open het tabblad <strong>Abonnees</strong>. Je ziet er elk adres met een status:</p>
<ul>
  <li><strong>Ingeschreven</strong>: deze persoon krijgt je campagnes.</li>
  <li><strong>Wacht op bevestiging</strong>: deze persoon kreeg een bevestigingsmail maar heeft nog niet op de knop geklikt. Tot dan krijgt hij of zij geen campagnes.</li>
  <li><strong>Uitgeschreven</strong>, <strong>Gebounced</strong> of <strong>Klacht</strong>: deze adressen worden nooit meer gemaild. Gebounced betekent dat het adres niet bestaat; een klacht betekent dat iemand je mail als spam markeerde.</li>
</ul>
<p>Je kan filteren op status en zoeken op e-mailadres of naam. Bovenaan zie je hoeveel adressen er per status zijn.</p>

<h2>Mensen uitnodigen</h2>
<p>Je kan niemand rechtstreeks op ingeschreven zetten. Klik op <strong>Uitnodigen</strong>, plak een of meer adressen of laad een CSV-bestand op, en bevestig dat je toestemming hebt om deze mensen uit te nodigen. Elk adres krijgt een mail met een knop om de inschrijving te bevestigen. Pas na die klik krijgen ze je campagnes.</p>
<p>De uitnodiging zegt duidelijk dat de persoon niets krijgt als hij of zij niets doet.</p>
<p>Per keer kan je maximaal 500 adressen uitnodigen, en maximaal 2.000 per 24 uur. Adressen die al ingeschreven zijn of ooit uitgeschreven zijn, slaat SellQo over. Wacht een adres al op bevestiging, dan krijgt het de uitnodiging enkel opnieuw als de vorige mail meer dan 7 dagen geleden is. Een uitnodiging kan enkel als je maandelijkse limiet voor marketingmails nog ruimte heeft voor het aantal adressen.</p>

<h2>Iemand uitschrijven</h2>
<p>Vraagt iemand je om geen mails meer te sturen, kies dan bij dat adres <strong>Uitschrijven</strong>. Het adres krijgt geen campagnes meer. De klant en zijn bestellingen blijven gewoon bestaan.</p>

<h2>Gegevens verwijderen op verzoek (AVG)</h2>
<p>Vraagt iemand om zijn gegevens te wissen, kies dan <strong>AVG-verwijderen</strong>. Enkel een beheerder van de winkel kan dit. SellQo verwijdert de nieuwsbriefinschrijving en de e-mailvoorkeuren en zet de klant op niet-ingeschreven.</p>
<p>Wat er blijft, en waarom:</p>
<ul>
  <li><strong>Het klantrecord en de bestelgeschiedenis</strong> (naam, adres, bestellingen, facturen) blijven bestaan. Die moet je bijhouden voor je boekhouding. Deze knop wist ze dus niet.</li>
  <li><strong>Het e-mailadres</strong> blijft op de uitschrijflijst staan, zonder naam. Zo kan SellQo garanderen dat het nooit meer een marketingmail krijgt. Dat blijft zo, tenzij de persoon zich later zelf opnieuw inschrijft en die inschrijving bevestigt.</li>
  <li><strong>Verzonden campagnes</strong>: de lijst van wie welke campagne kreeg, blijft bewaard.</li>
</ul>
<p>Vraagt iemand dat ook zijn klantgegevens gewist worden, kijk dan bij <strong>Klanten</strong> wat je wettelijk mag verwijderen en wat je moet bewaren. Vertel de persoon eerlijk wat je bewaart en waarom.</p>

<h2>Exporteren</h2>
<p>Met <strong>Exporteer CSV</strong> download je de lijst zoals je hem nu gefilterd hebt, met e-mail, naam, status, bron en datum.</p>
$html$,
  5
)
on conflict (doc_level, slug) do update
  set title = excluded.title,
      excerpt = excluded.excerpt,
      content = excluded.content,
      context_path = excluded.context_path,
      category_id = excluded.category_id,
      updated_at = now();