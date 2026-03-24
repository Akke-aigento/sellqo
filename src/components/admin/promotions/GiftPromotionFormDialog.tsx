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
import { useCreateGiftPromotion, useUpdateGiftPromotion } from '@/hooks/useGiftPromotions';
import { useProducts } from '@/hooks/useProducts';
import { ProductMultiSelect } from './ProductMultiSelect';
import { CategoryMultiSelect } from './CategoryMultiSelect';
import type { GiftPromotion, GiftPromotionFormData } from '@/types/promotions';

const formSchema = z.object({
  name: z.string().min(1, 'Naam is verplicht'),
  description: z.string().optional(),
  trigger_type: z.string(),
  trigger_value: z.coerce.number().optional(),
  trigger_product_ids: z.array(z.string()).optional(),
  trigger_category_ids: z.array(z.string()).optional(),
  gift_product_id: z.string().min(1, 'Cadeau product is verplicht'),
  gift_quantity: z.coerce.number().min(1).default(1),
  max_per_order: z.coerce.number().min(1).optional(),
  stock_limit: z.coerce.number().optional(),
  is_stackable: z.boolean(),
  is_active: z.boolean(),
  valid_from: z.string().optional(),
  valid_until: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface GiftPromotionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promotion?: GiftPromotion | null;
}

export function GiftPromotionFormDialog({
  open,
  onOpenChange,
  promotion,
}: GiftPromotionFormDialogProps) {
  const createPromotion = useCreateGiftPromotion();
  const updatePromotion = useUpdateGiftPromotion();
  const { products = [] } = useProducts();
  const isEditing = !!promotion;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      trigger_type: 'cart_total',
      trigger_value: 50,
      trigger_product_ids: [],
      trigger_category_ids: [],
      gift_product_id: '',
      gift_quantity: 1,
      max_per_order: 1,
      stock_limit: undefined,
      is_stackable: false,
      is_active: true,
      valid_from: '',
      valid_until: '',
    },
  });

  useEffect(() => {
    if (promotion) {
      form.reset({
        name: promotion.name,
        description: promotion.description || '',
        trigger_type: promotion.trigger_type,
        trigger_value: promotion.trigger_value || undefined,
        trigger_product_ids: promotion.trigger_product_ids || [],
        trigger_category_ids: promotion.trigger_category_ids || [],
        gift_product_id: promotion.gift_product_id,
        gift_quantity: promotion.gift_quantity,
        max_per_order: promotion.max_per_order || undefined,
        stock_limit: promotion.stock_limit || undefined,
        is_stackable: promotion.is_stackable,
        is_active: promotion.is_active,
        valid_from: promotion.valid_from || '',
        valid_until: promotion.valid_until || '',
      });
    } else {
      form.reset({
        name: '',
        description: '',
        trigger_type: 'cart_total',
        trigger_value: 50,
        trigger_product_ids: [],
        trigger_category_ids: [],
        gift_product_id: '',
        gift_quantity: 1,
        max_per_order: 1,
        stock_limit: undefined,
        is_stackable: false,
        is_active: true,
        valid_from: '',
        valid_until: '',
      });
    }
  }, [promotion, form]);

  const onSubmit = (data: FormData) => {
    const formData: GiftPromotionFormData = {
      name: data.name,
      description: data.description,
      trigger_type: data.trigger_type,
      trigger_value: data.trigger_value,
      trigger_product_ids: data.trigger_type === 'specific_products' && data.trigger_product_ids?.length ? data.trigger_product_ids : undefined,
      gift_product_id: data.gift_product_id,
      gift_quantity: data.gift_quantity,
      max_per_order: data.max_per_order,
      stock_limit: data.stock_limit,
      is_stackable: data.is_stackable,
      is_active: data.is_active,
      valid_from: data.valid_from || undefined,
      valid_until: data.valid_until || undefined,
    };

    if (isEditing && promotion) {
      updatePromotion.mutate(
        { id: promotion.id, formData },
        { onSuccess: () => onOpenChange(false) }
      );
    } else {
      createPromotion.mutate(formData, {
        onSuccess: () => onOpenChange(false),
      });
    }
  };

  const watchTriggerType = form.watch('trigger_type');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Gift Actie Bewerken' : 'Nieuwe Gift Actie'}
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
                    <Input placeholder="Gratis sample bij €75+ bestelling" {...field} />
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
                        <SelectItem value="cart_total">Bestelwaarde</SelectItem>
                        <SelectItem value="quantity">Aantal producten</SelectItem>
                        <SelectItem value="specific_products">Specifieke producten</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {watchTriggerType !== 'specific_products' && (
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
                    <FormDescription>Gift wordt toegevoegd als deze producten in de winkelwagen zitten</FormDescription>
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

            <FormField
              control={form.control}
              name="gift_product_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cadeau Product</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecteer een product" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="gift_quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Aantal</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="max_per_order"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max/bestelling</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="stock_limit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Voorraad limiet</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="Onbeperkt" {...field} />
                    </FormControl>
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
              name="is_stackable"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <FormLabel className="cursor-pointer">Stapelbaar</FormLabel>
                    <FormDescription>Meerdere keren toepassen per bestelling</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

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
              <Button type="submit" disabled={createPromotion.isPending || updatePromotion.isPending}>
                {isEditing ? 'Opslaan' : 'Aanmaken'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
