import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, MoreHorizontal, Play, Pause, X, FileText, Calendar, Link2 } from 'lucide-react';
import { format } from 'date-fns';
import { nl, enUS, de, fr } from 'date-fns/locale';
import type { Locale } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useSubscriptions, useUpdateSubscriptionStatus, SubscriptionStatus } from '@/hooks/useSubscriptions';
import { SubscriptionFormDialog } from '@/components/admin/SubscriptionFormDialog';
import { useCustomerMandates, type CustomerMandate } from '@/hooks/useCustomerMandates';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const dateLocales: Record<string, Locale> = { nl, en: enUS, de, fr };

function formatCurrency(value: number) {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}

function getStatusBadgeVariant(status: SubscriptionStatus) {
  switch (status) {
    case 'active':
      return 'default';
    case 'paused':
      return 'secondary';
    case 'cancelled':
    case 'ended':
      return 'outline';
    default:
      return 'outline';
  }
}

function getIntervalLabel(interval: string, count: number, t: (key: string) => string) {
  const labels: Record<string, string> = {
    weekly: t('subscriptions.interval.weekly'),
    monthly: t('subscriptions.interval.monthly'),
    quarterly: t('subscriptions.interval.quarterly'),
    yearly: t('subscriptions.interval.yearly'),
  };
  return count > 1 ? `${count} ${labels[interval]}` : labels[interval];
}

export default function SubscriptionsPage() {
  const { t, i18n } = useTranslation();
  const locale = dateLocales[i18n.language] || enUS;
  
  const [statusFilter, setStatusFilter] = useState<SubscriptionStatus | 'all'>('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [mandateLoadingId, setMandateLoadingId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: subscriptions = [], isLoading } = useSubscriptions(
    statusFilter === 'all' ? undefined : { status: statusFilter }
  );
  const { data: mandates = [] } = useCustomerMandates();
  const mandateByCustomer = new Map<string, CustomerMandate>();
  for (const m of mandates) mandateByCustomer.set(m.customer_id, m);

  const updateStatus = useUpdateSubscriptionStatus();

  const handleStatusChange = (id: string, status: SubscriptionStatus) => {
    updateStatus.mutate({ id, status });
  };

  const handleEdit = (id: string) => {
    setEditingId(id);
    setIsFormOpen(true);
  };

  const handleClose = () => {
    setIsFormOpen(false);
    setEditingId(null);
  };

  const handleGenerateNow = async (id: string) => {
    setGeneratingId(id);
    try {
      const { data, error } = await supabase.functions.invoke(
        'generate-subscription-invoices',
        { body: { subscription_id: id } }
      );
      if (error) throw error;
      const created = Number(data?.created ?? 0);
      const skipped = Number(data?.skipped_existing ?? 0);
      const noLines = Number(data?.skipped_no_lines ?? 0);
      const failed = Array.isArray(data?.failed) ? data.failed.length : 0;
      let description = '';
      if (created > 0) description = t('subscriptions.generate_result.created');
      else if (skipped > 0) description = t('subscriptions.generate_result.skipped_existing');
      else if (noLines > 0) description = t('subscriptions.generate_result.no_lines');
      else if (failed > 0) description = data.failed[0]?.error ?? t('subscriptions.generate_result.error');
      else description = t('subscriptions.generate_result.skipped_existing');
      toast({
        title: t('subscriptions.actions.generate_now'),
        description,
        variant: failed > 0 ? 'destructive' : 'default',
      });
      await queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
    } catch (err: any) {
      toast({
        title: t('subscriptions.actions.generate_now'),
        description: err?.message ?? t('subscriptions.generate_result.error'),
        variant: 'destructive',
      });
    } finally {
      setGeneratingId(null);
    }
  };

  const handleCreateMandateLink = async (customerId: string) => {
    setMandateLoadingId(customerId);
    try {
      const { data, error } = await supabase.functions.invoke('create-mandate-setup', {
        body: { customer_id: customerId },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error ?? t('subscriptions.mandate.error'));
      const url: string = data.url;
      try {
        await navigator.clipboard.writeText(url);
      } catch (_) {
        // clipboard may fail on http; keep going
      }
      toast({
        title: t('subscriptions.mandate.link_created'),
        description: url,
      });
    } catch (err: any) {
      toast({
        title: t('subscriptions.mandate.error'),
        description: err?.message ?? String(err),
        variant: 'destructive',
      });
    } finally {
      setMandateLoadingId(null);
    }
  };

  function renderMandateBadge(customerId: string | null | undefined) {
    if (!customerId) return null;
    const m = mandateByCustomer.get(customerId);
    if (!m || m.status === 'revoked') {
      return (
        <Badge variant="outline" className="text-muted-foreground">
          {t('subscriptions.mandate.badge.none')}
        </Badge>
      );
    }
    if (m.status === 'active') {
      return (
        <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800">
          {t('subscriptions.mandate.badge.active')}
        </Badge>
      );
    }
    if (m.status === 'failed') {
      return <Badge variant="destructive">{t('subscriptions.mandate.badge.failed')}</Badge>;
    }
    return <Badge variant="secondary">{t('subscriptions.mandate.badge.pending')}</Badge>;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t('subscriptions.title')}</h1>
          <p className="text-muted-foreground">
            {t('subscriptions.description')}
          </p>
        </div>
        <Button onClick={() => setIsFormOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t('subscriptions.create')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle>{t('subscriptions.title')}</CardTitle>
              <CardDescription>
                {subscriptions.length} {t('subscriptions.active_count')}
              </CardDescription>
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as SubscriptionStatus | 'all')}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder={t('common.status')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common.all')}</SelectItem>
                <SelectItem value="active">{t('subscriptions.status.active')}</SelectItem>
                <SelectItem value="paused">{t('subscriptions.status.paused')}</SelectItem>
                <SelectItem value="cancelled">{t('subscriptions.status.cancelled')}</SelectItem>
                <SelectItem value="ended">{t('subscriptions.status.ended')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('subscriptions.customer')}</TableHead>
                <TableHead>{t('subscriptions.name')}</TableHead>
                <TableHead>{t('common.total')}</TableHead>
                <TableHead className="hidden sm:table-cell">{t('subscriptions.billing_cycle')}</TableHead>
                <TableHead className="hidden sm:table-cell">{t('subscriptions.next_invoice')}</TableHead>
                <TableHead className="hidden lg:table-cell">{t('subscriptions.mandate.column')}</TableHead>
                <TableHead>{t('common.status')}</TableHead>
                <TableHead className="w-[70px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscriptions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    {t('common.noResults')}
                  </TableCell>
                </TableRow>
              ) : (
                subscriptions.map((sub) => (
                  <TableRow key={sub.id}>
                   <TableCell className="font-medium max-w-[120px] sm:max-w-[180px] truncate">
                      {sub.customer?.company_name || 
                        `${sub.customer?.first_name || ''} ${sub.customer?.last_name || ''}`.trim() ||
                        sub.customer?.email}
                    </TableCell>
                    <TableCell className="max-w-[120px] sm:max-w-[180px] truncate">{sub.name}</TableCell>
                    <TableCell>{formatCurrency(sub.total)}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {getIntervalLabel(sub.interval, sub.interval_count, t)}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {sub.next_invoice_date && sub.status === 'active' ? (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {format(new Date(sub.next_invoice_date), 'dd MMM yyyy', { locale })}
                        </div>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {renderMandateBadge(sub.customer_id)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(sub.status)}>
                        {t(`subscriptions.status.${sub.status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" side="bottom" collisionPadding={12}>
                          <DropdownMenuItem onClick={() => handleEdit(sub.id)}>
                            {t('common.edit')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={generatingId === sub.id || sub.status !== 'active'}
                            onSelect={(e) => {
                              e.preventDefault();
                              handleGenerateNow(sub.id);
                            }}
                          >
                            {generatingId === sub.id ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <FileText className="h-4 w-4 mr-2" />
                            )}
                            {t('subscriptions.actions.generate_now')}
                          </DropdownMenuItem>
                          {sub.customer_id && (
                            <DropdownMenuItem
                              disabled={mandateLoadingId === sub.customer_id}
                              onSelect={(e) => {
                                e.preventDefault();
                                handleCreateMandateLink(sub.customer_id!);
                              }}
                            >
                              {mandateLoadingId === sub.customer_id ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <Link2 className="h-4 w-4 mr-2" />
                              )}
                              {t('subscriptions.mandate.create_link')}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          {sub.status === 'active' && (
                            <DropdownMenuItem onClick={() => handleStatusChange(sub.id, 'paused')}>
                              <Pause className="h-4 w-4 mr-2" />
                              {t('subscriptions.actions.pause')}
                            </DropdownMenuItem>
                          )}
                          {sub.status === 'paused' && (
                            <DropdownMenuItem onClick={() => handleStatusChange(sub.id, 'active')}>
                              <Play className="h-4 w-4 mr-2" />
                              {t('subscriptions.actions.resume')}
                            </DropdownMenuItem>
                          )}
                          {(sub.status === 'active' || sub.status === 'paused') && (
                            <DropdownMenuItem 
                              className="text-destructive"
                              onClick={() => handleStatusChange(sub.id, 'cancelled')}
                            >
                              <X className="h-4 w-4 mr-2" />
                              {t('subscriptions.actions.cancel')}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      <SubscriptionFormDialog
        open={isFormOpen}
        onOpenChange={handleClose}
        subscriptionId={editingId}
      />
    </div>
  );
}
