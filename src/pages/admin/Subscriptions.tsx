import { useState } from 'react';
import { useIsCompact } from '@/hooks/use-mobile';
import { useTranslation } from 'react-i18next';
import { Plus, MoreHorizontal, Play, Pause, X, FileText, Calendar } from 'lucide-react';
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
  const isCompact = useIsCompact();
  const { t, i18n } = useTranslation();
  const locale = dateLocales[i18n.language] || enUS;
  
  const [statusFilter, setStatusFilter] = useState<SubscriptionStatus | 'all'>('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: subscriptions = [], isLoading } = useSubscriptions(
    statusFilter === 'all' ? undefined : { status: statusFilter }
  );
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
          {isCompact ? (
            <div className="space-y-2 px-3">
              {subscriptions.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">{t('common.noResults')}</p>
              ) : (
                subscriptions.map((sub) => (
                  <div
                    key={sub.id}
                    className="rounded-lg border bg-card p-3 cursor-pointer active:bg-muted/50"
                    onClick={() => handleEdit(sub.id)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium truncate">{sub.name}</span>
                      <Badge variant={getStatusBadgeVariant(sub.status)}>
                        {t(`subscriptions.status.${sub.status}`)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 truncate">
                      {sub.customer?.company_name || 
                        `${sub.customer?.first_name || ''} ${sub.customer?.last_name || ''}`.trim() ||
                        sub.customer?.email}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-sm text-muted-foreground">
                        {getIntervalLabel(sub.interval, sub.interval_count, t)}
                      </span>
                      <span className="font-medium">{formatCurrency(sub.total)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
          <div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('subscriptions.customer')}</TableHead>
                <TableHead>{t('subscriptions.name')}</TableHead>
                <TableHead>{t('common.total')}</TableHead>
                <TableHead className="hidden sm:table-cell">{t('subscriptions.billing_cycle')}</TableHead>
                <TableHead className="hidden sm:table-cell">{t('subscriptions.next_invoice')}</TableHead>
                <TableHead>{t('common.status')}</TableHead>
                <TableHead className="w-[70px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscriptions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    {t('common.noResults')}
                  </TableCell>
                </TableRow>
              ) : (
                subscriptions.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell className="font-medium max-w-[150px] truncate">
                      {sub.customer?.company_name || 
                        `${sub.customer?.first_name || ''} ${sub.customer?.last_name || ''}`.trim() ||
                        sub.customer?.email}
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate">{sub.name}</TableCell>
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
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(sub.id)}>
                            {t('common.edit')}
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <FileText className="h-4 w-4 mr-2" />
                            {t('subscriptions.actions.generate_now')}
                          </DropdownMenuItem>
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
          )}
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
