

# Plan: Inbound Domain Aanpassen naar sellqo.app

## Samenvatting

Simpele wijziging: verander het inbound email domein van `inbound.sellqo.app` naar `sellqo.app` om overeen te komen met de Resend configuratie.

---

## Wijzigingen

### 1. Edge Function Update

**Bestand:** `supabase/functions/handle-inbound-email/index.ts`

Wijzig de regex die het prefix extraheert:

```typescript
// VOOR:
function extractPrefix(email: string): string | null {
  const match = email.match(/^([^@]+)@inbound\./i);
  return match ? match[1].toLowerCase() : null;
}

// NA:
function extractPrefix(email: string): string | null {
  const match = email.match(/^([^@]+)@sellqo\.app$/i);
  return match ? match[1].toLowerCase() : null;
}
```

### 2. UI Component Update

**Bestand:** `src/components/admin/settings/InboundEmailSettings.tsx`

Wijzig de constante voor het domein:

```typescript
// VOOR:
const INBOUND_DOMAIN = 'inbound.sellqo.app';

// NA:
const INBOUND_DOMAIN = 'sellqo.app';
```

---

## Resultaat

| Tenant | Forwarding Adres |
|--------|------------------|
| demo-bakkerij | `demo-bakkerij@sellqo.app` |
| mijn-winkel | `mijn-winkel@sellqo.app` |
| nieuwe-tenant | `nieuwe-tenant@sellqo.app` |

---

## Verificatie

Na deze wijziging:
- Alle tenants gebruiken automatisch `{slug}@sellqo.app`
- Nieuwe tenants krijgen via de database trigger hun slug als prefix
- De Resend webhook kan direct getest worden

