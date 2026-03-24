import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { Users, Mail, Shield, ShieldOff, Search, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

export default function StorefrontAccounts() {
  const { currentTenant } = useTenant();
  const [search, setSearch] = useState('');

  const { data: accounts, isLoading } = useQuery({
    queryKey: ['storefront-accounts', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      const { data, error } = await (supabase as any)
        .from('storefront_customers')
        .select('id, email, first_name, last_name, phone, is_active, created_at, last_login_at, newsletter_opted_in, company_name, vat_number, vat_verified')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentTenant?.id,
  });

  // Link to CRM customers
  const { data: customerLinks } = useQuery({
    queryKey: ['storefront-customer-links', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return {};
      const { data } = await supabase
        .from('customers')
        .select('id, storefront_customer_id')
        .eq('tenant_id', currentTenant.id)
        .not('storefront_customer_id', 'is', null);
      const map: Record<string, string> = {};
      (data || []).forEach((c: any) => { if (c.storefront_customer_id) map[c.storefront_customer_id] = c.id; });
      return map;
    },
    enabled: !!currentTenant?.id,
  });

  const filtered = (accounts || []).filter((a: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      a.email?.toLowerCase().includes(q) ||
      a.first_name?.toLowerCase().includes(q) ||
      a.last_name?.toLowerCase().includes(q) ||
      a.company_name?.toLowerCase().includes(q)
    );
  });

  const stats = {
    total: accounts?.length || 0,
    active: accounts?.filter((a: any) => a.is_active)?.length || 0,
    newsletter: accounts?.filter((a: any) => a.newsletter_opted_in)?.length || 0,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Webshop Accounts</h1>
        <p className="text-muted-foreground">Overzicht van alle klantaccounts op je webshop</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-primary" />
              <div>
                <div className="text-2xl font-semibold">{stats.total}</div>
                <div className="text-sm text-muted-foreground">Totaal accounts</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Shield className="h-8 w-8 text-green-600" />
              <div>
                <div className="text-2xl font-semibold">{stats.active}</div>
                <div className="text-sm text-muted-foreground">Actieve accounts</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Mail className="h-8 w-8 text-blue-600" />
              <div>
                <div className="text-2xl font-semibold">{stats.newsletter}</div>
                <div className="text-sm text-muted-foreground">Nieuwsbrief opt-in</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Klantaccounts</CardTitle>
              <CardDescription>{filtered.length} account(s)</CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Zoek op naam of e-mail..."
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0 sm:px-6">
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Geen webshop accounts gevonden</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Naam</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Bedrijf</TableHead>
                  <TableHead>Nieuwsbrief</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Geregistreerd</TableHead>
                  <TableHead>Laatste login</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((account: any) => {
                  const crmId = customerLinks?.[account.id];
                  return (
                    <TableRow key={account.id}>
                      <TableCell className="font-medium">
                        {[account.first_name, account.last_name].filter(Boolean).join(' ') || '—'}
                      </TableCell>
                      <TableCell>{account.email}</TableCell>
                      <TableCell>
                        {account.company_name ? (
                          <div className="flex items-center gap-1">
                            <span className="text-sm">{account.company_name}</span>
                            {account.vat_verified && (
                              <Badge variant="secondary" className="text-xs">VIES ✓</Badge>
                            )}
                          </div>
                        ) : '—'}
                      </TableCell>
                      <TableCell>
                        {account.newsletter_opted_in ? (
                          <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Ja</Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">Nee</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {account.is_active ? (
                          <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Actief</Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">Inactief</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(account.created_at), 'd MMM yyyy', { locale: nl })}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {account.last_login_at
                          ? format(new Date(account.last_login_at), 'd MMM yyyy', { locale: nl })
                          : '—'}
                      </TableCell>
                      <TableCell>
                        {crmId && (
                          <Button variant="ghost" size="icon" asChild>
                            <Link to={`/admin/customers/${crmId}`}>
                              <ExternalLink className="h-4 w-4" />
                            </Link>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
