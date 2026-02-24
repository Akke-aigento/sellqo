

## Fix: SEPA Betaling "Bestelling niet gevonden" + Standaard betaalmethode

### Gevonden problemen

**1. Order items insertion faalt silently**
De edge function `create-bank-transfer-order` probeert een `vat_rate` kolom in te voegen in de `order_items` tabel, maar die kolom bestaat niet. Hierdoor worden de bestelregels niet aangemaakt. De fout wordt niet doorgestuurd naar de frontend (bewust "non-blocking"), maar kan downstream problemen veroorzaken.

Foutmelding in de logs:
```text
Could not find the 'vat_rate' column of 'order_items' in the schema cache
```

**2. "Bestelling niet gevonden" na SEPA betaling**
De bestelling wordt wel correct aangemaakt in de database, en de redirect-URL is correct (`/shop/loveke/order/{uuid}`). De bevestigingspagina (`ShopOrderConfirmation.tsx`) haalt de bestelling op met de Supabase client (anon key), en er bestaat een RLS policy die dit toestaat.

De meest waarschijnlijke oorzaak: de gepubliceerde site draait mogelijk een oudere versie van de code die het `payment_method` veld niet selecteert in de query, of de PostgREST schema-cache heeft de `payment_method` kolom nog niet opgepikt na een recente migratie. Door de `payment_method` query te laten falen geeft `.maybeSingle()` null terug, waardoor de "niet gevonden" melding verschijnt.

**Fix:** Toevoegen van een extra veiligheidslaag in de ShopOrderConfirmation pagina met betere error handling en logging, plus het verwijderen van `vat_rate` uit de order_items insert in de edge function.

**3. Standaard betaalmethode is Stripe i.p.v. SEPA**
De `payment_methods_enabled` array van de tenant is `['stripe', 'bank_transfer']`. De code pakt `methods[0]` als standaard, dus Stripe. De gewenste volgorde is dat SEPA (bank_transfer) standaard geselecteerd is wanneer beschikbaar.

---

### Oplossingen

#### 1. Database migratie: `vat_rate` kolom toevoegen aan `order_items`

Een `vat_rate` kolom (numeric, nullable) toevoegen aan de `order_items` tabel zodat de edge function correct kan inserten.

#### 2. Edge function: `create-bank-transfer-order` fixen

- De `vat_rate` kolom wordt nu ondersteund door de migratie, dus geen code-wijziging nodig in de edge function zelf.

#### 3. `ShopCheckout.tsx`: Standaard betaalmethode naar `bank_transfer`

De logica in het `useEffect` aanpassen zodat `bank_transfer` als standaard wordt geselecteerd wanneer deze in de lijst van beschikbare methodes staat. Alleen als `bank_transfer` niet beschikbaar is, valt het terug op `stripe`.

Huidige code (regel 172-179):
```typescript
if (methods.length > 0 && !methods.includes(paymentMethod)) {
  setPaymentMethod(methods[0]);
}
```

Nieuwe logica:
```typescript
// Prefer bank_transfer as default
if (methods.includes('bank_transfer')) {
  setPaymentMethod('bank_transfer');
} else {
  setPaymentMethod(methods[0]);
}
```

De initialisatie op regel 96 veranderen van `useState('stripe')` naar `useState('bank_transfer')`.

#### 4. `ShopOrderConfirmation.tsx`: Betere error handling

- Console logging toevoegen voor debugging
- Een fallback toevoegen: als `maybeSingle()` null retourneert, kort wachten en opnieuw proberen (race condition bescherming)

---

### Technische details

| Bestand | Wijziging |
|---|---|
| Database migratie | `ALTER TABLE order_items ADD COLUMN vat_rate numeric;` |
| `src/pages/storefront/ShopCheckout.tsx` | Standaard betaalmethode naar `bank_transfer` (regels 96, 172-179) |
| `src/pages/storefront/ShopOrderConfirmation.tsx` | Retry-logica + console logging toevoegen bij order ophalen |

