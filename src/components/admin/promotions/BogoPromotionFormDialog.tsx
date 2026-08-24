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
import { useTranslation } from 'react-i18next';

const formSchema = z.object({
  name: z.string().min(1, 'admin.promotions.autoDiscountFormDialog.validation.naam_is_verplicht'),
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
  const { t } = useTranslation();
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
            {promotion ? t('admin.promotions.bogoPromotionFormDialog.bogo_actie_bewerken') : t('admin.bogoPromotions.nieuwe_bogo_actie')}
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
                    <Input placeholder={t('admin.promotions.bogoPromotionFormDialog.koop_2_krijg_1_gratis')} {...field} />
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
                    <Textarea placeholder={t('admin.promotions.bogoPromotionFormDialog.optionele_beschrijving')} {...field} />
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
                  <FormLabel>{t('admin.promotions.bogoPromotionFormDialog.type_actie')}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="buy_x_get_y">{t('admin.promotions.bogoPromotionFormDialog.koop_x_krijg_y_gratis')}</SelectItem>
                      <SelectItem value="buy_x_get_y_discount">{t('admin.promotions.bogoPromotionFormDialog.koop_x_korting_op_y')}</SelectItem>
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
                    <FormLabel>{t('admin.promotions.bogoPromotionFormDialog.koop_aantal')}</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} {...field} />
                    </FormControl>
                    <FormDescription>{t('admin.promotions.bogoPromotionFormDialog.hoeveel_moet_klant_kopen')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="get_quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('admin.promotions.bogoPromotionFormDialog.krijg_aantal')}</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} {...field} />
                    </FormControl>
                    <FormDescription>{t('admin.promotions.bogoPromotionFormDialog.hoeveel_krijgt_klant')}</FormDescription>
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
                  <FormLabel>{t('admin.promotions.bogoPromotionFormDialog.kortingstype')}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="free">{t('admin.promotions.bogoPromotionFormDialog.gratis_100')}</SelectItem>
                      <SelectItem value="percentage">{t('admin.promotions.autoDiscountFormDialog.percentage')}</SelectItem>
                      <SelectItem value="fixed_amount">{t('admin.promotions.autoDiscountFormDialog.vast_bedrag')}</SelectItem>
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
                      {discountType === 'percentage' ? t('admin.marketing.productPromoWizard.kortingspercentage') : t('admin.promotions.bogoPromotionFormDialog.kortingsbedrag')}
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
                  <FormLabel>{t('admin.promotions.bogoPromotionFormDialog.max_per_bestelling')}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      placeholder={t('admin.productForm.onbeperkt')}
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormDescription>{t('admin.promotions.bogoPromotionFormDialog.leeg_laten_voor_onbeperkt')}</FormDescription>
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
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <FormLabel>{t('admin.marketing.aBTestingPanel.actief')}</FormLabel>
                    <FormDescription>
                      {t('admin.promotions.bogoPromotionFormDialog.actie_is_direct_zichtbaar_en_toepasbaar')}
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
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={createPromotion.isPending || updatePromotion.isPending}>
                {promotion ? t('common.save') : t('admin.adsAiRules.aanmaken')}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
