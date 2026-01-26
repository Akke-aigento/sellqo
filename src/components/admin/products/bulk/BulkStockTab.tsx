import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { BulkEditTabProps } from './BulkEditTypes';

export function BulkStockTab({ state, onChange, enabledFields, onToggleField }: BulkEditTabProps) {
  const stockAdjustmentType = state.stock_adjustment?.type || 'add';
  const stockAdjustmentValue = state.stock_adjustment?.value || 0;

  const handleStockTypeChange = (type: string) => {
    onChange({
      stock_adjustment: {
        type: type as any,
        value: stockAdjustmentValue,
      },
    });
  };

  const handleStockValueChange = (value: number) => {
    onChange({
      stock_adjustment: {
        type: stockAdjustmentType as any,
        value,
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Voorraad aanpassen */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id="enable-stock"
            checked={enabledFields.has('stock_adjustment')}
            onCheckedChange={() => onToggleField('stock_adjustment')}
          />
          <Label htmlFor="enable-stock" className="font-medium cursor-pointer">
            Voorraad aanpassen
          </Label>
        </div>
        {enabledFields.has('stock_adjustment') && (
          <div className="space-y-4 pl-6">
            <RadioGroup value={stockAdjustmentType} onValueChange={handleStockTypeChange}>
              <div className="flex items-center gap-3">
                <RadioGroupItem value="add" id="stock-add" />
                <Label htmlFor="stock-add" className="cursor-pointer">Toevoegen</Label>
              </div>
              <div className="flex items-center gap-3">
                <RadioGroupItem value="subtract" id="stock-subtract" />
                <Label htmlFor="stock-subtract" className="cursor-pointer">Aftrekken</Label>
              </div>
              <div className="flex items-center gap-3">
                <RadioGroupItem value="exact" id="stock-exact" />
                <Label htmlFor="stock-exact" className="cursor-pointer">Exact instellen</Label>
              </div>
            </RadioGroup>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                step={1}
                value={stockAdjustmentValue}
                onChange={(e) => handleStockValueChange(parseInt(e.target.value) || 0)}
                className="w-24"
              />
              <span className="text-muted-foreground">stuks</span>
            </div>
          </div>
        )}
      </div>

      {/* Voorraad tracking */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id="enable-track-inventory"
            checked={enabledFields.has('track_inventory')}
            onCheckedChange={() => onToggleField('track_inventory')}
          />
          <Label htmlFor="enable-track-inventory" className="font-medium cursor-pointer">
            Voorraad tracking
          </Label>
        </div>
        {enabledFields.has('track_inventory') && (
          <div className="pl-6">
            <RadioGroup
              value={state.track_inventory ? 'yes' : 'no'}
              onValueChange={(value) => onChange({ track_inventory: value === 'yes' })}
            >
              <div className="flex items-center gap-3">
                <RadioGroupItem value="yes" id="track-yes" />
                <Label htmlFor="track-yes" className="cursor-pointer">Inschakelen</Label>
              </div>
              <div className="flex items-center gap-3">
                <RadioGroupItem value="no" id="track-no" />
                <Label htmlFor="track-no" className="cursor-pointer">Uitschakelen</Label>
              </div>
            </RadioGroup>
          </div>
        )}
      </div>

      {/* Backorder toestaan */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id="enable-backorder"
            checked={enabledFields.has('allow_backorder')}
            onCheckedChange={() => onToggleField('allow_backorder')}
          />
          <Label htmlFor="enable-backorder" className="font-medium cursor-pointer">
            Backorder toestaan
          </Label>
        </div>
        {enabledFields.has('allow_backorder') && (
          <div className="pl-6">
            <RadioGroup
              value={state.allow_backorder ? 'yes' : 'no'}
              onValueChange={(value) => onChange({ allow_backorder: value === 'yes' })}
            >
              <div className="flex items-center gap-3">
                <RadioGroupItem value="yes" id="backorder-yes" />
                <Label htmlFor="backorder-yes" className="cursor-pointer">Ja</Label>
              </div>
              <div className="flex items-center gap-3">
                <RadioGroupItem value="no" id="backorder-no" />
                <Label htmlFor="backorder-no" className="cursor-pointer">Nee</Label>
              </div>
            </RadioGroup>
          </div>
        )}
      </div>

      {/* Lage voorraad drempel */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id="enable-threshold"
            checked={enabledFields.has('low_stock_threshold')}
            onCheckedChange={() => onToggleField('low_stock_threshold')}
          />
          <Label htmlFor="enable-threshold" className="font-medium cursor-pointer">
            Lage voorraad drempel
          </Label>
        </div>
        {enabledFields.has('low_stock_threshold') && (
          <div className="flex items-center gap-2 pl-6">
            <Input
              type="number"
              min={0}
              step={1}
              value={state.low_stock_threshold || 5}
              onChange={(e) => onChange({ low_stock_threshold: parseInt(e.target.value) || 5 })}
              className="w-24"
            />
            <span className="text-muted-foreground">stuks</span>
          </div>
        )}
      </div>
    </div>
  );
}
