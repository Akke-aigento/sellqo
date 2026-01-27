
# Plan: Enterprise AI Credits Beperking (5.000/maand)

## Analyse

### Huidige Situatie

| Plan | AI Credits/maand |
|------|------------------|
| Free | 0 |
| Starter | 50 |
| Pro | 500 |
| Enterprise | -1 (onbeperkt) ⚠️ |

### Probleem
De huidige implementatie met `-1` is technisch onveilig. De `use_ai_credits` functie behandelt `-1` niet expliciet - het werkt "toevallig" als onbeperkt omdat de berekening een negatief getal oplevert.

### Aanbevolen Limiet: 5.000 credits/maand

**Redenering:**
- Logische schaalstap: Free (0) → Starter (50) → Pro (500) → Enterprise (5.000)
- 10x verhoging t.o.v. Pro, consistent met de pricing ratio
- Ruim voldoende voor zelfs zeer actieve Enterprise klanten
- Beschermt tegen misbruik (bijv. bulk scraping via AI)
- Enterprise klanten kunnen altijd extra credits bijkopen (€19/500)

**Vergelijking met gebruikspatronen:**

| AI Actie | Kosten | 5.000 credits = |
|----------|--------|-----------------|
| Social post | 2 | 2.500 posts/maand |
| Email content | 3 | 1.666 emails/maand |
| Product beschrijving | 3 | 1.666 beschrijvingen |
| Afbeelding generatie | 5 | 1.000 afbeeldingen |
| Insights | 1 | 5.000 insights |

---

## Implementatie

### Fase 1: Database Migratie

Update de `pricing_plans` tabel om Enterprise credits te wijzigen van `-1` naar `5000`:

```sql
UPDATE pricing_plans 
SET ai_credits_monthly = 5000
WHERE slug = 'enterprise';
```

### Fase 2: Frontend Updates

**Bestanden aan te passen:**

| Bestand | Wijziging |
|---------|-----------|
| `src/components/landing/PricingSection.tsx` | "Onbeperkte AI credits" → "✨ 5.000 AI credits/maand" |
| `src/components/landing/FaqSection.tsx` | FAQ tekst aanpassen: "Enterprise onbeperkt" → "Enterprise 5.000 credits/maand" |

### Fase 3: (Optioneel) Credit Check Robuustheid

De huidige `use_ai_credits` functie werkt correct met positieve getallen. Geen wijziging nodig zodra Enterprise 5000 is in plaats van -1.

---

## Wijzigingen per Bestand

### 1. Database Migratie (nieuw)
**Pad:** `supabase/migrations/[timestamp]_enterprise_ai_credits_limit.sql`

```sql
-- Set Enterprise AI credits to 5000 instead of unlimited (-1)
UPDATE pricing_plans 
SET ai_credits_monthly = 5000
WHERE slug = 'enterprise';
```

### 2. PricingSection.tsx
**Wijziging:** Regel 85

```diff
- '✨ Onbeperkte AI credits',
+ '✨ 5.000 AI credits/maand',
```

### 3. FaqSection.tsx
**Wijziging:** Regel 25

```diff
- answer: 'AI credits worden gebruikt voor het genereren van content zoals social posts, emails en productbeschrijvingen. Pro krijgt 500 credits/maand, Enterprise onbeperkt. Extra credits kun je bijkopen voor €19 per 500 credits.',
+ answer: 'AI credits worden gebruikt voor het genereren van content zoals social posts, emails en productbeschrijvingen. Pro krijgt 500 credits/maand, Enterprise 5.000 credits/maand. Extra credits kun je bijkopen voor €19 per 500 credits.',
```

---

## Samenvatting

| Actie | Details |
|-------|---------|
| **Database** | Enterprise `ai_credits_monthly`: -1 → 5000 |
| **Pricing pagina** | "Onbeperkte" → "5.000/maand" |
| **FAQ** | "Enterprise onbeperkt" → "Enterprise 5.000 credits/maand" |
| **Impact** | Bestaande Enterprise klanten krijgen nu een echte limiet |

### Alternatief: 10.000 credits/maand

Als je wilt kun je ook kiezen voor 10.000 credits/maand als je Enterprise klanten meer ruimte wilt geven. Dit is nog steeds veilig en geeft hen 2x zoveel als de 10x schaalstap.

Welke limiet heb je liever: 5.000 of 10.000?
