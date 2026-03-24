import { useState, useEffect } from 'react';
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
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Wand2 } from 'lucide-react';
import { ProductMultiSelect } from './promotions/ProductMultiSelect';
import { CategoryMultiSelect } from './promotions/CategoryMultiSelect';
import type { DiscountCode, DiscountCodeFormData, DiscountType, DiscountAppliesTo } from '@/types/discount';
import { generateRandomCode } from '@/hooks/useDiscountCodes';

const formSchema = z.object({
  code: z.string().min(3, 'Code moet minimaal 3 karakters zijn').max(20, 'Code mag maximaal 20 karakters zijn'),
  description: z.string().optional(),
  discount_type: z.enum(['percentage', 'fixed_amount']),
  discount_value: z.coerce.number().min(0.01, 'Waarde moet groter zijn dan 0'),
  minimum_order_amount: z.coerce.number().min(0).optional().nullable(),
  maximum_discount_amount: z.coerce.number().min(0).optional().nullable(),
  usage_limit: z.coerce.number().int().min(1).optional().nullable(),
  usage_limit_per_customer: z.coerce.number().int().min(1).optional().nullable(),
  valid_from: z.string().optional().nullable(),
  valid_until: z.string().optional().nullable(),
  is_active: z.boolean(),
  applies_to: z.enum(['all', 'specific_products', 'specific_categories']),
  product_ids: z.array(z.string()).default([]),
  category_ids: z.array(z.string()).default([]),
  first_order_only: z.boolean(),
});

interface DiscountCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  discountCode?: DiscountCode | null;
  onSave: (data: DiscountCodeFormData) => void;
  isLoading?: boolean;
}

export function DiscountCodeDialog({
  open,
  onOpenChange,
  discountCode,
  onSave,
  isLoading,
}: DiscountCodeDialogProps) {
  const isEditing = !!discountCode;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: '',
      description: '',
      discount_type: 'percentage',
      discount_value: 10,
      minimum_order_amount: null,
      maximum_discount_amount: null,
      usage_limit: null,
      usage_limit_per_customer: null,
      valid_from: null,
      valid_until: null,
      is_active: true,
      applies_to: 'all',
      product_ids: [],
      category_ids: [],
      first_order_only: false,
    },
  });

  useEffect(() => {
    if (discountCode) {
      form.reset({
        code: discountCode.code,
        description: discountCode.description || '',
        discount_type: discountCode.discount_type as DiscountType,
        discount_value: discountCode.discount_value,
        minimum_order_amount: discountCode.minimum_order_amount,
        maximum_discount_amount: discountCode.maximum_discount_amount,
        usage_limit: discountCode.usage_limit,
        usage_limit_per_customer: discountCode.usage_limit_per_customer,
        valid_from: discountCode.valid_from ? discountCode.valid_from.split('T')[0] : null,
        valid_until: discountCode.valid_until ? discountCode.valid_until.split('T')[0] : null,
        is_active: discountCode.is_active,
        applies_to: discountCode.applies_to as DiscountAppliesTo,
        product_ids: discountCode.product_ids || [],
        category_ids: discountCode.category_ids || [],
        first_order_only: discountCode.first_order_only,
      });
    } else {
      form.reset({
        code: '',
        description: '',
        discount_type: 'percentage',
        discount_value: 10,
        minimum_order_amount: null,
        maximum_discount_amount: null,
        usage_limit: null,
        usage_limit_per_customer: null,
        valid_from: null,
        valid_until: null,
        is_active: true,
        applies_to: 'all',
        product_ids: [],
        category_ids: [],
        first_order_only: false,
      });
    }
  }, [discountCode, form]);

  const handleSubmit = (values: z.infer<typeof formSchema>) => {
    const formData: DiscountCodeFormData = {
      code: values.code,
      description: values.description || '',
      discount_type: values.discount_type,
      discount_value: values.discount_value,
      minimum_order_amount: values.minimum_order_amount || null,
      maximum_discount_amount: values.maximum_discount_amount || null,
      usage_limit: values.usage_limit || null,
      usage_limit_per_customer: values.usage_limit_per_customer || null,
      valid_from: values.valid_from ? new Date(values.valid_from).toISOString() : null,
      valid_until: values.valid_until ? new Date(values.valid_until).toISOString() : null,
      is_active: values.is_active,
      applies_to: values.applies_to,
      product_ids: values.applies_to === 'specific_products' ? values.product_ids : [],
      category_ids: values.applies_to === 'specific_categories' ? values.category_ids : [],
      first_order_only: values.first_order_only,
    };
    onSave(formData);
  };

  const generateCode = () => {
    form.setValue('code', generateRandomCode(8));
  };

  const discountType = form.watch('discount_type');
  const appliesTo = form.watch('applies_to');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Kortingscode bewerken' : 'Nieuwe kortingscode'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Code */}
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kortingscode *</FormLabel>
                  <div className="flex gap-2">
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="ZOMER2026"
                        className="font-mono uppercase"
                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                      />
                    </FormControl>
                    <Button type="button" variant="outline" onClick={generateCode}>
                      <Wand2 className="h-4 w-4" />
                    </Button>
                  </div>
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
                    <Textarea 
                      {...field} 
                      placeholder="Interne beschrijving van de kortingscode..."
                      rows={2}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            {/* Discount Type */}
            <FormField
              control={form.control}
              name="discount_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type korting</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="percentage" id="percentage" />
                        <Label htmlFor="percentage">Percentage</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="fixed_amount" id="fixed_amount" />
                        <Label htmlFor="fixed_amount">Vast bedrag</Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Discount Value */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="discount_value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {discountType === 'percentage' ? 'Kortingspercentage *' : 'Kortingsbedrag *'}
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input 
                          {...field} 
                          type="number" 
                          step={discountType === 'percentage' ? '1' : '0.01'}
                          min="0"
                          max={discountType === 'percentage' ? '100' : undefined}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                          {discountType === 'percentage' ? '%' : '€'}
                        </span>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {discountType === 'percentage' && (
                <FormField
                  control={form.control}
                  name="maximum_discount_amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max. korting</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input 
                            {...field} 
                            type="number" 
                            step="0.01"
                            min="0"
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                            placeholder="Geen limiet"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
                        </div>
                      </FormControl>
                      <FormDescription>Optioneel</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <Separator />

            {/* Applies To */}
            <FormField
              control={form.control}
              name="applies_to"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Toepassen op</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={(val) => {
                        field.onChange(val);
                        if (val !== 'specific_products') form.setValue('product_ids', []);
                        if (val !== 'specific_categories') form.setValue('category_ids', []);
                      }}
                      value={field.value}
                      className="flex flex-col gap-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="all" id="applies_all" />
                        <Label htmlFor="applies_all">Hele bestelling</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="specific_products" id="applies_products" />
                        <Label htmlFor="applies_products">Specifieke producten</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="specific_categories" id="applies_categories" />
                        <Label htmlFor="applies_categories">Specifieke categorieën</Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {appliesTo === 'specific_products' && (
              <FormField
                control={form.control}
                name="product_ids"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Producten</FormLabel>
                    <FormDescription>Selecteer de producten waarop deze code van toepassing is</FormDescription>
                    <ProductMultiSelect
                      selectedIds={field.value || []}
                      onChange={field.onChange}
                      placeholder="Selecteer producten..."
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {appliesTo === 'specific_categories' && (
              <FormField
                control={form.control}
                name="category_ids"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categorieën</FormLabel>
                    <FormDescription>Selecteer de categorieën waarop deze code van toepassing is</FormDescription>
                    <CategoryMultiSelect
                      selectedIds={field.value || []}
                      onChange={field.onChange}
                      placeholder="Selecteer categorieën..."
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <Separator />

            {/* Conditions */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="minimum_order_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Minimum bestelwaarde</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input 
                          {...field} 
                          type="number" 
                          step="0.01"
                          min="0"
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                          placeholder="Geen minimum"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="usage_limit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max. gebruik</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="number"
                        min="1"
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                        placeholder="Onbeperkt"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Validity period */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="valid_from"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Geldig van</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="date"
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value || null)}
                      />
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
                      <Input 
                        {...field} 
                        type="date"
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value || null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* Options */}
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="first_order_only"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <div>
                      <FormLabel>Alleen eerste bestelling</FormLabel>
                      <FormDescription>Code werkt alleen voor nieuwe klanten</FormDescription>
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
                  <FormItem className="flex items-center justify-between">
                    <div>
                      <FormLabel>Actief</FormLabel>
                      <FormDescription>Code kan worden gebruikt</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annuleren
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Opslaan...' : isEditing ? 'Bijwerken' : 'Aanmaken'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
