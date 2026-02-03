
# Fix voor Kapotte Product Import

## Probleem Geïdentificeerd

Het CSV-bestand bevat product beschrijvingen of titels die **meerdere regels** beslaan (newlines binnen quoted velden). De huidige CSV parser kan dit niet aan.

### Voorbeeld van probleem-data:
```csv
Handle,Title,Body (HTML),Variant Price,...
"vanxcel-powerstrip","VanXcel Powerstrip 2x EU plug, 2x USB C
and 2 powerful USB-C port. This powerstrip ensures safety
and flexibility wherever you need it.","<p>Description...</p>",29.99,...
```

De parser splitst dit als 3 aparte rijen in plaats van 1 rij met een multi-line titel.

## Huidige Code (Kapot)

In `src/hooks/useImport.ts`:

```typescript
const lines = text.split(/\r?\n/).filter(line => line.trim());  // PROBLEEM!
```

Dit splitst op ELKE newline, ook binnen quoted velden.

## Oplossing

Vervang de huidige `parseCSV` functie met een **state machine** die correct omgaat met:
1. Quoted velden met newlines
2. Escaped quotes (`""`)
3. Zowel `,` als `;` als delimiter
4. UTF-8/BOM karakters

### Nieuwe parsing logica:

```text
                               ┌─────────────────┐
                               │   START STATE   │
                               │   inQuotes=false│
                               └────────┬────────┘
                                        │
           ┌────────────────────────────┼────────────────────────────┐
           │                            │                            │
           ▼                            ▼                            ▼
    ┌──────────────┐           ┌──────────────┐           ┌──────────────┐
    │ char = '"'   │           │ char = ','   │           │ char = '\n'  │
    │ Toggle state │           │ or char = ';'│           │              │
    └──────────────┘           └──────────────┘           └──────────────┘
           │                            │                            │
           │                    If !inQuotes:                If !inQuotes:
           │                    → Push cell                  → Push cell
           │                    → Push row                   → Push row
           │                                                 → Start new row
           │                    If inQuotes:                 
           │                    → Add to cell                If inQuotes:
           │                                                 → Add to cell
           └────────────────────────────────────────────────────────────┘
```

## Te Wijzigen Bestanden

| Bestand | Wijziging |
|---------|-----------|
| `src/hooks/useImport.ts` | Vervang `parseCSV` en `parseCSVLine` met robust multi-line aware parser |

## Nieuwe Code

De `parseCSV` functie wordt vervangen door een character-by-character parser die de hele file in één keer verwerkt:

```typescript
export async function parseCSV(file: File): Promise<{
  headers: string[];
  rows: Record<string, string>[];
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        let text = e.target?.result as string;
        
        // Remove BOM if present
        if (text.charCodeAt(0) === 0xFEFF) {
          text = text.slice(1);
        }
        
        // Parse using state machine
        const allRows: string[][] = [];
        let currentRow: string[] = [];
        let currentCell = '';
        let inQuotes = false;
        
        for (let i = 0; i < text.length; i++) {
          const char = text[i];
          const nextChar = text[i + 1];
          
          if (char === '"') {
            if (inQuotes && nextChar === '"') {
              // Escaped quote
              currentCell += '"';
              i++;
            } else {
              // Toggle quote mode
              inQuotes = !inQuotes;
            }
          } else if ((char === ',' || char === ';') && !inQuotes) {
            // End of cell
            currentRow.push(currentCell.trim());
            currentCell = '';
          } else if ((char === '\n' || (char === '\r' && nextChar === '\n')) && !inQuotes) {
            // End of row
            if (char === '\r') i++; // Skip \n in \r\n
            currentRow.push(currentCell.trim());
            if (currentRow.length > 0 && currentRow.some(c => c)) {
              allRows.push(currentRow);
            }
            currentRow = [];
            currentCell = '';
          } else if (char === '\r' && !inQuotes) {
            // Mac-style line ending
            currentRow.push(currentCell.trim());
            if (currentRow.length > 0 && currentRow.some(c => c)) {
              allRows.push(currentRow);
            }
            currentRow = [];
            currentCell = '';
          } else {
            currentCell += char;
          }
        }
        
        // Push final cell/row
        if (currentCell || currentRow.length > 0) {
          currentRow.push(currentCell.trim());
          if (currentRow.some(c => c)) {
            allRows.push(currentRow);
          }
        }
        
        if (allRows.length < 2) {
          reject(new Error('File must have at least a header row and one data row'));
          return;
        }
        
        // First row is headers
        const headers = allRows[0];
        
        // Convert remaining rows to objects
        const rows: Record<string, string>[] = [];
        for (let i = 1; i < allRows.length; i++) {
          const values = allRows[i];
          const row: Record<string, string> = {};
          headers.forEach((header, idx) => {
            row[header] = values[idx] || '';
          });
          rows.push(row);
        }
        
        resolve({ headers, rows });
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}
```

## Wat Dit Oplost

| Issue | Oplossing |
|-------|-----------|
| Multi-line product titels | Newlines binnen quotes worden behouden als onderdeel van de cel |
| Lege rijen in preview | Alleen rijen met echte data worden toegevoegd |
| Missing Price/SKU | Kolommen blijven correct uitgelijnd |
| BOM karakters | Worden gestript aan het begin |
| Mac/Windows/Linux regeleindes | Alle formaten worden ondersteund |

## Na Implementatie

1. Upload je Shopify Products CSV opnieuw
2. In stap 3 (Field Mapping) worden alle velden correct getoond
3. In stap 4 (Preview) zie je de volledige productnamen in 1 rij
4. Geen "Price is required" of "Product name is required" fouten meer

