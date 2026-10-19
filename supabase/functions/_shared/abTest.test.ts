// MAIL-2d — A/B-test van het onderwerp: plan, verdeling, winnaar.
import { assert, assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { abDecisionDue, assignVariants, pickAbWinner, planAbTest, subjectForRow } from "./abTest.ts";

const camp = { kind: "campaign", subject_b: "Onderwerp B", ab_test_percent: 20, ab_wait_hours: 4, available_languages: ["nl"] };

Deno.test("plan: 20% van 1000 = 100 per variant, rest 800", () => {
  const p = planAbTest(camp, 1000);
  assertEquals([p.enabled, p.perVariant, p.testSize, p.remainder, p.minAudience], [true, 100, 200, 800, 1000]);
});

Deno.test("plan: te klein, meertalig, automation, geen onderwerp B", () => {
  assertEquals(planAbTest(camp, 999).reason, "too_small");
  assertEquals(planAbTest(camp, 999).enabled, false);
  assertEquals(planAbTest({ ...camp, available_languages: ["nl", "fr"] }, 5000).reason, "multi_language");
  assertEquals(planAbTest({ ...camp, kind: "automation" }, 5000).reason, "automation");
  assertEquals(planAbTest({ ...camp, subject_b: "  " }, 5000).reason, "off");
  // Percentage en wachttijd binnen de grenzen.
  const p = planAbTest({ ...camp, ab_test_percent: 90, ab_wait_hours: 99 }, 5000);
  assertEquals([p.percent, p.waitHours, p.perVariant, p.remainder], [50, 24, 1250, 2500]);
  assertEquals(planAbTest({ ...camp, ab_test_percent: 50 }, 401).perVariant, 100);
});

Deno.test("verdeling: exact perVariant A en B, de rest hold, iedereen één keer", () => {
  const rows = Array.from({ length: 1234 }, (_, i) => ({ email: `k${i}@x.be` }));
  const plan = planAbTest(camp, rows.length);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const out = assignVariants(rows, plan, rnd);
  const count = (v: string) => out.filter((r) => r.variant === v).length;
  assertEquals([count("A"), count("B"), count("hold")], [123, 123, 988]);
  assertEquals(new Set(out.map((r) => r.email)).size, rows.length);
  // Willekeurig: de A-groep is niet gewoon het begin van de lijst.
  assert(out.filter((r) => r.variant === "A").some((r) => Number(r.email.slice(1).split("@")[0]) >= 246));
  let threw = false;
  try { assignVariants(rows, planAbTest(camp, 10)); } catch { threw = true; }
  assert(threw, "zonder geldig plan geen verdeling");
});

Deno.test("winnaar: klikratio, dan openratio, dan A", () => {
  assertEquals(pickAbWinner({ sent: 100, opened: 50, clicked: 5 }, { sent: 100, opened: 20, clicked: 6 }), "B");
  // Ratio, niet absoluut: 5/100 > 6/150.
  assertEquals(pickAbWinner({ sent: 100, opened: 10, clicked: 5 }, { sent: 150, opened: 90, clicked: 6 }), "A");
  assertEquals(pickAbWinner({ sent: 100, opened: 30, clicked: 4 }, { sent: 100, opened: 31, clicked: 4 }), "B");
  assertEquals(pickAbWinner({ sent: 100, opened: 30, clicked: 4 }, { sent: 200, opened: 60, clicked: 8 }), "A");
  assertEquals(pickAbWinner({ sent: 0, opened: 0, clicked: 0 }, { sent: 0, opened: 0, clicked: 0 }), "A");
  assertEquals(pickAbWinner({ sent: 0, opened: 0, clicked: 0 }, { sent: 10, opened: 1, clicked: 0 }), "B");
});

Deno.test("wachttijd en onderwerp per rij", () => {
  const start = "2026-10-20T08:00:00Z";
  assertEquals(abDecisionDue(start, 4, new Date("2026-10-20T11:59:59Z")), false);
  assertEquals(abDecisionDue(start, 4, new Date("2026-10-20T12:00:00Z")), true);
  assertEquals(abDecisionDue(null, 4, new Date()), false);
  const c = { subject: "A!", subject_b: "B!", ab_started_at: start, ab_winner: null as string | null };
  assertEquals([subjectForRow(c, "A"), subjectForRow(c, "B"), subjectForRow(c, null)], ["A!", "B!", "A!"]);
  assertEquals(subjectForRow({ ...c, ab_winner: "B" }, null), "B!");
  // Zonder gestarte test: altijd A, ook als er een onderwerp B ingevuld staat.
  assertEquals(subjectForRow({ ...c, ab_started_at: null }, "B"), "A!");
});
