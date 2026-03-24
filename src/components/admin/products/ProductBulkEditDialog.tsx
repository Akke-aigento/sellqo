import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { BulkBasicTab } from './bulk/BulkBasicTab';
import { BulkPricingTab } from './bulk/BulkPricingTab';
import { BulkStockTab } from './bulk/BulkStockTab';
import { BulkVisibilityTab } from './bulk/BulkVisibilityTab';
import { BulkChannelsTab } from './bulk/BulkChannelsTab';
import { BulkTagsTab } from './bulk/BulkTagsTab';
import { BulkSpecificationsTab } from './bulk/BulkSpecificationsTab';
import type { BulkEditState } from './bulk/BulkEditTypes';

interface ProductBulkEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  selectedIds: string[];
  onApply: (state: BulkEditState, enabledFields: Set<string>) => Promise<void>;
}

export function ProductBulkEditDialog({
  open,
  onOpenChange,
  selectedCount,
  selectedIds,
  onApply,
}: ProductBulkEditDialogProps) {
  const [state, setState] = useState<BulkEditState>({});
  const [enabledFields, setEnabledFields] = useState<Set<string>>(new Set());
  const [isApplying, setIsApplying] = useState(false);
  const [activeTab, setActiveTab] = useState('basis');

  const handleChange = useCallback((updates: Partial<BulkEditState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const handleToggleField = useCallback((field: string) => {
    setEnabledFields((prev) => {
      const next = new Set(prev);
      if (next.has(field)) {
        next.delete(field);
      } else {
        next.add(field);
      }
      return next;
    });
  }, []);

  const handleApply = async () => {
    if (enabledFields.size === 0) return;
    
    setIsApplying(true);
    try {
      await onApply(state, enabledFields);
      // Reset state after successful apply
      setState({});
      setEnabledFields(new Set());
      onOpenChange(false);
    } finally {
      setIsApplying(false);
    }
  };

  const handleClose = () => {
    if (!isApplying) {
      setState({});
      setEnabledFields(new Set());
      onOpenChange(false);
    }
  };

  const tabProps = {
    state,
    onChange: handleChange,
    enabledFields,
    onToggleField: handleToggleField,
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col min-h-0">
        <DialogHeader>
          <DialogTitle>Bulk bewerking</DialogTitle>
          <DialogDescription>
            Wijzigingen toepassen op {selectedCount} geselecteerde producten
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="basis">Basis</TabsTrigger>
            <TabsTrigger value="prijzen">Prijzen</TabsTrigger>
            <TabsTrigger value="voorraad">Voorraad</TabsTrigger>
            <TabsTrigger value="zichtbaarheid">Zichtbaar</TabsTrigger>
            <TabsTrigger value="kanalen">Kanalen</TabsTrigger>
            <TabsTrigger value="tags">Tags</TabsTrigger>
            <TabsTrigger value="specs">Specs</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto mt-4 pr-2">
            <TabsContent value="basis" className="mt-0">
              <BulkBasicTab {...tabProps} />
            </TabsContent>
            <TabsContent value="prijzen" className="mt-0">
              <BulkPricingTab {...tabProps} />
            </TabsContent>
            <TabsContent value="voorraad" className="mt-0">
              <BulkStockTab {...tabProps} />
            </TabsContent>
            <TabsContent value="zichtbaarheid" className="mt-0">
              <BulkVisibilityTab {...tabProps} />
            </TabsContent>
            <TabsContent value="kanalen" className="mt-0">
              <BulkChannelsTab {...tabProps} />
            </TabsContent>
            <TabsContent value="tags" className="mt-0">
              <BulkTagsTab {...tabProps} />
            </TabsContent>
            <TabsContent value="specs" className="mt-0">
              <BulkSpecificationsTab {...tabProps} />
            </TabsContent>
          </div>
        </Tabs>

        <div className="border-t pt-4 mt-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <span>
              Let op: Deze wijzigingen worden toegepast op {selectedCount} producten
            </span>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={handleClose} disabled={isApplying}>
              Annuleren
            </Button>
            <Button 
              onClick={handleApply} 
              disabled={enabledFields.size === 0 || isApplying}
            >
              {isApplying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Bezig...
                </>
              ) : (
                `Wijzigingen toepassen (${enabledFields.size})`
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
