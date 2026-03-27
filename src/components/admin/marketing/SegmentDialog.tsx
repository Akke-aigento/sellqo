import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { SegmentBuilder } from './SegmentBuilder';
import { useSegmentMemberCount } from '@/hooks/useCustomerSegments';
import { useTenant } from '@/hooks/useTenant';
import type { CustomerSegment, SegmentFilterRules } from '@/types/marketing';

const segmentSchema = z.object({
  name: z.string().min(1, 'Naam is verplicht'),
  description: z.string().optional(),
});

type SegmentFormData = z.infer<typeof segmentSchema>;

interface SegmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  segment?: CustomerSegment;
  onSave: (data: { name: string; description?: string; filter_rules: SegmentFilterRules; is_dynamic: boolean; tenant_id: string }) => void;
  isLoading?: boolean;
}

export function SegmentDialog({ open, onOpenChange, segment, onSave, isLoading }: SegmentDialogProps) {
  const { currentTenant } = useTenant();
  const [filterRules, setFilterRules] = useState<SegmentFilterRules>(
    segment?.filter_rules || {}
  );

  const { data: memberCount } = useSegmentMemberCount(filterRules);

  const form = useForm<SegmentFormData>({
    resolver: zodResolver(segmentSchema),
    defaultValues: {
      name: segment?.name || '',
      description: segment?.description || '',
    },
  });

  // Reset form when segment changes (edit vs create)
  useEffect(() => {
    if (open) {
      form.reset({
        name: segment?.name || '',
        description: segment?.description || '',
      });
      setFilterRules(segment?.filter_rules || {});
    }
  }, [open, segment]);

  const handleSubmit = (data: SegmentFormData) => {
    if (!currentTenant?.id) return;
    
    onSave({
      name: data.name,
      description: data.description,
      filter_rules: filterRules,
      is_dynamic: true,
      tenant_id: currentTenant.id,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {segment ? 'Segment bewerken' : 'Nieuw segment aanmaken'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Naam</FormLabel>
                  <FormControl>
                    <Input placeholder="bijv. VIP Klanten" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Beschrijving (optioneel)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Beschrijf dit segment..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="border-t pt-4">
              <h3 className="text-sm font-medium mb-4">Filterregels</h3>
              <SegmentBuilder 
                filterRules={filterRules} 
                onChange={setFilterRules}
                memberCount={memberCount}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annuleren
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Opslaan...' : segment ? 'Bijwerken' : 'Aanmaken'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
