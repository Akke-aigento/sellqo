import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useShippingClasses } from '@/hooks/useShippingClasses';
import type { ProductSpecification } from '@/types/specifications';

interface LogisticsFieldsProps {
  spec: Partial<ProductSpecification> | null;
  onChange: (updates: Partial<ProductSpecification>) => void;
}

const NO_CLASS = '__none__';

export function LogisticsFields({ spec, onChange }: LogisticsFieldsProps) {
  const val = (key: keyof ProductSpecification) => (spec as any)?.[key] ?? '';
  const { shippingClasses } = useShippingClasses();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label className="text-sm">Doorlooptijd (dagen)</Label>
          <Input type="number" min="0" value={val('lead_time_days')} onChange={(e) => onChange({ lead_time_days: e.target.value ? parseInt(e.target.value) : null })} placeholder="3" />
        </div>
        <div className="space-y-1">
          <Label className="text-sm">Verzendklasse</Label>
          <Select
            value={spec?.shipping_class_id ?? NO_CLASS}
            onValueChange={(v) => onChange({ shipping_class_id: v === NO_CLASS ? null : v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Kies een verzendklasse" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_CLASS}>Geen</SelectItem>
              {shippingClasses.map((cls) => (
                <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Bijvoorbeeld 'boxspring' voor producten die met een vrachtwagen geleverd moeten worden. Beheer klassen bij Instellingen → Verzending.</p>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border p-3">
        <Label className="text-sm">Breekbaar</Label>
        <Switch checked={spec?.is_fragile ?? false} onCheckedChange={(checked) => onChange({ is_fragile: checked })} />
      </div>

      <div className="flex items-center justify-between rounded-lg border p-3">
        <Label className="text-sm">Gevaarlijke stoffen</Label>
        <Switch checked={spec?.is_hazardous ?? false} onCheckedChange={(checked) => onChange({ is_hazardous: checked })} />
      </div>

      {spec?.is_hazardous && (
        <div className="space-y-1">
          <Label className="text-sm">Gevarenklasse</Label>
          <Input value={val('hazard_class')} onChange={(e) => onChange({ hazard_class: e.target.value || null })} placeholder="Bijv. UN3481" />
        </div>
      )}

      <div className="space-y-1">
        <Label className="text-sm">Opslaginstructies</Label>
        <Textarea value={val('storage_instructions')} onChange={(e) => onChange({ storage_instructions: e.target.value || null })} placeholder="Droog en koel bewaren..." rows={2} />
      </div>
    </div>
  );
}
