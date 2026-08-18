# I18N-MOTOR — vertalen als batchwerk, en nieuwe UI automatisch mee

## Je twee vragen eerst

**"Krijgt nieuwe UI dit in de toekomst automatisch?"** Ja, en dat is precies waarom het gereedschap in de repo hoort in plaats van per keer geïmproviseerd. Na deze batch geldt: je schrijft een component in het Nederlands, draait één commando, en de vier andere talen staan erin. Een lintregel weigert nieuwe hardcoded tekst, dus vergeten kan niet meer stil gebeuren.

**"Kunnen we makkelijk nieuwe talen toevoegen?"** Ja. Eén regel in `src/i18n/languages.ts`, één commando, en de volledige key-set (nu 2221, straks veel meer) wordt in blokken vertaald naar de nieuwe taal. Spaans, Italiaans, Pools of Portugees wordt dan minutenwerk in plaats van een project. De taal-switcher en browserdetectie leiden al af uit `SUPPORTED_LANGUAGES`, dus die werken meteen mee.

## Wat er gebouwd wordt

Drie scripts plus een vangnet. Alles idempotent: twee keer draaien verandert niks extra, al gemigreerde bestanden worden overgeslagen. Zo doen we geen dubbel werk met wat Claude Code al gedaan heeft.

**1. `npm run i18n:scan`** — meetlat. Per map en bestand: hoeveel hardcoded strings er nog staan (JSX-tekst, tekstprops, toasts). Nulmeting nu: 102 van 707 bestanden gemigreerd, ~3.666 kandidaat-strings. Elke batch laat een cijfer zakken, dus we zien voortgang in plaats van hem te vermoeden.

**2. `npm run i18n:extract -- <pad>`** — codemod. Herkent hardcoded UI-tekst, leidt een keypad af uit de bestandslocatie (`src/pages/admin/Quotes.tsx` → `admin.quotes.*`), zet `useTranslation` erin, vervangt de string door `t('…')` en schrijft de Nederlandse waarde in `nl.json`. Merknamen, routes, classNames en enum-waarden blijven met rust. Twijfelgevallen raakt het script niet aan maar zet het in een TODO-lijst — nooit gokken in code.

**3. `npm run i18n:translate`** — vertaalmotor. Zoekt keys die in `nl.json` staan maar in `en/fr/de/uk` missen, vertaalt ze in blokken van ~100 via de AI-gateway met een vaste glossary (btw → VAT/TVA/MwSt, bestelling, retour, factuur, machtiging, verzendmethode) en schrijft ze op exact hetzelfde keypad terug. Interpolatie (`{{count}}`) en HTML blijven intact; dat wordt na elke run gecontroleerd. Met `--lang es` doet hetzelfde script een volledig nieuwe taal.

**4. Vangnet — nieuwe schuld wordt geweigerd**
- `eslint-plugin-i18next` met `no-literal-string` in waarschuwmodus met baseline: bestaande schuld breekt de build niet, nieuwe schuld valt direct op.
- `scripts/i18n-parity.mjs` uitgebreid: naast ontbrekende keys nu ook keys melden waarvan de waarde in en/fr/de/uk identiek is aan het Nederlands — een niet-vertaalde kopie die vandaag stil doorglipt.
- `npm run i18n:check` bundelt pariteit + kopieerdetectie + interpolatiecheck.

## Tempo en kwaliteit

Per batch: `scan` → `extract` → diff kort nalopen → `translate` → `check` → steekproef in de preview. Ik zet meerdere mappen parallel in subagenten, dus een hele map van 40+ componenten per bericht in plaats van één pagina per dag.

Kwaliteit: jij reviewt enkel het Nederlands, ik lever de vier talen glossary-consistent af — het snelste pad, jouw keuze. De scripts vangen wat een mens toch zou missen: ontbrekende keys, NL-kopieën, gebroken interpolatie.

Volgorde, klantgezicht eerst omdat de impact daar het grootst is: `src/components/storefront` + `src/pages/storefront` (2 van 46) → `src/pages/admin` (8 van 72) → `src/components/admin` per submap (50 van 413).

## Randvoorwaarden

- Alleen `src/`. `supabase/functions/**` (mailteksten, PDF's) en de vijf custom frontends blijven buiten scope — die hebben hun eigen i18n.
- `landing.{code}.json` wordt niet door de codemod aangeraakt; de changelog daarin blijft handwerk.
- Strikt additief: bestaande keys worden nooit hernoemd of verwijderd. `common.*` wordt hergebruikt om dubbelen te vermijden.
- Geen script hardcodeert een talenlijst; alles leidt af uit `SUPPORTED_LANGUAGES`.
- Verificatie per batch: `i18n:check` groen en `tsgo --noEmit` exit 0.

## Deze batch levert

De drie scripts, de lintregel, de uitgebreide pariteitscheck, en als bewijs één map volledig vertaald (`src/components/storefront`) met het scan-cijfer vóór en na. Plus een korte notitie in `docs/` zodat Claude Code exact dezelfde keten gebruikt en we nooit twee keer dezelfde map doen.