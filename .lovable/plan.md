

## Klantenoverzicht: één unified view

### Probleem

De twee tabbladen (CRM Klanten / Webshop Accounts) zijn verwarrend. Storefront klanten worden niet automatisch overgezet — het zijn gewoon twee losse tabellen. Eén unified view is overzichtelijker.

### Aanpak

Merge beide datasets in één tabel. Elke rij krijgt een "Bron" badge (`Webshop` of `CRM`) zodat je het verschil nog kunt zien.

**Concrete stappen:**

1. **Verwijder de Tabs** — geen tabbladen meer, gewoon één Card met één tabel
2. **Merge de data** — In de component: map `storefrontCustomers` naar hetzelfde formaat als CRM customers (naam, email, telefoon, type, bestellingen=0, uitgegeven=€0, bron="Webshop") en concat met CRM customers (bron="CRM"). Dedupliceer op email (als een storefront klant ook in CRM zit, toon alleen de CRM-rij met een "Webshop + CRM" badge)
3. **Bron-kolom toevoegen** — Nieuwe kolom "Bron" met een Badge (`Webshop`, `CRM`, of `Webshop + CRM`)
4. **Totaal count** — Header toont het totaal van de gemergte lijst
5. **Filter behouden** — Zoeken en type-filter werken op de unified lijst (type-filter is alleen relevant voor CRM-rijen; webshop-rijen worden altijd getoond tenzij "B2B"/"B2C" specifiek geselecteerd)

### Technisch detail

```text
CRM customers (customers tabel)
  + storefront_customers (storefront_customers tabel)
  - deduplicated on email
  = unified list met "source" badge
```

### Bestanden

| Bestand | Actie |
|---|---|
| `src/pages/admin/Customers.tsx` | Verwijder Tabs, merge datasets, voeg Bron-kolom toe |

### Geen database wijzigingen nodig

