import { Link } from 'react-router-dom';
import { PublicPageLayout } from '@/components/landing/PublicPageLayout';
import { Button } from '@/components/ui/button';
import { BookOpen, ShoppingBag, CreditCard, Package, Users, Settings, MessageSquare, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const categoryKeys = [
  { key: 'start', icon: BookOpen, color: 'bg-green-500/10 text-green-600' },
  { key: 'products', icon: ShoppingBag, color: 'bg-blue-500/10 text-blue-600' },
  { key: 'orders', icon: Package, color: 'bg-purple-500/10 text-purple-600' },
  { key: 'payments', icon: CreditCard, color: 'bg-amber-500/10 text-amber-600' },
  { key: 'customers', icon: Users, color: 'bg-pink-500/10 text-pink-600' },
  { key: 'settings', icon: Settings, color: 'bg-cyan-500/10 text-cyan-600' },
] as const;

export default function HelpCenter() {
  const { t } = useTranslation();
  return (
    <PublicPageLayout title={t('public.help.title')} subtitle={t('public.help.subtitle')}>
      {/* Notice */}
      <section className="max-w-2xl mx-auto mb-12">
        <div className="bg-accent/10 border border-accent/30 rounded-xl p-6 text-center">
          <Sparkles className="w-8 h-8 text-accent mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-foreground mb-2">{t('public.help.noticeTitle')}</h2>
          <p className="text-sm text-muted-foreground">{t('public.help.noticeText')}</p>
        </div>
      </section>

      {/* Categories */}
      <section className="max-w-5xl mx-auto mb-16">
        <h2 className="text-2xl font-bold text-foreground text-center mb-8">{t('public.help.topicsTitle')}</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {categoryKeys.map((category, index) => (
            <div
              key={index}
              className="bg-card rounded-xl border border-border p-6"
            >
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-lg ${category.color} flex items-center justify-center shrink-0`}>
                  <category.icon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">{t(`public.help.categories.${category.key}.title`)}</h3>
                  <p className="text-sm text-muted-foreground">{t(`public.help.categories.${category.key}.description`)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Contact CTA */}
      <section className="max-w-2xl mx-auto">
        <div className="bg-card rounded-2xl border border-border p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="w-6 h-6 text-accent" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">{t('public.help.supportTitle')}</h2>
          <p className="text-muted-foreground mb-6">{t('public.help.supportText')}</p>
          <Button asChild className="w-full sm:w-auto">
            <Link to="/contact">{t('public.help.supportButton')}</Link>
          </Button>
        </div>
      </section>
    </PublicPageLayout>
  );
}