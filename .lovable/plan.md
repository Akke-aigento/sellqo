
# Fix: Bestellingen plaatsen loopt vast - "Tenant not found"

## Oorzaak gevonden

Beide edge functions (`create-checkout-session` en `create-bank-transfer-order`) proberen kolommen `oss_enabled` en `oss_threshold_reached` op te halen uit de `tenants` tabel, maar deze kolommen bestaan niet in de database. Dit laat de query falen, waardoor de foutmelding "Tenant not found" verschijnt.

## Oplossing

**Twee ontbrekende kolommen toevoegen aan de `tenants` tabel:**

| Kolom | Type | Default | Doel |
|-------|------|---------|------|
| `oss_enabled` | boolean | false | EU One-Stop Shop BTW-regeling actief |
| `oss_threshold_reached` | boolean | false | OSS drempelbedrag bereikt |

Dit is een eenvoudige database-migratie die de bestaande data niet beïnvloedt. Na het toevoegen van deze kolommen zullen beide checkout-functies correct werken.

## Technische details

### Database migratie (SQL)
```sql
ALTER TABLE public.tenants 
  ADD COLUMN IF NOT EXISTS oss_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS oss_threshold_reached boolean DEFAULT false;
```

### Geen code-wijzigingen nodig
De edge functions (`create-checkout-session` en `create-bank-transfer-order`) selecteren deze kolommen al correct en gebruiken ze in de BTW-berekening. Zodra de kolommen bestaan, werkt alles.

### Impact
- Bestaande tenants krijgen `oss_enabled = false` en `oss_threshold_reached = false` als default
- Geen invloed op bestaande bestellingen of data
- Beide betaalmethoden (iDEAL/Creditcard/Bancontact en Directe Bankoverschrijving) werken weer
