
# Super Admin Rechten: Volledige Toegang Tot Alle Tenants

## Huidige Situatie

Je hebt de `platform_admin` rol, maar die werkt niet zoals verwacht omdat:

1. **Database functie probleem**: De `get_user_tenant_ids()` functie filtert op `tenant_id IS NOT NULL`, maar jouw platform_admin rol heeft `tenant_id = NULL`
2. **RLS policies blokkeren je**: Veel tabellen (zoals `customer_messages`, `notifications`) gebruiken `tenant_id IN (get_user_tenant_ids())` - dit sluit platform admins uit
3. **Edge functions inconsistent**: Sommige functies checken platform_admin correct, andere niet

## De Oplossing

We passen de `get_user_tenant_ids()` functie aan zodat platform admins automatisch toegang krijgen tot ALLE tenants:

### Stap 1: Database Functie Updaten

Huidige code:
```sql
SELECT tenant_id
FROM public.user_roles
WHERE user_id = _user_id
  AND tenant_id IS NOT NULL
```

Nieuwe code:
```sql
-- Als platform admin: return alle tenant IDs
IF EXISTS (
  SELECT 1 FROM public.user_roles 
  WHERE user_id = _user_id AND role = 'platform_admin'
) THEN
  RETURN QUERY SELECT id FROM public.tenants;
ELSE
  -- Normale gebruiker: alleen toegewezen tenants
  RETURN QUERY SELECT tenant_id
  FROM public.user_roles
  WHERE user_id = _user_id
    AND tenant_id IS NOT NULL;
END IF;
```

### Waarom Dit Werkt

Door de `get_user_tenant_ids()` functie aan te passen, krijgen platform admins automatisch toegang tot alle bestaande RLS policies zonder dat we elke policy individueel moeten aanpassen. Dit is de "single point of change" aanpak.

| Tabel | Huidige Policy | Na Fix |
|-------|----------------|--------|
| customer_messages | Alleen eigen tenants | Alle tenants voor platform_admin |
| notifications | Alleen eigen tenants | Alle tenants voor platform_admin |
| orders, products, etc. | Alleen eigen tenants | Alle tenants voor platform_admin |

### Stap 2: Bestaande Platform Admin Policies Behouden

Sommige tabellen hebben al aparte `is_platform_admin()` checks:
- `tenants` - al correct
- `user_roles` - al correct  
- `invoices`, `quotes`, etc. - al correct

Deze blijven werken zoals ze zijn.

### Stap 3: Edge Functions Audit (Optioneel)

We hebben al `send-team-invitation` gefixt. Andere edge functions die mogelijk nog platform_admin check missen:
- `accept-team-invitation` - controleert of user al in tenant zit
- `create-addon-checkout` - controleert tenant access
- `create-platform-bank-payment` - controleert tenant access

Deze kunnen in een vervolgstap aangepakt worden als je er tegenaan loopt.

## Resultaat Na Implementatie

| Wat | Voorheen | Straks |
|-----|----------|--------|
| Inbox (customer_messages) | Geblokkeerd | Volledige toegang |
| Notificaties | Geblokkeerd | Volledige toegang |
| Team uitnodigen | Gefixed | Werkt |
| Orders/Producten bekijken | Geblokkeerd | Volledige toegang |
| Tenant settings aanpassen | Afhankelijk | Volledige toegang |

## Samenvatting

Met één database migratie (update van `get_user_tenant_ids`) krijg je als platform admin automatisch volledige toegang tot alle tenant data, zonder elke RLS policy apart te moeten aanpassen. Dit is de meest elegante en onderhoudbare oplossing.
