import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { 
  ArrowLeft, 
  Mail, 
  Phone, 
  MapPin, 
  Building2, 
  ShoppingBag, 
  MessageSquare,
  User,
  Calendar,
  Edit,
  Trash2,
  ExternalLink
} from 'lucide-react';
import { useCustomer, useCustomerOrders } from '@/hooks/useCustomers';
import { useCustomerConversations } from '@/hooks/useCustomerConversations';
import { useTenant } from '@/hooks/useTenant';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { formatCurrency } from '@/lib/utils';

export default function CustomerDetailPage() {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const { currentTenant } = useTenant();
  const { customer, isLoading, error } = useCustomer(customerId);
  const { orders, isLoading: ordersLoading } = useCustomerOrders(customerId);
  const { conversations, isLoading: conversationsLoading } = useCustomerConversations(customerId);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[200px] w-full" />
        <Skeleton className="h-[300px] w-full" />
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate('/admin/customers')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Terug naar klanten
        </Button>
        <Alert variant="destructive">
          <AlertDescription>
            Klant niet gevonden. Deze klant bestaat mogelijk niet meer.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const fullName = [customer.first_name, customer.last_name].filter(Boolean).join(' ') || 'Onbekend';
  const initials = (customer.first_name?.[0] || customer.email[0]).toUpperCase();
  const currency = currentTenant?.currency || 'EUR';

  // Customer type badge
  const getTypeBadge = () => {
    switch (customer.customer_type) {
      case 'prospect':
        return <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">Prospect</Badge>;
      case 'b2b':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">B2B</Badge>;
      default:
        return <Badge variant="secondary">B2C</Badge>;
    }
  };

  const hasAddress = customer.billing_street || customer.billing_city || customer.billing_country;

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button variant="ghost" onClick={() => navigate('/admin/customers')}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Terug naar klanten
      </Button>

      {/* Header Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-6">
            {/* Avatar */}
            <Avatar className="h-20 w-20">
              <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>

            {/* Info */}
            <div className="flex-1 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-2xl font-semibold">{fullName}</h1>
                    {getTypeBadge()}
                    {customer.company_name && (
                      <Badge variant="outline" className="gap-1">
                        <Building2 className="h-3 w-3" />
                        {customer.company_name}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-muted-foreground text-sm flex-wrap">
                    <span className="flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5" />
                      {customer.email}
                    </span>
                    {customer.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5" />
                        {customer.phone}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      Klant sinds {format(new Date(customer.created_at), 'd MMM yyyy', { locale: nl })}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled>
                    <Edit className="h-4 w-4 mr-1" />
                    Bewerken
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t">
            <div className="text-center">
              <div className="text-2xl font-semibold">{formatCurrency(Number(customer.total_spent || 0), currency)}</div>
              <div className="text-sm text-muted-foreground">Totaal uitgegeven</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-semibold">{customer.total_orders || 0}</div>
              <div className="text-sm text-muted-foreground">Bestellingen</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-semibold">{conversations?.length || 0}</div>
              <div className="text-sm text-muted-foreground">Gesprekken</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="orders" className="space-y-4">
        <TabsList>
          <TabsTrigger value="orders" className="gap-2">
            <ShoppingBag className="h-4 w-4" />
            Bestellingen
          </TabsTrigger>
          <TabsTrigger value="conversations" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Gesprekken
          </TabsTrigger>
          <TabsTrigger value="details" className="gap-2">
            <User className="h-4 w-4" />
            Gegevens
          </TabsTrigger>
        </TabsList>

        {/* Orders Tab */}
        <TabsContent value="orders">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Bestellingen</CardTitle>
              <CardDescription>{orders?.length || 0} bestelling(en)</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto px-0 sm:px-6">
              {ordersLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : orders?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ShoppingBag className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Geen bestellingen gevonden</p>
                  {customer.customer_type === 'prospect' && (
                    <p className="text-sm mt-2">Deze prospect heeft nog geen bestelling geplaatst.</p>
                  )}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bestelnummer</TableHead>
                      <TableHead>Datum</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Totaal</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders?.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">{order.order_number}</TableCell>
                        <TableCell>{format(new Date(order.created_at), 'd MMM yyyy', { locale: nl })}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{order.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(order.total, currency)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" asChild>
                            <Link to={`/admin/orders/${order.id}`}>
                              <ExternalLink className="h-4 w-4" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Conversations Tab */}
        <TabsContent value="conversations">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Gesprekken</CardTitle>
              <CardDescription>{conversations?.length || 0} gesprek(ken)</CardDescription>
            </CardHeader>
            <CardContent>
              {conversationsLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : conversations?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Geen gesprekken gevonden</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {conversations?.map((conversation) => (
                    <Link
                      key={conversation.id}
                      to={`/admin/messages?conversation=${conversation.id}`}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{conversation.subject || '(Geen onderwerp)'}</div>
                          <div className="text-sm text-muted-foreground">
                            {conversation.message_count} bericht(en)
                          </div>
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(conversation.last_message_at), 'd MMM yyyy', { locale: nl })}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Details Tab */}
        <TabsContent value="details">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Contact Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Contactgegevens</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-sm text-muted-foreground">E-mail</div>
                  <div>{customer.email}</div>
                </div>
                {customer.phone && (
                  <div>
                    <div className="text-sm text-muted-foreground">Telefoon</div>
                    <div>{customer.phone}</div>
                  </div>
                )}
                {customer.company_name && (
                  <div>
                    <div className="text-sm text-muted-foreground">Bedrijf</div>
                    <div>{customer.company_name}</div>
                  </div>
                )}
                {customer.vat_number && (
                  <div>
                    <div className="text-sm text-muted-foreground">BTW-nummer</div>
                    <div className="flex items-center gap-2">
                      {customer.vat_number}
                      {customer.vat_verified && (
                        <Badge variant="secondary" className="text-xs">Geverifieerd</Badge>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Address */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Factuuradres</CardTitle>
              </CardHeader>
              <CardContent>
                {hasAddress ? (
                  <div className="space-y-1">
                    {customer.billing_street && <div>{customer.billing_street}</div>}
                    <div>
                      {[customer.billing_postal_code, customer.billing_city].filter(Boolean).join(' ')}
                    </div>
                    {customer.billing_country && <div>{customer.billing_country}</div>}
                  </div>
                ) : (
                  <div className="text-muted-foreground text-sm">
                    Geen adres bekend
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Notes */}
            {customer.notes && (
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Notities</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{customer.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
