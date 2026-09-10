---
name: sellqo-release-werkwijze
description: Release-werkwijze voor het sellqo-project. Toepassen bij elke
  afgeronde feature, batch of fix — bepaalt de sporen (role-audit, publieke
  changelog, newsletter-wachtrij, blog-concept, doc_articles), formats,
  versienummering en de i18n-pariteitsplicht. Ook toepassen bij het schrijven van
  changelog-entries, role-audit-entries of blogartikelen.
---

# SellQo Release-Werkwijze — sporen per afgeronde batch

**Scope: enkel het project `sellqo`. Bij andere projecten in deze workspace:
negeer deze skill, tenzij expliciet gevraagd.**

Elke afgeronde feature/batch/fix levert sporen op, in deze volgorde.
Spoor 1 altijd; spoor 2, 3 en 4 alleen bij tenant-merkbare wijzigingen.
Spoor 5 (doc_articles) is een aparte verplichte slottaak — zie de skill
`sellqo-docs-slottaak` — en geldt bij elke UI-zichtbare feature-wijziging.

## Beslisboom
1. Batch af én geverifieerd (post-flight)? Zo nee: geen sporen.
2. Schrijf spoor 1 (altijd, inclusief sectie Security-keuzes).
3. Merkt een tenant er iets van (UI, e-mail, factuur, gedrag)?
   - Nee (refactor, interne fix, migratie): stop na spoor 1.
   - Ja: spoor 2 (versienummer + i18n-pariteit), spoor 3 (newsletter-wachtrij),
     spoor 4 (blog-concept) én spoor 5 (doc_articles, zie aparte skill).

## Talen: de talenlijst is de bron, nooit een vast aantal
Overal waar deze skill "alle talen" zegt, betekent dat: **alle codes in
`SUPPORTED_LANGUAGES` (`src/i18n/languages.ts`), geverifieerd tegen die bron.**
Hardcode nooit een aantal ("4 talen", "5 talen") of een vaste lijst
(`nl/en/fr/de/uk`) in content of in deze skill — het talenaanbod groeit
(binnenkort o.a. es/it/pt). `scripts/i18n-parity.mjs` leest de talen uit de
bestanden zelf en is de scheidsrechter: groen = volledige pariteit, rood = een
taal mist een key. Die check draait in CI (`.github/workflows/ci.yml`) en
blokkeert de PR bij een gat. Tel de talen dus na tegen de bron; ga nooit uit van
een getal in dit document.

## Spoor 1 — Role-audit entry (altijd)
Bestand: `docs/role-audit.md`. Taal: casual Vlaams-Nederlands.
Structuur: root-cause-first.

```markdown
## <Batchnaam/titel> — <d maand jjjj>
**Root cause:** <waarom bestond het probleem — altijd eerst; bij nieuwe
features: welk gat vult dit>
**Uitgevoerd:** <concreet: bestanden, migraties, functies, guards>
**Security-keuzes:** <verplicht bij tabellen/functies/routes/policies:
rollen per cmd, motivatie anon-toegang, definer-functies + search_path,
service-role-paden. Niets relevants: expliciet "n.v.t.">
**Gedeelde-paden-waarschuwing:** <indien een gedeeld pad geraakt is:
waarom veilig voor alle tenants — zie skill sellqo-gedeelde-paden>
**Vangst uit recon:** <optioneel>
**Backlog-notitie:** <optioneel>
**Vervolg:** <optioneel: open acties met datum/voorwaarde>
```

Regels: idempotentie en guards expliciet benoemen; kolomnamen zoals
geverifieerd tegen `types.ts`; geen verzonnen details. Bij
security-incidenten horen de volledige technische details HIER — nooit in
spoor 2, 3 of 4.

## Spoor 2 — Publieke changelog (alleen tenant-merkbaar)
Bestand: `src/pages/public/PublicChangelog.tsx`. Klantentaal, geen
technische termen (niet "sync_status", wel "duidelijke status per
factuur"). Alles moet live en waar zijn.

**Types (exact vier):** `feature` | `improvement` | `fix` | `security`.
Security-entries ALTIJD generiek ("toegangscontrole op integraties
aangescherpt"), NOOIT exploiteerbare details: geen tabelnamen, geen
kwetsbaarheids-tijdlijn.

**Versienummering:** `JJJJ.MMx` — letter loopt op per release, telt door op de
laatste entry in de array (`2026.10n` → `2026.10o`). Nieuwe entries bovenaan
`changelogEntries` (nieuwste-eerst), nieuwe change-ids achteraan het
`changes`-object.

**i18n-pariteitsplicht:** elke entry krijgt keys in ALLE ondersteunde talen
(zie de talensectie hierboven). Twee plekken, altijd samen: de entry in
`PublicChangelog.tsx` én `public.changelog.changes.<id>` (`{ title, description }`)
in elk `src/i18n/locales/landing.{code}.json`. Eén ontbrekende taal = een
onafgewerkte entry die de changelog voor die bezoekers breekt en de CI-parity
rood maakt. Tel de bestanden na tegen `SUPPORTED_LANGUAGES`, niet tegen een
onthouden getal.

**Verificatieplicht:** vóór het schrijven altijd de actuele structuur van
`PublicChangelog.tsx` en de i18n-bestanden lezen — key-namespace, taalcodes en
veldnamen komen uit de code, niet uit dit document of het geheugen. Bij mismatch
wint de code.

**Aanspreekvorm:** tweede persoon; leg uit wat het voor de tenant betekent;
vermijd onverifieerbare marketingtaal (Belgische regels rond misleidende
handelspraktijken). De aanspreekvorm verschilt per taal en is niet uniform in de
bestaande set — sluit aan bij de entries in hetzelfde onderwerp.

**Slottaak-regel:** elke implementatieprompt voor tenant-merkbaar werk eindigt
standaard met: "Voeg de changelog-entry toe aan PublicChangelog.tsx volgens het
bestaande formaat, type <feature|improvement|fix|security>, met i18n-keys in
alle ondersteunde talen (parity-check groen)."

## Spoor 3 — Newsletter-wachtrij (alleen tenant-merkbaar)
Bestand: `docs/newsletter-queue.md` (of de chat/paper trail tot UPDATES-1 een
tabel heeft). Sinds de blog live is, is de nieuwsbrief een TEASER-kanaal: korte
tekst + "lees meer"-link naar het bijhorende blogartikel (spoor 4), niet meer
het volledige verhaal.

Format per item:

```
**<Kop = klantvoordeel, max 8 woorden>** (<maand jjjj>)
<1-2 zinnen teaser.>
Wat betekent dit voor jou? <1 zin antwoord.>
Lees meer → /blog/<slug>
[Beschikbaar vanaf <plan>]   ← alleen indien plan-gebonden
```

Security-fixes NIET in de nieuwsbrief, tenzij de tenant er actief iets van merkt
(bv. verplichte heraanmelding) — en dan even generiek als in spoor 2. Bundel op
2-4 items; verzenden nooit zonder bevestiging van Akke. Publiek = klant-rijen in
de SellQo-tenant met tag `sellqo-tenant` (gededupliceerd op e-mail).

## Spoor 4 — Blog-concept (alleen tenant-merkbaar)
Tabel: `blog_posts` (platform-scoped). Bij elke tenant-merkbare feature schrijft
Claude PROACTIEF een uitgebreid, redactioneel blogartikel en zet het als CONCEPT
(`status='draft'`) in `blog_posts`. Daarna één korte melding aan Akke: **"btw —
blogartikel staat klaar, akkoord?"** Claude moet hier NIET aan herinnerd worden;
het is een automatische slottaak.

Semi-auto: Claude schrijft en stelt voor, Akke keurt goed → published.
Publicatie (status → 'published') ENKEL na expliciete go van Akke.

Regels voor een blogartikel:
- **Altijd in alle ondersteunde talen** (zie de talensectie bovenaan). Claude
  vertaalt; Akke reviewt enkel NL. Go op NL = go op alle talen. De publieke blog
  toont de content in de actieve websitetaal met NL-fallback
  (`translations[lang]?.field ?? nl`). Verifieer volledige pariteit vóór
  publicatie — geen taal overslaan.
- **Uitgebreid en redactioneel**, geen changelog-regel: context, wat het doet,
  hoe je het gebruikt/instelt (met menu-paden), wat het je oplevert. Richtlengte
  400-800 woorden. Ruimte laten voor beeld (cover + inline screenshots uit de
  publieke bucket `marketing-assets`, map `blog/<slug>/`; nooit een signed URL
  opslaan, enkel het publieke pad).
- **Rijke HTML** in `content`: `h2`/`h3`, `p`, `ul`/`ol`, `blockquote`, `<img>`.
  Wordt bij render gesaneerd met DOMPurify — geen `<script>`.
- **Velden**: stabiele kebab-case `slug` (nooit hergebruiken), `title`,
  `excerpt` (1 zin), `category` (een van: `product-updates`, `boekhouding`,
  `tips`, `bedrijfsnieuws`), `meta_title`, `meta_description` (SEO),
  `cover_image_url`. `reading_minutes` wordt bij publiceren automatisch berekend
  als het leeg is.
- **Plan-gebondenheid** altijd vermelden (Free/Starter/Pro/Enterprise) — zelfde
  eerlijkheidsregel als hieronder.
- **Idempotent inschieten**: `ON CONFLICT (slug) DO UPDATE` zodat een herwerkt
  concept dezelfde rij hergebruikt.

De nieuwsbrief-teaser (spoor 3) linkt naar het GEPUBLICEERDE artikel. Volgorde
bij een release-bundel: eerst artikelen schrijven + laten goedkeuren +
publiceren, dan pas de teaser-nieuwsbrief versturen.

## Spoor 5 — doc_articles (aparte verplichte slottaak)
De in-app hulpchatbot antwoordt uitsluitend op basis van `doc_articles`. Bij elke
UI-zichtbare feature-wijziging: artikel aanmaken/bijwerken volgens de skill
`sellqo-docs-slottaak` (doc_level-keuze tenant vs platform, context_path,
schrijfstijl). Puur technische wijziging zonder UI-impact: expliciet "DOCS-1:
n.v.t." melden. Let op: `doc_articles` heeft één `content`-veld (geen
taalvarianten) — alleen changelog en blog zijn meertalig.

## Eerlijkheidsregel (spoor 2, 3 en 4)
Geen claims over wat niet live is, geen verzonnen cijfers, geen "coming soon" als
bestaand, plan-gebondenheid altijd vermelden. Bij twijfel: verifieer in de code
vóór publicatie. Security-entries: waar, maar nooit exploiteerbaar. Een
aankondiging van iets dat nog niet live is (bv. een app die nog niet in de store
staat) mag, maar ALTIJD expliciet als aankomend geframed, nooit als beschikbaar.

