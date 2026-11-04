// HORECA-INSTELLINGEN-1 — "Je zaak inrichten: X van Y klaar". Elke stap: status en een knop naar de
// plek waar je hem regelt. De regels staan in src/lib/horecaSetup.ts, de cijfers in useHorecaStatus.
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, ChevronRight, Circle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { setupProgress, setupSteps, type HorecaStatus } from '@/lib/horecaSetup';

export function SetupChecklist({ status, isLoading }: { status: HorecaStatus | undefined; isLoading: boolean }) {
  const { t } = useTranslation();
  if (isLoading || !status) {
    return <Card><CardContent className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label={t('common.loading')} /></CardContent></Card>;
  }
  const steps = setupSteps(status);
  const { done, total } = setupProgress(steps);
  const allDone = done === total;
  return (
    <Card className={cn(allDone && 'border-emerald-500/50')}>
      <CardHeader className="space-y-2">
        <CardTitle>{t('mijnZaak.setup.title', { done, total })}</CardTitle>
        <CardDescription>{allDone ? t('mijnZaak.setup.all_done') : t('mijnZaak.setup.intro')}</CardDescription>
        <Progress value={total ? (done / total) * 100 : 0} aria-label={t('mijnZaak.setup.title', { done, total })} />
      </CardHeader>
      <CardContent>
        <ul className="divide-y rounded-md border">
          {steps.map((s) => (
            <li key={s.id} className="flex min-h-[56px] items-center gap-3 px-3 py-2" data-step={s.id} data-done={s.done}>
              {s.done
                ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
                : <Circle className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />}
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{t(s.labelKey)}</span>
                <span className="mt-0.5 flex flex-wrap gap-1.5">
                  <Badge variant={s.done ? 'default' : 'secondary'} className={cn('text-[11px]', s.done && 'bg-emerald-600 hover:bg-emerald-600')}>
                    {s.done ? t('mijnZaak.setup.done') : t('mijnZaak.setup.todo')}
                  </Badge>
                  {s.optional ? <Badge variant="outline" className="text-[11px]">{t('mijnZaak.setup.optional')}</Badge> : null}
                </span>
              </span>
              <Button asChild size="sm" variant={s.done ? 'ghost' : 'outline'} className="shrink-0">
                <Link to={s.to}>
                  {s.done ? t('mijnZaak.setup.open') : t('mijnZaak.setup.do')}
                  <ChevronRight className="ml-1 h-4 w-4" aria-hidden />
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
