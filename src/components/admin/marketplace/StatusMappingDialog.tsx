import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowRight } from 'lucide-react';
import type { StatusMapping } from '@/types/syncRules';

interface StatusMappingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mappings: StatusMapping[];
  onSave: (mappings: StatusMapping[]) => void;
  platformName: string;
}

// SellQo internal order statuses
const INTERNAL_STATUSES = [
  { value: 'pending', label: 'In afwachting' },
  { value: 'processing', label: 'In behandeling' },
  { value: 'on_hold', label: 'In de wacht' },
  { value: 'shipped', label: 'Verzonden' },
  { value: 'delivered', label: 'Afgeleverd' },
  { value: 'cancelled', label: 'Geannuleerd' },
  { value: 'refunded', label: 'Terugbetaald' },
];

export function StatusMappingDialog({
  open,
  onOpenChange,
  mappings,
  onSave,
  platformName,
}: StatusMappingDialogProps) {
  const [localMappings, setLocalMappings] = useState<StatusMapping[]>(mappings);

  useEffect(() => {
    setLocalMappings(mappings);
  }, [mappings]);

  const updateMapping = (externalStatus: string, internalStatus: string) => {
    setLocalMappings(prev =>
      prev.map(m =>
        m.externalStatus === externalStatus
          ? { ...m, internalStatus }
          : m
      )
    );
  };

  const handleSave = () => {
    onSave(localMappings);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Order Status Mapping</DialogTitle>
          <DialogDescription>
            Koppel {platformName} statussen aan SellQo statussen
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-[1fr,auto,1fr] gap-3 items-center text-sm font-medium text-muted-foreground mb-2">
            <span>{platformName} Status</span>
            <span></span>
            <span>SellQo Status</span>
          </div>

          {localMappings.map((mapping) => (
            <div
              key={mapping.externalStatus}
              className="grid grid-cols-[1fr,auto,1fr] gap-3 items-center"
            >
              <div className="px-3 py-2 bg-muted rounded-md text-sm">
                {mapping.label || mapping.externalStatus}
              </div>
              
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
              
              <Select
                value={mapping.internalStatus}
                onValueChange={(value) => updateMapping(mapping.externalStatus, value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTERNAL_STATUSES.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuleren
          </Button>
          <Button onClick={handleSave}>
            Opslaan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
