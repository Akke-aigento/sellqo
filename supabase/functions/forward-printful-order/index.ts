import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';
import { authenticateRequest, requireRole, AuthError, authErrorResponse } from '../_shared/auth.ts';
import { decryptPrintfulToken } from '../_shared/printfulCrypto.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const STATE_REQUIRED = ['US', 'CA', 'AU'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { tenantId, orderId, confirm } = await req.json() as {
      tenantId?: string; orderId?: string; confirm?: boolean;
    };
    if (!tenantId) return json({ success: false, error: 'tenantId is verplicht' }, 400);
    if (!orderId) return json({ success: false, error: 'orderId is verplicht' }, 400);

    const auth = await authenticateRequest(req, tenantId);
    requireRole(auth, tenantId, ['tenant_admin', 'staff']);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 1. Settings + credentials
    const { data: settings } = await admin
      .from('tenant_printful_settings')
      .select('printful_sync_enabled, auto_confirm')
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (!settings?.printful_sync_enabled) {
      return json({ success: false, error: 'De Printful-koppeling staat uit. Zet de koppeling aan in SellQo Connect → Fulfilment.' }, 400);
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
      .select('id, tenant_id, order_number, shipping_address, shipping_cost, customer_email, customer_phone')
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
    const name = str('name') ?? (fullName || null);
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
      await admin.from('printful_order_links').upsert({
        tenant_id: tenantId, order_id: orderId, external_id, status: 'failed', last_error: msg,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'tenant_id,order_id' });
      return json({ success: false, error: msg }, 502);
    }

    const body = await res.json().catch(() => null) as
      | { result?: { id?: number; status?: string; costs?: unknown }; error?: { message?: string } }
      | null;

    if (!res.ok) {
      const msg = res.status === 401 || res.status === 403
        ? 'Token is ongeldig of verlopen'
        : (body?.error?.message ? `Printful: ${body.error.message}` : `Printful gaf een fout terug (status ${res.status})`);
      await admin.from('printful_order_links').upsert({
        tenant_id: tenantId, order_id: orderId, external_id, status: 'failed', last_error: msg,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'tenant_id,order_id' });
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
    if (linkErr) throw new Error(linkErr.message);

    return json({ success: true, printful_order_id: pfOrderId, status, costs: body?.result?.costs ?? null });
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err, corsHeaders);
    const msg = (err as Error)?.message ?? JSON.stringify(err);
    console.error('[forward-printful-order] error:', msg);
    return json({ success: false, error: msg }, 500);
  }
});
