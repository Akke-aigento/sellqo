import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { BulkEditTabProps } from './BulkEditTypes';

export function BulkVisibilityTab({ state, onChange, enabledFields, onToggleField }: BulkEditTabProps) {
  return (
    <div className="space-y-6">
      {/* Status */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id="enable-status"
            checked={enabledFields.has('is_active')}
            onCheckedChange={() => onToggleField('is_active')}
          />
          <Label htmlFor="enable-status" className="font-medium cursor-pointer">
            Status
          </Label>
        </div>
        {enabledFields.has('is_active') && (
          <div className="pl-6">
            <RadioGroup
              value={state.is_active ? 'active' : 'inactive'}
              onValueChange={(value) => onChange({ is_active: value === 'active' })}
            >
              <div className="flex items-center gap-3">
                <RadioGroupItem value="active" id="status-active" />
                <Label htmlFor="status-active" className="cursor-pointer">Activeren</Label>
              </div>
              <div className="flex items-center gap-3">
                <RadioGroupItem value="inactive" id="status-inactive" />
                <Label htmlFor="status-inactive" className="cursor-pointer">Deactiveren</Label>
              </div>
            </RadioGroup>
          </div>
        )}
      </div>

      {/* Webshop zichtbaarheid */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id="enable-storefront"
            checked={enabledFields.has('hide_from_storefront')}
            onCheckedChange={() => onToggleField('hide_from_storefront')}
          />
          <Label htmlFor="enable-storefront" className="font-medium cursor-pointer">
            Webshop zichtbaarheid
          </Label>
        </div>
        {enabledFields.has('hide_from_storefront') && (
          <div className="pl-6">
            <RadioGroup
              value={state.hide_from_storefront ? 'hidden' : 'visible'}
              onValueChange={(value) => onChange({ hide_from_storefront: value === 'hidden' })}
            >
              <div className="flex items-center gap-3">
                <RadioGroupItem value="visible" id="storefront-visible" />
                <Label htmlFor="storefront-visible" className="cursor-pointer">Online tonen</Label>
              </div>
              <div className="flex items-center gap-3">
                <RadioGroupItem value="hidden" id="storefront-hidden" />
                <Label htmlFor="storefront-hidden" className="cursor-pointer">Alleen winkel (POS)</Label>
              </div>
            </RadioGroup>
          </div>
        )}
      </div>

      {/* Featured/Uitgelicht */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id="enable-featured"
            checked={enabledFields.has('is_featured')}
            onCheckedChange={() => onToggleField('is_featured')}
          />
          <Label htmlFor="enable-featured" className="font-medium cursor-pointer">
            Featured/Uitgelicht
          </Label>
        </div>
        {enabledFields.has('is_featured') && (
          <div className="pl-6">
            <RadioGroup
              value={state.is_featured ? 'featured' : 'not-featured'}
              onValueChange={(value) => onChange({ is_featured: value === 'featured' })}
            >
              <div className="flex items-center gap-3">
                <RadioGroupItem value="featured" id="featured-yes" />
                <Label htmlFor="featured-yes" className="cursor-pointer">Uitlichten</Label>
              </div>
              <div className="flex items-center gap-3">
                <RadioGroupItem value="not-featured" id="featured-no" />
                <Label htmlFor="featured-no" className="cursor-pointer">Niet uitlichten</Label>
              </div>
            </RadioGroup>
          </div>
        )}
      </div>

      {/* Verzending vereist */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id="enable-shipping"
            checked={enabledFields.has('requires_shipping')}
            onCheckedChange={() => onToggleField('requires_shipping')}
          />
          <Label htmlFor="enable-shipping" className="font-medium cursor-pointer">
            Verzending vereist
          </Label>
        </div>
        {enabledFields.has('requires_shipping') && (
          <div className="pl-6">
            <RadioGroup
              value={state.requires_shipping ? 'yes' : 'no'}
              onValueChange={(value) => onChange({ requires_shipping: value === 'yes' })}
            >
              <div className="flex items-center gap-3">
                <RadioGroupItem value="yes" id="shipping-yes" />
                <Label htmlFor="shipping-yes" className="cursor-pointer">Ja</Label>
              </div>
              <div className="flex items-center gap-3">
                <RadioGroupItem value="no" id="shipping-no" />
                <Label htmlFor="shipping-no" className="cursor-pointer">Nee</Label>
              </div>
            </RadioGroup>
          </div>
        )}
      </div>
    </div>
  );
}
