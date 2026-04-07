

## Fix: "Upgrade nu" knoppen redirecten naar verkeerde URL

### Probleem
De "Upgrade nu" knop in de `TrialBanner` navigeert naar `/admin/settings?tab=subscription`, maar de billing pagina staat op `/admin/billing`. Dezelfde fout zit in `TrialExpiredBlocker`.

### Wijzigingen

| Bestand | Actie |
|---|---|
| `src/components/admin/TrialBanner.tsx` | `/admin/settings?tab=subscription` → `/admin/billing` |
| `src/components/admin/TrialExpiredBlocker.tsx` | `/admin/settings?tab=subscription&plan=...` → `/admin/billing` |

### Geen database wijzigingen nodig

