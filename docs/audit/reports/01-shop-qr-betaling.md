# Audit: /shop/:tenantSlug/checkout/qr-betaling — QR-betaling
Pinned SHA: `03781985` · Datum: 2026-09-02 · Assen: A–G · Laag 1 (statisch)
Bestand: `src/pages/storefront/ShopQRPayment.tsx (142 r.)`
Gedeelde bevindingen: `01-storefront-gedeeld.md` (S-1 t/m S-6) — gelden ook hier.

## Verdict-samenvatting
🔴 1 · 🟡 1 · 🟢 3

## Bevindingen

### 🔴 A1 — De pagina zonder navigatiestatus openen wist de winkelwagen
- **Wat:** komt een klant hier zonder `location.state` — een refresh, een bladwijzer, een terugknop — dan wordt de winkelwagen geleegd en volgt een redirect naar de winkelhomepage. Zonder melding.
- **Waar:** `src/pages/storefront/ShopQRPayment.tsx:34-43`
  ```ts
  useEffect(() => { clearCart(); }, [clearCart]);

  if (!state?.orderId || !state?.bankDetails?.iban) {
    navigate(`/shop/${tenantSlug}`, { replace: true });
    return null;
  }
  ```
- **Root cause:** de `clearCart`-effect staat vóór de statusguard. React registreert effects tijdens de render en voert ze na de commit uit, óók als de component `null` teruggeeft. De wagen wordt dus gewist op elk bezoek aan deze URL, ook wanneer er helemaal geen bestelling bij hoort.
- **Tweede probleem in dezelfde regels:** alle betaalgegevens — bedrag, IBAN, OGM-mededeling, QR-payload — bestaan uitsluitend in `location.state`. Eén refresh op het moment dat de klant z'n bankapp opent, en de betaalinstructies zijn onherroepelijk weg, terwijl de bestelling server-side al bestaat. Er is vanaf hier geen weg terug naar die gegevens; de klant belandt op de homepage met een lege wagen.
- **Bijkomend:** `navigate()` wordt aangeroepen tijdens de render in plaats van in een effect. Dat levert in React een waarschuwing op over statuswijziging tijdens rendering.
- **Fixrichting:** de `clearCart`-effect achter de guard zetten (of hem conditioneel maken), en de pagina laten terugvallen op `orderId` uit de URL zodat de betaalgegevens herlaadbaar zijn — de route `/shop/:tenantSlug/order/:orderId` bestaat al. **Platform:** CC. **Frozen-path-risico:** nee.

### 🟡 B1 — Klopt de OGM-mededeling die hier getoond wordt?
De pagina toont `bankDetails.ogm_reference` en de QR-payload zoals `checkout_complete` ze aanlevert. Een verkeerde gestructureerde mededeling betekent dat de betaling niet automatisch aan de bestelling gekoppeld wordt.
```sql
SELECT o.order_number, o.total, o.currency, o.payment_method, o.payment_status,
       o.ogm_reference, t.iban, t.bic
FROM public.orders o JOIN public.tenants t ON t.id = o.tenant_id
WHERE o.payment_method = 'bank_transfer' AND o.tenant_id = '<test-tenant>'
ORDER BY o.created_at DESC LIMIT 5;
```
**Duiding:** controleer of `ogm_reference` de Belgische mod-97-structuur `+++xxx/xxxx/xxxxx+++` volgt en of het bedrag in de QR-payload overeenkomt met `o.total`.

## 🟢 Geverifieerd correct
1. **Nette terugval zonder QR-payload.** `:66-70` schakelt over op een variant met alleen de overschrijvingsgegevens in plaats van een leeg QR-vak te tonen.
2. **De doorknop naar de bestelling klopt.** `:117-119` navigeert naar `/shop/${tenantSlug}/order/${orderId}` — een route die bestaat (`App.tsx:195`), met `replace: true` zodat de terugknop niet in deze pagina blijft hangen.
3. **De QR-code wordt lokaal gegenereerd** uit `qrData.payload` (`react-qr-code`, `:65`) — geen externe beeldservice, dus geen betaalgegevens die naar een derde partij lekken.
