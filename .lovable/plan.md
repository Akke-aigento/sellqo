

## Probleem

De `TrackingNotificationSettings` component (met de "Automatisch tracking status ophalen" toggle) bestaat wel, maar wordt nergens geïmporteerd of getoond. Het ontbreekt in de settings sidebar.

Daarnaast verwijst de component nog naar "17TRACK" terminologie en een API key veld, terwijl we nu directe carrier APIs gebruiken en geen API key meer nodig is.

## Plan

### 1. Toevoegen aan Settings pagina

In `src/pages/admin/Settings.tsx`:
- Importeer `TrackingNotificationSettings`
- Voeg een nieuwe sectie toe in de "Koppelingen & Kanalen" groep (of een nieuwe groep "Verzending"):
  ```
  { id: 'tracking', title: 'Verzending & Tracking', icon: Truck, component: TrackingNotificationSettings }
  ```

### 2. Component updaten

In `src/components/admin/settings/TrackingNotificationSettings.tsx`:
- Verwijder de hele "17TRACK Integratie" card (API key veld, poll interval)
- Hernoem `auto_poll_17track` toggle naar "Automatische tracking updates" — uitleg: "SellQo controleert automatisch de status bij PostNL, DHL, bpost, DPD en GLS"
- Verwijder verwijzingen naar 17TRACK in de UI teksten
- Houd de klantnotificatie-toggles (verzonden, onderweg, bezorgd, probleem) zoals ze zijn

