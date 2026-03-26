

## Analyse: Segmenten, Advertenties & Campagnes — Wat Ontbreekt

### Huidige staat per module

**Segmenten (SegmentBuilder + SegmentDialog)**
- Basisfilters werken: klanttype, landen, bestellingen, besteed bedrag, engagement score
- Ontbreekt:
  - Geen bewerkfunctie (edit) voor bestaande segmenten — alleen aanmaken + verwijderen
  - Geen RFM-tags of auto-tags als filtercriterium (terwijl auto-tagging al bestaat in Customer Intelligence)
  - Geen "product-gekocht" of "categorie" filter (belangrijk voor remarketing)
  - Geen "aangepast veld" / tags filter
  - Geen preview van individuele klanten in het segment
  - Segmenten worden NIET gedeeld tussen Email Marketing en Advertenties — terwijl de database dit al ondersteunt (`ad_campaigns.segment_id`)

**Advertenties (Ads module)**
- Dashboard toont stats + actieve campagnes
- CampaignWizard heeft: platform, type, naam, budget, ROAS
- Ontbreekt:
  - **Geen productselectie** — je kunt geen producten kiezen voor Sponsored Products / Shopping campagnes, terwijl `product_ids` en `category_ids` kolommen bestaan
  - **Geen segment/doelgroep stap** — `segment_id` en `audience_type` bestaan in DB maar worden niet gebruikt in de wizard
  - **Geen creatives beheer** — `ad_creatives` tabel bestaat maar er is geen UI om afbeeldingen, headlines, of beschrijvingen toe te voegen
  - **Geen campagne detail/edit pagina** — "Bewerken" in dropdown doet niets
  - **Geen datum selectie** — start/einddatum ontbreekt in wizard terwijl kolommen bestaan
  - **Geen audience syncs UI** — `ad_audience_syncs` tabel bestaat maar nergens zichtbaar
  - **Geen performance grafieken per campagne** — alleen totaalcijfers
  - **AI Suggesties** is een lege placeholder

**Email Campagnes (Marketing module)**
- Basis werkt: aanmaken, template kiezen, segment kiezen, versturen
- Ontbreekt:
  - **Geen campagne detail pagina** met per-ontvanger resultaten
  - Segmenten zijn niet bewerkbaar vanuit de campagne-flow
  - **Geen link tussen email campagnes en ad campagnes** — bijv. retargeting op basis van email non-openers

### Samenhang-problemen

1. **Segmenten leven op twee plekken** — Marketing tab en Ads wizard, maar zijn niet verbonden
2. **Geen cross-channel view** — je kunt niet zien welke klanten via email EN ads zijn bereikt
3. **Productselectie** zit nergens — niet in ads wizard, niet als segment filter

---

### Plan: Wat te bouwen (prioriteit)

**Fase 1 — Kritische ontbrekende functionaliteit**

| # | Wat | Waar |
|---|---|---|
| 1 | **Productselectie stap in CampaignWizard** | Nieuwe wizard stap "Producten" tussen type en budget: zoek/selecteer producten + categorieën |
| 2 | **Doelgroep/Segment stap in CampaignWizard** | Nieuwe wizard stap: kies bestaand segment OF maak doelgroep (audience_type) |
| 3 | **Datumkiezer in CampaignWizard** | Start/einddatum in de budget-stap |
| 4 | **Creatives tab/sectie bij campagne** | Na aanmaken: voeg headlines, beschrijvingen, afbeeldingen toe per campagne |
| 5 | **Campagne detail pagina** | Klikbare campagne → detail view met stats, creatives, producten, bewerk-opties |

**Fase 2 — Segmenten verbeteren**

| # | Wat | Waar |
|---|---|---|
| 6 | **Segment bewerken** | Edit-knop op segmentkaart → SegmentDialog met bestaande data |
| 7 | **Extra filters in SegmentBuilder** | Product gekocht, categorie, auto-tags (VIP, Sleeping, etc.), registratiedatum |
| 8 | **Klantpreview in segment** | "Bekijk klanten" knop → tabel met eerste 50 klanten die matchen |

**Fase 3 — Samenhang & Cross-channel**

| # | Wat | Waar |
|---|---|---|
| 9 | **Gedeelde segmenten widget** | Segment selectie-component herbruikbaar voor zowel email als ads |
| 10 | **Campagne performance grafieken** | Lijn/balk charts per campagne (impressies, clicks, ROAS over tijd) |
| 11 | **AI Suggesties invullen** | Op basis van verkoopdata: suggereer "Promoot bestsellers", "Retarget cart abandoners", etc. |

### Technische aanpak

- **CampaignWizard.tsx**: voeg 2 extra stappen toe (`products` + `audience`) aan de steps array; gebruik bestaand ProductSelectDialog voor productkeuze
- **CampaignCard.tsx**: maak klikbaar naar een nieuwe detail-route `/admin/ads/campaign/:id`
- **SegmentBuilder.tsx**: voeg filters toe voor `purchased_product_ids`, `tags`, `registration_date_range`
- **SegmentDialog.tsx**: accepteer een `segment` prop voor edit-modus (deels al voorbereid)
- **Nieuw component**: `CampaignDetailPage.tsx` met tabs (Overzicht, Creatives, Producten, Doelgroep)
- **Nieuw component**: `CreativeManager.tsx` voor het beheren van ad_creatives per campagne
- Database: geen migraties nodig — alle kolommen bestaan al

### Omvang
Fase 1 (5 items) is het belangrijkst — zonder productselectie en doelgroep zijn advertentiecampagnes functioneel onbruikbaar. Fase 2 en 3 zijn verbeteringen.

Zal ik met Fase 1 beginnen?

