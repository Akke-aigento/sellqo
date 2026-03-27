import { useState, useMemo } from 'react';
import { Search, User, Building2, X, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useCustomers } from '@/hooks/useCustomers';
import type { Customer } from '@/types/order';

interface POSCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCustomer: Customer | null;
  onSelectCustomer: (customer: Customer | null) => void;
}

export function POSCustomerDialog({
  open,
  onOpenChange,
  selectedCustomer,
  onSelectCustomer,
}: POSCustomerDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ first_name: '', last_name: '', email: '', phone: '' });
  const { customers, isLoading, createCustomer } = useCustomers(searchQuery);

  const filteredCustomers = useMemo(() => {
    if (!searchQuery) return customers.slice(0, 20);
    return customers;
  }, [customers, searchQuery]);

  const handleSelect = (customer: Customer) => {
    onSelectCustomer(customer);
    onOpenChange(false);
    setSearchQuery('');
    setShowCreateForm(false);
  };

  const handleClear = () => {
    onSelectCustomer(null);
    onOpenChange(false);
    setSearchQuery('');
    setShowCreateForm(false);
  };

  const handleCreateCustomer = async () => {
    if (!newCustomer.first_name || !newCustomer.last_name || !newCustomer.email) return;
    try {
      const created = await createCustomer.mutateAsync({
        first_name: newCustomer.first_name,
        last_name: newCustomer.last_name,
        email: newCustomer.email,
        phone: newCustomer.phone || undefined,
      });
      if (created) {
        onSelectCustomer(created as Customer);
        onOpenChange(false);
        setShowCreateForm(false);
        setNewCustomer({ first_name: '', last_name: '', email: '', phone: '' });
        setSearchQuery('');
      }
    } catch {
      // Error handled by useCustomers toast
    }
  };

  const getCustomerName = (customer: Customer) => {
    if (customer.company_name) return customer.company_name;
    return `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || customer.email;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {showCreateForm ? 'Nieuwe Klant Aanmaken' : 'Klant Selecteren'}
          </DialogTitle>
        </DialogHeader>

        {showCreateForm ? (
          /* Create Customer Form */
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="first_name">Voornaam *</Label>
                <Input
                  id="first_name"
                  placeholder="Voornaam"
                  value={newCustomer.first_name}
                  onChange={(e) => setNewCustomer(p => ({ ...p, first_name: e.target.value }))}
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="last_name">Achternaam *</Label>
                <Input
                  id="last_name"
                  placeholder="Achternaam"
                  value={newCustomer.last_name}
                  onChange={(e) => setNewCustomer(p => ({ ...p, last_name: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail *</Label>
              <Input
                id="email"
                type="email"
                placeholder="email@voorbeeld.nl"
                value={newCustomer.email}
                onChange={(e) => setNewCustomer(p => ({ ...p, email: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Telefoon</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+31 6 12345678"
                value={newCustomer.phone}
                onChange={(e) => setNewCustomer(p => ({ ...p, phone: e.target.value }))}
              />
            </div>
            <div className="flex justify-between pt-2 border-t">
              <Button variant="ghost" onClick={() => setShowCreateForm(false)}>
                Terug
              </Button>
              <Button
                onClick={handleCreateCustomer}
                disabled={!newCustomer.first_name || !newCustomer.last_name || !newCustomer.email || createCustomer.isPending}
              >
                {createCustomer.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Aanmaken...</>
                ) : (
                  'Klant Aanmaken'
                )}
              </Button>
            </div>
          </div>
        ) : (
          /* Search & Select View */
          <>
            {/* Current Selection */}
            {selectedCustomer && (
              <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg border border-primary/20">
                <div className="flex items-center gap-3">
                  {selectedCustomer.customer_type === 'b2b' ? (
                    <Building2 className="h-5 w-5 text-primary" />
                  ) : (
                    <User className="h-5 w-5 text-primary" />
                  )}
                  <div>
                    <p className="font-medium">{getCustomerName(selectedCustomer)}</p>
                    <p className="text-sm text-muted-foreground">{selectedCustomer.email}</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={handleClear}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Zoek op naam, email of bedrijf..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
            </div>

            {/* Customer List */}
            <ScrollArea className="h-[300px] -mx-6 px-6">
              {isLoading ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <p>Laden...</p>
                </div>
              ) : filteredCustomers.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <User className="h-10 w-10 mb-2 opacity-50" />
                  <p>Geen klanten gevonden</p>
                  {searchQuery && (
                    <p className="text-sm">Probeer een andere zoekopdracht</p>
                  )}
                  <Button variant="outline" className="mt-4" onClick={() => setShowCreateForm(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nieuwe klant aanmaken
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredCustomers.map((customer) => (
                    <button
                      key={customer.id}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                        selectedCustomer?.id === customer.id
                          ? 'bg-primary/10 border border-primary/20'
                          : 'hover:bg-muted border border-transparent'
                      }`}
                      onClick={() => handleSelect(customer)}
                    >
                      {customer.customer_type === 'b2b' ? (
                        <Building2 className="h-5 w-5 text-muted-foreground shrink-0" />
                      ) : (
                        <User className="h-5 w-5 text-muted-foreground shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{getCustomerName(customer)}</p>
                          {customer.customer_type === 'b2b' && (
                            <Badge variant="secondary" className="text-xs shrink-0">B2B</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">{customer.email}</p>
                      </div>
                      {customer.total_orders && customer.total_orders > 0 && (
                        <Badge variant="outline" className="shrink-0">
                          {customer.total_orders} orders
                        </Badge>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Actions */}
            <div className="flex justify-between pt-2 border-t">
              <Button variant="ghost" onClick={handleClear} disabled={!selectedCustomer}>
                Zonder klant
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowCreateForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nieuwe klant
                </Button>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Sluiten
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
