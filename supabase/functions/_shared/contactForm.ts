// UNIFIED-MAIL-1 — het contactformulier van de storefront-api, verhuisd uit
// storefront-api/index.ts zodat vitest hem met een nep-client kan draaien.
// De functie is inhoudelijk ongewijzigd; `submit_contact_form` gedraagt zich
// byte-gelijk (VanXcel). Nieuw: de aliassen voor drie frontends die een
// verkeerde actienaam sturen en daardoor nooit een bericht afleverden.
//
// Puur op de meegegeven client na: geen imports.

/**
 * Tijdelijke aliassen (akkoord Akke 29-09, eerste wet: strikt additief).
 *   submit_contact — Mancini Milano (sinds 02-04), Benny Rich (sinds 18-08)
 *   contact        — Loveke (proxy-default, sinds 13-03)
 * Weg zodra die frontends `submit_contact_form` sturen (FRONTEND-CONTACT-2).
 */
export const CONTACT_FORM_ALIASES = ["submit_contact", "contact"] as const;
export type ContactFormAlias = typeof CONTACT_FORM_ALIASES[number];

export function isContactFormAlias(action: string): action is ContactFormAlias {
  return (CONTACT_FORM_ALIASES as readonly string[]).includes(action);
}

/** Velden die submitContactForm zelf leest; alles daarbuiten is "onbekend". */
const KNOWN_FIELDS = new Set(["name", "email", "subject", "message", "orderNumber", "order_number"]);
/** Sleutels die een proxy zelf toevoegt; geen formulierinhoud. */
const TRANSPORT_FIELDS = new Set(["locale", "tenant_id", "tenantId", "action"]);
export const DEFAULT_ALIAS_SUBJECT = "Contactformulier";
const MAX_EXTRA_FIELDS = 20;
const MAX_EXTRA_LENGTH = 1000;

/**
 * Payload van een alias → params voor submitContactForm + extra context.
 * Geen synoniemen (naam/bericht/telefoon …): geen van de drie frontends stuurt
 * andere veldnamen dan name/email/subject/message (recon 29-09). Een ontbrekend
 * onderwerp (Benny Rich) wordt "Contactformulier". Onbekende velden gaan niet
 * verloren maar belanden, als tekst en begrensd, in context_data.extra_fields.
 */
export function normalizeContactAlias(params: Record<string, unknown>): {
  params: Record<string, unknown>;
  extraContext: Record<string, unknown>;
} {
  const subject = typeof params.subject === "string" ? params.subject.trim() : "";
  const extra: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (KNOWN_FIELDS.has(key) || TRANSPORT_FIELDS.has(key)) continue;
    if (value === undefined || value === null || value === "") continue;
    if (Object.keys(extra).length >= MAX_EXTRA_FIELDS) break;
    const text = typeof value === "string" ? value : JSON.stringify(value);
    extra[key.slice(0, 60)] = text.slice(0, MAX_EXTRA_LENGTH);
  }
  return {
    params: { ...params, subject: subject || DEFAULT_ALIAS_SUBJECT },
    extraContext: Object.keys(extra).length ? { extra_fields: extra } : {},
  };
}

// deno-lint-ignore no-explicit-any
export async function submitContactForm(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  tenantId: string,
  params: Record<string, unknown>,
  opts: { extraContext?: Record<string, unknown> } = {},
) {
  const name = ((params.name as string) || '').trim();
  const email = ((params.email as string) || '').trim().toLowerCase();
  const subject = ((params.subject as string) || '').trim();
  const message = ((params.message as string) || '').trim();
  const orderNumber = ((params.orderNumber as string) || (params.order_number as string) || '').trim();

  if (!name || name.length > 200) return { success: false, error: 'Name is required (max 200 chars)' };
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email) || email.length > 320) return { success: false, error: 'Valid email is required' };
  if (!subject || subject.length > 300) return { success: false, error: 'Subject is required (max 300 chars)' };
  if (!message || message.length > 5000) return { success: false, error: 'Message is required (max 5000 chars)' };
  if (orderNumber && orderNumber.length > 50) return { success: false, error: 'Order number too long (max 50 chars)' };

  // Resolve tenant inbox recipient
  const { data: tenant } = await supabase
    .from('tenants')
    .select('notification_email, owner_email, name')
    .eq('id', tenantId)
    .maybeSingle();
  // MAIL-SENDER-1: owner_email is NOT NULL, dus de laatste tak is een vangnet.
  const toEmail = tenant?.notification_email || tenant?.owner_email || 'info@sellqo.app';

  // Try to link to an existing customer (optional)
  const { data: existingCustomer } = await supabase
    .from('customers')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('email', email)
    .maybeSingle();

  const escapeHtml = (s: string) => s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const bodyHtml = `<p><strong>From:</strong> ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</p>`
    + (orderNumber ? `<p><strong>Order:</strong> ${escapeHtml(orderNumber)}</p>` : '')
    + `<p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>`;

  const insertRow: Record<string, unknown> = {
    tenant_id: tenantId,
    customer_id: existingCustomer?.id || null,
    direction: 'inbound',
    channel: 'web',
    subject: subject.slice(0, 300),
    body_html: bodyHtml,
    body_text: message,
    from_email: email,
    to_email: toEmail,
    reply_to_email: email,
    // MSG-STATUS-FIX: 'received' staat niet in customer_messages_status_check;
    // elke insert faalde. Inbound berichten krijgen 'delivered', zoals inbound e-mail.
    delivery_status: 'delivered',
    message_status: 'active',
    context_type: 'contact_form',
    context_data: {
      source: 'contact_form',
      name,
      order_number: orderNumber || null,
      // UNIFIED-MAIL-1: alleen via een alias (zie normalizeContactAlias); anders leeg.
      ...(opts.extraContext ?? {}),
    },
  };

  const { data: inserted, error } = await supabase
    .from('customer_messages')
    .insert(insertRow)
    .select('id')
    .single();

  if (error) {
    console.error('[submit_contact_form] insert failed:', error);
    return { success: false, error: 'Could not submit contact form' };
  }

  // CONTACT-NOTIFY-1: melding voor de winkel, zoals bij inbound e-mail
  // (handle-inbound-email). Zonder melding zag niemand het bericht, en was er geen
  // push. Een mislukte melding laat het contactbericht niet falen: het staat al in
  // de inbox. Response ongewijzigd (eerste wet).
  const { error: notificationError } = await supabase.from('notifications').insert({
    tenant_id: tenantId,
    category: 'messages',
    type: 'contact_form_inbound',
    title: 'Nieuw contactformulier bericht',
    message: `${name}: "${subject.slice(0, 80)}${subject.length > 80 ? '...' : ''}"`,
    priority: 'medium',
    action_url: '/admin/messages',
    data: {
      message_id: inserted.id,
      from: email,
      sender_name: name,
      order_number: orderNumber || null,
      source: 'submit_contact_form',
    },
  });
  if (notificationError) {
    console.error('[submit_contact_form] notification failed:', notificationError.message);
  }

  return { success: true, message_id: inserted.id };
}
