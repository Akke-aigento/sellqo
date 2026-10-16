-- SOCIAL-5a — de publicatie-cron draait elke 5 minuten in plaats van elk uur op :01.
--
-- Waarom: posttijden zijn per merk gekozen op het moment dat het publiek online is
-- (bv. 12:15, 20:35). Met een uurlijkse cron ging een post van 20:35 pas om 21:01 online.
-- Nu is een post hooguit ±5 minuten te laat.
--
-- Kost: verwaarloosbaar. De cron-query roept de edge functie enkel aan als er werk is
-- (EXISTS op social_posts); anders is het één index-lookup.
-- Herinneringen (manual) blijven één keer per post dankzij reminded_at.
--
-- Idempotent: alter_job zet hetzelfde schema bij een tweede run.
-- Terugdraaien: select cron.alter_job(jobid, schedule := '1 * * * *') from cron.job where jobname = 'social-publish-due-hourly';
-- (De jobnaam blijft "hourly" om bestaande verwijzingen niet te breken.)

select cron.alter_job(jobid, schedule := '*/5 * * * *')
from cron.job
where jobname = 'social-publish-due-hourly';
