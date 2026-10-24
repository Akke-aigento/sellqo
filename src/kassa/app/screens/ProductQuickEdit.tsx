// KASSA-0.6 — lang drukken (of rechtsklikken) op een product: "op voor vandaag" / terug en de
// prijs aanpassen. Elke medewerker kan het openen; een eigenaar of verantwoordelijke keurt goed
// met zijn PIN. De server controleert PIN en rol, het scherm beslist niets.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { ActionCtx } from '../horeca/actions';
import type { CatalogProduct } from '../horeca/useCatalog';
import { parseEuroInput } from '../horeca/pay';
import { formatEuro } from '../horeca/format';
import { PRODUCT_EDIT_ROLES, canApprove, quickEditProduct } from '../horeca/productActions';

interface Approver { id: string; display_name: string; role: string }

export function ProductQuickEdit({ ctx, product, onClose }: { ctx: ActionCtx; product: CatalogProduct | null; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const tenantId = ctx.runtime.device.tenantId;
  const [price, setPrice] = useState('');
  const [pin, setPin] = useState('');
  const [approverId, setApproverId] = useState<string>(canApprove(ctx) ? ctx.staffId : '');
  const [busy, setBusy] = useState<null | 'price' | 'soldout'>(null);
  const { data: approvers } = useQuery({
    queryKey: ['kassa-approvers', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from('pos_cashiers').select('id, display_name, role')
        .eq('tenant_id', tenantId).eq('is_active', true).in('role', [...PRODUCT_EDIT_ROLES]).order('display_name');
      if (error) throw error;
      return (data ?? []) as Approver[];
    },
  });
  // Enkel bij een ander product invullen: een verversing van de kaart mag het typen niet wissen.
  const productId = product?.id;
  useEffect(() => {
    if (product) setPrice((product.price_cents / 100).toFixed(2).replace('.', i18n.language.startsWith('en') ? '.' : ','));
  }, [productId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!approverId && approvers?.length === 1) setApproverId(approvers[0].id);
  }, [approvers, approverId]);
  if (!product) return null;

  const cents = parseEuroInput(price);
  const approved = !!approverId && /^\d{4,6}$/.test(pin);
  const run = async (kind: 'price' | 'soldout') => {
    if (!approved) return;
    setBusy(kind);
    const o = await quickEditProduct(ctx, product.id, { approverId, pin },
      kind === 'price' ? { price: ((cents ?? 0) / 100).toFixed(2) } : { soldOut: !product.sold_out });
    setBusy(null);
    if (o.ok === false) {
      if (o.reason === 'wrong_pin' || o.reason === 'locked') setPin('');
      toast.error(t(`kassa.productEdit.error.${o.reason}`));
      return;
    }
    void qc.invalidateQueries({ queryKey: ['kassa-catalog', tenantId] });
    toast.success(kind === 'price' ? t('kassa.productEdit.priceSaved', { name: product.name, price: formatEuro(Math.round(o.price * 100), i18n.language) })
      : o.soldOutUntil ? t('kassa.productEdit.soldOutOn', { name: product.name }) : t('kassa.productEdit.soldOutOff', { name: product.name }));
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent className="max-h-[95vh] w-[calc(100vw-1rem)] max-w-sm overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product.name}</DialogTitle>
          <DialogDescription>{t('kassa.productEdit.intro')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2 rounded-lg border p-3">
          <label htmlFor="kassa-approver" className="text-sm font-medium">{t('kassa.productEdit.approver')}</label>
          <select id="kassa-approver" value={approverId} onChange={(e) => { setApproverId(e.target.value); setPin(''); }}
            className="h-11 w-full rounded-md border bg-background px-2">
            <option value="">{t('kassa.productEdit.pickApprover')}</option>
            {(approvers ?? []).map((a) => <option key={a.id} value={a.id}>{a.display_name}</option>)}
          </select>
          <input type="password" inputMode="numeric" autoComplete="off" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            placeholder={t('kassa.productEdit.pin')} aria-label={t('kassa.productEdit.pin')} className="h-11 w-full rounded-md border bg-background px-3 text-center text-lg tracking-widest" />
          {approvers && !approvers.length ? <p className="text-xs text-destructive">{t('kassa.productEdit.noApprovers')}</p> : null}
        </div>

        <button type="button" onClick={() => void run('soldout')} disabled={!!busy || !approved}
          className={cn('flex h-14 w-full items-center justify-center gap-2 rounded-lg border-2 font-semibold disabled:opacity-40', product.sold_out ? 'border-primary' : 'border-destructive text-destructive')}>
          {busy === 'soldout' ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
          {product.sold_out ? t('kassa.productEdit.backIn') : t('kassa.productEdit.soldOut')}
        </button>
        <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); if (cents !== null && cents !== product.price_cents) void run('price'); }}>
          <label htmlFor="kassa-price" className="text-sm font-medium">{t('kassa.productEdit.price')}</label>
          <input id="kassa-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)}
            className={cn('h-12 w-full rounded-md border bg-background px-3 text-right text-lg tabular-nums', price && cents === null && 'border-destructive')} />
          <p className="text-xs text-muted-foreground">{t('kassa.productEdit.priceHint')}</p>
          <DialogFooter className="gap-2 sm:gap-2">
            <button type="button" onClick={onClose} disabled={!!busy} className="h-12 rounded-md border px-4">{t('kassa.common.cancel')}</button>
            <button type="submit" disabled={!!busy || !approved || cents === null || cents === product.price_cents || cents > 9_999_999}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-40 sm:w-auto sm:flex-1">
              {busy === 'price' ? <Loader2 className="h-5 w-5 animate-spin" /> : null}{t('kassa.productEdit.savePrice')}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
