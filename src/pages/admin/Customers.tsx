import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Search, Mail, Phone, ShoppingBag, MoreHorizontal, Eye, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { useCustomers } from '@/hooks/useCustomers';
import { useTenant } from '@/hooks/useTenant';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import type { Customer } from '@/types/order';

export default function CustomersPage() {
  const navigate = useNavigate();
  const { currentTenant, loading: tenantLoading } = useTenant();
  const [search, setSearch] = useState('');
  const { customers, isLoading, deleteCustomer } = useCustomers(search);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: currentTenant?.currency || 'EUR',
    }).format(amount);
  };

  if (tenantLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!currentTenant) {
    return (
      <Alert>
        <AlertDescription>Geen winkel gevonden. Neem contact op met een beheerder.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Klanten</h1>
          <p className="text-muted-foreground">Beheer je klantenbestand</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Zoek op naam of email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Customers Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Alle klanten
          </CardTitle>
          <CardDescription>
            {customers.length} klant{customers.length !== 1 ? 'en' : ''} gevonden
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : customers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-medium text-lg">Geen klanten gevonden</h3>
              <p className="text-muted-foreground text-sm">
                {search 
                  ? 'Probeer een andere zoekopdracht' 
                  : 'Klanten worden toegevoegd wanneer ze een bestelling plaatsen'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Klant</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead className="text-center">Bestellingen</TableHead>
                  <TableHead className="text-right">Uitgegeven</TableHead>
                  <TableHead>Sinds</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => (
                  <CustomerRow
                    key={customer.id}
                    customer={customer}
                    onDelete={() => deleteCustomer.mutate(customer.id)}
                    formatCurrency={formatCurrency}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface CustomerRowProps {
  customer: Customer;
  onDelete: () => void;
  formatCurrency: (amount: number) => string;
}

function CustomerRow({ customer, onDelete, formatCurrency }: CustomerRowProps) {
  const fullName = [customer.first_name, customer.last_name].filter(Boolean).join(' ') || 'Onbekend';

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-sm font-medium text-primary">
              {(customer.first_name?.[0] || customer.email[0]).toUpperCase()}
            </span>
          </div>
          <div>
            <div className="font-medium">{fullName}</div>
            <div className="text-sm text-muted-foreground">{customer.email}</div>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-1 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Mail className="h-3 w-3" />
            {customer.email}
          </div>
          {customer.phone && (
            <div className="flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {customer.phone}
            </div>
          )}
        </div>
      </TableCell>
      <TableCell className="text-center">
        <div className="flex items-center justify-center gap-1">
          <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{customer.total_orders}</span>
        </div>
      </TableCell>
      <TableCell className="text-right font-medium">
        {formatCurrency(Number(customer.total_spent))}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {format(new Date(customer.created_at), 'd MMM yyyy', { locale: nl })}
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled>
              <Eye className="h-4 w-4 mr-2" />
              Bekijken
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <DropdownMenuItem 
                  className="text-destructive focus:text-destructive"
                  onSelect={(e) => e.preventDefault()}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Verwijderen
                </DropdownMenuItem>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Klant verwijderen?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Weet je zeker dat je deze klant wilt verwijderen? Dit kan niet ongedaan worden gemaakt.
                    Bestellingen van deze klant blijven behouden.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuleren</AlertDialogCancel>
                  <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Verwijderen
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}
