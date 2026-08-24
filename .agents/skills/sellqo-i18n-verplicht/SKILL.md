---
name: sellqo-i18n-verplicht
description: Verplichte werkwijze voor alle user-facing tekst in de SellQo core (admin UI + SellQo-based storefront). Elke nieuwe of gewijzigde UI-string MOET door i18n (react-i18next t()) gaan met een key in ELKE ondersteunde taal — nooit hardcoded tekst in JSX. Bevat de codemod-motor voor batchwerk, het recept om een nieuwe taal toe te voegen, en de patronen die de codemods niet aankunnen. Geldt NIET voor de custom tenant-frontends (VanXcel/Mancini/Loveke/Astra/Zona), die hebben hun eigen i18n.
---

# SellQo i18n — Verplichte Werkwijze

Alle zichtbare tekst in de SellQo core (Lovable project 9932a7fe-43a1-42de-9c64-168968599600) gaat via i18n. Geen uitzonderingen voor "tijdelijk", "intern" of "admin-only". Als een gebruiker het kan lezen, is het een vertaalde key — in ALLE ondersteunde talen.

Deze regel bestaat omdat de codebase historisch is dichtgeslibd met hardcoded Nederlandse strings. Meet de stand altijd zelf met `node scripts/i18n-scan.mjs` in plaats van een getal uit dit document over te nemen; percentages in skills verouderen sneller dan de code.

**Scope:** admin UI + SellQo-based storefront. NIET de custom tenant-frontends — die hebben een eigen i18n-setup en vallen buiten deze skill.

## Bron van waarheid: de talenlijst

Er is één plek waar de ondersteunde talen staan: `src/i18n/languages.ts`, geëxporteerd als `SUPPORTED_LANGUAGES`. Elke andere plek in de code (allowlists, `z.enum`, taal-switchers, browser-detectie) leidt zijn talen HIERVAN af — nooit een eigen hardcoded lijst zoals `['nl','en','de','fr']`.

Kom je zo'n lijst tegen: dat is een bug. Vervang door afleiding uit `LANG_CODES`. Voor Zod: `z.enum(LANG_CODES as [LangCode, ...LangCode[]])`.

## De setup (feiten over deze repo)

- Library: react-i18next + i18next. Init in `src/i18n/index.ts`.
- `fallbackLng: 'nl'` (= `DEFAULT_LANG`).
- Eén namespace (`translation`). Per taal worden twee bestanden samengevoegd: `src/i18n/locales/{code}.json` (app-UI) en `src/i18n/locales/landing.{code}.json` (publieke landing). Bij init: `{ ...appJson, ...landingJson }`.
- Key-conventie: dot-notation, `t('sectie.key')`. Volg de bestaande key-stijl van de sectie waarin je schrijft; verzin geen nieuwe stijl.

### Waarom hardcoded tekst extra kwaad kan hier
Omdat `fallbackLng: 'nl'`: een ontbrekende key valt terug op het Nederlands, niet op Engels. Een half-vertaald scherm toont dus stille Nederlandse brokken aan elke niet-NL gebruiker. Een ontbrekende key is geen nette fallback — het is een zichtbare bug.

## De ijzeren regel

Geen enkele letterlijke, menselijk-leesbare string in JSX-output of in UI-tekstprops.

NIET hardcoden:
- JSX-tekstnodes: `<Button>Opslaan</Button>` → `<Button>{t('common.save')}</Button>`
- Tekstprops: `placeholder`, `title`, `label`, `aria-label`, `description`, `alt`, `tooltip`
- Toasts / sonner / `toast()`-berichten
- Validatie- en foutmeldingen die de gebruiker ziet — óók zod-meldingen, zie hieronder
- `<option>`-labels, tab-titels, dialog-titels, lege-staat-teksten
- Bevestigingsteksten ("Weet je het zeker?")
- Labels in object-literals en const-arrays (`{ label: 'Bekijken' }`) — zie het key-in-de-array-patroon
- Ternary-takken (`{actief ? 'Actief' : 'Inactief'}`)
- Datumformaat-strings met een Nederlands voegwoord erin (`"d MMMM yyyy 'om' HH:mm"`)

WEL letterlijk (geen UI-tekst):
- Code-identifiers, enum-waarden, API-parameters, routes, `className`, testids
- Merknamen ("Stripe", "Bol.com", "SellQo") en internationale vaktermen (SKU, EAN, ACoS, Slug, Sitemap.xml, Core Web Vitals)
- Taal-endoniemen in een taalkiezer — "Français" blijft Français, ook in een Duitse UI
- AI-prompts: dat zijn instructies aan een model, geen UI-tekst
- Tekst in uitgaande e-mail die de KLANT leest — die volgt de taal van de klant, niet van de ingelogde medewerker
- **Bedragen.** `Intl.NumberFormat('nl-NL')` blijft staan; geef hier NIET `i18n.language` mee. Zie hieronder.

## De motor: batchwerk met codemods

Voor meer dan een handvol strings ga je niet handmatig. `scripts/` bevat een keten die dit werk doet. **Draai ze in deze volgorde**, want elke pass bouwt voort op de keys van de vorige:

```
node scripts/i18n-scan.mjs <pad>                   # meetlat, schrijft niets
node scripts/i18n-extract.mjs <pad>                # JSX-tekst, tekstprops, toasts
node scripts/i18n-extract-multiline.mjs <pad>      # tekst op een eigen regel + na <Icon />
node scripts/i18n-extract-objprops.mjs <pad>       # label: 'X' in object-literals
node scripts/i18n-extract-ternary.mjs <pad>        # {x ? 'Actief' : 'Inactief'}
node scripts/i18n-extract-validation.mjs <pad>     # zod-meldingen
node scripts/i18n-datefns-locale.mjs <pad>         # date-fns-locale → useDateFnsLocale
node scripts/i18n-extract.mjs <pad> --repair       # hooks + imports plaatsen
node scripts/i18n-translate.mjs                    # vertaalt naar alle niet-NL talen
node scripts/i18n-parity.mjs                       # poortwachter, draait ook in CI
```

Alle extract-passes zijn strikt additief: `setKey()` overschrijft nooit een bestaande waarde. Ze schrijven alleen `nl.json`; vertalen is een aparte stap.

**Hergebruik-grens.** Een pass hergebruikt een bestaande key alleen als die in `common.*` staat of in de eigen root-namespace. Dat is geen willekeur: zonder die grens rendeerde de publieke webshop ooit `navigation.items.platform_legal` als footer-kop.

**`i18n-translate.mjs` heeft `LOVABLE_API_KEY` nodig** en stopt zonder key met exit 1. Is die er niet, dan vertaal je met de hand — glossary-consistent met de 14 termen in dat script, formeel (Sie/vous), Oekraïens in Cyrillisch met de ви-vorm. `scripts/i18n-translate-memory.mjs` scheelt daarbij fors: dat neemt bestaande vertalingen over voor identieke NL-tekst, maar alleen bij een 1-op-1-match.

**De npm-scripts bestaan niet.** `i18n-extract.mjs` print "Volgende stap: `npm run i18n:translate`" en `i18n-translate.mjs` print "`npm run i18n:check`". Geen van beide staat in `package.json`. Draai alles met `node scripts/…`.

### Wat de codemods NIET aankunnen

Twee categorieën worden gerapporteerd en overgeslagen. Lees die TODO-regels altijd; ze zijn geen ruis.

**1. "buiten een herkende component".** De pass herkent `function X(` en `const X = (…) => {` met blok-body. Valt ook maar één edit erbuiten, dan blijft het HELE bestand ongemoeid. Vrijwel altijd een const-array op moduleniveau. Los op met het key-in-de-array-patroon en draai de pass daarna opnieuw:

```ts
// Labels staan als i18n-key; `id` blijft de enum-waarde.
const STATUSSEN = [
  { id: 'draft', labelKey: 'admin.foo.status.draft' },
];
// rendersite:
{t(item.labelKey)}
```

Helpers die buiten een component staan krijgen `t` of `Locale` als argument mee — een hook mag daar niet.

**2. "in template literal of comment".** Interpolerende strings worden `t('key', { var })`. Gebruik géén i18next-plurals (`_one`/`_other`): Oekraïens heeft vier vormen, waardoor de key-sets per taal gaan verschillen en `i18n-parity.mjs` rood wordt. Kies een formulering met één `{{count}}`.

## Datum, tijd en geld

- **Datums volgen de UI-taal.** Gebruik `useDateFnsLocale()` uit `src/hooks/useDateFnsLocale.ts` in plaats van `import { nl } from 'date-fns/locale'`. Het type `Record<LangCode, Locale>` laat de typecheck falen zodra er een taal bijkomt zonder datumopmaak — dat is opzet, niet lastig.
- Buiten een component: `dateFnsLocaleFor(lang)` en geef de locale als argument door.
- `toLocaleDateString`/`toLocaleString` krijgen `i18n.language`, niet `'nl-NL'`.
- **Bedragen NIET.** Die blijven `Intl.NumberFormat('nl-NL')`, met komma als decimaalteken.

  Dit is een bewuste afwijking van "gebruik de actieve locale", en de reden is
  boekhoudkundig: facturen, exports, de Peppol-koppeling en Odoo gebruiken
  hetzelfde formaat. Zou de opmaak per ingelogde gebruiker verschillen, dan
  verschilt hij ook tussen twee exports van dezelfde data. Een Franse marketeer
  die `1.234,56` ziet begrijpt dat; een boekhouding die per medewerker anders
  formatteert is een echt probleem.

  Vastgelegd in I18N-4 (24 augustus 2026); zie `docs/role-audit.md`. Wil je dit
  omdraaien, dan is dat een aparte batch met een migratie van alle
  export-formaten — niet iets wat je en passant in één component doet.

## Zod-validatiemeldingen

Schema's staan meestal op moduleniveau, waar `t()` niet bestaat. Zet daarom de KEY in de message:

```ts
name: z.string().min(1, 'admin.foo.validation.naam_is_verplicht'),
```

`FormMessage` in `src/components/ui/form.tsx` herkent een key-achtige string (`^[a-z]\w*(\.[\w-]+)+$`) en vertaalt hem bij het renderen. Gewone tekst gaat onveranderd door. `i18n-extract-validation.mjs` doet dit automatisch.

## Werkwijze bij nieuwe of gewijzigde UI

1. Component: `useTranslation`, `{ t }`, `t('sectie.key')`.
2. Keys toevoegen in ALLE talen — of laat de motor het doen. Nooit een key in alleen `nl.json` "voor nu".
3. Echt vertalen. Een NL-string kopiëren naar een andere taal is fout.
4. **Verificatie vóór afronden (verplicht):**
   - `node scripts/i18n-parity.mjs` → moet groen zijn.
   - `npx tsc --noEmit -p tsconfig.app.json` → exit 0. Dit vangt `t` dat niet in scope is en dependency-fouten na een codemod.
   - Parse elk aangeraakt `.tsx`-bestand met esbuild (`loader: 'tsx'`). Dit is de belangrijkste zeef: alle vier de codemod-bugs die in I18N-4 boven water kwamen brachten geldige TypeScript-ogende maar kapotte JSX voort, en alleen een echte parse ving dat.
   - `node scripts/i18n-scan.mjs <pad>` opnieuw en het verschil verklaren. Wat overblijft is meestal scan-ruis (TS-generics als `useState<X>(`, ternary-takken); loop het na, neem het niet aan.

De oude losse grep `>[A-Z][a-z].{3,}<` is géén afdoende controle — die mist tekst op een eigen regel, tekst na een self-closing tag, object-literals, ternary's en zod-meldingen. Gebruik de scan.

## Een nieuwe taal toevoegen (recept)

1. Latijns of Cyrillisch, LTR? → gewoon volgen. CJK (zh/ja/ko)? → check dat het font de glyphs dekt. RTL (ar/he)? → STOP, geen simpele toevoeging: `dir: 'rtl'` plus layout-audit (logical CSS-properties, spiegeling). Doe RTL als apart project.
2. Eén regel toevoegen aan `SUPPORTED_LANGUAGES` in `src/i18n/languages.ts` (correct `script`/`dir`). ISO-codes: Oekraïens = `uk` (niet `ua`), Grieks = `el`, Zweeds = `sv`, Tsjechisch = `cs`, Chinees = `zh`.
3. `locales/{code}.json` + `locales/landing.{code}.json` met de VOLLEDIGE key-set. Importeer beide in `src/i18n/index.ts` en voeg de resource-entry toe.
4. **`src/hooks/useDateFnsLocale.ts` bijwerken** — de typecheck faalt tot je de date-fns-locale voor die taal toevoegt. Ontbreekt er geen locale in date-fns, dan is dat een blokker, geen detail.
5. Ook de glossary in `scripts/i18n-translate.mjs` uitbreiden: die dekt nu alleen en/fr/de/uk.
6. `node scripts/i18n-parity.mjs` → groen.

## Bestaande code aanraken
Migreer minstens de strings die je zelf aanraakt naar `t()`. Geen verplichting om een heel legacy-bestand op te ruimen in een ongerelateerde change, maar laat geen nieuwe hardcoded string achter.

## Wat je nooit doet
- Een UI-string hardcoden "omdat het sneller is".
- Een key in maar één taal zetten, of een NL-waarde als placeholder in andere talen kopiëren.
- Een eigen talenlijst hardcoden i.p.v. `LANG_CODES` gebruiken.
- Een eigen mini-vertaalmechanisme bouwen (ternary op `i18n.language`, eigen dictionary).
- i18next-plurals gebruiken — die breken de pariteitscheck.
- Een codemod draaien zonder de diff te lezen en zonder esbuild-parse.
- RTL-talen "even snel" toevoegen zonder layout-audit.
- De custom tenant-frontends aanraken vanuit deze skill.
