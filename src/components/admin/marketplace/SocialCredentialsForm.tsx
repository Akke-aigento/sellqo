import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Eye, EyeOff, ExternalLink, Loader2, Save, Trash2, CheckCircle2 } from 'lucide-react';

interface PlatformConfig {
  label: string;
  platform: string;
  helpUrl: string;
  helpText: string;
  idLabel: string;
  secretLabel: string;
}

const PLATFORMS: PlatformConfig[] = [
  {
    label: 'Meta (Facebook / Instagram / WhatsApp)',
    platform: 'facebook',
    helpUrl: 'https://developers.facebook.com/apps',
    helpText: 'Maak een app aan op Meta for Developers en kopieer de App ID en App Secret.',
    idLabel: 'App ID',
    secretLabel: 'App Secret',
  },
  {
    label: 'Twitter / X',
    platform: 'twitter',
    helpUrl: 'https://developer.twitter.com/en/portal/projects-and-apps',
    helpText: 'Maak een project aan op het Twitter Developer Portal.',
    idLabel: 'Client ID',
    secretLabel: 'Client Secret',
  },
  {
    label: 'LinkedIn',
    platform: 'linkedin',
    helpUrl: 'https://www.linkedin.com/developers/apps',
    helpText: 'Maak een app aan op LinkedIn Developers.',
    idLabel: 'Client ID',
    secretLabel: 'Client Secret',
  },
];

function maskSecret(value: string): string {
  if (value.length <= 8) return '••••••••';
  return value.slice(0, 4) + '••••••••' + value.slice(-4);
}

interface CredentialCardProps {
  config: PlatformConfig;
  existing?: { id: string; client_id: string; client_secret: string; is_active: boolean } | null;
  tenantId: string;
}

export function CredentialCard({ config, existing, tenantId }: CredentialCardProps) {
  const queryClient = useQueryClient();
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [isEditing, setIsEditing] = useState(!existing);

  const upsertMutation = useMutation({
    mutationFn: async () => {
      if (!clientId.trim() || !clientSecret.trim()) {
        throw new Error('Vul beide velden in');
      }

      const { error } = await supabase
        .from('tenant_oauth_credentials')
        .upsert({
          tenant_id: tenantId,
          platform: config.platform,
          client_id: clientId.trim(),
          client_secret: clientSecret.trim(),
          is_active: true,
        }, {
          onConflict: 'tenant_id,platform',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-oauth-credentials', tenantId] });
      toast.success(`${config.label} credentials opgeslagen`);
      setIsEditing(false);
      setClientId('');
      setClientSecret('');
    },
    onError: (error) => {
      toast.error('Opslaan mislukt: ' + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!existing) return;
      const { error } = await supabase
        .from('tenant_oauth_credentials')
        .delete()
        .eq('id', existing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-oauth-credentials', tenantId] });
      toast.success(`${config.label} credentials verwijderd`);
      setIsEditing(true);
    },
    onError: (error) => {
      toast.error('Verwijderen mislukt: ' + error.message);
    },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{config.label}</CardTitle>
          {existing && (
            <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
              <CheckCircle2 className="h-3 w-3 mr-1" /> Geconfigureerd
            </Badge>
          )}
        </div>
        <CardDescription className="text-sm">
          {config.helpText}{' '}
          <a href={config.helpUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
            Open developer portal <ExternalLink className="h-3 w-3" />
          </a>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {existing && !isEditing ? (
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">{config.idLabel}</Label>
              <p className="text-sm font-mono">{maskSecret(existing.client_id)}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">{config.secretLabel}</Label>
              <p className="text-sm font-mono">{maskSecret(existing.client_secret)}</p>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                Wijzigen
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="h-4 w-4 mr-1" /> Verwijderen
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor={`${config.platform}-id`}>{config.idLabel}</Label>
              <Input
                id={`${config.platform}-id`}
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder={`Plak je ${config.idLabel} hier`}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${config.platform}-secret`}>{config.secretLabel}</Label>
              <div className="relative">
                <Input
                  id={`${config.platform}-secret`}
                  type={showSecret ? 'text' : 'password'}
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder={`Plak je ${config.secretLabel} hier`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setShowSecret(!showSecret)}
                >
                  {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                onClick={() => upsertMutation.mutate()}
                disabled={upsertMutation.isPending || !clientId.trim() || !clientSecret.trim()}
              >
                {upsertMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                Opslaan
              </Button>
              {existing && (
                <Button variant="ghost" size="sm" onClick={() => { setIsEditing(false); setClientId(''); setClientSecret(''); }}>
                  Annuleren
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function SocialCredentialsForm() {
  const { currentTenant } = useTenant();

  const { data: credentials = [], isLoading } = useQuery({
    queryKey: ['tenant-oauth-credentials', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      const { data, error } = await supabase
        .from('tenant_oauth_credentials')
        .select('*')
        .eq('tenant_id', currentTenant.id);
      if (error) throw error;
      return data;
    },
    enabled: !!currentTenant?.id,
  });

  if (!currentTenant?.id) return null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">API Credentials</h3>
        <p className="text-sm text-muted-foreground">
          Vul hier de OAuth credentials in van je developer apps. Deze worden veilig opgeslagen per tenant.
        </p>
      </div>
      {PLATFORMS.map((platform) => {
        const existing = credentials.find((c: any) => c.platform === platform.platform);
        return (
          <CredentialCard
            key={platform.platform}
            config={platform}
            existing={existing}
            tenantId={currentTenant.id}
          />
        );
      })}
    </div>
  );
}
