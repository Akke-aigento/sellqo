// ALLERGEEN-ADMIN-1 — "allergenen: 2", "geen allergenen" of (amber) "niet ingevuld".
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { allergenState } from '@/components/admin/storefront/food/allergenState';

export function AllergenStateLabel({ allergens, declared, className }: { allergens: string[] | null; declared?: boolean; className?: string }) {
  const { t } = useTranslation();
  const s = allergenState(allergens, declared);
  if (s.kind === 'count') return <span className={cn('ml-2 font-normal text-muted-foreground', className)}>{t('admin.kaart.sheet.allergenCount', { count: s.n })}</span>;
  if (s.kind === 'none') return <span className={cn('ml-2 font-normal text-muted-foreground', className)}>{t('admin.kaart.allergenState.none')}</span>;
  return <span className={cn('ml-2 font-normal text-amber-700 dark:text-amber-400', className)}>{t('admin.kaart.allergenState.missing')}</span>;
}
