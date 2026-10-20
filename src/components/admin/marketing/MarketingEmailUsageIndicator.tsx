// MAIL-LIMIT-UI — compacte teller "X van Y marketingmails deze maand" voor Marketing → E-mail.
// Limiet en verbruik komen uit marketing_email_usage (zelfde telling als de verzendwachtrij).
// Kan de teller niet geladen worden, dan toont hij niets: liever geen regel dan een foute.
import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useCan } from '@/hooks/useCan';
import { useMarketingEmailUsage } from '@/hooks/useMarketingEmailUsage';
import { usageLevel } from '@/lib/planUsage';

export function MarketingEmailUsageIndicator({ className }: { className?: string }) {
  const { t, i18n } = useTranslation();
  const canSeePlans = useCan('read', 'platform_billing');
  const { data } = useMarketingEmailUsage();
  if (!data) return null;

  const fmt = (n: number) => n.toLocaleString(i18n.language);
  const { used, monthly } = data;
  const level = usageLevel(used, monthly);
  const pct = monthly ? Math.min(100, (used / monthly) * 100) : 0;

  return (
    <div className={cn('flex flex-col gap-2 rounded-lg border bg-card px-4 py-3 sm:flex-row sm:items-center sm:gap-4', className)}>
      <div className="flex items-center gap-2 text-sm min-w-0">
        <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className={cn(
          level === 'full' && 'text-destructive font-medium',
          level === 'near' && 'text-amber-600 dark:text-amber-400 font-medium',
        )}>
          {monthly == null
            ? t('admin.marketing.usage.used_unlimited', { used: fmt(used) })
            : t('admin.marketing.usage.used_of', { used: fmt(used), monthly: fmt(monthly) })}
        </span>
      </div>
      {monthly != null && (
        <Progress
          value={pct}
          aria-label={t('admin.marketing.usage.used_of', { used: fmt(used), monthly: fmt(monthly) })}
          className={cn(
            'h-2 sm:flex-1 sm:max-w-xs',
            level === 'full' && '[&>div]:bg-destructive',
            level === 'near' && '[&>div]:bg-amber-500',
          )}
        />
      )}
      {monthly != null && canSeePlans && (
        <Link to="/admin/billing" className="text-sm text-primary hover:underline sm:ml-auto shrink-0">
          {t('admin.marketing.usage.see_plans')}
        </Link>
      )}
    </div>
  );
}
