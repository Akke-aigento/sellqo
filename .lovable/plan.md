

## Verzonden e-mails bekijkbaar maken vanuit berichtgeschiedenis

### Wat
De berichten in de `MessageHistoryPanel` (order- en klantpagina) klikbaar maken. Bij klik opent een dialog/modal met de volledige e-mail (subject, afzender/ontvanger, datum, en de gerenderde HTML-inhoud).

### Aanpak

**`src/components/admin/MessageHistoryPanel.tsx`** — enige bestand dat wijzigt:

1. **State toevoegen** voor het geselecteerde bericht (`selectedMessage`)
2. **`MessageItem` klikbaar maken** — `cursor-pointer` + `hover:bg-muted/50` + `onClick` → zet selected message
3. **`MessageDetailDialog` component toevoegen** (in hetzelfde bestand):
   - Dialog met de volledige e-mail info:
     - Header: subject, status badge
     - Meta: van/naar, datum/tijd
     - Body: de `body_html` gerenderd in een `iframe` (sandbox, srcdoc) zodat de HTML-styling intact blijft zonder de app te beïnvloeden
     - Fallback: als geen `body_html`, toon `body_text`
   - Sluitknop

### Technische details

- **iframe met `srcdoc`**: De `body_html` wordt getoond in een sandboxed iframe (`sandbox=""`) zodat scripts geblokkeerd worden maar de styling van de originele e-mail behouden blijft
- **Geen nieuwe bestanden, hooks of database-wijzigingen** — alles zit al in `customer_messages.body_html`
- **Geen backend wijzigingen**

### Layout

```text
Berichtgeschiedenis (bestaand):
┌─────────────────────────────────┐
│ ● Je bestelling #1128 is onderweg  [Verzonden] │  ← klikbaar
│   Naar: paul@example.com • 23 mrt  │
│ ● Factuur #INV-2024-001           [Verzonden] │  ← klikbaar
│   Naar: paul@example.com • 22 mrt  │
└─────────────────────────────────┘

Dialog bij klik:
┌──────────────────────────────────────┐
│  Je bestelling #1128 is onderweg 📦  │
│  Van: VanXcel <noreply@sellqo.app>   │
│  Naar: paul@example.com             │
│  23 mrt 2026, 14:32                 │
│  ─────────────────────────────────── │
│  ┌────────────────────────────────┐  │
│  │  (gerenderde HTML e-mail       │  │
│  │   in iframe)                   │  │
│  └────────────────────────────────┘  │
│                          [Sluiten]   │
└──────────────────────────────────────┘
```

### Bestanden
- `src/components/admin/MessageHistoryPanel.tsx` — klikbare items + detail dialog

