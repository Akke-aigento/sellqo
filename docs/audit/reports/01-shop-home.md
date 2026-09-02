# Audit: /shop/:tenantSlug — Winkelhomepage
Pinned SHA: `03781985` · Datum: 2026-09-02 · Assen: A–G · Laag 1 (statisch)
Bestand: `src/pages/storefront/ShopHome.tsx (60 r.)`
Gedeelde bevindingen: `01-storefront-gedeeld.md` (S-1 t/m S-6) — gelden ook hier.

## Verdict-samenvatting
🔴 0 · 🟡 2 · 🟢 3

## Bevindingen

### 🟡 G1 — De enige knop op de standaard-homepage herlaadt de hele applicatie
- **Wat:** heeft een tenant nog geen homepage-secties ingericht, dan toont de winkel een standaardpagina met één knop, "Bekijk Producten". Die is gebouwd als een gewone `<a href>` en niet als router-`<Link>`.
- **Waar:** `src/pages/storefront/ShopHome.tsx:48-53` — `<a href={`/shop/${tenantSlug}/products`} …>`.
- **Root cause:** een `<a>` binnen een SPA veroorzaakt een volledige paginanavigatie: de React-app wordt afgebroken en opnieuw opgestart, inclusief het herophalen van de hoofdbundel (9,16 MB / 2,51 MB gzip, gemeten in run 0). Winkelwagen- en verlanglijst-context worden opnieuw opgebouwd.
- **Gevolg:** merkbare vertraging precies bij de nieuwste tenants — wie nog geen secties heeft ingericht, is per definitie net begonnen. Alle andere navigatie in de winkel gebruikt wél `<Link>`.
- **Fixrichting:** vervangen door `<Link to={...}>`. **Platform:** CC. **Frozen-path-risico:** nee.

### 🟡 E1 — De standaard-homepage heeft geen meta-beschrijving en is hardcoded Nederlands
`:29-31` zet alleen een `<title>`; er is geen `<meta name="description">`, terwijl `ShopPage` die wel meegeeft (`ShopPage.tsx:45`). Voor de belangrijkste vindbare pagina van een winkel is dat een SEO-gat. De teksten "Welkom bij", "Ontdek onze producten" en "Bekijk Producten" (`:42-52`) staan hardcoded in het Nederlands — zie S-3.
**Natrek:** hoeveel winkels draaien feitelijk op deze standaardpagina?
```sql
SELECT t.slug, t.name, count(hs.id) AS secties
FROM public.tenants t
LEFT JOIN public.homepage_sections hs ON hs.tenant_id = t.id AND hs.is_visible = true
WHERE t.use_custom_frontend = false
GROUP BY t.slug, t.name HAVING count(hs.id) = 0;
```

## 🟢 Geverifieerd correct
1. **Onbekende sectietypes worden overgeslagen, niet gecrasht.** `:15-16` haalt de renderer uit de registry en geeft `null` terug als die ontbreekt — een nieuw of verwijderd sectietype maakt de homepage niet stuk.
2. **Er is een echte terugval.** `:32-55` toont een bruikbare standaardpagina in plaats van een lege `<div>` wanneer er geen secties zijn.
3. **De pagina doet geen eigen queries.** Alles loopt via `usePublicStorefront`; geen embed-, limiet- of `.maybeSingle()`-risico op dit bestand.
