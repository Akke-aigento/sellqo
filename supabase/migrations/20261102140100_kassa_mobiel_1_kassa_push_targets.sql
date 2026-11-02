-- KASSA-MOBIEL-1 (2-11-2026) — push van een gekoppeld kassatoestel komt ook aan.
--
-- Sinds KASSA-ACCOUNT-1 meldt een kassatoestel zich aan met een eigen account (kassa_device_accounts), die bewust
-- NIET in user_roles staat. "Meldingen aanzetten" in de kassa schrijft het pushtoken dus op de toestelaccount in.
-- Maar horeca_notify_targets (wie krijgt een horeca-melding) en horeca_notify_devices_list (het push-bolletje in
-- Kassa (POS) › Kassa's) eisen een rij in user_roles voor de eigenaar van het token: een toestel kreeg dus nooit iets.
-- Live nagetrokken 2-11-2026: beide functies kennen kassa_device_accounts niet.
--
-- Patch (ankermethode, idempotent met marker 'KASSA-MOBIEL-1'): naast "lid van de zaak" telt ook "een niet-ingetrokken
-- kassatoestel van deze zaak". Persoonlijke meldingen (send-push-notification) blijven ongewijzigd: een toestel heeft
-- geen rol, dus krijgt het die nooit.
--
-- Handmatig terugdraaien: de definitie van vóór de patch staat in snapshots.sellqo_20261102_fn_kassa_mobiel_1 (kolom
-- def, per sig). Per functie die def opnieuw uitvoeren:
--   do $r$ declare r record; begin
--     for r in select def from snapshots.sellqo_20261102_fn_kassa_mobiel_1 loop execute r.def; end loop;
--   end $r$;
--   (controleer daarna: geen functie meer met 'KASSA-MOBIEL-1' in pg_get_functiondef.)

create schema if not exists snapshots;
create table if not exists snapshots.sellqo_20261102_fn_kassa_mobiel_1 as
  select p.oid::regprocedure::text as sig, pg_get_functiondef(p.oid) as def, md5(pg_get_functiondef(p.oid)) as md5, now() as taken_at
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname in ('horeca_notify_targets', 'horeca_notify_devices_list');
revoke all on snapshots.sellqo_20261102_fn_kassa_mobiel_1 from anon, authenticated;

do $patch$
declare
  v_sig text;
  v_def text;
  v_old text;
  v_new text;
begin
  -- horeca_notify_targets: alias k = device_tokens, p_tenant_id = de zaak.
  -- horeca_notify_devices_list: alias k = device_tokens, d.tenant_id = de zaak.
  foreach v_sig in array array['public.horeca_notify_targets(uuid, text, uuid)', 'public.horeca_notify_devices_list(uuid)'] loop
    if to_regprocedure(v_sig) is null then
      if current_setting('sellqo.kassa_account_test', true) = 'on' then
        raise notice 'KASSA-MOBIEL-1: % bestaat niet in de testdatabank, overgeslagen', v_sig;
        continue;
      end if;
      raise exception 'KASSA-MOBIEL-1: % bestaat niet', v_sig;
    end if;
    v_def := pg_get_functiondef(to_regprocedure(v_sig));
    if position('KASSA-MOBIEL-1' in v_def) > 0 then
      continue;  -- al gepatcht
    end if;
    if v_sig like 'public.horeca_notify_targets%' then
      v_old := 'and exists (select 1 from public.user_roles ur where ur.user_id = k.user_id and ur.tenant_id = p_tenant_id)';
      v_new := 'and (exists (select 1 from public.user_roles ur where ur.user_id = k.user_id and ur.tenant_id = p_tenant_id)'
            || ' /* KASSA-MOBIEL-1 */ or exists (select 1 from public.kassa_device_accounts a where a.user_id = k.user_id and a.tenant_id = p_tenant_id and a.revoked_at is null))';
    else
      v_old := 'and exists (select 1 from public.user_roles ur where ur.user_id = k.user_id and ur.tenant_id = d.tenant_id)';
      v_new := 'and (exists (select 1 from public.user_roles ur where ur.user_id = k.user_id and ur.tenant_id = d.tenant_id)'
            || ' /* KASSA-MOBIEL-1 */ or exists (select 1 from public.kassa_device_accounts a where a.user_id = k.user_id and a.tenant_id = d.tenant_id and a.revoked_at is null))';
    end if;
    if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then
      raise exception 'KASSA-MOBIEL-1: anker niet precies één keer gevonden in %', v_sig;
    end if;
    execute replace(v_def, v_old, v_new);
  end loop;
end
$patch$;
