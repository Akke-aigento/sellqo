import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Facebook, Instagram, Twitter, Linkedin, 
  Link2, Unlink, Loader2, AlertCircle, CheckCircle2,
  ExternalLink, RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSocialConnections, type SocialConnection } from '@/hooks/useSocialConnections';
import { useTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface SocialPlatformConfig {
  id: 'facebook' | 'instagram' | 'twitter' | 'linkedin';
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  description: string;
  scopes: string[];
}

/** Factory: de omschrijvingen gaan door i18n. */
const buildPlatformConfigs = (t: (key: string) => string): SocialPlatformConfig[] => [
  { 
    id: 'facebook',
    name: 'Meta (Facebook & Instagram)', 
    icon: Facebook, 
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    description: t('settings.social.platforms.meta'),
    scopes: ['pages_manage_posts', 'instagram_content_publish'],
  },
  {
    // SOCIAL-1: Instagram rechtstreeks (Instagram Login), zonder Facebook-pagina.
    id: 'instagram',
    name: 'Instagram',
    icon: Instagram,
    color: 'text-pink-600',
    bgColor: 'bg-pink-100',
    description: t('settings.social.platforms.instagram'),
    scopes: ['instagram_business_content_publish'],
  },
  { 
    id: 'twitter',
    name: 'X (Twitter)', 
    icon: Twitter, 
    color: 'text-foreground',
    bgColor: 'bg-muted',
    description: t('settings.social.platforms.x'),
    scopes: ['tweet.write', 'users.read'],
  },
  { 
    id: 'linkedin',
    name: 'LinkedIn', 
    icon: Linkedin, 
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
    description: t('settings.social.platforms.linkedin'),
    scopes: ['w_member_social'],
  },
];

interface MetaPage {
  page_id: string;
  page_name: string | null;
}

/**
 * SOCIAL-1: wie meerdere Facebook-pagina's beheert, kiest hier op welke pagina deze
 * winkel post. Zonder keuze weigert de publicatie (geen gok op "de eerste pagina").
 * Bij één pagina toont dit niets: die wordt automatisch gebruikt.
 */
function MetaPagePicker({ connection }: { connection: SocialConnection }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const { data: pages = [] } = useQuery({
    queryKey: ['meta-pages', connection.tenant_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meta_messaging_connections')
        .select('page_id, page_name')
        .eq('tenant_id', connection.tenant_id)
        .eq('platform', 'facebook')
        .eq('is_active', true)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as MetaPage[];
    },
  });

  if (pages.length < 2) return null;

  const handleChange = async (pageId: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('social_connections')
        .update({ target_page_id: pageId, updated_at: new Date().toISOString() })
        .eq('id', connection.id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['social-connections'] });
      toast.success(t('settings.social.pagePicker.saved'));
    } catch {
      toast.error(t('settings.social.pagePicker.saveError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-2 space-y-1">
      <p className="text-xs text-muted-foreground">{t('settings.social.pagePicker.hint')}</p>
      <Select
        value={connection.target_page_id ?? undefined}
        onValueChange={handleChange}
        disabled={saving}
      >
        <SelectTrigger className="h-8 w-64" aria-label={t('settings.social.pagePicker.label')}>
          <SelectValue placeholder={t('settings.social.pagePicker.placeholder')} />
        </SelectTrigger>
        <SelectContent>
          {pages.map((page) => (
            <SelectItem key={page.page_id} value={page.page_id}>
              {page.page_name || page.page_id}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function SocialConnectionsManager() {
  const { t } = useTranslation();
  const platformConfigs = useMemo(() => buildPlatformConfigs(t), [t]);
  const { currentTenant } = useTenant();
  const { connections, isLoading, deleteConnection, toggleConnection } = useSocialConnections();
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);
  const [disconnectDialog, setDisconnectDialog] = useState<{ open: boolean; connectionId: string; platform: string } | null>(null);

  const handleConnect = async (platform: string) => {
    if (!currentTenant?.id) {
      toast.error(t('settings.social.noTenant'));
      return;
    }

    setConnectingPlatform(platform);
    try {
      const { data, error } = await supabase.functions.invoke('social-oauth-init', {
        body: { 
          platform, 
          tenantId: currentTenant.id,
          redirectUrl: window.location.origin + '/admin/settings?section=social&oauth=callback',
        },
      });

      if (error) throw error;

      if (data?.authUrl) {
        // Store state for callback verification
        sessionStorage.setItem('social_oauth_state', data.state);
        sessionStorage.setItem('social_oauth_platform', platform);
        // Redirect to OAuth provider
        window.location.href = data.authUrl;
      } else {
        throw new Error('Geen auth URL ontvangen');
      }
    } catch (error: any) {
      console.error('OAuth init error:', error);
      toast.error(error.message || 'Kon OAuth flow niet starten');
    } finally {
      setConnectingPlatform(null);
    }
  };

  const handleDisconnect = async () => {
    if (!disconnectDialog) return;
    
    try {
      await deleteConnection.mutateAsync(disconnectDialog.connectionId);
      toast.success(`${disconnectDialog.platform} ontkoppeld`);
    } catch (error) {
      toast.error(t('settings.social.disconnectError'));
    } finally {
      setDisconnectDialog(null);
    }
  };

  // SOCIAL-1: Instagram heeft nu een eigen kaart (Instagram Login); de Meta-kaart
  // toont enkel de Facebook-koppeling.
  const getConnectionForPlatform = (platformId: string) =>
    connections.find(c => c.platform === platformId);

  // SOCIAL-1: de Instagram-kaart verschijnt alleen als Instagram Login voor deze winkel
  // ingesteld is (of er al een koppeling is). Anders zou Koppelen enkel op
  // "niet geconfigureerd" uitkomen: een dode knop.
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
  const visiblePlatforms = platformConfigs.filter(
    (p) => p.id !== 'instagram' || instagramAvailable || !!getConnectionForPlatform('instagram'),
  );

  const isTokenExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.social.autopostTitle')}</CardTitle>
          <CardDescription>
            {t('settings.social.autopostSubtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {t('settings.social.credentialsNeeded')}
              {t('settings.social.contactSupport')}
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            {visiblePlatforms.map((platform) => {
              const connection = getConnectionForPlatform(platform.id);
              const isConnected = Boolean(connection?.is_active);
              const isExpired = connection && isTokenExpired(connection.token_expires_at);
              const Icon = platform.icon;

              return (
                <div
                  key={platform.id}
                  className={cn(
                    'flex items-center justify-between p-4 rounded-lg border',
                    isConnected && !isExpired && 'border-green-200 bg-green-50/50',
                    isExpired && 'border-yellow-200 bg-yellow-50/50',
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn('p-2 rounded-lg', platform.bgColor)}>
                      <Icon className={cn('h-5 w-5', platform.color)} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{platform.name}</span>
                        {isConnected && !isExpired && (
                          <Badge variant="secondary" className="bg-green-100 text-green-700">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Gekoppeld
                          </Badge>
                        )}
                        {isExpired && (
                          <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Verlopen
                          </Badge>
                        )}
                      </div>
                      {isConnected && connection ? (
                        <div className="flex items-center gap-2 mt-1">
                          <Avatar className="h-5 w-5">
                            <AvatarImage src={connection.account_avatar || undefined} />
                            <AvatarFallback className="text-xs">
                              {connection.account_name?.[0] || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm text-muted-foreground">
                            {connection.account_name || connection.account_id}
                          </span>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">{platform.description}</p>
                      )}
                      {isConnected && connection && platform.id === 'facebook' && (
                        <MetaPagePicker connection={connection} />
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isConnected && connection ? (
                      <>
                        {isExpired && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleConnect(platform.id)}
                            disabled={connectingPlatform === platform.id}
                          >
                            <RefreshCw className="h-4 w-4 mr-1" />
                            Vernieuwen
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDisconnectDialog({ 
                            open: true, 
                            connectionId: connection.id,
                            platform: platform.name,
                          })}
                        >
                          <Unlink className="h-4 w-4 mr-1" />
                          Ontkoppelen
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleConnect(platform.id)}
                        disabled={connectingPlatform === platform.id}
                      >
                        {connectingPlatform === platform.id ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            {t('settings.social.connecting')}
                          </>
                        ) : (
                          <>
                            <Link2 className="h-4 w-4 mr-1" />
                            Koppelen
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              <strong>{t('settings.social.noteLabel')}</strong> Meta (Facebook/Instagram) vereist een{' '}
              <a 
                href="https://business.facebook.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                Business account <ExternalLink className="h-3 w-3" />
              </a>
              {' '}om te kunnen posten.
            </p>
          </div>
        </CardContent>
      </Card>

      <AlertDialog 
        open={disconnectDialog?.open} 
        onOpenChange={(open) => !open && setDisconnectDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('settings.social.disconnectTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je {disconnectDialog?.platform} wilt ontkoppelen? 
              {t('settings.social.disconnectBody')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDisconnect} className="bg-destructive text-destructive-foreground">
              Ontkoppelen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
