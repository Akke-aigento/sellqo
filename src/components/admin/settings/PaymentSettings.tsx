import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CreditCard, RefreshCw, CheckCircle2, AlertCircle, ExternalLink, Store, Percent, Shield, Globe, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTenant } from '@/hooks/useTenant';
import { useStripeConnect } from '@/hooks/useStripeConnect';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const SUPPORTED_COUNTRIES = [
  { code: 'NL', name: 'Nederland', flag: '🇳🇱' },
  { code: 'BE', name: 'België', flag: '🇧🇪' },
  { code: 'DE', name: 'Duitsland', flag: '🇩🇪' },
  { code: 'FR', name: 'Frankrijk', flag: '🇫🇷' },
  { code: 'AT', name: 'Oostenrijk', flag: '🇦🇹' },
  { code: 'LU', name: 'Luxemburg', flag: '🇱🇺' },
];

export function PaymentSettings() {
  const { currentTenant, refreshTenants } = useTenant();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [isSavingCountry, setIsSavingCountry] = useState(false);
  
  useEffect(() => {
    if (currentTenant?.country) {
      setSelectedCountry(currentTenant.country);
    } else {
      setSelectedCountry('NL');
    }
  }, [currentTenant?.country]);
  
  const {
    status,
    isLoading,
    isCreatingAccount,
    isOpeningDashboard,
    checkStatus,
    createConnectAccount,
    openStripeDashboard,
  } = useStripeConnect(currentTenant?.id);

  useEffect(() => {
    if (currentTenant?.id) {
      checkStatus();
    }
  }, [currentTenant?.id, checkStatus]);

  useEffect(() => {
    const stripeStatus = searchParams.get('stripe');
    if (stripeStatus === 'success') {
      toast({
        title: 'Onboarding voltooid!',
        description: 'Je Stripe account is succesvol gekoppeld. Je kunt nu betalingen ontvangen.',
      });
      checkStatus();
      setSearchParams({});
    } else if (stripeStatus === 'refresh') {
      toast({
        title: 'Onboarding verlopen',
        description: 'De onboarding link is verlopen. Klik opnieuw op "Betalingen activeren".',
        variant: 'destructive',
      });
      setSearchParams({});
    }
  }, [searchParams, toast, checkStatus, setSearchParams]);

  const renderStatusBadge = () => {
    if (!status) return null;
    
    if (status.charges_enabled && status.payouts_enabled) {
      return (
        <Badge className="bg-green-500 hover:bg-green-600">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Actief
        </Badge>
      );
    }
    
    if (status.configured && !status.onboarding_complete) {
      return (
        <Badge variant="secondary" className="bg-yellow-500 text-white hover:bg-yellow-600">
          <AlertCircle className="w-3 h-3 mr-1" />
          Onboarding vereist
        </Badge>
      );
    }
    
    if (!status.configured) {
      return (
        <Badge variant="outline">
          Niet geconfigureerd
        </Badge>
      );
    }

    return (
      <Badge variant="secondary">
        <AlertCircle className="w-3 h-3 mr-1" />
        In behandeling
      </Badge>
    );
  };

  const handleCountryChange = async (value: string) => {
    setSelectedCountry(value);
    setIsSavingCountry(true);
    try {
      const { error } = await supabase
        .from('tenants')
        .update({ country: value })
        .eq('id', currentTenant?.id);
      
      if (error) throw error;
      
      await refreshTenants();
      toast({
        title: 'Land opgeslagen',
        description: `Je land is ingesteld op ${SUPPORTED_COUNTRIES.find(c => c.code === value)?.name}.`,
      });
    } catch (error: any) {
      toast({
        title: 'Fout bij opslaan',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSavingCountry(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <CreditCard className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle>Betalingen</CardTitle>
              <CardDescription>
                Configureer online betalingen via Stripe Connect
              </CardDescription>
            </div>
          </div>
          {renderStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Betalingsstatus laden...</p>
          </div>
        ) : status?.charges_enabled && status?.payouts_enabled ? (
          <>
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">Betalingen zijn actief</span>
            </div>
            
            <div className="grid sm:grid-cols-3 gap-4 py-4">
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <Store className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Account ID</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {status.account_id?.slice(0, 20)}...
                  </p>
                </div>
              </div>
              
              {!currentTenant?.is_internal_tenant && (
                <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                  <Percent className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Platform fee</p>
                    <p className="text-xs text-muted-foreground">5% per transactie</p>
                  </div>
                </div>
              )}
              
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <Shield className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Betaalmethodes</p>
                  <p className="text-xs text-muted-foreground">iDEAL, Cards, Bancontact</p>
                </div>
              </div>
            </div>

            <Separator />

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={checkStatus}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Status vernieuwen
              </Button>
              <Button
                variant="outline"
                onClick={openStripeDashboard}
                disabled={isOpeningDashboard}
              >
                {isOpeningDashboard ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4 mr-2" />
                )}
                Stripe Dashboard openen
              </Button>
            </div>
          </>
        ) : status?.configured && !status?.onboarding_complete ? (
          <>
            <div className="flex items-center gap-2 text-yellow-600">
              <AlertCircle className="h-5 w-5" />
              <span className="font-medium">Onboarding niet afgerond</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Je Stripe account is aangemaakt, maar de configuratie is nog niet compleet. 
              Klik hieronder om verder te gaan met de onboarding.
            </p>
            
            {status.requirements?.currently_due && status.requirements.currently_due.length > 0 && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm font-medium text-yellow-800 mb-2">Nog te doen:</p>
                <ul className="list-disc list-inside text-sm text-yellow-700 space-y-1">
                  {status.requirements.currently_due.slice(0, 5).map((req, i) => (
                    <li key={i}>{req.replace(/_/g, ' ')}</li>
                  ))}
                </ul>
              </div>
            )}
            
            <div className="flex gap-3">
              <Button
                onClick={createConnectAccount}
                disabled={isCreatingAccount}
              >
                {isCreatingAccount ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4 mr-2" />
                )}
                Onboarding voltooien
              </Button>
              <Button
                variant="outline"
                onClick={checkStatus}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Status vernieuwen
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Activeer online betalingen om orders te ontvangen via je webshop. 
              We gebruiken Stripe Connect voor veilige betalingsverwerking met automatische uitbetalingen naar je bankrekening.
            </p>
            
            <div className="p-4 border rounded-lg bg-muted/50 space-y-3">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Selecteer je land</p>
              </div>
              <Select
                value={selectedCountry}
                onValueChange={handleCountryChange}
                disabled={isSavingCountry}
              >
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Selecteer land" />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_COUNTRIES.map((country) => (
                    <SelectItem key={country.code} value={country.code}>
                      <span className="flex items-center gap-2">
                        <span>{country.flag}</span>
                        <span>{country.name}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                ⚠️ Let op: het land kan niet worden gewijzigd nadat Stripe Connect is geactiveerd.
              </p>
            </div>

            <Separator />
            
            <div className="grid sm:grid-cols-2 gap-4 py-4">
              <div className="flex items-start gap-3">
                <div className="p-1.5 bg-green-100 rounded-full mt-0.5">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {selectedCountry === 'NL' ? 'iDEAL' : selectedCountry === 'BE' ? 'Bancontact' : 'SEPA'} & Creditcards
                  </p>
                  <p className="text-xs text-muted-foreground">Ondersteun alle populaire betaalmethodes</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-1.5 bg-green-100 rounded-full mt-0.5">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">Automatische uitbetalingen</p>
                  <p className="text-xs text-muted-foreground">Direct naar je bankrekening</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-1.5 bg-green-100 rounded-full mt-0.5">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">Veilig & betrouwbaar</p>
                  <p className="text-xs text-muted-foreground">PCI-DSS gecertificeerd via Stripe</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-1.5 bg-green-100 rounded-full mt-0.5">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">5 minuten setup</p>
                  <p className="text-xs text-muted-foreground">Snel je bankrekening koppelen</p>
                </div>
              </div>
            </div>

            <Button
              onClick={createConnectAccount}
              disabled={isCreatingAccount}
              size="lg"
            >
              {isCreatingAccount ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CreditCard className="h-4 w-4 mr-2" />
              )}
              Betalingen activeren
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
