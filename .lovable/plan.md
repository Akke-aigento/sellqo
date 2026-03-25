

## Bol.com Stock Sync Fix + Product Sync met Selectieve Import

### Probleem 1: Stock sync faalt — root cause gevonden

In de edge function logs zie ik de exacte fout:

```text
violations: [{"name":"offer-id","reason":"Request contains invalid value(s): '193210736985', must be lowercase and a valid UUID."}]
```

Het `bol_offer_id` in de database is `193210736985` — dat is **geen UUID**. Bol.com v10 API vereist UUIDs als offer-ID. De `lookupOfferIdByEan` functie bestaat al in de code, maar wordt **overgeslagen** omdat de code eerst checkt of `bol_offer_id` gevuld is (regel 227-235). Omdat die gevuld is met een ongeldige waarde, wordt de EAN-lookup nooit getriggerd.

**Fix in `supabase/functions/sync-bol-inventory/index.ts`:**
- UUID-validatie toevoegen vóór het gebruiken van `bol_offer_id` als fallback
- Als `bol_offer_id` geen geldig UUID is → negeren en via EAN opnieuw opzoeken
- Na succesvolle lookup: `bol_offer_id` overschrijven met het correcte UUID

### Probleem 2: Product sync bestaat nog niet

Er is geen `sync-bol-products` edge function. De `trigger-manual-sync` heeft al een `products` data type maar voor `bol_com` is die niet gemapped.

**Nieuw: `supabase/functions/sync-bol-products/index.ts`**

Werking:
1. Haal alle offers op via Bol.com API (`GET /retailer/offers?page=X`)
2. Retourneer de lijst naar de frontend (titel, EAN, prijs, voorraad, offer-ID)
3. **Importeer NIET automatisch** — stuur alleen de lijst terug

**Nieuw: Selectieve import UI**

In de marketplace detail pagina een "Producten importeren" flow:
1. Knop "Producten ophalen van Bol.com"
2. Dialog/drawer toont alle Bol.com offers in een tabel met checkboxes
3. Per product: naam, EAN, prijs, voorraad op Bol, of het al gekoppeld is in SellQo
4. Tenant selecteert welke producten ze willen importeren
5. "Importeer geselecteerde" → maakt nieuwe producten aan in `products` tabel met correcte `bol_offer_id` (UUID), `bol_ean`, `marketplace_mappings`
6. Al bestaande producten (match op EAN) worden gelinkt, niet gedupliceerd

**Aanpassingen:**

| Bestand | Actie |
|---|---|
| `supabase/functions/sync-bol-inventory/index.ts` | UUID-validatie toevoegen, ongeldige offer IDs automatisch herlookup via EAN |
| `supabase/functions/sync-bol-products/index.ts` | **Nieuw** — haalt offers op van Bol.com, retourneert lijst voor selectie |
| `supabase/functions/trigger-manual-sync/index.ts` | `products` case toevoegen voor `bol_com` |
| `src/components/admin/marketplace/BolProductImportDialog.tsx` | **Nieuw** — selectieve import dialog met checkboxes, EAN-matching, bulk import |
| `src/pages/admin/MarketplaceDetail.tsx` | "Producten importeren" knop + dialog integratie |

### Flow samengevat

```text
Tenant klikt "Producten ophalen"
  → Edge function haalt offers van Bol.com API
  → Frontend toont lijst met checkboxes
  → Tenant selecteert wat ze willen
  → "Importeer" → producten aangemaakt/gelinkt in SellQo
  → Stock sync werkt daarna automatisch (correcte UUID offer IDs)
```

