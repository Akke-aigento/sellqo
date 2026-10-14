// TICKET-MAIL-1 — tickets en munten van een bestelling, met "Tickets opnieuw mailen".
// Toont niets bij een bestelling zonder tickets of muntenkaart.
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Coins, ExternalLink, Loader2, Mail, Ticket } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { walletUrl } from '@/hooks/useFestival';

const db = supabase as unknown as SupabaseClient;

interface Info {
  tickets: number;
  checkedIn: number;
  wallet: { code: string; balance: number; purchased: number; status: string } | null;
  mail: { first_sent_at: string; last_sent_at: string; send_count: number } | null;
}

export function OrderTicketsCard({ orderId, tenantId, paid }: { orderId: string; tenantId: string; paid: boolean }) {
  const { t } = useTranslation();
  const k = (x: string, o?: Record<string, unknown>) => t(`admin.orderTickets.${x}`, o);
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ['order-tickets', tenantId, orderId],
    queryFn: async (): Promise<Info> => {
      const [{ data: tix }, { data: wallet }, { data: mail }] = await Promise.all([
        db.from('ticket_instances').select('status').eq('tenant_id', tenantId).eq('order_id', orderId),
        db.from('token_wallets').select('code, balance, purchased, status').eq('tenant_id', tenantId).eq('order_id', orderId).maybeSingle(),
        db.from('ticket_mail_log').select('first_sent_at, last_sent_at, send_count').eq('order_id', orderId).maybeSingle(),
      ]);
      const list = (tix ?? []) as { status: string }[];
      return {
        tickets: list.filter((x) => x.status === 'valid' || x.status === 'checked_in').length,
        checkedIn: list.filter((x) => x.status === 'checked_in').length,
        wallet: (wallet as Info['wallet']) ?? null,
        mail: (mail as Info['mail']) ?? null,
      };
    },
    enabled: !!orderId && !!tenantId,
  });

  const resend = useMutation({
    mutationFn: async () => {
      const { data: res, error } = await supabase.functions.invoke('send-ticket-confirmation', { body: { order_id: orderId } });
      if (error) throw error;
      if ((res as { skipped?: boolean })?.skipped) throw new Error('skipped');
    },
    onSuccess: () => {
      toast.success(k('resent'));
      void qc.invalidateQueries({ queryKey: ['order-tickets', tenantId, orderId] });
    },
    onError: () => toast.error(k('resend_failed')),
  });

  if (!data || (data.tickets === 0 && !data.wallet)) return null;
  const fmt = (iso: string) => new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><Ticket className="h-4 w-4" />{k('title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {data.tickets > 0 && (
          <p className="m-0">{k('tickets', { count: data.tickets })}{data.checkedIn > 0 ? ` · ${k('checked_in', { count: data.checkedIn })}` : ''}</p>
        )}
        {data.wallet && (
          <p className="m-0 flex flex-wrap items-center gap-2">
            <Coins className="h-4 w-4 text-muted-foreground" />
            {k('wallet', { balance: data.wallet.balance, purchased: data.wallet.purchased })}
            <a href={walletUrl(data.wallet.code)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
              {k('open_wallet')}<ExternalLink className="h-3 w-3" />
            </a>
          </p>
        )}
        <p className="m-0 text-muted-foreground">
          {data.mail
            ? (data.mail.send_count > 1
              ? k('mail_sent_again', { date: fmt(data.mail.last_sent_at), count: data.mail.send_count })
              : k('mail_sent', { date: fmt(data.mail.first_sent_at) }))
            : paid ? k('mail_not_sent') : k('mail_after_payment')}
        </p>
        {paid && (
          <Button size="sm" variant="outline" className="w-full" disabled={resend.isPending} onClick={() => resend.mutate()}>
            {resend.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
            {data.mail ? k('resend') : k('send')}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
