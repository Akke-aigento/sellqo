import { Link } from 'react-router-dom';
import { PublicPageLayout } from '@/components/landing/PublicPageLayout';
import { Button } from '@/components/ui/button';
import { Code, Lock, Book } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function ApiDocs() {
  const { t } = useTranslation();
  return (
    <PublicPageLayout
      title={t('public.api.title')}
      subtitle={t('public.api.subtitle')}
    >
      <section className="max-w-2xl mx-auto mb-12">
        <div className="bg-accent/10 border border-accent/30 rounded-xl p-6 text-center">
          <Code className="w-10 h-10 text-accent mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">{t('public.api.banner.title')}</h2>
          <p className="text-muted-foreground">{t('public.api.banner.text')}</p>
        </div>
      </section>

      <section className="max-w-2xl mx-auto mb-12 space-y-4">
        <div className="bg-card rounded-xl border border-border p-6 flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
            <Code className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-1">{t('public.api.features.rest.title')}</h3>
            <p className="text-sm text-muted-foreground">{t('public.api.features.rest.description')}</p>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-6 flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-1">{t('public.api.features.auth.title')}</h3>
            <p className="text-sm text-muted-foreground">{t('public.api.features.auth.description')}</p>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-6 flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
            <Book className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-1">{t('public.api.features.docs.title')}</h3>
            <p className="text-sm text-muted-foreground">{t('public.api.features.docs.description')}</p>
          </div>
        </div>
      </section>

      <section className="text-center max-w-xl mx-auto">
        <h2 className="text-xl font-bold text-foreground mb-4">{t('public.api.ctaTitle')}</h2>
        <p className="text-muted-foreground mb-6">{t('public.api.ctaText')}</p>
        <Button asChild>
          <Link to="/contact">{t('public.api.ctaButton')}</Link>
        </Button>
      </section>
    </PublicPageLayout>
  );
}