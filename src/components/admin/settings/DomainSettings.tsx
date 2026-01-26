import { useState, useEffect } from 'react';
import { Globe, Copy, Check, CheckCircle2, AlertCircle, RefreshCw, Trash2, ExternalLink, Info, Cloud, Settings, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useTenant } from '@/hooks/useTenant';
import { useDomainVerification, ProviderInfo } from '@/hooks/useDomainVerification';
import { FeatureGate } from '@/components/FeatureGate';

type SetupStep = 'input' | 'provider-detected' | 'manual-setup' | 'configured';

export function DomainSettings() {
  const { currentTenant } = useTenant();
  const {
    isSaving,
    isVerifying,
    isDetecting,
    verificationStatus,
    providerInfo,
    saveDomain,
    verifyDomain,
    removeDomain,
    detectProvider,
    initiateCloudflareOAuth,
  } = useDomainVerification();

  const [domainInput, setDomainInput] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [setupStep, setSetupStep] = useState<SetupStep>('input');
  const [isManualOpen, setIsManualOpen] = useState(false);

  const customDomain = currentTenant?.custom_domain;
  const domainVerified = currentTenant?.domain_verified;
  const verificationToken = currentTenant?.domain_verification_token;

  // Determine initial step based on existing domain
  useEffect(() => {
    if (customDomain) {
      if (domainVerified) {
        setSetupStep('configured');
      } else {
        setSetupStep('manual-setup');
      }
    } else {
      setSetupStep('input');
    }
  }, [customDomain, domainVerified]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleDomainCheck = async () => {
    if (!domainInput.trim()) return;
    
    const provider = await detectProvider(domainInput);
    if (provider) {
      setSetupStep('provider-detected');
    }
  };

  const handleAutoConnect = async () => {
    if (!providerInfo || !domainInput.trim()) return;

    // First save the domain
    const saved = await saveDomain(domainInput);
    if (!saved) return;

    if (providerInfo.connect_method === 'cloudflare_oauth') {
      const oauthUrl = await initiateCloudflareOAuth(domainInput);
      if (oauthUrl) {
        window.location.href = oauthUrl;
      } else {
        // Fallback to manual if OAuth not configured
        setSetupStep('manual-setup');
      }
    } else {
      // For other auto-connect methods or fallback
      setSetupStep('manual-setup');
    }
  };

  const handleManualSetup = async () => {
    if (!domainInput.trim()) return;
    
    const saved = await saveDomain(domainInput);
    if (saved) {
      setDomainInput('');
      setSetupStep('manual-setup');
    }
  };

  const handleRemoveDomain = async () => {
    const removed = await removeDomain();
    if (removed) {
      setSetupStep('input');
      setDomainInput('');
    }
  };

  const dnsRecords = [
    { type: 'A', name: '@', value: '185.158.133.1', description: 'Root domein' },
    { type: 'A', name: 'www', value: '185.158.133.1', description: 'WWW subdomein' },
    { type: 'TXT', name: '_sellqo', value: `sellqo-verify=${verificationToken || 'xxxxx'}`, description: 'Verificatie' },
  ];

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'cloudflare':
        return <Cloud className="h-5 w-5 text-orange-500" />;
      default:
        return <Settings className="h-5 w-5 text-muted-foreground" />;
    }
  };

  return (
    <FeatureGate feature="customDomain">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Eigen Domein
          </CardTitle>
          <CardDescription>
            Koppel je eigen domeinnaam aan je webshop voor een professionele uitstraling
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* Step 1: Domain Input */}
          {setupStep === 'input' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="domain">Domeinnaam</Label>
                <div className="flex gap-2">
                  <Input
                    id="domain"
                    placeholder="mijnwebshop.be"
                    value={domainInput}
                    onChange={(e) => setDomainInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleDomainCheck()}
                    className="flex-1"
                  />
                  <Button 
                    onClick={handleDomainCheck} 
                    disabled={!domainInput.trim() || isDetecting}
                  >
                    {isDetecting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Controleren...
                      </>
                    ) : (
                      'Volgende'
                    )}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Voer je domeinnaam in zonder https:// of www (bijv. mijnwebshop.be)
                </p>
              </div>
            </div>
          )}

          {/* Step 2: Provider Detected */}
          {setupStep === 'provider-detected' && providerInfo && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-3">
                  {getProviderIcon(providerInfo.provider)}
                  <div>
                    <p className="font-medium">{domainInput}</p>
                    <p className="text-sm text-muted-foreground">
                      Provider gedetecteerd: {providerInfo.provider_name}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSetupStep('input')}>
                  Wijzigen
                </Button>
              </div>

              {/* Auto Connect Option */}
              {providerInfo.supports_auto_connect && (
                <div className="p-4 rounded-lg border-2 border-primary/20 bg-primary/5">
                  <div className="flex items-start gap-3">
                    {getProviderIcon(providerInfo.provider)}
                    <div className="flex-1 space-y-3">
                      <div>
                        <h4 className="font-medium flex items-center gap-2">
                          Automatisch Koppelen
                          <Badge variant="secondary" className="text-xs">Aanbevolen</Badge>
                        </h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          Je kunt automatisch koppelen via je {providerInfo.provider_name} account.
                          Wij voegen alleen de benodigde DNS records toe.
                        </p>
                      </div>
                      <Button onClick={handleAutoConnect} disabled={isSaving}>
                        {isSaving ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Bezig...
                          </>
                        ) : (
                          <>
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Inloggen bij {providerInfo.provider_name}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Manual Setup Option */}
              <Collapsible open={isManualOpen || !providerInfo.supports_auto_connect} onOpenChange={setIsManualOpen}>
                <div className="p-4 rounded-lg border">
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between cursor-pointer">
                      <div className="flex items-center gap-3">
                        <Settings className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <h4 className="font-medium">
                            {providerInfo.supports_auto_connect ? 'Liever handmatig configureren?' : 'Handmatige Configuratie'}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {providerInfo.supports_auto_connect 
                              ? 'Kopieer de DNS records naar je domeinprovider'
                              : `Voor ${providerInfo.provider_name} moet je de DNS records handmatig toevoegen`
                            }
                          </p>
                        </div>
                      </div>
                      {providerInfo.supports_auto_connect && (
                        <Button variant="ghost" size="sm">
                          {isManualOpen ? 'Verbergen' : 'Tonen'}
                        </Button>
                      )}
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-4">
                    <Button onClick={handleManualSetup} disabled={isSaving} variant="outline">
                      {isSaving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Bezig...
                        </>
                      ) : (
                        'Start Handmatige Configuratie'
                      )}
                    </Button>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            </div>
          )}

          {/* Step 3: Manual Setup / DNS Configuration */}
          {(setupStep === 'manual-setup' || (customDomain && !domainVerified)) && (
            <>
              {/* Domain Status */}
              <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-yellow-500" />
                  <div>
                    <p className="font-medium">{customDomain}</p>
                    <p className="text-sm text-muted-foreground">
                      Wacht op DNS verificatie
                    </p>
                  </div>
                </div>
                <Badge variant="secondary">Pending</Badge>
              </div>

              <Separator />

              {/* DNS Records */}
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">DNS Records Configureren</h4>
                  <p className="text-sm text-muted-foreground">
                    Voeg de volgende DNS records toe bij je domeinprovider:
                  </p>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium">Type</th>
                        <th className="px-4 py-2 text-left font-medium">Naam</th>
                        <th className="px-4 py-2 text-left font-medium">Waarde</th>
                        <th className="px-4 py-2 text-left font-medium w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {dnsRecords.map((record, index) => (
                        <tr key={index} className="border-t">
                          <td className="px-4 py-3">
                            <Badge variant="outline">{record.type}</Badge>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs">{record.name}</td>
                          <td className="px-4 py-3 font-mono text-xs break-all">{record.value}</td>
                          <td className="px-4 py-3">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => copyToClipboard(record.value, `record-${index}`)}
                            >
                              {copied === `record-${index}` ? (
                                <Check className="h-4 w-4 text-green-500" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>DNS Propagatie</AlertTitle>
                  <AlertDescription>
                    DNS wijzigingen kunnen tot 48 uur duren om wereldwijd door te voeren. 
                    Dit is normaal en verschilt per provider.
                  </AlertDescription>
                </Alert>
              </div>

              <Separator />

              {/* Verification */}
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Verificatie Status</h4>
                  {verificationStatus && (
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        {verificationStatus.a_record_valid ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-yellow-500" />
                        )}
                        <span>
                          A-record: {verificationStatus.a_record_valid ? 'Correct' : 'Niet gevonden'}
                          {verificationStatus.current_a_record && !verificationStatus.a_record_valid && (
                            <span className="text-muted-foreground ml-1">
                              (gevonden: {verificationStatus.current_a_record})
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {verificationStatus.txt_record_valid ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-yellow-500" />
                        )}
                        <span>
                          TXT-record: {verificationStatus.txt_record_valid ? 'Correct' : 'Niet gevonden'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <Button onClick={verifyDomain} disabled={isVerifying}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${isVerifying ? 'animate-spin' : ''}`} />
                  {isVerifying ? 'Controleren...' : 'DNS Controleren'}
                </Button>
              </div>

              <Separator />

              {/* Remove Domain */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Domein Verwijderen
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Domein loskoppelen?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Weet je zeker dat je {customDomain} wilt loskoppelen? 
                      Je webshop zal alleen nog bereikbaar zijn via de standaard Sellqo URL.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuleren</AlertDialogCancel>
                    <AlertDialogAction onClick={handleRemoveDomain} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Verwijderen
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}

          {/* Step 4: Verified / Active */}
          {setupStep === 'configured' && domainVerified && (
            <>
              <div className="flex items-center justify-between p-4 rounded-lg border bg-green-50 dark:bg-green-950/20">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium">{customDomain}</p>
                    <p className="text-sm text-muted-foreground">
                      Domein geverifieerd en actief
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-500">Actief</Badge>
                  <Button variant="outline" size="icon" asChild>
                    <a href={`https://${customDomain}`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Remove Domain */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Domein Verwijderen
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Domein loskoppelen?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Weet je zeker dat je {customDomain} wilt loskoppelen? 
                      Je webshop zal alleen nog bereikbaar zijn via de standaard Sellqo URL.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuleren</AlertDialogCancel>
                    <AlertDialogAction onClick={handleRemoveDomain} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Verwijderen
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </CardContent>
      </Card>
    </FeatureGate>
  );
}
