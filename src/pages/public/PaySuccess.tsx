import { Link, useSearchParams } from 'react-router-dom';
import { PublicPageLayout } from '@/components/landing/PublicPageLayout';
import { PageMeta } from '@/components/seo/PageMeta';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, ArrowRight, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function PaySuccess() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const prNumber = searchParams.get('pr');
  const invoiceNumber = searchParams.get('invoice');

  let description = t('public.pay.success.genericDescription');
  let referenceLabel: string | null = null;
  let referenceValue: string | null = null;
  let ctaHref = '/admin';
  let ctaLabel = t('public.pay.success.ctaGeneric');

  if (prNumber) {
    description = t('public.pay.success.prDescription');
    referenceLabel = t('public.pay.success.prLabel');
    referenceValue = prNumber;
    ctaHref = `/admin/billing?paid=${encodeURIComponent(prNumber)}`;
    ctaLabel = t('public.pay.success.ctaSubscription');
  } else if (invoiceNumber) {
    description = t('public.pay.success.invoiceDescription');
    referenceLabel = t('public.pay.success.invoiceLabel');
    referenceValue = invoiceNumber;
    ctaHref = `/admin/billing?paid_invoice=${encodeURIComponent(invoiceNumber)}`;
    ctaLabel = t('public.pay.success.ctaSubscription');
  }

  return (
    <>
      <PageMeta
        title={t('public.pay.success.meta.title')}
        description={t('public.pay.success.meta.description')}
        path="/pay/success"
      />
      <PublicPageLayout
        title={t('public.pay.success.headline')}
        subtitle={t('public.pay.success.subtitle')}
      >
        <Card className="max-w-xl mx-auto border-border/70 shadow-sm">
          <CardContent className="flex flex-col items-center gap-6 px-6 py-10 text-center sm:px-10">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle2 className="h-11 w-11 text-primary" strokeWidth={1.75} />
            </div>

            <div className="space-y-3">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                {t('public.pay.success.headline')}
              </h2>
              <p className="text-base leading-relaxed text-muted-foreground">{description}</p>
            </div>

            {referenceValue && (
              <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-4 py-2">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  {referenceLabel}
                </span>
                <span className="font-mono text-sm font-medium text-foreground break-all">
                  {referenceValue}
                </span>
              </div>
            )}

            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-4 w-4 shrink-0" />
              <span>{t('public.pay.success.emailNote')}</span>
            </div>

            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link to={ctaHref}>
                {ctaLabel}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </PublicPageLayout>
    </>
  );
}
