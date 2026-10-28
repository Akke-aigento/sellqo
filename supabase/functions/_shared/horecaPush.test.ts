// MELDING-1 — teksten, links en samenvoeg-tags van horeca-meldingen.
import { buildHorecaPush, HORECA_EVENTS, HORECA_PUSH_TEXTS } from "./horecaPush.ts";
// Bron: src/i18n/languages.ts (SUPPORTED_LANGUAGES). Een nieuwe taal daar hoort ook in HORECA_PUSH_TEXTS.
import { LANG_CODES } from "../../../src/i18n/languages.ts";
import { webPushTopic } from "./webpush.ts";

const assert = (c: unknown, m: string) => { if (!c) throw new Error(m); };
const LANGS: string[] = [...LANG_CODES];

Deno.test("elke ondersteunde taal heeft elke tekst, voor elk event", () => {
  assert(LANGS.length >= 5, `talen niet gevonden: ${LANGS}`);
  for (const lang of LANGS) {
    assert(HORECA_PUSH_TEXTS[lang], `taal ${lang} ontbreekt in HORECA_PUSH_TEXTS`);
    for (const e of HORECA_EVENTS) {
      const m = buildHorecaPush(e, { table: "4", station: "Bar", items: 2, count: 3, amount_cents: 1250, tip_cents: 100, ref: "abcdef12-x", rest_open: true }, lang, "11111111-2222");
      assert(m && m.title && m.body && m.url && m.tag, `${lang}/${e}: ${JSON.stringify(m)}`);
      assert(!/undefined|null|NaN/.test(m!.title + m!.body), `${lang}/${e}: ${m!.title} | ${m!.body}`);
    }
  }
});

Deno.test("onbekende taal → Nederlands, onbekend event → null", () => {
  const m = buildHorecaPush("qr_request", { table: "4", count: 1 }, "xx");
  assert(m?.title === "QR-bestelling wacht", JSON.stringify(m));
  assert(buildHorecaPush("iets", {}, "nl") === null, "onbekend event");
});

Deno.test("samenvoegen: nieuwe bonnen per post één tag, klare bonnen en betalingen elk een eigen", () => {
  const a = buildHorecaPush("ticket_new", { station: "Keuken", count: 1 }, "nl", "aaaaaaaa-1");
  const b = buildHorecaPush("ticket_new", { station: "Keuken", count: 2 }, "nl", "aaaaaaaa-1");
  const c = buildHorecaPush("ticket_new", { station: "Bar", count: 1 }, "nl", "bbbbbbbb-1");
  assert(a!.tag === b!.tag && a!.tag !== c!.tag, `${a!.tag} ${b!.tag} ${c!.tag}`);
  assert(b!.title === "Keuken: 2 nieuwe bonnen", b!.title);
  const r1 = buildHorecaPush("ticket_ready", { ref: "11111111-a" }, "nl");
  const r2 = buildHorecaPush("ticket_ready", { ref: "22222222-a" }, "nl");
  assert(r1!.tag !== r2!.tag, "klare bonnen niet samenvoegen");
  assert(buildHorecaPush("qr_request", { count: 3 }, "nl")!.title === "3 QR-bestellingen wachten", "teller");
});

Deno.test("links per soort toestel: kassa → /kassa, post → keuken, gsm → admin (nooit kassa koppelen)", () => {
  assert(buildHorecaPush("ticket_new", {}, "nl", null, "phone")!.url === "/admin/keuken", "nieuwe bon");
  for (const e of ["qr_request", "ticket_ready", "paid_online"]) assert(buildHorecaPush(e, {}, "nl", null, "kassa")!.url === "/kassa", `kassa ${e}`);
  assert(buildHorecaPush("ticket_ready", {}, "nl", null, "station")!.url === "/admin/keuken", "post");
  for (const e of ["qr_request", "paid_online"]) assert(!buildHorecaPush(e, {}, "nl", null, "phone")!.url.startsWith("/kassa"), `gsm ${e}`);
});

Deno.test("klantnaam zonder het woord tafel", () => {
  const m = buildHorecaPush("ticket_ready", { customer: "Jansen" }, "nl");
  assert(m!.title === "Klaar: Jansen", m!.title);
  assert(buildHorecaPush("ticket_ready", { table: "4", customer: "Jansen" }, "nl")!.title === "Klaar: tafel 4", "tafel wint");
});

Deno.test("online betaald: bedrag, fooi, en 'rest' enkel als de rekening openblijft", () => {
  const open = buildHorecaPush("paid_online", { table: "S1", amount_cents: 1250, tip_cents: 100, rest_open: true }, "nl");
  assert(open!.title === "Tafel S1 betaalde online", open!.title);
  assert(/12,50/.test(open!.body) && /1,00 fooi/.test(open!.body) && /rest/.test(open!.body), open!.body);
  const closed = buildHorecaPush("paid_online", { table: "S1", amount_cents: 1250, rest_open: false }, "nl");
  assert(!/rest|fooi/.test(closed!.body), closed!.body);
  assert(buildHorecaPush("qr_request", {}, "nl")!.body.startsWith("Zonder tafel"), "zonder tafel");
});

Deno.test("web push Topic: 32 base64url-tekens, vast per tag (Apple weigerde 'sq-ticket-default': BadWebPushTopic)", async () => {
  const tags = ["sq-qr", "sq-ticket-default", "sq-ticket-3d8cf072", "sq-ready-", "sq-paid-abc", "0f0e1d2c-3b4a-5968-7766-554433221100"];
  const seen = new Set<string>();
  for (const tag of tags) {
    const t = await webPushTopic(tag);
    assert(/^[A-Za-z0-9_-]{32}$/.test(t), `topic voor ${tag} ongeldig: ${t}`);
    assert(t === await webPushTopic(tag), `topic voor ${tag} niet stabiel`);
    seen.add(t);
  }
  assert(seen.size === tags.length, "twee tags geven hetzelfde topic");
});
