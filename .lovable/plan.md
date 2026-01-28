
Doel
- Zorgen dat e-mails naar `demo-bakkerij@sellqo.app` wél in de SellQo inbox verschijnen.

Wat ik nu zie (diagnose)
- De webhook komt wél binnen: de logs tonen “Inbound email received … to: [demo-bakkerij@sellqo.app]”.
- Daarna faalt het opslaan in `customer_messages` met:
  - `null value in column "body_html" ... violates not-null constraint`
- De reden: Resend stuurt in de webhook bewust géén `html`/`text` body mee (alleen metadata). Dat is ook zo gedocumenteerd: je moet de “Retrieve Received Email” API call doen met `email_id` om `html`/`text` op te halen.
- Daardoor is `payload.html || payload.text` momenteel `undefined/null` en crasht de insert (en dus zie je niets in de inbox).

Wat we gaan aanpassen (high-level)
1) In de backend functie `handle-inbound-email`:
   - Na ontvangst van webhook (`email.received`) halen we de volledige ontvangen e-mail op via Resend API: “retrieve received email” met `payload.email_id`.
   - Daarna gebruiken we die opgehaalde `html`/`text` voor `body_html` en `body_text`.
   - We zorgen dat `body_html` altijd een string is (nooit null), door een veilige fallback te zetten.

2) Types/interfaces corrigeren:
   - `ResendInboundEmailData.text` en `.html` moeten optioneel worden (want webhook bevat ze niet).
   - Nieuwe interface toevoegen voor het “retrieved received email” response object (die bevat wel `html`, `text`, `headers`, `message_id`, `reply_to`, …).

3) Insert verbeteren:
   - `body_html`: `received.html ?? (received.text ? <pre>…</pre> : '<p>(Geen inhoud)</p>')`
   - `body_text`: `received.text ?? null`
   - `from_email/to_email/subject`: primair uit `received` nemen (met fallback op webhook data).
   - `resend_id` kolom (bestaat al) invullen met de received email id voor traceerbaarheid/idempotentie.
   - `context_data.message_id/references` bij voorkeur uit `received.message_id` en `received.headers` vullen.

4) Optioneel (sterk aangeraden) beveiliging & robuustheid
   - Webhook signature verificatie (Resend gebruikt Svix headers). Dit vereist een extra secret `RESEND_WEBHOOK_SECRET`. Dit is niet nodig om het probleem op te lossen, maar wel om misbruik (spam inserts) te voorkomen.
   - Idempotency: eerst checken of `customer_messages.resend_id = payload.email_id` al bestaat; zo vermijden we dubbel opslaan bij retries.

Concrete implementatiestappen (code)
A. Edge function uitbreiden met Resend API fetch
- Lees `RESEND_API_KEY` uit env (die staat al als secret in je project).
- Doe een `fetch('https://api.resend.com/emails/receiving/' + emailId, { headers: { Authorization: 'Bearer …' }})`
- Controleer statuscode en parse JSON.
- Map response naar `receivedEmail` object.

B. Gebruik `receivedEmail` in plaats van webhook payload voor body
- Vervang:
  - `body_html: payload.html || payload.text`
  - `body_text: payload.text`
- Door:
  - `body_html: computedHtmlString` (altijd non-null)
  - `body_text: receivedEmail.text ?? null`

C. Logging verbeteren (om toekomstige issues sneller te zien)
- Log 1x kort:
  - email_id, tenantPrefix, tenantId
  - of receivedEmail.html/text aanwezig is (booleans/lengths, geen volledige inhoud)
- Log bij Resend-fetch errors:
  - statuscode + error body (ingekort)

Testplan (end-to-end)
1) Stuur een testmail (met duidelijke body tekst) naar `demo-bakkerij@sellqo.app`.
2) Controleer backend logs:
   - Je moet zien: webhook ontvangen → received email opgehaald → message inserted → notification inserted.
3) Open in de app: Admin → Klantgesprekken (/admin/messages):
   - Er moet een nieuwe conversatie/message zichtbaar zijn.
4) Herhaal met:
   - e-mail zonder body (alleen subject)
   - e-mail met HTML body
   - e-mail met bijlage (bijlage blijft voorlopig als “reference” opgeslagen; content ophalen kunnen we als vervolgstap doen)

Risico’s / aandachtspunten
- Als Resend API tijdelijk faalt (timeout/401), dan kunnen we nog altijd een minimale placeholder opslaan zodat de inbox niet “leeg blijft”.
- Signature verification is security-wise belangrijk omdat deze endpoint publiek bereikbaar is en met service-role writes doet; ik stel voor dit als korte vervolgstap te doen.

Resultaat na deze fix
- Inbound e-mails komen binnen, de body wordt correct opgehaald via Resend, `customer_messages` insert faalt niet meer, en de inbox toont de berichten.

