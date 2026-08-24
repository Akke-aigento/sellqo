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
import type { GiftPromotion, GiftPromotionFormData } from '@/types/promotions';
import { useTranslation } from 'react-i18next';

const formSchema = z.object({
  name: z.string().min(1, 'admin.promotions.autoDiscountFormDialog.validation.naam_is_verplicht'),
  description: z.string().optional(),
  trigger_type: z.string(),
  trigger_value: z.coerce.number().optional(),
  gift_product_id: z.string().min(1, 'admin.promotions.giftPromotionFormDialog.validation.cadeau_product_is_verplicht'),
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
  const { t } = useTranslation();
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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t('admin.promotions.giftPromotionFormDialog.gift_actie_bewerken') : t('admin.giftPromotions.nieuwe_gift_actie')}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('common.name')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('admin.promotions.giftPromotionFormDialog.gratis_sample_bij_75_bestelling')} {...field} />
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
                  <FormLabel>{t('admin.marketing.emailBlockProperties.beschrijving')}</FormLabel>
                  <FormControl>
                    <Textarea placeholder={t('admin.promotions.autoDiscountFormDialog.interne_beschrijving')} {...field} />
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
                    <FormLabel>{t('admin.marketing.campaignDialog.trigger')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="cart_total">{t('admin.promotions.giftPromotionFormDialog.bestelwaarde')}</SelectItem>
                        <SelectItem value="quantity">{t('admin.promotions.autoDiscountFormDialog.aantal_producten')}</SelectItem>
                        <SelectItem value="specific_products">{t('admin.promotions.autoDiscountFormDialog.specifieke_producten')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="trigger_value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {watchTriggerType === 'cart_total' ? t('admin.promotions.autoDiscountFormDialog.min_bedrag') : t('admin.promotions.autoDiscountFormDialog.min_aantal')}
                    </FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="gift_product_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin.promotions.giftPromotionFormDialog.cadeau_product')}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('admin.promotions.giftPromotionFormDialog.selecteer_een_product')} />
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="gift_quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('admin.promotions.giftPromotionFormDialog.aantal')}</FormLabel>
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
                    <FormLabel>{t('admin.promotions.giftPromotionFormDialog.max_bestelling')}</FormLabel>
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
                    <FormLabel>{t('admin.promotions.giftPromotionFormDialog.voorraad_limiet')}</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder={t('admin.productForm.onbeperkt')} {...field} />
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
                    <FormLabel>{t('admin.promotions.autoDiscountFormDialog.geldig_vanaf')}</FormLabel>
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
                    <FormLabel>{t('admin.promotions.autoDiscountFormDialog.geldig_tot')}</FormLabel>
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
                    <FormLabel className="cursor-pointer">{t('admin.promotions.giftPromotionFormDialog.stapelbaar')}</FormLabel>
                    <FormDescription>{t('admin.promotions.giftPromotionFormDialog.meerdere_keren_toepassen_per_bestelling')}</FormDescription>
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
                  <FormLabel className="cursor-pointer">{t('admin.marketing.aBTestingPanel.actief')}</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={createPromotion.isPending || updatePromotion.isPending}>
                {isEditing ? t('common.save') : t('admin.adsAiRules.aanmaken')}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
