
# Synchronisatie Regels - Next Level Verbeteringen

## Huidige Status - Wat er al is

| Component | Status |
|-----------|--------|
| Type definities (SyncRules, FieldMappings) | Volledig |
| Platform capabilities matrix | Volledig (5 platformen) |
| SyncRuleCard met richting/velden/instellingen | Volledig |
| StatusMappingDialog voor orders | Volledig |
| Presets (Minimaal/Standaard/Volledig) | Volledig |
| useSyncRules hook met persistence | Volledig |

---

## Verbeteringen voor "Spot On" Status

### 1. Synchronisatie Geschiedenis en Logging Dashboard

Een visueel log van alle sync-activiteiten per data type, zodat gebruikers kunnen zien wat er wanneer is gesynchroniseerd.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  📊 Laatste Synchronisaties                                     [Vernieuwen]│
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ✓ Bestellingen   Vandaag 14:32   12 orders geimporteerd                    │
│  ✓ Voorraad       Vandaag 14:30   48 producten bijgewerkt                   │
│  ⚠ Producten      Vandaag 12:15   3 van 25 mislukt                          │
│  ✓ Klanten        Gisteren        5 klanten geimporteerd                    │
│                                                                              │
│  [Bekijk volledige historie →]                                              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Nieuwe Componenten:**
- `SyncHistoryWidget.tsx` - Compacte widget in SyncRulesTab
- `SyncLogDialog.tsx` - Uitgebreide log viewer per data type

**Nieuwe Database Tabel:**
```sql
CREATE TABLE sync_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  connection_id UUID REFERENCES marketplace_connections(id),
  data_type TEXT NOT NULL,
  direction TEXT NOT NULL,
  status TEXT DEFAULT 'success',
  records_processed INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  error_details JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2. Conflict Detectie en Resolutie Strategie

Wanneer dezelfde data in twee systemen wordt gewijzigd, wie "wint"? Geef gebruikers controle over dit gedrag.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  ⚔️ Conflict Strategie                                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Bij bidirectionele sync kan er conflict ontstaan wanneer dezelfde          │
│  data in beide systemen is gewijzigd.                                       │
│                                                                              │
│  Conflict Resolutie:                                                        │
│    ○ SellQo wint altijd                                                     │
│    ● Meest recente wijziging wint                                           │
│    ○ Platform wint altijd                                                   │
│    ○ Handmatig beoordelen                                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Wijzigingen:**
- Voeg `conflictStrategy` toe aan `SyncRuleConfig`
- Nieuwe `ConflictStrategySelector.tsx` component
- Alleen tonen wanneer `direction === 'bidirectional'`

### 3. Handmatige Sync Trigger per Data Type

Gebruikers willen soms direct synchroniseren in plaats van te wachten op auto-sync.

```text
┌────────────────────────────────────────────────────────────────────────┐
│ ☑ VOORRAAD                                             [Nu Syncen ⟳]  │
├────────────────────────────────────────────────────────────────────────┤
│  Richting: ↑ Export                                                    │
│  Laatste sync: 14:32 (15 min geleden)                                  │
│                                                                        │
│  [Nu Syncen] - Forceer directe synchronisatie                          │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

**Wijzigingen:**
- Voeg `lastSyncedAt` toe aan `SyncRuleConfig`
- "Nu Syncen" knop die edge function triggert
- Voortgangsindicator tijdens sync

### 4. Test Modus / Dry Run

Laat gebruikers zien wat er zou gebeuren ZONDER daadwerkelijk te synchroniseren.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  🧪 Test Modus                                               [Stoppen]      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Simulatie resultaten voor PRODUCTEN export:                                │
│                                                                              │
│  Nieuw aan te maken:     8 producten                                        │
│  Bij te werken:         24 producten                                        │
│  Geen actie nodig:     156 producten                                        │
│                                                                              │
│  Potentiële problemen:                                                      │
│  ⚠ 3 producten missen een EAN - vereist door Bol.com                        │
│  ⚠ 1 product heeft prijs €0.00                                              │
│                                                                              │
│  [Toch Syncen] [Problemen Oplossen]                                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Nieuwe Componenten:**
- `SyncTestModeDialog.tsx` - Dry run resultaten
- Nieuwe edge function `test-sync-rules` die geen data wijzigt

### 5. Validatie Waarschuwingen

Preventieve waarschuwingen wanneer configuratie mogelijk problemen kan veroorzaken.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  ⚠️ Configuratie Waarschuwingen                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  • Producten: SKU veld is uitgeschakeld maar vereist voor Bol.com matching  │
│  • Voorraad: Veiligheidsvoorraad is 0 - risico op overselling               │
│  • Klanten: Privacy - klantgegevens worden naar extern platform verzonden   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Wijzigingen:**
- `useSyncValidation.ts` hook voor validatielogica
- Waarschuwingskaart in `SyncRulesTab.tsx`

### 6. Import/Export van Configuratie

Backup en restore van sync regels, ook handig voor kopiëren tussen connecties.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  💾 Configuratie Beheer                                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  [📥 Exporteer als JSON]  [📤 Importeer Configuratie]                        │
│                                                                              │
│  Kopieer naar andere connectie:                                             │
│  [Selecteer connectie... ▾]  [Kopiëren]                                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Nieuwe Component:**
- `SyncConfigManager.tsx` - Export/Import/Copy functies

### 7. Scheduler / Sync Frequentie per Data Type

Verschillende data types kunnen verschillende sync-frequenties nodig hebben.

```text
┌────────────────────────────────────────────────────────────────────────┐
│  ⏰ Sync Schema                                                        │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  Bestellingen:  [Elke 5 minuten ▾]    ← Kritiek, snel syncen          │
│  Voorraad:      [Elke 15 minuten ▾]   ← Belangrijk                    │
│  Producten:     [Dagelijks ▾]         ← Minder vaak nodig             │
│  Klanten:       [Wekelijks ▾]                                         │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

**Wijzigingen:**
- Voeg `syncFrequency` toe aan `SyncRuleConfig`
- `SyncFrequencySelector.tsx` component
- Opties: 5min, 15min, 30min, 1uur, 4uur, dagelijks, wekelijks

---

## Prioriteit en Impact

| Verbetering | Prioriteit | Impact | Complexiteit |
|-------------|------------|--------|--------------|
| Sync Geschiedenis Widget | HOOG | Gebruikers zien wat er gebeurt | Laag |
| Handmatige Sync Trigger | HOOG | Directe controle | Laag |
| Validatie Waarschuwingen | HOOG | Voorkomt fouten | Laag |
| Conflict Strategie | MEDIUM | Belangrijk voor bidirectioneel | Medium |
| Sync Frequentie | MEDIUM | Flexibiliteit | Medium |
| Test Modus / Dry Run | MEDIUM | Vertrouwen | Hoog |
| Import/Export Config | LAAG | Nice-to-have | Laag |

---

## Bestandswijzigingen

| Bestand | Actie | Beschrijving |
|---------|-------|--------------|
| `src/types/syncRules.ts` | Wijzigen | Voeg conflictStrategy, syncFrequency, lastSyncedAt toe |
| `src/components/admin/marketplace/SyncRulesTab.tsx` | Wijzigen | Integreer nieuwe widgets |
| `src/components/admin/marketplace/SyncRuleCard.tsx` | Wijzigen | "Nu Syncen" knop, laatste sync tijd |
| `src/components/admin/marketplace/SyncHistoryWidget.tsx` | Nieuw | Compacte sync historie |
| `src/components/admin/marketplace/SyncLogDialog.tsx` | Nieuw | Uitgebreide log viewer |
| `src/components/admin/marketplace/ConflictStrategySelector.tsx` | Nieuw | Conflict resolutie keuze |
| `src/components/admin/marketplace/SyncFrequencySelector.tsx` | Nieuw | Sync interval keuze |
| `src/components/admin/marketplace/SyncValidationWarnings.tsx` | Nieuw | Waarschuwingen component |
| `src/components/admin/marketplace/SyncConfigManager.tsx` | Nieuw | Export/Import/Copy |
| `src/hooks/useSyncValidation.ts` | Nieuw | Validatielogica hook |
| `supabase/functions/trigger-manual-sync/index.ts` | Nieuw | Handmatige sync API |
| Database migratie | Nieuw | sync_activity_log tabel |

---

## Implementatie Volgorde

**Fase 1 - Quick Wins (Hoogste Impact):**
1. Sync Geschiedenis Widget + Database tabel
2. Handmatige Sync Trigger knop
3. Validatie Waarschuwingen

**Fase 2 - Configuratie Uitbreiding:**
4. Conflict Strategie Selector
5. Sync Frequentie Selector
6. Import/Export Configuratie

**Fase 3 - Geavanceerde Features:**
7. Test Modus / Dry Run

---

## Verwachte Gebruikerservaring Na Implementatie

```text
Merchant opent Sync Regels tab:

1. Ziet direct widget met laatste sync activiteiten
   → "Voorraad: 15 min geleden, 48 producten bijgewerkt"

2. Ziet waarschuwing bovenaan
   → "⚠ SKU veld is uitgeschakeld - aanbevolen voor Bol.com"

3. Opent Producten card
   → Ziet "Laatste sync: 12:15"
   → Klikt "Nu Syncen" voor directe update
   → Voortgangsbalk verschijnt

4. Schakelt naar bidirectioneel
   → Conflict strategie optie verschijnt
   → Kiest "Meest recente wint"

5. Wijzigt sync frequentie
   → Orders: 5 min (kritiek)
   → Producten: dagelijks (minder urgent)

6. Exporteert configuratie als backup
   → JSON bestand gedownload

Resultaat: Volledige controle over synchronisatie met
transparantie over wat er gebeurt.
```

---

## Technische Details

### SyncRuleConfig Uitbreiding

```typescript
export interface SyncRuleConfig {
  enabled: boolean;
  direction: SyncDirection;
  autoSync: boolean;
  fieldMappings: FieldMapping[];
  statusMappings?: StatusMapping[];
  customSettings: SyncCustomSettings;
  lastModified?: string;
  
  // NIEUWE VELDEN
  conflictStrategy?: 'sellqo_wins' | 'platform_wins' | 'newest_wins' | 'manual';
  syncFrequency?: '5min' | '15min' | '30min' | '1hour' | '4hour' | 'daily' | 'weekly';
  lastSyncedAt?: string;
  lastSyncStatus?: 'success' | 'partial' | 'failed';
  lastSyncStats?: {
    processed: number;
    failed: number;
    duration: number;
  };
}
```

### Validatie Regels

```typescript
const VALIDATION_RULES = {
  bol_com: {
    products: {
      required_fields: ['sku', 'barcode'],
      warnings: [
        { condition: (config) => !config.fieldMappings.find(f => f.id === 'sku')?.enabled,
          message: 'SKU veld is vereist voor Bol.com product matching' }
      ]
    }
  },
  // Per platform specifieke regels
};
```

### Manual Sync Edge Function

```typescript
// supabase/functions/trigger-manual-sync/index.ts
// Accepts: connectionId, dataType
// Returns: { success, recordsProcessed, errors }
// Logs to sync_activity_log table
```

---

## Voordelen van deze Verbeteringen

1. **Transparantie** - Gebruikers zien exact wat er gesynchroniseerd wordt
2. **Controle** - Handmatige triggers en frequentie-instellingen
3. **Vertrouwen** - Dry run modus voorkomt verrassingen
4. **Preventie** - Validatie waarschuwingen vangen fouten vroeg op
5. **Flexibiliteit** - Conflict strategieën voor complexe scenario's
6. **Herstel** - Export/import voor backup en migratie
