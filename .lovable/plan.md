

## Probleem

De bulk vertaling faalt met **402 (Onvoldoende credits)**. De berekening: 45 producten x 5 velden x 3 talen = **675 credits nodig**, maar er zijn slechts **368 credits beschikbaar** (210 + 200 - 42).

Daarnaast zijn er twee bijkomende problemen in de edge function:
1. De AI kan JSON teruggeven gewrapt in markdown (```json...```), waardoor `JSON.parse` faalt — maar dit wordt stil opgeslikt door de `catch`.
2. Er is geen duidelijke foutmelding naar de gebruiker over *hoeveel* credits nodig zijn vs. beschikbaar.

## Oplossing

### 1. Betere foutafhandeling bij onvoldoende credits
In `ai-translate-content/index.ts`:
- Bereken credits nodig en stuur dit mee in de 402-response: `{ error: "Onvoldoende credits", creditsNeeded, creditsAvailable }`
- Voeg een aparte query toe om beschikbare credits op te halen voor de foutmelding

### 2. Fix JSON parsing van AI response
In de edge function, strip markdown code fences voor `JSON.parse`:
```typescript
let content = aiResult.choices[0].message.content;
content = content.replace(/^```(?:json)?\n?/,'').replace(/\n?```$/,'');
const translatedContent = JSON.parse(content);
```

### 3. Betere UX in TranslationHub.tsx  
- Toon in de foutmelding hoeveel credits nodig zijn en hoeveel beschikbaar
- Voeg een link toe naar credits kopen

### 4. Frontend: toon credit-info voor bulk start
In `TranslationHub.tsx`, toon in de bulk-dialog een schatting van benodigde credits zodat de gebruiker weet wat het kost voor ze starten.

### Bestanden
- `supabase/functions/ai-translate-content/index.ts` — betere error response + JSON parse fix
- `src/hooks/useTranslations.ts` — parse credit info uit error response
- `src/pages/admin/TranslationHub.tsx` — toon credit schatting in bulk dialog + betere foutmeldingen

