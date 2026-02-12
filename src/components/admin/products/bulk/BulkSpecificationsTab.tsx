import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { BulkEditTabProps } from './BulkEditTypes';

interface BulkSpecificationsTabProps extends BulkEditTabProps {
  // Uses the existing enabledFields/onToggleField pattern
}

export function BulkSpecificationsTab({ state, onChange, enabledFields, onToggleField }: BulkSpecificationsTabProps) {
  return (
    <div className="space-y-6">
      {/* Brand */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id="enable-brand"
            checked={enabledFields.has('spec_brand')}
            onCheckedChange={() => onToggleField('spec_brand')}
          />
          <Label htmlFor="enable-brand" className="font-medium cursor-pointer">Merk instellen</Label>
        </div>
        {enabledFields.has('spec_brand') && (
          <Input
            value={(state as any).spec_brand || ''}
            onChange={(e) => onChange({ spec_brand: e.target.value } as any)}
            placeholder="Merknaam"
          />
        )}
      </div>

      {/* Country of origin */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id="enable-country"
            checked={enabledFields.has('spec_country_of_origin')}
            onCheckedChange={() => onToggleField('spec_country_of_origin')}
          />
          <Label htmlFor="enable-country" className="font-medium cursor-pointer">Herkomstland instellen</Label>
        </div>
        {enabledFields.has('spec_country_of_origin') && (
          <Input
            value={(state as any).spec_country_of_origin || ''}
            onChange={(e) => onChange({ spec_country_of_origin: e.target.value } as any)}
            placeholder="NL, DE, CN..."
          />
        )}
      </div>

      {/* HS Tariff Code */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id="enable-hs"
            checked={enabledFields.has('spec_hs_tariff_code')}
            onCheckedChange={() => onToggleField('spec_hs_tariff_code')}
          />
          <Label htmlFor="enable-hs" className="font-medium cursor-pointer">HS/Taric code instellen</Label>
        </div>
        {enabledFields.has('spec_hs_tariff_code') && (
          <Input
            value={(state as any).spec_hs_tariff_code || ''}
            onChange={(e) => onChange({ spec_hs_tariff_code: e.target.value } as any)}
            placeholder="Douanecode"
          />
        )}
      </div>

      {/* Manufacturer */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id="enable-manufacturer"
            checked={enabledFields.has('spec_manufacturer')}
            onCheckedChange={() => onToggleField('spec_manufacturer')}
          />
          <Label htmlFor="enable-manufacturer" className="font-medium cursor-pointer">Fabrikant instellen</Label>
        </div>
        {enabledFields.has('spec_manufacturer') && (
          <Input
            value={(state as any).spec_manufacturer || ''}
            onChange={(e) => onChange({ spec_manufacturer: e.target.value } as any)}
            placeholder="Naam fabrikant"
          />
        )}
      </div>
    </div>
  );
}
