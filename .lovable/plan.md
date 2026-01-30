
Doel
- Het Shopify “koppelverzoek indienen” moet weer werken op Live (sellqo.app), zonder 400 Bad Request.
- Berichten/tickets mogen niet dubbel aangemaakt worden bij status-updates.

Wat er nu misgaat (oorzaak)
- De database-trigger `shopify_request_notification_trigger` roept de functie `public.handle_shopify_request_notification()` aan.
- In die functie staat: `SELECT name, contact_email ... FROM tenants ...`
- In jullie `tenants` tabel bestaat `contact_email` niet (wel o.a. `notification_email`, `billing_email`, `owner_email`).
- Daardoor crasht de trigger bij het INSERT’en van een koppelverzoek → de API call krijgt 400 Bad Request.

Belangrijk: je test op Live
- Dit betekent: zelfs als we de fix in de testomgeving toepassen, moet die daarna ook naar Live doorgezet worden (via Publish), anders blijf je dezelfde fout zien op sellqo.app.

Oplossing (high level)
1) Pas `handle_shopify_request_notification()` aan:
   - Gebruik een bestaand e-mail veld uit `tenants` i.p.v. `contact_email`.
   - Aanbevolen fallback:
     - `COALESCE(notification_email, billing_email, owner_email, 'no-email@sellqo.nl')`
   - (Optioneel) sla de gekozen e-mail ook op in `support_tickets.metadata` voor traceability.

2) Voorkom dubbele tickets / onbedoelde ticket-creatie op UPDATE:
   - De trigger staat nu op `AFTER INSERT OR UPDATE`.
   - We wijzigen dit naar: alleen `AFTER INSERT`.
   - Extra safety: in de functie zelf ook enkel logica uitvoeren bij `TG_OP = 'INSERT'` (defensief).
   - Dit voorkomt dat bij statusupdates (of sync-processen) telkens opnieuw support tickets worden aangemaakt.

Concrete implementatiestappen (backend)
A. Database migratie (nieuw)
- CREATE OR REPLACE FUNCTION `public.handle_shopify_request_notification()` met:
  - `v_tenant_email := COALESCE(t.notification_email, t.billing_email, t.owner_email)`
  - Ticket creation + eerste message + notificatie zoals nu, maar met `v_tenant_email`
  - Guard: “alleen bij INSERT”
- DROP TRIGGER `shopify_request_notification_trigger` op `shopify_connection_requests`
- CREATE TRIGGER `shopify_request_notification_trigger`:
  - `AFTER INSERT ON public.shopify_connection_requests`
  - `FOR EACH ROW EXECUTE FUNCTION public.handle_shopify_request_notification()`

B. Verificatie in testomgeving (preview)
- Probeer een Shopify aanvraag in te dienen.
- Verwacht:
  - Geen 400 error
  - Request record wordt aangemaakt
  - Support ticket + support message worden aangemaakt (voor platform opvolging)
  - Merchant ziet “Verzoek in behandeling” bevestiging in UI

C. Live fix (belangrijk omdat jij op Live test)
- Publish zodat de database-migratie (schema/trigger/function) ook naar Live gaat.
- Daarna opnieuw testen op sellqo.app.

Acceptatiecriteria
- Op Live: “Dien Koppelverzoek In” geeft geen foutmelding meer.
- In de UI verschijnt het “Verzoek in behandeling” scherm.
- In de platform support-inbox verschijnt exact 1 ticket per aanvraag (geen duplicates bij statuswijzigingen).

Risico’s / edge cases die we afvangen
- Tenant heeft geen e-mail ingevuld: we vallen terug op `no-email@sellqo.nl` zodat de trigger niet faalt.
- Status-updates veroorzaken geen nieuwe tickets meer (door trigger-only-insert + INSERT-guard).

Optionele verbetering (na de fix)
- Frontend error handling: als de backend toch ooit faalt, toon een duidelijkere melding (“Er ging iets mis op de server, probeer opnieuw”) en log de details in console voor debug. Dit is niet nodig om de huidige bug op te lossen, maar helpt bij toekomstige fouten.
