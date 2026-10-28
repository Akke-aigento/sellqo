// QR-REKENING-1 — één aanvraag verwerken (met melding) en het automatisch bevestigen.
// Los van RequestInbox.tsx zodat dat bestand enkel componenten exporteert.
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { ActionCtx } from './actions';
import { acceptRequest, type AcceptOutcome, type TableRequest } from './requests';

/** Verwerk één aanvraag en vertaal de uitkomst naar een melding. Gooit nooit. */
export async function runAccept(ctx: ActionCtx, r: TableRequest, t: (k: string, o?: Record<string, unknown>) => string): Promise<AcceptOutcome> {
  try {
    const o = await acceptRequest(ctx, r);
    if (!o.ok) return o;
    if ('send' in o && o.send) toast.warning(t('kassa.requests.notSent', { table: r.table_label, reason: o.send.reason ?? '' }));
    return o;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Automatisch bevestigen (instelling, standaard uit): dit toestel werkt de openstaande aanvragen
 * af, oudste eerst en één tegelijk, tot er geen meer zijn (ook wat binnenkomt terwijl het bezig
 * is). Andere toestellen mogen hetzelfde doen; de server geeft elke aanvraag maar één keer lijnen.
 *
 * Enkel aanvragen van een tafel uit het zaalplan (QR-token): een vrij tafelnummer kan iedereen
 * typen, dat blijft voor de bediening. Een aanvraag die faalt (bv. iets net op), wordt 60 s
 * overgeslagen en blijft in de inbox; een timer probeert ze daarna opnieuw.
 */
export function useAutoAcceptRunner(ctx: ActionCtx | null, enabled: boolean, requests: TableRequest[]) {
  const { t } = useTranslation();
  const running = useRef(false);
  const skipUntil = useRef(new Map<string, number>());
  const [tick, setTick] = useState(0);
  const latest = useRef(requests);
  latest.current = requests;
  const on = useRef(enabled);
  on.current = enabled;
  // Vergrendeld of andere medewerker: een lopende ronde stopt (nooit onder de vorige naam verder).
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;
  // Enkel bij het sluiten van het scherm stoppen; een nieuwe lijst (elke poll) onderbreekt de ronde niet.
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  useEffect(() => {
    if (!ctx || !enabled || running.current) return;
    const eligible = (now: number) => latest.current.find((r) => !!r.dining_table_id && (skipUntil.current.get(r.id) ?? 0) < now);
    if (!eligible(Date.now())) return;
    running.current = true;
    void (async () => {
      try {
        for (let guard = 0; guard < 300 && mounted.current && on.current && ctxRef.current === ctx; guard++) {
          const next = eligible(Date.now());
          if (!next) break;
          const o = await runAccept(ctx, next, t);
          if (!o.ok) {
            skipUntil.current.set(next.id, Date.now() + 60_000);
            toast.error(t('kassa.requests.autoFailed', { table: next.table_label, error: 'error' in o ? o.error : '' }));
          } else {
            // Ook als de refresh de lijst nog niet bijwerkte: deze aanvraag niet nog eens nemen.
            skipUntil.current.set(next.id, Date.now() + 60_000);
          }
        }
      } finally {
        running.current = false;
        // Wat intussen binnenkwam of wat na de wachttijd opnieuw mag: nog een ronde.
        if (mounted.current) setTick((x) => x + 1);
      }
    })();
  }, [ctx, enabled, requests, t, tick]);

  // Overgeslagen aanvragen na hun wachttijd opnieuw proberen, ook zonder nieuwe gebeurtenis.
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => {
      const now = Date.now();
      for (const [k, until] of skipUntil.current) if (until < now) skipUntil.current.delete(k);
      if (latest.current.some((r) => !!r.dining_table_id && !skipUntil.current.has(r.id))) setTick((x) => x + 1);
    }, 15_000);
    return () => clearInterval(id);
  }, [enabled]);
}
