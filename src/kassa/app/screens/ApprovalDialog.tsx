// KASSA-RECHTEN-1 — "PIN van een verantwoordelijke": korting, van het huis of een verstuurde lijn
// annuleren door een medewerker die geen eigenaar of verantwoordelijke is. Zelfde opbouw als
// ProductQuickEdit (KASSA-0.6): goedkeurder kiezen, PIN, de server controleert en geeft een
// eenmalig akkoord terug. Het scherm beslist niets.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Loader2, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { ActionCtx } from '../horeca/actions';
import { PRODUCT_EDIT_ROLES, canApprove } from '../horeca/productActions';
import { requestApproval, type ApprovalAction, type ApprovalBind } from '../horeca/approvals';

interface Approver { id: string; display_name: string; role: string }

export function ApprovalDialog({ ctx, action, checkId, lineId, bind, what, onApproved, onClose }: {
  ctx: ActionCtx; action: ApprovalAction; checkId: string | null; lineId: string | null;
  /** Review 1: het akkoord geldt enkel voor dit percent/bedrag/aantal (de server vergelijkt). */
  bind: ApprovalBind;
  /** Wat er goedgekeurd wordt, bv. "−50 % op 2× Pils". */
  what: string;
  onApproved: (approvalId: string) => void | Promise<void>; onClose: () => void;
}) {
  const { t } = useTranslation();
  const tenantId = ctx.runtime.device.tenantId;
  // Een eigenaar/verantwoordelijke zonder sessietoken (bv. aangemeld vóór deze versie) keurt zelf goed.
  const [approverId, setApproverId] = useState(canApprove(ctx) ? ctx.staffId : '');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: approvers } = useQuery({
    queryKey: ['kassa-approvers', tenantId],
    queryFn: async () => {
      const { data, error: e } = await supabase.from('pos_cashiers').select('id, display_name, role')
        .eq('tenant_id', tenantId).eq('is_active', true).in('role', [...PRODUCT_EDIT_ROLES]).order('display_name');
      if (e) throw e;
      return (data ?? []) as Approver[];
    },
  });
  useEffect(() => {
    if (!approverId && approvers?.length === 1) setApproverId(approvers[0].id);
  }, [approvers, approverId]);

  const ready = !!approverId && /^\d{4,6}$/.test(pin);
  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    const o = await requestApproval(ctx, { action, checkId, lineId, bind }, { approverId, pin });
    if (o.ok === false) {
      setBusy(false);
      setPin('');
      setError(t(`kassa.approval.error.${o.reason}`));
      return;
    }
    await onApproved(o.approvalId);
    setBusy(false);
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent className="max-h-[95vh] w-[calc(100vw-1rem)] max-w-sm overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" aria-hidden />{t('kassa.approval.title')}</DialogTitle>
          <DialogDescription>{t(`kassa.approval.intro.${action}`, { what })}</DialogDescription>
        </DialogHeader>
        <form className="space-y-2 rounded-lg border p-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <label htmlFor="kassa-approval-approver" className="text-sm font-medium">{t('kassa.productEdit.approver')}</label>
          <select id="kassa-approval-approver" value={approverId} onChange={(e) => { setApproverId(e.target.value); setPin(''); setError(null); }}
            className="h-11 w-full rounded-md border bg-background px-2">
            <option value="">{t('kassa.productEdit.pickApprover')}</option>
            {(approvers ?? []).map((a) => <option key={a.id} value={a.id}>{a.display_name}</option>)}
          </select>
          <input type="password" inputMode="numeric" autoComplete="off" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            placeholder={t('kassa.productEdit.pin')} aria-label={t('kassa.productEdit.pin')} className="h-11 w-full rounded-md border bg-background px-3 text-center text-lg tracking-widest" />
          {approvers && !approvers.length ? <p className="text-xs text-destructive">{t('kassa.productEdit.noApprovers')}</p> : null}
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter className="gap-2 pt-2 sm:gap-2">
            <button type="button" onClick={onClose} disabled={busy} className="h-12 rounded-md border px-4">{t('kassa.common.cancel')}</button>
            <button type="submit" disabled={busy || !ready}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-40 sm:w-auto sm:flex-1">
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : null}{t('kassa.approval.confirm')}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
