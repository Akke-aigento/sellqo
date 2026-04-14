

# Facturen pagina mobiel optimaliseren

## Probleem
Op 390px viewport is de facturentabel afgekapt — de kolommen Status en Acties vallen buiten het scherm. Zelfde probleem als bij Order Detail.

## Aanpak

**Bestand:** `src/pages/admin/Invoices.tsx`

Dezelfde strategie als bij Order Detail: op mobiel (`sm:hidden`) een card-layout tonen, op desktop (`hidden sm:block`) de bestaande tabel behouden.

### Mobiele kaart-layout per factuur
```text
┌─────────────────────────────────┐
│ INV-2026-0005                   │
│ Aaron Mercken          € 59,99  │
│ 14 apr 2026    [Betaald]        │
│                    [📥] [✉️]    │
└─────────────────────────────────┘
```

Elke kaart toont:
- Factuurnummer (bold)
- Klantnaam + bedrag op één regel
- Datum + statusbadge
- Peppol-badge (indien van toepassing)
- Actieknoppen (download PDF, UBL, mail, Peppol markeren)

De bestaande `Table` krijgt `hidden sm:block`, de nieuwe kaart-lijst `sm:hidden`.

### Bestanden
| Bestand | Actie |
|---------|-------|
| `src/pages/admin/Invoices.tsx` | Card-layout voor mobiel toevoegen, tabel verbergen op small screens |

