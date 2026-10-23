// EVENT-REMINDER-2 — WhatsApp-groeplink per eventdatum.
//
// De herinneringsmail op de dag van het event (edge function send-event-reminder)
// toont een knop naar deze link. Alleen uitnodigingslinks van een groep
// (chat.whatsapp.com/<code>) zijn toegelaten. WhatsApp plakt er bij "Delen"
// trackingparameters achter (?s=sh&p=i...); die halen we weg.

const GROUP_LINK = /^(?:https?:\/\/)?chat\.whatsapp\.com\/([A-Za-z0-9]{10,40})\/?(?:[?#].*)?$/i;

export type WhatsappLinkResult =
  | { ok: true; value: string | null }
  | { ok: false };

/** Leeg = geen link (null). Anders een nette https-link of ongeldig. */
export function normalizeWhatsappGroupLink(input: string | null | undefined): WhatsappLinkResult {
  const raw = (input ?? '').trim();
  if (raw === '') return { ok: true, value: null };
  // Bij "kopieer link" komt er soms tekst voor: "Open this link to join my WhatsApp Group: https://..."
  const urlStart = raw.search(/(?:https?:\/\/)?chat\.whatsapp\.com\//i);
  const candidate = urlStart >= 0 ? raw.slice(urlStart).split(/\s/)[0] : raw;
  const m = GROUP_LINK.exec(candidate);
  if (!m) return { ok: false };
  return { ok: true, value: `https://chat.whatsapp.com/${m[1]}` };
}
