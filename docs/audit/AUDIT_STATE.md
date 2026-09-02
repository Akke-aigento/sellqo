# AUDIT_STATE — SellQo volledige pagina-audit

**Gepinde main-SHA:** `037819858ac875cba2a4c6c95e14d0d238546b59`
**Datum start:** 2026-09-02
**Audit-branch:** `audit-run` (rapporten committen hier; `main` blijft schoon tot fixes gemerged worden)
**Aard van de run:** audit, geen fix-run. Er wordt geen productcode gewijzigd; er wordt uitsluitend onder `docs/audit/**` geschreven.

---

## Status

> **GEBLOKKEERD op stap 0.2/0.4.** `docs/audit/RUNBOOK.md` is niet meegeleverd en bestaat niet in de repo
> (`find . -iname "*RUNBOOK*"` geeft alleen `.agents/skills/sellqo-custom-frontend-runbook/`, een andere skill).
> Het runbook is per opdracht "de enige opdrachtgever" voor de 3-lagen-architectuur, de 7 assen, het
> rapportformaat, de verificatie-discipline, de batchvolgorde en de routelijst in §6. Die worden niet geraden.
>
> Wat wél doorloopt zonder runbook: toolchain-verificatie (`npm ci`, build, `tsc`, i18n-parity),
> route-inventaris uit de router, en de template-inventaris. Zie hieronder.

---

## Voortgang per batch

| Batch | Gebied | Status | Rapport |
|---|---|---|---|
| 0 | Visuele quick-scan (alle routes, 3 viewports, mail-renders) | ⏸ wacht op runbook §6 | `reports/00-visual-quickscan.md` |
| 1 | Storefront — laag 1 | ⏸ niet gestart | — |
| 2 | _(runbook-gedefinieerd)_ | ⏸ niet gestart | — |
| 3 | _(runbook-gedefinieerd)_ | ⏸ niet gestart | — |
| 4 | _(runbook-gedefinieerd)_ | ⏸ niet gestart | — |
| 5 | _(runbook-gedefinieerd)_ | ⏸ niet gestart | — |
| 6 | _(runbook-gedefinieerd)_ | ⏸ niet gestart | — |
| 7 | _(runbook-gedefinieerd)_ | ⏸ niet gestart | — |
| 8 | _(runbook-gedefinieerd)_ | ⏸ niet gestart | — |
| 9 | _(runbook-gedefinieerd)_ | ⏸ niet gestart | — |
| 10 | _(runbook-gedefinieerd)_ | ⏸ niet gestart | — |

De batch-naar-pagina-toewijzing komt uit het runbook en wordt hier ingevuld zodra dat er is. Batch 1
staat op "Storefront" omdat de kickoff-prompt dat expliciet noemt.

### Status per pagina

Nog niet ingevuld — vereist de batchindeling uit het runbook. De feitelijke routelijst uit de code staat
in `reports/route-inventory.md` en dient als controlelijst tegen §6 van het runbook.

---

## Runbook-errata

Afwijkingen tussen het runbook / de kickoff-opdracht en wat de code feitelijk zegt. Hier genoteerd,
niet stilzwijgend gecorrigeerd.

### E-1 — Mail-templates: vier talen genoemd, vijf ondersteund
**Bron van de claim:** kickoff-prompt stap 1 — "Mail-templates ... per taal (nl/en/fr/de)".
**Wat de code zegt:** `src/i18n/languages.ts:19-26` — `SUPPORTED_LANGUAGES` bevat `nl, en, fr, de, uk`.
`src/i18n/locales/` bevat `nl/en/fr/de/uk.json` en `landing.{nl,en,fr,de,uk}.json`.
**Gevolg:** een render-run over alleen nl/en/fr/de laat Oekraïens ongetest. CLAUDE.md §4.2 is hier
expliciet over: "De talenlijst is de bron, nooit een vast aantal."
**Voorstel:** mail-renders over alle vijf codes uit `LANG_CODES` draaien, niet over een hardcoded viertal.
Afgestemd met Akke vóór uitvoering.

---

## Feitelijke vaststellingen stap 0

- `origin/main` en lokale `HEAD` staan beide op `03781985`; de pinned SHA vroeg geen checkout-sprong.
- Werkboom was schoon op `.claude/` (untracked) na.
- `src/App.tsx` telt 124 `path=`-declaraties over 388 regels. Volledige lijst: `reports/route-inventory.md`.
- Mail-templates: `supabase/functions/_shared/email-templates/` (7 templates + `_brand.tsx` + `index.ts`),
  plus `sellqoEmail.ts`, `tenantEmail.ts` en `tenantEmailI18n.ts` in `_shared/`.
- `package.json` heeft geen `typecheck`-script; typecheck draait handmatig als
  `npx tsc --noEmit -p tsconfig.app.json` (CLAUDE.md §6: 5–10 min looptijd).
