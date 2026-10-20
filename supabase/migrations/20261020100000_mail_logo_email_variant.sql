-- MAIL-LOGO-1 — e-mailvariant van het winkellogo.
--
-- 1) Twee nieuwe kolommen op public.tenants (strikt additief, nullable, geen default):
--    • email_logo_url        — publieke URL van de e-mailvariant in bucket tenant-logos
--                              (<tenant>/email-logo-<hash>.png): bijgesneden, 176 px hoog, PNG.
--    • email_logo_source_url — het logo waarvan de variant gemaakt is. getTenantBrand
--                              (_shared/tenantEmail.ts) gebruikt de variant enkel als die gelijk is
--                              aan het logo dat nu geldt; anders het origineel. Zo toont een mail
--                              nooit een verouderde variant na een nieuwe upload of verwijdering.
--    Bewust NIET op tenant_theme_settings: die rij stroomt via select('*') in storefront-api naar
--    alle custom frontends (CLAUDE.md §1). tenants wordt in getConfig per veld gemapt.
--    RLS: geen nieuwe policy nodig. Schrijven gebeurt door de admin met de bestaande UPDATE-policy
--    "Tenant admins can update their own tenant" (tenant_admin + platformadmin), dezelfde rol als
--    tenant_theme_settings_update_admin. tenants_protect_platform_columns raakt deze kolommen niet.
--
-- 2) Helpartikel 'emailcampagnes': één alinea over het logo in je mails. Er bestaat geen apart
--    artikel over logo/branding (doc_articles, 20-10-2026).
--
-- Idempotent: ADD COLUMN IF NOT EXISTS; de UPDATE slaat het artikel over zodra de alinea erin staat.
-- Geen backfill: bestaande winkels krijgen hun variant pas bij een nieuwe upload (zie role-audit).
--
-- Terugdraaien (handmatig, in deze volgorde):
--   update public.doc_articles set content = replace(content, <de alinea hieronder incl. kop>, '')
--     where doc_level = 'tenant' and slug = 'emailcampagnes';
--   -- Kolommen droppen is onomkeerbaar en enkel nodig als de feature definitief weg moet:
--   -- alter table public.tenants drop column if exists email_logo_source_url;
--   -- alter table public.tenants drop column if exists email_logo_url;
--   De code werkt zonder de kolommen verder (getTenantBrand leest ze in een aparte select).

alter table public.tenants add column if not exists email_logo_url text;
alter table public.tenants add column if not exists email_logo_source_url text;

comment on column public.tenants.email_logo_url is
  'MAIL-LOGO-1: e-mailvariant van het logo (bijgesneden, 176 px hoog, PNG) in tenant-logos.';
comment on column public.tenants.email_logo_source_url is
  'MAIL-LOGO-1: logo-URL waarvan email_logo_url gemaakt is; de variant geldt enkel zolang die gelijk is aan het huidige logo.';

update public.doc_articles
set content = content || $html$
<h2>Je logo in je mails</h2>
<p>Bovenaan elke mail aan je klanten staat je logo op een wit vlak, met een link naar je webshop (als SellQo het adres ervan kent). Upload je je logo bij <strong>Instellingen → Branding</strong> of in je webshopthema, dan maakt SellQo er automatisch een versie voor e-mails van: lege en witte randen worden weggeknipt en het formaat is afgestemd op de kop van je mails. Bij het uploaden zie je meteen hoe het eruitziet, ook in donkere modus. Heb je geen logo, dan staat de naam van je winkel er in tekst.</p>
$html$,
    updated_at = now()
where doc_level = 'tenant'
  and slug = 'emailcampagnes'
  and content not like '%<h2>Je logo in je mails</h2>%';
