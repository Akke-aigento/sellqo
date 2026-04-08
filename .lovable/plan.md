

## Fix alle kritieke bugs in de Bol Ads module

### Overzicht

6 fixes verspreid over 4 bestanden. Eén aandachtspunt: **ANTHROPIC_API_KEY is niet geconfigureerd** — ik moet eerst de secret opvragen voordat Fix 6 kan werken. Alternatief: de Lovable AI gateway werkt al (LOVABLE_API_KEY is aanwezig), dus Fix 6 kan ook overgeslagen worden tenzij je specifiek Anthropic wilt.

### Wijzigingen

| # | Bestand | Fix |
|---|---------|-----|
| 1 | `ads-bolcom-manage/index.ts` | Credentials lookup: `marketplace` → `marketplace_type`, `"bolcom"` → `"bol_com"`, filter op `is_active` + advertising credentials |
| 2 | `ads-bolcom-manage/index.ts` | Budget: `dailyBudget` als `{ amount, currency: "EUR" }` object |
| 3 | `ads-bolcom-manage/index.ts` | Negative keywords: top-level endpoint + `negativeKeywords` bulk formaat |
| 4 | `CampaignAIAnalysis.tsx` | Action mapping: correcte action names (`update_bid`, `pause_keyword`), geneste `payload`, `add_negative` toevoegen, `.replace(',', '.')` |
| 5 | `ads-inventory-watch/index.ts` | Bol API helpers + token cache per tenant + daadwerkelijke API calls bij pause/resume |
| 6 | `ads-campaign-analyze/index.ts` | Anthropic API i.p.v. Lovable AI gateway (vereist secret) |

### Detail per fix

**Fix 1-3: `supabase/functions/ads-bolcom-manage/index.ts`**
- Regels 99-112: Credentials lookup volledig vervangen — query op `marketplace_type = "bol_com"` + `is_active = true`, dan `.find()` voor advertising credentials
- Regel 237: `dailyBudget` wrappen in `{ amount: daily_budget, currency: "EUR" }`
- Regels 178-180: Negative keywords endpoint wijzigen naar top-level `/negative-keywords` met `negativeKeywords` array formaat

**Fix 4: `src/components/admin/ads/CampaignAIAnalysis.tsx`**
- Regels 91-103: Volledige `actionMap` vervangen met correcte action names en geneste payload structuur
- `add_negative` mapping toevoegen (ontbreekt nu volledig)
- `body` structuur: `{ tenant_id, action, payload }` i.p.v. `{ tenant_id, action, ...payload }`

**Fix 5: `supabase/functions/ads-inventory-watch/index.ts`**
- Bol API helpers toevoegen (getBolToken, bolPut) + ADV_HEADERS constanten
- Token cache functie `getTokenForTenant` die credentials ophaalt via `marketplace_type = "bol_com"`
- Bij pause (regel 77-80): na DB update ook `bolPut` aanroepen met `{ state: "PAUSED" }`
- Bij resume (regel 120-124): na DB update ook `bolPut` aanroepen met `{ state: "ENABLED" }`

**Fix 6: `supabase/functions/ads-campaign-analyze/index.ts`**
- Vereist `ANTHROPIC_API_KEY` secret — deze moet eerst worden toegevoegd
- API call vervangen: Lovable gateway → `api.anthropic.com/v1/messages`
- Request formaat: Anthropic `system`/`messages`/`tools`/`tool_choice` structuur
- Response parsing: `content.find(b => b.type === "tool_use")` i.p.v. `choices[0].message.tool_calls[0]`

### Secret vereiste

Voor Fix 6 moet `ANTHROPIC_API_KEY` als secret worden toegevoegd. Ik vraag dit op bij de implementatie.

### Geen database wijzigingen nodig

