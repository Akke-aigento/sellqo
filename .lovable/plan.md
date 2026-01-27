

# Fix: Demo Gegevens en Opslaan van Bedrijfsgegevens

## Geïdentificeerde Problemen

### Probleem 1: "Bakkerij De Gouden Korst" Demo Data
De "Bakkerij De Gouden Korst" data zit niet in de applicatiecode - het is bestaande data in de database van een eerdere test tenant. Dit is geen bug in de applicatie zelf, maar eerder testdata die opgeruimd moet worden.

**Echter**, er is wel een gerelateerd probleem: de placeholders in de formulieren zijn vrij generiek. Ze kunnen worden verbeterd om duidelijker aan te geven dat dit voorbeeldwaarden zijn.

### Probleem 2: Gegevens Slaan Niet Op
Dit is een **RLS (Row Level Security) probleem**. De huidige database policies zijn:

| Actie | Wie mag het |
|-------|-------------|
| INSERT tenant | Alleen `platform_admin` |
| UPDATE tenant | `platform_admin` OF `tenant_admin` van die tenant |

**Het probleem**: De `createTenant` functie in de onboarding hook probeert direct een tenant aan te maken in de database, maar nieuwe gebruikers zijn nog geen `platform_admin`. Ze krijgen die rol pas NA het aanmaken van hun eerste tenant.

Dit creëert een "chicken-and-egg" probleem: je hebt een tenant nodig om tenant_admin te worden, maar je moet platform_admin zijn om een tenant aan te maken.

---

## Oplossingsplan

### Fase 1: Database Fix - Tenant Aanmaken Toestaan

Een nieuwe RLS policy toevoegen die geauthenticeerde gebruikers toestaat om hun eerste tenant aan te maken:

```sql
-- Authenticated users can create their own tenant (for onboarding)
CREATE POLICY "Authenticated users can insert their own tenant"
  ON public.tenants FOR INSERT
  TO authenticated
  WITH CHECK (
    -- User email matches owner_email
    owner_email = auth.jwt()->>'email'
    -- AND user doesn't already have a tenant (prevents abuse)
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'tenant_admin'
    )
  );
```

### Fase 2: Placeholder Verbetering

De formulier placeholders aanpassen om neutraal en duidelijk te zijn:

| Veld | Oud | Nieuw |
|------|-----|-------|
| Winkelnaam | "Mijn Webshop" | "Bijv. Jouw Winkel" |
| Eigenaar naam | "Jan Jansen" | "Voornaam Achternaam" |
| Adres | "Straatnaam 123" | "Straatnaam + huisnummer" |
| Postcode | "1234 AB" | "1234 AB (NL) / 1000 (BE)" |
| Stad | "Amsterdam" | "Jouw stad" |
| KvK | "BE: 0123.456.789 \| NL: 12345678" | "8 cijfers (NL) / 10 cijfers (BE)" |

### Fase 3: Validatie Verbetering in BusinessSettings

De `handleSave` functie in `BusinessSettings.tsx` moet betere error handling krijgen zodat gebruikers duidelijk zien waarom opslaan faalt.

---

## Technische Wijzigingen

### Bestanden te wijzigen:

1. **Database migratie (nieuw)**
   - Nieuwe RLS policy voor tenant INSERT door geauthenticeerde gebruikers

2. **`src/components/admin/settings/BusinessSettings.tsx`**
   - Verbeterde placeholders
   - Betere error handling bij opslaan
   - Console logging voor debugging

3. **`src/components/onboarding/steps/BusinessDetailsStep.tsx`**
   - Consistente placeholders
   - Duidelijkere voorbeelden

4. **`src/components/onboarding/steps/WelcomeStep.tsx`**
   - Placeholder verbetering voor winkelnaam

---

## Database Clean-up Suggestie

De "Bakkerij De Gouden Korst" testdata zou handmatig verwijderd kunnen worden via een SQL query:

```sql
-- Alleen uitvoeren als deze tenant niet meer nodig is!
DELETE FROM tenants WHERE name = 'Bakkerij De Gouden Korst';
```

Of de data kan worden aangepast naar neutrale placeholders voor demo doeleinden.

---

## Samenvatting Wijzigingen

| Component | Wijziging |
|-----------|-----------|
| RLS Policy | Nieuwe INSERT policy voor onboarding |
| BusinessSettings.tsx | Placeholders + error handling |
| BusinessDetailsStep.tsx | Placeholders verbeteren |
| WelcomeStep.tsx | Placeholder verbeteren |

