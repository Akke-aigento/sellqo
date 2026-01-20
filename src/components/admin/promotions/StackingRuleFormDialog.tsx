import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateStackingRule, useUpdateStackingRule } from '@/hooks/useStackingRules';
import type { DiscountStackingRule, StackingRuleFormData } from '@/types/promotions';

const discountTypes = [
  { id: 'discount_code', label: 'Kortingscodes' },
  { id: 'volume_discount', label: 'Staffelkortingen' },
  { id: 'automatic_discount', label: 'Automatische kortingen' },
  { id: 'bundle_discount', label: 'Bundelkortingen' },
  { id: 'bogo', label: 'BOGO acties' },
  { id: 'customer_group', label: 'Klantengroep kortingen' },
  { id: 'loyalty', label: 'Loyaliteitspunten' },
  { id: 'gift_promotion', label: 'Cadeauacties' },
];

const formSchema = z.object({
  name: z.string().min(1, 'Naam is verplicht'),
  description: z.string().optional(),
  rule_type: z.enum(['exclusive', 'stackable', 'priority']),
  discount_types: z.array(z.string()).min(1, 'Selecteer minimaal 1 type'),
  max_stack_count: z.coerce.number().optional(),
  max_total_discount_percent: z.coerce.number().min(0).max(100).optional(),
  is_active: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

interface StackingRuleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule?: DiscountStackingRule | null;
}

export function StackingRuleFormDialog({
  open,
  onOpenChange,
  rule,
}: StackingRuleFormDialogProps) {
  const createRule = useCreateStackingRule();
  const updateRule = useUpdateStackingRule();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      rule_type: 'stackable',
      discount_types: [],
      max_stack_count: undefined,
      max_total_discount_percent: undefined,
      is_active: true,
    },
  });

  useEffect(() => {
    if (rule) {
      form.reset({
        name: rule.name,
        description: rule.description || '',
        rule_type: rule.rule_type as 'exclusive' | 'stackable' | 'priority',
        discount_types: rule.discount_types || [],
        max_stack_count: rule.max_stack_count ?? undefined,
        max_total_discount_percent: rule.max_total_discount_percent ?? undefined,
        is_active: rule.is_active,
      });
    } else {
      form.reset({
        name: '',
        description: '',
        rule_type: 'stackable',
        discount_types: [],
        max_stack_count: undefined,
        max_total_discount_percent: undefined,
        is_active: true,
      });
    }
  }, [rule, form]);

  const onSubmit = async (values: FormValues) => {
    const formData: StackingRuleFormData = {
      name: values.name,
      description: values.description || null,
      rule_type: values.rule_type,
      discount_types: values.discount_types,
      max_stack_count: values.max_stack_count ?? null,
      max_total_discount_percent: values.max_total_discount_percent ?? null,
      is_active: values.is_active,
    };

    if (rule) {
      await updateRule.mutateAsync({ id: rule.id, formData });
    } else {
      await createRule.mutateAsync(formData);
    }
    onOpenChange(false);
  };

  const ruleType = form.watch('rule_type');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {rule ? 'Stapelregel Bewerken' : 'Nieuwe Stapelregel'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Naam</FormLabel>
                  <FormControl>
                    <Input placeholder="Exclusieve kortingscode regel" {...field} />
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
                  <FormLabel>Beschrijving</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Optionele beschrijving..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="rule_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Regeltype</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="exclusive">
                        Exclusief - Kan niet met andere kortingen
                      </SelectItem>
                      <SelectItem value="stackable">
                        Stapelbaar - Mag combineren met andere kortingen
                      </SelectItem>
                      <SelectItem value="priority">
                        Prioriteit - Bepaal volgorde van toepassing
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="discount_types"
              render={() => (
                <FormItem>
                  <FormLabel>Van toepassing op</FormLabel>
                  <FormDescription>
                    Selecteer welke kortingstypes deze regel beïnvloedt
                  </FormDescription>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {discountTypes.map((type) => (
                      <FormField
                        key={type.id}
                        control={form.control}
                        name="discount_types"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(type.id)}
                                onCheckedChange={(checked) => {
                                  const updated = checked
                                    ? [...(field.value || []), type.id]
                                    : field.value?.filter((v) => v !== type.id) || [];
                                  field.onChange(updated);
                                }}
                              />
                            </FormControl>
                            <FormLabel className="text-sm font-normal cursor-pointer">
                              {type.label}
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {ruleType === 'stackable' && (
              <>
                <FormField
                  control={form.control}
                  name="max_stack_count"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max. aantal stapelbare kortingen</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          placeholder="Onbeperkt"
                          {...field}
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <FormDescription>Leeg laten voor onbeperkt</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="max_total_discount_percent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max. totale korting (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          placeholder="Geen limiet"
                          {...field}
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <FormDescription>
                        Voorkom extreem hoge kortingen door combinatie
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <FormLabel>Actief</FormLabel>
                    <FormDescription>
                      Regel wordt toegepast bij berekening
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annuleren
              </Button>
              <Button type="submit" disabled={createRule.isPending || updateRule.isPending}>
                {rule ? 'Opslaan' : 'Aanmaken'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
