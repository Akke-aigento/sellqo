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
import { useCreateCustomerGroup, useUpdateCustomerGroup } from '@/hooks/useCustomerGroups';
import type { CustomerGroup, CustomerGroupFormData } from '@/types/promotions';
import { useTranslation } from 'react-i18next';

const formSchema = z.object({
  name: z.string().min(1, 'admin.promotions.autoDiscountFormDialog.validation.naam_is_verplicht'),
  code: z.string().min(1, 'admin.promotions.customerGroupFormDialog.validation.code_is_verplicht'),
  description: z.string().optional(),
  discount_type: z.enum(['percentage', 'fixed_amount']).optional(),
  discount_value: z.coerce.number().optional(),
  min_order_amount: z.coerce.number().optional(),
  tax_exempt: z.boolean(),
  priority: z.coerce.number().min(1).default(10),
  is_active: z.boolean(),
});

type FormData = z.infer<typeof formSchema>;

interface CustomerGroupFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group?: CustomerGroup | null;
}

export function CustomerGroupFormDialog({
  open,
  onOpenChange,
  group,
}: CustomerGroupFormDialogProps) {
  const { t } = useTranslation();
  const createGroup = useCreateCustomerGroup();
  const updateGroup = useUpdateCustomerGroup();
  const isEditing = !!group;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      code: '',
      description: '',
      discount_type: 'percentage',
      discount_value: undefined,
      min_order_amount: undefined,
      tax_exempt: false,
      priority: 10,
      is_active: true,
    },
  });

  useEffect(() => {
    if (group) {
      form.reset({
        name: group.name,
        code: group.code,
        description: group.description || '',
        discount_type: (group.discount_type as 'percentage' | 'fixed_amount') || 'percentage',
        discount_value: group.discount_value || undefined,
        min_order_amount: group.min_order_amount || undefined,
        tax_exempt: group.tax_exempt,
        priority: group.priority,
        is_active: group.is_active,
      });
    } else {
      form.reset({
        name: '',
        code: '',
        description: '',
        discount_type: 'percentage',
        discount_value: undefined,
        min_order_amount: undefined,
        tax_exempt: false,
        priority: 10,
        is_active: true,
      });
    }
  }, [group, form]);

  const onSubmit = (data: FormData) => {
    const formData: CustomerGroupFormData = {
      name: data.name,
      code: data.code.toUpperCase(),
      description: data.description,
      discount_type: data.discount_type,
      discount_value: data.discount_value,
      min_order_amount: data.min_order_amount,
      tax_exempt: data.tax_exempt,
      priority: data.priority,
      is_active: data.is_active,
    };

    if (isEditing && group) {
      updateGroup.mutate(
        { id: group.id, formData },
        { onSuccess: () => onOpenChange(false) }
      );
    } else {
      createGroup.mutate(formData, {
        onSuccess: () => onOpenChange(false),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t('admin.promotions.customerGroupFormDialog.klantengroep_bewerken') : t('admin.promotions.customerGroupFormDialog.nieuwe_klantengroep')}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('common.name')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('admin.promotions.customerGroupFormDialog.groothandel')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('admin.products.productDescriptionEditor.code')}</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="WHOLESALE" 
                        {...field} 
                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin.marketing.emailBlockProperties.beschrijving')}</FormLabel>
                  <FormControl>
                    <Textarea placeholder={t('admin.promotions.customerGroupFormDialog.beschrijving_van_de_groep')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                          <SelectValue placeholder={t('admin.promotions.customerGroupFormDialog.geen_standaard_korting')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="percentage">{t('admin.promotions.autoDiscountFormDialog.percentage')}</SelectItem>
                        <SelectItem value="fixed_amount">{t('admin.promotions.autoDiscountFormDialog.vast_bedrag')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="discount_value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {form.watch('discount_type') === 'percentage' ? t('admin.productForm.korting') : t('admin.promotions.customerGroupFormDialog.korting')}
                    </FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="min_order_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('admin.promotions.customerGroupFormDialog.min_bestelbedrag')}</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder={t('admin.promotions.customerGroupFormDialog.geen_minimum')} {...field} />
                    </FormControl>
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
                    <FormDescription>{t('admin.promotions.customerGroupFormDialog.lager_hogere_prioriteit')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="tax_exempt"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <FormLabel className="cursor-pointer">{t('admin.promotions.customerGroupFormDialog.btw_vrijgesteld')}</FormLabel>
                    <FormDescription>{t('admin.promotions.customerGroupFormDialog.geen_btw_berekenen_voor_deze_groep')}</FormDescription>
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
              <Button type="submit" disabled={createGroup.isPending || updateGroup.isPending}>
                {isEditing ? t('common.save') : t('admin.adsAiRules.aanmaken')}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
