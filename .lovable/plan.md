

## Root Cause gevonden

De data **is** er. Alle shipping labels zijn correct opgeslagen met `provider: "bol_vvb"` en een `external_id` (het `transporterLabelId`). Maar de tracking is `null` in alle labels:

| Order | external_id | tracking_number (label) | tracking_number (order) |
|---|---|---|---|
| #1125 | 2be38efb-... | null | null |
| #1124 | 1ca34407-... | null | null |
| #1123 | 64c201f6-... | null | null |
| #1122 | 6638c219-... | null | CD116065228BE (via andere route) |

### Bug: Verkeerde kolomnaam in update-bol-tracking

In `supabase/functions/update-bol-tracking/index.ts` lijn 284:

```typescript
.eq("label_type", "bol_vvb")  // ❌ kolom "label_type" BESTAAT NIET
```

Moet zijn:

```typescript
.eq("provider", "bol_vvb")    // ✅ correcte kolomnaam
```

De tabel `shipping_labels` heeft geen kolom `label_type` — het veld heet `provider`. Hierdoor retourneert de query altijd nul resultaten, waardoor de HEAD fallback nooit wordt uitgevoerd. Dat verklaart exact de logs: "No shipping label found for order X" voor alle recente orders.

### Fix

**`supabase/functions/update-bol-tracking/index.ts`** — 1 regel wijzigen:
- Lijn 284: `.eq("label_type", "bol_vvb")` → `.eq("provider", "bol_vvb")`

Na deze fix zal de cron automatisch de tracking ophalen via HEAD voor alle orders die nu vastzitten.

