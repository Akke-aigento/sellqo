import { PublicPageLayout } from '@/components/landing/PublicPageLayout';
import { Button } from '@/components/ui/button';
import { Activity, ExternalLink, Mail } from 'lucide-react';
import { useTranslation, Trans } from 'react-i18next';

const STATUS_MONITOR_URL = 'https://status.sellqo.app';

export default function Status() {
  const { t } = useTranslation();
  return (
    <PublicPageLayout
      title={t('public.status.title')}
      subtitle={t('public.status.subtitle')}
    >
      <section className="max-w-2xl mx-auto mb-10">
        <div className="bg-card rounded-2xl border border-border p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
            <Activity className="w-7 h-7 text-accent" />
          </div>
          <p className="text-muted-foreground">{t('public.status.intro')}</p>
        </div>
      </section>

      <section className="max-w-2xl mx-auto mb-10 text-center">
        {STATUS_MONITOR_URL ? (
          <Button asChild size="lg">
            <a href={STATUS_MONITOR_URL} target="_blank" rel="noopener noreferrer">
              {t('public.status.button')}
              <ExternalLink className="w-4 h-4 ml-2" />
            </a>
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">{t('public.status.placeholder')}</p>
        )}
      </section>

      <section className="max-w-2xl mx-auto text-center">
        <p className="text-sm text-muted-foreground">
          <Trans
            i18nKey="public.status.supportLine"
            components={{
              email: (
                <a
                  href="mailto:info@sellqo.app"
                  className="text-accent hover:underline inline-flex items-center gap-1"
                >
                  <Mail className="w-3.5 h-3.5" />
                  info@sellqo.app
                </a>
              ),
            }}
          />
        </p>
      </section>
    </PublicPageLayout>
  );
}
