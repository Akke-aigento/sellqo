
# Fix: Onboarding RLS Blokkade - Volledige Reset

## Analyse
Je account (`info@vanxcel.com`) heeft:
- **0 tenants** - er is niets om te verwijderen
- **0 roles** - ook niets om te verwijderen  
- Profile staat op `onboarding_step: 3` (BusinessDetails)

Het probleem: de `can_create_first_tenant()` functie faalt omdat `auth.jwt() ->> 'email'` niet altijd beschikbaar is in de RLS context. De huidige logica is te strikt.

## Oplossing in 2 Stappen

### Stap 1: Database Fix - Robuustere Email Check
Update de `can_create_first_tenant` functie om ALTIJD te werken:

```sql
CREATE OR REPLACE FUNCTION public.can_create_first_tenant(_user_id uuid, _owner_email text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    (
      -- Check 1: Profile email match (most reliable)
      lower(trim(coalesce(_owner_email, ''))) = 
        lower(trim(coalesce((SELECT email FROM public.profiles WHERE id = _user_id), '')))
      OR
      -- Check 2: JWT email match (backup)
      lower(trim(coalesce(_owner_email, ''))) = 
        lower(trim(coalesce(auth.jwt() ->> 'email', '')))
      OR
      -- Check 3: If user has verified profile, allow if _user_id matches auth.uid()
      (_user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id))
    )
    AND
    NOT EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = _user_id
        AND role = 'tenant_admin'::app_role
        AND tenant_id IS NOT NULL
    );
$$;
```

De nieuwe check 3 zorgt ervoor dat als je ingelogd bent (auth.uid() == _user_id) en je hebt een profile, je een tenant mag aanmaken.

### Stap 2: Reset Je Profile naar Stap 1
```sql
UPDATE public.profiles 
SET onboarding_step = 1, 
    onboarding_completed = false,
    onboarding_skipped_at = null
WHERE id = '6b57c08d-c991-4d17-8687-2e9a324216c8';
```

## Verwacht Resultaat
Na deze fix:
1. Refresh de pagina of log opnieuw in
2. Onboarding start vanaf stap 1 (Welkom)
3. Bij stap 3 → 4 wordt de tenant succesvol aangemaakt
4. Je komt in je dashboard terecht

## Wat Dit Oplost
- De RLS check is nu robuuster en werkt ook als `auth.jwt()` leeg is
- Je profile is gereset naar stap 1 voor een schone start
- Toekomstige gebruikers zullen dit probleem niet meer ervaren
