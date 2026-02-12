
# Audit en Herstructurering: Domeinen, Talen, Vertalingen en Instellingen

## Gevonden Overlap en Inconsistenties

### 1. Domein-configuratie op 3 plekken

| Locatie | Wat er staat | Probleem |
|---------|-------------|----------|
| **Webshop > Instellingen** (`StorefrontSettings.tsx`) | "Domein" card met huidige URL, DNS-instructies, verwijzing naar "Instellingen > Algemeen" | Verouderd -- verwijst naar het oude single-domain systeem (`tenants.custom_domain`) |
| **Instellingen > Domeinen** (`MultiDomainSettings.tsx`) | Volledige multi-domain CRUD met DNS-verificatie, locale, canonical | Dit is de juiste, actuele plek |
| **Instellingen > Winkelinstellingen** (`StoreSettings.tsx`) | "Primaire Contenttaal" dropdown + link naar Vertaal Hub | Taalinstelling die losstaat van de domein-locale mapping |

### 2. Taalconfiguratie op 3 plekken

| Locatie | Wat er staat | Probleem |
|---------|-------------|----------|
| **Webshop > Functies > Meertalige Webshop** (`StorefrontFeaturesSettings.tsx` regel 679-800) | Toggle "meertalig activeren", talen selecteren, standaardtaal, taalwisselaar stijl | Dubbel met domein-locale; tenant moet hier apart talen activeren die al via domeinen gekoppeld zijn |
| **Instellingen > Winkelinstellingen** (`StoreSettings.tsx` regel 183-206) | "Primaire Contenttaal" dropdown | Derde plek voor taalinstelling, onduidelijk hoe dit relateert aan de meertalige webshop |
| **Instellingen > Domeinen** (`MultiDomainSettings.tsx`) | Locale per domein | De eigenlijke bron van welke talen actief zijn |

### 3. Vertalingen verspreid

| Locatie | Wat er staat |
|---------|-------------|
| **Marketing > Vertalingen** (sidebar) | Volledige TranslationHub met bulk-vertaling, statistieken, instellingen |
| **Instellingen > Winkelinstellingen** | Link "Vertalingen beheren" naar Vertaal Hub |
| **Producten > Productformulier** | ProductTranslationTabs (inline vertalingen) + link naar TranslationHub |
| **Categorieen formulier** | Vertalingen badge met AI-vertaalknop |

### 4. Overige inconsistenties

- **StoreSettings bevat thema-kleuren** (primary_color, secondary_color) -- dit hoort bij Webshop > Theme
- **StoreSettings bevat facturatie-instellingen** -- dit hoort bij Instellingen > Financieel (waar al "Automatische Facturatie" staat)
- **Webshop > Instellingen tab** bevat "Custom Frontend" en "Tracking & Scripts" -- technische zaken tussen visuele content

## Voorstel: Nieuwe Structuur

### Principe: Single Source of Truth

De `tenant_domains` tabel wordt de enige bron voor actieve talen. De "Meertalige Webshop" sectie in Functies wordt vereenvoudigd: in plaats van zelf talen te beheren, leest die automatisch welke talen actief zijn op basis van de gekoppelde domeinen.

### Webshop-pagina (creatieve hub) -- wat verandert

De Webshop tabs worden:
- **Theme** -- ongewijzigd
- **Homepage** -- ongewijzigd
- **Pagina's** -- ongewijzigd
- **Reviews** -- ongewijzigd
- **Juridisch** -- ongewijzigd
- **Functies** -- Meertalige Webshop sectie wordt vereenvoudigd (zie onder)
- **Instellingen** -- Domein-card wordt vervangen door compacte samenvatting + doorverwijzing

#### Webshop > Functies > Meertalige Webshop (vereenvoudigd)

In plaats van zelf talen aan/uit te zetten, toont deze sectie:
- Een read-only overzicht van actieve talen (afgeleid van gekoppelde domeinen)
- De **taalwisselaar stijl** instelling (dropdown/flags/text) -- dit is de enige instelling die hier overblijft want het gaat over hoe de storefront eruitziet
- Een link naar **Instellingen > Domeinen** om talen/domeinen te beheren
- De "meertalig activeren" toggle wordt automatisch: als er meer dan 1 domein-locale is, is het meertalig

#### Webshop > Instellingen (opschonen)

- **Domein-card verwijderen** -- vervangen door een compacte samenvatting: "X domeinen gekoppeld" met link naar Instellingen > Domeinen
- **Custom Frontend** -- blijft (relevant voor webshop)
- **Tracking & Scripts** -- blijft (relevant voor webshop)

### Instellingen-pagina -- wat verandert

#### Instellingen > Winkelinstellingen (opschonen)

- **"Primaire Contenttaal"** verwijderen -- wordt afgeleid van het canonical domein in `tenant_domains`
- **Thema-kleuren** verwijderen -- dit zit al in Webshop > Theme > Aanpassen
- **Link naar Vertaal Hub** verwijderen -- vertalingen zijn bereikbaar vanuit contextuele plekken
- **Facturatie-sectie** verwijderen -- zit al bij Instellingen > Financieel > Automatische Facturatie
- Wat overblijft: BTW-percentage, valuta, verzending inschakelen, systeemthema

#### Instellingen > Domeinen (wordt de central hub)

Blijft zoals het is -- dit is de single source of truth voor:
- Welke domeinen gekoppeld zijn
- Welke taal bij elk domein hoort
- Welk domein canonical is
- DNS-verificatie status

### Vertalingen (sidebar-item)

Het menu-item "Vertalingen" onder Marketing wordt verplaatst:
- **Nieuw**: Onder "Beheer" in de sidebar (naast Categorieen) -- want het is een content-beheertool, geen marketingtool
- De TranslationHub blijft als standalone pagina bestaan -- het is een krachtige tool voor bulk-vertalingen en overzicht
- Contextuele links vanuit producten en categorieen blijven bestaan

### Flow voor een nieuwe tenant

```text
1. Instellingen > Domeinen
   -> Voeg vanxcel.nl toe (NL, canonical)
   -> Voeg vanxcel.com toe (EN)
   -> DNS verifiëren

2. Webshop > Functies
   -> Ziet automatisch: NL + EN actief
   -> Kiest taalwisselaar stijl (dropdown)

3. Producten bewerken
   -> Ziet tabs: NL (standaard) | EN
   -> Vult vertalingen in of gebruikt AI

4. Beheer > Vertalingen (optioneel)
   -> Bulk alle producten vertalen
   -> Vertaalcoverage bekijken
```

## Concrete Wijzigingen

### Bestanden die gewijzigd worden

| Bestand | Wijziging |
|---------|-----------|
| `src/components/admin/storefront/StorefrontSettings.tsx` | Domein-card vervangen door compacte samenvatting met link naar Instellingen > Domeinen |
| `src/components/admin/storefront/StorefrontFeaturesSettings.tsx` | Meertalige Webshop sectie vereenvoudigen: read-only talen uit domeinen, alleen taalwisselaar stijl behouden |
| `src/components/admin/settings/StoreSettings.tsx` | "Primaire Contenttaal" dropdown verwijderen, thema-kleuren card verwijderen, facturatie-sectie verwijderen, link naar Vertaal Hub verwijderen |
| `src/components/admin/sidebar/sidebarConfig.ts` | "Vertalingen" verplaatsen van Marketing naar Beheer |

### Geen bestanden verwijderd

Alle componenten blijven bestaan -- we verplaatsen, vereenvoudigen en verwijzen door.
