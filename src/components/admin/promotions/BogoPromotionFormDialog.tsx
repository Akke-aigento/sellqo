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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateBogoPromotion, useUpdateBogoPromotion } from '@/hooks/useBogoPromotions';
import type { BogoPromotion, BogoPromotionFormData } from '@/types/promotions';

const formSchema = z.object({
  name: z.string().min(1, 'Naam is verplicht'),
  description: z.string().optional(),
  promotion_type: z.enum(['buy_x_get_y', 'buy_x_get_y_discount']),
  buy_quantity: z.coerce.number().min(1),
  get_quantity: z.coerce.number().min(1),
  discount_type: z.enum(['percentage', 'fixed_amount', 'free']),
  discount_value: z.coerce.number().min(0),
  max_uses_per_order: z.coerce.number().optional(),
  is_active: z.boolean(),
  valid_from: z.string().optional(),
  valid_until: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface BogoPromotionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promotion?: BogoPromotion | null;
}

export function BogoPromotionFormDialog({
  open,
  onOpenChange,
  promotion,
}: BogoPromotionFormDialogProps) {
  const createPromotion = useCreateBogoPromotion();
  const updatePromotion = useUpdateBogoPromotion();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      promotion_type: 'buy_x_get_y',
      buy_quantity: 2,
      get_quantity: 1,
      discount_type: 'free',
      discount_value: 100,
      max_uses_per_order: undefined,
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
        promotion_type: promotion.promotion_type as 'buy_x_get_y' | 'buy_x_get_y_discount',
        buy_quantity: promotion.buy_quantity,
        get_quantity: promotion.get_quantity,
        discount_type: promotion.discount_type as 'percentage' | 'fixed_amount' | 'free',
        discount_value: promotion.discount_value,
        max_uses_per_order: promotion.max_uses_per_order ?? undefined,
        is_active: promotion.is_active,
        valid_from: promotion.valid_from?.split('T')[0] || '',
        valid_until: promotion.valid_until?.split('T')[0] || '',
      });
    } else {
      form.reset({
        name: '',
        description: '',
        promotion_type: 'buy_x_get_y',
        buy_quantity: 2,
        get_quantity: 1,
        discount_type: 'free',
        discount_value: 100,
        max_uses_per_order: undefined,
        is_active: true,
        valid_from: '',
        valid_until: '',
      });
    }
  }, [promotion, form]);

  const onSubmit = async (values: FormValues) => {
    const formData: BogoPromotionFormData = {
      name: values.name,
      description: values.description || null,
      promotion_type: values.promotion_type,
      buy_quantity: values.buy_quantity,
      get_quantity: values.get_quantity,
      discount_type: values.discount_type,
      discount_value: values.discount_type === 'free' ? 100 : values.discount_value,
      max_uses_per_order: values.max_uses_per_order ?? null,
      is_active: values.is_active,
      valid_from: values.valid_from || null,
      valid_until: values.valid_until || null,
    };

    if (promotion) {
      await updatePromotion.mutateAsync({ id: promotion.id, formData });
    } else {
      await createPromotion.mutateAsync(formData);
    }
    onOpenChange(false);
  };

  const discountType = form.watch('discount_type');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {promotion ? 'BOGO Actie Bewerken' : 'Nieuwe BOGO Actie'}
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
                    <Input placeholder="Koop 2 krijg 1 gratis" {...field} />
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
              name="promotion_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type actie</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="buy_x_get_y">Koop X krijg Y gratis</SelectItem>
                      <SelectItem value="buy_x_get_y_discount">Koop X, korting op Y</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="buy_quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Koop aantal</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} {...field} />
                    </FormControl>
                    <FormDescription>Hoeveel moet klant kopen</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="get_quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Krijg aantal</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} {...field} />
                    </FormControl>
                    <FormDescription>Hoeveel krijgt klant</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="discount_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kortingstype</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="free">Gratis (100%)</SelectItem>
                      <SelectItem value="percentage">Percentage</SelectItem>
                      <SelectItem value="fixed_amount">Vast bedrag</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {discountType !== 'free' && (
              <FormField
                control={form.control}
                name="discount_value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {discountType === 'percentage' ? 'Kortingspercentage' : 'Kortingsbedrag'}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step={discountType === 'percentage' ? 1 : 0.01}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="max_uses_per_order"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Max per bestelling</FormLabel>
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
                  <div>
                    <FormLabel>Actief</FormLabel>
                    <FormDescription>
                      Actie is direct zichtbaar en toepasbaar
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
              <Button type="submit" disabled={createPromotion.isPending || updatePromotion.isPending}>
                {promotion ? 'Opslaan' : 'Aanmaken'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
