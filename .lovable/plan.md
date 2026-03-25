

## SEO Module: Fix + Radicale UX Upgrade

### Twee problemen

**1. Analyse crasht (500 error)**
De database heeft een expression-based unique index (`COALESCE(entity_id::text, '__tenant__')`) maar de edge function gebruikt `onConflict: 'tenant_id,entity_type,entity_id'` — PostgreSQL accepteert dat niet op expression indexes. Oplossing: vervang de expression index door een echte UNIQUE CONSTRAINT op de drie kolommen.

**2. De pagina voelt statisch en passief**
De gebruiker wil: selecteer items → klik genereer → AI doet het werk → tenant corrigeert eventueel. Zo min mogelijk stappen. Nu moet je eerst filteren, dan selecteren, dan type kiezen, dan genereren, dan reviewen — te veel drempels.

---

### Aanpak

#### A. Database fix (migratie)
- Backfill `entity_id` waar het NULL is (zet op `tenant_id`)
- Maak `entity_id` NOT NULL
- Drop de expression index
- Voeg een echte `UNIQUE CONSTRAINT` toe op `(tenant_id, entity_type, entity_id)`
- Hierna werkt `onConflict` correct en crasht de analyse niet meer

#### B. UX transformatie — "1-klik SEO wizard"

**Nieuw concept: de hele pagina draait om actie, niet om informatie**

**Hero section redesign:**
- Grote animerende score-ring met gradient (niet plat)
- Dynamische achtergrond die meebeweegt met score (groen gradient bij hoge score, rood bij laag)
- Prominente CTA-knoppen direct in de hero:
  - **"Alles optimaliseren"** — selecteert automatisch alle items zonder meta title/description en start generatie
  - **"AI Analyse starten"** — analyseert de hele winkel
- Animated counters voor key stats (X producten, Y zonder meta, Z score)

**Quick Wins → Actiekaarten:**
- Van saaie lijst naar visuele kaarten met kleur-gecodeerde zijbalk (rood/oranje/groen)
- Elke kaart heeft een directe **"Fix nu"** knop die:
  1. Automatisch de juiste items selecteert
  2. Het juiste type kiest (meta_title/meta_description)
  3. Direct de generatie start (preview → approve → save)
- Impact-indicator per kaart (geschatte score-verbetering)

**Optimize tab → Slimme 1-klik workflow:**
- **"Alles optimaliseren" knop** bovenaan — selecteert automatisch alle items die iets missen, genereert alles in één keer (meta titles + descriptions), toont preview
- Quick-filter chips i.p.v. dropdowns: `Zonder meta title (12)` `Zonder beschrijving (3)` — klik = filter + selecteer alles
- Tabel met kleur-gradient score bars (visueel ipv badges)
- Rijen die aandacht nodig hebben krijgen subtiele rode/oranje achtergrond tint
- Floating action bar met shimmer-effect op de genereer knop
- Na toepassen: confetti/success animatie + score update

**Overview tab visueel:**
- Animated progress rings voor "X van Y producten klaar" (niet tekst maar visuele donuts)
- Score history chart behoudt, maar met gradient fill under the line
- Health checklist items met progress bars i.p.v. alleen iconen

#### C. Edge function — geen wijziging nodig
De `onConflict` syntax in de code is correct. Het probleem zit puur in de database constraint. Na de migratie werkt alles.

---

### Bestanden

| Bestand | Actie |
|---|---|
| Nieuwe SQL migratie | Backfill NULL entity_ids, NOT NULL constraint, drop expression index, add real UNIQUE constraint |
| `src/pages/admin/SEODashboard.tsx` | Hero redesign met gradient + animated score + "Alles optimaliseren" CTA |
| `src/components/admin/seo/SEOOptimizeTab.tsx` | 1-klik workflow, quick-filter chips, kleur score bars, auto-select, "Alles optimaliseren" knop |
| `src/components/admin/seo/SEOQuickWins.tsx` | Van lijst naar actiekaarten met "Fix nu" knoppen + impact indicators |

