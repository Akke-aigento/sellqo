import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useShippingClasses } from '@/hooks/useShippingClasses';
import type { ProductSpecification } from '@/types/specifications';
import { useTranslation } from 'react-i18next';

interface LogisticsFieldsProps {
  spec: Partial<ProductSpecification> | null;
  onChange: (updates: Partial<ProductSpecification>) => void;
}

const NO_CLASS = '__none__';

export function LogisticsFields({ spec, onChange }: LogisticsFieldsProps) {
  const { t } = useTranslation();
  const val = (key: keyof ProductSpecification) => (spec as any)?.[key] ?? '';
  const { shippingClasses } = useShippingClasses();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label className="text-sm">{t('admin.products.specs.logisticsFields.doorlooptijd_dagen')}</Label>
          <Input type="number" min="0" value={val('lead_time_days')} onChange={(e) => onChange({ lead_time_days: e.target.value ? parseInt(e.target.value) : null })} placeholder="3" />
        </div>
        <div className="space-y-1">
          <Label className="text-sm">{t('admin.products.specs.logisticsFields.verzendklasse')}</Label>
          <Select
            value={spec?.shipping_class_id ?? NO_CLASS}
            onValueChange={(v) => onChange({ shipping_class_id: v === NO_CLASS ? null : v })}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('admin.products.specs.logisticsFields.kies_een_verzendklasse')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_CLASS}>{t('admin.products.grid.gridSelectCell.geen')}</SelectItem>
              {shippingClasses.map((cls) => (
                <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{t('admin.products.specs.logisticsFields.bijvoorbeeld_boxspring_voor_producten_die_met')}</p>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border p-3">
        <Label className="text-sm">{t('admin.products.specs.logisticsFields.breekbaar')}</Label>
        <Switch checked={spec?.is_fragile ?? false} onCheckedChange={(checked) => onChange({ is_fragile: checked })} />
      </div>

      <div className="flex items-center justify-between rounded-lg border p-3">
        <Label className="text-sm">{t('admin.products.specs.logisticsFields.gevaarlijke_stoffen')}</Label>
        <Switch checked={spec?.is_hazardous ?? false} onCheckedChange={(checked) => onChange({ is_hazardous: checked })} />
      </div>

      {spec?.is_hazardous && (
        <div className="space-y-1">
          <Label className="text-sm">{t('admin.products.specs.logisticsFields.gevarenklasse')}</Label>
          <Input value={val('hazard_class')} onChange={(e) => onChange({ hazard_class: e.target.value || null })} placeholder={t('admin.products.specs.logisticsFields.bijv_un3481')} />
        </div>
      )}

      <div className="space-y-1">
        <Label className="text-sm">{t('admin.products.specs.logisticsFields.opslaginstructies')}</Label>
        <Textarea value={val('storage_instructions')} onChange={(e) => onChange({ storage_instructions: e.target.value || null })} placeholder={t('admin.products.specs.logisticsFields.droog_en_koel_bewaren')} rows={2} />
      </div>
    </div>
  );
}
