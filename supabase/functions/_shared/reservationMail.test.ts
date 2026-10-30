// Geen netwerk: eigen mini-asserts (zoals fulfillmentSlots.test.ts).
function assert(ok: unknown, msg = "assert") { if (!ok) throw new Error(msg); }
function assertEquals(a: unknown, b: unknown) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${JSON.stringify(a)} != ${JSON.stringify(b)}`); }
function assertStringIncludes(s: string, part: string) { if (!s.includes(part)) throw new Error(`"${part}" ontbreekt in "${s}"`); }
import { RESERVATION_MAIL_LOCALES, reservationMail } from "./reservationMail.ts";

const r = { name: "Jef <b>", guests: 4, startsAt: "2026-10-31T17:30:00Z", timezone: "Europe/Brussels", shop: "Café De Wissel" };

Deno.test("RESERVATIE-2: elke e-mailtaal heeft beide uitkomsten, met lokale tijd en zonder HTML-injectie", () => {
  assertEquals(RESERVATION_MAIL_LOCALES.sort(), ["de", "en", "fr", "nl"]);
  for (const l of RESERVATION_MAIL_LOCALES) {
    for (const o of ["booked", "declined"] as const) {
      const m = reservationMail(o, r, l);
      assert(m.subject.includes("Café De Wissel"));
      assertStringIncludes(m.content, "18:30");
      assert(!m.intro.includes("<b>"), "naam wordt ge-escaped");
    }
  }
  assertStringIncludes(reservationMail("booked", r, "nl").subject, "bevestigd");
  assertStringIncludes(reservationMail("booked", r, "nl").content, "4 personen");
});
