

## Meer variabelen beschikbaar maken in campagnes & templates

### Huidige situatie
Er worden slechts 3-4 variabelen getoond: `{{customer_name}}`, `{{company_name}}`, `{{unsubscribe_url}}`. Maar de `customers` tabel heeft 59 kolommen met veel bruikbare data.

### Welke variabelen toevoegen

**Klant-variabelen** (uit `customers` tabel):
- `{{customer_first_name}}` — voornaam
- `{{customer_last_name}}` — achternaam  
- `{{customer_email}}` — e-mailadres
- `{{customer_phone}}` — telefoonnummer
- `{{customer_company}}` — bedrijfsnaam (B2B)
- `{{customer_vat_number}}` — BTW-nummer
- `{{customer_city}}` — stad
- `{{customer_country}}` — land
- `{{total_orders}}` — aantal bestellingen
- `{{total_spent}}` — totaal besteed

**Bedrijf-variabelen** (uit `tenants` tabel):
- `{{company_name}}` — bedrijfsnaam (bestaat al)
- `{{company_email}}` — bedrijfs-email
- `{{company_phone}}` — telefoonnummer
- `{{company_website}}` — website
- `{{company_iban}}` — IBAN

**Systeem-variabelen**:
- `{{current_date}}` — huidige datum
- `{{unsubscribe_url}}` — uitschrijflink (bestaat al)

### UI-verbetering
In plaats van een lange tekstregel met variabelen, een **klikbare variabelen-lijst** toevoegen:
- Compact grid/chips met alle variabelen
- Klik op een variabele → wordt ingevoegd in de editor op de cursor-positie
- Gegroepeerd: "Klant", "Bedrijf", "Systeem"

### Bestanden

| Bestand | Actie |
|---|---|
| `src/components/admin/marketing/VariableInserter.tsx` | Nieuw: klikbare variabelen-chips component |
| `src/components/admin/marketing/CampaignDialog.tsx` | Variabelen-tekst vervangen door VariableInserter |
| `src/components/admin/marketing/TemplateDialog.tsx` | Variabelen-tekst vervangen door VariableInserter |

### Geen database wijzigingen nodig

