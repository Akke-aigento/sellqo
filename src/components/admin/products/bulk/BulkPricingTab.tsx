import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { BulkEditTabProps } from './BulkEditTypes';

export function BulkPricingTab({ state, onChange, enabledFields, onToggleField }: BulkEditTabProps) {
  const priceAdjustmentType = state.price_adjustment?.type || 'add';
  const priceAdjustmentValue = state.price_adjustment?.value || 0;

  const handlePriceTypeChange = (type: string) => {
    onChange({
      price_adjustment: {
        type: type as any,
        value: priceAdjustmentValue,
      },
    });
  };

  const handlePriceValueChange = (value: number) => {
    onChange({
      price_adjustment: {
        type: priceAdjustmentType as any,
        value,
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Verkoopprijs */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id="enable-price"
            checked={enabledFields.has('price_adjustment')}
            onCheckedChange={() => onToggleField('price_adjustment')}
          />
          <Label htmlFor="enable-price" className="font-medium cursor-pointer">
            Verkoopprijs aanpassen
          </Label>
        </div>
        {enabledFields.has('price_adjustment') && (
          <div className="space-y-4 pl-6">
            <RadioGroup value={priceAdjustmentType} onValueChange={handlePriceTypeChange}>
              <div className="flex items-center gap-3">
                <RadioGroupItem value="add" id="price-add" />
                <Label htmlFor="price-add" className="cursor-pointer">Vast bedrag toevoegen</Label>
              </div>
              <div className="flex items-center gap-3">
                <RadioGroupItem value="subtract" id="price-subtract" />
                <Label htmlFor="price-subtract" className="cursor-pointer">Vast bedrag aftrekken</Label>
              </div>
              <div className="flex items-center gap-3">
                <RadioGroupItem value="percentage_up" id="price-percent-up" />
                <Label htmlFor="price-percent-up" className="cursor-pointer">Percentage verhogen</Label>
              </div>
              <div className="flex items-center gap-3">
                <RadioGroupItem value="percentage_down" id="price-percent-down" />
                <Label htmlFor="price-percent-down" className="cursor-pointer">Percentage verlagen</Label>
              </div>
              <div className="flex items-center gap-3">
                <RadioGroupItem value="exact" id="price-exact" />
                <Label htmlFor="price-exact" className="cursor-pointer">Exacte prijs instellen</Label>
              </div>
            </RadioGroup>
            <div className="flex items-center gap-2">
              {priceAdjustmentType.includes('percentage') ? (
                <>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={priceAdjustmentValue}
                    onChange={(e) => handlePriceValueChange(parseFloat(e.target.value) || 0)}
                    className="w-24"
                  />
                  <span className="text-muted-foreground">%</span>
                </>
              ) : (
                <>
                  <span className="text-muted-foreground">€</span>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={priceAdjustmentValue}
                    onChange={(e) => handlePriceValueChange(parseFloat(e.target.value) || 0)}
                    className="w-32"
                  />
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Vergelijkingsprijs */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id="enable-compare-price"
            checked={enabledFields.has('compare_at_price')}
            onCheckedChange={() => onToggleField('compare_at_price')}
          />
          <Label htmlFor="enable-compare-price" className="font-medium cursor-pointer">
            Vergelijkingsprijs (doorstreepprijs)
          </Label>
        </div>
        {enabledFields.has('compare_at_price') && (
          <div className="space-y-4 pl-6">
            <RadioGroup
              value={state.compare_at_price_action || 'remove'}
              onValueChange={(value) => onChange({ compare_at_price_action: value as any })}
            >
              <div className="flex items-center gap-3">
                <RadioGroupItem value="remove" id="compare-remove" />
                <Label htmlFor="compare-remove" className="cursor-pointer">Verwijderen</Label>
              </div>
              <div className="flex items-center gap-3">
                <RadioGroupItem value="set_current" id="compare-current" />
                <Label htmlFor="compare-current" className="cursor-pointer">
                  Instellen op huidige prijs (voor kortingsactie)
                </Label>
              </div>
              <div className="flex items-center gap-3">
                <RadioGroupItem value="exact" id="compare-exact" />
                <Label htmlFor="compare-exact" className="cursor-pointer">Exacte prijs</Label>
              </div>
            </RadioGroup>
            {state.compare_at_price_action === 'exact' && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">€</span>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={state.compare_at_price_value || 0}
                  onChange={(e) => onChange({ compare_at_price_value: parseFloat(e.target.value) || 0 })}
                  className="w-32"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Kostprijs */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id="enable-cost-price"
            checked={enabledFields.has('cost_price')}
            onCheckedChange={() => onToggleField('cost_price')}
          />
          <Label htmlFor="enable-cost-price" className="font-medium cursor-pointer">
            Kostprijs aanpassen
          </Label>
        </div>
        {enabledFields.has('cost_price') && (
          <div className="space-y-4 pl-6">
            <RadioGroup
              value={state.cost_price_action || 'exact'}
              onValueChange={(value) => onChange({ cost_price_action: value as any })}
            >
              <div className="flex items-center gap-3">
                <RadioGroupItem value="exact" id="cost-exact" />
                <Label htmlFor="cost-exact" className="cursor-pointer">Exacte prijs</Label>
              </div>
              <div className="flex items-center gap-3">
                <RadioGroupItem value="remove" id="cost-remove" />
                <Label htmlFor="cost-remove" className="cursor-pointer">Verwijderen</Label>
              </div>
            </RadioGroup>
            {state.cost_price_action === 'exact' && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">€</span>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={state.cost_price || 0}
                  onChange={(e) => onChange({ cost_price: parseFloat(e.target.value) || 0 })}
                  className="w-32"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
