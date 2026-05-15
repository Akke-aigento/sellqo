## Plan

Drie open SEO-bevindingen afsluiten in één pass.

### 1. Google Search Console koppelen + verifiëren

De connector bestaat in de workspace maar is nog niet aan dit project gekoppeld. Ik link hem, vraag dan een META-verificatietoken op, plaats die in `index.html`, en verifieer + voeg de site toe aan GSC.

Stappen:
1. `standard_connectors--connect` met `google_search_console` → jij bevestigt het koppelen aan dit project.
2. Token aanvragen voor `https://sellqo.app/` (META-methode).
3. `<meta name="google-site-verification" content="..." />` toevoegen aan `index.html`.
4. **Jij republished** zodat de tag live staat op `sellqo.app`.
5. Ik roep de verify endpoint aan en voeg de site toe aan jouw GSC property-lijst.
6. Sitemap insturen: `https://sellqo.app/sitemap.xml`.

> Stap 4 is een handmatige tussenstap. Zonder republish kan Google de meta-tag niet vinden en faalt verify.

### 2. Lighthouse performance — `font-display: swap`

In `index.html` de Google Fonts `<link>` aanpassen zodat de URL `&display=swap` bevat. Dat zorgt dat tekst direct met een systeemfont rendert terwijl Inter/Poppins inladen → snellere LCP.

Optioneel ook `fetchpriority="high"` op de hero-afbeelding van de landing (als die er is). Ik check `HeroSection.tsx` en pas alleen aan als er een echte `<img>` hero is.

### 3. Lighthouse accessibility — contrast

Ik scan de landing-componenten op lage-contrast utility-classes:
- `text-muted-foreground/50`, `/40`, `/60` op licht
- `text-gray-300|400` op witte achtergronden
- placeholder-stijlen met te lichte tinten

Gevonden gevallen vervang ik door design-tokens (`text-muted-foreground` zonder opacity, of `text-foreground`). Geen design-overhaul, alleen contrast-fixes.

### Tech details

- `index.html`: meta-tag voor GSC + `&display=swap` in Fonts URL.
- Geen wijzigingen aan `src/integrations/lovable/*` (auto-managed).
- Connector calls verlopen via `connector-gateway.lovable.dev/google_search_console/...` met `LOVABLE_API_KEY` + `GOOGLE_SEARCH_CONSOLE_API_KEY` (beschikbaar zodra gekoppeld).
- Na alle wijzigingen markeer ik de drie findings als fixed.

### Wat jij moet doen

1. De connectie-koppeling bevestigen wanneer de prompt verschijnt.
2. **Republishen** nadat ik de meta-tag heb geplaatst, zodat Google verify slaagt.
