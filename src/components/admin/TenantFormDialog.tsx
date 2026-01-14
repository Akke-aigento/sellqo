import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tenant, TenantFormData } from '@/hooks/useTenants';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const tenantSchema = z.object({
  name: z.string().min(1, 'Naam is verplicht'),
  slug: z.string().min(1, 'Slug is verplicht').regex(/^[a-z0-9-]+$/, 'Alleen kleine letters, cijfers en streepjes'),
  owner_email: z.string().email('Ongeldig e-mailadres'),
  owner_name: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  postal_code: z.string().optional(),
  country: z.string().optional(),
  kvk_number: z.string().optional(),
  btw_number: z.string().optional(),
  subscription_plan: z.string().optional(),
  subscription_status: z.string().optional(),
  currency: z.string().optional(),
  tax_percentage: z.coerce.number().min(0).max(100).optional(),
  shipping_enabled: z.boolean().optional(),
});

interface TenantFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant: Tenant | null;
  onSubmit: (data: TenantFormData) => void;
  isLoading: boolean;
}

export function TenantFormDialog({
  open,
  onOpenChange,
  tenant,
  onSubmit,
  isLoading,
}: TenantFormDialogProps) {
  const form = useForm<TenantFormData>({
    resolver: zodResolver(tenantSchema),
    defaultValues: {
      name: '',
      slug: '',
      owner_email: '',
      owner_name: '',
      phone: '',
      address: '',
      city: '',
      postal_code: '',
      country: 'NL',
      kvk_number: '',
      btw_number: '',
      subscription_plan: 'starter',
      subscription_status: 'trial',
      currency: 'EUR',
      tax_percentage: 21,
      shipping_enabled: true,
    },
  });

  useEffect(() => {
    if (tenant) {
      form.reset({
        name: tenant.name,
        slug: tenant.slug,
        owner_email: tenant.owner_email,
        owner_name: tenant.owner_name || '',
        phone: tenant.phone || '',
        address: tenant.address || '',
        city: tenant.city || '',
        postal_code: tenant.postal_code || '',
        country: tenant.country || 'NL',
        kvk_number: tenant.kvk_number || '',
        btw_number: tenant.btw_number || '',
        subscription_plan: tenant.subscription_plan || 'starter',
        subscription_status: tenant.subscription_status || 'trial',
        currency: tenant.currency || 'EUR',
        tax_percentage: tenant.tax_percentage ?? 21,
        shipping_enabled: tenant.shipping_enabled ?? true,
      });
    } else {
      form.reset({
        name: '',
        slug: '',
        owner_email: '',
        owner_name: '',
        phone: '',
        address: '',
        city: '',
        postal_code: '',
        country: 'NL',
        kvk_number: '',
        btw_number: '',
        subscription_plan: 'starter',
        subscription_status: 'trial',
        currency: 'EUR',
        tax_percentage: 21,
        shipping_enabled: true,
      });
    }
  }, [tenant, form]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    form.setValue('name', name);
    if (!tenant) {
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      form.setValue('slug', slug);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {tenant ? 'Tenant bewerken' : 'Nieuwe tenant'}
          </DialogTitle>
          <DialogDescription>
            {tenant
              ? 'Wijzig de gegevens van deze tenant.'
              : 'Vul de gegevens in voor een nieuwe tenant.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <Tabs defaultValue="general" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="general">Algemeen</TabsTrigger>
                <TabsTrigger value="address">Adres</TabsTrigger>
                <TabsTrigger value="settings">Instellingen</TabsTrigger>
              </TabsList>

              <TabsContent value="general" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Winkelnaam *</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            onChange={handleNameChange}
                            placeholder="Mijn Webshop"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="slug"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Slug *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="mijn-webshop" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="owner_email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Eigenaar e-mail *</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" placeholder="eigenaar@winkel.nl" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="owner_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Eigenaar naam</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Jan Janssen" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefoonnummer</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="+31 6 12345678" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="kvk_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>KVK-nummer</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="12345678" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="btw_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>BTW-nummer</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="NL123456789B01" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              <TabsContent value="address" className="space-y-4 mt-4">
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Adres</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Straatnaam 123" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="postal_code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Postcode</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="1234 AB" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Stad</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Amsterdam" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Land</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecteer land" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="NL">Nederland</SelectItem>
                          <SelectItem value="BE">België</SelectItem>
                          <SelectItem value="DE">Duitsland</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="settings" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="subscription_plan"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Abonnement</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecteer plan" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="starter">Starter</SelectItem>
                            <SelectItem value="professional">Professional</SelectItem>
                            <SelectItem value="enterprise">Enterprise</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="subscription_status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecteer status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="trial">Trial</SelectItem>
                            <SelectItem value="active">Actief</SelectItem>
                            <SelectItem value="suspended">Opgeschort</SelectItem>
                            <SelectItem value="cancelled">Geannuleerd</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="currency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valuta</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecteer valuta" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="EUR">Euro (€)</SelectItem>
                            <SelectItem value="USD">Dollar ($)</SelectItem>
                            <SelectItem value="GBP">Pond (£)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="tax_percentage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>BTW-percentage</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" min={0} max={100} step={0.01} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="shipping_enabled"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div>
                        <FormLabel>Verzending ingeschakeld</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Schakel verzendopties in voor deze tenant
                        </p>
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
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Annuleren
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Opslaan...' : tenant ? 'Bijwerken' : 'Aanmaken'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
