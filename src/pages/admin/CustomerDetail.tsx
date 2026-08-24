import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { format } from 'date-fns';
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
  ExternalLink,
  UserPlus,
  Loader2,
  Activity,
  Wallet
} from 'lucide-react';
import { useCustomer, useCustomerOrders, useCustomers } from '@/hooks/useCustomers';
import { useCustomerConversations } from '@/hooks/useCustomerConversations';
import { useTenant } from '@/hooks/useTenant';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { formatCurrency } from '@/lib/utils';
import { CustomerSelectDialog } from '@/components/admin/CustomerSelectDialog';
import { CustomerFormDialog } from '@/components/admin/CustomerFormDialog';
import { CustomerActivityTab } from '@/components/admin/customers/CustomerActivityTab';
import { CustomerLedgerTab } from '@/components/admin/customers/CustomerLedgerTab';
import { useAuth } from '@/hooks/useAuth';
import type { Customer } from '@/types/order';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useTranslation } from 'react-i18next';
import { useDateFnsLocale } from '@/hooks/useDateFnsLocale';

export default function CustomerDetailPage() {
  const { t } = useTranslation();
  const dateLocale = useDateFnsLocale();
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const { currentTenant } = useTenant();
  const { isPlatformAdmin } = useAuth();
  const { customer, isLoading, error } = useCustomer(customerId);
  const { orders, isLoading: ordersLoading } = useCustomerOrders(customerId);
  const { conversations, isLoading: conversationsLoading } = useCustomerConversations(customerId);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const { createCustomer, updateCustomer } = useCustomers();

  // Query customer_messages for from_email when customer not found
  const { data: messageData } = useQuery({
    queryKey: ['customer-message-lookup', customerId, currentTenant?.id],
    queryFn: async () => {
      if (!customerId || !currentTenant?.id) return null;
      const { data } = await supabase
        .from('customer_messages')
        .select('from_email, context_data')
        .eq('customer_id', customerId)
        .eq('tenant_id', currentTenant.id)
        .eq('direction', 'inbound')
        .order('created_at', { ascending: false })
        .limit(1);
      return data?.[0] || null;
    },
    enabled: !!customerId && !!currentTenant?.id && !isLoading && !customer,
  });

  const handleDirectCreate = async () => {
    if (!messageData?.from_email || !currentTenant?.id) return;
    setIsCreating(true);
    try {
      // Try to extract name from context_data or from_email
      const contextData = messageData.context_data as Record<string, unknown> | null;
      const senderName = (contextData?.sender_name as string) || (contextData?.from_name as string) || '';
      const nameParts = senderName.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      const result = await createCustomer.mutateAsync({
        customer_type: 'prospect',
        first_name: firstName,
        last_name: lastName,
        email: messageData.from_email,
      });
      navigate(`/admin/customers/${result.id}`);
    } catch {
      // Error toast is handled by useCustomers hook
    } finally {
      setIsCreating(false);
    }
  };

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
          {t('admin.customerDetail.terug_naar_klanten')}
        </Button>
        <Alert variant="destructive">
          <AlertDescription>
            {t('admin.customerDetail.klant_nog_niet_in_klantenbestand_of')}
          </AlertDescription>
        </Alert>
        {messageData?.from_email ? (
          <Button onClick={handleDirectCreate} disabled={isCreating}>
            {isCreating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4 mr-2" />
            )}
            Toevoegen: {messageData.from_email}
          </Button>
        ) : (
          <>
            <Button onClick={() => setShowCreateDialog(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              {t('admin.customerDetail.toevoegen_aan_klantenbestand')}
            </Button>
            <CustomerSelectDialog
              open={showCreateDialog}
              onOpenChange={setShowCreateDialog}
              onSelect={(newCustomer: Customer) => {
                navigate(`/admin/customers/${newCustomer.id}`);
              }}
            />
          </>
        )}
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
        return <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">{t('admin.customers.prospect')}</Badge>;
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
        {t('admin.customerDetail.terug_naar_klanten')}
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
                      Klant sinds {format(new Date(customer.created_at), 'd MMM yyyy', { locale: dateLocale })}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                    <Edit className="h-4 w-4 mr-1" />
                    {t('common.edit')}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t">
            <div className="text-center">
              <div className="text-2xl font-semibold">{formatCurrency(Number(customer.total_spent || 0), currency)}</div>
              <div className="text-sm text-muted-foreground">{t('admin.giftCards.totaal_uitgegeven')}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-semibold">{customer.total_orders || 0}</div>
              <div className="text-sm text-muted-foreground">{t('admin.customers.bestellingen')}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-semibold">{conversations?.length || 0}</div>
              <div className="text-sm text-muted-foreground">{t('admin.customerDetail.gesprekken')}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="orders" className="space-y-4">
        <TabsList>
          <TabsTrigger value="orders" className="gap-2">
            <ShoppingBag className="h-4 w-4" />
            {t('admin.customers.bestellingen')}
          </TabsTrigger>
          <TabsTrigger value="conversations" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            {t('admin.customerDetail.gesprekken')}
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-2">
            <Activity className="h-4 w-4" />
            {t('admin.customerDetail.activiteit')}
          </TabsTrigger>
          <TabsTrigger value="details" className="gap-2">
            <User className="h-4 w-4" />
            {t('admin.customerDetail.gegevens')}
          </TabsTrigger>
          {isPlatformAdmin && (
            <TabsTrigger value="ledger" className="gap-2">
              <Wallet className="h-4 w-4" />
              {t('admin.giftCards.saldo')}
            </TabsTrigger>
          )}
        </TabsList>

        {/* Orders Tab */}
        <TabsContent value="orders">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('admin.customers.bestellingen')}</CardTitle>
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
                  <p>{t('admin.customerDetail.geen_bestellingen_gevonden')}</p>
                  {customer.customer_type === 'prospect' && (
                    <p className="text-sm mt-2">{t('admin.customerDetail.deze_prospect_heeft_nog_geen_bestelling')}</p>
                  )}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('admin.customerDetail.bestelnummer')}</TableHead>
                      <TableHead>{t('common.date')}</TableHead>
                      <TableHead>{t('common.status')}</TableHead>
                      <TableHead className="text-right">{t('common.total')}</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders?.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">{order.order_number}</TableCell>
                        <TableCell>{format(new Date(order.created_at), 'd MMM yyyy', { locale: dateLocale })}</TableCell>
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
              <CardTitle className="text-base">{t('admin.customerDetail.gesprekken_2')}</CardTitle>
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
                  <p>{t('admin.customerDetail.geen_gesprekken_gevonden')}</p>
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
                        {format(new Date(conversation.last_message_at), 'd MMM yyyy', { locale: dateLocale })}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity">
          <CustomerActivityTab customerId={customerId} />
        </TabsContent>

        {/* Details Tab */}
        <TabsContent value="details">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Contact Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('admin.customerDetail.contactgegevens')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-sm text-muted-foreground">E-mail</div>
                  <div>{customer.email}</div>
                </div>
                {customer.phone && (
                  <div>
                    <div className="text-sm text-muted-foreground">{t('common.phone')}</div>
                    <div>{customer.phone}</div>
                  </div>
                )}
                {customer.company_name && (
                  <div>
                    <div className="text-sm text-muted-foreground">{t('admin.marketing.variableInserter.groups.company.label')}</div>
                    <div>{customer.company_name}</div>
                  </div>
                )}
                {customer.vat_number && (
                  <div>
                    <div className="text-sm text-muted-foreground">BTW-nummer</div>
                    <div className="flex items-center gap-2">
                      {customer.vat_number}
                      {customer.vat_verified && (
                        <Badge variant="secondary" className="text-xs">{t('admin.customerDetail.geverifieerd')}</Badge>
                      )}
                    </div>
                  </div>
                )}
                <div className="pt-2 border-t">
                  <Label className="text-sm text-muted-foreground">{t('admin.customerDetail.voorkeurstaal')}</Label>
                  <Select
                    value={(customer as any).preferred_language || 'none'}
                    onValueChange={(val) => {
                      if (!customerId) return;
                      updateCustomer.mutate({
                        customerId,
                        data: { preferred_language: val === 'none' ? null : val } as any,
                      });
                    }}
                  >
                    <SelectTrigger className="w-full mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('admin.customerDetail.geen_voorkeur_tenant_standaard')}</SelectItem>
                      <SelectItem value="nl">{t('admin.marketing.segmentBuilder.nederlands')}</SelectItem>
                      <SelectItem value="en">{t('admin.marketing.segmentBuilder.english')}</SelectItem>
                      <SelectItem value="fr">{t('admin.marketing.segmentBuilder.francais')}</SelectItem>
                      <SelectItem value="de">{t('admin.marketing.segmentBuilder.deutsch')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Address */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('admin.customerDetail.factuuradres')}</CardTitle>
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
                    {t('admin.customerDetail.geen_adres_bekend')}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Notes */}
            {customer.notes && (
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">{t('admin.customerDetail.notities')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{customer.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
        {isPlatformAdmin && (
          <TabsContent value="ledger">
            <CustomerLedgerTab customerId={customerId} />
          </TabsContent>
        )}
      </Tabs>

      <CustomerFormDialog
        mode="edit"
        customer={customer}
        open={editOpen}
        onOpenChange={setEditOpen}
        isLoading={updateCustomer.isPending}
        onSubmit={(data) => {
          if (!customerId) return;
          updateCustomer.mutate(
            { customerId, data: data as Partial<Customer> },
            { onSuccess: () => setEditOpen(false) }
          );
        }}
      />
    </div>
  );
}
