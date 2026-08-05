import { useSearchParams } from 'react-router-dom';
import { PublicPageLayout } from '@/components/landing/PublicPageLayout';
import { PageMeta } from '@/components/seo/PageMeta';
import { useTranslation } from 'react-i18next';
import { XCircle } from 'lucide-react';

export default function PayCancelled() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const prNumber = searchParams.get('pr');
  const invoiceNumber = searchParams.get('invoice');

  const referenceValue = prNumber || invoiceNumber;
  const referenceLabel = prNumber
    ? t('public.pay.cancelled.prLabel')
    : invoiceNumber
      ? t('public.pay.cancelled.invoiceLabel')
      : null;

  return (
    <>
      <PageMeta
        title={t('public.pay.cancelled.meta.title')}
        description={t('public.pay.cancelled.meta.description')}
        path="/pay/cancelled"
      />
      <PublicPageLayout
        title={t('public.pay.cancelled.title')}
        subtitle={t('public.pay.cancelled.subtitle')}
      >
        <div className="max-w-xl mx-auto text-center">
          <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
            <XCircle className="w-10 h-10 text-red-600" />
          </div>
          <p className="text-lg text-muted-foreground mb-6">
            {t('public.pay.cancelled.description')}
          </p>
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
