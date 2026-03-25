import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Check, X, Pencil, ArrowRight } from 'lucide-react';

interface PreviewItem {
  entity_id: string;
  entity_name: string;
  entity_type: 'product' | 'category';
  generated: string;
  field: string;
  current_value: string | null;
}

interface SEOPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: PreviewItem[];
  generateType: string;
  onApply: (approvedItems: PreviewItem[]) => void;
}

const CHAR_LIMITS: Record<string, { max: number; label: string }> = {
  meta_title: { max: 60, label: 'Meta Title' },
  meta_description: { max: 160, label: 'Meta Description' },
  product_description: { max: 5000, label: 'Beschrijving' },
  category_description: { max: 5000, label: 'Beschrijving' },
  alt_text: { max: 125, label: 'Alt-tekst' },
};

export function SEOPreviewDialog({ open, onOpenChange, items, generateType, onApply }: SEOPreviewDialogProps) {
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set(items.map(i => i.entity_id)));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [isApplying, setIsApplying] = useState(false);

  // Reset state when items change
  if (items.length > 0 && approvedIds.size === 0 && !isApplying) {
    setApprovedIds(new Set(items.map(i => i.entity_id)));
  }

  const toggleApproval = (id: string) => {
    setApprovedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getDisplayValue = (item: PreviewItem): string => {
    return editedValues[item.entity_id] ?? item.generated;
  };

  const charLimit = CHAR_LIMITS[generateType] || CHAR_LIMITS['meta_title'];
  const approvedCount = approvedIds.size;

  const handleApply = async () => {
    setIsApplying(true);
    const approvedItems = items
      .filter(i => approvedIds.has(i.entity_id))
      .map(i => ({
        ...i,
        generated: editedValues[i.entity_id] ?? i.generated,
      }));
    await onApply(approvedItems);
    setIsApplying(false);
    setApprovedIds(new Set());
    setEditedValues({});
    setEditingId(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Preview: {charLimit.label}
            <Badge variant="secondary">{items.length} items</Badge>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-4">
            {items.map((item) => {
              const isApproved = approvedIds.has(item.entity_id);
              const isEditing = editingId === item.entity_id;
              const displayValue = getDisplayValue(item);
              const charCount = displayValue.length;
              const isOverLimit = charLimit.max < 1000 && charCount > charLimit.max;

              return (
                <div
                  key={item.entity_id}
                  className={`rounded-lg border p-4 transition-colors ${
                    isApproved ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted/30 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={isApproved}
                        onCheckedChange={() => toggleApproval(item.entity_id)}
                      />
                      <div>
                        <span className="font-medium text-sm">{item.entity_name}</span>
                        <Badge variant="outline" className="ml-2 text-xs">
                          {item.entity_type === 'product' ? 'Product' : 'Categorie'}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {isOverLimit && (
                        <Badge variant="destructive" className="text-xs">
                          {charCount}/{charLimit.max}
                        </Badge>
                      )}
                      {!isOverLimit && charLimit.max < 1000 && (
                        <span className="text-xs text-muted-foreground">{charCount}/{charLimit.max}</span>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setEditingId(isEditing ? null : item.entity_id)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Current */}
                    <div>
                      <span className="text-xs font-medium text-muted-foreground mb-1 block">Huidig</span>
                      <div className="text-sm p-2 rounded bg-muted/50 min-h-[40px]">
                        {item.current_value || <span className="italic text-muted-foreground">Leeg</span>}
                      </div>
                    </div>

                    {/* New */}
                    <div>
                      <span className="text-xs font-medium text-primary mb-1 flex items-center gap-1">
                        <ArrowRight className="h-3 w-3" /> Nieuw
                      </span>
                      {isEditing ? (
                        charLimit.max > 200 ? (
                          <Textarea
                            value={displayValue}
                            onChange={(e) => setEditedValues(prev => ({ ...prev, [item.entity_id]: e.target.value }))}
                            className="text-sm min-h-[80px]"
                          />
                        ) : (
                          <Input
                            value={displayValue}
                            onChange={(e) => setEditedValues(prev => ({ ...prev, [item.entity_id]: e.target.value }))}
                            className="text-sm"
                          />
                        )
                      ) : (
                        <div className="text-sm p-2 rounded bg-primary/5 border border-primary/20 min-h-[40px]">
                          {displayValue}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <DialogFooter className="flex items-center justify-between sm:justify-between mt-4">
          <div className="text-sm text-muted-foreground">
            {approvedCount} van {items.length} goedgekeurd
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Annuleren
            </Button>
            <Button onClick={handleApply} disabled={approvedCount === 0 || isApplying} className="gap-2">
              {isApplying ? (
                'Toepassen...'
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  {approvedCount} items toepassen
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
