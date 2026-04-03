

## Floating Opslaan/Annuleren balk — overal bij bewerkingen

### Wat wordt er gebouwd

Een herbruikbare `FloatingSaveBar` component die onderaan het scherm verschijnt zodra er onopgeslagen wijzigingen zijn. Dezelfde stijl als de bulk-actiebalken: `fixed bottom-0`, sidebar-offset, slide-in animatie.

### Component

**`src/components/admin/FloatingSaveBar.tsx`** — Nieuw

```text
┌─────────────────────────────────────────┐
│  ● Onopgeslagen wijzigingen  [Annuleren] [Opslaan] │
└─────────────────────────────────────────┘
  fixed bottom-0, lg:left-[sidebar], z-40
```

Props: `isDirty`, `isSaving`, `onSave`, `onCancel`, optioneel `saveLabel`

### Pagina's die aangepast worden

| Pagina / Component | Dirty-detectie |
|---|---|
| `ProductForm.tsx` | `form.formState.isDirty` |
| `QuoteForm.tsx` | Altijd dirty na eerste wijziging (state-based) |
| `POSTerminalSettings.tsx` | Vergelijk state met initieel |
| `StorefrontSettings.tsx` | `hasChanges` state toevoegen |
| `TaxSettings.tsx` | Vergelijk state met initieel |
| `PeppolSettings.tsx` | Vergelijk met `currentTenant.peppol_id` |
| `ReminderSettings.tsx` | `formData !== settings` |
| `AIAssistantSettings.tsx` | `formState !== config` |
| `TransactionFeeSettings.tsx` | State vergelijking |
| `DomainSettings.tsx` | Heeft eigen flow, skip |
| `NotificationSettings.tsx` | Instant-save toggles, skip |

Per pagina: bestaande inline opslaan-knop verwijderen, `FloatingSaveBar` toevoegen met `isDirty` logica. Content krijgt `pb-20` wanneer dirty.

### Bestanden

| Bestand | Actie |
|---|---|
| `src/components/admin/FloatingSaveBar.tsx` | Nieuw — herbruikbare floating bar |
| `src/pages/admin/ProductForm.tsx` | FloatingSaveBar toevoegen, inline knoppen behouden als header maar floating bar als primaire actie |
| `src/pages/admin/QuoteForm.tsx` | FloatingSaveBar toevoegen |
| `src/pages/admin/POSTerminalSettings.tsx` | FloatingSaveBar toevoegen |
| `src/components/admin/storefront/StorefrontSettings.tsx` | FloatingSaveBar toevoegen |
| `src/components/admin/settings/TaxSettings.tsx` | FloatingSaveBar toevoegen |
| `src/components/admin/settings/PeppolSettings.tsx` | FloatingSaveBar toevoegen |
| `src/components/admin/settings/ReminderSettings.tsx` | FloatingSaveBar toevoegen |
| `src/components/admin/settings/AIAssistantSettings.tsx` | FloatingSaveBar toevoegen |
| `src/components/admin/settings/TransactionFeeSettings.tsx` | FloatingSaveBar toevoegen |

### Geen database wijzigingen nodig

