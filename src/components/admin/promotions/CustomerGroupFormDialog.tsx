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
import type { CustomerGroup } from '@/types/promotions';

const formSchema = z.object({
  name: z.string().min(1, 'Naam is verplicht'),
  code: z.string().min(1, 'Code is verplicht').toUpperCase(),
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
        discount_type: group.discount_type as FormData['discount_type'] || 'percentage',
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
    if (isEditing && group) {
      updateGroup.mutate(
        { id: group.id, formData: data },
        { onSuccess: () => onOpenChange(false) }
      );
    } else {
      createGroup.mutate(data, {
        onSuccess: () => onOpenChange(false),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Klantengroep Bewerken' : 'Nieuwe Klantengroep'}
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
                    <FormLabel>Naam</FormLabel>
                    <FormControl>
                      <Input placeholder="Groothandel" {...field} />
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
                    <FormLabel>Code</FormLabel>
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
                  <FormLabel>Beschrijving</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Beschrijving van de groep..." {...field} />
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
                    <FormLabel>Korting type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Geen standaard korting" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="percentage">Percentage</SelectItem>
                        <SelectItem value="fixed_amount">Vast bedrag</SelectItem>
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
                      {form.watch('discount_type') === 'percentage' ? 'Korting (%)' : 'Korting (€)'}
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
                    <FormLabel>Min. bestelbedrag (€)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="Geen minimum" {...field} />
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
                    <FormLabel>Prioriteit</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" {...field} />
                    </FormControl>
                    <FormDescription>Lager = hogere prioriteit</FormDescription>
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
                    <FormLabel className="cursor-pointer">BTW vrijgesteld</FormLabel>
                    <FormDescription>Geen BTW berekenen voor deze groep</FormDescription>
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
              <Button type="submit" disabled={createGroup.isPending || updateGroup.isPending}>
                {isEditing ? 'Opslaan' : 'Aanmaken'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
