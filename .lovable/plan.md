

# CC/BCC e-mailadressen toevoegen aan Facturatie-instellingen

## Wat is het probleem?

De database ondersteunt al `invoice_cc_email` en `invoice_bcc_email` op de tenants-tabel, en de e-mail verzend-functie (`send-invoice-email`) gebruikt deze velden al correct. Maar er is geen plek in de instellingenpagina waar je deze e-mailadressen kunt invullen.

## Wat gaan we doen?

De pagina **Instellingen > Automatische Facturatie** uitbreiden met twee e-mail invoervelden:

1. **CC e-mailadres** - Bijv. je boekhoudprogramma (exact.nl, moneybird, etc.)
2. **BCC e-mailadres** - Voor een extra kopie zonder dat de klant dit ziet

## Wijzigingen

### Bestand: `src/components/admin/settings/InvoiceAutomationSettings.tsx`

- **Twee state-variabelen toevoegen:** `ccEmail` en `bccEmail`
- **Query uitbreiden:** `invoice_cc_email` en `invoice_bcc_email` toevoegen aan de `select()` en `update()` calls
- **Twee Input-velden toevoegen** onder de bestaande switches:
  - CC e-mailadres (met uitleg: "Dit adres ontvangt een kopie van elke verstuurde factuur, bijv. je boekhoudsoftware")
  - BCC e-mailadres (met uitleg: "Blinde kopie - de klant ziet dit adres niet")
- Beide velden alleen tonen/actief maken als "Automatisch factuur e-mailen" aan staat
- E-mail validatie toevoegen (basis regex check)

Geen database-wijzigingen nodig - de kolommen `invoice_cc_email` en `invoice_bcc_email` bestaan al, en `send-invoice-email` gebruikt ze al.
