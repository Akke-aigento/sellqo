// MAIL-CLEAN-1 — de overgenomen welkomstmail (eigen volledig HTML-ontwerp) gaat ongewijzigd weg.
import { assert, assertEquals, assertFalse } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { applyVariables, extractEmailBody, isStandaloneEmailDocument } from "./emailContent.ts";
import { htmlSafeVars, mergeAutomationVars } from "./automationVars.ts";

// Zelfde vorm als de live welkomstmails: <head> met stijlen, buitenste tabel, afmeldlink in de voettekst.
const DOC = `<!DOCTYPE html>
<html lang="nl"><head><style>.h1{font-size:38px}</style></head>
<body style="margin:0;background-color:#EDEDED;">
<table role="presentation"><tr><td>
  <img src="{{tenant_logo_url}}" alt="VanXcel">
  <h1 class="h1">Klaar voor het avontuur, {{customer_first_name}}?</h1>
  <a href="{{shop_url}}">Ontdek de shop</a>
  <p><a href="{{unsubscribe_url}}">Afmelden</a></p>
  <p>&copy; {{current_year}} VanXcel</p>
</td></tr></table>
</body></html>`;

Deno.test("standalone: volledig document met eigen afmeldlink", () => {
  assert(isStandaloneEmailDocument(DOC));
  assertFalse(isStandaloneEmailDocument("<p>Hallo {{customer_first_name}}</p><p>{{unsubscribe_url}}</p>"));
  assertFalse(isStandaloneEmailDocument(DOC.replace("{{unsubscribe_url}}", "#")), "zonder afmeldlink: SellQo-voettekst nodig");
  assertFalse(isStandaloneEmailDocument(""));
});

Deno.test("standalone: enkel variabelen ingevuld, stijlen en ontwerp blijven", () => {
  const vars = htmlSafeVars(mergeAutomationVars(
    { customer_first_name: "Jan <b>", unsubscribe_url: "https://sellqo.app/mail/afmelden?t=x", tenant_logo_url: "https://cdn/logo.png" },
    { shop_url: "https://vanxcel.be" },
  ));
  const html = applyVariables(DOC, vars);
  assert(html.startsWith("<!DOCTYPE html>"));
  assert(html.includes("<style>.h1{font-size:38px}</style>"));
  assert(html.includes("Klaar voor het avontuur, Jan &lt;b&gt;?"), "voornaam ge-escaped");
  assert(html.includes('href="https://vanxcel.be"'));
  assert(html.includes('href="https://sellqo.app/mail/afmelden?t=x"'));
  assert(html.includes(`&copy; ${new Date().getFullYear()} VanXcel`), "jaartal ingevuld");
  assertFalse(/\{\{/.test(html));
  // Zelfde document, enkel de variabelen: na terugzetten identiek aan het origineel.
  const roundTrip = DOC
    .replace("{{tenant_logo_url}}", "https://cdn/logo.png")
    .replace("{{customer_first_name}}", "Jan &lt;b&gt;")
    .replace("{{shop_url}}", "https://vanxcel.be")
    .replace("{{unsubscribe_url}}", "https://sellqo.app/mail/afmelden?t=x")
    .replace("{{current_year}}", String(new Date().getFullYear()));
  assertEquals(html, roundTrip);
});

Deno.test("waarom: de gewone weg knipt zo'n document leeg", () => {
  // extractEmailBody verwijdert elke <tr> met de afmeldlink; bij één buitenste tabel is dat alles.
  const body = extractEmailBody(DOC);
  assertFalse(body.includes("Klaar voor het avontuur"));
});

Deno.test("standalone: geen logo → geen gebroken beeld", () => {
  const html = applyVariables(DOC, htmlSafeVars(mergeAutomationVars({ tenant_logo_url: "", unsubscribe_url: "u" }, {})));
  assertFalse(html.includes("<img"));
});

Deno.test("current_year: altijd gevuld bij een automationmail, nooit bij een gewone campagne", () => {
  assertEquals(mergeAutomationVars({}, {}).current_year, String(new Date().getFullYear()));
  assertEquals(mergeAutomationVars({}, { current_year: "2030" }).current_year, "2030");
  assertFalse("current_year" in mergeAutomationVars({}, null));
});
