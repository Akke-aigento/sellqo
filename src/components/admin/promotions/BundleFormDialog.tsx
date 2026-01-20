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
import { useCreateBundle, useUpdateBundle } from '@/hooks/useBundles';
import type { ProductBundle, ProductBundleFormData } from '@/types/promotions';

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
    },
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
      products: bundle?.products?.map(p => ({
        product_id: p.product_id,
        quantity: p.quantity,
        is_required: p.is_required,
        group_name: p.group_name || undefined,
      })) || [],
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
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
                    <Textarea
                      placeholder="Beschrijf de bundel..."
                      {...field}
                    />
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
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
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
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
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

            {form.watch('bundle_type') === 'mix_match' && (
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
