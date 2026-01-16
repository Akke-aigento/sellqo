import { useTranslation } from 'react-i18next';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import type { ImportPlatform, ImportDataType } from '@/types/import';

// Platform logos as simple text representations (can be replaced with actual logos)
const platforms: { id: ImportPlatform; name: string; icon: string }[] = [
  { id: 'shopify', name: 'Shopify', icon: '🛍️' },
  { id: 'woocommerce', name: 'WooCommerce', icon: '🔮' },
  { id: 'magento', name: 'Magento', icon: '🔶' },
  { id: 'prestashop', name: 'PrestaShop', icon: '🛒' },
  { id: 'lightspeed', name: 'Lightspeed', icon: '⚡' },
  { id: 'csv', name: 'CSV / Excel', icon: '📊' },
];

const dataTypes: { id: ImportDataType; labelKey: string }[] = [
  { id: 'customers', labelKey: 'import.customers' },
  { id: 'products', labelKey: 'import.products' },
  { id: 'categories', labelKey: 'import.categories' },
  { id: 'orders', labelKey: 'import.orders' },
  { id: 'coupons', labelKey: 'import.coupons' },
];

interface PlatformSelectProps {
  selectedPlatform: ImportPlatform | null;
  onPlatformChange: (platform: ImportPlatform) => void;
  selectedDataTypes: ImportDataType[];
  onDataTypesChange: (types: ImportDataType[]) => void;
}

export function PlatformSelect({
  selectedPlatform,
  onPlatformChange,
  selectedDataTypes,
  onDataTypesChange,
}: PlatformSelectProps) {
  const { t } = useTranslation();

  const toggleDataType = (type: ImportDataType) => {
    if (selectedDataTypes.includes(type)) {
      onDataTypesChange(selectedDataTypes.filter(t => t !== type));
    } else {
      onDataTypesChange([...selectedDataTypes, type]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Platform Selection */}
      <div>
        <Label className="text-base font-semibold">
          {t('import.select_source')}
        </Label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
          {platforms.map((platform) => (
            <button
              key={platform.id}
              onClick={() => onPlatformChange(platform.id)}
              className={cn(
                'flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all',
                'hover:border-primary hover:bg-accent',
                selectedPlatform === platform.id
                  ? 'border-primary bg-primary/5'
                  : 'border-border'
              )}
            >
              <span className="text-3xl mb-2">{platform.icon}</span>
              <span className="font-medium text-sm">{platform.name}</span>
              {selectedPlatform === platform.id && (
                <span className="text-primary mt-1">✓</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Data Types Selection */}
      <div>
        <Label className="text-base font-semibold">
          {t('import.what_to_import')}
        </Label>
        <div className="space-y-3 mt-3">
          {dataTypes.map((type) => (
            <div
              key={type.id}
              className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-accent cursor-pointer"
              onClick={() => toggleDataType(type.id)}
            >
              <Checkbox
                checked={selectedDataTypes.includes(type.id)}
                onCheckedChange={() => toggleDataType(type.id)}
              />
              <Label className="cursor-pointer flex-1">
                {t(type.labelKey)}
              </Label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
