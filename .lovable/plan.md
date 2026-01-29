
# Plan: Trial Expiry Notificaties + Data Behoud bij Downgrade/Upgrade

## Samenvatting

Dit plan implementeert twee belangrijke features:
1. **Trial Expiry Waarschuwing** - Email + in-app notificatie 1 dag voor trial afloopt
2. **Data Behoud Garantie** - Alle instellingen/data blijven bewaard bij downgrade → upgrade

---

## Deel 1: Huidige Architectuur Analyse

### Wat er al bestaat:
- `check-expired-trials` Edge Function - downgrade naar Free na trial afloop
- `create-notification` Edge Function - in-app + email notificaties (gebruikt Resend)
- `useTrialStatus` hook - berekent `daysRemaining` en urgency levels
- `RESEND_API_KEY` is geconfigureerd

### Wat er ontbreekt:
- Geen Edge Function die trials controleert die **bijna** verlopen (1 dag resterend)
- Geen notificatie trigger voor trial expiry warning

---

## Deel 2: Trial Expiry Waarschuwing

### Nieuwe Edge Function: `send-trial-expiry-warning`

Deze functie zoekt tenants waar:
- `status = 'trialing'`
- `trial_end` is morgen (tussen 23-25 uur van nu)
- `plan_id != 'free'`
- Nog geen waarschuwing verstuurd (nieuwe kolom: `trial_warning_sent_at`)

**Actie:**
1. Verstuur in-app notificatie via `create-notification`
2. Verstuur email met CTA naar upgrade pagina
3. Markeer `trial_warning_sent_at` om duplicaten te voorkomen

### Database Wijziging

Nieuwe kolom op `tenant_subscriptions`:
```sql
ALTER TABLE tenant_subscriptions 
ADD COLUMN trial_warning_sent_at timestamptz DEFAULT NULL;
```

### Email Template Content

| Sectie | Inhoud |
|--------|--------|
| Subject | ⏰ Je proefperiode eindigt morgen |
| Bericht | Je Enterprise trial loopt morgen af. Upgrade nu om al je features te behouden. |
| CTA | "Upgrade naar Enterprise →" linkt naar `/admin/settings/billing` |
| Urgentie badge | Ja (high priority oranje) |

### Scheduling

De functie wordt dagelijks aangeroepen (handmatig of via externe scheduler):
```
GET /functions/v1/send-trial-expiry-warning
```

---

## Deel 3: Data Behoud Garantie

### Huidige Situatie - Al Correct!

Bij een plan wijziging wordt **alleen de `plan_id` geüpdatet** in `tenant_subscriptions`. Er wordt **niets verwijderd**:

- Products, Orders, Customers → blijven
- Shipping integrations → blijven
- Email templates → blijven
- Brand settings → blijven
- AI learning patterns → blijven
- Alle instellingen → blijven

### Feature Gating vs Data Deletion

De app gebruikt **feature gating** (sidebar items verbergen) in plaats van data deletion:

```typescript
// AdminSidebar.tsx - Line 54-57
const features = subscription?.pricing_plan?.features;
if (!features) return true; // Hide if no subscription
```

**Dit betekent:**
- Bij downgrade naar Free → sidebar items worden verborgen
- Bij upgrade naar Pro/Enterprise → sidebar items verschijnen weer
- **Data is nooit verwijderd - alleen toegang is beperkt**

### Bevestiging in Code

De `check-expired-trials` functie doet alleen:
```typescript
.update({
  plan_id: "free",      // Alleen plan wijzigen
  status: "active",     // Status naar active
  trial_end: null,      // Trial timestamp wissen
})
```

Geen DELETE statements, geen data removal.

---

## Deel 4: Implementatie Details

### Bestand 1: `supabase/functions/send-trial-expiry-warning/index.ts` (NIEUW)

```text
Logica:
1. Query tenant_subscriptions WHERE:
   - status = 'trialing'
   - trial_end BETWEEN now() AND now() + 25 hours
   - plan_id != 'free'
   - trial_warning_sent_at IS NULL
   
2. Voor elke trial:
   a. Haal tenant + owner_email op
   b. Invoke create-notification met:
      - category: 'billing'
      - type: 'trial_expiring'
      - priority: 'high'
      - action_url: '/admin/settings/billing'
   c. Update trial_warning_sent_at = now()
   
3. Return count van verstuurde waarschuwingen
```

### Bestand 2: Database Migratie

```sql
ALTER TABLE public.tenant_subscriptions 
ADD COLUMN IF NOT EXISTS trial_warning_sent_at timestamptz DEFAULT NULL;
```

### Bestand 3: Update `check-expired-trials` (Optioneel)

Na downgrade, verstuur een bevestigingsnotificatie:
```typescript
// Na succesvolle downgrade, notify tenant
for (const trial of expiredTrials) {
  await supabase.functions.invoke('create-notification', {
    body: {
      tenant_id: trial.tenant_id,
      category: 'billing',
      type: 'trial_expired',
      title: 'Je proefperiode is verlopen',
      message: 'Je bent nu op het gratis plan. Upgrade om alle features te herstellen.',
      priority: 'high',
      action_url: '/admin/settings/billing',
    }
  });
}
```

---

## Deel 5: Email Templates

### Trial Expiry Warning Email

| Element | Waarde |
|---------|--------|
| From | `{tenant.name} <notifications@resend.dev>` |
| Subject | ⏰ Je proefperiode eindigt morgen |
| Priority banner | Oranje "High Priority" badge |
| Body | Beschrijving van wat er gebeurt + features die verloren gaan |
| CTA button | "Upgrade nu →" |
| Footer | Link naar pricing page |

### Post-Downgrade Email

| Element | Waarde |
|---------|--------|
| Subject | Je bent nu op het gratis plan |
| Body | Bevestiging + wat nog beschikbaar is + upgrade optie |
| CTA | "Bekijk upgrade opties →" |

---

## Technische Samenvatting

| Component | Actie |
|-----------|-------|
| `tenant_subscriptions` tabel | + `trial_warning_sent_at` kolom |
| `send-trial-expiry-warning/index.ts` | Nieuw - dagelijks te runnen |
| `check-expired-trials/index.ts` | Update - post-downgrade notificatie toevoegen |
| Frontend | Geen wijzigingen nodig |

---

## Data Behoud Garantie - Samenvatting

| Scenario | Data Gedrag |
|----------|-------------|
| Trial → Free (downgrade) | Alle data blijft, alleen feature access beperkt |
| Free → Pro (upgrade) | Alle data beschikbaar, features ontgrendeld |
| Pro → Enterprise | Alles blijft + extra features |
| Enterprise → Pro | Alles blijft, sommige features verborgen |

**Conclusie:** De huidige architectuur behoudt al alle data. Er is geen extra werk nodig voor data preservation - dit is by design correct geïmplementeerd via feature gating in de sidebar en hooks.
