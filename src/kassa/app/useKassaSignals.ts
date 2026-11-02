// MELDING-1 — wat de bediening op de open kassa moet merken: een nieuwe QR-bestelling, een bon die
// klaar is, en een gast die online betaalde. Telkens een melding in beeld, en een belletje (met
// trilling) als geluid op dit toestel aan staat.
//
// Last: QR-aanvragen komen al mee met de gewone poll (store.requests). Klare bonnen en online
// betalingen: één kleine vraag per 10 s over het laatste uur, enkel als het scherm zichtbaar is
// (geen realtime, zie de kostenlessen). De eerste lading telt nooit als nieuw.
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
// KASSA-MOBIEL-1: de kassa-client (eigen sessie van het toestel), niet de beheer-sessie.
import { kassaSupabase as supabase } from '@/kassa/app/kassaSupabase';
import { ding } from '@/lib/ding';
import { formatEuro } from './horeca/format';
import type { TableCall, TableRequest } from './horeca/requests';

const POLL_MS = 10_000;
const WINDOW_MS = 60 * 60_000;

export function useKassaSignals(tenantId: string, requests: TableRequest[], requestsLoaded: boolean, sound: boolean, /** OBER-ROEPEN-1 */ calls?: TableCall[] | null) {
  const { t, i18n } = useTranslation();
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const seenReq = useRef<Set<string> | null>(null);

  // QR-bestellingen: nieuw = een id die we nog niet zagen. De nulmeting pas na de eerste echte
  // lading: wat bij het openen van de kassa al openstond, is niet nieuw.
  useEffect(() => {
    if (!requestsLoaded) return;
    const ids = requests.map((r) => r.id);
    if (seenReq.current === null) { seenReq.current = new Set(ids); return; }
    const fresh = requests.filter((r) => !seenReq.current!.has(r.id));
    ids.forEach((id) => seenReq.current!.add(id));
    if (!fresh.length) return;
    if (soundRef.current) ding();
    const tables = [...new Set(fresh.map((r) => r.table_label))].join(', ');
    toast(t('kassa.signals.qr', { tables }), { duration: 8000 });
  }, [requests, requestsLoaded, t]);

  // OBER-ROEPEN-1: een tafel roept de bediening of vraagt de rekening (ook opnieuw na 2 min).
  // Nieuw = een id + aantal keren geroepen dat we nog niet zagen. null = nog niet geladen.
  const seenCall = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!calls) return;
    const keys = calls.map((c) => `${c.id}:${c.repeat_count}`);
    if (seenCall.current === null) { seenCall.current = new Set(keys); return; }
    const fresh = calls.filter((c) => !seenCall.current!.has(`${c.id}:${c.repeat_count}`));
    keys.forEach((k) => seenCall.current!.add(k));
    if (!fresh.length) return;
    if (soundRef.current) ding();
    for (const c of fresh) toast(t(c.kind === 'bill' ? 'kassa.calls.bill' : 'kassa.calls.waiter', { label: c.table_label }), { duration: 10000 });
  }, [calls, t]);

  // Klare bonnen en online betalingen: alles van het laatste uur, en enkel melden wat dit toestel nog
  // niet zag (id + tijdstip). Geen cursor op tijd: status_at komt van de klok van het keukentoestel,
  // en twee toestellen met een verschillende klok mogen elkaar geen meldingen laten missen.
  // KEUKEN-VEILIG-1b: de barpost werkt een bon in één tik af (nieuw → afgewerkt, zonder 'klaar'). Zo'n
  // bon telt ook als "klaar" voor de bediening; stond hij al eerder op klaar, dan geen tweede melding.
  useEffect(() => {
    const seen = new Set<string>();
    const readyIds = new Set<string>();
    let barIds: string[] | null = null;
    let primed = false;
    let alive = true;
    let busy = false;
    const tick = async () => {
      if (busy || document.visibilityState !== 'visible') return;
      busy = true;
      try {
        if (barIds === null) {
          const st = await supabase.from('prep_stations').select('id').eq('tenant_id', tenantId).eq('kind', 'bar');
          if (!alive || st.error) return;
          barIds = ((st.data ?? []) as { id: string }[]).map((x) => x.id);
        }
        const since = new Date(Date.now() - WINDOW_MS).toISOString();
        const tickets = supabase.from('kitchen_tickets').select('id, table_label, customer_label, status, status_at').eq('tenant_id', tenantId);
        const [ready, paid] = await Promise.all([
          (barIds.length ? tickets.or(`status.eq.ready,and(status.eq.done,station_id.in.(${barIds.join(',')}))`) : tickets.eq('status', 'ready'))
            .gt('status_at', since).order('status_at', { ascending: false }).limit(50),
          supabase.from('check_online_payments' as never).select('id, table_label, amount_cents, tip_cents, paid_at')
            .eq('tenant_id' as never, tenantId as never).eq('status' as never, 'paid' as never).gt('paid_at' as never, since as never)
            .order('paid_at' as never, { ascending: false }).limit(50),
        ]);
        if (!alive || ready.error || paid.error) return; // bij een fout: volgende keer opnieuw, niets is als gezien gemarkeerd
        const rows = (ready.data ?? []) as { id: string; table_label: string | null; customer_label: string | null; status?: string; status_at: string }[];
        // Een afgewerkte barbon enkel als hij nooit als "klaar" voorbijkwam (geen dubbele melding).
        const keyOf = (x: (typeof rows)[number]) => (x.status === 'done' ? `d:${x.id}` : `r:${x.id}:${x.status_at}`);
        const r = rows.filter((x) => !seen.has(keyOf(x)) && !(x.status === 'done' && readyIds.has(x.id)));
        rows.forEach((x) => { if (x.status !== 'done') readyIds.add(x.id); });
        const p = ((paid.data ?? []) as unknown as { id: string; table_label: string | null; amount_cents: number; tip_cents: number }[])
          .filter((x) => !seen.has(`p:${x.id}`));
        r.forEach((x) => seen.add(keyOf(x)));
        p.forEach((x) => seen.add(`p:${x.id}`));
        // De eerste lading telt nooit als nieuw.
        if (!primed) { primed = true; return; }
        if ((r.length || p.length) && soundRef.current) ding();
        for (const x of [...r].reverse()) {
          const label = x.table_label ? t('kassa.requests.table', { label: x.table_label }) : (x.customer_label ?? '—');
          toast.success(t('kassa.signals.ready', { label }), { duration: 10000 });
        }
        for (const x of [...p].reverse()) {
          toast.success(t('kassa.signals.paid', { label: x.table_label ? t('kassa.requests.table', { label: x.table_label }) : '—', amount: formatEuro(x.amount_cents + x.tip_cents, i18n.language) }), { duration: 10000 });
        }
      } finally {
        busy = false;
      }
    };
    void tick();
    const id = setInterval(() => { void tick(); }, POLL_MS);
    return () => { alive = false; clearInterval(id); };
  }, [tenantId, t, i18n.language]);
}
