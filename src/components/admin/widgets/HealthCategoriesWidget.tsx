import { useShopHealth } from '@/hooks/useShopHealth';
import { Skeleton } from '@/components/ui/skeleton';
import { HealthCategoryCardCompact } from '@/components/shop-health';

export function HealthCategoriesWidget() {
  const { categories, isLoading } = useShopHealth();
  
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }
  
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {categories.map((category) => (
        <HealthCategoryCardCompact key={category.id} category={category} />
      ))}
    </div>
  );
}
