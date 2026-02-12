

# Integratie van Varianten in One-Page Product Form

## Analyse Huidige Structuur

De ProductForm.tsx gebruikt momenteel een 3-tab systeem:
1. **Product** tab (424px) - linker kolom, 400px rechter sidebar
2. **Varianten** tab - volledig aparte tab met ProductVariantsTab component
3. **Marketplaces** tab

De memory vertelt dat dit al gerefactord is naar een "one-page layout", maar de varianten zitten nog in een aparte tab.

## Plan: Varianten naar Product Tab

### Stap 1: Restructurering van Product Tab
De "Product" tab moet nu twee kolommen herbergen:
- **Linkerkolom (flex-1)**: Bestaande contentvolgorde
  - Product type selector
  - Basisinformatie (naam, slug, beschrijving)
  - Prijzen en voorraad
  - Optionele secties (digitale, gift card specifiek)

- **Rechterkant sidebar (400px)**: Bestaande sidebarcontent
  - Afbeeldingen
  - Organisatie (categorieën, tags)
  - SEO
  - Publicatie instellingen
  - **NIEUW: Varianten sectie** (collapsible of altijd zichtbaar?)

### Stap 2: Varianten in de Layout Integreren

Twee opties:

**Optie A - Collapsible Variants in Sidebar (aanbevolen)**
- Voeg een `Collapsible` sectie toe in de rechterkant sidebar
- "Varianten" als titel met chevron icon
- Wanneer geopend, toont de volledige ProductVariantsTab inhoud
- Voordeel: niet opdringerig, maar toegankelijk
- Nadeel: veel content in sidebar, kan crowded worden

**Optie B - Variants als Volledige Sectie in Linkerkolom**
- Voeg varianten-sectie toe onder de huidige content in de linkerkolom
- Altijd zichtbaar, scrollable pagina
- Voordeel: duidelijk zichtbaar, genoeg ruimte
- Nadeel: maakt de form langer

**Keuze: Optie B** - omdat varianten een belangrijk onderdeel zijn van product management, moeten ze altijd zichtbaar en toegankelijk zijn.

### Stap 3: Tab-balk Aanpassen
Na integratie: **2 tabs in plaats van 3**
- `Product` (bevat nu alles inclusief varianten)
- `Marketplaces`

De `variants` tab kan compleet verwijderd worden uit de TabsList.

### Stap 4: Component Cleanup
- ProductVariantsTab blijft hetzelfde intern (geen wijzigingen nodig)
- Embedded rechtstreeks in de Product TabsContent
- Conditioneel renderen: alleen als `isEditing && id` (net als nu)

## Technische Implementatie

### Files die Aangepast Moeten Worden
1. **src/pages/admin/ProductForm.tsx**
   - Wijzig TabsList van 3 naar 2 triggers
   - Voeg ProductVariantsTab component toe in Product tab (onder huidige content, of in aparte Card sectie)
   - Import blijft hetzelfde

### Layout Specifics
```
Product Tab content (één kolom layout):
├── Left Column (flex-1)
│   ├── Product Type
│   ├── Basic Info (naam, slug, desc)
│   ├── Pricing & Stock
│   ├── Digital Product Settings (conditional)
│   ├── Gift Card Settings (conditional)
│   └── [NIEUW] Varianten Sectie
│       ├── Variant Options Management
│       └── Variants Table
│
└── Right Sidebar (400px)
    ├── Images
    ├── Organization (category, tags)
    ├── SEO
    └── Publication Settings
```

## Voordelen deze Benadering
1. ✅ Volledige "one-pager" ervaring - alles op één pagina
2. ✅ Varianten blijven prominent
3. ✅ Marketplace tab gescheiden (logisch)
4. ✅ Geen dubbel werk - ProductVariantsTab component kan "as-is" hergebruikt worden
5. ✅ Responsive: op mobiel wordt alles netjes gestapeld

## Inplanting Volgorde
1. Verwijder "Varianten" tab uit TabsList (regel ~418)
2. Voeg ProductVariantsTab() aanroep toe in Product tab, na de bestaande content
3. Zet het in een duidelijke Card/Section met titel "Varianten"
4. Test dat varianten fully functional blijven

