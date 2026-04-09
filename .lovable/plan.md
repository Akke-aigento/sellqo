

## Fix: Ontkoppelknop toevoegen bij "Onboarding niet afgerond" status

### Probleem
Wanneer een Stripe account is aangemaakt maar de onboarding niet is voltooid, toont de UI alleen "Onboarding voltooien" en "Status vernieuwen" — er is geen optie om te ontkoppelen. Als je het e-mailadres niet kent, zit je vast.

### Oplossing
Voeg dezelfde "Stripe ontkoppelen" knop + bevestigingsdialoog toe aan het `status?.configured && !status?.onboarding_complete` blok in `PaymentSettings.tsx` (regels 417-437).

### Wijziging

**Bestand: `src/components/admin/settings/PaymentSettings.tsx`**

Na de bestaande knoppen "Onboarding voltooien" en "Status vernieuwen" (rond regel 437), voeg een `Separator` en dezelfde gevarenzone-sectie toe met de ontkoppelknop + AlertDialog, identiek aan het blok op regels 344-393.

Dit hergebruikt exact dezelfde disconnect-logica die al werkt voor volledig geconfigureerde accounts.

### Resultaat
- Bij "Onboarding niet afgerond" verschijnt ook een "Stripe ontkoppelen" knop
- Mancini Milano kan direct ontkoppeld worden zonder de onboarding te hoeven voltooien

