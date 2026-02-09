
# Plan: Factuur Actieknop Tooltips op Basis van Status

## Probleem

In de factuuroverzichten (`Billing.tsx`, `TenantInvoicesTab.tsx`, `PlatformBilling.tsx`) is er een ExternalLink knop die naar de Stripe hosted invoice pagina linkt. Deze knop:
1. Heeft geen tooltip - gebruikers weten niet wat de knop doet
2. De Stripe pagina zelf kan "Betaal factuur" tonen, ook voor reeds betaalde facturen
3. Dit is verwarrend voor gebruikers

## Oplossing

Tooltips toevoegen aan de ExternalLink knoppen met contextgevoelige tekst:

| Factuurstatus | Tooltip tekst |
|---------------|---------------|
| `paid` | "Bekijk factuur" |
| `open`, `draft`, etc. | "Betaal factuur" |

## Technische Wijzigingen

### 1. `src/pages/admin/Billing.tsx`

Regels 359-365 aanpassen:

```typescript
// Huidige code
{invoice.hosted_invoice_url && (
  <Button size="icon" variant="ghost" asChild>
    <a href={invoice.hosted_invoice_url} target="_blank">
      <ExternalLink className="h-4 w-4" />
    </a>
  </Button>
)}

// Nieuwe code met Tooltip
{invoice.hosted_invoice_url && (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button size="icon" variant="ghost" asChild>
        <a href={invoice.hosted_invoice_url} target="_blank">
          <ExternalLink className="h-4 w-4" />
        </a>
      </Button>
    </TooltipTrigger>
    <TooltipContent>
      {invoice.status === 'paid' ? 'Bekijk factuur' : 'Betaal factuur'}
    </TooltipContent>
  </Tooltip>
)}
```

**Import toevoegen:** `Tooltip, TooltipContent, TooltipTrigger` van `@/components/ui/tooltip`

### 2. `src/components/platform/TenantInvoicesTab.tsx`

Regels 95-105 aanpassen met dezelfde logica:

```typescript
{invoice.hosted_invoice_url && (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button variant="ghost" size="icon" asChild>
        <a href={invoice.hosted_invoice_url} target="_blank">
          <ExternalLink className="h-4 w-4" />
        </a>
      </Button>
    </TooltipTrigger>
    <TooltipContent>
      {invoice.status === 'paid' ? 'Bekijk factuur' : 'Betaal factuur'}
    </TooltipContent>
  </Tooltip>
)}
```

### 3. `src/pages/platform/PlatformBilling.tsx`

Regels 373-380 aanpassen met dezelfde tooltip logica.

### 4. (Optioneel) Download knop ook voorzien van tooltip

Voor consistentie kan de Download knop ook een tooltip krijgen: "Download PDF"

## Resultaat Na Implementatie

- Gebruikers zien duidelijke feedback over wat elke knop doet
- Bij betaalde facturen: "Bekijk factuur" (geen verwarring over "betalen")
- Bij openstaande facturen: "Betaal factuur"
- Betere gebruikerservaring met consistente tooltips
