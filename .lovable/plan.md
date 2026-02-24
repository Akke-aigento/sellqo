

## Fix: Volledige publieke toegang voor de webshop

### Probleem

Na het eerdere fix voor "Shop niet gevonden" (`tenants` tabel) zijn er nog steeds meerdere tabellen die **geen publieke leestoegang** hebben. Niet-ingelogde bezoekers kunnen daardoor:

- Geen producten zien (lege productpagina)
- Geen categorienavigatie gebruiken
- Geen juridische pagina's (privacy, voorwaarden) lezen

### Volledige audit -- welke tabellen zijn al goed?

| Tabel | Publiek leesbaar? | Hoe gebruikt? |
|---|---|---|
| `tenants` | Ja (zojuist gefixed) | Shopinfo ophalen |
| `tenant_theme_settings` | Ja | Thema/kleuren/fonts |
| `homepage_sections` | Ja | Homepage secties |
| `storefront_pages` | Ja | CMS pagina's |
| `themes` | Ja | Thema defaults |
| `product_categories` | Ja | Product-categorie koppeling |
| `external_reviews` | Ja | Reviews op homepage |
| `product_variants` | Ja | Varianten op productpagina |
| `product_variant_options` | Ja | Variant opties (maat, kleur) |
| `orders` | Ja | Bevestigingspagina |
| `order_items` | Ja | Bevestigingspagina |
| `tenant_domains` | Ja | Custom domains |

### Wat mist er?

| Tabel | Nodig voor | Voorgestelde filter |
|---|---|---|
| `products` | Productoverzicht + detailpagina | `is_active = true AND hide_from_storefront = false` |
| `categories` | Categorienavigatie + filters | `is_active = true AND hide_from_storefront = false` |
| `legal_pages` | Privacy, voorwaarden, etc. | `is_published = true` |

### Tabellen die NIET publiek hoeven (via edge function)

De winkelwagen, checkout, verzendmethodes, kortingscodes, cadeaubonnen en klantregistratie worden allemaal afgehandeld via de Storefront API edge function die `service_role` gebruikt. Die werken dus al correct zonder publieke RLS policies.

### Technische wijziging

Een database migratie met drie nieuwe SELECT policies:

```text
products   -> FOR SELECT USING (is_active = true AND hide_from_storefront = false)
categories -> FOR SELECT USING (is_active = true AND hide_from_storefront = false)
legal_pages -> FOR SELECT USING (is_published = true)
```

### Waarom is dit veilig?

- Alleen **SELECT** -- geen INSERT/UPDATE/DELETE
- Strenge filters: alleen actieve, niet-verborgen producten/categorieen en gepubliceerde juridische pagina's
- Dezelfde aanpak als de bestaande policies op `homepage_sections`, `storefront_pages`, `external_reviews`
- Gevoelige tabellen (klanten, bestellingen schrijven, kortingscodes beheren) blijven beschermd

### Bestanden

| Wijziging | Details |
|---|---|
| Database migratie | 3 nieuwe RLS policies op `products`, `categories`, `legal_pages` |

Geen code-wijzigingen nodig -- de queries in `usePublicStorefront.ts` filteren al correct op `is_active`, `hide_from_storefront`, en `is_published`.
