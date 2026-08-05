import { useSearchParams } from 'react-router-dom';
import { PublicPageLayout } from '@/components/landing/PublicPageLayout';
import { PageMeta } from '@/components/seo/PageMeta';
import { useTranslation } from 'react-i18next';
import { CheckCircle } from 'lucide-react';

export default function PaySuccess() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const prNumber = searchParams.get('pr');
  const invoiceNumber = searchParams.get('invoice');

  let description = t('public.pay.success.genericDescription');
  let referenceLabel: string | null = null;
  let referenceValue: string | null = null;

  if (prNumber) {
    description = t('public.pay.success.prDescription');
    referenceLabel = t('public.pay.success.prLabel');
    referenceValue = prNumber;
  } else if (invoiceNumber) {
    description = t('public.pay.success.invoiceDescription');
    referenceLabel = t('public.pay.success.invoiceLabel');
    referenceValue = invoiceNumber;
  }

  return (
    <>
      <PageMeta
        title={t('public.pay.success.meta.title')}
        description={t('public.pay.success.meta.description')}
        path="/pay/success"
      />
      <PublicPageLayout
        title={t('public.pay.success.title')}
        subtitle={t('public.pay.success.subtitle')}
      >
        <div className="max-w-xl mx-auto text-center">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <p className="text-lg text-muted-foreground mb-6">{description}</p>
          {referenceValue && (
            <div className="inline-flex items-center gap-2 bg-card rounded-lg border border-border px-4 py-2">
              <span className="text-sm text-muted-foreground">{referenceLabel}:</span>
              <span className="text-sm font-medium text-foreground">{referenceValue}</span>
            </div>
          )}
        </div>
      </PublicPageLayout>
    </>
  );
}
