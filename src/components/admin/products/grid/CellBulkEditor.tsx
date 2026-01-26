import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { ColumnDefinition } from './gridTypes';

interface CellBulkEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  field: string;
  fieldLabel: string;
  cellCount: number;
  fieldType: ColumnDefinition['type'];
  onApply: (type: 'add' | 'subtract' | 'percentage_up' | 'percentage_down' | 'exact', value: number) => void;
}

export function CellBulkEditor({
  open,
  onOpenChange,
  field,
  fieldLabel,
  cellCount,
  fieldType,
  onApply,
}: CellBulkEditorProps) {
  const [adjustmentType, setAdjustmentType] = useState<'add' | 'subtract' | 'percentage_up' | 'percentage_down' | 'exact'>('exact');
  const [value, setValue] = useState('');

  const isCurrency = fieldType === 'currency';
  const isNumber = fieldType === 'number' || isCurrency;

  const handleApply = () => {
    const numValue = parseFloat(value.replace(',', '.'));
    if (!isNaN(numValue)) {
      onApply(adjustmentType, numValue);
      onOpenChange(false);
      setValue('');
      setAdjustmentType('exact');
    }
  };

  const getValueLabel = () => {
    switch (adjustmentType) {
      case 'add':
        return isCurrency ? 'Bedrag toevoegen (€)' : 'Waarde toevoegen';
      case 'subtract':
        return isCurrency ? 'Bedrag aftrekken (€)' : 'Waarde aftrekken';
      case 'percentage_up':
        return 'Percentage verhogen (%)';
      case 'percentage_down':
        return 'Percentage verlagen (%)';
      case 'exact':
        return isCurrency ? 'Exacte waarde (€)' : 'Exacte waarde';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Bulk bewerken: {fieldLabel}</DialogTitle>
          <DialogDescription>
            Pas {cellCount} geselecteerde cel(len) aan
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isNumber && (
            <RadioGroup
              value={adjustmentType}
              onValueChange={(v) => setAdjustmentType(v as typeof adjustmentType)}
              className="space-y-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="exact" id="exact" />
                <Label htmlFor="exact">Exacte waarde instellen</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="add" id="add" />
                <Label htmlFor="add">
                  {isCurrency ? 'Bedrag toevoegen' : 'Waarde toevoegen'}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="subtract" id="subtract" />
                <Label htmlFor="subtract">
                  {isCurrency ? 'Bedrag aftrekken' : 'Waarde aftrekken'}
                </Label>
              </div>
              {isCurrency && (
                <>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="percentage_up" id="percentage_up" />
                    <Label htmlFor="percentage_up">Percentage verhogen</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="percentage_down" id="percentage_down" />
                    <Label htmlFor="percentage_down">Percentage verlagen</Label>
                  </div>
                </>
              )}
            </RadioGroup>
          )}

          <div className="space-y-2">
            <Label htmlFor="value">{getValueLabel()}</Label>
            <Input
              id="value"
              type="text"
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={adjustmentType.includes('percentage') ? '10' : isCurrency ? '9,99' : '100'}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuleren
          </Button>
          <Button onClick={handleApply} disabled={!value.trim()}>
            Toepassen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
