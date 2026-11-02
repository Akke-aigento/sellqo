# KASSA-README — versieregel in src/kassa/README.md rechtgezet — 2 november 2026

Batch VERVOLG-1 (onderdeel C), branch `vervolg-1`.

## Root cause
`src/kassa/README.md` regel 3 van "Regels voor wie hier iets wijzigt" zei dat `KASSA_SW_VERSION` ophogen "komt met
CERT-1". CLAUDE.md §9 en de praktijk (`src/kassa/version.ts`: elke release opgehoogd, 0.2.0 → 0.20.0, patch voor
correcties zonder ander gedrag zoals 0.4.1 en 0.19.1) zeggen: elke wijziging aan `src/kassa/` = ophogen.

## Uitgevoerd
`src/kassa/README.md`, regel 3: elke wijziging hoogt nu al op (minor bij nieuw gedrag, patch bij een correctie), één
zin in de kop van `version.ts` met batch-ID's en of de fiscale berichten veranderen, bij parallel werk hoogt enkel wie
samenvoegt één keer op; vanaf CERT-1 komt daar de FOD-melding (≥1 maand vooraf, max. 12 per jaar) en de fiscale
changelog bij. `KASSA_SW_VERSION` zelf niet verhoogd (blijft `sellqo-kassa-0.20.0`).

Security / gedeelde paden: n.v.t. (documentatie). Geen code in `src/kassa/` gewijzigd buiten de README.

## Changelog
Geen (intern).
