

## Fix: Content-Type header in push-bol-campaign

### Wijziging

**Bestand**: `supabase/functions/push-bol-campaign/index.ts`, regel 45

Vervang:
```ts
"Content-Type": "application/vnd.retailer.v11+json",
```

Door:
```ts
"Content-Type": "application/json",
```

Geen andere wijzigingen. Daarna edge function opnieuw deployen.

