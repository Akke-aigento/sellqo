
# Fix: create-bol-vvb-label Retry Mode Silent Crash

## Probleem

De retry-modus crasht stil na het ophalen van de access token. De logs tonen:
```
INFO: Retry mode: fetching PDF and tracking for existing label e35d4320-...
... dan NIETS meer
```

De functie wordt ook twee keer tegelijk opgestart (race condition door dubbel-klik).

## Oorzaken

### 1. Geen try-catch rond PDF fetch in retry mode (regels 174-212)
De PDF download en upload code in de retry-sectie heeft geen eigen error handling. Als de fetch faalt (bijv. verkeerde Accept header, netwerk timeout, of Bol.com geeft een onverwacht antwoord), crasht de functie zonder enige logging.

### 2. Verkeerde Accept header voor Bol.com v10 PDF
De retry-code gebruikt `Accept: application/pdf` (regel 180), maar Bol.com v10 vereist `Accept: application/vnd.retailer.v10+pdf`. Dit kan een 406 Not Acceptable response geven die niet correct afgehandeld wordt.

De normale flow (regel 482) gebruikt dezelfde verkeerde header - die moet ook aangepast worden.

### 3. Geen 404 handling (label nog niet klaar)
Als Bol.com het label nog niet verwerkt heeft, geeft het een 404. De code behandelt dit niet apart.

### 4. Race condition (dubbele boot)
De logs tonen twee "booted" events. Er is geen bescherming tegen gelijktijdige uitvoering.

## Oplossing

### Bestand: `supabase/functions/create-bol-vvb-label/index.ts`

**Wijziging 1: Try-catch + logging in retry mode (regels 171-258)**
- Wrap de volledige PDF download + tracking sectie in try-catch
- Log elke stap: voor fetch, response status, na upload
- Bij crash: log de volledige error stack en return een 500 met details

**Wijziging 2: Correcte Accept header voor PDF**
- Retry mode (regel 180): wijzig `application/pdf` naar `application/vnd.retailer.v10+pdf`
- Normale flow (regel 482): zelfde fix

**Wijziging 3: 404 handling**
- Als PDF response status 404 is: return 202 met bericht "Label wordt nog verwerkt"

**Wijziging 4: Race condition guard**
- Bij start van de functie (zowel retry als normaal): check of er al een label met status "processing" bestaat
- Retry mode: check of het label niet al een label_url heeft (al opgehaald door andere instantie)

**Wijziging 5: Frontend error handling verbeteren**

### Bestand: `src/components/admin/BolActionsCard.tsx`

- Bij status 202: toon info toast "Label wordt nog verwerkt, probeer over 30 seconden opnieuw"
- Bij error: toon specifieke foutmelding uit response body
- Disable retry-knop gedurende 5 seconden na klik (debounce)

## Technisch detail

De kernwijziging in retry mode:

```text
// VOOR (regels 174-212 - crasht stil bij fout):
const pdfResponse = await fetch(...);
if (pdfResponse.ok) { ... }

// NA (met volledige error handling):
try {
  console.log('Fetching PDF from Bol.com, labelId:', retryLabelId);
  const pdfResponse = await fetch(
    `https://api.bol.com/retailer/shipping-labels/${retryLabelId}`,
    { headers: { Authorization: ..., Accept: 'application/vnd.retailer.v10+pdf' } }
  );
  console.log('PDF response status:', pdfResponse.status);
  
  if (pdfResponse.status === 404) {
    return Response(JSON.stringify({ 
      status: 'pending', 
      message: 'Label wordt nog verwerkt' 
    }), { status: 202, ... });
  }
  
  if (!pdfResponse.ok) {
    const errText = await pdfResponse.text();
    console.error('PDF fetch failed:', pdfResponse.status, errText);
    throw new Error(`PDF fetch failed: ${pdfResponse.status}`);
  }
  
  // ... rest van verwerking met logging per stap
} catch (error) {
  console.error('CRASH in retry PDF fetch:', error.message, error.stack);
  return Response(JSON.stringify({ error: 'Failed', details: error.message }), 
    { status: 500, ... });
}
```
