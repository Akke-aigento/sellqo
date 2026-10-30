// AI-AGENT-1 — een voorstel van de hulpassistent. Er gebeurt niets tot de gebruiker op
// Uitvoeren tikt; dan voert ai-assistant-action het uit (met zijn rechten, 1 AI-credit).
import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Check, Loader2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

export interface AIActionProposal {
  kind: 'stock' | 'price' | 'sold_out' | 'active' | 'create_product' | 'bulk_price' | 'discount_code';
  product_id: string;
  variant_id: string | null;
  product_name: string;
  before: number | boolean | null;
  after: number | boolean;
  delta?: number;
  mode?: 'add' | 'set';
  amount?: number;
  tenant_id?: string;
  payload?: Record<string, unknown>;
}

type BulkItem = { product_id: string; product_name: string; before: number; after: number };

// crypto.randomUUID bestaat pas vanaf iOS 15.4; de app ondersteunt iOS 15.0.
const newKey = (): string => (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
  ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

type State = 'idle' | 'running' | 'done' | 'cancelled' | 'error';

const ERROR_KEYS = new Set([
  'feature_not_in_plan', 'insufficient_credits', 'no_change', 'product_not_found', 'variant_required',
  'stock_not_tracked', 'invalid_price', 'invalid_amount', 'variant_not_found',
  'code_exists', 'invalid_code', 'invalid_value', 'invalid_name', 'invalid_active', 'stale', 'date_in_past',
]);

export function AIActionCard({ proposal, tenantId }: { proposal: AIActionProposal; tenantId: string | undefined }) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [state, setState] = useState<State>('idle');
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  // Eén sleutel per kaart: een dubbele tik of een retry na een verloren antwoord voert niet
  // twee keer uit (de server herkent de sleutel). De ref vangt een snelle dubbele tik af.
  const idemKey = useRef(newKey());
  const busy = useRef(false);
  // De winkel waarvoor het voorstel gemaakt is (ook na wisselen van winkel).
  const actTenant = proposal.tenant_id || tenantId;

  const eur = (n: unknown) => new Intl.NumberFormat(i18n.language, { style: 'currency', currency: 'EUR' }).format(Number(n));
  const fmt = (v: unknown) => {
    if (proposal.kind === 'price') return eur(v);
    if (proposal.kind === 'sold_out') return v ? t('admin.help.aiActions.sold_out') : t('admin.help.aiActions.available');
    if (proposal.kind === 'active') return v ? t('admin.help.aiActions.on') : t('admin.help.aiActions.off');
    return String(v ?? 0);
  };
  const title = t(`admin.help.aiActions.title_${proposal.kind}`);
  const pl = (proposal.payload ?? {}) as Record<string, unknown>;
  const bulk = (proposal.kind === 'bulk_price' ? (pl.items as BulkItem[] | undefined) ?? [] : []);

  const run = async () => {
    if (!actTenant || busy.current) return;
    busy.current = true;
    setState('running');
    setError(null);
    const { data, error: fnErr } = await supabase.functions.invoke('ai-assistant-action', {
      body: { tenant_id: actTenant, action: proposal, idempotency_key: idemKey.current },
    });
    // supabase-js geeft bij een niet-2xx de body niet altijd mee; lees hem dan uit de context.
    let res = data as { success?: boolean; error?: string } | null;
    if (fnErr && !res) {
      try { res = await (fnErr as { context?: Response }).context?.json(); } catch { res = null; }
    }
    busy.current = false;
    if (res?.success) {
      const rid = (res as { result?: { product_id?: string } }).result?.product_id;
      if (rid) setCreatedId(rid);
      setState('done');
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['kaart'] });
      qc.invalidateQueries({ queryKey: ['product-variants'] });
      qc.invalidateQueries({ queryKey: ['stock-report'] });
      qc.invalidateQueries({ queryKey: ['ai-credits'] });
      qc.invalidateQueries({ queryKey: ['discount-codes'] });
      return;
    }
    const code = res?.error && ERROR_KEYS.has(res.error) ? res.error : 'generic';
    setError(t(`admin.help.aiActions.errors.${code}`));
    setState('error');
  };

  return (
    <div className={cn('mt-2 rounded-lg border bg-background p-3 text-sm', state === 'done' && 'border-green-600/40', state === 'cancelled' && 'opacity-60')}>
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <p className="font-semibold">{proposal.product_name}</p>
      {proposal.kind === 'create_product' ? (
        <div className="mt-1 space-y-0.5">
          <p>{eur(pl.price)}{pl.category_name ? ` · ${String(pl.category_name)}` : ''}</p>
          {pl.description ? <p className="line-clamp-3 text-xs text-muted-foreground">{String(pl.description)}</p> : null}
          <p className="text-xs text-muted-foreground">{t('admin.help.aiActions.create_as_draft')}</p>
        </div>
      ) : proposal.kind === 'bulk_price' ? (
        <ul className="mt-1 max-h-40 space-y-0.5 overflow-y-auto text-xs">
          {bulk.map((it) => (
            <li key={it.product_id} className="flex justify-between gap-2">
              <span className="truncate">{it.product_name}</span>
              <span className="shrink-0"><span className="text-muted-foreground">{eur(it.before)}</span> → <span className="font-semibold">{eur(it.after)}</span></span>
            </li>
          ))}
        </ul>
      ) : proposal.kind === 'discount_code' ? (
        <p className="mt-1">
          {pl.discount_type === 'percentage' ? `${String(pl.discount_value)}%` : pl.discount_type === 'fixed_amount' ? eur(pl.discount_value) : t('admin.help.aiActions.free_shipping')}
          {pl.valid_until ? ` · ${t('admin.help.aiActions.valid_until', { date: String(pl.valid_until) })}` : ''}
          {pl.minimum_order_amount ? ` · ${t('admin.help.aiActions.min_order', { amount: eur(pl.minimum_order_amount) })}` : ''}
        </p>
      ) : (
        <p className="mt-1">
          <span className="text-muted-foreground">{fmt(proposal.before)}</span>
          <span className="mx-1.5">→</span>
          <span className="font-semibold">{fmt(proposal.after)}</span>
          {proposal.kind === 'stock' && proposal.delta ? (
            <span className="ml-1.5 text-xs text-muted-foreground">({proposal.delta > 0 ? '+' : ''}{proposal.delta})</span>
          ) : null}
        </p>
      )}
      {state === 'idle' || state === 'error' ? (
        <div className="mt-2 flex items-center gap-2">
          <Button type="button" size="sm" className="h-8" onClick={run} disabled={!actTenant}>
            <Check className="mr-1 h-3.5 w-3.5" />{t('admin.help.aiActions.execute')}
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => setState('cancelled')}>
            <X className="mr-1 h-3.5 w-3.5" />{t('common.cancel')}
          </Button>
          <span className="ml-auto text-xs text-muted-foreground">{t('admin.help.aiActions.cost')}</span>
        </div>
      ) : null}
      {state === 'running' ? <Loader2 className="mt-2 h-4 w-4 animate-spin text-muted-foreground" /> : null}
      {state === 'done' ? (
        <p className="mt-2 text-xs font-medium text-green-700">
          {t('admin.help.aiActions.done')}
          {createdId ? <> · <Link to={`/admin/products/${createdId}/edit`} className="underline">{t('admin.help.aiActions.open_product')}</Link></> : null}
        </p>
      ) : null}
      {state === 'cancelled' ? <p className="mt-2 text-xs text-muted-foreground">{t('admin.help.aiActions.cancelled')}</p> : null}
      {state === 'error' && error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
