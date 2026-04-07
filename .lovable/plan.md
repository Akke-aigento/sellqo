

## Probleem: Promotie-items verdwijnen in Tenant View ondanks "zichtbaar" markering

### Oorzaak
Er zijn **twee onafhankelijke systemen** die menu-items verbergen:

1. **Oog-toggles** (page overrides) — handmatig per tenant in/uitschakelen
2. **Abonnement-features** — items met `featureKey` worden verborgen als het abonnement die feature niet bevat

Mancini Milano zit op het **Free** plan. Dat plan heeft `promo_bundles`, `promo_bogo`, `promo_volume`, `loyalty_program`, en `promo_giftcards` allemaal op `false`. Daarom verdwijnen die 5 promotie-items in Tenant View, ongeacht de oog-toggle status.

De oog-icons in Admin View tonen alleen de page-override status — ze weten niet dat het abonnement het item ook blokkeert. Daardoor lijkt het alsof alles zichtbaar is, terwijl het dat niet is.

### Oplossing

**1. Page override overschrijft abonnement-beperking**

Wanneer een platform admin een item expliciet zichtbaar laat (niet in `hidden_pages`), én dat item heeft een `featureKey`, dan moet de admin de mogelijkheid hebben om dat item tóch zichtbaar te maken voor die tenant — ongeacht het abonnement.

Concreet: voeg een `granted_features` array toe aan `tenant_feature_overrides` (naast `hidden_pages`). Als een platform admin in Admin View een premium item expliciet "toekent" aan een tenant, wordt de `featureKey` toegevoegd aan `granted_features`. Die lijst overschrijft de abonnement-check.

**2. Visuele feedback in Admin View**

In Admin View krijgen items die door het abonnement geblokkeerd zijn een **ander icoon** dan het oog:
- 🔒 Geblokkeerd door abonnement (klikbaar om te "granten")
- 👁 Zichtbaar (huidige toggle)
- 👁‍🗨 Verborgen via page override

Zo ziet de admin in één oogopslag wát er geblokkeerd wordt en waaróm.

**3. Aangepaste `isItemFeatureHidden` logica**

```text
isItemFeatureHidden(item):
  if no featureKey → not hidden
  if platform admin + admin view → not hidden
  if featureKey in granted_features → not hidden   ← NIEUW
  if subscription has feature → not hidden
  else → hidden
```

### Database wijziging

Voeg `granted_features` kolom toe aan `tenant_feature_overrides`:

```sql
ALTER TABLE tenant_feature_overrides 
ADD COLUMN granted_features text[] DEFAULT '{}';
```

### Bestanden

| Bestand | Actie |
|---|---|
| Database migration | `granted_features` kolom toevoegen |
| `src/hooks/useTenantPageOverrides.ts` | `granted_features` ophalen + toggle functie toevoegen |
| `src/components/admin/AdminSidebar.tsx` | `isItemFeatureHidden` aanpassen: check `granted_features`; visuele indicatie voor abonnement-geblokkeerde items in Admin View |
| `src/components/admin/sidebar/sidebarConfig.ts` | Geen wijzigingen |

