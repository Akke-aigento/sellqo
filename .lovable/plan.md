
# Landing Page & Onboarding Updates - Complete Herziening

## Overzicht van Geïdentificeerde Problemen

### 1. Hero Dashboard Mockup - Outdated
De `HeroDashboardMockup.tsx` toont nog een verouderd dashboard design:
- Oude statistieken layout (Omzet, Bestellingen, Nieuwe Klanten, Conversie)
- Mist de nieuwe **Trial Banner** die nu prominent is
- Mist de nieuwe **Health Score** systeem
- Mist de **Plan Selection** die nu onderdeel is van onboarding

### 2. FAQ's - Ontbrekende Informatie over Nieuwe Features
Huidige FAQ's (11 stuks) missen kritieke onderwerpen:
- **Geen vermelding van automatische 14-dagen trial bij registratie**
- **Geen uitleg over het onboarding proces (7 stappen)**
- **Geen informatie over trial expiry en wat dan gebeurt**
- **Geen vermelding van Shop Health Score**
- Geen uitleg over plan selectie tijdens onboarding

### 3. Footer Links - Leiden naar Niets
**Product kolom:**
| Link | Status | Route |
|------|--------|-------|
| Features | ✅ Werkt | `#features` scroll |
| Prijzen | ✅ Werkt | `#pricing` scroll |
| Integraties | ❌ `#` - gaat nergens | Mist pagina |
| API Docs | ❌ `#` - gaat nergens | Mist pagina |
| Changelog | ❌ `#` - gaat nergens | Mist pagina |

**Bedrijf kolom:**
| Link | Status | Route |
|------|--------|-------|
| Over Ons | ❌ `#` | Mist pagina |
| Blog | ❌ `#` | Mist pagina |
| Contact | ❌ `#` | Mist pagina |
| Careers | ❌ `#` | Mist pagina |
| Partners | ❌ `#` | Mist pagina |

**Support kolom:**
| Link | Status | Route |
|------|--------|-------|
| Help Center | ❌ `#` | Mist pagina |
| FAQ | ✅ Werkt | `#faq` scroll |
| Status Page | ❌ `#` | Mist pagina |
| Neem Contact Op | ❌ `#` | Mist pagina |

**Legal links:**
| Link | Status | Route |
|------|--------|-------|
| Privacy Policy | ⚠️ `/privacy` route bestaat maar pagina niet gepubliceerd | `is_published: false` |
| Algemene Voorwaarden | ⚠️ `/terms` route bestaat maar niet gepubliceerd | `is_published: false` |
| Cookie Policy | ⚠️ `/cookies` route bestaat maar niet gepubliceerd | `is_published: false` |

### 4. Pricing Action Button - Enterprise Link Werkt Niet
`PricingSection.tsx` lijn 286: Enterprise linkt naar `/contact` die **niet bestaat**.

---

## Implementatieplan

### Fase 1: Hero Dashboard Mockup Updaten
**Bestand:** `src/components/landing/HeroDashboardMockup.tsx`

Aanpassingen:
1. **Trial Banner Toevoegen** - Toon "Je hebt nog 14 dagen trial" balk bovenaan mockup
2. **Health Score Badge** - Voeg een Health Score indicator toe (bijv. "Shop Health: 92% 🟢")
3. **Modernere Stats** - Update labels naar:
   - "Shop Health Score" (i.p.v. "Conversie")
   - Behoud overige stats maar voeg trend indicators toe
4. **Mini sidebar icons updaten** - Voeg Health/Gamification icon toe

### Fase 2: FAQ's Uitbreiden
**Bestand:** `src/components/landing/FaqSection.tsx`

**Nieuwe FAQ's toevoegen (5 stuks):**

| Vraag | Antwoord |
|-------|----------|
| Wat gebeurt er na de 14 dagen trial? | Na 14 dagen word je gevraagd een plan te kiezen. Tot die tijd blijft je account actief maar worden nieuwe functies geblokkeerd. Je data blijft veilig behouden. |
| Hoe werkt het onboarding proces? | Bij registratie doorloop je een 7-stappen wizard: winkelnaam, plan selectie, bedrijfsgegevens, logo upload, eerste product, betalingen en lancering. Je kunt stappen overslaan en later voltooien. |
| Wat is de Shop Health Score? | Een realtime score (0-100%) die de gezondheid van je shop meet: voorraad, bestellingen, reviews, SEO en meer. Je krijgt dagelijks tips om je score te verbeteren. |
| Kan ik later van plan wisselen? | Ja! Je kunt op elk moment upgraden of downgraden via Instellingen → Abonnement. Upgrades zijn direct actief, downgrades gaan in bij de volgende facturatieperiode. |
| Welke talen ondersteunt SellQo? | Nederlands, Engels, Frans en Duits. Zowel de admin interface als je webshop zijn volledig vertaalbaar. AI vertalingen zijn beschikbaar voor productbeschrijvingen. |

**Bestaande FAQ's bijwerken:**
- "Hoe werkt de gratis trial?" → Toevoegen: "Je kiest je plan tijdens onboarding, maar betaalt pas na 14 dagen."

### Fase 3: Publieke Pagina's Aanmaken
Creëer de volgende pagina's onder `/src/pages/public/`:

| Pagina | Route | Inhoud |
|--------|-------|--------|
| `About.tsx` | `/about` | Over SellQo pagina met team/missie info |
| `Contact.tsx` | `/contact` | Contact formulier + contactgegevens |
| `Blog.tsx` | `/blog` | Placeholder blog overzicht |
| `Partners.tsx` | `/partners` | Partner programma informatie |
| `Careers.tsx` | `/careers` | Vacatures placeholder |
| `HelpCenter.tsx` | `/help` | Help center met FAQ links |
| `Status.tsx` | `/status` | Simpele status pagina |
| `Integrations.tsx` | `/integrations` | Overzicht van alle integraties |
| `ApiDocs.tsx` | `/api-docs` | API documentatie placeholder |
| `PublicChangelog.tsx` | `/changelog` | Publieke changelog view |

### Fase 4: Routes Toevoegen aan App.tsx
**Bestand:** `src/App.tsx`

Toevoegen van nieuwe routes:
```
/about → AboutPage
/contact → ContactPage
/blog → BlogPage
/partners → PartnersPage
/careers → CareersPage
/help → HelpCenterPage
/status → StatusPage
/integrations → IntegrationsPage
/api-docs → ApiDocsPage
/changelog → PublicChangelogPage
```

### Fase 5: Footer Links Updaten
**Bestand:** `src/components/landing/LandingFooter.tsx`

1. Update alle `href="#"` naar correcte routes
2. Wijzig `<button>` naar `<Link>` voor pagina navigatie
3. Legal links aanpassen naar correcte `/terms`, `/privacy`, `/cookies` routes

### Fase 6: Pricing Enterprise Fix
**Bestand:** `src/components/landing/PricingSection.tsx`

Lijn 286: Wijzig `/contact` naar de nieuwe werkende `/contact` route.

---

## Technische Details

### Nieuwe Bestanden Aanmaken:

| Bestand | Type |
|---------|------|
| `src/pages/public/About.tsx` | Landingspagina |
| `src/pages/public/Contact.tsx` | Formulier pagina |
| `src/pages/public/Blog.tsx` | Placeholder |
| `src/pages/public/Partners.tsx` | Info pagina |
| `src/pages/public/Careers.tsx` | Placeholder |
| `src/pages/public/HelpCenter.tsx` | Verzamelpagina |
| `src/pages/public/Status.tsx` | Status overview |
| `src/pages/public/Integrations.tsx` | Features showcase |
| `src/pages/public/ApiDocs.tsx` | Placeholder |
| `src/pages/public/PublicChangelog.tsx` | Changelog view |
| `src/components/landing/PublicPageLayout.tsx` | Shared layout voor publieke pagina's |

### Bestaande Bestanden Wijzigen:

| Bestand | Wijziging |
|---------|-----------|
| `src/components/landing/HeroDashboardMockup.tsx` | Trial banner + Health Score toevoegen |
| `src/components/landing/FaqSection.tsx` | 5 nieuwe FAQ's + 1 update |
| `src/components/landing/LandingFooter.tsx` | Alle links werkend maken |
| `src/components/landing/PricingSection.tsx` | Enterprise button fix |
| `src/App.tsx` | 10 nieuwe routes toevoegen |

---

## Pagina Content Overzicht

### About Page
- Hero sectie met missie statement
- "Ons Team" sectie met foto placeholders
- "Waarom SellQo" value propositions
- CTA naar registratie

### Contact Page
- Contact formulier (naam, email, onderwerp, bericht)
- Bedrijfsgegevens sidebar
- Map embed placeholder
- Direct contact opties (WhatsApp, Email)

### Integrations Page
- Grid met alle ondersteunde platforms (Bol.com, Amazon, Shopify, etc.)
- Per integratie: logo, beschrijving, "Binnenkort" badge indien relevant
- Link naar SellQo Connect in admin

### Help Center Page
- Zoekbalk
- Categorieën: "Aan de slag", "Producten", "Bestellingen", "Betalingen", etc.
- Links naar FAQ sectie
- Contact support button

### Status Page
- Simpele "All Systems Operational" indicator
- Lijst van services met groene checkmarks
- Laatst bijgewerkt timestamp

---

## Verwacht Resultaat

Na implementatie:
1. **Hero mockup** toont het moderne dashboard met trial banner en health score
2. **FAQ sectie** bevat 16 vragen (11 bestaand + 5 nieuw) die alle veelgestelde vragen beantwoorden
3. **Alle footer links** leiden naar werkende pagina's
4. **Enterprise button** opent werkende contact pagina
5. **Legal pagina's** zijn toegankelijk (routes werken, maar content moet nog gepubliceerd worden via Platform Admin)
