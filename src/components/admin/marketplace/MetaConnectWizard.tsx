import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Facebook, Check, ChevronRight, Loader2, ExternalLink, Eye, EyeOff, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { toast } from 'sonner';

interface MetaConnectWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type WizardStep = 'credentials' | 'authorize' | 'features';

const META_FEATURES = [
  { id: 'facebook_shop', label: 'Facebook Shop', description: 'Catalogus synchronisatie naar Facebook' },
  { id: 'instagram_shop', label: 'Instagram Shop', description: 'Product tags in posts en stories' },
  { id: 'facebook_messenger', label: 'Facebook Messenger', description: 'Ontvang berichten in je inbox' },
  { id: 'instagram_dm', label: 'Instagram DM\'s', description: 'Ontvang DM\'s in je inbox' },
  { id: 'autopost', label: 'Autopost', description: 'AI social media posts plannen en publiceren' },
];

export function MetaConnectWizard({ open, onOpenChange }: MetaConnectWizardProps) {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<WizardStep>('credentials');
  const [appId, setAppId] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [isEditingCredentials, setIsEditingCredentials] = useState(false);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([
    'facebook_shop', 'instagram_shop', 'facebook_messenger', 'instagram_dm', 'autopost',
  ]);

  // Check existing credentials
  const { data: existingCredentials, isLoading: checkingCredentials } = useQuery({
    queryKey: ['tenant-oauth-credentials', currentTenant?.id, 'facebook'],
    queryFn: async () => {
      if (!currentTenant?.id) return null;
      const { data, error } = await supabase
        .from('tenant_oauth_credentials')
        .select('id, client_id, is_active')
        .eq('tenant_id', currentTenant.id)
        .eq('platform', 'facebook')
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!currentTenant?.id && open,
  });

  // Auto-skip credentials step if already configured
  const effectiveStep = step === 'credentials' && existingCredentials && !isEditingCredentials ? 'authorize' : step;

  const handleSaveCredentials = async () => {
    if (!appId.trim() || !appSecret.trim() || !currentTenant?.id) {
      toast.error('Vul beide velden in');
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('tenant_oauth_credentials')
        .upsert({
          tenant_id: currentTenant.id,
          platform: 'facebook',
          client_id: appId.trim(),
          client_secret: appSecret.trim(),
          is_active: true,
        }, { onConflict: 'tenant_id,platform' });

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['tenant-oauth-credentials', currentTenant.id] });
      toast.success('Meta credentials opgeslagen');
      setIsEditingCredentials(false);
      setStep('authorize');
    } catch (err: any) {
      toast.error('Opslaan mislukt: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAuthorize = async () => {
    if (!currentTenant?.id) return;

    setIsAuthorizing(true);
    try {
      const { data, error } = await supabase.functions.invoke('social-oauth-init', {
        body: {
          platform: 'facebook',
          tenantId: currentTenant.id,
          redirectUrl: window.location.origin + '/admin/connect?tab=channels',
        },
      });

      if (error) {
        try {
          const errorBody = await error.context?.json?.();
          if (errorBody?.missingConfig) {
            toast.error('Meta credentials niet gevonden. Voer eerst je App ID en Secret in.');
            setStep('credentials');
            return;
          }
        } catch {}
        throw error;
      }

      if (data?.authUrl) {
        sessionStorage.setItem('social_oauth_state', data.state);
        sessionStorage.setItem('social_oauth_platform', 'facebook');
        window.open(data.authUrl, '_blank');
        toast.info('Facebook autorisatie geopend in een nieuw tabblad.');
      }
    } catch (err: any) {
      toast.error('Kon OAuth niet starten: ' + (err.message || 'Onbekende fout'));
    } finally {
      setIsAuthorizing(false);
    }
  };

  const handleComplete = () => {
    toast.success('Meta kanaal configuratie opgeslagen');
    onOpenChange(false);
    // Reset
    setStep('credentials');
    setAppId('');
    setAppSecret('');
  };

  const toggleFeature = (featureId: string) => {
    setSelectedFeatures(prev =>
      prev.includes(featureId) ? prev.filter(f => f !== featureId) : [...prev, featureId]
    );
  };

  const steps: WizardStep[] = ['credentials', 'authorize', 'features'];
  const currentStepIndex = steps.indexOf(effectiveStep);

  const maskValue = (val: string) => {
    if (val.length <= 8) return '••••••••';
    return val.slice(0, 4) + '••••' + val.slice(-4);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Facebook className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <DialogTitle>Meta koppelen</DialogTitle>
              <DialogDescription>Facebook & Instagram</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 py-3">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center">
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
                currentStepIndex === i ? 'bg-blue-600 text-white' :
                currentStepIndex > i ? 'bg-blue-100 text-blue-700' : 'bg-muted text-muted-foreground'
              )}>
                {currentStepIndex > i ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              {i < steps.length - 1 && <ChevronRight className="h-4 w-4 mx-1 text-muted-foreground" />}
            </div>
          ))}
        </div>

        <div className="py-2">
          {/* Step 1: Credentials */}
          {effectiveStep === 'credentials' && (
            <div className="space-y-4">
              {checkingCredentials ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div>
                    <h3 className="font-medium">Stap 1: Meta App Credentials</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Om te verbinden heb je een Meta Developer App nodig.{' '}
                      <a
                        href="https://developers.facebook.com/apps"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-1"
                      >
                        Open Developer Portal <ExternalLink className="h-3 w-3" />
                      </a>
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label htmlFor="meta-app-id">App ID</Label>
                      <Input
                        id="meta-app-id"
                        value={appId}
                        onChange={(e) => setAppId(e.target.value)}
                        placeholder="Plak je Meta App ID hier"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="meta-app-secret">App Secret</Label>
                      <div className="relative">
                        <Input
                          id="meta-app-secret"
                          type={showSecret ? 'text' : 'password'}
                          value={appSecret}
                          onChange={(e) => setAppSecret(e.target.value)}
                          placeholder="Plak je App Secret hier"
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
                  </div>

                  <Button
                    onClick={handleSaveCredentials}
                    disabled={isSaving || !appId.trim() || !appSecret.trim()}
                    className="w-full"
                  >
                    {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Opslaan & Volgende
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Step 2: Authorize */}
          {effectiveStep === 'authorize' && (
            <div className="space-y-4 text-center">
              <div className="w-16 h-16 mx-auto bg-blue-100 rounded-full flex items-center justify-center">
                <Facebook className="h-8 w-8 text-blue-600" />
              </div>

              {existingCredentials && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-left">
                  <div className="flex items-center gap-2 text-green-700 font-medium">
                    <Check className="h-4 w-4" />
                    Meta App geconfigureerd
                  </div>
                  <p className="text-green-600 text-xs mt-1">
                    App ID: {maskValue(existingCredentials.client_id)}
                  </p>
                </div>
              )}

              <div>
                <h3 className="font-medium">Stap 2: Account autoriseren</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Je wordt doorgestuurd naar Facebook om je pagina('s) en accounts te autoriseren.
                </p>
              </div>

              <Button
                onClick={handleAuthorize}
                disabled={isAuthorizing}
                className="w-full"
              >
                {isAuthorizing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Facebook className="h-4 w-4 mr-2" />
                )}
                Verbind met Facebook
              </Button>

              {existingCredentials && (
                <button
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                  onClick={() => {
                    setIsEditingCredentials(true);
                    setStep('credentials');
                    setAppId(existingCredentials?.client_id || '');
                    setAppSecret('');
                  }}
                >
                  Credentials wijzigen
                </button>
              )}
            </div>
          )}

          {/* Step 3: Feature selection */}
          {effectiveStep === 'features' && (
            <div className="space-y-4">
              <div>
                <h3 className="font-medium">Stap 3: Wat wil je gebruiken?</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Selecteer welke functies je wilt activeren voor Meta.
                </p>
              </div>

              <div className="space-y-3">
                {META_FEATURES.map((feature) => (
                  <label
                    key={feature.id}
                    className={cn(
                      'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                      selectedFeatures.includes(feature.id) ? 'border-blue-200 bg-blue-50/50' : 'border-border hover:bg-muted/50'
                    )}
                  >
                    <Checkbox
                      checked={selectedFeatures.includes(feature.id)}
                      onCheckedChange={() => toggleFeature(feature.id)}
                      className="mt-0.5"
                    />
                    <div>
                      <span className="font-medium text-sm">{feature.label}</span>
                      <p className="text-xs text-muted-foreground">{feature.description}</p>
                    </div>
                  </label>
                ))}
              </div>

              <Button onClick={handleComplete} className="w-full">
                Voltooien
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
