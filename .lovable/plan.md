

## Diagnose: Bol.com order #1136 — label niet printbaar + status

### Bevindingen

**Order status: WEL correct geaccepteerd**
- `sync_status = 'accepted'` — de auto-accept werkt wél
- De order is correct geïmporteerd en als accepted gemarkeerd

**Label: WEL aangemaakt bij Bol.com, maar PDF niet opgehaald**
- Er bestaat een shipping label record met `status: 'created'` en `external_id: 45741890-...`
- Maar `label_url: NULL` en `tracking_number: NULL`
- Dit betekent: het VVB label is succesvol aangemaakt bij Bol.com (de `processStatus` werd `SUCCESS`), maar het ophalen van de PDF en/of de tracking is mislukt of getimedout

**Waarom kan je niet printen?**
- De UI toont correct een "Opnieuw ophalen" knop als `label_url` leeg is (lijn 262 in BolActionsCard)
- Maar het printen werkt niet omdat er geen PDF URL is om te printen

### Oorzaak
Het PDF-ophalen (stap 3 in create-bol-vvb-label, regels 639-692) is waarschijnlijk getimedout of gefaald. Dit kan gebeuren als:
- Bol.com de PDF nog niet klaar had na de process status SUCCESS
- De fetch of upload naar storage een timeout kreeg (30s limiet)
- De edge function overall timedout (isolate timeout)

### Fix: automatisch retry mechanisme

Het probleem is dat als het PDF-ophalen faalt, het label in een "limbo" staat: `status: created` maar geen `label_url`. De "Opnieuw ophalen" knop bestaat maar vereist handmatige actie.

**1. Directe fix voor order #1136**: Trigger de retry via de bestaande "Opnieuw ophalen" knop — dit roept `create-bol-vvb-label` aan met `retry: true` en haalt de PDF alsnog op

**2. Structurele verbetering**: In `sync-bol-orders` een automatische retry toevoegen voor labels die `status: 'created'` hebben maar `label_url IS NULL` — vergelijkbaar met de bestaande VVB-RETRY sectie

### Wijzigingen

| Bestand | Actie |
|---|---|
| `supabase/functions/sync-bol-orders/index.ts` | Retry-blok toevoegen voor labels met `created` status maar geen `label_url` |
| `supabase/functions/create-bol-vvb-label/index.ts` | Betere foutafhandeling: als PDF fetch faalt, status op `pending` houden i.p.v. `created` |

### Detail: status-fix in create-bol-vvb-label

Momenteel (lijn 732):
```typescript
status: transporterLabelId ? "created" : "pending"
```

Dit zou moeten zijn:
```typescript
status: (transporterLabelId && labelPdfUrl) ? "created" : "pending"
```

Zodat labels zonder PDF op `pending` blijven staan en automatisch opnieuw opgepakt worden door de retry-logica.

### Detail: retry in sync-bol-orders

Voeg een blok toe (vergelijkbaar met het bestaande VVB-RETRY blok rond lijn 620) dat:
1. Labels zoekt met `status = 'pending'` of `status = 'created'` maar `label_url IS NULL`
2. Voor elk zo'n label de retry aanroept via `create-bol-vvb-label` met `retry: true`

