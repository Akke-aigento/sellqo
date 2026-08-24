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
import { useTranslation } from 'react-i18next';

// Labels staan als i18n-key; `id` blijft de opgeslagen kortingstype-waarde.
const discountTypes = [
  { id: 'discount_code', labelKey: 'admin.promotions.stackingRuleFormDialog.discountTypes.discount_code' },
  { id: 'volume_discount', labelKey: 'admin.promotions.stackingRuleFormDialog.discountTypes.volume_discount' },
  { id: 'automatic_discount', labelKey: 'admin.promotions.stackingRuleFormDialog.discountTypes.automatic_discount' },
  { id: 'bundle_discount', labelKey: 'admin.promotions.stackingRuleFormDialog.discountTypes.bundle_discount' },
  { id: 'bogo', labelKey: 'admin.promotions.stackingRuleFormDialog.discountTypes.bogo' },
  { id: 'customer_group', labelKey: 'admin.promotions.stackingRuleFormDialog.discountTypes.customer_group' },
  { id: 'loyalty', labelKey: 'admin.promotions.stackingRuleFormDialog.discountTypes.loyalty' },
  { id: 'gift_promotion', labelKey: 'admin.promotions.stackingRuleFormDialog.discountTypes.gift_promotion' },
];

const formSchema = z.object({
  name: z.string().min(1, 'admin.promotions.autoDiscountFormDialog.validation.naam_is_verplicht'),
  description: z.string().optional(),
  rule_type: z.enum(['exclusive', 'stackable', 'priority']),
  discount_types: z.array(z.string()).min(1, 'admin.promotions.stackingRuleFormDialog.validation.selecteer_minimaal_1_type'),
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
  const { t } = useTranslation();
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
            {rule ? t('admin.promotions.stackingRuleFormDialog.stapelregel_bewerken') : t('admin.promotions.stackingRuleFormDialog.nieuwe_stapelregel')}
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
                    <Input placeholder={t('admin.promotions.stackingRuleFormDialog.exclusieve_kortingscode_regel')} {...field} />
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
              name="rule_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin.promotions.stackingRuleFormDialog.regeltype')}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="exclusive">
                        {t('admin.promotions.stackingRuleFormDialog.exclusief_kan_niet_met_andere_kortingen')}
                      </SelectItem>
                      <SelectItem value="stackable">
                        {t('admin.promotions.stackingRuleFormDialog.stapelbaar_mag_combineren_met_andere_kortingen')}
                      </SelectItem>
                      <SelectItem value="priority">
                        {t('admin.promotions.stackingRuleFormDialog.prioriteit_bepaal_volgorde_van_toepassing')}
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
                  <FormLabel>{t('admin.promotions.stackingRuleFormDialog.van_toepassing_op')}</FormLabel>
                  <FormDescription>
                    {t('admin.promotions.stackingRuleFormDialog.selecteer_welke_kortingstypes_deze_regel_beinvloedt')}
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
                              {t(type.labelKey)}
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
                      <FormLabel>{t('admin.promotions.stackingRuleFormDialog.max_aantal_stapelbare_kortingen')}</FormLabel>
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

                <FormField
                  control={form.control}
                  name="max_total_discount_percent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('admin.promotions.stackingRuleFormDialog.max_totale_korting')}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          placeholder={t('admin.productForm.geen_limiet')}
                          {...field}
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <FormDescription>
                        {t('admin.promotions.stackingRuleFormDialog.voorkom_extreem_hoge_kortingen_door_combinatie')}
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
                    <FormLabel>{t('admin.marketing.aBTestingPanel.actief')}</FormLabel>
                    <FormDescription>
                      {t('admin.promotions.stackingRuleFormDialog.regel_wordt_toegepast_bij_berekening')}
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
              <Button type="submit" disabled={createRule.isPending || updateRule.isPending}>
                {rule ? t('common.save') : t('admin.adsAiRules.aanmaken')}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
