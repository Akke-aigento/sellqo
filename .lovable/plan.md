

## Bugfix: 3 kortingscode problemen in checkout

### Analyse

**BUG 1 — Korting wordt niet berekend in server-side cart:**
De `cartGet` functie (regel 1103-1107) retourneert `discount_code` maar berekent geen `discount_amount`. De `cartApplyDiscount` slaat alleen de code op maar berekent geen bedrag. De checkout gebruikt `appliedDiscount` uit CartContext, maar bij server-side cart loading (cart_id) wordt de discount_code niet uitgelezen en niet als `appliedDiscount` ingesteld.

**BUG 2 — Kortingscode verdwijnt bij server-side cart laden:**
In de `useEffect` die server cart laadt (regel 172-212), wordt `result.discount_code` niet gelezen. De code moet na het laden van items ook de discount valideren en als `appliedDiscount` instellen in CartContext.

**BUG 3 — Focus verlies bij typen:**
`DiscountCodeSection` is gedefinieerd als inline arrow function component (regel 535-568) binnen de render. Dit is technisch een nieuwe component elke render, maar het probleem is dat het een closure is die `discountCode` state bevat — bij elke keystroke rerendert de parent en remount dit component. Fix: gebruik een `useRef` voor de input waarde.

### Wijzigingen

**1. `supabase/functions/storefront-api/index.ts` — cartGet: bereken discount**

In `cartGet` (regel 1101-1107), na subtotal berekening:
- Als `cart.discount_code` aanwezig is, haal de discount_code op uit `discount_codes` tabel
- Bereken `discount_amount` (percentage of fixed)
- Return `discount_amount` en `total` in de response

```typescript
// Na regel 1101 (subtotal berekening):
let discountAmount = 0;
let discountInfo = null;
if (cart.discount_code) {
  const { data: dc } = await supabase.from('discount_codes')
    .select('*').eq('tenant_id', tenantId).eq('code', cart.discount_code).eq('is_active', true).maybeSingle();
  if (dc) {
    if (dc.discount_type === 'percentage') {
      discountAmount = Math.round(subtotal * (dc.discount_value / 100) * 100) / 100;
    } else {
      discountAmount = Math.min(dc.discount_value, subtotal);
    }
    if (dc.maximum_discount_amount) discountAmount = Math.min(discountAmount, dc.maximum_discount_amount);
    discountInfo = { discount_type: dc.discount_type, discount_value: dc.discount_value, applies_to: dc.applies_to, description: dc.description };
  }
}

// In return: voeg discount_amount, discount_info, total toe
```

**2. `src/pages/storefront/ShopCheckout.tsx` — server cart laden: restore discount**

In de `useEffect` voor server cart loading (regel 172-212), na het toevoegen van items:
- Lees `result.discount_code` en `result.discount_amount` en `result.discount_info`
- Als aanwezig, roep `applyDiscountCode()` aan met de juiste data

**3. `src/pages/storefront/ShopCheckout.tsx` — focus fix: ref-based input**

Vervang het controlled discount input door een uncontrolled ref-based input:
- Verwijder `discountCode` state (regel 133)
- Voeg `discountInputRef = useRef<HTMLInputElement>(null)` toe
- In `handleApplyDiscount`: lees `discountInputRef.current?.value`
- In `DiscountCodeSection`: gebruik `ref={discountInputRef}` i.p.v. `value={discountCode}`

### Bestanden
- `supabase/functions/storefront-api/index.ts` — cartGet discount berekening toevoegen
- `src/pages/storefront/ShopCheckout.tsx` — discount restore bij server cart + ref-based input

