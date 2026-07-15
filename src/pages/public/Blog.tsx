import { Link } from 'react-router-dom';
import { PublicPageLayout } from '@/components/landing/PublicPageLayout';
import { Button } from '@/components/ui/button';
import { BookOpen, Rocket } from 'lucide-react';
import { PageMeta } from '@/components/seo/PageMeta';
import { useTranslation } from 'react-i18next';

export default function Blog() {
  const { t } = useTranslation();
  return (
    <>
      <PageMeta
        title={t('public.blog.meta.title')}
        description={t('public.blog.meta.description')}
        path="/blog"
      />
      <PublicPageLayout title={t('public.blog.title')} subtitle={t('public.blog.subtitle')}>
        <section className="max-w-2xl mx-auto text-center">
          <div className="bg-card rounded-2xl border border-border p-10">
            <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-5">
              <BookOpen className="w-7 h-7 text-accent" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-3">{t('public.blog.emptyTitle')}</h2>
            <p className="text-muted-foreground mb-8">{t('public.blog.emptyText')}</p>
            <Button asChild>
              <Link to="/changelog">
                <Rocket className="w-4 h-4 mr-2" />
                {t('public.blog.changelogButton')}
              </Link>
            </Button>
          </div>
        </section>
      </PublicPageLayout>
    </>
  );
}