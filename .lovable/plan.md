

# Factuur e-mails versturen via facturen@sellqo.app

## Wat verandert er

De `from`-adres in de factuur e-mail functie wordt gewijzigd van `noreply@sellqo.app` naar `facturen@sellqo.app`. Dit geldt voor:
- De primaire factuur e-mail naar de klant
- De kopie e-mail naar CC/BCC ontvangers (Odoo, boekhouding)

De afzendernaam blijft per tenant: `"Bedrijfsnaam <facturen@sellqo.app>"`.

## Waarom dit veilig is

- Het domein `sellqo.app` is al geverifieerd in Resend (anders zou `noreply@` ook niet werken)
- Resend staat toe om elk adres op een geverifieerd domein te gebruiken
- Alle tenants gebruiken dezelfde afzender — alleen de display naam verschilt per tenant

## Technische wijziging

**Bestand:** `supabase/functions/send-invoice-email/index.ts`

Twee regels aanpassen:
- Regel 227: `noreply@sellqo.app` -> `facturen@sellqo.app` (primaire e-mail)
- Regel 245: `noreply@sellqo.app` -> `facturen@sellqo.app` (kopie e-mail)
