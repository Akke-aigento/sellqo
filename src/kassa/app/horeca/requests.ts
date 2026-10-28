// QR-REKENING-1 — tafelaanvragen: wat gasten via de QR aan tafel bestellen, wachtend op de bediening.
//
// - Lezen: samen met de rekeningen, enkel als horeca_state.version veranderde (store.refresh).
// - Bevestigen = één serverfunctie (horeca_table_request_accept): de lijnen komen als ontwerp op de
//   rekening van die tafel (zelfde regels als aantikken), idempotent en met een rijlock, zodat twee
//   kassa's tegelijk nooit dubbele lijnen geven. Daarna verstuurt dit toestel precies die lijnen als
//   ronde (keukenbonnen per post; op een GKS-kassa eerst ondertekend).
// - Lukt het versturen niet (offline, zwarte doos), dan staan de lijnen al veilig op de rekening als
//   "nog niet verstuurd": niets gaat verloren, de bediening verstuurt ze zelf.
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { sendRound, type ActionCtx, type ActionOutcome } from './actions';

export interface TableRequestItem { product_id: string; variant_id: string | null; qty: number; name: string; unit_price_cents: number; addons: { name: string }[] }
export interface TableRequest {
  id: string;
  dining_table_id: string | null;
  table_label: string;
  items: TableRequestItem[];
  item_count: number;
  total_cents: number;
  guest_name: string | null;
  note: string | null;
  created_at: string;
}

/** Per tafel gegroepeerd, de tafel met de oudste aanvraag eerst. */
export function groupByTable(reqs: TableRequest[]): { key: string; label: string; tableId: string | null; requests: TableRequest[] }[] {
  const m = new Map<string, { key: string; label: string; tableId: string | null; requests: TableRequest[] }>();
  for (const r of reqs) {
    const key = r.dining_table_id ?? `label:${r.table_label}`;
    const g = m.get(key) ?? { key, label: r.table_label, tableId: r.dining_table_id, requests: [] };
    g.requests.push(r);
    m.set(key, g);
  }
  return [...m.values()].sort((a, b) => a.requests[0].created_at.localeCompare(b.requests[0].created_at));
}

export type AcceptOutcome =
  | { ok: true; checkId: string; sent: true }
  /** Op de rekening, maar de ronde is nog niet vertrokken (reden in `send`). */
  | { ok: true; checkId: string; sent: false; send?: ActionOutcome }
  | { ok: false; error: string; code?: string };

interface AcceptResult { ok: boolean; duplicate: boolean; check_id: string; line_ids: string[]; unsent?: number; age_s?: number; version: number }

export async function acceptRequest(ctx: ActionCtx, req: Pick<TableRequest, 'id'>): Promise<AcceptOutcome> {
  const { data, error } = await supabase.rpc('horeca_table_request_accept' as never, {
    p_tenant_id: ctx.store.tenantId, p_device_id: ctx.store.deviceId, p_request_id: req.id, p_staff_id: ctx.staffId,
  } as never);
  if (error) return { ok: false, error: error.message, code: (error as { code?: string }).code };
  const r = data as unknown as AcceptResult;
  await ctx.store.refresh();
  // line_ids = wat dit toestel (nog) moet versturen. Al bevestigd door een ander toestel: dat
  // verstuurt; wachten er na 30 s nog lijnen, dan meldt de kassa het (versturen vanaf de rekening).
  if (!r.line_ids?.length) {
    return r.duplicate && (r.unsent ?? 0) > 0 && (r.age_s ?? 0) >= 30
      ? { ok: true, checkId: r.check_id, sent: false, send: { ok: false, reason: 'server', detail: 'other_device' } as ActionOutcome }
      : { ok: true, checkId: r.check_id, sent: true };
  }
  const sent = await sendRound(ctx, r.check_id, new Set(r.line_ids));
  return sent.ok ? { ok: true, checkId: r.check_id, sent: true } : { ok: true, checkId: r.check_id, sent: false, send: sent };
}

export async function rejectRequest(ctx: ActionCtx, req: Pick<TableRequest, 'id'>, reason: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc('horeca_table_request_reject' as never, {
    p_tenant_id: ctx.store.tenantId, p_request_id: req.id, p_staff_id: ctx.staffId, p_reason: reason,
  } as never);
  if (error) return { ok: false, error: error.message };
  await ctx.store.refresh();
  return { ok: true };
}

/** Instelling van de zaak (Bestellen › QR): automatisch bevestigen. Standaard uit. */
export function useAutoAccept(tenantId: string | undefined): boolean {
  const { data } = useQuery({
    queryKey: ['kassa-qr-auto-accept', tenantId],
    enabled: !!tenantId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data: row, error } = await supabase.from('fulfillment_settings' as never)
        .select('qr_mode, qr_flow, qr_auto_accept').eq('tenant_id' as never, tenantId as never).maybeSingle();
      if (error) throw error;
      const r = row as { qr_mode?: string; qr_flow?: string; qr_auto_accept?: boolean } | null;
      return r?.qr_mode === 'order' && r?.qr_flow === 'check' && r?.qr_auto_accept === true;
    },
  });
  return data === true;
}
