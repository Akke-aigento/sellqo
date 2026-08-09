// Printful webhook receiver. Printful API v1 offers no request signing, so
// authentication is a per-tenant secret carried in the URL (?t=&k=) whose
// SHA-256 hash is compared in constant time against
// tenant_printful_credentials.webhook_secret_hash.
//
// Deliberately does NOT reuse tracking-webhook: that path serves the proven
// Bol/carrier flow and must stay untouched. This is a thin, dedicated update.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';
import { sha256Hex } from '../_shared/printfulApi.ts';

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

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const CARRIER_ALIASES: Record<string, string> = {
  usps: 'usps',
  'united states postal service': 'usps',
  dhl: 'dhl',
  'dhl express': 'dhl',
  'dhl ecommerce': 'dhl',
  dpd: 'dpd',
  postnl: 'postnl',
  fedex: 'fedex',
  'fedex smartpost': 'fedex',
  ups: 'ups',
  'ups mail innovations': 'ups',
  bpost: 'bpost',
  gls: 'gls',
};

function normalizeCarrier(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  if (CARRIER_ALIASES[key]) return CARRIER_ALIASES[key];
  return key.replace(/\s+/g, '_');
}

function unhyphenToUuid(v: string): string | null {
  const s = v.trim().toLowerCase();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(s)) return s;
  if (!/^[0-9a-f]{32}$/.test(s)) return null;
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

interface PrintfulShipment {
  tracking_number?: string | null;
  tracking_url?: string | null;
  carrier?: string | null;
  service?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const url = new URL(req.url);
    const tenantId = url.searchParams.get('t');
    const secret = url.searchParams.get('k');
    if (!tenantId || !secret) return json({ error: 'Unauthorized' }, 401);

    const { data: cred, error: credErr } = await admin
      .from('tenant_printful_credentials')
      .select('webhook_secret_hash')
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (credErr || !cred?.webhook_secret_hash) return json({ error: 'Unauthorized' }, 401);

    const providedHash = await sha256Hex(secret);
    if (!timingSafeEqual(providedHash, cred.webhook_secret_hash)) {
      return json({ error: 'Unauthorized' }, 401);
    }

    // From here on: authenticated. Everything below acks with 200 so Printful
    // does not retry forever on data we cannot process.
    let payload: {
      type?: string;
      data?: {
        order?: { id?: number; external_id?: string; status?: string };
        reason?: string;
        shipment?: PrintfulShipment;
      };
    };
    try {
      payload = await req.json();
    } catch {
      return json({ received: true, ignored: 'invalid_json' });
    }

    const type = payload?.type ?? '';
    const KNOWN = [
      'package_shipped', 'order_canceled', 'order_failed',
      'order_refunded', 'order_put_hold', 'order_remove_hold',
    ];
    if (!KNOWN.includes(type)) return json({ received: true, ignored: type || 'unknown' });

    const pfOrderId = payload.data?.order?.id ?? null;
    const externalId = payload.data?.order?.external_id ?? null;

    // Match the link row, always scoped to this tenant.
    let link: { id: string; order_id: string; tenant_id: string } | null = null;
    if (pfOrderId) {
      const { data } = await admin
        .from('printful_order_links')
        .select('id, order_id, tenant_id')
        .eq('tenant_id', tenantId)
        .eq('printful_order_id', pfOrderId)
        .maybeSingle();
      link = data ?? null;
    }
    if (!link && externalId) {
      const asUuid = unhyphenToUuid(externalId);
      if (asUuid) {
        const { data } = await admin
          .from('printful_order_links')
          .select('id, order_id, tenant_id')
          .eq('tenant_id', tenantId)
          .eq('order_id', asUuid)
          .maybeSingle();
        link = data ?? null;
      }
    }
    if (!link) {
      console.log('[printful-webhook] no matching link', { type, pfOrderId, hasExternal: !!externalId });
      return json({ received: true, ignored: 'no_match' });
    }
    // Tenant binding double-check.
    if (link.tenant_id !== tenantId) return json({ error: 'Forbidden' }, 403);

    const nowIso = new Date().toISOString();

    if (type === 'package_shipped') {
      const shipment = payload.data?.shipment ?? {};
      const trackingNumber = shipment.tracking_number?.toString().trim() || null;
      const trackingUrl = shipment.tracking_url?.toString().trim() || null;
      const carrier = normalizeCarrier(shipment.carrier ?? shipment.service);

      const { data: order } = await admin
        .from('orders')
        .select('id, status, tracking_number, shipped_at')
        .eq('id', link.order_id)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (!order) return json({ received: true, ignored: 'order_missing' });

      // Idempotent: same tracking number already stored → nothing to do.
      if (trackingNumber && order.tracking_number === trackingNumber) {
        return json({ received: true, idempotent: true });
      }

      // Status only ever moves forward.
      const movesToShipped = order.status === 'pending' || order.status === 'processing';
      const update: Record<string, unknown> = {
        tracking_status: 'shipped',
        updated_at: nowIso,
      };
      if (trackingNumber) update.tracking_number = trackingNumber;
      if (trackingUrl) update.tracking_url = trackingUrl;
      if (carrier) update.carrier = carrier;
      if (!order.shipped_at) update.shipped_at = nowIso;
      if (movesToShipped) update.status = 'shipped';

      const { error: updErr } = await admin
        .from('orders')
        .update(update)
        .eq('id', link.order_id)
        .eq('tenant_id', tenantId);
      if (updErr) {
        console.error('[printful-webhook] order update failed:', updErr.message);
        return json({ received: true, error: 'update_failed' });
      }

      if (movesToShipped) {
        const { data: settings } = await admin
          .from('tenant_tracking_settings')
          .select('notify_on_shipped')
          .eq('tenant_id', tenantId)
          .maybeSingle();
        if (settings?.notify_on_shipped !== false) {
          try {
            await admin.functions.invoke('send-customer-message', {
              body: { order_id: link.order_id, message_type: 'order_shipped' },
            });
          } catch (notifyErr) {
            console.error('[printful-webhook] notify error (non-fatal):', (notifyErr as Error)?.message);
          }
        }
      }

      return json({ received: true, shipped: true, notified: movesToShipped });
    }

    // Fulfilment-side statuses: only the link row is touched, never the order.
    const reason = payload.data?.reason?.toString().slice(0, 500) ?? null;
    const linkUpdate: Record<string, unknown> = { updated_at: nowIso };
    if (type === 'order_canceled') {
      linkUpdate.status = 'canceled';
      linkUpdate.last_error = reason ?? 'geannuleerd bij Printful';
    } else if (type === 'order_failed') {
      linkUpdate.status = 'failed';
      linkUpdate.last_error = reason ?? 'mislukt bij Printful';
    } else if (type === 'order_refunded') {
      linkUpdate.last_error = 'refunded bij Printful';
    } else if (type === 'order_put_hold') {
      linkUpdate.last_error = 'on hold bij Printful';
    } else if (type === 'order_remove_hold') {
      linkUpdate.last_error = null;
    }

    const { error: linkErr } = await admin
      .from('printful_order_links')
      .update(linkUpdate)
      .eq('id', link.id)
      .eq('tenant_id', tenantId);
    if (linkErr) console.error('[printful-webhook] link update failed:', linkErr.message);

    return json({ received: true, type });
  } catch (err) {
    // Post-verification failures still ack: Printful retries indefinitely on non-2xx.
    const msg = (err as Error)?.message ?? JSON.stringify(err);
    console.error('[printful-webhook] error:', msg);
    return json({ received: true, error: 'internal' });
  }
});
