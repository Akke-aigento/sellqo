# Onderzoek: publieke legal-pagina's tonen "Pagina niet gevonden"

## 1. Routes in `src/App.tsx` (regels 338-343)

```tsx
<Route path="/terms" element={<SellqoLegal />} />
<Route path="/privacy" element={<SellqoLegal />} />
<Route path="/cookies" element={<SellqoLegal />} />
<Route path="/sla" element={<SellqoLegal />} />
<Route path="/acceptable-use" element={<SellqoLegal />} />
<Route path="/dpa" element={<SellqoLegal />} />
```

Geen enkele route bevat een `:slug`-parameter.

## 2. `src/pages/SellqoLegal.tsx`

```tsx
const { slug } = useParams<{ slug: string }>();
const { page, isLoading, error } = usePublicLegalPage(slug || '');
```

De hook (`src/hooks/useSellqoLegal.ts`, regel 138-155) doet:
`.eq('slug', slug).eq('is_published', true).single()` met `enabled: !!slug`.

Verwachte waarde: de slug-string zoals opgeslagen in `public.sellqo_legal_pages`.

## 3. Conclusie: bevestigde bug — alle 6 pagina's zijn stuk

Omdat de routes geen `:slug` definiëren, is `useParams().slug` altijd `undefined`. De query wordt dus nooit uitgevoerd (`enabled: false`), `page` blijft `undefined` en `isLoading` is `false` → de component valt direct in de `!page`-branch en toont "Pagina niet gevonden".

Read-only browsertest tegen de live preview (alle 6 paden):

```text
/terms          -> Pagina niet gevonden
/privacy        -> Pagina niet gevonden
/cookies        -> Pagina niet gevonden
/sla            -> Pagina niet gevonden
/acceptable-use -> Pagina niet gevonden
/dpa            -> Pagina niet gevonden
```

De data is niet het probleem: alle 6 records bestaan en zijn gepubliceerd, met slugs die exact overeenkomen met de paden:

| slug | title | versie | gepubliceerd |
|---|---|---|---|
| acceptable-use | Acceptable Use Policy | 1 | ja |
| cookies | Cookie Policy | 2 | ja |
| dpa | Data Processing Agreement | 1 | ja |
| privacy | Privacy Policy | 2 | ja |
| sla | Service Level Agreement | 1 | ja |
| terms | Terms of Service | 2 | ja |

## 4. Minimale fix (nog niet uitgevoerd)

Voorkeur — slug uit het pad afleiden in `SellqoLegal.tsx`, één regel, routes onaangeroepen:

```tsx
import { useLocation, useParams } from "react-router-dom";
...
const { slug: paramSlug } = useParams<{ slug: string }>();
const { pathname } = useLocation();
const slug = paramSlug ?? pathname.replace(/^\/+|\/+$/g, "");
```

Omdat de slugs in de database exact gelijk zijn aan de paden werkt dit voor alle 6 routes, en blijft het compatibel als er later wél een `:slug`-route bijkomt.

Alternatief (meer wijzigingen): per route een expliciete prop meegeven, bijv. `element={<SellqoLegal slug="dpa" />}`, en `useParams` in het component vervangen door die prop.

Aanbeveling: de eerste variant — één bestand, één afgeleide waarde, geen routewijzigingen.

## Status
Alleen onderzocht en gerapporteerd. Geen code, routes of database gewijzigd.
