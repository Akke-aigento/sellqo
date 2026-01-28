
<context>
Gebruiker kan in onboarding stap “Bedrijfsgegevens” nog steeds niet verder/opslaan. Screenshot laat in console en toast zien:
- 403 (Forbidden) bij POST naar `tenants`
- `new row violates row-level security policy for table "tenants"`

We hebben al een RLS-policy die bij INSERT controleert:
`can_create_first_tenant(auth.uid(), owner_email) OR is_platform_admin(auth.uid())`

`can_create_first_tenant()` eist dat `owner_email` exact gelijk is aan het e-mailadres in de login-JWT.
</context>

<root-cause>
In `useOnboarding.createTenant()` wordt `owner_email` gezet op `state.data.email` (het e-mailadres dat je in het formulier “Bedrijfsgegevens” invult):

```ts
owner_email: email || user.email || ''
```

Als de gebruiker in stap 3 een “bedrijf/contact e-mail” invult die afwijkt van het login e-mailadres, dan faalt de RLS-check en wordt de insert geblokkeerd. Dit verklaart exact de “new row violates row-level security policy … tenants” fout.

Belangrijk: `owner_email` is in de database NOT NULL en wordt (in RLS) gebruikt om te bewijzen dat de ingelogde gebruiker deze tenant mag aanmaken. Het formulier gebruikt dit veld nu ook als “factuur/klant-communicatie e-mail”, maar dat botst met de security-regel.
</root-cause>

<goal>
- Gebruiker moet altijd door stap “Bedrijfsgegevens” kunnen gaan, ook als het factuur/contact e-mailadres anders is dan de login.
- Security blijft intact (alleen ingelogde gebruiker kan hun eerste tenant aanmaken).
- Het ingevoerde factuur/contact e-mailadres blijft wel opgeslagen (maar niet in `owner_email`).
</goal>

<plan>
1) Code-fix: `useOnboarding.createTenant()` corrigeren (geen database changes nodig)
   - Zet `owner_email` altijd op het login e-mailadres (`user.email`).
   - Sla het e-mailadres uit de onboarding (“voor facturen/klantcommunicatie”) op in een passend veld op `tenants`:
     - Gebruik `billing_email` (bestaat al in `tenants`).
   - (Optioneel, maar logisch) vul ook:
     - `billing_company_name` = `businessName`
     - `billing_vat_number` = `vatNumber`
     - `billing_address` (json) = `{ street: address, postal_code, city, country }` (alleen als we zeker zijn dat dit nergens anders een andere structuur verwacht; anders laten we dit weg).
   - Voeg defensieve check toe: als `user.email` ontbreekt, toon een duidelijke foutmelding (“Je login e-mailadres ontbreekt, log opnieuw in”).

2) UI-clarificatie (klein, maar voorkomt herhaling)
   - Pas tekst/tooltip in `BusinessDetailsStep` aan zodat duidelijk is:
     - Dit e-mailadres is voor facturen/communicatie
     - Het hoeft niet hetzelfde te zijn als je login e-mailadres

3) Compliance/validatie (optioneel maar aanbevolen om consistent te blijven)
   - In `useInvoiceCompliance` wordt nu `currentTenant.owner_email` gebruikt als “E-mailadres” requirement.
   - Update dit naar:
     - `billing_email` als die bestaat, anders fallback naar `owner_email`.
   - Update `Tenant` type in `useTenant.tsx` om `billing_email?: string | null` (en evt. `billing_company_name?: string | null`) toe te voegen, zodat we dit netjes kunnen gebruiken zonder `any`.

4) Testplan (end-to-end)
   - Log in met e-mailadres A.
   - Start onboarding:
     - Vul bij “Bedrijfsgegevens” e-mailadres B in (anders dan A).
     - Klik “Volgende stap”.
     - Verwacht: tenant wordt aangemaakt zonder RLS error; onboarding gaat door naar logo stap.
   - Controleer in de app (tenant context / instellingen):
     - `owner_email` = login e-mail A
     - `billing_email` = ingevoerd e-mail B
   - Controleer dat bestaande tenant-admin flows (tenants ophalen, wisselen, etc.) niet breken.

</plan>

<files-to-change>
- `src/hooks/useOnboarding.ts` (createTenant: owner_email vs billing_email mapping)
- `src/components/onboarding/steps/BusinessDetailsStep.tsx` (copy/tooltip verduidelijking)
- `src/hooks/useInvoiceCompliance.ts` (valideer billing_email i.p.v. owner_email, met fallback)
- `src/hooks/useTenant.tsx` (Tenant interface uitbreiden met billing_email (+ evt. billing_company_name))
</files-to-change>

<why-this-is-safe>
- We houden de bestaande RLS-policy intact: hij blijft checken dat `owner_email` matcht met login. We passen alleen de app-code aan zodat die regel altijd wordt gerespecteerd.
- Het “bedrijf/contact e-mailadres” blijft bewaard via `billing_email`, zonder security-conflict.
</why-this-is-safe>
