// KEUKEN-VEILIG-1 — printerfouten zichtbaar maken. Tot nu toe zag enkel het beheer (Kassa › Bon & printers)
// of een printer online was; een bon die niet afdrukte (print_jobs.status = 'failed') of bleef hangen
// (queued, de printer haalt niets op) merkte niemand in de zaak. Pure functie + hook: één lichte vraag
// per 30 s, enkel als het scherm zichtbaar is en enkel bij zaken met een actieve printer.
import { useQuery } from '@tanstack/react-query';
// KASSA-MOBIEL-1: de client van de omgeving (kassa-client in de kassa, anders beheer).
import { useSupabaseClient } from '@/lib/supabaseScope';

export interface PrinterRow { id: string; name: string; is_active: boolean; last_seen_at: string | null }
export interface PrintJobRow { id: string; printer_id: string; status: string; created_at: string }

/** Een CloudPRNT-printer peilt om de paar seconden; 2 minuten stil = offline (zoals Bon & printers). */
export const PRINTER_ONLINE_MS = 120_000;
/** Een bon die zo lang in de wachtrij staat, is niet afgedrukt. */
export const JOB_STUCK_MS = 90_000;
/** Hoe ver terug een mislukte afdruk nog meetelt. */
export const JOB_WINDOW_MS = 3 * 3600_000;

export interface PrintHealth {
  failed: number;
  stuck: number;
  /** Namen van actieve printers die niet meer peilen. */
  offline: string[];
  /** Tijdstip van het jongste probleem (ms): "gezien" verbergt alles tot er iets nieuws is. */
  latestMs: number;
}

export function printHealth(printers: PrinterRow[], jobs: PrintJobRow[], nowMs: number): PrintHealth {
  const active = printers.filter((p) => p.is_active);
  const ids = new Set(active.map((p) => p.id));
  let latestMs = 0;
  let failed = 0;
  let stuck = 0;
  for (const j of jobs) {
    if (!ids.has(j.printer_id)) continue;
    const at = new Date(j.created_at).getTime();
    if (nowMs - at > JOB_WINDOW_MS) continue;
    if (j.status === 'failed') { failed++; latestMs = Math.max(latestMs, at); }
    else if ((j.status === 'queued' || j.status === 'printing') && nowMs - at > JOB_STUCK_MS) { stuck++; latestMs = Math.max(latestMs, at); }
  }
  const offline = active.filter((p) => !p.last_seen_at || nowMs - new Date(p.last_seen_at).getTime() > PRINTER_ONLINE_MS);
  for (const p of offline) latestMs = Math.max(latestMs, p.last_seen_at ? new Date(p.last_seen_at).getTime() + PRINTER_ONLINE_MS : 1);
  return { failed, stuck, offline: offline.map((p) => p.name), latestMs };
}

export const hasPrintProblem = (h: PrintHealth, ackMs: number) => (h.failed > 0 || h.stuck > 0 || h.offline.length > 0) && h.latestMs > ackMs;

export function usePrintHealth(tenantId: string | null | undefined, enabled = true) {
  const supabase = useSupabaseClient();
  return useQuery({
    queryKey: ['print-health', tenantId],
    enabled: enabled && !!tenantId,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    queryFn: async (): Promise<PrintHealth | null> => {
      const { data: pr, error } = await supabase.from('printers' as never).select('id, name, is_active, last_seen_at')
        .eq('tenant_id' as never, tenantId as never).eq('is_active' as never, true as never);
      if (error) throw error;
      const printers = (pr ?? []) as unknown as PrinterRow[];
      if (!printers.length) return null;
      const since = new Date(Date.now() - JOB_WINDOW_MS).toISOString();
      const { data: jb, error: e2 } = await supabase.from('print_jobs' as never).select('id, printer_id, status, created_at')
        .eq('tenant_id' as never, tenantId as never).in('status' as never, ['failed', 'queued', 'printing'] as never)
        .gte('created_at' as never, since as never).order('created_at' as never, { ascending: false }).limit(100);
      if (e2) throw e2;
      return printHealth(printers, (jb ?? []) as unknown as PrintJobRow[], Date.now());
    },
  });
}
