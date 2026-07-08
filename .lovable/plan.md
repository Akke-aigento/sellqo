# Fix: "Machtigingslink aanmaken" + viewport-overflow op Abonnementen

## Diagnose

**1. Machtigingslink 404 (CORS + net::ERR_FAILED)**
De rode toast en de console-errors uit de screenshot komen niet van CORS zelf — ze zijn het gevolg van een **404** op de edge function. Ik heb het direct getest:

```
POST /create-mandate-setup → 404 NOT_FOUND "Requested function was not found"
```

De code, `config.toml` (`verify_jwt = false`) en de DB-tabellen (`customer_payment_mandates`, `mandate_setup_tokens`) staan er allemaal, maar de function is nooit gedeployed. Er staan ook nul logs voor `create-mandate-setup`. De browser ziet dan een preflight zonder CORS-headers → "blocked by CORS policy / ERR_FAILED", terwijl de echte oorzaak is dat de function niet bestaat op de server.

Waarschijnlijke trigger: bij de vorige batch is `config.toml` uitgebreid met drie nieuwe function-blocks (`create-mandate-setup`, `mandate-setup-info`, `mandate-setup-complete`) in één keer, waardoor het deploy-signaal is gemist. Een kleine no-op wijziging in elk van de drie `index.ts`-bestanden forceert een re-deploy.

**2. Acties/gegevens buiten viewport**
De abonnementen-tabel toont bij ≥768px (md-breakpoint) álle 8 kolommen inclusief "Machtiging" en de actie-kolom. Op de laptop-viewport van ±870px past dat niet meer horizontaal, waardoor:

- Het "…"-actiemenu rechts (Bewerken / Nu factureren / **Machtigingslink aanmaken** / Pauzeren) deels buiten de viewport valt.
- De toast rechtsonder overlapt met de rij die de actie triggerde.

De tabel-wrapper heeft geen horizontale scroll en de "Machtiging"-kolom komt te vroeg tevoorschijn.

## Fixes

### A. Edge function opnieuw laten deployen
Trigger een re-deploy door in elk van deze drie files een marker-comment bovenaan te zetten (geen gedragswijziging):

- `supabase/functions/create-mandate-setup/index.ts`
- `supabase/functions/mandate-setup-info/index.ts`
- `supabase/functions/mandate-setup-complete/index.ts`

Verifiëren met een directe `curl` naar `/create-mandate-setup` — verwacht: 401/400 met CORS-headers, geen 404 meer. Daarna vanuit de UI opnieuw "Machtigingslink aanmaken" testen op de actieve Weekly-subscription.

### B. Subscriptions-tabel responsive maken
In `src/pages/admin/Subscriptions.tsx`:

1. Tabel in een `overflow-x-auto`-wrapper zetten zodat brede content scrollt in plaats van weggeknipt te worden.
2. Breakpoint voor de "Machtiging"-kolom verhogen van `md:` (≥768px) naar `lg:` (≥1024px), zodat de kolom pas verschijnt als er echt ruimte is. De status-badge dekt de essentiële info af tot dan.
3. De DropdownMenuContent voor de rij-acties krijgt `align="end"` én `side="bottom"` met `collisionPadding` zodat het menu nooit rechts/onder het viewport uitvalt (shadcn ondersteunt dit out of the box; het menu is nu waarschijnlijk niet ge-aligned).
4. Optioneel: klant-/naam-cells van `max-w-[150px]` naar responsive (`max-w-[120px] sm:max-w-[180px]`) zodat de eerste twee kolommen niet onnodig ruimte opeisen op smallere schermen.

Deze wijzigingen raken alleen de presentatielaag; geen business logic, geen data-flow.

## Verificatie

- `curl` op de function → geen 404 meer.
- In de UI op ~870px breedte: het "…"-menu blijft volledig binnen de viewport, "Machtigingslink aanmaken" opent een succes-toast met gekopieerde URL, en de tabel scrollt horizontaal in plaats van kolommen te clippen.
- Op ≥1024px verschijnt de Machtiging-kolom weer.

## Buiten scope
- De bredere "veel acties/gegevens buiten viewport" opmerking — ik pak nu alleen deze pagina aan. Als je een lijst wilt van álle admin-pagina's die dezelfde tabel-overflow hebben (Facturen, Bestellingen, Klanten, …), doe ik dat in een aparte sweep-batch.
