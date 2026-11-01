// KASSA-ODOO-1 — kaart "Kassa-omzet naar Odoo" in Odoo Boekhouding: schakelaar, startdatum,
// kassadagboek, laatste Z-rapporten met Aanvaarden / Opnieuw proberen. Zie
// supabase/functions/_shared/odooPosZ.ts voor de boekingsregels en de migratie
// 20261101230500_kassa_odoo_1.sql voor de trigger en de RPC's.
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Info } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import type { TenantOdooSettings } from '@/hooks/useTenantOdooSettings';

/** Select-waarde voor "zelfde als het verkoopdagboek" (Radix staat geen lege waarde toe). */
const POS_JOURNAL_SAME = '__same__';

/** Kalenderdag in Brussel (JJJJ-MM-DD), zoals de trigger op tenant_odoo_settings rekent. */
function brusselsDate(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

const dateNl = (iso: string) => iso.split('-').reverse().join('-');

type PosZLogRow = {
  id: string; report_no: number | null; booking_date: string | null; sync_status: string;
  odoo_move_name: string | null; odoo_move_id: string | null; error_message: string | null; created_at: string;
};

/** RPC's van KASSA-ODOO-1 staan (nog) niet in de gegenereerde types. Rechtstreeks op de client (R14). */
async function posZRpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(name as never, args as never);
  if (error) throw new Error(error.message);
  return data as T;
}

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

interface Journal { id: number; name: string; code?: string | null; claimed_by_other_tenant?: boolean }

interface Props {
  tenantId: string;
  settings: TenantOdooSettings | null | undefined;
  isLoading: boolean;
  canWrite: boolean;
  configured: boolean;
  journals: { data?: Journal[]; isLoading: boolean };
  saving: boolean;
  onSave: (updates: Pick<TenantOdooSettings, 'pos_z_sync_enabled' | 'pos_z_sync_from' | 'pos_z_journal_id' | 'pos_z_journal_name'>) => void;
}

export function OdooPosZCard({ tenantId, settings, isLoading, canWrite, configured, journals, saving, onSave }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [enabled, setEnabled] = useState(false);
  const [from, setFrom] = useState('');
  const [journal, setJournal] = useState(POS_JOURNAL_SAME);
  const [busy, setBusy] = useState(false);
  // Bevestiging van een startdatum in het verleden (R13: geen window.confirm).
  const [backfill, setBackfill] = useState<{ from: string; count: number } | null>(null);
  // Aanvaarden van een met de hand geboekte Z (R13: geen window.prompt).
  const [accepting, setAccepting] = useState<PosZLogRow | null>(null);
  const [acceptNote, setAcceptNote] = useState('');

  // Review 2 punt 14: de huidige bedrijfsdag van de kassa (afkapuur), niet de kalenderdag.
  const businessDay = useQuery({
    queryKey: ['odoo-pos-z-business-day', tenantId],
    enabled: !!tenantId && canWrite,
    staleTime: 5 * 60_000,
    queryFn: () => posZRpc<string>('odoo_pos_z_business_day', { p_tenant_id: tenantId }),
  });
  const currentDay = businessDay.data ?? brusselsDate(new Date());

  useEffect(() => {
    if (settings) {
      setEnabled(settings.pos_z_sync_enabled ?? false);
      setFrom(settings.pos_z_sync_from ?? '');
      setJournal(settings.pos_z_journal_id || POS_JOURNAL_SAME);
    }
  }, [settings]);

  const baseline = {
    enabled: settings?.pos_z_sync_enabled ?? false,
    from: settings?.pos_z_sync_from ?? '',
    journal: settings?.pos_z_journal_id || POS_JOURNAL_SAME,
  };
  const dirty = !isLoading && (enabled !== baseline.enabled || from !== baseline.from || journal !== baseline.journal);
  const journalRow = journals.data?.find(x => String(x.id) === journal);
  // De factuursync moet opgeslagen aan staan: de Z-boekingen gebruiken die verbinding en instellingen.
  const available = configured && (settings?.odoo_sync_enabled ?? false);

  const handleToggle = (on: boolean) => {
    setEnabled(on);
    // Aanzetten = de huidige bedrijfsdag. Vroeger kan enkel na bevestiging bij Opslaan.
    if (on && !baseline.enabled) setFrom(currentDay);
  };

  const save = () => {
    const j = journal === POS_JOURNAL_SAME ? null : journals.data?.find(x => String(x.id) === journal);
    onSave({
      pos_z_sync_enabled: enabled,
      pos_z_sync_from: from || null,
      pos_z_journal_id: j ? String(j.id) : null,
      pos_z_journal_name: j?.name ?? null,
    });
  };

  const handleSave = async () => {
    // Een startdatum vóór het aanzetten (of vóór een eerder bevestigde datum) vraagt een expliciete
    // bevestiging met het aantal Z's dat dan geboekt wordt. De server dwingt dit ook af (trigger).
    if (enabled && from) {
      // Al aan: de dag van het aanzetten (de server rekent exact met de bedrijfsdag en weigert anders).
      const enabledDay = settings?.pos_z_sync_enabled && settings.pos_z_enabled_at ? brusselsDate(new Date(settings.pos_z_enabled_at)) : currentDay;
      const allowedFrom = [enabledDay, settings?.pos_z_backfill_from].filter(Boolean).sort()[0] as string;
      if (from < allowedFrom) {
        setBusy(true);
        try {
          const count = await posZRpc<number>('odoo_pos_z_backfill_count', { p_tenant_id: tenantId, p_from: from });
          setBackfill({ from, count });
        } catch (e) {
          toast.error(errText(e));
        } finally {
          setBusy(false);
        }
        return;
      }
    }
    save();
  };

  const confirmBackfill = async () => {
    if (!backfill) return;
    setBusy(true);
    try {
      // Review 2 H2: bevestigen en aanzetten (met het dagboek) in één transactie op de server.
      const j = journal === POS_JOURNAL_SAME ? null : journals.data?.find(x => String(x.id) === journal);
      await posZRpc('odoo_pos_z_confirm_backfill', {
        p_tenant_id: tenantId, p_from: backfill.from, p_count: backfill.count,
        p_journal_id: j ? String(j.id) : '', p_journal_name: j?.name ?? '',
      });
      setBackfill(null);
      toast.success(t('admin.odooPosZ.saved'));
      qc.invalidateQueries({ queryKey: ['tenant_odoo_settings', tenantId] });
    } catch (e) {
      toast.error(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const log = useQuery({
    queryKey: ['odoo-pos-z-log', tenantId],
    enabled: !!tenantId && !!settings?.pos_z_sync_enabled,
    queryFn: async () => {
      // De tabel staat (nog) niet in de gegenereerde types (zelfde patroon als src/kassa).
      // De laatste 5, plus alles wat aandacht vraagt (mislukt of na te kijken).
      const cols = 'id, report_no, booking_date, sync_status, odoo_move_name, odoo_move_id, error_message, created_at';
      const [recent, attention] = await Promise.all([
        supabase.from('odoo_pos_z_sync_log' as never).select(cols)
          .eq('tenant_id' as never, tenantId as never).order('created_at' as never, { ascending: false }).limit(5),
        supabase.from('odoo_pos_z_sync_log' as never).select(cols)
          .eq('tenant_id' as never, tenantId as never).in('sync_status' as never, ['failed', 'needs_review'] as never)
          .order('created_at' as never, { ascending: false }).limit(20),
      ]);
      const rows = [...((attention.data || []) as unknown as PosZLogRow[]), ...((recent.data || []) as unknown as PosZLogRow[])];
      return rows.filter((r, i) => rows.findIndex(x => x.id === r.id) === i);
    },
  });

  const submitAccept = async () => {
    if (!accepting) return;
    setBusy(true);
    try {
      await posZRpc('odoo_pos_z_accept', { p_log_id: accepting.id, p_note: acceptNote });
      toast.success(t('admin.odooPosZ.accept_done'));
      setAccepting(null);
      setAcceptNote('');
      qc.invalidateQueries({ queryKey: ['odoo-pos-z-log', tenantId] });
    } catch (e) {
      toast.error(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const retry = async (row: PosZLogRow) => {
    try {
      await posZRpc('odoo_pos_z_retry', { p_log_id: row.id });
      toast.success(t('admin.odooPosZ.retry_done'));
      qc.invalidateQueries({ queryKey: ['odoo-pos-z-log', tenantId] });
    } catch (e) {
      toast.error(errText(e));
    }
  };

  const needsAttention = (s: string) => s === 'failed' || s === 'needs_review';

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin.odooPosZ.title')}</CardTitle>
        <CardDescription>{t('admin.odooPosZ.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!available && (
          <p className="text-xs text-amber-700">{t('admin.odooPosZ.needs_sync')}</p>
        )}
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <Label htmlFor="pos-z-enabled">{t('admin.odooPosZ.enable_label')}</Label>
            <p className="text-xs text-muted-foreground mt-1">{t('admin.odooPosZ.enable_help')}</p>
          </div>
          <Switch
            id="pos-z-enabled"
            checked={enabled}
            disabled={!canWrite || isLoading || (!available && !enabled)}
            onCheckedChange={handleToggle}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="min-w-0">
            <Label htmlFor="pos-z-from">{t('admin.odooPosZ.from_label')}</Label>
            <Input
              id="pos-z-from"
              type="date"
              className="mt-1"
              value={from}
              onChange={e => setFrom(e.target.value)}
              disabled={!canWrite || !enabled || !available}
            />
            <p className="text-xs text-muted-foreground mt-1">{t('admin.odooPosZ.from_help')}</p>
            {enabled && <p className="text-xs text-muted-foreground mt-1">{t('admin.odooPosZ.business_day', { date: dateNl(currentDay) })}</p>}
          </div>
          <div className="min-w-0">
            <Label htmlFor="pos-z-journal">{t('admin.odooPosZ.journal_label')}</Label>
            <Select value={journal} onValueChange={setJournal}
              disabled={!canWrite || !enabled || !available || journals.isLoading}>
              <SelectTrigger id="pos-z-journal" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={POS_JOURNAL_SAME}>{t('admin.odooPosZ.journal_same')}</SelectItem>
                {(journals.data || []).map(j => (
                  <SelectItem key={j.id} value={String(j.id)} disabled={j.claimed_by_other_tenant}>
                    {j.name}{j.code ? ` (${j.code})` : ''}{j.claimed_by_other_tenant ? ` — ${t('admin.odooPosZ.journal_taken')}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">{t('admin.odooPosZ.journal_help')}</p>
          </div>
        </div>

        <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{t('admin.odooPosZ.rules_note')}</span>
        </div>

        {settings?.pos_z_sync_enabled && (
          <div className="space-y-1">
            <p className="text-sm font-medium">{t('admin.odooPosZ.recent_title')}</p>
            {(log.data || []).length === 0 ? (
              <p className="text-xs text-muted-foreground">{t('admin.odooPosZ.recent_empty')}</p>
            ) : (
              (log.data || []).map(l => (
                <div key={l.id} className="border-b py-2 last:border-b-0 text-sm space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <span className="min-w-0 break-words">{t('admin.odooPosZ.recent_row', { no: l.report_no ?? '?', name: l.odoo_move_name ?? '—' })}</span>
                    <span className={needsAttention(l.sync_status) ? 'text-xs text-red-600' : 'text-xs text-muted-foreground'}>
                      {t(`admin.odooPosZ.status.${l.sync_status}`)}
                    </span>
                  </div>
                  {needsAttention(l.sync_status) && l.error_message && (
                    <p className="text-xs text-muted-foreground break-words">{l.error_message}</p>
                  )}
                  {canWrite && needsAttention(l.sync_status) && (
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => { setAccepting(l); setAcceptNote(''); }}>{t('admin.odooPosZ.accept')}</Button>
                      {l.sync_status === 'needs_review' && (
                        <Button size="sm" variant="ghost" onClick={() => retry(l)}>{t('admin.odooPosZ.retry')}</Button>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={handleSave}
            disabled={!canWrite || !dirty || saving || busy || (enabled && (!available || !from)) || !!journalRow?.claimed_by_other_tenant}>
            {saving || busy ? t('admin.odooPosZ.saving') : t('admin.odooPosZ.save')}
          </Button>
        </div>
      </CardContent>

      <AlertDialog open={!!backfill} onOpenChange={(o) => { if (!o && !busy) setBackfill(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.odooPosZ.backfill_title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {backfill ? t('admin.odooPosZ.backfill_confirm', { count: backfill.count, date: dateNl(backfill.from) }) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t('admin.odooPosZ.cancel')}</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={(e) => { e.preventDefault(); void confirmBackfill(); }}>
              {t('admin.odooPosZ.backfill_ok', { count: backfill?.count ?? 0 })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!accepting} onOpenChange={(o) => { if (!o && !busy) setAccepting(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.odooPosZ.accept_title', { no: accepting?.report_no ?? '?' })}</DialogTitle>
            <DialogDescription>{t('admin.odooPosZ.accept_prompt', { no: accepting?.report_no ?? '?' })}</DialogDescription>
          </DialogHeader>
          {accepting?.odoo_move_id && (
            <p className="text-sm rounded-md border border-amber-300 bg-amber-50 p-2 text-amber-900">
              {t('admin.odooPosZ.accept_concept', { id: accepting.odoo_move_id, name: accepting.odoo_move_name ?? '' })}
            </p>
          )}
          <div className="space-y-1">
            <Label htmlFor="pos-z-accept-note">{t('admin.odooPosZ.accept_note_label')}</Label>
            <Textarea id="pos-z-accept-note" value={acceptNote} onChange={e => setAcceptNote(e.target.value)} rows={3} maxLength={500} />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAccepting(null)} disabled={busy}>{t('admin.odooPosZ.cancel')}</Button>
            <Button onClick={() => void submitAccept()} disabled={busy || acceptNote.trim().length < 3}>{t('admin.odooPosZ.accept')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
