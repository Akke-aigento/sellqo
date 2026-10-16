-- SOCIAL-SEC-1 (16-10-2026) — DATA-MIGRATIE, apart te draaien na een expliciete go van Akke.
--
-- Zet de externe contentpijplijn aan voor de twee Nomadix-winkels die hem vandaag hebben.
-- Vereist 20261016210000_media_3_social_sec_1.sql (de tabel).
--
-- Zonder deze rijen ziet niemand "Maak een post met dit beeld" of "Opnieuw maken", en weigert
-- request_social_regenerate met social_no_pipeline. Draai hem dus in dezelfde sessie als de
-- schema-migratie als Loveke "Opnieuw maken" moet blijven gebruiken.
--
-- Idempotent: on conflict do nothing (een bestaande rij, ook een die bewust op enabled = false
-- staat, blijft ongemoeid).
--
-- Handmatig terugdraaien:
--   delete from public.social_content_pipeline_tenants
--   where tenant_id in ('1671a91c-31fe-42ed-8a10-41f3117ceb50', '54f6b480-280b-42e1-b843-d5beb2831acd');

insert into public.social_content_pipeline_tenants (tenant_id, enabled, note)
values
  ('1671a91c-31fe-42ed-8a10-41f3117ceb50', true, 'Loveke — weekcontent + opnieuw maken (Claude-taken Nomadix)'),
  ('54f6b480-280b-42e1-b843-d5beb2831acd', true, 'VanXcel — Nomadix Socials')
on conflict (tenant_id) do nothing;
