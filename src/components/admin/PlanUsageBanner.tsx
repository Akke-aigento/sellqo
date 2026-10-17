// LIMITS-1 — banner vanaf 80% van een pakketlimiet, en één pop-up per sessie op 100%.
// Zelfde telling en drempels als de databank (src/lib/planUsage.ts, notify_plan_usage).
// Orders boven het limiet: de webshop blijft open, er komt een percentage per order bij.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Gauge } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { useTenant } from '@/hooks/useTenant';
import { useTenantSubscription } from '@/hooks/useTenantSubscription';
import { useUsageLimits } from '@/hooks/useUsageLimits';
import { usageLevel } from '@/lib/planUsage';

type Kind = 'orders' | 'products' | 'users';
const ORDER: Kind[] = ['orders', 'products', 'users'];

function readFlag(key: string): boolean {
  try { return sessionStorage.getItem(key) === '1'; } catch { return false; }
}
function writeFlag(key: string) {
  try { sessionStorage.setItem(key, '1'); } catch { /* privémodus: dan elke keer */ }
}

export function PlanUsageBanner() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentTenant } = useTenant();
  const { subscription, usage } = useTenantSubscription();
  const { isUnlimited } = useUsageLimits();
  const [dismissed, setDismissed] = useState(false);
  const [popupOpen, setPopupOpen] = useState(false);

  const pct = Number((subscription?.pricing_plan as { overage_fee_percent?: number } | undefined)?.overage_fee_percent ?? 0);

  // Ernstigste eerst: vol gaat voor bijna vol, orders voor producten voor gebruikers.
  const hit = (() => {
    if (!usage || isUnlimited) return null;
    let best: { kind: Kind; level: 'near' | 'full'; current: number; limit: number } | null = null;
    for (const kind of ORDER) {
      const u = usage[kind];
      if (!u || u.limit == null) continue;
      // Eén gebruiker inbegrepen: de eigenaar zit altijd op 100%, daar geen melding over.
      if (kind === 'users' && u.limit <= 1) continue;
      const level = usageLevel(u.current, u.limit);
      if (level === 'ok') continue;
      if (!best || (level === 'full' && best.level === 'near')) best = { kind, level, current: u.current, limit: u.limit };
    }
    return best;
  })();

  const key = hit && currentTenant ? `plan-usage:${currentTenant.id}:${hit.kind}:${hit.level}` : null;

  useEffect(() => {
    if (!key || !hit) return;
    setDismissed(hit.level === 'near' && readFlag(`${key}:banner`));
    if (hit.level === 'full' && !readFlag(`${key}:popup`)) {
      setPopupOpen(true);
      writeFlag(`${key}:popup`);
    }
    // hit wordt elke render opnieuw berekend; de sleutel vat de toestand samen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!hit || (dismissed && hit.level === 'near')) return null;

  const vars = { count: hit.current, limit: hit.limit, pct: pct.toLocaleString() };
  const title = t(`billing.usage_banner.${hit.kind}_${hit.level}_title`, vars);
  const body = t(`billing.usage_banner.${hit.kind}_${hit.level}_body`, vars);
  const goBilling = () => navigate('/admin/billing');

  return (
    <>
      <div
        role="status"
        className={cn(
          'mx-3 mt-2 flex flex-col gap-2 rounded-md border px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between',
          hit.level === 'full' ? 'border-destructive/30 bg-destructive/10' : 'border-amber-500/30 bg-amber-500/10',
        )}
      >
        <div className="flex min-w-0 items-start gap-2">
          <Gauge className={cn('mt-0.5 h-4 w-4 shrink-0', hit.level === 'full' ? 'text-destructive' : 'text-amber-600')} aria-hidden="true" />
          <p className="min-w-0">
            <span className="font-medium">{title}</span>{' '}
            <span className="text-muted-foreground">{body}</span>
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {hit.level === 'near' && key && (
            <Button size="sm" variant="ghost" onClick={() => { writeFlag(`${key}:banner`); setDismissed(true); }}>
              {t('billing.usage_banner.dismiss')}
            </Button>
          )}
          <Button size="sm" onClick={goBilling}>{t('billing.usage_banner.cta')}</Button>
        </div>
      </div>
      <AlertDialog open={popupOpen} onOpenChange={setPopupOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('billing.usage_banner.later')}</AlertDialogCancel>
            <AlertDialogAction onClick={goBilling}>{t('billing.usage_banner.cta')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
