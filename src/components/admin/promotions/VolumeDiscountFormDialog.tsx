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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
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
import { Plus, Trash2 } from 'lucide-react';
import { useCreateVolumeDiscount, useUpdateVolumeDiscount } from '@/hooks/useVolumeDiscounts';
import type { VolumeDiscount, VolumeDiscountFormData } from '@/types/promotions';

const tierSchema = z.object({
  min_quantity: z.coerce.number().min(0),
  max_quantity: z.coerce.number().optional(),
  discount_type: z.enum(['percentage', 'fixed_amount']),
  discount_value: z.coerce.number().min(0),
});

const formSchema = z.object({
  name: z.string().min(1, 'Naam is verplicht'),
  description: z.string().optional(),
  applies_to: z.enum(['all', 'product', 'category']),
  is_active: z.boolean(),
  valid_from: z.string().optional(),
  valid_until: z.string().optional(),
  tiers: z.array(tierSchema).min(1, 'Minimaal 1 staffel vereist'),
});

type FormData = z.infer<typeof formSchema>;

interface VolumeDiscountFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  discount?: VolumeDiscount | null;
}

export function VolumeDiscountFormDialog({
  open,
  onOpenChange,
  discount,
}: VolumeDiscountFormDialogProps) {
  const createDiscount = useCreateVolumeDiscount();
  const updateDiscount = useUpdateVolumeDiscount();
  const isEditing = !!discount;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      applies_to: 'all',
      is_active: true,
      valid_from: '',
      valid_until: '',
      tiers: [{ min_quantity: 5, discount_type: 'percentage', discount_value: 5 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'tiers',
  });

  useEffect(() => {
    if (discount) {
      form.reset({
        name: discount.name,
        description: discount.description || '',
        applies_to: discount.applies_to,
        is_active: discount.is_active,
        valid_from: discount.valid_from || '',
        valid_until: discount.valid_until || '',
        tiers: discount.tiers?.map(t => ({
          min_quantity: t.min_quantity,
          max_quantity: t.max_quantity || undefined,
          discount_type: t.discount_type as 'percentage' | 'fixed_amount',
          discount_value: t.discount_value,
        })) || [{ min_quantity: 5, discount_type: 'percentage' as const, discount_value: 5 }],
      });
    } else {
      form.reset({
        name: '',
        description: '',
        applies_to: 'all',
        is_active: true,
        valid_from: '',
        valid_until: '',
        tiers: [{ min_quantity: 5, discount_type: 'percentage', discount_value: 5 }],
      });
    }
  }, [discount, form]);

  const onSubmit = (data: FormData) => {
    const formData: VolumeDiscountFormData = {
      name: data.name,
      description: data.description,
      applies_to: data.applies_to,
      is_active: data.is_active,
      valid_from: data.valid_from || undefined,
      valid_until: data.valid_until || undefined,
      tiers: data.tiers.map(t => ({
        min_quantity: t.min_quantity,
        max_quantity: t.max_quantity,
        discount_type: t.discount_type,
        discount_value: t.discount_value,
      })),
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Staffelkorting Bewerken' : 'Nieuwe Staffelkorting'}
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
                    <Input placeholder="Kwantumkorting" {...field} />
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
                    <Textarea placeholder="Beschrijf de staffelkorting..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="applies_to"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Toepassen op</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="all">Alle producten</SelectItem>
                      <SelectItem value="product">Specifieke producten</SelectItem>
                      <SelectItem value="category">Categorie</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <FormLabel>Staffels</FormLabel>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    append({ min_quantity: 0, discount_type: 'percentage', discount_value: 0 })
                  }
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Staffel
                </Button>
              </div>
              
              {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-12 gap-2 items-end p-3 border rounded-lg">
                  <FormField
                    control={form.control}
                    name={`tiers.${index}.min_quantity`}
                    render={({ field }) => (
                      <FormItem className="col-span-3">
                        <FormLabel className="text-xs">Min. stuks</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`tiers.${index}.max_quantity`}
                    render={({ field }) => (
                      <FormItem className="col-span-3">
                        <FormLabel className="text-xs">Max (optioneel)</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`tiers.${index}.discount_type`}
                    render={({ field }) => (
                      <FormItem className="col-span-3">
                        <FormLabel className="text-xs">Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="percentage">%</SelectItem>
                            <SelectItem value="fixed_amount">€</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`tiers.${index}.discount_value`}
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel className="text-xs">Korting</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="col-span-1"
                    onClick={() => fields.length > 1 && remove(index)}
                    disabled={fields.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
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
              <Button type="submit" disabled={createDiscount.isPending || updateDiscount.isPending}>
                {isEditing ? 'Opslaan' : 'Aanmaken'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
