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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateGiftCard } from '@/hooks/useGiftCards';
import { useGiftCardDesigns } from '@/hooks/useGiftCardDesigns';
import { CreditCard, Gift } from 'lucide-react';

const formSchema = z.object({
  initial_balance: z.coerce.number().min(1, 'Minimaal €1'),
  currency: z.string().default('EUR'),
  recipient_email: z.string().email('Ongeldig emailadres').optional().or(z.literal('')),
  recipient_name: z.string().optional(),
  personal_message: z.string().optional(),
  design_id: z.string().optional(),
  expires_at: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface GiftCardFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GiftCardFormDialog({ open, onOpenChange }: GiftCardFormDialogProps) {
  const createGiftCard = useCreateGiftCard();
  const { data: designs = [] } = useGiftCardDesigns();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      initial_balance: 25,
      currency: 'EUR',
      recipient_email: '',
      recipient_name: '',
      personal_message: '',
      design_id: '',
      expires_at: '',
    },
  });

  useEffect(() => {
    if (open) {
      form.reset();
    }
  }, [open, form]);

  const onSubmit = async (data: FormData) => {
    await createGiftCard.mutateAsync({
      initial_balance: data.initial_balance,
      currency: data.currency,
      recipient_email: data.recipient_email || null,
      recipient_name: data.recipient_name || null,
      personal_message: data.personal_message || null,
      design_id: data.design_id || null,
      expires_at: data.expires_at || null,
    });
    onOpenChange(false);
  };

  const quickAmounts = [10, 25, 50, 100, 150, 200];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Nieuwe Cadeaukaart
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="initial_balance"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Waarde</FormLabel>
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {quickAmounts.map((amount) => (
                        <Button
                          key={amount}
                          type="button"
                          variant={field.value === amount ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => field.onChange(amount)}
                        >
                          €{amount}
                        </Button>
                      ))}
                    </div>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                          €
                        </span>
                        <Input
                          type="number"
                          min={1}
                          step={0.01}
                          className="pl-7"
                          {...field}
                        />
                      </div>
                    </FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="recipient_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Naam ontvanger</FormLabel>
                    <FormControl>
                      <Input placeholder="Jan Jansen" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="recipient_email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email ontvanger</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="jan@voorbeeld.nl"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="personal_message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Persoonlijk bericht</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Veel plezier met je cadeau!"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Dit bericht wordt getoond aan de ontvanger
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {designs.length > 0 && (
              <FormField
                control={form.control}
                name="design_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ontwerp</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Kies een ontwerp" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {designs
                          .filter((d) => d.is_active)
                          .map((design) => (
                            <SelectItem key={design.id} value={design.id}>
                              <div className="flex items-center gap-2">
                                <Gift className="h-4 w-4" />
                                {design.name}
                              </div>
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="expires_at"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vervaldatum (optioneel)</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormDescription>
                    Laat leeg voor geen vervaldatum
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Annuleren
              </Button>
              <Button type="submit" disabled={createGiftCard.isPending}>
                {createGiftCard.isPending ? 'Aanmaken...' : 'Cadeaukaart aanmaken'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
