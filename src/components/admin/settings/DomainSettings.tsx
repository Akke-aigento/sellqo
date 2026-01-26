import { useState } from 'react';
import { Globe, Copy, Check, CheckCircle2, AlertCircle, RefreshCw, Trash2, ExternalLink, Info } from 'lucide-react';
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
import { useTenant } from '@/hooks/useTenant';
import { useDomainVerification } from '@/hooks/useDomainVerification';
import { FeatureGate } from '@/components/FeatureGate';

export function DomainSettings() {
  const { currentTenant } = useTenant();
  const {
    isSaving,
    isVerifying,
    verificationStatus,
    saveDomain,
    verifyDomain,
    removeDomain,
  } = useDomainVerification();

  const [domainInput, setDomainInput] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const customDomain = currentTenant?.custom_domain;
  const domainVerified = currentTenant?.domain_verified;
  const verificationToken = currentTenant?.domain_verification_token;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleSaveDomain = async () => {
    const success = await saveDomain(domainInput);
    if (success) {
      setDomainInput('');
    }
  };

  const dnsRecords = [
    { type: 'A', name: '@', value: '185.158.133.1', description: 'Root domein' },
    { type: 'A', name: 'www', value: '185.158.133.1', description: 'WWW subdomein' },
    { type: 'TXT', name: '_sellqo', value: `sellqo-verify=${verificationToken || 'xxxxx'}`, description: 'Verificatie' },
  ];

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
          {/* Stap 1: Domein invoeren */}
          {!customDomain ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="domain">Domeinnaam</Label>
                <div className="flex gap-2">
                  <Input
                    id="domain"
                    placeholder="mijnwebshop.be"
                    value={domainInput}
                    onChange={(e) => setDomainInput(e.target.value)}
                    className="flex-1"
                  />
                  <Button 
                    onClick={handleSaveDomain} 
                    disabled={!domainInput.trim() || isSaving}
                  >
                    {isSaving ? 'Bezig...' : 'Domein Koppelen'}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Voer je domeinnaam in zonder https:// of www (bijv. mijnwebshop.be)
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Domein Status */}
              <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-3">
                  {domainVerified ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-yellow-500" />
                  )}
                  <div>
                    <p className="font-medium">{customDomain}</p>
                    <p className="text-sm text-muted-foreground">
                      {domainVerified ? 'Domein geverifieerd en actief' : 'Wacht op DNS verificatie'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={domainVerified ? 'default' : 'secondary'}>
                    {domainVerified ? 'Actief' : 'Pending'}
                  </Badge>
                  {domainVerified && (
                    <Button variant="outline" size="icon" asChild>
                      <a href={`https://${customDomain}`} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>

              {/* Stap 2: DNS Records (alleen tonen als niet geverifieerd) */}
              {!domainVerified && (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">DNS Records Configureren</h4>
                      <p className="text-sm text-muted-foreground">
                        Voeg de volgende DNS records toe bij je domeinprovider (bijv. Combell, TransIP, Cloudflare):
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

                  {/* Stap 3: Verificatie */}
                  <Separator />
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
                </>
              )}

              {/* Domein verwijderen */}
              <Separator />
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
                    <AlertDialogAction onClick={removeDomain} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
