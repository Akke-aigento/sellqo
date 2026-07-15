import { Link } from 'react-router-dom';
import { PublicPageLayout } from '@/components/landing/PublicPageLayout';
import { Button } from '@/components/ui/button';
import { Building2, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function Careers() {
  const { t } = useTranslation();
  return (
    <PublicPageLayout
      title={t('public.careers.title')}
      subtitle={t('public.careers.subtitle')}
    >
      <section className="max-w-2xl mx-auto">
        <div className="bg-card rounded-2xl border border-border p-8 md:p-10">
          <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-6">
            <Building2 className="w-6 h-6 text-accent" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-4">{t('public.careers.heading')}</h2>
          <p
            className="text-muted-foreground mb-4 [&_strong]:font-medium [&_strong]:text-foreground"
            dangerouslySetInnerHTML={{ __html: t('public.careers.p1') }}
          />
          <p className="text-muted-foreground mb-8">{t('public.careers.p2')}</p>
          <Button asChild size="lg">
            <Link to="/contact">
              <Send className="w-4 h-4 mr-2" />
              {t('public.careers.button')}
            </Link>
          </Button>
        </div>
      </section>
    </PublicPageLayout>
  );
}
