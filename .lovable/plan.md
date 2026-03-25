

## SEO Dashboard 2.0 — Van informatief naar actionable

### Problemen geidentificeerd

**1. "AI Analyse starten" loopt vast**
De edge function `ai-seo-analyzer` doet sequentieel per product+categorie een `upsert` — bij 45+ producten zijn dat 45+ individuele DB-calls in één request. Dit timeout. Oplossing: batch de upserts en verwijder de one-by-one loop.

**2. Pagina is puur informatief — geen actie-workflows**
Alles staat achter collapsibles verstopt. Je kunt wel genereren, maar:
- Geen preview van wat AI genereert voordat het wordt opgeslagen
- Geen "fix all" workflow — je moet per product kiezen
- Quick Wins zijn leeg totdat je een analyse draait (die vastloopt)
- Geen prioritering: wat levert het meeste op?

### Nieuwe opzet: 4 tabs

```text
┌─────────────────────────────────────────────────────┐
│  SEO Dashboard                    [AI Analyse ▼]    │
│  Score: 62/100  ↑4                                  │
├──────────┬───────────┬──────────┬───────────────────┤
│ Overzicht│ Optimaliseer│ Technisch│ Keywords        │
└──────────┴───────────┴──────────┴───────────────────┘
```

#### Tab 1: Overzicht (hero + quick wins + score history)
- Score-cirkel + sub-scores (zoals nu, maar compact)
- **Actionable quick wins** met directe "Fix nu" knoppen
- Score-geschiedenis grafiek
- Status-overzicht: X producten zonder meta title, Y zonder beschrijving etc.

#### Tab 2: Optimaliseer (de KERN — hier ontbreekt alles)
Dit is waar de magie moet gebeuren. Een wizard-achtige workflow:

**Stap-voor-stap SEO wizard:**
1. **Filter**: kies wat je wilt optimaliseren (producten/categorieën, met/zonder meta, score range)
2. **Selecteer**: checkbox-tabel met alle gefilterde items
3. **Kies actie**: meta titles / meta descriptions / beschrijvingen / alt-teksten / alles
4. **Preview & Approve**: AI genereert content → toont per item oud vs nieuw → tenant kan per item accepteren, bewerken of afwijzen
5. **Toepassen**: bulk-save van goedgekeurde items

Dit "preview before save" patroon ontbreekt volledig — nu wordt content direct overschreven zonder review.

**Extra filters in de tabel:**
- "Alleen producten zonder meta title" (1 klik)
- "Score < 50" (slechtste eerst)
- "Geen afbeeldingen"
- Sorteer op score (laag→hoog)

#### Tab 3: Technisch
- Structured data, robots.txt, sitemap, slug manager, Core Web Vitals
- Alles wat nu onder "Technische SEO" collapsible zit

#### Tab 4: Keywords
- Keyword research panel
- Concurrent analyse
- Zoekprestaties / AI Search optimalisatie

### Wijzigingen

**1. Edge function fix — `supabase/functions/ai-seo-analyzer/index.ts`**
- Batch alle product scores in één `upsert` call i.p.v. 45 individuele calls
- Idem voor category scores
- Timeout gaat van ~45 calls → 3 calls (tenant + products batch + categories batch)

**2. Nieuwe preview/approve workflow — `ai-generate-seo-content` edge function**
- Nieuwe modus: `preview: true` → genereert content maar slaat NIET op, retourneert alleen de suggesties
- Bestaande modus (zonder `preview`): slaat direct op (backwards compatible)
- Frontend stuurt eerst `preview: true`, toont resultaten, dan bij goedkeuring een tweede call met `apply: true` + de geaccepteerde items

**3. SEO Dashboard herschrijven — `src/pages/admin/SEODashboard.tsx`**
- Van collapsible-spaghetti naar clean tab-layout
- Tab "Overzicht": score card + quick wins + history chart
- Tab "Optimaliseer": nieuwe `SEOOptimizeTab` component met filter/select/generate/preview/apply workflow
- Tab "Technisch": bestaande componenten hergroepeerd
- Tab "Keywords": bestaande componenten hergroepeerd

**4. Nieuw component — `src/components/admin/seo/SEOOptimizeTab.tsx`**
Het hart van de pagina:
- Filterbalk bovenaan (entity type, status filters, score range)
- Selecteerbare tabel met producten EN categorieën
- Floating action bar onderaan bij selectie (zelfde patroon als producten/orders)
- "Genereer & Preview" knop → opent dialog met oud/nieuw vergelijking
- Per item: accepteren / bewerken / afwijzen
- "Alles toepassen" knop

**5. Nieuw component — `src/components/admin/seo/SEOPreviewDialog.tsx`**
- Modal die AI-gegenereerde content toont naast de huidige content
- Per item een toggle: accepteren/afwijzen
- Inline edit mogelijkheid
- Character count + SEO score preview (gebruikt `calculateQuickSEOScore`)
- "X van Y geaccepteerd — Toepassen" knop

**6. Quick wins verbeteren — `src/components/admin/seo/SEOQuickWins.tsx`**
- Zonder analyse: client-side quick scan op basis van de al geladen producten (meta_title leeg? → toon als quick win)
- Elke quick win heeft een directe actie-knop: "Fix nu" → selecteert relevante producten en opent de optimize tab
- Geen lege state meer nodig

### Bestanden

| Bestand | Actie |
|---|---|
| `supabase/functions/ai-seo-analyzer/index.ts` | Batch upserts (1 call per entity type) |
| `supabase/functions/ai-generate-seo-content/index.ts` | Preview modus toevoegen |
| `src/pages/admin/SEODashboard.tsx` | Herschrijven naar tab-layout |
| `src/components/admin/seo/SEOOptimizeTab.tsx` | Nieuw — filter/select/generate/preview workflow |
| `src/components/admin/seo/SEOPreviewDialog.tsx` | Nieuw — oud vs nieuw vergelijking + approve |
| `src/components/admin/seo/SEOQuickWins.tsx` | Client-side quick wins zonder analyse |

