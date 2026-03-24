

## Klantdata-analyse: Wat hebben tenants & wat kunnen ze ermee?

### Beschikbare klantdata (per tenant)

De tenants beschikken over een **rijke dataset** verspreid over meerdere tabellen:

| Databron | Velden | Status |
|---|---|---|
| **customers** (CRM) | 70+ velden: contactinfo, adres, BTW, tags, total_orders, total_spent, email_engagement_score, marketing consent (email/sms/whatsapp), social IDs (facebook, instagram, whatsapp), import data | Actief |
| **storefront_customers** | Login-activiteit, last_login_at, adressen (JSONB), newsletter opt-in, bedrijfsgegevens | Actief |
| **storefront_favorites** | Welke producten klanten op hun wishlist hebben | Actief |
| **orders + order_items** | Volledige aankoopgeschiedenis: wat, wanneer, hoeveel, welke producten, betaalmethode | Actief |
| **pos_transactions** | Fysieke winkelverkopen per klant | Actief |
| **newsletter_subscribers** | E-mail opt-in status, bevestiging | Actief |
| **customer_segments** | Dynamische segmenten op basis van filterregels | Actief |
| **customer_groups** | Handmatige groepen met custom prijzen | Actief |
| **customer_loyalty** | Punten, tiers, transactiegeschiedenis | Actief |
| **email_campaigns + campaign_sends** | Open/click/bounce rates per klant | Actief |

### Wat kunnen tenants NU al doen?

- Segmenten aanmaken (op basis van type, land, bestedingen, orders)
- E-mailcampagnes sturen naar segmenten
- Loyaliteitsprogramma's beheren met tiers
- Klantengroepen met custom prijzen
- AI win-back suggesties (via AIActionCenter)
- WhatsApp berichten (abandoned cart, shipping updates)
- Webshop accounts overzicht

### Wat ONTBREEKT — creatieve uitbreidingen

#### 1. Customer Intelligence Dashboard (nieuw admin-pagina)
Een dedicated klant-analytics pagina met:
- **RFM-analyse** (Recency, Frequency, Monetary): automatisch klanten scoren en indelen in segmenten als "Champions", "At Risk", "Hibernating", "New Customers" — alle data zit al in `total_orders`, `total_spent`, en `orders.created_at`
- **Customer Lifetime Value (CLV) voorspelling**: op basis van bestelhistorie een geschatte toekomstige waarde per klant berekenen
- **Churn-risico score**: klanten die X dagen geen bestelling hebben geplaatst + dalende email engagement → automatisch flaggen
- **Cohort-analyse**: groepen klanten per registratiemaand en hun herhaalaankoopgedrag over tijd visualiseren

#### 2. Slimme automatische klanttags
- **Auto-tagging engine** die op basis van gedrag automatisch tags toekent:
  - "VIP" bij >€500 besteed
  - "Slapend" bij >90 dagen geen bestelling
  - "Nieuwsbrief-lezer" bij hoge email engagement
  - "B2B Verified" bij VIES-gevalideerd BTW-nummer
  - "Fysieke klant" bij POS-aankopen
  - "Omni-channel" bij zowel online als POS-aankopen
- Tags worden real-time bijgewerkt via database triggers

#### 3. Product-aanbevelingen per klant
- **"Klanten die dit kochten, kochten ook..."** — cross-sell data uit `order_items`
- **Wishlist-gedreven aanbevelingen**: als meerdere klanten dezelfde producten op hun wishlist hebben → trending product signaal
- **Persoonlijke product-feed** op de storefront gebaseerd op aankoopgeschiedenis + wishlist
- Tenants kunnen in hun admin per klant zien: "Aanbevolen producten om te promoten bij deze klant"

#### 4. Klant-timeline / 360° View
- Op de klantdetailpagina een **chronologische timeline** van alle interacties:
  - Registratie, bestellingen, retouren, e-mails geopend, wishlist-wijzigingen, POS-aankopen, notities, support-berichten (inbox)
  - Combineert data uit `orders`, `campaign_sends`, `storefront_favorites`, `pos_transactions`, `inbox_messages`, `customer_loyalty`
- Geeft tenant een compleet beeld van de klantreis

#### 5. Geautomatiseerde klant-flows (beyond email)
- **Verjaardagscampagnes**: veld toevoegen `date_of_birth` → automatisch korting/bericht op verjaardag
- **Review requests**: X dagen na levering automatisch een review-verzoek sturen
- **Herbestelling-herinneringen**: voor consumables/producten met voorspelbare herbestelcyclus
- **Win-back flows met escalatie**: dag 30 → e-mail, dag 60 → WhatsApp, dag 90 → persoonlijke korting

#### 6. Klant-export voor advertentieplatformen
- **Lookalike audiences**: exporteer "beste klanten" segment als CSV voor Facebook/Google Ads Custom Audiences
- **Retargeting-lijsten**: klanten met abandoned wishlist items → advertentiecampagne
- Al een Ads-module aanwezig — directe integratie mogelijk

#### 7. Klant-scorecards & gezondheidsmetrics
- Per klant een "health score" (0-100) gebaseerd op:
  - Recente aankopen (recency)
  - Bestelfrequentie
  - Email engagement
  - Wishlist-activiteit
  - Loyaliteitspunten
- Dashboard-widget: "5 klanten met dalende score deze week"
- Automatische notificatie bij score-daling

#### 8. Omzet-attributie per acquisitiekanaal
- Klanten getagd met bron (Shopify import, webshop registratie, POS, handmatig) via `import_source` + `storefront_customer_id`
- Rapport: "Hoeveel omzet komt van webshop-registraties vs Shopify-import vs handmatig aangemaakte klanten?"
- Helpt tenants begrijpen welk kanaal het meest winstgevend is

### Prioriteitsvoorstel

| # | Feature | Impact | Complexiteit | Data beschikbaar? |
|---|---|---|---|---|
| 1 | Customer Intelligence Dashboard (RFM + CLV + Churn) | Zeer hoog | Gemiddeld | 100% — alle velden bestaan al |
| 2 | Klant-timeline / 360° View | Hoog | Gemiddeld | 100% — cross-table joins |
| 3 | Automatische klanttags | Hoog | Laag | 100% — triggers op bestaande data |
| 4 | Klant health scores | Hoog | Laag-Gemiddeld | 100% |
| 5 | Product-aanbevelingen | Gemiddeld-Hoog | Gemiddeld | 100% — order_items + favorites |
| 6 | Geautomatiseerde flows (verjaardag, herbestelling) | Gemiddeld | Gemiddeld | 90% — `date_of_birth` ontbreekt |
| 7 | Advertentie-export (lookalike audiences) | Gemiddeld | Laag | 100% |
| 8 | Omzet-attributie per kanaal | Gemiddeld | Laag | 100% |

Alle 8 features bouwen op **bestaande data** — er zijn nauwelijks schema-wijzigingen nodig. De klantdata die tenants al hebben is een goudmijn die nu grotendeels onbenut blijft.

Welke van deze features wil je aanpakken?

