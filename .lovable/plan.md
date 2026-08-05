# UX-UNIFY-1 — Plan-first billing wizard + mandaatpagina met context

Doel: betaalwijze en plankeuze samensmelten tot één flow. De plankeuze is de enige ingang; de betaalwijze-kaart wordt beheer-only; de machtigingspagina toont waarvoor en voor hoeveel je machtigt.

## 1. Wizard-ontwerp

Nieuwe component `PlanActivationWizard.tsx` (vervangt `PlanChangeConfirmDialog` als ingang; de inhoud van stap 1 is letterlijk de bestaande dialoog-inhoud, inclusief de twee wetten en zonder pro-rata-belofte).

Eén dialoog, interne stap-state:

```text
Klik plan (niet-Enterprise)
   |
   +-- downgrade met featureverlies? -> DowngradeWarningDialog (ongewijzigd) -> daarna wizard
   |
Stap 1  PLAN
   plan + interval + periodetarief + twee wetten
   heeft al betaalwijze (mandaat active/pending OF payment_mode=manual OF pendingMode)?
        ja  -> knop "Bevestigen"        -> ACTIVEREN (stap 3)
        nee -> knop "Verder: betaalwijze" -> stap 2
   gratis plan (price 0)? -> altijd direct "Bevestigen"
   |
Stap 2  BETAALWIJZE  (periodetarief blijft bovenaan zichtbaar)
   A "Automatische incasso"  -> create-platform-mandate-setup(plan_id, billing_interval)
                                -> stap 2b
   B "Betalingsverzoek per periode" -> pendingMode = 'manual' -> ACTIVEREN (stap 3)
   |
Stap 2b MACHTIGING LOPEND
   mandaatlink: kopieer-knop + "Open machtigingspagina" (nieuw tabblad)
   knop "Ik heb de machtiging afgerond" -> refetch platform-billing-status
        mandaat gevonden (active/pending) -> ACTIVEREN (stap 3)
        niets gevonden -> inline melding "nog niet ontvangen, probeer opnieuw"
   auto-poll: elke 5s zolang stap 2b open is en het tabblad focus heeft, max 3 min
   |
Stap 3  ACTIVEREN
   sync-tenant-plan (action = billing_subscription_id ? 'switch' : 'activate')
   pendingMode 'manual' -> daarna set_payment_mode('manual') zoals nu
   succes-toast (upgrade/downgrade) -> dialoog sluit
```

### Halverwege sluiten
Sluiten in stap 2b is toegestaan (geen blokkade). Uitkomst: mandaat kan wél gezet zijn, plan niet geactiveerd = "halve staat".
- Bij sluiten in stap 2b: onthoud het gekozen plan+interval in `sessionStorage` (`sellqo.pending_plan_selection`).
- Bij herladen van /admin/billing: als er een bruikbaar mandaat is én geen actief betaald abonnement én de sessionStorage-selectie bestaat, toont de pagina bovenaan een `Alert` "Je machtiging staat klaar — activeer <plan> om te starten" met knop die de wizard direct in stap 1 heropent (stap 2 wordt dan overgeslagen).
- Zonder sessionStorage-selectie: de betaalwijze-kaart toont de halve staat (zie §3) en de plankeuze blijft de call-to-action.
- De huidige toast + `scrollToPayment()` poortwachter verdwijnt volledig.

## 2. Context-drager voor de mandaatpagina

Schema-recon: `public.mandate_setup_tokens` heeft nu id, tenant_id, customer_id, token, expires_at, used_at, created_at, stripe_customer_id — geen contextveld. `MandateActivation.tsx` haalt zijn data uitsluitend via `supabase.functions.invoke('mandate-setup-info', { token })`.

Kleinste nette drager: één nullable kolom `context jsonb` op `mandate_setup_tokens` (migratie met IF NOT EXISTS, geen DROP).

Vorm:
```json
{ "kind": "platform_subscription", "plan_name": "Pro", "amount": 79, "currency": "EUR",
  "interval": "monthly", "vat_note": "excl_vat" }
```

Wijzigingen:
- `create-platform-mandate-setup`: accepteert optioneel `plan_id` + `billing_interval`, leest plannaam/prijs uit `pricing_plans`; is er geen plan meegegeven maar wel een lopend abonnement, dan wordt de bestaande plannaam + periodebedrag gebruikt. Schrijft dit als `context` bij de token-insert. Geen context beschikbaar -> kolom blijft NULL.
- `mandate-setup-info`: selecteert `context` mee en geeft het ongewijzigd terug in de response (`context: {...} | null`). Verder niets gewijzigd.
- `MandateActivation.tsx`: alleen een extra contextblok boven het bestaande formulier — "Je machtigt SellQo voor je <plan>-abonnement (<bedrag>/<periode>, excl. btw)" plus "Je kunt deze machtiging op elk moment stopzetten." Zonder context: exact het huidige gedrag. PaymentElement, SEPA-eerst en de confirm-flow blijven byte-voor-byte gelijk.
- `create-mandate-setup` (tenant -> eigen klant) wordt niet aangeraakt; die tokens houden `context = NULL`.

## 3. Gedragstabel betaalwijze-kaart

| Actief/lopend abonnement | Betaalwijze | Kaart | Inhoud |
|---|---|---|---|
| nee | geen | verborgen | plankeuze is de enige CTA |
| nee | mandaat active/pending | zichtbaar | mandaat + hint "kies een plan om te starten" |
| nee | manual gekozen | zichtbaar | manual + zelfde hint |
| ja | mandaat active | zichtbaar | zoals nu + "Vervangen" |
| ja | mandaat pending | zichtbaar | "in verwerking" + "Vervangen" |
| ja | manual | zichtbaar | manual + "Overstappen naar incasso" |
| ja/nee | mandaat failed | zichtbaar | foutmelding + opnieuw instellen |

De wijzig-acties in de kaart openen dezelfde mandaatlink-flow (nu met context uit het bestaande abonnement).

## 4. Wat wijzigt t.o.v. 2a·2

- `src/components/admin/billing/PlanActivationWizard.tsx` (nieuw; absorbeert PlanChangeConfirmDialog-inhoud)
- `src/components/admin/billing/PlanChangeConfirmDialog.tsx` (blijft bestaan als stap-1-body of wordt verwijderd na absorptie — één van de twee, geen dubbele bron)
- `src/components/admin/billing/PaymentMethodCard.tsx` (zichtbaarheids-/hint-logica; `hideWhenEmpty`-gedrag)
- `src/pages/admin/Billing.tsx` (poortwachter-toast + scroll eruit, wizard erin, halve-staat-alert, kaart-conditie)
- `src/hooks/usePlatformBillingStatus.ts` (`useCreatePlatformMandateLink` krijgt optioneel plan_id/interval; refetch-helper voor polling)
- `src/pages/MandateActivation.tsx` (alleen contextblok)
- `supabase/functions/create-platform-mandate-setup/index.ts` (context opbouwen + opslaan)
- `supabase/functions/mandate-setup-info/index.ts` (context teruggeven)
- migratie: `alter table public.mandate_setup_tokens add column if not exists context jsonb`
- i18n: nieuwe `billing.wizard.*` en `mandate.context.*` keys in nl/en/fr/de
- doc_articles: bestaand artikel "Abonnement en betaalwijze beheren" bijwerken (tenant-level) met de nieuwe flow
- changelog: nieuwe versie-entry (object met title+description, in `public.changelog.changes`, alle 4 talen)

Niet gewijzigd: `get-platform-billing-status`, `sync-tenant-plan`, CYCLE-functies, webhook, de twee wetten, activate/switch-keuzelogica, Enterprise = contact.

## 5. Risico's en open vragen

Risico's
- Mandaatvoltooiing gebeurt buiten de wizard (ander tabblad); polling kan het mandaat missen als de Stripe-webhook vertraagt -> daarom expliciete "ik heb het afgerond"-knop plus de halve-staat-alert als vangnet.
- sessionStorage-selectie kan verouderen (plan/prijs gewijzigd) -> bij heropenen altijd het actuele plan uit `pricing_plans` opnieuw lezen, alleen id+interval bewaren.
- Contextbedrag op de machtigingspagina is een momentopname bij tokencreatie; bij latere planwijziging kan een oude, nog niet gebruikte link een verouderd bedrag tonen -> tokens verlopen na 7 dagen, acceptabel; tekst blijft "voor je <plan>-abonnement" zonder juridische bedragbelofte.

Open vragen
1. Mag de wizard bij een pending (nog niet actief) mandaat al activeren, of pas bij `active`? Voorstel: ja, pending volstaat — gelijk aan de huidige `hasUsableMandate`-regel.
2. Mag `PlanChangeConfirmDialog` verdwijnen (opgaan in de wizard), of moet die als losse component blijven bestaan?
3. Welk changelog-versienummer wil je (voorstel: 2026.08q)?
