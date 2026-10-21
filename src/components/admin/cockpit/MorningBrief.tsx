import { formatDistanceStrict } from 'date-fns';
import { Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/components/ui/skeleton';
import { useDateFnsLocale } from '@/hooks/useDateFnsLocale';
import { useTenant } from '@/hooks/useTenant';
import { formatCurrency } from '@/lib/utils';
import { buildCockpitBrief, type BriefInput } from '@/lib/cockpitBrief';
import { channelLabel } from './cockpitFormat';

interface Props {
  input: BriefInput;
  isLoading: boolean;
}

/** "Je ochtendbrief": een paar zinnen over gisteren, verzendingen en voorraad. */
export function MorningBrief({ input, isLoading }: Props) {
  const { t } = useTranslation();
  const locale = useDateFnsLocale();
  const { currentTenant } = useTenant();
  const currency = currentTenant?.currency || 'EUR';

  const sentences = buildCockpitBrief(input, {
    money: (n) => formatCurrency(n, currency),
    channel: (c) => channelLabel(t, c),
    channelCount: (c, count) => t('admin.cockpit.brief.channel_count', { count, channel: channelLabel(t, c) }),
    age: (ms) => formatDistanceStrict(0, ms, { locale, roundingMethod: 'floor' }),
    list: (items) =>
      items.length < 2
        ? items.join('')
        : `${items.slice(0, -1).join(', ')} ${t('admin.cockpit.brief.and')} ${items[items.length - 1]}`,
  });

  return (
    <section
      aria-label={t('admin.cockpit.brief.title')}
      className="flex items-start gap-4 rounded-xl border bg-muted/40 p-4 md:p-5"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Sparkles className="h-4 w-4" aria-hidden="true" />
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t('admin.cockpit.brief.title')}
        </p>
        {isLoading && sentences.length === 0 ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-72 max-w-full" />
            <Skeleton className="h-4 w-56 max-w-full" />
          </div>
        ) : (
          <p className="text-base leading-relaxed">
            {sentences.length === 0
              ? t('admin.cockpit.brief.all_quiet')
              : sentences.map((s) => t(s.key, s.values)).join(' ')}
          </p>
        )}
      </div>
    </section>
  );
}
