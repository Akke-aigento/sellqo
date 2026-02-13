

# Fix: Preview knop moet niet naar ongeverifieerd domein linken

## Probleem
De "Preview" knop op de Webshop pagina (`Storefront.tsx`) linkt naar het canonieke domein, ook als dat domein nog niet DNS-geverifieerd is. Hierdoor opent de preview een niet-werkende URL.

De `PreviewPanel` component (met `?preview=true` bypass) wordt alleen in de HomepageBuilder gebruikt, niet op de hoofdpagina.

## Oplossing
Twee aanpassingen:

1. **`Storefront.tsx`**: De `storefrontUrl` moet alleen een custom domein gebruiken als het daadwerkelijk `dns_verified` is. Anders valt het terug op `/shop/{slug}`.

2. **`useTenantDomains.ts`**: De `canonicalDomain` helper moet ook alleen geverifieerde domeinen teruggeven, zodat het overal correct werkt.

---

## Technische Details

### `src/hooks/useTenantDomains.ts`

De `canonicalDomain` variabele filtert nu alleen op `is_canonical`, maar moet ook op `dns_verified` filteren:

```typescript
// Was:
const canonicalDomain = domains.find(d => d.is_canonical);

// Wordt:
const canonicalDomain = domains.find(d => d.is_canonical && d.dns_verified);
```

### `src/pages/admin/Storefront.tsx`

De `storefrontUrl` logica wordt vereenvoudigd. Omdat `canonicalDomain` nu al alleen geverifieerde domeinen teruggeeft, werkt de bestaande code al correct. De fallback via `(currentTenant as any).custom_domain` moet ook gecontroleerd worden:

```typescript
const storefrontUrl = canonicalDomain?.domain
  ? `https://${canonicalDomain.domain}`
  : `/shop/${currentTenant.slug}`;
```

De extra `custom_domain` check wordt verwijderd omdat die geen verificatie doet.

| Bestand | Wijziging |
|---|---|
| `useTenantDomains.ts` | `canonicalDomain` filtert op `dns_verified` |
| `Storefront.tsx` | Verwijder onveilige `custom_domain` fallback |
