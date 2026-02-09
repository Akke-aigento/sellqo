
# Plan: Email Afzenderdomein Standaardiseren naar sellqo.app

## Samenvatting

Alle email edge functions gebruiken momenteel Resend's test domeinen (`onboarding@resend.dev`, `notifications@resend.dev`, `noreply@resend.dev`), wat zorgt voor:
1. 403 errors bij verzending naar externe ontvangers
2. Inconsistente afzender adressen
3. Geen duidelijke branding

**Oplossing**: Standaardiseren naar `sellqo.app` domein (reeds geverifieerd bij Resend) met optionele ondersteuning voor eigen tenant domeinen.

## Email Types & Afzenderlogica

| Type Email | Afzenderadres | Logica |
|------------|---------------|--------|
| **Platform emails** (team invites, trial warnings) | `noreply@sellqo.app` | Altijd Sellqo platform |
| **Systeemnotificaties** (orders, betalingen) | `noreply@sellqo.app` | Platform afzender |
| **Klantcommunicatie** (facturen, offertes, campaigns) | Tenant email OF `noreply@sellqo.app` | Tenant keuze |

## Technische Wijzigingen

### 10 Edge Functions aan te passen:

| Edge Function | Huidige `from` | Nieuwe `from` |
|---------------|----------------|---------------|
| `send-invoice-email` | `onboarding@resend.dev` | `${tenant.name} <noreply@sellqo.app>` |
| `send-quote-email` | `onboarding@resend.dev` | `${tenant.name} <noreply@sellqo.app>` |
| `send-customer-message` | `onboarding@resend.dev` | `${tenant.name} <noreply@sellqo.app>` |
| `send-test-email` | `noreply@resend.dev` | `${tenant.name} <noreply@sellqo.app>` |
| `send-gift-card-email` | `onboarding@resend.dev` | `${tenant.name} <noreply@sellqo.app>` |
| `send-team-invitation` | `onboarding@resend.dev` | `Sellqo <noreply@sellqo.app>` |
| `send-campaign-batch` | `noreply@resend.dev` | `${tenant.name} <noreply@sellqo.app>` |
| `send-trial-expiry-warning` | `notifications@resend.dev` | `Sellqo <noreply@sellqo.app>` |
| `create-notification` | `notifications@resend.dev` | `${tenant.name} <noreply@sellqo.app>` |
| `automation-scheduler` | `noreply@resend.dev` | `${tenant.name} <noreply@sellqo.app>` |

### Code Patroon

```typescript
// Platform emails (team invites, trial warnings, etc.)
from: "Sellqo <noreply@sellqo.app>"

// Tenant-specifieke emails (facturen, offertes, etc.)
from: `${tenant.name} <noreply@sellqo.app>`
```

## Toekomstige Uitbreiding: Eigen Domein

Voor tenants die hun eigen domein willen gebruiken:

1. **UI Toevoeging**: Veld in tenant instellingen voor "Eigen email domein"
2. **Validatie**: Tenant moet eigen Resend account koppelen
3. **Logica**: Als tenant eigen domein + API key heeft → gebruik die, anders → sellqo.app

Dit valt buiten de huidige scope maar is eenvoudig toe te voegen.

## Resultaat

- Alle emails komen van `@sellqo.app` (geverifieerd domein)
- Geen 403 errors meer bij externe ontvangers
- Consistente branding
- Betere deliverability
