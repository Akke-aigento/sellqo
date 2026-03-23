import { useState } from 'react';
import { Copy, Check, Loader2, Search, ShieldCheck, AlertTriangle, ChevronDown, Key } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DomainProgressSteps, type DomainStep } from '@/components/admin/settings/DomainProgressSteps';
import { ProviderInstructions } from '@/components/admin/settings/ProviderInstructions';
import { useDomainVerificationMulti } from '@/hooks/useDomainVerificationMulti';
import type { TenantDomain } from '@/hooks/useTenantDomains';

interface DomainVerificationPanelProps {
  domain: TenantDomain;
}

export function DomainVerificationPanel({ domain }: DomainVerificationPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [cfToken, setCfToken] = useState('');
  
  const {
    isVerifying, isDetecting, isConnecting, isPolling,
    verificationStatus, providerInfo, sslStatus,
    verifyDomain, checkSSL, detectProvider,
    connectWithApiToken, startPolling, stopPolling,
  } = useDomainVerificationMulti(domain);

  const handleOpen = (open: boolean) => {
    setIsOpen(open);
    if (open && !providerInfo) {
      detectProvider();
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const getCurrentStep = (): DomainStep => {
    if (domain.ssl_active || sslStatus?.ssl_active) return 'live';
    if (domain.dns_verified) return 'ssl-active';
    return 'domain-saved';
  };

  const dnsRecords = [
    { type: 'A', name: '@', value: '185.158.133.1', description: 'Root domein' },
    { type: 'A', name: 'www', value: '185.158.133.1', description: 'WWW subdomain' },
    { type: 'TXT', name: '_sellqo', value: `sellqo-verify=${domain.verification_token || ''}`, description: 'Verificatie' },
  ];

  return (
    <Collapsible open={isOpen} onOpenChange={handleOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex items-center gap-1 text-sm hover:underline">
          <DomainStatusBadge domain={domain} sslActive={sslStatus?.ssl_active} />
          <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-3 space-y-4 p-4 rounded-lg border bg-muted/30">
          {/* Progress Steps */}
          <DomainProgressSteps currentStep={getCurrentStep()} isPolling={isPolling} />

          {/* DNS Records Table */}
          {!domain.dns_verified && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium">DNS Records instellen</h4>
              <p className="text-xs text-muted-foreground">
                Voeg deze records toe bij je domeinprovider. DNS-propagatie kan tot 48 uur duren.
              </p>
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="px-3 py-2 text-left font-medium">Type</th>
                      <th className="px-3 py-2 text-left font-medium">Naam</th>
                      <th className="px-3 py-2 text-left font-medium">Waarde</th>
                      <th className="px-3 py-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {dnsRecords.map((record, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-3 py-2">
                          <Badge variant="outline" className="text-xs">{record.type}</Badge>
                        </td>
                        <td className="px-3 py-2 font-mono">{record.name}</td>
                        <td className="px-3 py-2 font-mono text-xs break-all">{record.value}</td>
                        <td className="px-3 py-2">
                          <Button
                            variant="ghost" size="icon" className="h-6 w-6"
                            onClick={() => copyToClipboard(record.value, `${record.type}-${record.name}`)}
                          >
                            {copiedField === `${record.type}-${record.name}` 
                              ? <Check className="h-3 w-3 text-emerald-500" /> 
                              : <Copy className="h-3 w-3" />}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Verification status errors */}
              {verificationStatus && !verificationStatus.success && (
                <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-xs">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">{verificationStatus.error}</p>
                    {verificationStatus.error_details && (
                      <p className="mt-1 text-destructive/80">{verificationStatus.error_details}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Provider Instructions */}
              {isDetecting && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Provider detecteren...
                </div>
              )}
              {providerInfo && providerInfo.provider !== 'unknown' && (
                <>
                  <ProviderInstructions provider={providerInfo.provider} domain={domain.domain} />
                  
                  {/* Cloudflare auto-connect */}
                  {providerInfo.supports_auto_connect && (
                    <div className="p-3 rounded-md border border-primary/20 bg-primary/5 space-y-2">
                      <p className="text-xs font-medium flex items-center justify-between">
                        <span className="flex items-center gap-1"><Key className="h-3 w-3" /> Cloudflare automatisch koppelen</span>
                        <a href="/admin/settings?section=documentation" className="text-xs text-primary hover:underline font-normal">Hoe werkt dit? →</a>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Voer je Cloudflare API Token in om DNS automatisch te configureren.
                      </p>
                      <div className="flex gap-2">
                        <Input
                          type="password" placeholder="Cloudflare API Token"
                          value={cfToken} onChange={e => setCfToken(e.target.value)}
                          className="h-8 text-xs"
                        />
                        <Button
                          size="sm" className="h-8"
                          onClick={() => connectWithApiToken(cfToken)}
                          disabled={isConnecting || !cfToken.trim()}
                        >
                          {isConnecting ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Koppel'}
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Verify Button */}
              <div className="flex gap-2">
                <Button
                  size="sm" onClick={() => verifyDomain()}
                  disabled={isVerifying || isPolling}
                >
                  {isVerifying ? (
                    <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Controleren...</>
                  ) : (
                    <><Search className="h-4 w-4 mr-1" /> DNS Controleren</>
                  )}
                </Button>
                {!isPolling ? (
                  <Button size="sm" variant="outline" onClick={startPolling}>
                    Automatisch checken
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={stopPolling}>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Stop polling
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* DNS verified but no SSL yet */}
          {domain.dns_verified && !domain.ssl_active && !sslStatus?.ssl_active && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                DNS is geverifieerd. SSL-certificaat wordt gecontroleerd...
              </p>
              <Button size="sm" onClick={checkSSL}>
                <ShieldCheck className="h-4 w-4 mr-1" /> SSL Controleren
              </Button>
            </div>
          )}

          {/* Everything active */}
          {domain.dns_verified && (domain.ssl_active || sslStatus?.ssl_active) && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
              ✓ Domein is volledig actief met HTTPS
            </p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function DomainStatusBadge({ domain, sslActive }: { domain: TenantDomain; sslActive?: boolean }) {
  if (domain.ssl_active || sslActive) {
    return (
      <Badge variant="outline" className="text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700 gap-1">
        <ShieldCheck className="h-3 w-3" /> SSL actief
      </Badge>
    );
  }
  if (domain.dns_verified) {
    return (
      <Badge variant="outline" className="text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700">
        Geverifieerd
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-yellow-600 dark:text-yellow-400 border-yellow-300 dark:border-yellow-700">
      DNS niet geverifieerd
    </Badge>
  );
}
