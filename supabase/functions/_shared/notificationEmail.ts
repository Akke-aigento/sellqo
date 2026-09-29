// UNIFIED-MAIL-1 — de meldingsmail aan de winkel (create-notification).
//
// Alle categorieën behalve `messages`: exact de vorige opbouw, verhuisd uit
// create-notification (render-diff: byte-gelijk). De witruimte in `legacyIntro`
// is die van de oude template-string en hoort bij de bytes van de mail.
//
// `messages` (een klant schreef): afzender, een fragment van het bericht, de
// knop "Bericht openen" en de regel dat antwoorden op deze mail niet bij de klant
// komen — deze mail komt van info@sellqo.app, niet uit de inbox van de winkel.
//
// Puur op de client in loadMessageEmailInfo na; gedeeld met vitest.

import { renderSellqoEmail, htmlToPlainText } from "./sellqoEmail.ts";
import { t } from "./tenantEmailI18n.ts";
import { parseFromHeader, resolveSenderName } from "./senderName.ts";

export interface MessageEmailInfo {
  senderName: string | null;
  senderAddress: string | null;
  fragment: string | null;
}

export interface NotificationEmailInput {
  notification: { category: string; title: string; message: string };
  priority: string;
  tenantName: string;
  fullActionUrl: string | null;
  /** Alleen bij categorie `messages`; zonder afzender of fragment de oude mail. */
  messageInfo?: MessageEmailInfo | null;
  /** Taal van de winkel (`tenants.language`); alleen voor de nieuwe teksten. */
  locale?: string | null;
}

const EMAIL_LOCALES = new Set(["nl", "en", "fr", "de"]);
/** `t()` valt bij een onbekende taal terug op Engels; hier is dat Nederlands. */
export function notificationLocale(value: string | null | undefined): string {
  const v = (value ?? "").trim().toLowerCase().slice(0, 2);
  return EMAIL_LOCALES.has(v) ? v : "nl";
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const ENTITIES: Record<string, string> = { "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" };

/** ±`max` tekens platte tekst: HTML weg, witruimte samengevoegd, afgekapt op een woordgrens. Niet ge-escaped. */
export function messageFragment(raw: string | null | undefined, max = 200): string | null {
  if (!raw) return null;
  const text = raw
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6])>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(nbsp|amp|lt|gt|quot|#39);/g, (m) => ENTITIES[m] ?? m)
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return null;
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

function priorityBanner(priority: string): string {
  return priority === 'urgent'
    ? `<div style="background-color:#fee2e2;color:#dc2626;padding:12px 16px;border-radius:6px;margin:0 0 16px;font-weight:600;">⚠️ Urgente melding — directe aandacht vereist</div>`
    : priority === 'high'
      ? `<div style="background-color:#ffedd5;color:#ea580c;padding:12px 16px;border-radius:6px;margin:0 0 16px;font-weight:600;">Hoge prioriteit</div>`
      : '';
}

const I10 = "          ";
const I8 = "        ";

function legacyIntro(banner: string, tenantName: string, message: string): string {
  return `\n${I10}${banner}\n${I10}<p style="margin:0 0 12px;font-size:13px;color:#5b6b7d;">Melding voor <strong>${tenantName}</strong></p>\n${I10}<p style="margin:0;">${message}</p>\n${I8}`;
}

function hasMessageInfo(info: MessageEmailInfo | null | undefined): info is MessageEmailInfo {
  return !!info && !!(info.senderName || info.senderAddress || info.fragment);
}

export function buildNotificationEmail(input: NotificationEmailInput): { html: string; text: string } {
  const { notification, priority, tenantName, fullActionUrl } = input;
  const banner = priorityBanner(priority);
  const preheader = `${notification.title} — ${tenantName}`;
  const footerNote = `Je ontvangt deze e-mail omdat e-mailnotificaties voor ${notification.category} aanstaan.`;

  if (notification.category !== 'messages' || !hasMessageInfo(input.messageInfo)) {
    const html = renderSellqoEmail({
      preheader,
      heading: notification.title,
      intro: legacyIntro(banner, tenantName, notification.message),
      cta: fullActionUrl ? { label: 'Bekijk details', url: fullActionUrl } : undefined,
      footerNote,
    });
    return { html, text: htmlToPlainText(html) };
  }

  const info = input.messageInfo;
  const locale = notificationLocale(input.locale);
  const name = info.senderName?.trim() || null;
  const address = info.senderAddress?.trim() || null;
  const sender = name && address && name.toLowerCase() !== address.toLowerCase()
    ? `${escapeHtml(name)} &lt;${escapeHtml(address)}&gt;`
    : escapeHtml(name || address || "");

  const intro = [
    banner,
    `<p style="margin:0 0 12px;font-size:13px;color:#5b6b7d;">Melding voor <strong>${tenantName}</strong></p>`,
    sender ? `<p style="margin:0 0 12px;"><strong>${escapeHtml(t(locale, 'inboxNotification.from'))}:</strong> ${sender}</p>` : "",
    info.fragment
      ? `<p style="margin:0;padding:12px 16px;border-left:3px solid #d0d7e2;background-color:#f6f8fb;border-radius:4px;color:#1a2332;">${escapeHtml(info.fragment)}</p>`
      : `<p style="margin:0;">${notification.message}</p>`,
  ].filter(Boolean).join("\n");

  const html = renderSellqoEmail({
    preheader,
    heading: notification.title,
    intro,
    cta: fullActionUrl ? { label: t(locale, 'inboxNotification.openMessage'), url: fullActionUrl } : undefined,
    ctaNote: escapeHtml(t(locale, 'inboxNotification.replyInSellqo')),
    footerNote,
  });
  return { html, text: htmlToPlainText(html) };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/**
 * Afzender en fragment voor een berichtmelding. Bron (UNIFIED-MAIL-1):
 * - `data.message_id` (e-mail, contactformulier) → de rij in customer_messages,
 *   gefilterd op de winkel, met de klantnaam;
 * - anders (WhatsApp, Meta) wat er al in `data` staat: `message_preview`,
 *   `from_phone`, en de klantnaam via `data.customer_id`.
 * Er wordt niets nieuws in notifications opgeslagen. Geen bron → null (oude mail).
 */
export async function loadMessageEmailInfo(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  tenantId: string,
  data: Record<string, unknown> | null | undefined,
): Promise<MessageEmailInfo | null> {
  const d = data ?? {};
  const messageId = str(d.message_id);
  if (messageId && UUID_RE.test(messageId)) {
    const { data: row, error } = await supabase
      .from('customer_messages')
      .select('from_email, body_text, body_html, context_data, customers(first_name, last_name, email)')
      .eq('id', messageId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (error) console.warn('[notificationEmail] bericht niet gelezen:', error.message);
    if (row) {
      const customer = row.customers as { first_name?: string | null; last_name?: string | null; email?: string | null } | null;
      const address = parseFromHeader(row.from_email).address || null;
      return {
        senderName: resolveSenderName({
          customerName: [customer?.first_name, customer?.last_name].filter(Boolean).join(' '),
          contextName: (row.context_data as Record<string, unknown> | null)?.name,
          from: row.from_email,
          fallback: address,
        }),
        senderAddress: address,
        fragment: messageFragment(str(row.body_text) ?? str(row.body_html)),
      };
    }
  }

  const preview = str(d.message_preview);
  const phone = str(d.from_phone);
  let customerName: string | null = null;
  const customerId = str(d.customer_id);
  if (customerId && UUID_RE.test(customerId)) {
    const { data: customer } = await supabase
      .from('customers')
      .select('first_name, last_name')
      .eq('id', customerId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    customerName = [customer?.first_name, customer?.last_name].filter(Boolean).join(' ') || null;
  }
  if (!preview && !phone && !customerName) return null;
  return { senderName: customerName, senderAddress: phone, fragment: messageFragment(preview) };
}
