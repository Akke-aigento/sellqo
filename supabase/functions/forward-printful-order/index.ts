import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';
import { authenticateRequest, requireRole, AuthError, authErrorResponse } from '../_shared/auth.ts';
import { decryptPrintfulToken } from '../_shared/printfulCrypto.ts';
import { isAuthorizedCronRequest, CRON_ALLOWED_HEADERS } from '../_shared/cronAuth.ts';

// PRINTFUL-AUTO-1 — versiestempel voor de neveneffectvrije deploy-vingerafdruk (GET).
const VERSION = 'printful-auto-1';

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

// PRINTFUL-AUTO-1 — mislukte automatische forward: link op 'failed' zetten (de vroege
// returns hieronder schrijven zelf geen link) en de winkel een melding geven. Geen
// automatische retry: de claim-rij blijft bestaan, opnieuw proberen = de knop op de order.
async function markAutoFailed(admin: SupabaseClient, tenantId: string, orderId: string, error: string): Promise<void> {
  const now = new Date().toISOString();
  const { error: linkErr } = await admin.from('printful_order_links')
    .update({ status: 'failed', last_error: error, updated_at: now })
    .eq('tenant_id', tenantId).eq('order_id', orderId)
    .in('status', ['queued', 'forwarding', 'failed']).is('printful_order_id', null);
  if (linkErr) console.error('[forward-printful-order] markAutoFailed link:', linkErr.message);

  const { data: order } = await admin.from('orders').select('order_number').eq('id', orderId).maybeSingle();
  const number = order?.order_number ?? orderId.slice(0, 8);
  const { error: nErr } = await admin.from('notifications').insert({
    tenant_id: tenantId,
    category: 'integrations',
    type: 'integration_error',
    priority: 'high',
    title: `Bestelling ${number} niet doorgestuurd naar Printful`,
    message: `${error} Los dit op en klik in de bestelling op "Opnieuw proberen".`,
    action_url: `/admin/orders/${orderId}`,
    data: { order_id: orderId, dedupe_key: `printful_forward:${orderId}` },
  });
  if (nErr && (nErr as { code?: string }).code !== '23505') {
    console.error('[forward-printful-order] markAutoFailed notify:', nErr.message);
  }
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method === 'GET') return json({ ok: true, version: VERSION });

  let autoCtx: { admin: SupabaseClient; tenantId: string; orderId: string } | null = null;
  try {
    const { tenantId, orderId, confirm, auto } = await req.json() as {
      tenantId?: string; orderId?: string; confirm?: boolean; auto?: boolean;
    };
    if (!tenantId) return json({ success: false, error: 'tenantId is verplicht' }, 400);
    if (!orderId) return json({ success: false, error: 'orderId is verplicht' }, 400);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    if (auto === true) {
      // Automatisch pad: enkel vanuit de DB-trigger (printful_auto_forward_order) met het
      // interne secret. Die heeft vooraf een 'queued'-link geclaimd; zonder claim niets doen,
      // zodat een dubbele aanroep nooit een tweede (betaalde) Printful-order maakt.
      if (!(await isAuthorizedCronRequest(req, admin))) {
        return json({ success: false, error: 'Unauthorized' }, 401);
      }
      // Atomaire claim: queued → forwarding. Enkel wie de rij omzet, gaat verder.
      const { data: claimed, error: claimErr } = await admin.from('printful_order_links')
        .update({ status: 'forwarding', updated_at: new Date().toISOString() })
        .eq('tenant_id', tenantId).eq('order_id', orderId).eq('status', 'queued')
        .select('id');
      if (claimErr) throw new Error(claimErr.message);
      if (!claimed || claimed.length === 0) {
        return json({ success: true, skipped: 'not_queued' });
      }
      autoCtx = { admin, tenantId, orderId };
      const res = await forwardOrder(admin, tenantId, orderId, confirm, true);
      if (!res.ok) {
        const body = await res.clone().json().catch(() => null) as { error?: string } | null;
        await markAutoFailed(admin, tenantId, orderId, body?.error ?? `Fout ${res.status}`);
      }
      return res;
    }

    const auth = await authenticateRequest(req, tenantId);
    requireRole(auth, tenantId, ['tenant_admin', 'staff']);
    // Handmatig pad: niet tussen een lopende automatische forward komen, en een bevestigde
    // order niet opnieuw sturen (Printful produceert ze al; een fout zou 'm als mislukt tonen).
    const { data: existing } = await admin.from('printful_order_links')
      .select('status').eq('tenant_id', tenantId).eq('order_id', orderId).maybeSingle();
    if (existing?.status === 'queued' || existing?.status === 'forwarding') {
      return json({ success: false, error: 'Deze bestelling wordt al automatisch doorgestuurd. Wacht even en ververs de pagina.' }, 409);
    }
    if (existing?.status === 'confirmed') {
      return json({ success: false, error: 'Deze bestelling staat al bevestigd bij Printful.' }, 409);
    }
    return await forwardOrder(admin, tenantId, orderId, confirm, false);
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err, corsHeaders);
    const msg = (err as Error)?.message ?? JSON.stringify(err);
    console.error('[forward-printful-order] error:', msg);
    if (autoCtx) await markAutoFailed(autoCtx.admin, autoCtx.tenantId, autoCtx.orderId, msg).catch(() => {});
    return json({ success: false, error: msg }, 500);
  }
});

async function forwardOrder(
  admin: SupabaseClient,
  tenantId: string,
  orderId: string,
  confirm: boolean | undefined,
  autoMode: boolean,
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
      if (st?.payment_status !== 'paid' || st?.status === 'cancelled' || st?.status === 'returned') {
        return json({ success: false, error: 'De bestelling is niet (meer) betaald of is geannuleerd.' }, 409);
      }
    }

    const { data: cred, error: credErr } = await admin
      .from('tenant_printful_credentials')
      .select('token_ciphertext, store_id')
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (credErr) throw new Error(credErr.message);
    if (!cred) return json({ success: false, error: 'Geen Printful-verbinding geconfigureerd' }, 400);

    let token: string;
    try {
      token = await decryptPrintfulToken(cred.token_ciphertext);
    } catch {
      return json({ success: false, error: 'Opgeslagen token kon niet worden ontsleuteld' }, 400);
    }

    // 2. Order + items
    const { data: order, error: orderErr } = await admin
      .from('orders')
      .select('id, tenant_id, order_number, shipping_address, shipping_cost, customer_email, customer_phone, customer_name')
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
      if (!it.variant_id) {
        problems.push({ item: it.product_name ?? it.id, reason: 'Geen variant gekoppeld' });
        continue;
      }
      const sv = mapByVariant.get(it.variant_id);
      if (!sv) {
        problems.push({ item: it.product_name ?? it.id, reason: `Geen Printful-mapping voor variant ${it.variant_id}` });
        continue;
      }
      pfItems.push({ sync_variant_id: sv, quantity: it.quantity, retail_price: Number(it.unit_price).toFixed(2) });
    }
    if (problems.length > 0) {
      return json({
        success: false,
        error: 'Niet alle regels kunnen worden doorgestuurd. Koppel eerst de varianten aan Printful.',
        problems,
      }, 422);
    }
    if (pfItems.length === 0) return json({ success: false, error: 'Geen doorstuurbare regels gevonden' }, 422);

    // 4. Recipient
    const addr = (order.shipping_address ?? {}) as Record<string, unknown>;
    const str = (k: string) => {
      const v = addr[k];
      return typeof v === 'string' && v.trim() ? v.trim() : null;
    };
    const fullName = [str('first_name'), str('last_name')].filter(Boolean).join(' ');
    // PRINTFUL-AUTO-1 — custom frontends (Loveke) sturen een adres zonder naam mee; dan de
    // klantnaam van de order, en pas als laatste de bedrijfsnaam.
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

    const subtotal = pfItems.reduce((s, i) => s + Number(i.retail_price) * i.quantity, 0);
    const shipping = Number(order.shipping_cost ?? 0);
    const shouldConfirm = confirm === true || settings.auto_confirm === true;
    const external_id = orderId.replace(/-/g, '');

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
    if (cred.store_id) headers['X-PF-Store-Id'] = cred.store_id;

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
            shipping: shipping.toFixed(2),
            total: (subtotal + shipping).toFixed(2),
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
      last_error: null,
      forwarded_at: now,
      confirmed_at: status === 'confirmed' ? now : null,
      updated_at: now,
    }, { onConflict: 'tenant_id,order_id' });
    if (linkErr) {
      // De order staat al bij Printful: nooit als "niet doorgestuurd" melden. Loggen; de
      // Printful-webhook koppelt later op external_id.
      console.error('[forward-printful-order] link write after success failed:', linkErr.message);
    }

    return json({ success: true, printful_order_id: pfOrderId, status, costs: body?.result?.costs ?? null });
}
