import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ProductSpecification } from '@/types/specifications';

interface IdentificationFieldsProps {
  spec: Partial<ProductSpecification> | null;
  onChange: (updates: Partial<ProductSpecification>) => void;
}

export function IdentificationFields({ spec, onChange }: IdentificationFieldsProps) {
  const val = (key: keyof ProductSpecification) => (spec as any)?.[key] ?? '';

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-1">
        <Label className="text-sm">UPC</Label>
        <Input value={val('upc')} onChange={(e) => onChange({ upc: e.target.value || null })} placeholder="Universal Product Code" />
      </div>
      <div className="space-y-1">
        <Label className="text-sm">MPN</Label>
        <Input value={val('mpn')} onChange={(e) => onChange({ mpn: e.target.value || null })} placeholder="Manufacturer Part Number" />
      </div>
      <div className="space-y-1">
        <Label className="text-sm">ISBN</Label>
        <Input value={val('isbn')} onChange={(e) => onChange({ isbn: e.target.value || null })} placeholder="Voor boeken" />
      </div>
      <div className="space-y-1">
        <Label className="text-sm">Merk</Label>
        <Input value={val('brand')} onChange={(e) => onChange({ brand: e.target.value || null })} placeholder="Merknaam" />
      </div>
      <div className="space-y-1">
        <Label className="text-sm">Fabrikant</Label>
        <Input value={val('manufacturer')} onChange={(e) => onChange({ manufacturer: e.target.value || null })} placeholder="Naam fabrikant" />
      </div>
      <div className="space-y-1">
        <Label className="text-sm">Modelnummer</Label>
        <Input value={val('model_number')} onChange={(e) => onChange({ model_number: e.target.value || null })} placeholder="Model nummer" />
      </div>
      <div className="space-y-1">
        <Label className="text-sm">Herkomstland</Label>
        <Input value={val('country_of_origin')} onChange={(e) => onChange({ country_of_origin: e.target.value || null })} placeholder="NL, DE, CN..." />
      </div>
      <div className="space-y-1">
        <Label className="text-sm">HS/Taric code</Label>
        <Input value={val('hs_tariff_code')} onChange={(e) => onChange({ hs_tariff_code: e.target.value || null })} placeholder="Douanecode" />
      </div>
    </div>
  );
}
