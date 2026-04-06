

## Campagne-editor upgraden: Rich text, planning & triggers

### Wat er nu is
De `CampaignDialog` heeft alleen een raw HTML textarea — onbruikbaar voor normale gebruikers. Er is geen scheduling (datum/tijd) en geen trigger-systeem. De inbox heeft al een werkende TipTap rich text editor (`ComposeRichEditor.tsx`) die we kunnen hergebruiken.

### Wat er verandert

**1. Rich text editor met HTML-switch in CampaignDialog**

- Voeg een toggle toe: "Visueel" (standaard) vs "HTML" modus
- In visuele modus: hergebruik de bestaande `ComposeRichEditor` (TipTap) met extra extensies voor headings en images
- In HTML modus: de huidige monospace textarea
- De editor converteert automatisch tussen modes — visuele output wordt gewrapt in de email-template HTML structuur bij opslaan
- Voeg een "Voorbeeld" knop toe die de email als preview toont

**2. Scheduling: datum en tijd kiezen**

Voeg aan het formulier toe:
- Een "Wanneer verzenden?" sectie met 3 opties:
  - **Nu** — directe verzending (huidige gedrag)
  - **Plannen** — datum + tijdpicker, slaat op met `status: 'scheduled'` en `scheduled_at`
  - **Trigger** — koppel aan een automatisering (zie punt 3)
- Gebruik bestaande `scheduled_at` kolom op `email_campaigns` tabel

**3. Trigger-gebaseerde campagnes**

Voeg een trigger-selectie toe wanneer "Trigger" gekozen wordt:
- **Welkom** — nieuwe klant registreert zich
- **Verlaten winkelmandje** — winkelmandje niet afgerekend na X uur
- **Na aankoop** — X uur na bestelling
- **Verjaardag** — op de verjaardag van de klant
- **Heractivering** — klant heeft X dagen niet besteld

Dit koppelt aan de bestaande `email_automations` tabel en `AutomationTrigger` type. De campagne wordt gekoppeld aan een automation entry.

### Schema-aanpassing
Nieuw veld op `email_campaigns`:
```sql
ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS automation_id uuid REFERENCES email_automations(id);
```

### Technische aanpak

**Nieuwe component**: `CampaignRichEditor.tsx` — wraps `ComposeRichEditor` met heading-extensie en email-template wrapping

**Bestanden:**

| Bestand | Actie |
|---|---|
| `src/components/admin/marketing/CampaignDialog.tsx` | Toggle visueel/HTML, scheduling sectie, trigger selectie |
| `src/components/admin/marketing/CampaignRichEditor.tsx` | Nieuwe wrapper rond TipTap voor campagnes (headings, images) |
| `src/types/marketing.ts` | `automation_id` toevoegen aan `EmailCampaign` |
| Database migration | `automation_id` kolom op `email_campaigns` |

