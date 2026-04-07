

## Fix: BTW-weergave consistent maken in plan-switch preview

### Probleem

Op de marketing- en billing-pagina staat "Alle prijzen zijn exclusief BTW", maar in het plan-switch preview scherm staat bij "Nu te betalen" de tekst **"Incl. BTW"** — dit is verwarrend en inconsistent.

De `stripe_preview.total` bevat waarschijnlijk al BTW (Stripe berekent dit), maar de weergave moet duidelijk maken dat het bedrag incl. BTW is, óf het bedrag excl. BTW tonen met de BTW eronder als apart bedrag.

### Aanpak

De Stripe preview geeft `total` (incl. tax) en `tax` apart terug. We passen de weergave aan zodat het duidelijk is:

- Toon **subtotaal excl. BTW** als hoofdbedrag
- Toon **BTW** als aparte regel eronder
- Toon **totaal incl. BTW** als eindtotaal

### Wijziging

**`src/components/admin/billing/PlanSwitchPreview.tsx`** (regels 133-145)

Van:
```
Nu te betalen: €X (Incl. €Y BTW)
```

Naar:
```
Subtotaal:     €(total - tax)
BTW:           €tax
─────────────
Totaal:        €total
```

Dit maakt het consistent: prijzen in de kaarten zijn excl. BTW, en bij afrekenen zie je de BTW-opbouw.

### Bestanden

| Bestand | Actie |
|---|---|
| `src/components/admin/billing/PlanSwitchPreview.tsx` | BTW-opbouw tonen i.p.v. "Incl. BTW" |

### Geen database wijzigingen nodig

