
Plan: nieuwsbrief welkomstmail debug + fix

Wat ik heb nagekeken
- De storefront schrijft inschrijvingen wel degelijk weg:
  - `newsletter_subscribers` bevat recente records voor tenant `2606c5b9-caf8-4a42-94cd-80e3f3f31988`
  - o.a. `info@vanxcel.nl` op `2026-04-16 09:41:39` met `status=active` en `sync_status=synced`
- De nieuwsbriefconfig voor die tenant staat ook correct aan:
  - `provider=internal`
  - `double_optin=false`
  - `welcome_email_enabled=true`
  - er is ook effectief een `welcome_email_body`
- De flow wordt dus wel uitgevoerd tot en met “subscriber aanmaken/activeren”.

Root cause
- In `supabase/functions/storefront-api/index.ts` zit de welkomstmail achter deze stap:
  - eerst wordt tenant-info opgehaald met `.select('name, website')`
- In de live database bestaat kolom `website` helemaal niet op `public.tenants`
- Daardoor klapt net dat stukje in de `try` van de welcome-email flow
- De fout wordt daarna geslikt door:
  - `catch (e) { console.error('Welcome email send error:', e); }`
- Resultaat:
  - inschrijving lukt
  - subscriber wordt active/synced
  - maar de welkomstmail wordt nooit verstuurd

Is de flow inhoudelijk goed?
Ja, grotendeels wel:
```text
Nieuwsbrief formulier/popup
→ storefront-api action=newsletter_subscribe
→ subscriber insert/update
→ status active
→ welcome email proberen te sturen
```
Alleen het e-mailstuk faalt door die foutieve tenant-query, en omdat die fout niet naar de UI bubbelt lijkt alles “geslaagd”.

Belangrijk inzicht
- Ik zie geen harde bevestiging dat er ooit echt iets verstuurd is voor deze inschrijving.
- Er is voor deze welcome-email flow ook geen aparte duurzame mail-log tabel in gebruik.
- Dus op dit moment heb je wel bewijs van inschrijving, maar niet van een succesvolle verzending.

Wat ik zou aanpassen
1. Fix de tenant-query in `storefront-api`
- `select('name, website')` vervangen door alleen bestaande velden
- minimaal: `select('name, custom_domain')`
- of gewoon `select('name')` als website-merge niet nodig is

2. Veilige fallback voor `{{company_website}}`
- waarde afleiden uit:
  - `custom_domain` als die bestaat
  - anders leeg laten
- zodat een ontbrekende website nooit de mail blokkeert

3. Logging verbeteren
- expliciete log vóór de send
- expliciete log met response na de send
- expliciete foutlog als tenant-data lookup faalt
- zo kunnen we nadien exact zien: “template opgebouwd”, “send geprobeerd”, “send geslaagd/mislukt”

4. Optioneel maar sterk aanbevolen: kleine audit trail
- bijv. een status of foutmelding opslaan op subscriber-niveau voor welcome email
- dan zie je in admin meteen waarom een mail niet ging

Concrete implementatie
- Bestand: `supabase/functions/storefront-api/index.ts`
- Wijzigingen:
  - tenant select corrigeren
  - website-placeholder robuust maken
  - logging rond welcome-email send uitbreiden
- Daarna de functie opnieuw deployen en een nieuwe testinschrijving doen

Verwacht resultaat na fix
- Nieuwe nieuwsbriefinschrijvingen blijven gewoon aangemaakt worden
- Welkomstmail wordt daarna effectief verstuurd via Resend
- Als verzending toch nog faalt, krijgen we eindelijk een bruikbare fout in de logs in plaats van een stille mislukking
