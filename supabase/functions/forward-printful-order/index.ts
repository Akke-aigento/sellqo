import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';
import { authenticateRequest, requireRole, AuthError, authErrorResponse } from '../_shared/auth.ts';
import { decryptPrintfulToken } from '../_shared/printfulCrypto.ts';
import { isAuthorizedCronRequest, CRON_ALLOWED_HEADERS } from '../_shared/cronAuth.ts';

// Versiestempel voor de neveneffectvrije deploy-vingerafdruk (GET).
// PRINTFUL-AUTO-1: automatisch doorsturen. PRINTFUL-AUTO-2: annuleren, gemengde orders,
// kostenraming, eigen meldingstypes (push + mail).
const VERSION = 'printful-auto-2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': CRON_ALLOWED_HEADERS,
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const STATE_REQUIRED = ['US', 'CA', 'AU'];

type Action = 'forward' | 'cancel' | 'estimate';

interface Body {
  action?: Action;
  tenantId?: string;
  orderId?: string;
  confirm?: boolean;
  auto?: boolean;
  /** Handmatig: enkel de regels met een Printful-koppeling doorsturen (gemengde bestelling). */
  partial?: boolean;
  /** estimate: regels om te ramen. */
  items?: Array<{ sync_variant_id: number; quantity?: number }>;
  country_code?: string;
  zip?: string;
}

// ── Meldingen ──────────────────────────────────────────────────────────
// Eigen types (integrations/printful_*), zodat de winkel ze apart kan instellen. Prioriteit
// urgent/high = push én mail zonder eigen voorkeursrij (notificationDefaults.planEmail).
async function notify(
  admin: SupabaseClient,
  tenantId: string,
  orderId: string,
  type: 'printful_order_failed' | 'printful_order_canceled' | 'printful_cancel_failed',
  priority: 'medium' | 'high' | 'urgent',
  title: (number: string) => string,
  message: string,
): Promise<void> {
  const { data: order } = await admin.from('orders').select('order_number').eq('id', orderId).maybeSingle();
  const number = order?.order_number ?? orderId.slice(0, 8);
  const { error } = await admin.from('notifications').insert({
    tenant_id: tenantId,
    category: 'integrations',
    type,
    priority,
    title: title(number),
    message,
    action_url: `/admin/orders/${orderId}`,
    data: { order_id: orderId, dedupe_key: `${type}:${orderId}` },
  });
  if (error) console.error(`[forward-printful-order] notify ${type}:`, error.message);
}

// Mislukte automatische forward: link op 'failed' (de vroege returns schrijven zelf geen
// link) en een dringende melding. Geen automatische retry: opnieuw = de knop op de order.
async function markAutoFailed(admin: SupabaseClient, tenantId: string, orderId: string, error: string): Promise<void> {
  const now = new Date().toISOString();
  const { error: linkErr } = await admin.from('printful_order_links')
    .update({ status: 'failed', last_error: error, updated_at: now })
    .eq('tenant_id', tenantId).eq('order_id', orderId)
    .in('status', ['queued', 'forwarding', 'failed']).is('printful_order_id', null);
  if (linkErr) console.error('[forward-printful-order] markAutoFailed link:', linkErr.message);
  await notify(admin, tenantId, orderId, 'printful_order_failed', 'urgent',
    (n) => `Bestelling ${n} niet naar Printful`,
    `${error} De bestelling wordt NIET geproduceerd tot dit opgelost is. Open de bestelling en klik op "Opnieuw proberen".`);
}

// Foutstatus schrijven zonder een bevestigde of al aangemaakte Printful-order te
// overschrijven: die bestaat bij Printful, dus enkel de foutmelding bijwerken.
async function writeFailed(admin: SupabaseClient, tenantId: string, orderId: string, externalId: string, msg: string): Promise<void> {
  const now = new Date().toISOString();
  const { data: link } = await admin.from('printful_order_links')
    .select('status, printful_order_id').eq('tenant_id', tenantId).eq('order_id', orderId).maybeSingle();
  if (link && (link.status === 'confirmed' || link.printful_order_id)) {
    await admin.from('printful_order_links').update({ last_error: msg, updated_at: now })
      .eq('tenant_id', tenantId).eq('order_id', orderId);
    return;
  }
  await admin.from('printful_order_links').upsert({
    tenant_id: tenantId, order_id: orderId, external_id: externalId, status: 'failed', last_error: msg,
    updated_at: now,
  }, { onConflict: 'tenant_id,order_id' });
}

async function loadPrintful(admin: SupabaseClient, tenantId: string):
  Promise<{ headers: Record<string, string> } | { error: Response }> {
  const { data: settings } = await admin
    .from('tenant_printful_settings').select('printful_sync_enabled').eq('tenant_id', tenantId).maybeSingle();
  if (!settings?.printful_sync_enabled) {
    return { error: json({ success: false, error: 'De Printful-koppeling staat uit. Zet de koppeling aan in SellQo Connect → Fulfilment.' }, 400) };
  }
  const { data: cred, error: credErr } = await admin
    .from('tenant_printful_credentials').select('token_ciphertext, store_id').eq('tenant_id', tenantId).maybeSingle();
  if (credErr) throw new Error(credErr.message);
  if (!cred) return { error: json({ success: false, error: 'Geen Printful-verbinding geconfigureerd' }, 400) };
  let token: string;
  try {
    token = await decryptPrintfulToken(cred.token_ciphertext);
  } catch {
    return { error: json({ success: false, error: 'Opgeslagen token kon niet worden ontsleuteld' }, 400) };
  }
  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  if (cred.store_id) headers['X-PF-Store-Id'] = cred.store_id;
  return { headers };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method === 'GET') return json({ ok: true, version: VERSION });

  let autoCtx: { admin: SupabaseClient; tenantId: string; orderId: string } | null = null;
  try {
    const body = await req.json() as Body;
    const action: Action = body.action ?? 'forward';
    const { tenantId, orderId } = body;
    if (!tenantId) return json({ success: false, error: 'tenantId is verplicht' }, 400);
    if (action !== 'estimate' && !orderId) return json({ success: false, error: 'orderId is verplicht' }, 400);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const isAuto = body.auto === true;
    if (isAuto) {
      if (!(await isAuthorizedCronRequest(req, admin))) {
        return json({ success: false, error: 'Unauthorized' }, 401);
      }
    } else if (action === 'estimate' && await isAuthorizedCronRequest(req, admin)) {
      // Raming zonder neveneffect: ook met het interne secret (analyse, kostprijs vullen).
    } else {
      const auth = await authenticateRequest(req, tenantId);
      requireRole(auth, tenantId, action === 'forward' ? ['tenant_admin', 'staff'] : ['tenant_admin']);
    }

    if (action === 'estimate') return await estimateCosts(admin, tenantId, body);
    if (action === 'cancel') return await cancelAtPrintful(admin, tenantId, orderId!, isAuto);

    if (isAuto) {
      // Automatisch pad: enkel vanuit de DB-trigger (printful_auto_forward_order), die vooraf
      // een 'queued'-link claimde. Atomair queued → forwarding; enkel wie omzet, gaat verder.
      const { data: claimed, error: claimErr } = await admin.from('printful_order_links')
        .update({ status: 'forwarding', updated_at: new Date().toISOString() })
        .eq('tenant_id', tenantId).eq('order_id', orderId!).eq('status', 'queued')
        .select('id');
      if (claimErr) throw new Error(claimErr.message);
      if (!claimed || claimed.length === 0) {
        return json({ success: true, skipped: 'not_queued' });
      }
      autoCtx = { admin, tenantId, orderId: orderId! };
      const res = await forwardOrder(admin, tenantId, orderId!, body.confirm, true, false);
      if (!res.ok) {
        const b = await res.clone().json().catch(() => null) as { error?: string } | null;
        await markAutoFailed(admin, tenantId, orderId!, b?.error ?? `Fout ${res.status}`);
      }
      return res;
    }

    // Handmatig pad: niet tussen een lopende automatische forward of annulering komen, en een
    // bevestigde order niet opnieuw sturen (Printful produceert ze al).
    const { data: existing } = await admin.from('printful_order_links')
      .select('status').eq('tenant_id', tenantId).eq('order_id', orderId!).maybeSingle();
    if (existing?.status === 'queued' || existing?.status === 'forwarding') {
      return json({ success: false, error: 'Deze bestelling wordt al automatisch doorgestuurd. Wacht even en ververs de pagina.' }, 409);
    }
    if (existing?.status === 'canceling') {
      return json({ success: false, error: 'Deze bestelling wordt bij Printful geannuleerd. Wacht even en ververs de pagina.' }, 409);
    }
    if (existing?.status === 'confirmed' || existing?.status === 'cancel_failed') {
      return json({ success: false, error: 'Deze bestelling staat al bevestigd bij Printful.' }, 409);
    }
    return await forwardOrder(admin, tenantId, orderId!, body.confirm, false, body.partial === true);
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err, corsHeaders);
    const msg = (err as Error)?.message ?? JSON.stringify(err);
    console.error('[forward-printful-order] error:', msg);
    if (autoCtx) await markAutoFailed(autoCtx.admin, autoCtx.tenantId, autoCtx.orderId, msg).catch(() => {});
    return json({ success: false, error: msg }, 500);
  }
});

// ── Doorsturen ─────────────────────────────────────────────────────────
async function forwardOrder(
  admin: SupabaseClient,
  tenantId: string,
  orderId: string,
  confirm: boolean | undefined,
  autoMode: boolean,
  partial: boolean,
): Promise<Response> {
    // 1. Settings + credentials
    const { data: settings } = await admin
      .from('tenant_printful_settings')
      .select('printful_sync_enabled, auto_confirm, auto_forward_orders')
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (!settings?.printful_sync_enabled) {
      return json({ success: false, error: 'De Printful-koppeling staat uit. Zet de koppeling aan in SellQo Connect → Fulfilment.' }, 400);
    }
    if (autoMode && !settings.auto_forward_orders) {
      return json({ success: false, error: 'Automatisch doorsturen staat uit voor deze winkel.' }, 400);
    }
    if (autoMode) {
      // Tussen claim en forward kan de order nog geannuleerd of terugbetaald zijn.
      const { data: st } = await admin.from('orders')
        .select('payment_status, status').eq('id', orderId).maybeSingle();
      if (st?.status === 'cancelled' || st?.payment_status === 'refunded') {
        // PRINTFUL-AUTO-2: geannuleerd of volledig terugbetaald vóór het doorsturen. Niets
        // besteld, dus geen alarm en geen "Opnieuw proberen": de link wordt 'canceled'.
        await admin.from('printful_order_links')
          .update({ status: 'canceled', last_error: 'Geannuleerd of terugbetaald vóór het doorsturen: niets bij Printful besteld.', updated_at: new Date().toISOString() })
          .eq('tenant_id', tenantId).eq('order_id', orderId).eq('status', 'forwarding');
        return json({ success: true, skipped: 'cancelled_before_forward' });
      }
      if (st?.payment_status !== 'paid' || st?.status === 'returned') {
        // Gedeeltelijk terugbetaald, betaling in behandeling of geretourneerd: de winkel beslist.
        return json({ success: false, error: 'De betaalstatus van de bestelling veranderde vóór het doorsturen (bv. gedeeltelijk terugbetaald). Kijk ze na en stuur ze zelf door als ze gemaakt moet worden.' }, 409);
      }
    }

    const pf = await loadPrintful(admin, tenantId);
    if ('error' in pf) return pf.error;
    const headers = pf.headers;

    // 2. Order + items
    const { data: order, error: orderErr } = await admin
      .from('orders')
      .select('id, tenant_id, order_number, shipping_address, shipping_cost, discount_amount, customer_email, customer_phone, customer_name')
      .eq('id', orderId)
      .maybeSingle();
    if (orderErr) throw new Error(orderErr.message);
    if (!order) return json({ success: false, error: 'Bestelling niet gevonden' }, 404);
    if (order.tenant_id !== tenantId) return json({ success: false, error: 'Bestelling hoort niet bij deze winkel' }, 403);

    const { data: items, error: itemsErr } = await admin
      .from('order_items')
      .select('id, product_name, variant_id, gift_card_id, quantity, unit_price')
      .eq('order_id', orderId);
    if (itemsErr) throw new Error(itemsErr.message);

    const physical = (items ?? []).filter((i) => !i.gift_card_id);
    if (physical.length === 0) {
      return json({ success: false, error: 'Deze bestelling bevat geen producten die naar Printful kunnen worden gestuurd (alleen cadeaukaarten).' }, 422);
    }

    const variantIds = physical.map((i) => i.variant_id).filter((v): v is string => !!v);
    const { data: mappings, error: mapErr } = await admin
      .from('printful_variant_mappings')
      .select('variant_id, printful_sync_variant_id')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .in('variant_id', variantIds.length ? variantIds : ['00000000-0000-0000-0000-000000000000']);
    if (mapErr) throw new Error(mapErr.message);
    const mapByVariant = new Map((mappings ?? []).map((m) => [m.variant_id, Number(m.printful_sync_variant_id)]));

    const problems: Array<{ item: string; reason: string }> = [];
    const pfItems: Array<{ sync_variant_id: number; quantity: number; retail_price: string }> = [];
    for (const it of physical) {
      const sv = it.variant_id ? mapByVariant.get(it.variant_id) : undefined;
      if (!sv) {
        problems.push({ item: it.product_name ?? it.id, reason: it.variant_id ? 'Geen Printful-koppeling' : 'Geen variant' });
        continue;
      }
      pfItems.push({ sync_variant_id: sv, quantity: it.quantity, retail_price: Number(it.unit_price).toFixed(2) });
    }
    if (pfItems.length === 0) {
      return json({ success: false, error: 'Geen enkel product in deze bestelling is aan Printful gekoppeld.', problems }, 422);
    }
    if (problems.length > 0 && !partial) {
      // PRINTFUL-AUTO-2: gemengde bestelling. De admin biedt dan "Enkel Printful-producten
      // doorsturen" aan (partial), de rest verstuurt de winkel zelf.
      return json({
        success: false,
        code: 'mixed_order',
        error: `Deze bestelling bevat ook producten zonder Printful-koppeling (${problems.map((p) => p.item).join(', ')}). Koppel ze eerst, of stuur enkel de Printful-producten door en verstuur de rest zelf.`,
        problems,
      }, 422);
    }

    // 4. Recipient
    const addr = (order.shipping_address ?? {}) as Record<string, unknown>;
    const str = (k: string) => {
      const v = addr[k];
      return typeof v === 'string' && v.trim() ? v.trim() : null;
    };
    const fullName = [str('first_name'), str('last_name')].filter(Boolean).join(' ');
    // Custom frontends (Loveke) sturen een adres zonder naam mee; dan de klantnaam van de
    // order, en pas als laatste de bedrijfsnaam.
    const orderName = typeof order.customer_name === 'string' && order.customer_name.trim() ? order.customer_name.trim() : null;
    const company = str('company');
    const name = str('name') ?? (fullName || null) ?? orderName ?? company;
    const address1 = str('address1') ?? str('street') ?? str('line1');
    const city = str('city');
    const zip = str('zip') ?? str('postal_code') ?? str('postcode');
    const countryRaw = str('country_code') ?? str('country');
    const country_code = countryRaw ? countryRaw.toUpperCase().slice(0, 2) : null;
    const missing: string[] = [];
    if (!name) missing.push('naam');
    if (!address1) missing.push('straat en huisnummer');
    if (!city) missing.push('plaats');
    if (!zip) missing.push('postcode');
    if (!country_code) missing.push('land');
    const state_code = str('state_code') ?? str('state') ?? str('province');
    if (country_code && STATE_REQUIRED.includes(country_code) && !state_code) missing.push('staat/provincie');
    if (missing.length > 0) {
      return json({ success: false, error: `Verzendadres is onvolledig: ${missing.join(', ')} ontbreekt.` }, 422);
    }

    const recipient: Record<string, unknown> = {
      name, address1, city, zip, country_code,
      ...(company && company !== name ? { company } : {}),
      ...(str('address2') || str('line2') ? { address2: str('address2') ?? str('line2') } : {}),
      ...(country_code && STATE_REQUIRED.includes(country_code) && state_code ? { state_code } : {}),
      ...(str('phone') || order.customer_phone ? { phone: str('phone') ?? order.customer_phone } : {}),
      ...(order.customer_email ? { email: order.customer_email } : {}),
    };

    // Pakbon: wat de klant betaalde. Korting enkel bij een volledige forward (bij partial
    // is niet te zeggen welk deel van de korting bij de Printful-regels hoort).
    const subtotal = pfItems.reduce((s, i) => s + Number(i.retail_price) * i.quantity, 0);
    const shipping = partial ? 0 : Number(order.shipping_cost ?? 0);
    const discount = partial ? 0 : Math.min(Number(order.discount_amount ?? 0), subtotal + shipping);
    const shouldConfirm = confirm === true || settings.auto_confirm === true;
    const external_id = orderId.replace(/-/g, '');

    const url = `https://api.printful.com/orders?update_existing=true${shouldConfirm ? '&confirm=true' : ''}`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          external_id,
          recipient,
          items: pfItems,
          retail_costs: {
            subtotal: subtotal.toFixed(2),
            discount: discount.toFixed(2),
            shipping: shipping.toFixed(2),
            total: (subtotal - discount + shipping).toFixed(2),
          },
        }),
      });
    } catch {
      const msg = 'Kan geen verbinding maken met Printful';
      await writeFailed(admin, tenantId, orderId, external_id, msg);
      return json({ success: false, error: msg }, 502);
    }

    const body = await res.json().catch(() => null) as
      | { result?: { id?: number; status?: string; costs?: unknown }; error?: { message?: string } }
      | null;

    if (!res.ok) {
      const msg = res.status === 401 || res.status === 403
        ? 'Token is ongeldig of verlopen'
        : (body?.error?.message ? `Printful: ${body.error.message}` : `Printful gaf een fout terug (status ${res.status})`);
      await writeFailed(admin, tenantId, orderId, external_id, msg);
      return json({ success: false, error: msg }, res.status === 401 || res.status === 403 ? 400 : 502);
    }

    const pfOrderId = body?.result?.id ?? null;
    const pfStatus = (body?.result?.status ?? '').toLowerCase();
    const status = shouldConfirm && pfStatus !== 'draft' ? 'confirmed' : 'draft';
    const now = new Date().toISOString();

    const { error: linkErr } = await admin.from('printful_order_links').upsert({
      tenant_id: tenantId,
      order_id: orderId,
      external_id,
      printful_order_id: pfOrderId,
      status,
      last_error: partial ? `Enkel de Printful-producten doorgestuurd; verstuur zelf: ${problems.map((p) => p.item).join(', ')}.` : null,
      forwarded_at: now,
      confirmed_at: status === 'confirmed' ? now : null,
      updated_at: now,
    }, { onConflict: 'tenant_id,order_id' });
    if (linkErr) {
      // De order staat al bij Printful: nooit als "niet doorgestuurd" melden. Loggen; de
      // Printful-webhook koppelt later op external_id.
      console.error('[forward-printful-order] link write after success failed:', linkErr.message);
    }

    // PRINTFUL-AUTO-2: werd de order geannuleerd of terugbetaald terwijl ze onderweg was naar
    // Printful, dan meteen weer annuleren (de annuleertrigger zag toen nog geen order daar).
    const { data: after } = autoMode
      ? await admin.from('orders').select('status, payment_status').eq('id', orderId).maybeSingle()
      : { data: null };
    // Enkel bij automatisch doorsturen: een bewuste handmatige forward (bv. een vervangzending
    // voor een terugbetaalde order) wordt nooit stil teruggedraaid.
    if (autoMode && !linkErr && (after?.status === 'cancelled' || after?.payment_status === 'refunded')) {
      const { data: claimed } = await admin.from('printful_order_links')
        .update({ status: 'canceling', updated_at: new Date().toISOString() })
        .eq('tenant_id', tenantId).eq('order_id', orderId).in('status', ['confirmed', 'draft'])
        .select('id');
      if (claimed && claimed.length > 0) await cancelAtPrintful(admin, tenantId, orderId, true);
    }

    return json({ success: true, printful_order_id: pfOrderId, status, costs: body?.result?.costs ?? null });
}

// ── Annuleren ──────────────────────────────────────────────────────────
// Auto (DB-trigger bij annuleren/volledige terugbetaling): de trigger zette de link al op
// 'canceling'. Handmatig (knop): hier atomair confirmed/draft → canceling.
// Printful annuleert enkel zolang de productie niet gestart is; daarna blijft de kost.
async function cancelAtPrintful(admin: SupabaseClient, tenantId: string, orderId: string, autoMode: boolean): Promise<Response> {
  const { data: link } = await admin.from('printful_order_links')
    .select('status, external_id, printful_order_id, confirmed_at, updated_at')
    .eq('tenant_id', tenantId).eq('order_id', orderId).maybeSingle();
  if (!link) return json({ success: false, error: 'Deze bestelling staat niet bij Printful.' }, 404);
  const restore = link.confirmed_at ? 'confirmed' : 'draft';

  if (!autoMode) {
    const { data: claimed } = await admin.from('printful_order_links')
      .update({ status: 'canceling', updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId).eq('order_id', orderId).in('status', ['confirmed', 'draft', 'cancel_failed'])
      .select('id');
    if (!claimed || claimed.length === 0) {
      return json({ success: false, error: 'Deze bestelling kan niet (meer) geannuleerd worden bij Printful.' }, 409);
    }
  } else {
    // Auto: de trigger zette 'canceling'. Atomair "pakken" via updated_at, zodat een dubbele
    // aanroep geen tweede DELETE doet (en geen vals "annuleren mislukt" geeft).
    if (link.status !== 'canceling') return json({ success: true, skipped: 'not_canceling' });
    const { data: mine } = await admin.from('printful_order_links')
      .update({ updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId).eq('order_id', orderId).eq('status', 'canceling').eq('updated_at', link.updated_at)
      .select('id');
    if (!mine || mine.length === 0) return json({ success: true, skipped: 'already_handled' });
  }

  const fail = async (reason: string, status: number): Promise<Response> => {
    const msg = `Annuleren bij Printful lukte niet: ${reason}`;
    await admin.from('printful_order_links')
      .update({ status: autoMode ? 'cancel_failed' : restore, last_error: msg, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId).eq('order_id', orderId).eq('status', 'canceling');
    if (autoMode) {
      await notify(admin, tenantId, orderId, 'printful_cancel_failed', 'urgent',
        (n) => `Bestelling ${n}: Printful niet geannuleerd`,
        `De bestelling is geannuleerd of terugbetaald, maar Printful kon ze niet meer annuleren (${reason}). Waarschijnlijk is de productie al gestart: kijk in Printful. Lukt het daar niet meer, dan blijft de Printful-kost.`);
    }
    return json({ success: false, error: msg }, status);
  };

  const pf = await loadPrintful(admin, tenantId);
  if ('error' in pf) {
    const b = await pf.error.clone().json().catch(() => null) as { error?: string } | null;
    return await fail(b?.error ?? 'koppeling niet beschikbaar', 400);
  }

  const ref = link.printful_order_id ? String(link.printful_order_id) : `@${link.external_id}`;
  let res: Response;
  try {
    // ref is numeriek of '@' + hex-external_id: veilig in de URL, en '@' niet encoderen.
    res = await fetch(`https://api.printful.com/orders/${ref}`, { method: 'DELETE', headers: pf.headers });
  } catch {
    return await fail('geen verbinding met Printful', 502);
  }
  const body = await res.json().catch(() => null) as { error?: { message?: string } } | null;
  if (!res.ok) {
    return await fail(body?.error?.message ?? `status ${res.status}`, 502);
  }

  await admin.from('printful_order_links')
    .update({ status: 'canceled', last_error: null, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId).eq('order_id', orderId).eq('status', 'canceling');
  if (autoMode) {
    await notify(admin, tenantId, orderId, 'printful_order_canceled', 'medium',
      (n) => `Bestelling ${n} geannuleerd bij Printful`,
      'De bestelling is geannuleerd of terugbetaald, en ook bij Printful geannuleerd. Er wordt niets geproduceerd.');
  }
  return json({ success: true, status: 'canceled' });
}

// ── Kostenraming (geen neveneffect) ────────────────────────────────────
// Printfuls eigen raming: productkost incl. prints, verzending en btw, voor een adres in het
// opgegeven land. Basis voor marge-analyse en de inkoopprijs in SellQo.
async function estimateCosts(admin: SupabaseClient, tenantId: string, body: Body): Promise<Response> {
  const items = (body.items ?? []).filter((i) => Number.isFinite(Number(i.sync_variant_id)));
  if (items.length === 0 || items.length > 50) {
    return json({ success: false, error: 'Geef 1 tot 50 regels mee (sync_variant_id, quantity).' }, 400);
  }
  const pf = await loadPrintful(admin, tenantId);
  if ('error' in pf) return pf.error;
  const country = (body.country_code ?? 'BE').toUpperCase().slice(0, 2);
  const res = await fetch('https://api.printful.com/orders/estimate-costs', {
    method: 'POST',
    headers: pf.headers,
    body: JSON.stringify({
      recipient: { name: 'Raming', address1: 'Raming 1', city: 'Raming', zip: body.zip ?? '3000', country_code: country },
      items: items.map((i) => ({ sync_variant_id: Number(i.sync_variant_id), quantity: Math.max(1, Number(i.quantity ?? 1)) })),
    }),
  });
  const out = await res.json().catch(() => null) as { result?: unknown; error?: { message?: string } } | null;
  if (!res.ok) {
    return json({ success: false, error: out?.error?.message ?? `Printful gaf status ${res.status}` }, 502);
  }
  return json({ success: true, country_code: country, result: out?.result ?? null });
}
