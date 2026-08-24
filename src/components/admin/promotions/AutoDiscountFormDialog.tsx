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
import type { AutomaticDiscount, AutomaticDiscountFormData } from '@/types/promotions';
import { useTranslation } from 'react-i18next';

const formSchema = z.object({
  name: z.string().min(1, 'admin.promotions.autoDiscountFormDialog.validation.naam_is_verplicht'),
  description: z.string().optional(),
  trigger_type: z.string(),
  trigger_value: z.coerce.number().optional(),
  discount_type: z.string(),
  discount_value: z.coerce.number().optional(),
  applies_to: z.string(),
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
  const { t } = useTranslation();
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
      discount_type: 'percentage',
      discount_value: 10,
      applies_to: 'all',
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
        discount_type: discount.discount_type,
        discount_value: discount.discount_value || undefined,
        applies_to: discount.applies_to,
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
        discount_type: 'percentage',
        discount_value: 10,
        applies_to: 'all',
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
      discount_type: data.discount_type,
      discount_value: data.discount_value,
      applies_to: data.applies_to,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t('admin.promotions.autoDiscountFormDialog.automatische_korting_bewerken') : t('admin.promotions.autoDiscountFormDialog.nieuwe_automatische_korting')}
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
                    <Input placeholder={t('admin.promotions.autoDiscountFormDialog.gratis_verzending_vanaf_50')} {...field} />
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
                        <SelectItem value="cart_total">{t('admin.promotions.autoDiscountFormDialog.winkelwagen_totaal')}</SelectItem>
                        <SelectItem value="item_count">{t('admin.promotions.autoDiscountFormDialog.aantal_producten')}</SelectItem>
                        <SelectItem value="specific_products">{t('admin.promotions.autoDiscountFormDialog.specifieke_producten')}</SelectItem>
                        <SelectItem value="first_order">{t('admin.promotions.autoDiscountFormDialog.eerste_bestelling')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {watchTriggerType !== 'first_order' && (
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
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="discount_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('admin.promotions.autoDiscountFormDialog.korting_type')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="percentage">{t('admin.promotions.autoDiscountFormDialog.percentage')}</SelectItem>
                        <SelectItem value="fixed_amount">{t('admin.promotions.autoDiscountFormDialog.vast_bedrag')}</SelectItem>
                        <SelectItem value="free_shipping">{t('admin.promotions.autoDiscountFormDialog.gratis_verzending')}</SelectItem>
                        <SelectItem value="free_product">{t('admin.promotions.autoDiscountFormDialog.gratis_product')}</SelectItem>
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
                        {watchDiscountType === 'percentage' ? t('admin.productForm.percentage') : t('admin.promotions.autoDiscountFormDialog.bedrag')}
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
                  <FormLabel>{t('admin.promotions.autoDiscountFormDialog.toepassen_op')}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="all">{t('admin.promotions.autoDiscountFormDialog.hele_bestelling')}</SelectItem>
                      <SelectItem value="specific_products">{t('admin.promotions.autoDiscountFormDialog.specifieke_producten_2')}</SelectItem>
                      <SelectItem value="specific_categories">{t('admin.promotions.autoDiscountFormDialog.specifieke_categorieen')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="max_discount_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('admin.promotions.autoDiscountFormDialog.max_korting')}</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder={t('admin.productForm.geen_limiet')} {...field} />
                    </FormControl>
                    <FormDescription>{t('admin.promotions.autoDiscountFormDialog.optioneel_maximum')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('admin.promotions.autoDiscountFormDialog.prioriteit')}</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" {...field} />
                    </FormControl>
                    <FormDescription>{t('admin.promotions.autoDiscountFormDialog.lager_eerder_toegepast')}</FormDescription>
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
              <Button type="submit" disabled={createDiscount.isPending || updateDiscount.isPending}>
                {isEditing ? t('common.save') : t('admin.adsAiRules.aanmaken')}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
