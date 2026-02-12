import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ProductSpecification } from '@/types/specifications';

interface DimensionsFieldsProps {
  spec: Partial<ProductSpecification> | null;
  onChange: (updates: Partial<ProductSpecification>) => void;
}

export function DimensionsFields({ spec, onChange }: DimensionsFieldsProps) {
  const val = (key: keyof ProductSpecification) => (spec as any)?.[key] ?? '';

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Productafmetingen</Label>
        <div className="grid grid-cols-3 gap-3 mt-2">
          <div className="space-y-1">
            <Label className="text-sm">Lengte (cm)</Label>
            <Input type="number" step="0.1" min="0" value={val('length_cm')} onChange={(e) => onChange({ length_cm: e.target.value ? parseFloat(e.target.value) : null })} placeholder="0" />
          </div>
          <div className="space-y-1">
            <Label className="text-sm">Breedte (cm)</Label>
            <Input type="number" step="0.1" min="0" value={val('width_cm')} onChange={(e) => onChange({ width_cm: e.target.value ? parseFloat(e.target.value) : null })} placeholder="0" />
          </div>
          <div className="space-y-1">
            <Label className="text-sm">Hoogte (cm)</Label>
            <Input type="number" step="0.1" min="0" value={val('height_cm')} onChange={(e) => onChange({ height_cm: e.target.value ? parseFloat(e.target.value) : null })} placeholder="0" />
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-sm">Gewicht (kg)</Label>
        <Input type="number" step="0.01" min="0" value={val('weight_kg')} onChange={(e) => onChange({ weight_kg: e.target.value ? parseFloat(e.target.value) : null })} placeholder="0" className="max-w-[200px]" />
      </div>

      <div>
        <Label className="text-xs text-muted-foreground font-medium uppercase tracking-wide mt-4">Verpakkingsafmetingen</Label>
        <div className="grid grid-cols-3 gap-3 mt-2">
          <div className="space-y-1">
            <Label className="text-sm">Lengte (cm)</Label>
            <Input type="number" step="0.1" min="0" value={val('package_length_cm')} onChange={(e) => onChange({ package_length_cm: e.target.value ? parseFloat(e.target.value) : null })} placeholder="0" />
          </div>
          <div className="space-y-1">
            <Label className="text-sm">Breedte (cm)</Label>
            <Input type="number" step="0.1" min="0" value={val('package_width_cm')} onChange={(e) => onChange({ package_width_cm: e.target.value ? parseFloat(e.target.value) : null })} placeholder="0" />
          </div>
          <div className="space-y-1">
            <Label className="text-sm">Hoogte (cm)</Label>
            <Input type="number" step="0.1" min="0" value={val('package_height_cm')} onChange={(e) => onChange({ package_height_cm: e.target.value ? parseFloat(e.target.value) : null })} placeholder="0" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-sm">Brutogewicht (kg)</Label>
          <Input type="number" step="0.01" min="0" value={val('package_weight_kg')} onChange={(e) => onChange({ package_weight_kg: e.target.value ? parseFloat(e.target.value) : null })} placeholder="0" />
        </div>
        <div className="space-y-1">
          <Label className="text-sm">Stuks per verpakking</Label>
          <Input type="number" step="1" min="1" value={val('units_per_package')} onChange={(e) => onChange({ units_per_package: e.target.value ? parseInt(e.target.value) : null })} placeholder="1" />
        </div>
      </div>
    </div>
  );
}
