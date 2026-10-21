import { Link } from 'react-router-dom';
import { formatDistanceStrict } from 'date-fns';
import { CheckCircle2, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useDateFnsLocale } from '@/hooks/useDateFnsLocale';
import { cn } from '@/lib/utils';

export interface TodoItem {
  key: string;
  count: number;
  label: string;
  href: string;
  /** Leeftijd van het oudste item in ms (toont "oudste 2 d"). */
  oldestAgeMs?: number | null;
  tone: 'urgent' | 'normal' | 'soft';
}

interface Props {
  items: TodoItem[];
  isLoading: boolean;
}

const TONE: Record<TodoItem['tone'], string> = {
  urgent: 'bg-[#FF6B33] text-white',
  normal: 'bg-[#1D3A5C] text-white dark:bg-sky-200 dark:text-[#13283F]',
  soft: 'bg-muted text-foreground',
};

/** DASH-2b — wat er vandaag te doen is, elk item klikbaar naar de juiste pagina. */
export function TodoCard({ items, isLoading }: Props) {
  const { t } = useTranslation();
  const locale = useDateFnsLocale();
  const open = items.filter((i) => i.count > 0);

  return (
    <Card className="flex flex-col rounded-2xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t('admin.cockpit.todo.title')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        {isLoading && open.length === 0 ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : open.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center">
            <CheckCircle2 className="h-8 w-8 text-green-600" aria-hidden="true" />
            <p className="text-sm font-semibold">{t('admin.cockpit.todo.all_done')}</p>
          </div>
        ) : (
          <ul className="-mx-3 flex flex-col">
            {open.map((i) => (
              <li key={i.key}>
                <Link
                  to={i.href}
                  className="flex min-h-[52px] items-center gap-3 rounded-xl px-3 transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                >
                  <span
                    className={cn(
                      'inline-flex h-7 min-w-9 items-center justify-center rounded-full px-2 text-sm font-bold tabular-nums',
                      TONE[i.tone],
                    )}
                  >
                    {i.count > 99 ? '99+' : i.count}
                  </span>
                  <span className="flex-1 text-[15px] font-semibold">{i.label}</span>
                  {i.oldestAgeMs ? (
                    <span className="text-xs font-semibold text-red-700 dark:text-red-400">
                      {t('admin.cockpit.todo.oldest', {
                        age: formatDistanceStrict(0, i.oldestAgeMs, { locale, roundingMethod: 'floor' }),
                      })}
                    </span>
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
