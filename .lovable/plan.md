## Waar staat het nu

De label-format instellingen die we hebben toegevoegd staan momenteel **verspreid en verstopt**:

1. **Tenant default voor VVB labels** (a6 / 4x6_thermal / a5 / a4_original / brother_62mm)
   → alleen op **Beheer → Marketplaces → Bol.com (detail) → VVB Settings**
   Niet logisch — een gebruiker zoekt dit in Instellingen of Verzending, niet in een marketplace-detailpagina.

2. **Per-print override dropdown** → alleen op een order in `BolActionsCard` (klopt qua plek).

3. **Per-user voorkeur** (`user_label_preferences` tabel die we hebben aangemaakt)
   → **nog geen UI**. Niemand kan zijn persoonlijke default kiezen, terwijl dat juist de kern van je vraag was (verschillende printers per medewerker).

4. **Bestaande `LabelPrinterSettings`** op `/admin/shipping` heeft nog een aparte oude `labelFormat` (a6/4x6/brother_62mm) die nergens wordt gepersisteerd en niets met VVB doet.

Geen wonder dat je het niet kan vinden.

## Plan: alles centraliseren onder Verzending → Labelinstellingen

### A. Nieuwe sectie op `/admin/shipping`: **"Verzendlabel formaat"**
Eén nieuwe kaart `LabelFormatSettings.tsx` met twee blokken:

**Blok 1 — Tenant defaults (alleen tenant_admin)**
- Multi-select checkboxes: welke formaten zijn beschikbaar voor dit bedrijf
  (A6, 4×6 thermisch, A5, A4 origineel, Brother 62mm)
- Dropdown: welk formaat is bedrijfs-default
- Slaat op naar `marketplace_connections.settings.vvbLabelFormats` + `vvbLabelFormatDefault` (zelfde keys als BolVVBSettings nu al gebruikt → blijft compatibel)
- Helptekst: "Deze formaten kunnen je teamleden kiezen bij het printen van labels."

**Blok 2 — Mijn voorkeur (elke ingelogde user, ook fulfillment)**
- Eén dropdown: "Mijn standaard labelformaat" — toont alleen formaten die in Blok 1 zijn aangevinkt
- Slaat op in `user_label_preferences` (tabel bestaat al) via upsert op `(user_id, tenant_id)`
- Helptekst: "Dit is het formaat dat standaard geselecteerd wordt als jij een label print. Handig als jullie verschillende printers gebruiken."

### B. `BolVVBSettings.tsx` opschonen
- Format-dropdown daar **weghalen** (verplaatst naar Verzending)
- Vervangen door een korte info-regel met link: *"Labelformaat instellen → Verzending → Verzendlabel formaat"*
- Rest van VVB settings (auto-create, retry-instellingen etc.) blijft staan

### C. Bestaande oude `LabelPrinterSettings` (WebUSB sectie)
- Niets aan veranderen qua functionaliteit (printer-koppeling, WebUSB, test print blijft)
- Wel: de oude lokale `labelFormat` state (a6/4x6/brother_62mm) verwijderen — die wordt nergens opgeslagen en is nu overbodig omdat het nieuwe blok dit beheert
- Volgorde op `/admin/shipping`: Verzendmethodes → Integraties → **Verzendlabel formaat** (nieuw) → Labelprinter (WebUSB)

### D. Per-print dropdown in `BolActionsCard` blijft
- Resolutie-volgorde wordt: per-print keuze → user-preference → tenant-default → fallback `a6` (zoals al geïmplementeerd in edge function)

## Niet aangeraakt
- Edge function `create-bol-vvb-label` (resolutie-chain klopt al)
- DB schema (`user_label_preferences` bestaat al)
- Crop-logica
- Andere shipping providers / Sendcloud

## Vraag
Klinkt deze plek (Verzending → Verzendlabel formaat) goed, of liever onder **Instellingen → Algemene Instellingen** als aparte tab "Labels"?
