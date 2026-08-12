# ONBOARD-CUSTOMER-CONFLICT-1 — tenant-trigger maskeert klantconflict als slugconflict

## Bevestigde oorzaak

De fout ontstaat niet door een tweede klik, een remount of een werkelijk bezette slug.

De runtimevolgorde is bevestigd door code, backendlogs en databasegegevens:

1. `create-tenant` probeert tenant `test` in te voegen.
2. De slugcheck vindt vooraf geen tenant met die slug.
3. Tijdens de insert draait de `AFTER INSERT`-trigger `register_tenant_as_sellqo_customer_trigger`.
4. `register_tenant_as_sellqo_customer()` probeert voor de nieuwe tenant een klant aan te maken in de interne SellQo-tenant met e-mail `test@test.com`.
5. Voor die SellQo-tenant bestaat al een klant met exact `test@test.com` en `customers` heeft een unieke `(tenant_id, email)`-constraint.
6. De trigger gebruikt nu alleen `ON CONFLICT (linked_tenant_id) ... DO NOTHING`; die vangt het e-mailconflict niet op. PostgreSQL geeft daarom `23505` en rolt atomair ook de tenant-insert terug. Daarom zijn achteraf noch tenant, noch rol aanwezig en blijft het profiel op stap 3.
7. `create-tenant` behandelt vervolgens iedere `23505` alsof `tenants.slug` dubbel is en retourneert foutief HTTP 409 `slug_conflict`. Dat veroorzaakt precies de misleidende dialoog uit de screenshot.

De backendlog bevestigt `Inserting tenant` gevolgd door `Duplicate key error`; de database bevestigt tegelijk dat slug `test` niet bestaat, dat de tenant is teruggerold en dat de conflicterende SellQo-klant met `test@test.com` wel bestaat.

## Fix

### 1. Maak tenantregistratie als SellQo-klant idempotent

Voeg een additieve database-migratie toe die alleen `public.register_tenant_as_sellqo_customer()` vervangt.

- Behoud de bestaande anti-lus, lege-e-mailguard, nieuwsbriefvelden en tenantregistratie.
- Vang conflict op de bestaande `customers_tenant_id_email_key` constraint expliciet af.
- Als dezelfde SellQo-klant al bestaat:
  - koppel `linked_tenant_id` alleen wanneer die nog `NULL` is;
  - behoud een bestaande koppeling, zodat een eigenaar met meerdere winkels niet telkens naar de nieuwste winkel wordt omgehangen;
  - vul ontbrekende bedrijfs-/naamgegevens aan zonder bestaande klantgegevens te overschrijven;
  - voeg de tenant-tags samen zonder duplicaten;
  - maak de tenant-insert nooit afhankelijk van het opnieuw kunnen invoegen van hetzelfde klant-e-mailadres.

Kern van de wijziging:

```sql
INSERT INTO public.customers (...)
VALUES (...)
ON CONFLICT ON CONSTRAINT customers_tenant_id_email_key
DO UPDATE SET
  linked_tenant_id = COALESCE(public.customers.linked_tenant_id, EXCLUDED.linked_tenant_id),
  company_name = COALESCE(public.customers.company_name, EXCLUDED.company_name),
  first_name = COALESCE(public.customers.first_name, EXCLUDED.first_name),
  tags = (
    SELECT ARRAY(
      SELECT DISTINCT tag
      FROM unnest(COALESCE(public.customers.tags, '{}') || EXCLUDED.tags) AS tag
    )
  );
```

De migratie maakt geen tabellen aan en wijzigt geen RLS of grants.

### 2. Stop met elke unieke fout als slugconflict te labelen

Pas in `supabase/functions/create-tenant/index.ts` uitsluitend de `23505`-afhandeling na de tenant-insert aan.

- Vraag na een `23505` opnieuw op of `tenants.slug = slug` werkelijk bestaat.
- Alleen als die rij bestaat, retourneer 409 met een slugsuggestie.
- Als de slug niet bestaat, retourneer 500 met een generieke creatiefout en log de echte databasefout/constraint. Zo wordt een toekomstige trigger- of child-tableconstraint nooit opnieuw als “URL bezet” gemaskeerd.

Indicatieve diff:

```diff
 if (insertError.code === '23505') {
-  const suggestedSlug = await findAvailableSlug(supabase, slug);
-  return slugConflictResponse(suggestedSlug);
+  const { data: conflictingSlug } = await supabase
+    .from('tenants')
+    .select('id')
+    .eq('slug', slug)
+    .maybeSingle();
+
+  if (conflictingSlug) {
+    const suggestedSlug = await findAvailableSlug(supabase, slug);
+    return slugConflictResponse(suggestedSlug);
+  }
+
+  logStep('Insert unique violation outside tenants.slug', {
+    code: insertError.code,
+    message: insertError.message,
+    details: insertError.details,
+  });
+  return new Response(JSON.stringify({ error: 'Tenant creation failed' }), {
+    status: 500,
+    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
+  });
 }
```

De bestaande pre-flight slugcheck en echte slug-raceafhandeling blijven behouden.

## Verificatie

1. Controleer het regressiegeval met een nieuw auth-profiel waarvan het e-mailadres al als klant van de interne SellQo-tenant bestaat.
2. Doorloop stap 1–3 één keer en bevestig:
   - `create-tenant` retourneert 200;
   - tenant, `tenant_admin`-rol en standaardrecords bestaan;
   - bestaande klant veroorzaakt geen duplicaat en krijgt alleen een koppeling als die nog ontbrak;
   - profiel gaat naar onboarding-stap 4;
   - de wizard toont de logostap zonder slugdialoog.
3. Test daarnaast een werkelijk bezette slug: die moet nog steeds 409 plus een geldige suggestie geven.
4. Test een eigenaar met meerdere winkels: een bestaande `linked_tenant_id` mag niet worden overschreven.

## Geraakte onderdelen

- Eén additieve database-migratie voor `register_tenant_as_sellqo_customer()`.
- `supabase/functions/create-tenant/index.ts` voor correcte classificatie van unieke fouten.
- Changelog-entry in de bestaande vier talen na succesvolle verificatie.

Geen wijzigingen aan de wizard, auth-flow, `ProtectedRoute`, rollen-refresh, styling of andere onboardingstappen.
