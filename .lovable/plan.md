
# Volledige Reset: VanXcel & Gerelateerde Accounts Verwijderen

## Te Verwijderen Data

### Auth Users (auth.users)
| ID | Email | Actie |
|----|-------|-------|
| `6b57c08d-c991-4d17-8687-2e9a324216c8` | info@vanxcel.com | Verwijderen |
| `50bd5600-94f3-4e7d-8d79-06278df802f2` | info@outlook.com | Verwijderen |

### Profiles (public.profiles) - CASCADE via FK
De profiles worden automatisch verwijderd door de `ON DELETE CASCADE` foreign key wanneer we de auth.users verwijderen.

| ID | Email | onboarding_step | onboarding_data bevat |
|----|-------|-----------------|----------------------|
| `6b57c08d-c991-4d17-8687-2e9a324216c8` | info@vanxcel.com | 3 | shopSlug: vanxcel |
| `50bd5600-94f3-4e7d-8d79-06278df802f2` | info@outlook.com | 4 | shopSlug: vanxcel |

### Tenants (public.tenants)
Reeds verwijderd - geen tenants meer met slug "vanxcel" of owner_email van deze accounts.

### User Roles (public.user_roles)
Geen rollen gevonden voor deze twee users (info@vanxcel.com en info@outlook.com).

## Uitvoering

**Stap 1: Verwijder auth.users (Test environment)**
Dit triggert automatisch:
- `profiles` verwijdering via CASCADE
- Alle gerelateerde auth tokens worden ongeldig

```sql
DELETE FROM auth.users 
WHERE email IN ('info@vanxcel.com', 'info@outlook.com');
```

**Stap 2: Verwijder auth.users (Live environment)**  
Dezelfde data in live environment opschonen.

```sql
DELETE FROM auth.users 
WHERE email IN ('info@vanxcel.com', 'info@outlook.com');
```

## Resultaat na Uitvoering

| Item | Status |
|------|--------|
| auth.users (info@vanxcel.com) | Verwijderd |
| auth.users (info@outlook.com) | Verwijderd |
| profiles (beide) | Verwijderd via CASCADE |
| onboarding_data met "vanxcel" | Verwijderd met profiles |
| tenants met slug "vanxcel" | Al verwijderd |
| user_roles | Geen gevonden |

Na deze reset kun je opnieuw registreren met info@vanxcel.com en een volledig frisse onboarding doorlopen.

## Waarschuwing

- **Onomkeerbaar**: Deze accounts en alle bijbehorende data worden permanent verwijderd
- **Account vanxcel@outlook.com blijft behouden**: Dit account heeft tenant_admin rollen op demo-tenants en wordt niet verwijderd volgens jouw keuze
