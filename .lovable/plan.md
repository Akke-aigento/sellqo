

## Plan: Contactformulier Storefront + E-mail Forwarding

### Huidige situatie

1. **Contactformulier**: De `Contact.tsx` is de SellQo-platform pagina, niet per-tenant. Er bestaat **geen** contactformulier in de storefront (`/shop/:tenantSlug/...`). Het platform-formulier doet bovendien niets — het simuleert alleen een submit.
2. **E-mail forwarding**: Bestaat niet. Inkomende berichten landen in de SellQo inbox maar worden nergens doorgestuurd naar een externe mailbox.

### Wat we bouwen

#### 1. Storefront Contactformulier
Een contactpagina voor elke tenant-webshop (`/shop/:tenantSlug/contact`) waar bezoekers een bericht kunnen sturen dat direct in de SellQo inbox terechtkomt.

- **Pagina**: `src/pages/storefront/ShopContact.tsx` — formulier met naam, e-mail, onderwerp, bericht
- **Edge function**: `storefront-contact-form` — valideert input, slaat op als `customer_messages` met `direction: 'inbound'`, `channel: 'contact_form'`, koppelt aan bestaande klant of maakt prospect aan (zelfde patroon als `handle-inbound-email`)
- **Route**: Toevoegen aan router
- **Navigatie**: Link toevoegen aan de ShopLayout navigatie

#### 2. E-mail Forwarding Instelling
Per tenant een optioneel extern e-mailadres instellen waar inkomende berichten automatisch naartoe worden doorgestuurd.

- **Database**: Twee nieuwe kolommen op `tenants`:
  - `email_forward_address` (text, nullable) — bijv. `info@mijnbedrijf.nl`
  - `email_forward_enabled` (boolean, default false)
- **Instellingen UI**: Sectie toevoegen in `InboundEmailSettings.tsx` — toggle + e-mailadres input
- **Edge function aanpassing**: `handle-inbound-email` uitbreiden — na opslaan van bericht, als forwarding aan staat, stuur een kopie naar het forward-adres via de bestaande e-mail infrastructuur
- **Storefront contact form**: Zelfde forwarding-logica toepassen in de `storefront-contact-form` edge function

### Technische details

**Database migratie:**
```sql
ALTER TABLE tenants 
  ADD COLUMN email_forward_address text,
  ADD COLUMN email_forward_enabled boolean DEFAULT false;
```

**Forwarding mechanisme**: Na het opslaan van een inbound bericht, checken of `email_forward_enabled = true` en `email_forward_address` is ingevuld. Zo ja, een e-mail sturen naar dat adres met de originele inhoud (subject, body, afzender info). Gebruikt de bestaande Lovable e-mail pipeline.

**Contact form edge function**: Publiek endpoint (geen auth vereist), met rate limiting op basis van IP/tenant combo om misbruik te voorkomen. Zod-validatie op alle input.

### Bestanden

- `src/pages/storefront/ShopContact.tsx` — nieuw: contactpagina
- `supabase/functions/storefront-contact-form/index.ts` — nieuw: formulier verwerking + forwarding
- `supabase/functions/handle-inbound-email/index.ts` — uitbreiden met forwarding
- `src/components/admin/settings/InboundEmailSettings.tsx` — forwarding sectie toevoegen
- `src/hooks/useTenant.tsx` — Tenant interface uitbreiden
- Router config — route toevoegen
- ShopLayout navigatie — link toevoegen
- Database migratie — twee kolommen

