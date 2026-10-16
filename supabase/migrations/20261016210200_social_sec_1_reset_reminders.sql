-- SOCIAL-SEC-1 #10 (16-10-2026) — DATA-MIGRATIE, apart te draaien na een expliciete go van Akke.
--
-- Zet reminded_at terug op NULL voor manual-posts in de toekomst die nooit een
-- social_manual_due-melding kregen, zodat social-publish-due ze ±1 uur vooraf alsnog meldt.
--
-- Root cause (zie role-audit SOCIAL-SEC-1): de 6 Loveke-launchstories (17-22 okt) kregen op
-- 15-10 om 18:34:45.151266 UTC reminded_at in één SQL-statement (microseconden = now() in SQL,
-- niet de JS-stempel van remindManual). Dat was de bewuste live-stap van SOCIAL-3 om dubbele
-- herinneringen te vermijden met de Claude-dagtaken "Loveke IG: post 3..9", die nog steeds
-- ingepland staan voor 17-23 okt. reminded_at deed dus dienst als "niet herinneren"-vlag.
--
-- LET OP vóór de go: na deze migratie krijgt Akke voor die stories ZOWEL de SellQo-melding als
-- de Claude-dagtaak. Wil je één bron, schakel dan de Claude-taken uit of draai dit niet.
--
-- Idempotent: tweede run vindt geen rijen meer (reminded_at is dan NULL); de snapshot wordt
-- maar één keer gemaakt (create table if not exists houdt de eerste staat vast).
--
-- Handmatig terugdraaien:
--   update public.social_posts p set reminded_at = s.reminded_at
--   from snapshots.sellqo_20261016_social_reminded s
--   where s.id = p.id and p.reminded_at is null;

create schema if not exists snapshots;

create table if not exists snapshots.sellqo_20261016_social_reminded as
select p.id, p.tenant_id, p.status, p.scheduled_for, p.reminded_at
from public.social_posts p
where p.status = 'manual'
  and p.reminded_at is not null
  and p.scheduled_for > now()
  and not exists (
    select 1 from public.notifications n
    where n.type = 'social_manual_due'
      and n.data ->> 'social_post_id' = p.id::text
  );

update public.social_posts p
   set reminded_at = null
 where p.status = 'manual'
   and p.reminded_at is not null
   and p.scheduled_for > now()
   and not exists (
     select 1 from public.notifications n
     where n.type = 'social_manual_due'
       and n.data ->> 'social_post_id' = p.id::text
   );
