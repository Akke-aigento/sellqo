import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Wand2 } from 'lucide-react';
import { 
  useCreatePlatformCoupon, 
  useUpdatePlatformCoupon,
  generateCouponCode,
} from '@/hooks/usePlatformPromotions';
import type { PlatformCoupon } from '@/types/platformPromotion';

const formSchema = z.object({
  code: z.string().min(3, 'Code moet minimaal 3 tekens zijn').max(20),
  name: z.string().min(2, 'Naam is verplicht'),
  description: z.string().optional(),
  discount_type: z.enum(['percentage', 'fixed_amount', 'free_months']),
  discount_value: z.coerce.number().positive('Waarde moet positief zijn'),
  applies_to: z.enum(['all', 'new_tenants', 'upgrade', 'specific_plans']),
  min_subscription_months: z.coerce.number().optional(),
  max_uses: z.coerce.number().optional(),
  max_uses_per_tenant: z.coerce.number().min(1).optional(),
  valid_from: z.string().optional(),
  valid_until: z.string().optional(),
  is_active: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

interface PlatformCouponFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coupon: PlatformCoupon | null;
}

export function PlatformCouponFormDialog({
  open,
  onOpenChange,
  coupon,
}: PlatformCouponFormDialogProps) {
  const createCoupon = useCreatePlatformCoupon();
  const updateCoupon = useUpdatePlatformCoupon();
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: '',
      name: '',
      description: '',
      discount_type: 'percentage',
      discount_value: 10,
      applies_to: 'all',
      min_subscription_months: undefined,
      max_uses: undefined,
      max_uses_per_tenant: 1,
      valid_from: '',
      valid_until: '',
      is_active: true,
    },
  });

  useEffect(() => {
    if (coupon) {
      form.reset({
        code: coupon.code,
        name: coupon.name,
        description: coupon.description || '',
        discount_type: coupon.discount_type,
        discount_value: coupon.discount_value,
        applies_to: coupon.applies_to,
        min_subscription_months: coupon.min_subscription_months || undefined,
        max_uses: coupon.max_uses || undefined,
        max_uses_per_tenant: coupon.max_uses_per_tenant,
        valid_from: coupon.valid_from?.split('T')[0] || '',
        valid_until: coupon.valid_until?.split('T')[0] || '',
        is_active: coupon.is_active,
      });
    } else {
      form.reset({
        code: '',
        name: '',
        description: '',
        discount_type: 'percentage',
        discount_value: 10,
        applies_to: 'all',
        min_subscription_months: undefined,
        max_uses: undefined,
        max_uses_per_tenant: 1,
        valid_from: '',
        valid_until: '',
        is_active: true,
      });
    }
  }, [coupon, form]);

  const onSubmit = async (values: FormValues) => {
    const data = {
      code: values.code.toUpperCase(),
      name: values.name,
      description: values.description || undefined,
      discount_type: values.discount_type,
      discount_value: values.discount_value,
      applies_to: values.applies_to,
      min_subscription_months: values.min_subscription_months || undefined,
      max_uses: values.max_uses || undefined,
      max_uses_per_tenant: values.max_uses_per_tenant || 1,
      valid_from: values.valid_from ? new Date(values.valid_from).toISOString() : undefined,
      valid_until: values.valid_until ? new Date(values.valid_until).toISOString() : undefined,
      is_active: values.is_active,
    };

    if (coupon) {
      await updateCoupon.mutateAsync({ id: coupon.id, formData: data });
    } else {
      await createCoupon.mutateAsync(data);
    }
    
    onOpenChange(false);
  };

  const handleGenerateCode = () => {
    form.setValue('code', generateCouponCode());
  };

  const discountType = form.watch('discount_type');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {coupon ? 'Coupon Bewerken' : 'Nieuwe Coupon'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Code */}
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Code</FormLabel>
                  <div className="flex gap-2">
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="ZOMER2024"
                        className="uppercase"
                      />
                    </FormControl>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={handleGenerateCode}
                    >
                      <Wand2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Naam</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Zomer Actie 2024" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Beschrijving</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Optionele beschrijving..." rows={2} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Discount Type & Value */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="discount_type"
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
                        <SelectItem value="percentage">Percentage</SelectItem>
                        <SelectItem value="fixed_amount">Vast bedrag</SelectItem>
                        <SelectItem value="free_months">Gratis maanden</SelectItem>
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
                      {discountType === 'percentage' ? 'Percentage' : 
                       discountType === 'fixed_amount' ? 'Bedrag (€)' : 'Maanden'}
                    </FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        {...field}
                        min={0}
                        max={discountType === 'percentage' ? 100 : undefined}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Applies To */}
            <FormField
              control={form.control}
              name="applies_to"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Van toepassing op</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="all">Alle tenants</SelectItem>
                      <SelectItem value="new_tenants">Alleen nieuwe tenants</SelectItem>
                      <SelectItem value="upgrade">Bij upgrade</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Validity Dates */}
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

            {/* Usage Limits */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="max_uses"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max totaal gebruik</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        {...field} 
                        placeholder="Onbeperkt"
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Laat leeg voor onbeperkt
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="max_uses_per_tenant"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max per tenant</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        {...field} 
                        min={1}
                        value={field.value || 1}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Is Active */}
            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Actief</FormLabel>
                    <FormDescription>
                      Alleen actieve coupons kunnen worden ingewisseld
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Annuleren
              </Button>
              <Button 
                type="submit"
                disabled={createCoupon.isPending || updateCoupon.isPending}
              >
                {coupon ? 'Opslaan' : 'Aanmaken'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
