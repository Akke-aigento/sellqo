## Diagnose

De "Bewerken"-knop op de klantendetailpagina staat **hardcoded op `disabled`** — geen `onClick`, geen permissie-check, geen dialoog eraan gekoppeld. Dit heeft niks te maken met de tenant SellQo, met RLS of met de laatste security-batches:

- `src/pages/admin/CustomerDetail.tsx` regel 214–219:
  ```tsx
  <Button variant="outline" size="sm" disabled>
    <Edit className="h-4 w-4 mr-1" />
    Bewerken
  </Button>
  ```
- De `updateCustomer`-mutation wordt op dezelfde pagina wél al gebruikt voor het inline wisselen van *voorkeurstaal* (regel 411), dus de write-flow zelf werkt.
- RLS staat UPDATE toe voor `tenant_admin`/`staff` van de tenant én voor platform-admins (via aparte policy). `info@sellqo.app` is `tenant_admin` op SellQo én platform-admin, dus RLS blokkeert niets.

Kortom: knop is nooit afgemaakt. Zelfde symptoom zou in élke tenant optreden.

## Oplossing

`CustomerFormDialog` (nu alleen "aanmaken") uitbreiden met een **edit-modus**, en de knop op de detailpagina daaraan koppelen.

### Stappen

1. **`src/components/admin/CustomerFormDialog.tsx`**
   - Props uitbreiden met `mode?: 'create' | 'edit'`, `customer?: Customer`, `trigger?: ReactNode`, en controlled `open`/`onOpenChange` (optioneel).
   - Bij `mode === 'edit'`: formulier prefill uit `customer`, titel "Klant bewerken", submit-label "Wijzigingen opslaan".
   - Submit callt de bestaande `onSubmit` prop; de aanroeper bepaalt of dat `createCustomer` of `updateCustomer` is.

2. **`src/pages/admin/CustomerDetail.tsx`**
   - Lokale `editOpen`-state toevoegen.
   - `disabled` van de Bewerken-knop weghalen, `onClick={() => setEditOpen(true)}` toevoegen.
   - `<CustomerFormDialog mode="edit" customer={customer} open={editOpen} onOpenChange={setEditOpen} onSubmit={(data) => updateCustomer.mutate({ customerId, data })} isLoading={updateCustomer.isPending} />` renderen.
   - Na succes dialog sluiten (via `onSuccess` van de mutation of via `isSuccess`-effect); React Query invalideert `['customer', id]` al niet — daarom in dezelfde flow ook `queryClient.invalidateQueries({ queryKey: ['customer', customerId] })` triggeren (in `useCustomers.updateCustomer.onSuccess` toevoegen, naast de bestaande `['customers']`-invalidatie).

3. **`src/pages/admin/Customers.tsx`** — geen wijziging; blijft `mode="create"` gebruiken (default).

### Scope-grenzen

- Geen RLS-, migratie- of edge-function wijzigingen.
- Geen wijziging aan `useCustomers.updateCustomer` behalve de extra query-invalidatie voor `['customer', id]`.
- Geen changelog/newsletter (interne UI-fix, Spoor 1).
- i18n: dialoog gebruikt al Nederlandse labels zoals de rest van de klantenmodule; conform bestaand patroon.

### Verificatie

- Typecheck moet groen zijn.
- Handmatig: op SellQo-tenant klant "Ozay Group Belgium BV" openen → Bewerken → veld wijzigen → opslaan → detail toont nieuwe waarde zonder page-reload.
