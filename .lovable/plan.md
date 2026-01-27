
# Footer Pagina's Uitbreiden - Complete Herziening

## Huidige Situatie Analyse

De 10 publieke pagina's hebben een goede basisstructuur maar missen diepgang en interactieve elementen:

| Pagina | Status | Verbeterpunten |
|--------|--------|----------------|
| About | Goed | Team sectie is placeholder, meer bedrijfsinfo nodig |
| Contact | Goed | Enterprise demo button werkt niet, meer contactopties |
| Blog | Basis | Placeholder posts, newsletter werkt niet |
| Partners | Goed | Aanmeldformulier ontbreekt |
| Careers | Goed | Geen vacature listing systeem |
| HelpCenter | Goed | Zoekfunctie werkt niet, links naar artikelen missen |
| Status | Goed | Statische data, zou dynamischer kunnen |
| Integrations | Goed | Kan uitgebreider met logo's en diepere info |
| ApiDocs | Basis | Echte code voorbeelden en interactieve docs ontbreken |
| Changelog | Goed | Solide, kan nieuwsbrief CTA krijgen |

---

## Implementatieplan

### 1. About.tsx - Uitbreiden

**Toevoegingen:**
- **Tijdlijn sectie** met bedrijfsgeschiedenis/milestones
- **Statistieken rij** (bijv. "1.000+ shops", "€10M+ omzet verwerkt")
- **Press/Featured in sectie** met logo's
- Team sectie met placeholder avatars en rollen

```text
[Hero - Missie]
[Statistieken: 1.000+ Shops | €10M+ Verwerkt | 99.9% Uptime | 4.8/5 Rating]
[Tijdlijn: 2024 Opgericht → 2025 Launch → etc.]
[Waarden Grid - al aanwezig]
[Team Grid met placeholders]
[Press/Featured In sectie]
[CTA]
```

---

### 2. Contact.tsx - Verbeteren

**Toevoegingen:**
- **Onderwerp dropdown** (Sales, Support, Partnership, Technisch, Anders)
- **Demo booking link** naar Calendly/Hubspot placeholder
- **Live chat placeholder** met Intercom-achtige widget UI
- **Adres met kaart placeholder** (België locatie)
- **Response time verwachting** per type

---

### 3. Blog.tsx - Verrijken

**Toevoegingen:**
- **Categorie filter tabs** (Trends, Tutorials, Product Updates, Case Studies)
- **Featured article** met grotere card bovenaan
- **Meer placeholder posts** (6-8 stuks)
- **Auteur info** bij posts
- **Leestijd indicatie**
- **Newsletter form** met werkende toast feedback

---

### 4. Partners.tsx - Partner Aanmelding

**Toevoegingen:**
- **Partner aanmeldformulier** (bedrijfsnaam, type, website, bericht)
- **Huidige partners grid** met placeholder logo's
- **Success stories/testimonials** van partners
- **Commissie calculator** (simpele schatting: X klanten = €Y/maand)

---

### 5. Careers.tsx - Vacature Systeem

**Toevoegingen:**
- **Vacature cards** met open posities (placeholder data)
- **Afdelingen filter** (Engineering, Design, Marketing, Support)
- **"Dag in het leven"** sectie met workflow beschrijving
- **Sollicitatieproces stappen** visuele timeline
- **Benefits uitgebreider** met iconen en details

---

### 6. HelpCenter.tsx - Interactief

**Toevoegingen:**
- **Zoekfunctie met resultaten** (filtered lijst van popular articles)
- **Video tutorials placeholder** sectie
- **Quick links** naar meest gezochte onderwerpen
- **Klikbare categorie cards** die filteren
- **Contact widget** onderin met urgentie selector

---

### 7. Status.tsx - Rijker

**Toevoegingen:**
- **Incident geschiedenis** met laatste 7 dagen
- **Uptime grafiek** (visuele bar per dag)
- **Scheduled maintenance** sectie
- **Subscribe voor updates** form
- **Service response times** detail per service

---

### 8. Integrations.tsx - Dieper

**Toevoegingen:**
- **Filter/zoek** op integratie naam of categorie
- **Integratie detail modals** met meer info
- **Setup moeilijkheid indicator** (Easy/Medium/Advanced)
- **Populaire integraties** highlight sectie bovenaan
- **Request integration form**

---

### 9. ApiDocs.tsx - Developer Friendly

**Toevoegingen:**
- **Interactieve code tabs** (cURL, JavaScript, Python)
- **Copy code button** functionaliteit
- **Rate limits** tabel
- **Versioning info** (API v1, v2 planning)
- **Sandbox/test mode** uitleg
- **Webhook events** lijst met payload voorbeelden

---

### 10. PublicChangelog.tsx - Newsletter

**Toevoegingen:**
- **Email subscribe form** onderaan
- **Filter op type** (Features, Bugfixes, Security)
- **Expand/collapse** voor lange beschrijvingen
- **Link naar specifieke versie** (anchor links)

---

## Technische Aanpak

### Bestanden te wijzigen:
| Bestand | Wijzigingen |
|---------|-------------|
| `src/pages/public/About.tsx` | Tijdlijn, stats, team grid, press logos |
| `src/pages/public/Contact.tsx` | Onderwerp select, demo booking, live chat UI |
| `src/pages/public/Blog.tsx` | Categorie tabs, featured post, meer content |
| `src/pages/public/Partners.tsx` | Aanmeldformulier, partner logos, calculator |
| `src/pages/public/Careers.tsx` | Vacatures grid, process timeline, benefits |
| `src/pages/public/HelpCenter.tsx` | Zoekfilter, video sectie, quick links |
| `src/pages/public/Status.tsx` | Incident history, uptime visual, subscribe |
| `src/pages/public/Integrations.tsx` | Search/filter, popularity badges, modal |
| `src/pages/public/ApiDocs.tsx` | Code tabs, copy buttons, rate limits |
| `src/pages/public/PublicChangelog.tsx` | Newsletter form, type filter |

### Nieuwe componenten (optioneel, kunnen inline):
- `TimelineItem` - Herbruikbaar voor About en Careers
- `CodeBlock` - Met copy functionaliteit voor ApiDocs
- `PartnerLogoGrid` - Placeholder logo raster

---

## Content Details Per Pagina

### About - Nieuwe Statistieken
| Stat | Waarde | Icon |
|------|--------|------|
| Actieve Shops | 1.000+ | Store |
| Bestellingen Verwerkt | 500.000+ | ShoppingBag |
| Omzet Gefaciliteerd | €10M+ | Euro |
| Uptime | 99.9% | CheckCircle |

### About - Tijdlijn
| Datum | Milestone |
|-------|-----------|
| Q1 2024 | SellQo opgericht in België |
| Q3 2024 | Eerste beta testers onboarded |
| Q4 2024 | Bol.com integratie live |
| Q1 2025 | Publieke launch + AI features |
| 2025+ | Internationale expansie gepland |

### Careers - Placeholder Vacatures
| Functie | Afdeling | Locatie |
|---------|----------|---------|
| Senior Full-Stack Developer | Engineering | Remote (BE) |
| Product Designer | Design | Hybrid |
| Customer Success Manager | Support | Remote |

### Blog - Extra Posts
| Titel | Categorie | Leestijd |
|-------|-----------|----------|
| 5 Tips Voor Betere Productfoto's | Tutorials | 4 min |
| Marketplace Fees Vergelijken: Bol vs Amazon | Trends | 6 min |
| Hoe [Webshop X] 40% Groeide Met SellQo | Case Studies | 5 min |

---

## Verwacht Resultaat

Na implementatie:
1. **About** toont professioneel bedrijfsprofiel met sociale proof
2. **Contact** biedt meerdere contactmogelijkheden en booking
3. **Blog** ziet eruit als echte content hub met navigatie
4. **Partners** heeft werkend aanmeldproces
5. **Careers** toont aantrekkelijke werkgeverimage
6. **HelpCenter** is interactief doorzoekbaar
7. **Status** geeft vertrouwen met transparante uptime data
8. **Integrations** is filterable en informatief
9. **ApiDocs** is developer-ready met code voorbeelden
10. **Changelog** nodigt uit tot newsletter inschrijving

Alle pagina's worden rijker, professioneler en meer vertrouwenwekkend voor bezoekers.
