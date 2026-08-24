import { useEffect } from 'react';
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
import { Plus, Trash2 } from 'lucide-react';
import { useCreateLoyaltyProgram, useUpdateLoyaltyProgram, useCreateLoyaltyTier } from '@/hooks/useLoyalty';
import type { LoyaltyProgram, LoyaltyProgramFormData } from '@/types/promotions';
import { useTranslation } from 'react-i18next';

const tierSchema = z.object({
  name: z.string().min(1, 'admin.promotions.autoDiscountFormDialog.validation.naam_is_verplicht'),
  min_points: z.coerce.number().min(0),
  points_multiplier: z.coerce.number().min(1),
  discount_percentage: z.coerce.number().min(0).max(100).optional(),
});

const formSchema = z.object({
  name: z.string().min(1, 'admin.promotions.autoDiscountFormDialog.validation.naam_is_verplicht'),
  description: z.string().optional(),
  points_per_euro: z.coerce.number().min(1),
  points_value: z.coerce.number().min(0.01),
  min_points_redeem: z.coerce.number().min(0),
  is_active: z.boolean(),
  tiers: z.array(tierSchema),
});

type FormValues = z.infer<typeof formSchema>;

interface LoyaltyProgramFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  program?: LoyaltyProgram | null;
}

export function LoyaltyProgramFormDialog({
  open,
  onOpenChange,
  program,
}: LoyaltyProgramFormDialogProps) {
  const { t } = useTranslation();
  const createProgram = useCreateLoyaltyProgram();
  const updateProgram = useUpdateLoyaltyProgram();
  const createTier = useCreateLoyaltyTier();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      points_per_euro: 10,
      points_value: 0.01,
      min_points_redeem: 100,
      is_active: true,
      tiers: [
        { name: t('admin.promotions.loyaltyProgramFormDialog.bronze'), min_points: 0, points_multiplier: 1, discount_percentage: 0 },
        { name: t('admin.promotions.loyaltyProgramFormDialog.silver'), min_points: 500, points_multiplier: 1.5, discount_percentage: 5 },
        { name: t('admin.promotions.loyaltyProgramFormDialog.gold'), min_points: 2000, points_multiplier: 2, discount_percentage: 10 },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'tiers',
  });

  useEffect(() => {
    if (program) {
      form.reset({
        name: program.name,
        description: program.description || '',
        points_per_euro: program.points_per_euro,
        points_value: program.points_value,
        min_points_redeem: program.min_points_redeem,
        is_active: program.is_active,
        tiers: program.tiers?.map((t) => ({
          name: t.name,
          min_points: t.min_points,
          points_multiplier: t.points_multiplier,
          discount_percentage: t.discount_percentage ?? 0,
        })) || [],
      });
    } else {
      form.reset({
        name: '',
        description: '',
        points_per_euro: 10,
        points_value: 0.01,
        min_points_redeem: 100,
        is_active: true,
        tiers: [
          { name: t('admin.promotions.loyaltyProgramFormDialog.bronze'), min_points: 0, points_multiplier: 1, discount_percentage: 0 },
          { name: t('admin.promotions.loyaltyProgramFormDialog.silver'), min_points: 500, points_multiplier: 1.5, discount_percentage: 5 },
          { name: t('admin.promotions.loyaltyProgramFormDialog.gold'), min_points: 2000, points_multiplier: 2, discount_percentage: 10 },
        ],
      });
    }
  }, [program, form]);

  const onSubmit = async (values: FormValues) => {
    const formData: LoyaltyProgramFormData = {
      name: values.name,
      description: values.description || null,
      points_per_euro: values.points_per_euro,
      points_value: values.points_value,
      min_points_redeem: values.min_points_redeem,
      is_active: values.is_active,
    };

    if (program) {
      await updateProgram.mutateAsync({ id: program.id, formData });
      // Note: Tier updates would need separate handling in production
    } else {
      const newProgram = await createProgram.mutateAsync(formData);
      // Create tiers for new program
      for (const tier of values.tiers) {
        await createTier.mutateAsync({
          programId: newProgram.id,
          formData: {
            name: tier.name,
            min_points: tier.min_points,
            points_multiplier: tier.points_multiplier,
            discount_percentage: tier.discount_percentage ?? null,
          },
        });
      }
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {program ? t('admin.promotions.loyaltyProgramFormDialog.programma_bewerken') : t('admin.promotions.loyaltyProgramFormDialog.nieuw_loyaliteitsprogramma')}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('common.name')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('admin.promotions.loyaltyProgramFormDialog.vip_spaarprogramma')} {...field} />
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
                    <Textarea placeholder={t('admin.promotions.loyaltyProgramFormDialog.spaar_punten_bij_elke_aankoop')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="points_per_euro"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('admin.promotions.loyaltyProgramFormDialog.punten_per_1')}</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} {...field} />
                    </FormControl>
                    <FormDescription>{t('admin.promotions.loyaltyProgramFormDialog.hoeveel_punten_per_euro')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="points_value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('admin.promotions.loyaltyProgramFormDialog.waarde_per_punt')}</FormLabel>
                    <FormControl>
                      <Input type="number" step={0.01} min={0.01} {...field} />
                    </FormControl>
                    <FormDescription>{t('admin.promotions.loyaltyProgramFormDialog.euro_waarde_bij_inwisselen')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="min_points_redeem"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('admin.promotions.loyaltyProgramFormDialog.min_inwisselen')}</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field} />
                    </FormControl>
                    <FormDescription>{t('admin.promotions.loyaltyProgramFormDialog.minimum_punten')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Tiers */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <FormLabel>{t('admin.promotions.loyaltyProgramFormDialog.tiers')}</FormLabel>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ name: '', min_points: 0, points_multiplier: 1, discount_percentage: 0 })}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {t('admin.promotions.loyaltyProgramFormDialog.tier_toevoegen')}
                </Button>
              </div>

              {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 items-end p-3 border rounded-lg">
                  <FormField
                    control={form.control}
                    name={`tiers.${index}.name`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">{t('common.name')}</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`tiers.${index}.min_points`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">{t('admin.promotions.loyaltyProgramFormDialog.min_punten')}</FormLabel>
                        <FormControl>
                          <Input type="number" min={0} {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`tiers.${index}.points_multiplier`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">{t('admin.promotions.loyaltyProgramFormDialog.multiplier')}</FormLabel>
                        <FormControl>
                          <Input type="number" step={0.1} min={1} {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`tiers.${index}.discount_percentage`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">{t('admin.promotions.loyaltyProgramFormDialog.korting')}</FormLabel>
                        <FormControl>
                          <Input type="number" min={0} max={100} {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(index)}
                    disabled={fields.length <= 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <FormLabel>{t('admin.marketing.aBTestingPanel.actief')}</FormLabel>
                    <FormDescription>
                      {t('admin.promotions.loyaltyProgramFormDialog.klanten_kunnen_punten_sparen_en_inwisselen')}
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
              <Button type="submit" disabled={createProgram.isPending || updateProgram.isPending}>
                {program ? t('common.save') : t('admin.adsAiRules.aanmaken')}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
