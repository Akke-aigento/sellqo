import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { Download, Loader2, MoreHorizontal, Search, ShieldOff, UserMinus, UserPlus, Upload } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/hooks/useTenant';
import { useCan, useScopedRoles } from '@/hooks/useCan';
import { useDateFnsLocale } from '@/hooks/useDateFnsLocale';
import { toCsv, downloadCsv } from '@/lib/csvExport';
import { cn } from '@/lib/utils';
import {
  CONTACTS_PAGE_SIZE, fetchAllMarketingContacts, parseEmailList, useMarketingContactActions,
  useMarketingContactCounts, useMarketingContacts,
  type ContactStatus, type ContactStatusFilter, type MarketingContact,
} from '@/hooks/useMarketingContacts';

/**
 * MAIL-1b — tab "Abonnees" in Marketing → E-mail.
 *
 * Toestemming komt enkel van de persoon zelf: er is geen knop om iemand op
 * "ingeschreven" te zetten. "Uitnodigen" stuurt een bevestigingsmail (double opt-in).
 */
const STATUS_FILTERS: { id: ContactStatusFilter; labelKey: string }[] = [
  { id: 'all', labelKey: 'admin.marketing.subscribers.status.all' },
  { id: 'subscribed', labelKey: 'admin.marketing.subscribers.status.subscribed' },
  { id: 'pending', labelKey: 'admin.marketing.subscribers.status.pending' },
  { id: 'unsubscribed', labelKey: 'admin.marketing.subscribers.status.unsubscribed' },
  { id: 'bounced', labelKey: 'admin.marketing.subscribers.status.bounced' },
  { id: 'complaint', labelKey: 'admin.marketing.subscribers.status.complaint' },
];

const STATUS_VARIANT: Record<ContactStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  subscribed: 'default',
  pending: 'secondary',
  unsubscribed: 'outline',
  bounced: 'destructive',
  complaint: 'destructive',
};

const MAX_INVITE = 500;

function useDebouncedValue<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

export function SubscribersTab() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const { currentTenant } = useTenant();
  const dateLocale = useDateFnsLocale();
  const canWrite = useCan('write', 'marketing');
  const roles = useScopedRoles() ?? [];
  const isTenantAdmin = roles.includes('tenant_admin') || roles.includes('platform_admin');

  const [status, setStatus] = useState<ContactStatusFilter>('all');
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput.trim(), 300);
  const [page, setPage] = useState(0);
  useEffect(() => { setPage(0); }, [status, search]);

  const { data, isLoading, isFetching } = useMarketingContacts({ status, search, page });
  const { data: counts } = useMarketingContactCounts();
  const { unsubscribe, erase, invite } = useMarketingContactActions();

  const [confirmUnsub, setConfirmUnsub] = useState<MarketingContact | null>(null);
  const [confirmErase, setConfirmErase] = useState<MarketingContact | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / CONTACTS_PAGE_SIZE));
  const allCount = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : undefined;

  const statusLabel = (s: ContactStatus) => t(`admin.marketing.subscribers.status.${s}`);
  const sourceLabel = (s: string | null) => {
    if (!s) return '—';
    const key = `admin.marketing.subscribers.source.${s}`;
    return i18n.exists(key) ? t(key) : s;
  };
  const fmtDate = (d: string | null) => (d ? format(new Date(d), 'd MMM yyyy', { locale: dateLocale }) : '—');

  const handleExport = async () => {
    if (!currentTenant?.id) return;
    setExporting(true);
    try {
      const all = await fetchAllMarketingContacts(currentTenant.id, status, search);
      const csv = toCsv(
        [
          t('admin.marketing.subscribers.col.email'),
          t('admin.marketing.subscribers.col.name'),
          t('admin.marketing.subscribers.col.status'),
          t('admin.marketing.subscribers.col.source'),
          t('admin.marketing.subscribers.col.date'),
        ],
        all.map((r) => [r.email, r.name, statusLabel(r.status), sourceLabel(r.source), r.status_at ? r.status_at.slice(0, 10) : '']),
      );
      downloadCsv(`abonnees-${status}-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    } catch (e) {
      toast({ title: t('admin.marketing.subscribers.toast.export_failed'), description: (e as Error).message, variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  const doUnsubscribe = () => {
    if (!confirmUnsub) return;
    const email = confirmUnsub.email;
    unsubscribe.mutate(email, {
      onSuccess: () => toast({ title: t('admin.marketing.subscribers.toast.unsubscribed', { email }) }),
      onError: (e) => toast({ title: t('admin.marketing.subscribers.toast.action_failed'), description: (e as Error).message, variant: 'destructive' }),
      onSettled: () => setConfirmUnsub(null),
    });
  };

  const doErase = () => {
    if (!confirmErase) return;
    const email = confirmErase.email;
    erase.mutate(email, {
      onSuccess: () => toast({ title: t('admin.marketing.subscribers.toast.erased', { email }) }),
      onError: (e) => toast({ title: t('admin.marketing.subscribers.toast.action_failed'), description: (e as Error).message, variant: 'destructive' }),
      onSettled: () => setConfirmErase(null),
    });
  };

  return (
    <div className="space-y-4">
      {/* Filters per status, met aantallen */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => {
          const n = f.id === 'all' ? allCount : counts?.[f.id as ContactStatus];
          return (
            <Button
              key={f.id}
              type="button"
              size="sm"
              variant={status === f.id ? 'default' : 'outline'}
              onClick={() => setStatus(f.id)}
              className="gap-2"
            >
              {t(f.labelKey)}
              {n !== undefined && <span className={cn('text-xs', status === f.id ? 'opacity-80' : 'text-muted-foreground')}>{n}</span>}
            </Button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:w-80">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder={t('admin.marketing.subscribers.search_placeholder')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={handleExport} disabled={exporting || total === 0}>
            {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            {t('admin.marketing.subscribers.export_csv')}
          </Button>
          {canWrite && (
            <Button type="button" onClick={() => setInviteOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              {t('admin.marketing.subscribers.invite')}
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-10 text-center text-muted-foreground">{t('common.loading')}</div>
          ) : rows.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              {search ? t('admin.marketing.subscribers.empty_search') : t('admin.marketing.subscribers.empty')}
            </div>
          ) : (
            <div className={cn('overflow-x-auto', isFetching && 'opacity-70')}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('admin.marketing.subscribers.col.email')}</TableHead>
                    <TableHead className="hidden md:table-cell">{t('admin.marketing.subscribers.col.name')}</TableHead>
                    <TableHead>{t('admin.marketing.subscribers.col.status')}</TableHead>
                    <TableHead className="hidden lg:table-cell">{t('admin.marketing.subscribers.col.source')}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t('admin.marketing.subscribers.col.date')}</TableHead>
                    <TableHead className="w-10"><span className="sr-only">{t('admin.marketing.subscribers.col.actions')}</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const canUnsub = canWrite && (r.status === 'subscribed' || r.status === 'pending');
                    const canErase = isTenantAdmin && r.source !== 'gdpr_erasure';
                    return (
                      <TableRow key={`${r.status}-${r.email}`}>
                        <TableCell className="font-medium break-all">{r.email}</TableCell>
                        <TableCell className="hidden md:table-cell">{r.name || '—'}</TableCell>
                        <TableCell><Badge variant={STATUS_VARIANT[r.status]}>{statusLabel(r.status)}</Badge></TableCell>
                        <TableCell className="hidden lg:table-cell text-muted-foreground">{sourceLabel(r.source)}</TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground">{fmtDate(r.status_at)}</TableCell>
                        <TableCell>
                          {(canUnsub || canErase) && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label={t('admin.marketing.subscribers.col.actions')}>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {canUnsub && (
                                  <DropdownMenuItem onClick={() => setConfirmUnsub(r)}>
                                    <UserMinus className="mr-2 h-4 w-4" />
                                    {t('admin.marketing.subscribers.unsubscribe')}
                                  </DropdownMenuItem>
                                )}
                                {canErase && (
                                  <DropdownMenuItem className="text-destructive" onClick={() => setConfirmErase(r)}>
                                    <ShieldOff className="mr-2 h-4 w-4" />
                                    {t('admin.marketing.subscribers.erase')}
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {total > CONTACTS_PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{t('admin.marketing.subscribers.page_info', { page: page + 1, pages: pageCount, total })}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              {t('admin.marketing.subscribers.prev')}
            </Button>
            <Button size="sm" variant="outline" disabled={page + 1 >= pageCount} onClick={() => setPage((p) => p + 1)}>
              {t('admin.marketing.subscribers.next')}
            </Button>
          </div>
        </div>
      )}

      {/* Uitschrijven */}
      <AlertDialog open={!!confirmUnsub} onOpenChange={(o) => { if (!o) setConfirmUnsub(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.marketing.subscribers.unsubscribe_title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.marketing.subscribers.unsubscribe_body', { email: confirmUnsub?.email ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); doUnsubscribe(); }} disabled={unsubscribe.isPending}>
              {t('admin.marketing.subscribers.unsubscribe')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AVG-verwijderen */}
      <AlertDialog open={!!confirmErase} onOpenChange={(o) => { if (!o) setConfirmErase(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.marketing.subscribers.erase_title')}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>{t('admin.marketing.subscribers.erase_body', { email: confirmErase?.email ?? '' })}</p>
                <p>{t('admin.marketing.subscribers.erase_keeps')}</p>
                <p>{t('admin.marketing.subscribers.erase_irreversible')}</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); doErase(); }}
              disabled={erase.isPending}
            >
              {t('admin.marketing.subscribers.erase')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} invite={invite} />
    </div>
  );
}

function InviteDialog({
  open, onOpenChange, invite,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  invite: ReturnType<typeof useMarketingContactActions>['invite'];
}) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [text, setText] = useState('');
  const [consent, setConsent] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const emails = parseEmailList(text);
  const tooMany = emails.length > MAX_INVITE;

  useEffect(() => {
    if (!open) { setText(''); setConsent(false); }
  }, [open]);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const content = await file.text();
    setText((prev) => (prev ? `${prev}\n` : '') + parseEmailList(content).join('\n'));
    if (fileRef.current) fileRef.current.value = '';
  };

  const submit = () => {
    invite.mutate(
      { emails, consent, language: i18n.language },
      {
        onSuccess: (r) => {
          const skipped = r.skipped.active + r.skipped.unsubscribed + r.skipped.invalid + r.skipped.duplicate + (r.skipped.recent ?? 0);
          toast({
            title: t('admin.marketing.subscribers.invite_done', { count: r.invited + r.resent }),
            description: t('admin.marketing.subscribers.invite_done_detail', {
              invited: r.invited, resent: r.resent, skipped, active: r.skipped.active,
              unsubscribed: r.skipped.unsubscribed, failed: r.failed,
            }),
          });
          onOpenChange(false);
        },
        onError: (e) => toast({ title: t('admin.marketing.subscribers.toast.action_failed'), description: (e as Error).message, variant: 'destructive' }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[calc(100vw-2rem)]">
        <DialogHeader>
          <DialogTitle>{t('admin.marketing.subscribers.invite_title')}</DialogTitle>
          <DialogDescription>{t('admin.marketing.subscribers.invite_explain')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Textarea
            className="min-h-[160px] font-mono text-sm"
            placeholder={t('admin.marketing.subscribers.invite_placeholder')}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex items-center justify-between gap-2">
            <span className={cn('text-sm', tooMany ? 'text-destructive' : 'text-muted-foreground')}>
              {tooMany
                ? t('admin.marketing.subscribers.invite_too_many', { max: MAX_INVITE })
                : t('admin.marketing.subscribers.invite_count', { count: emails.length })}
            </span>
            <input ref={fileRef} type="file" accept=".csv,.txt,text/csv,text/plain" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" />
              {t('admin.marketing.subscribers.invite_upload_csv')}
            </Button>
          </div>
          <div className="flex items-start gap-2 rounded-md border p-3">
            <Checkbox id="invite-consent" checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" />
            <Label htmlFor="invite-consent" className="text-sm font-normal leading-snug">
              {t('admin.marketing.subscribers.invite_consent')}
            </Label>
          </div>
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button type="button" onClick={submit} disabled={!consent || emails.length === 0 || tooMany || invite.isPending}>
            {invite.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('admin.marketing.subscribers.invite_send')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
