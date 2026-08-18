import { usePublicProducts } from '@/hooks/usePublicStorefront';
import { ProductCard } from '@/components/storefront/ProductCard';
import { useTranslation } from 'react-i18next';

interface RelatedProductsProps {
  tenantId: string;
  currentProductId: string;
  categoryId?: string;
  basePath: string;
  currency?: string;
  mode: 'auto' | 'manual' | 'off';
}

export function RelatedProducts({ tenantId, currentProductId, categoryId, basePath, currency = 'EUR', mode }: RelatedProductsProps) {
  const { t } = useTranslation();
  // Auto mode: fetch products from same category
  const { data: products } = usePublicProducts(tenantId, {
    categoryId: mode === 'auto' ? categoryId : undefined,
    limit: 8,
  });

  if (mode === 'off' || !products || products.length === 0) return null;

  // Filter out current product and limit to 4
  const related = products.filter(p => {t('storefront.relatedProducts.p_id_currentproductid_slice_0_4')}
    <div className="mt-16 border-t pt-12">
      <h2 className="text-2xl font-bold mb-8">{t('storefront.relatedProducts.gerelateerde_producten')}</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {related.map(product => (
          <ProductCard
            key={product.id}
            product={product}
            basePath={basePath}
            currency={currency}
          />
        ))}
      </div>
    </div>
  );
}