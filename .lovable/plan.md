

## Instellingen-secties automatisch verbergen op basis van feature-visibility

### Probleem
De Instellingen-pagina toont altijd alle secties (Peppol, WhatsApp, Fulfillment API, etc.), ook als de bijbehorende feature verborgen is in de sidebar. Dit veroorzaakt verwarring bij tenants.

### Oplossing

**1. `featureKey` toevoegen aan settings-secties**

Koppel elke instellingen-sectie aan dezelfde `featureKey` als het sidebar-item:

| Settings sectie | featureKey |
|---|---|
| Peppol & E-facturatie | `peppol` |
| WhatsApp Koppeling | `whatsapp` |
| AI Assistent | `ai_marketing` |
| Nieuwsbrief | `newsletter` |
| Social Media | `social_commerce` |
| Fulfillment API | `fulfillment_api` |

**2. Visibility-check in Settings.tsx**

Gebruik dezelfde logica als de sidebar: check abonnement-features + `granted_features` + admin view mode. Secties zonder `featureKey` blijven altijd zichtbaar. Platform admins in Admin View zien alles.

**3. Implementatie**

- Voeg `featureKey?: string` toe aan de `SettingsSection` interface
- Importeer `useTenantPageOverrides`, `useSubscription`, `useAuth` (admin view check)
- Filter `visibleSections` op dezelfde manier als `isItemFeatureHidden` in de sidebar
- Als een hele groep leeg wordt na filtering, verberg de groep

### Bestanden

| Bestand | Actie |
|---|---|
| `src/pages/admin/Settings.tsx` | `featureKey` per sectie + visibility filtering |

### Geen database wijzigingen nodig

