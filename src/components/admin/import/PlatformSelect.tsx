import { useTranslation } from 'react-i18next';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  ShoppingBag,
  Store,
  Layers,
  Boxes,
  Zap,
  FileSpreadsheet,
  Users,
  Package,
  FolderTree,
  ShoppingCart,
  Ticket,
  CheckCircle2,
  Info,
  type LucideIcon,
} from 'lucide-react';
import type { ImportPlatform, ImportDataType } from '@/types/import';

const platforms: { id: ImportPlatform; name: string; icon: LucideIcon }[] = [
  { id: 'shopify', name: 'Shopify', icon: ShoppingBag },
  { id: 'woocommerce', name: 'WooCommerce', icon: Store },
  { id: 'magento', name: 'Magento', icon: Layers },
  { id: 'prestashop', name: 'PrestaShop', icon: Boxes },
  { id: 'lightspeed', name: 'Lightspeed', icon: Zap },
  { id: 'csv', name: 'CSV / Excel', icon: FileSpreadsheet },
];

const dataTypes: { id: ImportDataType; labelKey: string; descKey: string; icon: LucideIcon }[] = [
  { id: 'customers', labelKey: 'import.customers', descKey: 'import.data_type_desc.customers', icon: Users },
  { id: 'products', labelKey: 'import.products', descKey: 'import.data_type_desc.products', icon: Package },
  { id: 'categories', labelKey: 'import.categories', descKey: 'import.data_type_desc.categories', icon: FolderTree },
  { id: 'orders', labelKey: 'import.orders', descKey: 'import.data_type_desc.orders', icon: ShoppingCart },
  { id: 'coupons', labelKey: 'import.coupons', descKey: 'import.data_type_desc.coupons', icon: Ticket },
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

  const platformLabel = selectedPlatform
    ? platforms.find((p) => p.id === selectedPlatform)?.name ?? selectedPlatform
    : '';

  const getSteps = (platform: ImportPlatform, dt: ImportDataType): string[] | null => {
    const steps = t(`import.export_guide.platforms.${platform}.${dt}`, {
      returnObjects: true,
      defaultValue: null,
    }) as unknown;
    if (Array.isArray(steps) && steps.every((s) => typeof s === 'string')) {
      return steps as string[];
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Platform Selection */}
      <div>
        <Label className="text-base font-semibold">
          {t('import.select_source')}
        </Label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
          {platforms.map((platform) => {
            const Icon = platform.icon;
            const selected = selectedPlatform === platform.id;
            return (
              <button
                type="button"
                key={platform.id}
                onClick={() => onPlatformChange(platform.id)}
                className={cn(
                  'relative flex flex-col items-center justify-center gap-3 p-4 h-28 rounded-lg border-2 transition-all text-center',
                  'hover:border-primary hover:bg-accent',
                  selected ? 'border-primary bg-primary/5' : 'border-border'
                )}
              >
                <span
                  className={cn(
                    'inline-flex h-10 w-10 items-center justify-center rounded-full',
                    'bg-primary/10 text-primary'
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="font-medium text-sm leading-tight">{platform.name}</span>
                {selected && (
                  <CheckCircle2 className="absolute top-2 right-2 h-4 w-4 text-primary" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Data Types Selection */}
      <div>
        <Label className="text-base font-semibold">
          {t('import.what_to_import')}
        </Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          {dataTypes.map((type) => {
            const Icon = type.icon;
            const selected = selectedDataTypes.includes(type.id);
            return (
              <button
                type="button"
                key={type.id}
                onClick={() => toggleDataType(type.id)}
                className={cn(
                  'relative flex items-start gap-3 p-4 rounded-lg border-2 transition-all text-left',
                  'hover:border-primary hover:bg-accent',
                  selected ? 'border-primary bg-primary/5' : 'border-border'
                )}
              >
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{t(type.labelKey)}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {t(type.descKey)}
                  </div>
                </div>
                <Checkbox
                  checked={selected}
                  onCheckedChange={() => toggleDataType(type.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-0.5"
                />
                {selected && (
                  <CheckCircle2 className="absolute top-2 right-2 h-4 w-4 text-primary opacity-0" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Export Guide Panel */}
      {selectedPlatform && (
        <Card className="p-4 sm:p-6 bg-muted/40">
          <div className="flex items-start gap-3 mb-4">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
              <Info className="h-4 w-4" />
            </span>
            <div>
              <h3 className="font-semibold text-base">
                {t('import.export_guide.panel_title', { platform: platformLabel })}
              </h3>
            </div>
          </div>

          {selectedPlatform === 'csv' ? (
            <p className="text-sm text-muted-foreground">
              {t('import.export_guide.csv_note')}
            </p>
          ) : selectedDataTypes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('import.export_guide.select_datatypes_first')}
            </p>
          ) : (
            <div className="space-y-5">
              {selectedDataTypes.map((dt) => {
                const steps = getSteps(selectedPlatform, dt);
                const dtLabel = t(`import.${dt}`);
                return (
                  <div key={dt}>
                    <div className="font-medium text-sm mb-2">{dtLabel}</div>
                    {steps ? (
                      <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                        {steps.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ol>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {t('import.export_guide.fallback', {
                          platform: platformLabel,
                          dataType: dtLabel.toLowerCase(),
                        })}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
