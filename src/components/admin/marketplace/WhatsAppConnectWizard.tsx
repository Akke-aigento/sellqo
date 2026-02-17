import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronRight, Loader2, MessageCircle, AlertTriangle, Phone, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { toast } from 'sonner';

interface WhatsAppConnectWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (connectionId: string) => void;
}

type WizardStep = 'check_credentials' | 'info' | 'connect' | 'phone' | 'complete';

export function WhatsAppConnectWizard({ open, onOpenChange, onSuccess }: WhatsAppConnectWizardProps) {
  const { currentTenant } = useTenant();
  const [step, setStep] = useState<WizardStep>('check_credentials');
  const [isLoading, setIsLoading] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [businessName, setBusinessName] = useState('');

  // Check if Meta credentials are configured
  const { data: hasCredentials, isLoading: checkingCredentials } = useQuery({
    queryKey: ['tenant-oauth-credentials', currentTenant?.id, 'facebook'],
    queryFn: async () => {
      if (!currentTenant?.id) return false;
      const { data, error } = await supabase
        .from('tenant_oauth_credentials')
        .select('id')
        .eq('tenant_id', currentTenant.id)
        .eq('platform', 'facebook')
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
    enabled: !!currentTenant?.id && open,
  });

  const steps: WizardStep[] = ['check_credentials', 'info', 'connect', 'phone', 'complete'];
  const stepIndex = steps.indexOf(step);

  const handleStartEmbeddedSignup = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('social-oauth-init', {
        body: {
          platform: 'whatsapp',
          tenantId: currentTenant?.id,
          redirectUrl: window.location.origin + '/admin/settings?section=social',
        },
      });

      if (error) throw error;

      // Open the WhatsApp Embedded Signup in a popup
      const popup = window.open(data.authUrl, 'whatsapp_signup', 'width=700,height=800');

      const checkPopup = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkPopup);
          setStep('phone');
          setIsLoading(false);
        }
      }, 500);
    } catch (error: any) {
      toast.error('Kon WhatsApp koppeling niet starten: ' + error.message);
      setIsLoading(false);
    }
  };

  const handleSavePhone = async () => {
    if (!phoneNumber.trim()) {
      toast.error('Vul een telefoonnummer in');
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('social_channel_connections')
        .insert([{
          tenant_id: currentTenant?.id,
          channel_type: 'whatsapp_business',
          channel_name: businessName || 'WhatsApp Business',
          credentials: {
            phoneNumber: phoneNumber.trim(),
            businessName: businessName.trim(),
          } as any,
          is_active: true,
          sync_status: 'idle',
        }])
        .select()
        .single();

      if (error) throw error;

      setStep('complete');
      toast.success('WhatsApp Business verbonden!');

      setTimeout(() => {
        onSuccess(data.id);
        onOpenChange(false);
      }, 2000);
    } catch (error: any) {
      toast.error('Kon niet opslaan: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <MessageCircle className="h-6 w-6 text-green-600" />
            <DialogTitle>WhatsApp Business koppelen</DialogTitle>
          </div>
          <DialogDescription>
            Koppel je WhatsApp Business account om berichten te versturen
          </DialogDescription>
        </DialogHeader>

        {/* Progress */}
        <div className="flex items-center justify-center gap-2 py-4">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center">
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                step === s ? 'bg-green-600 text-white' :
                stepIndex > i ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'
              )}>
                {stepIndex > i ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              {i < steps.length - 1 && <ChevronRight className="h-4 w-4 mx-1 text-muted-foreground" />}
            </div>
          ))}
        </div>

        <div className="py-4">
          {/* Step 1: Check credentials */}
          {step === 'check_credentials' && (
            <div className="space-y-4">
              {checkingCredentials ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !hasCredentials ? (
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 mx-auto bg-amber-100 rounded-full flex items-center justify-center">
                    <AlertTriangle className="h-8 w-8 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="font-medium">Meta credentials vereist</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Om WhatsApp Business te koppelen heb je eerst Meta Developer App credentials nodig.
                      Ga naar <strong>API Credentials</strong> hierboven om je Meta App ID en App Secret in te voeren.
                    </p>
                  </div>
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Naar API Credentials
                  </Button>
                </div>
              ) : (
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                    <Check className="h-8 w-8 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-medium">Meta credentials gevonden</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Je Meta App is geconfigureerd. Je kunt doorgaan met het koppelen van WhatsApp Business.
                    </p>
                  </div>
                  <Button onClick={() => setStep('info')} className="bg-green-600 hover:bg-green-700">
                    Doorgaan
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Info */}
          {step === 'info' && (
            <div className="space-y-4">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                  <MessageCircle className="h-8 w-8 text-green-600" />
                </div>
              </div>
              <div>
                <h3 className="font-medium text-center">Wat heb je nodig?</h3>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                    Een WhatsApp Business Account (of maak er een aan in het volgende scherm)
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                    Een telefoonnummer dat nog niet gekoppeld is aan WhatsApp
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                    Je Meta Developer App (al geconfigureerd ✓)
                  </li>
                </ul>
              </div>
              <Button onClick={() => setStep('connect')} className="w-full bg-green-600 hover:bg-green-700">
                Start koppeling
              </Button>
            </div>
          )}

          {/* Step 3: Embedded Signup */}
          {step === 'connect' && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                <Phone className="h-8 w-8 text-green-600" />
              </div>
              <div>
                <h3 className="font-medium">WhatsApp Business koppelen</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Er opent een venster waar je je WhatsApp Business account koppelt via Meta. 
                  Volg de stappen in het popup-venster.
                </p>
              </div>
              <Button
                onClick={handleStartEmbeddedSignup}
                disabled={isLoading}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <MessageCircle className="h-4 w-4 mr-2" />}
                Koppel WhatsApp Business
              </Button>
              <p className="text-xs text-muted-foreground">
                Je wordt doorgestuurd naar Meta om je WhatsApp Business te autoriseren
              </p>
            </div>
          )}

          {/* Step 4: Phone number */}
          {step === 'phone' && (
            <div className="space-y-4">
              <div>
                <h3 className="font-medium">Bevestig je gegevens</h3>
                <p className="text-sm text-muted-foreground">
                  Vul het telefoonnummer in dat je hebt gekoppeld
                </p>
              </div>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="wa-business-name">Bedrijfsnaam</Label>
                  <Input
                    id="wa-business-name"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="Bijv. Mijn Webshop"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="wa-phone">WhatsApp telefoonnummer</Label>
                  <Input
                    id="wa-phone"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+31 6 12345678"
                  />
                </div>
              </div>
              <Button
                onClick={handleSavePhone}
                disabled={isLoading || !phoneNumber.trim()}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Koppeling voltooien
              </Button>
            </div>
          )}

          {/* Step 5: Complete */}
          {step === 'complete' && (
            <div className="text-center space-y-4 py-4">
              <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <div>
                <h3 className="font-medium text-lg">WhatsApp Business verbonden!</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Je kunt nu berichten versturen via WhatsApp Business.
                </p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
