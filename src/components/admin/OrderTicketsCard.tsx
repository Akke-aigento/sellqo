// TICKET-MAIL-1 — tickets en munten van een bestelling, met "Tickets opnieuw mailen".
// EVENT-ADMIN-1 — per ticket: event + datum, tickettype, houder, gemaskeerde code en status.
// Toont niets bij een bestelling zonder tickets of muntenkaart.
// EVENT-409-1 — status van de muntenkaart als badge; geen (opnieuw) mailen bij een
// geannuleerde of volledig terugbetaalde bestelling (de server weigert dat ook).
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import { format } from 'date-fns';
import { Coins, ExternalLink, Loader2, Mail, Ticket } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { walletUrl } from '@/hooks/useFestival';
import { useBusinessModules } from '@/hooks/useBusinessModules';
import { useDateFnsLocale } from '@/hooks/useDateFnsLocale';
import { maskTicketCode, sortOrderTickets, ticketStatusKey, walletStatusKey, WALLET_STATUS_VARIANT, type OrderTicketRow, type WalletStatus } from '@/lib/orderTickets';
import { canResendTickets, ticketOrderClosed } from '@/lib/ticketResend';

const db = supabase as unknown as SupabaseClient;

interface Info {
  rows: OrderTicketRow[];
  tickets: number;
  checkedIn: number;
  wallet: { code: string; balance: number; purchased: number; status: string } | null;
  mail: { first_sent_at: string; last_sent_at: string; send_count: number } | null;
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  valid: 'secondary',
  checked_in: 'default',
  cancelled: 'destructive',
  refunded: 'destructive',
  transferred: 'outline',
};

export function OrderTicketsCard({ orderId, tenantId, status, paymentStatus }: { orderId: string; tenantId: string; status: string; paymentStatus: string }) {
  const { t, i18n } = useTranslation();
  const orderState = { status, payment_status: paymentStatus };
  const paid = paymentStatus === 'paid' || paymentStatus === 'partially_refunded';
  const closed = ticketOrderClosed(orderState);
  const canResend = canResendTickets(orderState);
  const k = (x: string, o?: Record<string, unknown>) => t(`admin.orderTickets.${x}`, o);
  const qc = useQueryClient();
  const dfLocale = useDateFnsLocale();
  // EVENT-ADMIN-1: de lijst per ticket hoort bij de module Events; zonder module blijft de kaart zoals ze was.
  const { has } = useBusinessModules();
  const showList = has('events');

  const { data } = useQuery({
    queryKey: ['order-tickets', tenantId, orderId],
    queryFn: async (): Promise<Info> => {
      const [{ data: tix }, { data: wallet }, { data: mail }] = await Promise.all([
        db.from('ticket_instances')
          .select('id, status, seq, attendee_name, seat_label, qr_token, checked_in_at, product_id, products!ticket_instances_product_id_fkey(name), event_details!ticket_instances_event_detail_id_fkey(event_date, start_time, product_id, products!event_details_product_id_fkey(name))')
          .eq('tenant_id', tenantId)
          .eq('order_id', orderId),
        db.from('token_wallets').select('code, balance, purchased, status').eq('tenant_id', tenantId).eq('order_id', orderId).maybeSingle(),
        db.from('ticket_mail_log').select('first_sent_at, last_sent_at, send_count').eq('order_id', orderId).maybeSingle(),
      ]);
      const rows = sortOrderTickets((tix ?? []) as unknown as OrderTicketRow[]);
      return {
        rows,
        tickets: rows.filter((x) => x.status === 'valid' || x.status === 'checked_in').length,
        checkedIn: rows.filter((x) => x.status === 'checked_in').length,
        wallet: (wallet as Info['wallet']) ?? null,
        mail: (mail as Info['mail']) ?? null,
      };
    },
    enabled: !!orderId && !!tenantId,
  });

  const resend = useMutation({
    mutationFn: async () => {
      const { data: res, error } = await supabase.functions.invoke('send-ticket-confirmation', { body: { order_id: orderId } });
      if (error) {
        // EVENT-409-1: de server weigert een geannuleerde/terugbetaalde bestelling met ORDER_CLOSED.
        let code: string | undefined;
        try { code = ((await (error as { context?: Response }).context?.json()) as { error?: string } | undefined)?.error; } catch { /* geen json */ }
        throw new Error(code === 'ORDER_CLOSED' ? 'ORDER_CLOSED' : error.message);
      }
      if ((res as { skipped?: boolean })?.skipped) throw new Error('skipped');
    },
    onSuccess: () => {
      toast.success(k('resent'));
      void qc.invalidateQueries({ queryKey: ['order-tickets', tenantId, orderId] });
    },
    onError: (e: Error) => {
      if (e.message === 'ORDER_CLOSED') {
        toast.error(k('resend_closed'));
        // De bestelling is intussen geannuleerd of terugbetaald: scherm bijwerken, knop verdwijnt.
        void qc.invalidateQueries({ queryKey: ['order', orderId] });
        return;
      }
      toast.error(k('resend_failed'));
    },
  });

  if (!data || (data.tickets === 0 && !data.wallet && !(showList && data.rows.length > 0))) return null;
  const fmt = (iso: string) => new Date(iso).toLocaleString(i18n.language, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const eventWhen = (date?: string | null, time?: string | null) => {
    if (!date) return '';
    const d = format(new Date(`${date}T00:00:00`), 'EEE d MMM yyyy', { locale: dfLocale });
    return time ? `${d} · ${time.slice(0, 5)}` : d;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><Ticket className="h-4 w-4" />{k('title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {data.tickets > 0 && (
          <p className="m-0">{k('tickets_count', { count: data.tickets })}{data.checkedIn > 0 ? ` · ${k('checked_in_count', { count: data.checkedIn })}` : ''}</p>
        )}
        {showList && data.rows.length > 0 && (
          <ul className="m-0 max-h-96 list-none space-y-2 overflow-y-auto p-0">
            {data.rows.map((r) => {
              const ev = r.event_details;
              const eventName = ev?.products?.name ?? '';
              const isStandard = !r.product_id || r.product_id === ev?.product_id;
              const typeName = isStandard ? k('type_standard') : (r.products?.name ?? k('type_standard'));
              return (
                <li key={r.id} className="rounded-md border p-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="m-0 truncate font-medium">{eventName}</p>
                      <p className="m-0 text-xs text-muted-foreground">{eventWhen(ev?.event_date, ev?.start_time)}</p>
                    </div>
                    <Badge variant={STATUS_VARIANT[r.status] ?? 'outline'} className="shrink-0">
                      {k(ticketStatusKey(r.status))}
                    </Badge>
                  </div>
                  <p className="m-0 mt-1 text-xs">
                    {typeName}
                    {r.attendee_name ? ` · ${r.attendee_name}` : ''}
                    {r.seat_label ? ` · ${k('seat', { seat: r.seat_label })}` : ''}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="font-mono" title={k('code_masked_hint')}>{maskTicketCode(r.qr_token)}</span>
                    {r.status === 'checked_in' && r.checked_in_at && (
                      <span>{k('checked_in_at', { date: fmt(r.checked_in_at) })}</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {data.wallet && (
          <p className="m-0 flex flex-wrap items-center gap-2">
            <Coins className="h-4 w-4 text-muted-foreground" />
            {k('wallet', { balance: data.wallet.balance, purchased: data.wallet.purchased })}
            {walletStatusKey(data.wallet.status) && (
              <Badge variant={WALLET_STATUS_VARIANT[data.wallet.status as WalletStatus]}>{t(walletStatusKey(data.wallet.status)!)}</Badge>
            )}
            <a href={walletUrl(data.wallet.code)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
              {k('open_wallet')}<ExternalLink className="h-3 w-3" />
            </a>
          </p>
        )}
        {(data.mail || !closed) && (
        <p className="m-0 text-muted-foreground">
          {data.mail
            ? (data.mail.send_count > 1
              ? k('mail_sent_again', { date: fmt(data.mail.last_sent_at), count: data.mail.send_count })
              : k('mail_sent', { date: fmt(data.mail.first_sent_at) }))
            : paid ? k('mail_not_sent') : k('mail_after_payment')}
        </p>
        )}
        {canResend && (data.tickets > 0 || data.wallet) && (
          <Button size="sm" variant="outline" className="w-full" disabled={resend.isPending} onClick={() => resend.mutate()}>
            {resend.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
            {data.mail ? k('resend') : k('send')}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
