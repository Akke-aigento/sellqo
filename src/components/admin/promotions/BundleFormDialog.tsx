import { useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
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
import { Plus, Trash2, Package } from 'lucide-react';
import { useCreateBundle, useUpdateBundle } from '@/hooks/useBundles';
import { ProductMultiSelect } from './ProductMultiSelect';
import type { ProductBundle, ProductBundleFormData } from '@/types/promotions';

const bundleProductSchema = z.object({
  product_id: z.string().min(1, 'Product is verplicht'),
  quantity: z.coerce.number().min(1, 'Min. 1'),
  is_required: z.boolean(),
  allow_quantity_change: z.boolean(),
  group_name: z.string().optional(),
});

const formSchema = z.object({
  name: z.string().min(1, 'Naam is verplicht'),
  description: z.string().optional(),
  bundle_type: z.enum(['fixed', 'mix_match']),
  discount_type: z.enum(['percentage', 'fixed_amount', 'fixed_price']),
  discount_value: z.coerce.number().min(0),
  is_active: z.boolean(),
  valid_from: z.string().optional(),
  valid_until: z.string().optional(),
  min_items: z.coerce.number().min(1).optional(),
  max_items: z.coerce.number().min(1).optional(),
  products: z.array(bundleProductSchema),
});

type FormData = z.infer<typeof formSchema>;

interface BundleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bundle?: ProductBundle | null;
}

export function BundleFormDialog({
  open,
  onOpenChange,
  bundle,
}: BundleFormDialogProps) {
  const createBundle = useCreateBundle();
  const updateBundle = useUpdateBundle();
  const isEditing = !!bundle;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      bundle_type: 'fixed',
      discount_type: 'percentage',
      discount_value: 0,
      is_active: true,
      valid_from: '',
      valid_until: '',
      min_items: 2,
      max_items: 5,
      products: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'products',
  });

  useEffect(() => {
    if (bundle) {
      form.reset({
        name: bundle.name,
        description: bundle.description || '',
        bundle_type: bundle.bundle_type,
        discount_type: bundle.discount_type,
        discount_value: bundle.discount_value || 0,
        is_active: bundle.is_active,
        valid_from: bundle.valid_from || '',
        valid_until: bundle.valid_until || '',
        min_items: bundle.min_items || 2,
        max_items: bundle.max_items || 5,
        products: bundle.products?.map((p) => ({
          product_id: p.product_id,
          quantity: p.quantity,
          is_required: p.is_required,
          allow_quantity_change: p.allow_quantity_change ?? false,
          group_name: p.group_name || '',
        })) || [],
      });
    } else {
      form.reset({
        name: '',
        description: '',
        bundle_type: 'fixed',
        discount_type: 'percentage',
        discount_value: 0,
        is_active: true,
        valid_from: '',
        valid_until: '',
        min_items: 2,
        max_items: 5,
        products: [],
      });
    }
  }, [bundle, form]);

  const onSubmit = (data: FormData) => {
    const formData: ProductBundleFormData = {
      name: data.name,
      description: data.description,
      bundle_type: data.bundle_type,
      discount_type: data.discount_type,
      discount_value: data.discount_value,
      is_active: data.is_active,
      valid_from: data.valid_from || undefined,
      valid_until: data.valid_until || undefined,
      min_items: data.min_items,
      max_items: data.max_items,
      products: data.products.map((p) => ({
        product_id: p.product_id,
        quantity: p.quantity,
        is_required: p.is_required,
        allow_quantity_change: p.allow_quantity_change,
        group_name: p.group_name || undefined,
      })),
    };

    if (isEditing && bundle) {
      updateBundle.mutate(
        { id: bundle.id, formData },
        { onSuccess: () => onOpenChange(false) }
      );
    } else {
      createBundle.mutate(formData, {
        onSuccess: () => onOpenChange(false),
      });
    }
  };

  const bundleType = form.watch('bundle_type');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Bundel Bewerken' : 'Nieuwe Bundel'}
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
                    <Input placeholder="Zomerbundel" {...field} />
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
                    <Textarea placeholder="Beschrijf de bundel..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="bundle_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="fixed">Vaste bundel</SelectItem>
                        <SelectItem value="mix_match">Mix & Match</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                        <SelectItem value="fixed_price">Vaste prijs</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="discount_value"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {form.watch('discount_type') === 'percentage'
                      ? 'Korting (%)'
                      : 'Bedrag (€)'}
                  </FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {bundleType === 'mix_match' && (
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="min_items"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Min. items</FormLabel>
                      <FormControl>
                        <Input type="number" min="1" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="max_items"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max. items</FormLabel>
                      <FormControl>
                        <Input type="number" min="1" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Products section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <FormLabel className="text-base font-semibold">Producten in bundel</FormLabel>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    append({
                      product_id: '',
                      quantity: 1,
                      is_required: true,
                      allow_quantity_change: false,
                      group_name: '',
                    })
                  }
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Product toevoegen
                </Button>
              </div>

              {fields.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 border border-dashed rounded-lg">
                  <Package className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground mb-2">
                    Nog geen producten toegevoegd
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      append({
                        product_id: '',
                        quantity: 1,
                        is_required: true,
                        allow_quantity_change: false,
                        group_name: '',
                      })
                    }
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    Product toevoegen
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {fields.map((field, index) => (
                    <div
                      key={field.id}
                      className="p-3 border rounded-lg space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <FormField
                            control={form.control}
                            name={`products.${index}.product_id`}
                            render={({ field: f }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Product</FormLabel>
                                <ProductMultiSelect
                                  selectedIds={f.value ? [f.value] : []}
                                  onChange={(ids) => f.onChange(ids[0] || '')}
                                  singleSelect
                                  placeholder="Selecteer product..."
                                />
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="mt-6 shrink-0"
                          onClick={() => remove(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <FormField
                          control={form.control}
                          name={`products.${index}.quantity`}
                          render={({ field: f }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Kwantiteit</FormLabel>
                              <FormControl>
                                <Input type="number" min="1" {...f} />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        {bundleType === 'mix_match' && (
                          <FormField
                            control={form.control}
                            name={`products.${index}.group_name`}
                            render={({ field: f }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Groep</FormLabel>
                                <FormControl>
                                  <Input placeholder="bv. Kies smaak" {...f} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        )}

                        <FormField
                          control={form.control}
                          name={`products.${index}.is_required`}
                          render={({ field: f }) => (
                            <FormItem className="flex flex-col justify-end">
                              <FormLabel className="text-xs">Verplicht</FormLabel>
                              <div className="flex items-center h-9">
                                <Switch
                                  checked={f.value}
                                  onCheckedChange={f.onChange}
                                />
                              </div>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`products.${index}.allow_quantity_change`}
                          render={({ field: f }) => (
                            <FormItem className="flex flex-col justify-end">
                              <FormLabel className="text-xs">Klant past aan</FormLabel>
                              <div className="flex items-center h-9">
                                <Switch
                                  checked={f.value}
                                  onCheckedChange={f.onChange}
                                />
                              </div>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Annuleren
              </Button>
              <Button
                type="submit"
                disabled={createBundle.isPending || updateBundle.isPending}
              >
                {isEditing ? 'Opslaan' : 'Aanmaken'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
