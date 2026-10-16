// SOCIAL-5 — tab "Resultaten" in de Social planning: wat werkte, wanneer en welk soort post.
// Cijfers van Instagram (social-insights-sync, elke 3 uur). De weektaken gebruiken dezelfde
// cijfers (view social_post_performance) om de posttijden per merk te kiezen.

import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { BarChart3, ExternalLink, Info, Link2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useDateFnsLocale } from '@/hooks/useDateFnsLocale';
import { useSocialResults } from '@/hooks/useSocialResults';
import { cn } from '@/lib/utils';
import {
  bestBucket, bucketScore, engagementRate, interactionsOf, metricsOf, MIN_POSTS_PER_BUCKET, scoreOf, TAG_KEYS, type Bucket,
} from '@/lib/social/results';

const WEEKDAY_DATES = ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'];

export function SocialResults() {
  const { t, i18n } = useTranslation();
  const locale = useDateFnsLocale();
  const { isLoading, postedCount, summary, growth } = useSocialResults();
  const nf = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 0 });
  const pf = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 });
  const mode = summary.mode;

  const scoreText = (b: Bucket<string | number>) => {
    const v = mode === 'score' ? b.avgScore : b.avgInteractions;
    if (v === null) return '—';
    return mode === 'score' ? pf.format(v) : nf.format(v);
  };
  const rateText = (b: Bucket<string | number>) => (b.avgRate === null ? '—' : `${pf.format(b.avgRate)} %`);
  const tagLabel = (k: string | number) => String(k).replace(/[_-]+/g, ' ');

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
      </div>
    );
  }

  if (postedCount === 0) {
    return <p className="text-sm text-muted-foreground py-12 text-center max-w-md mx-auto">{t('admin.socialPlanner.results.empty')}</p>;
  }

  const weekdayLabel = (d: number) => format(new Date(`${WEEKDAY_DATES[d - 1]}T12:00:00`), 'EEEE', { locale });
  const typeLabel = (k: string) => t(`admin.socialPlanner.results.type.${k}`, { defaultValue: k });

  const barList = (title: string, buckets: Bucket<string | number>[], label: (k: string | number) => string) => {
    const max = Math.max(0, ...buckets.map((b) => bucketScore(b, mode)));
    return (
      <Card key={title}>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{title}</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {buckets.map((b) => {
            const score = bucketScore(b, mode);
            const few = b.posts < MIN_POSTS_PER_BUCKET;
            return (
              <div key={String(b.key)} className={cn('text-sm', few && 'text-muted-foreground')}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="capitalize">{label(b.key)}</span>
                  <span className="tabular-nums">
                    {scoreText(b)}
                    <span className="ml-2 text-xs text-muted-foreground">{t('admin.socialPlanner.results.posts', { count: b.posts })}</span>
                  </span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden" aria-hidden>
                  <div
                    className={cn('h-full rounded-full', few ? 'bg-muted-foreground/30' : 'bg-primary')}
                    style={{ width: max > 0 && score > 0 ? `${(score / max) * 100}%` : '0%' }}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    );
  };

  const bestDaypart = bestBucket(summary.byDaypart, mode);
  const bestWeekday = bestBucket(summary.byWeekday, mode);

  return (
    <div className="space-y-6">
      {summary.basicOnly && (
        <Alert>
          <Link2 className="h-4 w-4" />
          <AlertDescription className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
            <span>{t('admin.socialPlanner.results.basicOnly')}</span>
            <Button variant="outline" size="sm" asChild>
              <Link to="/admin/connect?tab=channels">{t('admin.socialPlanner.results.reconnect')}</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{t('admin.socialPlanner.results.measured')}</p>
            <p className="text-2xl font-semibold tabular-nums">{nf.format(summary.measured)}</p>
            <p className="text-xs text-muted-foreground">{t('admin.socialPlanner.results.ofPosted', { count: postedCount })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{t('admin.socialPlanner.results.avgReach')}</p>
            <p className="text-2xl font-semibold tabular-nums">{summary.overall.avgReach === null ? '—' : nf.format(summary.overall.avgReach)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">
              {mode === 'score' ? t('admin.socialPlanner.results.avgRate') : t('admin.socialPlanner.results.avgInteractions')}
            </p>
            <p className="text-2xl font-semibold tabular-nums">{mode === 'score' ? rateText(summary.overall) : scoreText(summary.overall)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{t('admin.socialPlanner.results.followers')}</p>
            <p className="text-2xl font-semibold tabular-nums">{growth.current === null ? '—' : nf.format(growth.current)}</p>
            {growth.delta !== null && growth.since && (
              <p className="text-xs text-muted-foreground">
                {t('admin.socialPlanner.results.followersDelta', {
                  delta: `${growth.delta >= 0 ? '+' : ''}${nf.format(growth.delta)}`,
                  since: format(new Date(`${growth.since}T12:00:00`), 'd MMM', { locale }),
                })}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {summary.measured === 0 ? (
        <p className="text-sm text-muted-foreground">{t('admin.socialPlanner.results.waiting')}</p>
      ) : (
        <>
          <Card>
            <CardContent className="p-4 flex gap-3 items-start">
              <BarChart3 className="h-5 w-5 mt-0.5 shrink-0 text-primary" />
              <div className="text-sm space-y-1">
                {bestDaypart || bestWeekday ? (
                  <>
                    {bestDaypart && (
                      <p>{t('admin.socialPlanner.results.bestDaypart', {
                        part: t(`admin.socialPlanner.results.daypart.${bestDaypart.key}`), score: scoreText(bestDaypart), count: bestDaypart.posts,
                      })}</p>
                    )}
                    {bestWeekday && (
                      <p>{t('admin.socialPlanner.results.bestWeekday', {
                        day: weekdayLabel(bestWeekday.key), score: scoreText(bestWeekday), count: bestWeekday.posts,
                      })}</p>
                    )}
                  </>
                ) : (
                  <p>{t('admin.socialPlanner.results.tooFew', { min: MIN_POSTS_PER_BUCKET })}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {mode === 'score' ? t('admin.socialPlanner.results.scoreExplain') : t('admin.socialPlanner.results.interactionsExplain')}
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            {barList(t('admin.socialPlanner.results.byDaypart'), summary.byDaypart, (k) => t(`admin.socialPlanner.results.daypart.${k}`))}
            {barList(t('admin.socialPlanner.results.byWeekday'), summary.byWeekday, (k) => weekdayLabel(Number(k)))}
            {barList(t('admin.socialPlanner.results.byType'), summary.byType, (k) => typeLabel(String(k)))}
          </div>

          {TAG_KEYS.some((k) => summary.byTag[k]?.length) && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">{t('admin.socialPlanner.results.content')}</h3>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {TAG_KEYS.filter((k) => summary.byTag[k]?.length).map((k) =>
                  barList(t(`admin.socialPlanner.results.tag.${k}`), summary.byTag[k]!.slice(0, 8), tagLabel))}
              </div>
            </div>
          )}

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{t('admin.socialPlanner.results.top')}</CardTitle></CardHeader>
            <CardContent className="divide-y">
              {summary.top.map((p) => {
                const m = metricsOf(p);
                const rate = engagementRate(m);
                const score = scoreOf(m);
                const inter = interactionsOf(m);
                const link = p.engagement_data?.permalink;
                return (
                  <div key={p.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                    {p.image_urls?.[0] && <img src={p.image_urls[0]} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded object-cover bg-muted" />}
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(p.posted_at), 'EEE d MMM · HH:mm', { locale })} · {typeLabel(p.media_type)}
                      </p>
                      <p className="truncate">{p.post_text}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {[
                          typeof m?.reach === 'number' ? t('admin.socialPlanner.metrics.reach', { value: nf.format(m.reach) }) : null,
                          inter !== null ? t('admin.socialPlanner.metrics.interactions', { value: nf.format(inter) }) : null,
                          rate !== null ? `${pf.format(rate)} %` : null,
                          score !== null ? t('admin.socialPlanner.results.scoreValue', { value: pf.format(score) }) : null,
                        ].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    {link && (
                      <Button variant="ghost" size="icon" className="shrink-0" asChild>
                        <a href={link} target="_blank" rel="noopener noreferrer" aria-label={t('admin.socialPlanner.metrics.open')}>
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </>
      )}

      <p className="text-xs text-muted-foreground flex gap-1.5 items-start">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        {t('admin.socialPlanner.results.footnote')}
      </p>
    </div>
  );
}
