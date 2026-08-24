import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { ProductSpecification } from '@/types/specifications';
import { useTranslation } from 'react-i18next';

interface ComplianceFieldsProps {
  spec: Partial<ProductSpecification> | null;
  onChange: (updates: Partial<ProductSpecification>) => void;
}

export function ComplianceFields({ spec, onChange }: ComplianceFieldsProps) {
  const { t } = useTranslation();
  const val = (key: keyof ProductSpecification) => (spec as any)?.[key] ?? '';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label className="text-sm">{t('admin.products.specs.complianceFields.garantie_maanden')}</Label>
          <Input type="number" min="0" value={val('warranty_months')} onChange={(e) => onChange({ warranty_months: e.target.value ? parseInt(e.target.value) : null })} placeholder="24" />
        </div>
        <div className="space-y-1">
          <Label className="text-sm">{t('admin.products.specs.complianceFields.energielabel')}</Label>
          <Input value={val('energy_label')} onChange={(e) => onChange({ energy_label: e.target.value || null })} placeholder={t('admin.products.specs.complianceFields.a_tot_g')} />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border p-3">
        <Label className="text-sm">CE-markering</Label>
        <Switch checked={spec?.ce_marking ?? false} onCheckedChange={(checked) => onChange({ ce_marking: checked })} />
      </div>

      <div className="space-y-1">
        <Label className="text-sm">{t('admin.products.specs.complianceFields.veiligheidsinstructies')}</Label>
        <Textarea value={val('safety_warnings')} onChange={(e) => onChange({ safety_warnings: e.target.value || null })} placeholder={t('admin.products.specs.complianceFields.veiligheidswaarschuwingen_en_instructies')} rows={2} />
      </div>
    </div>
  );
}
