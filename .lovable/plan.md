
<context>
Je zit vast op stap “Bedrijfsgegevens” met:
- 403 Forbidden / “new row violates row-level security policy for table tenants”
- Dit gebeurt op Live (sellqo.app)
- Zelfde login e-mail als het ingevulde factuur e-mail
- Eerste tenant voor dit account

Uit database-checks:
- In Live bestaan nog géén tenants voor dit account en géén user_roles records.
- De tenants INSERT-policy is: WITH CHECK (can_create_first_tenant(auth.uid(), owner_email) OR is_platform_admin(auth.uid()))
- can_create_first_tenant() vergelijkt nu: owner_email = (auth.jwt()->>'email') en “geen tenant_admin role bestaat”.
- user_roles heeft géén policy waarmee een normale gebruiker zelf een tenant_admin role mag inserten (alleen platform admins). Dus “automatisch admin user aanmaken” mag niet via client-side insert; dat moet server-side.

Wat dit betekent:
1) De tenants-insert faalt omdat can_create_first_tenant() in jouw request blijkbaar FALSE teruggeeft. De meest waarschijnlijke oorzaak is dat (auth.jwt()->>'email') in sommige requests leeg/null is of niet 1-op-1 matcht (case/whitespace), ondanks dat je wel bent ingelogd.
2) Zelfs als de tenant wél wordt aangemaakt, is het huidige “maak tenant_admin role aan” in de onboarding code niet betrouwbaar/veilig, omdat user_roles insert door RLS wordt geblokkeerd. Dit is precies wat je bedoelt met “als men op volgende klikt moet er automatisch een admin user aangemaakt worden”.

<doel>
- Stap 3 moet altijd door kunnen: tenant insert mag niet meer stuklopen op JWT-email edge cases.
- Bij het aanmaken van een tenant moet de “tenant_admin” rol automatisch en veilig server-side worden aangemaakt, zodat je direct verder kan en alle RLS-afhankelijke schermen werken.

<oplossing-overzicht>
A) Database: maak can_create_first_tenant() robuuster door te vergelijken met het e-mailadres in public.profiles (en case-insensitive), met fallback naar JWT-email.
B) Database: voeg een trigger toe op tenants INSERT die automatisch (server-side) een tenant_admin user_roles record aanmaakt voor de ingelogde gebruiker die de tenant aanmaakt. Dit voldoet aan jouw verwachting (“automatisch admin user”) en voorkomt client-side RLS blokkades.
C) Frontend: verwijder de client-side user_roles insert uit de onboarding (of maak die no-op), omdat de database dit voortaan altijd correct doet.

<stappenplan>
1) Database wijziging 1 — can_create_first_tenant() aanpassen (schema migration)
   - Vervang de check:
     - _owner_email = (auth.jwt()->>'email')
   - Door:
     - lower(trim(_owner_email)) = lower(trim(coalesce(
         (select email from public.profiles where id=_user_id),
         auth.jwt()->>'email'
       )))
   - En behoud de “NOT EXISTS tenant_admin role” check.
   - Resultaat: tenant insert is niet meer afhankelijk van een perfect gevulde JWT-email claim en is case/whitespace tolerant.

2) Database wijziging 2 — trigger om tenant_admin rol automatisch aan te maken (schema migration)
   - Maak een SECURITY DEFINER trigger function (bijv. public.assign_tenant_admin_role_on_tenant_insert()).
   - Logic:
     - Als auth.uid() IS NULL → doe niets
     - Als is_platform_admin(auth.uid()) → doe niets (platform admins creëren soms tenants namens anderen)
     - Als can_create_first_tenant(auth.uid(), NEW.owner_email) TRUE is → insert user_roles:
       - user_id = auth.uid()
       - tenant_id = NEW.id
       - role = 'tenant_admin'
       - ON CONFLICT (user_id, role, tenant_id) DO NOTHING
   - Voeg AFTER INSERT trigger toe op public.tenants.
   - Resultaat: zodra de tenant aangemaakt is, bestaat tenant_admin role altijd automatisch en veilig, zonder client-side permissies.

3) Frontend wijziging — onboarding createTenant vereenvoudigen
   - In src/hooks/useOnboarding.ts:
     - Verwijder de client-side insert naar public.user_roles (die nu toch door RLS geblokkeerd kan worden).
     - Houd refreshTenants() + setCurrentTenant(tenant) aan, zodat de UI meteen de juiste context heeft.
   - (Optioneel, maar handig) Voeg na createTenant een korte “sanity check” toe:
     - fetchTenants/roles refreshen; als tenant nog niet zichtbaar is, toon duidelijke foutmelding (“Je account rol kon niet worden aangemaakt, probeer opnieuw”).

4) Live rollout (belangrijk omdat je op Live test)
   - Eerst testen in Preview (staging) om zeker te zijn dat onboarding werkt.
   - Daarna publiceren naar Live zodat sellqo.app de nieuwe code + database schema wijzingen bevat.
   - Advies: na publish 1x uitloggen/inloggen om eventuele oude sessiestatus te resetten.

<testplan end-to-end>
1) (Preview) Log in → onboarding stap 3 → klik “Volgende stap”
   - Verwacht: stap 4 (Logo) opent, geen 403/RLS fout.
2) Controle (database):
   - tenants: 1 record met owner_email = login e-mail
   - user_roles: 1 record met (user_id = jouw id, tenant_id = nieuwe tenant id, role = tenant_admin)
3) (Live) Na publish hetzelfde herhalen op sellqo.app
4) Controleer dat je daarna:
   - tenants kan zien/selecteren
   - dashboard geen “trial/tenant missing” issues krijgt door ontbrekende roles

<risico’s & mitigatie>
- Risk: platform admins die tenants aanmaken zouden onbedoeld zichzelf tenant_admin maken.
  - Mitigatie: in trigger expliciet uitsluiten met is_platform_admin(auth.uid()).
- Risk: profiles.email is nullable.
  - Mitigatie: fallback op auth.jwt()->>'email' en null-safe coalesce; als beide null zijn blijft de insert terecht geblokkeerd.

<artefacten die aangepast worden>
- Database migration:
  - CREATE OR REPLACE FUNCTION public.can_create_first_tenant(...)
  - CREATE OR REPLACE FUNCTION public.assign_tenant_admin_role_on_tenant_insert(...)
  - CREATE TRIGGER ... AFTER INSERT ON public.tenants
- Frontend:
  - src/hooks/useOnboarding.ts (verwijder client-side user_roles insert; eventueel extra check/refresh)

