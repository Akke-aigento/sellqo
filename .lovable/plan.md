
## Fix: BTW-nummer, Kortingscode en BTW-berekening in Storefront

### Gevonden oorzaken

**Probleem 1: Geen B2B toggle / BTW-nummer veld zichtbaar**
De `usePublicStorefront` hook (regel 67) haalt slechts een beperkt aantal velden op uit de `tenants` tabel. De velden `enable_b2b_checkout`, `require_vies_validation`, `block_invalid_vat_orders`, `default_vat_handling`, `tax_percentage`, `oss_enabled` en `oss_threshold_reached` worden **niet** opgehaald. Hierdoor leest `ShopCheckout.tsx` overal `undefined`, waardoor:
- `enableB2bCheckout` = `false` (toggle wordt niet getoond)
- `defaultVatHandling` = `'exclusive'` (BTW wordt bovenop de prijs berekend)
- Alle andere BTW-instellingen niet werken

**Probleem 2: BTW wordt bijgerekend terwijl de shop op "inclusive" staat**
De Loveke-tenant heeft `default_vat_handling: 'inclusive'` in de database, maar omdat dit veld niet wordt opgehaald door de hook, valt de code terug op `'exclusive'` en rekent BTW bovenop de prijs.

**Probleem 3: Geen kortingscode in de Cart Drawer**
De kortigscode-input zit wel in de volledige winkelwagenpagina (`ShopCart.tsx`), maar **niet** in de `CartDrawer.tsx` (de slide-over die opent na "Toevoegen aan winkelwagen"). De screenshot toont deze drawer zonder kortingscode-veld.

---

### Oplossingen

#### 1. `usePublicStorefront.ts` -- Ontbrekende tenant-velden toevoegen

De tenant query (regel 67) uitbreiden met de volgende velden:
- `enable_b2b_checkout`
- `require_vies_validation`
- `block_invalid_vat_orders`
- `default_vat_handling`
- `tax_percentage`
- `oss_enabled`
- `oss_threshold_reached`

Het `PublicTenant` interface (regel 13-27) uitbreiden met deze velden.

#### 2. `ShopCheckout.tsx` -- Type-safe velden gebruiken

De `(tenant as any)?.` casts vervangen door directe property access, nu de velden in de tenant query zitten. Geen functionele wijzigingen nodig -- de logica is al correct, alleen de data ontbrak.

#### 3. `CartDrawer.tsx` -- Kortingscode-input toevoegen

Een compact kortingscode-veld toevoegen in de footer van de CartDrawer, boven de subtotaal-regel:
- Input + "Toepassen" knop (zelfde API-call als in ShopCart)
- Bij toegepaste korting: groene badge met code + verwijder-knop (X)
- Kortingsregel tonen in het subtotaal-overzicht
- Mobile-first: compacte layout die past in de drawer

---

### Technische details

**Bestanden die worden aangepast:**

| Bestand | Wijziging |
|---|---|
| `src/hooks/usePublicStorefront.ts` | Tenant query uitbreiden met 7 extra velden + PublicTenant interface updaten |
| `src/pages/storefront/ShopCheckout.tsx` | `(tenant as any)?.` casts vervangen door directe property access |
| `src/components/storefront/CartDrawer.tsx` | Kortingscode-input + kortingsregel toevoegen in de drawer footer |

**Impact:**
- B2B/B2C toggle verschijnt automatisch (data was er al, werd alleen niet opgehaald)
- BTW-nummer veld + VIES-validatie werkt automatisch
- BTW-berekening respecteert `inclusive` instelling (geen BTW meer bovenop de prijs)
- Kortingscode beschikbaar in alle 3 de locaties: CartDrawer, ShopCart, ShopCheckout
