// MARKETING-1 — tab "Kanalen" in Social: zien welke accounts gekoppeld zijn en Instagram
// (opnieuw) koppelen, zonder naar SellQo Connect te moeten. Werkt ook voor de rol marketing:
// de status komt uit social_connection_status (zonder tokens), koppelen via social-oauth-init
// (tenant_admin en marketing). Ontkoppelen en Facebook/Meta blijven in SellQo Connect.

import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { AlertTriangle, CheckCircle2, Facebook, Instagram, Link2, Linkedin, Loader2, Twitter } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useCan } from '@/hooks/useCan';
import { useDateFnsLocale } from '@/hooks/useDateFnsLocale';
import { isExpired, useSocialChannelStatus } from '@/hooks/useSocialChannelStatus';

const ICONS: Record<string, typeof Instagram> = { instagram: Instagram, facebook: Facebook, linkedin: Linkedin, twitter: Twitter };
const NAMES: Record<string, string> = { instagram: 'Instagram', facebook: 'Facebook', linkedin: 'LinkedIn', twitter: 'X' };

export function SocialChannels() {
  const { t } = useTranslation();
  const locale = useDateFnsLocale();
  const { currentTenant } = useTenant();
  const canOpenConnect = useCan('read', 'integrations');
  const [searchParams, setSearchParams] = useSearchParams();
  const { channels, isLoading, refetch } = useSocialChannelStatus();

  // Terug van Instagram: melding tonen en de parameters opruimen.
  useEffect(() => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    if (!success && !error) return;
    if (success) {
      toast.success(t('admin.socialPlanner.channels.connected'));
      void refetch();
    } else {
      toast.error(t('admin.socialPlanner.channels.connectFailed', { message: error }));
    }
    const next = new URLSearchParams(searchParams);
    next.delete('success');
    next.delete('error');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, refetch, t]);

  const { data: instagramAvailable = false } = useQuery({
    queryKey: ['social-oauth-available', currentTenant?.id, 'instagram'],
    enabled: !!currentTenant?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('social-oauth-init', {
        body: { platform: 'instagram', tenantId: currentTenant!.id, checkOnly: true },
      });
      if (error) return false;
      return Boolean(data?.available);
    },
  });

  const connect = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('social-oauth-init', {
        body: {
          platform: 'instagram',
          tenantId: currentTenant!.id,
          redirectUrl: `${window.location.origin}/admin/marketing/social?tab=channels`,
        },
      });
      if (error) throw error;
      if (!data?.authUrl) throw new Error(t('admin.socialPlanner.channels.noAuthUrl'));
      sessionStorage.setItem('social_oauth_state', data.state);
      sessionStorage.setItem('social_oauth_platform', 'instagram');
      window.location.href = data.authUrl;
    },
    onError: (err) => toast.error(t('admin.socialPlanner.channels.connectFailed', { message: (err as Error).message })),
  });

  if (isLoading) return <Skeleton className="h-40 w-full" />;

  const instagram = channels.find((c) => c.platform === 'instagram');
  const others = channels.filter((c) => c.platform !== 'instagram');

  const row = (platform: string, c: (typeof channels)[number] | undefined) => {
    const Icon = ICONS[platform] ?? Link2;
    const expired = c ? isExpired(c) : false;
    const active = !!c?.is_active && !expired;
    return (
      <div key={platform + (c?.id ?? '')} className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Icon className="h-5 w-5 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium flex items-center gap-2 flex-wrap">
              {NAMES[platform] ?? platform}
              {active && (
                <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200">
                  <CheckCircle2 className="h-3 w-3 mr-1" />{t('admin.socialPlanner.channels.active')}
                </Badge>
              )}
              {c && !active && (
                <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {expired ? t('admin.socialPlanner.channels.expired') : t('admin.socialPlanner.channels.inactive')}
                </Badge>
              )}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {c
                ? [c.account_name, c.token_expires_at && !expired
                    ? t('admin.socialPlanner.channels.validUntil', { date: format(new Date(c.token_expires_at), 'd MMM yyyy', { locale }) })
                    : null].filter(Boolean).join(' · ')
                : t('admin.socialPlanner.channels.notConnected')}
            </p>
          </div>
        </div>
        {platform === 'instagram' && instagramAvailable && (
          <Button size="sm" variant={active ? 'outline' : 'default'} onClick={() => connect.mutate()} disabled={connect.isPending} className="shrink-0">
            {connect.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Link2 className="h-4 w-4 mr-1" />}
            {c ? t('admin.socialPlanner.channels.reconnect') : t('admin.socialPlanner.channels.connect')}
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <p className="text-sm text-muted-foreground">{t('admin.socialPlanner.channels.intro')}</p>
      <Card>
        <CardContent className="p-4 space-y-3">
          {row('instagram', instagram)}
          {others.map((c) => row(c.platform, c))}
        </CardContent>
      </Card>
      {!instagramAvailable && (
        <p className="text-sm text-muted-foreground">{t('admin.socialPlanner.channels.instagramUnavailable')}</p>
      )}
      <p className="text-xs text-muted-foreground">
        {t('admin.socialPlanner.channels.reconnectHint')}{' '}
        {canOpenConnect && (
          <Link to="/admin/connect?tab=channels" className="text-primary underline-offset-2 hover:underline">
            {t('admin.socialPlanner.channels.moreInConnect')}
          </Link>
        )}
      </p>
    </div>
  );
}
