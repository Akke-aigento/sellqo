import { useState } from 'react';
import { Search, Plus, User, Check, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useCustomers } from '@/hooks/useCustomers';
import { useTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import type { Customer } from '@/types/order';

interface CustomerSelectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (customer: Customer) => void;
  selectedCustomerId?: string;
}

export function CustomerSelectDialog({ 
  open, 
  onOpenChange, 
  onSelect,
  selectedCustomerId 
}: CustomerSelectDialogProps) {
  const [search, setSearch] = useState('');
  const [showNewForm, setShowNewForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    email: '',
    first_name: '',
    last_name: '',
    phone: '',
  });

  const { customers, isLoading } = useCustomers(search);
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleCreateCustomer = async () => {
    if (!currentTenant?.id || !newCustomer.email) return;

    setIsCreating(true);
    try {
      const { data, error } = await supabase
        .from('customers')
        .insert({
          tenant_id: currentTenant.id,
          email: newCustomer.email,
          first_name: newCustomer.first_name || null,
          last_name: newCustomer.last_name || null,
          phone: newCustomer.phone || null,
        })
        .select()
        .single();

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({ title: 'Klant aangemaakt' });
      onSelect(data as Customer);
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      toast({ 
        title: 'Fout bij aanmaken', 
        description: error.message, 
        variant: 'destructive' 
      });
    } finally {
      setIsCreating(false);
    }
  };

  const resetForm = () => {
    setNewCustomer({ email: '', first_name: '', last_name: '', phone: '' });
    setShowNewForm(false);
    setSearch('');
  };

  const handleClose = (open: boolean) => {
    if (!open) resetForm();
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {showNewForm ? 'Nieuwe klant aanmaken' : 'Klant selecteren'}
          </DialogTitle>
          <DialogDescription>
            {showNewForm 
              ? 'Vul de gegevens in om een nieuwe klant aan te maken.' 
              : 'Zoek en selecteer een bestaande klant of maak een nieuwe aan.'}
          </DialogDescription>
        </DialogHeader>

        {showNewForm ? (
          <div className="space-y-4">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mailadres *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="klant@voorbeeld.nl"
                  value={newCustomer.email}
                  onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">Voornaam</Label>
                  <Input
                    id="first_name"
                    placeholder="Jan"
                    value={newCustomer.first_name}
                    onChange={(e) => setNewCustomer({ ...newCustomer, first_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Achternaam</Label>
                  <Input
                    id="last_name"
                    placeholder="Jansen"
                    value={newCustomer.last_name}
                    onChange={(e) => setNewCustomer({ ...newCustomer, last_name: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefoon</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+31 6 12345678"
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowNewForm(false)}>
                Annuleren
              </Button>
              <Button 
                onClick={handleCreateCustomer} 
                disabled={!newCustomer.email || isCreating}
              >
                {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Aanmaken & selecteren
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Zoek op naam of e-mail..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button variant="outline" onClick={() => setShowNewForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nieuwe klant
              </Button>
            </div>

            <Separator />

            <ScrollArea className="h-[300px]">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : customers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <User className="h-8 w-8 mb-2" />
                  <p>{search ? 'Geen klanten gevonden' : 'Nog geen klanten'}</p>
                  <Button 
                    variant="link" 
                    className="mt-2" 
                    onClick={() => setShowNewForm(true)}
                  >
                    Maak een nieuwe klant aan
                  </Button>
                </div>
              ) : (
                <div className="space-y-1">
                  {customers.map((customer) => (
                    <button
                      key={customer.id}
                      onClick={() => {
                        onSelect(customer);
                        onOpenChange(false);
                        resetForm();
                      }}
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent text-left transition-colors"
                    >
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {customer.first_name || customer.last_name 
                            ? `${customer.first_name || ''} ${customer.last_name || ''}`.trim()
                            : customer.email}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">
                          {customer.email}
                        </p>
                      </div>
                      {selectedCustomerId === customer.id && (
                        <Check className="h-5 w-5 text-primary shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
