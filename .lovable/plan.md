

## Bugfix: Kortingscode berekening + display + sessie-isolatie

### Huidige status na analyse

- **BUG 1 (floating point)**: `cartGet` rounding is al correct (regel 1111). Maar `total` op regel 1124 wordt niet afgerond → fix nodig. `cartApplyDiscount` (regel 1249) slaat alleen `discount_code` op maar niet `discount_amount`/`total` → acceptabel want `cartGet` berekent het on-the-fly. Geen extra opslag nodig.

- **BUG 2 (pre-fill)**: De restore-logica (regels 211-219) werkt al, maar het `discountInputRef` input veld heeft `defaultValue=""` en wordt niet ge-pre-filled met de herstelde code. Na restore toont het groene blok correct (want `appliedDiscount` is gezet), dus het input veld is verborgen. **Dit werkt al correct** — als discount aanwezig is, wordt het groene badge getoond i.p.v. het input veld.

- **BUG 3 (sessie-isolatie)**: `cartApplyDiscount` regel 1249 mist `.eq('tenant_id', tenantId)`. Zelfde voor `cartRemoveDiscount` regel 1257.

### Wijzigingen

**1. `supabase/functions/storefront-api/index.ts`**

- **Regel 1124**: Rond `total` af:
  ```typescript
  total: Math.round(Math.max(0, subtotal - discountAmount) * 100) / 100,
  ```

- **Regel 1249**: Voeg tenant_id check toe aan applyDiscount update:
  ```typescript
  .eq('id', cartId).eq('tenant_id', tenantId)
  ```

- **Regel 1257**: Zelfde voor removeDiscount:
  ```typescript
  .eq('id', cartId).eq('tenant_id', tenantId)
  ```

**2. Geen wijzigingen nodig in ShopCheckout.tsx** — de discount restore en display werken al correct na de vorige fix.

### Bestanden
- `supabase/functions/storefront-api/index.ts` — 3 kleine wijzigingen (rounding + tenant isolatie)

