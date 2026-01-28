
# Fix: Wijzig alle sellqo.ai emails naar sellqo.app

## Gevonden Locaties

### Database (Kritiek - moet handmatig)

| Tabel | Veld | Huidige Waarde | Nieuwe Waarde |
|-------|------|----------------|---------------|
| `tenants` | `owner_email` | info@sellqo.ai | info@sellqo.app |
| `profiles` | `email` | info@sellqo.ai | info@sellqo.app |

**Let op**: De `profiles.email` is gekoppeld aan je Supabase Auth account. Dit kan ik niet zomaar wijzigen - je moet mogelijk je email updaten via de auth flow.

### Codebase Wijzigingen

| Bestand | Huidige | Nieuw |
|---------|---------|-------|
| `src/pages/public/Contact.tsx` | hello@sellqo.com | hello@sellqo.app |
| `src/pages/Pricing.tsx` | sales@sellqo.com | sales@sellqo.app |

### Optioneel: API Docs (overweging)

De `api.sellqo.com` URLs in `ApiDocs.tsx` zijn placeholder URLs voor documentatie. Deze kunnen ook naar `.app` als je dat domein gaat gebruiken voor de API.

### Niet Wijzigen: Migratie Files

De oude migratie file bevat `.ai` emails maar deze wijzigen we niet - migraties zijn historische records.

---

## Implementatie

### Stap 1: Database Updates (via SQL)

```sql
-- Update tenant owner email
UPDATE tenants 
SET owner_email = 'info@sellqo.app' 
WHERE slug = 'sellqo';

-- Update profile email (let op: dit wijzigt alleen de profile tabel, niet de auth email)
UPDATE profiles 
SET email = 'info@sellqo.app' 
WHERE email = 'info@sellqo.ai';
```

### Stap 2: Code Wijzigingen

**Contact.tsx**: 
- `hello@sellqo.com` → `hello@sellqo.app`

**Pricing.tsx**:
- `sales@sellqo.com` → `sales@sellqo.app`

---

## Belangrijk: Supabase Auth Email

Je Supabase Auth account email (`info@sellqo.ai`) kan niet via een database update gewijzigd worden. Hiervoor moet je:

1. In je app: ga naar account settings en wijzig je email
2. Of: via Supabase Auth API de email updaten

Dit is een aparte stap die je zelf moet doen na de code wijzigingen.

---

## Samenvatting

| Type | Aantal Items | Actie |
|------|--------------|-------|
| Database records | 2 | SQL update |
| Frontend code | 2 bestanden | Code wijziging |
| Auth email | 1 | Handmatig via settings |
| Migratie files | 0 | Niet aanpassen |
