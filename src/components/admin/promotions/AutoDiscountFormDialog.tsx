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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useCreateAutoDiscount, useUpdateAutoDiscount } from '@/hooks/useAutoDiscounts';
import { ProductMultiSelect } from './ProductMultiSelect';
import { CategoryMultiSelect } from './CategoryMultiSelect';
import type { AutomaticDiscount, AutomaticDiscountFormData } from '@/types/promotions';

const formSchema = z.object({
  name: z.string().min(1, 'Naam is verplicht'),
  description: z.string().optional(),
  trigger_type: z.string(),
  trigger_value: z.coerce.number().optional(),
  trigger_product_ids: z.array(z.string()).optional(),
  discount_type: z.string(),
  discount_value: z.coerce.number().optional(),
  applies_to: z.string(),
  product_ids: z.array(z.string()).optional(),
  category_ids: z.array(z.string()).optional(),
  max_discount_amount: z.coerce.number().optional(),
  priority: z.coerce.number().min(1).default(10),
  is_active: z.boolean(),
  valid_from: z.string().optional(),
  valid_until: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface AutoDiscountFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  discount?: AutomaticDiscount | null;
}

export function AutoDiscountFormDialog({
  open,
  onOpenChange,
  discount,
}: AutoDiscountFormDialogProps) {
  const createDiscount = useCreateAutoDiscount();
  const updateDiscount = useUpdateAutoDiscount();
  const isEditing = !!discount;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      trigger_type: 'cart_total',
      trigger_value: 50,
      trigger_product_ids: [],
      discount_type: 'percentage',
      discount_value: 10,
      applies_to: 'all',
      product_ids: [],
      max_discount_amount: undefined,
      priority: 10,
      is_active: true,
      valid_from: '',
      valid_until: '',
    },
  });

  useEffect(() => {
    if (discount) {
      form.reset({
        name: discount.name,
        description: discount.description || '',
        trigger_type: discount.trigger_type,
        trigger_value: discount.trigger_value || undefined,
        trigger_product_ids: discount.trigger_product_ids || [],
        discount_type: discount.discount_type,
        discount_value: discount.discount_value || undefined,
        applies_to: discount.applies_to,
        product_ids: discount.product_ids || [],
        max_discount_amount: discount.max_discount_amount || undefined,
        priority: discount.priority,
        is_active: discount.is_active,
        valid_from: discount.valid_from || '',
        valid_until: discount.valid_until || '',
      });
    } else {
      form.reset({
        name: '',
        description: '',
        trigger_type: 'cart_total',
        trigger_value: 50,
        trigger_product_ids: [],
        discount_type: 'percentage',
        discount_value: 10,
        applies_to: 'all',
        product_ids: [],
        max_discount_amount: undefined,
        priority: 10,
        is_active: true,
        valid_from: '',
        valid_until: '',
      });
    }
  }, [discount, form]);

  const onSubmit = (data: FormData) => {
    const formData: AutomaticDiscountFormData = {
      name: data.name,
      description: data.description,
      trigger_type: data.trigger_type,
      trigger_value: data.trigger_value,
      trigger_product_ids: data.trigger_type === 'specific_products' && data.trigger_product_ids?.length ? data.trigger_product_ids : undefined,
      discount_type: data.discount_type,
      discount_value: data.discount_value,
      applies_to: data.applies_to,
      product_ids: data.applies_to === 'specific_products' && data.product_ids?.length ? data.product_ids : undefined,
      max_discount_amount: data.max_discount_amount,
      priority: data.priority,
      is_active: data.is_active,
      valid_from: data.valid_from || undefined,
      valid_until: data.valid_until || undefined,
    };

    if (isEditing && discount) {
      updateDiscount.mutate(
        { id: discount.id, formData },
        { onSuccess: () => onOpenChange(false) }
      );
    } else {
      createDiscount.mutate(formData, {
        onSuccess: () => onOpenChange(false),
      });
    }
  };

  const watchTriggerType = form.watch('trigger_type');
  const watchDiscountType = form.watch('discount_type');
  const watchAppliesTo = form.watch('applies_to');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Automatische Korting Bewerken' : 'Nieuwe Automatische Korting'}
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
                    <Input placeholder="Gratis verzending vanaf €50" {...field} />
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
                    <Textarea placeholder="Interne beschrijving..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="trigger_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Trigger</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="cart_total">Winkelwagen totaal</SelectItem>
                        <SelectItem value="item_count">Aantal producten</SelectItem>
                        <SelectItem value="specific_products">Specifieke producten</SelectItem>
                        <SelectItem value="first_order">Eerste bestelling</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {watchTriggerType !== 'first_order' && watchTriggerType !== 'specific_products' && (
                <FormField
                  control={form.control}
                  name="trigger_value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {watchTriggerType === 'cart_total' ? 'Min. bedrag (€)' : 'Min. aantal'}
                      </FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {watchTriggerType === 'specific_products' && (
              <FormField
                control={form.control}
                name="trigger_product_ids"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Trigger-producten</FormLabel>
                    <FormDescription>Korting wordt geactiveerd als deze producten in de winkelwagen zitten</FormDescription>
                    <ProductMultiSelect
                      selectedIds={field.value || []}
                      onChange={field.onChange}
                      placeholder="Selecteer trigger-producten..."
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="discount_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Korting type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="percentage">Percentage</SelectItem>
                        <SelectItem value="fixed_amount">Vast bedrag</SelectItem>
                        <SelectItem value="free_shipping">Gratis verzending</SelectItem>
                        <SelectItem value="free_product">Gratis product</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {(watchDiscountType === 'percentage' || watchDiscountType === 'fixed_amount') && (
                <FormField
                  control={form.control}
                  name="discount_value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {watchDiscountType === 'percentage' ? 'Percentage (%)' : 'Bedrag (€)'}
                      </FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <FormField
              control={form.control}
              name="applies_to"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Toepassen op</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="all">Hele bestelling</SelectItem>
                      <SelectItem value="specific_products">Specifieke producten</SelectItem>
                      <SelectItem value="specific_categories">Specifieke categorieën</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {watchAppliesTo === 'specific_products' && (
              <FormField
                control={form.control}
                name="product_ids"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Korting toepassen op producten</FormLabel>
                    <ProductMultiSelect
                      selectedIds={field.value || []}
                      onChange={field.onChange}
                      placeholder="Selecteer producten..."
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="max_discount_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max. korting (€)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="Geen limiet" {...field} />
                    </FormControl>
                    <FormDescription>Optioneel maximum</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prioriteit</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" {...field} />
                    </FormControl>
                    <FormDescription>Lager = eerder toegepast</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="valid_from"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Geldig vanaf</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="valid_until"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Geldig tot</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <FormLabel className="cursor-pointer">Actief</FormLabel>
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
              <Button type="submit" disabled={createDiscount.isPending || updateDiscount.isPending}>
                {isEditing ? 'Opslaan' : 'Aanmaken'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
