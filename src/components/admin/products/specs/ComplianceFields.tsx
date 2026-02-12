import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { ProductSpecification } from '@/types/specifications';

interface ComplianceFieldsProps {
  spec: Partial<ProductSpecification> | null;
  onChange: (updates: Partial<ProductSpecification>) => void;
}

export function ComplianceFields({ spec, onChange }: ComplianceFieldsProps) {
  const val = (key: keyof ProductSpecification) => (spec as any)?.[key] ?? '';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label className="text-sm">Garantie (maanden)</Label>
          <Input type="number" min="0" value={val('warranty_months')} onChange={(e) => onChange({ warranty_months: e.target.value ? parseInt(e.target.value) : null })} placeholder="24" />
        </div>
        <div className="space-y-1">
          <Label className="text-sm">Energielabel</Label>
          <Input value={val('energy_label')} onChange={(e) => onChange({ energy_label: e.target.value || null })} placeholder="A+++ tot G" />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border p-3">
        <Label className="text-sm">CE-markering</Label>
        <Switch checked={spec?.ce_marking ?? false} onCheckedChange={(checked) => onChange({ ce_marking: checked })} />
      </div>

      <div className="space-y-1">
        <Label className="text-sm">Veiligheidsinstructies</Label>
        <Textarea value={val('safety_warnings')} onChange={(e) => onChange({ safety_warnings: e.target.value || null })} placeholder="Veiligheidswaarschuwingen en instructies" rows={2} />
      </div>
    </div>
  );
}
