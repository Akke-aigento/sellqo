

## Productbeheer Samenvoegen: Eén "Producten" Tab

### Het probleem nu

Er zijn 3 losse plekken voor product sync:
1. **"Producten Synchroniseren" knop** (header) → dialog met import/export/bidi + per-product veld-toggles
2. **"Voorraad" tab** → toont gekoppelde producten met sync status, maar geen veld-toggles
3. **"Sync Regels" tab** → generieke "producten" regelkaart met richting/frequentie, maar geen productselectie

### De oplossing

Vervang de losse "Voorraad" tab en de floating dialog door één geïntegreerde **"Producten" tab** die alles combineert:

```text
┌─ Producten Tab ──────────────────────────────────────────────┐
│                                                               │
│  ┌─ Sync Instellingen (compact) ───────────────────────────┐ │
│  │  Richting: [Import] [Export] [Bidi]   Frequentie: 30min │ │
│  │  Conflict: SellQo wins              Auto-sync: ✓ Aan   │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  [Producten ophalen van Bol.com]  [Zoek...]  Filter: [Alle] │
│                                                               │
│  ┌─ Producttabel ──────────────────────────────────────────┐ │
│  │ ☑ Product X  │ EAN │ €29.99 │ 150 │ FBR │ 🔄 Aan │ ▼  │ │
│  │   ├─ Sync velden: [✓]Prijs [✓]Voorraad [ ]Titel [✓]... │ │
│  │ ☑ Product Y  │ EAN │ €14.50 │  32 │ FBR │ 🔄 Aan │ ▶  │ │
│  │ ☐ Product Z  │ EAN │ €45.00 │   0 │ FBB │ Nieuw  │ ▶  │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  [Importeer geselecteerde] of [Exporteer geselecteerde]       │
└───────────────────────────────────────────────────────────────┘
```

### Wat verandert

| Bestand | Actie |
|---|---|
| `src/pages/admin/MarketplaceDetail.tsx` | "Voorraad" tab hernoemen naar "Producten". De tab-content vervangen door de nieuwe `BolProductSyncTab` component. `BolProductImportDialog` knop uit de header verwijderen. |
| `src/components/admin/marketplace/BolProductSyncTab.tsx` | **Nieuw** — Combineert de inhoud van de oude `BolProductImportDialog` (product ophalen, selectie, import/export, veld-toggles) met de voorraadtabel (gekoppelde producten, sync status, laatste sync). Sync richting/frequentie/conflict als inline instellingen bovenaan ipv in een dialog. |
| `src/components/admin/marketplace/BolProductImportDialog.tsx` | Wordt niet meer gebruikt vanuit MarketplaceDetail. Kan behouden blijven voor eventueel hergebruik elders, maar de logica verhuist naar de nieuwe tab. |
| `src/components/admin/marketplace/SyncRulesTab.tsx` | De "producten" SyncRuleCard krijgt een link/knop "Beheer producten →" die naar de Producten tab navigeert, zodat er geen dubbele config meer is. |

### Hoe de nieuwe tab werkt

1. **Bovenaan**: Compacte sync-instellingen (richting, frequentie, conflict-strategie) — direct inline, geen dialog nodig
2. **Midden**: Actieknoppen "Producten ophalen van Bol.com" (import-modus) of "SellQo producten tonen" (export-modus), plus zoek/filter
3. **Tabel**: Alle producten (zowel gekoppelde als nog te importeren) in één lijst met:
   - Checkbox voor selectie
   - Status badge (Gekoppeld / Nieuw / Niet op Bol)  
   - Sync toggle (aan/uit)
   - Expandable row met per-veld toggles (prijs, voorraad, titel, etc.)
   - Laatste sync timestamp
4. **Onderaan**: Bulk actie knoppen afhankelijk van selectie en richting

### Wat verdwijnt
- De floating "Producten Synchroniseren" dialog-knop in de header
- De aparte "Voorraad" tab (samengevoegd in "Producten")
- De losse "producten" kaart in Sync Regels tab (vervangen door deeplink)

