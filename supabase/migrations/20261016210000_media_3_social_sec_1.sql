-- MEDIA-3 + SOCIAL-SEC-1 (16-10-2026) — contentverzoeken vanuit de mediabibliotheek, en
-- afscherming van de externe contentpijplijn (status regenerate_requested / source content_task).
--
-- Aanleiding (recon 16-10 via query_database):
--   * RLS op social_posts: INSERT/UPDATE voor has_tenant_role(tenant_id, [tenant_admin, staff,
--     marketing]) zonder kolom- of statuscontrole. Elke marketinggebruiker van elke winkel kon
--     dus status 'regenerate_requested' en source 'content_task' zetten. De externe Claude-taak
--     (betaald door Nomadix) pakt elk uur zulke rijen op: misbruik = kosten.
--   * Rollen (pg_roles + select current_user via de connector): de connector en migraties draaien
--     als 'postgres' (rolbypassrls), edge functions als 'service_role', PostgREST-gebruikers als
--     'authenticated'. De guard hieronder treft enkel 'authenticated' en 'anon'.
--   * use_ai_credits(p_tenant_id, p_credits, p_feature, p_model, p_metadata): SECURITY DEFINER,
--     enkel uitvoerbaar door service_role/postgres; billing_exempt en is_internal_tenant krijgen
--     altijd true (0 credits, wel gelogd). De RPC's hieronder (eigenaar postgres) roepen hem aan.
--
-- Wat dit doet (strikt additief; geen bestaande kolom, policy of functie gewijzigd):
--   1. Tabel social_content_pipeline_tenants: welke winkels de externe contentpijplijn hebben.
--      Tenantleden mogen hun eigen rij lezen; schrijven kan enkel de beheerrol (connector of
--      migratie). Seed staat APART in 20261016210100 (niet automatisch draaien).
--   2. Tabel social_content_requests: verzoeken "maak een post met dit beeld". Tenantleden
--      lezen; niemand schrijft rechtstreeks (enkel via de RPC of de beheerrol).
--   3. RPC request_social_content(...) en request_social_regenerate(...): SECURITY DEFINER,
--      search_path vast, rolcontrole op de winkel van het object, pijplijn aan, limieten, en
--      afrekenen via use_ai_credits (post/story 10, reel 25).
--   4. Guard-trigger BEFORE INSERT OR UPDATE op social_posts: 'authenticated'/'anon' mogen
--      status 'regenerate_requested', source van/naar 'content_task' en de regenerate_*-kolommen
--      niet rechtstreeks zetten. request_social_regenerate komt erdoor omdat hij als eigenaar
--      draait; hij zet ook de transactie-lokale GUC sellqo.social_rpc = '1' (zoals gevraagd),
--      maar de guard vertrouwt die GUC bewust niet voor authenticated/anon: die rol kan hem
--      zelf zetten (lokaal aangetoond). Daarnaast, voor elke aanroeper: verschuift het
--      tijdstip van een manual-post, dan gaat reminded_at terug op NULL (zie SOCIAL-SEC-1 #10).
--
-- Limieten (verdedigbaar, gedocumenteerd in docs/prepared/MEDIA-3-SOCIAL-SEC-1-deploy.md):
--   contentverzoek: 1-10 beelden; max 10 open (requested|processing) per winkel; max 20 nieuwe
--     per 24 u per winkel; gewenste datum vandaag t/m +90 dagen; opmerking max 1000 tekens.
--   opnieuw maken: max 3 per post per 24 u; max 30 per winkel per 24 u; opmerking max 1000.
--   Telling via ai_usage_log (use_ai_credits logt altijd, ook bij vrijstelling).
--   Gelijktijdige aanroepen per winkel worden geserialiseerd met pg_advisory_xact_lock.
--
-- Foutcodes (message = sleutel die de app vertaalt, zie src/lib/socialContent.ts):
--   social_no_access (42501), social_no_pipeline, social_not_found, social_invalid_state,
--   social_invalid_input, social_rate_limit, social_insufficient_credits (P0001).
--   De guard geeft social_guard_forbidden (42501).
--
-- Idempotent: create table if not exists, create or replace function, drop policy/trigger if
-- exists + create, grants herhaalbaar.
--
-- Handmatig terugdraaien (in deze volgorde; de frontend valt dan terug op "knop verborgen"
-- omdat de pijplijntabel ontbreekt — "Opnieuw maken" werkt dan niet meer tot de vorige
-- frontend terug staat):
--   drop trigger if exists trg_social_posts_guard on public.social_posts;
--   drop function if exists public.social_posts_guard();
--   drop function if exists public.request_social_regenerate(uuid, text, text);
--   drop function if exists public.request_social_content(uuid, uuid[], text, text, date, text);
--   drop table if exists public.social_content_requests;
--   drop table if exists public.social_content_pipeline_tenants;

-- 1. Wie heeft de contentpijplijn ---------------------------------------------------------

create table if not exists public.social_content_pipeline_tenants (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  note text
);

comment on table public.social_content_pipeline_tenants is
  'SOCIAL-SEC-1: winkels met de externe contentpijplijn (Claude-taken van Nomadix). Enkel de beheerrol schrijft; tenantleden lezen hun eigen rij.';

alter table public.social_content_pipeline_tenants enable row level security;
revoke all on table public.social_content_pipeline_tenants from public, anon, authenticated;
grant select on table public.social_content_pipeline_tenants to authenticated;
grant all on table public.social_content_pipeline_tenants to service_role;

drop policy if exists social_pipeline_select_members on public.social_content_pipeline_tenants;
create policy social_pipeline_select_members on public.social_content_pipeline_tenants
  for select to authenticated
  using (tenant_id in (select public.get_user_tenant_ids(auth.uid())));

-- 2. Contentverzoeken ---------------------------------------------------------------------

create table if not exists public.social_content_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  media_asset_ids uuid[] not null,
  note text check (note is null or char_length(note) <= 1000),
  kind text not null check (kind in ('post', 'story', 'reel')),
  language text check (language is null or language ~ '^[a-z]{2}$'),
  wanted_for date,
  status text not null default 'requested'
    check (status in ('requested', 'processing', 'done', 'rejected', 'cancelled')),
  result_post_id uuid references public.social_posts(id) on delete set null,
  credits_charged integer not null default 0 check (credits_charged >= 0),
  requested_by uuid,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  error text,
  constraint social_content_requests_assets_check
    check (cardinality(media_asset_ids) between 1 and 10)
);

comment on table public.social_content_requests is
  'MEDIA-3: "maak een post met dit beeld" vanuit de mediabibliotheek. Enkel via request_social_content (of de beheerrol); de externe pijplijn verwerkt status requested.';

create index if not exists social_content_requests_tenant_created_idx
  on public.social_content_requests (tenant_id, created_at desc);
create index if not exists social_content_requests_open_idx
  on public.social_content_requests (created_at)
  where status in ('requested', 'processing');

alter table public.social_content_requests enable row level security;
revoke all on table public.social_content_requests from public, anon, authenticated;
grant select on table public.social_content_requests to authenticated;
grant all on table public.social_content_requests to service_role;

drop policy if exists social_content_requests_select_members on public.social_content_requests;
create policy social_content_requests_select_members on public.social_content_requests
  for select to authenticated
  using (tenant_id in (select public.get_user_tenant_ids(auth.uid())));

-- 3a. RPC: contentverzoek -----------------------------------------------------------------

create or replace function public.request_social_content(
  p_tenant_id uuid,
  p_media_asset_ids uuid[],
  p_kind text,
  p_language text default null,
  p_wanted_for date default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ids uuid[];
  v_found integer;
  v_open integer;
  v_recent integer;
  v_cost integer;
  v_exempt boolean;
  v_ok boolean;
  v_id uuid := gen_random_uuid();
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_language text := nullif(btrim(coalesce(p_language, '')), '');
begin
  if v_uid is null or p_tenant_id is null
     or not public.has_tenant_role(p_tenant_id, array['tenant_admin', 'staff', 'marketing']::public.app_role[]) then
    raise exception 'social_no_access' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.social_content_pipeline_tenants
    where tenant_id = p_tenant_id and enabled
  ) then
    raise exception 'social_no_pipeline';
  end if;

  if p_kind is null or p_kind not in ('post', 'story', 'reel')
     or (v_language is not null and v_language !~ '^[a-z]{2}$')
     or (v_note is not null and char_length(v_note) > 1000)
     or (p_wanted_for is not null and (p_wanted_for < current_date or p_wanted_for > current_date + 90)) then
    raise exception 'social_invalid_input';
  end if;

  select coalesce(array_agg(distinct x), '{}') into v_ids
  from unnest(coalesce(p_media_asset_ids, '{}'::uuid[])) as x
  where x is not null;
  if cardinality(v_ids) < 1 or cardinality(v_ids) > 10 then
    raise exception 'social_invalid_input';
  end if;

  select count(*) into v_found
  from public.media_assets
  where id = any (v_ids) and tenant_id = p_tenant_id;
  if v_found <> cardinality(v_ids) then
    raise exception 'social_not_found';
  end if;

  -- Eén verzoek tegelijk per winkel, zodat de limieten niet te omzeilen zijn met parallelle klikken.
  perform pg_advisory_xact_lock(hashtext('social_content_request:' || p_tenant_id::text));

  select count(*) filter (where status in ('requested', 'processing')),
         count(*) filter (where created_at > now() - interval '24 hours')
    into v_open, v_recent
  from public.social_content_requests
  where tenant_id = p_tenant_id;
  if v_open >= 10 or v_recent >= 20 then
    raise exception 'social_rate_limit';
  end if;

  v_cost := case p_kind when 'reel' then 25 else 10 end;

  select coalesce(is_internal_tenant, false) or coalesce(billing_exempt, false)
    into v_exempt
  from public.tenants where id = p_tenant_id;

  v_ok := public.use_ai_credits(
    p_tenant_id, v_cost, 'social_content_request', null,
    jsonb_build_object('request_id', v_id, 'kind', p_kind, 'assets', cardinality(v_ids), 'user_id', v_uid)
  );
  if not coalesce(v_ok, false) then
    raise exception 'social_insufficient_credits';
  end if;

  insert into public.social_content_requests
    (id, tenant_id, media_asset_ids, note, kind, language, wanted_for, status, credits_charged, requested_by)
  values
    (v_id, p_tenant_id, v_ids, v_note, p_kind, v_language, p_wanted_for, 'requested',
     case when coalesce(v_exempt, false) then 0 else v_cost end, v_uid);

  return jsonb_build_object(
    'id', v_id,
    'credits_cost', v_cost,
    'credits_charged', case when coalesce(v_exempt, false) then 0 else v_cost end
  );
end;
$$;

revoke all on function public.request_social_content(uuid, uuid[], text, text, date, text) from public, anon;
grant execute on function public.request_social_content(uuid, uuid[], text, text, date, text) to authenticated;

-- 3b. RPC: opnieuw maken ------------------------------------------------------------------

create or replace function public.request_social_regenerate(
  p_post_id uuid,
  p_note text default null,
  p_language text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_post record;
  v_per_post integer;
  v_per_tenant integer;
  v_cost integer;
  v_exempt boolean;
  v_ok boolean;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_language text := nullif(btrim(coalesce(p_language, '')), '');
begin
  if v_uid is null then
    raise exception 'social_no_access' using errcode = '42501';
  end if;

  select id, tenant_id, status, source, media_type into v_post
  from public.social_posts where id = p_post_id;
  if not found then
    raise exception 'social_not_found';
  end if;

  if not public.has_tenant_role(v_post.tenant_id, array['tenant_admin', 'staff', 'marketing']::public.app_role[]) then
    raise exception 'social_no_access' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.social_content_pipeline_tenants
    where tenant_id = v_post.tenant_id and enabled
  ) then
    raise exception 'social_no_pipeline';
  end if;

  if (v_language is not null and v_language !~ '^[a-z]{2}$')
     or (v_note is not null and char_length(v_note) > 1000) then
    raise exception 'social_invalid_input';
  end if;

  perform pg_advisory_xact_lock(hashtext('social_content_request:' || v_post.tenant_id::text));

  -- Status opnieuw lezen ná de lock en de rij vastzetten: twee klikken tegelijk rekenen niet dubbel af.
  select id, tenant_id, status, source, media_type into v_post
  from public.social_posts where id = p_post_id for update;
  if v_post.source is distinct from 'content_task'
     or v_post.status not in ('pending_approval', 'manual', 'failed', 'draft') then
    raise exception 'social_invalid_state';
  end if;

  select count(*) filter (where metadata ->> 'post_id' = p_post_id::text),
         count(*)
    into v_per_post, v_per_tenant
  from public.ai_usage_log
  where tenant_id = v_post.tenant_id
    and feature = 'social_regenerate'
    and created_at > now() - interval '24 hours';
  if v_per_post >= 3 or v_per_tenant >= 30 then
    raise exception 'social_rate_limit';
  end if;

  v_cost := case v_post.media_type when 'reel' then 25 else 10 end;

  select coalesce(is_internal_tenant, false) or coalesce(billing_exempt, false)
    into v_exempt
  from public.tenants where id = v_post.tenant_id;

  v_ok := public.use_ai_credits(
    v_post.tenant_id, v_cost, 'social_regenerate', null,
    jsonb_build_object('post_id', p_post_id, 'media_type', v_post.media_type, 'user_id', v_uid)
  );
  if not coalesce(v_ok, false) then
    raise exception 'social_insufficient_credits';
  end if;

  perform set_config('sellqo.social_rpc', '1', true);
  update public.social_posts
     set status = 'regenerate_requested',
         regenerate_from = v_post.status,
         regenerate_note = v_note,
         regenerate_language = v_language,
         regenerate_requested_at = now(),
         updated_at = now()
   where id = p_post_id;
  perform set_config('sellqo.social_rpc', '', true);

  return jsonb_build_object(
    'post_id', p_post_id,
    'credits_cost', v_cost,
    'credits_charged', case when coalesce(v_exempt, false) then 0 else v_cost end
  );
end;
$$;

revoke all on function public.request_social_regenerate(uuid, text, text) from public, anon;
grant execute on function public.request_social_regenerate(uuid, text, text) to authenticated;

-- 4. Guard op social_posts ----------------------------------------------------------------
-- SECURITY INVOKER (default): current_user is de echte aanroeper. Binnen de RPC hierboven is dat
-- de eigenaar (postgres); de GUC is een tweede, expliciete doorgang voor het geval de eigenaar
-- ooit wijzigt.

create or replace function public.social_posts_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- SOCIAL-SEC-1 #10: een manual-post die verschoven wordt, krijgt opnieuw een herinnering.
  -- Enkel als de schrijver reminded_at zelf niet aanraakt (wie hem bewust zet, wint).
  if tg_op = 'UPDATE'
     and new.status = 'manual'
     and new.scheduled_for is distinct from old.scheduled_for
     and new.reminded_at is not distinct from old.reminded_at then
    new.reminded_at := null;
  end if;

  -- Beheerrol (connector/migraties: postgres), service_role (edge functions, cron) en de
  -- eigenaar van de SECURITY DEFINER-RPC's mogen alles. De GUC sellqo.social_rpc wordt door
  -- request_social_regenerate gezet, maar hier NIET vertrouwd voor authenticated/anon: die rol
  -- kan set_config('sellqo.social_rpc','1',true) zelf aanroepen in dezelfde transactie (lokaal
  -- aangetoond). De doorlaat voor de RPC komt van current_user = eigenaar.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status = 'regenerate_requested'
       or new.source = 'content_task'
       or new.regenerate_note is not null
       or new.regenerate_requested_at is not null
       or new.regenerate_from is not null
       or new.regenerate_language is not null then
      raise exception 'social_guard_forbidden'
        using errcode = '42501',
              detail = 'regenerate_requested, source content_task en regenerate_* lopen via request_social_regenerate';
    end if;
  else
    if (new.status = 'regenerate_requested' and old.status is distinct from 'regenerate_requested')
       or (new.source is distinct from old.source
           and (new.source = 'content_task' or old.source = 'content_task'))
       or new.regenerate_note is distinct from old.regenerate_note
       or new.regenerate_requested_at is distinct from old.regenerate_requested_at
       or new.regenerate_from is distinct from old.regenerate_from
       or new.regenerate_language is distinct from old.regenerate_language then
      raise exception 'social_guard_forbidden'
        using errcode = '42501',
              detail = 'regenerate_requested, source content_task en regenerate_* lopen via request_social_regenerate';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.social_posts_guard() from public, anon, authenticated;

drop trigger if exists trg_social_posts_guard on public.social_posts;
create trigger trg_social_posts_guard
  before insert or update on public.social_posts
  for each row execute function public.social_posts_guard();
