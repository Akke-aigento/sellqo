import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Label } from '@/components/ui/label';

interface ProductOption {
  name: string;
  values: string[];
}

interface VariantSelectorProps {
  options: ProductOption[];
  selectedAttributes: Record<string, string>;
  onAttributeChange: (optionName: string, value: string) => void;
}

const MAX_TOGGLE_VALUES = 8;

export function VariantSelector({ options, selectedAttributes, onAttributeChange }: VariantSelectorProps) {
  if (!options || options.length === 0) return null;

  return (
    <div className="space-y-4">
      {options.map((option) => (
        <div key={option.name} className="space-y-2">
          <Label className="text-sm font-medium">
            {option.name}
            {selectedAttributes[option.name] && (
              <span className="ml-2 text-muted-foreground font-normal">
                — {selectedAttributes[option.name]}
              </span>
            )}
          </Label>

          {option.values.length <= MAX_TOGGLE_VALUES ? (
            <ToggleGroup
              type="single"
              value={selectedAttributes[option.name] || ''}
              onValueChange={(value) => {
                if (value) onAttributeChange(option.name, value);
              }}
              className="justify-start flex-wrap gap-2"
            >
              {option.values.map((val) => (
                <ToggleGroupItem
                  key={val}
                  value={val}
                  variant="outline"
                  className="px-4 py-2 text-sm data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                >
                  {val}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          ) : (
            <Select
              value={selectedAttributes[option.name] || ''}
              onValueChange={(value) => onAttributeChange(option.name, value)}
            >
              <SelectTrigger className="w-full max-w-xs">
                <SelectValue placeholder={`Kies ${option.name.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {option.values.map((val) => (
                  <SelectItem key={val} value={val}>
                    {val}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      ))}
    </div>
  );
}
