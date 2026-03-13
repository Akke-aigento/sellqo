

## Probleem: `update-bol-tracking` wordt nooit aangeroepen

### Analyse

De functie `update-bol-tracking` is aangemaakt maar **heeft geen cron job**. Hij wordt dus nooit automatisch uitgevoerd. De huidige cron jobs zijn:
- `marketplace-sync-scheduler` (elke 5 min)
- `auto-invoice-cron` (elke 5 min)
- `poll-tracking-status` (elke 30 min)

`poll-tracking-status` zou `update-bol-tracking` kunnen triggeren, maar in de logs staat: "No tenants with auto-poll enabled" — dus die code wordt nooit bereikt.

De database bevestigt het probleem: **alle recente Bol.com orders** (#1121-#1125) hebben `sync_status: accepted` en de meeste missen een `tracking_number`. Dit geldt ook voor jouw laatste order #1125.

**Dit zou ook voor de bestaande orders moeten werken**, niet alleen voor nieuwe. De batch mode zoekt op alle orders met `sync_status IN ('accepted', 'shipped', 'shipped_awaiting_tracking')`.

### Oplossing

**1 wijziging:** Voeg een cron job toe voor `update-bol-tracking` die elke 5 minuten draait. Dit zorgt ervoor dat:
- Tracking wordt **opgehaald** van Bol.com voor VVB orders (zoals #1125)
- Tracking wordt **gepusht** naar Bol.com voor orders die het lokaal al hebben (zoals #1122)
- Bestaande orders worden alsnog verwerkt

| Actie | Detail |
|---|---|
| Nieuwe cron job | `update-bol-tracking` elke 5 minuten via `cron.schedule` |

