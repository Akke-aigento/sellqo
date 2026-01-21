import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { RotateCcw } from 'lucide-react';
import { useSidebarPreferences } from '@/hooks/useSidebarPreferences';

interface MenuItem {
  id: string;
  title: string;
  group: string;
}

interface SidebarCustomizeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  menuItems: MenuItem[];
}

export function SidebarCustomizeDialog({
  open,
  onOpenChange,
  menuItems,
}: SidebarCustomizeDialogProps) {
  const { hiddenItems, updatePreferences, isUpdating, showAllItems } = useSidebarPreferences();
  const [localHidden, setLocalHidden] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setLocalHidden(hiddenItems);
    }
  }, [open, hiddenItems]);

  const toggleItem = (itemId: string) => {
    setLocalHidden(prev =>
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleSave = () => {
    updatePreferences(localHidden);
    onOpenChange(false);
  };

  const handleReset = () => {
    setLocalHidden([]);
  };

  // Group items by their group
  const groupedItems = menuItems.reduce((acc, item) => {
    if (!acc[item.group]) acc[item.group] = [];
    acc[item.group].push(item);
    return acc;
  }, {} as Record<string, MenuItem[]>);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Personaliseer menu</DialogTitle>
          <DialogDescription>
            Verberg menu-items die je niet gebruikt. Je kunt ze altijd terughalen.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[400px] pr-4">
          <div className="space-y-6">
            {Object.entries(groupedItems).map(([group, items]) => (
              <div key={group}>
                <h4 className="text-sm font-medium text-muted-foreground mb-3">
                  {group}
                </h4>
                <div className="space-y-2">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-center space-x-3">
                      <Checkbox
                        id={item.id}
                        checked={!localHidden.includes(item.id)}
                        onCheckedChange={() => toggleItem(item.id)}
                      />
                      <Label
                        htmlFor={item.id}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {item.title}
                      </Label>
                    </div>
                  ))}
                </div>
                <Separator className="mt-4" />
              </div>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleReset}
            className="w-full sm:w-auto"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Alles tonen
          </Button>
          <Button
            onClick={handleSave}
            disabled={isUpdating}
            className="w-full sm:w-auto"
          >
            {isUpdating ? 'Opslaan...' : 'Opslaan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
