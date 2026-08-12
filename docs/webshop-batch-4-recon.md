# WEBSHOP-4 — Recon: settings-migratie

**Status:** recon, niets verplaatst — 2026-08-12
**Scope:** alleen docs.

---

## 1. Deep-links: het risico uit OB-WS-3 bestaat niet

Het masterplan (§5) waarschuwt dat deep-links als `?section=webshop-features` in gebruik kunnen zijn en dus een redirect nodig hebben. **Dat blijkt niet zo.**

Alle `?section=`-links in de codebase:

| Deep-link | Aantal |
|---|---|
| `section=social` | 3 |
| `section=webshop-general` | 2 |
| `section=whatsapp` | 1 |
| `section=payments` | 1 |
| `section=domain` | 1 |
| `section=customer-communication` | 1 |

**Nul verwijzingen naar `section=webshop-features` of `section=store`.** De enige treffers op die termen staan in `webshop-masterplan.md` en `webshop-batch-1-recon.md` — als hypothese, niet als gebruik. Ook buiten `src/` (edge-functies, migraties, scripts) komen ze niet voor.

**Gevolg voor OB-WS-3:** een redirect-release is niet nodig. De secties kunnen direct verdwijnen. Een redirect kost weinig en kan alsnog, maar er is geen aantoonbaar verkeer om op te vangen.

### 1.1 Wél gevonden: tien kapotte `?tab=`-links

`Settings.tsx:162` leest uitsluitend `section`:

```ts
const initialSection = searchParams.get('section') || 'profile';
```

`tab` wordt nergens uitgelezen. Elke `?tab=`-link landt dus stilzwijgend op "Mijn profiel". Dit staat los van WEBSHOP-4 maar valt er wel middenin.

| Bestand | Link | Zou moeten zijn |
|---|---|---|
| `StorefrontSettings.tsx:133` | `?tab=domains` | `?section=domain` |
| `StorefrontSettings.tsx:189` | `?tab=domains` | `?section=domain` |
| `StorefrontFeaturesSettings.tsx:790` | `?tab=domains` | `?section=domain` |
| `LaunchStep.tsx:54` | `?tab=shipping` | `/admin/shipping` (geen settings-sectie) |
| `LaunchStep.tsx:60` | `?tab=storefront` | `?section=webshop-general` |
| `LaunchStep.tsx:66` | `?tab=legal` | `/admin/storefront?section=legal` |
| `healthScoreCalculator.ts:311` | `?tab=payments` | `?section=payments` |
| `check-scheduled-notifications/index.ts:226` | `?tab=billing` | `/admin/billing` (geen settings-sectie) |
| `create-addon-checkout/index.ts:142` | `?tab=billing&addon_success=` | `/admin/billing` |
| `create-addon-checkout/index.ts:143` | `?tab=peppol&addon_cancelled=true` | `?section=peppol` |

Let op: vier hiervan wijzen naar iets dat geen settings-sectie (meer) is — shipping, legal en billing zijn eigen routes. Twee zitten in edge-functies (Stripe-redirects na een add-on-aankoop), dus dat zijn klantgerichte kapotte links.

---

## 2. StorefrontFeaturesSettings: in één keer te verplaatsen

**Conclusie: geen splitsing nodig.** Het component is al portable.

### 2.1 Hoe het aan de data hangt

```ts
const { themeSettings, saveThemeSettings } = useStorefront();   // regel 62
...
saveThemeSettings.mutate(formData as any, { ... });             // regel 150
```

Het gebruikt exact dezelfde hook als de rest van de studio. De `allowedFields`-whitelist in `useStorefront.ts` dekt **alle 29 velden** al — die stonden daar vanaf het begin in. Er is dus geen datawerk, geen nieuwe hook en geen schemawijziging nodig.

Lezen gebeurt via één `useEffect` die `themeSettings` in `formData` giet met `?? prev.x` als fallback, dus ontbrekende kolommen leveren nette defaults op.

### 2.2 De 29 velden, per accordion-sectie

| Sectie | Velden | Aantal |
|---|---|---|
| `newsletter` | `newsletter_enabled`, `_provider`, `_popup_enabled`, `_popup_delay_seconds`, `_incentive_text` | 5 |
| `checkout` | `checkout_guest_enabled`, `_phone_required`, `_company_field`, `_address_autocomplete` | 4 |
| `product` | `product_image_zoom`, `_variant_style`, `_reviews_display`, `_stock_indicator`, `_related_mode` | 5 |
| `trust` | `cookie_banner_enabled`, `cookie_banner_style`, `trust_badges` | 3 |
| `navigation` | `nav_style`, `header_sticky`, `search_display`, `mobile_bottom_nav` | 4 |
| `conversion` | `show_stock_count`, `show_viewers_count`, `show_recent_purchases`, `exit_intent_popup` | 4 |
| `multilingual` | `storefront_multilingual_enabled`, `_languages`, `_default_language`, `_language_selector_style` | 4 |

Dat komt exact overeen met de zeven onderdelen die §2.2 van het masterplan naar de Webshop-pagina wil verhuizen.

### 2.3 Wat er aan het component moet veranderen

Alleen de omlijsting, niet de inhoud:

1. **Eigen kop weg** (regel 190-193: `<h2>Functies & Gedrag</h2>` + beschrijving). De studio zet zelf sectiekoppen.
2. **Amber banner weg** (regel 196-210). Dat is precies de verspreide waarschuwing die WEBSHOP-2 heeft opgeheven; de studio toont één rustige uitleg op paginaniveau.
3. **`fieldset disabled` heroverwegen** (regel 212-215). Zie de open vraag in §5.
4. **`?tab=domains` op regel 790 corrigeren** (§1.1).

De accordion, de 29 velden en de opslagknop kunnen ongewijzigd mee.

### 2.4 Wat er in Instellingen → Webshop overblijft

`StorefrontSettings.tsx` (305 regels) beheert `use_custom_frontend`, `custom_frontend_url` en `custom_head_scripts`, plus een domeinen-samenvatting en de API-keys-manager. Dat is exact wat volgens §2.2 daar hoort te blijven. Na de verhuizing houdt Instellingen → Webshop dus één sectie over.

---

## 3. StoreSettings (4b): twee verhuizingen, twee opruimingen

195 regels, vier bedieningselementen. Bij nader inzien is maar de helft een echte verhuizing.

| Onderdeel | Opslag | Bevinding | Bestemming |
|---|---|---|---|
| **BTW-percentage** | `tenants.tax_percentage` | `TaxSettings` **toont** het op vijf plekken (o.a. regel 213: "je standaard BTW-tarief van X%") maar kan het **niet wijzigen**. StoreSettings is de enige plek waar het bewerkt kan worden. | → Financieel › BTW-instellingen. Vult een bestaand gat. |
| **Valuta** | `tenants.currency` | `BusinessSettings` heeft geen valutaveld. Echte verhuizing. | → Bedrijfsgegevens |
| **Verzending inschakelen** | `tenants.shipping_enabled` | **Nul consumenten.** Buiten formulieren (`StoreSettings`, `TenantFormDialog`) en typedefinities leest geen enkele regel client- of serverside dit veld. Geen enkele treffer in `supabase/functions/`. | ⚠️ Zie §5 — een dode schakelaar verplaatsen lost niets op |
| **Systeemthema volgen** | `next-themes` (client) | **Duplicaat.** `AccountSettings.tsx:364` heeft al een volledige keuzelijst licht/donker/systeem voor dezelfde state. De versie in StoreSettings is een binaire schakelaar die alleen systeem ↔ licht/donker wisselt, dus strikt minder capabel. | → verwijderen, niet verhuizen |

`tax_percentage` is geen dood veld: het wordt gebruikt door `ManualInvoiceDialog`, `useQuotes`, `useInvoiceCompliance`, `QuoteForm` en `POSTerminal`. Het bewerkbaar maken in TaxSettings is dus functioneel relevant.

---

## 4. Plan van aanpak

### WEBSHOP-4a — Functies & Gedrag verhuizen

1. `StorefrontFeaturesSettings.tsx` verplaatsen naar `src/components/admin/storefront/studio/`, met de vier aanpassingen uit §2.3.
2. Sectie **"Functies & Gedrag"** toevoegen aan `navItems` in `Storefront.tsx`, tussen Juridisch en Status.
3. Sectie `webshop-features` verwijderen uit `Settings.tsx:110`.
4. Optioneel (zie §1): een redirect van `?section=webshop-features` naar `/admin/storefront?section=features`.
5. Verificatie: tsc, eslint, build, plus smoke-test dat alle 29 velden nog laden én opslaan.

### WEBSHOP-4b — StoreSettings ontmantelen

6. BTW-percentage bewerkbaar maken in `TaxSettings` (naast de bestaande weergave).
7. Valutakeuze toevoegen aan `BusinessSettings`.
8. Systeemthema-schakelaar verwijderen — `AccountSettings` heeft hem al.
9. Verzending-schakelaar: afhankelijk van het besluit in §5.
10. Sectie `store` verwijderen uit `Settings.tsx:109` en `StoreSettings.tsx` verwijderen.
11. Verificatie: controleren dat BTW en valuta op hun nieuwe plek écht opslaan naar `tenants`, want dat is de enige plek waar tenants die waarden kunnen zetten.

### Los daarvan — de `?tab=`-links

12. De tien links uit §1.1 repareren. Twee ervan zitten in edge-functies en zijn klantgerichte Stripe-redirects; die zou ik niet laten liggen.

**Volgorde:** 4a eerst (grootste zichtbare winst, laagste risico — het component verhuist ongewijzigd). Dan de `?tab=`-fix als losse stap, want die raakt edge-functies en verdient een eigen verificatie. Dan 4b.

---

## 5. Open beslispunten

| ID | Vraag | Voorstel |
|---|---|---|
| **OB-WS-7** | Blijft Functies & Gedrag uitgeschakeld voor custom-frontend tenants? In WEBSHOP-2 is besloten dat zij bewust kunnen doorklikken naar de studio; alles daar vervolgens grijs maken spreekt dat tegen. | Inschakelen. Ze hebben expliciet gekozen de SellQo-winkel te beheren. |
| **OB-WS-8** | Wat doen we met `shipping_enabled`? Het heeft nul consumenten. | Niet verplaatsen. Eerst uitzoeken of het ooit iets deed; anders verwijderen in plaats van verhuizen. |
| **OB-WS-9** | Redirect voor `?section=webshop-features` / `?section=store`? | Niet nodig (§1), maar goedkoop. Jouw keuze. |
| **OB-WS-10** | De tien `?tab=`-links in deze reeks meenemen of apart? | Meenemen als losse stap tussen 4a en 4b. |
