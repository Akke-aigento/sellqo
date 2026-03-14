

## Probleem: Categorie aanmaken faalt met "duplicate key" error

### Analyse

De FK-migratie is correct toegepast — alle constraints staan nu op `ON DELETE SET NULL`. Het probleem is dat:

1. **De oude categorie nog steeds in de database staat** — eerdere delete-pogingen (vóór de FK-fix) zijn stilletjes gefaald, waardoor de slug nog bezet is
2. **De foutmelding is onduidelijk** — de gebruiker ziet "Fout" met een technische Postgres-melding in plaats van een begrijpelijke boodschap
3. **Er is geen slug-conflict detectie** — het formulier stuurt gewoon de insert en faalt pas bij de database

### Oplossing

**1. Slug-conflict detectie vóór insert** (`src/hooks/useCategories.ts`)

In de `createCategory` mutation, vóór de insert:
- Query of de slug al bestaat voor deze tenant
- Als ja: automatisch een suffix toevoegen (`-2`, `-3`, etc.) en de gebruiker informeren
- Als nee: gewoon doorgaan met insert

**2. Betere foutafhandeling bij create** (`src/hooks/useCategories.ts`)

In de `onError` van `createCategory`:
- Detecteer error code `23505` (unique violation)
- Toon een duidelijke melding: "Er bestaat al een categorie met deze slug. Probeer een andere naam."

**3. Slug-conflict check in het formulier** (`src/components/admin/CategoryFormDialog.tsx`)

- Bij het indienen van het formulier, pre-check of de slug beschikbaar is
- Als niet beschikbaar, toon inline validatiefout op het slug-veld
- Suggereer een alternatieve slug (bijv. `kabels-2`)

### Technische wijzigingen

**`src/hooks/useCategories.ts`** — `createCategory.mutationFn`:
```typescript
// Check slug availability before insert
const { data: existing } = await supabase
  .from('categories')
  .select('id')
  .eq('tenant_id', currentTenant.id)
  .eq('slug', data.slug)
  .maybeSingle();

if (existing) {
  // Find available slug with suffix
  let suffix = 2;
  let newSlug = `${data.slug}-${suffix}`;
  while (true) {
    const { data: check } = await supabase
      .from('categories').select('id')
      .eq('tenant_id', currentTenant.id)
      .eq('slug', newSlug).maybeSingle();
    if (!check) break;
    suffix++;
    newSlug = `${data.slug}-${suffix}`;
  }
  data = { ...data, slug: newSlug };
}
```

**`src/hooks/useCategories.ts`** — `createCategory.onError`:
```typescript
onError: (error: Error) => {
  const msg = error.message?.includes('23505')
    ? 'Er bestaat al een categorie met deze slug. Kies een andere naam of slug.'
    : error.message;
  toast({ title: 'Fout', description: msg, variant: 'destructive' });
}
```

**`src/components/admin/CategoryFormDialog.tsx`** — slug validatie verbeteren:
- Trim trailing dashes uit de gegenereerde slug
- Filter lege slugs na transformatie

### Samenvatting

- Pre-check slug beschikbaarheid vóór insert met auto-suffix
- Duidelijke Nederlandse foutmelding bij slug-conflicten
- Slug-generatie verbeteren (trailing dashes verwijderen)

