---
name: sellqo-i18n-verplicht
description: Verplichte werkwijze voor alle user-facing tekst in de SellQo core (admin UI + SellQo-based storefront). Elke nieuwe of gewijzigde UI-string MOET door i18n (react-i18next t()) gaan met een key in ELKE ondersteunde taal — nooit hardcoded tekst in JSX. Bevat ook het recept om een nieuwe taal toe te voegen. Geldt NIET voor de custom tenant-frontends (VanXcel/Mancini/Loveke/Astra/Zona), die hebben hun eigen i18n.
---

# SellQo i18n — Verplichte Werkwijze

Alle zichtbare tekst in de SellQo core (Lovable project 9932a7fe-43a1-42de-9c64-168968599600) gaat via i18n. Geen uitzonderingen voor "tijdelijk", "intern" of "admin-only". Als een gebruiker het kan lezen, is het een vertaalde key — in ALLE ondersteunde talen.

Deze regel bestaat omdat de codebase historisch is dichtgeslibd met hardcoded Nederlandse strings: op het moment van schrijven gebruikt slechts ±7% van de componenten i18n en staan er duizenden hardcoded strings in JSX. Elke nieuwe hardcoded string maakt dat erger. Doe het vanaf nu in één keer goed.

**Scope:** admin UI + SellQo-based storefront. NIET de custom tenant-frontends — die hebben een eigen i18n-setup en vallen buiten deze skill.

## Bron van waarheid: de talenlijst

Er is één plek waar de ondersteunde talen staan: src/i18n/languages.ts, geëxporteerd als SUPPORTED_LANGUAGES. Elke andere plek in de code (allowlists, z.enum, taal-switchers, browser-detectie) leidt zijn talen HIERVAN af — nooit een eigen hardcoded lijst zoals ['nl','en','de','fr'].

Als je een allowlist of z.enum(['nl','en','de','fr']) in de code tegenkomt: dat is een bug. Vervang door afleiding uit LANG_CODES. Voor Zod: z.enum(LANG_CODES as [LangCode, ...LangCode[]]).

## De setup (feiten over deze repo)

- Library: react-i18next + i18next. Init in src/i18n/index.ts.
- fallbackLng: 'nl' (= DEFAULT_LANG).
- Eén namespace (translation). Per taal worden twee bestanden samengevoegd: src/i18n/locales/{code}.json (app-UI) en src/i18n/locales/landing.{code}.json (publieke landing). Bij init: { ...appJson, ...landingJson } in dezelfde translation-namespace.
- Key-conventie: dot-notation, t('sectie.key'). Volg de bestaande key-stijl (camelCase/snake_case) van de sectie waarin je schrijft; verzin geen nieuwe stijl.

### Waarom hardcoded tekst extra kwaad kan hier
Omdat fallbackLng: 'nl': een ontbrekende key in eender welke taal valt terug op het Nederlands, niet op Engels. Een half-vertaald scherm toont dus stille Nederlandse brokken aan elke niet-NL gebruiker. Een ontbrekende key is geen nette fallback — het is een zichtbare bug.

## De ijzeren regel

Geen enkele letterlijke, menselijk-leesbare string in JSX-output of in UI-tekstprops.

NIET hardcoden:
- JSX-tekstnodes: <Button>Opslaan</Button> → <Button>{t('common.save')}</Button>
- Tekstprops: placeholder, title, label, aria-label, description, alt, tooltip
- Toasts / sonner / toast()-berichten
- Validatie- en foutmeldingen die de gebruiker ziet
- <option>-labels, tab-titels, dialog-titels, lege-staat-teksten
- Bevestigingsteksten ("Weet je het zeker?")

WEL letterlijk (geen UI-tekst):
- Code-identifiers, enum-waarden, API-keys, routes, className, testids
- Merknamen ("Stripe", "Bol.com", "SellQo")
- Getallen/valuta via Intl.NumberFormat met de actieve locale (niet via een key)

## Werkwijze bij nieuwe of gewijzigde UI

1. Component: importeer useTranslation, haal { t } op, gebruik t('sectie.key'). t() mag een default als 2e arg krijgen (t('mysection.title', 'Mijn titel')) — vangnet, GEEN vervanging voor de JSON-key.
2. Keys toevoegen — in ALLE talen: voeg de key toe aan elk locales/{code}.json (of landing.{code}.json), met exact hetzelfde key-pad. Nooit een key in alleen nl.json "voor nu" — zo ontstonden de honderden ontbrekende keys. Plaats in de juiste bestaande sectie. Hergebruik common.* voor generieke woorden.
3. Vertalen — echt vertalen: de waarden per taal moeten daadwerkelijk vertaald zijn, vakterm-consistent (e-commerce/boekhoud-terminologie). Een NL-string kopiëren naar een andere taal is fout.
4. Verificatie vóór afronden (verplicht): draai node scripts/i18n-parity.mjs. Groen = elke taal heeft exact dezelfde key-set. Rood = gat dichten. Controleer ook je component met grep -nE ">[A-Z][a-z].{3,}<" op UI-tekst.

## Een nieuwe taal toevoegen (recept)

1. Latijns of Cyrillisch, LTR? → gewoon volgen. CJK (zh/ja/ko)? → check dat het font de glyphs dekt (line-height/letter-spacing kan aandacht nodig hebben). RTL (ar/he)? → STOP, geen simpele toevoeging: dir: 'rtl' in de lijst plus layout-audit (logical CSS-properties, spiegeling). Doe RTL als apart project.
2. Voeg één regel toe aan SUPPORTED_LANGUAGES in src/i18n/languages.ts (met correct script/dir). Let op ISO-codes: Oekraïens = uk (niet ua), Grieks = el, Zweeds = sv, Tsjechisch = cs, Chinees = zh.
3. Maak locales/{code}.json + locales/landing.{code}.json aan met de VOLLEDIGE key-set. Importeer beide in src/i18n/index.ts en voeg de resource-entry toe.
4. node scripts/i18n-parity.mjs → moet groen zijn. De taal-switcher, browser-detectie en allowlists werken automatisch mee omdat ze uit LANG_CODES afleiden. Moet je toch een hardcoded lijst aanpassen, dan leest die plek nog niet uit de bron van waarheid → fix dat.

## Bestaande code aanraken
Migreer minstens de strings die je zelf aanraakt naar t(). Geen verplichting om een heel legacy-bestand op te ruimen in een ongerelateerde change (scope creep), maar laat geen nieuwe hardcoded string achter.

## Wat je nooit doet
- Een UI-string hardcoden "omdat het sneller is".
- Een key in maar één taal zetten, of een NL-waarde als placeholder in andere talen kopiëren.
- Een eigen talenlijst hardcoden i.p.v. LANG_CODES gebruiken.
- Een eigen mini-vertaalmechanisme bouwen (ternary op i18n.language, eigen dictionary). Alles via t().
- RTL-talen "even snel" toevoegen zonder layout-audit.
- De custom tenant-frontends aanraken vanuit deze skill.
