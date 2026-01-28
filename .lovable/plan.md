
Doel
- Onboarding wizard moet op alle stappen (Welkom t/m Betalingen) altijd kunnen scrollen wanneer de content hoger is dan het scherm.

Wat er nu misgaat (waarschijnlijk)
- De wizard gebruikt een Radix `ScrollArea` in een flex-layout waarbij de hoogte niet “hard” wordt vastgezet (Card heeft alleen `max-h-[90vh]`).
- In zo’n situatie kan de `ScrollArea` eindigen met een “auto”-hoogte die groter wordt dan bedoeld, waardoor Radix geen echte overflow/scrollbar activeert en de content simpelweg wordt afgeknipt door `overflow-hidden` op de Card.
- De eerdere fix met `max-h-[calc(...)]` is kwetsbaar (magic number) en lost dit niet stabiel op voor alle viewports/stappen.

Oplossing (robust, zonder magic numbers)
- De wizard-card krijgt een expliciete hoogte (90vh) zodat er altijd een duidelijke “box” is waarbinnen de content moet passen.
- De card-layout wordt omgezet naar CSS Grid met 3 rijen:
  1) Header (auto)
  2) Progress (auto)
  3) Content (1fr)
- De `ScrollArea` komt in rij 3 en krijgt `min-h-0` (cruciaal in grid/flex om overflow toe te laten), zodat Radix altijd de juiste viewport-hoogte heeft en scrolling gegarandeerd werkt.
- Extra fallback: de overlay krijgt `overflow-y-auto` zodat, als het scherm extreem klein is, je alsnog kunt scrollen.

Concrete wijzigingen (frontend)
1) Bestand: `src/components/onboarding/OnboardingWizard.tsx`
   - Overlay wrapper:
     - Voeg `overflow-y-auto` toe (en eventueel `py-4`) zodat de volledige overlay kan scrollen op kleine schermen.
   - Card container:
     - Wijzig className van:
       - `max-h-[90vh] flex flex-col ... overflow-hidden`
     - Naar bijvoorbeeld:
       - `h-[90vh] max-h-[90vh] grid grid-rows-[auto,auto,1fr] ... overflow-hidden`
   - Progress blok:
     - Kan conditioneel blijven; als het niet gerenderd wordt (stap 7), wordt rij 2 automatisch “0 hoog” (geen probleem).
   - ScrollArea:
     - Vervang de huidige `ScrollArea` className:
       - van: `flex-1 min-h-0 max-h-[calc(90vh-180px)]`
       - naar: `min-h-0 h-full` (en géén calc).
     - (Optioneel) `type="auto"` expliciet zetten, maar meestal niet nodig.

Waarom dit werkt
- `h-[90vh]` op de Card maakt de beschikbare hoogte deterministisch.
- `grid-rows-[auto,auto,1fr]` garandeert dat de content-zone exact de resterende hoogte krijgt.
- `min-h-0` op de scroll container zorgt dat het element daadwerkelijk mág krimpen (anders blijft overflow vaak “vastzitten” en werkt scroll niet).
- Geen vaste “180px” offsets meer, dus het blijft correct als header/progress padding wijzigt.

Testplan (end-to-end)
- Desktop (zoals je screenshot):
  - Open onboarding → stap 2 planselectie → scroll met muiswiel/trackpad: je moet de volledige kaarten (incl. knoppen onderaan) kunnen bereiken.
  - Stap 3 bedrijfsgegevens → scroll tot de knoppen; inputs blijven bereikbaar.
  - Stap 5 product → scroll tot image/velden/knoppen.
- Kleinere viewport (responsive):
  - Zet browserhoogte kleiner → check dat je nog steeds overal kunt scrollen (ofwel binnen de content-zone, of via overlay fallback).
- Controle:
  - Header + progress blijven “vast” (niet meegescrolled), alleen de stapcontent scrolt.

Risico’s / aandachtspunten
- Als een stap zelf een eigen scroll container heeft (zeldzaam), kan “nested scroll” vreemd aanvoelen. Voor nu zie ik in de steps geen extra scroll-wrappers, dus dit is veilig.
- Als je stap 7 (Launch) juist volledig “zonder scroll” wil, blijft dit ook goed: content is meestal kort en de ScrollArea zal dan gewoon geen scrollbar tonen.

Wat ik na jouw goedkeuring ga doen
- Alleen `OnboardingWizard.tsx` aanpassen volgens bovenstaande (grid layout + harde hoogte + min-h-0 + overlay overflow fallback).
- Daarna end-to-end scrollen controleren op stap 2/3/5.
