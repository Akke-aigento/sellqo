import { useTranslation } from 'react-i18next';
import { Clock } from 'lucide-react';

/**
 * APP-CLEAN-1 — eerlijke plaatshouder voor SEO-onderdelen zonder echte databron.
 *
 * Search Console, Core Web Vitals, concurrentieanalyse en geplande audits toonden
 * tot 12-10-2026 cijfers uit Math.random() en schreven die zelfs weg. Zolang er
 * geen echte koppeling is (Google Search Console, PageSpeed Insights, ...), staat
 * hier wat het wordt in plaats van verzonnen data.
 */
type Part = 'searchConsole' | 'webVitals' | 'competitors' | 'audits';

export function SeoComingSoon({ part }: { part: Part }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-start gap-3 rounded-lg border border-dashed p-4 text-sm">
      <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0">
        <p className="font-medium">
          {t(`admin.seo.comingSoon.${part}.title`)}{' '}
          <span className="text-muted-foreground font-normal">· {t('admin.seo.comingSoon.badge')}</span>
        </p>
        <p className="text-muted-foreground">{t(`admin.seo.comingSoon.${part}.body`)}</p>
      </div>
    </div>
  );
}
