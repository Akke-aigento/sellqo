

## Fix: Whitespace verwijderen op mobiel in Inbox

### Probleem
Op mobiel (390px) staat er onnodige padding links en rechts rond de inbox Card. De mappen mogen blijven, maar de witruimte moet weg zodat alles de volle breedte benut.

### Wijzigingen

| Bestand | Actie |
|---------|-------|
| `src/pages/admin/Messages.tsx` | Padding reduceren op mobiel |

### Detail

**Messages.tsx**

Twee padding-aanpassingen:

1. **Regel 154** — Header padding: `p-3` → `p-2` of `px-2` op mobiel
2. **Regel 176** — Content padding: `p-3` → `p-1` of `px-1` op mobiel

Concreet:
```tsx
// Regel 154 — was:
<div className={`${isSinglePanel ? 'p-3 pb-0' : 'p-6 pb-0'}`}>
// wordt:
<div className={`${isSinglePanel ? 'px-1 pt-2 pb-0' : 'p-6 pb-0'}`}>

// Regel 176 — was:
<div className={`${isSinglePanel ? 'p-3' : 'p-6'} ...`}>
// wordt:
<div className={`${isSinglePanel ? 'px-1 pb-1' : 'p-6'} ...`}>
```

Dit verwijdert de zijdelingse whitespace op mobiel terwijl desktop onaangetast blijft. De Card en mappen blijven exact hetzelfde, alleen de container-padding wordt kleiner.

### Geen database wijzigingen nodig

