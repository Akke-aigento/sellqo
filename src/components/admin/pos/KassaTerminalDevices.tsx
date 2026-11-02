// KASSA-ACCOUNT-1 — per kassa (Kassa (POS) › Kassa's): de toestellen die eraan hangen en "Toestel koppelen".
// Vervangt KassaDevicesStatus (LIVE-1): dezelfde hartslag (gezien, wachtend, versie), nu per gekoppeld toestel,
// met "Ontkoppelen". Koppelen = een eenmalige code (6 cijfers) + QR, 10 minuten geldig, enkel voor de zaakvoerder.
import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useTranslation } from 'react-i18next';
import QRCode from 'react-qr-code';
import { AlertTriangle, Link2, Loader2, Tablet, Unplug } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useDateFnsLocale } from '@/hooks/useDateFnsLocale';
import { cn } from '@/lib/utils';
import { isSilent, terminalDeviceRows, waitingCount, type KassaDevice, type KassaDeviceAccount } from '@/hooks/useKassaDevices';
import { formatPairCode, mmss, pairUrl, secondsLeft } from '@/kassa/app/setup';

interface PairCode { code: string; token: string; expires_at: string; created: number }

function PairDialog({ tenantId, terminal, accounts, onClose }: {
  tenantId: string; terminal: { id: string; name: string }; accounts: KassaDeviceAccount[]; onClose: () => void;
}) {
  const { t } = useTranslation();
  const [pc, setPc] = useState<PairCode | null>(null);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const create = async () => {
    setPc(null); setError(false);
    const { data, error: e } = await supabase.rpc('kassa_pair_code_create' as never, { p_tenant_id: tenantId, p_terminal_id: terminal.id } as never);
    if (e || !data) { setError(true); return; }
    setPc({ ...(data as unknown as Omit<PairCode, 'created'>), created: Date.now() });
  };
  useEffect(() => { void create(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  // Gekoppeld = een nieuw toestel op deze kassa sinds de code er is (de lijst ververst elke 3 s zolang dit open is).
  const paired = pc ? accounts.find((a) => a.terminal_id === terminal.id && new Date(a.paired_at).getTime() >= pc.created - 5_000) : undefined;
  const left = pc ? secondsLeft(pc.expires_at, now) : 0;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('admin.pos.kassaDevice.pairTitle', { name: terminal.name })}</DialogTitle>
          <DialogDescription>{t('admin.pos.kassaDevice.pairIntro')}</DialogDescription>
        </DialogHeader>
        {paired ? (
          <p role="status" className="rounded-md bg-green-50 p-3 text-sm font-medium text-green-800 dark:bg-green-950 dark:text-green-200">
            {t('admin.pos.kassaDevice.pairDone', { name: paired.name })}
          </p>
        ) : error ? (
          <p role="alert" className="text-sm text-destructive">{t('admin.pos.kassaDevice.pairFailed')}</p>
        ) : !pc ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" aria-label={t('common.loading')} /></div>
        ) : left > 0 ? (
          <div className="flex flex-col items-center gap-3">
            <p className="font-mono text-4xl font-bold tracking-[0.2em]" data-testid="pair-code">{formatPairCode(pc.code)}</p>
            <div className="rounded-lg bg-white p-3"><QRCode value={pairUrl(window.location.origin, pc.token)} size={180} /></div>
            <p className="text-sm text-muted-foreground">{t('admin.pos.kassaDevice.pairExpires', { time: mmss(left) })}</p>
          </div>
        ) : (
          <p role="status" className="text-sm text-muted-foreground">{t('admin.pos.kassaDevice.pairExpired')}</p>
        )}
        <DialogFooter className="gap-2">
          {!paired && (error || (pc && left === 0)) ? <Button variant="outline" onClick={() => void create()}>{t('admin.pos.kassaDevice.pairNew')}</Button> : null}
          <Button onClick={onClose}>{t('admin.pos.kassaDevice.close')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function KassaTerminalDevices({ tenantId, terminal, accounts, beats, canManage, onPairingChange }: {
  tenantId: string;
  terminal: { id: string; name: string };
  accounts: KassaDeviceAccount[];
  beats: KassaDevice[];
  canManage: boolean;
  /** Koppelvenster open: de lijst gekoppelde toestellen sneller verversen. */
  onPairingChange?: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const locale = useDateFnsLocale();
  const qc = useQueryClient();
  const [pairing, setPairing] = useState(false);
  const [toUnpair, setToUnpair] = useState<KassaDeviceAccount | null>(null);
  const [busy, setBusy] = useState(false);
  const rows = terminalDeviceRows(terminal.id, accounts, beats);
  const setPairingOpen = (o: boolean) => { setPairing(o); onPairingChange?.(o); };

  const unpair = async () => {
    if (!toUnpair) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('kassa-device-revoke', { body: { user_id: toUnpair.user_id } });
    setBusy(false);
    setToUnpair(null);
    if (error || !(data as { revoked?: boolean } | null)?.revoked) toast.error(t('admin.pos.kassaDevice.unpairFailed'));
    else toast.success(t('admin.pos.kassaDevice.unpairDone', { name: toUnpair.name }));
    void qc.invalidateQueries({ queryKey: ['kassa-device-accounts'] });
  };

  return (
    <div className="min-w-0 space-y-2">
      {rows.length > 0 && (
        <ul className="space-y-1.5">
          {rows.map(({ key, account, beat }) => {
            const silent = beat ? isSilent(beat) : false;
            const waiting = beat ? waitingCount(beat) : 0;
            return (
              <li key={key} className={cn('flex min-w-0 items-center gap-1.5 text-xs', silent || waiting ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground')}>
                {silent || waiting ? <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden /> : <Tablet className="h-3.5 w-3.5 shrink-0" aria-hidden />}
                <span className="min-w-0 flex-1 break-words">
                  <span className="font-medium text-foreground">{account ? account.name : t('admin.pos.kassaDevice.unpairedLogin')}</span>
                  {' · '}
                  {beat
                    ? t('admin.pos.kassaDevice.seen', { when: formatDistanceToNow(new Date(beat.last_seen_at), { addSuffix: true, locale }) })
                    : t('admin.pos.kassaDevice.pairedOn', { when: formatDistanceToNow(new Date(account!.paired_at), { addSuffix: true, locale }) })}
                  {waiting ? ` · ${t('admin.pos.kassaDevice.waiting', { n: waiting })}` : ''}
                  {beat?.sw_version ? ` · ${beat.sw_version.replace('sellqo-kassa-', 'v')}` : ''}
                </span>
                {account && canManage ? (
                  <Button variant="ghost" size="sm" className="h-8 shrink-0 px-2 text-xs" onClick={() => setToUnpair(account)}>
                    <Unplug className="mr-1 h-3.5 w-3.5" />{t('admin.pos.kassaDevice.unpair')}
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {canManage ? (
        <Button variant="outline" size="sm" className="w-full" onClick={() => setPairingOpen(true)}>
          <Link2 className="mr-2 h-4 w-4" />{t('admin.pos.kassaDevice.pair')}
        </Button>
      ) : null}
      {pairing ? <PairDialog tenantId={tenantId} terminal={terminal} accounts={accounts} onClose={() => setPairingOpen(false)} /> : null}
      <AlertDialog open={!!toUnpair} onOpenChange={(o) => !o && setToUnpair(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.pos.kassaDevice.unpairTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('admin.pos.kassaDevice.unpairBody', { name: toUnpair?.name ?? '' })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={(e) => { e.preventDefault(); void unpair(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t('admin.pos.kassaDevice.unpair')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
