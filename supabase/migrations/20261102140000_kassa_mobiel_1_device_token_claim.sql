-- KASSA-MOBIEL-1 (2-11-2026) — pushtoken van dit toestel veilig overzetten naar wie nu aangemeld is.
--
-- Oorzaak (bewezen 2-11-2026, live read-only + code): device_tokens heeft UNIQUE(token) en RLS "enkel je eigen rij"
-- (select/insert/update/delete: auth.uid() = user_id). Een browser heeft per service-worker-registratie één
-- push-abonnement (één endpoint). Meldt iemand anders zich in dezelfde browser aan en zet die "Meldingen aanzetten",
-- dan doet de app upsert(onConflict: 'token') → INSERT … ON CONFLICT (token) DO UPDATE op een rij van een andere
-- gebruiker → de UPDATE-policy (USING auth.uid() = user_id) weigert → 42501 → subscribeWebPush() geeft 'error' →
-- toast "Het lukte niet" zonder uitleg. Live: het web-token van be6f2a43-… (sinds 15-10, install_id 01d9010f-…) en
-- het profiel horeca_notify_devices dat ba60e41e-… op 2-11 11:24 met dezelfde install_id bewaarde.
-- Native (src/native/pushRegistration.ts) had hetzelfde probleem, daar verdween de fout stil in de console.
--
-- Oplossing: device_token_claim(...). Bestaat het token niet: aanmaken voor auth.uid(). Is het van auth.uid():
-- bijwerken. Is het van iemand anders: enkel overzetten naar auth.uid() als de aanroeper bewijst dat hij het toestel
-- heeft:
--   - web: endpoint (token) + dezelfde p256dh én auth-sleutel als in de rij (die bestaan enkel in de browser zelf);
--   - native (FCM/APNs): het token zelf (enkel op het toestel op te vragen).
-- Anders: 42501 'token_owned_elsewhere'. Geen andere kolom of rij wordt geraakt; tenant_id gaat bij een overzetting
-- naar null (hoorde bij de vorige gebruiker).
-- Strikt additief: geen wijziging aan device_tokens, de policies of de unieke sleutel.
--
-- Handmatig terugdraaien:
--   drop function if exists public.device_token_claim(text, text, text, text, text, text, text);
--   (de app valt dan terug op de gewone upsert; overgezette rijen blijven bij hun nieuwe eigenaar — wie ze terug wil,
--    zet user_id terug uit de snapshot hieronder, per token.)
-- Snapshot (enkel ter controle): snapshots.sellqo_20261102_device_tokens_kassa_mobiel_1.

create schema if not exists snapshots;
create table if not exists snapshots.sellqo_20261102_device_tokens_kassa_mobiel_1 as
  select id, user_id, tenant_id, token, platform, os, install_id, device_name, created_at, last_seen_at, now() as taken_at
    from public.device_tokens;
revoke all on snapshots.sellqo_20261102_device_tokens_kassa_mobiel_1 from anon, authenticated;

create or replace function public.device_token_claim(
  p_token text,
  p_platform text,
  p_os text default null,
  p_device_name text default null,
  p_install_id text default null,
  p_p256dh text default null,
  p_auth text default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid uuid := auth.uid();
  r public.device_tokens%rowtype;
begin
  if v_uid is null then
    raise exception 'niet aangemeld' using errcode = '42501';
  end if;
  if coalesce(btrim(p_token), '') = '' or length(p_token) > 2048 then
    raise exception 'ongeldig token' using errcode = '22023';
  end if;
  if p_platform is null or p_platform not in ('ios', 'android', 'web') then
    raise exception 'ongeldig platform' using errcode = '22023';
  end if;
  if p_platform = 'web' and (coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = '') then
    raise exception 'web push zonder sleutels' using errcode = '22023';
  end if;

  select * into r from public.device_tokens where token = p_token for update;

  if not found then
    begin
      insert into public.device_tokens (user_id, token, platform, os, device_name, install_id, p256dh, auth, last_seen_at)
      values (v_uid, p_token, p_platform, p_os, left(p_device_name, 120), left(p_install_id, 80), p_p256dh, p_auth, now());
      return jsonb_build_object('status', 'created');
    exception when unique_violation then
      -- Gelijktijdig door een andere aanroep aangemaakt: opnieuw lezen (met lock) en verder zoals hieronder.
      select * into r from public.device_tokens where token = p_token for update;
      if not found then
        -- Review: rij verdween tussen de botsing en het herlezen; de app probeert opnieuw.
        raise exception 'retry' using errcode = '40001';
      end if;
    end;
  end if;

  if r.user_id <> v_uid then
    -- Bewijs van bezit: web = dezelfde sleutels; native = het token zelf.
    if p_platform <> r.platform
       or (r.platform = 'web' and (r.p256dh is distinct from p_p256dh or r.auth is distinct from p_auth)) then
      raise exception 'token_owned_elsewhere' using errcode = '42501';
    end if;
    update public.device_tokens
       set user_id = v_uid, tenant_id = null, os = coalesce(p_os, os), device_name = coalesce(left(p_device_name, 120), device_name),
           install_id = coalesce(left(p_install_id, 80), install_id), last_seen_at = now()
     where id = r.id;
    return jsonb_build_object('status', 'transferred');
  end if;

  update public.device_tokens
     set platform = p_platform, os = coalesce(p_os, os), device_name = coalesce(left(p_device_name, 120), device_name),
         install_id = coalesce(left(p_install_id, 80), install_id),
         p256dh = coalesce(p_p256dh, p256dh), auth = coalesce(p_auth, auth), last_seen_at = now()
   where id = r.id;
  return jsonb_build_object('status', 'updated');
end;
$$;
revoke all on function public.device_token_claim(text, text, text, text, text, text, text) from public, anon;
grant execute on function public.device_token_claim(text, text, text, text, text, text, text) to authenticated;
