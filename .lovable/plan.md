

# Fix: Incomplete CSV Import - Alle Records Importeren

## Probleem Gevonden

De import wizard slaat **alleen de eerste 5 rijen** op als "sample data" en importeert vervolgens alleen die sample. Hierdoor worden van 100+ klanten slechts een paar geïmporteerd.

### Bewijs

**FileUpload.tsx (regel 50):**
```typescript
sampleData: rows.slice(0, 5),  // ← ALLEEN 5 RIJEN!
```

**PreviewValidation.tsx (regel 69):**
```typescript
const records = file.sampleData.map(...)  // ← GEBRUIKT ALLEEN DIE 5
```

De volledige data (`rows`) wordt nergens bewaard tussen upload en import.

---

## Oplossing

### Aanpak: Volledige Data Opslaan + Batched Import

1. **Bewaar alle rijen** na parsing (niet alleen sample)
2. **Preview toont sample** (voor performance), maar import gebruikt alles
3. **Batch processing** voor grote bestanden (>500 records)
4. **Progress indicator** tijdens import

---

## Technische Wijzigingen

### 1. Update `UploadedFile` Type

**Bestand:** `src/types/import.ts`

```typescript
export interface UploadedFile {
  file: File;
  dataType: ImportDataType;
  rowCount: number;
  headers: string[];
  sampleData: Record<string, string>[];  // Preview (5 rijen)
  allData: Record<string, string>[];     // ALLE rijen - NIEUW
}
```

### 2. Update FileUpload Component

**Bestand:** `src/components/admin/import/FileUpload.tsx`

Bewaar alle rijen na parsing:

```typescript
onFileUpload(dataType, {
  file,
  dataType,
  rowCount: rows.length,
  headers,
  sampleData: rows.slice(0, 5),   // Voor preview
  allData: rows,                  // ALLE data voor import
});
```

### 3. Update PreviewValidation Component

**Bestand:** `src/components/admin/import/PreviewValidation.tsx`

- Preview toont nog steeds sample (voor snelheid)
- Gebruik `allData` voor de werkelijke import data

```typescript
// Transform ALL records, but only show preview of first few
const allRecords = file.allData.map((row, index) => {
  const transformed = transformRecord(row, fieldMapping);
  const validation = validateRecord(transformed, dataType);
  return {
    index,
    data: transformed,
    errors: validation.errors.map(e => e.error),
    warnings: [],
    selected: validation.valid,
  };
});

onPreviewChange(dataType, allRecords);

// UI shows only first N records for performance
const displayRecords = records.slice(0, 100);
```

### 4. Update ImportWizard met Batching

**Bestand:** `src/components/admin/import/ImportWizard.tsx`

Implementeer batch processing met progress:

```typescript
const BATCH_SIZE = 100;

// Split records into batches
const batches = [];
for (let i = 0; i < records.length; i += BATCH_SIZE) {
  batches.push(records.slice(i, i + BATCH_SIZE));
}

let totalSuccess = 0;
let totalFailed = 0;

// Process each batch
for (let i = 0; i < batches.length; i++) {
  setProgress({ current: i + 1, total: batches.length });
  
  const { data, error } = await supabase.functions.invoke('run-csv-import', {
    body: { records: batches[i], ... }
  });
  
  if (data) {
    totalSuccess += data.success_count;
    totalFailed += data.failed_count;
  }
  
  // Small delay to prevent timeouts
  await new Promise(r => setTimeout(r, 50));
}
```

### 5. Add Progress UI

**Bestand:** `src/components/admin/import/ImportWizard.tsx`

Voeg progress indicator toe:

```tsx
const [progress, setProgress] = useState<{
  current: number;
  total: number;
  dataType: string;
} | null>(null);

// In render:
{progress && (
  <div className="space-y-2">
    <Progress value={(progress.current / progress.total) * 100} />
    <p className="text-sm text-muted-foreground text-center">
      {progress.dataType}: Batch {progress.current} van {progress.total}
    </p>
  </div>
)}
```

---

## Bestanden die Worden Gewijzigd

| Bestand | Wijziging |
|---------|-----------|
| `src/types/import.ts` | Voeg `allData` property toe aan `UploadedFile` |
| `src/components/admin/import/FileUpload.tsx` | Bewaar alle rijen in `allData` |
| `src/components/admin/import/PreviewValidation.tsx` | Gebruik `allData` voor transform, beperk preview display |
| `src/components/admin/import/ImportWizard.tsx` | Batch processing met progress indicator |

---

## Verwachte Resultaten

| Vóór Fix | Na Fix |
|----------|--------|
| 100 klanten → 5 geïmporteerd | 100 klanten → 100 geïmporteerd |
| 44 producten → 1 geïmporteerd | 44 producten → 44 geïmporteerd |
| ~100 orders → 4 geïmporteerd | ~100 orders → alle geïmporteerd |

---

## Performance Overwegingen

- **Preview UI**: Beperkt tot 100 rijen weergave (voor snelheid)
- **Batches**: 100 records per API call (voorkomt timeouts)
- **Progress feedback**: Gebruiker ziet voortgang bij grote imports
- **Memory**: Alle data in memory is OK voor <10K records

